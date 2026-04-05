import logging

from flask import Flask
from flask_cors import CORS

from .api.routes import api_blueprint
from .config import Settings
from .repositories.chroma import (
    ChromaCharacterRepository,
    ChromaFactualMemoryRepository,
    ChromaSessionRepository,
)
from .services.character_service import CharacterService
from .services.chat_service import ChatService


def configure_logging(debug: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if debug else logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )


def create_app(settings: Settings | None = None) -> Flask:
    resolved_settings = settings or Settings.from_env()
    configure_logging(resolved_settings.debug)

    app = Flask(__name__)
    app.config["SETTINGS"] = resolved_settings
    CORS(app, resources={r"/api/*": {"origins": resolved_settings.cors_origins}})

    character_repository = ChromaCharacterRepository(resolved_settings.chroma_db_path)
    session_repository = ChromaSessionRepository(resolved_settings.chroma_db_path)
    factual_memory_repository = ChromaFactualMemoryRepository(
        resolved_settings.chroma_db_path
    )

    app.extensions["services"] = {
        "character_service": CharacterService(
            settings=resolved_settings,
            character_repository=character_repository,
        ),
        "chat_service": ChatService(
            settings=resolved_settings,
            character_repository=character_repository,
            session_repository=session_repository,
            factual_memory_repository=factual_memory_repository,
        ),
    }

    app.register_blueprint(api_blueprint)
    return app
