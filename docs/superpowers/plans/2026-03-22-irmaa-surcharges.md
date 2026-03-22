# IRMAA Surcharges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Medicare IRMAA surcharge modeling to the retirement projection — calculating per-year surcharges from guaranteed retirement income and surfacing them as a metric box in the Tax & Cost Summary alongside the existing RMD callout.

**Architecture:** New `irmaaTable.js` lookup function maps annual MAGI to a monthly per-person surcharge. The calc loop computes `irmaaAnnual` from guaranteed income (SS + pension + part-time + rental) before the spending gap calculation, adds it to `yearlyNeed`, and stores `irmaa` on each `yearsData` entry. ResultsStep finds the first year where `irmaa > 0` and displays the metric box.

**Tech Stack:** JavaScript (ES modules), React 18, Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/steps/SpendingStep.jsx` | Modify | Fix housing toggle classes (Task 1) |
| `src/utils/irmaaTable.js` | Create | IRS bracket lookup function |
| `tests/irmaaTable.test.js` | Create | Unit tests for lookup function |
| `src/utils/calc.js` | Modify | IRMAA calculation in drawdown loop |
| `tests/calc.test.js` | Modify | IRMAA integration tests |
| `src/steps/ResultsStep.jsx` | Modify | IRMAA metric box in Tax & Cost Summary |

---

## Task 1: Fix housing toggle styling

The housing type toggle in SpendingStep uses `tab-row`/`tab-btn`/`tab-btn--active` classes that don't exist in `styles.css`. Replace with the existing `toggle-group`/`toggle`/`toggle--active` pattern used everywhere else on the page.

**Files:**
- Modify: `src/steps/SpendingStep.jsx`

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feat/irmaa-surcharges
```

- [ ] **Step 2: Replace tab classes with toggle classes**

In `src/steps/SpendingStep.jsx`, replace:

```jsx
<div className="tab-row" style={{ marginBottom: 16 }}>
  <button
    className={`tab-btn${housingType === "own" ? " tab-btn--active" : ""}`}
    onClick={() => setHousingType("own")}
  >I have a mortgage</button>
  <button
    className={`tab-btn${housingType === "rent" ? " tab-btn--active" : ""}`}
    onClick={() => setHousingType("rent")}
  >I rent</button>
</div>
```

With:

```jsx
<div className="toggle-group" style={{ marginBottom: 16 }}>
  <button
    className={`toggle${housingType === "own" ? " toggle--active" : ""}`}
    onClick={() => setHousingType("own")}
  >I have a mortgage</button>
  <button
    className={`toggle${housingType === "rent" ? " toggle--active" : ""}`}
    onClick={() => setHousingType("rent")}
  >I rent</button>
</div>
```

- [ ] **Step 3: Run tests to confirm nothing broke**

```bash
npm test
```

Expected: all tests pass (no test covers this UI element directly — just confirm no regressions).

- [ ] **Step 4: Commit**

```bash
git add src/steps/SpendingStep.jsx
git commit -m "fix: housing toggle uses correct toggle-group/toggle classes"
```

---

## Task 2: Create IRMAA lookup table

Build the `irmaaTable.js` module that maps annual income to a monthly per-person IRMAA surcharge.

**Files:**
- Create: `src/utils/irmaaTable.js`
- Create: `tests/irmaaTable.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/irmaaTable.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { getIrmaaSurcharge } from '../src/utils/irmaaTable';

describe('getIrmaaSurcharge — single filer', () => {
  it('returns 0 at exactly the base threshold', () => {
    expect(getIrmaaSurcharge(103000, false)).toBe(0);
  });

  it('returns 82.80 one dollar above first bracket', () => {
    expect(getIrmaaSurcharge(103001, false)).toBe(82.80);
  });

  it('returns 208.00 in the second bracket', () => {
    expect(getIrmaaSurcharge(150000, false)).toBe(208.00);
  });

  it('returns 500.30 at the top bracket', () => {
    expect(getIrmaaSurcharge(600000, false)).toBe(500.30);
  });
});

describe('getIrmaaSurcharge — married filer', () => {
  it('returns 0 at exactly the married base threshold', () => {
    expect(getIrmaaSurcharge(206000, true)).toBe(0);
  });

  it('returns 82.80 one dollar above married first bracket', () => {
    expect(getIrmaaSurcharge(206001, true)).toBe(82.80);
  });

  it('returns 500.30 at the married top bracket', () => {
    // Married top bracket is $750K (not 2× single $500K — it is 1.5×)
    expect(getIrmaaSurcharge(800000, true)).toBe(500.30);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test tests/irmaaTable.test.js
```

