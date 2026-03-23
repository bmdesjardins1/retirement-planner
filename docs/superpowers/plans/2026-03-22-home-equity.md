# Home Equity as an Asset — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users model a planned home sale — net proceeds inject into the portfolio at the sale year and property tax stops, meaningfully extending retirement runway.

**Architecture:** Three new state fields (`mortgageBalance`, `homeSaleIntent`, `homeSaleAge`) flow through PlannerContext → `sharedInputs` → all three `runProjection` calls. In the drawdown loop, a `homeSold` flag zeros out property tax and a one-time `taxableBucket` injection adds net proceeds at the sale year. ResultsStep surfaces the event as a metric box in the Tax & Cost Summary card.

**Tech Stack:** React 18, Vite, Vitest (tests), plain JS

---

## Files Modified

| File | Change |
|---|---|
| `src/utils/calc.js` | New input params, `homeSold` flag, proceeds injection, `homeSaleProceeds` on yearsData |
| `src/context/PlannerContext.jsx` | 3 new state fields, constrained setter clamps, sharedInputs, dep arrays, context value |
| `src/steps/AssetsStep.jsx` | Mortgage balance slider, equity display, intent toggle, sale age slider |
| `src/steps/ResultsStep.jsx` | `homeSaleYear` lookup, metric box in Tax & Cost Summary |
| `tests/calc.test.js` | 6 new tests in `'Home equity sale'` describe block |

---

## Task 1: Feature branch

**Files:** none

- [ ] **Step 1: Create the feature branch**

```bash
git checkout -b feat/home-equity
```

- [ ] **Step 2: Verify you are on the right branch**

```bash
git branch
```

Expected: `* feat/home-equity`

---

## Task 2: Write failing tests for home equity calc behavior

**Files:**
- Modify: `tests/calc.test.js`

The BASE fixture already has `homeValue: 300000, homeOwned: true`. The new calc params default to safe values (`mortgageBalance=0`, `homeSaleIntent="keep"`, `homeSaleAge=Infinity`), so existing tests are unaffected. All 6 tests below will FAIL until Task 3 adds `homeSaleProceeds` to yearsData.

- [ ] **Step 1: Add the describe block to `tests/calc.test.js`**

Append after the last existing `describe` block (after the IRMAA tests):

```js
describe('Home equity sale', () => {
  it('homeSaleIntent keep produces no sale proceeds', () => {
    const result = runProjection({ ...BASE, homeSaleIntent: 'keep', homeSaleAge: 70 });
    // Use every(d => d.homeSaleProceeds === 0) — not some(...> 0) — so this test
    // FAILS before implementation (undefined === 0 is false). The >0 form would
    // pass even when the field doesn't exist yet (undefined > 0 === false).
    expect(result.yearsData.every(d => d.homeSaleProceeds === 0)).toBe(true);
  });

  it('sell injects proceeds at sale age', () => {
    const result = runProjection({
      ...BASE, mortgageBalance: 0, homeSaleIntent: 'sell', homeSaleAge: 70,
    });
    const saleYear = result.yearsData.find(d => d.age === 70);
    expect(saleYear.homeSaleProceeds).toBeGreaterThan(0);
    // homeValue 300000 - mortgageBalance 0 = 300000 × 0.95 = 285000
    expect(saleYear.homeSaleProceeds).toBeCloseTo(285000, -3);
  });

  it('property tax is lower in and after sale year compared to year before', () => {
    const result = runProjection({
      ...BASE, mortgageBalance: 0, homeSaleIntent: 'sell', homeSaleAge: 70,
    });
    const preSale  = result.yearsData.find(d => d.age === 69);
    const saleYear = result.yearsData.find(d => d.age === 70);
    // Property tax = 300000 × 0.009 / 12 × 12 = 2700/yr removed from expenses
    expect(saleYear.expenses).toBeLessThan(preSale.expenses);
  });

  it('proceeds are 0 when mortgageBalance >= homeValue', () => {
    const result = runProjection({
      ...BASE, mortgageBalance: 400000, homeSaleIntent: 'sell', homeSaleAge: 70,
    });
    const saleYear = result.yearsData.find(d => d.age === 70);
    expect(saleYear.homeSaleProceeds).toBe(0);
  });

  it('selling home extends runway compared to keeping', () => {
    // Use a tight scenario so runway difference is visible
    const tight = {
      ...BASE,
      ss1: 500,
      trad401k: 30000, tradIRA: 0, taxableBrokerage: 0,
      annualContrib401k: 0, employerMatch: 0, annualContribIRA: 0,
      homeValue: 350000, mortgageBalance: 0, homeSaleAge: 68,
    };
    const sell = runProjection({ ...tight, homeSaleIntent: 'sell' });
    const keep = runProjection({ ...tight, homeSaleIntent: 'keep' });
    expect(sell.runwayYears).toBeGreaterThan(keep.runwayYears);
  });

  it('proceeds appear in first drawdown year when homeSaleAge equals retirementAge', () => {
    const result = runProjection({
      ...BASE, mortgageBalance: 0, homeSaleIntent: 'sell', homeSaleAge: 65,
    });
    const firstYear = result.yearsData.find(d => d.age === 65);
    expect(firstYear.homeSaleProceeds).toBeGreaterThan(0);
    // Property tax also stops at age 65 — expenses less than keep version
    const keepResult = runProjection({ ...BASE, homeSaleIntent: 'keep', homeSaleAge: 65 });
    const keepFirst  = keepResult.yearsData.find(d => d.age === 65);
    expect(firstYear.expenses).toBeLessThan(keepFirst.expenses);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm test
```

