# Social Security Claiming Age — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-03-21-ss-claiming-age.md`
**Goal:** Add SS claiming age sliders (62–70) for primary and spouse. Auto-adjust benefits using SSA's formula. Model survivor benefit loss in combined projection when first spouse dies.

---

## Task Dependency Map

```
Task 1 (ssUtils.js + tests)   ← independent
Task 2 (PlannerContext)        ← depends on Task 1 (imports ssAdjustmentFactor)
Task 3 (IncomeStep UI)         ← depends on Task 2 (needs ss1ClaimAge, adjustedSS1 from context)
Task 4 (calc.js survivor)      ← independent (no new imports)
Task 5 (test updates)          ← depends on Tasks 1 + 4
```

---

## Task 1: `ssAdjustmentFactor` utility + tests

**Files:**
- Create: `src/utils/ssUtils.js`
- Create: `tests/ssUtils.test.js`

### Step 1: Create `src/utils/ssUtils.js`

```js
/**
 * Returns the benefit multiplier for claiming SS at a given age.
 * FRA is assumed to be 67 (born 1960+).
 *
 * Early claiming: -5/9% per month for first 36 months before FRA,
 *                 -5/12% per month for months 37-60.
 * Delayed:        +8% per full year after FRA (max age 70).
 */
export function ssAdjustmentFactor(claimAge, fra = 67) {
  if (claimAge >= fra) return 1 + (claimAge - fra) * 0.08;
  const monthsEarly = (fra - claimAge) * 12;
  const reduction = monthsEarly <= 36
    ? monthsEarly * (5 / 9 / 100)
    : 36 * (5 / 9 / 100) + (monthsEarly - 36) * (5 / 12 / 100);
  return +(1 - reduction).toFixed(6); // round float noise
}
```

### Step 2: Create `tests/ssUtils.test.js`

```js
import { describe, it, expect } from 'vitest';
import { ssAdjustmentFactor } from '../src/utils/ssUtils';

describe('ssAdjustmentFactor', () => {
  it('returns 1.0 at FRA (67)', () => {
    expect(ssAdjustmentFactor(67)).toBeCloseTo(1.0);
  });

  it('returns 0.70 at age 62 (max early reduction)', () => {
    // 60 months early: first 36 × 5/9% + next 24 × 5/12% = 20% + 10% = 30% reduction
    expect(ssAdjustmentFactor(62)).toBeCloseTo(0.70, 4);
  });

  it('returns 0.80 at age 64 (36 months early)', () => {
    // 36 × 5/9% = 20% reduction
    expect(ssAdjustmentFactor(64)).toBeCloseTo(0.80, 4);
  });

  it('returns 1.24 at age 70 (3 years of 8% credits)', () => {
    expect(ssAdjustmentFactor(70)).toBeCloseTo(1.24, 4);
  });

  it('returns 1.08 at age 68 (1 year delay)', () => {
    expect(ssAdjustmentFactor(68)).toBeCloseTo(1.08, 4);
  });
});
```

### Step 3: Run tests

```bash
npx vitest run
```

Expected: all existing 19 tests pass + 5 new ssUtils tests = 24 total.

### Step 4: Commit

```bash
git add src/utils/ssUtils.js tests/ssUtils.test.js
git commit -m "feat: ssAdjustmentFactor utility with SSA claiming formula"
```

---

## Task 2: PlannerContext — claiming age state + derived SS

**Files:**
- Modify: `src/context/PlannerContext.jsx`

### Step 1: Add imports + state

At the top of the file, add:
```js
import { ssAdjustmentFactor } from "../utils/ssUtils";
```

In the Income state section, after `const [ss2, setSs2] = useState(1400);`, add:
```js
const [ss1ClaimAge, setSs1ClaimAge] = useState(67);
const [ss2ClaimAge, setSs2ClaimAge] = useState(67);
```

### Step 2: Add derived adjusted SS amounts

After the `const stateInfo = ...` line, add:
```js
const adjustedSS1 = ss1 * ssAdjustmentFactor(ss1ClaimAge);
const adjustedSS2 = ss2 * ssAdjustmentFactor(ss2ClaimAge);
```

### Step 3: Wire to runProjection calls

In the **combined projection** (`results` useMemo), change `ss1, ss2` to:
```js
ss1: adjustedSS1, ss2: adjustedSS2,
```

