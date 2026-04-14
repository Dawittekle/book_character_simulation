from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from ..config import Settings
from ..errors import ConfigurationError
from .base import Base


class DatabaseManager:
    def __init__(self, settings: Settings):
        self._database_url = settings.database_url
        self._database_connect_timeout = settings.database_connect_timeout
        self._engine: Engine | None = None
        self._session_factory: sessionmaker[Session] | None = None

        if self._database_url:
            self._engine = create_engine(
                self._database_url,
                pool_pre_ping=True,
                connect_args={"connect_timeout": self._database_connect_timeout},
                echo=settings.sqlalchemy_echo,
                future=True,
            )
            self._session_factory = sessionmaker(
                bind=self._engine,
                autoflush=False,
                autocommit=False,
                expire_on_commit=False,
            )

    @property
    def is_configured(self) -> bool:
        return self._engine is not None

    @property
    def engine(self) -> Engine:
        if self._engine is None:
            raise ConfigurationError("DATABASE_URL is not configured.")
        return self._engine

    def create_schema(self) -> None:
        Base.metadata.create_all(bind=self.engine)

    def check_connection(self) -> bool:
        if not self.is_configured:
            return False
        try:
            with self.engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return True
        except SQLAlchemyError:
            return False

    @contextmanager
    def session_scope(self) -> Iterator[Session]:
        if self._session_factory is None:
            raise ConfigurationError("DATABASE_URL is not configured.")

        session = self._session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
