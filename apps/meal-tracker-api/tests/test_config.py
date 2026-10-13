"""JWT secret startup validation (app.core.config)."""

import pytest
from pydantic import ValidationError

from app.core.config import DEV_JWT_SECRET, Settings

_STRONG = "test-strong-secret-0123456789abcdef0123456789abcdef"  # 48 chars


def _settings(**overrides) -> Settings:
    """Fresh Settings with no .env file; kwargs outrank env vars."""
    return Settings(_env_file=None, **overrides)


def test_strong_secret_accepted_in_production_mode() -> None:
    s = _settings(jwt_secret=_STRONG, debug=False)
    assert s.jwt_secret == _STRONG


def test_default_secret_rejected_in_production_mode() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        _settings(jwt_secret=DEV_JWT_SECRET, debug=False)


def test_short_secret_rejected_in_production_mode() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        _settings(jwt_secret="a" * 31, debug=False)


def test_blank_secret_rejected_in_production_mode() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        _settings(jwt_secret="   ", debug=False)


def test_default_secret_allowed_in_debug_mode() -> None:
    s = _settings(jwt_secret=DEV_JWT_SECRET, debug=True)
    assert s.jwt_secret == DEV_JWT_SECRET
