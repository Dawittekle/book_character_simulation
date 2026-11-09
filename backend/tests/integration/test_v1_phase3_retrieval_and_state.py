from __future__ import annotations

import json
from flask.testing import FlaskClient
import pytest
from sqlalchemy import select

from book_character_simulation_backend.db.models import (
    Book,
    BookChapter,
    BookChunk,
    CharacterMemory,
    CharacterProfileEvidence,
    CharacterProfileRecord,
    CharacterStateEvent,
    ChatSession,
    UserAccount,
    UserCharacterState,
)
from book_character_simulation_backend.db.session import DatabaseManager
from book_character_simulation_backend.llm.gemini_provider import GeminiProvider
from book_character_simulation_backend.rag.embedding_provider import EmbeddingService
from book_character_simulation_backend.rag.retriever import SpoilerAwareRetriever, compute_lexical_score
from book_character_simulation_backend.simulation.psi_engine import PerceivedObservation, PsiEngine, clamp


def test_lexical_scoring_and_hybrid_rrf_retrieval():
    # 1. Test compute_lexical_score
    sample_text = "Emelyan took the sky-blue riding breeches and hid them beneath his ragged coat."
    exact_score = compute_lexical_score(sample_text, "sky-blue riding breeches")
    token_score = compute_lexical_score(sample_text, "riding coat")
    irrelevant_score = compute_lexical_score(sample_text, "starship galaxies")

    assert exact_score > token_score > irrelevant_score
    assert irrelevant_score == 0.0


def test_psi_engine_deterministic_transitions_and_clamping():
    initial_psi = {
        "valence_level": 0.5,
        "arousal_level": 0.3,
        "selection_threshold": 0.6,
        "resolution_level": 0.7,
        "goal_directedness": 0.8,
        "securing_rate": 0.4,
    }
    initial_emotion = {
        "anger": 0.0,
        "sadness": 0.1,
        "pride": 0.4,
        "joy": 0.5,
        "bliss": 0.2,
    }

    obs = PerceivedObservation(
        valence_delta=-0.6,
        arousal_delta=0.8,
        threat_level=0.7,
        goal_relevance=0.9,
        connection_delta=-0.5,
    )

    # 1. Determinism test: Calling twice with identical inputs produces identical results
    res_psi_1, res_em_1, d_psi_1, d_em_1 = PsiEngine.apply_transition(
        current_psi=initial_psi,
        current_emotion=initial_emotion,
        observation=obs,
    )
    res_psi_2, res_em_2, d_psi_2, d_em_2 = PsiEngine.apply_transition(
        current_psi=initial_psi,
        current_emotion=initial_emotion,
        observation=obs,
    )
    assert res_psi_1 == res_psi_2
    assert res_em_1 == res_em_2
    assert d_psi_1 == d_psi_2

    # Under threat and negative valence:
    # Arousal should increase, anger should increase, securing rate should increase
    assert res_psi_1["arousal_level"] > initial_psi["arousal_level"]
    assert res_psi_1["securing_rate"] > initial_psi["securing_rate"]
    assert res_em_1["anger"] > initial_emotion["anger"]

    # 2. Strict bounds and safe clamping test on untrusted inputs
    extreme_obs = PerceivedObservation.from_dict({
        "valence_delta": 100.0,
        "arousal_delta": 100.0,
        "threat_level": 100.0,
        "goal_relevance": 100.0,
        "connection_delta": 100.0,
    })
    ext_psi, ext_em, _, _ = PsiEngine.apply_transition(
        current_psi=initial_psi,
        current_emotion=initial_emotion,
        observation=extreme_obs,
    )
    for v in ext_psi.values():
        assert 0.0 <= v <= 1.0
    for v in ext_em.values():
        assert 0.0 <= v <= 1.0


