# Tax & Cost Summary Redesign + SS Breakeven Analysis

**Date:** 2026-03-26
**Status:** Draft

---

## Goal

Consolidate a crowded Tax & Cost Summary section into a denser, more readable layout, and add a Social Security breakeven analysis callout that tells users whether delaying their SS claim pays off given their life expectancy.

---

## Background

The Tax & Cost Summary section has grown organically as features were added. It currently contains:
- Four metric boxes in a 2-column grid (Federal Tax, State Tax, Property Tax, LTC/CoL)
- Up to four full-width conditional callouts (RMD, IRMAA "no surcharge" or surcharge, Home Sale, Roth Window)

The result is a vertically bloated section with inconsistent box heights, wasted whitespace, and a heading ("Taxes & Cost of Living Impact") that no longer reflects the content. This spec redesigns it into two denser rows plus adds the SS breakeven feature.

---

## Section Rename

**Old heading:** "Taxes & Cost of Living Impact"
**New heading:** "Taxes & Planning Insights"

---

## Part 1: Tax Snapshot Box

### What changes
Replace the four separate metric boxes (grid-2) with a single compact "tax snapshot" card component. Each item is a label-value row rather than an oversized metric box.

### Layout
```
Taxes & Costs
─────────────────────────────────────────
Federal Tax (est.)          −$1,200/mo
[State] State Tax           −$300/mo
  ↳ note if planningToMove (see below)
Property Tax                −$450/mo
Long-Term Care              −$2,000/mo · starts age 75
  [OR if longTermCare === 0:]
─────────────────────────────────────────
Total                       −$3,950/mo

Cost of Living              +2.3% vs national avg
```

### Total row
`total = federalTaxMonthly + stateTaxMonthly + monthlyPropertyTax + (longTermCare > 0 ? longTermCare : 0)`

The CoL adjustment is a percentage, not a dollar figure, so it is displayed separately below the total line — not included in the sum.

### Move note
If `planningToMove`, show a one-line note indented below the State Tax row:
> After move to {retirementState} at age {moveAge}: income tax → {X.X}% · SS {taxed/not taxed}

### CSS
New classes:
- `.tax-snapshot` — container: `display: flex; flex-direction: column; gap: 6px`
- `.tax-snapshot-row` — `display: flex; justify-content: space-between; align-items: baseline; font-size: 13px`
- `.tax-snapshot-label` — `color: #94a3b8`
- `.tax-snapshot-value` — `font-family: 'DM Mono', monospace; color: #f1f5f9`
- `.tax-snapshot-divider` — `border: none; border-top: 1px solid rgba(51,65,85,0.4); margin: 8px 0`
- `.tax-snapshot-total` — same as `.tax-snapshot-row` but `font-weight: 600; color: #f1f5f9`
- `.tax-snapshot-note` — `font-size: 11px; color: #64748b; margin-left: 12px; margin-top: -2px`

---

## Part 2: Planning Insights Row

### What changes
Replace the three stacked full-width callouts (RMD, IRMAA, Roth Window) with a flex row of compact side-by-side boxes. Each box is only rendered when applicable. If none apply, the row is hidden entirely.

### IRMAA: remove "no surcharge" state
The "No surcharge" IRMAA box is removed. IRMAA only renders when `firstIrmaaYear` exists (i.e., there is an actual surcharge). This is the biggest single reduction in clutter.

### Each box content

**RMD** (shown when `firstRmdYear` exists):
- Label: "Required Minimum Distributions"
- Value: `${Math.round(firstRmdYear.rmd / 12).toLocaleString()}/mo`
- Note: "Starting age {firstRmdYear.age} · IRS-required withdrawals from pre-tax accounts. Excess reinvested as taxable income. Consider Roth conversions before 73."

**IRMAA** (shown when `firstIrmaaYear` exists):
- Label: "Medicare IRMAA Surcharge"
- Value: `+${firstIrmaaYear.irmaa.toLocaleString()}/mo per person`
- Note: "Based on guaranteed income. Roth withdrawals don't count toward the income limit — conversions before 65 can reduce this."

**Roth Conversion Window** (shown when `showRothWindow`):
- Label: "Roth Conversion Window"
- Value: `Ages {retirementAge}–72`
- Note: "{rothWindowYears} years before RMDs begin. Lower income in this window may allow tax-efficient conversions — Roth accounts have no RMDs and withdrawals are tax-free."

### CSS
- `.insights-row` — `display: flex; gap: 16px; margin-top: 20px; flex-wrap: wrap`
- `.insights-row > .metric-box` — `flex: 1; min-width: 180px` (reuses existing `.metric-box` styles)

---

## Part 3: Social Security Breakeven

### Calculation logic

Implemented as a new exported function `ssBreakeven(monthlyBenefit, claimAge, fra = 67)` in `src/utils/ssUtils.js`.

```js
// Returns null if claimAge >= 70 (already at or past maximum — no delay possible)
// compareAge: fra if claimAge < fra, else 70
// breakevenAge: age at which cumulative SS income from delaying overtakes early claiming
export function ssBreakeven(monthlyBenefit, claimAge, fra = 67) {
  if (claimAge >= 70) return null;

  const compareAge = claimAge < fra ? fra : 70;
  const currentBenefit = Math.round(monthlyBenefit * ssAdjustmentFactor(claimAge, fra));
  const compareBenefit = Math.round(monthlyBenefit * ssAdjustmentFactor(compareAge, fra));
  const monthsMissed   = (compareAge - claimAge) * 12;
  const monthlyGain    = compareBenefit - currentBenefit;

  if (monthlyGain <= 0) return null; // shouldn't occur given SSA rules

  const breakevenAge = compareAge + (monthsMissed * currentBenefit) / monthlyGain / 12;

  return { compareAge, currentBenefit, compareBenefit, breakevenAge: +breakevenAge.toFixed(1) };
}
```

