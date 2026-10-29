from typing import Any
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from pydantic import Field
from langchain_core.retrievers import BaseRetriever
from qdrant_client import QdrantClient,models

from studyhub_rag.vectorstore import SPARSE_MODEL
FILTER_FIELDS=("subject","year","category","resource_id")

def build_filter(filters:dict[str,Any] | None) -> models.Filter | None:
    conditions = []
    for field in FILTER_FIELDS:
        value = (filters or {}).get(field)
        if value in (None,"",[]):
            continue
        if isinstance(value, list):
            match = models.MatchAny(any=value)
        else:
            match = models.MatchValue(value=value)
        conditions.append(models.FieldCondition(key=f"metadata.{field}",match=match))
    return models.Filter(must=conditions) if conditions else None

class CloudHybridRetriever(BaseRetriever):
    client:QdrantClient
    embeddings:Embeddings
    collection_name:str
    dense_vector_name:str
    sparse_vector_name: str
    k:int=20
    filters: dict[str,Any] = Field(default_factory=dict)

    def _get_relevant_documents(self, query, *, run_manager:CallbackManagerForRetrieverRun) -> list[Document]:
        dense_vector = self.embeddings.embed_query(query)
        flt = build_filter(self.filters)
        response = self.client.query_points(
            collection_name = self.collection_name,
            prefetch = [
                models.Prefetch(
                    query=dense_vector,
                    using=self.dense_vector_name,
                    filter=flt,
                    limit=self.k,
                ),
                models.Prefetch(
                    query = models.Document(text = query,model=SPARSE_MODEL),
                    using=self.sparse_vector_name,
                    filter = flt,
                    limit=self.k,
                )
            ],
            query = models.FusionQuery(fusion=models.Fusion.RRF),
            limit = self.k,
            with_payload=True,
            with_vectors = False,
        )

        documents = []
        for point in response.points:
            payload = point.payload or {}
            documents.append(
                Document(
                    page_content=payload.get("page_content",""),
                    metadata=payload.get("metadata") or {},
                )   
            )
        return documents