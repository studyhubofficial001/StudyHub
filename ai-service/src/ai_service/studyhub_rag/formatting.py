"""studyhub_rag/formatting.py: how retrieved pages are shown to the model and to the student.

Every page gets a SOURCE line (title, subject, year, category, page) taken from the resource metadata. A paper
called "java pyq 2025" often never says "2025" in its text, so the model and the reranker are given the name.
"""
import re


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


# ---- scanned books carry page furniture. None of it is content, and a model that is told to "reproduce the
# context" copies it into the answer ("Introduction to Object-Oriented Programming | 1.3", stray "1.4", ...).
_RUNNING_HEAD = re.compile(r"^[A-Za-z][\w\-,:'’ ]{5,80}\s\|\s*\d{1,3}(?:\.\d{1,3})?$")      # Title of chapter | 1.3
_RUNNING_HEAD_NUM_FIRST = re.compile(r"^\d{1,3}(?:\.\d{1,3})?\s*\|\s*[A-Za-z][\w\-,:'’ ]{5,80}$")  # 1.2 | Title of chapter
_SECTION_NUMBER_ONLY = re.compile(r"^\d{1,2}\.\d{1,2}$")                                      # a lone 1.4 (page number of a book)
_LATEX_TEXT = re.compile(r"\\text\{([^}]*)\}")


def clean_page_text(text: str) -> str:
    """Remove running headers/footers, the page number printed next to them, and LaTeX wrappers from one page of notes.
    A lone number like 3.14 is removed only when it sits right next to a running header, so program output is safe."""
    lines = text.split("\n")
    filled = [i for i, ln in enumerate(lines) if ln.strip()]
    heads = {i for i in filled if _RUNNING_HEAD.match(lines[i].strip()) or _RUNNING_HEAD_NUM_FIRST.match(lines[i].strip())}
    drop = set(heads)
    for pos, i in enumerate(filled):
        if _SECTION_NUMBER_ONLY.match(lines[i].strip()):
            near = [filled[q] for q in (pos - 1, pos + 1) if 0 <= q < len(filled)]
            if any(n in heads for n in near):
                drop.add(i)
    out = "\n".join(ln for i, ln in enumerate(lines) if i not in drop)
    out = _LATEX_TEXT.sub(r"\1", out).replace("$$", "")
    return re.sub(r"\n{3,}", "\n\n", out).strip()


def format_docs(docs):
    if not docs:
        return "NO_CONTEXT_RETRIEVED"
    seen, chunks = set(), []
    for doc in docs:
        text = clean_page_text(doc.page_content.replace("</context>", ""))
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