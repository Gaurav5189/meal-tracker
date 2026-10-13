"""Price defaults: which stored default applies to a meal type (ARCHITECTURE §4)."""

from decimal import Decimal

from app.models import MEAL_TYPES, UserSettings


def default_price(settings_row: UserSettings, meal_type: str) -> Decimal:
    if meal_type not in MEAL_TYPES:
        raise ValueError(f"Unknown meal type: {meal_type}")
    if meal_type == "dinner" and not settings_row.dinner_same_as_lunch:
        return settings_row.dinner_price
    return settings_row.lunch_price
