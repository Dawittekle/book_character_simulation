from __future__ import annotations

import re
from typing import Any

from ..db.models import AvatarAsset, CharacterProfileRecord


def match_character_avatar(
    character: CharacterProfileRecord,
    available_avatars: list[AvatarAsset],
) -> tuple[AvatarAsset, str, list[str]]:
    """
    Deterministic character-to-avatar matching engine per Section 9.3.
    Returns: (matched_avatar, confidence, match_reasons)
    where confidence is 'explicit', 'inferred', or 'neutral_fallback'.
    """
    if not available_avatars:
        raise ValueError("No avatar assets available in catalog for matching.")

    candidates = [a for a in available_avatars if a.is_approved and a.is_active and not a.is_fallback]
    fallback_avatar = next((a for a in available_avatars if a.is_fallback), available_avatars[0])

    if not candidates:
        return fallback_avatar, "neutral_fallback", ["No curated specific portraits available; using canonical silhouette."]

    corpus = " ".join([
        character.name or "",
        character.role or "",
        character.personality or "",
        character.appearance_description or "",
        " ".join(character.relationships or []),
    ]).lower()

    reasons: list[str] = []

    # 1. Gender presentation analysis
    fem_tokens = {"she", "her", "hers", "woman", "heroine", "lady", "girl", "daughter", "mother", "sister", "miss", "mrs"}
    masc_tokens = {"he", "him", "his", "man", "hero", "lord", "boy", "son", "father", "brother", "mr", "gentleman"}

    found_fem = any(re.search(rf"\b{re.escape(t)}\b", corpus) for t in fem_tokens)
    found_masc = any(re.search(rf"\b{re.escape(t)}\b", corpus) for t in masc_tokens)

    name_lower = (character.name or "").lower()
    if any(n in name_lower for n in ["nastenka", "nástyenka", "sonya", "dunya", "elena", "elizabeth", "katerina"]):
        found_fem = True
    elif any(n in name_lower for n in ["raskolnikov", "rodion", "astafy", "razumikhin", "porfiry", "darcy", "dreamer"]):
        found_masc = True

    target_gender = "neutral"
    if found_fem and not found_masc:
        target_gender = "feminine"
        reasons.append("Feminine persona detected.")
    elif found_masc and not found_fem:
        target_gender = "masculine"
        reasons.append("Masculine persona detected.")
    else:
        target_gender = "neutral"

    # 2. Target age bracket
    target_age = "adult"
    if any(t in corpus for t in ["young", "youthful", "seventeen", "eighteen", "girl", "student", "boy"]):
        target_age = "young_adult"
        reasons.append("Young adult / youthful persona detected.")
    elif any(t in corpus for t in ["elderly", "old", "aging", "grey", "veteran"]):
        target_age = "older_adult"
        reasons.append("Mature / older adult persona detected.")

    # 3. Score candidate portraits
    scored: list[tuple[AvatarAsset, int]] = []
    for avatar in candidates:
        score = 0
        if target_gender != "neutral" and avatar.gender == target_gender:
            score += 5
        elif target_gender == "neutral" and avatar.gender == "neutral":
            score += 4

        if avatar.apparent_age == target_age:
            score += 3

        # Tag overlap with corpus
        avatar_tags = [t.lower() for t in (avatar.tags or [])]
        matched_tags = 0
        for tag in avatar_tags:
            tag_clean = tag.replace("_", " ")
            if tag in corpus or tag_clean in corpus:
                score += 2
                matched_tags += 1

        if matched_tags > 0:
            reasons.append(f"Visual descriptor overlap: matched {matched_tags} attributes.")

        scored.append((avatar, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    best_avatar, best_score = scored[0]

    confidence = "neutral_fallback"
    if best_score >= 10:
        confidence = "explicit"
    elif best_score >= 6:
        confidence = "inferred"
    else:
        best_avatar = fallback_avatar
        confidence = "neutral_fallback"
        reasons.append("Score fell below minimum threshold; applying neutral literary portrait.")

    return best_avatar, confidence, reasons
