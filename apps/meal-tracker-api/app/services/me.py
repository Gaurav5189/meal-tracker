"""Profile service: name update and password change."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import hash_password, verify_password
from app.models import User
from app.schemas.me import NameUpdateIn, PasswordChangeIn


async def update_name(user: User, data: NameUpdateIn, db: AsyncSession) -> User:
    user.name = data.name
    await db.commit()
    await db.refresh(user)
    return user


async def change_password(user: User, data: PasswordChangeIn, db: AsyncSession) -> None:
    if not verify_password(user.password_hash, data.current_password):
        raise AppError(
            "validation_error",
            "Check the highlighted fields.",
            fields={"current_password": ["Current password is incorrect."]},
        )
    user.password_hash = hash_password(data.new_password)
    await db.commit()
