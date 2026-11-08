from __future__ import annotations

import logging

from flask import Blueprint, current_app, jsonify, request

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


# --- Books ---

@v1_blueprint.route("/books", methods=["GET"])
def list_books():
    user = _authenticated_user()
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
    user = _authenticated_user()
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
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify({"characters": service.list_characters(user, book_id)})


# --- Characters ---

@v1_blueprint.route("/characters/<character_id>", methods=["GET"])
def get_character_dossier(character_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify(service.get_character_dossier(user, character_id))


@v1_blueprint.route("/characters/<character_id>/state", methods=["GET"])
def get_character_state(character_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify(service.get_character_state(user, character_id))


@v1_blueprint.route("/characters/<character_id>/reset-state", methods=["POST"])
def reset_character_state(character_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify(service.reset_character_state(user, character_id))


@v1_blueprint.route("/characters/<character_id>/memories", methods=["GET"])
def get_character_memories(character_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify({"memories": service.get_character_memories(user, character_id)})


@v1_blueprint.route("/characters/<character_id>/conversations", methods=["POST"])
def create_character_conversation(character_id: str):
    user = _authenticated_user()
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
    user = _authenticated_user()
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
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify({"messages": service.get_conversation_messages(user, session_id)})


@v1_blueprint.route("/conversations/<session_id>/messages", methods=["POST"])
def send_conversation_message(session_id: str):
    user = _authenticated_user()
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


@v1_blueprint.route("/conversations/<session_id>", methods=["DELETE"])
def delete_conversation(session_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    service.delete_conversation(user, session_id)
    return jsonify({"message": "Conversation deleted successfully."}), 200
