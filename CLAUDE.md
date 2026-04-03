# Retirement Planner — Project Instructions

## Project Summary
React 18 + Vite retirement planning tool. Client-side only, no backend.
Deployed: GitHub → Vercel (auto-deploys on push to `main`).

## Key Directories
- `src/context/PlannerContext.jsx` — all app state + three projection calls
- `src/steps/` — ProfileStep, IncomeStep, AssetsStep, SpendingStep, ResultsStep, WhatIfPanel
- `src/utils/calc.js` — runProjection(), verdictConfig()
- `src/utils/stateTax.js` — computeStateTax() — state tax with per-person pension/trad exemptions
- `src/utils/ssUtils.js` — ssAdjustmentFactor() — SSA claiming age multiplier
- `src/utils/federalTax.js` — estimateFederalTax(), estimateCapitalGainsTax()
- `src/data/stateData.js` — all 50 states (incl. pensionExemptPerPerson, tradExemptPerPerson)
- `src/styles.css` — all styling
- `docs/superpowers/specs/` — design specs
- `docs/superpowers/plans/` — implementation plans

## Active Work
**Status:** Phase 2 complete. 14 features shipped to main.

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
- Track A calculation fixes (PR #20, 2026-04-02) — SS COLA, early withdrawal penalty, Medicare Part B base premium, home appreciation, state cap gains tax
- State retirement income exemptions (PR #21, 2026-04-02) — per-state pension + trad IRA/401k exemptions, computeStateTax() helper, "Pension exemption savings" in Tax Snapshot

**Resume point:** Track B option 1 complete. Next: Track B option 2 — glide path / asset allocation (stock/bond split that shifts over time). Use `superpowers:brainstorming`.

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
