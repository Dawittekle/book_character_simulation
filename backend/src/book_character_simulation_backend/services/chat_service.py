from __future__ import annotations

import json
import logging

from ..errors import NotFoundError
from ..config import Settings
from ..llm import LLMProviderFactory
from ..prompts import chat_prompt, fact_extraction_prompt
from ..repositories.chroma import (
    ChromaCharacterRepository,
    ChromaFactualMemoryRepository,
    ChromaSessionRepository,
)
from ..schemas.chat import (
    ChatMessage,
    ChatReplyPayload,
    ChatSessionState,
    ChatTurnResult,
    ExtractedFacts,
    FactualMemoryRecord,
    utc_now,
)
from ..utils.json import parse_json_response
from .relational_persistence_service import RelationalPersistenceService

logger = logging.getLogger(__name__)


class ChatService:
    def __init__(
        self,
        *,
        settings: Settings,
        character_repository: ChromaCharacterRepository,
        session_repository: ChromaSessionRepository,
        factual_memory_repository: ChromaFactualMemoryRepository,
        relational_persistence_service: RelationalPersistenceService | None = None,
    ) -> None:
        self.settings = settings
        self.character_repository = character_repository
        self.session_repository = session_repository
        self.factual_memory_repository = factual_memory_repository
        self.provider_factory = LLMProviderFactory(settings)
        self.relational_persistence_service = relational_persistence_service

    def chat(
        self,
        *,
        character_id: str,
        text_id: str,
        user_message: str,
        session_id: str | None = None,
        llm_provider: str | None = None,
    ) -> ChatTurnResult:
        character = self.character_repository.get_character_by_id(text_id, character_id)
        if character is None:
            raise NotFoundError("Character not found.")

        session = self._get_or_create_session(
            character_id=character_id,
            text_id=text_id,
            session_id=session_id,
            psi_parameters=character.psi_parameters,
            emotion_state=character.emotion_state,
        )

        session.chat_history.append(ChatMessage(type="user", content=user_message))
        provider = self.provider_factory.get_provider(llm_provider)

        system_prompt, user_prompt = chat_prompt(
            character_json=json.dumps(character.model_dump(mode="json")),
            chat_history=self._format_chat_history(session.chat_history),
            factual_memories=self._format_factual_memories(character_id, text_id),
            psi_parameters=json.dumps(session.psi_parameters.model_dump(mode="json")),
            emotion_state=json.dumps(session.emotion_state.model_dump(mode="json")),
            latest_message=user_message,
        )
        raw_response = provider.generate_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        chat_payload = ChatReplyPayload.model_validate(parse_json_response(raw_response))
        session.psi_parameters = chat_payload.updated_psi
        session.emotion_state = chat_payload.updated_emotion_state
        session.chat_history.append(ChatMessage(type="ai", content=chat_payload.reply))
        session.last_updated = utc_now()

        self._extract_and_store_facts(
            provider_name=llm_provider,
            session=session,
            character_id=character_id,
            text_id=text_id,
            user_message=user_message,
            character_response=chat_payload.reply,
        )
        self.session_repository.save(session)
        if self.relational_persistence_service is not None:
            self.relational_persistence_service.persist_chat_state(
                text_id=text_id,
                stable_character_key=character_id,
                session_state=session,
                memories=self.factual_memory_repository.list_for_character(
                    character_id, text_id
                ),
            )

        return ChatTurnResult(
            session_id=session.id,
            reply=chat_payload.reply,
            updated_psi=chat_payload.updated_psi,
            emotion_state=chat_payload.updated_emotion_state,
        )

    def _get_or_create_session(
        self,
        *,
        character_id: str,
        text_id: str,
        session_id: str | None,
        psi_parameters,
        emotion_state,
    ) -> ChatSessionState:
        if session_id:
            existing = self.session_repository.get(session_id)
            if (
                existing is not None
                and existing.character_id == character_id
                and existing.text_id == text_id
            ):
                return existing

        return ChatSessionState(
            character_id=character_id,
            text_id=text_id,
            psi_parameters=psi_parameters,
            emotion_state=emotion_state,
        )

    def _extract_and_store_facts(
        self,
        *,
        provider_name: str | None,
        session: ChatSessionState,
        character_id: str,
        text_id: str,
        user_message: str,
        character_response: str,
    ) -> None:
        provider = self.provider_factory.get_provider(provider_name)
        existing_memories = self.factual_memory_repository.list_for_character(
            character_id, text_id
        )
        existing_facts = {memory.fact.strip().lower() for memory in existing_memories}

        system_prompt, user_prompt = fact_extraction_prompt(
            chat_history=self._format_chat_history(session.chat_history),
            user_message=user_message,
            character_response=character_response,
        )

        try:
            raw_response = provider.generate_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
            extracted_facts = ExtractedFacts.model_validate(
                parse_json_response(raw_response)
            )

            for fact in extracted_facts.facts:
                normalized_fact = fact.strip()
                if not normalized_fact or normalized_fact.lower() in existing_facts:
                    continue

                self.factual_memory_repository.save(
                    FactualMemoryRecord(
                        character_id=character_id,
                        text_id=text_id,
                        fact=normalized_fact,
                        source_session_id=session.id,
                    )
                )
                existing_facts.add(normalized_fact.lower())
        except Exception as exc:
            logger.warning("Fact extraction skipped after provider error: %s", exc)

    @staticmethod
    def _format_chat_history(chat_history: list[ChatMessage]) -> str:
        if not chat_history:
            return "No previous conversation."
        return "\n".join(
            f"{'User' if message.type == 'user' else 'Character'}: {message.content}"
            for message in chat_history
        )

    def _format_factual_memories(self, character_id: str, text_id: str) -> str:
        memories = self.factual_memory_repository.list_for_character(character_id, text_id)
        if not memories:
            return "No previous factual memories."
        return "\n".join(f"- {memory.fact}" for memory in memories)
