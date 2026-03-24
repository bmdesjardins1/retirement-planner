# calc.js Model Accuracy Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the one non-conservative MAGI accuracy gap in calc.js (spouse pension excluded from income), remove dead/redundant code, and add clarifying comments for each accepted simplification.

**Architecture:** All changes are in `src/utils/calc.js` only. Three behavioral-change lines (MAGI fix) and three structural cleanup lines (dead variable, redundant condition), plus four inline comments. No new state, no UI changes, no new tests required — the existing 57-test suite covers regression detection.

**Tech Stack:** Vanilla JS, Vitest

---

## Files Modified

| File | Change |
|---|---|
| `src/utils/calc.js` | MAGI fix, dead variable removal, redundant condition fix, 4 simplification comments |

---

## Task 1: Feature branch

**Files:** none

- [ ] **Step 1: Create the feature branch**

```bash
git checkout -b feat/calc-audit
```

- [ ] **Step 2: Verify**

```bash
git branch
```

Expected: `* feat/calc-audit`

---

## Task 2: MAGI fix — add spouse pension to ordinary income

**Files:**
- Modify: `src/utils/calc.js` lines 108–109

**Context:** `nonSSWithPT` and `nonSSWithoutPT` are the MAGI approximation used for (a) `realOrdinary` in the drawdown loop → `estimateFederalTax()` and `irmaaMAGI`, and (b) the year-0 federal tax summary at the bottom. Spouse pension was excluded, causing federal tax and IRMAA to be understated when the spouse has a pension. `spousePension` defaults to 0, so this change has no effect when no spouse pension is entered.

The PlannerContext override pattern already handles isolation:
- Primary-solo projection: `spousePension: 0` override → fix is safe
- Spouse-solo projection: `pension: spousePension, spousePension: 0` override → fix is safe
- Combined projection: both pensions in scope → fix is correct

- [ ] **Step 1: Apply the fix**

Find these two lines (around line 108):

```js
const nonSSWithPT    = pension + partTimeIncome + rentalIncome;
const nonSSWithoutPT = pension + rentalIncome;
```

Replace with:

```js
const nonSSWithPT    = pension + spousePension + partTimeIncome + rentalIncome;
const nonSSWithoutPT = pension + spousePension + rentalIncome;
```

- [ ] **Step 2: Run the test suite**

```bash
npm test
```

Expected: 57 tests pass, 0 fail. (No existing test uses `spousePension > 0`, so no expected values need updating.)

- [ ] **Step 3: Commit**

```bash
git add src/utils/calc.js
git commit -m "fix: include spouse pension in MAGI for federal tax and IRMAA estimates"
```

---

## Task 3: Code quality — remove dead variable and redundant condition

**Files:**
- Modify: `src/utils/calc.js` lines 76, 281–283

**Context:**
- `baseBridgeHealthcareNeed` (line 76) is declared but never referenced — orphaned from an earlier implementation.
- The inner `bridgeHealthcare > 0 ?` condition inside the `inBridgePhase` branch is always true because `inBridgePhase` inherits from `hasBridge = bridgeHealthcare > 0 && retirementAge < lastMedicareAge`. The false branch (`healthcare * activeCol`) is unreachable dead code.

- [ ] **Step 1: Remove the dead variable**

Find this line (around line 76):

```js
const baseBridgeHealthcareNeed = bridgeHealthcare > 0 ? bridgeHealthcare * col : baseHealthcareNeed;
```

Delete it entirely. Nothing references it.

- [ ] **Step 2: Simplify the redundant condition**

Find this block in the drawdown loop (around line 281):

```js
const activeBaseHealthcareNeed = inBridgePhase
  ? (bridgeHealthcare > 0 ? bridgeHealthcare * activeCol : healthcare * activeCol)
  : healthcare * activeCol;
```

Replace with:

```js
const activeBaseHealthcareNeed = inBridgePhase
  ? bridgeHealthcare * activeCol
  : healthcare * activeCol;
```

- [ ] **Step 3: Run the test suite**

```bash
npm test
```

Expected: 57 tests pass, 0 fail.

- [ ] **Step 4: Commit**

```bash
git add src/utils/calc.js
git commit -m "refactor: remove dead baseBridgeHealthcareNeed variable and unreachable bridge condition"
```

---

## Task 4: Add simplification comments

**Files:**
- Modify: `src/utils/calc.js` — 4 comment additions

**Context:** Four locations in calc.js have intentional simplifications that aren't obvious to a reader. Each gets a comment explaining the behavior and its conservative/non-conservative bias, so future maintainers don't "fix" something that's working as designed.