def test_hard_spoiler_filtering_on_retrieval_and_character_evidence(
    db_client: FlaskClient,
    monkeypatch: pytest.MonkeyPatch,
):
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]

    # Set up a test book with 3 chapters and character with evidence in chapters 1, 2, 3
    with db_manager.session_scope() as session:
        user = UserAccount(supabase_user_id="usr-spoiler-tester", email="spoiler@lorely.example", display_name="Spoiler Tester")
        session.add(user)
        session.flush()

        book = Book(
            owner_user_id=user.id,
            title="The Mystery of Red Manor",
            author="Arthur C.",
            visibility="featured",
        )
        session.add(book)
        session.flush()

        ch1 = BookChapter(book_id=book.id, chapter_order=1, title="Chapter 1: The Arrival", word_count=500)
        ch2 = BookChapter(book_id=book.id, chapter_order=2, title="Chapter 2: The Stolen Key", word_count=600)
        ch3 = BookChapter(book_id=book.id, chapter_order=3, title="Chapter 3: The Secret Vault", word_count=700)
        session.add_all([ch1, ch2, ch3])
        session.flush()

        embedder = EmbeddingService(db_client.application.config["SETTINGS"])

        chunk1 = BookChunk(
            book_id=book.id,
            chapter_order=1,
            chapter_title="Chapter 1: The Arrival",
            chunk_index=0,
            content="Detective Gray arrived at Red Manor as twilight fell over the moors.",
            embedding=embedder.embed_text("Detective Gray arrived at Red Manor as twilight fell over the moors."),
        )
        chunk2 = BookChunk(
            book_id=book.id,
            chapter_order=2,
            chapter_title="Chapter 2: The Stolen Key",
            chunk_index=0,
            content="Detective Gray found the golden key hidden inside a hollowed-out Shakespeare folio.",
            embedding=embedder.embed_text("Detective Gray found the golden key hidden inside a hollowed-out Shakespeare folio."),
        )
        chunk3 = BookChunk(
            book_id=book.id,
            chapter_order=3,
            chapter_title="Chapter 3: The Secret Vault",
            chunk_index=0,
            content="Detective Gray unlocked the secret underground vault and found Lord Blackwood alive.",
            embedding=embedder.embed_text("Detective Gray unlocked the secret underground vault and found Lord Blackwood alive."),
        )
        session.add_all([chunk1, chunk2, chunk3])

        char = CharacterProfileRecord(
            book_id=book.id,
            stable_character_key="det-gray",
            name="Detective Gray",
            personality="Methodical, observant, discreet.",
            key_events=[
                "Arrived at Red Manor at dusk",
                "Discovered the golden key in the library folio",
                "Unlocked the underground vault and found Lord Blackwood",
            ],
            psi_parameters={"valence_level": 0.5, "arousal_level": 0.4},
            emotion_state={"joy": 0.2, "sadness": 0.1, "anger": 0.0},
        )
        session.add(char)
        session.flush()

        # Seed chapter-tagged evidence
        ev1 = CharacterProfileEvidence(character_id=char.id, book_id=book.id, fact_text="Arrived at Red Manor at dusk", chapter_order=1)
        ev2 = CharacterProfileEvidence(character_id=char.id, book_id=book.id, fact_text="Found the golden key in Shakespeare folio", chapter_order=2)
        ev3 = CharacterProfileEvidence(character_id=char.id, book_id=book.id, fact_text="Found Lord Blackwood alive in vault", chapter_order=3)
        session.add_all([ev1, ev2, ev3])
        session.flush()

        char_id = char.id
        book_id = book.id

    auth_headers = {"X-Test-User-Id": "usr-spoiler-tester"}

    # 1. Start conversation at Chapter 1
    create_res = db_client.post(
        f"/api/v1/characters/{char_id}/conversations",
        headers=auth_headers,
        json={"reading_progress_chapter": 1, "spoiler_policy": "cautious"},
    )
    assert create_res.status_code == 201
    session_id = create_res.get_json()["id"]
    assert create_res.get_json()["reading_progress_chapter"] == 1

    # Mock LLM to return structured observation and grounded reply
    mock_reply = json.dumps({
        "reply": "I have only just arrived at Red Manor. I know nothing yet of keys or vaults.",
        "perceived_observation": {
            "valence_delta": 0.0,
            "arousal_delta": 0.1,
            "threat_level": 0.0,
            "goal_relevance": 0.5,
            "connection_delta": 0.2,
        },
    })
    monkeypatch.setattr(GeminiProvider, "generate_json", lambda self, system_prompt, user_prompt: mock_reply)

    # 2. Ask question about vault (only in Chapter 3) while reading at Chapter 1
    msg_res = db_client.post(
        f"/api/v1/conversations/{session_id}/messages",
        headers=auth_headers,
        json={"content": "What did you find in the secret underground vault?"},
    )
    assert msg_res.status_code == 201
    data = msg_res.get_json()

    # Citations must NEVER include Chapter 2 or Chapter 3!
    for citation in data.get("citations", []):
        assert citation["chapter_order"] <= 1
        assert "vault" not in citation.get("snippet", "").lower()

    # 3. Advance reading progress to Chapter 3
    patch_res = db_client.patch(
        f"/api/v1/conversations/{session_id}",
        headers=auth_headers,
        json={"reading_progress_chapter": 3},
    )
    assert patch_res.status_code == 200
    assert patch_res.get_json()["reading_progress_chapter"] == 3

    # Now ask again
    msg_res_2 = db_client.post(
        f"/api/v1/conversations/{session_id}/messages",
        headers=auth_headers,
        json={"content": "Who did you find in the vault?"},
    )
    assert msg_res_2.status_code == 201
    data_2 = msg_res_2.get_json()
    # Now Chapter 3 passages can be retrieved!
    citation_orders = [c["chapter_order"] for c in data_2.get("citations", [])]
    assert any(order == 3 for order in citation_orders)


