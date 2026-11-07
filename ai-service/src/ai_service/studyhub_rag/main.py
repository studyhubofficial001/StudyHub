import asyncio
import hmac
import json
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse

from studyhub_rag import chain
from studyhub_rag.config import settings
from studyhub_rag.conversation import clean_history
from studyhub_rag.followup import is_standalone
from studyhub_rag.formatting import build_sources
from studyhub_rag.prompts import NO_ANSWER
from studyhub_rag.schemas import ChatRequest
from studyhub_rag.semantic_cache import semantic_cache

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    chain.warm_up()  # builds objects only; makes no network calls
    yield
    await semantic_cache.close()

app = FastAPI(title="studyhub-rag-service", lifespan=lifespan)

def check_key(x_internal_key: str = Header(default="")) -> None:
    if settings.internal_key and not hmac.compare_digest(x_internal_key, settings.internal_key):
        raise HTTPException(status_code=401, detail="unauthorized")

@app.get("/ping")  # your Express /api/ai/ping calls this
def ping() -> dict:
    return {"pong": True}

@app.get("/health")
def health() -> dict:
    return {"ok": True}

def _cacheable(answer: str) -> bool:
    """Never cache an empty answer or the 'insufficient information' reply (the notes may be added later)."""
    text = answer.strip()
    return bool(text) and not text.lower().startswith(NO_ANSWER[:40].lower())

async def _replay(text: str, size: int = 80):
    """Send a cached answer in small pieces, so the frontend sees the same token events as a normal answer."""
    for i in range(0, len(text), size):
        yield text[i:i + size]
        await asyncio.sleep(0.01)

@app.post("/chat", dependencies=[Depends(check_key)])
async def chat(req: ChatRequest) -> dict:
    filters = req.filter_dict()
    hit, vector = await semantic_cache.lookup(req.question, filters, req.marks)
    if hit:
        return {"answer": hit.answer, "sources": hit.sources, "cached": True}
    result = await asyncio.to_thread(chain.answer, req.question, filters, req.marks)
    if result["docs"] and _cacheable(result["answer"]):
        await semantic_cache.store(req.question, vector, filters, req.marks,
                                   result["answer"], result["sources"], {"provider": result["provider"]})
    return {"answer": result["answer"], "sources": result["sources"], "cached": False}

@app.post("/cache/clear", dependencies=[Depends(check_key)])
async def clear_cache() -> dict:
    """Call this after re-ingesting notes (or just bump CACHE_VERSION in .env and restart)."""
    return {"deleted": await semantic_cache.clear()}

def sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"

@app.post("/chat/stream", dependencies=[Depends(check_key)])
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    async def events():
        try:
            yield sse("status", {"stage": "searching"})
            filters = req.filter_dict()

            # A question that makes sense on its own ("what is java?") does not need the chat history: drop it. That
            # skips the slow Groq rewrite, makes the answer independent of the chat, and so makes it safe to cache.
            # A real follow-up ("what is its output?") keeps its history and skips the cache.
            history = req.history_list()
            if history and is_standalone(req.question):
                history = []
            use_cache = semantic_cache.enabled and not clean_history(history)
            if not use_cache and semantic_cache.enabled:
                log.info("cache skipped: follow-up question")
            vector = None
            if use_cache:
                hit, vector = await semantic_cache.lookup(req.question, filters, req.marks)
                if hit:
                    yield sse("meta", {**hit.meta, "provider": "cache", "cached": True})
                    yield sse("sources", hit.sources)
                    yield sse("status", {"stage": "writing"})
                    async for piece in _replay(hit.answer):
                        yield sse("token", {"text": piece})
                    yield sse("done", {"message": "streaming complete"})
                    return

            plan = await asyncio.to_thread(chain.prepare, req.question, req.marks, req.filter_dict(), history)
            sources = build_sources(plan.docs)
            yield sse("meta", plan.meta())
            yield sse("sources", sources)
            yield sse("status", {"stage": "writing"})
            pieces: list[str] = []
            async for piece in chain.stream_answer(plan):
                pieces.append(piece)
                yield sse("token", {"text": piece})

            # The stream finished without an error: keep the answer for the next student who asks the same thing.
            answer = "".join(pieces)
            if use_cache and plan.docs and _cacheable(answer):
                await semantic_cache.store(req.question, vector, filters, req.marks, answer, sources, plan.meta())
            yield sse("done", {"message": "streaming complete"})
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("chat stream failed")
            yield sse("error",{"message":"Something went wrong.Please try again."})
    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control":"no-cache, no-transform", "X-Accel-Buffering":"no"},
    )