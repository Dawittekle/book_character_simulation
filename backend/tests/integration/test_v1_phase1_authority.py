from __future__ import annotations

import json
import pytest
from flask.testing import FlaskClient

from book_character_simulation_backend.db.models import (
    Book,
    CharacterMemory,
    CharacterProfileRecord,
    UserAccount,
)
from book_character_simulation_backend.db.session import DatabaseManager


def test_cross_device_sync_and_persistence(db_client: FlaskClient, db_app):
    """
    Test Phase 1 requirement:
    User A creates data from simulated Device 1, and Device 2 (same user token)
    instantly retrieves the exact same data from PostgreSQL without depending on browser cache.
    """
    device_1_headers = {"X-Test-User-Id": "reader-alice", "User-Agent": "Device-1-Chrome-Desktop"}
    device_2_headers = {"X-Test-User-Id": "reader-alice", "User-Agent": "Device-2-Safari-Mobile"}

    # 1. Device 1 creates a private book
    create_res = db_client.post(
        "/api/v1/books",
        json={
            "title": "Letters from Lake Geneva",
            "author": "Alice Walker",
            "extracted_text": "Chapter 1: The water was still as glass under the morning mist.",
        },
        headers=device_1_headers,
    )
    assert create_res.status_code == 201
    book_id = create_res.get_json()["id"]

    # 2. Device 2 fetches book list and book details
    list_res = db_client.get("/api/v1/books?scope=mine", headers=device_2_headers)
    assert list_res.status_code == 200
    my_books = list_res.get_json()["books"]
    assert any(b["id"] == book_id for b in my_books)

    detail_res = db_client.get(f"/api/v1/books/{book_id}", headers=device_2_headers)
    assert detail_res.status_code == 200
    assert detail_res.get_json()["title"] == "Letters from Lake Geneva"


def test_cross_user_isolation(db_client: FlaskClient, db_app):
    """
    Test Phase 1 requirement:
    User B cannot inspect, mutate, or delete User A's private books or conversations.
    """
    user_a_headers = {"X-Test-User-Id": "reader-alice-iso"}
    user_b_headers = {"X-Test-User-Id": "reader-bob-iso"}

    # 1. User A creates a private book
    book_res = db_client.post(
        "/api/v1/books",
        json={
            "title": "Alice Confidential Journal",
            "author": "Alice",
            "extracted_text": "Secret notes on narrative architecture.",
        },
        headers=user_a_headers,
    )
    assert book_res.status_code == 201
    book_id = book_res.get_json()["id"]

    # 2. User B lists their own books -> sees 0
    b_list = db_client.get("/api/v1/books?scope=mine", headers=user_b_headers).get_json()["books"]
    assert not any(b["id"] == book_id for b in b_list)

    # 3. User B attempts to access User A's private book -> 403 Forbidden
    b_detail = db_client.get(f"/api/v1/books/{book_id}", headers=user_b_headers)
    assert b_detail.status_code == 403

    # 4. User B attempts to delete User A's private book -> 403 Forbidden
    b_delete = db_client.delete(f"/api/v1/books/{book_id}", headers=user_b_headers)
    assert b_delete.status_code == 403

    # Verify book still exists
    a_detail = db_client.get(f"/api/v1/books/{book_id}", headers=user_a_headers)
    assert a_detail.status_code == 200


