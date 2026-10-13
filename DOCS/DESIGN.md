# DESIGN — Meal Tracker

Mobile-first, warm, and calm. One strong brand block (the month card); everything else stays quiet.

## 1. Color Palette
Brand: `#790D16` burgundy · `#E5D3AF` sand · `#F5EFE1` cream · `#AEC4D4` mist blue.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--p` | `#790D16` | `#B3303C` | Primary: month card, buttons, sidebar, today outline |
| `--s` | `#E5D3AF` | `#3A2A22` | Secondary surfaces |
| `--bg` | `#F5EFE1` | `#1A1213` | Page background |
| `--card` | `#FFFFFF` | `#271A1C` | Cards, rows, sheets |
| `--a` | `#AEC4D4` | `#AEC4D4` | "Taken" chips, Uncheck state, focus ring |
| `--tx` | `#2B1A1C` | `#F5EFE1` | Text |
| `--mu` | `#6F5F61` | `#B9A89F` | Muted text |
| `--ln` | `#E5D3AF` | `#3D2C2D` | Borders, skipped chip outline |
| on-accent | `#14232E` | `#14232E` | Text on `--a` |
| on-primary | `#F5EFE1` | `#F5EFE1` | Text on `--p` |
| danger | `#B3261E` | `#F2766E` | Errors |

- Follow `prefers-color-scheme`; allow a manual override later.
- Contrast ≥ 4.5:1 for text. Never rely on color alone: Taken shows "✓", locked shows a lock icon.

## 2. Fonts
- Headings, numbers in the month card: **Fraunces** (variable, 600–700).
- Body, UI, chips: **Nunito** (variable, 400–800).
- Self-host via `@fontsource-variable/*`. Fallbacks: `Georgia, serif` and `"Segoe UI", system-ui, sans-serif`.

## 3. Typography Scale
| Role | Size / weight | Font |
|---|---|---|
| Page title | 20px / 700 | Fraunces |
| Card title | 18–22px / 700 | Fraunces |
| Total number | 24px / 800 | Nunito |
| Body | 16px / 400, line-height 1.4 | Nunito |
| Label / chip | 14px / 700 | Nunito |
| Caption | 12–13px / 600 | Nunito |
- Sentence case. No all-caps labels. Line length < 70 characters.

## 4. Shape, Spacing, Motion
- Radius: sheet 24, cards 20–22, rows 16, chips 12, inputs 12.
- Spacing scale: 4, 8, 12, 16, 20, 24. Page padding 16.
- Touch target ≥ 44px. Content max-width 560px; sidebar 260px.
- Motion: sheet slide-up 220ms, drawer 250ms, chip color 150ms. Disable under `prefers-reduced-motion`.

## 5. Components
- **Auth card:** centered, max 380px, Log in/Sign up segmented tabs. Warning icon (ⓘ/⚠) beside Password on sign up opens a popover: "Save your password. There is no reset or recovery method."
- **Sidebar:** `--p` background, "Hello {name}" in Fraunces, Meals/Profile/Settings, Log out pinned bottom with a divider. Drawer + dim overlay on mobile; permanent ≥ 900px.
- **Month card:** `--p`, month nav buttons (round), two stat tiles (Meal price total, Meals taken).
- **Bulk actions block:** sits directly under the month card. Collapsed: one full-width button "Bulk actions". Expanded: meal type segmented (Lunch / Dinner / Both), From/To date inputs, presets (Rest of month, This week, Whole month), action segmented (Mark taken / Mark skipped), "Apply" button. Result shown as toast.
- **Date row:** card, 76px date column + two equal chips. Today: 2px `--p` border and "Today" label.
- **Meal chip:** 
  - Taken: `--a` fill, "✓ Taken", price caption.
  - Skipped: dashed `--ln` border, muted text.
  - Custom price: 2px inset `--p` ring.
  - Locked: 55% opacity, lock icon, no pointer, `aria-disabled`.
- **Meal sheet:** bottom sheet on mobile, centered modal ≥ 600px. Check/Uncheck segmented (Check = `--p`, Uncheck = `--a`), "Meal cost: N" with Edit → inline number input + Save. Backdrop tap and Esc close. Focus trapped.
- **Settings/Profile:** stacked cards, labeled fields, switches (50×30) with helper text, full-width primary Save button.
- **Toast:** bottom center, auto-dismiss 1.8s, error variant uses danger color.
- Money always formatted with the user's currency via `Intl.NumberFormat`.

## 6. Reference
Approved interactive demo: `Make/Meal Tracker demo v2.html` (repo-local; includes the bulk actions block). Follow this document where they differ.