- [ ] **Step 1: Comment — healthcare survivor scaling**

After the `activeBaseHealthcareNeed` line (the one just updated in Task 3), add a comment:

Find:
```js
const activeBaseHealthcareNeed = inBridgePhase
  ? bridgeHealthcare * activeCol
  : healthcare * activeCol;
```

Replace with:
```js
// Conservative simplification: not scaled by activeSurvFactor — household healthcare stays
// at the full entered amount after one spouse dies. Per-person Medicare costs don't drop
// much when a spouse dies (premiums are per-person), so this overstatement is intentional.
const activeBaseHealthcareNeed = inBridgePhase
  ? bridgeHealthcare * activeCol
  : healthcare * activeCol;
```

- [ ] **Step 2: Comment — mortgage payoff drops housing to $0**

Find these two lines (around line 276):

```js
const housePaid = housingType === "own" && ageInYear >= mortgagePayoffAge;
const effectiveHousingNeed = housePaid ? 0 : activeBaseHousingNeed;
```

Replace with:

```js
const housePaid = housingType === "own" && ageInYear >= mortgagePayoffAge;
// Simplification: housing drops to $0 after payoff. Ongoing maintenance and homeowner's
// insurance (~1–2% of home value/yr) are not modeled — users should include these in
// their 'Other' spending category. Slightly non-conservative but acceptable.
const effectiveHousingNeed = housePaid ? 0 : activeBaseHousingNeed;
```

- [ ] **Step 3: Comment — home sale 60% gains assumption**

Find the existing home sale comment block (around line 331). It currently reads (all 7 lines — include the trailing two lines in your find):

```js
// Home sale proceeds: inject into taxableBucket at the sale year.
// taxableBucket is the right destination — proceeds go into a taxable brokerage
// account in practice. The 60%-gains assumption applies on withdrawal (a minor
// overstatement since actual home sale proceeds are tax-free principal after
// the primary residence exclusion, but acceptable for a planning tool).
// Net proceeds = 95% of equity after realtor fees + closing costs.
// Both mortgageBalance and homeValue are today's values — mortgage paydown
// and home appreciation before the sale date are not modeled.
```

Replace with:

```js
// Home sale proceeds: inject into taxableBucket at the sale year.
// taxableBucket is the right destination — proceeds go into a taxable brokerage
// account in practice.
// Conservative: the 60%-gains assumption overstates the tax on home sale proceeds.
// In reality, the $250K/$500K primary residence exclusion eliminates gains tax for
// most users. Treating it as taxable is a modest conservative overstatement.
// Net proceeds = 95% of equity after realtor fees + closing costs.
// Note: mortgage paydown and home appreciation before the sale date are not modeled.
```

- [ ] **Step 4: Comment — realOrdinary not adjusted in survivor phase**

Find these lines (around line 233):

```js
const realSS       = ssMonthly * 12;
const realOrdinary = (ptEnded ? nonSSWithoutPT : nonSSWithPT) * 12;
```

Replace with:

```js
const realSS       = ssMonthly * 12;
// Not adjusted for survivor phase — pension and rental income don't necessarily
// halve after one spouse's death. The overstatement of income and the overstatement
// of taxes roughly cancel; accepted simplification. activeRealSS does correctly
// drop to ssMonthlyAlone*12 in survivor mode.
const realOrdinary = (ptEnded ? nonSSWithoutPT : nonSSWithPT) * 12;
```

- [ ] **Step 5: Run the test suite**

```bash
npm test
```

Expected: 57 tests pass, 0 fail.

- [ ] **Step 6: Commit**

```bash
git add src/utils/calc.js
git commit -m "docs: add conservative-bias comments to calc.js simplification points"
```

---

## Task 5: Open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/calc-audit
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create \
  --title "fix: calc.js model accuracy audit — MAGI fix + code quality" \
  --body "$(cat <<'EOF'
## Summary
- Fixes the one non-conservative accuracy gap: spouse pension was excluded from MAGI, causing federal tax and IRMAA to be understated when the spouse has a pension. Fix: add `spousePension` to `nonSSWithPT` / `nonSSWithoutPT` (2 lines).
- Removes dead variable `baseBridgeHealthcareNeed` (declared line 76, never referenced).
- Removes unreachable inner condition inside the bridge healthcare branch.
- Adds 4 inline comments documenting each accepted simplification and its conservative/non-conservative bias.

## Test plan
- [ ] `npm test` — 57 tests pass, 0 fail
- [ ] Scenario: couple with spouse pension $2,000/mo → federal tax and IRMAA callout are now higher than before (conservative correction)
- [ ] Scenario: no spouse pension → no change in output

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
