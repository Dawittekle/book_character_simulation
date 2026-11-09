from __future__ import annotations

import math
from typing import Any
from pydantic import BaseModel, Field, field_validator

from ..schemas.character import EmotionState, PsiParameters


class PerceivedObservation(BaseModel):
    valence_delta: float = Field(default=0.0, ge=-1.0, le=1.0)
    arousal_delta: float = Field(default=0.0, ge=-1.0, le=1.0)
    threat_level: float = Field(default=0.0, ge=0.0, le=1.0)
    goal_relevance: float = Field(default=0.0, ge=0.0, le=1.0)
    connection_delta: float = Field(default=0.0, ge=-1.0, le=1.0)

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> PerceivedObservation:
        if not data or not isinstance(data, dict):
            return cls()
        clean = {}
        for key in ("valence_delta", "arousal_delta", "threat_level", "goal_relevance", "connection_delta"):
            val = data.get(key)
            if val is not None:
                try:
                    fval = float(val)
                    if math.isnan(fval):
                        fval = 0.0
                    clean[key] = fval
                except (ValueError, TypeError):
                    clean[key] = 0.0
        # Clamp bounds
        clean["valence_delta"] = max(-1.0, min(1.0, clean.get("valence_delta", 0.0)))
        clean["arousal_delta"] = max(-1.0, min(1.0, clean.get("arousal_delta", 0.0)))
        clean["threat_level"] = max(0.0, min(1.0, clean.get("threat_level", 0.0)))
        clean["goal_relevance"] = max(0.0, min(1.0, clean.get("goal_relevance", 0.0)))
        clean["connection_delta"] = max(-1.0, min(1.0, clean.get("connection_delta", 0.0)))
        return cls(**clean)


def clamp(value: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    if math.isnan(value):
        return min_val
    return round(max(min_val, min(max_val, value)), 3)


class PsiEngine:
    RULES_VERSION: str = "v1.0"

    @classmethod
    def apply_transition(
        cls,
        *,
        current_psi: dict[str, Any],
        current_emotion: dict[str, Any],
        observation: PerceivedObservation,
    ) -> tuple[dict[str, float], dict[str, float], dict[str, float], dict[str, float]]:
        """
        Applies deterministic, bounded transition rules to PSI parameters and emotional states.
        
        Returns:
            (resulting_psi, resulting_emotion, delta_psi, delta_emotion)
        """
        # Validate current state with fallbacks
        v = float(current_psi.get("valence_level", 0.5))
        a = float(current_psi.get("arousal_level", 0.5))
        st = float(current_psi.get("selection_threshold", 0.5))
        res = float(current_psi.get("resolution_level", 0.5))
        gd = float(current_psi.get("goal_directedness", 0.5))
        sec = float(current_psi.get("securing_rate", 0.5))

        em_anger = float(current_emotion.get("anger", 0.0))
        em_sadness = float(current_emotion.get("sadness", 0.0))
        em_pride = float(current_emotion.get("pride", 0.0))
        em_joy = float(current_emotion.get("joy", 0.0))
        em_bliss = float(current_emotion.get("bliss", 0.0))

        # --- Deterministic PSI Rules ---
        new_v = clamp(v + 0.3 * observation.valence_delta + 0.1 * observation.connection_delta)
        new_a = clamp(0.7 * a + 0.3 * (a + observation.arousal_delta) + 0.2 * observation.threat_level)
        new_st = clamp(st - 0.15 * observation.arousal_delta + 0.1 * observation.goal_relevance)
        new_res = clamp(res - 0.2 * observation.threat_level + 0.1 * observation.connection_delta)
        new_gd = clamp(gd + 0.2 * observation.goal_relevance - 0.1 * observation.threat_level)
        new_sec = clamp(sec + 0.25 * observation.threat_level - 0.1 * observation.connection_delta)

        resulting_psi = {
            "valence_level": new_v,
            "arousal_level": new_a,
            "selection_threshold": new_st,
            "resolution_level": new_res,
            "goal_directedness": new_gd,
            "securing_rate": new_sec,
        }

        # --- Deterministic Emotion Rules ---
        neg_val = max(0.0, -observation.valence_delta)
        pos_val = max(0.0, observation.valence_delta)
        pos_conn = max(0.0, observation.connection_delta)

        new_anger = clamp(0.6 * em_anger + 0.4 * (observation.threat_level + neg_val))
        new_sadness = clamp(0.6 * em_sadness + 0.4 * (neg_val * (1.0 - observation.threat_level)))
        new_joy = clamp(0.6 * em_joy + 0.4 * (pos_val + pos_conn))
        new_pride = clamp(0.6 * em_pride + 0.3 * observation.goal_relevance + 0.1 * pos_val)
        new_bliss = clamp(0.6 * em_bliss + 0.4 * (pos_val * pos_conn))

        resulting_emotion = {
            "anger": new_anger,
            "sadness": new_sadness,
            "pride": new_pride,
            "joy": new_joy,
            "bliss": new_bliss,
        }

        # Compute deltas
        delta_psi = {k: round(resulting_psi[k] - current_psi.get(k, 0.5), 3) for k in resulting_psi}
        delta_emotion = {k: round(resulting_emotion[k] - current_emotion.get(k, 0.0), 3) for k in resulting_emotion}

        return resulting_psi, resulting_emotion, delta_psi, delta_emotion
