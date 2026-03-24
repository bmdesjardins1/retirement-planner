# Calculation Accuracy Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four projection calculation bugs and add a per-account-type tax system (Traditional/Roth/Taxable) with tax-efficient withdrawal ordering.

**Architecture:** Phase 1 fixes four bugs in `calc.js` with no new UI except a pension toggle. Phase 2 replaces the 3-field asset model with 5 typed account fields per person, tracks three portfolio buckets through the drawdown loop, and applies correct tax treatment per bucket. All pure functions are unit tested with Vitest; UI changes are verified via `vite build` and browser.

**Tech Stack:** React 18, Vite 5, Vitest (added in Task 1), pure JS utils (`calc.js`, `federalTax.js`)

**Spec:** `docs/superpowers/specs/2026-03-18-calculation-audit-design.md`

**⚠️ Phase 2 commit discipline:** Tasks 5–8 are interdependent. `federalTax.js`'s return type changes in Task 5 require matching changes in `calc.js`. Do NOT run build checks between Tasks 5–7 — only run the final build check at the end of Task 8, then commit everything together.

---

## File Structure

| File | Role |
|---|---|
| `src/utils/calc.js` | Core projection engine — all Phase 1 fixes + Phase 2 bucket tracking |
| `src/utils/federalTax.js` | Tax helpers — Phase 2 adds `estimateCapitalGainsTax`, changes return signature |
| `src/context/PlannerContext.jsx` | All app state — Fix 4 adds `pensionCOLA`; Phase 2 replaces 3 asset fields with 5 per person |
| `src/steps/IncomeStep.jsx` | Fix 4: pension COLA toggle |
| `src/steps/AssetsStep.jsx` | Phase 2: 5 account type inputs with show/hide toggles |
| `src/utils/calc.test.js` | NEW: unit tests for `runProjection` |
| `src/utils/federalTax.test.js` | NEW: unit tests for tax helpers |
| `vitest.config.js` | NEW: Vitest configuration |

---

## Task 1: Set Up Vitest

**Files:**
- Create: `vitest.config.js`
- Modify: `package.json`
- Create: `src/utils/calc.test.js`
- Create: `src/utils/federalTax.test.js`

No test framework exists yet. Vitest is the natural choice — built for Vite, fast, no Babel required.

- [ ] **Step 1: Install Vitest**

```bash
cd C:/Users/code/retirement-planner
npm install --save-dev vitest
```

- [ ] **Step 2: Create `vitest.config.js`**

```js
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 3: Add test scripts to `package.json`**

In the `"scripts"` section, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create placeholder test files**

```js
// src/utils/federalTax.test.js
import { describe, it, expect } from 'vitest';
import { estimateFederalTax } from './federalTax';

describe('estimateFederalTax', () => {
  it('returns a number', () => {
    const result = estimateFederalTax({
      ssAnnual: 24000, ordinaryIncome: 0, withdrawalEstimate: 0,
      married: false, age: 70,
    });
    expect(typeof result).toBe('number');
  });
});
```

```js
// src/utils/calc.test.js
import { describe, it, expect } from 'vitest';
import { runProjection } from './calc';

// Shared base inputs — pensionCOLA included now; ignored by calc.js until Task 4 wires it in
const BASE = {
  age: 50, retirementAge: 65, lifeExpectancy: 85,
  hasSpouse: false, spouseAge: 0, spouseRetirementAge: 65, spouseLifeExpectancy: 85,
  ss1: 2000, ss2: 0,
  pension: 0, pensionCOLA: false,
  partTimeIncome: 0, partTimeEndAge: 70, rentalIncome: 0,
  annualContrib401k: 10000, employerMatch: 5000,
  annualContribIRA: 3000, annualContribOther: 0,
  spouseAnnualContrib401k: 0, spouseEmployerMatch: 0,
  spouseAnnualContribIRA: 0, spouseAnnualContribOther: 0,
  savings401k: 300000, iraBalance: 75000, taxableInvestments: 50000,
  homeValue: 300000, homeOwned: true,
  investmentReturn: 5, inflation: 3, healthcareInflation: 5.5,
  housing: 1500, food: 700, healthcare: 800, transport: 400, leisure: 500, other: 300,
  longTermCare: 0, ltcStartAge: 80,
  stateInfo: { incomeTax: 0.0, hasSSIncomeTax: false, avgPropertyTaxRate: 0.009, costOfLivingIndex: 100 },
  survivorFactor: 1.0,
};

