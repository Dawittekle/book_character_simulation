import warnings

warnings.filterwarnings("ignore", message=".*is not a Python type.*")

from .app import create_app

__all__ = ["create_app"]
