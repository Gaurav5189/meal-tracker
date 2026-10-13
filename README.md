# Meal Tracker

A meal-cost tracking app for shared lunches and dinners. Log which meals you
took, set prices, and know what you owe. Track lunches and dinners for a month,
bulk-apply changes, and lock past meals so history stays stable.

- **Frontend:** React 18 + Vite + TypeScript (strict), React Router, TanStack
  Query, react-hook-form + zod, plain CSS (CSS Modules + `tokens.css`),
  `vite-plugin-pwa` (installable, offline app shell).
- **Backend:** Python 3.14, FastAPI, Pydantic v2, SQLAlchemy 2 (async) + psycopg3,
  Alembic, argon2id, JWT cookie auth.
- **Database:** Neon PostgreSQL (pooled connection string).
- **Tests:** Vitest + Testing Library (frontend), pytest + httpx (backend).

## Repository layout

```
meal-tracker/
├─ apps/
│  ├─ react-frontend/          # Vite + React + TS PWA
│  └─ meal-tracker-api/        # FastAPI + SQLAlchemy (uv-managed)
├─ DOCS/                       # PRD, ARCHITECTURE, DESIGN, PHASES, RULES, INDEX
└─ Make/                       # approved visual reference (demo v2)
```

## Local development

Requirements: Node 20+ and `pnpm`, Python 3.14+ and [`uv`](https://docs.astral.sh/uv/).

```bash
# 1. Install dependencies
pnpm -C apps/react-frontend install
uv sync --directory apps/meal-tracker-api

# 2. Create apps/meal-tracker-api/.env (see the env table below for keys)
#    At minimum set DATABASE_URL and JWT_SECRET, and DEBUG=true for local work.

# 3. Run migrations against your database
uv run --directory apps/meal-tracker-api alembic upgrade head

# 4. Start the API (http://localhost:8000) and the frontend (http://localhost:5173)
uv run --directory apps/meal-tracker-api uvicorn app.main:app --reload --port 8000
pnpm -C apps/react-frontend dev
```

The Vite dev server proxies same-origin `/api/*` calls to `http://localhost:8000`,
so cookies and CSRF behave the same in dev and production.

## Environment variables

All backend configuration lives in `apps/meal-tracker-api/.env`
(template: `apps/meal-tracker-api/.env.example`).

| Variable        | Required | Notes                                                                                     |
| --------------- | -------- | ----------------------------------------------------------------------------------------- |
| `DATABASE_URL`  | yes      | Neon pooled connection string.                                                                            |
| `JWT_SECRET`    | yes      | Signs session tokens. `>= 32` chars; must not be the repo default when `DEBUG=false`.                     |
| `CORS_ORIGINS`  | prod     | Comma-separated allow-list of frontend origins.                                                            |
| `COOKIE_DOMAIN` | prod     | Leave empty for same-origin proxy / localhost.                                                            |
| `COOKIE_SECURE` | prod     | `true` in production (HTTPS-only cookies).                                                                 |
| `DEBUG`         | —        | `false` in production.                                                                                     |

Generate a secret with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Startup fails fast if `JWT_SECRET` is weak while `DEBUG=false`.

The frontend proxy Function (`apps/react-frontend/functions/api/[[path]].js`)
reads `API_ORIGIN` from the Cloudflare Pages environment — it is **not** a
build-time Vite variable.

## Tests and checks

```bash
pnpm -C apps/react-frontend typecheck   # tsc
pnpm -C apps/react-frontend lint        # eslint
pnpm -C apps/react-frontend test        # vitest
pnpm -C apps/react-frontend build       # tsc + vite build (emits the service worker)

uv run --directory apps/meal-tracker-api ruff check app tests
uv run --directory apps/meal-tracker-api pytest            # DB tests need DATABASE_URL
uv run --directory apps/meal-tracker-api pytest -m "not db" # no database required
```

## Deployment

- **Frontend → Cloudflare Pages.** Build command `pnpm build`, output `dist`.
  `_headers` adds security headers, `_redirects` provides SPA fallback, and the
  Pages Function proxies `/api/*` to the Azure API (`API_ORIGIN`).
- **Backend → Azure App Service.** `.github/workflows/main_meal-track.yml`
  builds and deploys on push to `main`; run Alembic migrations against the
  production database before/at deploy.
- The API also sets baseline security headers and emits access logs
  (`meal-tracker.access`) so proxied responses carry the same protections as the
  static app.

## Project docs

- `DOCS/INDEX.md` — active phase and current status
- `DOCS/PRD.md` — product requirements and acceptance criteria
- `DOCS/ARCHITECTURE.md` — stack, data model, API, deployment
- `DOCS/DESIGN.md` — colors, typography, component primitives
- `DOCS/PHASES.md` — phase roadmap
- `DOCS/RULES.md` — code and formatting rules

## License

MIT (see `LICENSE`).