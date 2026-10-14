"""Meals service: month fetch (with materialization) and single-meal edits."""

import calendar
import re
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Numeric, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models import Meal, User, UserSettings
from app.schemas.meals import MealDayOut, MealOut, MealPatchIn, MealsMonthOut
from app.services import materialize
from app.services.lock import is_locked
from app.services.pricing import default_price
from app.services.timeutil import local_today

MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def parse_month(month: str) -> tuple[date, date]:
    """'YYYY-MM' -> (first day, last day); 422 with a field error when invalid."""
    if not MONTH_RE.match(month):
        raise AppError(
            "validation_error",
            "Check the highlighted fields.",
            fields={"month": ["Use the YYYY-MM format."]},
        )
    year, mon = int(month[:4]), int(month[5:7])
    start = date(year, mon, 1)
    return start, date(year, mon, calendar.monthrange(year, mon)[1])


def meal_out(row: Meal, settings_row: UserSettings, tz_name: str) -> MealOut:
    return MealOut(
        id=row.id,
        taken=row.taken,
        price=row.price,
        price_overridden=row.price_overridden,
        locked=is_locked(settings_row, tz_name, row.meal_date),
    )


def synthetic_meal(
    settings_row: UserSettings, tz_name: str, meal_type: str, day: date
) -> MealOut:
    """Placeholder for a day with no row (pre-signup): skipped, default price, read-only."""
    return MealOut(
        id=None,
        taken=False,
        price=default_price(settings_row, meal_type),
        price_overridden=False,
        locked=is_locked(settings_row, tz_name, day),
    )


async def get_month(
    user: User, settings_row: UserSettings, month: str, db: AsyncSession
) -> MealsMonthOut:
    start, end = parse_month(month)
    today = local_today(user.tz)
    # Reject months past the horizon BEFORE materializing: otherwise one request
    # could insert millions of rows and push materialized_through into the far
    # future, permanently stopping gap-filling (start would pass end).
    if end > materialize.horizon_for(user):
        raise AppError(
            "validation_error",
            "Check the highlighted fields.",
            fields={"month": ["That month is too far in the future."]},
        )
    # Fetching a month beyond the window extends materialization (ARCHITECTURE §4.1).
    await materialize.ensure_window(user, db, settings_row, through=end)
    await db.commit()

    rows = (
        (
            await db.execute(
                select(Meal).where(
                    Meal.user_id == user.id, Meal.meal_date >= start, Meal.meal_date <= end
                )
            )
        )
        .scalars()
        .all()
    )
    by_key = {(row.meal_date, row.meal_type): row for row in rows}

    agg = await db.execute(
        select(
            func.coalesce(func.sum(Meal.price), 0).cast(Numeric(12, 2)).label("total"),
            func.count().label("taken_count"),
        ).where(
            Meal.user_id == user.id,
            Meal.meal_date >= start,
            Meal.meal_date <= end,
            Meal.taken.is_(True),
        )
    )
    agg_row = agg.one()
    total: Decimal = agg_row.total or Decimal("0.00")
    taken_count: int = agg_row.taken_count or 0

    days: list[MealDayOut] = []
    day = start
    while day <= end:
        lunch = by_key.get((day, "lunch"))
        dinner = by_key.get((day, "dinner"))
        days.append(
            MealDayOut(
                date=day,
                lunch=meal_out(lunch, settings_row, user.tz) if lunch
                else synthetic_meal(settings_row, user.tz, "lunch", day),
                dinner=meal_out(dinner, settings_row, user.tz) if dinner
                else synthetic_meal(settings_row, user.tz, "dinner", day),
            )
        )
        day = date.fromordinal(day.toordinal() + 1)

    return MealsMonthOut(
        month=month,
        currency=settings_row.currency,
        today=today,
        total=total,
        taken_count=taken_count,
        days=days,
    )


async def get_meal(user: User, meal_id: UUID, db: AsyncSession) -> Meal:
    row = await db.get(Meal, meal_id)
    if row is None or row.user_id != user.id:
        raise AppError("not_found", "Meal not found.")
    return row


async def patch_meal(
    user: User, settings_row: UserSettings, meal_id: UUID, payload: MealPatchIn, db: AsyncSession
) -> MealOut:
    row = await get_meal(user, meal_id, db)
    if is_locked(settings_row, user.tz, row.meal_date):
        raise AppError("locked", "This meal is locked: it is older than 48 hours.")

    if payload.taken is not None:
        row.taken = payload.taken
        # Manual changes survive later default changes (PRD §5.4/§5.5).
        row.taken_manual = True
    if "price" in payload.model_fields_set:
        if payload.price is None:  # reset to the current default
            row.price = default_price(settings_row, row.meal_type)
            row.price_overridden = False
        else:
            row.price = payload.price
            row.price_overridden = True
    await db.commit()
    return meal_out(row, settings_row, user.tz)
