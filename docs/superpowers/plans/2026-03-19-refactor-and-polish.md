# Refactor & UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a shared `AccountTypeBlock` component, move tests to a dedicated `tests/` folder, tighten dependency arrays, add tabbed account layout, numbered step navigation, fix chart label overlaps, and tighten form spacing.

**Architecture:** Two sequential tracks — Track 1 (code refactor, zero visible changes) then Track 2 (UI polish). Tasks 1–3 are pure refactors with no user-facing effect. Tasks 4–7 are UI changes. Task 4 depends on Task 2 (`AccountTypeBlock`); all others are independent.

**Tech Stack:** React 18, Vite, Recharts, Vitest, plain JS (no TypeScript)

---

## File Map

| File | Change |
|---|---|
| `tests/calc.test.js` | NEW — moved from `src/utils/calc.test.js` |
| `tests/federalTax.test.js` | NEW — moved from `src/utils/federalTax.test.js` |
| `src/utils/calc.test.js` | DELETED |
| `src/utils/federalTax.test.js` | DELETED |
| `vitest.config.js` | Update `include` path |
| `src/components/AccountTypeBlock.jsx` | NEW — shared account input block |
| `src/steps/AssetsStep.jsx` | Rewrite: use `AccountTypeBlock`, add tabs |
| `src/context/PlannerContext.jsx` | Replace implicit dep spreads with explicit lists |
| `src/App.jsx` | Numbered step nav markup |
| `src/steps/ResultsStep.jsx` | Chart: axis range, legend, reference line positions |
| `src/styles.css` | Step nav styles + form density values |

---

## Task 1: Move tests to `tests/` at project root

**Files:**
- Create: `tests/calc.test.js`
- Create: `tests/federalTax.test.js`
- Modify: `vitest.config.js`
- Delete: `src/utils/calc.test.js`
- Delete: `src/utils/federalTax.test.js`

- [ ] **Step 1: Create `tests/` directory and copy test files with updated import paths**

Create `tests/calc.test.js` — same content as `src/utils/calc.test.js` but with updated import:

```js
// Change line 2 from:
import { runProjection } from './calc';
// To:
import { runProjection } from '../src/utils/calc';
```

Create `tests/federalTax.test.js` — same content as `src/utils/federalTax.test.js` but with updated import:

```js
// Change line 2 from:
import { estimateFederalTax, estimateCapitalGainsTax } from './federalTax';
// To:
import { estimateFederalTax, estimateCapitalGainsTax } from '../src/utils/federalTax';
```

- [ ] **Step 2: Update `vitest.config.js` to include the new path**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
```

- [ ] **Step 3: Run tests from new location to verify they pass**

Run: `npx vitest run`

Expected: `19 tests passed` — all from `tests/calc.test.js` and `tests/federalTax.test.js`

- [ ] **Step 4: Delete the old test files**

Delete `src/utils/calc.test.js` and `src/utils/federalTax.test.js`.

Run `npx vitest run` again to confirm nothing broke.

Expected: `19 tests passed`

- [ ] **Step 5: Commit**

```bash
git add tests/ vitest.config.js src/utils/calc.test.js src/utils/federalTax.test.js
git commit -m "refactor: move tests to tests/ at project root"
```

---

## Task 2: Extract `AccountTypeBlock` component

**Files:**
- Create: `src/components/AccountTypeBlock.jsx`
- Modify: `src/steps/AssetsStep.jsx` (rewrite using the new component — side-by-side layout preserved, no tabs yet)

- [ ] **Step 1: Create `src/components/AccountTypeBlock.jsx`**

```jsx
import SliderInput from "./SliderInput";

