from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


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


@dataclass(slots=True, frozen=True)
class Settings:
    app_env: str
    debug: bool
    host: str
    port: int
    cors_origins: list[str]
    chroma_db_path: Path
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
            llm_provider=os.getenv("LLM_PROVIDER", "openai").strip().lower(),
            llm_temperature=_as_float(os.getenv("LLM_TEMPERATURE"), 0.7),
            max_source_characters=_as_int(os.getenv("MAX_SOURCE_CHARACTERS"), 50000),
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            openai_model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
            gemini_api_key=os.getenv("GEMINI_API_KEY"),
            gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        )
