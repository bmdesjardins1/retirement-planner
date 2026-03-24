# Pension Survivor Benefit Modeling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add survivor benefit % selectors and a spouse pension input so the drawdown projection correctly reduces pension income after a spouse's death instead of assuming 100% always.

**Architecture:** Pure state + calc + UI change — no new files. PlannerContext gets 4 new state fields wired through sharedInputs and all three useMemo projections. calc.js pre-computes spouse pension net monthly, detects who dies first, and replaces the single `activePensionNetMonthly` with two independent pension contributions. IncomeStep gets a survivor % toggle group (primary pension) and a new spouse pension section.

**Tech Stack:** React 18, Vite, plain JS (no TypeScript)

---

## Files Modified

| File | Change |
|---|---|
| `src/context/PlannerContext.jsx` | 4 new useState, sharedInputs update, 3 useMemo dep arrays + projection overrides, context value object |
| `src/utils/calc.js` | New params, spouse pension pre-compute, `primaryDiesFirst` flag, loop pension replacement, summary values |
| `src/steps/IncomeStep.jsx` | 8 new destructures, survivor % selector, spouse pension section |

---

## Task 1: Feature branch

**Files:** none

- [ ] **Step 1: Create the feature branch**

```bash
git checkout -b feat/pension-survivor
```

- [ ] **Step 2: Verify**

```bash
git branch
```

Expected: `* feat/pension-survivor`

---

## Task 2: PlannerContext — state, wiring, projections

**Files:**
- Modify: `src/context/PlannerContext.jsx`

Read the full file before editing. Key anchors: line 28, 146, 158–191, 194–220, 223–250, 287–290, 338.

- [ ] **Step 1: Add 4 new useState declarations**

Find (line 28):
```js
  const [pensionCOLA, setPensionCOLA]         = useState(false);
```

Insert immediately after it:
```js
  const [pensionSurvivorPct, setPensionSurvivorPct]           = useState(100);
  const [spousePension, setSpousePension]                     = useState(0);
  const [spousePensionCOLA, setSpousePensionCOLA]             = useState(false);
  const [spousePensionSurvivorPct, setSpousePensionSurvivorPct] = useState(100);
```

- [ ] **Step 2: Add new fields to sharedInputs**

Find (line 146):
```js
    pension, pensionCOLA, partTimeIncome, partTimeEndAge, rentalIncome,
```

Replace with:
```js
    pension, pensionCOLA, pensionSurvivorPct,
    spousePension, spousePensionCOLA, spousePensionSurvivorPct,
    partTimeIncome, partTimeEndAge, rentalIncome,
```

- [ ] **Step 3: Update combined `results` useMemo dependency array**

Find (line 185):
```js
    pension, pensionCOLA, partTimeIncome, partTimeEndAge, rentalIncome,
```

Replace with:
```js
    pension, pensionCOLA, pensionSurvivorPct,
    spousePension, spousePensionCOLA, spousePensionSurvivorPct,
    partTimeIncome, partTimeEndAge, rentalIncome,
```

- [ ] **Step 4: Update `primaryResults` useMemo — add override + dep array**

Find in the primaryResults useMemo call (around line 207):
```js
    survivorFactor: 0.6,
    ...sharedInputs,
```

Replace with:
```js
    survivorFactor: 0.6,
    ...sharedInputs,
    spousePension: 0,   // prevent spouse pension leaking into primary-solo summary cards
```

Then find the primaryResults dep array entry (around line 214):
```js
    pension, pensionCOLA, partTimeIncome, partTimeEndAge, rentalIncome,
```

Replace with:
```js
    pension, pensionCOLA, pensionSurvivorPct,
    spousePension, spousePensionCOLA, spousePensionSurvivorPct,
    partTimeIncome, partTimeEndAge, rentalIncome,
```

- [ ] **Step 5: Update `spouseResults` useMemo — add overrides + dep array**

Find in the spouseResults useMemo call (around line 236–237):
```js
    survivorFactor: 0.6,
    ...sharedInputs,
```

Replace with:
```js
    survivorFactor: 0.6,
    ...sharedInputs,
    pension: spousePension,           // spouse's own pension, not primary's
    pensionCOLA: spousePensionCOLA,   // spouse's own COLA flag
    spousePension: 0,                 // prevent double-counting (pension above = spousePension)
```

Then find the spouseResults dep array entry (around line 244):
```js
    pension, pensionCOLA, partTimeIncome, partTimeEndAge, rentalIncome,
```

Replace with:
```js
    pension, pensionCOLA, pensionSurvivorPct,
    spousePension, spousePensionCOLA, spousePensionSurvivorPct,
    partTimeIncome, partTimeEndAge, rentalIncome,
```

- [ ] **Step 6: Add 8 new entries to the context value object**

Find (around line 287–288):
```js
      pension, setPension,
      pensionCOLA, setPensionCOLA,
```

