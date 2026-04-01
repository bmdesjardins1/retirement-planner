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
`ss1` and `ss2` are frozen at year-0 values for the entire retirement. Currently SS is bundled into `nonPensionNetWithPT/WithoutPT` and multiplied by `generalFactor` inside the loop — so SS is being inflated at the general CPI rate, not an SSA COLA rate, and it can't be controlled separately.

### Design

**New `runProjection()` param:**
```js
ssCola = 2.5  // default, percent per year
```

**Separate SS from the non-pension income bundle.** Currently:
```js
const nonPensionGrossWithPT = ssMonthly + partTimeIncome + rentalIncome;
```
Becomes two separate streams:
- `nonSSNonPensionNet` — part-time + rental, inflated by `generalFactor` as before
- SS handled independently with its own COLA factor

**Inside the drawdown loop**, for each year `y` (years since retirement start):
```js
const ssColaFactor = Math.pow(1 + ssCola / 100, y);
const ssGrossAnnual = activeSSMonthly * 12 * ssColaFactor;
const ssStateTax = activeSSTaxableMonthly * 12 * ssColaFactor * activeStateTaxRate;
const ssNetAnnual = ssGrossAnnual - ssStateTax;
```

`activeSSMonthly` and `activeSSTaxableMonthly` are the survivor-adjusted equivalents of `ssMonthly` and `ssTaxableMonthly` (same survivor logic that already exists for the other income streams).

**Real-terms SS for federal tax estimation** — the federal tax function receives `ssAnnual` in real terms. With COLA:
```js
const realSSAnnual = (activeSSMonthly * 12 * ssColaFactor) / generalFactor;
```
This replaces the current `activeRealSS` passed to `estimateFederalTax`.

**`yearlyIncome` updated:**
```js
const yearlyIncome = ssNetAnnual + (activeNonSSNonPensionNet * 12 * generalFactor) + pensionContrib;
```

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
- Verify that with `ssCola=0`, SS income is identical to year-0 value throughout retirement
- Verify that with `ssCola=2.5`, SS income in year 10 is `ssMonthly * 12 * 1.025^10`
- Verify that a higher COLA rate increases `portfolioAtRetirement` (more income = less withdrawal)

---

## Fix 2: Early Withdrawal Penalty

### Problem
No 10% IRS penalty applied when traditional account withdrawals are taken before age 59.5. This makes early retirement scenarios (e.g., retire at 55) systematically too optimistic.

### Design

Inside the drawdown loop, after `tradSpend` is computed:
```js
const earlyWithdrawalPenalty = ageInYear < 59.5 ? tradSpend * 0.10 : 0;
```

Add `earlyWithdrawalPenalty` to `yearlyWithdrawal`:
```js
const yearlyWithdrawal = preTaxGap + stateTaxOnTrad + capGainsTax + federalTax + earlyWithdrawalPenalty;
```

