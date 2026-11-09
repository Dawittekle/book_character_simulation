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
    monkeypatch.setenv("R2_ACCOUNT_ID", "cf-acc-123")
    monkeypatch.setenv("R2_ACCESS_KEY_ID", "cf-key-456")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "cf-secret-789")
    monkeypatch.setenv("R2_BUCKET_NAME", "my-test-bucket")
    monkeypatch.setenv("R2_PUBLIC_URL", "https://cdn.example.com")

    settings = Settings.from_env()
    assert settings.app_env == "testing"
    assert settings.port == 5050
    assert settings.llm_provider == "gemini"
    assert settings.gemini_model == "gemini-3.5-flash"
    assert settings.gemini_api_key == "test-key-12345"
    assert settings.r2_account_id == "cf-acc-123"
    assert settings.r2_access_key_id == "cf-key-456"
    assert settings.r2_secret_access_key == "cf-secret-789"
    assert settings.r2_bucket_name == "my-test-bucket"
    assert settings.r2_public_url == "https://cdn.example.com"