Insert immediately after the `pensionCOLA` line:
```js
      pensionSurvivorPct, setPensionSurvivorPct,
      spousePension, setSpousePension,
      spousePensionCOLA, setSpousePensionCOLA,
      spousePensionSurvivorPct, setSpousePensionSurvivorPct,
```

- [ ] **Step 7: Run tests**

```bash
cd C:\Users\code\retirement-planner && npm test
```

Expected: 57 tests pass, 0 fail.

- [ ] **Step 8: Commit**

```bash
git add src/context/PlannerContext.jsx
git commit -m "feat: pension survivor — PlannerContext state, wiring, projections"
```

---

## Task 3: calc.js — pension survivor logic

**Files:**
- Modify: `src/utils/calc.js`

Read the file before editing. Key anchors: line 41, 113–117, 177, 251, 295–297.

- [ ] **Step 1: Add new params to destructuring**

Find (line 41):
```js
    ss1, ss2, pension, pensionCOLA = false, partTimeIncome, partTimeEndAge, rentalIncome,
```

Replace with:
```js
    ss1, ss2, pension, pensionCOLA = false,
    pensionSurvivorPct = 100, spousePension = 0, spousePensionCOLA = false, spousePensionSurvivorPct = 100,
    partTimeIncome, partTimeEndAge, rentalIncome,
```

- [ ] **Step 2: Pre-compute spouse pension net monthly**

Find (line 113):
```js
  const retPensionNetMonthly      = pension - pension * retirementStateInfo.incomeTax;
```

Insert immediately after it:
```js
  const spousePensionStateTax      = spousePension * stateInfo.incomeTax;
  const spousePensionNetMonthly    = spousePension - spousePensionStateTax;
  const retSpousePensionNetMonthly = spousePension - spousePension * retirementStateInfo.incomeTax;
```

- [ ] **Step 3: Update summary card values to include spouse pension**

Find (lines 116–117):
```js
  const netMonthlyIncome = nonPensionNetWithPT + pensionNetMonthly;
  const stateTaxMonthly  = nonPensionTaxWithPT + pensionStateTax;
```

Replace with:
```js
  const netMonthlyIncome = nonPensionNetWithPT + pensionNetMonthly + spousePensionNetMonthly;
  const stateTaxMonthly  = nonPensionTaxWithPT + pensionStateTax   + spousePensionStateTax;
```

- [ ] **Step 4: Add `primaryDiesFirst` flag after `firstDeathAge`**

Find (lines 175–177):
```js
  const firstDeathAge = modelSurvivor
    ? Math.min(lifeExpectancy, currentAge + (spouseLifeExpectancy - spouseAge))
    : Infinity;
```

Insert immediately after it:
```js
  // primaryDiesFirst: true when primary's life expectancy ≤ spouse's (converted to primary age scale).
  // Determines which pension amount gets the survivor % reduction in the drawdown loop.
  const primaryDiesFirst = !hasSpouse ? false
    : lifeExpectancy <= currentAge + (spouseLifeExpectancy - spouseAge);
```

- [ ] **Step 5: Replace `activePensionNetMonthly` in the drawdown loop**

Find (line 251):
```js
    const activePensionNetMonthly      = hasMoved ? retPensionNetMonthly : pensionNetMonthly;
```

Replace with:
```js
    // Primary pension: reduced by survivorPct when primary has died (isSurvivor && primaryDiesFirst)
    const activePrimaryPensionNet = (isSurvivor && primaryDiesFirst)
      ? (hasMoved ? retPensionNetMonthly : pensionNetMonthly) * (pensionSurvivorPct / 100)
      : (hasMoved ? retPensionNetMonthly : pensionNetMonthly);
    // Spouse pension: reduced by survivorPct when spouse has died (isSurvivor && !primaryDiesFirst)
    const activeSpousePensionNet = !hasSpouse ? 0
      : (isSurvivor && !primaryDiesFirst)
      ? (hasMoved ? retSpousePensionNetMonthly : spousePensionNetMonthly) * (spousePensionSurvivorPct / 100)
      : (hasMoved ? retSpousePensionNetMonthly : spousePensionNetMonthly);
```

- [ ] **Step 6: Replace `pensionContrib` to sum both pensions**

Find (lines 295–297):
```js
    const pensionContrib = pensionCOLA
      ? activePensionNetMonthly * 12 * generalFactor   // COLA: inflates with general inflation
      : activePensionNetMonthly * 12;                  // Fixed: stays flat in nominal dollars
```

Replace with:
```js
    // Each pension's COLA applies independently
    const pensionContrib =
      (pensionCOLA      ? activePrimaryPensionNet * 12 * generalFactor : activePrimaryPensionNet * 12) +
      (spousePensionCOLA ? activeSpousePensionNet  * 12 * generalFactor : activeSpousePensionNet  * 12);
```

- [ ] **Step 7: Run tests**

```bash
cd C:\Users\code\retirement-planner && npm test
```