**Note:** The calculation uses nominal dollars with no time-value-of-money adjustment. This matches the standard SSA breakeven methodology and is the approach used by most financial planning tools.

### Display: SS Breakeven row

Positioned after the Planning Insights row, before the Home Sale callout.

- Rendered as a flex row (same `.insights-row` pattern)
- One box per person, side by side when both are visible
- Hidden when `ss1 === 0` (no SS income for primary)
- Spouse box hidden when `!hasSpouse` or `ss2 === 0`

**Primary box** (shown when `ss1 > 0`):

When `primaryBreakeven` is non-null (claimAge < 70):
- Label: "Social Security · You"
- Value: `age {primaryBreakeven.breakevenAge}` (large, prominent)
- Sub-value: `Claim {ss1ClaimAge} → delay to {primaryBreakeven.compareAge}`
- Note line 1: `${primaryBreakeven.currentBenefit}/mo now vs ${ primaryBreakeven.compareBenefit}/mo if you wait`
- Note line 2 (the key sentence): "If you live past **{primaryBreakeven.breakevenAge}**, waiting pays off. If not, claiming at {ss1ClaimAge} wins."
- Note line 3: Contextual — if `breakevenAge <= lifeExpectancy`: *(green)* "Within your life expectancy of {lifeExpectancy}" · else *(muted)* "Past your life expectancy of {lifeExpectancy} — early claiming may be advantageous."

When `primaryBreakeven` is null (claimAge === 70):
- Do not render this box (no comparison available at maximum age).

**Spouse box** — identical structure using `ss2`, `ss2ClaimAge`, `spouseBreakeven`, `spouseLifeExpectancy`.

### Values computed in ResultsStep.jsx

```js
import { ssBreakeven } from "../utils/ssUtils";

const primaryBreakeven = ss1 > 0 ? ssBreakeven(ss1, ss1ClaimAge) : null;
const spouseBreakeven  = hasSpouse && ss2 > 0 ? ssBreakeven(ss2, ss2ClaimAge) : null;
```

`ss1`, `ss2`, `ss1ClaimAge`, `ss2ClaimAge` are all already exposed by `usePlanner()`.

---

## Part 4: Home Sale Callout

No changes. Stays as a full-width conditional callout below the SS Breakeven row.

---

## Final Section Order

```
<Card>
  <h3>Taxes & Planning Insights</h3>

  {/* 1. Tax Snapshot — always shown */}
  <div className="tax-snapshot"> ... </div>

  {/* 2. Planning Insights Row — shown when any apply */}
  {(firstRmdYear || firstIrmaaYear || showRothWindow) && (
    <div className="insights-row"> [RMD] [IRMAA] [Roth Window] </div>
  )}

  {/* 3. SS Breakeven Row — shown when ss1 > 0 */}
  {(ss1 > 0 || (hasSpouse && ss2 > 0)) && (
    <div className="insights-row"> [Primary Breakeven] [Spouse Breakeven] </div>
  )}

  {/* 4. Home Sale — conditional, full-width */}
  {homeSaleYear && ( ... )}

  <p className="disclaimer"> ... </p>
</Card>
```

---

## Architecture

### Files changed

| File | Change |
|------|--------|
| `src/utils/ssUtils.js` | Add `ssBreakeven()` function |
| `tests/ssUtils.test.js` | Add tests for `ssBreakeven()` |
| `src/steps/ResultsStep.jsx` | Restructure Tax & Cost Summary JSX, add breakeven computations |
| `src/styles.css` | Add `.tax-snapshot*` and `.insights-row` classes |

### No changes to
- `PlannerContext.jsx` — all needed values already exposed
- `calc.js` — no projection changes
- Other step files

---

## Tests (`tests/ssUtils.test.js`)

New tests for `ssBreakeven`:
1. Returns `null` when `claimAge >= 70`
2. Returns `null` when `claimAge === 70` exactly
3. `compareAge` is FRA (67) when `claimAge < 67`
4. `compareAge` is 70 when `claimAge >= 67` and `< 70`
5. `breakevenAge` is after `compareAge` (always)
6. Known value check: `ssBreakeven(1800, 62)` → `compareAge = 67`, `currentBenefit ≈ $1,260`, `compareBenefit = $1,800`, `breakevenAge ≈ 78.8`
7. Known value check: `ssBreakeven(1800, 67)` → `compareAge = 70`, `currentBenefit = $1,800`, `compareBenefit = $2,232`, `breakevenAge ≈ 82.7`

---

## Key Decisions

- **No time-value adjustment** — nominal breakeven matches SSA methodology and is what users expect to see. Inflation and investment return adjustments would make the number harder to explain and potentially misleading without full financial context.
- **Hide at maximum (70)** — no callout when already at max claiming age. Nothing actionable to show.
- **Remove "no IRMAA" state** — "no surcharge" is the absence of a problem, not insight. Showing it wastes space and trains users to ignore the callout.
- **Reuse `.insights-row` for both planning callouts and SS breakeven** — same flex pattern, consistent visual weight.
- **`ssBreakeven` in ssUtils.js not ResultsStep** — pure function, easily testable, reusable if needed elsewhere.
