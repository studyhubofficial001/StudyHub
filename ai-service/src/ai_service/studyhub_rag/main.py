import asyncio
import hmac
import json
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse

from studyhub_rag import chain
from studyhub_rag.config import settings
from studyhub_rag.formatting import build_sources
from studyhub_rag.schemas import ChatRequest

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    chain.warm_up()  # builds objects only; makes no network calls
    yield

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

@app.post("/chat", dependencies=[Depends(check_key)])
async def chat(req: ChatRequest) -> dict:
    result = await asyncio.to_thread(chain.answer, req.question, req.filter_dict(), req.marks)
    return {"answer": result["answer"], "sources": result["sources"]}

def sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"

@app.post("/chat/stream", dependencies=[Depends(check_key)])
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    async def events():
        try:
            yield sse("status", {"stage": "searching"})
            plan = await asyncio.to_thread(chain.prepare, req.question, req.marks, req.filter_dict())
            yield sse("meta", plan.meta())
            yield sse("sources", build_sources(plan.docs))
            yield sse("status", {"stage": "writing"})
            async for piece in chain.stream_answer(plan):
                yield sse("token", {"text": piece})
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