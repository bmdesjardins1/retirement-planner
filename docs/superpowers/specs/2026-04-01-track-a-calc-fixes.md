# Track A Calculation Fixes — Design Spec

## Goal

Fix five confirmed gaps in `calc.js` identified in the 2026-03-31 model audit, bringing the projection to financial-planner quality. All fixes are targeted changes — no new architecture, no new files.

## Files Changed

| File | Change |
|------|--------|
| `src/utils/calc.js` | All 5 calculation fixes |
| `src/context/PlannerContext.jsx` | Add `ssCola` state (default 2.5) |
| `src/steps/IncomeStep.jsx` | Add SS COLA rate input field |
| `src/steps/SpendingStep.jsx` | Add Medicare Part B note under healthcare input |
| `tests/calc.test.js` | New tests for each fix |

---

## Fix 1: SS COLA

### Problem
`ss1` and `ss2` are frozen at year-0 values for the entire retirement. Currently SS is bundled into `nonPensionNetWithPT/WithoutPT` (and their survivor/retirement-state variants) and multiplied by `generalFactor` inside the loop — so SS is being inflated at the general CPI rate, not an SSA COLA rate, and it can't be controlled separately.

### Design

**New `runProjection()` param:**
```js
ssCola = 2.5  // default, percent per year
```

**Refactor the pre-computed non-pension bundles.** The current code has 8 pre-computed bundle variables that each embed SS:
```
nonPensionGrossWithPT / nonPensionGrossWithoutPT
nonPensionNetWithPT   / nonPensionNetWithoutPT
retNonPensionNetWithPT / retNonPensionNetWithoutPT          (retirement-state variants)
retNonPensionNetWithPTAlone / retNonPensionNetWithoutPTAlone (survivor variants)
```

All 8 must be refactored to exclude SS. They become `nonSSNonPensionNet*` variants containing only part-time income and rental income. Their calculation and selection logic is otherwise unchanged — only the SS terms are removed.

**Two new pre-computed SS variables (before the loop):**
```js
const ssMonthlyTaxable = stateInfo.hasSSIncomeTax ? ssMonthly : 0;
// Survivor-phase equivalents (mirror the existing Alone logic for other income streams):
const ssMonthlyAlone        = ss1;           // primary-only after spouse death
const ssMonthlyTaxableAlone = stateInfo.hasSSIncomeTax ? ss1 : 0;
```

**Inside the drawdown loop**, define survivor-adjusted SS variables (matching the `isSurvivor` pattern already used for other streams):
```js
const activeSSMonthly        = isSurvivor ? ssMonthlyAlone        : ssMonthly;
const activeSSTaxableMonthly = isSurvivor ? ssMonthlyTaxableAlone : ssMonthlyTaxable;
```

Then compute SS income with COLA applied:
```js
const ssColaFactor  = Math.pow(1 + ssCola / 100, y);
const ssGrossAnnual = activeSSMonthly * 12 * ssColaFactor;
const ssStateTax    = activeSSTaxableMonthly * 12 * ssColaFactor * activeStateTaxRate;
const ssNetAnnual   = ssGrossAnnual - ssStateTax;
```

**`yearlyIncome` updated:**
```js
const yearlyIncome = ssNetAnnual + (activeNonSSNonPensionNet * 12 * generalFactor) + pensionContrib;
```
where `activeNonSSNonPensionNet` is the survivor/PT-adjusted non-SS non-pension net (same selection logic as the old `baseNonPensionNet`, applied to the refactored bundles).

**Real-terms SS for federal tax estimation.** The existing `activeRealSS` (line 274) is replaced throughout the loop by:
```js
const realSSAnnual = (activeSSMonthly * 12 * ssColaFactor) / generalFactor;
```
Both `estimateFederalTax` calls in the loop (the two-iteration gross-up) receive `ssAnnual: realSSAnnual` instead of `ssAnnual: activeRealSS`.

**Year-0 summary estimate** (lines 445–453, outside the loop — computes `federalTaxMonthly` for the display cards): this call uses `ssMonthly * 12` directly and should not be changed. COLA does not apply at year 0.

**PlannerContext:**
- New state: `const [ssCola, setSsCola] = useState(2.5)`
- Passed to all three `runProjection()` calls: `{ ..., ssCola }`

