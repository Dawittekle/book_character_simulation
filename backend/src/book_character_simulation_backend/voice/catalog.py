from __future__ import annotations

from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import VoiceCatalogItem


SEED_VOICE_CATALOG: list[dict[str, Any]] = [
    {
        "voice_id": "nova",
        "provider": "openai",
        "name": "Nova (Warm & Expressive)",
        "gender": "feminine",
        "age_bracket": "young_adult",
        "pitch": "mid",
        "speaking_style": "warm",
        "accent": "american",
        "language_codes": ["en"],
        "sample_text": "There is nothing in the world more delightful than sharing a quiet hour with an honest friend.",
        "is_approved": True,
        "is_active": True,
    },
    {
        "voice_id": "shimmer",
        "provider": "openai",
        "name": "Shimmer (Bright & Youthful)",
        "gender": "feminine",
        "age_bracket": "youthful",
        "pitch": "high",
        "speaking_style": "playful",
        "accent": "american",
        "language_codes": ["en"],
        "sample_text": "The world is full of wonder if only we take the time to notice the subtleties around us.",
        "is_approved": True,
        "is_active": True,
    },
    {
        "voice_id": "alloy",
        "provider": "openai",
        "name": "Alloy (Clear & Balanced)",
        "gender": "neutral",
        "age_bracket": "adult",
        "pitch": "mid",
        "speaking_style": "formal",
        "accent": "neutral",
        "language_codes": ["en"],
        "sample_text": "Every page reveals a new question, and every thought is worth examining closely.",
        "is_approved": True,
        "is_active": True,
    },
    {
        "voice_id": "echo",
        "provider": "openai",
        "name": "Echo (Calm & Resonant)",
        "gender": "masculine",
        "age_bracket": "adult",
        "pitch": "low",
        "speaking_style": "contemplative",
        "accent": "american",
        "language_codes": ["en"],
        "sample_text": "In the quiet of the night, truth speaks louder than the daytime clamor.",
        "is_approved": True,
        "is_active": True,
    },
    {
        "voice_id": "onyx",
        "provider": "openai",
        "name": "Onyx (Deep & Authoritative)",
        "gender": "masculine",
        "age_bracket": "older_adult",
        "pitch": "low",
        "speaking_style": "dramatic",
        "accent": "american",
        "language_codes": ["en"],
        "sample_text": "We must face our choices with courage, no matter the consequences that follow.",
        "is_approved": True,
        "is_active": True,
    },
    {
        "voice_id": "fable",
        "provider": "openai",
        "name": "Fable (British & Theatrical)",
        "gender": "masculine",
        "age_bracket": "adult",
        "pitch": "mid",
        "speaking_style": "playful",
        "accent": "british",
        "language_codes": ["en"],
        "sample_text": "Listen closely, traveler, for every great tale begins with an unforeseen journey.",
        "is_approved": True,
        "is_active": True,
    },
    {
        "voice_id": "geez_narrator",
        "provider": "local_harmonic",
        "name": "Ge'ez Literary Voice (Warm & Measured)",
        "gender": "neutral",
        "age_bracket": "adult",
        "pitch": "mid",
        "speaking_style": "warm",
        "accent": "neutral",
        "language_codes": ["en", "am"],
        "sample_text": "ሰላም ለእርስዎ ይሁን። ታሪኩን እና ምስጢሩን በጥልቀት አብረን እንመርምር።",
        "is_approved": True,
        "is_active": True,
    },
]


def sync_seed_voice_catalog(session: Session) -> list[VoiceCatalogItem]:
    """Ensures that the curated approved voice catalog is populated in the database."""
    items: list[VoiceCatalogItem] = []
    for voice_dict in SEED_VOICE_CATALOG:
        existing = session.scalar(
            select(VoiceCatalogItem).where(VoiceCatalogItem.voice_id == voice_dict["voice_id"])
        )
        if existing is None:
            item = VoiceCatalogItem(**voice_dict)
            session.add(item)
            items.append(item)
        else:
            items.append(existing)
    session.flush()
    return items
