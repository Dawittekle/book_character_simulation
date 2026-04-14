from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import AuthenticatedUser
from ..db.base import utc_now
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
from ..schemas.character import CharacterProfile, EmotionState, PsiParameters
from ..schemas.chat import (
    ChatMessage as ChatHistoryMessage,
    ChatSessionState,
    FactualMemoryRecord,
)


class RelationalRepository:
    demo_email = "local-demo@book-character-simulation.local"
    demo_display_name = "Local Demo User"

    @staticmethod
    def _to_character_profile(record: CharacterProfileRecord) -> CharacterProfile:
        return CharacterProfile(
            id=record.stable_character_key or record.id,
            name=record.name,
            personality=record.personality,
            key_events=record.key_events,
            relationships=record.relationships,
            psi_parameters=PsiParameters.model_validate(record.psi_parameters),
            emotion_state=EmotionState.model_validate(record.emotion_state),
        )

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

    @staticmethod
    def _fallback_email(subject: str) -> str:
        return f"supabase-user-{subject}@book-character-simulation.local"

    def get_or_create_owner(
        self, session: Session, authenticated_user: AuthenticatedUser | None
    ) -> UserAccount:
        if authenticated_user is None:
            return self.get_or_create_demo_user(session)

        record = session.scalar(
            select(UserAccount).where(
                UserAccount.supabase_user_id == authenticated_user.subject
            )
        )
        if record is None and authenticated_user.email:
            record = session.scalar(
                select(UserAccount).where(UserAccount.email == authenticated_user.email)
            )

        email = authenticated_user.email or self._fallback_email(authenticated_user.subject)
        display_name = authenticated_user.display_name or email

        if record is None:
            record = UserAccount(
                supabase_user_id=authenticated_user.subject,
                email=email,
                display_name=display_name,
                avatar_url=authenticated_user.avatar_url,
            )
            session.add(record)
            session.flush()
            return record

        record.supabase_user_id = authenticated_user.subject
        record.email = email
        record.display_name = display_name
        record.avatar_url = authenticated_user.avatar_url
        record.last_login_at = utc_now()
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
            select(BookSource)
            .join(Book, BookSource.book_id == Book.id)
            .where(
                BookSource.extracted_text_hash == text_id,
                Book.owner_user_id == owner.id,
            )
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

    def get_book_by_text_id(
        self, session: Session, *, owner: UserAccount, text_id: str
    ) -> Book | None:
        source = session.scalar(
            select(BookSource)
            .join(Book, BookSource.book_id == Book.id)
            .where(
                BookSource.extracted_text_hash == text_id,
                Book.owner_user_id == owner.id,
            )
        )
        return source.book if source is not None else None

    def list_characters_by_text_id(
        self, session: Session, *, owner: UserAccount, text_id: str
    ) -> list[CharacterProfile]:
        book = self.get_book_by_text_id(session, owner=owner, text_id=text_id)
        if book is None:
            return []

        records = session.scalars(
            select(CharacterProfileRecord)
            .where(CharacterProfileRecord.book_id == book.id)
            .order_by(CharacterProfileRecord.name.asc())
        ).all()
        return [self._to_character_profile(record) for record in records]

    def get_character_by_stable_key(
        self, session: Session, *, book_id: str, stable_character_key: str
    ) -> CharacterProfileRecord | None:
        return session.scalar(
            select(CharacterProfileRecord).where(
                CharacterProfileRecord.book_id == book_id,
                CharacterProfileRecord.stable_character_key == stable_character_key,
            )
        )

    def get_character_profile(
        self,
        session: Session,
        *,
        owner: UserAccount,
        text_id: str,
        stable_character_key: str,
    ) -> CharacterProfile | None:
        book = self.get_book_by_text_id(session, owner=owner, text_id=text_id)
        if book is None:
            return None

        record = self.get_character_by_stable_key(
            session,
            book_id=book.id,
            stable_character_key=stable_character_key,
        )
        if record is None:
            return None
        return self._to_character_profile(record)

    def get_chat_session_state(
        self, session: Session, *, owner: UserAccount, session_id: str
    ) -> ChatSessionState | None:
        record = session.scalar(
            select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.owner_user_id == owner.id,
            )
        )
        if record is None:
            return None

        character = session.get(CharacterProfileRecord, record.character_id)
        if character is None:
            return None

        messages = session.scalars(
            select(ChatMessage)
            .where(ChatMessage.session_id == record.id)
            .order_by(ChatMessage.sequence_number.asc())
        ).all()

        return ChatSessionState(
            id=record.id,
            character_id=character.stable_character_key or character.id,
            text_id=character.source_text_id or "",
            psi_parameters=PsiParameters.model_validate(record.latest_psi_parameters),
            emotion_state=EmotionState.model_validate(record.latest_emotion_state),
            chat_history=[
                ChatHistoryMessage(
                    type="user" if message.role == ChatRole.user else "ai",
                    content=message.content,
                )
                for message in messages
            ],
            created_at=record.created_at,
            last_updated=record.last_message_at or record.updated_at,
        )

    def list_character_memories(
        self,
        session: Session,
        *,
        owner: UserAccount,
        text_id: str,
        stable_character_key: str,
    ) -> list[FactualMemoryRecord]:
        book = self.get_book_by_text_id(session, owner=owner, text_id=text_id)
        if book is None:
            return []

        character = self.get_character_by_stable_key(
            session,
            book_id=book.id,
            stable_character_key=stable_character_key,
        )
        if character is None:
            return []

        records = session.scalars(
            select(CharacterMemory)
            .where(
                CharacterMemory.book_id == book.id,
                CharacterMemory.character_id == character.id,
            )
            .order_by(CharacterMemory.created_at.asc())
        ).all()

        return [
            FactualMemoryRecord(
                id=record.id,
                character_id=stable_character_key,
                text_id=text_id,
                fact=record.fact,
                source_session_id=record.session_id,
                created_at=record.created_at,
            )
            for record in records
        ]

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
