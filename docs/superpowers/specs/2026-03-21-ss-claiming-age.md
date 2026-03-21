# Social Security Claiming Age — Design Spec

## Goal
Let users specify when they plan to claim Social Security (age 62–70). Automatically adjust their benefit based on SSA's published formula. Model the survivor benefit loss in the combined projection when the first spouse dies.

---

## Background

The user's ssa.gov estimate is shown at their **Full Retirement Age (FRA)**. For anyone born 1960 or later (the vast majority of working-age users), FRA = 67. Claiming earlier permanently reduces the benefit; delaying past FRA permanently increases it.

**SSA adjustment formula:**
- Each month *before* FRA: −5/9% for first 36 months, −5/12% beyond that
  - At 62 (60 months early): −30% → 70% of FRA benefit
  - At 64 (36 months early): −20% → 80% of FRA benefit
- Each year *after* FRA: +8% (Delayed Retirement Credits)
  - At 70 (3 years late): +24% → 124% of FRA benefit

**Assumption:** FRA = 67. Noted in UI. Accurate for anyone born 1960+.

---

## Survivor Benefit

When one spouse dies, the household loses the **lower** of the two SS benefits and keeps only the **higher** one. This is SSA law — the survivor receives whichever is greater: their own benefit or the deceased's full benefit.

Current problem: the combined projection uses `ss1 + ss2` for the entire drawdown. That's incorrect — it overstates income during the survivor phase. Additionally, expenses should drop to 60% (survivorFactor) after the first death, but currently stay at 100%.

**Survivor transition (combined projection only):**
- `firstDeathAge` = min(primaryLifeExpectancy, primaryAge + (spouseLifeExpectancy − spouseAge))
- Before firstDeathAge: SS = ss1_adj + ss2_adj, expenses × 1.0, married filing jointly
- After firstDeathAge: SS = max(ss1_adj, ss2_adj), expenses × 0.6, filing as single

The solo projections (survivorFactor=0.6 inputs) are unaffected — they already model one person only.

---

## New State

| Variable | Default | Description |
|---|---|---|
| `ss1ClaimAge` | 67 | Age primary user plans to claim SS |
| `ss2ClaimAge` | 67 | Age spouse plans to claim SS |

`ss1` and `ss2` remain as FRA benefit inputs (no rename). The label in IncomeStep is updated to clarify these are FRA amounts.

---

## New Utility: `ssAdjustmentFactor(claimAge, fra = 67)`

Lives in `src/utils/ssUtils.js`. Returns a multiplier to apply to the FRA benefit.

```js
export function ssAdjustmentFactor(claimAge, fra = 67) {
  if (claimAge >= fra) return 1 + (claimAge - fra) * 0.08;
  const monthsEarly = (fra - claimAge) * 12;
  const reduction = monthsEarly <= 36
    ? monthsEarly * (5 / 9 / 100)
    : 36 * (5 / 9 / 100) + (monthsEarly - 36) * (5 / 12 / 100);
  return 1 - reduction;
}
```

Spot checks:
- claimAge 62: factor = 0.70 (30% reduction) ✓
- claimAge 67: factor = 1.00 ✓
- claimAge 70: factor = 1.24 (+24%) ✓

---

## PlannerContext Changes

1. Add `ss1ClaimAge` / `ss2ClaimAge` state (default 67)
2. Compute derived adjusted amounts:
   ```js
   const adjustedSS1 = ss1 * ssAdjustmentFactor(ss1ClaimAge);
   const adjustedSS2 = ss2 * ssAdjustmentFactor(ss2ClaimAge);
   ```
3. Pass `ss1: adjustedSS1` and `ss2: adjustedSS2` (and `ss2: 0` for solo) to all three `runProjection()` calls
4. Expose `ss1ClaimAge`, `setSs1ClaimAge`, `ss2ClaimAge`, `setSs2ClaimAge`, `adjustedSS1`, `adjustedSS2` in context
5. Add `ss1ClaimAge`, `ss2ClaimAge` to dep arrays of all three `useMemo` calls

---

## IncomeStep UI Changes

Below each SS slider, add:

1. A **Claiming Age** slider (min 62, max 70, step 1, default 67)
2. An **inline benefit preview** note:
   - At FRA (67): `"At 67 (Full Retirement Age): $1,800/mo"`
   - Early: `"At 64: $1,440/mo — $360/mo less than waiting until 67"`
   - Late: `"At 70: $2,232/mo — $432/mo more than claiming at 67"`

Label on the FRA benefit slider updated to: `"Your Social Security Benefit (at Full Retirement Age 67)"`

Same pattern for spouse SS if hasSpouse.

---

## calc.js Changes

### 1. Adjusted SS amounts pass through unchanged
`ss1` and `ss2` params now receive pre-adjusted values from PlannerContext. No change to how they're used in solo projections.

### 2. Survivor transition for combined projection

Add before the drawdown loop:

```js
const modelSurvivor = hasSpouse && survivorFactor === 1.0;
const firstDeathAge = modelSurvivor
  ? Math.min(lifeExpectancy, currentAge + (spouseLifeExpectancy - spouseAge))
  : Infinity;

// Survivor-phase income bases
const ssMonthlyAlone       = Math.max(ss1, ss2);
const ssTaxableAlone       = stateInfo.hasSSIncomeTax ? ssMonthlyAlone : 0;
const baseNonHealthcareNeedAlone = (housing + food + transport + leisure + other) * col * 0.6;

const nonPensionGrossWithPTAlone    = ssMonthlyAlone + partTimeIncome + rentalIncome;
const nonPensionTaxWithPTAlone      = (partTimeIncome + rentalIncome + ssTaxableAlone) * stateInfo.incomeTax;
const nonPensionNetWithPTAlone      = nonPensionGrossWithPTAlone - nonPensionTaxWithPTAlone;

const nonPensionGrossWithoutPTAlone = ssMonthlyAlone + rentalIncome;
const nonPensionTaxWithoutPTAlone   = (rentalIncome + ssTaxableAlone) * stateInfo.incomeTax;
const nonPensionNetWithoutPTAlone   = nonPensionGrossWithoutPTAlone - nonPensionTaxWithoutPTAlone;
```

Inside the drawdown loop, add at the top:

```js
const isSurvivor = modelSurvivor && ageInYear > firstDeathAge;
const activeBaseNonHealthcareNeed  = isSurvivor ? baseNonHealthcareNeedAlone : baseNonHealthcareNeed;
const activeNonPensionNetWithPT    = isSurvivor ? nonPensionNetWithPTAlone    : nonPensionNetWithPT;
const activeNonPensionNetWithoutPT = isSurvivor ? nonPensionNetWithoutPTAlone : nonPensionNetWithoutPT;
const activeRealSS                 = isSurvivor ? ssMonthlyAlone * 12          : realSS;
const activeMarried                = isSurvivor ? false : hasSpouse;
```

Replace usages of `baseNonHealthcareNeed`, `nonPensionNetWithPT` / `nonPensionNetWithoutPT`, `realSS`, and `hasSpouse` (for federal tax) with the `active*` variants inside the loop.

---

## Files Changed

| File | Change |
|---|---|
| `src/utils/ssUtils.js` | NEW — `ssAdjustmentFactor()` |
| `src/context/PlannerContext.jsx` | Add claim age state, derived adjustedSS1/SS2, wire to projections |
| `src/steps/IncomeStep.jsx` | Claiming age sliders + benefit preview notes |
| `src/utils/calc.js` | Survivor transition in combined drawdown loop |
| `tests/calc.test.js` | New tests for claiming adjustment + survivor transition |
