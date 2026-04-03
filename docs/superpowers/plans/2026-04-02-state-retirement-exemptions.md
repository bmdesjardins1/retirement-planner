# State Retirement Income Exemptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-state pension and trad IRA/401k withdrawal exemptions so the model stops overtaxing states like Illinois (fully exempt) and Georgia ($65K/person cap).

**Architecture:** New `stateTax.js` helper computes state tax with exemption awareness. `stateData.js` gains two new fields per state. `calc.js` calls the helper for pension pre-loop variants and the trad gross-up inside the drawdown loop. A new `stateExemptionSavingsMonthly` return value surfaces pension savings in the Tax & Cost Summary UI.

**Tech Stack:** Plain JS (no TypeScript), Vitest for tests, React functional component for UI.

**Spec:** `docs/superpowers/specs/2026-04-02-state-retirement-exemptions-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/utils/stateTax.js` | **Create** | `computeStateTax()` — exemption-aware state tax computation |
| `tests/stateTax.test.js` | **Create** | Unit tests for `computeStateTax` |
| `src/data/stateData.js` | **Modify** | Add `pensionExemptPerPerson` + `tradExemptPerPerson` to all 50 states |
| `src/utils/calc.js` | **Modify** | Use `computeStateTax` for pension pre-loop; update trad gross-up; add return value |
| `tests/calc.test.js` | **Modify** | Add 3 regression cases (Illinois full exempt, Georgia cap, savings amount) |
| `src/steps/ResultsStep.jsx` | **Modify** | Add "Pension exemption savings" line to Tax Snapshot |

---

## Task 1: Create `stateTax.js` helper (TDD)

**Files:**
- Create: `src/utils/stateTax.js`
- Create: `tests/stateTax.test.js`

- [ ] **Step 1.1: Write failing tests**

Create `tests/stateTax.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeStateTax } from '../src/utils/stateTax';

// Helpers for test stateInfo objects
const state = (incomeTax, pensionExempt = 0, tradExempt = 0) => ({
  incomeTax,
  pensionExemptPerPerson: pensionExempt,
  tradExemptPerPerson: tradExempt,
  hasSSIncomeTax: false,
  avgPropertyTaxRate: 0.01,
  costOfLivingIndex: 100,
});

describe('computeStateTax', () => {
  it('returns 0 for zero-rate state regardless of exemption', () => {
    expect(computeStateTax({ grossAnnual: 100000, stateInfo: state(0, Infinity, Infinity), type: 'pension' })).toBe(0);
  });

  it('applies full flat rate when no exemption', () => {
    // 5% of $60,000/yr = $3,000
    expect(computeStateTax({ grossAnnual: 60000, stateInfo: state(0.05, 0, 0), type: 'pension' })).toBe(3000);
  });

  it('returns 0 tax when income is below full-exemption cap (Infinity)', () => {
    expect(computeStateTax({ grossAnnual: 60000, stateInfo: state(0.05, Infinity, 0), type: 'pension' })).toBe(0);
  });

  it('taxes only the amount above a partial exemption cap', () => {
    // $65,000 cap, $80,000 income → taxable = $15,000, tax = $15,000 * 0.055 = $825
    expect(computeStateTax({ grossAnnual: 80000, stateInfo: state(0.055, 65000, 0), type: 'pension' })).toBe(825);
  });

  it('returns 0 when income is exactly at the exemption cap', () => {
    expect(computeStateTax({ grossAnnual: 65000, stateInfo: state(0.055, 65000, 0), type: 'pension' })).toBe(0);
  });

  it('returns 0 when income is below the exemption cap', () => {
    expect(computeStateTax({ grossAnnual: 40000, stateInfo: state(0.055, 65000, 0), type: 'pension' })).toBe(0);
  });

  it('uses tradExemptPerPerson when type is trad', () => {
    // tradExempt = $20,000, grossAnnual = $50,000 → taxable = $30,000, tax = $30,000 * 0.05 = $1,500
    expect(computeStateTax({ grossAnnual: 50000, stateInfo: state(0.05, 0, 20000), type: 'trad' })).toBe(1500);
  });

  it('applies no exemption for unknown type (e.g. ss)', () => {
    // type 'ss' has no exemption → full flat rate
    expect(computeStateTax({ grossAnnual: 30000, stateInfo: state(0.05, Infinity, Infinity), type: 'ss' })).toBe(1500);
  });

  it('doubles exemption for personCount 2 (couple)', () => {
    // Georgia-style $65K cap per person → $130K total exempt for couple
    // grossAnnual = $150,000 → taxable = $150,000 - $130,000 = $20,000, tax = $20,000 * 0.055 = $1,100
    expect(computeStateTax({ grossAnnual: 150000, stateInfo: state(0.055, 0, 65000), type: 'trad', personCount: 2 })).toBe(1100);
  });

  it('survivor phase uses personCount 1 (default)', () => {
    // Same inputs as above but personCount = 1 (default) → exempt = $65K only
    // taxable = $150,000 - $65,000 = $85,000, tax = $85,000 * 0.055 = $4,675
    expect(computeStateTax({ grossAnnual: 150000, stateInfo: state(0.055, 0, 65000), type: 'trad' })).toBe(4675);
  });
});
```

