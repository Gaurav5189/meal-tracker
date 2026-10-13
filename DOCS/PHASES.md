# PHASES — Meal Tracker

Rule: finish a phase (all "Done when" items) and update `MEMORY.md` before starting the next.

## Phase 0 — Setup  (completed)
- Monorepo folders under `apps/` (react-frontend, meal-tracker-api), Vite + TS + plain CSS tokens, FastAPI skeleton (uv), Neon project, Alembic init, env files, lint/format, CI (lint + tests).
- Tokens from `DESIGN.md` in `tokens.css`; fonts self-hosted.
- Done when: both apps run locally, `/health` returns 200, migrations run on Neon.

## Phase 1 — Login & Sign up  (completed)
- Migration: `users`, `settings`.
- Endpoints: signup, login, logout, `/me`. Argon2id, JWT cookie, CSRF, rate limit, validation.
- UI: AuthPage with tabs, name/username/password fields, password warning icon + popover, error states, timezone capture.
- Done when: can sign up, log in, reload while staying logged in, log out; wrong credentials show a generic error; tests pass.

## Phase 2 — App Shell & Profile  (completed)
- Sidebar (drawer on mobile, fixed ≥900px), "Hello {name}", Log out, route guard, error boundary, toast.
- Profile: editable name, read-only username, change password.
- Done when: navigation works on mobile and desktop; name change reflects in the sidebar; password change requires the current password.

## Phase 3 — Settings  (completed)
- `GET/PUT /settings`; currency picker, default lunch/dinner cost, Same-as-lunch, upcoming-default switch, lock-past-meals switch.
- Done when: settings persist; dinner mirrors lunch when "same" is on; validation errors are inline.
- Note: applying changes to future meals (§4.2) is deferred to Phase 5 (needs the materialization service), so `PUT /settings` currently only persists.

## Phase 4 — Meals Dashboard (read + single edit)  (completed)
- Migration: `meals`. Materialization service + `GET /meals?month=`. `PATCH /meals/{id}`.
- UI: MonthCard (total, count, month nav), MealTable, MealChip, MealSheet (check/uncheck, price edit), optimistic updates.
- Done when: toggling and price edit work and update totals instantly; reload shows correct data; today row highlighted; custom price marker shown.
- Note: days before the signup date are read-only synthetic rows (no history fabricated).

## Phase 5 — Defaults Propagation & Locking  (completed)
- Apply settings changes to future non-manual rows only (§4.2). Lock rule server + UI (faded, disabled, 423 handling).
- Done when: tests prove today/past rows never change on settings edits, manual rows survive, 48h lock matches the rule in the user's timezone.

## Phase 6 — Bulk Actions  (completed)
- `POST /meals/bulk`; BulkActions block under the month card with presets and result message.
- Done when: range/meal-type/action work; locked meals are skipped and counted; single transaction.

## Phase 7 — Polish & Performance
- PWA (manifest, icons, offline shell), prefetch adjacent month, skeleton loaders, empty states, a11y pass, reduced motion, dark mode QA, Lighthouse ≥ 90.
- Done when: audits meet targets on a throttled mobile profile.

## Phase 8 — Hardening & Release
- Security checklist, CORS/cookie config for production, backups, monitoring/logging, README with setup and env vars, deploy both apps.
- Done when: production smoke test passes end to end.

## Future (not in v1)
CSV export, optional email recovery, per-meal notes, charts, more meal types, shared households.