def test_character_memory_management_and_isolation(db_client: FlaskClient, db_app):
    """
    Test Phase 1 requirement:
    User can inspect, edit, and delete their own character memories.
    Other users cannot read, modify, or delete them.
    """
    db: DatabaseManager = db_app.extensions["database_manager"]
    user_a_headers = {"X-Test-User-Id": "reader-mem-a"}
    user_b_headers = {"X-Test-User-Id": "reader-mem-b"}

    # Create character and user A memory in database
    with db.session_scope() as session:
        user_a = UserAccount(supabase_user_id="reader-mem-a", email="mem_a@lorely.app")
        user_b = UserAccount(supabase_user_id="reader-mem-b", email="mem_b@lorely.app")
        session.add_all([user_a, user_b])
        session.flush()

        book = Book(
            owner_user_id=user_a.id,
            title="Memories of Verona",
            author="Shakespeare",
            visibility="featured",
            source_type="book",
        )
        session.add(book)
        session.flush()

        character = CharacterProfileRecord(
            book_id=book.id,
            stable_character_key="juliet-capulet",
            name="Juliet Capulet",
            personality="Passionate and articulate.",
            role="Protagonist",
        )
        session.add(character)
        session.flush()

        from book_character_simulation_backend.db.models import ChatSession
        chat_sess = ChatSession(
            owner_user_id=user_a.id,
            book_id=book.id,
            character_id=character.id,
            title="Chat with Juliet",
        )
        session.add(chat_sess)
        session.flush()

        memory = CharacterMemory(
            owner_user_id=user_a.id,
            book_id=book.id,
            character_id=character.id,
            session_id=chat_sess.id,
            fact="Prefers nightingales over larks in the morning twilight.",
        )
        session.add(memory)
        session.flush()
        char_id = character.id
        mem_id = memory.id

    # 1. User A lists memories -> sees 1 memory
    a_mems = db_client.get(f"/api/v1/characters/{char_id}/memories", headers=user_a_headers).get_json()["memories"]
    assert len(a_mems) == 1
    assert "nightingales" in a_mems[0]["fact"]

    # 2. User B lists memories -> sees 0 memories (isolated)
    b_mems = db_client.get(f"/api/v1/characters/{char_id}/memories", headers=user_b_headers).get_json()["memories"]
    assert len(b_mems) == 0

    # 3. User B tries to update User A's memory -> 403 Forbidden
    b_patch = db_client.patch(
        f"/api/v1/characters/{char_id}/memories/{mem_id}",
        json={"fact": "Tampered fact by user B"},
        headers=user_b_headers,
    )
    assert b_patch.status_code == 403

    # 4. User B tries to delete User A's memory -> 403 Forbidden
    b_del = db_client.delete(f"/api/v1/characters/{char_id}/memories/{mem_id}", headers=user_b_headers)
    assert b_del.status_code == 403

    # 5. User A updates their memory -> 200 OK
    a_patch = db_client.patch(
        f"/api/v1/characters/{char_id}/memories/{mem_id}",
        json={"fact": "Confirmed preference for nightingales."},
        headers=user_a_headers,
    )
    assert a_patch.status_code == 200
    assert a_patch.get_json()["memory"]["fact"] == "Confirmed preference for nightingales."

    # 6. User A deletes their memory -> 200 OK
    a_del = db_client.delete(f"/api/v1/characters/{char_id}/memories/{mem_id}", headers=user_a_headers)
    assert a_del.status_code == 200

    # Verify memory is gone
    a_mems_after = db_client.get(f"/api/v1/characters/{char_id}/memories", headers=user_a_headers).get_json()["memories"]
    assert len(a_mems_after) == 0


def test_legacy_workspace_migration(db_client: FlaskClient):
    """
    Test Phase 1 requirement:
    Migrates client-side legacy workspace JSON (from localStorage) into PostgreSQL.
    Verify data is persisted and verified idempotent.
    """
    headers = {"X-Test-User-Id": "reader-migrator"}
    legacy_payload = {
        "books": [
            {
                "textId": "legacy-text-101",
                "title": "Adventures in the Steppe",
                "author": "Anton Chekhov",
                "preview": "A journey across the sunlit Ukrainian steppe.",
                "sourceType": "text",
                "characters": [
                    {
                        "id": "char-egorushka",
                        "name": "Egorushka",
                        "personality": "Observant boy wide-eyed at the world.",
                        "role": "Protagonist",
                        "psi_parameters": {"competence": 0.6, "certainty": 0.5},
                        "emotion_state": {"joy": 0.8, "wonder": 0.9},
                    }
                ],
                "characterSessions": {
                    "char-egorushka": [
                        {"role": "user", "content": "What do you see in the distance?"},
                        {"role": "assistant", "content": "A windmill slowly turning against the purple clouds."},
                    ]
                },
            }
        ]
    }

    # 1. Run migration
    res = db_client.post("/api/v1/workspaces/migrate-legacy", json=legacy_payload, headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert data["migrated_books"] == 1
    assert data["migrated_characters"] == 1
    assert data["migrated_sessions"] == 1
    assert data["migrated_messages"] == 2

    # 2. Verify book exists in user's library
    books = db_client.get("/api/v1/books?scope=mine", headers=headers).get_json()["books"]
    assert any(b["title"] == "Adventures in the Steppe" for b in books)

    # 3. Verify conversation exists and has messages
    convs = db_client.get("/api/v1/conversations", headers=headers).get_json()["conversations"]
    assert len(convs) >= 1
    session_id = convs[0]["id"]

    msgs = db_client.get(f"/api/v1/conversations/{session_id}/messages", headers=headers).get_json()["messages"]
    assert len(msgs) == 2
    assert "windmill" in msgs[1]["content"]

    # 4. Run migration again with same payload -> idempotent (0 new items)
    res2 = db_client.post("/api/v1/workspaces/migrate-legacy", json=legacy_payload, headers=headers)
    assert res2.status_code == 200
    data2 = res2.get_json()
    assert data2["migrated_books"] == 0
    assert data2["migrated_characters"] == 0
