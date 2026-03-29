# What If Scenario Comparison

**Date:** 2026-03-29
**Status:** Draft

---

## Goal

Add a "What If?" tab to the Results page that lets users compare their current plan against an alternate scenario by adjusting up to 5 key variables. Shows verdict, portfolio chart, and key metrics side by side.

---

## Background

The Results page currently shows a single projection. Users naturally ask questions like "what if I retire 3 years earlier?" or "what if we both delay SS to 70?" — but today there's no way to answer those without going back through the wizard. This feature adds a second tab to the Results page where users can tweak key variables and see the impact immediately, without touching their plan.

---

## Part 1: Tab Toggle

### Placement
Two tab buttons at the top of the Results page content area, above all cards. Tabs are: **My Plan** and **What If?**

Tab state is `useState('myplan')` local to `ResultsStep.jsx`. The tab buttons are rendered before any cards. When `activeTab === 'myplan'`, the existing results content renders unchanged. When `activeTab === 'whatif'`, `<WhatIfPanel />` renders instead.

### JSX structure
```jsx
// In ResultsStep.jsx — add at top of returned JSX, before first card:
const [activeTab, setActiveTab] = useState('myplan');

// ...

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
    {/* all existing results content — unchanged */}
  </>
)}

{activeTab === 'whatif' && <WhatIfPanel />}
```

### CSS
```css
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
```

---

## Part 2: WhatIfPanel Component

**File:** `src/steps/WhatIfPanel.jsx`

Calls `usePlanner()` directly. No props. Contains all What If tab UI: input panel (left) + comparison output (right).

### Mounts fresh on each tab switch
`WhatIfPanel` only renders when `activeTab === 'whatif'`. Each time the user switches to the What If tab, the component mounts fresh and local state initializes from the current plan values. This is intentional — if the user updates their plan on My Plan tab and switches back, they start from the updated values.

### Layout
```jsx
<div className="whatif-layout">
  <div>{/* input card — left column */}</div>
  <div>{/* comparison output — right column */}</div>
</div>
```

```css
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
```

---

## Part 3: Input Panel

### Baseline values (computed once at top of WhatIfPanel)
```js
const baseSpending = housing + food + healthcare + transport + leisure + other;
const baseAnnualContribs =
  annualContrib401k + annualContribIRA + annualContribOther +
  (hasSpouse ? spouseAnnualContrib401k + spouseAnnualContribIRA + spouseAnnualContribOther : 0);
// employer match excluded — not user-controlled
```

### Local state (initialized from context on mount)
```js
const [wiRetirementAge,  setWiRetirementAge]  = useState(retirementAge);
const [wiSs1ClaimAge,    setWiSs1ClaimAge]    = useState(ss1ClaimAge);
const [wiSs2ClaimAge,    setWiSs2ClaimAge]    = useState(ss2ClaimAge);
const [wiAnnualContribs, setWiAnnualContribs] = useState(baseAnnualContribs);
const [wiMonthlySpending,setWiMonthlySpending]= useState(baseSpending);
const [wiPartTimeIncome, setWiPartTimeIncome] = useState(partTimeIncome);
```

### FieldInput fields

All use the existing `FieldInput` component. Each field shows a `note` with the user's current plan value so they can see what they changed.

| Field | label | min | max | step | prefix | suffix | note |
|---|---|---|---|---|---|---|---|
| Retirement age | "Your Retirement Age" | `age` | 80 | 1 | — | `" yrs"` | `"Your plan: ${retirementAge} yrs"` |
| SS claim age (you) | "Your SS Claim Age" | 62 | 70 | 1 | — | `" yrs"` | `"Your plan: ${ss1ClaimAge} yrs"` |
| SS claim age (spouse) | "Spouse SS Claim Age" | 62 | 70 | 1 | — | `" yrs"` | `"Your plan: ${ss2ClaimAge} yrs"` |
| Annual contributions | "Annual Contributions" | 0 | 200000 | 500 | `"$"` | — | `"Your plan: $${baseAnnualContribs.toLocaleString()}/yr"` |
| Monthly spending | "Monthly Spending" | 0 | 50000 | 100 | `"$"` | `"/mo"` | `"Your plan: $${baseSpending.toLocaleString()}/mo"` |
| Part-time income | "Part-Time Income" | 0 | 20000 | 100 | `"$"` | `"/mo"` | `"Your plan: $${partTimeIncome.toLocaleString()}/mo · ends age ${partTimeEndAge}"` |

**Spouse SS claim age** is only rendered when `hasSpouse && ss2 > 0`.

