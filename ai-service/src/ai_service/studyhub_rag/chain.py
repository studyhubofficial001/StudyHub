"""studyhub_rag/chain.py: the whole RAG flow in one place.

    message -> split into questions -> hybrid search (Qdrant) per question -> rerank (Cohere)
            -> rebuild the whole PDF page of each best chunk (pages.py)
            -> build prompt (faithful and complete; length from the marks)
            -> choose Groq or Gemini by request size -> stream the answer

The web API uses prepare() + stream_answer(); evaluation/evaluate.py uses answer(). Both share the same code.
"""
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, AsyncIterator

from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser

from studyhub_rag.config import settings
from studyhub_rag.codefix import looks_like_code, needs_code_pass, repair_prompt
from studyhub_rag.conversation import clean_history, history_block, rewrite_question
from studyhub_rag.embeddings import OpenRouterEmbeddings
from studyhub_rag.formatting import build_sources, format_docs
from studyhub_rag.llm import choose_provider, get_llm
from studyhub_rag.profiles import est_tokens, get_profile, split_questions
from studyhub_rag.pages import expand_to_pages
from studyhub_rag.prompts import NO_ANSWER, length_rule, prompt
from studyhub_rag.reranker import CohereReranker
from studyhub_rag.retriever import CloudHybridRetriever
from studyhub_rag.vectorstore import (
    COLLECTION_NAME,
    DENSE_VECTOR_NAME,
    SPARSE_VECTOR_NAME,
    get_client,
)

log = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _parts():
    """Build everything once. No network calls happen here."""
    retriever = CloudHybridRetriever(
        client=get_client(),
        embeddings=OpenRouterEmbeddings(),
        collection_name=COLLECTION_NAME,
        dense_vector_name=DENSE_VECTOR_NAME,
        sparse_vector_name=SPARSE_VECTOR_NAME,
        k=settings.retrieve_k,
    )
    reranker = CohereReranker(
        api_key=settings.cohere_api_key,
        base_url=settings.cohere_base_url,
        model=settings.cohere_model,
        top_n=settings.rerank_top_n,
    )
    return retriever, reranker


def warm_up() -> None:
    _parts()


def retrieve(question: str, filters: dict[str, Any] | None = None, marks: int | None = None) -> list[Document]:
    """Hybrid search, then rerank. Longer answers (more marks) keep more chunks.
    If Cohere is down we still answer from the hybrid order."""
    retriever, reranker = _parts()
    profile = get_profile(marks)
    k = profile.k if marks else settings.retrieve_k
    top_n = profile.top_n if marks else settings.rerank_top_n

    docs = retriever.model_copy(update={"filters": filters or {}, "k": k}).invoke(question)
    if not docs:
        return []
    try:
        docs = list(reranker.model_copy(update={"top_n": top_n}).compress_documents(docs, question))
    except Exception:
        log.warning("rerank failed; using hybrid order", exc_info=True)
        docs = docs[:top_n]

    if settings.expand_to_pages:
        # Chunks are only pieces of a page; give the model the full pages so nothing the page says is missing.
        docs = expand_to_pages(
            get_client(), COLLECTION_NAME, docs,
            max_pages=profile.ctx_pages,
            max_tokens=settings.max_context_tokens,
            min_ratio=settings.min_page_score_ratio,
        )
    return docs


def _retrieve_many(questions: list[str], filters, marks) -> list[Document]:
    """One search per question, then merge: each question's best chunks come first, repeats dropped."""
    if len(questions) == 1:
        return retrieve(questions[0], filters, marks)
    with ThreadPoolExecutor(max_workers=min(len(questions), 3)) as pool:
        lists = list(pool.map(lambda q: retrieve(q, filters, marks), questions))
    merged, seen = [], set()
    for rank in range(max(len(group) for group in lists)):
        for group in lists:
            if rank < len(group) and group[rank].page_content not in seen:
                seen.add(group[rank].page_content)
                merged.append(group[rank])
    return merged


def _task_text(questions: list[str]) -> str:
    if len(questions) == 1:
        return f"Question: {questions[0]}"
    numbered = "\n".join(f"{i}. {q}" for i, q in enumerate(questions, 1))
    return f"Answer each of these questions separately, in order:\n{numbered}"


@dataclass
class Plan:
    """Everything decided BEFORE the model is called."""
    questions: list[str]
    truncated: bool          # the message had more questions than MAX_QUESTIONS
    marks: int | None
    docs: list[Document]
    messages: list           # the exact prompt that will be sent
    prompt_tokens: int       # estimate, includes the system prompt and all context
    answer_tokens: int       # how long the answer is expected to be
    provider: str            # "groq", "gemini", or "none" when nothing was found
    code_mode: bool = False  # the notes hold code: write a draft, then fix it with the compiler-style pass
    context: str = ""        # the context text and question text, kept for that second pass
    task: str = ""

    def meta(self) -> dict:
        return {
            "provider": self.provider,
            "questions": len(self.questions),
            "marks": self.marks,
            "truncated": self.truncated,
        }


