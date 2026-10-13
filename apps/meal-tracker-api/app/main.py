from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.errors import register_error_handlers
from app.routers import auth, me, meals
from app.routers import settings as settings_router


def create_app() -> FastAPI:
    app = FastAPI(title="Meal Tracker API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_error_handlers(app)

    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(me.router, prefix="/api/v1")
    app.include_router(settings_router.router, prefix="/api/v1")
    app.include_router(meals.router, prefix="/api/v1")

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
