# Retirement Planner — Project Instructions

## Project Summary
React 18 + Vite retirement planning tool. Client-side only, no backend.
Deployed: GitHub → Vercel (auto-deploys on push to `main`).

## Key Directories
- `src/context/PlannerContext.jsx` — all app state + three projection calls
- `src/steps/` — ProfileStep, IncomeStep, AssetsStep, SpendingStep, ResultsStep
- `src/utils/calc.js` — runProjection(), verdictConfig()
- `src/utils/federalTax.js` — estimateFederalTax(), (Phase 2) estimateCapitalGainsTax()
- `src/data/stateData.js` — all 50 states
- `src/styles.css` — all styling
- `docs/superpowers/specs/` — design specs
- `docs/superpowers/plans/` — implementation plans

## Active Work
**Status:** Refactor & UI polish (7 tasks) complete. Push to main pending.

**Completed:**
- Calculation accuracy audit (8 tasks) — merged
- Refactor: tests moved to `tests/`, AccountTypeBlock extracted, PlannerContext dep arrays explicit
- UI polish: tabbed Assets step, numbered step nav, chart fixes, form density tightened

**Resume point:** Ask user which Phase 2 feature to tackle next.

## Workflow Rules
- **Code review after every task** — use `superpowers:requesting-code-review` skill after each task completes
- **Preview tools work** — `preview_start` (server name: `retirement-planner`) → `preview_screenshot` for verification
- **Commit after each task** — plan specifies exact commit messages
- **One decision at a time** — never move on without user confirmation
- **Explain reasoning** — why this pattern, not just what it does

## Code Style
- React functional components, hooks only
- Context via `usePlanner()` hook from PlannerContext
- No TypeScript — plain JS throughout
- Avoid jargon; explain financial concepts inline for non-expert users

## Do Not Use
- `preview_snapshot` (fails with `t.slice is not a function`) — use `preview_screenshot` instead
