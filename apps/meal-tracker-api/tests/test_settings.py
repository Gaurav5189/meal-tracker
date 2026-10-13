import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.security import CSRF_COOKIE
from app.main import app

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


def _csrf_headers(csrf: str) -> dict[str, str]:
    return {"X-CSRF-Token": csrf}


def _put(payload: dict, csrf: str):
    return client.put("/api/v1/settings", json=payload, headers=_csrf_headers(csrf))


@pytest.mark.db
def test_get_settings_returns_signup_defaults(clean_db):
    _signup()
    res = client.get("/api/v1/settings")
    assert res.status_code == 200
    assert res.json() == {
        "currency": "INR",
        "lunch_price": "35.00",
        "dinner_price": "35.00",
        "dinner_same_as_lunch": True,
        "upcoming_default_on": True,
        "lock_past_meals": False,
    }


@pytest.mark.db
def test_settings_require_session(clean_db):
    client.cookies.clear()
    assert client.get("/api/v1/settings").status_code == 401


@pytest.mark.db
def test_put_settings_requires_csrf(clean_db):
    _signup()
    res = client.put("/api/v1/settings", json={})
    assert res.status_code == 403


@pytest.mark.db
def test_put_settings_persists(clean_db):
    csrf = _signup()
    res = _put(
        {
            "currency": "USD",
            "lunch_price": "4.50",
            "dinner_price": "5.25",
            "dinner_same_as_lunch": False,
            "upcoming_default_on": False,
            "lock_past_meals": True,
        },
        csrf,
    )
    assert res.status_code == 200
    assert res.json() == {
        "currency": "USD",
        "lunch_price": "4.50",
        "dinner_price": "5.25",
        "dinner_same_as_lunch": False,
        "upcoming_default_on": False,
        "lock_past_meals": True,
    }
    assert client.get("/api/v1/settings").json() == res.json()


@pytest.mark.db
def test_put_settings_mirrors_dinner_when_same_as_lunch(clean_db):
    csrf = _signup()
    res = _put(
        {
            "currency": "INR",
            "lunch_price": "40.00",
            "dinner_price": "99.00",  # ignored: same-as-lunch wins
            "dinner_same_as_lunch": True,
            "upcoming_default_on": True,
            "lock_past_meals": False,
        },
        csrf,
    )
    assert res.status_code == 200
    assert res.json()["dinner_price"] == "40.00"


@pytest.mark.db
def test_put_settings_rejects_negative_price(clean_db):
    csrf = _signup()
    res = _put(
        {
            "currency": "INR",
            "lunch_price": "-1",
            "dinner_price": "35",
            "dinner_same_as_lunch": False,
            "upcoming_default_on": True,
            "lock_past_meals": False,
        },
        csrf,
    )
    assert res.status_code == 422
    error = res.json()["error"]
    assert error["code"] == "validation_error"
    assert "lunch_price" in error["fields"]


@pytest.mark.db
def test_put_settings_rejects_unknown_currency(clean_db):
    csrf = _signup()
    res = _put(
        {
            "currency": "XXX",
            "lunch_price": "35",
            "dinner_price": "35",
            "dinner_same_as_lunch": True,
            "upcoming_default_on": True,
            "lock_past_meals": False,
        },
        csrf,
    )
    assert res.status_code == 422
    assert "currency" in res.json()["error"]["fields"]


@pytest.mark.db
def test_put_settings_rejects_unknown_fields(clean_db):
    csrf = _signup()
    payload = {
        "currency": "INR",
        "lunch_price": "35",
        "dinner_price": "35",
        "dinner_same_as_lunch": True,
        "upcoming_default_on": True,
        "lock_past_meals": False,
        "hax": True,
    }
    assert _put(payload, csrf).status_code == 422
