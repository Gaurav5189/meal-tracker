"""Phase 5: settings changes propagate to future non-manual rows only."""

import asyncio
import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

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


def _put_settings(csrf: str, **overrides):
    payload = {
        "currency": "INR",
        "lunch_price": "35",
        "dinner_price": "35",
        "dinner_same_as_lunch": True,
        "upcoming_default_on": True,
        "lock_past_meals": False,
        **overrides,
    }
    return client.put("/api/v1/settings", json=payload, headers=_headers(csrf))


def _today() -> date:
    return datetime.now(ZoneInfo("Asia/Kolkata")).date()


def _fetch_meal(meal_date: date, meal_type: str) -> dict:
    """Load a meal row straight from the DB (bypasses materialization side effects)."""

    async def _run() -> dict:
        assert SessionFactory is not None
        async with SessionFactory() as session:
            user = (
                await session.execute(
                    select(User).where(User.username.startswith(TEST_USERNAME_PREFIX))
                )
            ).scalar_one()
            row = (
                await session.execute(
                    select(Meal).where(
                        Meal.user_id == user.id,
                        Meal.meal_date == meal_date,
                        Meal.meal_type == meal_type,
                    )
                )
            ).scalar_one()
            return {
                "taken": row.taken,
                "taken_manual": row.taken_manual,
                "price": str(row.price),
                "price_overridden": row.price_overridden,
            }

    return asyncio.run(_run())


@pytest.mark.db
def test_price_change_propagates_to_future_non_overridden_rows(clean_db):
    csrf = _signup()
    headers = _headers(csrf)
    today = _today()
    future = today + timedelta(days=10)
    month = f"{future.year:04d}-{future.month:02d}"

    # Materialize, then hand-edit one future price (override marker set).
    month_payload = client.get("/api/v1/meals", params={"month": month}).json()
    day = next(d for d in month_payload["days"] if d["date"] == future.isoformat())
    overridden_id = day["dinner"]["id"]

    res = client.patch(
        f"/api/v1/meals/{overridden_id}", json={"price": "99"}, headers=headers
    )
    assert res.status_code == 200

    # Change the defaults (dinner different from lunch now).
    assert _put_settings(
        csrf, lunch_price="40", dinner_price="50", dinner_same_as_lunch=False
    ).status_code == 200

    # Non-overridden future rows got the new defaults.
    assert _fetch_meal(future, "lunch")["price"] == "40.00"
    # The manually priced row survived (custom price is never clobbered).
    overridden = _fetch_meal(future, "dinner")
    assert overridden["price"] == "99.00"
    assert overridden["price_overridden"] is True

    # Today's rows are never touched: still the OLD default.
    assert _fetch_meal(today, "lunch")["price"] == "35.00"


@pytest.mark.db
def test_taken_default_propagates_but_manual_rows_survive(clean_db):
    csrf = _signup()
    headers = _headers(csrf)
    today = _today()
    future = today + timedelta(days=10)
    month = f"{future.year:04d}-{future.month:02d}"

    month_payload = client.get("/api/v1/meals", params={"month": month}).json()
    day = next(d for d in month_payload["days"] if d["date"] == future.isoformat())
    manual_id = day["lunch"]["id"]

    # Manually skip one future lunch (marks taken_manual).
    res = client.patch(f"/api/v1/meals/{manual_id}", json={"taken": False}, headers=headers)
    assert res.status_code == 200

    # Flip the upcoming default to off.
    assert _put_settings(csrf, upcoming_default_on=False).status_code == 200

    # Non-manual future rows flipped to skipped.
    dinner = _fetch_meal(future, "dinner")
    assert dinner["taken"] is False
    assert dinner["taken_manual"] is False
    # The manual row survived.
    manual = _fetch_meal(future, "lunch")
    assert manual["taken"] is False
    assert manual["taken_manual"] is True

    # Today's meals are never changed by settings edits (still default-on).
    today_lunch = _fetch_meal(today, "lunch")
    assert today_lunch["taken"] is True
    assert today_lunch["taken_manual"] is False


@pytest.mark.db
def test_re_enabling_default_applies_only_to_future(clean_db):
    csrf = _signup()
    today = _today()
    yesterday = today - timedelta(days=1)

    # Seed a real row for yesterday (materialization never creates pre-signup
    # days), then default-off: future rows skipped. Yesterday: manually taken.
    assert _put_settings(csrf, upcoming_default_on=False).status_code == 200
    _seed_meal(yesterday, taken=False)
    month = f"{today.year:04d}-{today.month:02d}"
    month_payload = client.get("/api/v1/meals", params={"month": month}).json()
    day = next(d for d in month_payload["days"] if d["date"] == yesterday.isoformat())
    client.patch(
        f"/api/v1/meals/{day['lunch']['id']}", json={"taken": True}, headers=_headers(csrf)
    )

    # Default back on: only strictly-future rows flip.
    assert _put_settings(csrf, upcoming_default_on=True).status_code == 200
    assert _fetch_meal(today + timedelta(days=5), "dinner")["taken"] is True
    assert _fetch_meal(yesterday, "lunch")["taken"] is True  # manual past row untouched


def _seed_meal(meal_date: date, *, taken: bool) -> None:
    async def _run() -> None:
        assert SessionFactory is not None
        async with SessionFactory() as session:
            user = (
                await session.execute(
                    select(User).where(User.username.startswith(TEST_USERNAME_PREFIX))
                )
            ).scalar_one()
            session.add(
                Meal(user_id=user.id, meal_date=meal_date, meal_type="lunch", taken=taken, price=35)
            )
            await session.commit()

    asyncio.run(_run())


@pytest.mark.db
def test_gap_days_are_filled_with_old_defaults(clean_db):
    """§4.1 invariant: ensure_window runs before the new defaults land."""
    csrf = _signup()
    today = _today()
    # Simulate a user absent for 3 days: rewind materialized_through.
    from sqlalchemy import update

    async def _rewind() -> None:
        assert SessionFactory is not None
        async with SessionFactory() as session:
            await session.execute(
                update(User)
                .where(User.username.startswith(TEST_USERNAME_PREFIX))
                .values(materialized_through=today - timedelta(days=4))
            )
            await session.commit()

    asyncio.run(_rewind())

    # A settings change now must fill the 3 gap days with the OLD defaults
    # (35.00, skipped) before applying the new ones.
    assert _put_settings(
        csrf, lunch_price="40", dinner_price="40", dinner_same_as_lunch=True
    ).status_code == 200

    gap_day = today - timedelta(days=2)
    gap = _fetch_meal(gap_day, "lunch")
    assert gap["price"] == "35.00"  # old default, not the new 40
    assert gap["taken"] is False  # past gap day stays skipped
    # Future rows use the new default.
    assert _fetch_meal(today + timedelta(days=3), "lunch")["price"] == "40.00"
