from fastapi import APIRouter

from app.deps import CsrfDep, CurrentUser, DbDep
from app.schemas.me import MeOut, NameUpdateIn, PasswordChangeIn
from app.services import auth as auth_service
from app.services import me as me_service

router = APIRouter(tags=["me"])


@router.get("/me")
async def me(user: CurrentUser) -> MeOut:
    return MeOut(username=user.username, name=user.name, tz=user.tz)


@router.patch("/me")
async def update_me(payload: NameUpdateIn, user: CurrentUser, _: CsrfDep, db: DbDep) -> MeOut:
    updated = await me_service.update_name(user, payload, db)
    return auth_service.me_out(updated)


@router.post("/me/password")
async def change_password(
    payload: PasswordChangeIn, user: CurrentUser, _: CsrfDep, db: DbDep
) -> dict[str, bool]:
    await me_service.change_password(user, payload, db)
    return {"ok": True}
