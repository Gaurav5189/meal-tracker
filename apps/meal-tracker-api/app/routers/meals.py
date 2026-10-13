from uuid import UUID

from fastapi import APIRouter, Query

from app.deps import CsrfDep, CurrentUser, DbDep
from app.schemas.meals import BulkIn, BulkOut, MealOut, MealPatchIn, MealsMonthOut
from app.services import bulk as bulk_service
from app.services import meals as meals_service
from app.services.settings import get_settings_row

router = APIRouter(tags=["meals"])


@router.get("/meals")
async def list_meals(
    user: CurrentUser, db: DbDep, month: str = Query(...)
) -> MealsMonthOut:
    settings_row = await get_settings_row(user, db)
    return await meals_service.get_month(user, settings_row, month, db)


@router.patch("/meals/{meal_id}")
async def patch_meal(
    meal_id: UUID, payload: MealPatchIn, user: CurrentUser, _: CsrfDep, db: DbDep
) -> MealOut:
    settings_row = await get_settings_row(user, db)
    return await meals_service.patch_meal(user, settings_row, meal_id, payload, db)


@router.post("/meals/bulk")
async def bulk_meals(
    payload: BulkIn, user: CurrentUser, _: CsrfDep, db: DbDep
) -> BulkOut:
    settings_row = await get_settings_row(user, db)
    return await bulk_service.bulk_update(user, settings_row, payload, db)
