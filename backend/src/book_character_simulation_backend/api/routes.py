from __future__ import annotations

import hashlib
import logging

from flask import Blueprint, current_app, jsonify, request

from ..errors import AppError, BadRequestError
from ..utils.pdf import extract_text_from_pdf

logger = logging.getLogger(__name__)

api_blueprint = Blueprint("api", __name__, url_prefix="/api")


def _services() -> dict:
    return current_app.extensions["services"]


def _database_manager():
    return current_app.extensions["database_manager"]


@api_blueprint.route("/health", methods=["GET"])
def health_check():
    settings = current_app.config["SETTINGS"]
    database_manager = _database_manager()
    enabled_providers = [
        provider
        for provider, key in {
            "openai": settings.openai_api_key,
            "gemini": settings.gemini_api_key,
        }.items()
        if key
    ]
    return jsonify(
        {
            "status": "ok",
            "environment": settings.app_env,
            "default_provider": settings.llm_provider,
            "configured_provider_ready": settings.llm_provider in enabled_providers,
            "enabled_providers": enabled_providers,
            "database_configured": database_manager.is_configured,
            "database_connected": database_manager.check_connection()
            if database_manager.is_configured
            else False,
            "supabase_configured": bool(
                settings.supabase_url and settings.supabase_anon_key
            ),
        }
    )


@api_blueprint.route("/extract-characters", methods=["POST"])
def extract_characters():
    try:
        text = ""
        llm_provider = request.form.get("llm_provider")

        if "file" in request.files:
            uploaded_file = request.files["file"]
            if not uploaded_file.filename or not uploaded_file.filename.lower().endswith(
                ".pdf"
            ):
                raise BadRequestError("Invalid file type. Only PDFs are allowed.")
            text = extract_text_from_pdf(uploaded_file)
        else:
            text = (request.form.get("text") or "").strip()

        if not text:
            raise BadRequestError("No text provided.")

        text_id = hashlib.sha256(text.encode("utf-8")).hexdigest()
        characters = _services()["character_service"].extract_characters(
            text_id=text_id,
            text=text,
            llm_provider=llm_provider,
        )

        result = [{**character.model_dump(), "text_id": text_id} for character in characters]
        return jsonify(result)
    except AppError as exc:
        return jsonify({"error": exc.message}), exc.status_code
    except Exception as exc:
        logger.exception("Character extraction failed: %s", exc)
        return jsonify({"error": "An error occurred during character extraction."}), 500


@api_blueprint.route("/chat/<character_id>", methods=["POST"])
def chat_with_character(character_id: str):
    try:
        user_message = (request.form.get("message") or "").strip()
        text_id = (request.form.get("text_id") or "").strip()
        session_id = (request.form.get("session_id") or "").strip() or None
        llm_provider = request.form.get("llm_provider")

        if not user_message:
            raise BadRequestError("No message provided.")
        if not text_id:
            raise BadRequestError("No text_id provided.")

        response_payload = _services()["chat_service"].chat(
            character_id=character_id,
            text_id=text_id,
            user_message=user_message,
            session_id=session_id,
            llm_provider=llm_provider,
        )

        return jsonify([response_payload.model_dump()])
    except AppError as exc:
        return jsonify({"error": exc.message}), exc.status_code
    except Exception as exc:
        logger.exception("Chat update failed: %s", exc)
        return jsonify({"error": "An error occurred during chat processing."}), 500
