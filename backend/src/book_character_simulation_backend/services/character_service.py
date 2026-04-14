from __future__ import annotations

import hashlib
import logging

from ..auth import AuthenticatedUser
from ..config import Settings
from ..errors import AppError
from ..llm import LLMProviderFactory
from ..prompts import character_extraction_prompt
from ..repositories.chroma import ChromaCharacterRepository
from ..schemas.character import CharacterProfile
from ..utils.json import parse_json_response
from .relational_persistence_service import RelationalPersistenceService

logger = logging.getLogger(__name__)


class CharacterService:
    def __init__(
        self,
        *,
        settings: Settings,
        character_repository: ChromaCharacterRepository,
        relational_persistence_service: RelationalPersistenceService | None = None,
    ) -> None:
        self.settings = settings
        self.character_repository = character_repository
        self.provider_factory = LLMProviderFactory(settings)
        self.relational_persistence_service = relational_persistence_service

    def extract_characters(
        self,
        *,
        authenticated_user: AuthenticatedUser | None,
        text_id: str,
        text: str,
        llm_provider: str | None = None,
    ) -> list[CharacterProfile]:
        if self.relational_persistence_service is not None:
            relational_characters = self.relational_persistence_service.get_characters(
                authenticated_user=authenticated_user,
                text_id=text_id
            )
            if relational_characters:
                logger.info(
                    "Returning Postgres-backed cached characters for text_id=%s",
                    text_id,
                )
                if authenticated_user is None:
                    self.character_repository.store_characters(text_id, relational_characters)
                return relational_characters

        if authenticated_user is None:
            cached_characters = self.character_repository.get_characters(text_id)
            if cached_characters:
                logger.info("Returning cached characters for text_id=%s", text_id)
                if self.relational_persistence_service is not None:
                    self.relational_persistence_service.persist_character_extraction(
                        authenticated_user=authenticated_user,
                        text_id=text_id,
                        extracted_text=text[: self.settings.max_source_characters],
                        characters=cached_characters,
                    )
                return cached_characters

        prepared_text = text[: self.settings.max_source_characters]
        system_prompt, user_prompt = character_extraction_prompt(prepared_text)
        provider = self.provider_factory.get_provider(llm_provider)
        raw_response = provider.generate_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        payload = parse_json_response(raw_response)
        if not isinstance(payload, list):
            raise AppError("Character extraction returned an invalid payload.")

        characters: list[CharacterProfile] = []
        for item in payload:
            character_id = hashlib.sha256(
                f"{text_id}:{item['name']}".encode("utf-8")
            ).hexdigest()
            item["id"] = character_id
            characters.append(CharacterProfile.model_validate(item))

        if authenticated_user is None:
            self.character_repository.store_characters(text_id, characters)
        if self.relational_persistence_service is not None:
            self.relational_persistence_service.persist_character_extraction(
                authenticated_user=authenticated_user,
                text_id=text_id,
                extracted_text=prepared_text,
                characters=characters,
            )
        return characters