- [ ] **Step 1.2: Run tests — confirm they all fail**

```bash
npx vitest run tests/stateTax.test.js
```

Expected: all tests fail with "Cannot find module" or similar.

- [ ] **Step 1.3: Implement `computeStateTax`**

Create `src/utils/stateTax.js`:

```js
export function computeStateTax({ grossAnnual, stateInfo, type, personCount = 1 }) {
  const rate = stateInfo.incomeTax;
  if (rate === 0) return 0;

  const exemptPerPerson =
    type === 'pension' ? (stateInfo.pensionExemptPerPerson ?? 0) :
    type === 'trad'    ? (stateInfo.tradExemptPerPerson    ?? 0) :
    0;

  const taxable = Math.max(0, grossAnnual - exemptPerPerson * personCount);
  return taxable * rate;
}
```

- [ ] **Step 1.4: Run tests — confirm all pass**

```bash
npx vitest run tests/stateTax.test.js
```

Expected: 9 tests pass.

- [ ] **Step 1.5: Commit**

```bash
git add src/utils/stateTax.js tests/stateTax.test.js
git commit -m "feat: add computeStateTax helper with per-person exemption support"
```

---

## Task 2: Add exemption data to `stateData.js`

**Files:**
- Modify: `src/data/stateData.js`

Add `pensionExemptPerPerson` and `tradExemptPerPerson` to every state entry. Use the reference table below. **Verify each value against current state tax law before implementation** — tax laws change and this table reflects best-available knowledge as of 2026.

**Key rules:**
- States with `incomeTax: 0` → both fields `0` (rate=0 short-circuits; values are never read)
- `Infinity` = full exemption (state taxes none of this income type)
- Dollar value = annual per-person cap
- `0` = no exemption for this income type

**Research reference table:**

