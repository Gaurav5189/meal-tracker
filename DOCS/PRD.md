# PRD — Meal Tracker

## 1. Summary
Mobile-first web app to track daily lunch/dinner and calculate the monthly meal cost. Desktop is fully supported.

## 2. Target User
Individuals who pay per meal (mess, tiffin, canteen, home-cook service) and need to know what they owe each month. Mostly used on a phone, one-handed, several times a week.

## 3. Goals
- Mark a meal in ≤2 taps.
- Monthly total always correct and visible.
- Fast, smooth, installable (PWA).

## 4. Non-Goals (v1)
Email, password recovery, social login, multi-user sharing, payments, more than two meal types.

## 5. Features

### 5.1 Auth
- Single screen with Log in / Sign up tabs.
- Sign up fields: **name**, **username**, **password**. Log in fields: username, password.
- Warning icon next to password on sign up. On click it shows: "Save your password. There is no reset or recovery method."
- Username: 3–20 chars, `a-z 0-9 _`, stored lowercase, unique, immutable. Name: 1–50 chars. Password: 8–128 chars.
- Timezone auto-detected from the browser and stored on the user.

### 5.2 Sidebar / Navigation
- Header "Hello {name}", items: Meals, Profile, Settings, and Log out pinned at the bottom.
- Mobile: slide-in drawer. Desktop (≥900px): permanent sidebar.

### 5.3 Meals (Dashboard)
- Month card: month navigation (‹ ›), **meal price total**, **meals taken**.
- **Bulk actions** block directly under the month card (see 5.4).
- Table: one row per date; columns Date, Lunch, Dinner. Today's row highlighted.
- Chip states: Taken, Skipped (skipped = unmarked; same meaning), Custom price (marker), Locked (faded).
- Tap a chip → popup (bottom sheet on mobile, centered modal on desktop):
  - Check / Uncheck toggle.
  - "Meal cost: N" with an Edit action to set a price for that meal only (special meals).
- Past meals are editable unless locked (5.6).

### 5.4 Bulk Actions
- Inputs: meal type (Lunch / Dinner / Both), range (From–To; presets: Rest of month, This week, Whole month), action (Mark taken / Mark skipped).
- Locked meals are skipped. Result message: "Updated N meals, M locked skipped."
- Bulk-changed meals count as manual (not altered by later default changes).

### 5.5 Settings
- Currency (ISO 4217 picker; formatted with `Intl.NumberFormat`).
- Default lunch cost; default dinner cost with a **Same as lunch** switch (dinner input disabled and mirrors lunch).
- **Upcoming meals taken by default**: on/off.
- **Lock past meals**: on/off. When on, meals older than 48 hours are read-only and faded.
- Changes to defaults apply only to **future** meals (date > today) that were not manually changed. Today and past are never changed.

### 5.6 Locking Rule
`locked = lock_enabled AND meal_date < date(now_in_user_tz − 48h)`. Computed by the server. The client only renders the flag.

### 5.7 Profile
- Name (editable), username (read-only), change password (current, new, confirm).
- No forgot-password flow.

## 6. Data & Time
- Meal date = calendar `DATE` in the user's timezone (no conversion).
- Audit timestamps = `timestamptz` (UTC in DB), displayed in the user's timezone.
- Money = `numeric(10,2)`; API transports decimals as strings.

## 7. Non-Functional
- Mobile-first, responsive 320px → desktop, light + dark.
- Month load <300 ms p95 on warm backend; optimistic UI for toggles.
- Accessible: keyboard, visible focus, 44px touch targets, reduced-motion respected.
- Security: argon2id, httpOnly cookie, CSRF, rate limiting, strict validation.

## 8. Assumptions (confirm or change)
1. "Lock past meals" locks meals **older than 48 hours**; the last 48 hours stay editable.
2. Lock setting defaults to **off**.
3. Rows before the user's signup date are not editable.
4. Single currency per user; changing currency changes display only, not stored amounts.

## 9. Success Criteria
All features above work on a 360px-wide phone and a 1440px desktop with no console errors; Lighthouse PWA/Performance/Accessibility ≥ 90.
