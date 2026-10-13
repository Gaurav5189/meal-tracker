from fastapi import APIRouter

from app.deps import CurrentUser
from app.schemas.me import MeOut

router = APIRouter(tags=["me"])


@router.get("/me")
async def me(user: CurrentUser) -> MeOut:
    return MeOut(username=user.username, name=user.name, tz=user.tz)
