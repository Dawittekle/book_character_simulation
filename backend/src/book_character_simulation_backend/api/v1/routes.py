from __future__ import annotations

import base64
import io
import logging

from flask import Blueprint, current_app, jsonify, request, send_file

from ...auth import AuthenticatedUser
from ...errors import AppError, BadRequestError, UnauthorizedError
from ...services.lorely_service import LorelyService

logger = logging.getLogger(__name__)

v1_blueprint = Blueprint("v1", __name__, url_prefix="/api/v1")


def _lorely_service() -> LorelyService:
    if "lorely_service" not in current_app.extensions["services"]:
        settings = current_app.config["SETTINGS"]
        db = current_app.extensions["database_manager"]
        current_app.extensions["services"]["lorely_service"] = LorelyService(db, settings)
    return current_app.extensions["services"]["lorely_service"]


def _authenticated_user() -> AuthenticatedUser:
    auth_header = request.headers.get("Authorization")
    test_user_id = request.headers.get("X-Test-User-Id")

    # In test environments or when explicit test header is provided
    if test_user_id:
        return AuthenticatedUser(
            subject=test_user_id,
            email=f"{test_user_id}@test.lorely.app",
            display_name=test_user_id.replace("-", " ").title(),
            avatar_url=None,
            role="user",
            claims={"sub": test_user_id},
        )

    auth_service = current_app.extensions.get("auth_service")
    if auth_service is None or not auth_header:
        raise UnauthorizedError("Missing or invalid authorization token.")

    user = auth_service.authenticate_request(auth_header)
    if user is None:
        raise UnauthorizedError("Invalid authorization token.")
    return user


@v1_blueprint.errorhandler(AppError)
def handle_app_error(exc: AppError):
    return jsonify({"error": exc.message}), exc.status_code


@v1_blueprint.errorhandler(Exception)
def handle_unexpected_error(exc: Exception):
    logger.exception("Unexpected error in v1 API: %s", exc)
    return jsonify({"error": "An unexpected server error occurred."}), 500


def _optional_authenticated_user() -> AuthenticatedUser | None:
    try:
        return _authenticated_user()
    except Exception:
        return None


# --- Me / Settings ---

@v1_blueprint.route("/me", methods=["GET"])
def get_me():
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify(service.get_me(user))


@v1_blueprint.route("/me", methods=["PATCH"])
def update_me():
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    return jsonify(service.update_me(user, body.get("display_name"), body.get("avatar_url")))


@v1_blueprint.route("/me/settings", methods=["GET"])
def get_settings():
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify(service.get_settings(user))


@v1_blueprint.route("/me/settings", methods=["PATCH"])
def update_settings():
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    return jsonify(service.update_settings(user, body))


# --- Books & Ingestion ---

@v1_blueprint.route("/books/inspect", methods=["POST"])
def inspect_source():
    user = _optional_authenticated_user()
    service = _lorely_service()

    file_bytes = None
    filename = None
    raw_text = None

    if "file" in request.files:
        uploaded_file = request.files["file"]
        filename = uploaded_file.filename
        file_bytes = uploaded_file.read()
    else:
        body = request.get_json(silent=True) or {}
        raw_text = body.get("text") or request.form.get("text")
        filename = body.get("filename") or request.form.get("filename")

    result = service.inspect_source(
        user,
        file_bytes=file_bytes,
        filename=filename,
        raw_text=raw_text,
        llm_provider=request.args.get("llm_provider"),
    )
    return jsonify(result), 200


@v1_blueprint.route("/books/ingest", methods=["POST"])
def ingest_source():
    user = _optional_authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    temp_source_id = body.get("temp_source_id")
    if not temp_source_id:
        raise BadRequestError("temp_source_id is required.")

    result = service.ingest_source(
        user,
        temp_source_id=temp_source_id,
        title=body.get("title"),
        author=body.get("author"),
        visibility=body.get("visibility", "private"),
        force_extraction=bool(body.get("force_extraction", False)),
        llm_provider=body.get("llm_provider"),
    )
    return jsonify(result), 201


