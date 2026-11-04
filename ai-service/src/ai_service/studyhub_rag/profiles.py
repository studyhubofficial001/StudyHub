"""studyhub_rag/profiles.py: how long an answer should be for each marks value, and how many questions a message has.

Lengths are for ONE question, single-spaced A4:
    16 marks: 3584 tokens, 2688 words, 6 pages
     8 marks: 2560 tokens, 1920 words, 4 pages
     5 marks: 1536 tokens, 1152 words, 3 pages
     3 marks: 1024 tokens,  768 words, 1.5 pages
"""
import math
import re
from dataclasses import dataclass, replace

from studyhub_rag.config import settings


@dataclass(frozen=True)
class Profile:
    marks: int | None
    tokens: int   # answer length target, per question
    words: int
    pages: float
    k: int        # chunks fetched by hybrid search, per question
    top_n: int    # chunks kept after Cohere rerank, per question
    ctx_pages: int  # whole PDF pages given to the model, per question (see pages.py)
    style: str    # how to arrange the answer; always built only from the context
    asked: bool = False  # the student wrote a length in the question ("8 pages", "1500 words")


_ARRANGE = ("Start directly with the content: no introduction and no conclusion paragraph unless the context itself has one. "
            "Follow the context's own order and headings.")

PROFILES: dict[int | None, Profile] = {
    16: Profile(16, 3584, 2688, 6, 40, 12, 6,
                _ARRANGE + " Cover every point, definition, step, example, advantage and limitation the context contains, "
                "each explained fully in the context's own wording."),
    8: Profile(8, 2560, 1920, 4, 30, 9, 5,
               _ARRANGE + " Cover every main point the context contains, each with its explanation, and the example if the context has one."),
    5: Profile(5, 1536, 1152, 3, 20, 7, 4,
               _ARRANGE + " Give the definition, then each main point with a short explanation, and the example if the context has one."),
    3: Profile(3, 1024, 768, 1.5, 15, 5, 3,
               _ARRANGE + " Give the definition, then the key points in short paragraphs."),
    # no marks selected: complete and faithful, as long as the material needs, no padding
    None: Profile(None, 1200, 900, 1.5, 20, 7, 3,
                  "Answer the question completely from the context. If the question asks what a topic, section or phase "
                  "contains, list EVERY item the context gives for it, in the context's own order and grouping, with the "
                  "context's own wording. Do not shorten a list and do not merge items."),
}


def get_profile(marks: int | None) -> Profile:
    return PROFILES.get(marks) or PROFILES[None]


# ---- a length written inside the question ("explain in 8 pages", "about 1500 words") beats the marks
WORDS_PER_PAGE = 448       # same ratio as the table above: 2688 words = 6 pages of single-spaced A4
MAX_WORDS = 4480           # 10 pages. Raise this to allow longer answers (the model's output limit is the real ceiling)
MIN_WORDS = 150
SOURCE_WORDS_PER_PAGE = 320  # a scanned note page holds about this many words, so this many pages are read per answer page
MAX_CONTEXT_PAGES = 12
_PAGES_ASKED = re.compile(r"\b(\d{1,2}(?:\.\d)?)[\s-]*pages?\b", re.IGNORECASE)
_WORDS_ASKED = re.compile(r"\b(\d{3,5})[\s-]*words?\b", re.IGNORECASE)


def with_requested_length(profile: Profile, text: str) -> Profile:
    """If the message names a length in pages or words, use it (and read enough pages of notes to fill it)."""
    pages = _PAGES_ASKED.search(text or "")
    words = _WORDS_ASKED.search(text or "")
    if pages:
        target = float(pages.group(1)) * WORDS_PER_PAGE
    elif words:
        target = float(words.group(1))
    else:
        return profile
    target = int(min(max(target, MIN_WORDS), MAX_WORDS))
    ctx_pages = min(MAX_CONTEXT_PAGES, max(profile.ctx_pages, math.ceil(target / SOURCE_WORDS_PER_PAGE)))
    top_n = max(profile.top_n, ctx_pages * 2)
    return replace(
        profile,
        tokens=target * 4 // 3,          # 3584 tokens = 2688 words
        words=target,
        pages=round(target / WORDS_PER_PAGE, 1),
        k=min(100, max(profile.k, top_n * 3)),
        top_n=top_n,
        ctx_pages=ctx_pages,
        style=profile.style if profile.marks else PROFILES[16].style,
        asked=True,
    )


def est_tokens(text: str) -> int:
    """Cheap token estimate (no tokenizer, no RAM). Slightly high on purpose: 1 token ~ 3.5 characters."""
    return len(text) * 2 // 7 + 1


_NUMBERED = re.compile(
    r"^[ \t]*(?:Q(?:uestion)?[ \t]*\.?[ \t]*)?\d+[ \t]*[\).:\-][ \t]+"   # "1. ", "2) ", "Q3: " at the start of a line
    r"|\bQ(?:uestion)?[ \t]*\.?[ \t]*\d+[ \t]*[\).:\-][ \t]+",          # "Q1. ... Q2. ..." on one line
    re.IGNORECASE | re.MULTILINE,
)


def split_questions(text: str) -> tuple[list[str], bool]:
    """One message can hold several questions. Returns (questions, was_cut_to_limit).

    A message counts as several questions when:
      * it has numbered lines:  "1. ...", "Q2) ...", "Question 3: ...", or
      * it is two or more sentences that ALL end with '?'.
    Anything else (including "(a) ... (b) ..." parts) is ONE question, so sub-parts are not
    multiplied into separate 16-mark answers.
    """
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