**IncomeStep UI:**
- New `FieldInput` labeled **"SS Annual COLA"**
- `value={ssCola}`, `min={0}`, `max={4}`, `step={0.1}`, `suffix="%"`, `onChange={setSsCola}`
- Note: `"SSA historical average ~2.5%/yr. Use 0% to model no COLA."`
- Placed after the SS claim age inputs, before the spouse SS section
- Only shown when `ss1 > 0` (if no SS entered, COLA is irrelevant)

### Tests
- Verify that with `ssCola=0`, SS income in `yearsData` is identical to year-0 value throughout retirement
- Verify that with `ssCola=2.5`, SS income in year 10 equals `ssMonthly * 12 * 1.025^10`
- Verify that a higher `ssCola` reduces the portfolio withdrawal needed each year (portfolio lasts longer)
- Audit all existing tests that pass `ss1 > 0` or `ss2 > 0` — assertions on income/portfolio values will shift because the default COLA rate (2.5%) differs from the old behavior (growing at `generalFactor`). Update those tests to use `ssCola=0` to isolate SS from the change, or update expected values to reflect the corrected model.

---

## Fix 2: Early Withdrawal Penalty

### Problem
No 10% IRS penalty applied when traditional account withdrawals are taken before age 59.5. This makes early retirement scenarios (e.g., retire at 55) systematically too optimistic.

### Design

Inside the drawdown loop, after `tradSpend` is computed:
```js
const earlyWithdrawalPenalty = ageInYear < 59.5 ? tradSpend * 0.10 : 0;
```

Add `earlyWithdrawalPenalty` to `yearlyWithdrawal` only:
```js
const yearlyWithdrawal = preTaxGap + stateTaxOnTrad + capGainsTax + stateTaxOnCapGains + federalTax + earlyWithdrawalPenalty;
```

Do **not** add it to `federalTaxMonthly`. That value is computed outside the loop as a year-0 summary estimate — the penalty is loop-internal and scoped to specific drawdown years. The penalty affects the portfolio deduction silently.

No UI changes needed. The penalty is baked silently into the projection — users retiring before 59.5 will see a worse outcome, which is correct behavior.

**Known simplification:** Rule 72(t) SEPP distributions are a legal way to avoid the penalty before 59.5. This is a planning technique that applies to a small subset of users; we do not model it. This is an acceptable simplification at financial-planner quality.

### Tests
- Verify that with `retirementAge=55`, `tradSpend * 0.10` is added to `yearlyWithdrawal` for years where `ageInYear < 59.5`
- Verify that at `ageInYear=60`, `earlyWithdrawalPenalty === 0`
- Verify that with `retirementAge=62`, `earlyWithdrawalPenalty === 0` for all years

---

## Fix 3: Medicare Part B Base Premium

### Problem
The IRMAA surcharge (income-based extra charge) is auto-applied at age 65. The base Medicare Part B premium (~$174.70/month per person in 2024) is not modeled — users must remember to include it in their healthcare input with no guidance.

### Design

**New constant in `calc.js`:**
```js
const MEDICARE_PART_B_MONTHLY_2024 = 174.70; // per person, 2024 base premium
```

**Inside the drawdown loop**, `spouseAgeInYear` already exists in scope (used for IRMAA). Reuse it — do not redeclare it.

Compute Part B cost for primary and spouse:
```js
const primaryPartB = ageInYear >= 65
  ? MEDICARE_PART_B_MONTHLY_2024 * Math.pow(1 + healthcareInflation / 100, ageInYear - 65)
  : 0;

const spousePartB = hasSpouse && spouseAgeInYear >= 65
  ? MEDICARE_PART_B_MONTHLY_2024 * Math.pow(1 + healthcareInflation / 100, spouseAgeInYear - 65)
  : 0;

const annualPartB = (primaryPartB + spousePartB) * 12;
```

The inflation base is age 65 for each person (not drawdown year 0). This means Part B inflates from the year each person turns 65, independent of when retirement started. This is intentionally different from how user-entered healthcare costs inflate (which start from drawdown year 0), because the 2024 base constant represents the cost at age 65, not at the user's retirement age.

Add `annualPartB` to `yearlyNeed`:
```js
const yearlyNeed = (...existing terms...) + annualPartB;
```