def prepare(
    question: str,
    marks: int | None = None,
    filters: dict[str, Any] | None = None,
    history: list[dict] | None = None,
) -> Plan:
    profile = get_profile(marks)
    questions, truncated = split_questions(question)
    history = clean_history(history)

    # A follow-up ("what is its output?") is searched as a full question; the first question of a chat is not changed.
    search_questions, shown = questions, questions
    if history and len(questions) == 1 and settings.rewrite_followups:
        full = rewrite_question(questions[0], history)
        search_questions = [full]
        shown = [f"{questions[0]}\n(In full: {full})"] if full != questions[0] else questions

    docs = _retrieve_many(search_questions, filters, marks)
    answer_tokens = profile.tokens * len(questions)

    if not docs:
        return Plan(questions, truncated, marks, [], [], 0, answer_tokens, "none")

    inputs = {
        "history": history_block(history),
        "context": format_docs(docs),
        "question": _task_text(shown),
        "length": length_rule(marks, profile.words, f"{profile.pages:g}"),
        "style": profile.style,
    }
    template = prompt
    messages = template.format_messages(**inputs)

    # The system prompt, the history and every chunk are part of the request, so they are counted too.
    prompt_tokens = est_tokens("".join(str(m.content) for m in messages))
    provider = choose_provider(prompt_tokens, answer_tokens)
    log.info("route=%s marks=%s questions=%d history=%d prompt~%d answer~%d", provider, marks, len(questions), len(history), prompt_tokens, answer_tokens)
    code_mode = settings.fix_code and needs_code_pass(" ".join(search_questions), inputs["context"])
    return Plan(questions, truncated, marks, docs, messages, prompt_tokens, answer_tokens, provider,
                code_mode, inputs["context"], inputs["question"])


# ---------------------------------------------------------------- the second pass for code
CODE_PASS_EXTRA_TOKENS = 1700   # the reviewer thinks before it writes, and those tokens count against the limit


def _repair_request(plan: Plan, draft: str):
    """(messages, model chain) for the code-fixing pass. The model is chosen by the size of THIS request."""
    messages = repair_prompt.format_messages(context=plan.context, question=plan.task, draft=draft)
    tokens = est_tokens("".join(str(m.content) for m in messages))
    budget = plan.answer_tokens + CODE_PASS_EXTRA_TOKENS
    provider = choose_provider(tokens, budget)
    log.info("code pass: route=%s prompt~%d", provider, tokens)
    return messages, get_llm(provider, budget, settings.code_reasoning_effort) | StrOutputParser()


def answer(question: str, filters: dict[str, Any] | None = None, marks: int | None = None) -> dict:
    """Non-streaming version (used by evaluation)."""
    plan = prepare(question, marks, filters)
    if not plan.docs:
        return {"answer": NO_ANSWER, "docs": [], "sources": [], "provider": plan.provider}
    text = (get_llm(plan.provider, plan.answer_tokens) | StrOutputParser()).invoke(plan.messages)
    if plan.code_mode and looks_like_code(text):
        try:
            messages, repair = _repair_request(plan, text)
            text = repair.invoke(messages)
        except Exception:
            log.warning("code pass failed; returning the draft", exc_info=True)
    return {"answer": text, "docs": plan.docs, "sources": build_sources(plan.docs), "provider": plan.provider}


async def stream_answer(plan: Plan) -> AsyncIterator[str]:
    """Yields the answer piece by piece. Search is done before this (see main.py)."""
    if not plan.docs:
        yield NO_ANSWER
        return
    chain = get_llm(plan.provider, plan.answer_tokens) | StrOutputParser()

    if not plan.code_mode:
        async for piece in chain.astream(plan.messages):
            if piece:  # reasoning models send empty pieces while they think
                yield piece
        return

    # The notes contain code: write the answer, then let the reviewer pass fix it, and stream THAT.
    draft = await chain.ainvoke(plan.messages)
    if not looks_like_code(draft):
        yield draft
        return
    sent = False
    try:
        messages, repair = _repair_request(plan, draft)
        async for piece in repair.astream(messages):
            if piece:
                sent = True
                yield piece
    except Exception:
        log.warning("code pass failed", exc_info=True)
        if sent:
            raise            # part of the fixed answer is already on the screen
        yield draft          # nothing was shown yet: fall back to the draft