import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.security import CSRF_COOKIE
from app.main import app

from .conftest import TEST_USERNAME_PREFIX

client = TestClient(app)


def _signup(username: str | None = None, password: str = "secret123") -> dict:
    body = {
        "name": "Test User",
        "username": username or TEST_USERNAME_PREFIX + uuid.uuid4().hex[:8],
        "password": password,
        "tz": "Asia/Kolkata",
    }
    res = client.post("/api/v1/auth/signup", json=body)
    assert res.status_code == 201
    return body


def _csrf_headers() -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get(CSRF_COOKIE)}


@pytest.mark.db
def test_patch_me_updates_name(clean_db):
    body = _signup()
    res = client.patch("/api/v1/me", json={"name": "Carlita"}, headers=_csrf_headers())
    assert res.status_code == 200
    assert res.json()["name"] == "Carlita"
    assert client.get("/api/v1/me").json()["name"] == "Carlita"
    assert res.json()["username"] == body["username"]


@pytest.mark.db
def test_patch_me_rejects_blank_name(clean_db):
    _signup()
    res = client.patch("/api/v1/me", json={"name": "   "}, headers=_csrf_headers())
    assert res.status_code == 422
    error = res.json()["error"]
    assert error["code"] == "validation_error"
    assert "name" in error["fields"]


@pytest.mark.db
def test_patch_me_requires_csrf(clean_db):
    _signup()
    res = client.patch("/api/v1/me", json={"name": "No Csrf"})
    assert res.status_code == 403


@pytest.mark.db
def test_change_password_requires_correct_current_password(clean_db):
    body = _signup()
    res = client.post(
        "/api/v1/me/password",
        json={"current_password": "wrongpass99", "new_password": "brandnew456"},
        headers=_csrf_headers(),
    )
    assert res.status_code == 422
    error = res.json()["error"]
    assert "current_password" in error["fields"]

    # The old password must still work after a failed attempt.
    client.cookies.clear()
    res_login = client.post(
        "/api/v1/auth/login", json={"username": body["username"], "password": "secret123"}
    )
    assert res_login.status_code == 200


@pytest.mark.db
def test_change_password_success_then_login_with_new_password(clean_db):
    body = _signup()
    res = client.post(
        "/api/v1/me/password",
        json={"current_password": "secret123", "new_password": "brandnew456"},
        headers=_csrf_headers(),
    )
    assert res.status_code == 200
    assert res.json() == {"ok": True}

    client.cookies.clear()
    old_login = client.post(
        "/api/v1/auth/login", json={"username": body["username"], "password": "secret123"}
    )
    assert old_login.status_code == 401
    new_login = client.post(
        "/api/v1/auth/login", json={"username": body["username"], "password": "brandnew456"}
    )
    assert new_login.status_code == 200


@pytest.mark.db
def test_change_password_validation_errors(clean_db):
    _signup()
    res = client.post(
        "/api/v1/me/password",
        json={"current_password": "", "new_password": "short"},
        headers=_csrf_headers(),
    )
    assert res.status_code == 422
    assert set(res.json()["error"]["fields"]) == {"current_password", "new_password"}
