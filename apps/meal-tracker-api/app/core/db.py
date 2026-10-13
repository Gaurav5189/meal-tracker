from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings


def to_async_url(url: str) -> str:
    """Normalize a Postgres URL (e.g. Neon's `postgres://...`) for async SQLAlchemy + psycopg3."""
    if "+psycopg" in url:
        return url
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return url.replace(prefix, "postgresql+psycopg://", 1)
    return url


def _make_engine() -> AsyncEngine | None:
    if not settings.database_url:
        return None
    return create_async_engine(to_async_url(settings.database_url), pool_pre_ping=True)


engine = _make_engine()
SessionFactory = async_sessionmaker(engine, expire_on_commit=False) if engine else None
