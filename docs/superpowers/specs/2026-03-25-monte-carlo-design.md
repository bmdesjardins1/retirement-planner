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
- The success rate badge in the verdict banner gains a click handler that smooth-scrolls to this section via a `useRef`
- Section header: "Monte Carlo Simulation" with a subheading explaining what it shows

---

## Section 2: Confidence Band Chart

**Chart type:** Recharts `ComposedChart`

**Data source:** `bands` array from `runMonteCarlo` — `{age, p10, p50, p90}` per year, drawdown phase only (retirement age → life expectancy)

**Visual layers (bottom to top):**
- Shaded band — filled area between p10 and p90, low-opacity emerald green. Represents the range where 80% of simulations landed.
- p50 line — solid, labeled "Median"
- p10 line — thin dashed, labeled "Pessimistic (worst 10%)"
- p90 line — thin dashed, labeled "Optimistic (best 10%)"

**What is NOT on this chart:**
- The deterministic `combined` line from the primary portfolio chart (keeps the two charts telling separate stories)
- Retirement age / life expectancy reference lines (chart starts and ends at those bounds implicitly)

**Chart bounds:** x-axis from `retirementAge` to `effectiveLifeExpectancy`

---

## Section 3: Volatility Control

**UI:** Segmented button toggle (three discrete buttons — not a slider). Placed directly below the chart.

**Local state in `ResultsStep`:** `const [stdDevSetting, setStdDevSetting] = useState("medium")`

**Options:**

| Setting | stdDev | Label | Description |
|---------|--------|-------|-------------|
| low | 5% | Conservative | Heavy bonds, stable returns. Annual swings rarely exceed ±10%. |
| medium | 10% | Balanced | 60/40 stocks/bonds. Annual swings typically ±15%. *(default)* |
| high | 17% | Aggressive | All equities. Annual swings can exceed ±30%. |

- Description updates dynamically below the toggle as the user switches options
- No debouncing needed — discrete button clicks, not continuous drag
- `stdDevSetting` added to `useMemo` dependency array so chart and success rate update together

---

## Section 4: Failure Analysis & Explainability

**Three metric boxes (displayed as a row):**

1. **Success Rate** — "X% of 1,000 simulations survived to age N" (mirrors banner but with full context)
2. **Median Failure Age** — "When simulations failed, portfolios typically ran dry around age X" (derived from new `medianFailureAge` return value)
3. **Worst 10%** — "In the worst 10% of scenarios, portfolio depleted by age X" (derived from new `p10DepletionAge` return value)

**Edge case:** When `successRate === 100`, show "No failures across 1,000 simulations" and hide the callout below.

**Sequence of returns callout (highlighted box):**

Shown only when `successRate < 100`:

> "Most failures are driven by poor market returns in the first 5–7 years of retirement — not the long-run average. Even if average returns are good, selling investments at a loss early on permanently reduces your portfolio. This is called **sequence of returns risk**. Retiring with a lower withdrawal rate or a cash buffer for the first few years significantly reduces this risk."

This is static educational content — no new computation required.

---

## Architecture

### `src/utils/monteCarlo.js`

- Bump `simCount` default: 500 → 1,000
- During simulation loop, track failure ages: when a simulation first hits $0, push `drawdown[i].age` to a `failureAges` array
- Compute and return two new values:
  - `medianFailureAge` — median of `failureAges` (null if no failures)
  - `p10DepletionAge` — the earliest age at which p10 hits $0 in `bands` (null if p10 never hits $0)
- Full return shape: `{ successRate, bands, medianFailureAge, p10DepletionAge }`

### `src/steps/ResultsStep.jsx`

- Add local state: `const [stdDevSetting, setStdDevSetting] = useState("medium")`
- Add stdDev map: `const STD_DEV_MAP = { low: 5, medium: 10, high: 17 }`
- Destructure `bands`, `medianFailureAge`, `p10DepletionAge` from `runMonteCarlo`
- Add `stdDevSetting` to `useMemo` dependency array
- Add `ComposedChart`, `Area` (already imported), `Line` (already imported) from Recharts — verify existing imports, add only what's missing
- Add `useRef` for scroll target, click handler on success rate badge in verdict banner
- New JSX: section header, band chart, volatility toggle, failure stats, sequence of returns callout

### `src/styles.css`

- `.mc-section` — section container (matches existing card style)
- `.mc-toggle` — segmented button group container
- `.mc-toggle-btn` — individual button, with `.mc-toggle-btn--active` modifier
- `.mc-toggle-desc` — dynamic description line below toggle
- `.mc-explainer` — highlighted callout box for sequence of returns risk (amber/yellow tint to distinguish from standard cards)

### No changes to

- `PlannerContext` — stdDev is display-only state, not a planning input
- `calc.js` — no changes to core projection
- Other step files
- Existing tests

### New tests (`tests/monteCarlo.test.js`)

- `medianFailureAge` is null when all simulations succeed
- `medianFailureAge` is a number within the drawdown range when failures occur
- `p10DepletionAge` is null when p10 never hits $0
- `bands` length equals drawdown phase length
- `successRate` is between 0 and 100

---

## Key Decisions

- **Separate chart, not overlaid** — primary portfolio chart stays clean. MC band is a distinct "what's the range" story.
- **Local state, not PlannerContext** — stdDev setting is a visualization control, not a planning input. No need to persist across steps.
- **Discrete toggle, not slider** — three meaningful options are clearer than a continuous range for non-technical users.
- **No routing** — section on results page with scroll anchor. Routing deferred to a future architectural pass when multiple pages exist.
- **1,000 simulations** — free performance upgrade from 500, more stable percentile estimates.