Expected: 6 new tests FAIL with `Cannot read properties of undefined (reading 'homeSaleProceeds')` or similar — `homeSaleProceeds` doesn't exist yet on yearsData.

---

## Task 3: Implement calc.js changes

**Files:**
- Modify: `src/utils/calc.js`

Three changes: (1) new input params, (2) `homeSold` flag + property tax guard, (3) proceeds injection + yearsData field.

- [ ] **Step 1: Add new params to inputs destructuring**

Find the inputs destructuring block (starts at line ~38, has `homeValue, homeOwned`). Add three new lines after `homeOwned`:

```js
mortgageBalance = 0,
homeSaleIntent = "keep",
homeSaleAge = Infinity,
```

The full block excerpt with context:

```js
homeValue, homeOwned,
mortgageBalance = 0,
homeSaleIntent = "keep",
homeSaleAge = Infinity,
investmentReturn, inflation, healthcareInflation,
```

- [ ] **Step 2: Replace the `activeMonthlyPropertyTax` line with `homeSold` guard**

In the drawdown `for` loop, find this existing line (around line 229):

```js
const activeMonthlyPropertyTax = hasMoved ? retMonthlyPropertyTax : monthlyPropertyTax;
```

Replace it with:

```js
// Home sale: property tax stops in and after the sale year.
// Stopping the full year (not prorated) is an accepted simplification.
const homeSold = homeOwned && homeSaleIntent === "sell" && ageInYear >= homeSaleAge;
const activeMonthlyPropertyTax = homeSold
  ? 0
  : (hasMoved ? retMonthlyPropertyTax : monthlyPropertyTax);
```

- [ ] **Step 3: Add proceeds injection after bucket growth, before spending allocation**

In the drawdown loop, find the bucket growth block (three lines ending with `rothBucket += rothBucket * bucketGrowthRate;`). Immediately after those three lines, add:

```js
// Home sale proceeds: inject into taxableBucket at the sale year.
// taxableBucket is the right destination — proceeds go into a taxable brokerage
// account in practice. The 60%-gains assumption applies on withdrawal (a minor
// overstatement since actual home sale proceeds are tax-free principal after
// the primary residence exclusion, but acceptable for a planning tool).
// Net proceeds = 95% of equity after realtor fees + closing costs.
// mortgageBalance is today's balance — paydown before sale is not modeled.
let homeSaleProceeds = 0;
if (homeOwned && homeSaleIntent === "sell" && ageInYear === homeSaleAge) {
  homeSaleProceeds = Math.max(0, homeValue - mortgageBalance) * 0.95;
  taxableBucket += homeSaleProceeds;
}
```

- [ ] **Step 4: Add `homeSaleProceeds` to the drawdown `yearsData.push`**

In the drawdown loop's `yearsData.push({...})`, add:

```js
homeSaleProceeds: Math.round(homeSaleProceeds),
```

The push should now look like:

```js
yearsData.push({
  year: currentYear,
  age: ageInYear,
  portfolio: Math.max(Math.round(portfolio), 0),
  withdrawal: Math.round(yearlyWithdrawal),
  income: Math.round(yearlyIncome),
  expenses: Math.round(yearlyNeed),
  rmd: Math.round(rmdAmount),
  irmaa: Math.round(irmaaSurchargePerPerson),
  homeSaleProceeds: Math.round(homeSaleProceeds),
});
```

