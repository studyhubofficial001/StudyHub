from typing import Optional,Sequence
import httpx
from langchain_core.callbacks import Callbacks
from langchain_core.documents import BaseDocumentCompressor,Document

_http = httpx.Client(timeout=30)

class CohereReranker(BaseDocumentCompressor):
    api_key:str
    base_url:str = "https://api.cohere.com"
    model:str = "rerank-v4.0-fast"
    top_n:int = 7

    def compress_documents(self, documents: Sequence[Document],query:str,callbacks:Optional[Callbacks] = None,) -> Sequence[Document]:
        if not documents:
            return []
        resp = _http.post(
            f"{self.base_url}/v2/rerank",
            headers={"Authorization":f"Bearer {self.api_key}"},
            json={
                "model":self.model,
                "query":query,
                "documents":[d.page_content for d in documents],
                "top_n": min(self.top_n,len(documents)),
            }
        )
        resp.raise_for_status()
        ranked = []
        for row in resp.json()["results"]:
            doc = documents[row["index"]]
            ranked.append(
                Document(
                    page_content=doc.page_content,
                    metadata={**doc.metadata,"relevance_score":row["relevance_score"]}
                )
            )
        return ranked