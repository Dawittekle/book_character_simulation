from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field

from .character import EmotionState, PsiParameters


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["user", "ai"]
    content: str = Field(min_length=1)


class ChatReplyPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reply: str
    updated_psi: PsiParameters
    updated_emotion_state: EmotionState


class ChatTurnResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    reply: str
    updated_psi: PsiParameters
    emotion_state: EmotionState


class ExtractedFacts(BaseModel):
    model_config = ConfigDict(extra="forbid")

    facts: list[str]


class FactualMemoryRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(default_factory=lambda: str(uuid4()))
    character_id: str
    text_id: str
    fact: str
    source_session_id: str
    created_at: datetime = Field(default_factory=utc_now)


class ChatSessionState(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(default_factory=lambda: str(uuid4()))
    character_id: str
    text_id: str
    psi_parameters: PsiParameters
    emotion_state: EmotionState
    chat_history: list[ChatMessage] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)
    last_updated: datetime = Field(default_factory=utc_now)