Expected: FAIL — "Cannot find module '../src/utils/irmaaTable'"

- [ ] **Step 3: Implement the lookup table**

Create `src/utils/irmaaTable.js`:

```js
/**
 * 2024 IRMAA (Income-Related Monthly Adjustment Amount) brackets.
 * Medicare Part B + Part D combined monthly surcharge per person.
 * Source: CMS 2024.
 *
 * Note: the top married bracket is $750K (1.5× single $500K, not 2×).
 */

// [maxIncome, monthlyPerPerson] — single filer thresholds
const SINGLE_BRACKETS = [
  [103000,  0],
  [129000,  82.80],
  [161000,  208.00],
  [193000,  333.30],
  [500000,  458.50],
  [Infinity, 500.30],
];

// [maxIncome, monthlyPerPerson] — married filing jointly thresholds
const MARRIED_BRACKETS = [
  [206000,  0],
  [258000,  82.80],
  [322000,  208.00],
  [386000,  333.30],
  [750000,  458.50],
  [Infinity, 500.30],
];

/**
 * Returns the monthly IRMAA surcharge per person.
 *
 * @param {number} annualIncome - Annual MAGI in dollars (real/year-0 terms)
 * @param {boolean} isMarried - Use married filing jointly thresholds when true
 * @returns {number} Monthly surcharge per person (0 if below base threshold)
 */
export function getIrmaaSurcharge(annualIncome, isMarried) {
  const brackets = isMarried ? MARRIED_BRACKETS : SINGLE_BRACKETS;
  for (const [max, surcharge] of brackets) {
    if (annualIncome <= max) return surcharge;
  }
  return 500.30; // fallback (should never be reached due to Infinity sentinel)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test tests/irmaaTable.test.js
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/irmaaTable.js tests/irmaaTable.test.js
git commit -m "feat: IRMAA bracket lookup table with unit tests"
```

---

## Task 3: Wire IRMAA into the calc drawdown loop

Add IRMAA to `runProjection()` in `calc.js`. The surcharge is computed from guaranteed income (SS + ordinary) before the spending gap is calculated, added to `yearlyNeed`, and stored on each `yearsData` entry.

**Files:**
- Modify: `src/utils/calc.js`
- Modify: `tests/calc.test.js`

Key context about `calc.js`:
- The drawdown loop starts after Phase 1 (accumulation). Loop index `y` runs from 0.
- `ageInYear = retirementAge + y`
- `activeRealSS` = annual SS in real/year-0 dollars (already switches to `ssMonthlyAlone * 12` after survivor transition at line ~240)
- `activeMarried = isSurvivor ? false : hasSpouse` (already computed at line ~241)
- `realOrdinary = (ptEnded ? nonSSWithoutPT : nonSSWithPT) * 12` (annual pension+part-time+rental, real terms, computed at line ~217)
- `spouseAge` is the spouse's current age at projection start (a param)
- `isSurvivor` is already in the loop
- `yearlyNeed` is computed after these variables — IRMAA is inserted before `yearlyNeed`
- `yearsData.push(...)` happens at the end of each loop iteration — add `irmaa` there

- [ ] **Step 1: Write failing tests**

Add this describe block to `tests/calc.test.js` (append after the existing RMD tests):

