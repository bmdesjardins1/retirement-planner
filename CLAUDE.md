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
**Current plan:** `docs/superpowers/plans/2026-03-18-calculation-audit.md`

This plan covers two phases of calculation fixes:
- **Phase 1 (Tasks 1–4):** Healthcare survivorFactor bug, federal bracket inflation + circular dependency, pension COLA toggle
- **Phase 2 (Tasks 5–8):** Account type system (Traditional/Roth/Taxable per person), tax-efficient withdrawal ordering, capital gains tax

**Resume point:** Plan is written and reviewed. Execution not yet started. Next step: pick up at Task 1.

## Workflow Rules
- **Code review after every task** — use `superpowers:requesting-code-review` skill after each task completes
- **No preview_* tools** — they don't work on this machine. Verify with `vite build` via Bash only
- **User verifies visually** at localhost:5173 in their own browser
- **Commit after each task** — plan specifies exact commit messages
- **One decision at a time** — never move on without user confirmation
- **Explain reasoning** — why this pattern, not just what it does

## Code Style
- React functional components, hooks only
- Context via `usePlanner()` hook from PlannerContext
- No TypeScript — plain JS throughout
- Avoid jargon; explain financial concepts inline for non-expert users

## Do Not Use
- `preview_start`, `preview_screenshot`, `preview_snapshot`, or any `preview_*` tools
