"""FastAPI dependencies: DB session, current user, CSRF check."""

import secrets
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionFactory
from app.core.errors import AppError
from app.core.rate_limit import USER_LIMIT, rate_limiter
from app.core.security import CSRF_COOKIE, SESSION_COOKIE, decode_session_token
from app.models import User


async def get_db() -> AsyncIterator[AsyncSession]:
    """Yield a DB session (one transaction per request)."""
    if SessionFactory is None:
        raise AppError("internal_error", "DATABASE_URL is not configured")
    async with SessionFactory() as session:
        yield session


DbDep = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(request: Request, db: DbDep) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise AppError("unauthenticated", "Please log in.")
    user_id = decode_session_token(token)
    if user_id is None:
        raise AppError("unauthenticated", "Please log in.")
    user = await db.get(User, user_id)
    if user is None:
        raise AppError("unauthenticated", "Please log in.")
    rate_limiter.check(f"user:{user.id}", USER_LIMIT, 60)
    return user


async def require_csrf(request: Request) -> None:
    """Double-submit check: the X-CSRF-Token header must match the CSRF cookie."""
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get("X-CSRF-Token")
    if not cookie or not header or not secrets.compare_digest(cookie, header):
        raise AppError("forbidden", "Missing or invalid CSRF token.")


CurrentUser = Annotated[User, Depends(get_current_user)]
CsrfDep = Annotated[None, Depends(require_csrf)]
