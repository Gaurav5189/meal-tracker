# Security

This is an early-phase demo; do not use for sensitive production data without a security audit.

## Reporting

Open a private issue with reproduction steps. Don't post exploits in public.

## Known controls

- JWT cookie auth (`Secure`, `HttpOnly`, `SameSite=Lax`) with argon2id password hashes.
- CSRF double-submit cookie protection on state-changing endpoints.
- Rate limiting (`slowapi`) on auth endpoints.
- `DEBUG` mode weakens `JWT_SECRET` checks — never deploy with `DEBUG=true`.

## Dependency updates

Check `pnpm audit` and `pip audit` monthly. Dependencies include React 18, Vite, FastAPI, SQLAlchemy 2, psycopg3, argon2-cffi, PyJWT.
