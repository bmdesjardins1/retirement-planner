# Monte Carlo Simulation — Visualization & Explainability

**Date:** 2026-03-25
**Status:** Approved

---

## Goal

Surface the Monte Carlo simulation results that are already computed but currently discarded. Add a dedicated "Simulation Analysis" section to the results page with a confidence band chart, a volatility control, and a plain-English failure analysis — giving users real insight into their retirement risk, not just a number.

---

## Background

`runMonteCarlo` in `src/utils/monteCarlo.js` already runs 500 simulations and returns:
- `successRate` — % of simulations where portfolio survived to life expectancy (currently displayed in verdict banner)
- `bands` — `{age, p10, p50, p90}` per year (currently discarded)

The simulation varies only annual portfolio returns (Box-Muller normal distribution). Income, spending, SS, and pension are deterministic — only return sequence varies. This means the primary driver of failure is **sequence of returns risk**: bad returns early in retirement permanently damage a portfolio even if long-run averages are fine.

---

## What Gets Built

A new "Simulation Analysis" section on the results page (below income/expenses chart, above tax summary) containing:

1. Section header with success rate badge (scrolled to from verdict banner)
2. Confidence band chart
3. Volatility control (Low / Medium / High toggle)
4. Failure analysis stats + sequence of returns explainer

---

## Section 1: Overall Layout

- Positioned below the income/expenses chart, above the tax summary
- The success rate badge in the verdict banner gains a click handler that smooth-scrolls to this section via a `useRef` named `mcSectionRef`
- The scroll is triggered with `mcSectionRef.current?.scrollIntoView({ behavior: 'smooth' })`
- The success rate `<div className="verdict-runway">` block is wrapped in a `<button>` element with `className="verdict-runway-btn"` (styled to remove default button appearance) so it is keyboard-accessible. A `cursor: pointer` style is added.
- Section header: "Monte Carlo Simulation" with a subheading explaining what it shows

---

## Section 2: Confidence Band Chart

**Chart type:** Recharts `ComposedChart` — add to existing Recharts import (not currently imported)

**Data source:** Pre-processed `bandChartData` array derived from `bands`:

```js
const bandChartData = bands.map(b => ({
  age: b.age,
  p10: b.p10,
  bandWidth: Math.max(0, b.p90 - b.p10),  // used for stacked area rendering
  p50: b.p50,
  p90: b.p90,
}));
```

**Band rendering strategy — stacked area approach:**
- `<Area dataKey="p10" fill="transparent" stroke="none" />` — invisible floor that positions the band
- `<Area dataKey="bandWidth" fill="rgba(52,211,153,0.15)" stroke="none" stackId="band" />` — the visible band (stacked on top of p10)
- `<Line dataKey="p50" stroke="#34d399" strokeWidth={2} dot={false} name="Median" />`
- `<Line dataKey="p10" stroke="#34d399" strokeWidth={1} strokeDasharray="4 3" dot={false} name="Pessimistic (worst 10%)" />`
- `<Line dataKey="p90" stroke="#34d399" strokeWidth={1} strokeDasharray="4 3" dot={false} name="Optimistic (best 10%)" />`

Note: `p10` appears twice — once as a stacked `Area` (transparent floor) and once as a `Line`. Both use `dataKey="p10"` which is valid in `ComposedChart`.

**What is NOT on this chart:**
- The deterministic `combined` line from the primary portfolio chart (keeps the two charts telling separate stories)
- Retirement age / life expectancy reference lines (chart starts and ends at those bounds implicitly)

**Chart bounds:** x-axis from `retirementAge` to `effectiveLifeExpectancy`

**Chart height:** 260px

---

## Section 3: Volatility Control

**UI:** Segmented button toggle (three `<button>` elements in a row). Placed directly below the chart with a label "Portfolio Volatility".

**Local state in `ResultsStep`:** `const [stdDevSetting, setStdDevSetting] = useState("medium")`

**stdDev map:** `const STD_DEV_MAP = { low: 5, medium: 10, high: 17 }`

**Options:**

| Setting | stdDev | Label | Description |
|---------|--------|-------|-------------|
| low | 5% | Conservative | Heavy bonds, stable returns. Annual swings rarely exceed ±10%. |
| medium | 10% | Balanced | 60/40 stocks/bonds. Annual swings typically ±15%. *(default)* |
| high | 17% | Aggressive | All equities. Annual swings can exceed ±30%. |

- Description text updates dynamically below the toggle as the user switches options (one line, driven by `stdDevSetting`)
- No debouncing needed — discrete button clicks, not continuous drag
- The existing `useMemo` call (lines ~102–108 of `ResultsStep.jsx`) is **expanded in-place**:
  - Add `stdDev: STD_DEV_MAP[stdDevSetting]` to the `runMonteCarlo` call arguments
  - Expand destructure: `const { successRate, bands, medianFailureAge, p10DepletionAge } = useMemo(...)`
  - Add `stdDevSetting` to the dependency array
- The verdict banner label `"of 500 simulations"` must be updated to `"of 1,000 simulations"`

---

## Section 4: Failure Analysis & Explainability

**Three metric boxes (displayed as a row, using existing `.metric-box` class):**

1. **Success Rate** — "X% of 1,000 simulations survived to age {effectiveLifeExpectancy}"
2. **Median Failure Age** — label: "Median Failure Age", value: age number or `"—"` if `medianFailureAge === null`
3. **Worst 10%** — label: "Worst 10% Depleted By", value: age number or `"—"` if `p10DepletionAge === null`

