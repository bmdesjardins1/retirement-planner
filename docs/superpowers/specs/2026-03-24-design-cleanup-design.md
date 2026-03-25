# Site Design Cleanup — Design Spec

**Date:** 2026-03-24
**Feature:** Site design cleanup — input step polish + results page rework
**Branches:** `feat/design-input`, `feat/design-results`

---

## Overview

Two-PR cleanup targeting three goals: (1) establish a consistent design system, (2) polish the input step UX, and (3) restructure the results page around the financial narrative a CFP would use. The dark navy + emerald green aesthetic stays — this is refinement, not redesign.

**Guiding principle:** A user should be able to read the results page and get a clear answer to "will my money last?" without needing to interpret raw numbers.

---

## Scope

**In scope:**
- Typography scale consolidation (13 sizes → 7)
- Spacing utilities fix (class names currently lie about their values)
- Button hover/focus states
- Header cleanup (remove redundant copy, new headline)
- SliderInput → FieldInput (number input replacing slider track)
- Tooltip component for definition text (data stays visible; definitions move to ⓘ)
- AccountTypeBlock: section heading hierarchy fix + collapse animation
- Results page layout restructure (verdict banner, gap analysis, chart split)
- Income/expenses chart: survivor transition line + age cap
- Tax summary: retirement state callout when user plans to move

**Out of scope:**
- Mobile responsiveness (deferred)
- New state fields or calc changes
- New financial features

---

## Files Modified

### PR 1 — CSS System + Input Steps

| File | Change |
|---|---|
| `src/styles.css` | Typography scale, spacing fix, button hover states, tooltip styles, collapse animation, `.field-note` definition |
| `src/App.jsx` | Header cleanup (remove eyebrow + subtext, new headline, reduce padding) |
| `src/components/FieldInput.jsx` | New component — replaces SliderInput; number input + helper text |
| `src/components/SliderInput.jsx` | Delete (replaced by FieldInput) |
| `src/components/AccountTypeBlock.jsx` | Hierarchy fix, collapse animation, Tooltip integration |
| `src/components/Tooltip.jsx` | New component — ⓘ icon + popover |
| `src/steps/ProfileStep.jsx` | Use FieldInput, add tooltips per audit |
| `src/steps/IncomeStep.jsx` | Use FieldInput, add tooltips per audit |
| `src/steps/AssetsStep.jsx` | Use FieldInput, add tooltips per audit |
| `src/steps/SpendingStep.jsx` | Use FieldInput, add tooltips per audit |

### PR 2 — Results Page

| File | Change |
|---|---|
| `src/steps/ResultsStep.jsx` | Verdict banner, gap analysis section, chart split, income chart improvements, tax summary callout |
| `src/styles.css` | Any additional result page styles |

---

## PR 1: CSS System + Input Step Polish

### 1. Typography Scale

Collapse 13 font sizes to 7. All existing classes map to this scale:

| Size | Usage |
|---|---|
| 11px | Metric box labels, disclaimers, chart tick labels, badge text |
| 12px | Notes, helper text (`.field-note`, `.slider-note`, tooltip popover) |
| 13px | Field labels, slider labels (consolidate — these classes are identical) |
| 14px | Body text, card headings, button text |
| 18px | Account type section headings |
| 22px | Section titles (`.section-title h2`) |
| 32px+ | Hero numbers (verdict, portfolio values, assets total — keep as-is) |

Consolidate `.field-label` and `.slider-label` into a single class — they are currently defined separately with the same properties.

### 2. Spacing Utilities Fix

Current values are wrong — class names don't match actual values:

```css
/* Fix: */
.mb-20 { margin-bottom: 20px; }   /* was 14px */
.mb-28 { margin-bottom: 28px; }   /* was 20px */
```

Add:
```css
.gap-32 { gap: 32px; }   /* wider card grid gap */
```

### 3. Button Hover States

```css
.btn-primary:hover  { filter: brightness(1.1); transition: filter 0.15s; }
.btn-secondary:hover { background: rgba(51, 65, 85, 0.6); color: #cbd5e1; transition: background 0.15s, color 0.15s; }
```

### 4. Tooltip Styles

```css
.tooltip-anchor {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.tooltip-icon {
  font-size: 11px;
  color: #475569;
  cursor: help;
  line-height: 1;
  user-select: none;
}
.tooltip-icon:hover { color: #94a3b8; }
.tooltip-popover {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  background: #1e293b;
  border: 1px solid rgba(51, 65, 85, 0.8);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
  white-space: normal;
  width: 220px;
  z-index: 100;
  pointer-events: none;
}
```

### 5. Collapse Animation

