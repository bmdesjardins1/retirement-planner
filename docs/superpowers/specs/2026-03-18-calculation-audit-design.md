# Calculation Accuracy Audit — Design Spec
**Date:** 2026-03-18
**Project:** Retirement Planner
**Status:** Approved

---

## Overview

Audit and fix the retirement projection calculations in two phases:

- **Phase 1:** Four targeted bug fixes — no new user inputs except one toggle
- **Phase 2:** Account type system — separate Traditional/Roth/Taxable balances per person with correct tax treatment and tax-efficient withdrawal ordering

---

## Phase 1: Bug Fixes

### Fix 1 — Healthcare in survivor scenario

**Problem:** The survivor factor (0.6) is applied to healthcare costs in solo projections. Healthcare is a per-person expense — a surviving spouse's costs don't drop 40% when their partner dies.

**Note:** This is a modeling assumption change. Removing the 0.6 means solo projections assume the same healthcare cost as the combined household, which is the more defensible choice. Known gap: the combined projection uses `survivorFactor = 1.0` for its entire horizon, including years after the first spouse statistically would have died. This is not addressed in this phase.

**Fix:**
```js
const baseHealthcareNeed    = healthcare * col;  // per-person cost — survivorFactor does not apply
const baseNonHealthcareNeed = (housing + food + transport + leisure + other) * col * survivorFactor;
```

**Files:** `src/utils/calc.js`

---

### Fix 2+3 — Federal bracket inflation + circular dependency

**Problem A:** Federal income tax brackets are hardcoded 2024 values. Over a 30-year projection, bracket creep overstates taxes as nominal income grows but thresholds don't.

**Problem B:** Tax is currently estimated on the net spending gap, then added on top. The tax bill itself requires an additional withdrawal, creating a circular dependency.

**Fix:** Work in real (year-0 dollar) terms when calling `estimateFederalTax()`, then scale the result back to nominal. Two iterations resolve the circular dependency. These are implemented together in the drawdown loop:

```js
// Year-0 values are already real-term (no adjustment needed)
const realSS       = ssMonthly * 12;
const realOrdinary = currentNonSS * 12;   // NOTE: see Fix 4 — pension is extracted from this
const realGap      = preTaxGap / generalFactor;

// Iteration 1
const realTax1 = estimateFederalTax({
  ssAnnual: realSS, ordinaryIncome: realOrdinary,
  withdrawalEstimate: realGap, married: hasSpouse, age: ageInYear,
});

// Iteration 2: gross up — gap + iteration-1 tax
const realTax2 = estimateFederalTax({
  ssAnnual: realSS, ordinaryIncome: realOrdinary,
  withdrawalEstimate: realGap + realTax1, married: hasSpouse, age: ageInYear,
});

const federalTax     = realTax2 * generalFactor;
const yearlyWithdrawal = preTaxGap + federalTax;
```

Two iterations is sufficient precision for a planning tool. The remaining error is negligible at realistic income levels.

**Social Security provisional income thresholds:** The thresholds inside `estimateFederalTax()` that determine how much Social Security becomes taxable ($32,000/$44,000 married; $25,000/$34,000 single) are intentionally left as nominal frozen values — they have not been adjusted for inflation since 1984. Do not deflate them. By passing real-term income while leaving thresholds nominal, we correctly model the bracket creep that the law creates.

**Files:** `src/utils/calc.js`

---

### Fix 4 — Pension inflation toggle

**Problem:** Pension income inflates with `generalFactor` every year. Most pensions pay a fixed dollar amount for life.

**Fix:** Add `pensionCOLA` boolean (default `false`) to `PlannerContext`. Add a toggle in `IncomeStep` (visible when pension > 0): "Does this pension increase with inflation each year?"

**Implementation detail — income pre-computation must be restructured.** Currently, `netIncomeWithPT` and `netIncomeWithoutPT` are computed before the loop as single scalars that include pension, then the loop multiplies the whole scalar by `generalFactor`. This works when everything inflates uniformly, but breaks when pension must inflate independently. Pension must be extracted from the pre-loop scalar and handled separately inside the loop.

Restructure as follows:

