"""studyhub_rag/conversation.py: lets a follow-up question ("what is its output?") be understood.

Express sends the last few messages of the chat. Two things are done with them:
  1. The follow-up is rewritten into a full question, so the SEARCH looks for the right notes.
  2. The earlier messages are shown to the answer model, so it knows what "it" and "that program" mean.
The first question of a chat has no history, so nothing here runs and nothing changes for it.
"""
import logging

from langchain_core.output_parsers import StrOutputParser

from studyhub_rag.llm import get_rewriter
from studyhub_rag.prompts import NO_ANSWER

log = logging.getLogger(__name__)

MAX_MESSAGES = 4          # the last two question-and-answer pairs
USER_CHARS = 700
ANSWER_CHARS = 2500       # an earlier answer may contain a whole program
REWRITE_ANSWER_CHARS = 700

REWRITE_PROMPT = """Below is the start of a chat between a student and a study assistant, then the student's newest message.
Rewrite the newest message as ONE complete question that can be understood without the chat.
- Replace words like "it", "that", "this program", "the above" with what they refer to. Keep names, class names, topics and numbers.
- If the newest message is already complete and clear, return it unchanged.
- Do not answer it. Output only the question, on one line.

Chat:
{chat}

Newest message: {question}

Complete question:"""


def _is_no_answer(text: str) -> bool:
    """True for the reply 'The provided context contains insufficient information...'."""
    return text.strip().lower().startswith(NO_ANSWER[:40].lower())


def clean_history(history) -> list[dict]:
    """Keep only the last few non-empty messages, cut to a safe length.

    A failed try ("insufficient information") is left out together with the question that caused it. Otherwise the
    next message, even a correct one, is shown that reply and the model repeats it instead of reading the notes.
    """
    out = []
    for item in history or []:
        role, text = item.get("role"), (item.get("text") or "").strip()
        if role not in ("user", "assistant") or not text:
            continue
        if role == "assistant" and _is_no_answer(text):
            if out and out[-1]["role"] == "user":
                out.pop()
            continue
        out.append({"role": role, "text": text})
    return out[-MAX_MESSAGES:]


def _cut(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[:limit].rstrip() + " ..."


def format_history(history: list[dict], answer_chars: int = ANSWER_CHARS) -> str:
    lines = []
    for m in history:
        who = "Student" if m["role"] == "user" else "Assistant"
        lines.append(f"{who}: {_cut(m['text'], USER_CHARS if m['role'] == 'user' else answer_chars)}")
    return "\n\n".join(lines)


def history_block(history: list[dict]) -> str:
    """The text placed in front of the context in the answer prompt ('' when there is no history)."""
    return f"<history>\n{format_history(history)}\n</history>\n\n" if history else ""


def rewrite_question(question: str, history: list[dict]) -> str:
    """The follow-up as a full question. If the small model fails, join it with the last question instead."""
    try:
        chain = get_rewriter() | StrOutputParser()
        text = chain.invoke(REWRITE_PROMPT.format(chat=format_history(history, REWRITE_ANSWER_CHARS), question=question))
        line = next((ln.strip().strip('"').strip() for ln in text.splitlines() if ln.strip()), "")
        if 3 <= len(line) <= 500:
            return line
    except Exception:
        log.warning("could not rewrite the follow-up; using the previous question instead", exc_info=True)
    last_question = next((m["text"] for m in reversed(history) if m["role"] == "user"), "")
    return f"{_cut(last_question, 300)} {question}".strip()