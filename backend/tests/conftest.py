from __future__ import annotations

from pathlib import Path
import pytest
from flask import Flask
from flask.testing import FlaskClient

from book_character_simulation_backend.config import Settings
from book_character_simulation_backend.app import create_app


@pytest.fixture
def temp_chroma_path(tmp_path: Path) -> Path:
    chroma_dir = tmp_path / "test_chroma_db"
    chroma_dir.mkdir(parents=True, exist_ok=True)
    return chroma_dir


@pytest.fixture
def test_settings(temp_chroma_path: Path) -> Settings:
    return Settings(
        app_env="testing",
        debug=True,
        host="127.0.0.1",
        port=5000,
        cors_origins=["http://localhost:5173"],
        chroma_db_path=temp_chroma_path,
        database_url=None,  # isolated from production DB by default
        database_connect_timeout=2,
        sqlalchemy_echo=False,
        auto_create_relational_schema=False,
        supabase_url=None,
        supabase_anon_key=None,
        supabase_service_role_key=None,
        supabase_jwt_secret=None,
        llm_provider="gemini",
        llm_temperature=0.7,
        max_source_characters=50000,
        openai_api_key="mock-openai-key",
        openai_model="gpt-4.1-mini",
        gemini_api_key="mock-gemini-key",
        gemini_model="gemini-3.5-flash",
    )


@pytest.fixture
def app(test_settings: Settings) -> Flask:
    return create_app(test_settings)


@pytest.fixture
def client(app: Flask) -> FlaskClient:
    return app.test_client()
