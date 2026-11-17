from __future__ import annotations

from flask.testing import FlaskClient
from sqlalchemy import select

from book_character_simulation_backend.db.models import (
    Book,
    CharacterProfileRecord,
    UserAccount,
    UserCharacterState,
    UserRole,
)
from book_character_simulation_backend.db.session import DatabaseManager


def test_bookshelf_scoping_and_export_workflow(db_client: FlaskClient):
    """
    Verifies strict separation of Bookshelf (/bookshelf) vs Book Store (/store):
    1. Admin creates a featured store book with characters.
    2. Reader creates a private book.
    3. Reader's bookshelf (scope=mine) ONLY contains reader's uploaded book; store book is absent.
    4. Reader's character gallery (/characters) ONLY contains characters from reader's books.
    5. Reader exports store book to bookshelf (POST /catalog/books/<id>/add-to-library).
    6. Bookshelf now includes exported store book (is_owner=False, is_in_library=True).
    7. Character gallery now includes store book's characters.
    8. Book store (GET /catalog/featured) reports is_in_library=True for exported book.
    9. Reader removes book from bookshelf (DELETE /catalog/books/<id>/add-to-library).
    10. Book and its characters are removed from personal shelf & gallery while remaining in store.
    """
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]

    # Setup admin and reader accounts
    with db_manager.session_scope() as session:
        admin = UserAccount(
            supabase_user_id="usr-scoping-admin",
            email="admin-scoping@lorely.example",
            display_name="Admin Curator",
        )
        reader = UserAccount(
            supabase_user_id="usr-scoping-reader",
            email="reader-scoping@lorely.example",
            display_name="Avid Reader",
        )
        session.add_all([admin, reader])
        session.flush()

        admin_role = UserRole(user_id=admin.id, role="admin")
        session.add(admin_role)
        session.flush()

        # Admin creates featured store book: The Count of Monte Cristo
        store_book = Book(
            owner_user_id=admin.id,
            title="The Count of Monte Cristo",
            author="Alexandre Dumas",
            summary="A tale of betrayal, revenge, and redemption in 19th-century France.",
            visibility="featured",
            original_language="en",
        )
        session.add(store_book)
        session.flush()

        edmond = CharacterProfileRecord(
            book_id=store_book.id,
            name="Edmond Dantes",
            role="Protagonist",
            personality="Vengeful yet noble",
            emotion_state={"resolve": 0.95},
            psi_parameters={"warmth": 0.4},
        )
        faria = CharacterProfileRecord(
            book_id=store_book.id,
            name="Abbe Faria",
            role="Mentor",
            personality="Wise scholar and priest",
            emotion_state={"peace": 0.8},
            psi_parameters={"warmth": 0.85},
        )
        session.add_all([edmond, faria])
        session.flush()

        admin_id = admin.id
        reader_id = reader.id
        store_book_id = store_book.id
        edmond_id = edmond.id
        faria_id = faria.id

    admin_headers = {"X-Test-User-Id": "usr-scoping-admin"}
    reader_headers = {"X-Test-User-Id": "usr-scoping-reader"}

    # 1. Reader creates their own private uploaded book
    create_res = db_client.post(
        "/api/v1/books",
        headers=reader_headers,
        json={"title": "My Personal Diary", "visibility": "private", "author": "Reader Me"},
    )
    assert create_res.status_code == 201
    reader_book_id = create_res.get_json()["id"]

    # 2. Check Reader's personal Bookshelf (scope=mine)
    # Must ONLY contain reader's own book; store book must NOT be mixed in!
    shelf_res = db_client.get("/api/v1/books?scope=mine", headers=reader_headers)
    assert shelf_res.status_code == 200
    shelf_books = shelf_res.get_json()["books"]
    shelf_ids = [b["id"] for b in shelf_books]

    assert reader_book_id in shelf_ids
    assert store_book_id not in shelf_ids, "Unexported store book must not appear in user's personal bookshelf!"

    reader_book_entry = next(b for b in shelf_books if b["id"] == reader_book_id)
    assert reader_book_entry["is_owner"] is True
    assert reader_book_entry["is_in_library"] is True

    # 3. Check Reader's Character Gallery (/characters)
    # Must NOT contain characters from unexported store books!
    chars_res = db_client.get("/api/v1/characters", headers=reader_headers)
    assert chars_res.status_code == 200
    chars = chars_res.get_json()["characters"]
    char_names = [c["name"] for c in chars]

    assert "Edmond Dantes" not in char_names, "Unexported character must not appear in user's character gallery!"
    assert "Abbe Faria" not in char_names

    # 4. Check Book Store catalog before export (GET /catalog/featured)
    cat_res = db_client.get("/api/v1/catalog/featured", headers=reader_headers)
    assert cat_res.status_code == 200
    cat_books = cat_res.get_json()["books"]
    featured_monte = next((b for b in cat_books if b["id"] == store_book_id), None)
    assert featured_monte is not None
    assert featured_monte["is_in_library"] is False, "Book should not be flagged as in library before export!"

    # 5. Reader clicks "Export to Bookshelf"
    export_res = db_client.post(
        f"/api/v1/catalog/books/{store_book_id}/add-to-library",
        headers=reader_headers,
        json={"reading_progress_chapter": 1},
    )
    assert export_res.status_code == 201
    export_data = export_res.get_json()
    assert export_data["book_id"] == store_book_id

    # Verify per-user character states initialized
    with db_manager.session_scope() as session:
        edmond_state = session.scalar(
            select(UserCharacterState).where(
                UserCharacterState.user_id == reader_id,
                UserCharacterState.character_id == edmond_id,
            )
        )
        assert edmond_state is not None
        assert edmond_state.emotion_state.get("resolve") == 0.95

    # 6. Re-check Reader's Bookshelf (scope=mine)
    # Now it MUST contain both books!
    shelf_res_2 = db_client.get("/api/v1/books?scope=mine", headers=reader_headers)
    assert shelf_res_2.status_code == 200
    shelf_books_2 = shelf_res_2.get_json()["books"]
    shelf_ids_2 = [b["id"] for b in shelf_books_2]

    assert reader_book_id in shelf_ids_2
    assert store_book_id in shelf_ids_2, "Exported store book must now appear in user's personal bookshelf!"

    exported_entry = next(b for b in shelf_books_2 if b["id"] == store_book_id)
    assert exported_entry["is_owner"] is False
    assert exported_entry["is_in_library"] is True

    # 7. Re-check Reader's Character Gallery (/characters)
    # Now it MUST contain Edmond Dantes and Abbe Faria!
    chars_res_2 = db_client.get("/api/v1/characters", headers=reader_headers)
    assert chars_res_2.status_code == 200
    chars_2 = chars_res_2.get_json()["characters"]
    char_names_2 = [c["name"] for c in chars_2]

    assert "Edmond Dantes" in char_names_2, "Exported character must now appear in user's character gallery!"
    assert "Abbe Faria" in char_names_2

    # 8. Re-check Book Store (GET /catalog/featured)
    # is_in_library should now be True
    cat_res_2 = db_client.get("/api/v1/catalog/featured", headers=reader_headers)
    assert cat_res_2.status_code == 200
    cat_books_2 = cat_res_2.get_json()["books"]
    featured_monte_2 = next((b for b in cat_books_2 if b["id"] == store_book_id), None)
    assert featured_monte_2 is not None
    assert featured_monte_2["is_in_library"] is True, "Book should now be flagged as is_in_library=True!"

    # 9. Reader removes book from bookshelf (DELETE /catalog/books/<id>/add-to-library)
    del_res = db_client.delete(f"/api/v1/catalog/books/{store_book_id}/add-to-library", headers=reader_headers)
    assert del_res.status_code == 200
    assert del_res.get_json()["removed"] is True

    # 10. Re-check Bookshelf & Character Gallery after removal
    shelf_res_3 = db_client.get("/api/v1/books?scope=mine", headers=reader_headers)
    shelf_ids_3 = [b["id"] for b in shelf_res_3.get_json()["books"]]
    assert store_book_id not in shelf_ids_3

    chars_res_3 = db_client.get("/api/v1/characters", headers=reader_headers)
    char_names_3 = [c["name"] for c in chars_res_3.get_json()["characters"]]
    assert "Edmond Dantes" not in char_names_3

    cat_res_3 = db_client.get("/api/v1/catalog/featured", headers=reader_headers)
    featured_monte_3 = next((b for b in cat_res_3.get_json()["books"] if b["id"] == store_book_id), None)
    assert featured_monte_3["is_in_library"] is False
