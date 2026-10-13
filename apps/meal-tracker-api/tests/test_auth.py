import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.security import CSRF_COOKIE, SESSION_COOKIE
from app.main import app

from .conftest import TEST_USERNAME_PREFIX

client = TestClient(app)


def _username() -> str:
    return TEST_USERNAME_PREFIX + uuid.uuid4().hex[:8]


def _signup_body(username=None):
    return {
        "name": "Test User",
        "username": username or _username(),
        "password": "secret123",
        "tz": "Asia/Kolkata",
    }


@pytest.mark.db
def test_signup_creates_user_and_sets_cookies(clean_db):
    body = _signup_body()
    res = client.post("/api/v1/auth/signup", json=body)
    assert res.status_code == 201
    assert res.json() == {"username": body["username"], "name": "Test User", "tz": "Asia/Kolkata"}
    assert SESSION_COOKIE in client.cookies
    assert CSRF_COOKIE in client.cookies
    # Session cookie works immediately.
    me = client.get("/api/v1/me")
    assert me.status_code == 200
    assert me.json()["username"] == body["username"]


@pytest.mark.db
def test_signup_duplicate_username_rejected(clean_db):
    body = _signup_body()
    assert client.post("/api/v1/auth/signup", json=body).status_code == 201
    res = client.post("/api/v1/auth/signup", json=_signup_body(body["username"]))
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "conflict"
    assert "username" in res.json()["error"]["fields"]


@pytest.mark.db
def test_signup_validation_errors(clean_db):
    res = client.post(
        "/api/v1/auth/signup",
        json={"name": "  ", "username": "Bad Name!", "password": "short", "tz": "Not/AZone"},
    )
    assert res.status_code == 422
    error = res.json()["error"]
    assert error["code"] == "validation_error"
    assert set(error["fields"]) == {"name", "username", "password", "tz"}


@pytest.mark.db
def test_signup_rejects_unknown_fields(clean_db):
    res = client.post("/api/v1/auth/signup", json={**_signup_body(), "is_admin": True})
    assert res.status_code == 422


@pytest.mark.db
def test_login_success_updates_timezone(clean_db):
    body = _signup_body()
    client.post("/api/v1/auth/signup", json=body)
    client.cookies.clear()
    res = client.post(
        "/api/v1/auth/login",
        json={"username": body["username"], "password": "secret123", "tz": "Europe/Paris"},
    )
    assert res.status_code == 200
    assert res.json()["tz"] == "Europe/Paris"
    assert client.get("/api/v1/me").json()["tz"] == "Europe/Paris"


@pytest.mark.db
def test_login_wrong_password_generic_error(clean_db):
    res = client.post(
        "/api/v1/auth/login", json={"username": "nobody_here", "password": "whatever123"}
    )
    assert res.status_code == 401
    body = res.json()["error"]
    assert body["code"] == "unauthenticated"
    assert body["message"] == "Invalid username or password."
    assert not body.get("fields")


@pytest.mark.db
def test_login_unknown_user_same_message_as_wrong_password(clean_db):
    body = _signup_body()
    client.post("/api/v1/auth/signup", json=body)
    wrong_pw = client.post(
        "/api/v1/auth/login", json={"username": body["username"], "password": "wrongpass99"}
    )
    unknown_user = client.post(
        "/api/v1/auth/login", json={"username": "ghost_user", "password": "wrongpass99"}
    )
    assert wrong_pw.status_code == unknown_user.status_code == 401
    assert wrong_pw.json() == unknown_user.json()


@pytest.mark.db
def test_me_requires_session(clean_db):
    client.cookies.clear()
    res = client.get("/api/v1/me")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "unauthenticated"


@pytest.mark.db
def test_logout_requires_csrf(clean_db):
    client.post("/api/v1/auth/signup", json=_signup_body())
    res = client.post("/api/v1/auth/logout")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "forbidden"


@pytest.mark.db
def test_logout_clears_session(clean_db):
    client.post("/api/v1/auth/signup", json=_signup_body())
    res = client.post(
        "/api/v1/auth/logout", headers={"X-CSRF-Token": client.cookies.get(CSRF_COOKIE)}
    )
    assert res.status_code == 200
    assert res.json() == {"ok": True}
    me = client.get("/api/v1/me")
    assert me.status_code == 401


@pytest.mark.db
def test_login_rate_limited_after_five_attempts(clean_db):
    username = _username()
    for _ in range(5):
        res = client.post(
            "/api/v1/auth/login", json={"username": username, "password": "badpassword1"}
        )
        assert res.status_code == 401
    res = client.post("/api/v1/auth/login", json={"username": username, "password": "badpassword1"})
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "rate_limited"
