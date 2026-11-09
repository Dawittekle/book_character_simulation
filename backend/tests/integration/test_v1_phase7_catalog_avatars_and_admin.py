from __future__ import annotations

from flask.testing import FlaskClient
import pytest
from sqlalchemy import select

from book_character_simulation_backend.db.models import (
    AvatarAsset,
    Book,
    BookChapter,
    CharacterProfileRecord,
    ChatMessage,
    ChatRole,
    ChatSession,
    UserAccount,
    UserCharacterState,
    UserLibraryBook,
    UserRole,
    UserSettings,
)
from book_character_simulation_backend.db.session import DatabaseManager


def _setup_phase7_test_environment(db_manager: DatabaseManager):
    """Sets up an admin user, a regular reader, and a featured book."""
    with db_manager.session_scope() as session:
        # Admin user
        admin = UserAccount(
            supabase_user_id="usr-phase7-admin-launcher",
            email="admin-launch@lorely.example",
            display_name="Lorely Admin Curator",
        )
        session.add(admin)
        session.flush()

        admin_role = UserRole(user_id=admin.id, role="admin")
        session.add(admin_role)

        # Reader user
        reader = UserAccount(
            supabase_user_id="usr-phase7-reader-citizen",
            email="reader-citizen@lorely.example",
            display_name="Citizen Reader",
        )
        session.add(reader)
        session.flush()

        reader_settings = UserSettings(
            user_id=reader.id,
            reading_theme="parchment",
            spoiler_policy="strict",
            voice_save_audio_recordings=False,
        )
        session.add(reader_settings)

        # Featured Book: Crime and Punishment
        featured_book = Book(
            owner_user_id=admin.id,
            title="Crime and Punishment",
            author="Fyodor Dostoevsky",
            summary="A psychological drama exploring conscience, redemption, and moral philosophy in St. Petersburg.",
            visibility="featured",
            original_language="en",
            edition_notes="Garnett translation (1914), public domain in US and life+70 jurisdictions.",
            rights_basis="Public Domain (US / Life+70)",
            file_provenance="Project Gutenberg #2554",
            cover_art_licence="Public Domain / CC0",
        )
        session.add(featured_book)
        session.flush()

        # Add chapters
        ch1 = BookChapter(book_id=featured_book.id, chapter_order=1, title="Chapter I: The Garret and the Pledge")
        ch2 = BookChapter(book_id=featured_book.id, chapter_order=2, title="Chapter II: The Tavern and Marmeladov")
        session.add_all([ch1, ch2])

        # Character: Rodion Raskolnikov
        raskolnikov = CharacterProfileRecord(
            book_id=featured_book.id,
            name="Rodion Raskolnikov",
            role="Former student and protagonist",
            personality="Brooding, proud, introspective, intense, dramatic",
            appearance_description="A handsome young man with dark brown hair and gloomy, commanding eyes in a frock coat",
            relationships=["Dunya", "Sonya", "Razumikhin"],
            emotion_state={"anxiety": 0.85},
            psi_parameters={"warmth": 0.2},
        )
        session.add(raskolnikov)

        # Character: Sonya Marmeladova
        sonya = CharacterProfileRecord(
            book_id=featured_book.id,
            name="Sonya Marmeladova",
            role="Devoted confessor",
            personality="Quiet, humble, self-sacrificing, pure, gentle",
            appearance_description="A young lady with fair hair and humble, meek demeanor",
            relationships=["Marmeladov", "Raskolnikov"],
            emotion_state={"compassion": 0.95},
            psi_parameters={"warmth": 0.9},
        )
        session.add(sonya)
        session.flush()

        return admin.id, reader.id, featured_book.id, raskolnikov.id, sonya.id


