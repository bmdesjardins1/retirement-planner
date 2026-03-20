# Refactor & UI Polish — Design Spec

**Date:** 2026-03-19
**Status:** Approved

## Overview

Two parallel tracks executed in order:

1. **Code refactor** — eliminate duplication, clean up dependency arrays, move tests to a dedicated folder. Zero visible changes.
2. **UI/UX polish** — assets step tabs, numbered step navigation, chart fixes, consistent form density.

The refactor comes first because extracting `AccountTypeBlock` directly enables the assets step tab redesign.

---

## Track 1: Code Refactor

### 1A — Extract `AccountTypeBlock` component

**Problem:** `AssetsStep.jsx` repeats the same 5-account-type block twice — once for the primary user, once for the spouse — with only variable names changed (`trad401k` vs `spouseTrad401k`). Any UI change requires editing both copies.

**Solution:** Create `src/components/AccountTypeBlock.jsx` with this interface:

```jsx
<AccountTypeBlock
  label="Traditional 401(k) / 403(b)"
  note="Pre-tax retirement account through your employer..."
  hasAccount={hasTrad401k}
  onToggle={setHasTrad401k}
  balance={trad401k}
  onBalanceChange={setTrad401k}
  max={2000000}
  step={10000}
  balanceNote={null}        // optional: e.g. "We assume 60% of withdrawals are taxable gains"
/>
```

The component renders: field-label → field-note → toggle-group → conditional SliderInput.

`AssetsStep.jsx` is rewritten to use `AccountTypeBlock` × 5 per person. The 240-line file should reduce significantly.

### 1B — Move tests to `tests/` at project root

**Problem:** Test files (`calc.test.js`, `federalTax.test.js`) live alongside source files in `src/utils/`, mixing source and test concerns.

**Solution:**
- Create `tests/` directory at project root
- Move `src/utils/calc.test.js` → `tests/calc.test.js`
- Move `src/utils/federalTax.test.js` → `tests/federalTax.test.js`
- Update import paths inside test files: `./calc` → `../src/utils/calc`
- Update `vitest.config.js`: add `test.include: ['tests/**/*.test.js']`
- Delete the old test files from `src/utils/`

All 19 existing tests must continue to pass.

### 1C — Explicit dependency arrays in PlannerContext

**Problem:** All three `useMemo` projections end with `...Object.values(sharedInputs)` — an implicit spread that makes the dependency list unreadable and fragile (adding/removing a field from `sharedInputs` silently affects all three dep arrays).

**Solution:** Replace the spread with an explicit list of each value in all three `useMemo` dep arrays:

```js
// Replace:
...Object.values(sharedInputs),

// With explicit fields:
pension, pensionCOLA, partTimeIncome, partTimeEndAge, rentalIncome,
housing, food, healthcare, transport, leisure, other,
longTermCare, ltcStartAge,
homeValue, homeOwned, investmentReturn, inflation, healthcareInflation,
stateInfo,
```

No behavioral change — only readability and maintainability. The `...sharedInputs` spread inside the `runProjection()` calls is unchanged.

---

## Track 2: UI/UX Polish

### 2A — Assets step: tabbed layout

**Problem:** With a spouse, the current `grid-2` layout renders 10 account blocks simultaneously — a wall of inputs.

**Solution:** Replace the side-by-side cards with a single tabbed card:

- Two tabs: **Your Accounts** (green accent) and **Spouse Accounts** (blue accent)
- Only one tab visible at a time — shows 5 `AccountTypeBlock`s + 4 contribution sliders for that person
- When `hasSpouse` is false, no tabs — just the "Your Accounts" content directly
- Tab state is local UI state (`useState`) inside `AssetsStep`, not in PlannerContext
- The Real Estate & Growth card and the Summary card below remain unchanged

### 2B — Step navigation: numbered steps with connector

**Problem:** Current stepper is plain text buttons with a border-bottom underline — minimal visual feedback on progress.

**Solution:** Replace `.step-btn` elements with a numbered-circle + connector pattern:

- Each step: circle (32×32px, border-radius 50%) + label below
- Circles connected by a horizontal line between them
- **Completed steps** (index < current): filled green circle, checkmark icon, green connector line to next
- **Active step** (index === current): bright green circle with step number, white text
- **Future steps** (index > current): ghost circle (transparent fill, dark border), muted label
- Clicking a completed step still navigates back (existing behavior preserved)
- Labels: Profile, Income, Assets, Spending, Results

Implementation: update `App.jsx` stepper markup and replace `.step-btn` styles in `styles.css`.

### 2C — Results page: chart fixes

Four targeted fixes — no layout changes:

**i. Age axis range**
- `chartData` in `ResultsStep.jsx` is currently built from all `yearsData` entries, which runs to `effectiveLifeExpectancy + 30` (changed during the calculation audit)
- Fix: filter `chartData` to only include entries where `age <= max(lifeExpectancy, spouseLifeExpectancy) + 5`
- This caps the portfolio chart x-axis at a sensible age (e.g. 93 not 118)

**ii. Legend + axis label overlap (portfolio chart)**
- Current: `insideBottom` and `insideLeft` axis labels compete with the Recharts legend inside the chart area
- Fix: increase bottom margin from 24 to 40, increase left margin from 8 to 16; move legend to `verticalAlign="top"` with `height={36}` wrapperStyle so it sits above the chart area

**iii. Reference line label collisions (portfolio chart)**
- Four reference lines (Your Retirement, Spouse Retirement, Your Life Exp., Spouse Life Exp.) can overlap when ages are close
- Fix: shorten labels to "Retire" / "Spouse Retire" / "Life Exp." / "Spouse Exp."; use `position="insideTopRight"` on even-indexed lines and `position="insideTopLeft"` on odd-indexed to stagger them

**iv. Bar chart legend + axis label overlap**
- Same root cause as (ii)
- Fix: same margin adjustment + legend moved to `verticalAlign="top"`

### 2D — Form density: between A and B

Adjust CSS spacing values for a tighter, more consistent rhythm without feeling cramped:

| Property | Before | After |
|---|---|---|
| `.card` padding | `28px` | `20px 24px` |
| `.mb-20` (between account blocks) | `20px` | `14px` |
| `.field-label` margin-bottom | `12px` | `8px` |
| `.toggle` padding | `10px 20px` | `7px 16px` |
| `.toggle-group` margin-bottom | `0` | `10px` |
| `.slider-field` margin-bottom | `24px` | `18px` |
| `.mb-28` (between cards) | `28px` | `20px` |

The toggle-group margin-bottom is the most important fix — currently 0, which causes account blocks that don't show a slider ("I don't") to run directly into the next block's label with no visual separation.

---

## Component & File Inventory

### New files
- `src/components/AccountTypeBlock.jsx`
- `tests/calc.test.js`
- `tests/federalTax.test.js`

### Modified files
- `src/steps/AssetsStep.jsx` — rewritten to use tabs + `AccountTypeBlock`
- `src/App.jsx` — numbered step nav markup
- `src/steps/ResultsStep.jsx` — chart fixes
- `src/styles.css` — step nav styles + density adjustments
- `src/context/PlannerContext.jsx` — explicit dep arrays
- `vitest.config.js` — updated include path

### Deleted files
- `src/utils/calc.test.js`
- `src/utils/federalTax.test.js`

---

## Out of Scope

- No changes to `calc.js` or `federalTax.js` logic
- No changes to ProfileStep, IncomeStep, SpendingStep content
- No new features
- No mobile-specific layout work

---

## Success Criteria

- All 19 existing tests pass from their new location in `tests/`
- `vite build` succeeds with no warnings
- Assets step shows tabs when spouse is present; single view when not
- Step nav shows numbered circles with checkmarks for completed steps
- Portfolio chart age axis stops at life expectancy + 5
- No overlapping labels or legends on any chart
- Form sections feel consistently spaced — tighter than current but not cramped