**Spouse SS claim age** uses `wiSs2ClaimAge` / `setWiSs2ClaimAge`.

### Input card wrapper
```jsx
<Card>
  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
    Adjust any variables — comparison updates automatically
  </div>
  <FieldInput ... />
  {/* ... all fields */}
</Card>
```

---

## Part 4: Alternate Projection

### Building the overrides
```js
// Adjusted SS using what-if claim ages
const wiAdjustedSS1 = ss1 * ssAdjustmentFactor(wiSs1ClaimAge);
const wiAdjustedSS2 = ss2 * ssAdjustmentFactor(wiSs2ClaimAge);

// Proportional spending scale
const spendingScale = baseSpending > 0 ? wiMonthlySpending / baseSpending : 1;

// Proportional contribution scale (employer match excluded)
const contribScale = baseAnnualContribs > 0 ? wiAnnualContribs / baseAnnualContribs : 1;
```

### runProjection call
Call `runProjection` with the same inputs as `results` in `PlannerContext`, but with these overrides:

```js
const wiResults = useMemo(() => runProjection({
  // Profile overrides
  retirementAge: wiRetirementAge,
  // SS overrides
  ss1: wiAdjustedSS1,
  ss2: wiAdjustedSS2,
  // Contribution overrides (employer match unchanged)
  annualContrib401k:      Math.round(annualContrib401k      * contribScale),
  annualContribIRA:       Math.round(annualContribIRA       * contribScale),
  annualContribOther:     Math.round(annualContribOther     * contribScale),
  spouseAnnualContrib401k: Math.round(spouseAnnualContrib401k * contribScale),
  spouseAnnualContribIRA:  Math.round(spouseAnnualContribIRA  * contribScale),
  spouseAnnualContribOther:Math.round(spouseAnnualContribOther* contribScale),
  // Spending overrides
  housing:   Math.round(housing   * spendingScale),
  food:      Math.round(food      * spendingScale),
  healthcare:Math.round(healthcare* spendingScale),
  transport: Math.round(transport * spendingScale),
  leisure:   Math.round(leisure   * spendingScale),
  other:     Math.round(other     * spendingScale),
  // Part-time income override
  partTimeIncome: wiPartTimeIncome,
  // Everything else unchanged — spread from context
  age, lifeExpectancy,
  spouseAge, spouseRetirementAge, spouseLifeExpectancy,
  hasSpouse,
  trad401k: (hasTrad401k ? trad401k : 0) + (hasSpouse && spouseHasTrad401k ? spouseTrad401k : 0),
  roth401k: (hasRoth401k ? roth401k : 0) + (hasSpouse && spouseHasRoth401k ? spouseRoth401k : 0),
  tradIRA:  (hasTradIRA  ? tradIRA  : 0) + (hasSpouse && spouseHasTradIRA  ? spouseTradIRA  : 0),
  rothIRA:  (hasRothIRA  ? rothIRA  : 0) + (hasSpouse && spouseHasRothIRA  ? spouseRothIRA  : 0),
  taxableBrokerage: (hasTaxableBrokerage ? taxableBrokerage : 0) + (hasSpouse && spouseHasTaxableBrokerage ? spouseTaxableBrokerage : 0),
  employerMatch, spouseEmployerMatch,
  survivorFactor: 1.0,
  pension, pensionCOLA, pensionSurvivorPct,
  spousePension, spousePensionCOLA, spousePensionSurvivorPct,
  partTimeEndAge, rentalIncome,
  bridgeHealthcare, longTermCare, ltcStartAge, healthcareInflation,
  housingType, mortgagePayoffAge,
  homeValue, homeOwned, mortgageBalance, homeSaleIntent, homeSaleAge,
  investmentReturn, inflation,
  stateInfo,
  moveAge: planningToMove ? moveAge : Infinity,
  retirementStateInfo: planningToMove ? retirementStateInfo : stateInfo,
}), [
  wiRetirementAge, wiSs1ClaimAge, wiSs2ClaimAge,
  wiAnnualContribs, wiMonthlySpending, wiPartTimeIncome,
  // all unchanged context values that runProjection depends on
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
```

**Import:** `import { runProjection, verdictConfig } from "../utils/calc";` — `verdictConfig` is needed for the verdict display. `ssAdjustmentFactor` is already imported in `ResultsStep.jsx`; import it in `WhatIfPanel.jsx` too.

---

## Part 5: Comparison Output

### Verdict row
Two side-by-side boxes using existing `.metric-box` class pattern:

```jsx
const myVerdict  = verdictConfig(results);
const wiVerdict  = verdictConfig(wiResults);
```

