"""studyhub_rag/chain.py: the whole RAG flow in one place.

    message -> split into questions -> hybrid search (Qdrant) per question -> rerank (Cohere)
            -> rebuild the whole PDF page of each best chunk (pages.py)
            -> build prompt (faithful and complete; length from the marks)
            -> choose Groq or Gemini by request size -> stream the answer

The web API uses prepare() + stream_answer(); evaluation/evaluate.py uses answer(). Both share the same code.
"""
import logging
import math
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, replace
from functools import lru_cache
from typing import Any, AsyncIterator

from langchain_core.documents import Document
from langchain_core.messages import AIMessage, HumanMessage

from studyhub_rag.config import settings
from studyhub_rag.codefix import looks_like_code, needs_code_pass, repair_prompt
from studyhub_rag.conversation import clean_history, history_block, rewrite_question, search_queries
from studyhub_rag.embeddings import OpenRouterEmbeddings
from studyhub_rag.formatting import build_sources, format_docs
from studyhub_rag.llm import choose_provider, get_models
from studyhub_rag.profiles import Profile, est_tokens, get_profile, split_questions, with_requested_length
from studyhub_rag.pages import expand_to_pages
from studyhub_rag.prompts import NO_ANSWER, length_rule, prompt
from studyhub_rag.reranker import CohereReranker
from studyhub_rag.resilient import generate_text, stream_text
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


def retrieve(question: str, filters: dict[str, Any] | None = None, marks: int | None = None,
             profile: Profile | None = None) -> list[Document]:
    """Hybrid search, then rerank. Longer answers (more marks) keep more chunks.
    If Cohere is down we still answer from the hybrid order."""
    retriever, reranker = _parts()
    profile = profile or get_profile(marks)
    custom = bool(marks) or profile.asked
    k = profile.k if custom else settings.retrieve_k
    top_n = profile.top_n if custom else settings.rerank_top_n

    docs = retriever.model_copy(update={"filters": filters or {}, "k": k}).invoke(question)
    if not docs:
        # An empty result for a question the notes can answer is usually a hiccup, not the truth: try once more,
        # with the dense search alone. The same filters are kept, so nothing outside the student's year/subject is read.
        log.warning("hybrid search returned nothing for %r; retrying with dense search", question[:80])
        time.sleep(0.4)
        try:
            docs = retriever.model_copy(update={"filters": filters or {}, "k": k, "hybrid": False}).invoke(question)
        except Exception:
            log.warning("dense retry failed", exc_info=True)
            docs = []
    if not docs:
        return []
    try:
        docs = list(reranker.model_copy(update={"top_n": top_n}).compress_documents(docs, question))
    except Exception:
        log.warning("rerank failed; using hybrid order", exc_info=True)
        docs = docs[:top_n]

    if settings.expand_to_pages:
        # Chunks are only pieces of a page; give the model the full pages so nothing the page says is missing.
        # A long answer (8 or 16 marks, or a length typed in the question) also reads on after the best page, because the
        # explanation of a topic sits on the pages that follow it, and it accepts weaker pages (low rerank score).
        long_answer = profile.asked or (profile.marks or 0) >= 8
        docs = expand_to_pages(
            get_client(), COLLECTION_NAME, docs,
            max_pages=profile.ctx_pages,
            max_tokens=settings.max_context_tokens,
            min_ratio=min(settings.min_page_score_ratio, 0.15) if long_answer else settings.min_page_score_ratio,
            read_on=long_answer,
        )
    return docs


def _retrieve_many(questions: list[str], filters, marks, profile: Profile | None = None) -> list[Document]:
    """One search per question, then merge: each question's best chunks come first, repeats dropped."""
    if len(questions) == 1:
        return retrieve(questions[0], filters, marks, profile)
    with ThreadPoolExecutor(max_workers=min(len(questions), 3)) as pool:
        lists = list(pool.map(lambda q: retrieve(q, filters, marks, profile), questions))
    merged, seen = [], set()
    for rank in range(max(len(group) for group in lists)):
        for group in lists:
            if rank < len(group) and group[rank].page_content not in seen:
                seen.add(group[rank].page_content)
                merged.append(group[rank])
    return merged


