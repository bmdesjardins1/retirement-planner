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
  (omit this row entirely when longTermCare === 0)
─────────────────────────────────────────
Total                       −$3,950/mo

Cost of Living              +3% vs national avg   (positive example)
Cost of Living              −17% vs national avg  (negative example — Mississippi-style)
  (CoL always shown; color is always #f1f5f9 — no yellow tinting unlike existing code)
  (`costOfLivingDelta` is always an integer: `stateInfo.costOfLivingIndex - 100`. Use a conditional prefix: `{results.costOfLivingDelta > 0 ? "+" : ""}`. No `.toFixed()` needed.)
```

### Total row
`total = results.federalTaxMonthly + results.stateTaxMonthly + results.monthlyPropertyTax + longTermCare`

(`longTermCare` is the raw context value from `usePlanner()` — it is a monthly dollar amount. The other three come from the `results` object returned by `runProjection()`.)

The total row label is always **"Total"** regardless of whether LTC is included. No label variant needed.

The CoL adjustment is a percentage, not a dollar figure, so it is displayed separately below the total line — not included in the sum.

### Move note
If `planningToMove`, show a one-line note indented below the State Tax row using `.tax-snapshot-note`. Exact rendered strings:
- If SS is taxed in retirement state: `"After move to {retirementState} at age {moveAge}: income tax → {X.X}% · SS benefits taxed"`
- If SS is not taxed in retirement state: `"After move to {retirementState} at age {moveAge}: income tax → {X.X}% · SS benefits not taxed"`

Where `X.X%` is `(retirementStateInfo.incomeTax * 100).toFixed(1)` — `incomeTax` in `stateData.js` is a decimal fraction (e.g., `0.0575` for Virginia), so multiply by 100 and format to one decimal place. Do not use `stateInfo.incomeTax` — `stateInfo` is always the current state; `retirementStateInfo` is the destination state. `retirementState`/`moveAge` come from `usePlanner()`, and `retirementStateInfo.hasSSIncomeTax` determines the "taxed/not taxed" suffix.

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
  - Note: `d.irmaa` in `yearsData` is **monthly per-person** (see `calc.js` line 434: `irmaa: Math.round(irmaaSurchargePerPerson)` — no division needed)
- Note: "Based on guaranteed income. Roth withdrawals don't count toward the income limit — conversions before 65 can reduce this."

**Roth Conversion Window** (shown when `showRothWindow`):
- Label: "Roth Conversion Window"
- Value: `Ages {retirementAge}–72`
- Note: "{rothWindowYears} years before RMDs begin. Lower income in this window may allow tax-efficient conversions — Roth accounts have no RMDs and withdrawals are tax-free."
- Window start is `retirementAge` (not `ss1ClaimAge`). This is intentional — the window starts when earned income stops, not when SS begins.

### CSS
- `.insights-row` — `display: flex; gap: 16px; margin-top: 20px; flex-wrap: wrap`
- `.insights-row > .metric-box` — `flex: 1; min-width: 180px; padding: 14px 16px` (scoped override — reduces the default `.metric-box` padding of `20px 24px` to fit side-by-side layout)
  - Boxes must be direct children of `.insights-row` (no wrapper divs) for this selector to apply. Do not wrap boxes in fragments that add DOM nodes.

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
- Note line 2 (the key sentence): JSX — `<>If you live past <strong>{primaryBreakeven.breakevenAge}</strong>, waiting pays off. If not, claiming at {ss1ClaimAge} wins.</>` (use `<strong>` tag, not Markdown `**` — this renders in JSX, not a plain string)
- Note line 3: Contextual — if `breakevenAge <= lifeExpectancy`: *(green)* "Within your life expectancy of {lifeExpectancy}" · else *(muted)* "Past your life expectancy of {lifeExpectancy} — early claiming may be advantageous."

When `primaryBreakeven` is null (claimAge === 70):
- Do not render this box (no comparison available at maximum age).

**Spouse box** — same structure as primary box using `ss2`, `ss2ClaimAge`, `spouseBreakeven`, `spouseLifeExpectancy`. When `spouseBreakeven` is `null` (i.e., `ss2ClaimAge === 70`), do not render the spouse box — same suppression rule as the primary box.

### Values computed in ResultsStep.jsx

```js
import { ssBreakeven } from "../utils/ssUtils";

const primaryBreakeven = ss1 > 0 ? ssBreakeven(ss1, ss1ClaimAge) : null;
const spouseBreakeven  = hasSpouse && ss2 > 0 ? ssBreakeven(ss2, ss2ClaimAge) : null;
```

`ss1`, `ss2`, `ss1ClaimAge`, `ss2ClaimAge` are all already exposed by `usePlanner()`.

**Important:** Pass the raw `ss1`/`ss2` value (the FRA-equivalent benefit the user entered), NOT `adjustedSS1`/`adjustedSS2`. `ssBreakeven()` applies `ssAdjustmentFactor` internally — passing the already-adjusted value would double-apply the factor and produce a wrong breakeven age.

**FRA assumption:** `ssBreakeven()` accepts an optional third `fra` parameter but it is always called with two arguments, using the default `fra = 67`. This matches `ssAdjustmentFactor`'s default and the project-wide assumption that users were born in 1960 or later.

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

  {/* 3. SS Breakeven Row — shown only when at least one box would actually render */}
  {(primaryBreakeven !== null || spouseBreakeven !== null) && (
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
1. Returns `null` when `claimAge >= 70` — test with `claimAge = 71` (over-boundary)
2. Returns `null` when `claimAge === 70` exactly (at-boundary — the `>=` guard includes this)
3. `compareAge` is FRA (67) when `claimAge < 67`
4. `compareAge` is 70 when `claimAge >= 67` and `< 70`
5. `breakevenAge` is after `compareAge` (always)
6. Known value check (early claiming → FRA): `ssBreakeven(1800, 62)` → `compareAge = 67`, `currentBenefit = 1260`, `compareBenefit = 1800`, `breakevenAge = 78.7`
   - Math: `currentBenefit = round(1800 × 0.70) = 1260`, `monthsMissed = 60`, `monthlyGain = 540`, `breakevenAge = 67 + (60 × 1260) / 540 / 12 = 78.67 → 78.7`
7. Known value check (FRA → max): `ssBreakeven(1800, 67)` → `compareAge = 70`, `currentBenefit = 1800`, `compareBenefit = 2232`, `breakevenAge = 82.5`
   - Math: `currentBenefit = round(1800 × 1.00) = 1800`, `compareBenefit = round(1800 × 1.24) = 2232`, `monthsMissed = 36`, `monthlyGain = 432`, `breakevenAge = 70 + (36 × 1800) / 432 / 12 = 82.5`
8. Known value check (between FRA and max → max): `ssBreakeven(1800, 68)` → `compareAge = 70`, `currentBenefit = 1944`, `compareBenefit = 2232`, `breakevenAge = 83.5`
   - Math: `currentBenefit = round(1800 × 1.08) = 1944`, `compareBenefit = round(1800 × 1.24) = 2232`, `monthsMissed = 24`, `monthlyGain = 288`, `breakevenAge = 70 + (24 × 1944) / 288 / 12 = 83.5`

---

## Key Decisions

- **No time-value adjustment** — nominal breakeven matches SSA methodology and is what users expect to see. Inflation and investment return adjustments would make the number harder to explain and potentially misleading without full financial context.
- **Hide at maximum (70)** — no callout when already at max claiming age. Nothing actionable to show.
- **Remove "no IRMAA" state** — "no surcharge" is the absence of a problem, not insight. Showing it wastes space and trains users to ignore the callout.
- **Reuse `.insights-row` for both planning callouts and SS breakeven** — same flex pattern, consistent visual weight.
- **`ssBreakeven` in ssUtils.js not ResultsStep** — pure function, easily testable, reusable if needed elsewhere.
