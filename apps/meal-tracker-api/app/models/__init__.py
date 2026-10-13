from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


from app.models.settings import UserSettings  # noqa: E402
from app.models.user import User  # noqa: E402

__all__ = ["Base", "User", "UserSettings"]
