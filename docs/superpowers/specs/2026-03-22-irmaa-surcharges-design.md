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
- IRMAA on portfolio chart bands
- IRMAA-aware Roth conversion optimizer

---

## Data

### 2024 IRMAA Brackets

Combined Part B + Part D monthly surcharge per person:

| Single income    | Married (MFJ) income | Monthly add-on/person |
|-----------------|---------------------|----------------------|
| ≤ $103,000      | ≤ $206,000          | $0                   |
| $103,001–$129,000 | $206,001–$258,000 | $82.80               |
| $129,001–$161,000 | $258,001–$322,000 | $208.00              |
| $161,001–$193,000 | $322,001–$386,000 | $333.30              |
| $193,001–$500,000 | $386,001–$750,000 | $458.50              |
| > $500,000      | > $750,000          | $500.30              |

*Part B surcharges: $0, $69.90, $174.70, $279.50, $384.30, $419.30/mo*
*Part D surcharges: $0, $12.90, $33.30, $53.80, $74.20, $81.00/mo*

### Income Definition

"Medicare-countable income" for IRMAA is Modified Adjusted Gross Income (MAGI). In this projection, we approximate MAGI as:

```
totalGrossIncome = SS income + pension + traditional account withdrawals + RMD excess + part-time income + rental income
```

This aligns with the `totalIncome` already computed in the drawdown loop (pre-state-tax). Roth withdrawals are excluded from MAGI — which is why Roth conversions before 65 reduce IRMAA exposure.

---

## Architecture

### New file: `src/utils/irmaaTable.js`

Single exported function:

```js
getIrmaaSurcharge(annualIncome, isMarried) → Number
```

- Returns the monthly IRMAA surcharge **per person**
- `isMarried`: uses MFJ thresholds when true, single thresholds when false
- Returns 0 when income ≤ base threshold

### `src/utils/calc.js` changes

In the drawdown loop, after computing `totalGrossIncome` for the year:

1. Determine if IRMAA applies: `ageInYear >= 65` (primary person)
2. Count Medicare-covered people:
   - 1 if no spouse, or survivor phase, or spouse < 65
   - 2 if both alive and both ≥ 65
3. `irmaaSurcharge = getIrmaaSurcharge(totalGrossIncome, hasSpouse) * medicareCount * 12` (annual)
4. Add `irmaaSurcharge` to `expenses` for the year
5. Store `irmaa: Math.round(getIrmaaSurcharge(totalGrossIncome, hasSpouse))` on each `yearsData` entry (monthly per-person amount, for display)

### `src/steps/ResultsStep.jsx` changes

In the Tax & Cost Summary section, add IRMAA metric box after the RMD box:

- **When IRMAA > 0:** Yellow/orange metric box. Title: "Medicare IRMAA". Value: `+$X/mo per person`. Sub-note: "Based on projected retirement income". One-line nudge: "Roth conversions before 65 can reduce this."
- **When IRMAA = 0:** Green metric box. Title: "Medicare IRMAA". Value: "No surcharge". Sub-note: "Your income is below the Medicare IRMAA threshold." (Positive feedback — users want to know they cleared it.)

Source data: `results.yearsData` — find first year where `age >= Math.max(retirementAge, 65)` and read `irmaa` from that row.

---

## Testing

### New file: `tests/irmaaTable.test.js`

- Income at exactly the base threshold → $0
- Income $1 above first bracket → $82.80/mo
- Income in middle bracket (single) → correct amount
- Income at top bracket → $500.30/mo
- Married thresholds are double the single thresholds

### Additions to `tests/calc.test.js`

- `irmaa is 0 below income threshold` — low SS + low withdrawal → no surcharge
- `irmaa is positive when income exceeds threshold` — large trad withdrawal → surcharge appears in yearsData
- `irmaa doubles for couples vs singles at same household income` — hasSpouse with both 65+ → 2× per-person amount
- `irmaa only applies at age 65+` — drawdown years before 65 have irmaa = 0

---

## Backward Compatibility

- `getIrmaaSurcharge` returns 0 for income ≤ base threshold → no effect on existing test scenarios
- `irmaa` field added to yearsData entries (like `rmd`) — existing tests that don't check `irmaa` are unaffected
- Default behavior: if `hasSpouse` is false and income is low, IRMAA = 0, projection unchanged

---

## Plain Language (UI copy)

- Label: **Medicare IRMAA**
- Tooltip/note: "Medicare charges extra premiums when your retirement income exceeds certain limits. This is called IRMAA (Income-Related Monthly Adjustment Amount)."
- Nudge: "Roth conversions before 65 can reduce this — Roth withdrawals don't count toward the income limit."
- No-surcharge note: "Your projected income is below the Medicare IRMAA threshold — no extra premium expected."
