from __future__ import annotations

import base64
import io
import logging
import uuid
from pathlib import Path

from flask import Blueprint, current_app, jsonify, redirect, request, send_file

from ...auth import AuthenticatedUser
from ...errors import AppError, BadRequestError, NotFoundError, UnauthorizedError
from ...services.lorely_service import LorelyService
from ...voice.realtime_benchmark import RealtimeVoiceBenchmark

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

    # The test identity header is a test-only shortcut. Never accept it in
    # deployed environments, otherwise any caller could impersonate any user.
    settings = current_app.config.get("SETTINGS")
    allow_test_identity = getattr(settings, "app_env", "development") in {"testing", "test"}
    if test_user_id and allow_test_identity:
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
    return jsonify(
        service.update_me(
            user,
            display_name=body.get("display_name"),
            avatar_url=body.get("avatar_url"),
            full_name=body.get("full_name"),
            preferred_language=body.get("preferred_language"),
        )
    )


@v1_blueprint.route("/me/avatar", methods=["POST"])
def upload_avatar():
    user = _authenticated_user()
    service = _lorely_service()

    file_bytes = None
    filename = None

    if request.files:
        file_obj = request.files.get("avatar") or request.files.get("file")
        if file_obj:
            filename = file_obj.filename
            file_bytes = file_obj.read()

    if not file_bytes:
        file_bytes = request.get_data()

    if not file_bytes:
        raise BadRequestError("No avatar image file was provided in the request.")

    result = service.upload_user_avatar(user, file_bytes, filename=filename)
    return jsonify(result), 200


@v1_blueprint.route("/me/avatar", methods=["DELETE"])
def delete_avatar():
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify(service.delete_user_avatar(user)), 200


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


@v1_blueprint.route("/me/subscription", methods=["GET"])
def get_my_subscription():
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify(service.get_my_subscription(user)), 200


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
        raw_text = body.get("text") or body.get("raw_text") or request.form.get("text") or request.form.get("raw_text")
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

    async_mode = bool(body.get("async") or body.get("async_mode") or request.args.get("async"))
    result = service.ingest_source(
        user,
        temp_source_id=temp_source_id,
        title=body.get("title"),
        author=body.get("author"),
        visibility=body.get("visibility", "private"),
        force_extraction=bool(body.get("force_extraction", False)),
        llm_provider=body.get("llm_provider"),
        async_mode=async_mode,
    )
    status_code = 202 if async_mode else 201
    return jsonify(result), status_code


