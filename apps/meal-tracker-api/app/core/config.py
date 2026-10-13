import logging
from typing import Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

DEV_JWT_SECRET = "dev-only-change-me"


class Settings(BaseSettings):
    """App configuration. Values come from environment variables (see .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = ""
    jwt_secret: str = DEV_JWT_SECRET
    cors_origins: str = "http://localhost:5173"
    cookie_domain: str = ""
    cookie_secure: bool = True
    debug: bool = False

    @model_validator(mode="after")
    def _check_secret(self) -> Self:
        weak = (
            not self.jwt_secret.strip()
            or self.jwt_secret == DEV_JWT_SECRET
            or len(self.jwt_secret) < 32
        )
        if weak and not self.debug:
            raise ValueError(
                "JWT_SECRET must be a strong value (>= 32 chars, not the repo default)"
                " when DEBUG=false — anyone with the public default can forge session tokens."
                ' Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        if weak:
            logger.warning(
                "JWT_SECRET is weak/default (DEBUG=true): fine for local dev, never production"
            )
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
