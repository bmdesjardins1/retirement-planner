# Tax & Cost Summary Redesign + SS Breakeven Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the Tax & Cost Summary section into a compact layout and add a Social Security breakeven callout showing whether delaying SS claiming pays off.

**Architecture:** Three sequential tasks — pure function first (testable in isolation), then CSS, then JSX restructure. No new state, no context changes, no new components. All changes are in 4 files.

**Tech Stack:** React 18, Vitest (tests), plain CSS

---

## File Map

| File | Change |
|------|--------|
| `src/utils/ssUtils.js` | Add exported `ssBreakeven()` function (12 lines) |
| `tests/ssUtils.test.js` | Add 8 new tests in a new `describe('ssBreakeven')` block |
| `src/styles.css` | Append `.tax-snapshot*` and `.insights-row` classes at end of file |
| `src/steps/ResultsStep.jsx` | Add 4 vars to destructure, add import, add 2 computed values, replace lines 489–602 with new JSX |

---

## Prerequisites

- [ ] **Create feature branch**

```bash
git checkout -b feat/tax-summary-ss-breakeven
```

---

## Task 1: `ssBreakeven()` function + tests

**Files:**
- Modify: `src/utils/ssUtils.js`
- Modify: `tests/ssUtils.test.js`

### Background

`ssAdjustmentFactor(claimAge, fra)` already lives in `ssUtils.js` and returns the benefit multiplier:
- `62` → `0.70` (max early reduction)
- `67` → `1.00` (FRA)
- `68` → `1.08`
- `70` → `1.24` (max delayed)

`ssBreakeven` uses this to answer: "At what age does waiting to claim pay off?" It compares `claimAge` to either FRA (if claiming before FRA) or age 70 (if already past FRA but not at max). Returns `null` when `claimAge >= 70` — nothing to compare at maximum age.

- [ ] **Step 1a: Update the existing import in `tests/ssUtils.test.js`**

Line 2 currently reads:
```js
import { ssAdjustmentFactor } from '../src/utils/ssUtils';
```
Change it to:
```js
import { ssAdjustmentFactor, ssBreakeven } from '../src/utils/ssUtils';
```

- [ ] **Step 1b: Append the new `describe` block to `tests/ssUtils.test.js`**

Add this at the end of the file, after the closing `});` of the `ssAdjustmentFactor` describe block:

```js
describe('ssBreakeven', () => {
  it('returns null when claimAge >= 70 (over-boundary: 71)', () => {
    expect(ssBreakeven(1800, 71)).toBeNull();
  });

  it('returns null when claimAge === 70 (at-boundary)', () => {
    expect(ssBreakeven(1800, 70)).toBeNull();
  });

  it('compareAge is FRA (67) when claimAge < 67', () => {
    const result = ssBreakeven(1800, 62);
    expect(result.compareAge).toBe(67);
  });

  it('compareAge is 70 when claimAge >= 67 and < 70', () => {
    const result = ssBreakeven(1800, 68);
    expect(result.compareAge).toBe(70);
  });

  it('breakevenAge is always after compareAge', () => {
    const result = ssBreakeven(1800, 62);
    expect(result.breakevenAge).toBeGreaterThan(result.compareAge);
  });

  it('known value: ssBreakeven(1800, 62) — early claiming to FRA', () => {
    const result = ssBreakeven(1800, 62);
    expect(result.compareAge).toBe(67);
    expect(result.currentBenefit).toBe(1260);
    expect(result.compareBenefit).toBe(1800);
    expect(result.breakevenAge).toBeCloseTo(78.7, 1);
    // Math: currentBenefit = round(1800 × 0.70) = 1260
    // monthsMissed = 60, monthlyGain = 540
    // breakevenAge = 67 + (60 × 1260) / 540 / 12 = 78.67 → 78.7
  });

  it('known value: ssBreakeven(1800, 67) — FRA to max', () => {
    const result = ssBreakeven(1800, 67);
    expect(result.compareAge).toBe(70);
    expect(result.currentBenefit).toBe(1800);
    expect(result.compareBenefit).toBe(2232);
    expect(result.breakevenAge).toBeCloseTo(82.5, 1);
    // Math: compareBenefit = round(1800 × 1.24) = 2232
    // monthsMissed = 36, monthlyGain = 432
    // breakevenAge = 70 + (36 × 1800) / 432 / 12 = 82.5
  });

  it('known value: ssBreakeven(1800, 68) — between FRA and max', () => {
    const result = ssBreakeven(1800, 68);
    expect(result.compareAge).toBe(70);
    expect(result.currentBenefit).toBe(1944);
    expect(result.compareBenefit).toBe(2232);
    expect(result.breakevenAge).toBeCloseTo(83.5, 1);
    // Math: currentBenefit = round(1800 × 1.08) = 1944
    // monthsMissed = 24, monthlyGain = 288
    // breakevenAge = 70 + (24 × 1944) / 288 / 12 = 83.5
  });
});
```

