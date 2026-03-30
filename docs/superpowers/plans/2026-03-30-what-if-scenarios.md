# What If Scenario Comparison — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "What If?" tab to the Results page letting users adjust 6 variables and see a side-by-side comparison of verdict, portfolio chart, and key metrics against their current plan.

**Architecture:** Tab state lives in `ResultsStep.jsx`; all What If logic lives in a new `WhatIfPanel.jsx` that calls `usePlanner()` directly, holds local input state, and runs a second `runProjection()` via `useMemo`. No changes to PlannerContext or calc.js.

**Tech Stack:** React 18, Recharts (ComposedChart + Line), existing `FieldInput` component, `usePlanner()` hook.

---

## File Structure

| File | Role |
|---|---|
| `src/styles.css` | Append new CSS classes |
| `src/steps/ResultsStep.jsx` | Add tab state + tab buttons + conditional `<WhatIfPanel />` render |
| `src/steps/WhatIfPanel.jsx` | New component — all What If UI: inputs, projection, comparison output |

---

### Task 1: Add CSS classes

**Files:**
- Modify: `src/styles.css` (append after line 873)

- [ ] **Step 1: Append new CSS to `src/styles.css`**

Add this block at the very end of the file:

```css
/* === WHAT IF SCENARIOS === */
.results-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
}
.results-tab {
  padding: 8px 24px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px 6px 0 0;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.results-tab--active {
  background: #1e293b;
  border-color: #3b82f6;
  color: #f1f5f9;
  font-weight: 600;
}
.whatif-layout {
  display: grid;
  grid-template-columns: 1fr 1.6fr;
  gap: 20px;
  align-items: start;
}
@media (max-width: 720px) {
  .whatif-layout {
    grid-template-columns: 1fr;
  }
}
.whatif-metric-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-top: 16px;
}
.whatif-metric-table th {
  color: #475569;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: right;
  padding: 4px 6px 8px;
  border-bottom: 1px solid #1e293b;
}
.whatif-metric-table th:first-child { text-align: left; }
.whatif-metric-table td {
  padding: 6px 6px;
  border-bottom: 1px solid #0f172a;
  color: #94a3b8;
  text-align: right;
}
.whatif-metric-table td:first-child { text-align: left; color: #64748b; }
.whatif-metric-table td.wi-better { color: #22c55e; }
.whatif-metric-table td.wi-worse  { color: #ef4444; }
.whatif-metric-table td.wi-same   { color: #475569; }
```

- [ ] **Step 2: Run tests to verify no regressions**

```bash
cd /c/Users/code/retirement-planner && npm test -- --run
```

Expected: all 69 tests pass.

- [ ] **Step 3: Commit**

```bash
git checkout -b feat/what-if-scenarios
git add src/styles.css
git commit -m "style: add What If tab and comparison panel CSS"
```

---

### Task 2: Tab toggle in ResultsStep + stub WhatIfPanel

**Files:**
- Create: `src/steps/WhatIfPanel.jsx`
- Modify: `src/steps/ResultsStep.jsx`

- [ ] **Step 1: Create stub `src/steps/WhatIfPanel.jsx`**

```jsx
export default function WhatIfPanel() {
  return (
    <div style={{ color: '#64748b', padding: 24, textAlign: 'center' }}>
      Loading What If panel…
    </div>
  );
}
```

- [ ] **Step 2: Add tab state and import to `ResultsStep.jsx`**

At the top of `ResultsStep.jsx`, add the import after the existing imports:

```js
import WhatIfPanel from "./WhatIfPanel";
```

Inside `ResultsStep()` (after the `usePlanner()` destructure block, around line 30), add:

```js
const [activeTab, setActiveTab] = useState('myplan');
```

`useState` is already imported at the top — no change needed there.

- [ ] **Step 3: Add tab buttons and wrap existing content**

The `return (` statement currently opens with:
```jsx
return (
    <div>
      {/* Verdict Banner */}
```

Replace it with:
```jsx
return (
    <div>
      <div className="results-tabs">
        <button
          className={`results-tab${activeTab === 'myplan' ? ' results-tab--active' : ''}`}
          onClick={() => setActiveTab('myplan')}
        >
          My Plan
        </button>
        <button
          className={`results-tab${activeTab === 'whatif' ? ' results-tab--active' : ''}`}
          onClick={() => setActiveTab('whatif')}
        >
          What If?
        </button>
      </div>

      {activeTab === 'myplan' && (
        <>
          {/* Verdict Banner */}
```