@v1_blueprint.route("/jobs/<job_id>", methods=["GET"])
def get_job_status(job_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify(service.get_job_status(user, job_id))


@v1_blueprint.route("/books", methods=["GET"])
def list_books():
    user = _optional_authenticated_user()
    service = _lorely_service()
    scope = request.args.get("scope")
    return jsonify({"books": service.list_books(user, scope=scope)})


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
        extracted_text=body.get("text") or body.get("extracted_text"),
        original_language=body.get("original_language", "en"),
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


@v1_blueprint.route("/books/<book_id>/download", methods=["GET"])
def download_book(book_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    info = service.get_book_download(user, book_id)
    if info.get("url"):
        return redirect(info["url"])
    return send_file(
        io.BytesIO(info["content"]),
        mimetype=info.get("mime_type", "application/octet-stream"),
        as_attachment=True,
        download_name=info.get("filename", "book.txt"),
    )


@v1_blueprint.route("/reader/books/<book_id>/access", methods=["GET"])
def get_reader_access(book_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify(service.get_reader_book_access(user, book_id))


@v1_blueprint.route("/reader/books/<book_id>/chapters", methods=["GET"])
def get_reader_chapters(book_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify({"chapters": service.get_reader_book_chapters(user, book_id)})


@v1_blueprint.route("/reader/books/<book_id>/progress", methods=["GET"])
def get_reader_progress(book_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify(service.get_reading_progress(user, book_id))


@v1_blueprint.route("/reader/books/<book_id>/progress", methods=["PUT"])
def update_reader_progress(book_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    data = request.get_json(silent=True) or {}
    return jsonify(service.update_reading_progress(user, book_id, data))


@v1_blueprint.route("/reader/books/<book_id>/narration/<int:chapter_index>", methods=["GET"])
def get_reader_chapter_narration(book_id: str, chapter_index: int):
    user = _optional_authenticated_user()
    service = _lorely_service()
    voice_id = request.args.get("voice_id", "nova")
    try:
        speed = float(request.args.get("speed", "1.0"))
    except ValueError:
        speed = 1.0
    return jsonify(
        service.get_chapter_narration(
            user, book_id, chapter_index, voice_id=voice_id, speed=speed
        )
    )


@v1_blueprint.route("/reader/books/<book_id>/raw", methods=["GET"])
def stream_reader_raw_book(book_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    info = service.get_reader_raw_source(user, book_id)
    return send_file(
        io.BytesIO(info["content"]),
        mimetype=info.get("mime_type", "application/octet-stream"),
        as_attachment=False,
        download_name=info.get("filename", "book.bin"),
    )


@v1_blueprint.route("/reader/storage-proxy/<path:storage_key>", methods=["GET"])
def get_reader_storage_proxy(storage_key: str):
    service = _lorely_service()
    data = service.storage_service.download_file(storage_key)
    if data is None:
        raise NotFoundError("Stored asset not found.")
    filename = storage_key.rsplit("/", 1)[-1].lower()
    if filename.endswith(".epub"):
        mimetype = "application/epub+zip"
    elif filename.endswith(".pdf"):
        mimetype = "application/pdf"
    elif filename.endswith(".mp3"):
        mimetype = "audio/mpeg"
    elif filename.endswith(".wav"):
        mimetype = "audio/wav"
    elif filename.endswith(".txt"):
        mimetype = "text/plain; charset=utf-8"
    else:
        mimetype = "application/octet-stream"

    return send_file(
        io.BytesIO(data),
        mimetype=mimetype,
        as_attachment=False,
        download_name=filename,
    )


# --- Phase 5: Bookmarks, Annotations & Contextual Reader Chat ---

@v1_blueprint.route("/reader/books/<book_id>/bookmarks", methods=["GET"])
def get_reader_bookmarks(book_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify({"bookmarks": service.list_reader_bookmarks(user, book_id)})


@v1_blueprint.route("/reader/books/<book_id>/bookmarks", methods=["POST"])
def create_reader_bookmark(book_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    data = request.get_json(silent=True) or {}
    return jsonify({"bookmark": service.create_reader_bookmark(user, book_id, data)}), 201


@v1_blueprint.route("/reader/books/<book_id>/bookmarks/<bookmark_id>", methods=["DELETE"])
def delete_reader_bookmark(book_id: str, bookmark_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify(service.delete_reader_bookmark(user, book_id, bookmark_id)), 200


@v1_blueprint.route("/reader/books/<book_id>/annotations", methods=["GET"])
def get_reader_annotations(book_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    return jsonify({"annotations": service.list_reader_annotations(user, book_id)})


@v1_blueprint.route("/reader/books/<book_id>/annotations", methods=["POST"])
def create_reader_annotation(book_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    data = request.get_json(silent=True) or {}
    return jsonify({"annotation": service.create_reader_annotation(user, book_id, data)}), 201


@v1_blueprint.route("/reader/books/<book_id>/annotations/<annotation_id>", methods=["DELETE"])
def delete_reader_annotation(book_id: str, annotation_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify(service.delete_reader_annotation(user, book_id, annotation_id)), 200


@v1_blueprint.route("/reader/books/<book_id>/contextual-chat", methods=["POST"])
def reader_contextual_chat(book_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    data = request.get_json(silent=True) or {}
    character_id = data.get("character_id")
    if not character_id:
        raise BadRequestError("character_id is required.")
    passage_quote = (data.get("passage_quote") or "").strip()
    user_message = (data.get("user_message") or data.get("content") or "").strip()
    if not user_message:
        raise BadRequestError("user_message is required.")
    chapter_index = int(data.get("chapter_index", 1))
    session_id = data.get("session_id")
    conversation_language = data.get("conversation_language", "en")
    llm_provider = data.get("llm_provider")

    result = service.create_contextual_turn(
        user,
        book_id,
        character_id=character_id,
        passage_quote=passage_quote,
        user_message=user_message,
        chapter_index=chapter_index,
        session_id=session_id,
        conversation_language=conversation_language,
        llm_provider=llm_provider,
    )
    return jsonify(result), 201


@v1_blueprint.route("/storage/<path:storage_key>", methods=["GET"])
def get_stored_file(storage_key: str):
    service = _lorely_service()
    data = service.storage_service.download_file(storage_key)
    if data is None:
        raise NotFoundError("Stored object not found.")
    filename = storage_key.rsplit("/", 1)[-1]
    return send_file(
        io.BytesIO(data),
        download_name=filename,
    )


@v1_blueprint.route("/storage/presigned-upload", methods=["POST"])
def get_presigned_upload_url():
    user = _authenticated_user()
    service = _lorely_service()
    payload = request.get_json(silent=True) or {}
    filename = payload.get("filename")
    if not filename or not isinstance(filename, str):
        raise BadRequestError("Filename is required for presigned upload.")

    safe_name = Path(filename).name.strip()
    if not safe_name or ".." in safe_name:
        raise BadRequestError("Invalid filename.")

    allowed_exts = {".pdf", ".epub", ".txt", ".json", ".jpg", ".jpeg", ".png", ".webp"}
    ext = Path(safe_name).suffix.lower()
    if ext not in allowed_exts:
        raise BadRequestError(f"Unsupported file extension: {ext}")

    content_type = payload.get("content_type")
    book_id = payload.get("book_id")
    upload_id = uuid.uuid4().hex[:12]

    upload_user_id = getattr(user, "user_id", None) or getattr(user, "id", "anonymous")
    if book_id:
        storage_key = f"books/{book_id}/sources/{upload_id}_{safe_name}"
    else:
        storage_key = f"uploads/{upload_user_id}/{upload_id}_{safe_name}"

    upload_info = service.storage_service.generate_presigned_upload_url(
        key=storage_key,
        content_type=content_type,
        expires_in=payload.get("expires_in", 3600),
    )
    return jsonify(upload_info), 200


@v1_blueprint.route("/storage/upload/<path:storage_key>", methods=["POST", "PUT"])
def receive_direct_upload(storage_key: str):
    """Local dev/test direct upload receiver when storage is in local mode."""
    service = _lorely_service()
    data = request.get_data()
    if not data and request.files:
        uploaded_file = next(iter(request.files.values()))
        data = uploaded_file.read()
    if not data:
        raise BadRequestError("No binary data received.")
    saved_key = service.storage_service.upload_file(
        key=storage_key,
        data=data,
        content_type=request.content_type,
    )
    return jsonify({"key": saved_key, "bytes_written": len(data), "status": "uploaded"}), 201


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


@v1_blueprint.route("/characters/<character_id>/memories/<memory_id>", methods=["DELETE"])
def delete_character_memory(character_id: str, memory_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    service.delete_character_memory(user, character_id, memory_id)
    return jsonify({"status": "deleted"}), 200


@v1_blueprint.route("/characters/<character_id>/memories/<memory_id>", methods=["PATCH"])
def update_character_memory(character_id: str, memory_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    fact = body.get("fact") or ""
    updated = service.update_character_memory(user, character_id, memory_id, fact)
    return jsonify({"memory": updated}), 200


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
        reading_progress_chapter=int(body.get("reading_progress_chapter", 1)),
        conversation_language=body.get("conversation_language", "en"),
        voice_override=body.get("voice_override"),
    )
    return jsonify(session_data), 201


@v1_blueprint.route("/characters/<character_id>/state-events", methods=["GET"])
def get_character_state_events(character_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    limit = request.args.get("limit", default=50, type=int)
    events = service.list_character_state_events(user, character_id, limit=limit)
    return jsonify({"character_id": character_id, "events": events}), 200


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


@v1_blueprint.route("/conversations/<session_id>", methods=["PATCH"])
def patch_conversation(session_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    res = service.update_conversation(
        user,
        session_id,
        title=body.get("title"),
        spoiler_policy=body.get("spoiler_policy"),
        reading_progress_chapter=body.get("reading_progress_chapter"),
        conversation_language=body.get("conversation_language"),
        voice_override=body.get("voice_override"),
    )
    return jsonify(res), 200


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
        reading_progress_chapter=body.get("reading_progress_chapter"),
        conversation_language=body.get("conversation_language"),
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
        conditional=True,
    )


@v1_blueprint.route("/conversations/<session_id>/voice-turn", methods=["POST"])
def conversation_voice_turn(session_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()

    speech_text = None
    audio_bytes = None
    filename = "speech.wav"
    llm_provider = None
    conversation_language = None

    reading_progress_chapter = None
    if request.is_json:
        body = request.get_json(silent=True) or {}
        speech_text = body.get("speech_text") or body.get("content")
        reading_progress_chapter = body.get("reading_progress_chapter")
        conversation_language = body.get("conversation_language")
        raw_b64 = body.get("audio_base64")
        if raw_b64:
            try:
                audio_bytes = base64.b64decode(raw_b64)
            except Exception as exc:
                raise BadRequestError(f"Invalid base64 audio payload: {exc}")
        llm_provider = body.get("llm_provider")
    elif request.files:
        speech_text = request.form.get("speech_text")
        reading_progress_chapter = request.form.get("reading_progress_chapter")
        conversation_language = request.form.get("conversation_language")
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
        reading_progress_chapter=int(reading_progress_chapter) if reading_progress_chapter is not None else None,
        conversation_language=conversation_language,
    )
    return jsonify(result), 200


@v1_blueprint.route("/conversations/<session_id>/interrupt", methods=["POST"])
def interrupt_conversation(session_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    result = service.interrupt_conversation(user, session_id)
    return jsonify(result), 200


@v1_blueprint.route("/voices", methods=["GET"])
def list_voices():
    user = _optional_authenticated_user()
    service = _lorely_service()
    provider = request.args.get("provider")
    gender = request.args.get("gender")
    language = request.args.get("language")
    voices = service.list_voices(user, provider=provider, gender=gender, language=language)
    return jsonify({"voices": voices}), 200


@v1_blueprint.route("/voices/<voice_id>/preview", methods=["GET"])
def get_voice_preview(voice_id: str):
    service = _lorely_service()
    audio_bytes, mime_type, _ = service.get_voice_preview(voice_id)
    return send_file(
        io.BytesIO(audio_bytes),
        mimetype=mime_type,
        as_attachment=False,
        download_name=f"preview_{voice_id}.wav",
        conditional=True,
    )


@v1_blueprint.route("/characters/<character_id>/matched-voice", methods=["GET"])
def get_character_matched_voice(character_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    language = request.args.get("language", "en")
    result = service.get_matched_voice(user, character_id, language=language)
    return jsonify(result), 200


@v1_blueprint.route("/me/voice-usage", methods=["GET"])
def get_my_voice_usage():
    user = _authenticated_user()
    service = _lorely_service()
    usage = service.get_user_voice_usage(user)
    return jsonify(usage), 200


# --- Phase 6: Real-time Voice (WebRTC Ephemeral Session & Controlled Tool Delegation) ---

@v1_blueprint.route("/conversations/<session_id>/realtime-session", methods=["POST"])
def create_realtime_session(session_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    session_data = service.create_realtime_session(
        user, session_id, voice_override=body.get("voice_override")
    )
    return jsonify(session_data), 200


@v1_blueprint.route("/conversations/<session_id>/realtime-tool-call", methods=["POST"])
def execute_realtime_tool_call(session_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    reader_message = body.get("reader_message") or body.get("message")
    if not reader_message:
        raise BadRequestError("reader_message parameter is required for controlled tool delegation.")
    result = service.execute_realtime_tool_call(user, session_id, reader_message=reader_message)
    return jsonify(result), 200


@v1_blueprint.route("/voice/benchmark", methods=["GET"])
def get_voice_benchmark():
    stage_a = RealtimeVoiceBenchmark.evaluate_stage_a()
    stage_b = RealtimeVoiceBenchmark.evaluate_stage_b()
    return jsonify({"stage_a": stage_a, "stage_b": stage_b}), 200


# --- Phase 7: Reusable Character Avatar Library ---

@v1_blueprint.route("/avatars", methods=["GET"])
def list_avatars():
    service = _lorely_service()
    gender = request.args.get("gender")
    art_style = request.args.get("art_style")
    period_era = request.args.get("period_era")
    avatars = service.list_avatars(gender=gender, art_style=art_style, period_era=period_era)
    return jsonify({"avatars": avatars}), 200


@v1_blueprint.route("/characters/<character_id>/matched-avatar", methods=["GET"])
def get_character_matched_avatar(character_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    result = service.get_matched_avatar(user, character_id)
    return jsonify(result), 200


@v1_blueprint.route("/characters/<character_id>/avatar", methods=["PATCH"])
def patch_character_avatar(character_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    avatar_asset_id = body.get("avatar_asset_id")
    if not avatar_asset_id:
        raise BadRequestError("avatar_asset_id is required.")
    result = service.update_character_avatar(user, character_id, avatar_asset_id=avatar_asset_id)
    return jsonify(result), 200


# --- Phase 7: Featured Public Catalogue & Library Separation ---

@v1_blueprint.route("/catalog/featured", methods=["GET"])
def list_featured_catalog():
    user = _optional_authenticated_user()
    service = _lorely_service()
    language = request.args.get("language")
    genre = request.args.get("genre")
    books = service.list_featured_catalog(user, language=language, genre=genre)
    return jsonify({"books": books}), 200


@v1_blueprint.route("/catalog/books/<book_id>/add-to-library", methods=["POST"])
def add_catalog_book_to_library(book_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    progress = int(body.get("reading_progress_chapter", 1))
    result = service.add_catalog_book_to_library(user, book_id, reading_progress_chapter=progress)
    return jsonify(result), 201


@v1_blueprint.route("/admin/books/<book_id>/publish", methods=["PATCH"])
def admin_publish_catalog_book(book_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    result = service.admin_publish_catalog_book(
        user,
        book_id,
        edition_notes=body.get("edition_notes"),
        rights_basis=body.get("rights_basis"),
        file_provenance=body.get("file_provenance"),
        cover_art_licence=body.get("cover_art_licence"),
    )
    return jsonify(result), 200


# --- Phase 7: Account Data Export & Deletion (GDPR & Privacy Compliance) ---

@v1_blueprint.route("/me/export", methods=["GET"])
def export_my_account_data():
    user = _authenticated_user()
    service = _lorely_service()
    data = service.export_user_account_data(user)
    return jsonify(data), 200


@v1_blueprint.route("/me", methods=["DELETE"])
def delete_my_account():
    user = _authenticated_user()
    service = _lorely_service()
    result = service.delete_user_account(user)
    return jsonify(result), 200


@v1_blueprint.route("/conversations/<session_id>", methods=["DELETE"])
def delete_conversation(session_id: str):
    user = _optional_authenticated_user()
    service = _lorely_service()
    service.delete_conversation(user, session_id)
    return jsonify({"message": "Conversation deleted successfully."}), 200


@v1_blueprint.route("/workspaces/migrate-legacy", methods=["POST"])
def migrate_legacy_workspace():
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    result = service.migrate_legacy_workspace(user, body)
    return jsonify(result), 200


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


@v1_blueprint.route("/payments/submit", methods=["POST"])
def submit_payment():
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    return jsonify(service.submit_payment(user, body)), 201


@v1_blueprint.route("/payments/config", methods=["GET"])
def get_payment_config():
    service = _lorely_service()
    return jsonify(service.get_payment_config()), 200


@v1_blueprint.route("/admin/payments/config", methods=["GET", "PUT", "PATCH"])
def admin_payment_config():
    user = _authenticated_user()
    service = _lorely_service()
    if request.method == "GET":
        return jsonify(service.get_payment_config()), 200
    body = request.get_json(silent=True) or {}
    return jsonify(service.admin_update_payment_config(user, body)), 200


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


@v1_blueprint.route("/admin/payments", methods=["GET"])
def admin_list_payments():
    user = _authenticated_user()
    service = _lorely_service()
    status_filter = request.args.get("status")
    return jsonify({"payments": service.admin_list_payments(user, status_filter=status_filter)}), 200


@v1_blueprint.route("/admin/payments/<payment_id>/verify", methods=["POST"])
def admin_verify_payment(payment_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    notes = body.get("admin_notes")
    return jsonify(service.admin_verify_payment(user, payment_id, admin_notes=notes)), 200


@v1_blueprint.route("/admin/payments/<payment_id>/reject", methods=["POST"])
def admin_reject_payment(payment_id: str):
    user = _authenticated_user()
    service = _lorely_service()
    body = request.get_json(silent=True) or {}
    notes = body.get("admin_notes")
    return jsonify(service.admin_reject_payment(user, payment_id, admin_notes=notes)), 200


@v1_blueprint.route("/admin/subscribers", methods=["GET"])
def admin_get_subscribers():
    user = _authenticated_user()
    service = _lorely_service()
    return jsonify(service.admin_get_subscriber_metrics(user)), 200


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