```js
describe('IRMAA surcharges', () => {
  // Low guaranteed income: SS $1,200/mo, no pension — MAGI ≈ $14,400 → $0
  const lowIncomeBase = {
    ...BASE,
    ss1: 1200, ss2: 0, pension: 0,
    retirementAge: 65, lifeExpectancy: 85,
  };

  it('irmaa is 0 below income threshold', () => {
    const result = runProjection(lowIncomeBase);
    const medicareYears = result.yearsData.filter(d => d.age >= 65);
    for (const yr of medicareYears) {
      expect(yr.irmaa).toBe(0);
    }
  });

  it('irmaa is 0 before age 65', () => {
    // retirementAge 62 means ages 62, 63, 64 should have irmaa=0
    const result = runProjection({ ...lowIncomeBase, retirementAge: 62, lifeExpectancy: 85 });
    const preMedicare = result.yearsData.filter(d => d.age < 65);
    for (const yr of preMedicare) {
      expect(yr.irmaa).toBe(0);
    }
  });

  // High income: SS $5,000/mo + pension $4,000/mo → MAGI ≈ $108,000 → bracket 1 → $82.80/mo
  const highIncomeBase = {
    ...BASE,
    ss1: 5000, ss2: 0, pension: 4000, pensionCOLA: false,
    retirementAge: 65, lifeExpectancy: 85,
    trad401k: 0, tradIRA: 0, roth401k: 0, rothIRA: 0, taxableBrokerage: 200000,
  };

  it('irmaa is positive when guaranteed income exceeds threshold', () => {
    const result = runProjection(highIncomeBase);
    const firstMedicareYear = result.yearsData.find(d => d.age >= 65);
    expect(firstMedicareYear.irmaa).toBeGreaterThan(0);
  });

  it('couple has shorter runway than single at same income (2× IRMAA cost)', () => {
    // Both spouses ≥ 65 when drawdown starts → medicareCount = 2
    const couple = runProjection({
      ...highIncomeBase,
      hasSpouse: true, spouseAge: 65, spouseRetirementAge: 65, spouseLifeExpectancy: 85,
      survivorFactor: 1.0,
    });
    const single = runProjection({ ...highIncomeBase, hasSpouse: false });
    // Couple pays more IRMAA → shorter (or equal) runway
    expect(couple.runwayYears).toBeLessThanOrEqual(single.runwayYears);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test tests/calc.test.js
```

Expected: FAIL — `yr.irmaa` is undefined (field not yet added to yearsData).

- [ ] **Step 3: Import and wire IRMAA into calc.js**

At the top of `src/utils/calc.js`, add import:

```js
import { getIrmaaSurcharge } from './irmaaTable.js';
```

Then in the drawdown loop, **before the `yearlyNeed` calculation**, add:

```js
// ── IRMAA: Medicare premium surcharge at age 65+ ─────────────────────────
// MAGI approximated from guaranteed income only (no portfolio withdrawals —
// including them would create a circular dependency with yearlyNeed).
// Documented simplifications (see spec):
//   1. Gross SS used instead of taxable SS portion (slightly conservative)
//   2. realOrdinary is NOT adjusted for survivor phase — pension/rental don't
//      necessarily halve after one spouse's death, so this is a reasonable
//      approximation. activeRealSS does correctly drop to ssMonthlyAlone*12.
const irmaaApplies = ageInYear >= 65;
const irmaaMAGI = irmaaApplies ? activeRealSS + realOrdinary : 0;
const irmaaSurchargePerPerson = irmaaApplies
  ? getIrmaaSurcharge(irmaaMAGI, activeMarried)
  : 0;

// medicareCount: both spouses on Medicare only while both alive and both ≥ 65.
// Derives from isSurvivor (same flag as activeMarried) — always consistent.
// In the drawdown loop y=0 corresponds to retirementAge (not currentAge), so the
// spouse's age at drawdown year y = spouseAge + (retirementAge - currentAge) + y.
const spouseAgeInYear = spouseAge + (retirementAge - currentAge) + y;
const spouseOnMedicare = !isSurvivor && hasSpouse && spouseAgeInYear >= 65;
const medicareCount = irmaaApplies ? (spouseOnMedicare ? 2 : 1) : 0;
const irmaaAnnual = irmaaSurchargePerPerson * medicareCount * 12;
```

Then, in the `yearlyNeed` calculation, add `irmaaAnnual`:

```js
const yearlyNeed =
  (activeBaseNonHousingNeed + effectiveHousingNeed + activeMonthlyPropertyTax) * 12 * generalFactor +
  activeBaseHealthcareNeed * 12 * healthcareFactor +
  yearlyLTC +
  irmaaAnnual;   // ← add this
```

Finally, in the `yearsData.push(...)` call, add the `irmaa` field alongside `rmd`:

```js
irmaa: Math.round(irmaaSurchargePerPerson),   // monthly per-person
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: all tests PASS (new IRMAA tests + all existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/calc.js tests/calc.test.js
git commit -m "feat: IRMAA surcharge in drawdown loop — adds to yearlyNeed at age 65+"
```

---

## Task 4: Display IRMAA metric box in ResultsStep

Add the IRMAA callout to the Tax & Cost Summary section in `ResultsStep.jsx`. It appears alongside the existing RMD callout — orange when surcharge is owed, green when below threshold.

**Files:**
- Modify: `src/steps/ResultsStep.jsx`

