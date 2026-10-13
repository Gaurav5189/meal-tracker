"""Bulk meal updates (PRD §5.4 / ARCHITECTURE Phase 6).

Locked meals (older than 48h when locking is on) are skipped and counted,
never rejected. Everything happens in a single transaction.
"""

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models import Meal, User, UserSettings
from app.schemas.meals import BulkIn, BulkOut
from app.services import materialize
from app.services.lock import lock_cutoff


async def bulk_update(
    user: User, settings_row: UserSettings, data: BulkIn, db: AsyncSession
) -> BulkOut:
    # Same horizon guard as GET /meals: materializing an unbounded range would
    # build a huge INSERT and push materialized_through into the far future.
    if data.date_to > materialize.horizon_for(user):
        raise AppError(
            "validation_error",
            "Check the highlighted fields.",
            fields={"to": ["That date is too far in the future."]},
        )
    # Make sure rows exist for the whole range (extends the window when needed).
    await materialize.ensure_window(user, db, settings_row, through=data.date_to)

    filters = [
        Meal.user_id == user.id,
        Meal.meal_date >= data.date_from,
        Meal.meal_date <= data.date_to,
        Meal.meal_type.in_(data.meal_types),
    ]
    if settings_row.lock_past_meals:
        cutoff = lock_cutoff(user.tz)
        locked_skipped: int = (
            await db.scalar(
                select(func.count())
                .select_from(Meal)
                .where(*filters, Meal.meal_date < cutoff)
            )
            or 0
        )
        filters.append(Meal.meal_date >= cutoff)
    else:
        locked_skipped = 0

    result = await db.execute(
        update(Meal).where(*filters).values(taken=data.taken, taken_manual=True)
    )
    updated = result.rowcount or 0
    await db.commit()
    return BulkOut(updated=updated, locked_skipped=locked_skipped)
