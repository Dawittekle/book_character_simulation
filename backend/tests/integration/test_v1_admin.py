from __future__ import annotations

import json
import pytest
from flask import Flask
from flask.testing import FlaskClient

from book_character_simulation_backend.db.models import (
    Book,
    ProcessingJob,
    UserAccount,
    UserRole,
)
from book_character_simulation_backend.db.session import DatabaseManager


@pytest.fixture
def seeded_admin_environment(db_app: Flask):
    db: DatabaseManager = db_app.extensions["database_manager"]

    with db.session_scope() as session:
        # Create normal user
        normal_user = UserAccount(
            supabase_user_id="normal-user",
            email="normal@test.lorely.app",
            display_name="Normal Reader",
        )
        session.add(normal_user)
        session.flush()

        # Create admin user
        admin_user = UserAccount(
            supabase_user_id="admin-user",
            email="admin@test.lorely.app",
            display_name="Site Administrator",
        )
        session.add(admin_user)
        session.flush()

        # Grant admin role
        admin_role = UserRole(user_id=admin_user.id, role="admin")
        normal_role = UserRole(user_id=normal_user.id, role="user")
        session.add_all([admin_role, normal_role])
        session.flush()

        # Create book
        book = Book(
            owner_user_id=normal_user.id,
            title="The Grand Chronicle",
            visibility="private",
        )
        session.add(book)
        session.flush()

        # Create a failed job
        job = ProcessingJob(
            owner_user_id=normal_user.id,
            status="failed",
            stage="failed",
            document_type="book",
            inferred_title="The Grand Chronicle",
            error_message="Simulation extraction timeout",
        )
        session.add(job)
        session.commit()

        return {
            "normal_user_id": normal_user.id,
            "admin_user_id": admin_user.id,
            "book_id": book.id,
            "job_id": job.id,
        }


def test_non_admin_user_rejected_from_admin_endpoints(
    db_client: FlaskClient,
    seeded_admin_environment: dict[str, str],
):
    headers = {"X-Test-User-Id": "normal-user"}

    # 1. Overview
    res = db_client.get("/api/v1/admin/overview", headers=headers)
    assert res.status_code == 403
    assert "Administrator privileges required" in res.get_json()["error"]

    # 2. Books
    res = db_client.get("/api/v1/admin/books", headers=headers)
    assert res.status_code == 403

    # 3. Jobs
    res = db_client.get("/api/v1/admin/jobs", headers=headers)
    assert res.status_code == 403

    # 4. Users
    res = db_client.get("/api/v1/admin/users", headers=headers)
    assert res.status_code == 403


def test_admin_user_can_access_overview_and_operations(
    db_client: FlaskClient,
    seeded_admin_environment: dict[str, str],
):
    headers = {"X-Test-User-Id": "admin-user"}
    book_id = seeded_admin_environment["book_id"]
    job_id = seeded_admin_environment["job_id"]
    normal_user_id = seeded_admin_environment["normal_user_id"]

    # 1. Get Overview
    res = db_client.get("/api/v1/admin/overview", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["health"] == "healthy"
    assert data["counts"]["users"] >= 2
    assert data["counts"]["books"] >= 1
    assert len(data["recent_jobs"]) >= 1

    # 2. List & Update Books (Feature a book)
    books_res = db_client.get("/api/v1/admin/books", headers=headers)
    assert books_res.status_code == 200
    books = books_res.get_json()["books"]
    assert any(b["id"] == book_id for b in books)

    patch_res = db_client.patch(
        f"/api/v1/admin/books/{book_id}",
        headers=headers,
        data=json.dumps({"visibility": "featured"}),
        content_type="application/json",
    )
    assert patch_res.status_code == 200
    assert patch_res.get_json()["visibility"] == "featured"

    # 3. List Jobs & Retry Failed Job
    jobs_res = db_client.get("/api/v1/admin/jobs?status=failed", headers=headers)
    assert jobs_res.status_code == 200
    jobs = jobs_res.get_json()["jobs"]
    assert any(j["id"] == job_id for j in jobs)

    retry_res = db_client.post(f"/api/v1/admin/jobs/{job_id}/retry", headers=headers)
    assert retry_res.status_code == 200
    assert retry_res.get_json()["status"] == "queued"

    # 4. List Users & Promote/Demote
    users_res = db_client.get("/api/v1/admin/users", headers=headers)
    assert users_res.status_code == 200
    users = users_res.get_json()["users"]
    assert any(u["id"] == normal_user_id for u in users)

    promote_res = db_client.patch(
        f"/api/v1/admin/users/{normal_user_id}/role",
        headers=headers,
        data=json.dumps({"role": "admin"}),
        content_type="application/json",
    )
    assert promote_res.status_code == 200
    assert promote_res.get_json()["role"] == "admin"


def test_admin_login_endpoint(db_client: FlaskClient):
    # Invalid password
    bad_res = db_client.post(
        "/api/v1/admin/login",
        data=json.dumps({"email": "admin@lorely.app", "password": "wrong_password"}),
        content_type="application/json",
    )
    assert bad_res.status_code == 401

    # Valid credentials
    good_res = db_client.post(
        "/api/v1/admin/login",
        data=json.dumps({"email": "admin@lorely.app", "password": "LorelyAdmin2026!Secure"}),
        content_type="application/json",
    )
    assert good_res.status_code == 200
    payload = good_res.get_json()
    assert "token" in payload
    assert payload["user"]["role"] == "admin"
    admin_token = payload["token"]

    # Use the token to access admin overview
    auth_res = db_client.get(
        "/api/v1/admin/overview",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert auth_res.status_code == 200
    assert auth_res.get_json()["health"] == "healthy"
