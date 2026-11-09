from __future__ import annotations

import json
from flask.testing import FlaskClient
import pytest
from sqlalchemy import select

from book_character_simulation_backend.db.models import (
    Book,
    BookChapter,
    BookChunk,
    CharacterProfileRecord,
    CharacterStateEvent,
    ChatMessage,
    ChatSession,
    UserAccount,
    UserSettings,
)
from book_character_simulation_backend.db.session import DatabaseManager
from book_character_simulation_backend.llm.base import LLMProvider
from book_character_simulation_backend.prompts import chat_prompt
from book_character_simulation_backend.rag.retriever import (
    SpoilerAwareRetriever,
    compute_lexical_score,
    expand_query_cross_lingual,
)


def test_user_settings_bilingual_preferences(db_client: FlaskClient):
    """Verifies that user settings store and update bilingual language preferences."""
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]

    with db_manager.session_scope() as session:
        user = UserAccount(
            supabase_user_id="usr-bilingual-pref-tester",
            email="bilingual@lorely.example",
            display_name="Bilingual Tester",
        )
        session.add(user)
        session.flush()

        settings = UserSettings(
            user_id=user.id,
            preferred_ui_language="en",
            preferred_conversation_language="en",
        )
        session.add(settings)
        session.flush()

    headers = {"X-Test-User-Id": "usr-bilingual-pref-tester"}

    # 1. Fetch settings and check defaults
    res = db_client.get("/api/v1/me/settings", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["preferred_ui_language"] == "en"
    assert data["preferred_conversation_language"] == "en"

    # 2. Update language settings to Amharic
    patch_res = db_client.patch(
        "/api/v1/me/settings",
        headers=headers,
        json={
            "preferred_ui_language": "am",
            "preferred_conversation_language": "am",
        },
    )
    assert patch_res.status_code == 200
    updated_data = patch_res.get_json()
    assert updated_data["preferred_ui_language"] == "am"
    assert updated_data["preferred_conversation_language"] == "am"

    # 3. Verify in database
    with db_manager.session_scope() as session:
        db_settings = session.scalar(select(UserSettings).join(UserAccount).where(UserAccount.supabase_user_id == "usr-bilingual-pref-tester"))
        assert db_settings.preferred_ui_language == "am"
        assert db_settings.preferred_conversation_language == "am"


def test_cross_language_retrieval_and_expansion():
    """Verifies Amharic-to-English cross-language query expansion and lexical scoring."""
    # 1. Test dictionary expansion
    amharic_query = "ስለ ናስቴንካ እና ነጭ ሌሊቶች ንገረኝ"
    expanded_tokens = expand_query_cross_lingual(amharic_query)
    expanded_text = " ".join(expanded_tokens).lower()
    assert "nastenka" in expanded_text
    assert "white nights" in expanded_text or ("white" in expanded_text and "nights" in expanded_text)

    # 2. Test lexical scoring with Amharic query against English text
    english_chunk_1 = "Nastenka stood beside the canal during the quiet white nights in St. Petersburg."
    english_chunk_2 = "Astafy Ivanovich was searching everywhere for the missing blue riding breeches."
    unrelated_chunk = "The spaceship engaged its hyperdrive towards Alpha Centauri."

    score_1 = compute_lexical_score(english_chunk_1, amharic_query)
    score_unrelated = compute_lexical_score(unrelated_chunk, amharic_query)

    assert score_1 > 0.0
    assert score_unrelated == 0.0

    breeches_query = "ስለ ሰማያዊው ሱሪ እና አስታፊ"
    score_2 = compute_lexical_score(english_chunk_2, breeches_query)
    assert score_2 > 0.0


def test_cross_language_retriever_hybrid_rrf(db_client: FlaskClient):
    """Verifies that SpoilerAwareRetriever retrieves English chunks when queried in Amharic."""
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]

    with db_manager.session_scope() as session:
        user = UserAccount(
            supabase_user_id="usr-cross-rag-tester",
            email="crossrag@lorely.example",
            display_name="Cross RAG Tester",
        )
        session.add(user)
        session.flush()

        book = Book(
            owner_user_id=user.id,
            title="White Nights and An Honest Thief",
            author="Fyodor Dostoevsky",
            visibility="featured",
            original_language="en",
        )
        session.add(book)
        session.flush()

        session.add(BookChapter(book_id=book.id, chapter_order=1, title="Night One"))
        session.add(BookChapter(book_id=book.id, chapter_order=2, title="An Honest Thief"))
        session.flush()

        # 8-dim embeddings with distinct semantic direction
        vec_nastenka = [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
        vec_breeches = [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]

        # Chunk 1: White nights passage
        session.add(
            BookChunk(
                book_id=book.id,
                chapter_order=1,
                chapter_title="Night One",
                chunk_index=0,
                content="It was a wonderful night, such a night as is only possible when we are young, dear reader. Nastenka stood by the railing of the Fontanka canal under the white nights.",
                embedding=vec_nastenka,
                embedding_provider="test",
                embedding_model="test",
                embedding_dimensions=8,
                content_hash="hash_c1",
                language_code="en",
            )
        )

        # Chunk 2: Honest Thief passage
        session.add(
            BookChunk(
                book_id=book.id,
                chapter_order=2,
                chapter_title="An Honest Thief",
                chunk_index=1,
                content="Astafy Ivanovich was distraught because someone had stolen his sky-blue riding breeches. Emelyan Ilyitch was trembling quietly in the corner.",
                embedding=vec_breeches,
                embedding_provider="test",
                embedding_model="test",
                embedding_dimensions=8,
                content_hash="hash_c2",
                language_code="en",
            )
        )
        session.flush()

        class DummyEmbeddingService:
            def embed_text(self, text: str) -> list[float]:
                if "ናስቴንካ" in text:
                    return vec_nastenka
                if "ሱሪ" in text or "አስታፊ" in text:
                    return vec_breeches
                return [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]

        retriever = SpoilerAwareRetriever(DummyEmbeddingService())

        # Query in Amharic for Nastenka
        results_1 = retriever.retrieve(
            session=session,
            book_id=book.id,
            query="ስለ ናስቴንካ እና ነጭ ሌሊቶች ንገረኝ",
            spoiler_policy="unrestricted",
            top_k=2,
        )
        assert len(results_1) > 0
        assert results_1[0].chapter_order == 1
        assert "Nastenka" in results_1[0].content

        # Query in Amharic for riding breeches / Astafy
        results_2 = retriever.retrieve(
            session=session,
            book_id=book.id,
            query="ስለ ሰማያዊው ሱሪ እና አስታፊ ኢቫኖቪች",
            spoiler_policy="unrestricted",
            top_k=2,
        )
        assert len(results_2) > 0
        assert results_2[0].chapter_order == 2
        assert "riding breeches" in results_2[0].content


def test_amharic_prompt_generation_and_language_rules():
    """Verifies that chat_prompt applies strict Amharic rules when conversation_language is 'am'."""
    sys_am, user_am = chat_prompt(
        character_json='{"name": "Nastenka"}',
        chat_history="User: ሰላም ናስቴንካ",
        factual_memories="None yet.",
        psi_parameters="{}",
        emotion_state="{}",
        latest_message="ሰላም ናስቴንካ",
        book_passages="[Night One]: Nastenka stood by the canal.",
        conversation_language="am",
    )

    # Check Amharic specific guidance in system and user prompt
    assert "Amharic" in sys_am
    assert "አማርኛ" in sys_am
    assert "IMPORTANT CONVERSATION LANGUAGE REQUIREMENT" in user_am
    assert "Ge'ez script" in user_am
    assert "ናስቴንካ" in user_am

    # English comparison
    sys_en, user_en = chat_prompt(
        character_json='{"name": "Nastenka"}',
        chat_history="User: Hello Nastenka",
        factual_memories="None yet.",
        psi_parameters="{}",
        emotion_state="{}",
        latest_message="Hello Nastenka",
        book_passages="[Night One]: Nastenka stood by the canal.",
        conversation_language="en",
    )
    assert "IMPORTANT CONVERSATION LANGUAGE REQUIREMENT" not in user_en


def test_amharic_conversation_turn_and_state_events(
    db_client: FlaskClient,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verifies end-to-end conversation turn in Amharic, state version tracking, and language tagging."""
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]

    class MockAmharicLLM(LLMProvider):
        def __init__(self, settings=None):
            self.settings = settings

        @property
        def provider_name(self) -> str:
            return "mock-amharic"

        def generate_json(self, *, system_prompt: str, user_prompt: str, **kwargs) -> str:
            if "extract" in system_prompt.lower() or "fact" in system_prompt.lower():
                return json.dumps({"facts": ["ተጠቃሚው በሴንት ፒተርስበርግ ሌሊት ላይ ፍላጎት አለው።"]})
            return json.dumps({
                "reply": "ሰላም ወዳጄ! በሴንት ፒተርስበርግ ሌሊቶች ድንቅ ህልሞችን እያለምኩ ነው።",
                "perceived_observation": {
                    "valence_delta": 0.4,
                    "arousal_delta": 0.2,
                    "threat_level": 0.0,
                    "goal_relevance": 0.7,
                    "connection_delta": 0.8,
                },
            })

    from book_character_simulation_backend.services import lorely_service as ls_mod
    monkeypatch.setattr(ls_mod, "get_llm_provider", lambda settings, provider_name=None: MockAmharicLLM(settings))

    with db_manager.session_scope() as session:
        user = UserAccount(
            supabase_user_id="usr-amharic-chat-tester",
            email="amchat@lorely.example",
            display_name="Amharic Chat Tester",
        )
        session.add(user)
        session.flush()

        book = Book(
            owner_user_id=user.id,
            title="White Nights",
            author="Fyodor Dostoevsky",
            visibility="featured",
        )
        session.add(book)
        session.flush()

        char = CharacterProfileRecord(
            book_id=book.id,
            stable_character_key="nastenka-am-test",
            name="Nastenka",
            role="Heroine",
            personality="Dreamy and romantic",
            psi_parameters={
                "valence_level": 0.5,
                "arousal_level": 0.4,
                "selection_threshold": 0.5,
                "resolution_level": 0.6,
                "goal_directedness": 0.7,
                "securing_rate": 0.3,
            },
            emotion_state={"joy": 0.4, "sadness": 0.2, "anger": 0.0, "pride": 0.3, "bliss": 0.1},
        )
        session.add(char)
        session.flush()
        char_id = char.id

    headers = {"X-Test-User-Id": "usr-amharic-chat-tester"}

    # 1. Create Amharic conversation session
    create_res = db_client.post(
        f"/api/v1/characters/{char_id}/conversations",
        headers=headers,
        json={"conversation_language": "am", "title": "ናስቴንካ ውይይት"},
    )
    assert create_res.status_code == 201
    session_data = create_res.get_json()
    session_id = session_data["id"]
    assert session_data["conversation_language"] == "am"

    # 2. Send Amharic message
    msg_res = db_client.post(
        f"/api/v1/conversations/{session_id}/messages",
        headers=headers,
        json={"content": "ሰላም ናስቴንካ፣ በሴንት ፒተርስበርግ ሌሊት እንዴት ነሽ?"},
    )
    assert msg_res.status_code == 201
    msg_data = msg_res.get_json()
    assert msg_data["conversation_language"] == "am"
    assert msg_data["language_code"] == "am"
    assert "ሰላም" in msg_data["response"]

    # 3. Verify message persistence and language_code in DB
    with db_manager.session_scope() as session:
        msgs = session.scalars(
            select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.sequence_number.asc())
        ).all()
        assert len(msgs) == 2
        assert msgs[0].role.value == "user"
        assert msgs[0].language_code == "am"
        assert msgs[1].role.value == "assistant"
        assert msgs[1].language_code == "am"

        # Verify state event
        events = session.scalars(
            select(CharacterStateEvent).where(CharacterStateEvent.session_id == session_id)
        ).all()
        assert len(events) == 1
        assert events[0].trigger_text == "ሰላም ናስቴንካ፣ በሴንት ፒተርስበርግ ሌሊት እንዴት ነሽ?"
        assert events[0].resulting_psi["valence_level"] > 0.5  # positive valence delta applied


def test_conversation_language_switching_and_voice_guardrail(
    db_client: FlaskClient,
    monkeypatch: pytest.MonkeyPatch,
):
    """
    Verifies:
    1. Switching language on existing session via PATCH /conversations/<id>.
    2. Section 8.4 voice capability guardrail: Amharic voice turns return structured
       text with 'experimental_text_only' status instead of garbled synthesized English audio.
    """
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]

    class MockBilingualLLM(LLMProvider):
        def __init__(self, settings=None):
            self.settings = settings

        @property
        def provider_name(self) -> str:
            return "mock-bilingual"

        def generate_json(self, *, system_prompt: str, user_prompt: str, **kwargs) -> str:
            return json.dumps({
                "reply": "እኔ ናስቴንካ ነኝ።" if "amharic" in user_prompt.lower() else "I am Nastenka.",
                "perceived_observation": {
                    "valence_delta": 0.1,
                    "arousal_delta": 0.0,
                    "threat_level": 0.0,
                    "goal_relevance": 0.5,
                    "connection_delta": 0.5,
                },
            })

    from book_character_simulation_backend.services import lorely_service as ls_mod
    monkeypatch.setattr(ls_mod, "get_llm_provider", lambda settings, provider_name=None: MockBilingualLLM(settings))

    with db_manager.session_scope() as session:
        user = UserAccount(
            supabase_user_id="usr-lang-switch-tester",
            email="switch@lorely.example",
            display_name="Lang Switch Tester",
        )
        session.add(user)
        session.flush()

        book = Book(
            owner_user_id=user.id,
            title="White Nights",
            author="Fyodor Dostoevsky",
            visibility="featured",
        )
        session.add(book)
        session.flush()

        char = CharacterProfileRecord(
            book_id=book.id,
            stable_character_key="nastenka-switch-test",
            name="Nastenka",
            role="Heroine",
            personality="Dreamy",
            psi_parameters={},
            emotion_state={},
        )
        session.add(char)
        session.flush()
        char_id = char.id

    headers = {"X-User-Id": "usr-lang-switch-tester"}

    # 1. Create conversation in English
    create_res = db_client.post(
        f"/api/v1/characters/{char_id}/conversations",
        headers=headers,
        json={"conversation_language": "en"},
    )
    assert create_res.status_code == 201
    session_id = create_res.get_json()["id"]

    # 2. Test English voice turn produces audio base64
    en_voice_res = db_client.post(
        f"/api/v1/conversations/{session_id}/voice-turn",
        headers=headers,
        json={"speech_text": "Hello Nastenka"},
    )
    assert en_voice_res.status_code == 200
    en_voice_data = en_voice_res.get_json()
    assert "audio" in en_voice_data
    assert "base64_data" in en_voice_data["audio"]

    # 3. Switch conversation language to Amharic
    patch_res = db_client.patch(
        f"/api/v1/conversations/{session_id}",
        headers=headers,
        json={"conversation_language": "am"},
    )
    assert patch_res.status_code == 200
    assert patch_res.get_json()["conversation_language"] == "am"

    # 4. Test Amharic voice turn triggers Section 8.4 guardrail (experimental_text_only)
    am_voice_res = db_client.post(
        f"/api/v1/conversations/{session_id}/voice-turn",
        headers=headers,
        json={"speech_text": "ሰላም ናስቴንካ", "conversation_language": "am"},
    )
    assert am_voice_res.status_code == 200
    am_voice_data = am_voice_res.get_json()
    assert "audio" in am_voice_data
    assert am_voice_data["audio"]["status"] == "experimental_text_only"
    assert "experimental evaluation" in am_voice_data["audio"]["message"]
    assert am_voice_data["audio"]["speech_text"] == "ሰላም ናስቴንካ"
    assert am_voice_data["conversation_language"] == "am"