def test_multi_user_character_isolation_and_state_events(
    db_client: FlaskClient,
    monkeypatch: pytest.MonkeyPatch,
):
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]

    # Use the seeded White Nights "char-the-dreamer"
    char_id = "char-the-dreamer"

    # User A: Alice
    user_a_headers = {"X-Test-User-Id": "usr-alice-reader"}
    conv_a = db_client.post(
        f"/api/v1/characters/{char_id}/conversations",
        headers=user_a_headers,
        json={"reading_progress_chapter": 1},
    ).get_json()
    session_a_id = conv_a["id"]

    # User B: Bob
    user_b_headers = {"X-Test-User-Id": "usr-bob-reader"}
    conv_b = db_client.post(
        f"/api/v1/characters/{char_id}/conversations",
        headers=user_b_headers,
        json={"reading_progress_chapter": 1},
    ).get_json()
    session_b_id = conv_b["id"]

    # 1. Alice sends an aggressive message causing threat and negative valence
    alice_obs = json.dumps({
        "reply": "Why do you shout at me? I wander alone in sorrow...",
        "perceived_observation": {
            "valence_delta": -0.7,
            "arousal_delta": 0.8,
            "threat_level": 0.9,
            "goal_relevance": 0.3,
            "connection_delta": -0.8,
        },
    })
    monkeypatch.setattr(GeminiProvider, "generate_json", lambda self, system_prompt, user_prompt: alice_obs)

    msg_a_res = db_client.post(
        f"/api/v1/conversations/{session_a_id}/messages",
        headers=user_a_headers,
        json={"content": "You are a foolish loafer and I despise your dreams!"},
    )
    assert msg_a_res.status_code == 201
    a_data = msg_a_res.get_json()
    assert a_data["character_state_version"] == 1
    assert a_data["updated_state"]["emotion_state"]["anger"] > 0.0

    # 2. Check Alice's state events
    events_a_res = db_client.get(
        f"/api/v1/characters/{char_id}/state-events",
        headers=user_a_headers,
    )
    assert events_a_res.status_code == 200
    events_a = events_a_res.get_json()["events"]
    assert len(events_a) == 1
    assert events_a[0]["state_version"] == 1
    assert events_a[0]["trigger_text"] == "You are a foolish loafer and I despise your dreams!"

    # 3. Check Bob's state: Bob has NOT interacted, so Bob's state events MUST be empty!
    events_b_res = db_client.get(
        f"/api/v1/characters/{char_id}/state-events",
        headers=user_b_headers,
    )
    assert events_b_res.status_code == 200
    assert len(events_b_res.get_json()["events"]) == 0

    # 4. Verify canonical CharacterProfileRecord is UNTOUCHED
    with db_manager.session_scope() as session:
        canonical_char = session.get(CharacterProfileRecord, char_id)
        assert canonical_char is not None
        # Canonical emotion state has 0.0 anger, despite Alice's turn!
        assert canonical_char.emotion_state.get("anger", 0.0) == 0.0


def test_unsupported_question_handles_unknown_grounding(
    db_client: FlaskClient,
    monkeypatch: pytest.MonkeyPatch,
):
    char_id = "char-the-dreamer"
    auth_headers = {"X-Test-User-Id": "usr-grounding-eval"}

    conv = db_client.post(
        f"/api/v1/characters/{char_id}/conversations",
        headers=auth_headers,
        json={"reading_progress_chapter": 1},
    ).get_json()
    session_id = conv["id"]

    # Mock model honestly admitting it does not know of airplanes or non-canonical items
    mock_reply = json.dumps({
        "reply": "I know nothing of 'airplanes' or machines flying through the clouds. My St. Petersburg knows only the quiet ripples of the canal and the stars above.",
        "perceived_observation": {
            "valence_delta": 0.0,
            "arousal_delta": 0.0,
            "threat_level": 0.0,
            "goal_relevance": 0.0,
            "connection_delta": 0.1,
        },
    })
    monkeypatch.setattr(GeminiProvider, "generate_json", lambda self, system_prompt, user_prompt: mock_reply)

    res = db_client.post(
        f"/api/v1/conversations/{session_id}/messages",
        headers=auth_headers,
        json={"content": "Can you fly an airplane over St. Petersburg?"},
    )
    assert res.status_code == 201
    reply = res.get_json()["response"]
    assert "nothing of 'airplanes'" in reply or "know" in reply.lower()