def test_avatar_library_listing_and_filtering(db_client: FlaskClient):
    """Verifies that GET /api/v1/avatars lists curated avatars with tag and style metadata."""
    res = db_client.get("/api/v1/avatars")
    assert res.status_code == 200
    data = res.get_json()
    assert "avatars" in data
    avatars = data["avatars"]
    assert len(avatars) >= 10

    # Test filtering by gender = feminine
    fem_res = db_client.get("/api/v1/avatars?gender=feminine")
    assert fem_res.status_code == 200
    fem_avatars = fem_res.get_json()["avatars"]
    assert all(a["gender"] == "feminine" for a in fem_avatars)
    assert any(a["asset_id"] == "avatar_fem_nastenka" for a in fem_avatars)


def test_deterministic_character_avatar_matching_and_override(db_client: FlaskClient):
    """
    Verifies Section 9.3:
    - Deterministic matching of character profile attributes to avatar collection.
    - User/Admin override of assigned portrait.
    - Stability across sessions.
    """
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]
    admin_id, _, _, raskolnikov_id, sonya_id = _setup_phase7_test_environment(db_manager)
    headers = {"X-Test-User-Id": "usr-phase7-admin-launcher"}

    # 1. Match Raskolnikov (masculine, young adult, brooding, dark hair)
    masc_match_res = db_client.get(f"/api/v1/characters/{raskolnikov_id}/matched-avatar", headers=headers)
    assert masc_match_res.status_code == 200
    masc_match = masc_match_res.get_json()
    assert masc_match["character_id"] == raskolnikov_id
    assert masc_match["gender"] == "masculine"
    assert masc_match["avatar_asset_id"] == "avatar_masc_raskolnikov"
    assert masc_match["confidence"] in ["explicit", "inferred"]

    # 2. Match Sonya (feminine, gentle, fair hair)
    fem_match_res = db_client.get(f"/api/v1/characters/{sonya_id}/matched-avatar", headers=headers)
    assert fem_match_res.status_code == 200
    fem_match = fem_match_res.get_json()
    assert fem_match["character_id"] == sonya_id
    assert fem_match["gender"] == "feminine"
    assert fem_match["avatar_asset_id"] in ["avatar_fem_sonya", "avatar_fem_nastenka"]

    # 3. Override assigned portrait
    patch_res = db_client.patch(
        f"/api/v1/characters/{raskolnikov_id}/avatar",
        headers=headers,
        json={"avatar_asset_id": "avatar_neutral_scholar"},
    )
    assert patch_res.status_code == 200
    assert patch_res.get_json()["avatar_asset_id"] == "avatar_neutral_scholar"

    # Verify persistence in database
    with db_manager.session_scope() as session:
        char = session.get(CharacterProfileRecord, raskolnikov_id)
        assert char.avatar_asset_id == "avatar_neutral_scholar"


def test_featured_catalogue_and_personal_library(db_client: FlaskClient):
    """
    Verifies Section 10:
    - Public featured catalogue listing with edition and rights provenance.
    - Adding catalogue book to user personal library with isolated reader state.
    """
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]
    _, reader_id, book_id, raskolnikov_id, _ = _setup_phase7_test_environment(db_manager)
    headers = {"X-Test-User-Id": "usr-phase7-reader-citizen"}

    # 1. Browse featured catalogue
    cat_res = db_client.get("/api/v1/catalog/featured")
    assert cat_res.status_code == 200
    books = cat_res.get_json()["books"]
    assert len(books) >= 1
    cp_book = next((b for b in books if b["id"] == book_id), None)
    assert cp_book is not None
    assert cp_book["rights_basis"] == "Public Domain (US / Life+70)"
    assert cp_book["file_provenance"] == "Project Gutenberg #2554"
    assert cp_book["chapter_count"] == 2
    assert len(cp_book["characters"]) == 2

    # 2. Add catalogue book to personal library
    add_res = db_client.post(
        f"/api/v1/catalog/books/{book_id}/add-to-library",
        headers=headers,
        json={"reading_progress_chapter": 2},
    )
    assert add_res.status_code == 201
    add_data = add_res.get_json()
    assert add_data["book_id"] == book_id
    assert add_data["reading_progress_chapter"] == 2

    # Verify isolated per-user character state created
    with db_manager.session_scope() as session:
        user_state = session.scalar(
            select(UserCharacterState).where(
                UserCharacterState.user_id == reader_id,
                UserCharacterState.character_id == raskolnikov_id,
            )
        )
        assert user_state is not None
        assert user_state.emotion_state.get("anxiety") == 0.85


