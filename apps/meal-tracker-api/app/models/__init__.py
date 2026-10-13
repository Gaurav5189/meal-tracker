from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


from app.models.meal import MEAL_TYPES, Meal  # noqa: E402
from app.models.settings import UserSettings  # noqa: E402
from app.models.user import User  # noqa: E402

__all__ = ["Base", "Meal", "MEAL_TYPES", "User", "UserSettings"]
