from pathlib import Path
import sys

SRC_DIR = Path(__file__).resolve().parent / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from book_character_simulation_backend import create_app
from book_character_simulation_backend.config import Settings


def _display_host(host: str) -> str:
    if host in {"0.0.0.0", "::"}:
        return "127.0.0.1"
    return host


def print_startup_banner(settings: Settings) -> None:
    base_url = f"http://{_display_host(settings.host)}:{settings.port}"
    provider_ready = (
        settings.gemini_api_key if settings.llm_provider == "gemini" else settings.openai_api_key
    )
    print("")
    print("Backend startup")
    print(f"API base: {base_url}/api")
    print(f"Health: {base_url}/api/health")
    print(f"Configured LLM provider: {settings.llm_provider}")
    print(f"Configured LLM provider ready: {'yes' if provider_ready else 'no'}")
    print(
        "Supabase configured: "
        f"{'yes' if settings.supabase_url and settings.supabase_anon_key else 'no'}"
    )
    print(f"Relational database configured: {'yes' if settings.database_url else 'no'}")
    print("")


if __name__ == '__main__':
    settings = Settings.from_env()
    app = create_app(settings)
    print_startup_banner(settings)
    app.run(host=settings.host, port=settings.port, debug=settings.debug)
