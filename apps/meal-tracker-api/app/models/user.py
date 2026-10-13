import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(Text, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    tz: Mapped[str] = mapped_column(Text, nullable=False, default="UTC")
    # Intro popup: new users start false; set true on first confirm. Server-side
    # so clearing browser data / re-login can't skip it. ORM default false —
    # the migration's server_default=true only marks pre-existing rows.
    onboarded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    materialized_through: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
