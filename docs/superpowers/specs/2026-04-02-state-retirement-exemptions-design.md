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

States with `incomeTax: 0` receive `0` for both fields (the zero rate already eliminates the tax).

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

Replace flat-rate pension tax multiplications with `computeStateTax` calls:

```js
// Before
const pensionStateTax = pension * stateInfo.incomeTax;

// After
const pensionStateTax = computeStateTax({
  grossAnnual: pension * 12, stateInfo, type: 'pension', personCount: 1,
}) / 12;
```

Same pattern applies to:
- Spouse pension (`spousePensionStateTax`)
- Retirement-state pension variants (`retPensionNetMonthly`, `retSpousePensionNetMonthly`)

### Trad withdrawal tax (inside the drawdown loop)

Current gross-up logic assumes all trad withdrawals are taxable:
```js
const tradGross = activeStateTaxRate < 1 ? tradSpend / (1 - activeStateTaxRate) : tradSpend;
const stateTaxOnTrad = tradGross - tradSpend;
```

New logic with exemption:
```js
const tradPersonCount = isSurvivor ? 1 : (hasSpouse ? 2 : 1);
const activeStateInfo = hasMoved ? retirementStateInfo : stateInfo;
const tradExemptAnnual = (activeStateInfo.tradExemptPerPerson ?? 0) * tradPersonCount;
const taxableTrad = Math.max(0, tradSpend - tradExemptAnnual);
const stateTaxOnTrad = activeStateTaxRate < 1
  ? taxableTrad * activeStateTaxRate / (1 - activeStateTaxRate)
  : 0;
const tradGross = tradSpend + stateTaxOnTrad;
```

The exemption applies to the net `tradSpend` as a simplification — mathematically, exemptions are defined on gross income, but since state tax rates are flat and the difference is small, this avoids a circular dependency.

### Survivor and retirement-state transitions

No special handling needed. The drawdown loop already switches `stateInfo` vs `retirementStateInfo` via `hasMoved`, and pension variants are already pre-computed per state. `computeStateTax` takes `stateInfo` as a parameter, so correct exemption data flows automatically.

### New return value

```js
// Compute at year-0 after the pre-loop section
const pensionExemptSavingsMonthly =
  (pension * stateInfo.incomeTax) - computeStateTax({ grossAnnual: pension * 12, stateInfo, type: 'pension', personCount: 1 }) / 12
  + (spousePension * stateInfo.incomeTax) - computeStateTax({ grossAnnual: spousePension * 12, stateInfo, type: 'pension', personCount: 1 }) / 12;

// Trad exemption savings approximated at year-0 gap
const tradExemptSavingsMonthly = /* trad withdrawal at year-0 gap × rate reduction */;

return {
  ...,
  stateExemptionSavingsMonthly: Math.round(pensionExemptSavingsMonthly + tradExemptSavingsMonthly),
};
```

Exact year-0 trad savings formula to be determined during implementation (depends on the monthly gap and asset mix).

## UI: Tax & Cost Summary (`ResultsStep.jsx`)

One new line added directly below the existing "State Income Tax" line:

```
State retirement exemptions    −$X/mo
```

- Shown only when `stateExemptionSavingsMonthly > 0`
- Styled as a savings/reduction line (green text or matching existing negative-value style)
- No new user inputs, no changes to `PlannerContext`

## What Does Not Change

- SS state tax logic (`hasSSIncomeTax`) — unchanged
- Part-time income, rental income state tax — no exemptions, unchanged
- Capital gains state tax — no exemptions, unchanged
- Federal tax computation — unchanged
- All existing calc.js inputs and outputs (except one new return value)

## Testing

New test file: `tests/stateTax.test.js`
- Full exemption: tax = 0
- Partial exemption: tax only on amount above cap
- No exemption: matches existing flat-rate behavior
- Zero tax-rate state: tax = 0 regardless of exemption
- Two-person household: exemption doubles correctly
- Survivor phase: single-person exemption only

`calc.test.js`: add regression cases for Illinois (full exemption) and Georgia ($65K cap) to confirm end-to-end pipeline.
