"""Locking rule (PRD §5.6 / ARCHITECTURE §4.3).

locked = lock_past_meals AND meal_date < (now_in_user_tz - 48h).date()
Computed by the server; the client only renders the flag.
"""

from datetime import date

from app.models import UserSettings
from app.services.timeutil import local_date_minus_hours

LOCK_AFTER_HOURS = 48


def lock_cutoff(tz_name: str) -> date:
    return local_date_minus_hours(tz_name, LOCK_AFTER_HOURS)


def is_locked(settings_row: UserSettings, tz_name: str, meal_date: date) -> bool:
    if not settings_row.lock_past_meals:
        return False
    return meal_date < lock_cutoff(tz_name)
