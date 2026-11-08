from __future__ import annotations

import pytest
from flask import Flask
from flask.testing import FlaskClient

from book_character_simulation_backend.db.models import UserAccount, UserRole
from book_character_simulation_backend.db.session import DatabaseManager


@pytest.fixture
def notif_test_env(db_app: Flask):
    db: DatabaseManager = db_app.extensions["database_manager"]

    with db.session_scope() as session:
        admin = UserAccount(
            supabase_user_id="notif-admin",
            email="admin@notif.lorely.app",
            display_name="Broadcast Admin",
        )
        reader = UserAccount(
            supabase_user_id="notif-reader",
            email="reader@notif.lorely.app",
            display_name="Regular Reader",
        )
        session.add_all([admin, reader])
        session.flush()

        session.add_all([
            UserRole(user_id=admin.id, role="admin"),
            UserRole(user_id=reader.id, role="user"),
        ])
        session.commit()

        return {"admin_id": admin.id, "reader_id": reader.id}


def test_notifications_lifecycle_and_broadcast(db_client: FlaskClient, notif_test_env: dict[str, str]):
    # 1. Reader lists notifications (gets seeded defaults)
    res = db_client.get(
        "/api/v1/notifications",
        headers={"X-Test-User-Id": "notif-reader"},
    )
    assert res.status_code == 200
    notifs = res.get_json()["notifications"]
    assert len(notifs) >= 1
    first_id = notifs[0]["id"]
    assert notifs[0]["is_read"] is False

    # 2. Mark single notification as read
    res = db_client.post(
        f"/api/v1/notifications/{first_id}/read",
        headers={"X-Test-User-Id": "notif-reader"},
    )
    assert res.status_code == 200
    assert res.get_json()["is_read"] is True

    # 3. Admin broadcasts a new notification
    res = db_client.post(
        "/api/v1/admin/notifications/broadcast",
        headers={"X-Test-User-Id": "notif-admin"},
        json={
            "title": "New Character Available",
            "message": "Talk with Nástyenka under the Petersburg twilight.",
            "category": "character",
            "link_url": "/chat/char-nastenka",
        },
    )
    assert res.status_code == 201
    broadcast_data = res.get_json()
    assert broadcast_data["title"] == "New Character Available"

    # 4. Reader now sees the broadcast notification
    res = db_client.get(
        "/api/v1/notifications",
        headers={"X-Test-User-Id": "notif-reader"},
    )
    assert res.status_code == 200
    updated_notifs = res.get_json()["notifications"]
    titles = [n["title"] for n in updated_notifs]
    assert "New Character Available" in titles

    # 5. Mark all as read
    res = db_client.post(
        "/api/v1/notifications/read-all",
        headers={"X-Test-User-Id": "notif-reader"},
    )
    assert res.status_code == 200

    # 6. Verify all read
    res = db_client.get(
        "/api/v1/notifications",
        headers={"X-Test-User-Id": "notif-reader"},
    )
    for n in res.get_json()["notifications"]:
        assert n["is_read"] is True