def _retrieve_parts(queries: list[str], filters, marks, profile: Profile) -> list[Document]:
    """One question with several parts ("X and its advantages and disadvantages"): search each part, keep the pages
    part by part (so the answer follows the question's order), and share the page budget between the parts."""
    share = replace(
        profile,
        ctx_pages=max(2, math.ceil(profile.ctx_pages / len(queries))),
        top_n=max(4, math.ceil(profile.top_n / len(queries))),
        k=max(15, math.ceil(profile.k / len(queries))),
    )
    with ThreadPoolExecutor(max_workers=len(queries)) as pool:
        groups = list(pool.map(lambda q: retrieve(q, filters, marks, share), queries))
    merged, seen = [], set()
    for group in groups:
        for doc in group:
            if doc.page_content not in seen:
                seen.add(doc.page_content)
                merged.append(doc)
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
    target_words: int = 0    # expected answer length in words (0 = no fixed length, so no top-up)

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
    questions, truncated = split_questions(question)
    # "explain in 8 pages" written in the message beats the marks setting
    profile = with_requested_length(get_profile(marks), question)
    history = clean_history(history)

    # A follow-up ("what is its output?") is searched as a full question; the first question of a chat is not changed.
    search_questions, shown = questions, questions
    if history and len(questions) == 1 and settings.rewrite_followups:
        full = rewrite_question(questions[0], history)
        search_questions = [full]
        shown = [f"{questions[0]}\n(In full: {full})"] if full != questions[0] else questions

    if len(search_questions) == 1:
        parts = search_queries(search_questions[0])
        docs = _retrieve_parts(parts, filters, marks, profile) if len(parts) > 1 else _retrieve_many(search_questions, filters, marks, profile)
    else:
        docs = _retrieve_many(search_questions, filters, marks, profile)
    answer_tokens = profile.tokens * len(questions)

    if not docs:
        return Plan(questions, truncated, marks, [], [], 0, answer_tokens, "none")

    inputs = {
        "history": history_block(history),
        "context": format_docs(docs),
        "question": _task_text(shown),
        "length": length_rule(marks, profile.words, f"{profile.pages:g}", profile.asked),
        "style": profile.style,
    }
    template = prompt
    messages = template.format_messages(**inputs)

    # The system prompt, the history and every chunk are part of the request, so they are counted too.
    prompt_tokens = est_tokens("".join(str(m.content) for m in messages))
    provider = choose_provider(prompt_tokens, answer_tokens)
    log.info("route=%s marks=%s questions=%d history=%d prompt~%d answer~%d", provider, marks, len(questions), len(history), prompt_tokens, answer_tokens)
    code_mode = settings.fix_code and needs_code_pass(" ".join(search_questions), inputs["context"])
    target_words = profile.words * len(questions) if (marks or profile.asked) else 0
    return Plan(questions, truncated, marks, docs, messages, prompt_tokens, answer_tokens, provider,
                code_mode, inputs["context"], inputs["question"], target_words)


# ---------------------------------------------------------------- the second pass for code
CODE_PASS_EXTRA_TOKENS = 1700   # the reviewer thinks before it writes, and those tokens count against the limit


def _repair_request(plan: Plan, draft: str):
    """(messages, models) for the code-fixing pass. The models are chosen by the size of THIS request."""
    messages = repair_prompt.format_messages(context=plan.context, question=plan.task, draft=draft)
    tokens = est_tokens("".join(str(m.content) for m in messages))
    budget = plan.answer_tokens + CODE_PASS_EXTRA_TOKENS
    provider = choose_provider(tokens, budget)
    log.info("code pass: route=%s prompt~%d", provider, tokens)
    return messages, get_models(provider, budget, settings.code_reasoning_effort)


