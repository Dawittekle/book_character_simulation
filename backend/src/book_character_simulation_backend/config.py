from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit, urlunsplit

from dotenv import load_dotenv


_PLACEHOLDER_PREFIXES = (
    "YOUR_",
    "REPLACE_",
    "CHANGE_ME",
    "<",
)


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_int(value: str | None, default: int) -> int:
    if value is None:
        return default
    return int(value)


def _as_float(value: str | None, default: float) -> float:
    if value is None:
        return default
    return float(value)


def _as_list(value: str | None, default: list[str]) -> list[str]:
    if value is None or not value.strip():
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


def _clean_value(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()
    if not cleaned:
        return None

    normalized = cleaned.upper()
    if normalized in {"NONE", "NULL"}:
        return None
    if any(normalized.startswith(prefix) for prefix in _PLACEHOLDER_PREFIXES):
        return None

    return cleaned


def _normalize_database_url(value: str | None) -> str | None:
    cleaned = _clean_value(value)
    if cleaned is None:
        return None

    raw = cleaned
    if raw.startswith("DATABASE_URL="):
        raw = raw.split("=", 1)[1].strip()
    if raw.startswith("postgres://"):
        raw = "postgresql+psycopg://" + raw[len("postgres://") :]
    elif raw.startswith("postgresql://"):
        raw = "postgresql+psycopg://" + raw[len("postgresql://") :]

    parsed = urlsplit(raw)
    if not parsed.scheme or "@" not in parsed.netloc or ":" not in parsed.netloc:
        return raw

    userinfo, hostinfo = parsed.netloc.rsplit("@", 1)
    if ":" not in userinfo:
        return raw

    username, password = userinfo.split(":", 1)
    encoded_password = quote(unquote(password), safe="")
    normalized_netloc = f"{username}:{encoded_password}@{hostinfo}"
    return urlunsplit(
        (parsed.scheme, normalized_netloc, parsed.path, parsed.query, parsed.fragment)
    )


@dataclass(slots=True, frozen=True)
class Settings:
    app_env: str
    debug: bool
    host: str
    port: int
    cors_origins: list[str]
    database_url: str | None
    database_connect_timeout: int
    sqlalchemy_echo: bool
    auto_create_relational_schema: bool
    supabase_url: str | None
    supabase_anon_key: str | None
    supabase_service_role_key: str | None
    supabase_jwt_secret: str | None
    llm_provider: str
    llm_temperature: float
    max_source_characters: int
    openai_api_key: str | None
    openai_model: str
    gemini_api_key: str | None
    gemini_model: str
    admin_email: str = "admin@lorely.app"
    admin_password: str = "LorelyAdmin2026!Secure"
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket_name: str = "lorely-books"
    r2_public_url: str | None = None
    storage_local_dir: Path | None = None
    qdrant_url: str | None = None
    qdrant_api_key: str | None = None
    qdrant_collection: str = "lorely_book_chunks"
    qdrant_timeout: int = 10
    gemini_embedding_model: str = "models/gemini-embedding-001"
    openai_embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536

    @classmethod
    def from_env(cls) -> "Settings":
        backend_dir = Path(__file__).resolve().parents[2]
        load_dotenv(backend_dir / ".env")

        storage_local_path = Path(os.getenv("STORAGE_LOCAL_DIR", "storage"))
        if not storage_local_path.is_absolute():
            storage_local_path = backend_dir / storage_local_path

        return cls(
            app_env=os.getenv("APP_ENV", "development"),
            debug=_as_bool(os.getenv("DEBUG"), True),
            host=os.getenv("HOST", "0.0.0.0"),
            port=_as_int(os.getenv("PORT"), 5000),
            cors_origins=_as_list(
                os.getenv("CORS_ORIGINS"),
                ["http://localhost:5173", "http://127.0.0.1:5173"],
            ),
            database_url=_normalize_database_url(os.getenv("DATABASE_URL")),
            database_connect_timeout=_as_int(
                os.getenv("DATABASE_CONNECT_TIMEOUT"), 10
            ),
            sqlalchemy_echo=_as_bool(os.getenv("SQLALCHEMY_ECHO"), False),
            auto_create_relational_schema=_as_bool(
                os.getenv("AUTO_CREATE_RELATIONAL_SCHEMA"), False
            ),
            supabase_url=_clean_value(os.getenv("SUPABASE_URL")),
            supabase_anon_key=_clean_value(os.getenv("SUPABASE_PUBLISHABLE_KEY"))
            or _clean_value(os.getenv("SUPABASE_ANON_KEY")),
            supabase_service_role_key=_clean_value(os.getenv("SUPABASE_SECRET_KEY"))
            or _clean_value(os.getenv("SUPABASE_SERVICE_ROLE_KEY")),
            supabase_jwt_secret=_clean_value(os.getenv("SUPABASE_JWT_SECRET")),
            llm_provider=os.getenv("LLM_PROVIDER", "openai").strip().lower(),
            llm_temperature=_as_float(os.getenv("LLM_TEMPERATURE"), 0.7),
            max_source_characters=_as_int(os.getenv("MAX_SOURCE_CHARACTERS"), 50000),
            openai_api_key=_clean_value(os.getenv("OPENAI_API_KEY")),
            openai_model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
            gemini_api_key=_clean_value(os.getenv("GEMINI_API_KEY")),
            gemini_model=os.getenv("GEMINI_MODEL", "gemini-3.5-flash"),
            admin_email=os.getenv("ADMIN_EMAIL", "admin@lorely.app").strip(),
            admin_password=os.getenv("ADMIN_PASSWORD", "LorelyAdmin2026!Secure").strip(),
            r2_account_id=_clean_value(os.getenv("R2_ACCOUNT_ID")),
            r2_access_key_id=_clean_value(os.getenv("R2_ACCESS_KEY_ID")),
            r2_secret_access_key=_clean_value(os.getenv("R2_SECRET_ACCESS_KEY")),
            r2_bucket_name=os.getenv("R2_BUCKET_NAME", "lorely-books").strip(),
            r2_public_url=_clean_value(os.getenv("R2_PUBLIC_URL")),
            storage_local_dir=storage_local_path,
            qdrant_url=_clean_value(os.getenv("QDRANT_URL")),
            qdrant_api_key=_clean_value(os.getenv("QDRANT_API_KEY")),
            qdrant_collection=os.getenv("QDRANT_COLLECTION", "lorely_book_chunks").strip(),
            qdrant_timeout=_as_int(os.getenv("QDRANT_TIMEOUT"), 10),
            gemini_embedding_model=os.getenv("GEMINI_EMBEDDING_MODEL", "models/gemini-embedding-001").strip(),
            openai_embedding_model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small").strip(),
            embedding_dimensions=_as_int(os.getenv("EMBEDDING_DIMENSIONS"), 1536),
        )
