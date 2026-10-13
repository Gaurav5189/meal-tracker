# RULES — Meal Tracker (for AI coding assistants)

Read `PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `PHASES.md`, and `MEMORY.md` before every task.

## 1. What to Use
- Frontend: TypeScript strict, functional components, hooks, plain CSS: global design tokens in `styles/tokens.css` + scoped `*.module.css` per component. No Tailwind.
- Server state: TanStack Query. Local UI state: `useState`/`useReducer`. No global store.
- Forms: react-hook-form + zod. Validation rules mirror the backend.
- Backend: FastAPI routers → services → models. Business logic lives in `services/`, never in routers.
- DB: SQLAlchemy 2 async, Alembic migrations for every schema change.
- Money: `Decimal` / `numeric(10,2)`; strings over the wire.
- Dates: meal dates are plain `YYYY-MM-DD`; timestamps are UTC ISO-8601.

## 2. Approved Libraries
Frontend: react, react-dom, react-router-dom, @tanstack/react-query, react-hook-form, zod, @hookform/resolvers, vite-plugin-pwa, @fontsource-variable/fraunces, @fontsource-variable/nunito, vitest, @testing-library/react, eslint, prettier.
Backend (managed with `uv`): fastapi, uvicorn, pydantic, pydantic-settings, sqlalchemy, psycopg[binary], alembic, argon2-cffi, pyjwt, slowapi, pytest, httpx, ruff.

## 3. Avoid
- Any library not listed in §2 — **ask first**, with reason and alternatives.
- UI kits (MUI, Chakra, Ant), Redux, Moment.js, Axios (use `fetch` wrapper), CSS-in-JS, Tailwind or other utility-CSS frameworks.
- `localStorage` for auth tokens. Floats for money. `any` types. Raw SQL string concatenation.
- Trusting `user_id` or locked status from the client.
- Premature abstraction, dead code, commented-out code, TODOs without an entry in `MEMORY.md`.

## 4. Error Handling
**Backend**
- Raise typed `AppError(code, message, status)`; one global handler returns `{error:{code,message,fields?}}`.
- Never leak stack traces, SQL, or whether a username exists on login failure.
- Validate with Pydantic; reject unknown fields.
- Log server errors with a request id; never log passwords, tokens, or cookies.
- DB writes that touch multiple rows (settings apply, bulk) run in one transaction.

**Frontend**
- Every query/mutation handles loading, error, and empty states in the UI.
- Network/5xx → toast with retry; 401 → redirect to `/auth`; 422 → inline field errors; 423 → "This meal is locked".
- Optimistic updates must roll back on failure and notify the user.
- Wrap routes in an error boundary with a friendly fallback.
- No empty `catch`. No `console.log` in committed code.

## 5. Security Checklist (each PR)
- Every query is scoped by the token's `user_id`.
- Mutating routes require CSRF header and are rate-limited where specified.
- Cookies: `httpOnly`, `Secure`, `SameSite=Lax`.
- Secrets only from env vars; `.env` is git-ignored; `.env.example` is maintained.

## 6. Quality
- Mobile layout verified at 360px and desktop at 1440px, light and dark.
- Touch targets ≥44px; visible focus; respect `prefers-reduced-motion`.
- Add tests for: materialization, settings-apply rules, lock rule, bulk action, totals, auth.
- Run lint, type-check, and tests before declaring a task done.

## 7. AI Boundaries
The AI **may**: implement the current phase in `PHASES.md`, write tests, fix bugs inside the current task, update `MEMORY.md`.
The AI **must ask before**: adding dependencies, changing the schema or API contract, changing product behavior or the lock/default rules, altering `DESIGN.md` tokens, deleting files, touching deployment or secrets.
The AI **must not**: start a later phase early, invent features, change requirements in `PRD.md`, silently work around a failing test, weaken security checks, or make assumptions on ambiguous requirements — ask instead and record the answer in `MEMORY.md`.
Keep diffs small and focused; one task per commit (`feat:`, `fix:`, `chore:`, `test:`).
