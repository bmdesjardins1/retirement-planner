# Pension Survivor Benefit Modeling — Design Spec

**Date:** 2026-03-23
**Feature:** #11 — Pension survivor benefit modeling
**Branch:** feat/pension-survivor

---

## Overview

The app currently models a single pension (primary person only) and applies the full pension amount in both the combined and survivor phases of the projection. This implicitly assumes a 100% joint & survivor election — the most generous (and rarest) option. Most real pension elections reduce the surviving spouse's benefit to 50% or 75%, and single-life elections pay nothing to the survivor.

This feature adds:
1. A survivor benefit % selector for the primary person's pension (0%, 50%, 75%, 100%)
2. A spouse pension input (amount + COLA toggle + survivor benefit %)
3. Corrected drawdown loop that applies the right pension amount in the survivor phase based on who dies first

---

## Scope

**In scope:**
- `pensionSurvivorPct` for primary pension — controls how much the spouse receives after primary's death
- `spousePension`, `spousePensionCOLA`, `spousePensionSurvivorPct` — full pension modeling for spouse
- Survivor phase pension is correctly reduced based on the elected %
- "Who dies first" detection from existing `firstDeathAge` logic

**Out of scope:**
- Pension start age (assumed to begin at retirement age)
- Pension from a previous employer that starts at a fixed age before retirement
- Tax treatment beyond state income tax (already applied to primary pension today)

---

## Data Model

Four new state fields in `PlannerContext.jsx`:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `pensionSurvivorPct` | number | `100` | % of primary's pension the spouse receives after primary's death |
| `spousePension` | number | `0` | Spouse's monthly pension ($/mo) |
| `spousePensionCOLA` | boolean | `false` | Does spouse's pension inflate with general inflation? |
| `spousePensionSurvivorPct` | number | `100` | % of spouse's pension the primary receives after spouse's death |

**Default of 100 for survivor %:** The app currently assumes 100% implicitly. Defaulting to 100 ensures no behavioral change for existing users who already have pension amounts entered. The selector is shown prominently to prompt users to set the correct value.

---

## Architecture

### `src/context/PlannerContext.jsx`

Add four new `useState` declarations and expose them via the context value object. Pass the new fields through `sharedInputs` so all three projections (combined, primaryOnly, spouseOnly) receive them.

### `src/utils/calc.js`

**Step 1 — Accept new params**

Destructure `pensionSurvivorPct`, `spousePension`, `spousePensionCOLA`, `spousePensionSurvivorPct` from `inputs`. Default `spousePension` to `0`, `spousePensionSurvivorPct` to `100`, `spousePensionCOLA` to `false`, `pensionSurvivorPct` to `100`.

**Step 2 — Pre-compute spouse pension net monthly (above the loop)**

Following the same pattern as the existing primary pension pre-computation:

```js
const spousePensionStateTax    = spousePension * stateInfo.incomeTax;
const spousePensionNetMonthly  = spousePension - spousePensionStateTax;
const retSpousePensionNetMonthly = spousePension - spousePension * retirementStateInfo.incomeTax;
```

**Step 3 — Compute `primaryDiesFirst` flag (above the loop)**

```js
// Determines which pension amounts apply in the survivor phase.
// primaryDiesFirst = true when primary's life expectancy is shorter than (or equal to) spouse's.
const primaryDiesFirst = !hasSpouse ? false
  : lifeExpectancy <= currentAge + (spouseLifeExpectancy - spouseAge);
```

**Step 4 — Replace `activePensionNetMonthly` in the drawdown loop**

Remove:
```js
const activePensionNetMonthly = hasMoved ? retPensionNetMonthly : pensionNetMonthly;
```

Replace with:
```js
// Primary pension: reduced by survivorPct if primary has died (isSurvivor && primaryDiesFirst)
const activePrimaryPensionNet = (isSurvivor && primaryDiesFirst)
  ? (hasMoved ? retPensionNetMonthly : pensionNetMonthly) * (pensionSurvivorPct / 100)
  : (hasMoved ? retPensionNetMonthly : pensionNetMonthly);

// Spouse pension: reduced by survivorPct if spouse has died (isSurvivor && !primaryDiesFirst)
const activeSpousePensionNet = !hasSpouse ? 0
  : (isSurvivor && !primaryDiesFirst)
  ? (hasMoved ? retSpousePensionNetMonthly : spousePensionNetMonthly) * (spousePensionSurvivorPct / 100)
  : (hasMoved ? retSpousePensionNetMonthly : spousePensionNetMonthly);
```

