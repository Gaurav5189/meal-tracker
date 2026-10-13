import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, field_validator

_USERNAME_RE = re.compile(r"^[a-z0-9_]{3,20}$")
_TIMEZONE_ALIASES = {
    "Asia/Calcutta": "Asia/Kolkata",
}


def _normalize_timezone(value: str) -> str:
    timezone = _TIMEZONE_ALIASES.get(value, value)
    try:
        ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError, KeyError) as exc:
        raise ValueError("Not a recognized timezone.") from exc
    return timezone


class SignupIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    username: str
    password: str
    tz: str

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        name = value.strip()
        if not 1 <= len(name) <= 50:
            raise ValueError("Name must be 1–50 characters.")
        return name

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        username = value.strip().lower()
        if not _USERNAME_RE.fullmatch(username):
            raise ValueError("Use 3-20 characters: a-z, 0-9, underscore.")
        return username

    @field_validator("password")
    @classmethod
    def check_password(cls, value: str) -> str:
        if not 8 <= len(value) <= 128:
            raise ValueError("Password must be 8-128 characters.")
        return value

    @field_validator("tz")
    @classmethod
    def check_tz(cls, value: str) -> str:
        return _normalize_timezone(value)


class LoginIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str
    password: str
    tz: str | None = None

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        username = value.strip().lower()
        if not _USERNAME_RE.fullmatch(username):
            raise ValueError("Use 3-20 characters: a-z, 0-9, underscore.")
        return username

    @field_validator("tz")
    @classmethod
    def check_tz(cls, value: str | None) -> str | None:
        return None if value is None else _normalize_timezone(value)