```css
.collapsible {
  overflow: hidden;
  transition: max-height 0.2s ease, opacity 0.2s ease;
  max-height: 400px;  /* sufficient for a single FieldInput — the only content inside AccountTypeBlock's collapsible */
  opacity: 1;
}
.collapsible--collapsed {
  max-height: 0;
  opacity: 0;
}
```

### 6. `.field-note` Definition

Currently undefined in styles.css — falls back to browser `<p>` default (16px full brightness), which is larger and brighter than the label above it. Fix:

```css
.field-note {
  font-size: 12px;
  color: #64748b;
  margin: 0 0 12px;
  line-height: 1.5;
}
```

---

### App.jsx Header

**Remove:**
- `.app-eyebrow` element (`<p className="app-eyebrow">Retirement Planning Tool</p>`)
- `.app-sub` element (`<p className="app-sub">A personalized projection...</p>`)

**Change:**
- `.app-headline` text: `"Retirement Planner"` (was `"Will Your Money Last?"`)
- `.app-header` padding: `24px 32px 20px` (was `32px 32px 24px`)

---

### Tooltip Component

`src/components/Tooltip.jsx` — a lightweight inline tooltip triggered by hover on an ⓘ icon:

```jsx
import { useState } from "react";

export default function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="tooltip-anchor">
      {children}
      <span
        className="tooltip-icon"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >ⓘ</span>
      {visible && <span className="tooltip-popover">{text}</span>}
    </span>
  );
}
```

Usage:
```jsx
<Tooltip text="Age at which your spouse plans to stop working full-time.">
  <label className="field-label">Spouse Planned Retirement Age</label>
</Tooltip>
```

---

### FieldInput Component

`src/components/FieldInput.jsx` — replaces `SliderInput.jsx`. Removes the slider track and bounds entirely. The value is always directly editable (no click-to-activate).

**Props:** `label`, `value`, `min`, `max`, `step`, `onChange`, `prefix`, `suffix`, `note`, `tooltip`

**Wrapper class:** `.field-input` (replace `.slider-field` — same margin-bottom: 18px behavior).

**Layout:**
```
[Tooltip wrapper if tooltip prop, else plain label with .field-label class]
[prefix + <input type="number"> + suffix]
[<p className="field-note"> if note prop — always visible]
```

**Tooltip integration:** When `tooltip` prop is provided, wrap the label in the Tooltip component:
```jsx
{tooltip
  ? <Tooltip text={tooltip}><label className="field-label">{label}</label></Tooltip>
  : <label className="field-label">{label}</label>
}
```

**Input styling:** Reuse `.slider-value-input` class (22px, DM Mono, white, no border except bottom on focus). Always rendered — no toggle between display/edit mode.

**Keyboard behavior:** `onBlur` → clamp and snap. `Enter` → clamp, snap, and blur. `Escape` → revert to last committed value, blur. Same clamping logic as current SliderInput: `Math.min(max, Math.max(min, parsed))`, then `Math.round(clamped / step) * step`.

**Migration:** All 5 files that import SliderInput must be updated:
- `src/components/AccountTypeBlock.jsx` — line 1: `import FieldInput from "./FieldInput"`; all `<SliderInput>` → `<FieldInput>`
- `src/steps/ProfileStep.jsx` — line 3: `import FieldInput from "../components/FieldInput"`; all `<SliderInput>` → `<FieldInput>`
- `src/steps/IncomeStep.jsx` — line 2: same; all usages updated
- `src/steps/AssetsStep.jsx` — line 3: same; all usages updated
- `src/steps/SpendingStep.jsx` — line 2: same; all usages updated

---

### AccountTypeBlock Changes

**1. Label hierarchy fix:**

Current: `label` uses `.field-label` (13px, uppercase, muted) — smaller than `note` which is unstyled `<p>` (browser default ~16px).

Fix:
- `label` → new class `.account-type-heading` (18px, weight 700, color `#f1f5f9`, not uppercase)
- `note` → apply the tooltip rule:
  - If the note is a definition (e.g. "Tax-deferred account funded with pre-tax dollars") → moves to `tooltip` prop on the heading via Tooltip component
  - If the note is data/context → stays as `.field-note` below the heading

**2. Collapse animation:**

Wrap balance/SliderInput content in `.collapsible` div. Toggle `.collapsible--collapsed` when `!hasAccount`.

```jsx
<div className={`collapsible${!hasAccount ? ' collapsible--collapsed' : ''}`}>
  <FieldInput label="Current Balance" ... />
</div>
```

**3. Card horizontal spacing:**

Where AccountTypeBlock cards sit side-by-side in `.grid-2`, change gap from 20px to 32px. Add class `grid-2--wide` or use inline style on the specific grids in AssetsStep.

---

### Note Audit Rule