| State | pensionExemptPerPerson | tradExemptPerPerson | Notes |
|-------|----------------------|---------------------|-------|
| Alabama | 0 | 0 | Govt pensions exempt but can't distinguish; private taxable |
| Alaska | 0 | 0 | No income tax |
| Arizona | 0 | 0 | No broad retirement exemption |
| Arkansas | 6000 | 6000 | Up to $6K for pension/IRA at 59.5+ |
| California | 0 | 0 | No retirement exemptions |
| Colorado | 24000 | 24000 | $24K at 65+, $20K under 65 (use 65+ as simplification) |
| Connecticut | 75000 | 75000 | Up to $75K (single) / $100K (married) for AGI under threshold |
| Delaware | 12500 | 12500 | $12,500 pension/retirement exclusion at 60+ |
| Florida | 0 | 0 | No income tax |
| Georgia | 65000 | 65000 | $65K per person exclusion at 65+ |
| Hawaii | Infinity | Infinity | Pension distributions fully exempt; IRA/401k distributions also exempt |
| Idaho | 0 | 0 | No broad retirement exemption |
| Illinois | Infinity | Infinity | All retirement income exempt |
| Indiana | 0 | 0 | No broad retirement exemption |
| Iowa | 0 | 0 | Iowa eliminated income tax effective 2025 — set incomeTax to 0 and both exemptions to 0 |
| Kansas | 0 | 0 | SS may be partially exempt; pension/IRA taxed |
| Kentucky | 31110 | 31110 | $31,110 pension exclusion |
| Louisiana | 6000 | 6000 | $6K per person exemption for retirement income at 65+ |
| Maine | 25000 | 25000 | Up to $25K pension exclusion at 65+ |
| Maryland | 35500 | 35500 | Up to $35,500 pension exclusion at 65+ |
| Massachusetts | 0 | 0 | Pensions taxable (govt pensions partially exempt, private fully taxable) |
| Michigan | 0 | 0 | Complex rules by birth year; simplified to 0 |
| Minnesota | 0 | 0 | No pension/IRA exemption beyond SS deduction |
| Mississippi | Infinity | Infinity | All qualified retirement income exempt |
| Missouri | 0 | 0 | Small public pension deduction; simplified to 0 |
| Montana | 0 | 0 | No broad retirement exemption |
| Nebraska | 0 | 0 | SS partially exempt; pension/IRA taxed |
| Nevada | 0 | 0 | No income tax |
| New Hampshire | 0 | 0 | No income tax |
| New Jersey | 0 | 0 | Pension exclusion is complex income-phased; simplified to 0 |
| New Mexico | 0 | 0 | Small exemption for 65+; simplified to 0 |
| New York | 20000 | 20000 | $20K pension exclusion at 59.5+ |
| North Carolina | 0 | 0 | No broad retirement exemption |
| North Dakota | 0 | 0 | No broad retirement exemption |
| Ohio | 0 | 0 | No broad retirement exemption beyond small credits |
| Oklahoma | 10000 | 10000 | Up to $10K pension exemption |
| Oregon | 0 | 0 | No broad retirement exemption |
| Pennsylvania | Infinity | Infinity | All retirement income exempt (if from qualifying plan) |
| Rhode Island | 0 | 0 | Small exemption for income below threshold; simplified to 0 |
| South Carolina | 15000 | 15000 | $15K retirement exemption at 65+ |
| South Dakota | 0 | 0 | No income tax |
| Tennessee | 0 | 0 | No income tax |
| Texas | 0 | 0 | No income tax |
| Utah | 0 | 0 | Retirement credit applies but income-phased; simplified to 0 |
| Vermont | 0 | 0 | No broad pension/IRA exemption |
| Virginia | 12000 | 12000 | $12K age deduction for 65+ |
| Washington | 0 | 0 | No income tax |
| West Virginia | 0 | 0 | No broad retirement exemption |
| Wisconsin | 0 | 0 | No broad pension/IRA exemption |
| Wyoming | 0 | 0 | No income tax |

**Important:** Iowa's `incomeTax` in `stateData.js` is currently `0.06` but Iowa eliminated its income tax effective 2025. Update Iowa's `incomeTax` to `0.0` as well.

- [ ] **Step 2.1: Update `stateData.js`**

Add both new fields to each of the 50 state entries. Format to match existing alignment style. Example of updated entries:

```js
"Illinois":    { incomeTax: 0.0495, hasSSIncomeTax: false, avgPropertyTaxRate: 0.0227, costOfLivingIndex: 95,  pensionExemptPerPerson: Infinity, tradExemptPerPerson: Infinity },
"Georgia":     { incomeTax: 0.055,  hasSSIncomeTax: false, avgPropertyTaxRate: 0.0092, costOfLivingIndex: 93,  pensionExemptPerPerson: 65000,    tradExemptPerPerson: 65000    },
"Iowa":        { incomeTax: 0.0,    hasSSIncomeTax: false, avgPropertyTaxRate: 0.015,  costOfLivingIndex: 90,  pensionExemptPerPerson: 0,        tradExemptPerPerson: 0        },
"Florida":     { incomeTax: 0.0,    hasSSIncomeTax: false, avgPropertyTaxRate: 0.0089, costOfLivingIndex: 103, pensionExemptPerPerson: 0,        tradExemptPerPerson: 0        },
"California":  { incomeTax: 0.093,  hasSSIncomeTax: false, avgPropertyTaxRate: 0.0073, costOfLivingIndex: 151, pensionExemptPerPerson: 0,        tradExemptPerPerson: 0        },
```

- [ ] **Step 2.2: Run existing tests to confirm no regression**

```bash
npx vitest run
```

Expected: all existing tests pass (stateData.js changes are purely additive; no logic was touched yet).

- [ ] **Step 2.3: Commit**

```bash
git add src/data/stateData.js
git commit -m "feat: add pension and trad withdrawal exemption data for all 50 states"
```

---

## Task 3: Update `calc.js` pension pre-loop + return value (TDD)

**Files:**
- Modify: `tests/calc.test.js` (add cases first)
- Modify: `src/utils/calc.js` (lines 96–120 pension pre-loop + return block)

- [ ] **Step 3.1: Write failing regression tests**

Add to the bottom of `tests/calc.test.js`:

```js
// Helper stateInfo objects for exemption tests
const illinoisInfo = {
  incomeTax: 0.0495, hasSSIncomeTax: false, avgPropertyTaxRate: 0.0227,
  costOfLivingIndex: 95, pensionExemptPerPerson: Infinity, tradExemptPerPerson: Infinity,
};
const georgiaInfo = {
  incomeTax: 0.055, hasSSIncomeTax: false, avgPropertyTaxRate: 0.0092,
  costOfLivingIndex: 93, pensionExemptPerPerson: 65000, tradExemptPerPerson: 65000,
};

describe('State retirement income exemptions — pension pre-loop', () => {
  it('Illinois: pension net equals full pension (no state tax, full exemption)', () => {
    // Illinois exempts all retirement income; pensionStateTax should be 0
    const result = runProjection({
      ...BASE,
      pension: 2000,  // $2,000/mo = $24,000/yr — well under Infinity exemption
      stateInfo: illinoisInfo,
    });
    // stateTaxMonthly = ssStateTax + nonSSNonPension tax + pension tax + spousePension tax
    // With full exemption: pension portion = 0
    // BASE has ss1=2000, hasSSIncomeTax=false → ssStateTax=0
    // BASE has no part-time/rental → nonSSNonPension=0
    // Expected: stateTaxMonthly = 0
    expect(result.stateTaxMonthly).toBe(0);
  });

  it('Georgia: pension under $65K cap has no state tax', () => {
    // Pension of $3,000/mo = $36,000/yr — under $65K cap → no state tax
    const result = runProjection({
      ...BASE,
      pension: 3000,
      stateInfo: georgiaInfo,
    });
    expect(result.stateTaxMonthly).toBe(0);
  });

  it('Georgia: pension over $65K cap — only excess is taxed', () => {
    // Pension of $8,000/mo = $96,000/yr → taxable = $96,000 - $65,000 = $31,000/yr
    // state tax = $31,000 * 0.055 = $1,705/yr = ~$142/mo
    const result = runProjection({
      ...BASE,
      pension: 8000,
      stateInfo: georgiaInfo,
    });
    expect(result.stateTaxMonthly).toBeCloseTo(142, 0);
  });

  it('Illinois: stateExemptionSavingsMonthly equals what flat-rate would have charged', () => {
    // Illinois rate 4.95%, pension $2,000/mo = $24,000/yr
    // Old flat-rate tax: $2,000 * 0.0495 = $99/mo
    // New exemption-adjusted: $0/mo
    // Savings = $99/mo
    const result = runProjection({
      ...BASE,
      pension: 2000,
      stateInfo: illinoisInfo,
    });
    const expectedSavings = Math.round(2000 * 0.0495);
    expect(result.stateExemptionSavingsMonthly).toBe(expectedSavings);
  });
});
```

- [ ] **Step 3.2: Run tests — confirm they fail**

```bash
npx vitest run tests/calc.test.js
```

Expected: 4 new tests fail. Existing tests still pass.

- [ ] **Step 3.3: Import `computeStateTax` in `calc.js`**

At the top of `src/utils/calc.js`, add the import:

```js
import { computeStateTax } from './stateTax';
```

- [ ] **Step 3.4: Replace pension pre-loop in `calc.js`**

Find and replace lines 96–120 (the four pension pre-computations). Replace these lines:

```js
// BEFORE (remove these):
const pensionStateTax   = pension * stateInfo.incomeTax;
const pensionNetMonthly = pension - pensionStateTax;
// ...
// const retPensionNetMonthly = pension - pension * retirementStateInfo.incomeTax;
// const retSpousePensionNetMonthly = spousePension - spousePension * retirementStateInfo.incomeTax;
// ...
const spousePensionStateTax      = spousePension * stateInfo.incomeTax;
const spousePensionNetMonthly    = spousePension - spousePensionStateTax;
const retSpousePensionNetMonthly = spousePension - spousePension * retirementStateInfo.incomeTax;
```

With:

```js
// Primary pension — current state (personCount: 1; each pension belongs to one person)
const pensionStateTax   = computeStateTax({ grossAnnual: pension * 12, stateInfo, type: 'pension', personCount: 1 }) / 12;
const pensionNetMonthly = pension - pensionStateTax;

// Spouse pension — current state
const spousePensionStateTax   = computeStateTax({ grossAnnual: spousePension * 12, stateInfo, type: 'pension', personCount: 1 }) / 12;
const spousePensionNetMonthly = spousePension - spousePensionStateTax;

// Primary pension — retirement state (note: retirementStateInfo, not stateInfo)
const retPensionNetMonthly = pension - computeStateTax({ grossAnnual: pension * 12, stateInfo: retirementStateInfo, type: 'pension', personCount: 1 }) / 12;

// Spouse pension — retirement state (note: retirementStateInfo, not stateInfo)
const retSpousePensionNetMonthly = spousePension - computeStateTax({ grossAnnual: spousePension * 12, stateInfo: retirementStateInfo, type: 'pension', personCount: 1 }) / 12;
```

