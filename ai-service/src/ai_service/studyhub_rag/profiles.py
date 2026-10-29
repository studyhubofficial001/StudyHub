import re
from dataclasses import dataclass

from studyhub_rag.config import settings


@dataclass(frozen=True)
class Profile:
    marks: int | None
    tokens: int   # answer length target, per question
    words: int
    pages: float
    k: int        # chunks fetched by hybrid search, per question
    top_n: int    # chunks kept after Cohere rerank, per question (longer answers need more material)
    style: str    # structure hint given to the model


PROFILES: dict[int | None, Profile] = {
    16: Profile(16, 3584, 2688, 6, 40, 12,
                "An introduction, 5 to 8 headed sections that cover every aspect the context contains in depth "
                "(definitions, working, examples, advantages, limitations where the context mentions them), and a conclusion."),
    8: Profile(8, 2560, 1920, 4, 30, 9,
               "An introduction, 3 to 5 headed sections, an example if the context has one, and a short conclusion."),
    5: Profile(5, 1536, 1152, 3, 20, 7,
               "A definition, the main points with a short explanation each, and a small example if the context has one. "
               "Use headings only if they help."),
    3: Profile(3, 1024, 768, 1.5, 15, 5,
               "A direct definition followed by the key points in short paragraphs. No headings."),
    # no marks selected: the short, strict answer your original prompt produces
    None: Profile(None, 350, 260, 0.5, 20, 7, ""),
}


def get_profile(marks: int | None) -> Profile:
    return PROFILES.get(marks) or PROFILES[None]


def est_tokens(text: str) -> int:
    """Cheap token estimate (no tokenizer, no RAM). Slightly high on purpose: 1 token ~ 3.5 characters."""
    return len(text) * 2 // 7 + 1


_NUMBERED = re.compile(
    r"^[ \t]*(?:Q(?:uestion)?[ \t]*\.?[ \t]*)?\d+[ \t]*[\).:\-][ \t]+"   # "1. ", "2) ", "Q3: " at the start of a line
    r"|\bQ(?:uestion)?[ \t]*\.?[ \t]*\d+[ \t]*[\).:\-][ \t]+",          # "Q1. ... Q2. ..." on one line
    re.IGNORECASE | re.MULTILINE,
)


def split_questions(text: str) -> tuple[list[str], bool]:
    text = text.strip()
    limit = settings.max_questions

    starts = [m.start() for m in _NUMBERED.finditer(text)]
    if len(starts) >= 2:
        parts = [text[a:b].strip() for a, b in zip(starts, starts[1:] + [len(text)])]
        parts = [_NUMBERED.sub("", p, count=1).strip() for p in parts]
        parts = [p for p in parts if p]
    else:
        parts = [p.strip() for p in re.split(r"(?<=\?)\s+", text) if p.strip()]
        if not (len(parts) >= 2 and all(p.endswith("?") for p in parts)):
            parts = [text]

    return parts[:limit], len(parts) > limit