- [ ] **Step 2: Run tests to confirm all 8 fail**

```bash
npm test -- tests/ssUtils.test.js
```

Expected: 8 failures, all with "ssBreakeven is not a function" or similar.

- [ ] **Step 3: Implement `ssBreakeven()` in `src/utils/ssUtils.js`**

Append this after the existing `ssAdjustmentFactor` function:

```js
/**
 * Returns breakeven analysis for delaying SS claiming.
 * Pass the raw FRA-equivalent benefit (ss1/ss2 from context), NOT adjustedSS1/adjustedSS2 —
 * this function applies ssAdjustmentFactor internally.
 *
 * compareAge: FRA (67) if claimAge < FRA, else 70
 * breakevenAge: age at which cumulative SS income from delaying overtakes early claiming
 * Returns null if claimAge >= 70 (already at maximum — no delay possible)
 *
 * Uses nominal dollars with no time-value adjustment — matches SSA methodology.
 */
export function ssBreakeven(monthlyBenefit, claimAge, fra = 67) {
  if (claimAge >= 70) return null;

  const compareAge     = claimAge < fra ? fra : 70;
  const currentBenefit = Math.round(monthlyBenefit * ssAdjustmentFactor(claimAge, fra));
  const compareBenefit = Math.round(monthlyBenefit * ssAdjustmentFactor(compareAge, fra));
  const monthsMissed   = (compareAge - claimAge) * 12;
  const monthlyGain    = compareBenefit - currentBenefit;

  if (monthlyGain <= 0) return null; // shouldn't occur given SSA rules

  const breakevenAge = compareAge + (monthsMissed * currentBenefit) / monthlyGain / 12;

  return { compareAge, currentBenefit, compareBenefit, breakevenAge: +breakevenAge.toFixed(1) };
}
```

- [ ] **Step 4: Run tests to confirm all 8 pass**

```bash
npm test -- tests/ssUtils.test.js
```

Expected: All tests pass (existing 5 + new 8 = 13 total in this file).

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/ssUtils.js tests/ssUtils.test.js
git commit -m "feat: add ssBreakeven() function with 8 tests"
```

---

## Task 2: CSS classes

**Files:**
- Modify: `src/styles.css`

The file currently ends at line 814 with `.mc-explainer`. Append the new classes after the last closing brace.

**Important:** `.insights-row > .metric-box` uses a direct-child selector (`>`). This requires that `.metric-box` elements be direct children of `.insights-row` — no wrapper divs. This override reduces `.metric-box`'s default padding from `20px 24px` to `14px 16px` to fit the compact side-by-side layout.

- [ ] **Step 1: Append new CSS at the end of `src/styles.css`**

```css

/* === TAX SNAPSHOT === */
.tax-snapshot {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tax-snapshot-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
}

.tax-snapshot-label {
  color: #94a3b8;
}

.tax-snapshot-value {
  font-family: 'DM Mono', monospace;
  color: #f1f5f9;
}

.tax-snapshot-divider {
  border: none;
  border-top: 1px solid rgba(51, 65, 85, 0.4);
  margin: 8px 0;
}

.tax-snapshot-total {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
}

.tax-snapshot-note {
  font-size: 11px;
  color: #64748b;
  margin-left: 12px;
  margin-top: -2px;
}