Then find the very last line of the return — currently just `</div>` before the closing `);` — and replace it with:

```jsx
        </>
      )}

      {activeTab === 'whatif' && <WhatIfPanel />}
    </div>
  );
```

The structure after the change:
```
return (
  <div>
    <div className="results-tabs"> ... tabs ... </div>

    {activeTab === 'myplan' && (
      <>
        {/* Verdict Banner */}
        ... [all existing content unchanged] ...
        {/* Tax & Cost Summary card */}
      </>
    )}

    {activeTab === 'whatif' && <WhatIfPanel />}
  </div>
);
```

- [ ] **Step 4: Run tests to verify no regressions**

```bash
npm test -- --run
```

Expected: all 69 tests pass.

- [ ] **Step 5: Verify tabs render in browser**

Start the dev server and open the Results page. You should see "My Plan" and "What If?" tab buttons at the top. Clicking "What If?" should show "Loading What If panel…" and clicking "My Plan" should restore the full results view.

- [ ] **Step 6: Commit**

```bash
git add src/steps/ResultsStep.jsx src/steps/WhatIfPanel.jsx
git commit -m "feat: add My Plan / What If tab toggle to Results page"
```

---

### Task 3: WhatIfPanel — inputs + alternate projection

**Files:**
- Modify: `src/steps/WhatIfPanel.jsx`

Replace the stub with the full component. This task completes the left column (input panel) and wires up the alternate `runProjection()` call. The right column will render a placeholder until Task 4.

- [ ] **Step 1: Write the full WhatIfPanel with inputs and projection**

Replace the entire contents of `src/steps/WhatIfPanel.jsx` with:

