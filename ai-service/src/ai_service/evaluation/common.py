"""evaluation/common.py: the judge model and helpers shared by the two scripts.

LOCAL USE ONLY. Nothing in studyhub_rag imports this folder, and .dockerignore keeps it out of Render.

The judge model is the model that writes test questions and scores answers. It should
NOT be the same one that answers students, otherwise it grades its own homework.
Default: Gemini (the same GEMINI_KEYS ingestion uses). Set JUDGE_PROVIDER=groq to use Groq instead.
"""
import os
import warnings
from pathlib import Path

warnings.filterwarnings("ignore", category=DeprecationWarning)  # ragas 0.4 prints noisy wrapper warnings

from studyhub_rag.config import settings  # noqa: E402  (loads .env)

DATA_DIR = Path(__file__).parent / "data"
RESULTS_DIR = DATA_DIR / "results"
DEFAULT_TESTSET = DATA_DIR / "testset.jsonl"


def judge_llm():
    provider = os.getenv("JUDGE_PROVIDER", "").strip().lower() or ("gemini" if settings.gemini_keys else "groq")
    model = os.getenv("JUDGE_MODEL", "").strip()
    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=model or settings.gemini_model,
            google_api_key=settings.gemini_keys[0],
            temperature=0.0,
            max_retries=4,
            timeout=120,
        )
    from langchain_groq import ChatGroq

    return ChatGroq(
        api_key=settings.groq_keys[-1],  # the LAST key, so the judge does not share a quota with the answering model
        model=model or settings.groq_model,
        temperature=0.0,
        max_retries=4,
    )


def ragas_models():
    """(judge llm, embeddings) wrapped the way Ragas wants them."""
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.llms import LangchainLLMWrapper

    from studyhub_rag.embeddings import OpenRouterEmbeddings

    return LangchainLLMWrapper(judge_llm()), LangchainEmbeddingsWrapper(OpenRouterEmbeddings())


def run_config():
    """Gentle on free-tier rate limits: few parallel calls, patient retries."""
    from ragas import RunConfig

    return RunConfig(timeout=180, max_retries=6, max_wait=60, max_workers=2)
