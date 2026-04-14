from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import (
    Book,
    BookProcessingStatus,
    BookSource,
    CharacterMemory,
    CharacterProfileRecord,
    ChatMessage,
    ChatRole,
    ChatSession,
    UserAccount,
)
from ..schemas.character import CharacterProfile
from ..schemas.chat import ChatSessionState, FactualMemoryRecord


class RelationalRepository:
    demo_email = "local-demo@book-character-simulation.local"
    demo_display_name = "Local Demo User"

    def get_or_create_demo_user(self, session: Session) -> UserAccount:
        record = session.scalar(
            select(UserAccount).where(UserAccount.email == self.demo_email)
        )
        if record is not None:
            return record

        record = UserAccount(
            email=self.demo_email,
            display_name=self.demo_display_name,
        )
        session.add(record)
        session.flush()
        return record

    def get_or_create_book(
        self,
        *,
        session: Session,
        owner: UserAccount,
        text_id: str,
        extracted_text: str,
    ) -> Book:
        source = session.scalar(
            select(BookSource).where(BookSource.extracted_text_hash == text_id)
        )
        if source is not None:
            if source.extracted_text != extracted_text:
                source.extracted_text = extracted_text
            return source.book

        book = Book(
            owner_user_id=owner.id,
            title=f"Imported Book {text_id[:8]}",
            summary="Imported from prototype text extraction flow.",
            processing_status=BookProcessingStatus.ready,
        )
        session.add(book)
        session.flush()

        source = BookSource(
            book_id=book.id,
            mime_type="text/plain",
            extracted_text=extracted_text,
            extracted_text_hash=text_id,
        )
        session.add(source)
        session.flush()
        return book

    def upsert_characters(
        self,
        *,
        session: Session,
        book: Book,
        text_id: str,
        characters: list[CharacterProfile],
    ) -> list[CharacterProfileRecord]:
        records: list[CharacterProfileRecord] = []

        for character in characters:
            record = session.scalar(
                select(CharacterProfileRecord).where(
                    CharacterProfileRecord.book_id == book.id,
                    CharacterProfileRecord.stable_character_key == character.id,
                )
            )
            if record is None:
                record = CharacterProfileRecord(
                    book_id=book.id,
                    source_text_id=text_id,
                    stable_character_key=character.id,
                    name=character.name,
                    personality=character.personality,
                    key_events=character.key_events,
                    relationships=character.relationships,
                    psi_parameters=character.psi_parameters.model_dump(mode="json"),
                    emotion_state=character.emotion_state.model_dump(mode="json"),
                )
                session.add(record)
            else:
                record.name = character.name
                record.personality = character.personality
                record.key_events = character.key_events
                record.relationships = character.relationships
                record.psi_parameters = character.psi_parameters.model_dump(mode="json")
                record.emotion_state = character.emotion_state.model_dump(mode="json")
            session.flush()
            records.append(record)

        return records

    def get_book_by_text_id(self, session: Session, text_id: str) -> Book | None:
        source = session.scalar(
            select(BookSource).where(BookSource.extracted_text_hash == text_id)
        )
        return source.book if source is not None else None

    def get_character_by_stable_key(
        self, session: Session, *, book_id: str, stable_character_key: str
    ) -> CharacterProfileRecord | None:
        return session.scalar(
            select(CharacterProfileRecord).where(
                CharacterProfileRecord.book_id == book_id,
                CharacterProfileRecord.stable_character_key == stable_character_key,
            )
        )

    def get_or_create_chat_session(
        self,
        *,
        session: Session,
        record_id: str,
        owner: UserAccount,
        book: Book,
        character: CharacterProfileRecord,
        session_state: ChatSessionState,
    ) -> ChatSession:
        record = session.get(ChatSession, record_id)
        if record is None:
            record = ChatSession(
                id=record_id,
                owner_user_id=owner.id,
                book_id=book.id,
                character_id=character.id,
                title=f"Conversation with {character.name}",
                latest_psi_parameters=session_state.psi_parameters.model_dump(mode="json"),
                latest_emotion_state=session_state.emotion_state.model_dump(mode="json"),
                last_message_at=session_state.last_updated,
            )
            session.add(record)
            session.flush()
            return record

        record.latest_psi_parameters = session_state.psi_parameters.model_dump(mode="json")
        record.latest_emotion_state = session_state.emotion_state.model_dump(mode="json")
        record.last_message_at = session_state.last_updated
        return record

    def sync_chat_messages(
        self,
        *,
        session: Session,
        chat_session: ChatSession,
        chat_history: list,
    ) -> None:
        existing_messages = session.scalars(
            select(ChatMessage)
            .where(ChatMessage.session_id == chat_session.id)
            .order_by(ChatMessage.sequence_number.asc())
        ).all()
        existing_count = len(existing_messages)

        for index, message in enumerate(chat_history[existing_count:], start=existing_count + 1):
            role = ChatRole.user if message.type == "user" else ChatRole.assistant
            session.add(
                ChatMessage(
                    session_id=chat_session.id,
                    role=role,
                    content=message.content,
                    sequence_number=index,
                )
            )

    def sync_character_memories(
        self,
        *,
        session: Session,
        owner: UserAccount,
        book: Book,
        character: CharacterProfileRecord,
        chat_session: ChatSession,
        memories: list[FactualMemoryRecord],
    ) -> None:
        existing = {
            fact
            for fact in session.scalars(
                select(CharacterMemory.fact).where(
                    CharacterMemory.book_id == book.id,
                    CharacterMemory.character_id == character.id,
                )
            ).all()
        }

        for memory in memories:
            if memory.fact in existing:
                continue
            session.add(
                CharacterMemory(
                    owner_user_id=owner.id,
                    book_id=book.id,
                    character_id=character.id,
                    session_id=chat_session.id,
                    fact=memory.fact,
                    created_at=memory.created_at,
                )
            )
            existing.add(memory.fact)
