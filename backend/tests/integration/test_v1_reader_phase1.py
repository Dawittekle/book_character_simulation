from __future__ import annotations

import io
from flask.testing import FlaskClient
from sqlalchemy import select

from book_character_simulation_backend.db.models import (
    BookAnnotation,
    BookBookmark,
    BookChapter,
    BookNarrationSegment,
    ReadingProgress,
    UserAccount,
    UserRole,
)


def test_reader_access_permission_isolation(db_client: FlaskClient):
    headers_owner = {"X-Test-User-Id": "reader-author-1"}
    headers_other = {"X-Test-User-Id": "reader-stranger-2"}
    headers_admin = {"X-Test-User-Id": "reader-admin-3"}

    # Assign admin role to admin user
    app = db_client.application
    db = app.extensions["database_manager"]
    with db.session_scope() as session:
        admin_acc = session.scalar(select(UserAccount).where(UserAccount.supabase_user_id == "reader-admin-3"))
        if not admin_acc:
            admin_acc = UserAccount(
                id="reader-admin-3",
                supabase_user_id="reader-admin-3",
                email="reader-admin-3@lorely.local",
            )
            session.add(admin_acc)
            session.flush()
        existing_role = session.scalar(select(UserRole).where(UserRole.user_id == admin_acc.id))
        if not existing_role:
            session.add(UserRole(user_id=admin_acc.id, role="admin"))
        else:
            existing_role.role = "admin"

    # 1. Author creates a private book with extracted text
    create_res = db_client.post(
        "/api/v1/books",
        json={
            "title": "Private Manuscript",
            "author": "Secret Novelist",
            "visibility": "private",
            "text": "Chapter 1: The Secret Begins.\nIt was a dark and stormy night.",
        },
        headers=headers_owner,
    )
    assert create_res.status_code == 201
    book_id = create_res.get_json()["id"]

    # 2. Stranger tries to access reader -> 403 Forbidden
    unauth_res = db_client.get(f"/api/v1/reader/books/{book_id}/access", headers=headers_other)
    assert unauth_res.status_code == 403
    assert "permission" in unauth_res.get_json()["error"].lower()

    # 3. Owner accesses reader -> 200 OK with stream URL and initial progress
    owner_res = db_client.get(f"/api/v1/reader/books/{book_id}/access", headers=headers_owner)
    assert owner_res.status_code == 200
    owner_data = owner_res.get_json()
    assert owner_data["book_id"] == book_id
    assert owner_data["title"] == "Private Manuscript"
    assert owner_data["format"] == "txt"
    assert "stream_url" in owner_data
    assert owner_data["current_progress"]["current_chapter_index"] == 0
    assert owner_data["current_progress"]["progress_percent"] == 0.0

    # 4. Admin accesses reader -> 200 OK
    admin_res = db_client.get(f"/api/v1/reader/books/{book_id}/access", headers=headers_admin)
    assert admin_res.status_code == 200


def test_reader_public_and_featured_books_accessible_by_all(db_client: FlaskClient):
    headers_author = {"X-Test-User-Id": "featured-author"}
    headers_guest = {"X-Test-User-Id": "guest-reader"}

    # Create featured book
    create_res = db_client.post(
        "/api/v1/books",
        json={
            "title": "Pride and Prejudice",
            "author": "Jane Austen",
            "visibility": "featured",
            "text": "It is a truth universally acknowledged...",
        },
        headers=headers_author,
    )
    assert create_res.status_code == 201
    book_id = create_res.get_json()["id"]

    # Guest can access without owning it
    res = db_client.get(f"/api/v1/reader/books/{book_id}/access", headers=headers_guest)
    assert res.status_code == 200
    data = res.get_json()
    assert data["title"] == "Pride and Prejudice"
    assert data["author"] == "Jane Austen"


def test_reader_chapters_endpoint(db_client: FlaskClient):
    headers = {"X-Test-User-Id": "chapter-test-user"}
    create_res = db_client.post(
        "/api/v1/books",
        json={
            "title": "Multi-Chapter Book",
            "text": "Chapter 1: The Start\nHello world.\nChapter 2: The Journey\nMoving along.",
        },
        headers=headers,
    )
    book_id = create_res.get_json()["id"]

    res = db_client.get(f"/api/v1/reader/books/{book_id}/chapters", headers=headers)
    assert res.status_code == 200
    chapters = res.get_json()["chapters"]
    assert isinstance(chapters, list)
    assert len(chapters) >= 1
    assert "chapter_index" in chapters[0]
    assert "title" in chapters[0]


def test_reader_raw_stream_endpoint(db_client: FlaskClient):
    headers = {"X-Test-User-Id": "stream-test-user"}
    create_res = db_client.post(
        "/api/v1/books",
        json={
            "title": "Streamable Novel",
            "text": "The quick brown fox jumps over the lazy dog.",
        },
        headers=headers,
    )
    book_id = create_res.get_json()["id"]

    # Fetch raw stream
    res = db_client.get(f"/api/v1/reader/books/{book_id}/raw", headers=headers)
    assert res.status_code == 200
    assert "text/plain" in res.headers["Content-Type"]
    assert b"The quick brown fox" in res.data


def test_storage_service_generate_presigned_download_url():
    from book_character_simulation_backend.config import Settings
    from book_character_simulation_backend.services.storage_service import StorageService

    settings = Settings.from_env()
    service = StorageService(settings)

    # Local mode fallback
    res = service.generate_presigned_download_url("books/test-id/original/book.epub")
    assert res["storage_provider"] in ("local", "r2")
    assert "download_url" in res
    assert "book.epub" in res["download_url"]


