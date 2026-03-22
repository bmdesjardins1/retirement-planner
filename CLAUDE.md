# Retirement Planner — Project Instructions

## Project Summary
React 18 + Vite retirement planning tool. Client-side only, no backend.
Deployed: GitHub → Vercel (auto-deploys on push to `main`).

## Key Directories
- `src/context/PlannerContext.jsx` — all app state + three projection calls
- `src/steps/` — ProfileStep, IncomeStep, AssetsStep, SpendingStep, ResultsStep
- `src/utils/calc.js` — runProjection(), verdictConfig()
- `src/utils/ssUtils.js` — ssAdjustmentFactor() — SSA claiming age multiplier
- `src/utils/federalTax.js` — estimateFederalTax(), (Phase 2) estimateCapitalGainsTax()
- `src/data/stateData.js` — all 50 states
- `src/styles.css` — all styling
- `docs/superpowers/specs/` — design specs
- `docs/superpowers/plans/` — implementation plans

## Active Work
**Status:** Phase 2 in progress. 4 features shipped to main.

**Completed this session:**
- SS claiming age (62–70 slider, SSA formula, survivor benefit transition in combined projection)
- Input validation (constrained setters — age/retirement/lifeExpectancy ordering enforced)
- Withdrawal rate display (verdict banner, color-coded, 4% rule benchmark)
- Pre-65 healthcare bridge (separate cost before Medicare; `lastMedicareAge` handles couples)

**Resume point:** Next up is #5 — Monte Carlo simulation (confidence band: best/median/worst).

## Workflow Rules
- **Code review after every task** — use `superpowers:requesting-code-review` skill after each task completes
- **Preview tools work** — `preview_start` (server name: `retirement-planner`) → `preview_screenshot` for verification
- **Feature branches required** — main is branch-protected. Create `feat/<name>` branch, commit there, open PR for user to merge.
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
