"""studyhub_rag/config.py: the single place that reads environment variables.

Same style as the ingestion config.py: it fails at startup with a clear message
if something required is missing, instead of failing later in the middle of a chat.
"""
import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()  # local only: copies .env into os.environ


class ConfigError(RuntimeError):
    """Raised at startup when an env variable is missing or invalid."""


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ConfigError(f"Missing required environment variable: {name}")
    return value


def _optional(name: str, default: str = "") -> str:
    return os.getenv(name, "").strip() or default


def _int(name: str, default: int, lo: int, hi: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ConfigError(f"{name} must be a whole number, got {raw!r}") from None
    if not lo <= value <= hi:
        raise ConfigError(f"{name} must be between {lo} and {hi}, got {value}")
    return value


def _csv(name: str) -> tuple[str, ...]:
    return tuple(p.strip() for p in os.getenv(name, "").split(",") if p.strip())


def _groq_keys() -> tuple[str, ...]:
    """GROQ_API_KEYS=a,b  (or the old GROQ_API_KEY and GROQ_API_KEY2 names)."""
    keys = _csv("GROQ_API_KEYS")
    if not keys:
        keys = tuple(k for k in (_optional("GROQ_API_KEY"), _optional("GROQ_API_KEY2")) if k)
    if not keys:
        raise ConfigError("Set GROQ_API_KEYS (comma separated) or GROQ_API_KEY")
    return keys


@dataclass(frozen=True)
class Settings:
    # Qdrant (must be the same cluster and collection that ingestion writes to)
    qdrant_url: str
    qdrant_api_key: str
    # query embeddings (must be the SAME model ingestion used)
    openrouter_api_keys: tuple[str, ...]
    openrouter_base_url: str
    embed_model: str
    embed_dimensions: int
    # reranker
    cohere_api_key: str
    cohere_base_url: str
    cohere_model: str
    # generation
    groq_keys: tuple[str, ...]
    groq_model: str
    groq_fallback_model: str  # second Groq model: it has its own separate rate limit
    groq_request_budget: int  # largest request (prompt + answer, in tokens) we send to Groq; bigger goes to Gemini
    gemini_keys: tuple[str, ...]  # optional fallback, same keys as ingestion
    gemini_model: str
    # security + tuning
    internal_key: str  # shared secret between Express and this service
    retrieve_k: int
    rerank_top_n: int
    max_question_chars: int
    max_questions: int  # how many questions one message may contain
    expand_to_pages: bool  # give the model the whole PDF page of each best chunk, not just the chunk
    min_page_score_ratio: float  # a page must score at least this share of the best page's score
    max_context_tokens: int  # upper limit for the context sent to the model
    groq_reasoning_effort: str  # "low", "medium" or "high"


def load_settings() -> Settings:
    openrouter_keys = _csv("OPENROUTER_API_KEYS")
    if not openrouter_keys:
        raise ConfigError("Missing required environment variable: OPENROUTER_API_KEYS")
    return Settings(
        qdrant_url=_required("QDRANT_URL"),
        qdrant_api_key=_required("QDRANT_API_KEY"),
        openrouter_api_keys=openrouter_keys,
        openrouter_base_url=_optional("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        embed_model=_optional("EMBED_MODEL", "liquid/lfm-2.5-embedding-350m:free"),
        embed_dimensions=_int("EMBED_DIMENSIONS", 1024, 64, 4096),
        cohere_api_key=_required("COHERE_API_KEY"),
        cohere_base_url=_optional("COHERE_BASE_URL", "https://api.cohere.com"),
        cohere_model=_optional("COHERE_RERANK_MODEL", "rerank-v4.0-fast"),
        groq_keys=_groq_keys(),
        groq_model=_optional("GROQ_MODEL", "openai/gpt-oss-120b"),
        groq_fallback_model=_optional("GROQ_FALLBACK_MODEL", "openai/gpt-oss-20b"),
        groq_request_budget=_int("GROQ_REQUEST_BUDGET", 7000, 1000, 200000),
        gemini_keys=_csv("GEMINI_KEYS"),
        gemini_model=_optional("GEMINI_ANSWER_MODEL", "gemini-3.1-flash-lite"),
        internal_key=_optional("AI_INTERNAL_KEY"),
        retrieve_k=_int("RETRIEVE_K", 20, 1, 100),
        rerank_top_n=_int("RERANK_TOP_N", 7, 1, 20),
        max_question_chars=_int("MAX_QUESTION_CHARS", 2000, 20, 6000),
        max_questions=_int("MAX_QUESTIONS", 5, 1, 10),
        expand_to_pages=_optional("EXPAND_TO_PAGES", "true").lower() not in ("0", "false", "no", "off"),
        min_page_score_ratio=float(_optional("MIN_PAGE_SCORE_RATIO", "0.3")),
        max_context_tokens=_int("MAX_CONTEXT_TOKENS", 12000, 1000, 100000),
        groq_reasoning_effort=_optional("GROQ_REASONING_EFFORT", "low").lower(),
    )


settings = load_settings()  # runs once, when the module is first imported