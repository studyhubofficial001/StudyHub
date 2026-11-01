import logging
import time
import httpx
from langchain_core.embeddings import Embeddings

from studyhub_rag.config import settings

log=logging.getLogger(__name__)

QUERY_PREFIX="query: "
DOC_PREFIX="document: "
MAX_CHARS=1400
BATCH=32

class OpenRouterEmbeddings(Embeddings):
    def __init__(self) -> None:
        self._http = httpx.Client(base_url=settings.openrouter_base_url,timeout=30)
        self._key_idx = 0

    def _request(self,texts: list[str]) -> list[list[float]]:
        keys = settings.openrouter_api_keys
        last_error = "unknown error"
        for attempt in range(len(keys) * 2):
            idx = (self._key_idx + attempt) % len(keys)
            try:
                resp = self._http.post(
                    "/embeddings",
                    headers={"Authorization" : f"Bearer {keys[idx]}"},
                    json={"model":settings.embed_model,"input":texts},
                )
            except httpx.HTTPError as exc:
                last_error = f"network error : {exc}"
                time.sleep(min(attempt,3))
                continue
            if resp.status_code != 200:
                last_error = f"HTTP {resp.status_code}:{resp.text[:200]}"
                log.warning("embedding key #%d failed (%s)",idx,last_error)
                time.sleep(min(attempt,3))
                continue
            body = resp.json()
            if "data" not in body:
                last_error = f"bad response : {str(body)[:200]}"
                time.sleep(min(attempt,3))
                continue
            rows = sorted(body["data"],key=lambda r: r.get("index",0))
            vectors = [r["embedding"] for r in rows]
            if len(vectors) != len(texts):
                raise RuntimeError(
                    f"model returned {len(vectors)} vectors for {len(texts)} inputs"
                )
            invalid_dimensions = [
                len(vector) for vector in vectors
                if len(vector) != settings.embed_dimensions
            ]
            if invalid_dimensions:
                raise RuntimeError(
                    f"model returned {invalid_dimensions[0]} numbers per vector, "
                    f"expected {settings.embed_dimensions} (set EMBED_DIMENSIONS / EMBED_MODEL)"
                )
            self._key_idx = idx
            return vectors
        raise RuntimeError(f"embedding failed on every key: {last_error}")

    def _embed(self,texts:list[str],prefix: str) -> list[list[float]]:
        out:list[list[float]] = []
        for i in range(0, len(texts),BATCH):
            batch = [prefix + t[:MAX_CHARS] for t in texts[i:i + BATCH]]
            out.extend(self._request(batch))
        return out

    def embed_query(self, text:str) -> list[float]:
        return self._embed([text],QUERY_PREFIX)[0]

    def embed_documents(self, texts:list[str]) -> list[list[float]]:
        return self._embed(texts,DOC_PREFIX)