In the **primaryResults** useMemo, change `ss1, ss2: 0` to:
```js
ss1: adjustedSS1, ss2: 0,
```

In the **spouseResults** useMemo, change `ss1: ss2, ss2: 0` to:
```js
ss1: adjustedSS2, ss2: 0,
```

### Step 4: Add to dep arrays

Add `ss1ClaimAge` and `ss2ClaimAge` to:
- `results` useMemo dep array (after `ss1, ss2`)
- `primaryResults` useMemo dep array (after `ss1`)
- `spouseResults` useMemo dep array (after `ss2`)

### Step 5: Expose in context value

In the `PlannerContext.Provider value={{...}}`, in the Income section, add after `ss2, setSs2`:
```js
ss1ClaimAge, setSs1ClaimAge,
ss2ClaimAge, setSs2ClaimAge,
adjustedSS1, adjustedSS2,
```

### Step 6: Run tests and build

```bash
npx vitest run
npx vite build
```

Expected: 24 tests pass, build succeeds.

### Step 7: Commit

```bash
git add src/context/PlannerContext.jsx
git commit -m "feat: ss1ClaimAge/ss2ClaimAge state + adjustedSS1/SS2 derived values in PlannerContext"
```

---

## Task 3: IncomeStep UI — claiming age sliders + benefit preview

**Files:**
- Modify: `src/steps/IncomeStep.jsx`

### Step 1: Destructure new values

Add to the `usePlanner()` destructure:
```js
ss1ClaimAge, setSs1ClaimAge,
ss2ClaimAge, setSs2ClaimAge,
adjustedSS1, adjustedSS2,
```

### Step 2: Add helper for the preview note

Inline helper at the top of the component (before the return):
```js
function claimPreviewNote(claimAge, fraAmount, adjustedAmount) {
  const delta = Math.round(Math.abs(adjustedAmount - fraAmount));
  const adj = Math.round(adjustedAmount);
  if (claimAge === 67) return `At 67 (Full Retirement Age): $${adj.toLocaleString()}/mo`;
  if (claimAge < 67)  return `At ${claimAge}: $${adj.toLocaleString()}/mo — $${delta.toLocaleString()}/mo less than waiting until 67`;
  return `At ${claimAge}: $${adj.toLocaleString()}/mo — $${delta.toLocaleString()}/mo more than claiming at 67`;
}
```

### Step 3: Update the SS sliders

**Primary SS block** — update the existing SliderInput for `ss1`, and add the claim age slider + preview below it:

Change the label from:
```
"Your Social Security Benefit"
```
to:
```
"Your Social Security Benefit (at Full Retirement Age, 67)"
```

Below the existing `ss1` SliderInput (still inside the SS Card), add:
```jsx
<SliderInput
  label="Your Planned Claiming Age"
  value={ss1ClaimAge} min={62} max={70} step={1}
  onChange={setSs1ClaimAge} suffix=" yrs"
  note={claimPreviewNote(ss1ClaimAge, ss1, adjustedSS1)}
/>
```

**Spouse SS block** (inside `{hasSpouse && (...)}`) — same pattern:

Change label from `"Spouse Social Security Benefit"` to `"Spouse Social Security Benefit (at Full Retirement Age, 67)"`.

Below that SliderInput add:
```jsx
<SliderInput
  label="Spouse Planned Claiming Age"
  value={ss2ClaimAge} min={62} max={70} step={1}
  onChange={setSs2ClaimAge} suffix=" yrs"
  note={claimPreviewNote(ss2ClaimAge, ss2, adjustedSS2)}
/>
```

### Step 4: Run tests and build

```bash
npx vitest run
npx vite build
```

Expected: 24 tests pass, build succeeds.

### Step 5: Commit

```bash
git add src/steps/IncomeStep.jsx
git commit -m "feat: SS claiming age sliders with real-time benefit preview in IncomeStep"
```

---

## Task 4: calc.js — survivor transition in combined projection

**Files:**
- Modify: `src/utils/calc.js`

### Step 1: Add survivor setup before the drawdown loop

Find the line `// ── Phase 2: Drawdown` and add the following BEFORE the `for` loop (after the `portfolioAtRetirement` and bucket initialization code):