- [ ] **Step 5: Add `homeSaleProceeds: 0` to the accumulation `yearsData.push`**

In the accumulation `for` loop's `yearsData.push({...})`, add the field for shape consistency:

```js
yearsData.push({
  year: new Date().getFullYear() + y,
  age: currentAge + y,
  portfolio: Math.round(portfolio),
  withdrawal: 0,
  income: 0,
  expenses: 0,
  rmd: 0,
  irmaa: 0,
  homeSaleProceeds: 0,
});
```

- [ ] **Step 6: Run the tests**

```bash
npm test
```

Expected: All 6 new tests PASS. All existing tests still PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/calc.js tests/calc.test.js
git commit -m "feat: home equity sale — inject proceeds and stop property tax at sale age"
```

---

## Task 4: PlannerContext — state, constrained setters, sharedInputs

**Files:**
- Modify: `src/context/PlannerContext.jsx`

Four sub-changes: (1) state declarations, (2) constrained setter clamps, (3) sharedInputs, (4) useMemo dep arrays + context value.

- [ ] **Step 1: Add three state declarations**

After the existing `homeOwned` state line (around line 75), add:

```js
const [mortgageBalance, setMortgageBalance]   = useState(0);
const [homeSaleIntent, setHomeSaleIntent]     = useState("keep");
const [homeSaleAge, setHomeSaleAge]           = useState(retirementAge);
```

Note: `useState(retirementAge)` captures the initial value (65) — this is intentional. The constrained setters will keep it in sync as ages change.

- [ ] **Step 2: Add `homeSaleAge` clamp to `setAge`**

`setAge` calls `setRetirementAgeRaw(v)` directly when age exceeds retirementAge. Add a matching clamp for `homeSaleAge`. Find `setAge`:

```js
const setAge = (v) => {
  setAgeRaw(v);
  if (retirementAge < v)   setRetirementAgeRaw(v);
  if (lifeExpectancy <= v) setLifeExpectancyRaw(v + 1);
};
```

Add one line (same `v` that retirementAge was pushed to):

```js
const setAge = (v) => {
  setAgeRaw(v);
  if (retirementAge < v)   setRetirementAgeRaw(v);
  if (lifeExpectancy <= v) setLifeExpectancyRaw(v + 1);
  if (homeSaleAge < v)     setHomeSaleAge(v);  // < not <= : homeSaleAge === retirementAge is valid minimum
};
```

- [ ] **Step 3: Add `homeSaleAge` clamp to `setRetirementAge`**

Find `setRetirementAge`:

```js
const setRetirementAge = (v) => {
  setRetirementAgeRaw(v);
  if (lifeExpectancy <= v) setLifeExpectancyRaw(v + 1);
  if (partTimeEndAge < v)  setPartTimeEndAge(v);
  if (ltcStartAge < v)     setLtcStartAge(v);
};
```

Add one line:

```js
const setRetirementAge = (v) => {
  setRetirementAgeRaw(v);
  if (lifeExpectancy <= v) setLifeExpectancyRaw(v + 1);
  if (partTimeEndAge < v)  setPartTimeEndAge(v);
  if (ltcStartAge < v)     setLtcStartAge(v);
  if (homeSaleAge < v)     setHomeSaleAge(v);
};
```

- [ ] **Step 4: Add `homeSaleAge` clamp to `setLifeExpectancy`**

Find `setLifeExpectancy`:

```js
const setLifeExpectancy = (v) => {
  setLifeExpectancyRaw(Math.max(v, retirementAge + 1));
  if (ltcStartAge > v)     setLtcStartAge(v);
};
```

Add one line (clamps against raw `v`, matching the `ltcStartAge` pattern — the UI slider min prevents values below `retirementAge`):

```js
const setLifeExpectancy = (v) => {
  setLifeExpectancyRaw(Math.max(v, retirementAge + 1));
  if (ltcStartAge > v)     setLtcStartAge(v);
  if (homeSaleAge > v)     setHomeSaleAge(v);
};
```

- [ ] **Step 5: Add fields to `sharedInputs`**

Find the `sharedInputs` object (around line 139). Add three fields alongside the existing home-related ones:

```js
const sharedInputs = {
  pension, pensionCOLA, partTimeIncome, partTimeEndAge, rentalIncome,
  homeValue, homeOwned, mortgageBalance, homeSaleIntent, homeSaleAge,
  investmentReturn, inflation, healthcareInflation,
  housingType, housing, mortgagePayoffAge,
  food, healthcare, bridgeHealthcare, transport, leisure, other,
  longTermCare, ltcStartAge,
  stateInfo,
  moveAge: planningToMove ? moveAge : Infinity,
  retirementStateInfo: planningToMove ? retirementStateInfo : stateInfo,
};
```

- [ ] **Step 6: Add fields to all three `useMemo` dep arrays**

Each of the three `useMemo` calls has a dep array. Add `mortgageBalance, homeSaleIntent, homeSaleAge` to all three.

For the **combined projection** dep array (around line 169), add after `homeValue, homeOwned`:
```js
homeValue, homeOwned, mortgageBalance, homeSaleIntent, homeSaleAge,
```

For the **primary solo** dep array (around line 202), add after `homeValue, homeOwned`:
```js
homeValue, homeOwned, mortgageBalance, homeSaleIntent, homeSaleAge,
```

For the **spouse solo** dep array (around line 232), add after `homeValue, homeOwned`:
```js
homeValue, homeOwned, mortgageBalance, homeSaleIntent, homeSaleAge,
```

- [ ] **Step 7: Expose in context value**

In the `PlannerContext.Provider value={{...}}` block (around line 307), add after `homeOwned, setHomeOwned`:

```js
mortgageBalance, setMortgageBalance,
homeSaleIntent, setHomeSaleIntent,
homeSaleAge, setHomeSaleAge,
```

- [ ] **Step 8: Run tests to confirm nothing broke**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/context/PlannerContext.jsx
git commit -m "feat: home equity — state, constrained setters, sharedInputs"
```