def test_reader_database_models_persistence(db_client: FlaskClient):
    app = db_client.application
    db = app.extensions["database_manager"]

    with db.session_scope() as session:
        # Create user and book
        user = UserAccount(email="db-models-test@lorely.local")
        session.add(user)
        session.flush()

        from book_character_simulation_backend.db.models import Book
        book = Book(owner_user_id=user.id, title="Test Models Book", visibility="private")
        session.add(book)
        session.flush()

        # 1. ReadingProgress
        progress = ReadingProgress(
            user_id=user.id,
            book_id=book.id,
            current_chapter_index=2,
            progress_percent=45.5,
            locator_type="epub_cfi",
            locator_payload={"cfi": "epubcfi(/6/4[chap01]!/4/2/10)"},
            last_read_mode="follow_along",
            reading_time_seconds=600,
        )
        session.add(progress)

        # 2. BookBookmark
        bookmark = BookBookmark(
            user_id=user.id,
            book_id=book.id,
            chapter_index=2,
            chapter_title="Chapter II: The Encounter",
            progress_percent=45.5,
            locator_type="epub_cfi",
            locator_payload={"cfi": "epubcfi(/6/4[chap01]!/4/2/10)"},
            snippet="Elizabeth smiled with serene amusement.",
        )
        session.add(bookmark)

        # 3. BookAnnotation
        annotation = BookAnnotation(
            user_id=user.id,
            book_id=book.id,
            chapter_index=2,
            selected_text="Elizabeth smiled with serene amusement.",
            color="amber",
            note="Notice Elizabeth's guarded irony here.",
            locator_type="epub_cfi",
            locator_payload={"cfi_range": "epubcfi(/6/4[chap01]!/4/2/10,/4/2/22)"},
        )
        session.add(annotation)

        # 4. BookNarrationSegment
        narration = BookNarrationSegment(
            book_id=book.id,
            chapter_index=2,
            voice_id="alloy-warm",
            audio_storage_path=f"books/{book.id}/narration/ch_2.mp3",
            duration_ms=45200,
            alignment_data=[
                {"segment_index": 0, "text": "Elizabeth smiled.", "start_time_ms": 0, "end_time_ms": 2100}
            ],
        )
        session.add(narration)
        session.commit()

        # Verify retrieval
        saved_progress = session.scalar(select(ReadingProgress).where(ReadingProgress.user_id == user.id))
        assert saved_progress is not None
        assert saved_progress.current_chapter_index == 2
        assert saved_progress.locator_payload["cfi"] == "epubcfi(/6/4[chap01]!/4/2/10)"

        saved_bm = session.scalar(select(BookBookmark).where(BookBookmark.user_id == user.id))
        assert saved_bm is not None
        assert saved_bm.chapter_title == "Chapter II: The Encounter"

        saved_ann = session.scalar(select(BookAnnotation).where(BookAnnotation.user_id == user.id))
        assert saved_ann is not None
        assert saved_ann.color == "amber"
        assert "guarded irony" in saved_ann.note

        saved_narr = session.scalar(select(BookNarrationSegment).where(BookNarrationSegment.book_id == book.id))
        assert saved_narr is not None
        assert saved_narr.duration_ms == 45200
        assert len(saved_narr.alignment_data) == 1


def test_reader_progress_sync_and_spoiler_advance(db_client: FlaskClient):
    headers = {"X-Test-User-Id": "progress-reader-1"}

    # 1. Create a book
    create_res = db_client.post(
        "/api/v1/books",
        json={"title": "Progress Tracking Novel", "visibility": "private", "text": "Ch 1 text..."},
        headers=headers,
    )
    book_id = create_res.get_json()["id"]

    # 2. Add book to user's library
    db_client.post(f"/api/v1/catalog/books/{book_id}/add-to-library", headers=headers)

    # 3. Update reading progress to Chapter 4 (index 3), 42%
    put_res = db_client.put(
        f"/api/v1/reader/books/{book_id}/progress",
        json={
            "chapter_index": 3,
            "progress_percent": 42.5,
            "locator_type": "epub_cfi",
            "locator_payload": {"cfi": "epubcfi(/6/8!/4/2)"},
            "last_read_mode": "read",
            "reading_time_delta_seconds": 120,
        },
        headers=headers,
    )
    assert put_res.status_code == 200
    data = put_res.get_json()
    assert data["current_chapter_index"] == 3
    assert data["progress_percent"] == 42.5
    assert data["reading_time_seconds"] == 120
    assert data["completed"] is False

    # 4. Fetch reading progress
    get_res = db_client.get(f"/api/v1/reader/books/{book_id}/progress", headers=headers)
    assert get_res.status_code == 200
    assert get_res.get_json()["current_chapter_index"] == 3

    # 5. Fetch book details and verify reading_progress & reading_status
    details_res = db_client.get(f"/api/v1/books/{book_id}", headers=headers)
    assert details_res.status_code == 200
    details = details_res.get_json()
    assert details["reading_status"] == "in_progress"
    assert details["reading_progress"]["current_chapter_index"] == 3

    # 6. Verify UserLibraryBook spoiler boundary advanced to Chapter 4 (1-based index)
    app = db_client.application
    db = app.extensions["database_manager"]
    with db.session_scope() as session:
        from book_character_simulation_backend.db.models import UserLibraryBook, UserAccount
        user = session.scalar(select(UserAccount).where(UserAccount.supabase_user_id == "progress-reader-1"))
        lib_entry = session.scalar(
            select(UserLibraryBook).where(
                UserLibraryBook.user_id == user.id,
                UserLibraryBook.book_id == book_id,
            )
        )
        if lib_entry:
            assert lib_entry.reading_progress_chapter >= 4
