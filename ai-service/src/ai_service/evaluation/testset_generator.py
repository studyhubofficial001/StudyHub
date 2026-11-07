"""evaluation/testset_generator.py: builds the question set that evaluate.py scores.

Run from the ai_service folder:
    python -m evaluation.testset_generator --pages 30 --size 20
    python -m evaluation.testset_generator --pages 30 --size 20 --subject DBMS

What it does:
    1. Picks random pages from your Qdrant collection (optionally one subject / one resource).
    2. Rebuilds each page's text from its chunks.
    3. Asks the judge model (via Ragas) to write questions + reference answers from those pages.
    4. Saves them to evaluation/data/testset.jsonl.

Run it again only when your documents change. Keep --pages small (20-40): every page costs
several judge calls and several embedding calls on free tiers.
"""
import argparse
import json
import sys
from pathlib import Path

from langchain_core.documents import Document
from qdrant_client import models

from evaluation.common import DEFAULT_TESTSET, ragas_models, run_config
from studyhub_rag.retriever import build_filter
from studyhub_rag.vectorstore import COLLECTION_NAME, get_client

MIN_PAGE_CHARS = 500  # near-empty pages (cover, index, blank) make bad questions


def load_pages(n_pages: int, filters: dict) -> list[Document]:
    """Random pages from Qdrant, each rebuilt from its chunks (in reading order)."""
    client = get_client()
    flt = build_filter(filters)

    sample = client.query_points(
        collection_name=COLLECTION_NAME,
        query=models.SampleQuery(sample=models.Sample.RANDOM),
        query_filter=flt,
        limit=n_pages * 6,  # oversample: several random chunks may land on the same page
        with_payload=True,
        with_vectors=False,
    ).points

    seen: list[tuple[str, int]] = []
    for point in sample:
        meta = (point.payload or {}).get("metadata") or {}
        key = (meta.get("resource_id"), meta.get("page"))
        if None not in key and key not in seen:
            seen.append(key)

    pages: list[Document] = []
    for resource_id, page in seen:
        if len(pages) >= n_pages:
            break
        points, _ = client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=models.Filter(must=[
                models.FieldCondition(key="metadata.resource_id", match=models.MatchValue(value=resource_id)),
                models.FieldCondition(key="metadata.page", match=models.MatchValue(value=page)),
            ]),
            limit=50,
            with_payload=True,
            with_vectors=False,
        )
        points.sort(key=lambda p: (p.payload.get("metadata") or {}).get("chunk_index", 0))
        text = "\n".join((p.payload or {}).get("page_content", "") for p in points).strip()
        if len(text) < MIN_PAGE_CHARS:
            continue
        meta = dict((points[0].payload or {}).get("metadata") or {})
        pages.append(Document(page_content=text, metadata=meta))
    return pages


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pages", type=int, default=30, help="how many pages to read from Qdrant")
    ap.add_argument("--size", type=int, default=20, help="how many questions to generate")
    ap.add_argument("--subject")
    ap.add_argument("--year")
    ap.add_argument("--category")
    ap.add_argument("--resource-id")
    ap.add_argument("--out", type=Path, default=DEFAULT_TESTSET)
    args = ap.parse_args()

    filters = {k: v for k, v in {
        "subject": args.subject, "year": args.year,
        "category": args.category, "resource_id": args.resource_id,
    }.items() if v}

    print(f"reading up to {args.pages} random pages from Qdrant {filters or ''}...")
    docs = load_pages(args.pages, filters)
    if len(docs) < 3:
        sys.exit(f"only {len(docs)} usable pages found: check the filters, or that this collection has data")
    print(f"got {len(docs)} pages. generating {args.size} questions (this takes a few minutes)...")

    from ragas.testset import TestsetGenerator
    from ragas.testset.graph import Node
    from ragas.testset.transforms import HeadlineSplitter, default_transforms

    llm, embeddings = ragas_models()
    generator = TestsetGenerator(llm=llm, embedding_model=embeddings)
    transforms = default_transforms(docs, llm, embeddings)

    def has_headlines(node: Node) -> bool:
        return node.get_property("headlines") is not None

    for transform in transforms:
        if isinstance(transform, HeadlineSplitter):
            transform.filter_nodes = has_headlines

    testset = generator.generate_with_langchain_docs(
        docs,
        testset_size=args.size,
        transforms=transforms,
        run_config=run_config(),
        raise_exceptions=False,  # applies to question generation, not transform preprocessing
    )

    df = testset.to_pandas()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as f:
        for row in df.to_dict(orient="records"):
            f.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
    print(f"saved {len(df)} questions to {args.out}")
    print(df[["user_input", "reference"]].head(5).to_string(max_colwidth=70))


if __name__ == "__main__":
    main()