**Null display rules per box:**
- `medianFailureAge === null` → show `"—"` with sub-label "No failures"
- `p10DepletionAge === null` → show `"—"` with sub-label "p10 never depleted"
- These can occur independently (e.g., `successRate` = 85% but p10 never hit $0)

**Edge case — all simulations succeed (`successRate === 100`):**
- Success Rate box shows "100% — all simulations survived"
- Median Failure Age and Worst 10% boxes both show `"—"`
- Sequence of returns callout is hidden

**Sequence of returns callout (highlighted box using `.mc-explainer`):**

Shown only when `successRate < 100`:

> "Most failures are driven by poor market returns in the first 5–7 years of retirement — not the long-run average. Even if average returns are good, selling investments at a loss early on permanently reduces your portfolio. This is called **sequence of returns risk**. Retiring with a lower withdrawal rate or a cash buffer for the first few years significantly reduces this risk."

This is static educational content — no new computation required.

---

## Architecture

### `src/utils/monteCarlo.js`

- Bump `simCount` default: 500 → 1,000
- During simulation loop, track failure ages: when a simulation first hits $0 (i.e., `portfolio <= 0` and the simulation is marked failed), push `drawdown[i].age` to a `failureAges` array
- After the simulation loop, compute:
  - `medianFailureAge` — median of `failureAges`; if `failureAges` is empty, return `null`
  - `p10DepletionAge` — earliest `band.age` where `band.p10 === 0` (exact equality — all portfolio values are clamped to 0 and rounded, so `=== 0` is correct, not `<= 0`); return `null` if no such age exists
- Full return shape: `{ successRate, bands, medianFailureAge, p10DepletionAge }`

### `src/steps/ResultsStep.jsx`

- Add local state: `const [stdDevSetting, setStdDevSetting] = useState("medium")`
- Add stdDev map constant: `const STD_DEV_MAP = { low: 5, medium: 10, high: 17 }`
- Add `mcSectionRef` via `useRef(null)`, attached to the simulation section container
- Expand the existing `useMemo` in-place: add `stdDev: STD_DEV_MAP[stdDevSetting]` to call args, expand destructure to `{ successRate, bands, medianFailureAge, p10DepletionAge }`, add `stdDevSetting` to dependency array
- Pre-compute `bandChartData` from `bands` (see Section 2 above)
- Update verdict banner label from `"of 500 simulations"` to `"of 1,000 simulations"`
- Wrap success rate `verdict-runway` block in a `<button className="verdict-runway-btn">` with `onClick` calling `mcSectionRef.current?.scrollIntoView({ behavior: 'smooth' })`
- Add `ComposedChart` to the existing Recharts import line (all other needed components — `Area`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`, `Legend` — are already imported)
- New JSX: simulation section with `ref={mcSectionRef}`, section header, band chart, volatility toggle, failure stats row, sequence of returns callout

### `src/styles.css`

- `.verdict-runway-btn` — resets button appearance (background none, border none, padding 0, cursor pointer, text-align left, color inherit, font inherit); inherits all `.verdict-runway` visual styling
- `.mc-section` — uses `<Card>` component (not a plain div); no new CSS class needed for the outer container since `<Card className="mb-28">` already provides card styling
- `.mc-toggle` — `display: flex; gap: 8px; margin: 20px 0 8px`
- `.mc-toggle-btn` — pill-shaped button: `padding: 6px 16px; border-radius: 20px; border: 1px solid rgba(51,65,85,0.5); background: transparent; color: #64748b; font-size: 13px; cursor: pointer`
- `.mc-toggle-btn--active` — active state: `background: rgba(52,211,153,0.15); border-color: #34d399; color: #34d399`
- `.mc-toggle-desc` — `font-size: 12px; color: #64748b; margin-bottom: 20px`
- `.mc-explainer` — amber-tinted callout: `background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); border-radius: 10px; padding: 16px 20px; margin-top: 20px; font-size: 13px; color: #cbd5e1; line-height: 1.6`

### No changes to

- `PlannerContext` — stdDev is display-only state, not a planning input
- `calc.js` — no changes to core projection
- Other step files
- Existing tests (monteCarlo.test.js gets new tests, existing ones are unchanged)

### New tests (`tests/monteCarlo.test.js`)

- `medianFailureAge` is `null` when all simulations succeed (use a high portfolioAtRetirement with low withdrawals)
- `medianFailureAge` is a number within the drawdown age range when failures occur (use a low portfolioAtRetirement with high withdrawals)
- `p10DepletionAge` is `null` when p10 never hits $0
- `p10DepletionAge` is `=== 0` check, not `<= 0`
- `bands` length equals the number of years in the drawdown phase
- `successRate` is between 0 and 100 inclusive
- `bandChartData` pre-computation: `bandWidth` is never negative (Math.max guard)

---

## Key Decisions

- **Separate chart, not overlaid** — primary portfolio chart stays clean. MC band is a distinct "what's the range" story.
- **Local state, not PlannerContext** — stdDev setting is a visualization control, not a planning input. No need to persist across steps.
- **Discrete toggle, not slider** — three meaningful options are clearer than a continuous range for non-technical users.
- **Stacked area band rendering** — `p10` as transparent floor + `bandWidth` as visible fill avoids background-color masking hack and works correctly on any background.
- **No routing** — section on results page with scroll anchor. Routing deferred to a future architectural pass when multiple pages exist.
- **1,000 simulations** — free performance upgrade from 500, more stable percentile estimates.
- **`=== 0` for depletion check** — simulation clamps portfolio to exactly 0, so strict equality is correct.
