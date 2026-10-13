"""Timezone-aware date helpers.

Meal dates are calendar DATEs in the user's timezone (PRD §6); every
"today"/"now" decision must go through these helpers, never UTC.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def safe_zone(tz_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError, KeyError):
        return ZoneInfo("UTC")


def now_local(tz_name: str) -> datetime:
    return datetime.now(safe_zone(tz_name))


def local_today(tz_name: str) -> date:
    return now_local(tz_name).date()


def local_date_minus_hours(tz_name: str, hours: float) -> date:
    """`date(now_in_tz - 48h)` — the lock cutoff (PRD §5.6)."""
    from datetime import timedelta

    return (now_local(tz_name) - timedelta(hours=hours)).date()
