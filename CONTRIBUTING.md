# Contributing

This is a personal / demo project. Contributions are welcome but the author keeps final say.

## Before you start

1. Read `DOCS/ARCHITECTURE.md`, `DOCS/PHASES.md`, and `DOCS/DESIGN.md`.
2. Run the full test suite before and after your change.

```bash
# Frontend
pnpm -C apps/react-frontend test
pnpm -C apps/react-frontend lint
pnpm -C apps/react-frontend exec tsc

# Backend
python -m pytest apps/meal-tracker-api/tests/
```

## Coding rules

- TypeScript strict mode; no `any`.
- React Hook Form + zod for all forms; inline validation, not toast-only.
- CSS Modules only; no Tailwind.
- Keep console clean (no unhandled errors or warnings from our code).
- Don't modify `DOCS/PHASES.md` milestones without agreement.

## Pull requests

- One phase/task per PR.
- Reference a `DOCS/PHASES.md` phase number in the title (e.g. "feat: Phase 4 meals table").
- Include tests for new behavior; update `DOCS/INDEX.md` status line.
