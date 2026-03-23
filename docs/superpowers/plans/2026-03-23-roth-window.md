# Roth Conversion Window Callout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a yellow metric box to the Tax & Cost Summary card that surfaces the Roth conversion opportunity window when the user has traditional accounts and retires before age 71.

**Architecture:** Pure display addition — no new state, no calc changes. Two derived values computed in `ResultsStep.jsx` from already-destructured context fields, then a conditional JSX block inserted after the home sale callout.

**Tech Stack:** React 18, Vite

---

## Files Modified

| File | Change |
|---|---|
| `src/steps/ResultsStep.jsx` | Add `rothWindowYears` + `showRothWindow` derivations and conditional metric box JSX |

---

## Task 1: Feature branch

**Files:** none

- [ ] **Step 1: Create the feature branch**

```bash
git checkout -b feat/roth-window
```

- [ ] **Step 2: Verify**

```bash
git branch
```

Expected: `* feat/roth-window`

---

## Task 2: Implement the Roth window callout

**Files:**
- Modify: `src/steps/ResultsStep.jsx`

All required context fields (`trad401k`, `tradIRA`, `hasTrad401k`, `hasTradIRA`, `retirementAge`) are **already destructured** in the `usePlanner()` call at lines 20–21. No destructuring changes needed.

- [ ] **Step 1: Add derived values after the `homeSaleYear` lookup**

Find this block (around line 59–61):

```js
// Home sale: find the year proceeds were injected (only appears for drawdown-phase sales,
// since homeSaleAge is constrained to >= retirementAge by the context setters)
const homeSaleYear = results.yearsData.find(d => d.homeSaleProceeds > 0);
```

Insert immediately after it:

```js
// Roth conversion window: show when user has active traditional accounts and retires with
// at least 2 years before RMDs begin at 73. rothWindowYears is an inclusive count of ages
// (e.g. retirementAge=65 → ages 65,66,67,68,69,70,71,72 = 8 years).
// Minimum of 2 years avoids showing "Ages 72–72" (single-age range, visually confusing).
// Note: intentionally checks only primary accounts (not spouse). The existing hasTradAccounts
// check above includes spouse accounts for RMD detection — this is an accepted asymmetry.
// A user whose only traditional accounts belong to the spouse will see the RMD callout but not
// this one. See spec Simplification #3.
const rothWindowYears = 73 - retirementAge;
const showRothWindow =
  ((hasTrad401k && trad401k > 0) || (hasTradIRA && tradIRA > 0)) &&
  rothWindowYears >= 2;
```

- [ ] **Step 2: Add the metric box JSX after the home sale callout**

Find the home sale block and the disclaimer that follows it (around lines 361–374):

```jsx
        {homeSaleYear && (
          <div className="metric-box metric-box--green mt-20" style={{ gridColumn: "1 / -1" }}>
            ...
          </div>
        )}

        <p className="disclaimer">
```

Insert the Roth window block between the home sale closing `)}` and the `<p className="disclaimer">`:

```jsx
        {showRothWindow && (
          <div className="metric-box metric-box--yellow mt-20" style={{ gridColumn: "1 / -1" }}>
            <div className="metric-box-label">Roth Conversion Window</div>
            <div className="metric-box-value value--yellow">
              Ages {retirementAge}–72
            </div>
            <div className="metric-box-note">
              {rothWindowYears} years before RMDs begin at 73.
              Your income may be lower during this window — converting some traditional savings to Roth
              could reduce your lifetime tax bill. Roth accounts have no RMDs and withdrawals are tax-free.
            </div>
          </div>
        )}
```

- [ ] **Step 3: Run the test suite to confirm no regressions**

```bash
npm test
```

Expected: 57 tests pass, 0 fail.

- [ ] **Step 4: Verify the callout visually**

Start the dev server:

```bash
npm run dev
```

Open the app and check these scenarios manually:

| Scenario | Expected |
|---|---|
| `hasTrad401k = true`, `trad401k > 0`, `retirementAge = 65` | Callout shows "Ages 65–72" and "8 years" |
| `trad401k = 0`, `tradIRA = 0` | No callout |
| `trad401k > 0` but `hasTrad401k = false` (toggle off) | No callout |
| `retirementAge = 72` | No callout (`rothWindowYears = 1`, fails `>= 2`) |
| `retirementAge = 71` | Callout shows "Ages 71–72" and "2 years" |
| `hasTradIRA = true`, `tradIRA > 0`, `trad401k = 0` | Callout shows (IRA-only path) |
| Other callouts (RMD, IRMAA, home sale) still visible when applicable | No regressions |

- [ ] **Step 5: Commit**

```bash
git add src/steps/ResultsStep.jsx
git commit -m "feat: Roth conversion window callout in Tax & Cost Summary"
```

---

## Task 3: Open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/roth-window
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create \
  --title "feat: Roth conversion window callout" \
  --body "$(cat <<'EOF'
## Summary
- Adds a yellow metric box to the Tax & Cost Summary card when the user has active traditional accounts and retires before age 71 (window ≥ 2 years)
- Shows window duration (e.g. "Ages 65–72, 8 years") and a plain-language note about converting before RMDs begin at 73
- No new state, no calc changes — pure display addition using already-available context values

## Test plan
- [ ] `npm test` — 57 tests pass
- [ ] Traditional accounts + retirementAge 65 → callout appears with correct ages and year count
- [ ] No traditional accounts → no callout
- [ ] Traditional account toggled off → no callout
- [ ] retirementAge 72 → no callout (1-year window suppressed)
- [ ] retirementAge 71 → callout shows "Ages 71–72, 2 years"
- [ ] Other callouts (RMD, IRMAA, home sale) unaffected

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