Applied to every `note` prop across all 4 step files:

| Note type | Treatment |
|---|---|
| Data / benchmark the user may not know ("Avg US life expectancy ~78M/~82F") | Stays as `note` — always visible |
| Range context ("62 is the earliest you can claim SS") | Stays as `note` |
| Behavior explanation ("After payoff, housing drops to $0") | Moves to `tooltip` |
| Definition that restates the label ("Age at which your spouse plans to stop working") | Moves to `tooltip` |
| Obvious label restatement | Delete entirely |

**Concrete audit results by file:**

**ProfileStep:**
| Field | Note text | Treatment |
|---|---|---|
| Planned Retirement Age | "Age at which you plan to stop working full-time." | → `tooltip` (definition) |
| Life Expectancy | "Average US life expectancy is ~78M / ~82F. Adjust based on health." | stays `note` (data) |
| Spouse Planned Retirement Age | "Age at which your spouse plans to stop working full-time." | → `tooltip` (definition) |
| Spouse Life Expectancy | "Average US life expectancy is ~78M / ~82F. Adjust based on health." | stays `note` (data) |
| Planned Move Age | "The year you move, your cost of living, taxes, and property tax all switch to the new state." | → `tooltip` (behavior) |

**IncomeStep:**
| Field | Note text | Treatment |
|---|---|---|
| SS Benefit | "Check ssa.gov for your estimate (avg. ~$1,900/mo). Your ssa.gov estimate is already in today's dollars." | stays `note` (data + instruction) |
| SS Claiming Age | Computed preview (claimPreviewNote) | stays `note` (dynamic data) |
| Pension COLA toggle | "Most pensions pay a fixed dollar amount for life. Some government pensions include annual cost-of-living increases." | stays `note` (data) |
| Pension survivor % | "Most pensions require you to elect a survivor benefit at retirement — check your plan documents." | stays `note` (important context) |

**SpendingStep:**
| Field | Note text | Treatment |
|---|---|---|
| Monthly Mortgage/Rent | "Don't include property taxes here — we calculate those automatically from your home value on the Assets step." | stays `note` (prevents user error) |
| Mortgage Paid Off At Age | "After payoff, housing expenses drop to $0 — freeing up that cash flow in your retirement projection." | → `tooltip` (behavior) |
| Monthly Healthcare (Medicare) | "Medicare Part B + supplement avg $400–900/mo per person. Applies from age 65 onward." | stays `note` (data/benchmark) |
| Monthly Healthcare Before Medicare | "Private insurance before Medicare kicks in at 65. Marketplace/COBRA avg $800–1,500/mo per person." | stays `note` (data/benchmark) |

**AssetsStep / AccountTypeBlock notes:**
All `note` props on AccountTypeBlock are account type definitions (e.g., "Pre-tax retirement account through your employer. Withdrawals are taxed as regular income."). These are definitions → all move to `tooltip`.

---

## PR 2: Results Page Rework

### 1. Verdict Banner

**Replace** "Savings Runway (years)" with "Portfolio at Life Expectancy."

New derived value:
```js
// For couples, show portfolio at effective life expectancy (whoever lives longer).
// For singles, show at their own life expectancy.
const portfolioAtLifeExp =
  results.yearsData.find(d => d.age >= effectiveLifeExpectancy)?.portfolio ?? 0;

// Display formatting:
const portfolioAtLifeExpDisplay =
  portfolioAtLifeExp <= 0     ? "$0"                                             // depleted — show $0 not negative
  : portfolioAtLifeExp < 1000 ? `$${Math.round(portfolioAtLifeExp)}`             // under $1k — show exact
  : portfolioAtLifeExp < 1e6  ? `$${Math.round(portfolioAtLifeExp / 1000)}k`     // under $1M — show Xk
  :                             `$${(portfolioAtLifeExp / 1e6).toFixed(1)}M`;    // $1M+ — show X.XM
```

The label reads: "Portfolio at Age {effectiveLifeExpectancy}". Color: same `.colorClass` as the verdict label (green if depleted > 0, red if depleted at $0).

Banner layout (left to right):
1. Verdict icon (replace emoji with a filled circle `●` in the verdict color — consistent rendering) + label + description
2. **Portfolio at Life Exp** (replaces Savings Runway)
3. Withdrawal Rate (existing — keep)
4. Success Rate (existing — keep)

---

### 2. Gap Analysis Section

Replace the current 3-card `grid-3` (Net Monthly Income, Monthly Need, Monthly Gap) with a single connected layout that tells the income story:

```
MONTHLY RETIREMENT PICTURE

Monthly Need at Retirement          $8,500
Guaranteed Income (ⓘ)            − $4,200
                                  ─────────
Monthly Portfolio Draw (ⓘ)          $4,300
Withdrawal Rate                       5.1%   ← color-coded
```

