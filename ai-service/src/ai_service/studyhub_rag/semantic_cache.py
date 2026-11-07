"""studyhub_rag/semantic_cache.py: Redis semantic cache for the RAG answers.

Flow (see main.py):
    question -> embed -> look for a cached question with almost the same meaning (same filters, same marks)
        hit  -> replay the stored answer + sources (no Qdrant, no Cohere, no Groq/Gemini)
        miss -> normal RAG -> store {question, embedding, answer, sources} with a TTL

Needs Redis Stack or Redis 8+ (the search module with vector fields). Plain Redis does not work.
The cache FAILS OPEN: if Redis is down or slow, the request just runs the normal RAG path.
"""
import asyncio
import hashlib
import json
import logging
import uuid
from array import array
from dataclasses import dataclass
from typing import Any

from redis.asyncio import Redis
from redis.commands.search.field import TagField, TextField, VectorField
try:  # redis-py 6+ renamed this module
    from redis.commands.search.index_definition import IndexDefinition, IndexType
except ImportError:  # redis-py 5.x
    from redis.commands.search.indexDefinition import IndexDefinition, IndexType
from redis.commands.search.query import Query
from redis.exceptions import RedisError, ResponseError

from studyhub_rag.config import settings
from studyhub_rag.embeddings import OpenRouterEmbeddings

log = logging.getLogger(__name__)

TIMEOUT_SECONDS = 1.5   # Redis must answer fast, otherwise we skip the cache for this request


@dataclass
class CacheHit:
    answer: str
    sources: list
    meta: dict
    score: float
    matched_question: str


def _s(value) -> str:
    return value.decode("utf-8", "replace") if isinstance(value, (bytes, bytearray)) else str(value)


def _to_blob(vector: list[float]) -> bytes:
    return array("f", vector).tobytes()


def _norm_filters(filters: dict[str, Any] | None) -> dict:
    out = {}
    for key, value in (filters or {}).items():
        if value in (None, "", []):
            continue
        out[key] = sorted(value, key=str) if isinstance(value, list) else value
    return out


def make_scope(filters: dict[str, Any] | None, marks: int | None) -> str:
    """Entries only match inside the same scope: same year/subject/category/resource filters, same marks
    (a 3 mark and a 16 mark answer to the same question are different answers) and same CACHE_VERSION."""
    raw = json.dumps({"v": settings.cache_version, "f": _norm_filters(filters), "m": marks}, sort_keys=True)
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


class SemanticCache:
    def __init__(self) -> None:
        self.enabled = bool(settings.cache_enabled and settings.redis_url)
        self.dim = settings.embed_dimensions
        self.index = f"shcache_idx_{self.dim}"     # the dimension is in the name: a new embed model gets a new index
        self.prefix = f"shcache:{self.dim}:"
        self._redis: Redis | None = None
        self._index_ready = False
        self._embedder = OpenRouterEmbeddings()
        if self.enabled:
            log.info("semantic cache ON (threshold=%.2f ttl=%ds version=%s)",
                     settings.cache_threshold, settings.cache_ttl_seconds, settings.cache_version)
        else:
            log.info("semantic cache OFF (set REDIS_URL to switch it on)")

    # ------------------------------------------------------------ connection
    def _client(self) -> Redis:
        if self._redis is None:   # created lazily, inside the running event loop
            self._redis = Redis.from_url(
                settings.redis_url,
                socket_timeout=TIMEOUT_SECONDS,
                socket_connect_timeout=TIMEOUT_SECONDS,
                decode_responses=False,   # the vector is raw bytes
            )
        return self._redis

    async def _ensure_index(self) -> None:
        if self._index_ready:
            return
        r = self._client()
        try:
            await r.ft(self.index).info()
        except ResponseError:   # index does not exist yet
            try:
                await r.ft(self.index).create_index(
                    [
                        TagField("scope"),
                        TextField("question"),
                        VectorField("vec", "FLAT", {"TYPE": "FLOAT32", "DIM": self.dim, "DISTANCE_METRIC": "COSINE"}),
                    ],
                    definition=IndexDefinition(prefix=[self.prefix], index_type=IndexType.HASH),
                )
                log.info("created Redis index %s", self.index)
            except ResponseError as exc:
                if "already exists" not in str(exc).lower():
                    raise
        self._index_ready = True

    async def close(self) -> None:
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None

    # ------------------------------------------------------------ lookup
    async def embed(self, question: str) -> list[float]:
        return await asyncio.to_thread(self._embedder.embed_query, question.strip())

    async def lookup(self, question: str, filters: dict | None, marks: int | None) -> tuple[CacheHit | None, list[float] | None]:
        """(hit or None, the question's embedding or None). The embedding is kept so store() does not embed again."""
        if not self.enabled:
            return None, None
        try:
            vector = await self.embed(question)
        except Exception:
            log.warning("cache: could not embed the question; skipping the cache", exc_info=True)
            return None, None
        try:
            await self._ensure_index()
            scope = make_scope(filters, marks)
            query = (
                Query(f"(@scope:{{{scope}}})=>[KNN 1 @vec $blob AS dist]")
                .sort_by("dist")
                .return_fields("question", "answer", "sources", "meta", "dist")
                .dialect(2)
            )
            result = await self._client().ft(self.index).search(query, query_params={"blob": _to_blob(vector)})
            if not result.docs:
                log.info("cache MISS (nothing stored in this scope)")
                return None, vector
            doc = result.docs[0]
            score = 1.0 - float(_s(doc.dist))   # COSINE distance -> similarity
            if score < settings.cache_threshold:
                log.info("cache MISS best=%.3f < threshold=%.2f matched=%r", score, settings.cache_threshold, _s(doc.question)[:60])
                return None, vector
            hit = CacheHit(
                answer=_s(doc.answer),
                sources=json.loads(_s(doc.sources)),
                meta=json.loads(_s(doc.meta)),
                score=score,
                matched_question=_s(doc.question),
            )
            log.info("cache HIT score=%.3f %r <- %r", score, question[:60], hit.matched_question[:60])
            return hit, vector
        except (RedisError, OSError, ValueError):
            log.warning("cache: lookup failed; continuing without the cache", exc_info=True)
            return None, vector

    # ------------------------------------------------------------ store
    async def store(self, question: str, vector: list[float] | None, filters: dict | None, marks: int | None,
                    answer: str, sources: list, meta: dict) -> None:
        if not self.enabled or vector is None or not answer.strip():
            return
        try:
            await self._ensure_index()
            key = f"{self.prefix}{uuid.uuid4().hex}"
            pipe = self._client().pipeline()
            pipe.hset(key, mapping={
                "scope": make_scope(filters, marks),
                "question": question.strip(),
                "answer": answer,
                "sources": json.dumps(sources),
                "meta": json.dumps(meta),
                "vec": _to_blob(vector),
            })
            pipe.expire(key, settings.cache_ttl_seconds)
            await pipe.execute()
            log.info("cache STORE %r (marks=%s)", question[:60], marks)
        except (RedisError, OSError, ValueError):
            log.warning("cache: store failed; the answer was still sent", exc_info=True)

    # ------------------------------------------------------------ admin
    async def clear(self) -> int:
        """Delete every cached entry (call after re-ingesting notes). Returns how many were deleted."""
        if not self.enabled:
            return 0
        r = self._client()
        deleted = 0
        async for key in r.scan_iter(match=f"{self.prefix}*", count=500):
            deleted += await r.delete(key)
        return deleted


semantic_cache = SemanticCache()