export default function AccountTypeBlock({
  label,
  note,
  hasAccount,
  onToggle,
  balance,
  onBalanceChange,
  max,
  step,
  balanceNote = null,
}) {
  return (
    <div className="mb-20">
      <label className="field-label">{label}</label>
      <p className="field-note">{note}</p>
      <div className="toggle-group">
        <button
          className={`toggle${hasAccount ? ' toggle--active' : ''}`}
          onClick={() => onToggle(true)}
        >
          I have this
        </button>
        <button
          className={`toggle${!hasAccount ? ' toggle--active' : ''}`}
          onClick={() => onToggle(false)}
        >
          I don't
        </button>
      </div>
      {hasAccount && (
        <SliderInput
          label="Current Balance"
          value={balance}
          min={0}
          max={max}
          step={step}
          onChange={onBalanceChange}
          prefix="$"
          note={balanceNote}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `src/steps/AssetsStep.jsx` to use `AccountTypeBlock`**

The layout stays the same (side-by-side `grid-2` for now — tabs come in Task 4). Replace the repeated toggle+slider blocks with the new component. The Summary card at the bottom must be preserved verbatim including its `hasSpouse` conditional.

```jsx
import { useState } from "react";
import { usePlanner } from "../context/PlannerContext";
import SliderInput from "../components/SliderInput";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import AccountTypeBlock from "../components/AccountTypeBlock";

export default function AssetsStep() {
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

  return (
    <div>
      <SectionTitle sub="Your investable assets and how they might grow.">Assets & Investments</SectionTitle>

      <div className={`grid-2 mb-28`}>
        <Card>
          <h3 className="card-heading card-heading--green">Your Retirement Accounts</h3>
          <AccountTypeBlock
            label="Traditional 401(k) / 403(b)"
            note="Pre-tax retirement account through your employer. Withdrawals are taxed as regular income."
            hasAccount={hasTrad401k} onToggle={setHasTrad401k}
            balance={trad401k} onBalanceChange={setTrad401k}
            max={2000000} step={10000}
          />
          <AccountTypeBlock
            label="Roth 401(k) / 403(b)"
            note="After-tax employer retirement account. Withdrawals are completely tax-free."
            hasAccount={hasRoth401k} onToggle={setHasRoth401k}
            balance={roth401k} onBalanceChange={setRoth401k}
            max={2000000} step={10000}
          />
          <AccountTypeBlock
            label="Traditional IRA"
            note="Pre-tax individual retirement account — a tax-advantaged savings account you open yourself, not through an employer. Withdrawals are taxed as regular income."
            hasAccount={hasTradIRA} onToggle={setHasTradIRA}
            balance={tradIRA} onBalanceChange={setTradIRA}
            max={1000000} step={5000}
          />
          <AccountTypeBlock
            label="Roth IRA"
            note="After-tax individual retirement account. Withdrawals are completely tax-free."
            hasAccount={hasRothIRA} onToggle={setHasRothIRA}
            balance={rothIRA} onBalanceChange={setRothIRA}
            max={1000000} step={5000}
          />
          <AccountTypeBlock
            label="Brokerage / Investment Account"
            note="Regular investment account — not retirement-specific. Examples: Fidelity, Vanguard, Schwab taxable accounts. Only the gains portion is taxed when you withdraw, at lower long-term rates."
            hasAccount={hasTaxableBrokerage} onToggle={setHasTaxableBrokerage}
            balance={taxableBrokerage} onBalanceChange={setTaxableBrokerage}
            max={1000000} step={5000}
            balanceNote="We assume 60% of withdrawals are taxable gains — a conservative estimate for a long-held account."
          />
          <SliderInput label="Annual 401(k) Contribution" value={annualContrib401k} min={0} max={30000} step={500} onChange={setAnnualContrib401k} prefix="$" suffix="/yr"
            note="2024 limit: $23,000 ($30,500 if age 50+)." />
          <SliderInput label="Employer Contributions / yr" value={employerMatch} min={0} max={15000} step={500} onChange={setEmployerMatch} prefix="$" suffix="/yr"
            note="Total your employer contributes to your retirement accounts each year. Check your HR portal or most recent pay stub." />
          <SliderInput label="Annual IRA Contribution" value={annualContribIRA} min={0} max={8000} step={500} onChange={setAnnualContribIRA} prefix="$" suffix="/yr"
            note="2024 limit: $7,000 ($8,000 if age 50+). Includes Roth IRA." />
          <SliderInput label="Annual Other Savings" value={annualContribOther} min={0} max={100000} step={1000} onChange={setAnnualContribOther} prefix="$" suffix="/yr"
            note="Additional savings to brokerage accounts, savings accounts, or other investments." />
        </Card>

        {hasSpouse && (
          <Card>
            <h3 className="card-heading card-heading--blue">Spouse Retirement Accounts</h3>
            <AccountTypeBlock
              label="Traditional 401(k) / 403(b)"
              note="Pre-tax retirement account through your spouse's employer. Withdrawals are taxed as regular income."
              hasAccount={spouseHasTrad401k} onToggle={setSpouseHasTrad401k}
              balance={spouseTrad401k} onBalanceChange={setSpouseTrad401k}
              max={2000000} step={10000}
            />
            <AccountTypeBlock
              label="Roth 401(k) / 403(b)"
              note="After-tax employer retirement account. Withdrawals are completely tax-free."
              hasAccount={spouseHasRoth401k} onToggle={setSpouseHasRoth401k}
              balance={spouseRoth401k} onBalanceChange={setSpouseRoth401k}
              max={2000000} step={10000}
            />
            <AccountTypeBlock
              label="Traditional IRA"
              note="Pre-tax individual retirement account — a tax-advantaged savings account your spouse opens themselves, not through an employer. Withdrawals are taxed as regular income."
              hasAccount={spouseHasTradIRA} onToggle={setSpouseHasTradIRA}
              balance={spouseTradIRA} onBalanceChange={setSpouseTradIRA}
              max={1000000} step={5000}
            />
            <AccountTypeBlock
              label="Roth IRA"
              note="After-tax individual retirement account. Withdrawals are completely tax-free."
              hasAccount={spouseHasRothIRA} onToggle={setSpouseHasRothIRA}
              balance={spouseRothIRA} onBalanceChange={setSpouseRothIRA}
              max={1000000} step={5000}
            />
            <AccountTypeBlock
              label="Brokerage / Investment Account"
              note="Regular investment account — not retirement-specific. Examples: Fidelity, Vanguard, Schwab taxable accounts. Only the gains portion is taxed when you withdraw, at lower long-term rates."
              hasAccount={spouseHasTaxableBrokerage} onToggle={setSpouseHasTaxableBrokerage}
              balance={spouseTaxableBrokerage} onBalanceChange={setSpouseTaxableBrokerage}
              max={1000000} step={5000}
              balanceNote="We assume 60% of withdrawals are taxable gains — a conservative estimate for a long-held account."
            />
            <SliderInput label="Annual Spouse 401(k) Contribution" value={spouseAnnualContrib401k} min={0} max={30000} step={500} onChange={setSpouseAnnualContrib401k} prefix="$" suffix="/yr"
              note="2024 limit: $23,000 ($30,500 if age 50+)." />
            <SliderInput label="Spouse Employer Contributions / yr" value={spouseEmployerMatch} min={0} max={15000} step={500} onChange={setSpouseEmployerMatch} prefix="$" suffix="/yr"
              note="Total your spouse's employer contributes annually to their retirement accounts." />
            <SliderInput label="Annual Spouse IRA Contribution" value={spouseAnnualContribIRA} min={0} max={8000} step={500} onChange={setSpouseAnnualContribIRA} prefix="$" suffix="/yr"
              note="2024 limit: $7,000 ($8,000 if age 50+)." />
            <SliderInput label="Spouse Annual Other Savings" value={spouseAnnualContribOther} min={0} max={100000} step={1000} onChange={setSpouseAnnualContribOther} prefix="$" suffix="/yr"
              note="Additional savings to brokerage, savings accounts, etc." />
          </Card>
        )}
      </div>

      {/* Real Estate & Growth — unchanged */}
      <Card className="mb-28">
        <h3 className="card-heading card-heading--purple">Real Estate & Growth</h3>
        <div className="grid-2">
          <div>
            <div className="mb-20">
              <label className="field-label">Own Home?</label>
              <div className="toggle-group">
                <button className={`toggle${homeOwned ? " toggle--active" : ""}`}  onClick={() => setHomeOwned(true)}>Own</button>
                <button className={`toggle${!homeOwned ? " toggle--active" : ""}`} onClick={() => setHomeOwned(false)}>Rent</button>
              </div>
            </div>
            {homeOwned && (
              <SliderInput
                label="Home Value" value={homeValue} min={50000} max={1500000} step={10000}
                onChange={setHomeValue} prefix="$"
                note={`Est. property tax in ${state}: ~$${Math.round(homeValue * stateInfo.avgPropertyTaxRate / 12).toLocaleString()}/mo`}
              />
            )}
          </div>
          <div>
            <SliderInput label="Expected Return" value={investmentReturn} min={2} max={10}  step={0.5} onChange={setInvestmentReturn} suffix="% / yr"
              note="Conservative: 4-5%. Moderate: 6-7%. Aggressive: 8%+" />
            <SliderInput label="General Inflation Rate" value={inflation} min={1} max={6} step={0.5} onChange={setInflation} suffix="% / yr"
              note="How fast everyday costs rise. Historical avg ~3%. Higher = more conservative." />
            <SliderInput label="Healthcare Cost Growth" value={healthcareInflation} min={2} max={10} step={0.5} onChange={setHealthcareInflation} suffix="% / yr"
              note="Medical costs rise faster than general inflation — historically ~5-7%/yr. This is applied separately to your healthcare spending." />
          </div>
        </div>
      </Card>

      {/* Summary — preserved verbatim */}
      <Card>
        <div className="assets-total-label">Combined Total Liquid Assets</div>
        <div className="assets-total-value">${results.totalLiquidAssets.toLocaleString()}</div>
        <div className="assets-total-label mt-12">Your Projected Balance at Retirement (age {retirementAge})</div>
        <div className="assets-total-value value--green">${primaryResults.portfolioAtRetirement.toLocaleString()}</div>
        {hasSpouse && <>
          <div className="assets-total-label mt-12">Spouse Projected Balance at Retirement (age {spouseRetirementAge})</div>
          <div className="assets-total-value value--blue">${spouseResults.portfolioAtRetirement.toLocaleString()}</div>
        </>}
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Run tests and build to verify no regressions**

```bash
npx vitest run
npx vite build
```

Expected: 19 tests passed, build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/AccountTypeBlock.jsx src/steps/AssetsStep.jsx
git commit -m "refactor: extract AccountTypeBlock component, eliminate AssetsStep copy-paste"
```

---

## Task 3: Explicit dependency arrays in PlannerContext

**Files:**
- Modify: `src/context/PlannerContext.jsx`

- [ ] **Step 1: Replace `...Object.values(sharedInputs)` in all three `useMemo` dep arrays**

In `src/context/PlannerContext.jsx`, find the three `useMemo` calls. Each ends with `...Object.values(sharedInputs)`. Replace that spread in all three with the explicit list below.

The shared deps to append to each dep array (in place of `...Object.values(sharedInputs)`):

```js
pension, pensionCOLA, partTimeIncome, partTimeEndAge, rentalIncome,
housing, food, healthcare, transport, leisure, other,
longTermCare, ltcStartAge,
homeValue, homeOwned, investmentReturn, inflation, healthcareInflation,
stateInfo,
```

Note: use `stateInfo` (the derived object), not `state` (the string). `stateInfo` is `STATE_DATA[state]` computed synchronously before the memo runs — it is already up to date when React evaluates the dep array. Listing `state` separately would be redundant.

The `...sharedInputs` spread inside the `runProjection()` call arguments is unchanged — only the dep array brackets change.

After editing, each `useMemo` should have a fully explicit dep array with no spread operators.

- [ ] **Step 2: Run tests and build**

```bash
npx vitest run
npx vite build
```

Expected: 19 tests passed, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/context/PlannerContext.jsx
git commit -m "refactor: replace implicit sharedInputs dep spread with explicit dependency lists"
```

---

## Task 4: Tabbed layout for Assets step

**Files:**
- Modify: `src/steps/AssetsStep.jsx`
- Modify: `src/styles.css` (add tab styles)

- [ ] **Step 1: Add tab CSS to `src/styles.css`**

Find the `/* === CARD === */` section and add the following after it:

```css
/* === ACCOUNT TABS === */
.account-tabs {
  display: flex;
  border-bottom: 1px solid rgba(51, 65, 85, 0.5);
  margin: -4px -4px 20px;
  gap: 0;
}

.account-tab {
  padding: 10px 20px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #475569;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.account-tab--green {
  color: #34d399;
  border-bottom-color: #34d399;
}

.account-tab--blue {
  color: #60a5fa;
  border-bottom-color: #60a5fa;
}
```

- [ ] **Step 2: Rewrite `AssetsStep.jsx` to use the tab layout**

Add `useState` for the active tab (local state — not in PlannerContext). When `hasSpouse` is false, render the account blocks directly with no tabs. When `hasSpouse` is true, render the tab bar and show only the active person's accounts.

Replace the `grid-2` card section (lines from `<div className="grid-2 mb-28">` through `</div>`) with:

```jsx
const [activeTab, setActiveTab] = useState('primary');

// Replace the grid-2 section with:
<Card className="mb-28">
  {hasSpouse && (
    <div className="account-tabs">
      <button
        className={`account-tab${activeTab === 'primary' ? ' account-tab--green' : ''}`}
        onClick={() => setActiveTab('primary')}
      >
        Your Accounts
      </button>
      <button
        className={`account-tab${activeTab === 'spouse' ? ' account-tab--blue' : ''}`}
        onClick={() => setActiveTab('spouse')}
      >
        Spouse Accounts
      </button>
    </div>
  )}

  {(!hasSpouse || activeTab === 'primary') && (
    <>
      {!hasSpouse && <h3 className="card-heading card-heading--green">Your Retirement Accounts</h3>}
      <AccountTypeBlock
        label="Traditional 401(k) / 403(b)"
        note="Pre-tax retirement account through your employer. Withdrawals are taxed as regular income."
        hasAccount={hasTrad401k} onToggle={setHasTrad401k}
        balance={trad401k} onBalanceChange={setTrad401k}
        max={2000000} step={10000}
      />
      <AccountTypeBlock
        label="Roth 401(k) / 403(b)"
        note="After-tax employer retirement account. Withdrawals are completely tax-free."
        hasAccount={hasRoth401k} onToggle={setHasRoth401k}
        balance={roth401k} onBalanceChange={setRoth401k}
        max={2000000} step={10000}
      />
      <AccountTypeBlock
        label="Traditional IRA"
        note="Pre-tax individual retirement account — a tax-advantaged savings account you open yourself, not through an employer. Withdrawals are taxed as regular income."
        hasAccount={hasTradIRA} onToggle={setHasTradIRA}
        balance={tradIRA} onBalanceChange={setTradIRA}
        max={1000000} step={5000}
      />
      <AccountTypeBlock
        label="Roth IRA"
        note="After-tax individual retirement account. Withdrawals are completely tax-free."
        hasAccount={hasRothIRA} onToggle={setHasRothIRA}
        balance={rothIRA} onBalanceChange={setRothIRA}
        max={1000000} step={5000}
      />
      <AccountTypeBlock
        label="Brokerage / Investment Account"
        note="Regular investment account — not retirement-specific. Examples: Fidelity, Vanguard, Schwab taxable accounts. Only the gains portion is taxed when you withdraw, at lower long-term rates."
        hasAccount={hasTaxableBrokerage} onToggle={setHasTaxableBrokerage}
        balance={taxableBrokerage} onBalanceChange={setTaxableBrokerage}
        max={1000000} step={5000}
        balanceNote="We assume 60% of withdrawals are taxable gains — a conservative estimate for a long-held account."
      />
      <SliderInput label="Annual 401(k) Contribution" value={annualContrib401k} min={0} max={30000} step={500} onChange={setAnnualContrib401k} prefix="$" suffix="/yr"
        note="2024 limit: $23,000 ($30,500 if age 50+)." />
      <SliderInput label="Employer Contributions / yr" value={employerMatch} min={0} max={15000} step={500} onChange={setEmployerMatch} prefix="$" suffix="/yr"
        note="Total your employer contributes to your retirement accounts each year. Check your HR portal or most recent pay stub." />
      <SliderInput label="Annual IRA Contribution" value={annualContribIRA} min={0} max={8000} step={500} onChange={setAnnualContribIRA} prefix="$" suffix="/yr"
        note="2024 limit: $7,000 ($8,000 if age 50+). Includes Roth IRA." />
      <SliderInput label="Annual Other Savings" value={annualContribOther} min={0} max={100000} step={1000} onChange={setAnnualContribOther} prefix="$" suffix="/yr"
        note="Additional savings to brokerage accounts, savings accounts, or other investments." />
    </>
  )}

  {hasSpouse && activeTab === 'spouse' && (
    <>
      <AccountTypeBlock
        label="Traditional 401(k) / 403(b)"
        note="Pre-tax retirement account through your spouse's employer. Withdrawals are taxed as regular income."
        hasAccount={spouseHasTrad401k} onToggle={setSpouseHasTrad401k}
        balance={spouseTrad401k} onBalanceChange={setSpouseTrad401k}
        max={2000000} step={10000}
      />
      <AccountTypeBlock
        label="Roth 401(k) / 403(b)"
        note="After-tax employer retirement account. Withdrawals are completely tax-free."
        hasAccount={spouseHasRoth401k} onToggle={setSpouseHasRoth401k}
        balance={spouseRoth401k} onBalanceChange={setSpouseRoth401k}
        max={2000000} step={10000}
      />
      <AccountTypeBlock
        label="Traditional IRA"
        note="Pre-tax individual retirement account — a tax-advantaged savings account your spouse opens themselves, not through an employer. Withdrawals are taxed as regular income."
        hasAccount={spouseHasTradIRA} onToggle={setSpouseHasTradIRA}
        balance={spouseTradIRA} onBalanceChange={setSpouseTradIRA}
        max={1000000} step={5000}
      />
      <AccountTypeBlock
        label="Roth IRA"
        note="After-tax individual retirement account. Withdrawals are completely tax-free."
        hasAccount={spouseHasRothIRA} onToggle={setSpouseHasRothIRA}
        balance={spouseRothIRA} onBalanceChange={setSpouseRothIRA}
        max={1000000} step={5000}
      />
      <AccountTypeBlock
        label="Brokerage / Investment Account"
        note="Regular investment account — not retirement-specific. Examples: Fidelity, Vanguard, Schwab taxable accounts. Only the gains portion is taxed when you withdraw, at lower long-term rates."
        hasAccount={spouseHasTaxableBrokerage} onToggle={setSpouseHasTaxableBrokerage}
        balance={spouseTaxableBrokerage} onBalanceChange={setSpouseTaxableBrokerage}
        max={1000000} step={5000}
        balanceNote="We assume 60% of withdrawals are taxable gains — a conservative estimate for a long-held account."
      />
      <SliderInput label="Annual Spouse 401(k) Contribution" value={spouseAnnualContrib401k} min={0} max={30000} step={500} onChange={setSpouseAnnualContrib401k} prefix="$" suffix="/yr"
        note="2024 limit: $23,000 ($30,500 if age 50+)." />
      <SliderInput label="Spouse Employer Contributions / yr" value={spouseEmployerMatch} min={0} max={15000} step={500} onChange={setSpouseEmployerMatch} prefix="$" suffix="/yr"
        note="Total your spouse's employer contributes annually to their retirement accounts." />
      <SliderInput label="Annual Spouse IRA Contribution" value={spouseAnnualContribIRA} min={0} max={8000} step={500} onChange={setSpouseAnnualContribIRA} prefix="$" suffix="/yr"
        note="2024 limit: $7,000 ($8,000 if age 50+)." />
      <SliderInput label="Spouse Annual Other Savings" value={spouseAnnualContribOther} min={0} max={100000} step={1000} onChange={setSpouseAnnualContribOther} prefix="$" suffix="/yr"
        note="Additional savings to brokerage, savings accounts, etc." />
    </>
  )}
</Card>
```

The `useState` declaration goes at the top of the `AssetsStep` function body, before the `usePlanner()` destructure. The `import { useState }` is already at the top of the file from Task 2's rewrite — if not, add it.

- [ ] **Step 3: Run tests and build**

```bash
npx vitest run
npx vite build
```

Expected: 19 tests passed, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/steps/AssetsStep.jsx src/styles.css
git commit -m "feat: tabbed Your Accounts / Spouse Accounts layout in Assets step"
```

---

## Task 5: Numbered step navigation

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Replace stepper CSS in `src/styles.css`**

Find the `/* === STEPPER === */` section and replace everything from `.stepper {` through the last `.step-btn--active {` block (including its closing `}`) with:

```css
/* === STEPPER === */
.stepper {
  display: flex;
  align-items: flex-start;
  margin-top: 28px;
  padding: 0 8px;
  overflow-x: auto;
}

.stepper-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.stepper-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #334155;
  background: transparent;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
  line-height: 1;
}

.stepper-circle--done {
  background: rgba(52, 211, 153, 0.15);
  border-color: #34d399;
  color: #34d399;
  cursor: pointer;
}

.stepper-circle--active {
  background: #34d399;
  border-color: #34d399;
  color: #0a0a14;
}

.stepper-label {
  font-size: 10px;
  color: #475569;
  font-weight: 500;
  letter-spacing: 0.05em;
  white-space: nowrap;
  text-transform: uppercase;
}

.stepper-label--done {
  color: rgba(52, 211, 153, 0.7);
}

.stepper-label--active {
  color: #34d399;
  font-weight: 700;
}

.stepper-connector {
  flex: 1;
  height: 2px;
  background: #1e293b;
  margin-top: 15px;
  margin-bottom: 22px;
  min-width: 16px;
}

.stepper-connector--done {
  background: rgba(52, 211, 153, 0.4);
}
```

- [ ] **Step 2: Replace stepper markup in `src/App.jsx`**

Replace the `<nav className="stepper">` block with:

```jsx
<nav className="stepper">
  {STEPS.flatMap((s, i) => {
    const isDone   = step > i;
    const isActive = step === i;
    const items = [
      <div key={`step-${i}`} className="stepper-item">
        <button
          className={`stepper-circle${isActive ? ' stepper-circle--active' : isDone ? ' stepper-circle--done' : ''}`}
          onClick={() => isDone && setStep(i)}
        >
          {isDone ? '✓' : i + 1}
        </button>
        <span className={`stepper-label${isActive ? ' stepper-label--active' : isDone ? ' stepper-label--done' : ''}`}>
          {s}
        </span>
      </div>,
    ];
    if (i < STEPS.length - 1) {
      items.push(
        <div key={`conn-${i}`} className={`stepper-connector${isDone ? ' stepper-connector--done' : ''}`} />
      );
    }
    return items;
  })}
</nav>
```

Note: `flatMap` is used (instead of `map` + `React.Fragment`) to interleave step items and connector divs without needing `React.Fragment` key props. No extra imports needed.

- [ ] **Step 3: Run tests and build**

```bash
npx vitest run
npx vite build
```

Expected: 19 tests passed, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/styles.css
git commit -m "feat: numbered step navigation with connector line and checkmarks"
```

---

## Task 6: Chart fixes in Results page

**Files:**
- Modify: `src/steps/ResultsStep.jsx`

- [ ] **Step 1: Fix `chartData` age range**

In `ResultsStep.jsx`, `spouseRetirementOnPrimaryAxis` and `spouseLifeExpOnPrimaryAxis` are currently defined around lines 44–45, after `chartData`. Move both of those lines to before the `maxLen` / `chartData` block so they're available for the filter.

Then add these two lines immediately after the existing `chartData` declaration:

```js
const chartCutoffAge = hasSpouse
  ? Math.max(lifeExpectancy, spouseLifeExpOnPrimaryAxis) + 5
  : lifeExpectancy + 5;
const visibleChartData = chartData.filter(d => d.age <= chartCutoffAge);
```

Then replace `data={chartData}` on the `<AreaChart>` with `data={visibleChartData}`. Do not rename or modify the `chartData` declaration — just filter it into a new variable.

- [ ] **Step 2: Fix portfolio chart — legend position and margins**

Find the `<AreaChart>` component. Make these changes:

1. Change `margin` from `{ top: 4, right: 8, bottom: 24, left: 8 }` to `{ top: 4, right: 8, bottom: 40, left: 16 }` — increased bottom gives the `insideBottom` "Age" axis label room; increased left gives the `insideLeft` "Portfolio Value" label room.
2. On the `<Legend>` component, add: `verticalAlign="top" height={36}`

```jsx
<AreaChart data={visibleChartData} margin={{ top: 4, right: 8, bottom: 40, left: 16 }}>
  {/* ... */}
  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12, color: "#64748b" }} />
```

- [ ] **Step 3: Fix reference line label positions and text**

Find the four `<ReferenceLine>` elements. Replace with the following (note explicit `position` per line and shortened label text):

```jsx
<ReferenceLine
  x={retirementAge}
  stroke="#818cf8" strokeDasharray="4 4"
  label={{ value: "Your Retirement", fill: "#818cf8", fontSize: 10, position: "insideTopRight" }}
/>
{hasSpouse && (
  <ReferenceLine
    x={spouseRetirementOnPrimaryAxis}
    stroke="#60a5fa" strokeDasharray="4 4"
    label={{ value: "Spouse Retire", fill: "#60a5fa", fontSize: 10, position: "insideTopLeft" }}
  />
)}
<ReferenceLine
  x={lifeExpectancy}
  stroke="#f43f5e" strokeDasharray="4 4"
  label={{ value: "Life Exp.", fill: "#f43f5e", fontSize: 10, position: "insideTopRight" }}
/>
{hasSpouse && (
  <ReferenceLine
    x={spouseLifeExpOnPrimaryAxis}
    stroke="#fb923c" strokeDasharray="4 4"
    label={{ value: "Spouse Life Exp.", fill: "#fb923c", fontSize: 10, position: "insideTopLeft" }}
  />
)}
```

Positions alternate R/L/R/L in x-axis order so no two consecutive rendered lines share the same side.

- [ ] **Step 4: Fix bar chart — legend position and margins**

Find the `<BarChart>` component. Apply the same legend fix:

1. Change `margin` from `{ top: 4, right: 8, bottom: 24, left: 8 }` to `{ top: 4, right: 8, bottom: 40, left: 16 }`
2. On `<Legend>`: add `verticalAlign="top" height={36}`

```jsx
<BarChart
  data={results.yearsData.filter(...)}
  margin={{ top: 4, right: 8, bottom: 40, left: 16 }}
>
  {/* ... */}
  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12, color: "#64748b" }} />
