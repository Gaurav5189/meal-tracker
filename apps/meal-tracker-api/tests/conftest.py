import asyncio
import os

# The TestClient speaks plain http, so Secure cookies would never be sent back.
os.environ.setdefault("COOKIE_SECURE", "false")
# Force a deterministic, non-default test secret regardless of the developer's local .env.
os.environ["JWT_SECRET"] = "test-secret-32-chars-0123456789abcdef0123456789abcde"

import pytest  # noqa: E402
from sqlalchemy import delete  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.models import User  # noqa: E402

DB_AVAILABLE = bool(settings.database_url)
TEST_USERNAME_PREFIX = "test_"


def pytest_collection_modifyitems(config, items):
    if DB_AVAILABLE:
        return
    skip_db = pytest.mark.skip(reason="DATABASE_URL not configured; DB tests skipped")
    for item in items:
        if "db" in item.keywords:
            item.add_marker(skip_db)


async def _delete_test_users() -> None:
    from app.core.db import SessionFactory

    assert SessionFactory is not None
    async with SessionFactory() as session:
        await session.execute(delete(User).where(User.username.startswith(TEST_USERNAME_PREFIX)))
        await session.commit()


@pytest.fixture
def clean_db():
    if not DB_AVAILABLE:
        yield
        return
    asyncio.run(_delete_test_users())
    yield
    asyncio.run(_delete_test_users())
