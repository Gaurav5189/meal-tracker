import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CHAR, Boolean, DateTime, ForeignKey, Numeric, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base

DEFAULT_LUNCH_PRICE = Decimal("35.00")
DEFAULT_DINNER_PRICE = Decimal("35.00")


class UserSettings(Base):
    __tablename__ = "settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    currency: Mapped[str] = mapped_column(CHAR(3), nullable=False, default="INR")
    lunch_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=DEFAULT_LUNCH_PRICE
    )
    dinner_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=DEFAULT_DINNER_PRICE
    )
    dinner_same_as_lunch: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    upcoming_default_on: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    lock_past_meals: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