/* === PLANNING INSIGHTS ROW === */
.insights-row {
  display: flex;
  gap: 16px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.insights-row > .metric-box {
  flex: 1;
  min-width: 180px;
  padding: 14px 16px;
}
```

- [ ] **Step 2: Note on verification**

CSS classes cannot be unit-tested. Visual verification happens in Task 3 Step 6 (dev server). No separate verification step needed here.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat: add .tax-snapshot and .insights-row CSS classes"
```

---

## Task 3: ResultsStep.jsx — Tax & Cost Summary restructure

**Files:**
- Modify: `src/steps/ResultsStep.jsx`

### What changes

1. Add `ss1`, `ss2`, `ss1ClaimAge`, `ss2ClaimAge` to the `usePlanner()` destructure (line 14)
2. Add `ssBreakeven` import at the top
3. Add two computed values (`primaryBreakeven`, `spouseBreakeven`) near the other derived values
4. Replace the entire `{/* Tax & Cost Summary */}` Card (lines 489–602) with the new structure

### Context for the new JSX structure

The new section has 4 parts in order:
1. **Tax Snapshot** — always shown, compact list with total row
2. **Planning Insights Row** — side-by-side boxes (RMD, IRMAA surcharge only, Roth Window) — shown when any apply
3. **SS Breakeven Row** — side-by-side boxes (You, Spouse) — shown when `primaryBreakeven !== null || spouseBreakeven !== null`
4. **Home Sale** — unchanged full-width box

**Note on LTC in the total:** The total formula uses the raw `longTermCare` context value (the user-entered monthly amount, not inflation-adjusted). The other three values (`federalTaxMonthly`, `stateTaxMonthly`, `monthlyPropertyTax`) come from `results` and are projection-time figures. This mix is intentional per the spec — LTC is shown at its nominal entered cost, consistent with how it's labeled in the snapshot row.

Key behavior changes from the old code:
- The "no IRMAA surcharge" green box is **removed entirely** — IRMAA only renders when `firstIrmaaYear` exists
- LTC row in the snapshot is **omitted** when `longTermCare === 0`
- CoL is always shown but is **not** part of the total sum (it's a % not a $)
- CoL color is neutral `#f1f5f9` — no yellow tinting (removed from existing code)
- The `mt-20` helper class on the Home Sale box is preserved

- [ ] **Step 1: Add `ss1`, `ss2`, `ss1ClaimAge`, `ss2ClaimAge` to the `usePlanner()` destructure**

Current destructure starts at line 14. Add the four SS variables to it. Change:
```js
  const {
    results, primaryResults, spouseResults,
    hasSpouse, state,
    age, lifeExpectancy, retirementAge,
    spouseAge, spouseLifeExpectancy, spouseRetirementAge,
    longTermCare, ltcStartAge,
    investmentReturn,
    trad401k, tradIRA, hasTrad401k, hasTradIRA,
    spouseTrad401k, spouseTradIRA, spouseHasTrad401k, spouseHasTradIRA,
    planningToMove, moveAge, retirementState, retirementStateInfo,
  } = usePlanner();
```
To:
```js
  const {
    results, primaryResults, spouseResults,
    hasSpouse, state,
    age, lifeExpectancy, retirementAge,
    spouseAge, spouseLifeExpectancy, spouseRetirementAge,
    longTermCare, ltcStartAge,
    investmentReturn,
    trad401k, tradIRA, hasTrad401k, hasTradIRA,
    spouseTrad401k, spouseTradIRA, spouseHasTrad401k, spouseHasTradIRA,
    planningToMove, moveAge, retirementState, retirementStateInfo,
    ss1, ss2, ss1ClaimAge, ss2ClaimAge,
  } = usePlanner();
```

- [ ] **Step 2: Add `ssBreakeven` import**

Current import at line 9:
```js
import { runMonteCarlo } from "../utils/monteCarlo";
```
Add after it:
```js
import { ssBreakeven } from "../utils/ssUtils";
```

- [ ] **Step 3: Add `primaryBreakeven` and `spouseBreakeven` computations**

Add these two lines after the `bandChartData` computation (the block ending with `}));`), just before the `successRateColor` constant. Use the content anchor — do not rely on a line number, as the prior import addition shifts line numbers by 1:

```js
  // SS breakeven: pass raw ss1/ss2 (FRA-equivalent), NOT adjustedSS1/adjustedSS2
  const primaryBreakeven = ss1 > 0 ? ssBreakeven(ss1, ss1ClaimAge) : null;
  const spouseBreakeven  = hasSpouse && ss2 > 0 ? ssBreakeven(ss2, ss2ClaimAge) : null;
```

- [ ] **Step 4: Replace the Tax & Cost Summary Card**

Replace everything from `{/* Tax & Cost Summary */}` (line 489) through the closing `</Card>` tag at line 602 with the following:

```jsx
      {/* Tax & Cost Summary */}
      <Card>
        <h3 className="chart-heading">Taxes & Planning Insights</h3>

        {/* 1. Tax Snapshot — always shown */}
        <div className="tax-snapshot">
          <div className="tax-snapshot-row">
            <span className="tax-snapshot-label">Federal Tax (est.)</span>
            <span className="tax-snapshot-value">−${results.federalTaxMonthly.toLocaleString()}/mo</span>
          </div>
          <div className="tax-snapshot-row">
            <span className="tax-snapshot-label">{state} State Tax</span>
            <span className="tax-snapshot-value">−${results.stateTaxMonthly.toLocaleString()}/mo</span>
          </div>
          {planningToMove && (
            <div className="tax-snapshot-note">
              After move to {retirementState} at age {moveAge}: income tax → {(retirementStateInfo.incomeTax * 100).toFixed(1)}%
              {" · SS benefits "}{retirementStateInfo.hasSSIncomeTax ? "taxed" : "not taxed"}
            </div>
          )}
          <div className="tax-snapshot-row">
            <span className="tax-snapshot-label">Property Tax</span>
            <span className="tax-snapshot-value">−${results.monthlyPropertyTax.toLocaleString()}/mo</span>
          </div>
          {longTermCare > 0 && (
            <div className="tax-snapshot-row">
              <span className="tax-snapshot-label">Long-Term Care</span>
              <span className="tax-snapshot-value">−${longTermCare.toLocaleString()}/mo · starts age {ltcStartAge}</span>
            </div>
          )}
          <hr className="tax-snapshot-divider" />
          <div className="tax-snapshot-total">
            <span>Total</span>
            <span>−${(results.federalTaxMonthly + results.stateTaxMonthly + results.monthlyPropertyTax + longTermCare).toLocaleString()}/mo</span>
          </div>
          <div className="tax-snapshot-row" style={{ marginTop: 8 }}>
            <span className="tax-snapshot-label">Cost of Living</span>
            <span className="tax-snapshot-value">
              {results.costOfLivingDelta > 0 ? "+" : ""}{results.costOfLivingDelta}% vs national avg
            </span>
          </div>
        </div>

        {/* 2. Planning Insights Row — shown when any apply */}
        {(firstRmdYear || firstIrmaaYear || showRothWindow) && (
          <div className="insights-row">
            {firstRmdYear && (
              <div className="metric-box metric-box--yellow">
                <div className="metric-box-label">Required Minimum Distributions</div>
                <div className="metric-box-value value--yellow">${Math.round(firstRmdYear.rmd / 12).toLocaleString()}/mo</div>
                <div className="metric-box-note">
                  Starting age {firstRmdYear.age} · IRS-required withdrawals from pre-tax accounts. Excess reinvested as taxable income. Consider Roth conversions before 73.
                </div>
              </div>
            )}
            {firstIrmaaYear && (
              <div className="metric-box metric-box--yellow">
                <div className="metric-box-label">Medicare IRMAA Surcharge</div>
                <div className="metric-box-value value--yellow">+${firstIrmaaYear.irmaa.toLocaleString()}/mo per person</div>
                <div className="metric-box-note">
                  Based on guaranteed income. Roth withdrawals don't count toward the income limit — conversions before 65 can reduce this.
                </div>
              </div>
            )}
            {showRothWindow && (
              <div className="metric-box metric-box--yellow">
                <div className="metric-box-label">Roth Conversion Window</div>
                <div className="metric-box-value value--yellow">Ages {retirementAge}–72</div>
                <div className="metric-box-note">
                  {rothWindowYears} years before RMDs begin. Lower income in this window may allow tax-efficient conversions — Roth accounts have no RMDs and withdrawals are tax-free.
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. SS Breakeven Row — shown when at least one box renders */}
        {(primaryBreakeven !== null || spouseBreakeven !== null) && (
          <div className="insights-row">
            {primaryBreakeven !== null && (
              <div className="metric-box metric-box--green">
                <div className="metric-box-label">Social Security · You</div>
                <div className="metric-box-value value--green">age {primaryBreakeven.breakevenAge}</div>
                <div className="metric-box-note">Claim {ss1ClaimAge} → delay to {primaryBreakeven.compareAge}</div>
                <div className="metric-box-note" style={{ marginTop: 4 }}>
                  ${primaryBreakeven.currentBenefit}/mo now vs ${primaryBreakeven.compareBenefit}/mo if you wait
                </div>
                <div className="metric-box-note" style={{ marginTop: 4 }}>
                  If you live past <strong>{primaryBreakeven.breakevenAge}</strong>, waiting pays off. If not, claiming at {ss1ClaimAge} wins.
                </div>
                <div className="metric-box-note" style={{ marginTop: 4, color: primaryBreakeven.breakevenAge <= lifeExpectancy ? "#34d399" : "#64748b" }}>
                  {primaryBreakeven.breakevenAge <= lifeExpectancy
                    ? `Within your life expectancy of ${lifeExpectancy}`
                    : `Past your life expectancy of ${lifeExpectancy} — early claiming may be advantageous.`}
                </div>
              </div>
            )}
            {spouseBreakeven !== null && (
              <div className="metric-box metric-box--green">
                <div className="metric-box-label">Social Security · Spouse</div>
                <div className="metric-box-value value--green">age {spouseBreakeven.breakevenAge}</div>
                <div className="metric-box-note">Claim {ss2ClaimAge} → delay to {spouseBreakeven.compareAge}</div>
                <div className="metric-box-note" style={{ marginTop: 4 }}>
                  ${spouseBreakeven.currentBenefit}/mo now vs ${spouseBreakeven.compareBenefit}/mo if you wait
                </div>
                <div className="metric-box-note" style={{ marginTop: 4 }}>
                  If you live past <strong>{spouseBreakeven.breakevenAge}</strong>, waiting pays off. If not, claiming at {ss2ClaimAge} wins.
                </div>
                <div className="metric-box-note" style={{ marginTop: 4, color: spouseBreakeven.breakevenAge <= spouseLifeExpectancy ? "#34d399" : "#64748b" }}>
                  {spouseBreakeven.breakevenAge <= spouseLifeExpectancy
                    ? `Within spouse's life expectancy of ${spouseLifeExpectancy}`
                    : `Past spouse's life expectancy of ${spouseLifeExpectancy} — early claiming may be advantageous.`}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. Home Sale — full-width, no change */}
        {homeSaleYear && (
          <div className="metric-box metric-box--green mt-20" style={{ gridColumn: "1 / -1" }}>
            <div className="metric-box-label">Home Sale</div>
            <div className="metric-box-value value--green">
              +${homeSaleYear.homeSaleProceeds.toLocaleString()}
            </div>
            <div className="metric-box-note">
              At age {homeSaleYear.age} — one-time lump sum added to your portfolio after ~5% in realtor and closing costs.
              Capital gains tax is not modeled here — if your home has appreciated significantly, consult a tax advisor.
            </div>
          </div>
        )}

        <p className="disclaimer">
          ⚠ This tool provides estimates for planning purposes only and is not financial advice. Consult a certified financial planner (CFP) for personalized guidance. Tax rates, Social Security rules, and cost of living figures are approximate and subject to change.
        </p>
      </Card>
