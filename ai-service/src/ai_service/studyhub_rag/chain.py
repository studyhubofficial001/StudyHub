import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from functools import lru_cache
from typing import Any,AsyncIterator

from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser

from studyhub_rag.config import settings 
from studyhub_rag.embeddings import OpenRouterEmbeddings
from studyhub_rag.prompts import NO_ANSWER,exam_prompt,prompt
from studyhub_rag.reranker import CohereReranker
from studyhub_rag.retriever import CloudHybridRetriever
from studyhub_rag.llm import choose_provider,get_llm
from studyhub_rag.formatting import build_sources,format_docs 
from studyhub_rag.profiles import est_tokens,get_profile,split_questions
from studyhub_rag.vectorstore import (COLLECTION_NAME,DENSE_VECTOR_NAME,SPARSE_VECTOR_NAME,get_client)

log=logging.getLogger(__name__)

@lru_cache(maxsize=1)
def _parts():
    retriever = CloudHybridRetriever(
        client = get_client(),
        embeddings = OpenRouterEmbeddings(),
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
    return retriever,reranker

def warm_up() -> None:
    _parts()

def retrieve(question:str,filters:dict[str,Any]| None = None,marks:int | None = None) -> list[Document]:
    retriever,reranker = _parts()
    profile = get_profile(marks)
    k = profile.k if marks else settings.retrieve_k
    top_n = profile.top_n if marks else settings.rerank_top_n

    docs = retriever.model_copy(update={"filter":filters or {}, "k": k}).invoke(question)
    if not docs:
        return []
    try:
        return list(reranker.model_copy(update={"top_n":top_n}).compress_documents(docs,question))
    except Exception:
        log.warning("rerank failed; using hybrid order",exc_info=True)
        return docs[:top_n]