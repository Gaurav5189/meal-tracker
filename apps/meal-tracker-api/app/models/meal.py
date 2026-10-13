import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base

MEAL_TYPES = ("lunch", "dinner")


class Meal(Base):
    __tablename__ = "meals"
    __table_args__ = (
        UniqueConstraint("user_id", "meal_date", "meal_type", name="uq_meals_user_date_type"),
        CheckConstraint("meal_type IN ('lunch', 'dinner')", name="ck_meals_type"),
        Index("ix_meals_user_date", "user_id", "meal_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    meal_date: Mapped[date] = mapped_column(Date, nullable=False)
    meal_type: Mapped[str] = mapped_column(Text, nullable=False)
    taken: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Manual changes (chip toggle, bulk) survive later default changes (PRD §5.4/§5.5).
    taken_manual: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    price_overridden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
