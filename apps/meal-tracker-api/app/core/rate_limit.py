"""In-memory sliding-window rate limiter.

Note: the docs list `slowapi`, but its key function cannot read the JSON body,
so login/signup could not be keyed per IP+username as ARCHITECTURE §6 requires.
This ~30-line limiter implements the documented rule directly. If the app ever
runs with multiple API instances, swap in a shared store.
"""

import time
from collections import defaultdict, deque

from app.core.errors import AppError

_MAX_KEYS = 10_000


class RateLimiter:
    def __init__(self) -> None:
        self._hits: defaultdict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int, per_seconds: int) -> None:
        now = time.monotonic()
        hits = self._hits[key]
        cutoff = now - per_seconds
        while hits and hits[0] <= cutoff:
            hits.popleft()
        if len(hits) >= limit:
            raise AppError("rate_limited", "Too many attempts. Try again in a minute.")
        hits.append(now)
        # Best-effort cleanup so abandoned keys can't grow the dict forever.
        if len(self._hits) > _MAX_KEYS:
            for stale_key in list(self._hits):
                if not self._hits[stale_key] or self._hits[stale_key][-1] <= cutoff:
                    del self._hits[stale_key]


rate_limiter = RateLimiter()

AUTH_LIMIT = 5  # per minute, per IP+username (login and signup)
USER_LIMIT = 120  # per minute, per user (authenticated requests)