Context: ResultsStep uses `results` (the combined projection from PlannerContext). The existing RMD callout pattern to follow:

```jsx
{firstRmdYear && (
  <div className="metric-box metric-box--yellow">
    <div className="metric-box-label">RMD at 73</div>
    <div className="metric-box-value value--yellow">
      ${Math.round(firstRmdYear.rmd / 12).toLocaleString()}/mo
    </div>
    ...
  </div>
)}
```

- [ ] **Step 1: Locate the Tax & Cost Summary section in ResultsStep.jsx**

Read the file and find where the RMD callout is rendered. IRMAA goes immediately after it, in the same metric box grid.

- [ ] **Step 2: Add IRMAA lookup and metric box**

Before the return statement (or in the component body near the `firstRmdYear` derivation), add:

```js
// IRMAA: find first Medicare-eligible year with a surcharge
const medicareYears = results.yearsData.filter(
  d => d.age >= Math.max(inputs.retirementAge, 65)
);
const firstIrmaaYear = medicareYears.find(d => d.irmaa > 0);
```

Note: `inputs` may not exist as a named object in ResultsStep — use the individual context values instead. `retirementAge` is already destructured from `usePlanner()` in this file. The filter becomes:

```js
const medicareYears = results.yearsData.filter(
  d => d.age >= Math.max(retirementAge, 65)
);
const firstIrmaaYear = medicareYears.find(d => d.irmaa > 0);
```

Then, immediately after the RMD metric box JSX, add:

```jsx
{/* IRMAA surcharge */}
{firstIrmaaYear ? (
  <div className="metric-box metric-box--yellow">
    <div className="metric-box-label">Medicare IRMAA</div>
    <div className="metric-box-value value--yellow">
      +${firstIrmaaYear.irmaa.toLocaleString()}/mo per person
    </div>
    <div className="metric-box-note">
      Based on your guaranteed retirement income (SS, pension, other fixed sources).
      Actual surcharge may be higher if large traditional account withdrawals push
      your income up.
    </div>
    <div className="metric-box-note" style={{ marginTop: 4 }}>
      Roth conversions before 65 can reduce this — Roth withdrawals don't count
      toward the Medicare income limit.
    </div>
  </div>
) : (
  <div className="metric-box metric-box--green">
    <div className="metric-box-label">Medicare IRMAA</div>
    <div className="metric-box-value value--green">No surcharge</div>
    <div className="metric-box-note">
      Your projected income is below the Medicare IRMAA threshold.
    </div>
  </div>
)}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass. The ResultsStep renders pure JSX — no logic to test separately.

- [ ] **Step 4: Commit**

```bash
git add src/steps/ResultsStep.jsx
git commit -m "feat: IRMAA metric box in Tax & Cost Summary"
```

---

## Task 5: Final verification and PR

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass. Confirm the count increased (should be 51+ tests now: 40 existing + 7 irmaaTable + 4 calc IRMAA = 51).

- [ ] **Step 2: Check for TypeErrors in the browser**

Start the dev server and open the Results tab:

```bash
npm run dev
```

Verify:
- Housing toggle in SpendingStep now matches the page design (same pill style as other toggles)
- Tax & Cost Summary shows IRMAA metric box (orange with surcharge amount, or green "No surcharge")
- No console errors

- [ ] **Step 3: Open PR**

```bash
gh pr create \
  --title "feat: IRMAA Medicare surcharge modeling (#8)" \
  --body "$(cat <<'EOF'
## Summary
- Adds Medicare IRMAA surcharge lookup table (2024 CMS brackets, Part B + Part D combined)
- Calculates per-year surcharge in the drawdown loop from guaranteed income (SS + pension + part-time + rental) and adds it to annual expenses
- Displays IRMAA metric box in Tax & Cost Summary alongside the RMD callout — orange when surcharge applies, green when below threshold
- Includes Roth conversion nudge for users who owe surcharges
- Fixes housing toggle styling in SpendingStep (was using undefined CSS classes)

## Test plan
- [ ] All existing tests still pass
- [ ] `tests/irmaaTable.test.js` — 7 new unit tests covering bracket boundaries for single and married
- [ ] `tests/calc.test.js` — 4 new IRMAA integration tests
- [ ] Manual: open Results tab, verify IRMAA box renders correctly for high-income and low-income scenarios
- [ ] Manual: verify housing toggle looks correct in SpendingStep

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