Note: `pension` is a monthly dollar value from inputs. Multiplying by 12 converts to annual for `computeStateTax`, then dividing by 12 converts back to monthly.

- [ ] **Step 3.5: Add `stateExemptionSavingsMonthly` computation**

Immediately after the four pension lines above, add:

```js
// Pension exemption savings: difference between old flat-rate tax and new exemption-adjusted tax.
// Uses current state only (summary cards show current-state figures, not retirement-state).
// Pension-only — trad exemption savings vary by withdrawal amount and are not included here.
const oldPensionTax       = pension       * stateInfo.incomeTax / 12;
const oldSpousePensionTax = spousePension * stateInfo.incomeTax / 12;
const stateExemptionSavingsMonthly = Math.round(
  (oldPensionTax - pensionStateTax) + (oldSpousePensionTax - spousePensionStateTax)
);
```

- [ ] **Step 3.6: Add `stateExemptionSavingsMonthly` to the return value**

In the `return { ... }` block at the end of `runProjection()`, add:

```js
stateExemptionSavingsMonthly,
```

- [ ] **Step 3.7: Run tests — confirm new tests pass and no regressions**

```bash
npx vitest run
```

Expected: all tests pass including the 4 new ones.

- [ ] **Step 3.8: Commit**

```bash
git add src/utils/calc.js tests/calc.test.js
git commit -m "feat: apply pension exemptions in calc.js pre-loop, expose stateExemptionSavingsMonthly"
```

---

## Task 4: Update `calc.js` trad withdrawal gross-up (TDD)

**Files:**
- Modify: `tests/calc.test.js` (add failing test first)
- Modify: `src/utils/calc.js` (drawdown loop, trad gross-up section, lines ~407–408)

- [ ] **Step 4.1: Write a failing trad-exemption test**

Add to `tests/calc.test.js` (below the Task 3 tests):

```js
describe('State retirement income exemptions — trad withdrawal loop', () => {
  it('Illinois: trad withdrawal runway is longer than California (same inputs, higher trad balance)', () => {
    // Illinois exempts all trad withdrawals; California does not.
    // With a large trad balance, Illinois users pay less state tax on withdrawals → portfolio lasts longer.
    const californiaInfo = {
      incomeTax: 0.093, hasSSIncomeTax: false, avgPropertyTaxRate: 0.0073,
      costOfLivingIndex: 100, pensionExemptPerPerson: 0, tradExemptPerPerson: 0,
    };
    const illinoisInfoNormalized = { ...illinoisInfo, costOfLivingIndex: 100, avgPropertyTaxRate: 0.0073 };
    const califResult = runProjection({ ...BASE, stateInfo: californiaInfo, trad401k: 500000, tradIRA: 100000 });
    const ilResult    = runProjection({ ...BASE, stateInfo: illinoisInfoNormalized, trad401k: 500000, tradIRA: 100000 });
    expect(ilResult.runwayYears).toBeGreaterThan(califResult.runwayYears);
  });
});
```

- [ ] **Step 4.2: Run test — confirm it fails**

```bash
npx vitest run tests/calc.test.js
```

Expected: the new test fails (Illinois and California produce same runway since exemption is not yet applied to trad).

- [ ] **Step 4.4: Replace trad gross-up in the drawdown loop**

Find this block in the drawdown loop (after the bucket spending allocation):

```js
// State tax on Traditional spending (flat-rate gross-up is exact).
// RMD excess is already included in tradSpend so it's captured here automatically.
const tradGross      = activeStateTaxRate < 1 ? tradSpend / (1 - activeStateTaxRate) : tradSpend;
const stateTaxOnTrad = tradGross - tradSpend;
```

Replace with:

```js
// State tax on Traditional spending — gross-up with per-person exemption.
// tradPersonCount: each person has their own tradExemptPerPerson; survivor phase = 1 person.
// Exemption is applied to tradSpend (net) as a simplification — mathematically it applies to
// gross, but since state rates are flat (max ~10%) the understatement is < 0.5% of the exempted
// amount. This avoids a circular dependency between the gross-up and the exemption.
const tradPersonCount  = isSurvivor ? 1 : (hasSpouse ? 2 : 1);
const tradExemptAnnual = ((hasMoved ? retirementStateInfo : stateInfo).tradExemptPerPerson ?? 0) * tradPersonCount;
const taxableTrad      = Math.max(0, tradSpend - tradExemptAnnual);
const stateTaxOnTrad   = activeStateTaxRate > 0 && activeStateTaxRate < 1
  ? taxableTrad * activeStateTaxRate / (1 - activeStateTaxRate)
  : 0;
const tradGross        = tradSpend + stateTaxOnTrad;
```

- [ ] **Step 4.5: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass including the new trad-exemption test.

- [ ] **Step 4.6: Commit**

```bash
git add src/utils/calc.js
git commit -m "feat: apply trad withdrawal exemptions in drawdown loop gross-up"
```

---

## Task 5: Add "Pension exemption savings" to UI

**Files:**
- Modify: `src/steps/ResultsStep.jsx`

- [ ] **Step 5.1: Add the new row in the Tax Snapshot**

In `ResultsStep.jsx`, find the "State Tax" row (around line 526–529):

```jsx
<div className="tax-snapshot-row">
  <span className="tax-snapshot-label">{state} State Tax</span>
  <span className="tax-snapshot-value">−${results.stateTaxMonthly.toLocaleString()}/mo</span>
</div>
```

Add the exemption savings row immediately after it:

```jsx
<div className="tax-snapshot-row">
  <span className="tax-snapshot-label">{state} State Tax</span>
  <span className="tax-snapshot-value">−${results.stateTaxMonthly.toLocaleString()}/mo</span>
</div>
{results.stateExemptionSavingsMonthly > 0 && (
  <div className="tax-snapshot-row">
    <span className="tax-snapshot-label" style={{ paddingLeft: 12, color: 'var(--color-green, #4caf50)', fontSize: '0.9em' }}>
      Pension exemption savings
    </span>
    <span className="tax-snapshot-value" style={{ color: 'var(--color-green, #4caf50)', fontSize: '0.9em' }}>
      −${results.stateExemptionSavingsMonthly.toLocaleString()}/mo
    </span>
  </div>
)}
```

Note: `results.stateTaxMonthly` already reflects the exemption-adjusted tax — the savings row is a display-only annotation explaining why the state tax is lower than a flat-rate calculation would suggest. The total row formula is unchanged.

- [ ] **Step 5.2: Verify rendering**

Set state to Illinois in the app with a pension income entered, navigate to Results step, confirm:
- "Illinois State Tax" shows a reduced value (or $0 if pension is the only income)
- "Pension exemption savings" line appears below it in green showing the monthly savings
- Total row is unchanged

Set state to California with a pension — confirm no exemption savings line appears.

- [ ] **Step 5.3: Commit**

```bash
git add src/steps/ResultsStep.jsx
git commit -m "feat: show pension exemption savings in Tax & Cost Summary"
```

---

## Task 6: Feature branch and PR

- [ ] **Step 6.1: Run full test suite one final time**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6.2: Create feature branch and push**

This work is on `main` if done inline. If using a worktree, it's already on a feature branch. Confirm branch name and push:

```bash
git checkout -b feat/state-retirement-exemptions
git push -u origin feat/state-retirement-exemptions
```

- [ ] **Step 6.3: Open PR**

```bash
gh pr create \
  --title "feat: state retirement income exemptions (pension + trad IRA/401k)" \
  --body "$(cat <<'EOF'
## Summary
- Adds `pensionExemptPerPerson` and `tradExemptPerPerson` to all 50 states in `stateData.js`
- New `src/utils/stateTax.js` helper computes state tax with per-person exemption caps
- Updates `calc.js` pension pre-loop and trad withdrawal gross-up to apply exemptions
- Surfaces pension exemption savings in Tax & Cost Summary (shown only when > $0)
- Iowa incomeTax corrected to 0 (state eliminated income tax in 2025)

## Test plan
- [ ] `npx vitest run` — all tests pass
- [ ] Set state to Illinois with pension income → state tax is $0, green savings line appears
- [ ] Set state to Georgia with $3K/mo pension → state tax is $0 (under $65K cap)
- [ ] Set state to Georgia with $8K/mo pension → state tax ~$142/mo (only excess above $65K taxed)
- [ ] Set state to California → no savings line appears
- [ ] Set state to Florida (no income tax) → no savings line appears

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
