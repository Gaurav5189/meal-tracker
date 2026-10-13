"""Cross-cutting HTTP middleware: access logging + baseline security headers.

Access logs go to the "meal-tracker.access" logger, which Azure App Service
streams to its log console. Security headers are set here (not only in the
frontend host's `_headers` file) because proxied `/api/*` responses keep the
API's headers, while the static `_headers` rules only apply to Pages assets.
"""

import logging
import time
from collections.abc import Awaitable, Callable

from fastapi import Request, Response

logger = logging.getLogger("meal-tracker.access")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}

# Health checks fire constantly from uptime probes; keep them out of the log.
_QUIET_PATHS = {"/health"}


async def access_log_and_headers(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000

    if request.url.path not in _QUIET_PATHS:
        logger.info(
            "%s %s -> %s (%.1fms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )

    for header, value in SECURITY_HEADERS.items():
        response.headers.setdefault(header, value)
    return response
