"""studyhub_rag/llm.py: picks the answer model for each request.

Rule: Groq (GPT-OSS) handles a request only when the WHOLE request (prompt + context + the answer
we expect) fits inside Groq's per-minute token limit. Anything bigger, for example a 16-marks answer
or several long questions in one message, goes to Gemini, which has a much larger limit.

    Groq route :  gpt-oss-120b (each key)  ->  gpt-oss-20b (each key)  ->  Gemini
    Gemini route: Gemini (each key)

If a Groq call still fails (rate limit, outage), LangChain moves on to the next model by itself.
"""
import logging
from functools import lru_cache

from langchain_groq import ChatGroq

from studyhub_rag.config import settings

log = logging.getLogger(__name__)

GROQ_THINKING_HEADROOM = 800     # gpt-oss thinks before it answers; those tokens count against the limit too
GEMINI_THINKING_HEADROOM = 2000  # same for Gemini, so a long answer is never cut off by its own thinking
MAX_GEMINI_KEYS = 3


def choose_provider(prompt_tokens: int, answer_tokens: int) -> str:
    """'groq' when the whole request fits in the Groq budget, otherwise 'gemini'."""
    total = prompt_tokens + answer_tokens + GROQ_THINKING_HEADROOM
    if total <= settings.groq_request_budget or not settings.gemini_keys:
        return "groq"
    return "gemini"


def _groq_models(answer_tokens: int, effort: str | None = None) -> list:
    max_tokens = answer_tokens + GROQ_THINKING_HEADROOM
    models = []
    for model_name in (settings.groq_model, settings.groq_fallback_model):
        for key in settings.groq_keys:
            models.append(
                ChatGroq(
                    api_key=key,
                    model=model_name,
                    temperature=0.0,
                    reasoning_effort=effort or settings.groq_reasoning_effort,
                    max_tokens=max_tokens,
                    max_retries=0,  # on a rate limit, switch to the next model at once instead of waiting
                )
            )
    return models


def _gemini_models(answer_tokens: int) -> list:
    if not settings.gemini_keys:
        return []
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI  # imported only when needed (saves RAM)

        return [
            ChatGoogleGenerativeAI(
                model=settings.gemini_model,
                google_api_key=key,
                temperature=0.0,
                max_output_tokens=answer_tokens + GEMINI_THINKING_HEADROOM,
                max_retries=2,
                timeout=180,
            )
            for key in settings.gemini_keys[:MAX_GEMINI_KEYS]
        ]
    except Exception:
        log.warning("Gemini disabled (package missing or bad settings)", exc_info=True)
        return []


@lru_cache(maxsize=32)
def get_llm(provider: str, answer_tokens: int, effort: str | None = None):
    """The model chain for one provider and one answer size (cached: there are only a few sizes)."""
    if provider == "gemini":
        models = _gemini_models(answer_tokens) or _groq_models(answer_tokens, effort)
    else:
        models = _groq_models(answer_tokens, effort) + _gemini_models(answer_tokens)
    return models[0].with_fallbacks(models[1:]) if len(models) > 1 else models[0]


@lru_cache(maxsize=1)
def get_rewriter():
    """Small, quick model used only to rewrite a follow-up question into a full question (Groq 20b, then 120b)."""
    models = []
    for model_name in (settings.groq_fallback_model, settings.groq_model):
        for key in settings.groq_keys:
            models.append(
                ChatGroq(
                    api_key=key,
                    model=model_name,
                    temperature=0.0,
                    reasoning_effort="low",
                    max_tokens=700,   # gpt-oss thinks first; the rewritten question itself is short
                    max_retries=0,
                )
            )
    return models[0].with_fallbacks(models[1:]) if len(models) > 1 else models[0]