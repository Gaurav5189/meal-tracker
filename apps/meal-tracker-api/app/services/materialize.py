"""Materialization: fill the meal-row window with the user's current defaults.

ARCHITECTURE §4.1:
- ensure_window(user) inserts missing rows (ON CONFLICT DO NOTHING) from
  materialized_through+1 (signup date for new users) to today_local + 60 days,
  using the *current* settings, then updates materialized_through.
- `through` extends the window to cover a requested month or bulk range.
- Callers own the transaction: this service only flushes. It must run *before*
  settings values change (the §4.1 invariant) so gap days get the old defaults.

Rows are never created before the signup date (PRD §8.3: pre-signup days are
not editable). Past gap days materialize as skipped; today and future use the
upcoming_default_on setting, matching the demo.
"""

from datetime import date, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MEAL_TYPES, Meal, User, UserSettings
from app.services.pricing import default_price
from app.services.timeutil import local_today, safe_zone

WINDOW_DAYS = 60
# Hard ceiling on how far ahead rows may be materialized. A client-chosen
# `through` (month fetch or bulk range) is validated against this at the API
# layer; the clamp below is defense-in-depth so one request can never build a
# huge INSERT or push materialized_through into the far future (which would
# permanently stop gap-filling: start = materialized_through+1 would pass end).
MAX_HORIZON_DAYS = 400


def horizon_for(user: User) -> date:
    """Latest date a client-requested window may end (422 beyond this)."""
    return local_today(user.tz) + timedelta(days=MAX_HORIZON_DAYS)


def signup_date(user: User) -> date:
    created = user.created_at
    if created is None:
        # Fresh signup: created_at (server_default) isn't loaded yet, but at
        # signup time it equals today in the user's timezone anyway.
        return local_today(user.tz)
    if created.tzinfo is None:  # defensive: timestamptz should always be aware
        created = created.replace(tzinfo=ZoneInfo("UTC"))
    return created.astimezone(safe_zone(user.tz)).date()


def _taken_default(meal_date: date, today: date, settings_row: UserSettings) -> bool:
    # The demo treats today like upcoming days (only strictly-past days are history).
    return meal_date >= today and settings_row.upcoming_default_on


async def ensure_window(
    user: User,
    db: AsyncSession,
    settings_row: UserSettings,
    *,
    through: date | None = None,
) -> None:
    """Insert missing meal rows up to max(today + WINDOW_DAYS, through). No commit."""
    today = local_today(user.tz)
    if user.materialized_through:
        start = user.materialized_through + timedelta(days=1)
    else:
        # New user: never create rows before the signup date (PRD §8.3).
        start = max(signup_date(user), today)
    end = today + timedelta(days=WINDOW_DAYS)
    if through is not None and through > end:
        end = through
    end = min(end, today + timedelta(days=MAX_HORIZON_DAYS))
    if start > end:
        return

    values = [
        {
            "user_id": user.id,
            "meal_date": day,
            "meal_type": meal_type,
            "taken": _taken_default(day, today, settings_row),
            "taken_manual": False,
            "price": default_price(settings_row, meal_type),
            "price_overridden": False,
        }
        for day in (start + timedelta(days=offset) for offset in range((end - start).days + 1))
        for meal_type in MEAL_TYPES
    ]
    stmt = insert(Meal).values(values)
    await db.execute(stmt.on_conflict_do_nothing(constraint="uq_meals_user_date_type"))
    user.materialized_through = end
    await db.flush()