# ---------------------------------------------------------------- top-up for an answer that is too short
END_LINE = "cover this topic only up to this point"   # the model's own "I used everything" sentence (see prompts.py)

TOPUP_TEXT = (
    "The answer above has about {have} words, but this question needs about {want}. Go back through EVERY page of the "
    "<context> and continue the answer with the relevant material you have not used yet (items, explanations, examples, "
    "code, advantages, limitations, applications). Do not repeat anything already written, do not write a conclusion "
    "for the earlier text, and keep the same plain-text format and rules. If the context has nothing more, reply with "
    "only: The provided notes cover this topic only up to this point."
)


def _topup_request(plan: Plan, text: str):
    """(models, messages) for one top-up pass, or None when the answer is long enough (or top-up is off)."""
    if not plan.target_words or settings.max_topups < 1 or END_LINE in text.lower():
        return None
    have = len(text.split())
    if have >= settings.min_answer_ratio * plan.target_words:
        return None
    messages = [*plan.messages, AIMessage(content=text),
                HumanMessage(content=TOPUP_TEXT.format(have=have, want=plan.target_words))]
    remaining = max(600, plan.answer_tokens - est_tokens(text))
    provider = choose_provider(plan.prompt_tokens + est_tokens(text) + 200, remaining)
    log.info("top-up: answer has %d of ~%d words, route=%s", have, plan.target_words, provider)
    return get_models(provider, remaining), messages


# ---------------------------------------------------------------- answering
def answer(question: str, filters: dict[str, Any] | None = None, marks: int | None = None) -> dict:
    """Non-streaming version (used by evaluation). Survives a model failing half way."""
    plan = prepare(question, marks, filters)
    if not plan.docs:
        return {"answer": NO_ANSWER, "docs": [], "sources": [], "provider": plan.provider}
    text = generate_text(get_models(plan.provider, plan.answer_tokens), plan.messages)
    if plan.code_mode and looks_like_code(text):
        try:
            messages, models = _repair_request(plan, text)
            text = generate_text(models, messages)
        except Exception:
            log.warning("code pass failed; returning the draft", exc_info=True)
    elif not plan.code_mode:
        for _ in range(settings.max_topups):
            request = _topup_request(plan, text)
            if not request:
                break
            try:
                text += "\n\n" + generate_text(*request)
            except Exception:
                log.warning("top-up failed; returning the answer as it is", exc_info=True)
                break
    return {"answer": text, "docs": plan.docs, "sources": build_sources(plan.docs), "provider": plan.provider}


async def stream_answer(plan: Plan) -> AsyncIterator[str]:
    """Yields the answer piece by piece. Search is done before this (see main.py).
    If a model fails half way (503, rate limit) the next model continues the same answer (see resilient.py)."""
    if not plan.docs:
        yield NO_ANSWER
        return
    models = get_models(plan.provider, plan.answer_tokens)

    if not plan.code_mode:
        text = ""
        async for piece in stream_text(models, plan.messages):
            text += piece
            yield piece
        # the answer ended normally but is much shorter than the marks need: one more pass for the skipped material
        for _ in range(settings.max_topups):
            request = _topup_request(plan, text)
            if not request:
                break
            extra, started = "", False
            try:
                async for piece in stream_text(*request):
                    if not started:
                        started = True
                        yield "\n\n"
                        extra = "\n\n"
                    extra += piece
                    yield piece
            except Exception:
                log.warning("top-up failed; the answer is complete without it", exc_info=True)
                break
            text += extra
        return

    # The notes contain code: write the answer, then let the reviewer pass fix it, and stream THAT.
    draft = "".join([piece async for piece in stream_text(models, plan.messages)])
    if not looks_like_code(draft):
        yield draft
        return
    sent = False
    try:
        messages, repair_models = _repair_request(plan, draft)
        async for piece in stream_text(repair_models, messages):
            sent = True
            yield piece
    except Exception:
        log.warning("code pass failed", exc_info=True)
        if sent:
            raise            # part of the fixed answer is already on the screen
        yield draft          # nothing was shown yet: fall back to the draft