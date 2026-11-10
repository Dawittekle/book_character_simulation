from __future__ import annotations

from unittest.mock import patch
from flask.testing import FlaskClient
from sqlalchemy import select

from book_character_simulation_backend.db.models import (
    Book,
    BookAnnotation,
    BookBookmark,
    BookChapter,
    CharacterProfileRecord,
    ChatSession,
    UserAccount,
)


def test_reader_bookmarks_crud(db_client: FlaskClient):
    headers = {"X-Test-User-Id": "bookmark-user-1"}
    headers_other = {"X-Test-User-Id": "bookmark-user-2"}

    # 1. Create a book
    create_res = db_client.post(
        "/api/v1/books",
        json={"title": "Bookmark Testing Novel", "visibility": "featured", "text": "Chapter 1..."},
        headers=headers,
    )
    assert create_res.status_code == 201
    book_id = create_res.get_json()["id"]

    # 2. Initially empty bookmarks
    get_res = db_client.get(f"/api/v1/reader/books/{book_id}/bookmarks", headers=headers)
    assert get_res.status_code == 200
    assert get_res.get_json()["bookmarks"] == []

    # 3. Create bookmark
    post_res = db_client.post(
        f"/api/v1/reader/books/{book_id}/bookmarks",
        json={
            "chapter_index": 2,
            "chapter_title": "Chapter III: A Chance Meeting",
            "progress_percent": 34.5,
            "locator_type": "text_offset",
            "locator_payload": {"offset": 1240},
            "snippet": "She walked along the gravel path in quiet contemplation.",
        },
        headers=headers,
    )
    assert post_res.status_code == 201
    bm_data = post_res.get_json()["bookmark"]
    assert bm_data["chapter_index"] == 2
    assert bm_data["chapter_title"] == "Chapter III: A Chance Meeting"
    assert bm_data["progress_percent"] == 34.5
    assert "gravel path" in bm_data["snippet"]
    bookmark_id = bm_data["id"]

    # 4. List bookmarks
    list_res = db_client.get(f"/api/v1/reader/books/{book_id}/bookmarks", headers=headers)
    assert list_res.status_code == 200
    bookmarks = list_res.get_json()["bookmarks"]
    assert len(bookmarks) == 1
    assert bookmarks[0]["id"] == bookmark_id

    # 5. Other user sees empty bookmarks (isolation)
    other_list = db_client.get(f"/api/v1/reader/books/{book_id}/bookmarks", headers=headers_other)
    assert other_list.status_code == 200
    assert other_list.get_json()["bookmarks"] == []

    # 6. Other user cannot delete first user's bookmark
    del_unauth = db_client.delete(f"/api/v1/reader/books/{book_id}/bookmarks/{bookmark_id}", headers=headers_other)
    assert del_unauth.status_code in (403, 404)

    # 7. Owner deletes bookmark
    del_res = db_client.delete(f"/api/v1/reader/books/{book_id}/bookmarks/{bookmark_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.get_json()["status"] == "deleted"

    # 8. List is empty again
    final_list = db_client.get(f"/api/v1/reader/books/{book_id}/bookmarks", headers=headers)
    assert final_list.status_code == 200
    assert final_list.get_json()["bookmarks"] == []


def test_reader_annotations_crud(db_client: FlaskClient):
    headers = {"X-Test-User-Id": "annotation-user-1"}

    # 1. Create a book
    create_res = db_client.post(
        "/api/v1/books",
        json={"title": "Annotation Testing Novel", "visibility": "featured", "text": "Chapter 1..."},
        headers=headers,
    )
    book_id = create_res.get_json()["id"]

    # 2. Create annotation with pastel color (rose) and personal reflection note
    post_res = db_client.post(
        f"/api/v1/reader/books/{book_id}/annotations",
        json={
            "chapter_index": 1,
            "selected_text": "He looked at her with sudden, involuntary admiration.",
            "color": "rose",
            "note": "A pivotal turning point in their early dynamic.",
            "locator_type": "text_offset",
            "locator_payload": {"start": 450, "end": 505},
        },
        headers=headers,
    )
    assert post_res.status_code == 201
    ann_data = post_res.get_json()["annotation"]
    assert ann_data["chapter_index"] == 1
    assert ann_data["color"] == "rose"
    assert ann_data["selected_text"] == "He looked at her with sudden, involuntary admiration."
    assert "pivotal turning point" in ann_data["note"]
    annotation_id = ann_data["id"]

    # 3. List annotations
    list_res = db_client.get(f"/api/v1/reader/books/{book_id}/annotations", headers=headers)
    assert list_res.status_code == 200
    annotations = list_res.get_json()["annotations"]
    assert len(annotations) == 1
    assert annotations[0]["id"] == annotation_id
    assert annotations[0]["color"] == "rose"

    # 4. Delete annotation
    del_res = db_client.delete(f"/api/v1/reader/books/{book_id}/annotations/{annotation_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.get_json()["status"] == "deleted"

    # 5. List is empty
    empty_res = db_client.get(f"/api/v1/reader/books/{book_id}/annotations", headers=headers)
    assert len(empty_res.get_json()["annotations"]) == 0


def test_reader_contextual_chat_with_spoiler_boundary(db_client: FlaskClient):
    headers = {"X-Test-User-Id": "reader-chat-user"}

    app = db_client.application
    db = app.extensions["database_manager"]

    # Setup a book with a character
    with db.session_scope() as session:
        user = session.scalar(select(UserAccount).where(UserAccount.supabase_user_id == "reader-chat-user"))
        if not user:
            user = UserAccount(id="reader-chat-user", supabase_user_id="reader-chat-user", email="reader@lorely.local")
            session.add(user)
            session.flush()

        book = Book(
            id="book-ctx-test",
            owner_user_id=user.id,
            title="Sense and Sensibility",
            author="Jane Austen",
            visibility="featured",
        )
        session.add(book)
        session.flush()

        ch1 = BookChapter(id="chap-1", book_id=book.id, chapter_order=1, title="Chapter I", start_char=0, end_char=500)
        ch2 = BookChapter(id="chap-2", book_id=book.id, chapter_order=2, title="Chapter II", start_char=501, end_char=1000)
        session.add_all([ch1, ch2])

        char = CharacterProfileRecord(
            id="char-elinor",
            book_id=book.id,
            stable_character_key="elinor_dashwood",
            name="Elinor Dashwood",
            role="Protagonist",
            personality="Composed, discerning, prudent and deeply loyal.",
            emotion_state={"calm": 0.8, "guarded": 0.6},
            psi_parameters={"prudence": 0.9, "expressiveness": 0.4},
            key_events=[
                {"chapter": 1, "event": "Family departs Norland Park."},
                {"chapter": 5, "event": "Secret engagement revelation (future spoiler!)."},
            ],
        )
        session.add(char)
        session.commit()

    # Call contextual-chat endpoint with passage quote from Chapter 1
    passage = "Elinor, this eldest daughter whose advice was so effectual, possessed a strength of understanding."
    post_res = db_client.post(
        "/api/v1/reader/books/book-ctx-test/contextual-chat",
        json={
            "character_id": "char-elinor",
            "passage_quote": passage,
            "user_message": "Do you feel burdened by being the sensible one in the family?",
            "chapter_index": 1,
        },
        headers=headers,
    )
    assert post_res.status_code == 201
    data = post_res.get_json()
    assert "session_id" in data
    assert "response" in data
    assert len(data["response"]) > 0
    assert data["passage_quote"] == passage
    assert data["chapter_index"] == 1
    assert data["character"]["id"] == "char-elinor"
    assert data["character"]["name"] == "Elinor Dashwood"
    session_id = data["session_id"]

    # Verify that citations include the passage quote
    assert len(data["citations"]) >= 1
    assert data["citations"][0]["chapter_order"] == 1
    assert "Elinor" in data["citations"][0]["snippet"]

    # Verify the created ChatSession has reading_progress_chapter = 1 (strictly spoiler-gated)
    with db.session_scope() as session:
        chat_sess = session.get(ChatSession, session_id)
        assert chat_sess is not None
        assert chat_sess.reading_progress_chapter == 1
        assert "Passage" in chat_sess.title

    # Continue the conversation within the same session
    cont_res = db_client.post(
        "/api/v1/reader/books/book-ctx-test/contextual-chat",
        json={
            "character_id": "char-elinor",
            "passage_quote": passage,
            "user_message": "Would you ever confide your own sorrow to Marianne?",
            "chapter_index": 1,
            "session_id": session_id,
        },
        headers=headers,
    )
    assert cont_res.status_code == 201
    cont_data = cont_res.get_json()
    assert cont_data["session_id"] == session_id
    assert "response" in cont_data