```

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```

Expected: All tests pass. (No new tests here — this is pure JSX restructuring.)

- [ ] **Step 6: Start dev server and visually verify**

```bash
npm run dev
```

Open the app, go to the Results page, and check:
- Heading says "Taxes & Planning Insights"
- Tax snapshot shows rows with label/value pairs and a total line
- If `longTermCare === 0`, no LTC row appears in the snapshot
- Planning insights boxes appear side by side (not stacked full-width)
- No "No surcharge" IRMAA box appears when there's no surcharge
- SS breakeven boxes appear if SS income > 0 and claim age < 70
- Home sale box still appears full-width when applicable

- [ ] **Step 7: Commit**

```bash
git add src/steps/ResultsStep.jsx
git commit -m "feat: restructure Tax & Cost Summary — compact snapshot, side-by-side insights, SS breakeven"
```

---

## Final: Open PR

```bash
gh pr create --title "feat: Tax & Cost Summary redesign + SS breakeven" --body "$(cat <<'EOF'
## Summary
- Consolidates 4 metric boxes into a compact `.tax-snapshot` list with total row
- Replaces 3 stacked full-width callouts (RMD, IRMAA, Roth Window) with side-by-side `.insights-row` flex boxes; removes empty "no IRMAA surcharge" state
- Adds SS breakeven callout (one per person) — shows at what age delaying SS claiming pays off vs. claiming now
- Renames section "Taxes & Planning Insights"
- Adds `ssBreakeven()` pure function to `ssUtils.js` with 8 tests

## Test plan
- [ ] All 13 `ssUtils` tests pass (5 existing + 8 new)
- [ ] Full test suite passes with no regressions
- [ ] Tax snapshot renders correctly with and without LTC configured
- [ ] Planning insights boxes appear side by side, not stacked
- [ ] IRMAA "no surcharge" box no longer appears
- [ ] SS breakeven boxes appear correctly for single and couple scenarios
- [ ] SS breakeven row hidden when SS income is 0 or claim age is 70
- [ ] Home sale box still appears full-width

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
