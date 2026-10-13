import logging
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("meal-tracker")

HTTP_STATUS_BY_CODE = {
    "bad_request": 400,
    "unauthenticated": 401,
    "forbidden": 403,
    "not_found": 404,
    "conflict": 409,
    "validation_error": 422,
    "locked": 423,
    "rate_limited": 429,
    "internal_error": 500,
}


class AppError(Exception):
    """Typed API error; rendered as {"error": {code, message, fields?}} by the global handler."""

    def __init__(
        self, code: str, message: str, *, fields: dict[str, list[str]] | None = None
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.fields = fields
        self.status_code = HTTP_STATUS_BY_CODE.get(code, 500)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        body: dict[str, object] = {"code": exc.code, "message": exc.message}
        if exc.fields:
            body["fields"] = exc.fields
        return JSONResponse(status_code=exc.status_code, content={"error": body})

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        fields: dict[str, list[str]] = {}
        for err in exc.errors():
            if err.get("type") == "json_invalid":
                return JSONResponse(
                    status_code=422,
                    content={"error": {"code": "validation_error", "message": "Invalid JSON body"}},
                )
            field = ".".join(str(part) for part in err["loc"][1:])
            fields.setdefault(field, []).append(err["msg"])
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Check the highlighted fields.",
                    "fields": fields,
                }
            },
        )

    @app.exception_handler(Exception)
    async def internal_error_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = uuid4().hex[:12]
        logger.exception("Internal error request_id=%s path=%s", request_id, request.url.path)
        response = JSONResponse(
            status_code=500,
            content={
                "error": {"code": "internal_error", "message": "Something went wrong on our end."}
            },
        )
        response.headers["X-Request-Id"] = request_id
        return response
