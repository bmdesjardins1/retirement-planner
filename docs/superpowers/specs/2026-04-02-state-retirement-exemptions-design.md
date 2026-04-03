# State Retirement Income Exemptions — Design Spec

**Date:** 2026-04-02
**Status:** Approved

## Problem

The current model applies a flat state income tax rate to all income types with no exemptions. Many states exempt pension income and/or traditional IRA/401k withdrawals — fully or up to a dollar cap. This causes meaningful tax overstatement for residents of states like Illinois (full exemption), Georgia ($65K/person), and Pennsylvania (full exemption), and understates how far their retirement savings will stretch.

## Scope

- Applies to pension income and traditional IRA/401k withdrawals only
- SS income already handled separately via `hasSSIncomeTax`
- Part-time income, rental income, and capital gains: no exemptions (not retirement income)
- Exemptions follow whichever state is active (current state pre-move, retirement state post-move)

## Data Layer: `stateData.js`

Two new fields added to every state entry:

| Field | Type | Meaning |
|---|---|---|
| `pensionExemptPerPerson` | number | Annual pension dollars exempt from state tax, per person |
| `tradExemptPerPerson` | number | Annual trad IRA/401k withdrawal dollars exempt, per person |

Values:
- `0` — no exemption (state taxes all of this income type)
- `Infinity` — full exemption (state taxes none of this income type)
- A positive dollar amount — partial exemption cap

States with `incomeTax: 0` receive `0` for both fields. These values are never consulted — `computeStateTax` returns early when `rate === 0`. The `0` values are placeholders only; they have no effect on the output.

Examples:
```js
"Illinois":    { ..., pensionExemptPerPerson: Infinity, tradExemptPerPerson: Infinity },
"Georgia":     { ..., pensionExemptPerPerson: 65000,    tradExemptPerPerson: 65000    },
"Pennsylvania":{ ..., pensionExemptPerPerson: Infinity, tradExemptPerPerson: Infinity },
"California":  { ..., pensionExemptPerPerson: 0,        tradExemptPerPerson: 0        },
"Florida":     { ..., pensionExemptPerPerson: 0,        tradExemptPerPerson: 0        },
```

Actual values for all 50 states will be researched and populated during implementation using current state tax law.

## New Helper: `src/utils/stateTax.js`

Exports a single function used by `calc.js`:

```js
export function computeStateTax({ grossAnnual, stateInfo, type, personCount = 1 }) {
  const rate = stateInfo.incomeTax;
  if (rate === 0) return 0;

  const exemptPerPerson =
    type === 'pension' ? (stateInfo.pensionExemptPerPerson ?? 0) :
    type === 'trad'    ? (stateInfo.tradExemptPerPerson    ?? 0) :
    0;

  const taxable = Math.max(0, grossAnnual - exemptPerPerson * personCount);
  return taxable * rate;
}
```

Parameters:
- `grossAnnual` — pre-tax annual income amount
- `stateInfo` — state entry from `STATE_DATA` (either current or retirement state)
- `type` — `'pension'` or `'trad'`; any other value applies no exemption
- `personCount` — 1 for single/survivor, 2 for couples (trad bucket is shared; each person contributes their own exemption)

## `calc.js` Changes

### Pension tax (pre-loop)

Replace flat-rate pension tax multiplications with `computeStateTax` calls. All four pension pre-computations use `personCount: 1` — each pension belongs to exactly one person regardless of marital status or survivor phase.

```js
// Primary pension — current state
const pensionStateTax   = computeStateTax({ grossAnnual: pension * 12, stateInfo, type: 'pension', personCount: 1 }) / 12;
const pensionNetMonthly = pension - pensionStateTax;

// Spouse pension — current state
const spousePensionStateTax   = computeStateTax({ grossAnnual: spousePension * 12, stateInfo, type: 'pension', personCount: 1 }) / 12;
const spousePensionNetMonthly = spousePension - spousePensionStateTax;

// Primary pension — retirement state (note: retirementStateInfo, not stateInfo)
const retPensionNetMonthly = pension - computeStateTax({ grossAnnual: pension * 12, stateInfo: retirementStateInfo, type: 'pension', personCount: 1 }) / 12;

// Spouse pension — retirement state (note: retirementStateInfo, not stateInfo)
const retSpousePensionNetMonthly = spousePension - computeStateTax({ grossAnnual: spousePension * 12, stateInfo: retirementStateInfo, type: 'pension', personCount: 1 }) / 12;
```

### Trad withdrawal tax (inside the drawdown loop)

Current gross-up logic assumes all trad withdrawals are taxable:
```js
const tradGross      = activeStateTaxRate < 1 ? tradSpend / (1 - activeStateTaxRate) : tradSpend;
const stateTaxOnTrad = tradGross - tradSpend;
```

New logic with exemption. `activeStateTaxRate` already exists in the loop (derived from `hasMoved`); derive the exemption from the same condition rather than introducing a separate `activeStateInfo` variable:

```js
const tradPersonCount  = isSurvivor ? 1 : (hasSpouse ? 2 : 1);
const tradExemptAnnual = ((hasMoved ? retirementStateInfo : stateInfo).tradExemptPerPerson ?? 0) * tradPersonCount;
const taxableTrad      = Math.max(0, tradSpend - tradExemptAnnual);
const stateTaxOnTrad   = activeStateTaxRate > 0 && activeStateTaxRate < 1
  ? taxableTrad * activeStateTaxRate / (1 - activeStateTaxRate)
  : 0;
const tradGross        = tradSpend + stateTaxOnTrad;
```

The guard `activeStateTaxRate > 0 && activeStateTaxRate < 1` replaces the original `< 1` check and explicitly handles the `>= 1` edge case (impossible in real data, but consistent with the original behavior). For `rate === 0`, `stateTaxOnTrad = 0` and `tradGross = tradSpend` — same as before.

The exemption is applied to `tradSpend` (net) rather than `tradGross` (gross). Mathematically, exemptions apply to gross income, but since state rates are flat (max 9.9%) the understatement is small (< 0.5% of the exempted amount). This avoids a circular dependency between the gross-up and the exemption calculation.

### Survivor and retirement-state transitions

No special handling needed beyond the pre-loop variants above. The `pensionSurvivorPct` multiplier in the drawdown loop is unchanged — it is applied after selecting the pre-computed net value, so the survivor reduction and the exemption compose correctly.

`stateTaxMonthly` in the return value is computed from the pre-loop pension and SS values. It reflects pension exemption savings but **not** trad withdrawal exemption savings — trad tax is only computed inside the drawdown loop and is not part of the year-0 summary. This is consistent with the existing model.

### New return value: `stateExemptionSavingsMonthly`

The savings figure is **pension-only** at year 0. Trad exemption savings depend on year-0 withdrawal amount which varies by asset mix — pension savings alone is the most meaningful and stable figure to show. The UI label reflects this: "Pension exemption savings" rather than "State retirement exemptions" to avoid implying the figure covers all retirement income types.

```js
// Reuse already-computed pensionStateTax and spousePensionStateTax
// These are the flat-rate tax BEFORE the feature; after the feature they are the exemption-adjusted values.
// The savings = what the old flat-rate tax would have been minus what it is now.
const oldPensionTax       = pension      * stateInfo.incomeTax / 12;  // flat rate, no exemption
const oldSpousePensionTax = spousePension * stateInfo.incomeTax / 12;
const stateExemptionSavingsMonthly = Math.round(
  (oldPensionTax - pensionStateTax) + (oldSpousePensionTax - spousePensionStateTax)
);
```

This is computed immediately after the `pensionStateTax` / `spousePensionStateTax` lines, using the current state (not retirement state) — the summary cards always show current-state figures.

### Tax Snapshot total row

The Tax & Cost Summary total row in `ResultsStep.jsx` currently sums:
```js
results.federalTaxMonthly + results.stateTaxMonthly + results.monthlyPropertyTax
```

The `results.stateTaxMonthly` value already reflects exemption-adjusted tax (it's derived from the updated pre-loop computation), so it is already correct. The new `stateExemptionSavingsMonthly` line is a display-only annotation showing how much the exemption saved — it does not need to be subtracted from the total (it is already reflected in `stateTaxMonthly`). No change to the total row formula is needed.

## UI: Tax & Cost Summary (`ResultsStep.jsx`)

One new line added directly below the existing "State Income Tax" line:

```
Pension exemption savings    −$X/mo
```

- Label is "Pension exemption savings" (not "State retirement exemptions") — the figure is pension-only; labeling it broadly would imply it covers trad withdrawal exemptions as well
- Shown only when `stateExemptionSavingsMonthly > 0`
- Styled as a savings/reduction line (green text or matching existing negative-value style)
- The displayed value is `stateExemptionSavingsMonthly` formatted as a negative dollar amount (e.g., `−$312/mo`)
- No new user inputs, no changes to `PlannerContext`

## What Does Not Change

- SS state tax logic (`hasSSIncomeTax`) — unchanged
- Part-time income, rental income state tax — no exemptions, unchanged
- Capital gains state tax — no exemptions, unchanged
- Federal tax computation — unchanged
- All existing calc.js inputs and outputs (except one new return value)

## Testing

New test file: `tests/stateTax.test.js`
- Full exemption (`Infinity`): tax = 0
- Partial exemption: tax only on amount above cap
- No exemption (`0`): matches existing flat-rate behavior exactly
- Zero tax-rate state: `computeStateTax` returns 0 regardless of exemption value
- Two-person household (`personCount: 2`): total exempt amount doubles
- Survivor phase (`personCount: 1`): single-person exemption only

`calc.test.js`: add regression cases confirming:
- Illinois (full exemption): pension net = full pension amount, no state tax deducted
- Georgia ($65K cap): pension under $65K is untaxed; pension over $65K has tax only on the excess
- Illinois user with a pension: `stateExemptionSavingsMonthly` equals `pension * stateInfo.incomeTax` rounded (full old tax is saved, new tax is 0)
