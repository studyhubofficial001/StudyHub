"""studyhub_rag/formatting.py: how retrieved pages are shown to the model and to the student.

Every page gets a SOURCE line (title, subject, year, category, page) taken from the resource metadata. A paper
called "java pyq 2025" often never says "2025" in its text, so the model and the reranker are given the name.
"""


def source_header(meta: dict | None) -> str:
    """One line such as: SOURCE: java pyq 2025 | subject: Java | year: 2025 | category: PYQ | page 1"""
    meta = meta or {}
    parts = []
    for label, key in (("", "title"), ("subject", "subject"), ("year", "year"), ("category", "category")):
        value = meta.get(key)
        if value not in (None, ""):
            parts.append(f"{label}: {value}" if label else str(value))
    if meta.get("page"):
        parts.append(f"page {meta['page']}")
    return "SOURCE: " + (" | ".join(parts) if parts else "unknown")


def format_docs(docs):
    if not docs:
        return "NO_CONTEXT_RETRIEVED"
    seen, chunks = set(), []
    for doc in docs:
        text = doc.page_content.replace("</context>", "").strip()
        if text and text not in seen:
            seen.add(text)
            chunks.append(f"{source_header(doc.metadata)}\n{text}")
    return "\n\n---\n\n".join(chunks) if chunks else "NO_CONTEXT_RETRIEVED"


def build_sources(docs) -> list[dict]:
    sources, seen = [], set()
    for doc in docs:
        meta = doc.metadata or {}
        key = (meta.get("resource_id"), meta.get("page"))
        if key in seen:
            continue
        seen.add(key)
        score = meta.get("relevance_score")
        sources.append({
            "resource_id": meta.get("resource_id"),
            "title": meta.get("title"),
            "page": meta.get("page"),
            "subject": meta.get("subject"),
            "year": meta.get("year"),
            "category": meta.get("category"),
            "score": round(score, 4) if isinstance(score, (int, float)) else None,
        })
    return sources