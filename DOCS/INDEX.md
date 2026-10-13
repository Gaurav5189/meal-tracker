# Project Index & Map

## Active State
- **Current Phase:** Phase 0 — Setup (in progress; Neon migration check pending)
- **Current Task:** Verify Alembic against Neon once `apps/meal-tracker-api/.env` has `DATABASE_URL`, then Phase 1

## Structure
- `apps/react-frontend/` — Vite + React + TypeScript frontend
- `apps/meal-tracker-api/` — FastAPI backend (uv-managed)
- `Make/Meal Tracker demo v2.html` — approved visual reference
- `DOCS/` — all project docs (this file, RULES, PRD, ARCHITECTURE, DESIGN, PHASES)
- `.agents/MEMORY.md` — status, decisions, lessons

## Doc Map
- **`RULES.md`**: Code formatting, framework rules, strict constraints. (path: DOCS/)
- **`PRD.md`**: Product features, user flows, acceptance criteria. (DOCS/)
- **`ARCHITECTURE.md`**: Database schema, API endpoints, folder structure, system flow. (DOCS/)
- **`DESIGN.md`**: UI component rules, color palettes, visual tokens, layout specs. (DOCS/)
- **`PHASES.md`**: Roadmap breakdown, current phase deliverables, completed milestones. (DOCS/)
- **`MEMORY.md`**: Architectural decisions, past bugs, lessons learned. (.agents/MEMORY.md)

## Retrieval Guidelines
1. Working on UI/Layout? -> Read `DESIGN.md`.
2. Modifying DB/API/Endpoints? -> Read relevant sections in `ARCHITECTURE.md`.
3. Updating roadmap or status? -> Check `PHASES.md`.
4. Stuck on an edge-case bug? -> Grep `MEMORY.md` for related issues.