---

## Task 5: AssetsStep UI

**Files:**
- Modify: `src/steps/AssetsStep.jsx`

Extend the existing `homeOwned` block in the Real Estate & Growth card with mortgage balance, equity display, intent toggle, and conditional sale age slider.

- [ ] **Step 1: Destructure new fields from `usePlanner()`**

Add to the destructuring at the top of `AssetsStep`:

```js
mortgageBalance, setMortgageBalance,
homeSaleIntent, setHomeSaleIntent,
homeSaleAge, setHomeSaleAge,
lifeExpectancy,
```

Note: `lifeExpectancy` is needed for the sale age slider max. `retirementAge` is already destructured.

- [ ] **Step 2: Add the new controls after the `grid-2` div in the Real Estate card**

The existing Real Estate card structure in AssetsStep looks like this:

```jsx
<Card className="mb-28">
  <h3 className="card-heading card-heading--purple">Real Estate & Growth</h3>
  <div className="grid-2">
    <div>
      {/* Own Home toggle */}
      {homeOwned && (
        <SliderInput label="Home Value" ... />   {/* ← existing, DO NOT TOUCH */}
      )}
    </div>
    <div>
      {/* investment return, inflation, healthcare inflation sliders */}
    </div>
  </div>   {/* ← closing </div> of grid-2 */}

  {/* ↓ INSERT NEW BLOCK HERE — after grid-2, before </Card> */}
</Card>
```

The new controls must go **after the closing `</div>` of the `grid-2`** and **before the closing `</Card>`**. Do NOT place them inside the left-column `<div>` — that would cramp them into half-width.

Add this block in that position:

