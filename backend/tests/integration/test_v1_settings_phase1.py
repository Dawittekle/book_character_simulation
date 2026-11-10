from __future__ import annotations

import io
from flask.testing import FlaskClient
from sqlalchemy import select

from book_character_simulation_backend.db.models import UserAccount, UserProfile, UserSettings


def _create_minimal_png(width: int = 100, height: int = 100) -> bytes:
    """Construct a minimal valid PNG image binary with specific width and height in IHDR."""
    import struct
    import zlib

    # PNG signature
    sig = b"\x89PNG\r\n\x1a\n"
    # IHDR chunk: length (13), IHDR, width, height, bit_depth=8, color_type=6 (RGBA), comp=0, filter=0, interlace=0
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    ihdr_crc = struct.pack(">I", zlib.crc32(b"IHDR" + ihdr_data) & 0xFFFFFFFF)
    ihdr_chunk = struct.pack(">I", 13) + b"IHDR" + ihdr_data + ihdr_crc

    # Single scanline compressed IDAT (uncompressed 1 line with filter byte 0)
    raw_scanlines = b"\x00" + (b"\x00\x00\x00\xff" * width)
    compressed = zlib.compress(raw_scanlines)
    idat_chunk = (
        struct.pack(">I", len(compressed))
        + b"IDAT"
        + compressed
        + struct.pack(">I", zlib.crc32(b"IDAT" + compressed) & 0xFFFFFFFF)
    )

    # IEND chunk
    iend_chunk = struct.pack(">I", 0) + b"IEND" + struct.pack(">I", zlib.crc32(b"IEND") & 0xFFFFFFFF)

    return sig + ihdr_chunk + idat_chunk + iend_chunk


