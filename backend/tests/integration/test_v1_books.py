from __future__ import annotations

from flask.testing import FlaskClient


def test_create_and_list_books(db_client: FlaskClient):
    headers_u1 = {"X-Test-User-Id": "user-one"}

    # 1. Create a book
    payload = {
        "title": "The Great Gatsby",
        "author": "F. Scott Fitzgerald",
        "summary": "A novel about the American dream in the Jazz Age.",
        "visibility": "private",
        "source_type": "book",
    }
    res = db_client.post("/api/v1/books", json=payload, headers=headers_u1)
    assert res.status_code == 201
    data = res.get_json()
    assert data["title"] == "The Great Gatsby"
    assert data["author"] == "F. Scott Fitzgerald"
    assert data["visibility"] == "private"
    book_id = data["id"]

    # 2. List books for user-1
    res = db_client.get("/api/v1/books", headers=headers_u1)
    assert res.status_code == 200
    books = res.get_json()["books"]
    assert any(b["id"] == book_id and b["is_owner"] is True for b in books)


def test_book_details_and_patch(db_client: FlaskClient):
    headers = {"X-Test-User-Id": "reader-alice"}

    # Create book
    res = db_client.post(
        "/api/v1/books",
        json={"title": "Pride and Prejudice", "author": "Jane Austen"},
        headers=headers,
    )
    book_id = res.get_json()["id"]

    # Get details
    res = db_client.get(f"/api/v1/books/{book_id}", headers=headers)
    assert res.status_code == 200
    details = res.get_json()
    assert details["title"] == "Pride and Prejudice"
    assert details["characters"] == []

    # Patch title and summary
    patch_res = db_client.patch(
        f"/api/v1/books/{book_id}",
        json={"title": "Pride & Prejudice (Annotated)", "summary": "Classic romance."},
        headers=headers,
    )
    assert patch_res.status_code == 200
    updated = patch_res.get_json()
    assert updated["title"] == "Pride & Prejudice (Annotated)"
    assert updated["summary"] == "Classic romance."


def test_user_isolation_private_book(db_client: FlaskClient):
    headers_u1 = {"X-Test-User-Id": "user-alpha"}
    headers_u2 = {"X-Test-User-Id": "user-beta"}

    # User 1 creates a private book
    create_res = db_client.post(
        "/api/v1/books",
        json={"title": "Alpha Secret Diary", "visibility": "private"},
        headers=headers_u1,
    )
    book_id = create_res.get_json()["id"]

    # User 2 lists books -> should NOT see User 1's private book
    res = db_client.get("/api/v1/books", headers=headers_u2)
    assert res.status_code == 200
    user2_books = res.get_json()["books"]
    assert not any(b["id"] == book_id for b in user2_books)
    assert not any(b["title"] == "Alpha Secret Diary" for b in user2_books)

    # User 2 attempts to get User 1's book details -> 403 Forbidden
    res = db_client.get(f"/api/v1/books/{book_id}", headers=headers_u2)
    assert res.status_code == 403

    # User 2 attempts to delete User 1's book -> 403 Forbidden
    del_res = db_client.delete(f"/api/v1/books/{book_id}", headers=headers_u2)
    assert del_res.status_code == 403


def test_featured_book_visibility(db_client: FlaskClient):
    headers_admin = {"X-Test-User-Id": "admin-curator"}
    headers_reader = {"X-Test-User-Id": "reader-guest"}

    # Create featured book
    create_res = db_client.post(
        "/api/v1/books",
        json={"title": "Timeless Classics: Dracula", "visibility": "featured"},
        headers=headers_admin,
    )
    book_id = create_res.get_json()["id"]

    # Reader lists books -> sees featured book
    res = db_client.get("/api/v1/books", headers=headers_reader)
    assert res.status_code == 200
    books = res.get_json()["books"]
    assert any(b["id"] == book_id for b in books)

    # Reader views details -> allowed
    res = db_client.get(f"/api/v1/books/{book_id}", headers=headers_reader)
    assert res.status_code == 200
    assert res.get_json()["is_owner"] is False

    # Reader tries to delete featured book they don't own -> 403 Forbidden
    del_res = db_client.delete(f"/api/v1/books/{book_id}", headers=headers_reader)
    assert del_res.status_code == 403


def test_delete_book_cascade(db_client: FlaskClient):
    headers = {"X-Test-User-Id": "deleter-dan"}

    create_res = db_client.post(
        "/api/v1/books",
        json={"title": "Ephemeral Notes"},
        headers=headers,
    )
    book_id = create_res.get_json()["id"]

    # Delete book
    del_res = db_client.delete(f"/api/v1/books/{book_id}", headers=headers)
    assert del_res.status_code == 200

    # Subsequent GET returns 404
    res = db_client.get(f"/api/v1/books/{book_id}", headers=headers)
    assert res.status_code == 404


def test_download_book_source(db_client: FlaskClient):
    headers = {"X-Test-User-Id": "downloader-dave"}
    create_res = db_client.post(
        "/api/v1/books",
        json={"title": "Moby Dick", "extracted_text": "Call me Ishmael. Some years ago..."},
        headers=headers,
    )
    assert create_res.status_code == 201
    book_id = create_res.get_json()["id"]

    # Download book file
    dl_res = db_client.get(f"/api/v1/books/{book_id}/download", headers=headers)
    assert dl_res.status_code == 200
    assert b"Call me Ishmael." in dl_res.data
    assert "attachment" in dl_res.headers.get("Content-Disposition", "")