**ⓘ on Guaranteed Income:** "Social Security + pension + rental income + part-time income, after state income tax."

**ⓘ on Monthly Portfolio Draw:** "The amount drawn from your portfolio each month to cover the gap between income and spending. This drives your withdrawal rate."

Withdrawal rate color coding: ≤4% green, ≤5% yellow, ≤7% orange, >7% red (same thresholds as current).

---

### 3. Portfolio Chart — Split into Two

**Why the MC band is removed from the chart:** The confidence band (p10–p90 range) makes the chart visually cluttered and is hard to interpret at a glance. The key insight from the simulation — "X% of scenarios survive to life expectancy" — is already surfaced as a single number in the verdict banner. Keeping the band on the chart adds noise without adding clarity. The simulation still runs; only the visual band is removed.

**Primary chart (everyone):** Combined projection only.
- Remove MC band Area components (`mcFloor`, `mcBand`) and their entries from `chartData`
- Remove `primary` and `spouse` Area components
- Keep `combined` Area only (green, filled gradient)
- Cap: change `chartCutoffAge` from `effectiveLifeExpectancy + 5` to `effectiveLifeExpectancy` exactly
- Keep all existing ReferenceLine markers (retirement ages, life expectancies)
- Title: "Portfolio Value Over Time"
- Height: 280px (unchanged)

**Scenario Comparison chart (couples only):**
- Shown only when `hasSpouse` — rendered as a second `<Card>` below the primary chart
- Title: "Scenario Comparison: You vs. Spouse vs. Combined"
- Use `LineChart` (not `AreaChart`) — no fill, clean line-only view
- Three lines: `combined` (green solid, strokeWidth 2.5), `primary` (purple dashed, strokeWidth 1.5), `spouse` (blue dashed, strokeWidth 1.5)
- Same `visibleChartData` and x-axis cap as primary chart
- Height: 240px
- Disclaimer: "Individual trajectories use 60% of household expenses — standard survivor planning assumption. Combined uses 100%."

---

### 4. Income vs. Expenses Chart

**Two changes:**

1. **Age cap:** Add `&& d.age <= effectiveLifeExpectancy` to the data filter. Currently runs to the end of yearsData which can exceed age 100.

2. **Survivor transition line:** Add ReferenceLine at `firstDeathAge` for couples.

```js
// Computed in ResultsStep — no calc changes needed:
const firstDeathAge = hasSpouse
  ? Math.min(lifeExpectancy, age + (spouseLifeExpectancy - spouseAge))
  : null;
```

```jsx
{firstDeathAge && (
  <ReferenceLine
    x={firstDeathAge}
    stroke="#94a3b8" strokeDasharray="4 4"
    label={{ value: "Survivor phase", fill: "#94a3b8", fontSize: 10, position: "insideTopRight" }}
  />
)}
```

3. **Chart title:** "Combined Household Income vs. Expenses" when `hasSpouse`, "Your Income vs. Expenses" when solo.

---

### 5. Tax Summary — Retirement State Callout

`ResultsStep.jsx` does not currently destructure `planningToMove`, `retirementState`, `moveAge`, or `retirementStateInfo` from `usePlanner()`. Add all four to the existing destructuring block at the top of the component.

When `planningToMove`, add a note beneath the state tax metric box:

```jsx
{planningToMove && (
  <div className="metric-box-note" style={{ marginTop: 8 }}>
    After your planned move to {retirementState} at age {moveAge}:{" "}
    state income tax changes to {(retirementStateInfo.incomeTax * 100).toFixed(1)}%
    {retirementStateInfo.hasSSIncomeTax
      ? " (SS benefits are taxed in that state)"
      : " (SS benefits are not taxed in that state)"}.
  </div>
)}
```

No calc changes — the projection already accounts for the move correctly.

---

## Simplifications Accepted

1. **No mobile breakpoints.** PRs do not add responsive layout. Grid columns will overflow on small screens. Deferred to a dedicated mobile pass.

2. **FieldInput has no slider fallback.** Users who preferred the slider for coarse adjustment lose that option. Tradeoff accepted — the number input is the cleaner primary interaction.

3. **Portfolio at life expectancy uses primary's age axis.** For couples, `effectiveLifeExpectancy` is already converted to the primary's age axis (which is what the chart uses). The displayed age label matches what the user entered for their own life expectancy or their spouse's (whichever is longer when mapped to primary's age).

4. **Survivor transition line uses life expectancy inputs, not probability.** `firstDeathAge` is deterministic (min of both life expectancies on the primary's axis). In reality the first death could happen at any age — the line marks the planning assumption, not a guarantee.
