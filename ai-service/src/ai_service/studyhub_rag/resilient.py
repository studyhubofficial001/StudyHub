"""studyhub_rag/resilient.py: streaming that survives a 503 / rate limit in the MIDDLE of an answer.

Why this file exists
--------------------
LangChain's `model.with_fallbacks([...])` only switches to the next model when the error happens BEFORE the first
token. If Gemini sends half of the answer and then fails with "503 UNAVAILABLE ... high demand", the error is
raised, the stream stops, and the student sees a half answer. (That is the error you saw in LangSmith.)

What this does instead
----------------------
  * keeps the text that was already sent to the student;
  * on any error it moves to the NEXT model and asks it to CONTINUE from where the text stopped
    (the partial answer is given back to it as its own earlier message), so the answer just goes on;
  * a model that failed is skipped for a short time (COOLDOWN_SECONDS), so a busy model does not slow every request;
  * if every model fails, the whole list is tried again after a short pause (STREAM_ROUNDS in .env);
  * if a model stops because it hit its token limit (finish_reason = length / MAX_TOKENS), it is asked to continue.

Only when every model has failed in every round is the error raised (then main.py sends the "error" event).
"""
import asyncio
import logging
import time
from typing import AsyncIterator, Sequence

from langchain_core.messages import AIMessage, HumanMessage

from studyhub_rag.config import settings

log = logging.getLogger(__name__)

COOLDOWN_SECONDS = 20          # a model that just failed is skipped for this long (unless every model is cooling)
ROUND_PAUSE = 1.5              # seconds to wait before the whole model list is tried again (grows each round)
MAX_LENGTH_CONTINUATIONS = 2   # how many times a model that hit its token limit is asked to carry on

_cooldown: dict[int, float] = {}

CONTINUE_TEXT = (
    "Your answer was cut off. Continue it EXACTLY from where it stopped. It ended with: \"...{tail}\"\n"
    "Start with the very next whole word. Do not repeat anything already written, do not restart, do not add an "
    "introduction, and keep the same plain-text format and rules as before. Finish the whole answer."
)


# ------------------------------------------------------------------ small helpers
def chunk_text(chunk) -> str:
    """Text of one streamed chunk. Gemini can send a list of blocks (text + thinking); only the text is kept."""
    content = getattr(chunk, "content", chunk)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "".join(parts)
    return ""


def _finish_reason(chunk) -> str:
    meta = getattr(chunk, "response_metadata", None) or {}
    return str(meta.get("finish_reason") or meta.get("finishReason") or "").lower()


def _cut_by_length(reason: str) -> bool:
    return reason == "length" or "max_token" in reason


def _order(models: Sequence) -> list:
    """Models that are not cooling down, in the original order. If all are cooling, try them all anyway."""
    now = time.monotonic()
    ready = [m for m in models if _cooldown.get(id(m), 0) <= now]
    return ready or list(models)


def _cool(model) -> None:
    _cooldown[id(model)] = time.monotonic() + COOLDOWN_SECONDS


def _with_continuation(messages: Sequence, written: str) -> list:
    if not written:
        return list(messages)
    return [*messages, AIMessage(content=written), HumanMessage(content=CONTINUE_TEXT.format(tail=written[-200:]))]


def _join_fix(written: str, text: str) -> str:
    """The first piece of a continuation may come without the space that separated the words."""
    if written and text and not written[-1].isspace() and text[0].isalnum():
        return " " + text
    return text


def _name(model) -> str:
    return getattr(model, "model_name", None) or getattr(model, "model", None) or type(model).__name__


# ------------------------------------------------------------------ async (used by the web stream)
async def stream_text(models: Sequence, messages: Sequence, rounds: int | None = None) -> AsyncIterator[str]:
    """Yield the answer piece by piece. Continues on another model when one fails half way."""
    models = list(models)
    if not models:
        raise RuntimeError("No language models are configured")
    rounds = rounds or settings.stream_rounds
    written, continuations, last_error = "", 0, None

    for rnd in range(rounds):
        candidates = _order(models)
        i = 0
        while i < len(candidates):
            model = candidates[i]
            before, reason, first = len(written), "", True
            try:
                async for chunk in model.astream(_with_continuation(messages, written)):
                    reason = _finish_reason(chunk) or reason
                    text = chunk_text(chunk)
                    if not text:
                        continue  # reasoning models send empty pieces while they think
                    if first:
                        text, first = _join_fix(written, text), False
                    written += text
                    yield text
                if len(written) == before and not written:
                    raise RuntimeError("model returned an empty answer")
            except Exception as exc:  # 503, 429, timeout, empty answer ... all mean: use the next model
                last_error = exc
                _cool(model)
                log.warning("model %s failed after %d chars (round %d): %s", _name(model), len(written), rnd + 1,
                            str(exc)[:200])
                i += 1
                continue
            if _cut_by_length(reason) and continuations < MAX_LENGTH_CONTINUATIONS and len(written) > before:
                continuations += 1
                log.info("model %s hit its token limit; asking it to continue (%d)", _name(model), continuations)
                continue  # same model again, now asked to continue
            return
        if rnd < rounds - 1:
            await asyncio.sleep(ROUND_PAUSE * (rnd + 1))

    raise last_error or RuntimeError("every model failed")


# ------------------------------------------------------------------ sync (used by answer() / evaluation)
def generate_text(models: Sequence, messages: Sequence, rounds: int | None = None) -> str:
    """Same as stream_text but blocking, returns the whole answer."""
    models = list(models)
    if not models:
        raise RuntimeError("No language models are configured")
    rounds = rounds or settings.stream_rounds
    written, continuations, last_error = "", 0, None

    for rnd in range(rounds):
        candidates = _order(models)
        i = 0
        while i < len(candidates):
            model = candidates[i]
            before, reason, first = len(written), "", True
            try:
                for chunk in model.stream(_with_continuation(messages, written)):
                    reason = _finish_reason(chunk) or reason
                    text = chunk_text(chunk)
                    if not text:
                        continue
                    if first:
                        text, first = _join_fix(written, text), False
                    written += text
                if len(written) == before and not written:
                    raise RuntimeError("model returned an empty answer")
            except Exception as exc:
                last_error = exc
                _cool(model)
                log.warning("model %s failed after %d chars (round %d): %s", _name(model), len(written), rnd + 1,
                            str(exc)[:200])
                i += 1
                continue
            if _cut_by_length(reason) and continuations < MAX_LENGTH_CONTINUATIONS and len(written) > before:
                continuations += 1
                continue
            return written
        if rnd < rounds - 1:
            time.sleep(ROUND_PAUSE * (rnd + 1))

    raise last_error or RuntimeError("every model failed")