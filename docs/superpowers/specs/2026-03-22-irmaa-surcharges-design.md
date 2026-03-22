# IRMAA Surcharges — Design Spec

**Date:** 2026-03-22
**Feature:** #8 — Medicare IRMAA surcharge modeling
**Branch:** feat/irmaa-surcharges

---

## Overview

IRMAA (Income-Related Monthly Adjustment Amount) is a Medicare premium surcharge applied when a retiree's income exceeds certain thresholds. It affects Part B (medical insurance) and Part D (prescription drug) premiums. Since Medicare is nearly universal for Americans 65+, this surcharge is relevant to virtually all users of this tool who have moderate-to-high retirement income.

The feature adds IRMAA to the projection loop, surfaces it as a metric box in the Tax & Cost Summary section (alongside the existing RMD callout), and nudges users toward Roth conversions as a mitigation strategy.

---

## Scope

**In scope:**
- IRMAA lookup table (2024 IRS brackets, Part B + Part D combined, single and married)
- Per-year IRMAA calculation in the drawdown loop (age 65+)
- IRMAA added to annual expenses so it flows through the full projection
- IRMAA metric box in ResultsStep Tax & Cost Summary
- "No IRMAA" success state when income is below threshold
- Roth conversion nudge in the callout
- Unit tests for the lookup function and calc integration

**Out of scope:**
- Annual inflation-adjustment of IRMAA thresholds (fixed 2024 values, same approach as federal tax brackets)
- Per-year IRMAA chart visualization
- IRMAA-aware Roth conversion optimizer

---

## Data

### 2024 IRMAA Brackets

Combined Part B + Part D monthly surcharge per person:

| Single MAGI      | Married (MFJ) MAGI   | Monthly add-on/person |
|-----------------|---------------------|----------------------|
| ≤ $103,000      | ≤ $206,000          | $0                   |
| $103,001–$129,000 | $206,001–$258,000 | $82.80               |
| $129,001–$161,000 | $258,001–$322,000 | $208.00              |
| $161,001–$193,000 | $322,001–$386,000 | $333.30              |
| $193,001–$500,000 | $386,001–$750,000 | $458.50              |
| > $500,000      | > $750,000          | $500.30              |

*Source: CMS 2024. Note: the top married threshold ($750K) is 1.5× single ($500K), not 2× — the ratio is only exact for lower tiers.*

### Income Definition (IRMAA MAGI Approximation)

IRMAA uses Modified Adjusted Gross Income (MAGI = AGI + tax-exempt interest). AGI includes the **taxable portion** of Social Security (0%–85% depending on combined income), not the gross SS benefit. It includes pension, part-time income, rental income, and traditional account withdrawals (including RMDs).

**Simplifications applied in this projection:**

1. **Gross SS used instead of taxable SS.** We use the full `ssMonthly * 12` as the SS component rather than computing the taxable portion. This slightly overstates MAGI for users whose SS is only 50% taxable, and is accurate for users at 85% taxability (the common case for anyone with meaningful retirement income). Net effect: slightly conservative (may overstate IRMAA by one tier for moderate-income retirees). We accept this.

2. **Portfolio withdrawals excluded to avoid circular dependency.** IRMAA is added to `yearlyNeed` before the gap is computed. This means IRMAA must be estimated before withdrawal amounts are known. Including portfolio withdrawals in MAGI would require circular logic (IRMAA → larger gap → larger withdrawal → higher MAGI → higher IRMAA). We therefore estimate MAGI from guaranteed income only: `SS + pension + part-time + rental`. This may understate IRMAA for retirees with large traditional account balances (high withdrawals). We accept this simplification and note it in the UI.

**MAGI used for lookup:**
```
irmaaMAGI = activeRealSS + realOrdinary   (real/year-0 dollars, annual)
```

Where:
- `activeRealSS` = `ssMonthly * 12` (or `ssMonthlyAlone * 12` in survivor phase) — already in the loop
- `realOrdinary` = `(ptEnded ? nonSSWithoutPT : nonSSWithPT) * 12` — already in the loop; includes pension + part-time + rental
- Both are already computed in real (year-0 dollar) terms; IRMAA brackets are fixed 2024 nominal values, so using real terms is equivalent to assuming IRMAA brackets are inflation-adjusted annually (a reasonable approximation)

---

## Architecture

### New file: `src/utils/irmaaTable.js`

Single exported function:

```js
getIrmaaSurcharge(annualIncome, isMarried) → Number
```

- Returns the monthly IRMAA surcharge **per person**
- `isMarried`: uses MFJ thresholds when true, single thresholds when false
- Returns 0 when income ≤ base threshold ($103K single / $206K married)

### `src/utils/calc.js` changes

In the drawdown loop, **before computing `yearlyNeed`**, add:

