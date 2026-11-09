from __future__ import annotations

import re
from typing import Any

from ..db.models import CharacterProfileRecord, VoiceCatalogItem


def match_character_voice(
    character: CharacterProfileRecord,
    available_voices: list[VoiceCatalogItem],
    conversation_language: str = "en",
) -> tuple[VoiceCatalogItem, str, list[str]]:
    """
    Deterministic character-to-voice matching engine per Section 11.8.
    Returns: (matched_voice_item, confidence, match_reasons)
    where confidence is 'explicit', 'inferred', or 'neutral_fallback'.
    """
    if not available_voices:
        raise ValueError("No voices available in catalog for matching.")

    # 1. Filter approved and active voices
    candidates = [v for v in available_voices if v.is_approved and v.is_active]
    if not candidates:
        candidates = available_voices

    # Filter to voices that support the selected language per Section 11.8 step 1
    target_lang = "am" if conversation_language.lower().startswith("am") else "en"
    lang_matched = [
        v for v in candidates
        if any(l.lower().startswith(target_lang) for l in (v.language_codes or []))
    ]
    if lang_matched:
        candidates = lang_matched

    # Combine character text context
    text_corpus = " ".join([
        character.name or "",
        character.role or "",
        character.personality or "",
        character.appearance_description or "",
        " ".join(character.relationships or []),
    ]).lower()

    reasons: list[str] = []
    target_gender = "neutral"
    gender_confidence = "none"

    # Analyze gender presentation from role, descriptors, and explicit pronouns
    fem_tokens = {"she", "her", "hers", "woman", "heroine", "lady", "girl", "daughter", "mother", "sister", "miss", "mrs"}
    masc_tokens = {"he", "him", "his", "man", "hero", "lord", "boy", "son", "father", "brother", "mr", "gentleman"}

    found_fem = any(re.search(rf"\b{re.escape(t)}\b", text_corpus) for t in fem_tokens)
    found_masc = any(re.search(rf"\b{re.escape(t)}\b", text_corpus) for t in masc_tokens)

    # Name-based checks for canonical literary characters
    name_lower = (character.name or "").lower()
    if any(n in name_lower for n in ["nastenka", "nástyenka", "elena", "elizabeth", "sonya", "katerina", "jane"]):
        found_fem = True
        reasons.append("Character name and literary identity indicate feminine persona.")
    elif any(n in name_lower for n in ["raskolnikov", "rodion", "astafy", "emelyan", "darcy", "bingley", "dmitri", "ivan"]):
        found_masc = True
        reasons.append("Character name and literary identity indicate masculine persona.")

    if found_fem and not found_masc:
        target_gender = "feminine"
        gender_confidence = "explicit"
        reasons.append("Feminine gender presentation detected.")
    elif found_masc and not found_fem:
        target_gender = "masculine"
        gender_confidence = "explicit"
        reasons.append("Masculine gender presentation detected.")
    else:
        target_gender = "neutral"
        reasons.append("Neutral or dual gender cues detected.")

    # Analyze target age bracket
    target_age = "adult"
    if any(t in text_corpus for t in ["young", "youthful", "seventeen", "eighteen", "girl", "boy"]):
        target_age = "young_adult" if "young" in text_corpus else "youthful"
        reasons.append("Youthful/young-adult age bracket detected.")
    elif any(t in text_corpus for t in ["elderly", "old", "aging", "grey", "white-haired", "veteran"]):
        target_age = "older_adult"
        reasons.append("Mature/older-adult age bracket detected.")

    # Analyze target pitch and style
    target_pitch = "mid"
    target_style = "warm"
    if any(t in text_corpus for t in ["deep", "grave", "commanding", "dark", "somber", "brooding", "intense"]):
        target_pitch = "low"
        target_style = "dramatic"
        reasons.append("Deep, dramatic vocal tone detected.")
    elif any(t in text_corpus for t in ["bright", "playful", "lively", "witty", "energetic", "cheerful"]):
        target_pitch = "high"
        target_style = "playful"
        reasons.append("Bright, lively vocal style detected.")
    elif any(t in text_corpus for t in ["calm", "gentle", "contemplative", "quiet", "dreamy", "sorrowful", "thoughtful"]):
        target_pitch = "mid"
        target_style = "contemplative" if "contemplative" in text_corpus or "dream" in text_corpus else "warm"
        reasons.append("Warm, contemplative speaking style detected.")

    # Score candidates
    scored_candidates: list[tuple[VoiceCatalogItem, int]] = []
    is_amharic = conversation_language.lower().startswith("am")

    for v in candidates:
        score = 0
        v_langs = [l.lower() for l in v.language_codes]

        if is_amharic and "am" in v_langs:
            score += 6
        elif not is_amharic and "en" in v_langs:
            score += 2

        if target_gender != "neutral" and v.gender == target_gender:
            score += 4
        elif target_gender == "neutral" and v.gender == "neutral":
            score += 3

        if v.age_bracket == target_age:
            score += 3

        if v.pitch == target_pitch:
            score += 2

        if v.speaking_style == target_style:
            score += 2

        scored_candidates.append((v, score))

    scored_candidates.sort(key=lambda x: x[1], reverse=True)
    best_voice, best_score = scored_candidates[0]

    confidence = "neutral_fallback"
    if best_score >= 9:
        confidence = "explicit"
    elif best_score >= 5:
        confidence = "inferred"

    return best_voice, confidence, reasons
