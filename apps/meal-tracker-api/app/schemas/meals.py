"""Meals API schemas. Decimal prices transport as strings (PRD §6)."""

import uuid
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_PRICE = Decimal("99999999.99")


class MealOut(BaseModel):
    id: uuid.UUID | None  # null = not materialized (pre-signup day): render read-only
    taken: bool
    price: Decimal
    price_overridden: bool
    locked: bool


class MealDayOut(BaseModel):
    date: date
    lunch: MealOut
    dinner: MealOut


class MealsMonthOut(BaseModel):
    month: str  # YYYY-MM as requested
    currency: str
    today: date  # "today" in the user's timezone, for row highlighting
    total: Decimal  # SUM(price) WHERE taken, for the month
    taken_count: int
    days: list[MealDayOut]


class MealPatchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    taken: bool | None = None
    price: Decimal | None = None  # explicit null resets the price to the default

    @field_validator("price")
    @classmethod
    def check_price(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and not (0 <= value <= MAX_PRICE):
            raise ValueError("Price must be between 0 and 99999999.99.")
        return value

    @model_validator(mode="after")
    def check_any_field(self) -> MealPatchIn:
        if self.taken is None and "price" not in self.model_fields_set:
            raise ValueError("Provide taken, price, or both.")
        return self


class BulkIn(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    date_from: date = Field(alias="from")
    date_to: date = Field(alias="to")
    meal_types: list[Literal["lunch", "dinner"]] = Field(min_length=1)
    taken: bool

    @field_validator("meal_types")
    @classmethod
    def dedupe_types(cls, value: list[str]) -> list[str]:
        return sorted(set(value))

    @model_validator(mode="after")
    def check_range(self) -> BulkIn:
        if self.date_from > self.date_to:
            raise ValueError("From must be on or before To.")
        return self


class BulkOut(BaseModel):
    updated: int
    locked_skipped: int