- Left box label: `"MY PLAN"` (muted)
- Right box label: `"WHAT IF"` (blue — `#3b82f6`)
- Each shows: verdict label (large, colored per verdict), and portfolio runway note (e.g., `"Portfolio lasts to age 91"` or `"Portfolio outlasts life expectancy"`)

**Portfolio runway note logic:**
- If `portfolioDepletionAge >= lifeExpectancy`: `"Portfolio outlasts life expectancy"`
- Else: `` `Portfolio runs to age ${portfolioDepletionAge}` ``

`portfolioDepletionAge` is already returned by `runProjection()`.

### Chart: two-line portfolio comparison
Renders a Recharts `ComposedChart` (same as existing chart) showing both trajectories on the same axes.

**Chart data:** merge `results.yearsData` and `wiResults.yearsData` by age:
```js
const allAges = [...new Set([
  ...results.yearsData.map(d => d.age),
  ...wiResults.yearsData.map(d => d.age),
])].sort((a, b) => a - b);

const chartData = allAges.map(age => ({
  age,
  myPlan:  results.yearsData.find(d => d.age === age)?.portfolio  ?? null,
  whatIf: wiResults.yearsData.find(d => d.age === age)?.portfolio ?? null,
}));
```

**Lines:**
- `<Line dataKey="myPlan"  name="My Plan"  stroke="#22c55e" strokeWidth={2} dot={false} connectNulls={false} />`
- `<Line dataKey="whatIf" name="What If"  stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="6 3" connectNulls={false} />`

**Axes, tooltip, legend:** same pattern as existing chart in ResultsStep. Y-axis formats in `$M` / `$K`. X-axis uses `age`. Legend shows both line names with their colors.

### Metric comparison table
Four rows. Each row: metric name | My Plan value | What If value | Change (delta, color-coded).

| Row | My Plan value | What If value | Change color rule |
|---|---|---|---|
| Portfolio at retirement | `$${(results.portfolioAtRetirement/1e6).toFixed(2)}M` (or `$${Math.round(results.portfolioAtRetirement/1000)}K` if < $1M) | same format | green if whatIf ≥ myPlan, red if worse |
| Monthly income | `$${results.monthlyIncome.toLocaleString()}/mo` | same | green if ≥, red if < |
| Withdrawal rate | `${results.withdrawalRate.toFixed(1)}%` | same | green if ≤, red if > (lower is better) |
| Portfolio runs to | `age ${portfolioDepletionAge}` or `"100+"` | same | green if ≥, red if < |

**Delta format:**
- Dollar amounts: `+$X` / `−$X` (use `−` not `-` for display)
- Percentages: `+X.X%` / `−X.X%`
- Ages: `+X yrs` / `−X yrs`
- If delta is 0: show `—` in muted color

**Table header row:** `""` | `"My Plan"` | `"What If"` | `"Change"` — all right-aligned except first column.

```css
.whatif-metric-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
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

---

## Part 6: Architecture Summary

### Files changed

| File | Change |
|---|---|
| `src/steps/ResultsStep.jsx` | Add tab toggle state + tab buttons + conditional rendering of `<WhatIfPanel />` |
| `src/steps/WhatIfPanel.jsx` | New component — all What If tab UI |
| `src/styles.css` | Add `.results-tabs`, `.results-tab`, `.results-tab--active`, `.whatif-layout`, `.whatif-metric-table` |

### No changes to
- `PlannerContext.jsx` — all needed values already exposed
- `calc.js` — no projection changes
- Other step files
- Tests — no new utility functions; all logic is UI wiring

---

## Key Decisions

- **Local state in WhatIfPanel, not context** — What If inputs are ephemeral and don't affect the user's actual plan. Keeping them local avoids polluting shared state.
- **Mounts fresh each tab switch** — Since `WhatIfPanel` only renders when `activeTab === 'whatif'`, it initializes fresh from current plan values each time. This means if the user updates their plan and switches back, values reset. Acceptable behavior for v1.
- **Proportional scaling for spending and contributions** — Exposing a single total is far simpler than 6 spending fields or 8 contribution fields. Proportional scaling preserves the user's intended mix.
- **No Monte Carlo for What If** — The deterministic metrics (portfolio at retirement, monthly income, withdrawal rate, depletion age) are sufficient for comparison. MC adds computation with marginal benefit here; can be added later.
- **Employer match excluded from contributions** — The match is employer-controlled, not a decision variable. Scaling it would give misleading results.
- **Part-time end age not exposed** — Keep the input count to 6. The end age from the main plan carries over. A note on the field tells the user this.
