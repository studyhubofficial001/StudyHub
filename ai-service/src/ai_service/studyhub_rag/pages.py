"""studyhub_rag/pages.py: turn the best chunks into the whole pages they came from.

Why: ingestion cuts every PDF page into ~480-token chunks. Only the first chunk of a page carries the
page's heading ("Phase 1 - Typed Python for APIs"), so a question about that heading finds chunk 1 and
the rest of the page (the other chunks) never reaches the model. The answer then silently stops early.

What: for each page that the reranker liked, read ALL of that page's chunks from Qdrant (a plain filtered
read: no embedding, no model, very little RAM), join them in order, and cut the 80-token overlap that
ingestion repeated between neighbours. The model then sees the page exactly as it was in the PDF.

If anything fails, the original chunks are used, so answering never breaks because of this step.
"""
import logging
from concurrent.futures import ThreadPoolExecutor

from langchain_core.documents import Document
from qdrant_client import QdrantClient, models

log = logging.getLogger(__name__)

MIN_OVERLAP = 20      # characters; a shorter match is a coincidence, not ingestion's overlap
MAX_OVERLAP = 2000    # 80 tokens is roughly 400 chars; this leaves a wide margin
MAX_CHUNKS_PER_PAGE = 200


def _join(parts: list[str]) -> str:
    """Join consecutive chunks, removing the text repeated between them (chunk overlap)."""
    text = parts[0]
    for nxt in parts[1:]:
        tail = text[-MAX_OVERLAP:]
        cut = 0
        for k in range(min(len(tail), len(nxt), MAX_OVERLAP), MIN_OVERLAP - 1, -1):
            if tail.endswith(nxt[:k]):
                cut = k
                break
        text = text + (nxt[cut:] if cut else "\n" + nxt)
    return text


def _page_key(doc: Document):
    meta = doc.metadata or {}
    return meta.get("resource_id"), meta.get("page")


def _load_page(client: QdrantClient, collection: str, doc: Document) -> Document:
    """All chunks of the page this chunk belongs to, as one Document. Falls back to `doc` itself."""
    resource_id, page = _page_key(doc)
    if resource_id is None or page is None:
        return doc
    try:
        records, _ = client.scroll(
            collection_name=collection,
            scroll_filter=models.Filter(must=[
                models.FieldCondition(key="metadata.resource_id", match=models.MatchValue(value=resource_id)),
                models.FieldCondition(key="metadata.page", match=models.MatchValue(value=page)),
            ]),
            limit=MAX_CHUNKS_PER_PAGE,
            with_payload=True,
            with_vectors=False,
        )
        chunks = []
        for rec in records:
            payload = rec.payload or {}
            text = (payload.get("page_content") or "").strip()
            index = (payload.get("metadata") or {}).get("chunk_index")
            if text:
                chunks.append((index if isinstance(index, (int, float)) else 0, text))
        if not chunks:
            return doc
        chunks.sort(key=lambda c: c[0])
        full = _join([c[1] for c in chunks])
        if len(full) < len(doc.page_content):  # never return less than we already had
            return doc
        return Document(page_content=full, metadata=dict(doc.metadata))
    except Exception:
        log.warning("could not read the full page; using the chunk only", exc_info=True)
        return doc


def expand_to_pages(
    client: QdrantClient,
    collection: str,
    docs: list[Document],
    max_pages: int,
    max_tokens: int,
    min_ratio: float = 0.0,
) -> list[Document]:
    """Best-ranked chunks in, whole pages out, in reading order (document by document, page 1, 2, 3...).

    max_pages  : the most pages to keep (a limit, not a target)
    max_tokens : stop adding pages once the context would pass this size (estimated, 1 token ~ 3.5 chars)
    min_ratio  : drop a page whose best rerank score is below min_ratio x the top page's score, so pages that
                 only look a little related (another phase, another project) are not sent to the model
    """
    if not docs or max_pages <= 0:
        return docs

    best: dict = {}                    # (resource_id, page) -> highest-ranked chunk of that page
    for doc in docs:                   # `docs` is already ordered best first
        key = _page_key(doc)
        if key not in best and len(best) < max_pages:
            best[key] = doc
    chosen = list(best.values())

    scores = [(d.metadata or {}).get("relevance_score") for d in chosen]
    if min_ratio > 0 and all(isinstance(x, (int, float)) for x in scores) and scores and scores[0] > 0:
        chosen = [d for d, sc in zip(chosen, scores) if sc >= min_ratio * scores[0]]  # chosen[0] is always kept

    with ThreadPoolExecutor(max_workers=min(len(chosen), 4)) as pool:
        pages = list(pool.map(lambda d: _load_page(client, collection, d), chosen))

    kept, used = [], 0
    for page in pages:                 # best page first; the first page is always kept
        cost = len(page.page_content) * 2 // 7 + 1
        if kept and used + cost > max_tokens:
            continue
        kept.append(page)
        used += cost

    # Reading order: a page that continues a list must come right after the page it continues.
    first_seen = {}
    for page in kept:
        first_seen.setdefault((page.metadata or {}).get("resource_id"), len(first_seen))

    def order(page):
        meta = page.metadata or {}
        number = meta.get("page")
        return first_seen[meta.get("resource_id")], number if isinstance(number, (int, float)) else 0

    return sorted(kept, key=order)