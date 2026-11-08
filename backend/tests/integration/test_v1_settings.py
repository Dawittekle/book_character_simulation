from __future__ import annotations

from flask.testing import FlaskClient


def test_me_and_settings_lifecycle(db_client: FlaskClient):
    headers = {"X-Test-User-Id": "reader-emily"}

    # 1. Fetch current profile
    res = db_client.get("/api/v1/me", headers=headers)
    assert res.status_code == 200
    profile = res.get_json()
    assert profile["email"] == "reader-emily@test.lorely.app"
    assert profile["role"] == "user"
    assert profile["book_count"] == 0

    # 2. Update display name
    update_res = db_client.patch(
        "/api/v1/me",
        json={"display_name": "Emily Bronte"},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.get_json()["display_name"] == "Emily Bronte"

    # 3. Fetch default settings
    res_settings = db_client.get("/api/v1/me/settings", headers=headers)
    assert res_settings.status_code == 200
    settings = res_settings.get_json()
    assert settings["reading_theme"] == "parchment"
    assert settings["enter_to_send"] is True

    # 4. Patch settings
    patch_settings = db_client.patch(
        "/api/v1/me/settings",
        json={
            "reading_theme": "dark_ink",
            "spoiler_policy": "all_book",
            "enter_to_send": False,
        },
        headers=headers,
    )
    assert patch_settings.status_code == 200
    updated = patch_settings.get_json()
    assert updated["reading_theme"] == "dark_ink"
    assert updated["spoiler_policy"] == "all_book"
    assert updated["enter_to_send"] is False
