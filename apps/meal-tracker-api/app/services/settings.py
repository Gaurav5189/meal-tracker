"""Settings service.

ARCHITECTURE §4.1 invariant: ensure_window runs BEFORE values change, so any
gap days are materialized with the OLD defaults. Then §4.2 propagation applies
the NEW defaults to future rows only (meal_date > today in the user's tz):
- price where price_overridden = false;
- taken = upcoming_default_on where taken_manual = false.
Today and past rows are never touched.
"""

from sqlalchemy import case, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Meal, User, UserSettings
from app.schemas.settings import SettingsIn, SettingsOut
from app.services import materialize
from app.services.timeutil import local_today


def settings_out(row: UserSettings) -> SettingsOut:
    return SettingsOut(
        currency=row.currency,
        lunch_price=row.lunch_price,
        dinner_price=row.dinner_price,
        dinner_same_as_lunch=row.dinner_same_as_lunch,
        upcoming_default_on=row.upcoming_default_on,
        lock_past_meals=row.lock_past_meals,
    )


async def get_settings_row(user: User, db: AsyncSession) -> UserSettings:
    """Fetch the settings row, creating it if a signup somehow missed it."""
    row = await db.get(UserSettings, user.id)
    if row is None:
        row = UserSettings(user_id=user.id)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


async def update_settings(user: User, data: SettingsIn, db: AsyncSession) -> UserSettings:
    row = await get_settings_row(user, db)
    # §4.1 invariant first: fill gap days using the OLD defaults, in this same
    # transaction, before any value below changes.
    await materialize.ensure_window(user, db, row)

    today = local_today(user.tz)
    future = [Meal.user_id == user.id, Meal.meal_date > today]

    # §4.2 price propagation: non-overridden future rows get the new defaults.
    await db.execute(
        update(Meal)
        .where(*future, Meal.price_overridden.is_(False))
        .values(
            price=case(
                (Meal.meal_type == "dinner", data.dinner_price),
                else_=data.lunch_price,
            )
        )
    )
    # §4.2 taken propagation: non-manual future rows follow the upcoming default.
    await db.execute(
        update(Meal)
        .where(*future, Meal.taken_manual.is_(False))
        .values(taken=data.upcoming_default_on)
    )

    row.currency = data.currency
    row.lunch_price = data.lunch_price
    row.dinner_price = data.dinner_price
    row.dinner_same_as_lunch = data.dinner_same_as_lunch
    row.upcoming_default_on = data.upcoming_default_on
    row.lock_past_meals = data.lock_past_meals
    await db.commit()
    return row