Also include `earlyWithdrawalPenalty` in the returned `federalTaxMonthly` value (it's an IRS payment, reported alongside federal tax):
```js
federalTaxMonthly: (federalTax + earlyWithdrawalPenalty) / 12
```

No UI changes needed. The penalty is baked silently into the projection — users retiring before 59.5 will see a worse outcome, which is correct behavior.

**Known simplification:** Rule 72(t) SEPP distributions are a legal way to avoid the penalty before 59.5. This is a planning technique that applies to a small subset of users; we do not model it. This is an acceptable simplification at financial-planner quality.

### Tests
- Verify that with `retirementAge=55`, `tradSpend * 0.10` is added to the tax bill for ages 55–59
- Verify that at age 60, no penalty is applied
- Verify that with `retirementAge=62`, no penalty is ever applied

---

## Fix 3: Medicare Part B Base Premium

### Problem
The IRMAA surcharge (income-based extra charge) is auto-applied at age 65. The base Medicare Part B premium (~$174.70/month per person in 2024) is not modeled — users must remember to include it in their healthcare input with no guidance.

### Design

**New constant in `calc.js`:**
```js
const MEDICARE_PART_B_MONTHLY_2024 = 174.70; // per person, 2024 base premium
```

**Inside the drawdown loop**, compute Part B cost for primary and spouse:
```js
const yearsFrom65Primary = Math.max(0, ageInYear - 65);
const primaryPartB = ageInYear >= 65
  ? MEDICARE_PART_B_MONTHLY_2024 * Math.pow(1 + healthcareInflation / 100, yearsFrom65Primary)
  : 0;

const spouseAgeInYear = hasSpouse ? spouseAge + (retirementAge - currentAge) + y : 0;
const yearsFrom65Spouse = Math.max(0, spouseAgeInYear - 65);
const spousePartB = hasSpouse && spouseAgeInYear >= 65
  ? MEDICARE_PART_B_MONTHLY_2024 * Math.pow(1 + healthcareInflation / 100, yearsFrom65Spouse)
  : 0;

const annualPartB = (primaryPartB + spousePartB) * 12;
```

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
- Verify Part B inflates at `healthcareInflation` rate year over year
- Verify spouse Part B added when `hasSpouse=true` and spouse age >= 65
- Verify spouse Part B not added when `hasSpouse=false`

---

## Fix 4: Home Appreciation + Mortgage Payoff at Sale

### Problem
Home sale proceeds use today's home value with no appreciation, and the current mortgage balance is always subtracted even if the mortgage will be paid off before the sale.

### Design

**Home appreciation** — apply general inflation compounding before computing proceeds:
```js
const yearsUntilSale = homeSaleAge - currentAge;
const appreciatedHomeValue = homeValue * Math.pow(1 + inflation / 100, yearsUntilSale);
```

**Mortgage balance at sale** — if the mortgage is paid off before the sale date, balance is $0:
```js
const mortgageBalanceAtSale = mortgagePayoffAge <= homeSaleAge ? 0 : mortgageBalance;
```

**Updated proceeds calculation:**
```js
if (homeOwned && homeSaleIntent === "sell" && ageInYear === homeSaleAge) {
  homeSaleProceeds = Math.max(0, appreciatedHomeValue - mortgageBalanceAtSale) * 0.95;
  taxableBucket += homeSaleProceeds;
}
```

`appreciatedHomeValue` and `mortgageBalanceAtSale` are computed once before the drawdown loop (they don't change year to year).

**Known simplification:** Mortgage amortization is not modeled — if `mortgagePayoffAge > homeSaleAge`, the full current balance is used. Full amortization requires adding mortgage rate and term inputs, deferred to Track B.

### Tests
- Verify that selling a $400K home in 20 years at 3% inflation produces proceeds based on ~$722K value (not $400K)
- Verify that `mortgagePayoffAge <= homeSaleAge` results in $0 mortgage balance at sale
- Verify that `mortgagePayoffAge > homeSaleAge` uses the entered `mortgageBalance`
- Verify `homeSaleIntent !== "sell"` produces $0 proceeds regardless of home value

---

## Fix 5: State Capital Gains Tax on Taxable Withdrawals

### Problem
`estimateCapitalGainsTax()` computes only federal capital gains tax on taxable brokerage withdrawals. Most states tax capital gains as ordinary income at the state rate.

### Design

After the existing `capGainsTax` computation, add state tax on capital gains:
```js
const stateTaxOnCapGains = realCapGains * generalFactor * activeStateTaxRate;
```

Add to `yearlyWithdrawal`:
```js
const yearlyWithdrawal = preTaxGap + stateTaxOnTrad + capGainsTax + stateTaxOnCapGains + federalTax + earlyWithdrawalPenalty;
```

`realCapGains` is already computed just above (`(taxableSpend * 0.60) / generalFactor`). Multiplying back by `generalFactor` converts it to nominal terms for the state tax application. States with no income tax have `activeStateTaxRate = 0`, so no special casing is needed.

**Note:** Traditional withdrawals already have state tax applied via `stateTaxOnTrad`. Roth withdrawals correctly have no state tax.

### Tests
- Verify that a state with `incomeTax=0.093` (California) adds state tax on 60% of taxable brokerage withdrawals
- Verify that a state with `incomeTax=0` (Florida) adds $0 state cap gains tax
- Verify that `tradSpend` state tax is not affected (traditional tax path unchanged)

---

## Testing Approach

All new tests go in `tests/calc.test.js`. Each fix gets its own `describe` block. Tests call `runProjection()` with minimal inputs and assert on specific return values or `yearsData` entries.

Existing 69 tests must continue to pass. The SS COLA fix changes the default behavior (previously SS was growing at the general inflation rate via `generalFactor`; now it grows at `ssCola=2.5%` by default), so some existing test assertions involving SS income may need to be updated to reflect the corrected model.
