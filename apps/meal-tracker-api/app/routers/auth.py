from fastapi import APIRouter, Request, Response

from app.core.security import clear_auth_cookies, set_auth_cookies
from app.deps import CsrfDep, CurrentUser, DbDep
from app.schemas.auth import LoginIn, SignupIn
from app.schemas.me import MeOut
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.post("/signup", status_code=201)
async def signup(payload: SignupIn, request: Request, response: Response, db: DbDep) -> MeOut:
    user = await auth_service.signup(payload, _client_ip(request), db)
    set_auth_cookies(response, user.id)
    return MeOut(username=user.username, name=user.name, tz=user.tz)


@router.post("/login")
async def login(payload: LoginIn, request: Request, response: Response, db: DbDep) -> MeOut:
    user = await auth_service.login(payload, _client_ip(request), db)
    set_auth_cookies(response, user.id)
    return MeOut(username=user.username, name=user.name, tz=user.tz)


@router.post("/logout")
async def logout(user: CurrentUser, _: CsrfDep, response: Response) -> dict[str, bool]:
    clear_auth_cookies(response)
    return {"ok": True}