```jsx
import { useState, useMemo } from "react";
import { usePlanner } from "../context/PlannerContext";
import Card from "../components/Card";
import FieldInput from "../components/FieldInput";
import { runProjection } from "../utils/calc";
import { ssAdjustmentFactor } from "../utils/ssUtils";

export default function WhatIfPanel() {
  const {
    results,
    age, lifeExpectancy, retirementAge,
    spouseAge, spouseRetirementAge, spouseLifeExpectancy,
    hasSpouse,
    ss1, ss2, ss1ClaimAge, ss2ClaimAge,
    trad401k, roth401k, tradIRA, rothIRA, taxableBrokerage,
    hasTrad401k, hasRoth401k, hasTradIRA, hasRothIRA, hasTaxableBrokerage,
    spouseTrad401k, spouseRoth401k, spouseTradIRA, spouseRothIRA, spouseTaxableBrokerage,
    spouseHasTrad401k, spouseHasRoth401k, spouseHasTradIRA, spouseHasRothIRA, spouseHasTaxableBrokerage,
    annualContrib401k, employerMatch, annualContribIRA, annualContribOther,
    spouseAnnualContrib401k, spouseEmployerMatch, spouseAnnualContribIRA, spouseAnnualContribOther,
    pension, pensionCOLA, pensionSurvivorPct,
    spousePension, spousePensionCOLA, spousePensionSurvivorPct,
    partTimeIncome, partTimeEndAge, rentalIncome,
    housing, food, healthcare, bridgeHealthcare, transport, leisure, other,
    longTermCare, ltcStartAge, healthcareInflation,
    housingType, mortgagePayoffAge,
    homeValue, homeOwned, mortgageBalance, homeSaleIntent, homeSaleAge,
    investmentReturn, inflation,
    stateInfo, planningToMove, moveAge, retirementStateInfo,
  } = usePlanner();

  // Baseline totals used to initialize state and compute scale factors
  const baseSpending = housing + food + healthcare + transport + leisure + other;
  const baseAnnualContribs =
    annualContrib401k + annualContribIRA + annualContribOther +
    (hasSpouse ? spouseAnnualContrib401k + spouseAnnualContribIRA + spouseAnnualContribOther : 0);

  // What If local state — initialized from current plan values on mount
  const [wiRetirementAge,   setWiRetirementAge]   = useState(retirementAge);
  const [wiSs1ClaimAge,     setWiSs1ClaimAge]     = useState(ss1ClaimAge);
  const [wiSs2ClaimAge,     setWiSs2ClaimAge]     = useState(ss2ClaimAge);
  const [wiAnnualContribs,  setWiAnnualContribs]  = useState(baseAnnualContribs);
  const [wiMonthlySpending, setWiMonthlySpending] = useState(baseSpending);
  const [wiPartTimeIncome,  setWiPartTimeIncome]  = useState(partTimeIncome);

  // Scale factors for proportional overrides
  const spendingScale = baseSpending > 0 ? wiMonthlySpending / baseSpending : 1;
  const contribScale  = baseAnnualContribs > 0 ? wiAnnualContribs / baseAnnualContribs : 1;

  // Adjusted SS for what-if claim ages
  const wiAdjustedSS1 = ss1 * ssAdjustmentFactor(wiSs1ClaimAge);
  const wiAdjustedSS2 = ss2 * ssAdjustmentFactor(wiSs2ClaimAge);

  // Alternate projection
  const wiResults = useMemo(() => runProjection({
    age, lifeExpectancy,
    retirementAge: wiRetirementAge,
    spouseAge, spouseRetirementAge, spouseLifeExpectancy,
    hasSpouse,
    ss1: wiAdjustedSS1,
    ss2: wiAdjustedSS2,
    trad401k: (hasTrad401k ? trad401k : 0) + (hasSpouse && spouseHasTrad401k ? spouseTrad401k : 0),
    roth401k: (hasRoth401k ? roth401k : 0) + (hasSpouse && spouseHasRoth401k ? spouseRoth401k : 0),
    tradIRA:  (hasTradIRA  ? tradIRA  : 0) + (hasSpouse && spouseHasTradIRA  ? spouseTradIRA  : 0),
    rothIRA:  (hasRothIRA  ? rothIRA  : 0) + (hasSpouse && spouseHasRothIRA  ? spouseRothIRA  : 0),
    taxableBrokerage: (hasTaxableBrokerage ? taxableBrokerage : 0) + (hasSpouse && spouseHasTaxableBrokerage ? spouseTaxableBrokerage : 0),
    annualContrib401k:        Math.round(annualContrib401k        * contribScale),
    employerMatch,
    annualContribIRA:         Math.round(annualContribIRA         * contribScale),
    annualContribOther:       Math.round(annualContribOther       * contribScale),
    spouseAnnualContrib401k:  Math.round(spouseAnnualContrib401k  * contribScale),
    spouseEmployerMatch,
    spouseAnnualContribIRA:   Math.round(spouseAnnualContribIRA   * contribScale),
    spouseAnnualContribOther: Math.round(spouseAnnualContribOther * contribScale),
    survivorFactor: 1.0,
    housing:    Math.round(housing    * spendingScale),
    food:       Math.round(food       * spendingScale),
    healthcare: Math.round(healthcare * spendingScale),
    transport:  Math.round(transport  * spendingScale),
    leisure:    Math.round(leisure    * spendingScale),
    other:      Math.round(other      * spendingScale),
    bridgeHealthcare,
    partTimeIncome: wiPartTimeIncome,
    partTimeEndAge, rentalIncome,
    pension, pensionCOLA, pensionSurvivorPct,
    spousePension, spousePensionCOLA, spousePensionSurvivorPct,
    longTermCare, ltcStartAge, healthcareInflation,
    housingType, mortgagePayoffAge,
    homeValue, homeOwned, mortgageBalance, homeSaleIntent, homeSaleAge,
    investmentReturn, inflation,
    stateInfo,
    moveAge: planningToMove ? moveAge : Infinity,
    retirementStateInfo: planningToMove ? retirementStateInfo : stateInfo,
  }), [
    wiRetirementAge, wiSs1ClaimAge, wiSs2ClaimAge,
    wiAnnualContribs, wiMonthlySpending, wiPartTimeIncome,
    age, lifeExpectancy, spouseAge, spouseRetirementAge, spouseLifeExpectancy,
    hasSpouse, ss1, ss2,
    trad401k, roth401k, tradIRA, rothIRA, taxableBrokerage,
    hasTrad401k, hasRoth401k, hasTradIRA, hasRothIRA, hasTaxableBrokerage,
    spouseTrad401k, spouseRoth401k, spouseTradIRA, spouseRothIRA, spouseTaxableBrokerage,
    spouseHasTrad401k, spouseHasRoth401k, spouseHasTradIRA, spouseHasRothIRA, spouseHasTaxableBrokerage,
    annualContrib401k, annualContribIRA, annualContribOther,
    spouseAnnualContrib401k, spouseAnnualContribIRA, spouseAnnualContribOther,
    employerMatch, spouseEmployerMatch,
    pension, pensionCOLA, pensionSurvivorPct,
    spousePension, spousePensionCOLA, spousePensionSurvivorPct,
    partTimeEndAge, rentalIncome,
    housing, food, healthcare, transport, leisure, other,
    bridgeHealthcare, longTermCare, ltcStartAge, healthcareInflation,
    housingType, mortgagePayoffAge,
    homeValue, homeOwned, mortgageBalance, homeSaleIntent, homeSaleAge,
    investmentReturn, inflation,
    stateInfo, planningToMove, moveAge, retirementStateInfo,
  ]);

  return (
    <div className="whatif-layout">
      {/* Left column: input panel */}
      <Card>
        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
          Adjust any variables — comparison updates automatically
        </div>
        <FieldInput
          label="Your Retirement Age"
          value={wiRetirementAge}
          min={age}
          max={80}
          step={1}
          suffix=" yrs"
          onChange={setWiRetirementAge}
          note={`Your plan: ${retirementAge} yrs`}
        />
        <FieldInput
          label="Your SS Claim Age"
          value={wiSs1ClaimAge}
          min={62}
          max={70}
          step={1}
          suffix=" yrs"
          onChange={setWiSs1ClaimAge}
          note={`Your plan: ${ss1ClaimAge} yrs`}
        />
        {hasSpouse && ss2 > 0 && (
          <FieldInput
            label="Spouse SS Claim Age"
            value={wiSs2ClaimAge}
            min={62}
            max={70}
            step={1}
            suffix=" yrs"
            onChange={setWiSs2ClaimAge}
            note={`Your plan: ${ss2ClaimAge} yrs`}
          />
        )}
        <FieldInput
          label="Annual Contributions"
          value={wiAnnualContribs}
          min={0}
          max={200000}
          step={500}
          prefix="$"
          onChange={setWiAnnualContribs}
          note={`Your plan: $${baseAnnualContribs.toLocaleString()}/yr`}
        />
        <FieldInput
          label="Monthly Spending"
          value={wiMonthlySpending}
          min={0}
          max={50000}
          step={100}
          prefix="$"
          suffix="/mo"
          onChange={setWiMonthlySpending}
          note={`Your plan: $${baseSpending.toLocaleString()}/mo`}
        />
        <FieldInput
          label="Part-Time Income"
          value={wiPartTimeIncome}
          min={0}
          max={20000}
          step={100}
          prefix="$"
          suffix="/mo"
          onChange={setWiPartTimeIncome}
          note={`Your plan: $${partTimeIncome.toLocaleString()}/mo · ends age ${partTimeEndAge}`}
        />
      </Card>

      {/* Right column: comparison output — completed in Task 4 */}
      <div>
        <div style={{ color: '#64748b', fontSize: 13, padding: 16 }}>
          Comparison output loading…
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run tests to verify no regressions**

```bash
npm test -- --run
```

Expected: all 69 tests pass.

- [ ] **Step 3: Verify in browser**

Open the What If tab. You should see:
- An input panel on the left with 5–6 FieldInput fields (retirement age, SS claim ages, contributions, spending, part-time income)
- Each field shows a "Your plan: X" note below it
- Changing a value and tabbing away should update the field
- Right column shows placeholder text

- [ ] **Step 4: Commit**

```bash
git add src/steps/WhatIfPanel.jsx
git commit -m "feat: WhatIfPanel input panel and alternate projection"
```

---

### Task 4: WhatIfPanel — comparison output

**Files:**
- Modify: `src/steps/WhatIfPanel.jsx`

Replace the placeholder right column with the full comparison output: verdict boxes, two-line portfolio chart, and metric comparison table.

- [ ] **Step 1: Add Recharts import at top of WhatIfPanel.jsx**

Add this import after the existing imports:

```js
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
```

- [ ] **Step 2: Add computed values before the return statement**

Add these computations inside `WhatIfPanel()` after the `wiResults` useMemo:

```js
// Withdrawal rates (not returned by runProjection — computed locally)
const myWithdrawalRate = results.portfolioAtRetirement > 0 && results.monthlyGap > 0
  ? (results.monthlyGap * 12) / results.portfolioAtRetirement * 100
  : 0;