```js
// Before the loop: non-pension income (always inflates)
const pensionStateTax    = pension * stateInfo.incomeTax;
const pensionNetMonthly  = pension - pensionStateTax;

const nonPensionGrossWithPT  = ssMonthly + partTimeIncome + rentalIncome;
const nonPensionTaxWithPT    = (partTimeIncome + rentalIncome + ssTaxableMonthly) * stateInfo.incomeTax;
const nonPensionNetWithPT    = nonPensionGrossWithPT - nonPensionTaxWithPT;

const nonPensionGrossWithoutPT = ssMonthly + rentalIncome;
const nonPensionTaxWithoutPT   = (rentalIncome + ssTaxableMonthly) * stateInfo.incomeTax;
const nonPensionNetWithoutPT   = nonPensionGrossWithoutPT - nonPensionTaxWithoutPT;

// Inside the loop: assemble yearlyIncome from components
const pensionContrib = pensionCOLA
  ? pensionNetMonthly * 12 * generalFactor   // inflates
  : pensionNetMonthly * 12;                  // fixed

const baseNet    = ptEnded ? nonPensionNetWithoutPT : nonPensionNetWithPT;
const yearlyIncome = (baseNet * 12 * generalFactor) + pensionContrib;

// realOrdinary for tax purposes also uses the same split:
const pensionOrdinary = pensionCOLA ? pension * 12 : pension * 12 / generalFactor;
// (pension gross in real terms — for pension COLA: divide nominal pension by generalFactor;
//  for fixed pension: already in real terms = pension * 12)
// Simplified:
const realPensionGross  = pensionCOLA ? pension * 12 : pension * 12;  // fixed pension is already real
// For COLA pension: nominal = pension * 12 * generalFactor; real = pension * 12
// Either way realPensionGross = pension * 12
const realOrdinary = pension * 12 + (ptEnded ? rentalIncome : rentalIncome + partTimeIncome) * 12;
// (= the same as before — pension gross is pension * 12 in real terms regardless of COLA)
```

The key insight: for tax calculations, `realOrdinary` remains `pension * 12 + other * 12` in real terms regardless of `pensionCOLA`, because real-term pension income is always the year-0 value. The COLA flag only affects whether the *nominal* income in `yearlyIncome` inflates. This means Fix 4 does not change the `realOrdinary` used in Fix 2+3.

**Files:** `src/context/PlannerContext.jsx`, `src/steps/IncomeStep.jsx`, `src/utils/calc.js`

---

## Phase 2: Account Type System

### New Data Model

Replace the 3 asset balance fields per person with 5 typed account fields:

| Account | Tax treatment on withdrawal |
|---|---|
| Traditional 401k | Taxable as ordinary income (federal + state) |
| Roth 401k | Tax-free |
| Traditional Individual Retirement Account | Taxable as ordinary income (federal + state) |
| Roth Individual Retirement Account | Tax-free |
| Taxable brokerage | 60% of withdrawal at long-term capital gains rates; 40% principal return (tax-free) |

**State variables:** `trad401k`, `roth401k`, `tradIRA`, `rothIRA`, `taxableBrokerage` per person (same prefix for spouse).

---

### UI — AssetsStep

Each account has a "I have this account" toggle that shows/hides the balance slider. Default visible: Traditional 401k + taxable brokerage. Default hidden: the rest. Contribution sliders unchanged. Plain-language labels with tooltips.

---

### Projection: Separate Bucket Tracking

Three buckets tracked independently through the drawdown loop. Each grows at `investmentReturn` before withdrawals each year:

```js
let taxableBucket = taxableBrokerage;
let tradBucket    = trad401k + tradIRA;
let rothBucket    = roth401k + rothIRA;
// portfolio = taxableBucket + tradBucket + rothBucket
```

---

### Per-Year Tax Accounting

**Step 1 — Determine spending allocation (allocate `preTaxGap` across buckets):**

Allocate only the net spending gap across buckets first. Taxes are computed from this split and added on top — this avoids a circular dependency between tax estimates and the bucket split.

```
taxableSpend = min(taxableBucket, preTaxGap)
tradSpend    = min(tradBucket, preTaxGap - taxableSpend)
rothSpend    = min(rothBucket, preTaxGap - taxableSpend - tradSpend)
```

**Step 2 — Compute taxes based on that split:**

