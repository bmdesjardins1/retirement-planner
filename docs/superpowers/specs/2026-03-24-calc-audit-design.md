# calc.js Model Accuracy Audit — Design Spec

**Date:** 2026-03-24
**Feature:** calc.js model accuracy audit + code quality cleanup
**Branch:** feat/calc-audit

---

## Overview

A targeted audit of `src/utils/calc.js` focused on two goals:
1. Fix the one confirmed non-conservative accuracy gap: spouse pension excluded from MAGI
2. Improve code clarity with comments explaining each intentional simplification and its conservative/non-conservative bias

The guiding principle is **conservative bias** — the tool should slightly overestimate costs and underestimate runway rather than the reverse. A user who is told their money might not last and it does is in a better position than one told it will last when it doesn't.

---

## Scope

**In scope:**
- MAGI fix: add `spousePension` to `nonSSWithPT` / `nonSSWithoutPT`
- Code quality: remove redundant `bridgeHealthcare > 0` inner condition
- Comments: document each known simplification with conservative rationale

**Out of scope:**
- New inputs or UI changes
- Changing any other model behavior
- New tests (fix is small, existing 57-test suite covers runProjection())

---

## Model Accuracy Assessment

Each known simplification categorized by its bias direction:

| Simplification | Bias | Action |
|---|---|---|
| Spouse pension excluded from MAGI | Non-conservative (understates tax + IRMAA) | **Fix** |
| Healthcare not scaled by survivorFactor in survivor phase | Conservative (keeps household amount high) | Document |
| Bridge healthcare not scaled in survivor phase | Conservative | Document |
| Home sale proceeds: 60% taxable gains (ignores $250K/$500K exclusion) | Conservative (overstates tax) | Document |
| `mortgagePayoffAge` drops housing to $0 (loses maintenance/insurance) | Non-conservative | Document (too complex to fix without new input) |
| `realOrdinary` not reduced in survivor phase | Neutral wash (overstates both income and taxes) | Document |

---

## Architecture

### `src/utils/calc.js`

**Change 1 — MAGI fix (2 lines changed)**

`nonSSWithPT` and `nonSSWithoutPT` are used as the MAGI approximation for:
- `realOrdinary` in the drawdown loop → feeds `estimateFederalTax()` and `irmaaMAGI`
- The year-0 federal tax summary at the bottom of `runProjection()`

The PlannerContext already passes `spousePension: 0` for the primary-solo and spouse-solo projections, so this change is automatically correct across all three projections — no additional guarding needed.

```js
// Before:
const nonSSWithPT    = pension + partTimeIncome + rentalIncome;
const nonSSWithoutPT = pension + rentalIncome;

// After:
const nonSSWithPT    = pension + spousePension + partTimeIncome + rentalIncome;
const nonSSWithoutPT = pension + spousePension + rentalIncome;
```

**Change 2 — Remove dead variable `baseBridgeHealthcareNeed` (1 line removed)**

`baseBridgeHealthcareNeed` is declared on line 76 but never referenced anywhere in the file — orphaned from an earlier implementation. Remove it.

```js
// Remove this line entirely:
const baseBridgeHealthcareNeed = bridgeHealthcare > 0 ? bridgeHealthcare * col : baseHealthcareNeed;
```

**Change 3 — Remove redundant inner condition (1 line simplified)**

`inBridgePhase` is only true when `hasBridge` is true, and `hasBridge` already requires `bridgeHealthcare > 0`. The inner `bridgeHealthcare > 0 ?` check is always true in that branch.

```js
// Before:
const activeBaseHealthcareNeed = inBridgePhase
  ? (bridgeHealthcare > 0 ? bridgeHealthcare * activeCol : healthcare * activeCol)
  : healthcare * activeCol;

// After:
const activeBaseHealthcareNeed = inBridgePhase
  ? bridgeHealthcare * activeCol
  : healthcare * activeCol;
```

**Change 4 — Add simplification comments (4 comments added)**

Four locations in the drawdown loop get inline comments explaining the simplification and its bias:

1. **Healthcare survivor scaling** (near `activeBaseHealthcareNeed`):
   > "Intentionally not scaled by activeSurvFactor — household healthcare stays at the full entered amount after one spouse dies. Conservative simplification: a single person's healthcare costs are not much lower than a couple's (Medicare premiums are per-person)."

2. **Home sale 60% gains** (near home sale proceeds block):
   > "Conservative: treats 60% of proceeds as taxable gains, ignoring the $250K/$500K primary residence exclusion. For most users the actual exclusion eliminates the tax entirely; this overstates the tax slightly."

3. **mortgagePayoffAge → $0** (near `effectiveHousingNeed`):
   > "Simplification: housing drops to $0 after payoff. Ongoing maintenance and homeowner's insurance (~1–2% of home value/yr) are not modeled — users should include these in their 'Other' spending category."

4. **realOrdinary in survivor phase** (near `realOrdinary`):
   > "Not adjusted for survivor phase — pension and rental income don't necessarily halve after one spouse's death. The overstatement of income and the overstatement of taxes roughly offset; accepted simplification."

---

## Simplifications Accepted (Not Fixed)

1. **Mortgage payoff maintenance gap.** Modeling post-payoff residual housing cost would require a new input (maintenance/insurance estimate). Added as a comment instead. Users should account for this in 'Other' spending.

2. **`realOrdinary` survivor adjustment.** Effect is a wash — fixing it would require tracking which income sources disappear with which person, adding significant complexity for minimal net impact.

3. **Healthcare survivor scaling.** Intentionally conservative — keeping the full household healthcare amount errs on the side of more realistic planning for older individuals whose per-person healthcare costs are high.

---

## Testing

No new tests. The MAGI fix is a straightforward additive change. The existing `calc.test.js` suite (57 tests) covers `runProjection()` end-to-end and will confirm no regressions. The code quality changes have no behavioral effect.

**Note for implementer:** Any existing test that passes `spousePension > 0` and asserts a specific `federalTaxMonthly` value will need its expected value updated — the old value was computed without spouse pension in MAGI, so it was understated. Updating the expected value is correct behavior, not a regression.
