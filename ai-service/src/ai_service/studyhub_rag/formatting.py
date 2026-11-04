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


def _head_key(line: str) -> str:
    """'Introduction to OOP | 1.3' and 'Introduction to OOP | 1.5' are the same running header: compare without numbers."""
    return re.sub(r"[\d.|]+", " ", line).strip().lower()


def _is_head(line: str) -> bool:
    line = line.strip()
    return bool(_RUNNING_HEAD.match(line) or _RUNNING_HEAD_NUM_FIRST.match(line))


def running_headers(texts: list[str]) -> set[str]:
    """A header line that shows up on two or more of the pages is page furniture. A line that shows up once might be a
    real section heading ("1.5 | Applications"), so it is never deleted: content must never be lost."""
    counts: dict[str, int] = {}
    for text in texts:
        for key in {_head_key(ln) for ln in text.split("\n") if _is_head(ln)}:
            counts[key] = counts.get(key, 0) + 1
    return {key for key, n in counts.items() if n >= 2}


def clean_page_text(text: str, headers: set[str] | None = None) -> str:
    """Remove the repeated running headers, the page number printed next to them, and LaTeX wrappers."""
    headers = headers or set()
    lines = text.split("\n")
    filled = [i for i, ln in enumerate(lines) if ln.strip()]
    heads = {i for i in filled if _is_head(lines[i]) and _head_key(lines[i]) in headers}
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
    raw = [doc.page_content.replace("</context>", "") for doc in docs]
    headers = running_headers(raw)
    for doc, body in zip(docs, raw):
        text = clean_page_text(body, headers)
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