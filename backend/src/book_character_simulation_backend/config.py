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
    chroma_db_path: Path
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

    @classmethod
    def from_env(cls) -> "Settings":
        backend_dir = Path(__file__).resolve().parents[2]
        default_chroma_path = backend_dir / "chroma_db"
        load_dotenv(backend_dir / ".env")
        os.environ.setdefault("ANONYMIZED_TELEMETRY", "FALSE")
        chroma_db_path = Path(os.getenv("CHROMA_DB_PATH", str(default_chroma_path)))
        if not chroma_db_path.is_absolute():
            chroma_db_path = backend_dir / chroma_db_path

        return cls(
            app_env=os.getenv("APP_ENV", "development"),
            debug=_as_bool(os.getenv("DEBUG"), True),
            host=os.getenv("HOST", "0.0.0.0"),
            port=_as_int(os.getenv("PORT"), 5000),
            cors_origins=_as_list(
                os.getenv("CORS_ORIGINS"),
                ["http://localhost:5173", "http://127.0.0.1:5173"],
            ),
            chroma_db_path=chroma_db_path,
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
            gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        )
