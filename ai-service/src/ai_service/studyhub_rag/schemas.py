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

class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(min_length=1,max_length=settings.max_question_chars)
    marks: Literal[3,5,8,16] | None = None
    filters: Filters | None = None

    def filter_dict(self) -> dict:
        return self.filters.model_dump(exclude_none=True) if self.filters else {}