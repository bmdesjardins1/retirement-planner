# Retirement Planner — Project Instructions

## Project Summary
React 18 + Vite retirement planning tool. Client-side only, no backend.
Deployed: GitHub → Vercel (auto-deploys on push to `main`).

## Key Directories
- `src/context/PlannerContext.jsx` — all app state + three projection calls
- `src/steps/` — ProfileStep, IncomeStep, AssetsStep, SpendingStep, ResultsStep, WhatIfPanel
- `src/utils/calc.js` — runProjection(), verdictConfig()
- `src/utils/ssUtils.js` — ssAdjustmentFactor() — SSA claiming age multiplier
- `src/utils/federalTax.js` — estimateFederalTax(), (Phase 2) estimateCapitalGainsTax()
- `src/data/stateData.js` — all 50 states
- `src/styles.css` — all styling
- `docs/superpowers/specs/` — design specs
- `docs/superpowers/plans/` — implementation plans

## Active Work
**Status:** Phase 2 complete. 13 features shipped to main.

**Completed:**
- SS claiming age (62–70 slider, SSA formula, survivor benefit transition in combined projection)
- Input validation (constrained setters — age/retirement/lifeExpectancy ordering enforced)
- Withdrawal rate display (verdict banner, color-coded, 4% rule benchmark)
- Pre-65 healthcare bridge (separate cost before Medicare; `lastMedicareAge` handles couples)
- Home equity as asset (PR #7, 2026-03-22)
- Roth conversion window callout (PR #8, 2026-03-23) — yellow metric box in Tax & Cost Summary
- Pension survivor benefit modeling (PR #9, 2026-03-23) — survivor % selectors for both pensions, spouse pension input, corrected drawdown loop
- calc.js model accuracy audit (PR #10, 2026-03-24) — MAGI fix, dead code removal, simplification comments
- Site design cleanup (PR #14 input steps, PR #15 results page, 2026-03-25)
- Monte Carlo simulation (PR #16 + band fix PR #17, 2026-03-25) — confidence band chart, volatility toggle, failure stats, sequence-of-returns explainer
- Tax & Cost Summary redesign + SS breakeven (PR #18, 2026-03-29) — compact tax snapshot, side-by-side planning insights, SS breakeven callout per person
- What If scenario comparisons (PR #19, 2026-03-30) — My Plan / What If tab toggle, 6 adjustable variables, verdict + chart + metric table comparison

**Resume point:** What If scenarios shipped (PR #19, 2026-03-30). Phase 2 complete. Next: Phase 3 features (exportable results, onboarding tooltips) or any stretch Phase 2 items. Invoke `superpowers:brainstorming` to kick off the next feature.

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
