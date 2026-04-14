from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import jwt
import requests
from jwt import InvalidTokenError, PyJWKClient

from .config import Settings
from .errors import ConfigurationError, UnauthorizedError

logger = logging.getLogger(__name__)


@dataclass(slots=True, frozen=True)
class AuthenticatedUser:
    subject: str
    email: str | None
    display_name: str | None
    avatar_url: str | None
    role: str | None
    claims: dict[str, Any]


class SupabaseAuthService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._issuer = (
            f"{settings.supabase_url}/auth/v1" if settings.supabase_url else None
        )
        self._jwks_url = (
            f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
            if settings.supabase_url
            else None
        )
        self._jwks_client = PyJWKClient(self._jwks_url) if self._jwks_url else None

    @property
    def is_configured(self) -> bool:
        return bool(self.settings.supabase_url and self.settings.supabase_anon_key)

    def authenticate_request(self, authorization_header: str | None) -> AuthenticatedUser | None:
        token = self._extract_bearer_token(authorization_header)
        if token is None:
            return None
        if not self.is_configured:
            raise ConfigurationError(
                "Supabase auth is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY."
            )

        return self.verify_access_token(token)

    def verify_access_token(self, token: str) -> AuthenticatedUser:
        try:
            unverified_header = jwt.get_unverified_header(token)
        except InvalidTokenError as exc:
            raise UnauthorizedError("Invalid authorization token.") from exc

        algorithm = str(unverified_header.get("alg") or "").upper()
        if algorithm.startswith("HS"):
            return self._get_user_via_auth_api(token)

        try:
            return self._verify_with_jwks(token, algorithm)
        except InvalidTokenError as exc:
            raise UnauthorizedError("Invalid authorization token.") from exc
        except Exception as exc:
            logger.warning("JWKS verification failed, falling back to Supabase Auth API: %s", exc)
            return self._get_user_via_auth_api(token)

    @staticmethod
    def _extract_bearer_token(authorization_header: str | None) -> str | None:
        if authorization_header is None:
            return None

        raw = authorization_header.strip()
        if not raw:
            return None

        scheme, _, token = raw.partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            raise UnauthorizedError("Authorization header must use the Bearer scheme.")
        return token.strip()

    def _verify_with_jwks(self, token: str, algorithm: str) -> AuthenticatedUser:
        if self._jwks_client is None or self._issuer is None:
            raise ConfigurationError("Supabase auth is not configured.")

        signing_key = self._jwks_client.get_signing_key_from_jwt(token).key
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=[algorithm],
            issuer=self._issuer,
            options={"verify_aud": False},
        )
        return self._claims_to_user(payload)

    def _get_user_via_auth_api(self, token: str) -> AuthenticatedUser:
        if not self.settings.supabase_url or not self.settings.supabase_anon_key:
            raise ConfigurationError("Supabase auth is not configured.")

        response = requests.get(
            f"{self.settings.supabase_url}/auth/v1/user",
            headers={
                "apikey": self.settings.supabase_anon_key,
                "Authorization": f"Bearer {token}",
            },
            timeout=20,
        )
        if response.status_code != 200:
            raise UnauthorizedError("Invalid authorization token.")

        payload = response.json()
        metadata = payload.get("user_metadata") or {}
        subject = payload.get("id")
        if not subject:
            raise UnauthorizedError("Authorization token did not include a user id.")

        return AuthenticatedUser(
            subject=subject,
            email=payload.get("email"),
            display_name=metadata.get("full_name")
            or metadata.get("name")
            or payload.get("email"),
            avatar_url=metadata.get("avatar_url"),
            role=payload.get("role"),
            claims=payload,
        )

    @staticmethod
    def _claims_to_user(payload: dict[str, Any]) -> AuthenticatedUser:
        metadata = payload.get("user_metadata") or {}
        subject = payload.get("sub")
        if not subject:
            raise UnauthorizedError("Authorization token did not include a subject.")

        return AuthenticatedUser(
            subject=subject,
            email=payload.get("email"),
            display_name=metadata.get("full_name")
            or metadata.get("name")
            or payload.get("email"),
            avatar_url=metadata.get("avatar_url"),
            role=payload.get("role"),
            claims=payload,
        )
