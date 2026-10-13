"""Phase 6: bulk actions — range, meal types, locking, single transaction."""

import asyncio
import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.db import SessionFactory
from app.core.security import CSRF_COOKIE
from app.main import app
from app.models import Meal, User

from .conftest import TEST_USERNAME_PREFIX

client = TestClient(app)


def _signup() -> str:
    client.post(
        "/api/v1/auth/signup",
        json={
            "name": "Test User",
            "username": TEST_USERNAME_PREFIX + uuid.uuid4().hex[:8],
            "password": "secret123",
            "tz": "Asia/Kolkata",
        },
    )
    return client.cookies.get(CSRF_COOKIE)


def _headers(csrf: str) -> dict[str, str]:
    return {"X-CSRF-Token": csrf}


def _bulk(csrf: str, date_from: date, date_to: date, **overrides):
    payload = {
        "from": date_from.isoformat(),
        "to": date_to.isoformat(),
        "meal_types": ["lunch", "dinner"],
        "taken": True,
        **overrides,
    }
    return client.post("/api/v1/meals/bulk", json=payload, headers=_headers(csrf))


def _today() -> date:
    return datetime.now(ZoneInfo("Asia/Kolkata")).date()


def _count_taken(meal_date: date | None = None, meal_type: str | None = None) -> int:
    async def _run() -> int:
        assert SessionFactory is not None
        async with SessionFactory() as session:
            user = (
                await session.execute(
                    select(User).where(User.username.startswith(TEST_USERNAME_PREFIX))
                )
            ).scalar_one()
            filters = [Meal.user_id == user.id, Meal.taken.is_(True)]
            if meal_date is not None:
                filters.append(Meal.meal_date == meal_date)
            if meal_type is not None:
                filters.append(Meal.meal_type == meal_type)
            return (
                await session.scalar(select(func.count()).select_from(Meal).where(*filters)) or 0
            )

    return asyncio.run(_run())


@pytest.mark.db
def test_bulk_requires_session_and_csrf(clean_db):
    assert client.post("/api/v1/meals/bulk", json={}).status_code == 401
    _signup()
    assert client.post("/api/v1/meals/bulk", json={}).status_code == 403


@pytest.mark.db
def test_bulk_validates_range_and_types(clean_db):
    csrf = _signup()
    today = _today()
    # from after to
    res = _bulk(csrf, today + timedelta(days=2), today)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"
    # unknown meal type
    res = client.post(
        "/api/v1/meals/bulk",
        json={
            "from": today.isoformat(),
            "to": today.isoformat(),
            "meal_types": ["breakfast"],
            "taken": True,
        },
        headers=_headers(csrf),
    )
    assert res.status_code == 422
    # empty types
    res = client.post(
        "/api/v1/meals/bulk",
        json={
            "from": today.isoformat(),
            "to": today.isoformat(),
            "meal_types": [],
            "taken": True,
        },
        headers=_headers(csrf),
    )
    assert res.status_code == 422
    # unknown field
    res = client.post(
        "/api/v1/meals/bulk",
        json={
            "from": today.isoformat(),
            "to": today.isoformat(),
            "meal_types": ["lunch"],
            "taken": True,
            "hax": 1,
        },
        headers=_headers(csrf),
    )
    assert res.status_code == 422


@pytest.mark.db
def test_bulk_marks_range_taken(clean_db):
    csrf = _signup()
    today = _today()
    date_from = today + timedelta(days=1)
    date_to = today + timedelta(days=4)  # 4 days x 2 meals

    # Future rows start out taken (upcoming default on): bulk-skip them first.
    res = _bulk(csrf, date_from, date_to, taken=False)
    assert res.status_code == 200
    body = res.json()
    assert body["updated"] == 8
    assert body["locked_skipped"] == 0
    assert _count_taken(date_from, "lunch") == 0
    assert _count_taken(date_to, "dinner") == 0
    # Outside the range, materialized defaults are untouched.
    assert _count_taken(today + timedelta(days=5)) == 2

    # Mark the same range taken again.
    res = _bulk(csrf, date_from, date_to, taken=True)
    assert res.status_code == 200
    assert res.json()["updated"] == 8
    assert _count_taken(date_from, "lunch") == 1
    assert _count_taken(date_to, "dinner") == 1


@pytest.mark.db
def test_bulk_lunch_only_leaves_dinner(clean_db):
    csrf = _signup()
    today = _today()
    res = _bulk(csrf, today, today, meal_types=["lunch"], taken=True)
    assert res.status_code == 200
    assert res.json()["updated"] == 1
    assert _count_taken(today, "lunch") == 1
    assert _count_taken(today, "dinner") == 1  # default, not from bulk


@pytest.mark.db
def test_bulk_skips_locked_and_counts_them(clean_db):
    csrf = _signup()
    headers = _headers(csrf)
    today = _today()
    old_date = today - timedelta(days=5)

    # Seed one old (locked) row and yesterday's two meals (not locked) so bulk
    # has something to skip and something to update.
    async def _seed() -> None:
        assert SessionFactory is not None
        async with SessionFactory() as session:
            user = (
                await session.execute(
                    select(User).where(User.username.startswith(TEST_USERNAME_PREFIX))
                )
            ).scalar_one()
            session.add_all(
                [
                    Meal(
                        user_id=user.id,
                        meal_date=old_date,
                        meal_type="lunch",
                        taken=False,
                        price=35,
                    ),
                    Meal(
                        user_id=user.id,
                        meal_date=today - timedelta(days=1),
                        meal_type="lunch",
                        taken=False,
                        price=35,
                    ),
                    Meal(
                        user_id=user.id,
                        meal_date=today - timedelta(days=1),
                        meal_type="dinner",
                        taken=False,
                        price=35,
                    ),
                ]
            )
            await session.commit()

    asyncio.run(_seed())

    # Enable locking.
    res = client.put(
        "/api/v1/settings",
        json={
            "currency": "INR",
            "lunch_price": "35",
            "dinner_price": "35",
            "dinner_same_as_lunch": True,
            "upcoming_default_on": True,
            "lock_past_meals": True,
        },
        headers=headers,
    )
    assert res.status_code == 200

    # Range spans 7 past days: the seeded old row is locked (skipped and
    # counted); yesterday's two seeded rows are recent and get updated.
    res = _bulk(csrf, today - timedelta(days=7), today - timedelta(days=1), taken=True)
    assert res.status_code == 200
    body = res.json()
    assert body["updated"] == 2
    assert body["locked_skipped"] == 1
    assert _count_taken(old_date, "lunch") == 0  # locked row untouched
    assert _count_taken(today - timedelta(days=1), "lunch") == 1

    # A recent day (within 48h) is not locked and can be bulk-edited.
    res = _bulk(csrf, today - timedelta(days=1), today - timedelta(days=1), taken=True)
    assert res.json()["updated"] == 2
    assert res.json()["locked_skipped"] == 0