Expected: 57 tests pass, 0 fail.

- [ ] **Step 8: Commit**

```bash
git add src/utils/calc.js
git commit -m "feat: pension survivor — calc.js survivor phase and spouse pension logic"
```

---

## Task 4: IncomeStep UI

**Files:**
- Modify: `src/steps/IncomeStep.jsx`

Read the full file before editing. Key anchor: line 15–16 (destructuring), line 60–70 (pension section).

- [ ] **Step 1: Add 8 new destructured values**

Find (lines 15–16):
```js
    pension, setPension,
    pensionCOLA, setPensionCOLA,
```

Insert immediately after the `pensionCOLA` line:
```js
    pensionSurvivorPct, setPensionSurvivorPct,
    spousePension, setSpousePension,
    spousePensionCOLA, setSpousePensionCOLA,
    spousePensionSurvivorPct, setSpousePensionSurvivorPct,
```

- [ ] **Step 2: Add survivor % selector after the primary pension COLA block**

Find (lines 61–70):
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

Replace with:
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
          {pension > 0 && hasSpouse && (
            <div className="mb-20">
              <label className="field-label">What % of your pension does your spouse receive after your death?</label>
              <p className="field-note">Most pensions require you to elect a survivor benefit at retirement — check your plan documents. Single life pays more now but nothing to your spouse after your death.</p>
              <div className="toggle-group">
                {[0, 50, 75, 100].map(pct => (
                  <button
                    key={pct}
                    className={`toggle${pensionSurvivorPct === pct ? ' toggle--active' : ''}`}
                    onClick={() => setPensionSurvivorPct(pct)}
                  >
                    {pct === 0 ? '0% (Single Life)' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>
          )}
```

- [ ] **Step 3: Add spouse pension section after the primary pension block**

Find (line 71):
```jsx
          <SliderInput label="Part-Time Work"   value={partTimeIncome}  min={0} max={5000} step={100} onChange={setPartTimeIncome}  prefix="$" suffix="/mo" />
```

Insert immediately before it:
```jsx
          {hasSpouse && (
            <>
              <SliderInput label="Spouse's Pension" value={spousePension} min={0} max={5000} step={50} onChange={setSpousePension} prefix="$" suffix="/mo" />
              {spousePension > 0 && (
                <div className="mb-20">
                  <label className="field-label">Does your spouse's pension increase with inflation each year?</label>
                  <p className="field-note">Most pensions pay a fixed dollar amount for life. Some government pensions include annual cost-of-living increases.</p>
                  <div className="toggle-group">
                    <button className={`toggle${spousePensionCOLA ? ' toggle--active' : ''}`} onClick={() => setSpousePensionCOLA(true)}>Yes</button>
                    <button className={`toggle${!spousePensionCOLA ? ' toggle--active' : ''}`} onClick={() => setSpousePensionCOLA(false)}>No (fixed)</button>
                  </div>
                </div>
              )}
              {spousePension > 0 && (
                <div className="mb-20">
                  <label className="field-label">What % of your spouse's pension do you receive after their death?</label>
                  <p className="field-note">Most pensions require you to elect a survivor benefit at retirement — check your plan documents.</p>
                  <div className="toggle-group">
                    {[0, 50, 75, 100].map(pct => (
                      <button
                        key={pct}
                        className={`toggle${spousePensionSurvivorPct === pct ? ' toggle--active' : ''}`}
                        onClick={() => setSpousePensionSurvivorPct(pct)}
                      >
                        {pct === 0 ? '0% (Single Life)' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
```

- [ ] **Step 4: Run tests**

```bash
cd C:\Users\code\retirement-planner && npm test
```

Expected: 57 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/steps/IncomeStep.jsx
git commit -m "feat: pension survivor — IncomeStep survivor % selector and spouse pension UI"
```

---

## Task 5: Open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/pension-survivor
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create \
  --title "feat: pension survivor benefit modeling" \
  --body "$(cat <<'EOF'
## Summary
- Adds survivor benefit % selector (0%/50%/75%/100%) for primary pension — controls how much spouse receives after primary's death
- Adds spouse pension input with its own COLA toggle and survivor benefit % selector
- Fixes the drawdown loop to correctly reduce pension income in the survivor phase based on who dies first
- Default of 100% means no behavioral change for existing users

## Test plan
- [ ] `npm test` — 57 tests pass
- [ ] Primary pension 50%, primary dies first → survivor phase income drops by half the primary pension
- [ ] Primary pension 0% (single life), primary dies first → $0 primary pension in survivor phase
- [ ] Primary pension 100% → projection unchanged from before
- [ ] Spouse pension entered → appears in income summary card, affects projection
- [ ] Spouse pension with survivor %, spouse dies first → correctly reduced
- [ ] `hasSpouse = false` → survivor % selectors not shown, spouse pension not shown
- [ ] Existing users (pension > 0, no new fields set) → 100% default, numbers unchanged

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