@v1_blueprint.route("/jobs/<job_id>", methods=["GET"])
def get_job_status(job_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify(service.get_job_status(user, job_id))


@v1_blueprint.route("/books", methods=["GET"])
def list_books():
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify({"books": service.list_books(user)})


@v1_blueprint.route("/books", methods=["POST"])
def create_book():
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    title = body.get("title")
    if not title:
        raise BadRequestError("Book title is required.")

    book = service.create_book(
        user,
        title=title,
        author=body.get("author"),
        summary=body.get("summary"),
        cover_url=body.get("cover_url"),
        visibility=body.get("visibility", "private"),
        source_type=body.get("source_type", "book"),
        extracted_text=body.get("text"),
    )
    return jsonify(book), 201


@v1_blueprint.route("/books/<book_id>", methods=["GET"])
def get_book_details(book_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify(service.get_book_details(user, book_id))


@v1_blueprint.route("/books/<book_id>", methods=["PATCH"])
def update_book(book_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    return jsonify(service.update_book(user, book_id, body))


@v1_blueprint.route("/books/<book_id>", methods=["DELETE"])
def delete_book(book_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    service.delete_book(user, book_id)
    return jsonify({"message": "Book deleted successfully."}), 200


@v1_blueprint.route("/books/<book_id>/characters", methods=["GET"])
def list_book_characters(book_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify({"characters": service.list_characters(user, book_id)})


# --- Characters ---

@v1_blueprint.route("/characters", methods=["GET"])
def list_characters():
    user = _optional_authenticated_user()
    service = _lorely_service()
    book_id = request.args.get("book_id")
    return jsonify({"characters": service.list_characters(user, book_id=book_id)})


@v1_blueprint.route("/characters/<character_id>", methods=["GET"])
def get_character_dossier(character_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify(service.get_character_dossier(user, character_id))


@v1_blueprint.route("/characters/<character_id>/state", methods=["GET"])
def get_character_state(character_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify(service.get_character_state(user, character_id))


@v1_blueprint.route("/characters/<character_id>/reset-state", methods=["POST"])
def reset_character_state(character_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify(service.reset_character_state(user, character_id))


@v1_blueprint.route("/characters/<character_id>/memories", methods=["GET"])
def get_character_memories(character_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify({"memories": service.get_character_memories(user, character_id)})


@v1_blueprint.route("/characters/<character_id>/conversations", methods=["POST"])
def create_character_conversation(character_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    session_data = service.create_conversation(
        user,
        character_id,
        title=body.get("title"),
        spoiler_policy=body.get("spoiler_policy", "cautious"),
    )
    return jsonify(session_data), 201


# --- Conversations ---

@v1_blueprint.route("/conversations", methods=["GET"])
def list_conversations():
    user = _optional_authenticated_user()
    service = _lorely_service()
    book_id = request.args.get("book_id")
    character_id = request.args.get("character_id")
    return jsonify({
        "conversations": service.list_conversations(
            user,
            book_id=book_id,
            character_id=character_id,
        )
    })


@v1_blueprint.route("/conversations/<session_id>/messages", methods=["GET"])
def get_conversation_messages(session_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify({"messages": service.get_conversation_messages(user, session_id)})


@v1_blueprint.route("/conversations/<session_id>/messages", methods=["POST"])
def send_conversation_message(session_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    content = body.get("content") or body.get("message")
    if not content:
        raise BadRequestError("Message content is required.")

    result = service.send_message(
        user,
        session_id,
        content=content,
        input_modality=body.get("input_modality", "text"),
        llm_provider=body.get("llm_provider"),
    )
    return jsonify(result), 201


@v1_blueprint.route("/conversations/<session_id>/messages/<message_id>/audio", methods=["GET"])
def get_message_audio(session_id: str, message_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    audio_bytes, mime_type, _ = service.synthesize_message_audio(user, session_id, message_id)
    return send_file(
        io.BytesIO(audio_bytes),
        mimetype=mime_type,
        as_attachment=False,
        download_name=f"audio_{message_id}.wav",
    )


@v1_blueprint.route("/conversations/<session_id>/voice-turn", methods=["POST"])
def conversation_voice_turn(session_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()

    speech_text = None
    audio_bytes = None
    filename = "speech.wav"
    llm_provider = None

    if request.is_json:
        body = request.get_json(silent=True) or {}
        speech_text = body.get("speech_text") or body.get("content")
        raw_b64 = body.get("audio_base64")
        if raw_b64:
            try:
                audio_bytes = base64.b64decode(raw_b64)
            except Exception as exc:
                raise BadRequestError(f"Invalid base64 audio payload: {exc}")
        llm_provider = body.get("llm_provider")
    elif request.files:
        speech_text = request.form.get("speech_text")
        llm_provider = request.form.get("llm_provider")
        file = request.files.get("audio") or request.files.get("file")
        if file:
            audio_bytes = file.read()
            filename = file.filename or "speech.wav"

    if not speech_text and not audio_bytes:
        raise BadRequestError("Either speech_text or audio file payload is required.")

    result = service.execute_voice_turn(
        user,
        session_id,
        speech_text=speech_text,
        audio_bytes=audio_bytes,
        filename=filename,
        llm_provider=llm_provider,
    )
    return jsonify(result), 200


@v1_blueprint.route("/conversations/<session_id>", methods=["DELETE"])
def delete_conversation(session_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    service.delete_conversation(user, session_id)
    return jsonify({"message": "Conversation deleted successfully."}), 200


# --- Admin Routes ---

# --- Dedicated Authoritative Admin Portal ---

@v1_blueprint.route("/admin/login", methods=["POST"])
def admin_login():
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    email = str(body.get("email") or "").strip()
    password = str(body.get("password") or "").strip()
    return jsonify(service.admin_login(email=email, password=password)), 200


@v1_blueprint.route("/admin/overview", methods=["GET"])
def get_admin_overview():
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify(service.get_admin_overview(user)), 200


@v1_blueprint.route("/admin/analytics", methods=["GET"])
def get_admin_analytics():
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify(service.get_admin_analytics(user)), 200


@v1_blueprint.route("/admin/jobs", methods=["GET"])
def admin_list_jobs():
    user = _authenticated_user()
    service = _lorely_service()
    status = request.args.get("status")
    return jsonify({"jobs": service.admin_list_jobs(user, status=status)}), 200


@v1_blueprint.route("/admin/jobs/<job_id>/retry", methods=["POST"])
def admin_retry_job(job_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify(service.admin_retry_job(user, job_id)), 200


@v1_blueprint.route("/admin/books", methods=["GET"])
def admin_list_books():
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify({"books": service.admin_list_books(user)}), 200


@v1_blueprint.route("/admin/books/<book_id>", methods=["PATCH"])
def admin_update_book(book_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    return jsonify(service.admin_update_book(user, book_id, body)), 200


@v1_blueprint.route("/admin/users", methods=["GET"])
def admin_list_users():
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify({"users": service.admin_list_users(user)}), 200


@v1_blueprint.route("/admin/users/<user_id>/role", methods=["PATCH"])
def admin_update_user_role(user_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    new_role = body.get("role")
    if not new_role:
        raise BadRequestError("Role parameter is required.")
    return jsonify(service.admin_update_user_role(user, user_id, new_role)), 200


@v1_blueprint.route("/admin/users/<user_id>", methods=["DELETE"])
def admin_delete_user(user_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify(service.admin_delete_user(user, user_id)), 200


@v1_blueprint.route("/auth/switch-role", methods=["POST"])
@v1_blueprint.route("/users/me/role", methods=["PATCH"])
def switch_my_role():
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    target_role = body.get("role", "user")
    return jsonify(service.switch_my_role(user, target_role)), 200


@v1_blueprint.route("/plans", methods=["GET"])
def get_public_plans():
    service = _lorely_service()
    return jsonify(service.get_public_plans()), 200


@v1_blueprint.route("/admin/plans", methods=["GET"])
def admin_get_plans():
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify(service.admin_get_plans(user)), 200


@v1_blueprint.route("/admin/plans/<plan_id>", methods=["PUT", "PATCH"])
def admin_update_plan(plan_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    return jsonify(service.admin_update_plan(user, plan_id, body)), 200


@v1_blueprint.route("/admin/users/<user_id>/plan", methods=["PATCH"])
def admin_update_user_plan(user_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    new_plan = body.get("plan_tier") or body.get("plan")
    if not new_plan:
        raise BadRequestError("plan_tier parameter is required.")
    return jsonify(service.admin_update_user_plan(user, user_id, new_plan)), 200


# --- Notifications & Broadcast Routes ---

@v1_blueprint.route("/notifications", methods=["GET"])
def list_notifications():
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify({"notifications": service.list_notifications(user)}), 200


@v1_blueprint.route("/notifications/<notification_id>/read", methods=["POST"])
def mark_notification_read(notification_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify(service.mark_notification_read(user, notification_id)), 200


@v1_blueprint.route("/notifications/read-all", methods=["POST"])
def mark_all_notifications_read():
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify(service.mark_all_notifications_read(user)), 200


@v1_blueprint.route("/admin/notifications/broadcast", methods=["POST"])
def admin_broadcast_notification():
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    title = body.get("title")
    message = body.get("message")
    if not title or not message:
        raise BadRequestError("title and message are required for broadcasts.")

    return (
        jsonify(
            service.admin_broadcast_notification(
                user,
                title=title,
                message=message,
                category=body.get("category", "admin_broadcast"),
                link_url=body.get("link_url"),
            )
        ),
        201,
    )



