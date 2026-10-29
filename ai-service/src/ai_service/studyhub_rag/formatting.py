def format_docs(docs):
    if not docs:
        return "NO_CONTEXT_RETRIEVED"
    seen, chunks = set(), []
    for doc in docs:
        text = doc.page_content.replace("</context>", "").strip()
        if text and text not in seen:
            seen.add(text)
            chunks.append(text)
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
            "page": meta.get("page"),
            "subject": meta.get("subject"),
            "year": meta.get("year"),
            "category": meta.get("category"),
            "score": round(score, 4) if isinstance(score, (int, float)) else None,
        })
    return sources