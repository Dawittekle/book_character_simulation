import logging

from flask import Flask
from flask_cors import CORS

from .api.routes import api_blueprint
from .api.v1.routes import v1_blueprint
from .auth import SupabaseAuthService
from .config import Settings
from .db.seeds import purge_demo_and_test_data, seed_dostoevsky_books, seed_membership_plans
from .db.session import DatabaseManager
from .repositories.chroma import (
    ChromaCharacterRepository,
    ChromaFactualMemoryRepository,
    ChromaSessionRepository,
)
from .services.character_service import CharacterService
from .services.chat_service import ChatService
from .services.lorely_service import LorelyService
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
    CORS(
        app,
        resources={r"/api/*": {"origins": resolved_settings.cors_origins}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-Test-User-Id", "Accept"],
        methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    )
    database_manager = DatabaseManager(resolved_settings)
    auth_service = SupabaseAuthService(resolved_settings)
    if database_manager.is_configured:
        database_manager.create_schema()
        try:
            purge_demo_and_test_data(database_manager, resolved_settings)
            seed_dostoevsky_books(database_manager, resolved_settings)
            seed_membership_plans(database_manager)
        except Exception as exc:
            logging.getLogger(__name__).warning("Dostoevsky catalog sync skipped or deferred: %s", exc)

    character_repository = ChromaCharacterRepository(resolved_settings.chroma_db_path)
    session_repository = ChromaSessionRepository(resolved_settings.chroma_db_path)
    factual_memory_repository = ChromaFactualMemoryRepository(
        resolved_settings.chroma_db_path
    )
    relational_persistence_service = RelationalPersistenceService(database_manager)
    lorely_service = LorelyService(database_manager, resolved_settings)

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
        "lorely_service": lorely_service,
    }
    app.extensions["database_manager"] = database_manager
    app.extensions["auth_service"] = auth_service

    app.register_blueprint(api_blueprint)
    app.register_blueprint(v1_blueprint)
    return app