```
// State tax on Traditional: flat-rate gross-up is exact
tradGross      = tradSpend / (1 - stateIncomeTax)
stateTaxOnTrad = tradGross - tradSpend

// Federal tax on Traditional withdrawal — two-iteration gross-up in real terms (Fix 2+3)
// withdrawalEstimate is the Traditional gross withdrawal in real terms
{ tax: federalTax, taxableSS } = twoIterationFederalTax(
  realSS, realOrdinary, withdrawalEstimate = tradGross / generalFactor
)
federalTax *= generalFactor  // scale back to nominal

// Capital gains tax on taxable brokerage withdrawal
capGainsTax = estimateCapitalGainsTax({
  taxableGains: (taxableSpend * 0.60) / generalFactor,  // real terms
  totalOrdinaryIncome: realOrdinary + (tradGross / generalFactor) + taxableSS,
  married: hasSpouse,
}) * generalFactor  // scale back to nominal
```

**Step 3 — Total portfolio deduction:**

```
yearlyWithdrawal = preTaxGap + stateTaxOnTrad + capGainsTax + federalTax
```

The taxes are drawn from the portfolio in addition to the spending gap. For simplicity, all taxes are deducted from the total portfolio balance (not re-split across buckets). The spending allocation (Step 1) drives bucket depletion tracking — each bucket's balance is reduced by its spending allocation.

**Bucket balance updates:**
```
taxableBucket -= (taxableSpend + proportionalTaxDeduction)  // see note
tradBucket    -= tradGross  // gross amount leaves the Traditional bucket (net spend + state tax)
rothBucket    -= rothSpend
portfolio      = taxableBucket + tradBucket + rothBucket
```

**Note on tax deductions:** For tracking purposes, the capital gains tax and federal tax are deducted from the taxable bucket first (since taxes on capital gains are paid from sale proceeds), then from Traditional, then Roth — same ordering as spending. This is a planning-tool simplification; the exact source of tax payments does not materially affect the portfolio depletion curve over a 30-year horizon.

---

### Capital Gains Tax Helper

New function in `src/utils/federalTax.js`:

```js
export function estimateCapitalGainsTax({ taxableGains, totalOrdinaryIncome, married })
```

Parameters are in real (year-0) terms. Caller scales result back to nominal.

`totalOrdinaryIncome` must include all ordinary income stacked below the gains:
- `realOrdinary` (pension + rental + part-time)
- `tradWithdrawalGross / generalFactor` (Traditional withdrawal in real terms)
- `taxableSS` — the taxable portion of Social Security (computed from the combined income test already in `estimateFederalTax`; extract this as a helper or return it alongside the tax)

Capital gains are stacked on top of this total. The applicable rate (0%/15%/20%) is determined by where `totalOrdinaryIncome + taxableGains` falls relative to the 2024 long-term capital gains brackets, inflation-adjusted to real terms:
- 0% bracket: up to $94,050 (married) / $47,025 (single) of total income
- 15% bracket: up to $583,750 (married) / $518,900 (single)
- 20% above that

**`taxableSS` extraction:** Modify `estimateFederalTax()` to return `{ tax, taxableSS }` so callers have access to the computed taxable SS amount for use in capital gains stacking. Existing callers can destructure just `{ tax }`.

**Files:** `src/utils/federalTax.js`

---

### Known Limitations (Explicitly Out of Scope)

**Required Minimum Distributions** (mandatory minimum withdrawals the Internal Revenue Service requires from Traditional accounts starting at age 73): Not modeled. Understates taxable income and taxes from age 73+, overstates Roth balances. Flagged for a future phase.

**Taxable brokerage cost basis not tracked:** The 60/40 gain/principal split is fixed. As basis is exhausted over a long drawdown, this understates capital gains tax in later years. Flagged for a future phase.

**Social Security provisional income thresholds frozen:** Intentionally left nominal — frozen by law since 1984. Passing real-term income against nominal thresholds correctly models the bracket creep the law creates.

**Combined projection survivor modeling:** Combined projection uses `survivorFactor = 1.0` for its full horizon, even post-first-death. Not addressed this phase.

**State income tax progressive brackets:** Flat-rate approximation unchanged.

---

## Files Changed

| File | Change |
|---|---|
| `src/utils/calc.js` | All Phase 1 fixes; pension income restructured; Phase 2 bucket tracking and two-round tax accounting |
| `src/utils/federalTax.js` | Return `{ tax, taxableSS }` from `estimateFederalTax`; add `estimateCapitalGainsTax()` |
| `src/context/PlannerContext.jsx` | Replace 3 asset fields with 5 per person; add `pensionCOLA`; add account visibility toggles |
| `src/steps/IncomeStep.jsx` | Pension COLA toggle |
| `src/steps/AssetsStep.jsx` | New account type UI with show/hide toggles |