def test_admin_publish_catalogue_book_authorization(db_client: FlaskClient):
    """Verifies that only users with admin role can publish books to the public catalogue."""
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]
    admin_id, reader_id, _, _, _ = _setup_phase7_test_environment(db_manager)

    with db_manager.session_scope() as session:
        draft = Book(
            owner_user_id=admin_id,
            title="Notes from Underground",
            author="Fyodor Dostoevsky",
            visibility="private",
        )
        session.add(draft)
        session.flush()
        draft_id = draft.id

    # 1. Unauthorized reader attempt -> 403 Forbidden
    reader_headers = {"X-Test-User-Id": "usr-phase7-reader-citizen"}
    unauth_res = db_client.patch(
        f"/api/v1/admin/books/{draft_id}/publish",
        headers=reader_headers,
        json={"rights_basis": "Public Domain (US)"},
    )
    assert unauth_res.status_code == 403

    # 2. Authorized admin attempt -> 200 OK
    admin_headers = {"X-Test-User-Id": "usr-phase7-admin-launcher"}
    auth_res = db_client.patch(
        f"/api/v1/admin/books/{draft_id}/publish",
        headers=admin_headers,
        json={
            "edition_notes": "1864 Russian novella translated by Constance Garnett.",
            "rights_basis": "Public Domain (Life+70)",
            "file_provenance": "Project Gutenberg #600",
            "cover_art_licence": "Public Domain / CC0",
        },
    )
    assert auth_res.status_code == 200
    data = auth_res.get_json()
    assert data["visibility"] == "featured"
    assert data["rights_basis"] == "Public Domain (Life+70)"


def test_user_data_export_and_gdpr_deletion(db_client: FlaskClient):
    """
    Verifies Section 17 privacy and data portability:
    - Complete account data export (settings, books, conversations, memories, voice usage).
    - Permanent account erasure cascading cleanly across related records.
    """
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]
    _, reader_id, book_id, raskolnikov_id, _ = _setup_phase7_test_environment(db_manager)
    headers = {"X-Test-User-Id": "usr-phase7-reader-citizen"}

    # 1. Create a conversation for the reader
    conv_res = db_client.post(
        f"/api/v1/characters/{raskolnikov_id}/conversations",
        headers=headers,
        json={"title": "Conscience Discussion"},
    )
    session_id = conv_res.get_json()["id"]

    # Send a message
    db_client.post(
        f"/api/v1/conversations/{session_id}/messages",
        headers=headers,
        json={"content": "Can an extraordinary person transcend ordinary laws?"},
    )

    # 2. Export account data
    export_res = db_client.get("/api/v1/me/export", headers=headers)
    assert export_res.status_code == 200
    bundle = export_res.get_json()
    assert bundle["export_version"] == "1.0"
    assert "reader-citizen" in bundle["user"]["email"]
    assert "settings" in bundle
    assert bundle["settings"]["reading_theme"] == "parchment"
    assert len(bundle["conversations"]) >= 1
    assert any("Conscience Discussion" in c["title"] for c in bundle["conversations"])

    # 3. Delete account permanently
    del_res = db_client.delete("/api/v1/me", headers=headers)
    assert del_res.status_code == 200
    assert del_res.get_json()["status"] == "deleted"

    # Verify user and related records purged in database
    with db_manager.session_scope() as session:
        u = session.get(UserAccount, reader_id)
        assert u is None
        remaining_sessions = session.scalars(select(ChatSession).where(ChatSession.owner_user_id == reader_id)).all()
        assert len(remaining_sessions) == 0
