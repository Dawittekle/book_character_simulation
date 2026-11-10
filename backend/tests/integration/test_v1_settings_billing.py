from __future__ import annotations

from flask.testing import FlaskClient
from sqlalchemy import select

from book_character_simulation_backend.db.models import (
    Book,
    BookProcessingStatus,
    ChatMessage,
    ChatRole,
    ChatSession,
    MembershipPlan,
    PaymentTransaction,
    UserAccount,
    VoiceUsageLog,
)


def test_user_subscription_and_billing_endpoint(db_client: FlaskClient):
    headers = {"X-Test-User-Id": "billing-test-user-1"}

    # 1. Initial GET /me/subscription for default user -> free tier
    res = db_client.get("/api/v1/me/subscription", headers=headers)
    assert res.status_code == 200
    data = res.get_json()

    assert "subscription" in data
    assert "usage" in data
    assert "payment_method" in data
    assert "invoices" in data

    sub = data["subscription"]
    assert sub["plan_slug"] in ("free", "scholar", "standard")
    assert sub["status"] == "active"
    assert "features" in sub

    usage = data["usage"]
    assert "books" in usage
    assert "daily_messages" in usage
    assert "voice_minutes" in usage
    assert usage["books"]["used"] == 0
    assert usage["daily_messages"]["used"] == 0
    assert usage["voice_minutes"]["used"] == 0.0


def test_user_subscription_with_verified_payment_and_usage(db_client: FlaskClient):
    app = db_client.application
    db = app.extensions["database_manager"]

    headers = {"X-Test-User-Id": "billing-test-user-2"}

    # Initialize user via /me
    me_res = db_client.get("/api/v1/me", headers=headers)
    assert me_res.status_code == 200
    user_db_id = me_res.get_json()["id"]

    with db.session_scope() as session:
        # Create a book owned by this user
        book = Book(
            owner_user_id=user_db_id,
            title="Emma",
            author="Jane Austen",
            original_language="en",
            processing_status=BookProcessingStatus.ready,
        )
        session.add(book)

        # Create a verified payment transaction
        pay = PaymentTransaction(
            user_id=user_db_id,
            plan_slug="scholar",
            amount=12.0,
            currency="USD",
            payment_method="credit_card",
            payment_details={
                "card_brand": "Visa",
                "last4": "4242",
                "expiry": "12/2030",
            },
            status="verified",
        )
        session.add(pay)

        # Create voice usage log
        voice_log = VoiceUsageLog(
            user_id=user_db_id,
            stt_audio_seconds=180.0,  # 3.0 minutes
        )
        session.add(voice_log)
        session.flush()

    # Query /me/subscription
    res = db_client.get("/api/v1/me/subscription", headers=headers)
    assert res.status_code == 200
    sub_data = res.get_json()

    assert sub_data["subscription"]["plan_slug"] == "scholar"
    assert sub_data["subscription"]["is_paid"] is True

    # Quota verification
    assert sub_data["usage"]["books"]["used"] >= 1
    assert sub_data["usage"]["voice_minutes"]["used"] >= 3.0

    # Payment details verification
    assert sub_data["payment_method"]["brand"] == "Visa"
    assert sub_data["payment_method"]["last4"] == "4242"

    # Invoices verification
    invoices = sub_data["invoices"]
    assert len(invoices) >= 1
    assert invoices[0]["status"] == "Paid"
    assert invoices[0]["amount"] == 12.0
    assert "INV-" in invoices[0]["invoice_number"]
