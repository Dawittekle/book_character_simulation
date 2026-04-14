import logging

from flask import Flask
from flask_cors import CORS

from .api.routes import api_blueprint
from .config import Settings
from .db.session import DatabaseManager
from .repositories.chroma import (
    ChromaCharacterRepository,
    ChromaFactualMemoryRepository,
    ChromaSessionRepository,
)
from .services.character_service import CharacterService
from .services.chat_service import ChatService
from .services.relational_persistence_service import RelationalPersistenceService


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
    database_manager = DatabaseManager(resolved_settings)
    if resolved_settings.auto_create_relational_schema and database_manager.is_configured:
        database_manager.create_schema()

    character_repository = ChromaCharacterRepository(resolved_settings.chroma_db_path)
    session_repository = ChromaSessionRepository(resolved_settings.chroma_db_path)
    factual_memory_repository = ChromaFactualMemoryRepository(
        resolved_settings.chroma_db_path
    )
    relational_persistence_service = RelationalPersistenceService(database_manager)

    app.extensions["services"] = {
        "character_service": CharacterService(
            settings=resolved_settings,
            character_repository=character_repository,
            relational_persistence_service=relational_persistence_service,
        ),
        "chat_service": ChatService(
            settings=resolved_settings,
            character_repository=character_repository,
            session_repository=session_repository,
            factual_memory_repository=factual_memory_repository,
            relational_persistence_service=relational_persistence_service,
        ),
    }
    app.extensions["database_manager"] = database_manager

    app.register_blueprint(api_blueprint)
    return app
