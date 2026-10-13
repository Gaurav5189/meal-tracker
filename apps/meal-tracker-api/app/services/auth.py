import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.rate_limit import AUTH_LIMIT, rate_limiter
from app.core.security import dummy_verify, hash_password, verify_password
from app.models import User, UserSettings
from app.schemas.auth import LoginIn, SignupIn
from app.schemas.me import MeOut


def me_out(user: User) -> MeOut:
    return MeOut(username=user.username, name=user.name, tz=user.tz)


def _username_taken() -> AppError:
    return AppError(
        "conflict",
        "That username is already taken.",
        fields={"username": ["That username is already taken."]},
    )


async def signup(data: SignupIn, ip: str, db: AsyncSession) -> User:
    rate_limiter.check(f"auth:{ip}|{data.username}", AUTH_LIMIT, 60)
    existing = await db.scalar(select(User).where(User.username == data.username))
    if existing is not None:
        raise _username_taken()
    user = User(
        id=uuid.uuid4(),
        username=data.username,
        name=data.name,
        password_hash=hash_password(data.password),
        tz=data.tz,
    )
    db.add(user)
    try:
        # Flush the user first: without a mapper relationship SQLAlchemy cannot
        # infer that `users` must be inserted before `settings`.
        await db.flush()
        db.add(UserSettings(user_id=user.id))
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise _username_taken() from None
    await db.refresh(user)
    return user


async def login(data: LoginIn, ip: str, db: AsyncSession) -> User:
    rate_limiter.check(f"auth:{ip}|{data.username}", AUTH_LIMIT, 60)
    user = await db.scalar(select(User).where(User.username == data.username))
    if user is None:
        # Burn the same argon2 time so unknown usernames aren't detectable.
        dummy_verify(data.password)
        raise AppError("unauthenticated", "Invalid username or password.")
    if not verify_password(user.password_hash, data.password):
        raise AppError("unauthenticated", "Invalid username or password.")
    if data.tz and data.tz != user.tz:
        user.tz = data.tz
        await db.commit()
    return user
