from __future__ import annotations

import logging

from ..db.session import DatabaseManager
from ..repositories.relational import RelationalRepository
from ..schemas.character import CharacterProfile
from ..schemas.chat import ChatSessionState, FactualMemoryRecord

logger = logging.getLogger(__name__)


class RelationalPersistenceService:
    def __init__(self, database_manager: DatabaseManager):
        self.database_manager = database_manager
        self.repository = RelationalRepository()

    @property
    def is_enabled(self) -> bool:
        return self.database_manager.is_configured

    def persist_character_extraction(
        self,
        *,
        text_id: str,
        extracted_text: str,
        characters: list[CharacterProfile],
    ) -> None:
        if not self.is_enabled:
            return

        with self.database_manager.session_scope() as session:
            owner = self.repository.get_or_create_demo_user(session)
            book = self.repository.get_or_create_book(
                session=session,
                owner=owner,
                text_id=text_id,
                extracted_text=extracted_text,
            )
            self.repository.upsert_characters(
                session=session,
                book=book,
                text_id=text_id,
                characters=characters,
            )
            logger.info(
                "Persisted %s extracted characters into Postgres for text_id=%s",
                len(characters),
                text_id,
            )

    def get_characters(self, *, text_id: str) -> list[CharacterProfile]:
        if not self.is_enabled:
            return []

        with self.database_manager.session_scope() as session:
            return self.repository.list_characters_by_text_id(session, text_id)

    def get_character(
        self, *, text_id: str, stable_character_key: str
    ) -> CharacterProfile | None:
        if not self.is_enabled:
            return None

        with self.database_manager.session_scope() as session:
            return self.repository.get_character_profile(
                session,
                text_id=text_id,
                stable_character_key=stable_character_key,
            )

    def get_chat_session(self, *, session_id: str) -> ChatSessionState | None:
        if not self.is_enabled:
            return None

        with self.database_manager.session_scope() as session:
            return self.repository.get_chat_session_state(session, session_id=session_id)

    def list_character_memories(
        self,
        *,
        text_id: str,
        stable_character_key: str,
    ) -> list[FactualMemoryRecord]:
        if not self.is_enabled:
            return []

        with self.database_manager.session_scope() as session:
            return self.repository.list_character_memories(
                session,
                text_id=text_id,
                stable_character_key=stable_character_key,
            )

    def persist_chat_state(
        self,
        *,
        text_id: str,
        stable_character_key: str,
        session_state: ChatSessionState,
        memories: list[FactualMemoryRecord],
    ) -> None:
        if not self.is_enabled:
            return

        with self.database_manager.session_scope() as session:
            owner = self.repository.get_or_create_demo_user(session)
            book = self.repository.get_book_by_text_id(session, text_id)
            if book is None:
                logger.warning(
                    "Skipping relational chat persistence because no book exists for text_id=%s",
                    text_id,
                )
                return

            character = self.repository.get_character_by_stable_key(
                session,
                book_id=book.id,
                stable_character_key=stable_character_key,
            )
            if character is None:
                logger.warning(
                    "Skipping relational chat persistence because no character exists for key=%s",
                    stable_character_key,
                )
                return

            chat_session = self.repository.get_or_create_chat_session(
                session=session,
                record_id=session_state.id,
                owner=owner,
                book=book,
                character=character,
                session_state=session_state,
            )
            self.repository.sync_chat_messages(
                session=session,
                chat_session=chat_session,
                chat_history=session_state.chat_history,
            )
            self.repository.sync_character_memories(
                session=session,
                owner=owner,
                book=book,
                character=character,
                chat_session=chat_session,
                memories=memories,
            )