def test_user_profile_crud_and_persistence(db_client: FlaskClient):
    headers = {"X-Test-User-Id": "settings-test-user-1"}

    # 1. Initial GET /me creates profile record with defaults
    res = db_client.get("/api/v1/me", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert "settings-test-user-1@" in data["email"]
    assert data["preferred_language"] == "en"
    assert data["full_name"] is None

    # 2. Update profile fields via PATCH /me
    patch_res = db_client.patch(
        "/api/v1/me",
        json={
            "full_name": "Jane Austen",
            "display_name": "Jane Penname",
            "preferred_language": "am",
        },
        headers=headers,
    )
    assert patch_res.status_code == 200
    patch_data = patch_res.get_json()
    assert patch_data["full_name"] == "Jane Austen"
    assert patch_data["display_name"] == "Jane Penname"
    assert patch_data["preferred_language"] == "am"

    # 3. Verify persistence across subsequent requests
    get_res = db_client.get("/api/v1/me", headers=headers)
    assert get_res.status_code == 200
    get_data = get_res.get_json()
    assert get_data["full_name"] == "Jane Austen"
    assert get_data["display_name"] == "Jane Penname"
    assert get_data["preferred_language"] == "am"

    # 4. Verify database model integrity
    app = db_client.application
    db = app.extensions["database_manager"]
    with db.session_scope() as session:
        user = session.scalar(select(UserAccount).where(UserAccount.supabase_user_id == "settings-test-user-1"))
        assert user is not None
        profile = session.scalar(select(UserProfile).where(UserProfile.id == user.id))
        assert profile is not None
        assert profile.full_name == "Jane Austen"
        assert profile.display_name == "Jane Penname"
        assert profile.preferred_language == "am"


def test_avatar_upload_validation_and_storage(db_client: FlaskClient):
    headers = {"X-Test-User-Id": "settings-avatar-user"}

    # 1. Reject empty file
    err_empty = db_client.post("/api/v1/me/avatar", data=b"", headers=headers)
    assert err_empty.status_code == 400

    # 2. Reject non-image text data
    err_text = db_client.post(
        "/api/v1/me/avatar",
        data=b"hello this is definitely not an image file",
        headers={**headers, "Content-Type": "image/png"},
    )
    assert err_text.status_code == 400
    assert "Unsupported" in err_text.get_json()["error"] or "Invalid" in err_text.get_json()["error"]

    # 3. Reject oversized file (> 10MB)
    fake_oversize = b"\x89PNG\r\n\x1a\n" + (b"\x00" * (10 * 1024 * 1024 + 100))
    err_oversize = db_client.post(
        "/api/v1/me/avatar",
        data=fake_oversize,
        headers={**headers, "Content-Type": "image/png"},
    )
    assert err_oversize.status_code == 400
    assert "exceeds maximum limit" in err_oversize.get_json()["error"]

    # 4. Upload valid PNG image
    valid_png = _create_minimal_png(120, 120)
    upload_res = db_client.post(
        "/api/v1/me/avatar",
        data={"avatar": (io.BytesIO(valid_png), "portrait.png")},
        headers=headers,
        content_type="multipart/form-data",
    )
    assert upload_res.status_code == 200
    data = upload_res.get_json()
    assert "storage_key" in data
    assert data["storage_key"].startswith("avatars/")
    assert data["content_type"] == "image/png"
    assert data["width"] == 120
    assert data["height"] == 120
    assert data["avatar_url"] is not None

    # 5. Verify GET /me reflects updated avatar_url and storage_path
    me_res = db_client.get("/api/v1/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.get_json()
    assert me_data["avatar_path"] == data["storage_key"]
    assert me_data["avatar_url"] == data["avatar_url"]

    # 6. Delete avatar via DELETE /me/avatar
    del_res = db_client.delete("/api/v1/me/avatar", headers=headers)
    assert del_res.status_code == 200
    del_data = del_res.get_json()
    assert del_data["status"] == "deleted"
    assert del_data["profile"]["avatar_path"] is None
    assert del_data["profile"]["avatar_url"] is None

    # 7. Subsequent GET confirms avatar removed
    verify_me = db_client.get("/api/v1/me", headers=headers)
    assert verify_me.get_json()["avatar_path"] is None


def test_expanded_user_settings_persistence(db_client: FlaskClient):
    headers = {"X-Test-User-Id": "settings-prefs-user"}

    # 1. Fetch initial settings (should include all expanded appearance & accessibility fields)
    initial_res = db_client.get("/api/v1/me/settings", headers=headers)
    assert initial_res.status_code == 200
    init_data = initial_res.get_json()
    assert init_data["app_theme"] == "system"
    assert init_data["accent_color"] == "coral"
    assert init_data["reduced_motion"] is False
    assert init_data["high_contrast"] is False
    assert init_data["reading_theme"] == "parchment"
    assert init_data["notification_preferences"] == {}

    # 2. Update settings with new appearance, theme, and notification preferences
    patch_res = db_client.patch(
        "/api/v1/me/settings",
        json={
            "app_theme": "dark",
            "accent_color": "emerald",
            "reduced_motion": True,
            "high_contrast": True,
            "reading_theme": "obsidian",
            "spoiler_policy": "strict",
            "notification_preferences": {
                "email_digest": True,
                "character_replies": True,
                "weekly_reading_goals": False,
            },
        },
        headers=headers,
    )
    assert patch_res.status_code == 200
    patch_data = patch_res.get_json()
    assert patch_data["app_theme"] == "dark"
    assert patch_data["accent_color"] == "emerald"
    assert patch_data["reduced_motion"] is True
    assert patch_data["high_contrast"] is True
    assert patch_data["reading_theme"] == "obsidian"
    assert patch_data["spoiler_policy"] == "strict"
    assert patch_data["notification_preferences"]["email_digest"] is True
    assert patch_data["notification_preferences"]["weekly_reading_goals"] is False

    # 3. Verify persistence on subsequent GET
    get_res = db_client.get("/api/v1/me/settings", headers=headers)
    assert get_res.status_code == 200
    get_data = get_res.get_json()
    assert get_data["app_theme"] == "dark"
    assert get_data["accent_color"] == "emerald"
    assert get_data["reduced_motion"] is True
    assert get_data["high_contrast"] is True
    assert get_data["reading_theme"] == "obsidian"
    assert get_data["notification_preferences"]["character_replies"] is True
