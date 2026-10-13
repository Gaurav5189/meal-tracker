from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# The picker shown in the demo; keep the API strict so typos fail with a field error.
CURRENCIES = ("INR", "USD", "EUR", "GBP", "BDT", "AED")


class SettingsOut(BaseModel):
    currency: str
    lunch_price: Decimal
    dinner_price: Decimal
    dinner_same_as_lunch: bool
    upcoming_default_on: bool
    lock_past_meals: bool


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    currency: str
    lunch_price: Decimal = Field(max_digits=10, decimal_places=2, ge=0)
    dinner_price: Decimal = Field(max_digits=10, decimal_places=2, ge=0)
    dinner_same_as_lunch: bool
    upcoming_default_on: bool
    lock_past_meals: bool

    @field_validator("currency")
    @classmethod
    def check_currency(cls, value: str) -> str:
        currency = value.strip().upper()
        if currency not in CURRENCIES:
            raise ValueError("Choose a supported currency.")
        return currency

    @model_validator(mode="after")
    def mirror_dinner_price(self) -> SettingsIn:
        # "Dinner same as lunch" stores the mirrored value so meal rows and
        # future defaults (Phase 4/5) never see a stale dinner price.
        if self.dinner_same_as_lunch:
            self.dinner_price = self.lunch_price
        return self
