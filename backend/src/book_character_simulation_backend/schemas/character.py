from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class PsiParameters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    valence_level: float = Field(ge=0.0, le=1.0)
    arousal_level: float = Field(ge=0.0, le=1.0)
    selection_threshold: float = Field(ge=0.0, le=1.0)
    resolution_level: float = Field(ge=0.0, le=1.0)
    goal_directedness: float = Field(ge=0.0, le=1.0)
    securing_rate: float = Field(ge=0.0, le=1.0)


class EmotionState(BaseModel):
    model_config = ConfigDict(extra="forbid")

    anger: float = Field(ge=0.0, le=1.0)
    sadness: float = Field(ge=0.0, le=1.0)
    pride: float = Field(ge=0.0, le=1.0)
    joy: float = Field(ge=0.0, le=1.0)
    bliss: float = Field(ge=0.0, le=1.0)


class CharacterProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    personality: str
    key_events: list[str]
    relationships: list[str]
    psi_parameters: PsiParameters
    emotion_state: EmotionState