```js
// ── Survivor transition setup (combined projection only) ─────────────────
// When hasSpouse && survivorFactor === 1.0, the combined projection models
// both spouses alive. After the first death, SS drops to the higher benefit
// and expenses scale down to 60% (survivorFactor for solo).
const modelSurvivor = hasSpouse && survivorFactor === 1.0;
const firstDeathAge = modelSurvivor
  ? Math.min(lifeExpectancy, currentAge + (spouseLifeExpectancy - spouseAge))
  : Infinity;

// Survivor-phase expense and income bases
const baseNonHealthcareNeedAlone = (housing + food + transport + leisure + other) * col * 0.6;
const ssMonthlyAlone             = Math.max(ss1, ss2);
const ssTaxableAlone             = stateInfo.hasSSIncomeTax ? ssMonthlyAlone : 0;

const nonPensionGrossWithPTAlone    = ssMonthlyAlone + partTimeIncome + rentalIncome;
const nonPensionTaxWithPTAlone      = (partTimeIncome + rentalIncome + ssTaxableAlone) * stateInfo.incomeTax;
const nonPensionNetWithPTAlone      = nonPensionGrossWithPTAlone - nonPensionTaxWithPTAlone;

const nonPensionGrossWithoutPTAlone = ssMonthlyAlone + rentalIncome;
const nonPensionTaxWithoutPTAlone   = (rentalIncome + ssTaxableAlone) * stateInfo.incomeTax;
const nonPensionNetWithoutPTAlone   = nonPensionGrossWithoutPTAlone - nonPensionTaxWithoutPTAlone;
```

### Step 2: Add active-variable switching at the top of the drawdown loop

At the very top of the `for (let y = 0; y <= yearsToProject; y++)` loop body, add:

```js
// Switch to survivor mode after the first spouse's death
const isSurvivor = modelSurvivor && ageInYear > firstDeathAge;
const activeBaseNonHealthcareNeed  = isSurvivor ? baseNonHealthcareNeedAlone  : baseNonHealthcareNeed;
const activeNonPensionNetWithPT    = isSurvivor ? nonPensionNetWithPTAlone    : nonPensionNetWithPT;
const activeNonPensionNetWithoutPT = isSurvivor ? nonPensionNetWithoutPTAlone : nonPensionNetWithoutPT;
const activeRealSS                 = isSurvivor ? ssMonthlyAlone * 12          : realSS;
const activeMarried                = isSurvivor ? false                         : hasSpouse;
```

### Step 3: Replace usages inside the loop

Replace every reference inside the loop body:
- `baseNonHealthcareNeed` → `activeBaseNonHealthcareNeed`
- `nonPensionNetWithPT` → `activeNonPensionNetWithPT`
- `nonPensionNetWithoutPT` → `activeNonPensionNetWithoutPT`
- `realSS` → `activeRealSS`
- `hasSpouse` (inside `estimateFederalTax` calls, the `married` param) → `activeMarried`

**Important:** Only replace inside the drawdown `for` loop. Do NOT replace in the Phase 1 accumulation loop or the pre-loop calculations. The pre-loop `hasSpouse` references (e.g., `const ssMonthly = ss1 + (hasSpouse ? ss2 : 0)`) are unchanged.

Also: the `yearlyNeed` line uses `baseNonHealthcareNeed` — replace that with `activeBaseNonHealthcareNeed`.

### Step 4: Run tests and build

```bash
npx vitest run
npx vite build
```

Expected: 24 tests pass, build succeeds.

### Step 5: Commit

```bash
git add src/utils/calc.js
git commit -m "feat: survivor SS benefit and expense transition in combined projection"
```

---

## Task 5: Test updates — claiming age + survivor transition

**Files:**
- Modify: `tests/calc.test.js`

### Step 1: Add SS claiming age tests

Add a new `describe` block to `tests/calc.test.js`:

```js
describe('SS claiming age via adjustedSS values', () => {
  const base = {
    age: 60, retirementAge: 62, lifeExpectancy: 85, hasSpouse: false,
    ss1: 1000, ss2: 0,
    trad401k: 200000, roth401k: 0, tradIRA: 0, rothIRA: 0, taxableBrokerage: 0,
    annualContrib401k: 0, employerMatch: 0, annualContribIRA: 0, annualContribOther: 0,
    spouseAnnualContrib401k: 0, spouseEmployerMatch: 0, spouseAnnualContribIRA: 0, spouseAnnualContribOther: 0,
    pension: 0, pensionCOLA: false, partTimeIncome: 0, partTimeEndAge: 70, rentalIncome: 0,
    housing: 1000, food: 500, healthcare: 300, transport: 200, leisure: 200, other: 100,
    longTermCare: 0, ltcStartAge: 80,
    homeValue: 0, homeOwned: false,
    investmentReturn: 5, inflation: 3, healthcareInflation: 5.5,
    survivorFactor: 0.6,
    stateInfo: { incomeTax: 0, hasSSIncomeTax: false, avgPropertyTaxRate: 0, costOfLivingIndex: 100 },
  };

  it('higher SS income (ss1=1240) leads to smaller monthly withdrawal than lower SS (ss1=700)', () => {
    const resultHigh = runProjection({ ...base, ss1: 1240 }); // claiming at 70: 1000 × 1.24
    const resultLow  = runProjection({ ...base, ss1: 700  }); // claiming at 62: 1000 × 0.70
    expect(resultHigh.monthlyGap).toBeLessThan(resultLow.monthlyGap);
  });

  it('higher SS leads to longer portfolio runway', () => {
    const resultHigh = runProjection({ ...base, ss1: 1240 });
    const resultLow  = runProjection({ ...base, ss1: 700  });
    expect(resultHigh.runwayYears).toBeGreaterThan(resultLow.runwayYears);
  });
});
```

### Step 2: Add survivor transition test

```js
describe('survivor SS transition in combined projection', () => {
  const base = {
    age: 60, retirementAge: 65, lifeExpectancy: 80,
    spouseAge: 58, spouseRetirementAge: 63, spouseLifeExpectancy: 75,
    hasSpouse: true, survivorFactor: 1.0,
    ss1: 2000, ss2: 1000,   // survivor should keep $2000, not $3000
    trad401k: 300000, roth401k: 0, tradIRA: 0, rothIRA: 0, taxableBrokerage: 0,
    annualContrib401k: 0, employerMatch: 0, annualContribIRA: 0, annualContribOther: 0,
    spouseAnnualContrib401k: 0, spouseEmployerMatch: 0, spouseAnnualContribIRA: 0, spouseAnnualContribOther: 0,
    pension: 0, pensionCOLA: false, partTimeIncome: 0, partTimeEndAge: 70, rentalIncome: 0,
    housing: 1000, food: 500, healthcare: 300, transport: 200, leisure: 200, other: 100,
    longTermCare: 0, ltcStartAge: 80,
    homeValue: 0, homeOwned: false,
    investmentReturn: 5, inflation: 3, healthcareInflation: 5.5,
    stateInfo: { incomeTax: 0, hasSSIncomeTax: false, avgPropertyTaxRate: 0, costOfLivingIndex: 100 },
  };

  it('combined projection runway is shorter than no-survivor-transition baseline', () => {
    // A projection that never drops SS should have a longer runway than one that does
    const withSurvivor    = runProjection({ ...base });
    const noSurvivorDrop  = runProjection({ ...base, hasSpouse: false, ss1: 3000, survivorFactor: 1.0 });
    // withSurvivor drops SS income at spouse death; noSurvivorDrop keeps full $3000 forever
    expect(withSurvivor.runwayYears).toBeLessThanOrEqual(noSurvivorDrop.runwayYears);
  });
});
```

### Step 3: Run tests

```bash
npx vitest run
```

Expected: all tests pass (24 existing + new ones).

### Step 4: Commit

```bash
git add tests/calc.test.js
git commit -m "test: SS claiming adjustment and survivor transition coverage"
```

---

## Success Criteria

- `npx vitest run` — all tests pass
- `npx vite build` — no errors
- IncomeStep: claiming age slider appears below each SS field; note shows adjusted amount and delta vs FRA
- Setting claim age to 62 reduces SS in projection (higher monthly gap, shorter runway)
- Setting claim age to 70 increases SS in projection (lower monthly gap, longer runway)
- With a spouse: combined projection shows reduced SS and expenses after the first spouse's death age
- Solo projections (primary / spouse chart lines) are unaffected by survivor logic
