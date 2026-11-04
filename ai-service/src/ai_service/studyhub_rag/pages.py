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
import re
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


def _read_page(client: QdrantClient, collection: str, resource_id, page) -> str | None:
    """The full text of one page (all its chunks, in order, overlap removed). None if it has no text."""
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
        return None
    chunks.sort(key=lambda c: c[0])
    return _join([c[1] for c in chunks])


def _load_page(client: QdrantClient, collection: str, doc: Document) -> Document:
    """All chunks of the page this chunk belongs to, as one Document. Falls back to `doc` itself."""
    resource_id, page = _page_key(doc)
    if resource_id is None or page is None:
        return doc
    try:
        full = _read_page(client, collection, resource_id, page)
        if not full or len(full) < len(doc.page_content):  # never return less than we already had
            return doc
        return Document(page_content=full, metadata=dict(doc.metadata))
    except Exception:
        log.warning("could not read the full page; using the chunk only", exc_info=True)
        return doc


# ---------------------------------------------------------------- pages that continue on the next page
MAX_NEIGHBOUR_PAGES = 2   # how many following pages may be added to finish a cut-off page
_OPEN_ENDINGS = (",", ":", "(", "-", " and", " or", " the", " of", " to")


def _ends_open(text: str) -> bool:
    """True when the text looks cut off at the bottom of the page: an unclosed { or (, or a line that stops mid-sentence."""
    if text.count("{") > text.count("}") or text.count("(") > text.count(")"):
        return True
    lines = [line.rstrip() for line in text.splitlines() if line.strip()]
    return bool(lines) and lines[-1].lower().endswith(_OPEN_ENDINGS)


def _starts_inside(text: str) -> bool:
    """True when the page begins in the middle of a code block: it closes more { than it opens."""
    return text.count("}") > text.count("{")


def _page_doc(source: Document, page: int, text: str) -> Document:
    meta = dict(source.metadata or {})
    meta["page"] = page
    meta.pop("relevance_score", None)   # a neighbour page was not ranked, it was added to finish another page
    return Document(page_content=text, metadata=meta)


def _add_neighbours(client, collection, kept: list[Document], max_tokens: int) -> list[Document]:
    """Add the next page when a kept page is cut off at the bottom (a program or list that continues),
    and the previous page when a kept page starts in the middle of a code block."""
    have = {_page_key(p): p for p in kept}
    used = sum(len(p.page_content) * 2 // 7 + 1 for p in kept)
    extra: list[Document] = []

    def fetch(source: Document, rid, number: int) -> Document | None:
        nonlocal used
        if (rid, number) in have or number < 1:
            return None
        try:
            text = _read_page(client, collection, rid, number)
        except Exception:
            log.warning("could not read neighbour page %s", number, exc_info=True)
            return None
        if not text or used + len(text) * 2 // 7 + 1 > max_tokens:
            return None
        doc = _page_doc(source, number, text)
        have[(rid, number)] = doc
        extra.append(doc)
        used += len(text) * 2 // 7 + 1
        return doc

    for page in list(kept):
        rid, number = _page_key(page)
        if rid is None or not isinstance(number, int):
            continue
        text, cur = page.page_content, number
        for _ in range(MAX_NEIGHBOUR_PAGES):                 # forward: finish the program / list
            if not _ends_open(text):
                break
            nxt = have.get((rid, cur + 1)) or fetch(page, rid, cur + 1)
            if nxt is None:
                break
            text, cur = text + "\n" + nxt.page_content, cur + 1
        if _starts_inside(page.page_content):                # backward: the code started on the page before
            fetch(page, rid, number - 1)
    return kept + extra


# ---------------------------------------------------------------- long answers: keep reading after the best page
_NEW_CHAPTER = re.compile(r"^\s*Chapter\s*\|?\s*\d+\b", re.IGNORECASE)


def _read_on(client, collection, kept: list[Document], slots: int, max_tokens: int) -> list[Document]:
    """A topic usually continues on the pages after the page that names it (a list of applications on one page, the
    explanation of each item on the next pages). The reranker scores those explanation pages low because they do not
    repeat the question's words, so they are added here, in order, right after the best page, until `slots` pages are
    used, the context is full, or a new chapter starts."""
    if slots <= 0 or not kept:
        return []
    best = kept[0]                                  # kept is still ordered best first
    rid, number = _page_key(best)
    if rid is None or not isinstance(number, int):
        return []
    have = {_page_key(p) for p in kept}
    used = sum(len(p.page_content) * 2 // 7 + 1 for p in kept)
    extra: list[Document] = []
    cur = number
    while have and (rid, cur + 1) in have:          # start after the last page already kept in this run
        cur += 1
    while len(extra) < slots:
        cur += 1
        if (rid, cur) in have:
            continue
        try:
            text = _read_page(client, collection, rid, cur)
        except Exception:
            log.warning("could not read page %s", cur, exc_info=True)
            break
        if not text or _NEW_CHAPTER.match(text):
            break                                   # end of the book, an empty page, or the next chapter begins
        cost = len(text) * 2 // 7 + 1
        if used + cost > max_tokens:
            break
        extra.append(_page_doc(best, cur, text))
        used += cost
    return extra


def expand_to_pages(
    client: QdrantClient,
    collection: str,
    docs: list[Document],
    max_pages: int,
    max_tokens: int,
    min_ratio: float = 0.0,
    read_on: bool = False,
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

    kept = _add_neighbours(client, collection, kept, max_tokens)
    if read_on:
        kept = kept + _read_on(client, collection, kept, max_pages - len(kept), max_tokens)

    # Reading order: a page that continues a list must come right after the page it continues.
    first_seen = {}
    for page in kept:
        first_seen.setdefault((page.metadata or {}).get("resource_id"), len(first_seen))

    def order(page):
        meta = page.metadata or {}
        number = meta.get("page")
        return first_seen[meta.get("resource_id")], number if isinstance(number, (int, float)) else 0

    return sorted(kept, key=order)