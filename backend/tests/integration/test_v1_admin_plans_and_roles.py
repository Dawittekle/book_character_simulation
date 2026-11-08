from __future__ import annotations

import pytest
from flask import Flask
from flask.testing import FlaskClient

from book_character_simulation_backend.db.models import UserAccount, UserRole, UserSettings
from book_character_simulation_backend.db.session import DatabaseManager


@pytest.fixture
def plan_test_env(db_app: Flask):
    db: DatabaseManager = db_app.extensions["database_manager"]

    with db.session_scope() as session:
        admin_user = UserAccount(
            supabase_user_id="admin-plan-test",
            email="admin@plan.lorely.app",
            display_name="Plan Admin",
        )
        reader_user = UserAccount(
            supabase_user_id="reader-plan-test",
            email="reader@plan.lorely.app",
            display_name="Plan Reader",
        )
        session.add_all([admin_user, reader_user])
        session.flush()

        admin_role = UserRole(user_id=admin_user.id, role="admin")
        reader_role = UserRole(user_id=reader_user.id, role="user")
        admin_settings = UserSettings(user_id=admin_user.id, preferences={"plan_tier": "scholar"})
        reader_settings = UserSettings(user_id=reader_user.id, preferences={"plan_tier": "free"})

        session.add_all([admin_role, reader_role, admin_settings, reader_settings])
        session.commit()

        return {
            "admin_id": admin_user.id,
            "reader_id": reader_user.id,
        }


def test_switch_role_and_plan_endpoints(db_client: FlaskClient, plan_test_env: dict[str, str]):
    # 1. Reader switches to admin
    res = db_client.post(
        "/api/v1/auth/switch-role",
        headers={"X-Test-User-Id": "reader-plan-test"},
        json={"role": "admin"},
    )
    assert res.status_code == 200
    assert res.get_json()["role"] == "admin"

    # 2. Get plans as admin
    res = db_client.get(
        "/api/v1/admin/plans",
        headers={"X-Test-User-Id": "reader-plan-test"},
    )
    assert res.status_code == 200
    plans = res.get_json()["plans"]
    assert len(plans) >= 3
    plan_ids = [p["id"] for p in plans]
    assert "free" in plan_ids
    assert "scholar" in plan_ids
    assert "institution" in plan_ids

    # Test public plans endpoint
    pub_res = db_client.get("/api/v1/plans")
    assert pub_res.status_code == 200
    pub_plans = pub_res.get_json()["plans"]
    assert len(pub_plans) >= 3

    # Test admin updating a plan
    edit_res = db_client.put(
        "/api/v1/admin/plans/scholar",
        headers={"X-Test-User-Id": "reader-plan-test"},
        json={"price_monthly": 19.99, "description": "Custom updated scholar tier."},
    )
    assert edit_res.status_code == 200
    updated_plan = edit_res.get_json()["plan"]
    assert updated_plan["price_monthly"] == 19.99
    assert updated_plan["description"] == "Custom updated scholar tier."

    # 3. Update user plan
    res = db_client.patch(
        f"/api/v1/admin/users/{plan_test_env['reader_id']}/plan",
        headers={"X-Test-User-Id": "admin-plan-test"},
        json={"plan_tier": "institution"},
    )
    assert res.status_code == 200
    assert res.get_json()["plan_tier"] == "institution"

    # 4. List users shows updated plan
    res = db_client.get(
        "/api/v1/admin/users",
        headers={"X-Test-User-Id": "admin-plan-test"},
    )
    assert res.status_code == 200
    users = res.get_json()["users"]
    reader_record = next(u for u in users if u["id"] == plan_test_env["reader_id"])
    assert reader_record["plan_tier"] == "institution"


def test_submit_payment_flow(db_client: FlaskClient, plan_test_env: dict[str, str]):
    # Reader submits a payment for 'scholar' tier with chosen AI model
    pay_res = db_client.post(
        "/api/v1/payments/submit",
        headers={"X-Test-User-Id": "reader-plan-test"},
        json={
            "plan_slug": "scholar",
            "amount": 20.0,
            "currency": "USD",
            "payment_method": "credit_card",
            "payment_details": {
                "cardholder_name": "Reader Test",
                "card_number": "4242 4242 4242 4242",
                "brand": "Visa",
            },
            "chosen_model": "gemini-2.5-pro",
        },
    )
    assert pay_res.status_code == 201
    payload = pay_res.get_json()
    assert payload["plan_slug"] == "scholar"
    assert payload["chosen_model"] == "gemini-2.5-pro"
    assert payload["status"] == "pending"
    assert payload["amount"] == 20.0
    payment_id = payload["id"]

    # 1. Admin lists payments
    list_res = db_client.get(
        "/api/v1/admin/payments",
        headers={"X-Test-User-Id": "admin-plan-test"},
    )
    assert list_res.status_code == 200
    payments = list_res.get_json()["payments"]
    assert any(p["id"] == payment_id for p in payments)

    # 2. Admin verifies payment
    verify_res = db_client.post(
        f"/api/v1/admin/payments/{payment_id}/verify",
        headers={"X-Test-User-Id": "admin-plan-test"},
        json={"admin_notes": "All checks cleared."},
    )
    assert verify_res.status_code == 200
    v_data = verify_res.get_json()
    assert v_data["status"] == "verified"
    assert v_data["admin_notes"] == "All checks cleared."

    # Verify user was upgraded
    users_res = db_client.get(
        "/api/v1/admin/users",
        headers={"X-Test-User-Id": "admin-plan-test"},
    )
    reader_record = next(u for u in users_res.get_json()["users"] if u["id"] == plan_test_env["reader_id"])
    assert reader_record["plan_tier"] == "scholar"

    # 3. Check subscriber metrics
    sub_res = db_client.get(
        "/api/v1/admin/subscribers",
        headers={"X-Test-User-Id": "admin-plan-test"},
    )
    assert sub_res.status_code == 200
    sub_data = sub_res.get_json()
    assert sub_data["verified_transactions"] >= 1
    assert sub_data["mrr"] >= 20.0

