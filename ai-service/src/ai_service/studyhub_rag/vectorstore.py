from functools import lru_cache
from qdrant_client import QdrantClient
from studyhub_rag.config import settings

COLLECTION_NAME="resources"
DENSE_VECTOR_NAME="dense"
SPARSE_VECTOR_NAME="bm25"
SPARSE_MODEL="Qdrant/bm25"

@lru_cache(maxsize=1)
def get_client() -> QdrantClient:
    return QdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key,
        timeout=60,
        cloud_inference=True,
    )