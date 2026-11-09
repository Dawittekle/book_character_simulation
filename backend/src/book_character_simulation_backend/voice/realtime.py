from __future__ import annotations

import hmac
import hashlib
import time
from typing import Any
import uuid

from ..config import Settings
from ..db.models import CharacterProfileRecord, ChatSession, UserAccount, UserSettings
from ..errors import BadRequestError, ForbiddenError, NotFoundError


REALTIME_SUPPORTED_VOICES = {
    "alloy": "alloy",
    "echo": "echo",
    "shimmer": "shimmer",
    "nova": "shimmer",     # Map feminine nova to shimmer in realtime
    "onyx": "echo",        # Map deep onyx to echo in realtime
    "fable": "echo",
    "geez_narrator": "alloy",
}


def build_realtime_instructions(character: CharacterProfileRecord, session: ChatSession) -> str:
    """Generates authoritative system instructions for the Realtime voice session."""
    name = character.name or "Character"
    role = character.role or "Fictional Character"
    personality = character.personality or "Reflective, literary"
    current_chapter = session.reading_progress_chapter or 1

    return (
        f"You are the voice of {name} ({role}) from classical literature. "
        f"Personality: {personality}. "
        f"Current reader progress is strictly bounded to Chapter {current_chapter}. "
        "CRITICAL GROUNDING DIRECTIVE: You MUST NEVER invent future plot developments, facts, or events "
        f"beyond Chapter {current_chapter}. Whenever the reader asks any question about the book, events, "
        "motives, or personal memories, you MUST call the controlled tool 'lorely_grounded_response' "
        "to obtain authoritatively book-grounded dialogue before speaking. "
        "Speak naturally in character, honoring your established tone."
    )


def build_controlled_tools() -> list[dict[str, Any]]:
    """Returns controlled backend tool definitions so Lorely owns RAG/character state."""
    return [
        {
            "type": "function",
            "name": "lorely_grounded_response",
            "description": (
                "Fetch authoritatively book-grounded dialogue, spoiler-filtered context, "
                "and emotional state transition from the Lorely simulation engine."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "reader_message": {
                        "type": "string",
                        "description": "The exact utterance or question spoken by the reader.",
                    }
                },
                "required": ["reader_message"],
            },
        }
    ]


def generate_ephemeral_realtime_grant(
    settings: Settings,
    *,
    user_id: str,
    session_id: str,
    voice_id: str,
    ttl_seconds: int = 60,
) -> dict[str, Any]:
    """Generates short-lived, signed session credentials server-side per Section 11.5."""
    expires_at = int(time.time()) + ttl_seconds
    grant_id = uuid.uuid4().hex
    raw_payload = f"{user_id}:{session_id}:{voice_id}:{expires_at}:{grant_id}"
    secret_str = getattr(settings, "supabase_jwt_secret", None) or "lorely-realtime-secret"
    secret = secret_str.encode("utf-8")
    signature = hmac.new(secret, raw_payload.encode("utf-8"), hashlib.sha256).hexdigest()

    return {
        "grant_id": grant_id,
        "session_id": session_id,
        "voice": voice_id,
        "expires_at": expires_at,
        "token": f"rt_{grant_id}_{signature[:24]}",
        "client_secret": {
            "value": f"ek_lorely_{signature[:32]}",
            "expires_at": expires_at,
        },
    }
