# Home Equity as an Asset — Design Spec

**Date:** 2026-03-22
**Feature:** #9 — Home equity modeling (sale backstop)
**Branch:** feat/home-equity

---

## Overview

Homeownership is the largest asset for most American households, yet the current tool ignores it entirely as a retirement resource. This feature lets users model a planned home sale: net proceeds are injected into the portfolio as a lump sum at the sale year, and property tax expenses stop after the sale.

The Real Estate & Growth card in AssetsStep already captures `homeValue` and `homeOwned`. This feature extends that card with three new inputs (mortgage balance, sale intent, sale age) and wires them through the drawdown loop.

---

## Scope

**In scope:**
- `mortgageBalance` input → live equity display (`homeValue − mortgageBalance`)
- Intent toggle: "Sell & Invest Proceeds" vs. "Keep / Leave to Heirs"
- Planned sale age slider (conditional on sell intent)
- Net proceeds (`max(0, homeValue − mortgageBalance) × 0.95`) injected into `taxableBucket` at sale year (see Simplifications #1)
- Property tax stops after sale year (`activeMonthlyPropertyTax → 0` when sold)
- `homeSaleProceeds` field on `yearsData` for the sale year
- Home sale callout in ResultsStep Tax & Cost Summary card when proceeds > 0

**Out of scope:**
- Home value appreciation modeling (real-dollar framework already holds value constant in real terms)
- Capital gains tax on home sale (primary residence exclusion covers most users; noted as simplification)
- Reverse mortgage
- Pre-sale mortgage paydown modeling (today's balance used as-is; noted as simplification)

---

## Data Model

### New state (PlannerContext)

| Field | Type | PlannerContext default | Constraint |
|---|---|---|---|
| `mortgageBalance` | number | 0 | ≥ 0 |
| `homeSaleIntent` | `"sell"` \| `"keep"` | `"keep"` | — |
| `homeSaleAge` | number | `retirementAge` (current state value at mount) | ≥ `retirementAge`, ≤ `lifeExpectancy` |

The `calc.js` destructuring default for `homeSaleAge` is `Infinity` — this is a direct-call safety net only. In practice the field is always provided from PlannerContext, so `Infinity` is never used. The operative default is always the PlannerContext initial state value (`retirementAge`).

---

## Architecture

### `src/context/PlannerContext.jsx`

Add three state values:
```js
const [mortgageBalance, setMortgageBalance] = useState(0);
const [homeSaleIntent, setHomeSaleIntent] = useState("keep");
const [homeSaleAge, setHomeSaleAge] = useState(retirementAge);
```

**Constrained setter for `homeSaleAge`:** The clamping must live inside the existing constrained setters — not as a standalone setter — to avoid React batching issues with stale state reads.

Three setters need a `homeSaleAge` clamp line:

Inside `setAge(v)` (after the existing `setRetirementAgeRaw(v)` call):
```js
// existing clamps ...
if (homeSaleAge < v) setHomeSaleAge(v);   // add this line (v = new age, which retirementAge was pushed to)
```

Inside `setRetirementAge(v)`:
```js
// existing clamps ...
if (homeSaleAge < v) setHomeSaleAge(v);   // add this line
```

Inside `setLifeExpectancy(v)`:
```js
// existing clamps — note: uses raw v, matching the existing ltcStartAge pattern.
// The actual stored lifeExpectancy = Math.max(v, retirementAge+1), but we clamp
// homeSaleAge against raw v for consistency. The UI slider min (retirementAge)
// prevents the slider from reaching a value below retirementAge+1 in practice.
if (homeSaleAge > v) setHomeSaleAge(v);   // add this line
```

**All three `runProjection` calls** (combined, primary solo, spouse solo) receive the new fields:
```js
mortgageBalance,
homeSaleIntent,
homeSaleAge,
```

Note on solo projections: The home is a shared asset, but passing the same sale to solo projections is an accepted simplification. Solo projections are used to show relative contribution (not as standalone plans), so the slight overstatement is acceptable. The implementer should NOT add a guard to exclude these fields from solo calls — just pass them through identically.

**Expose via `usePlanner()`:** Add all three fields and their setters to the context value.

---

### `src/steps/AssetsStep.jsx`

Inside the existing `homeOwned` block in the Real Estate & Growth card, after the home value slider, add:

1. **Mortgage Balance** slider
   - Label: "Remaining Mortgage Balance"
   - Min: 0, Max: 1,500,000, Step: 5,000, Prefix: `$`
   - Note: "What you still owe on your mortgage today. If your mortgage is paid off (or nearly so), enter $0."
   - Live display below the slider: `Estimated Equity: $X` (computed as `Math.max(0, homeValue - mortgageBalance)`, formatted with `toLocaleString()`)

2. **Intent toggle**
   - Label: "What do you plan to do with this home?"
   - Options: "Sell & Invest Proceeds" / "Keep / Leave to Heirs"
   - Uses `toggle-group` / `toggle` / `toggle--active` CSS classes (same pattern as housing toggle in SpendingStep)
   - Drives `homeSaleIntent`

3. **Planned Sale Age** slider (only rendered when `homeSaleIntent === "sell"`)
   - Label: "Planned Sale Age"
   - Min: `retirementAge`, Max: `lifeExpectancy`, Step: 1, Suffix: ` yrs`
   - Note: "We'll add ~95% of your equity to your portfolio at this age, after realtor fees and closing costs."

---

### `src/utils/calc.js`

**Inputs destructuring** — add three fields:
```js
mortgageBalance = 0,
homeSaleIntent = "keep",
homeSaleAge = Infinity,
```

**In-loop additions** (inside the drawdown `for` loop):

**Step A — `homeSold` flag and property tax guard** (replace the existing `activeMonthlyPropertyTax` line on line 229):

```js
// Home sale: property tax stops in and after the sale year.
// We stop the full year (not prorated) as a simplification — the same year
// the proceeds arrive also has no property tax. The net effect is a slight
// benefit in the sale year. Accepted simplification.
const homeSold = homeOwned && homeSaleIntent === "sell" && ageInYear >= homeSaleAge;
const activeMonthlyPropertyTax = homeSold
  ? 0
  : (hasMoved ? retMonthlyPropertyTax : monthlyPropertyTax);
```

**Step B — Proceeds injection** (immediately after the bucket growth block, before spending allocation):

```js
// Home sale: inject net proceeds into taxableBucket.
//
// Why taxableBucket: after a real home sale, proceeds are deposited into a
// taxable brokerage account — that is exactly what taxableBucket models.
// The 60%-gains assumption applies when the bucket is drawn for spending,
// causing a minor overstatement of capital gains tax on what is actually
// tax-free principal (after the primary residence exclusion). The error
// magnitude is small (~$3,000–4,000/year of phantom tax for a typical
// $300–400K infusion drawn over many years) and acceptable for a
// planning tool. Documented in Simplifications #1.
//
// Net proceeds = 95% of equity (5% covers realtor fees + closing costs).
// Mortgage balance used is today's balance — we do not model paydown
// between now and the sale date (see Simplifications).
let homeSaleProceeds = 0;
if (homeOwned && homeSaleIntent === "sell" && ageInYear === homeSaleAge) {
  homeSaleProceeds = Math.max(0, homeValue - mortgageBalance) * 0.95;
  taxableBucket += homeSaleProceeds;
}
```

Place this block after bucket growth (`taxableBucket +=`, `tradBucket +=`, `rothBucket +=`) and before spending allocation (`taxableSpend`, `tradSpend`, `rothSpend`).

**yearsData.push** — add one field in the drawdown phase:
```js
homeSaleProceeds: Math.round(homeSaleProceeds),
```

Also add `homeSaleProceeds: 0` to the accumulation phase `yearsData.push` for shape consistency.

---

### `src/steps/ResultsStep.jsx`

Find the sale year:

```js
const homeSaleYear = results.yearsData.find(d => d.homeSaleProceeds > 0);
```

**Placement:** Inside the Tax & Cost Summary card, alongside the existing RMD and IRMAA callouts. This is the established pattern for notable one-time or recurring projection events.

**Display (when `homeSaleYear` exists):**

Render a metric box (same visual pattern as RMD/IRMAA boxes) with:
- Label: "Home Sale"
- Value: `+$X` (formatted with `toLocaleString()`, where X = `homeSaleYear.homeSaleProceeds`)
- Sub-note: `At age ${homeSaleYear.age} — net proceeds after fees added to portfolio`

No success/zero state needed — the box only renders when `homeSaleYear` exists. When `homeSaleIntent === "keep"` or `homeOwned === false`, no box is shown.

---

## Simplifications

1. **Proceeds injected into `taxableBucket` (minor gains overstatement).** After a real home sale, proceeds go into a taxable brokerage account — that's what `taxableBucket` models. Home sale proceeds after the primary residence exclusion ($250K single / $500K married) are tax-free principal, but the existing 60%-gains assumption applies to all `taxableBucket` withdrawals, causing a small overstatement of capital gains tax on those proceeds when drawn (~$3,000–4,000/year of phantom tax for a typical $300–400K infusion). This is within the noise of other planning-tool simplifications and is acceptable. The alternative (tracking a separate principal balance per withdrawal) adds loop complexity disproportionate to the accuracy gain.

2. **No home value appreciation.** The tool operates in real (year-0 dollar) terms throughout. `homeValue` entered today is used as the real-dollar sale price regardless of sale age. This is equivalent to assuming home appreciation matches general inflation — a reasonable baseline.

3. **Property tax stops the full year of sale (not prorated).** The user pays zero property tax in the sale year and receives the full proceeds in the same year. Net benefit: one free year of property tax. Accepted as a planning tool simplification.

4. **Property tax summary card (above the projection loop) does not reflect post-sale state.** The "After CoL Adj. + Property Tax" summary metric in SpendingStep and the pre-loop `totalMonthlyNeed` in the return object both use the current-year property tax rate. After a planned sale, these cards still show the pre-sale tax figure. This is intentional — those cards show year-0 conditions, not the post-sale steady state. No fix needed; document as known behavior.

5. **`mortgageBalance` is today's balance.** We do not model mortgage paydown between now and the sale date. A user selling at age 70 whose mortgage is paid off at 65 should enter $0 (or a low balance). The UI note acknowledges this. If `homeSaleAge >= mortgagePayoffAge`, the user likely owes $0 at sale, and the note encourages them to enter $0.

6. **Solo projections receive the same sale.** All three `runProjection` calls (combined, primary solo, spouse solo) receive identical `homeSaleIntent`, `homeSaleAge`, and `mortgageBalance`. The home is a shared asset, so this slightly overstates the solo projections. Solo projections are relative indicators, not standalone plans — acceptable simplification.

---

## Testing

### `tests/calc.test.js` — new describe block: `'Home equity sale'`

1. **No proceeds when intent is keep:** `homeSaleIntent: "keep"` → all `homeSaleProceeds` in yearsData are 0; property tax is continuous throughout
2. **Proceeds injected at sale age:** `homeSaleIntent: "sell"`, `homeSaleAge: 70` → yearsData entry at age 70 has `homeSaleProceeds > 0`; portfolio is visibly larger that year
3. **Property tax stops at sale:** `homeSaleIntent: "sell"`, `homeSaleAge: 70` → `expenses` for age 70 is lower than age 69 by approximately the annual property tax amount
4. **Zero equity edge case:** `mortgageBalance >= homeValue` → `homeSaleProceeds === 0` (no negative proceeds)
5. **Runway extends with sale:** same inputs, `homeSaleIntent: "sell"` vs `"keep"` → `runwayYears` is longer when selling
6. **Boundary — sale at first drawdown year:** `homeSaleAge === retirementAge` (y=0) → `homeSaleProceeds > 0` in the first drawdown entry; property tax is 0 from year one