const wiWithdrawalRate = wiResults.portfolioAtRetirement > 0 && wiResults.monthlyGap > 0
  ? (wiResults.monthlyGap * 12) / wiResults.portfolioAtRetirement * 100
  : 0;

// Portfolio runway display — runOutYear is null when portfolio never depletes
const myRunsTo  = results.runOutYear  === null ? '100+' : String(results.runOutYear);
const wiRunsTo  = wiResults.runOutYear === null ? '100+' : String(wiResults.runOutYear);

// Two-line chart: merge yearsData by age
const allAges = [...new Set([
  ...results.yearsData.map(d => d.age),
  ...wiResults.yearsData.map(d => d.age),
])].sort((a, b) => a - b);

const compChartData = allAges.map(a => ({
  age: a,
  myPlan: results.yearsData.find(d => d.age === a)?.portfolio  ?? null,
  whatIf: wiResults.yearsData.find(d => d.age === a)?.portfolio ?? null,
}));

// Tooltip style (matches rest of app)
const tooltipStyle = { background: '#0f172a', border: '1px solid rgba(51,65,85,0.8)', borderRadius: 10, fontSize: 12 };

// Delta helpers
const fmtDollar = (delta) => {
  if (delta === 0) return '—';
  const sign = delta > 0 ? '+' : '−';
  const abs = Math.abs(delta);
  return abs >= 1e6
    ? `${sign}$${(abs / 1e6).toFixed(2)}M`
    : abs >= 1000
    ? `${sign}$${Math.round(abs / 1000)}K`
    : `${sign}$${Math.round(abs).toLocaleString()}`;
};