Replace the `pensionContrib` line:
```js
// Each pension's COLA applies independently
const pensionContrib =
  (pensionCOLA      ? activePrimaryPensionNet * 12 * generalFactor : activePrimaryPensionNet * 12) +
  (spousePensionCOLA ? activeSpousePensionNet  * 12 * generalFactor : activeSpousePensionNet  * 12);
```

**Step 5 — Update income summary values**

The pre-loop `netMonthlyIncome` and `stateTaxMonthly` summary values (used for the results cards) currently include only the primary pension. Add spouse pension to both:

```js
const netMonthlyIncome = nonPensionNetWithPT + pensionNetMonthly + spousePensionNetMonthly;
const stateTaxMonthly  = nonPensionTaxWithPT + pensionStateTax   + spousePensionStateTax;
```

### `src/steps/IncomeStep.jsx`

All changes are inside the existing "Other Income" card. No new cards, no new tabs.

**Primary pension section (existing, extended):**

```
Pension                                  $0–$5,000/mo slider

[when pension > 0]
Does this pension increase with inflation each year?
  [ Yes ]  [ No (fixed) ]

[when pension > 0 && hasSpouse]
What % of your pension does your spouse receive after your death?
Most pensions require you to elect a survivor benefit at retirement — check your plan documents.
  [ 0% (Single Life) ]  [ 50% ]  [ 75% ]  [ 100% ]
```

**Spouse pension section (new, shown only when hasSpouse):**

```
Spouse's Pension                         $0–$5,000/mo slider

[when spousePension > 0]
Does your spouse's pension increase with inflation each year?
  [ Yes ]  [ No (fixed) ]

[when spousePension > 0]
What % of your spouse's pension do you receive after their death?
  [ 0% (Single Life) ]  [ 50% ]  [ 75% ]  [ 100% ]
```

---

## Simplifications

1. **Pension start age not modeled.** Both pensions are assumed to begin at the primary's retirement age. Users with pensions that start at a different age (e.g., military retirement at 42, deferred vested pension at 65) cannot model that precisely. Acceptable for this phase.

2. **`realOrdinary` (federal tax MAGI estimate) not updated for spouse pension.** The existing `nonSSWithPT` / `nonSSWithoutPT` includes only the primary pension for federal tax estimation. Adding spouse pension would improve accuracy but the federal tax estimate is already an approximation. Extend in a future tax accuracy pass.

3. **Solo projections (primaryOnly, spouseOnly) ignore survivor %.** The `primaryOnly` and `spouseOnly` projections model each person in isolation (no spouse). In these projections `hasSpouse = false`, so `isSurvivor` never triggers and survivor % is irrelevant. No changes needed for solo projections.

4. **`primaryDiesFirst` uses life expectancy inputs, not probability.** When both spouses have the same life expectancy, `primaryDiesFirst = true` (≤ condition). This is an arbitrary but consistent tiebreak.

---

## Testing

No unit tests — pension changes affect the drawdown loop which is integration-level behavior verified manually. Manual verification scenarios:

1. **Primary pension, 50% survivor, primary dies first:** Survivor phase income drops by 50% of primary pension. Spouse's pension (if any) unaffected.
2. **Primary pension, 0% (single life), primary dies first:** Survivor phase shows $0 primary pension.
3. **Primary pension, 100% survivor:** Survivor phase income unchanged from current behavior.
4. **Spouse pension, 50% survivor, spouse dies first:** Survivor phase drops spouse pension by 50%.
5. **Both pensions, each with different survivor %:** Both reduce independently in the survivor phase.
6. **No spouse (`hasSpouse = false`):** Survivor % selector not shown; `spousePension` fields not shown; projection unaffected.
7. **Spouse pension only (primary pension = 0):** Primary survivor % selector not shown; spouse section works normally.
8. **Existing users (pension > 0, no survivor % previously set):** Default of 100% means no change to projections.
