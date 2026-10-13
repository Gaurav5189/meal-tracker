from pydantic import BaseModel, ConfigDict, field_validator


class MeOut(BaseModel):
    username: str
    name: str
    tz: str


class NameUpdateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        name = value.strip()
        if not 1 <= len(name) <= 50:
            raise ValueError("Name must be 1-50 characters.")
        return name


class PasswordChangeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str
    new_password: str

    @field_validator("current_password")
    @classmethod
    def check_current(cls, value: str) -> str:
        if not value:
            raise ValueError("Enter your current password.")
        return value

    @field_validator("new_password")
    @classmethod
    def check_new(cls, value: str) -> str:
        if not 8 <= len(value) <= 128:
            raise ValueError("Password must be 8-128 characters.")
        return value
