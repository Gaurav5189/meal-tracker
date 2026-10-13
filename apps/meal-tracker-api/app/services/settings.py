"""Settings service.

Phase 3 scope: persist the user's settings. Applying changes to future meal
rows (ARCHITECTURE §4.2) lands in Phase 5 together with the materialization
service, which must run *before* these values change (§4.1 invariant).
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, UserSettings
from app.schemas.settings import SettingsIn, SettingsOut


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
    row.currency = data.currency
    row.lunch_price = data.lunch_price
    row.dinner_price = data.dinner_price
    row.dinner_same_as_lunch = data.dinner_same_as_lunch
    row.upcoming_default_on = data.upcoming_default_on
    row.lock_past_meals = data.lock_past_meals
    await db.commit()
    await db.refresh(row)
    return row