const fmtPct = (delta) => {
  if (Math.abs(delta) < 0.05) return '—';
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${Math.abs(delta).toFixed(1)}%`;
};

const fmtPortfolio = (v) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${Math.round(v / 1000)}K`;
```

- [ ] **Step 3: Replace the right column placeholder with full comparison output**

Find this block in the return statement:
```jsx
      {/* Right column: comparison output — completed in Task 4 */}
      <div>
        <div style={{ color: '#64748b', fontSize: 13, padding: 16 }}>
          Comparison output loading…
        </div>
      </div>
```

Replace it with:
```jsx
      {/* Right column: comparison output */}
      <div>

        {/* Verdict row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          <div className="metric-box">
            <div className="metric-box-label" style={{ color: '#475569' }}>MY PLAN</div>
            <div className={`metric-box-value ${results.verdict.colorClass}`}>
              {results.verdict.label}
            </div>
            <div className="metric-box-note">
              {results.runOutYear === null
                ? 'Portfolio outlasts life expectancy'
                : `Portfolio runs to age ${results.runOutYear}`}
            </div>
          </div>
          <div className="metric-box" style={{ borderColor: '#3b82f644' }}>
            <div className="metric-box-label" style={{ color: '#3b82f6' }}>WHAT IF</div>
            <div className={`metric-box-value ${wiResults.verdict.colorClass}`}>
              {wiResults.verdict.label}
            </div>
            <div className="metric-box-note">
              {wiResults.runOutYear === null
                ? 'Portfolio outlasts life expectancy'
                : `Portfolio runs to age ${wiResults.runOutYear}`}
            </div>
          </div>
        </div>

        {/* Two-line portfolio chart */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>Portfolio over time</div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={compChartData} margin={{ top: 4, right: 8, bottom: 32, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.4)" />
              <XAxis
                dataKey="age"
                tick={{ fill: '#475569', fontSize: 11 }}
                label={{ value: 'Age', position: 'insideBottom', offset: -12, fill: '#475569', fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: '#475569', fontSize: 11 }}
                tickFormatter={v => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}k`}
                width={60}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={v => `Age ${v}`}
                formatter={(v, n) => v === null ? ['—', n] : [`$${v.toLocaleString()}`, n]}
              />
              <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: 12, color: '#64748b' }} />
              <Line dataKey="myPlan" name="My Plan" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls={false} />
              <Line dataKey="whatIf" name="What If" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="6 3" connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        {/* Metric comparison table */}
        <Card>
          <table className="whatif-metric-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}></th>
                <th>My Plan</th>
                <th>What If</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {/* Portfolio at retirement */}
              {(() => {
                const my = results.portfolioAtRetirement;
                const wi = wiResults.portfolioAtRetirement;
                const delta = wi - my;
                return (
                  <tr>
                    <td>Portfolio at retirement</td>
                    <td>{fmtPortfolio(my)}</td>
                    <td>{fmtPortfolio(wi)}</td>
                    <td className={delta > 0 ? 'wi-better' : delta < 0 ? 'wi-worse' : 'wi-same'}>
                      {fmtDollar(delta)}
                    </td>
                  </tr>
                );
              })()}
              {/* Monthly income */}
              {(() => {
                const my = results.netMonthlyIncome;
                const wi = wiResults.netMonthlyIncome;
                const delta = wi - my;
                return (
                  <tr>
                    <td>Monthly income</td>
                    <td>${my.toLocaleString()}/mo</td>
                    <td>${wi.toLocaleString()}/mo</td>
                    <td className={delta > 0 ? 'wi-better' : delta < 0 ? 'wi-worse' : 'wi-same'}>
                      {fmtDollar(delta)}
                    </td>
                  </tr>
                );
              })()}
              {/* Withdrawal rate */}
              {(() => {
                const delta = wiWithdrawalRate - myWithdrawalRate;
                return (
                  <tr>
                    <td>Withdrawal rate</td>
                    <td>{myWithdrawalRate.toFixed(1)}%</td>
                    <td>{wiWithdrawalRate.toFixed(1)}%</td>
                    {/* lower is better — invert color */}
                    <td className={delta < 0 ? 'wi-better' : delta > 0 ? 'wi-worse' : 'wi-same'}>
                      {fmtPct(delta)}
                    </td>
                  </tr>
                );
              })()}
              {/* Portfolio runs to */}
              {(() => {
                // null = never depletes; treat as better than any finite age
                const myNull = results.runOutYear === null;
                const wiNull = wiResults.runOutYear === null;
                let changeClass = 'wi-same';
                if (wiNull && !myNull) changeClass = 'wi-better';
                else if (!wiNull && myNull) changeClass = 'wi-worse';
                else if (!wiNull && !myNull) {
                  if (wiResults.runOutYear > results.runOutYear) changeClass = 'wi-better';
                  else if (wiResults.runOutYear < results.runOutYear) changeClass = 'wi-worse';
                }
                // Show '—' in delta when either is null (can't subtract "never")
                const showDelta = !myNull && !wiNull;
                const delta = showDelta ? wiResults.runOutYear - results.runOutYear : null;
                const deltaStr = showDelta
                  ? (delta === 0 ? '—' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} yrs`)
                  : '—';
                return (
                  <tr>
                    <td>Portfolio runs to</td>
                    <td>{myRunsTo}</td>
                    <td>{wiRunsTo}</td>
                    <td className={changeClass}>{deltaStr}</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </Card>

      </div>
```

- [ ] **Step 4: Run tests to verify no regressions**

```bash
npm test -- --run
```

Expected: all 69 tests pass.

- [ ] **Step 5: Verify the full What If tab in browser**

Open the What If tab. Verify:
- Verdict boxes appear side by side with correct labels ("MY PLAN" / "WHAT IF")
- Portfolio chart shows two lines (green solid = My Plan, amber dashed = What If) — initially they should overlap since all inputs start at plan values
- Metric table shows 4 rows with matching values (delta = 0 / "—" initially)
- Changing "Your Retirement Age" to a lower value should show amber What If verdict (worse) and red delta values
- Changing "Annual Contributions" to a higher value should show green deltas

- [ ] **Step 6: Commit**

```bash
git add src/steps/WhatIfPanel.jsx
git commit -m "feat: WhatIfPanel comparison output — verdict, chart, metric table"
```