```js
// IRMAA: Medicare premium surcharge applies at age 65+
// Uses activeMarried (already derived: isSurvivor ? false : hasSpouse) so filing
// status flips correctly after the first spouse's death.
const irmaaApplies = ageInYear >= 65;
const irmaaMAGI = irmaaApplies ? activeRealSS + realOrdinary : 0;
const irmaaSurchargePerPerson = irmaaApplies ? getIrmaaSurcharge(irmaaMAGI, activeMarried) : 0;

// medicareCount: both spouses on Medicare only while both alive and both ≥ 65.
// Same survivor-phase flag as activeMarried so the two are always consistent.
const spouseOnMedicare = !isSurvivor && hasSpouse && (currentAge + (spouseAge - age)) >= 65;
//   ↑ approximates spouse's age in this loop year
const medicareCount = irmaaApplies ? (spouseOnMedicare ? 2 : 1) : 0;

const irmaaAnnual = irmaaSurchargePerPerson * medicareCount * 12;
```

Then add `irmaaAnnual` to `yearlyNeed`:
```js
const yearlyNeed = ... + irmaaAnnual;
```

Store on each `yearsData` entry:
```js
irmaa: Math.round(irmaaSurchargePerPerson),   // monthly per-person; reuses already-computed variable
```

**Note:** `irmaaSurchargePerPerson` is computed once and reused for both the expense calculation and the stored yearsData value — no double-calling of `getIrmaaSurcharge`.

### Spouse age in loop

`currentAge` tracks the primary person's age in the drawdown loop (`retirementAge + y`). Spouse's age in the same year is approximated as `spouseAge + y` (where `spouseAge` is the spouse's current age at projection start, and the loop index `y` represents years from retirement). The spec author should verify that the existing loop already has a clean way to derive spouse's age at each year — if not, the approximation `(spouseAge + (ageInYear - currentAge))` is acceptable. The important invariant: `medicareCount = 2` only when both `irmaaApplies` (primary ≥ 65) AND spouse's age in that year ≥ 65 AND still in the married phase (`!isSurvivor`).

### `src/steps/ResultsStep.jsx` changes

In the Tax & Cost Summary section, add IRMAA metric box after the RMD box.

**Source data:** Find the first `yearsData` entry where `age >= Math.max(retirementAge, 65)` — call it `firstMedicareYear`. Read `firstMedicareYear.irmaa` (monthly per-person).

**Limitation acknowledged:** For couples where the primary retires before 65 or where the spouses have meaningfully different retirement ages, the snapshot year may show only one person's IRMAA exposure rather than the couple's full steady-state. The UI labels "per person" which is accurate for the snapshot, even if both spouses will ultimately be covered.

**Display:**

- **When `irmaa > 0`:** Orange metric box
  - Label: "Medicare IRMAA"
  - Value: `+$X/mo per person`
  - Sub-note: "Based on your guaranteed retirement income (SS, pension, other fixed sources). Actual IRMAA may be higher if large traditional account withdrawals push your income up."
  - Nudge: "Roth conversions before 65 can reduce this — Roth withdrawals don't count toward the income limit."

- **When `irmaa === 0`:** Green metric box
  - Label: "Medicare IRMAA"
  - Value: "No surcharge"
  - Sub-note: "Your projected income is below the Medicare IRMAA threshold."

---

## Testing

### New file: `tests/irmaaTable.test.js`

Test concrete input/output pairs — do not assert the "2× married" relationship since the top brackets are 1.5×, not 2×.

- Single income at $103,000 → $0/mo
- Single income at $103,001 → $82.80/mo (bracket 1)
- Single income at $150,000 → $208.00/mo (bracket 2)
- Single income at $600,000 → $500.30/mo (top bracket)
- Married income at $206,000 → $0/mo
- Married income at $206,001 → $82.80/mo (same per-person rate, higher threshold)
- Married income at $800,000 → $500.30/mo (top bracket — same per-person rate as single top)

### Additions to `tests/calc.test.js`

```
describe('IRMAA surcharges', () => {
  // Low-income scenario: SS $1,200/mo, no pension → MAGI ≈ $14,400 → $0 surcharge
  it('irmaa is 0 below income threshold');

  // High-income scenario: SS $2,500/mo + pension $3,000/mo → MAGI > $66K still below $103K threshold
  // Need: SS $5,000/mo + pension $5,000/mo → MAGI ≈ $120K → bracket 1 → irmaa > 0
  it('irmaa is positive when income exceeds threshold');

  // Couples test: same guaranteed income, hasSpouse=true → medicareCount=2 → 2× annual expense
  // vs hasSpouse=false at same income → medicareCount=1 → 1× annual expense
  // Couple's runway should be shorter (more total IRMAA paid)
  it('couple pays double the IRMAA compared to single at same income level');

  // Person retires at 62, age 64 in yearsData should have irmaa=0
  it('irmaa is 0 before age 65');
})
```

---

## Backward Compatibility

- `getIrmaaSurcharge` returns 0 for income ≤ $103K → no effect on existing test scenarios (BASE has SS $2K/mo + no pension = MAGI ≈ $24K → $0)
- `irmaa` field added to yearsData entries (like `rmd`) — existing tests that don't check `irmaa` are unaffected
- `irmaaAnnual` = 0 when below threshold or before age 65 → no change to projection math for existing tests
