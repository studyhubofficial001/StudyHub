import logging
from functools import lru_cache
from langchain_groq import ChatGroq
from studyhub_rag.config import settings

log=logging.getLogger(__name__)

GROQ_THINKING_HEADROOM = 800

GEMINI_THINKING_HEADROOM = 2000

MAX_GEMINI_KEYS=3

def choose_provider(prompt_tokens:int , answer_token: int) -> str:
    total = prompt_tokens+answer_token + GROQ_THINKING_HEADROOM
    if total <= settings.groq_request_budget or not settings.gemini_keys:
        return "groq"
    return "gemini"

def _groq_models(answer_tokens:int) -> list:
    max_tokens = answer_tokens + GROQ_THINKING_HEADROOM
    models=[]
    for model_name in (settings.groq_model, settings.groq_fallback_model):
        for key in settings.groq_keys:
            models.append(
                ChatGroq(
                    api_key=key,
                    model=model_name,
                    temperature=0.0,
                    reasoning_effort="low",
                    max_tokens=max_tokens,
                    max_retries=0,
                )
            )
    return models

def _gemini_models(answer_tokens:int) -> list:
    if not settings.gemini_keys:
        return[]
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        return [
            ChatGoogleGenerativeAI(
                model=settings.gemini.model,
                google_api_key=key,
                temperature=0.0,
                max_output_tokens=answer_tokens + GEMINI_THINKING_HEADROOM,
                max_retries=2,
                timeout=180,
            )
            for key in settings.gemini_keys[:MAX_GEMINI_KEYS]
        ]
    except Exception:
        log.warning("Gemini disabled (package missing or bad settings)",exc_info=True)
        return[]


@lru_cache(maxsize=32)
def get_llm(provider:str,answer_tokens:int):
    if provider == "gemini":
        models=_gemini_models(answer_tokens) or _groq_models(answer_tokens)
    else:
        models = _groq_models(answer_tokens) + _gemini_models(answer_tokens)
    return models[0].with_fallbacks(models[1:]) if len(models) > 1 else models[0]