```

- [ ] **Step 5: Run tests and build**

```bash
npx vitest run
npx vite build
```

Expected: 19 tests passed, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/steps/ResultsStep.jsx
git commit -m "fix: chart axis range, legend overlap, reference line label collisions"
```

---

## Task 7: Form density CSS adjustments

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Update spacing values in `src/styles.css`**

Make the following targeted changes. Find each rule by its selector and update only the listed property:

| Selector | Property | Old value | New value |
|---|---|---|---|
| `.card` | `padding` | `28px` | `20px 24px` |
| `.mb-20` | `margin-bottom` | `20px` | `14px` |
| `.mb-28` | `margin-bottom` | `28px` | `20px` |
| `.field-label` | `margin-bottom` | `12px` | `8px` |
| `.toggle` | `padding` | `10px 20px` | `7px 16px` |
| `.toggle-group` | *(add)* | *(none)* | `margin-bottom: 10px` |
| `.slider-field` | `margin-bottom` | `24px` | `18px` |

The `toggle-group` margin-bottom is new — add it to the `.toggle-group` rule. This is the most important fix: without it, an "I don't" block (which shows no slider) runs its toggle directly into the next block's label with no separation.

- [ ] **Step 2: Run tests and build**

```bash
npx vitest run
npx vite build
```

Expected: 19 tests passed, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "style: tighten form density — card padding, toggle spacing, slider margins"
```

---

## Success Criteria

- `npx vitest run` → 19 tests passed, all from `tests/`
- `npx vite build` → no errors or warnings
- Assets step: tabs visible when `hasSpouse` is true; single-person view when false
- Switching tabs switches the account blocks shown; other data unchanged
- Step nav: circles with numbers → checkmarks for completed, highlighted for active
- Portfolio chart age axis ends at life expectancy + 5 (not ~118)
- No overlapping legend/axis labels on portfolio or bar chart
- Reference line labels alternate sides (R/L/R/L) — no collisions
- Form spacing feels tighter but not cramped; "I don't" blocks have visible separation from the next block
