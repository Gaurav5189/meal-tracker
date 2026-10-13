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


def _signup(tz: str = "Asia/Kolkata") -> str:
    client.post(
        "/api/v1/auth/signup",
        json={
            "name": "Test User",
            "username": TEST_USERNAME_PREFIX + uuid.uuid4().hex[:8],
            "password": "secret123",
            "tz": tz,
        },
    )
    return client.cookies.get(CSRF_COOKIE)


def _csrf_headers(csrf: str) -> dict[str, str]:
    return {"X-CSRF-Token": csrf}


def _headers() -> dict[str, str]:
    return _csrf_headers(client.cookies.get(CSRF_COOKIE))


def _get(month: str):
    return client.get("/api/v1/meals", params={"month": month})


def _month_str(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _iso(d: date) -> str:
    return d.isoformat()


def _day(payload: dict, iso_date: str) -> dict:
    return next(day for day in payload["days"] if day["date"] == iso_date)


def _meal_id(payload: dict, iso_date: str, meal_type: str) -> str:
    meal = _day(payload, iso_date)[meal_type]
    assert meal["id"] is not None, f"expected a materialized {meal_type} on {iso_date}"
    return str(meal["id"])


def _today(tz: str = "Asia/Kolkata") -> date:
    return datetime.now(ZoneInfo(tz)).date()


def _seed_meals(rows: list[Meal]) -> None:
    async def _run() -> None:
        assert SessionFactory is not None
        async with SessionFactory() as session:
            user = (
                await session.execute(
                    select(User).where(User.username.startswith(TEST_USERNAME_PREFIX))
                )
            ).scalar_one()
            for row in rows:
                row.user_id = user.id
                session.add(row)
            await session.commit()

    asyncio.run(_run())


@pytest.mark.db
def test_get_meals_requires_session(clean_db):
    assert _get("2026-01").status_code == 401


@pytest.mark.db
def test_get_meals_rejects_bad_month(clean_meals):
    _signup()
    assert _get("2026-13").status_code == 422
    assert _get("not-a-month").status_code == 422
    assert _get("2026-1").status_code == 422
    assert "month" in _get("2026-1").json()["error"]["fields"]


@pytest.mark.db
def test_get_meals_rejects_month_past_horizon(clean_meals):
    """A far month must 422 BEFORE materializing: otherwise one request inserts
    millions of rows and pushes materialized_through into the far future, which
    would permanently stop gap-filling."""
    _signup()
    res = _get("9999-12")
    assert res.status_code == 422
    assert res.json()["error"]["fields"]["month"] == ["That month is too far in the future."]
    # Regression: the near month still materializes real rows (id not null),
    # proving materialized_through was not pushed past the horizon.
    today = _today()
    ok = _get(_month_str(today))
    assert ok.status_code == 200
    assert _day(ok.json(), _iso(today))["lunch"]["id"] is not None


@pytest.mark.db
def test_get_meals_materializes_current_month(clean_meals):
    _signup()
    today = _today()
    res = _get(_month_str(today))
    assert res.status_code == 200
    payload = res.json()
    assert payload["currency"] == "INR"
    assert payload["today"] == _iso(today)
    # Upcoming default is on: today + every strictly-future day of the month is
    # taken at 35.00 (the demo marks upcoming meals by default).
    nxt = date(today.year + (today.month == 12), today.month % 12 + 1, 1)
    month_end = date.fromordinal(nxt.toordinal() - 1)
    taken_days = (month_end - today).days + 1
    assert payload["taken_count"] == 2 * taken_days
    assert float(payload["total"]) == pytest.approx(2 * taken_days * 35.0)
    today_row = _day(payload, _iso(today))
    assert today_row["lunch"]["taken"] is True
    assert today_row["dinner"]["taken"] is True
    # The 60-day window ahead is materialized with real rows.
    window_end = today + timedelta(days=60)
    far = _get(_month_str(window_end)).json()
    assert far["days"][-1]["lunch"]["id"] is not None


@pytest.mark.db
def test_get_meals_synthesizes_pre_signup_days(clean_meals):
    _signup()
    today = _today()
    payload = _get(_month_str(today)).json()
    # Days before the signup date have no rows: skipped placeholders, read-only.
    if today.day > 1:  # only when the month started before signup
        first = payload["days"][0]
        assert first["lunch"]["id"] is None
        assert first["lunch"]["taken"] is False
        assert first["lunch"]["price"] == "35.00"


@pytest.mark.db
def test_patch_meal_taken_updates_totals(clean_meals):
    _signup()
    today = _today()
    month = _month_str(today)
    before = _get(month).json()
    meal_id = _meal_id(before, _iso(today), "lunch")

    res = client.patch(f"/api/v1/meals/{meal_id}", json={"taken": False}, headers=_headers())
    assert res.status_code == 200
    body = res.json()
    assert body["taken"] is False
    assert set(body) == {"id", "taken", "price", "price_overridden", "locked"}

    after = _get(month).json()
    assert after["taken_count"] == before["taken_count"] - 1
    assert float(after["total"]) == pytest.approx(float(before["total"]) - 35.0)

    # Mutations require CSRF.
    assert client.patch(f"/api/v1/meals/{meal_id}", json={"taken": True}).status_code == 403


@pytest.mark.db
def test_patch_meal_price_override_and_reset(clean_meals):
    _signup()
    today = _today()
    month = _month_str(today)
    before = _get(month).json()
    meal_id = _meal_id(before, _iso(today), "dinner")
    headers = _headers()

    res = client.patch(f"/api/v1/meals/{meal_id}", json={"price": "55.5"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["price"] == "55.50"
    assert res.json()["price_overridden"] is True

    after = _get(month).json()
    assert float(after["total"]) == pytest.approx(float(before["total"]) + 20.5)

    # price: null resets to the default and clears the override marker.
    res = client.patch(f"/api/v1/meals/{meal_id}", json={"price": None}, headers=headers)
    assert res.status_code == 200
    assert res.json()["price"] == "35.00"
    assert res.json()["price_overridden"] is False
    restored = _get(month).json()
    assert float(restored["total"]) == pytest.approx(float(before["total"]))


@pytest.mark.db
def test_patch_meal_rejects_bad_payload(clean_meals):
    _signup()
    today = _today()
    meal_id = _meal_id(_get(_month_str(today)).json(), _iso(today), "lunch")
    headers = _headers()

    assert client.patch(f"/api/v1/meals/{meal_id}", json={}, headers=headers).status_code == 422
    assert (
        client.patch(f"/api/v1/meals/{meal_id}", json={"price": "-1"}, headers=headers).status_code
        == 422
    )
    res = client.patch(f"/api/v1/meals/{meal_id}", json={"hax": 1}, headers=headers)
    assert res.status_code == 422
    assert (
        client.patch(
            f"/api/v1/meals/{uuid.uuid4()}", json={"taken": True}, headers=headers
        ).status_code
        == 404
    )


@pytest.mark.db
def test_lock_past_meals_returns_423(clean_meals):
    _signup()
    headers = _headers()
    today = _today()
    old_date = today - timedelta(days=3)  # older than 48h
    recent_date = today - timedelta(days=1)  # inside the 48h grace period
    _seed_meals(
        [
            Meal(user_id=uuid.uuid4(), meal_date=old_date, meal_type="lunch", taken=True, price=35),
            Meal(
                user_id=uuid.uuid4(), meal_date=recent_date, meal_type="lunch", taken=True, price=35
            ),
        ]
    )
    payload = _get(_month_str(today)).json()
    old_id = _meal_id(payload, _iso(old_date), "lunch")
    recent_id = _meal_id(payload, _iso(recent_date), "lunch")

    # Locking is off by default: past meals stay editable.
    assert (
        client.patch(f"/api/v1/meals/{old_id}", json={"taken": False}, headers=headers).status_code
        == 200
    )

    # Turn the lock on via settings.
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

    payload = _get(_month_str(today)).json()
    assert _day(payload, _iso(old_date))["lunch"]["locked"] is True
    assert _day(payload, _iso(recent_date))["lunch"]["locked"] is False

    locked_res = client.patch(f"/api/v1/meals/{old_id}", json={"taken": True}, headers=headers)
    assert locked_res.status_code == 423
    assert locked_res.json()["error"]["code"] == "locked"

    # Meals within the last 48h stay editable.
    assert (
        client.patch(
            f"/api/v1/meals/{recent_id}", json={"taken": False}, headers=headers
        ).status_code
        == 200
    )
