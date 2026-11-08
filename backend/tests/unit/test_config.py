from __future__ import annotations

from book_character_simulation_backend.config import Settings, _clean_value, _normalize_database_url


def test_clean_value():
    assert _clean_value(None) is None
    assert _clean_value("") is None
    assert _clean_value("   ") is None
    assert _clean_value("NONE") is None
    assert _clean_value("null") is None
    assert _clean_value("YOUR_API_KEY") is None
    assert _clean_value("<replace-me>") is None
    assert _clean_value("valid-token") == "valid-token"


def test_normalize_database_url():
    assert _normalize_database_url(None) is None
    assert _normalize_database_url("") is None
    
    # Converts postgres:// to postgresql+psycopg://
    url = "postgres://user:pass@localhost:5432/mydb"
    normalized = _normalize_database_url(url)
    assert normalized.startswith("postgresql+psycopg://")
    assert "user:" in normalized

    # Handles DATABASE_URL= prefix
    prefixed = "DATABASE_URL=postgresql://user:pass@localhost:5432/mydb"
    normalized_prefixed = _normalize_database_url(prefixed)
    assert normalized_prefixed.startswith("postgresql+psycopg://")


def test_settings_from_env(monkeypatch):
    monkeypatch.setenv("APP_ENV", "testing")
    monkeypatch.setenv("PORT", "5050")
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.5-flash")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-12345")

    settings = Settings.from_env()
    assert settings.app_env == "testing"
    assert settings.port == 5050
    assert settings.llm_provider == "gemini"
    assert settings.gemini_model == "gemini-3.5-flash"
    assert settings.gemini_api_key == "test-key-12345"
