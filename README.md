# Meal Tracker

A meal-cost tracking app for shared lunches and dinners. Phase 2 (App Shell & Profile) and Phase 3 (Settings) are complete; Phase 4 (Meals Dashboard) is next.

## Stack

- **Frontend:** React 18, Vite, TypeScript (strict), React Router, TanStack Query, react-hook-form + zod, plain CSS (CSS Modules + tokens)
- **Backend:** FastAPI, SQLAlchemy 2 async, Neon PostgreSQL, Alembic
- **Tests:** Vitest + Testing Library (frontend), pytest + httpx (backend)

## Quick start

```bash
# Backend (Python 3.14+)
pnpm install
pnpm -C apps/react-frontend install
pnpm -C apps/react-frontend dev   # Vite on :5173
fastapi dev apps/meal-tracker-api/app/main.py --port 8000
```

Requires `.env` in `apps/meal-tracker-api/` with `DATABASE_URL` and `JWT_SECRET`.

## Project docs

- `DOCS/ARCHITECTURE.md` — tech stack, folder layout, deployment
- `DOCS/PHASES.md` — phase roadmap (Phase 2 & 3 complete; Phase 4 next)
- `DOCS/DESIGN.md` — colors, typography, component primitives
- `DOCS/INDEX.md` — active phase and current status

## License

MIT (see `LICENSE`).