```jsx
{homeOwned && (
  <>
    <SliderInput
      label="Remaining Mortgage Balance"
      value={mortgageBalance} min={0} max={1500000} step={5000}
      onChange={setMortgageBalance} prefix="$"
      note="What you still owe on your mortgage today. If it's paid off (or nearly so), enter $0."
    />
    <div style={{ fontSize: 13, color: "#94a3b8", marginTop: -12, marginBottom: 16 }}>
      Estimated Equity: <strong style={{ color: "#e2e8f0" }}>${Math.max(0, homeValue - mortgageBalance).toLocaleString()}</strong>
    </div>

    <div className="mb-20">
      <label className="field-label">What do you plan to do with this home?</label>
      <div className="toggle-group">
        <button
          className={`toggle${homeSaleIntent === "sell" ? " toggle--active" : ""}`}
          onClick={() => setHomeSaleIntent("sell")}
        >Sell &amp; Invest Proceeds</button>
        <button
          className={`toggle${homeSaleIntent === "keep" ? " toggle--active" : ""}`}
          onClick={() => setHomeSaleIntent("keep")}
        >Keep / Leave to Heirs</button>
      </div>
    </div>

    {homeSaleIntent === "sell" && (
      <SliderInput
        label="Planned Sale Age"
        value={homeSaleAge} min={retirementAge} max={lifeExpectancy} step={1}
        onChange={setHomeSaleAge} suffix=" yrs"
        note={`We'll add ~$${Math.round(Math.max(0, homeValue - mortgageBalance) * 0.95).toLocaleString()} to your portfolio at age ${homeSaleAge} (after realtor fees and closing costs).`}
      />
    )}
  </>
)}
```

The existing home value `SliderInput` inside the `grid-2` left column is untouched.

- [ ] **Step 3: Run the dev server and visually verify**

```bash
npm run dev
```

Navigate to the Assets step. Verify:
- When "Own Home" is selected: mortgage balance slider and intent toggle appear below home value slider
- Equity display updates live as home value or mortgage balance changes
- "Sell & Invest" toggle shows the sale age slider; "Keep / Leave to Heirs" hides it
- Sale age slider note shows the estimated net proceeds

- [ ] **Step 4: Commit**

```bash
git add src/steps/AssetsStep.jsx
git commit -m "feat: home equity — mortgage balance, intent toggle, and sale age UI"
```

---

## Task 6: ResultsStep — home sale callout

**Files:**
- Modify: `src/steps/ResultsStep.jsx`

Add a metric box in the Tax & Cost Summary card when the user plans to sell their home.

- [ ] **Step 1: Add `homeSaleYear` lookup**

In `ResultsStep`, find the existing IRMAA lookup (around line 53):

```js
const medicareYears = results.yearsData.filter(
  d => d.age >= Math.max(retirementAge, 65)
);
const firstIrmaaYear = medicareYears.find(d => d.irmaa > 0);
```

Add immediately after:

```js
// Home sale: find the year proceeds were injected
const homeSaleYear = results.yearsData.find(d => d.homeSaleProceeds > 0);
```

- [ ] **Step 2: Add the metric box in the Tax & Cost Summary card**

Find the IRMAA metric box block (it ends with the closing `)}` after the green "No surcharge" box). Add the home sale box immediately after:

```jsx
{homeSaleYear && (
  <div className="metric-box metric-box--green mt-20" style={{ gridColumn: "1 / -1" }}>
    <div className="metric-box-label">Home Sale</div>
    <div className="metric-box-value value--green">
      +${homeSaleYear.homeSaleProceeds.toLocaleString()}
    </div>
    <div className="metric-box-note">
      At age {homeSaleYear.age} — net proceeds after fees added to your portfolio.
      Your taxable investments will grow from this injection onward.
    </div>
  </div>
)}
```

- [ ] **Step 3: Run the dev server and verify the callout**

```bash
npm run dev
```

Navigate to Assets step, set "Sell & Invest Proceeds", then go to Results. Verify:
- The "Home Sale" metric box appears in the Tax & Cost Summary card
- The amount matches ~95% of (homeValue − mortgageBalance)
- The age matches the planned sale age slider

Also verify: when "Keep / Leave to Heirs" is selected, the box does not appear.

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/steps/ResultsStep.jsx
git commit -m "feat: home equity — home sale callout in Tax & Cost Summary"
```

---

## Task 7: Open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/home-equity
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create \
  --title "feat: home equity — model planned home sale as retirement asset" \
  --body "$(cat <<'EOF'
## Summary
- Adds mortgage balance input and equity display to the Real Estate & Growth card
- Intent toggle (Sell & Invest / Keep) with conditional sale age slider
- Net proceeds (~95% of equity) injected into portfolio at the sale year; property tax stops
- Home sale metric box in Tax & Cost Summary shows the projected proceeds and age
- 6 new tests covering proceeds injection, property tax stop, edge cases, and boundary (sale at retirement age)

## Simplifications documented in spec
- Mortgage balance is today's balance (paydown not modeled)
- 60%-gains assumption applies to proceeds when drawn (minor overstatement; tax-free principal via primary residence exclusion not separately tracked)
- Property tax stops full year of sale (not prorated)

## Test plan
- [ ] Run `npm test` — all tests pass
- [ ] Assets step: toggle Own/Rent, set mortgage balance, toggle intent, verify equity display and sale age slider
- [ ] Results step: verify Home Sale metric box appears/disappears with intent toggle
- [ ] Verify sale proceeds amount matches ~95% of (homeValue − mortgageBalance)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
