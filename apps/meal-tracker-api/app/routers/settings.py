from fastapi import APIRouter

from app.deps import CsrfDep, CurrentUser, DbDep
from app.schemas.settings import SettingsIn, SettingsOut
from app.services import settings as settings_service

router = APIRouter(tags=["settings"])


@router.get("/settings")
async def get_settings(user: CurrentUser, db: DbDep) -> SettingsOut:
    row = await settings_service.get_settings_row(user, db)
    return settings_service.settings_out(row)


@router.put("/settings")
async def update_settings(
    payload: SettingsIn, user: CurrentUser, _: CsrfDep, db: DbDep
) -> SettingsOut:
    row = await settings_service.update_settings(user, payload, db)
    return settings_service.settings_out(row)