**SpendingStep UI:**
- Add a note under the healthcare monthly input:
  `"Medicare Part B (~$175/mo per person) is added automatically at age 65 — do not include it here."`

### Tests
- Verify `annualPartB > 0` when `ageInYear >= 65`
- Verify `annualPartB === 0` when `ageInYear < 65`
- Verify Part B inflates correctly: at `ageInYear=75`, `primaryPartB = 174.70 * 1.055^10`
- Verify spouse Part B added when `hasSpouse=true` and spouse age >= 65
- Verify spouse Part B is $0 when `hasSpouse=false`

---

## Fix 4: Home Appreciation + Mortgage Payoff at Sale

### Problem
Home sale proceeds use today's home value with no appreciation, and the current mortgage balance is always subtracted even if the mortgage will be paid off before the sale.

### Design

Both values are computed **once before the drawdown loop** (they don't vary year to year):

**Home appreciation** — apply general inflation compounding:
```js
const yearsUntilSale = homeSaleAge - currentAge;  // currentAge is the destructured alias for `age`
const appreciatedHomeValue = homeValue * Math.pow(1 + inflation / 100, yearsUntilSale);
```

**Mortgage balance at sale** — zero if paid off before sale:
```js
const mortgageBalanceAtSale = mortgagePayoffAge <= homeSaleAge ? 0 : mortgageBalance;
```

**Updated proceeds calculation inside the loop:**
```js
if (homeOwned && homeSaleIntent === "sell" && ageInYear === homeSaleAge) {
  homeSaleProceeds = Math.max(0, appreciatedHomeValue - mortgageBalanceAtSale) * 0.95;
  taxableBucket += homeSaleProceeds;
}
```

**Known simplification:** If `mortgagePayoffAge > homeSaleAge`, the full current mortgage balance is used (no amortization). Full amortization requires adding mortgage rate and term inputs — deferred to Track B.

### Tests
- Verify that selling a $400K home in 20 years at `inflation=3` produces proceeds based on `$400K * 1.03^20 ≈ $722K` value
- Verify that `mortgagePayoffAge <= homeSaleAge` results in $0 mortgage balance subtracted at sale
- Verify that `mortgagePayoffAge > homeSaleAge` subtracts the entered `mortgageBalance`
- Verify `homeSaleIntent !== "sell"` produces $0 proceeds regardless

---

## Fix 5: State Capital Gains Tax on Taxable Withdrawals

### Problem
`estimateCapitalGainsTax()` computes only federal capital gains tax on taxable brokerage withdrawals. Most states tax capital gains as ordinary income at the state rate.

### Design

After the existing `capGainsTax` computation, add state tax on capital gains. Since `realCapGains = (taxableSpend * 0.60) / generalFactor`, multiplying back by `generalFactor` cancels, so write directly:
```js
const stateTaxOnCapGains = taxableSpend * 0.60 * activeStateTaxRate;
```

Add to `yearlyWithdrawal`:
```js
const yearlyWithdrawal = preTaxGap + stateTaxOnTrad + capGainsTax + stateTaxOnCapGains + federalTax + earlyWithdrawalPenalty;
```

States with no income tax have `activeStateTaxRate = 0`, so no special casing is needed.

**Note:** Traditional withdrawals already have state tax applied via `stateTaxOnTrad`. Roth withdrawals correctly have no state tax.

### Tests
- Verify that a state with `incomeTax=0.093` (California) adds `taxableSpend * 0.60 * 0.093` to the yearly tax bill
- Verify that a state with `incomeTax=0` (Florida) adds $0 state cap gains tax
- Verify that `tradSpend` state tax computation is not affected

---

## Testing Approach

All new tests go in `tests/calc.test.js`. Each fix gets its own `describe` block. Tests call `runProjection()` with minimal inputs and assert on specific return values or `yearsData` entries.

Existing 69 tests must continue to pass. **SS COLA audit required on existing tests:** any test that passes `ss1 > 0` or `ss2 > 0` and asserts on income, portfolio balance, or drawdown values will be affected by Fix 1. The implementer must review every such test and either:
- Set `ssCola: 0` to preserve existing behavior in that test, or
- Update expected values to reflect the corrected model (SS now grows at 2.5%/yr by default instead of at `generalFactor`)
