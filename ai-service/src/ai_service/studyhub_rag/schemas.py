from typing import Literal
from pydantic import BaseModel,ConfigDict,Field
from studyhub_rag.config import settings

Value = str | int | list[str | int] | None

class Filters(BaseModel):
    model_config = ConfigDict(extra = "forbid")
    subject: Value = None
    year: Value = None
    category: Value = None
    resource_id: Value = None

class HistoryItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    text: str = Field(max_length=8000)

class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(min_length=1,max_length=settings.max_question_chars)
    marks: Literal[3,5,8,16] | None = None
    filters: Filters | None = None
    history: list[HistoryItem] = Field(default_factory=list, max_length=8)  # earlier messages of this chat

    def history_list(self) -> list[dict]:
        return [item.model_dump() for item in self.history]

    def filter_dict(self) -> dict:
        return self.filters.model_dump(exclude_none=True) if self.filters else {}