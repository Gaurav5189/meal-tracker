# ARCHITECTURE — Meal Tracker

## 1. Tech Stack
| Layer | Choice |
|---|---|
| Frontend | React 18, Vite, TypeScript (strict), React Router, TanStack Query, plain CSS (CSS Modules + `tokens.css`, no Tailwind), react-hook-form + zod, vite-plugin-pwa |
| Backend | Python 3.14, FastAPI, Pydantic v2, SQLAlchemy 2 (async) + psycopg3, Alembic, argon2-cffi, PyJWT, slowapi |
| Database | Neon PostgreSQL (pooled connection string) |
| Tests | Vitest + Testing Library, pytest + httpx |

## 2. Folder Structure
```
meal-tracker/
├─ DOCS/                    # PRD.md ARCHITECTURE.md RULES.md PHASES.md DESIGN.md
├─ apps/
│  ├─ react-frontend/       # Vite + React + TS
│  │  ├─ src/
│  │  │  ├─ app/            # router, providers, layout (Sidebar, AppShell)
│  │  │  ├─ features/
│  │  │  │  ├─ auth/        # AuthPage, LoginForm, SignupForm, PasswordWarning
│  │  │  │  ├─ meals/       # MealsPage, MonthCard, BulkActions, MealTable, MealChip, MealSheet
│  │  │  │  ├─ settings/    # SettingsPage
│  │  │  │  └─ profile/     # ProfilePage
│  │  │  ├─ components/     # ui primitives: Button, Input, Switch, Sheet, Toast
│  │  │  ├─ lib/            # api client, money, date/tz helpers, queryClient
│  │  │  ├─ hooks/
│  │  │  └─ styles/         # tokens.css, index.css
│  │  └─ vite.config.ts
│  └─ meal-tracker-api/     # FastAPI + SQLAlchemy
│     ├─ app/
│     │  ├─ main.py
│     │  ├─ core/           # config, db, security, csrf, rate_limit
│     │  ├─ models/         # user.py, settings.py, meal.py
│     │  ├─ schemas/        # pydantic request/response models
│     │  ├─ routers/        # auth.py, me.py, settings.py, meals.py
│     │  ├─ services/       # materialize.py, lock.py, bulk.py, pricing.py
│     │  └─ deps.py         # get_db, get_current_user
│     ├─ alembic/
│     └─ tests/
```

## 3. Data Model
```
users(id uuid pk, username text unique, name text, password_hash text,
      tz text, materialized_through date, created_at timestamptz)
settings(user_id pk fk, currency char(3) default 'INR', lunch_price numeric(10,2),
         dinner_price numeric(10,2), dinner_same_as_lunch bool,
         upcoming_default_on bool, lock_past_meals bool default false,
         updated_at timestamptz)
meals(id uuid pk, user_id fk, meal_date date, meal_type text check in ('lunch','dinner'),
      taken bool, taken_manual bool default false,
      price numeric(10,2), price_overridden bool default false,
      updated_at timestamptz, unique(user_id, meal_date, meal_type))
index meals(user_id, meal_date)
```
- Each meal row stores its own `taken` and `price` snapshot, so history never shifts when defaults change.

## 4. Core Logic

### 4.1 Materialization
- `ensure_window(user)`: insert missing rows (`ON CONFLICT DO NOTHING`) from `materialized_through+1` to `today_local + 60 days` using the **current** settings, then update `materialized_through`.
- Runs on login and at the start of meals/settings requests.
- **Invariant:** `PUT /settings` calls `ensure_window` **before** applying changes, so gap days are filled with the old defaults.
- Month fetch beyond the window also materializes that month (future only).

### 4.2 Applying Settings Changes
After `ensure_window`, for rows where `meal_date > today_local`:
- price: update where `price_overridden = false`.
- taken: set to `upcoming_default_on` where `taken_manual = false`.
Today and past rows are never touched.

### 4.3 Locking
`locked = lock_past_meals AND meal_date < (now_in_tz − 48h).date()`. Enforced server-side in `PATCH /meals/{id}` and bulk (reject → 423 for single, skipped + counted for bulk). Included in responses as `locked`.

### 4.4 Totals
`SUM(price) WHERE taken` for the month, computed in SQL, returned as a decimal string with `taken_count`.

## 5. API (all under `/api/v1`, JSON)
| Method | Path | Purpose |
|---|---|---|
| POST | /auth/signup | `{name, username, password, tz}` → sets cookie |
| POST | /auth/login | `{username, password, tz}` → sets cookie |
| POST | /auth/logout | clears cookie |
| GET | /me | `{username, name, tz}` |
| PATCH | /me | `{name}` |
| POST | /me/password | `{current_password, new_password}` |
| GET | /settings | settings |
| PUT | /settings | full settings, applies §4.2 |
| GET | /meals?month=YYYY-MM | `{month, currency, total, taken_count, days:[{date, lunch:Meal, dinner:Meal}]}` |
| PATCH | /meals/{id} | `{taken?, price?}`; `price:null` resets to default |
| POST | /meals/bulk | `{from, to, meal_types:[...], taken}` → `{updated, locked_skipped}` |

`Meal = {id, taken, price, price_overridden, locked}`

Errors: `{ "error": { "code": "string", "message": "string", "fields"?: {} } }` with correct HTTP status (400/401/403/404/409/422/423/429/500).

## 6. Auth & Security Flow
1. Sign up/login → server verifies (argon2id) → issues JWT (7 days) in `httpOnly; Secure; SameSite=Lax` cookie + CSRF token cookie (readable).
2. Mutating requests send `X-CSRF-Token` (double-submit); server compares.
3. Every query filters by `user_id` from the token, never from the request.
4. Rate limits: login/signup 5/min per IP+username; others 120/min per user.
5. CORS: explicit origin allow-list, credentials on. Frontend and API on same site (subdomains).
6. Login errors are generic ("Invalid username or password").

## 7. Frontend Flow
```
Load → GET /me
  ├─ 401 → /auth (Login | Signup tabs)
  └─ 200 → AppShell (Sidebar + Outlet)
        ├─ /            MealsPage  (MonthCard → BulkActions → MealTable → MealSheet)
        ├─ /profile     ProfilePage
        └─ /settings    SettingsPage
```
- Server state: TanStack Query (`['meals', month]`, `['settings']`, `['me']`). Chip toggles use optimistic update with rollback on error.
- Changing settings invalidates `['meals']`.
- Route-level code splitting; prefetch the adjacent month (prev/next warmed after the current month settles).
- Skeleton loaders (month card, table, shell, settings) and an empty-state card; `prefers-reduced-motion` respected globally and for scroll behavior.
- Dialogs (MealSheet, OnboardingModal) share `lib/useModalFocus` for focus trap + restore; the mobile drawer moves focus in/out and closes on Escape.
- "Today" and month boundaries computed from `users.tz`; money formatted via `Intl.NumberFormat(locale, {style:'currency', currency})`.

## 8. Deployment
Frontend: Cloudflare Pages (static build + `functions/api/[[path]].js` proxy to the API via `API_ORIGIN`; `_headers`/`_redirects` for security headers and SPA fallback). Backend: Azure App Service (`.github/workflows/main_meal-track.yml` on push to `main`). The API sets baseline security headers and emits access logs via `app/core/middleware.py`. Env vars: `DATABASE_URL`, `JWT_SECRET` (>= 32 chars, must not be repo default `dev-only-change-me` when DEBUG=false), `CORS_ORIGINS`, `COOKIE_DOMAIN`, `COOKIE_SECURE`, `DEBUG` (false in production). Migrations run with Alembic on deploy.