describe('runProjection', () => {
  it('returns expected shape', () => {
    const result = runProjection(BASE);
    expect(result).toHaveProperty('runwayYears');
    expect(result).toHaveProperty('yearsData');
    expect(result.yearsData.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5: Run tests and confirm both pass**

```bash
npm test
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.js package.json src/utils/calc.test.js src/utils/federalTax.test.js
git commit -m "chore: add Vitest test framework"
```

---

## Task 2: Fix 1 — Healthcare survivorFactor

**Files:**
- Modify: `src/utils/calc.js`
- Modify: `src/utils/calc.test.js`

**The bug:** `baseHealthcareNeed` is multiplied by `survivorFactor` (0.6 in solo projections), cutting a surviving spouse's healthcare costs by 40%. Healthcare is a per-person expense.

- [ ] **Step 1: Write the failing tests**

Add to `src/utils/calc.test.js` after the existing describe block:

```js
describe('Fix 1: healthcare survivorFactor', () => {
  it('healthcare cost is not scaled by survivorFactor', () => {
    // Zero non-healthcare spending except leisure ($500) so both components are non-zero
    const inputs = { ...BASE, housing: 0, food: 0, transport: 0, leisure: 500, other: 0, healthcare: 800 };
    const combined = runProjection({ ...inputs, survivorFactor: 1.0 });
    const solo     = runProjection({ ...inputs, survivorFactor: 0.6 });
    // With the fix: adjustedExpenses differs only by the leisure component, not healthcare
    // combined: (500*1.0 + 800) * col = 1300 * col
    // solo:     (500*0.6 + 800) * col = 1100 * col  → difference = 200 * col
    const diff = combined.adjustedExpenses - solo.adjustedExpenses;
    expect(diff).toBeCloseTo(500 * 0.4, -1);  // only leisure scales, not healthcare
  });

  it('non-healthcare expenses are still scaled by survivorFactor', () => {
    const inputs = { ...BASE, healthcare: 0, housing: 1000, food: 500, transport: 200, leisure: 0, other: 0 };
    const combined = runProjection({ ...inputs, survivorFactor: 1.0 });
    const solo     = runProjection({ ...inputs, survivorFactor: 0.6 });
    expect(solo.adjustedExpenses).toBeCloseTo(combined.adjustedExpenses * 0.6, -1);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: the two new tests fail.

- [ ] **Step 3: Apply Fix 1 in `calc.js`**

In `src/utils/calc.js`, find exactly these two lines (currently lines 58-59):

```js
const baseNonHealthcareNeed = (housing + food + transport + leisure + other) * col * survivorFactor;
const baseHealthcareNeed    = healthcare * col * survivorFactor;
```

Replace with (only line 59 changes — remove `* survivorFactor` from healthcare only):

```js
const baseNonHealthcareNeed = (housing + food + transport + leisure + other) * col * survivorFactor;
const baseHealthcareNeed    = healthcare * col;
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all 4 tests pass.

- [ ] **Step 5: Build check**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/utils/calc.js src/utils/calc.test.js
git commit -m "fix: healthcare cost not scaled by survivorFactor in solo projections"
```

---

## Task 3: Fix 2+3 — Federal Bracket Inflation + Two-Iteration Gross-Up

**Files:**
- Modify: `src/utils/calc.js` (drawdown loop federal tax block)
- Modify: `src/utils/calc.test.js`

**The bugs:**
1. Federal tax brackets are hardcoded 2024 values — overstates taxes over a 30-year projection as nominal income grows but thresholds don't.
2. Tax is estimated on the net gap then added on top — but the tax itself needs a further withdrawal (circular dependency, slightly underestimates gross withdrawal).

**⚠️ Note on variable naming:** This task uses `currentNonSS` (existing variable in the drawdown loop). Task 4 will restructure the pre-loop income computation and rename `currentNonSS`. After Task 4, this task's code is updated — Task 4 includes an explicit step for this.

- [ ] **Step 1: Write the failing tests**

Add to `src/utils/calc.test.js`:

```js
describe('Fix 2+3: federal bracket inflation + gross-up', () => {
  it('high inflation does not collapse runway due to bracket creep', () => {
    // Before fix: 6% inflation inflates nominal income ~5x over 30 years; brackets stay fixed → heavy taxation
    // After fix: real-term income stays flat → tax burden is proportional
    const highInflation = runProjection({ ...BASE, inflation: 6, investmentReturn: 8 });
    const lowInflation  = runProjection({ ...BASE, inflation: 1, investmentReturn: 4 });
    expect(highInflation.runwayYears).toBeGreaterThan(5);
    expect(lowInflation.runwayYears).toBeGreaterThan(5);
    // Neither should be dramatically shorter — inflation fix keeps real purchasing power comparable
    expect(highInflation.runwayYears / lowInflation.runwayYears).toBeGreaterThan(0.6);
  });

  it('withdrawal is at least as large as the spending gap', () => {
    const result = runProjection({ ...BASE, ss1: 1000 });
    const drawdownYears = result.yearsData.filter(y => y.withdrawal > 0);
    drawdownYears.forEach(y => {
      expect(y.withdrawal).toBeGreaterThanOrEqual(Math.max(y.expenses - y.income, 0) - 1);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail or are marginal**

```bash
npm test
```

- [ ] **Step 3: Apply Fix 2+3 in `calc.js` drawdown loop**

In the drawdown loop, find the federal tax block (currently lines ~155-166). It looks like this:

```js
const currentNonSS = ptEnded ? nonSSWithoutPT : nonSSWithPT;
const federalTax = estimateFederalTax({
  ssAnnual: ssMonthly * 12 * generalFactor,
  ordinaryIncome: currentNonSS * 12 * generalFactor,
  withdrawalEstimate: preTaxGap,
  married: hasSpouse,
  age: ageInYear,
});
const yearlyWithdrawal = preTaxGap + federalTax;
```

Replace with:

```js
const currentNonSS = ptEnded ? nonSSWithoutPT : nonSSWithPT;

// Work in real (year-0 dollar) terms — equivalent to inflating brackets each year.
// SS provisional income thresholds ($32K/$44K married; $25K/$34K single) inside
// estimateFederalTax are intentionally left as frozen nominal values (unchanged since 1984).
const realSS       = ssMonthly * 12;
const realOrdinary = currentNonSS * 12;  // ← updated in Task 4 when pension is split out
const realGap      = preTaxGap / generalFactor;

// Iteration 1: tax on net gap
const realTax1 = estimateFederalTax({
  ssAnnual: realSS, ordinaryIncome: realOrdinary,
  withdrawalEstimate: realGap,
  married: hasSpouse, age: ageInYear,
});

// Iteration 2: gross up — gap + iter-1 tax
const realTax2 = estimateFederalTax({
  ssAnnual: realSS, ordinaryIncome: realOrdinary,
  withdrawalEstimate: realGap + realTax1,
  married: hasSpouse, age: ageInYear,
});

const federalTax     = realTax2 * generalFactor;
const yearlyWithdrawal = preTaxGap + federalTax;
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all 6 tests pass.

- [ ] **Step 5: Build check**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/utils/calc.js src/utils/calc.test.js
git commit -m "fix: federal tax uses real-term brackets and two-iteration gross-up"
```

---

## Task 4: Fix 4 — Pension COLA Toggle

**Files:**
- Modify: `src/utils/calc.js` (pre-loop income computation + drawdown loop)
- Modify: `src/context/PlannerContext.jsx`
- Modify: `src/steps/IncomeStep.jsx`
- Modify: `src/utils/calc.test.js`

**The bug:** Pension income is multiplied by `generalFactor` every year. Most pensions are fixed. Over 25 years at 3% inflation this makes a pension appear ~2x more valuable than it is.

**Implementation detail:** Currently `netIncomeWithPT` / `netIncomeWithoutPT` are pre-loop scalars that include pension. The loop multiplies the whole scalar by `generalFactor`. Pension must be extracted and handled separately in the loop.

- [ ] **Step 1: Write the failing tests**

Add to `src/utils/calc.test.js`:

```js
describe('Fix 4: pension COLA', () => {
  it('COLA pension yields longer runway than fixed pension', () => {
    const inputs = { ...BASE, pension: 1500, ss1: 500 };
    const withCOLA    = runProjection({ ...inputs, pensionCOLA: true });
    const fixedPension = runProjection({ ...inputs, pensionCOLA: false });
    expect(withCOLA.runwayYears).toBeGreaterThanOrEqual(fixedPension.runwayYears);
  });

  it('pensionCOLA has no effect when pension is zero', () => {
    const withCOLA = runProjection({ ...BASE, pension: 0, pensionCOLA: true });
    const noCOLA   = runProjection({ ...BASE, pension: 0, pensionCOLA: false });
    expect(withCOLA.runwayYears).toBe(noCOLA.runwayYears);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: "COLA pension" test fails — currently pension always inflates.

- [ ] **Step 3: Add `pensionCOLA` state to `PlannerContext.jsx`**

Find the pension state line:
```js
const [pension, setPension] = useState(0);
```

Add immediately after:
```js
const [pensionCOLA, setPensionCOLA] = useState(false);
```

Add `pensionCOLA` to `sharedInputs` (so all three `runProjection` calls receive it automatically via `...sharedInputs`):

```js
const sharedInputs = {
  pension, partTimeIncome, partTimeEndAge, rentalIncome,
  pensionCOLA,   // ← add this line
  homeValue, homeOwned, ...rest
};
```

Expose in the context value object:
```js
pension, setPension,
pensionCOLA, setPensionCOLA,   // ← add this line
```

- [ ] **Step 4: Add pension COLA toggle to `IncomeStep.jsx`**

Destructure from `usePlanner()`:
```js
pension, setPension,
pensionCOLA, setPensionCOLA,   // add
```

Add the toggle immediately after the pension `<SliderInput>` line (inside the "Other Income" Card):

```jsx
{pension > 0 && (
  <div className="mb-20">
    <label className="field-label">Does this pension increase with inflation each year?</label>
    <p className="field-note">Most pensions pay a fixed dollar amount for life. Some government pensions include annual cost-of-living increases.</p>
    <div className="toggle-group">
      <button className={`toggle${pensionCOLA ? ' toggle--active' : ''}`} onClick={() => setPensionCOLA(true)}>Yes</button>
      <button className={`toggle${!pensionCOLA ? ' toggle--active' : ''}`} onClick={() => setPensionCOLA(false)}>No (fixed)</button>
    </div>
  </div>
)}
```

- [ ] **Step 5: Destructure `pensionCOLA` from inputs at top of `runProjection` in `calc.js`**

In the destructuring block at the top of `runProjection`, add:
```js
pensionCOLA = false,
```

alongside the existing `pension` line.

- [ ] **Step 6: Replace the pre-loop income block in `calc.js`**

Find the pre-loop block that currently reads:

```js
// Net income with part-time work (used until partTimeEndAge)
const grossWithPT = ssMonthly + pension + partTimeIncome + rentalIncome;
const taxWithPT = (pension + partTimeIncome + rentalIncome + ssTaxableMonthly) * stateInfo.incomeTax;
const netIncomeWithPT = grossWithPT - taxWithPT;

// Net income after part-time work ends
const grossWithoutPT = ssMonthly + pension + rentalIncome;
const taxWithoutPT = (pension + rentalIncome + ssTaxableMonthly) * stateInfo.incomeTax;
const netIncomeWithoutPT = grossWithoutPT - taxWithoutPT;

// Non-SS ordinary income (pension + part-time + rental) — used for federal tax calc
const nonSSWithPT = pension + partTimeIncome + rentalIncome;
const nonSSWithoutPT = pension + rentalIncome;

// For summary cards — show current (with PT if applicable)
const netMonthlyIncome = netIncomeWithPT;
const stateTaxMonthly = taxWithPT;
```

Replace entirely with:

```js
// Pension extracted so it can inflate independently (pensionCOLA toggle).
const pensionStateTax   = pension * stateInfo.incomeTax;
const pensionNetMonthly = pension - pensionStateTax;

// Non-pension income (SS + part-time + rental) — always inflates with generalFactor
const nonPensionGrossWithPT    = ssMonthly + partTimeIncome + rentalIncome;
const nonPensionTaxWithPT      = (partTimeIncome + rentalIncome + ssTaxableMonthly) * stateInfo.incomeTax;
const nonPensionNetWithPT      = nonPensionGrossWithPT - nonPensionTaxWithPT;

const nonPensionGrossWithoutPT = ssMonthly + rentalIncome;
const nonPensionTaxWithoutPT   = (rentalIncome + ssTaxableMonthly) * stateInfo.incomeTax;
const nonPensionNetWithoutPT   = nonPensionGrossWithoutPT - nonPensionTaxWithoutPT;

// Non-SS ordinary income — used for federal tax in real terms.
// Pension is always its year-0 value in real terms (whether or not it has COLA).
const nonSSWithPT    = pension + partTimeIncome + rentalIncome;
const nonSSWithoutPT = pension + rentalIncome;

// For summary cards (year-0, with part-time)
const netMonthlyIncome = nonPensionNetWithPT + pensionNetMonthly;
const stateTaxMonthly  = nonPensionTaxWithPT + pensionStateTax;
```

- [ ] **Step 7: Update the drawdown loop's `yearlyIncome` calculation**

In the drawdown loop, find:

```js
const currentNetIncome = ptEnded ? netIncomeWithoutPT : netIncomeWithPT;
const yearlyIncome = currentNetIncome * 12 * generalFactor;
```

Replace with:

```js
const baseNonPensionNet = ptEnded ? nonPensionNetWithoutPT : nonPensionNetWithPT;
const pensionContrib = pensionCOLA
  ? pensionNetMonthly * 12 * generalFactor   // COLA: inflates
  : pensionNetMonthly * 12;                  // Fixed: stays flat in nominal dollars
const yearlyIncome = (baseNonPensionNet * 12 * generalFactor) + pensionContrib;
```

- [ ] **Step 8: Update `realOrdinary` from Task 3**

In the drawdown loop, find the line written in Task 3:

```js
const realOrdinary = currentNonSS * 12;  // ← updated in Task 4 when pension is split out
```

The variable `currentNonSS` still exists (`const currentNonSS = ptEnded ? nonSSWithoutPT : nonSSWithPT;`). `nonSSWithPT` and `nonSSWithoutPT` now use the new variable names from Step 6 above (their values are unchanged — pension is still included in year-0 real terms). This line can remain as-is since `currentNonSS` is still defined. Remove only the inline comment:

```js
const realOrdinary = currentNonSS * 12;
```

- [ ] **Step 9: Run tests**

```bash
npm test
```

Expected: all 8 tests pass.

- [ ] **Step 10: Build check**

```bash
npm run build
```

- [ ] **Step 11: Verify in browser**

`npm run dev`. Go to Income step, set pension > 0, confirm COLA toggle appears. Toggle it and confirm the results page shows different runway values. Set pension to 0, confirm toggle disappears.

- [ ] **Step 12: Commit**

```bash
git add src/utils/calc.js src/utils/calc.test.js src/context/PlannerContext.jsx src/steps/IncomeStep.jsx
git commit -m "feat: pension COLA toggle — fixed vs inflation-adjusted pension income"
```

---

## Task 5: Phase 2 — Update `federalTax.js`

**Files:**
- Modify: `src/utils/federalTax.js`
- Modify: `src/utils/federalTax.test.js`
- Modify: `src/utils/calc.js` (update all call sites immediately — see step 6)

**⚠️ Do not commit after this task.** Tasks 5–8 are committed together at the end of Task 8. `calc.js` will remain partially updated until Task 8 rewrites the drawdown loop entirely.

Two changes: (1) `estimateFederalTax` returns `{ tax, taxableSS }` instead of a plain number. (2) New `estimateCapitalGainsTax` function.

**Why update call sites in this task:** After step 5 changes the return type, `calc.js` will have broken call sites (`realTax1 * X` will produce NaN since `realTax1` is now an object). Fix all call sites immediately in step 6 so the codebase stays buildable. Task 8 will replace the loop calls entirely.

- [ ] **Step 1: Update `federalTax.test.js` to expect the new return shape**

Replace all content of `src/utils/federalTax.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { estimateFederalTax, estimateCapitalGainsTax } from './federalTax';

describe('estimateFederalTax', () => {
  it('returns { tax, taxableSS } shape', () => {
    const result = estimateFederalTax({
      ssAnnual: 24000, ordinaryIncome: 0, withdrawalEstimate: 0,
      married: false, age: 70,
    });
    expect(result).toHaveProperty('tax');
    expect(result).toHaveProperty('taxableSS');
    expect(typeof result.tax).toBe('number');
    expect(typeof result.taxableSS).toBe('number');
  });

  it('SS not taxable when combined income is below lower threshold ($25K single)', () => {
    // combined income = 0 + 0 + 12000/2 = 6000 < 25000
    const { taxableSS } = estimateFederalTax({
      ssAnnual: 12000, ordinaryIncome: 0, withdrawalEstimate: 0,
      married: false, age: 70,
    });
    expect(taxableSS).toBe(0);
  });

  it('up to 85% of SS is taxable above upper threshold ($34K single)', () => {
    // combined income = 40000 + 0 + 30000/2 = 55000 > 34000
    const { taxableSS } = estimateFederalTax({
      ssAnnual: 30000, ordinaryIncome: 40000, withdrawalEstimate: 0,
      married: false, age: 70,
    });
    expect(taxableSS).toBeLessThanOrEqual(Math.round(30000 * 0.85));
    expect(taxableSS).toBeGreaterThan(0);
  });

  it('applies senior standard deduction bonus at age 65+', () => {
    const { tax: under65 } = estimateFederalTax({
      ssAnnual: 0, ordinaryIncome: 30000, withdrawalEstimate: 0,
      married: false, age: 64,
    });
    const { tax: over65 } = estimateFederalTax({
      ssAnnual: 0, ordinaryIncome: 30000, withdrawalEstimate: 0,
      married: false, age: 65,
    });
    expect(over65).toBeLessThan(under65);
  });

  it('tax is zero for income below standard deduction', () => {
    const { tax } = estimateFederalTax({
      ssAnnual: 0, ordinaryIncome: 10000, withdrawalEstimate: 0,
      married: false, age: 65,
    });
    expect(tax).toBe(0);
  });
});

describe('estimateCapitalGainsTax', () => {
  it('0% rate when total income is below single threshold ($47,025)', () => {
    // 20000 + 10000 = 30000 < 47025
    const tax = estimateCapitalGainsTax({
      taxableGains: 10000, totalOrdinaryIncome: 20000, married: false,
    });
    expect(tax).toBe(0);
  });

  it('15% rate when ordinary income already exceeds 0% threshold', () => {
    // ordinary = 50000 > 47025 → all $10K gains in 15% bracket
    const tax = estimateCapitalGainsTax({
      taxableGains: 10000, totalOrdinaryIncome: 50000, married: false,
    });
    expect(tax).toBe(Math.round(10000 * 0.15));
  });

  it('married threshold is higher than single', () => {
    // At the same income, married filer should owe less or equal capital gains tax
    const single  = estimateCapitalGainsTax({ taxableGains: 50000, totalOrdinaryIncome: 60000, married: false });
    const married = estimateCapitalGainsTax({ taxableGains: 50000, totalOrdinaryIncome: 60000, married: true });
    expect(married).toBeLessThanOrEqual(single);
  });

  it('returns 0 for zero gains', () => {
    const tax = estimateCapitalGainsTax({ taxableGains: 0, totalOrdinaryIncome: 100000, married: false });
    expect(tax).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: `estimateFederalTax` shape tests fail (returns a number). `estimateCapitalGainsTax` tests fail (not exported).

- [ ] **Step 3: Change `estimateFederalTax` return value in `federalTax.js`**

Find the final return statement (currently the last line of `estimateFederalTax`):

```js
return Math.round(applyBrackets(taxableIncome, brackets));
```

Replace with:

```js
return {
  tax: Math.round(applyBrackets(taxableIncome, brackets)),
  taxableSS: Math.round(taxableSS),
};
```

Note: `taxableSS` is already computed earlier in the function — just add it to the return object.

- [ ] **Step 4: Add `estimateCapitalGainsTax` to `federalTax.js`**

Add after the closing brace of `estimateFederalTax`:

```js
/**
 * Estimates long-term capital gains tax.
 * All inputs must be in real (year-0) dollar terms. Caller scales result back to nominal.
 *
 * taxableGains        — the gains portion of a taxable brokerage withdrawal (real terms)
 * totalOrdinaryIncome — all ordinary income stacked below gains: pension + rental + PT +
 *                       Traditional account withdrawals (gross) + taxable SS (real terms)
 * married             — true if filing jointly
 *
 * Gains are stacked on top of ordinary income to find the applicable bracket.
 */
export function estimateCapitalGainsTax({ taxableGains, totalOrdinaryIncome, married }) {
  if (taxableGains <= 0) return 0;

  // 2024 long-term capital gains bracket thresholds (lower bound of each rate)
  const thresholds = married ? [94050, 583750] : [47025, 518900];
  const rates      = [0.00, 0.15, 0.20];

  const totalIncome = totalOrdinaryIncome + taxableGains;
  let tax = 0;

  for (let i = 0; i < rates.length; i++) {
    const bandBottom = i === 0 ? 0 : thresholds[i - 1];
    const bandTop    = i < thresholds.length ? thresholds[i] : Infinity;

    if (totalIncome <= bandBottom) break;

    // Gains portion that falls in this band = overlap of [ordinaryIncome, totalIncome] with [bandBottom, bandTop]
    const gainsStart  = Math.max(totalOrdinaryIncome, bandBottom);
    const gainsEnd    = Math.min(totalIncome, bandTop);
    const gainsInBand = Math.max(gainsEnd - gainsStart, 0);

    tax += gainsInBand * rates[i];
  }

  return Math.round(tax);
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all `federalTax.test.js` tests pass. `calc.test.js` tests will now fail because `calc.js` uses the result of `estimateFederalTax` as a plain number (`realTax1 * generalFactor` etc. now produces NaN). Fix this in the next step.

- [ ] **Step 6: Update ALL `estimateFederalTax` call sites in `calc.js` to destructure `{ tax }`**

There are two call sites in `calc.js` to fix:

**Call site 1 — The two-iteration loop block (written in Task 3):**

Find:
```js
const realTax1 = estimateFederalTax({
  ssAnnual: realSS, ordinaryIncome: realOrdinary,
  withdrawalEstimate: realGap,
  married: hasSpouse, age: ageInYear,
});
const realTax2 = estimateFederalTax({
  ssAnnual: realSS, ordinaryIncome: realOrdinary,
  withdrawalEstimate: realGap + realTax1,
  married: hasSpouse, age: ageInYear,
});
const federalTax     = realTax2 * generalFactor;
```

Replace with:

```js
const { tax: realTax1 } = estimateFederalTax({
  ssAnnual: realSS, ordinaryIncome: realOrdinary,
  withdrawalEstimate: realGap,
  married: hasSpouse, age: ageInYear,
});
const { tax: realTax2 } = estimateFederalTax({
  ssAnnual: realSS, ordinaryIncome: realOrdinary,
  withdrawalEstimate: realGap + realTax1,
  married: hasSpouse, age: ageInYear,
});
const federalTax = realTax2 * generalFactor;
```

**Call site 2 — The year-0 summary card (`federalTaxMonthly`) near the bottom of `runProjection`:**

Find:
```js
const federalTaxMonthly = Math.round(estimateFederalTax({
  ssAnnual: ssMonthly * 12,
  ordinaryIncome: nonSSWithPT * 12,
  withdrawalEstimate: Math.max(monthlyGap, 0) * 12,
  married: hasSpouse,
  age: retirementAge,
}) / 12);
```

Replace with:

```js
const { tax: federalTaxAnnual } = estimateFederalTax({
  ssAnnual: ssMonthly * 12,
  ordinaryIncome: nonSSWithPT * 12,
  withdrawalEstimate: Math.max(monthlyGap, 0) * 12,
  married: hasSpouse,
  age: retirementAge,
});
const federalTaxMonthly = Math.round(federalTaxAnnual / 12);
```

- [ ] **Step 7: Also add `estimateCapitalGainsTax` to the import at the top of `calc.js`**

Find:
```js
import { estimateFederalTax } from "./federalTax";
```

Replace with:
```js
import { estimateFederalTax, estimateCapitalGainsTax } from "./federalTax";
```

- [ ] **Step 8: Run tests**

```bash
npm test
```

Expected: all tests pass.

**Do not commit. Proceed to Task 6.**

---

## Task 6: Phase 2 — Update PlannerContext

**Files:**
- Modify: `src/context/PlannerContext.jsx`

**⚠️ After this task, `AssetsStep.jsx` will have stale destructure names (`savings401k` etc.) pointing to undefined context values. This is expected — Task 7 fixes it. Do not run a build check until after Task 8.**

- [ ] **Step 1: Replace primary asset state**

Find the "Primary assets" block:
```js
// Primary assets
const [savings401k, setSavings401k]               = useState(270000);
const [iraBalance, setIraBalance]                 = useState(75000);
const [taxableInvestments, setTaxableInvestments] = useState(50000);
```

Replace with:
```js
// Primary assets — 5 typed account fields
const [trad401k, setTrad401k]                     = useState(270000);
const [roth401k, setRoth401k]                     = useState(0);
const [tradIRA, setTradIRA]                       = useState(75000);
const [rothIRA, setRothIRA]                       = useState(0);
const [taxableBrokerage, setTaxableBrokerage]     = useState(50000);

// Primary account visibility toggles
const [hasTrad401k, setHasTrad401k]               = useState(true);
const [hasRoth401k, setHasRoth401k]               = useState(false);
const [hasTradIRA, setHasTradIRA]                 = useState(true);
const [hasRothIRA, setHasRothIRA]                 = useState(false);
const [hasTaxableBrokerage, setHasTaxableBrokerage] = useState(true);
```

- [ ] **Step 2: Replace spouse asset state**

Find the "Spouse assets" block:
```js
// Spouse assets
const [spouseSavings401k, setSpouseSavings401k]               = useState(180000);
const [spouseIraBalance, setSpouseIraBalance]                 = useState(45000);
const [spouseTaxableInvestments, setSpouseTaxableInvestments] = useState(30000);
```

Replace with:
```js
// Spouse assets — 5 typed account fields
const [spouseTrad401k, setSpouseTrad401k]                     = useState(180000);
const [spouseRoth401k, setSpouseRoth401k]                     = useState(0);
const [spouseTradIRA, setSpouseTradIRA]                       = useState(45000);
const [spouseRothIRA, setSpouseRothIRA]                       = useState(0);
const [spouseTaxableBrokerage, setSpouseTaxableBrokerage]     = useState(30000);

// Spouse account visibility toggles
const [spouseHasTrad401k, setSpouseHasTrad401k]               = useState(true);
const [spouseHasRoth401k, setSpouseHasRoth401k]               = useState(false);
const [spouseHasTradIRA, setSpouseHasTradIRA]                 = useState(true);
const [spouseHasRothIRA, setSpouseHasRothIRA]                 = useState(false);
const [spouseHasTaxableBrokerage, setSpouseHasTaxableBrokerage] = useState(true);
```

- [ ] **Step 3: Update the combined projection `useMemo` call**

In the combined `results` useMemo, replace:
```js
savings401k: savings401k + (hasSpouse ? spouseSavings401k : 0),
iraBalance: iraBalance + (hasSpouse ? spouseIraBalance : 0),
taxableInvestments: taxableInvestments + (hasSpouse ? spouseTaxableInvestments : 0),
```

With:
```js
trad401k: trad401k + (hasSpouse ? spouseTrad401k : 0),
roth401k: roth401k + (hasSpouse ? spouseRoth401k : 0),
tradIRA: tradIRA + (hasSpouse ? spouseTradIRA : 0),
rothIRA: rothIRA + (hasSpouse ? spouseRothIRA : 0),
taxableBrokerage: taxableBrokerage + (hasSpouse ? spouseTaxableBrokerage : 0),
```

Update the dependency array to use the new field names.

- [ ] **Step 4: Update primary solo projection call**

Replace:
```js
savings401k, iraBalance, taxableInvestments,
```

With:
```js
trad401k, roth401k, tradIRA, rothIRA, taxableBrokerage,
```

Update the dependency array.

- [ ] **Step 5: Update spouse solo projection call**

Replace:
```js
savings401k: spouseSavings401k, iraBalance: spouseIraBalance, taxableInvestments: spouseTaxableInvestments,
```

With:
```js
trad401k: spouseTrad401k, roth401k: spouseRoth401k,
tradIRA: spouseTradIRA, rothIRA: spouseRothIRA,
taxableBrokerage: spouseTaxableBrokerage,
```

- [ ] **Step 6: Update context value — replace old fields with new**

In the `<PlannerContext.Provider value={{...}}>` block, remove old asset fields and add new ones:

```js
// Primary assets (replace old savings401k, iraBalance, taxableInvestments entries)
trad401k, setTrad401k,
roth401k, setRoth401k,
tradIRA, setTradIRA,
rothIRA, setRothIRA,
taxableBrokerage, setTaxableBrokerage,
hasTrad401k, setHasTrad401k,
hasRoth401k, setHasRoth401k,
hasTradIRA, setHasTradIRA,
hasRothIRA, setHasRothIRA,
hasTaxableBrokerage, setHasTaxableBrokerage,
// Spouse assets (replace old spouseSavings401k etc. entries)
spouseTrad401k, setSpouseTrad401k,
spouseRoth401k, setSpouseRoth401k,
spouseTradIRA, setSpouseTradIRA,
spouseRothIRA, setSpouseRothIRA,
spouseTaxableBrokerage, setSpouseTaxableBrokerage,
spouseHasTrad401k, setSpouseHasTrad401k,
spouseHasRoth401k, setSpouseHasRoth401k,
spouseHasTradIRA, setSpouseHasTradIRA,
spouseHasRothIRA, setSpouseHasRothIRA,
spouseHasTaxableBrokerage, setSpouseHasTaxableBrokerage,
```

**Do not commit. Proceed to Task 7.**

---

## Task 7: Phase 2 — Update AssetsStep UI

**Files:**
- Modify: `src/steps/AssetsStep.jsx`

**⚠️ No build check until Task 8 is complete.**

- [ ] **Step 1: Replace the destructure in `AssetsStep.jsx`**

Replace the entire `usePlanner()` destructure with:

```js
const {
  trad401k, setTrad401k,
  roth401k, setRoth401k,
  tradIRA, setTradIRA,
  rothIRA, setRothIRA,
  taxableBrokerage, setTaxableBrokerage,
  hasTrad401k, setHasTrad401k,
  hasRoth401k, setHasRoth401k,
  hasTradIRA, setHasTradIRA,
  hasRothIRA, setHasRothIRA,
  hasTaxableBrokerage, setHasTaxableBrokerage,
  spouseTrad401k, setSpouseTrad401k,
  spouseRoth401k, setSpouseRoth401k,
  spouseTradIRA, setSpouseTradIRA,
  spouseRothIRA, setSpouseRothIRA,
  spouseTaxableBrokerage, setSpouseTaxableBrokerage,
  spouseHasTrad401k, setSpouseHasTrad401k,
  spouseHasRoth401k, setSpouseHasRoth401k,
  spouseHasTradIRA, setSpouseHasTradIRA,
  spouseHasRothIRA, setSpouseHasRothIRA,
  spouseHasTaxableBrokerage, setSpouseHasTaxableBrokerage,
  annualContrib401k, setAnnualContrib401k,
  employerMatch, setEmployerMatch,
  annualContribIRA, setAnnualContribIRA,
  annualContribOther, setAnnualContribOther,
  spouseAnnualContrib401k, setSpouseAnnualContrib401k,
  spouseEmployerMatch, setSpouseEmployerMatch,
  spouseAnnualContribIRA, setSpouseAnnualContribIRA,
  spouseAnnualContribOther, setSpouseAnnualContribOther,
  homeValue, setHomeValue,
  homeOwned, setHomeOwned,
  investmentReturn, setInvestmentReturn,
  inflation, setInflation,
  healthcareInflation, setHealthcareInflation,
  retirementAge, spouseRetirementAge,
  hasSpouse,
  stateInfo, state, results, primaryResults, spouseResults,
} = usePlanner();
```

- [ ] **Step 2: Replace the "Your Retirement Accounts" Card content**

Replace the primary accounts Card (keep the contribution sliders below it unchanged). Use this account-toggle pattern for all 5 account types:

```jsx
<Card>
  <h3 className="card-heading card-heading--green">Your Retirement Accounts</h3>

  {/* Traditional 401(k) */}
  <div className="mb-20">
    <label className="field-label">Traditional 401(k) / 403(b)</label>
    <p className="field-note">Pre-tax retirement account through your employer. Withdrawals are taxed as regular income.</p>
    <div className="toggle-group">
      <button className={`toggle${hasTrad401k ? ' toggle--active' : ''}`} onClick={() => setHasTrad401k(true)}>I have this</button>
      <button className={`toggle${!hasTrad401k ? ' toggle--active' : ''}`} onClick={() => setHasTrad401k(false)}>I don't</button>
    </div>
    {hasTrad401k && <SliderInput label="Current Balance" value={trad401k} min={0} max={2000000} step={10000} onChange={setTrad401k} prefix="$" />}
  </div>

  {/* Roth 401(k) */}
  <div className="mb-20">
    <label className="field-label">Roth 401(k) / 403(b)</label>
    <p className="field-note">After-tax employer retirement account. Withdrawals are completely tax-free.</p>
    <div className="toggle-group">
      <button className={`toggle${hasRoth401k ? ' toggle--active' : ''}`} onClick={() => setHasRoth401k(true)}>I have this</button>
      <button className={`toggle${!hasRoth401k ? ' toggle--active' : ''}`} onClick={() => setHasRoth401k(false)}>I don't</button>
    </div>
    {hasRoth401k && <SliderInput label="Current Balance" value={roth401k} min={0} max={2000000} step={10000} onChange={setRoth401k} prefix="$" />}
  </div>

  {/* Traditional IRA */}
  <div className="mb-20">
    <label className="field-label">Traditional IRA</label>
    <p className="field-note">Pre-tax individual retirement account — a tax-advantaged savings account you open yourself, not through an employer. Withdrawals are taxed as regular income.</p>
    <div className="toggle-group">
      <button className={`toggle${hasTradIRA ? ' toggle--active' : ''}`} onClick={() => setHasTradIRA(true)}>I have this</button>
      <button className={`toggle${!hasTradIRA ? ' toggle--active' : ''}`} onClick={() => setHasTradIRA(false)}>I don't</button>
    </div>
    {hasTradIRA && <SliderInput label="Current Balance" value={tradIRA} min={0} max={1000000} step={5000} onChange={setTradIRA} prefix="$" />}
  </div>

  {/* Roth IRA */}
  <div className="mb-20">
    <label className="field-label">Roth IRA</label>
    <p className="field-note">After-tax individual retirement account. Withdrawals are completely tax-free.</p>
    <div className="toggle-group">
      <button className={`toggle${hasRothIRA ? ' toggle--active' : ''}`} onClick={() => setHasRothIRA(true)}>I have this</button>
      <button className={`toggle${!hasRothIRA ? ' toggle--active' : ''}`} onClick={() => setHasRothIRA(false)}>I don't</button>
    </div>
    {hasRothIRA && <SliderInput label="Current Balance" value={rothIRA} min={0} max={1000000} step={5000} onChange={setRothIRA} prefix="$" />}
  </div>

  {/* Taxable Brokerage */}
  <div className="mb-20">
    <label className="field-label">Brokerage / Investment Account</label>
    <p className="field-note">Regular investment account — not retirement-specific. Examples: Fidelity, Vanguard, Schwab taxable accounts. Only the gains portion is taxed when you withdraw, at lower long-term rates.</p>
    <div className="toggle-group">
      <button className={`toggle${hasTaxableBrokerage ? ' toggle--active' : ''}`} onClick={() => setHasTaxableBrokerage(true)}>I have this</button>
      <button className={`toggle${!hasTaxableBrokerage ? ' toggle--active' : ''}`} onClick={() => setHasTaxableBrokerage(false)}>I don't</button>
    </div>
    {hasTaxableBrokerage && <SliderInput label="Current Balance" value={taxableBrokerage} min={0} max={1000000} step={5000} onChange={setTaxableBrokerage} prefix="$" note="We assume 60% of withdrawals are taxable gains — a conservative estimate for a long-held account." />}
  </div>

  {/* Contribution sliders — KEEP UNCHANGED from original */}
  <SliderInput label="Annual 401(k) Contribution" ... />
  ...
</Card>
```

Apply the same pattern for the Spouse card using spouse field names.

- [ ] **Step 3: Proceed directly to Task 8 — no build check here.**

---

## Task 8: Phase 2 — Update `calc.js` Bucket Tracking

**Files:**
- Modify: `src/utils/calc.js`
- Modify: `src/utils/calc.test.js`

This is the largest single change — replaces the single-portfolio drawdown with three tracked buckets and per-bucket tax treatment.

- [ ] **Step 1: Write the failing tests**

Add to `src/utils/calc.test.js`. Note: These tests use new account type field names (`trad401k` etc.) instead of the old `savings401k` etc.:

```js
// Phase 2 base inputs — uses new account type fields
const P2_BASE = {
  age: 50, retirementAge: 65, lifeExpectancy: 85,
  hasSpouse: false, spouseAge: 0, spouseRetirementAge: 65, spouseLifeExpectancy: 85,
  ss1: 2000, ss2: 0,
  pension: 0, pensionCOLA: false,
  partTimeIncome: 0, partTimeEndAge: 70, rentalIncome: 0,
  annualContrib401k: 10000, employerMatch: 5000,
  annualContribIRA: 3000, annualContribOther: 0,
  spouseAnnualContrib401k: 0, spouseEmployerMatch: 0,
  spouseAnnualContribIRA: 0, spouseAnnualContribOther: 0,
  trad401k: 300000, roth401k: 0, tradIRA: 75000, rothIRA: 0, taxableBrokerage: 50000,
  homeValue: 300000, homeOwned: true,
  investmentReturn: 5, inflation: 3, healthcareInflation: 5.5,
  housing: 1500, food: 700, healthcare: 800, transport: 400, leisure: 500, other: 300,
  longTermCare: 0, ltcStartAge: 80,
  stateInfo: { incomeTax: 0.05, hasSSIncomeTax: false, avgPropertyTaxRate: 0.009, costOfLivingIndex: 100 },
  survivorFactor: 1.0,
};

describe('Phase 2: account type bucket tracking', () => {
  it('Roth-only portfolio produces longer runway than Traditional-only (same total)', () => {
    const allRoth = runProjection({
      ...P2_BASE, trad401k: 0, tradIRA: 0, roth401k: 300000, rothIRA: 75000, taxableBrokerage: 0,
    });
    const allTrad = runProjection({
      ...P2_BASE, trad401k: 300000, tradIRA: 75000, roth401k: 0, rothIRA: 0, taxableBrokerage: 0,
    });
    // Roth withdrawals are tax-free → same gross needed, no tax bill → longer runway
    expect(allRoth.runwayYears).toBeGreaterThan(allTrad.runwayYears);
  });

  it('totalLiquidAssets equals sum of all 5 account fields', () => {
    const result = runProjection(P2_BASE);
    const expected = P2_BASE.trad401k + P2_BASE.roth401k + P2_BASE.tradIRA + P2_BASE.rothIRA + P2_BASE.taxableBrokerage;
    expect(result.totalLiquidAssets).toBe(expected);
  });

  it('taxable brokerage incurs capital gains tax → shorter runway than equivalent Roth', () => {
    const allTaxable = runProjection({
      ...P2_BASE, trad401k: 0, tradIRA: 0, roth401k: 0, rothIRA: 0, taxableBrokerage: 375000,
    });
    const allRoth = runProjection({
      ...P2_BASE, trad401k: 0, tradIRA: 0, roth401k: 375000, rothIRA: 0, taxableBrokerage: 0,
    });
    expect(allRoth.runwayYears).toBeGreaterThanOrEqual(allTaxable.runwayYears);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: Phase 2 tests fail (`trad401k` etc. not accepted by `runProjection` yet).

- [ ] **Step 3: Update `runProjection` inputs destructuring**

At the top of `runProjection`, replace:
```js
savings401k, iraBalance, taxableInvestments,
```

With:
```js
trad401k = 0, roth401k = 0, tradIRA = 0, rothIRA = 0, taxableBrokerage = 0,
```

- [ ] **Step 4: Update `totalLiquidAssets`**

Find:
```js
const totalLiquidAssets = savings401k + iraBalance + taxableInvestments;
```

Replace with:
```js
const totalLiquidAssets = trad401k + roth401k + tradIRA + rothIRA + taxableBrokerage;
```

The accumulation phase uses `let portfolio = totalLiquidAssets;` — no other changes needed there.

- [ ] **Step 5: Initialize drawdown buckets proportionally after accumulation**

After `const portfolioAtRetirement = Math.round(portfolio);`, add:

```js
// Initialize drawdown buckets proportional to accumulation growth.
// All asset types grow at the same expected return during accumulation.
const growthFactor    = totalLiquidAssets > 0 ? portfolioAtRetirement / totalLiquidAssets : 1;
let taxableBucket = taxableBrokerage * growthFactor;
let tradBucket    = (trad401k + tradIRA) * growthFactor;
let rothBucket    = (roth401k + rothIRA) * growthFactor;
```

- [ ] **Step 6: Replace the drawdown loop's growth + withdrawal block**

In the drawdown loop, find and **remove** these two lines (they are replaced by per-bucket equivalents):

```js
const growth = portfolio * (investmentReturn / 100);
portfolio = portfolio + growth - yearlyWithdrawal;
```

Also remove the `const federalTax` and `const yearlyWithdrawal` lines that follow the real-terms tax block from Task 3/5. The entire section from the real-terms tax block onwards is replaced.

Replace with the following block, positioned **after** `preTaxGap` is computed but **before** the `yearsData.push(...)` call. Buckets grow first, then withdrawals are applied (matching existing grow-then-withdraw loop structure):

```js
// --- Per-bucket growth (before withdrawals — matches existing loop structure) ---
const bucketGrowthRate = investmentReturn / 100;
taxableBucket += taxableBucket * bucketGrowthRate;
tradBucket    += tradBucket    * bucketGrowthRate;
rothBucket    += rothBucket    * bucketGrowthRate;

// --- Step 1: Spending allocation — allocate preTaxGap across buckets in order ---
// Taxes are computed from this split and added on top, avoiding circular dependency.
const taxableSpend = Math.min(taxableBucket, preTaxGap);
const remaining1   = preTaxGap - taxableSpend;
const tradSpend    = Math.min(tradBucket, remaining1);
const rothSpend    = Math.min(rothBucket, remaining1 - tradSpend);

// --- Step 2: Tax computation based on spending split ---
const stateTaxRate   = stateInfo.incomeTax;

// State tax on Traditional spending (flat-rate gross-up is exact)
const tradGross      = stateTaxRate < 1 ? tradSpend / (1 - stateTaxRate) : tradSpend;
const stateTaxOnTrad = tradGross - tradSpend;

// Federal tax — two-iteration real-terms gross-up using new return shape { tax, taxableSS }
const realTradGross = tradGross / generalFactor;
const { tax: realFed1, taxableSS: ss1_ } = estimateFederalTax({
  ssAnnual: realSS, ordinaryIncome: realOrdinary,
  withdrawalEstimate: realTradGross,
  married: hasSpouse, age: ageInYear,
});
const { tax: realFed2, taxableSS } = estimateFederalTax({
  ssAnnual: realSS, ordinaryIncome: realOrdinary,
  withdrawalEstimate: realTradGross + realFed1,
  married: hasSpouse, age: ageInYear,
});
const federalTax = realFed2 * generalFactor;

// Capital gains tax on taxable brokerage withdrawal (60% assumed gains, real terms)
const capGainsTax = estimateCapitalGainsTax({
  taxableGains: (taxableSpend * 0.60) / generalFactor,
  totalOrdinaryIncome: realOrdinary + (tradGross / generalFactor) + taxableSS,
  married: hasSpouse,
}) * generalFactor;

// --- Step 3: Total portfolio deduction ---
const yearlyWithdrawal = preTaxGap + stateTaxOnTrad + capGainsTax + federalTax;

// --- Bucket balance updates ---
// Spending reduces each bucket by its spending share; Traditional pays gross (includes state tax)
taxableBucket -= taxableSpend;
tradBucket    -= tradGross;
rothBucket    -= rothSpend;

// Remaining taxes (cap gains + federal) drawn from buckets in same order
let taxesLeft = capGainsTax + federalTax;
const taxFromTaxable = Math.min(taxableBucket, taxesLeft);
taxableBucket  -= taxFromTaxable;
taxesLeft      -= taxFromTaxable;
const taxFromTrad = Math.min(tradBucket, taxesLeft);
tradBucket     -= taxFromTrad;
taxesLeft      -= taxFromTrad;
rothBucket     -= Math.min(rothBucket, taxesLeft);

// Clamp to zero, recompute portfolio
taxableBucket = Math.max(taxableBucket, 0);
tradBucket    = Math.max(tradBucket,    0);
rothBucket    = Math.max(rothBucket,    0);
portfolio     = taxableBucket + tradBucket + rothBucket;
```

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: all tests pass, including the three new Phase 2 tests.

- [ ] **Step 8: Build check**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 9: Verify in browser**

`npm run dev`. Go through all 5 wizard steps:
- AssetsStep: account type toggles appear, show/hide works for each account type
- Change all assets to Roth (zero Traditional, set Roth 401k) → results should show longer runway than all-Traditional equivalent
- Pension COLA toggle still works in Income step
- Results page shows reasonable numbers and no NaN values

- [ ] **Step 10: Commit all Phase 2 changes together**

```bash
git add src/utils/calc.js src/utils/calc.test.js src/utils/federalTax.js src/utils/federalTax.test.js src/context/PlannerContext.jsx src/steps/AssetsStep.jsx
git commit -m "feat: Traditional/Roth/Taxable account types with tax-efficient withdrawal ordering"
```

---

## Summary of Commits

| Commit | Tasks |
|---|---|
| `chore: add Vitest test framework` | 1 |
| `fix: healthcare cost not scaled by survivorFactor in solo projections` | 2 |
| `fix: federal tax uses real-term brackets and two-iteration gross-up` | 3 |
| `feat: pension COLA toggle — fixed vs inflation-adjusted pension income` | 4 |
| `feat: Traditional/Roth/Taxable account types with tax-efficient withdrawal ordering` | 5–8 |
