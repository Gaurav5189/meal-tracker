"""Argon2id password hashing, JWT sessions, and cookie helpers."""

import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Response

from app.core.config import settings

SESSION_COOKIE = "mt_session"
CSRF_COOKIE = "mt_csrf"
SESSION_MAX_AGE = 7 * 24 * 60 * 60  # 7 days, per ARCHITECTURE §6

_ph = PasswordHasher()  # argon2id with sensible defaults
# A throwaway hash used to equalize timing when the username does not exist.
_DUMMY_HASH = _ph.hash(secrets.token_urlsafe(32))


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except VerifyMismatchError:
        return False
    except VerificationError, InvalidHashError:
        # Malformed/stale hash params: fail closed, but do not crash.
        return False


def dummy_verify(password: str) -> None:
    """Burn the same argon2 time as a real check so unknown usernames aren't detectable."""
    try:
        _ph.verify(_DUMMY_HASH, password)
    except VerifyMismatchError, VerificationError, InvalidHashError:
        pass


def create_session_token(user_id: uuid.UUID) -> str:
    now = datetime.now(UTC)
    payload = {"sub": str(user_id), "type": "access", "iat": now, "exp": now + timedelta(days=7)}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_session_token(token: str) -> uuid.UUID | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return None
    if payload.get("type") != "access":
        return None
    try:
        return uuid.UUID(str(payload.get("sub")))
    except ValueError:
        return None


def _cookie_kwargs() -> dict[str, object]:
    return {
        "path": "/",
        "secure": settings.cookie_secure,
        "samesite": "lax",
        "domain": settings.cookie_domain or None,
    }


def set_auth_cookies(response: Response, user_id: uuid.UUID) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        create_session_token(user_id),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        **_cookie_kwargs(),
    )
    response.set_cookie(
        CSRF_COOKIE,
        secrets.token_urlsafe(32),
        max_age=SESSION_MAX_AGE,
        httponly=False,  # double-submit: the client must read it
        **_cookie_kwargs(),
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, **_cookie_kwargs())
    response.delete_cookie(CSRF_COOKIE, **_cookie_kwargs())
