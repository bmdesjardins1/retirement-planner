# Roth Conversion Window Callout — Design Spec

**Date:** 2026-03-23
**Feature:** #10 — Roth conversion window callout
**Branch:** feat/roth-window

---

## Overview

Between retirement and age 73 (when RMDs begin), many retirees experience a "low income valley" — Social Security may not have started yet, part-time income has ended, and RMD-forced withdrawals haven't kicked in. This is a well-known planning opportunity: converting traditional dollars to Roth during this window locks in a lower tax rate and reduces future RMD burden.

The tool already surfaces RMDs and IRMAA as callouts in the Tax & Cost Summary card. This feature adds a companion callout that surfaces the *pre-RMD opportunity* for users who have traditional accounts and retire before 72.

---

## Scope

**In scope:**
- Detect the Roth conversion window from existing context state (no new inputs, no calc changes)
- Display a metric box in the Tax & Cost Summary card showing the window duration and a plain-language explanation
- Callout only appears when: active traditional accounts exist AND `rothWindowYears >= 2`

**Out of scope:**
- Modeling actual Roth conversions (would require new inputs: annual conversion amount, target bracket)
- Quantifying the tax savings from converting
- Spouse traditional accounts — the primary person's traditional balance is sufficient to signal the opportunity; extending to spouse accounts is a minor enhancement for later

---

## Data Model

No new state. Detection uses values already in PlannerContext and already destructured in ResultsStep:

| Value | Source | Purpose |
|---|---|---|
| `hasTrad401k`, `trad401k` | PlannerContext | Primary traditional 401(k) — both toggle and balance |
| `hasTradIRA`, `tradIRA` | PlannerContext | Primary traditional IRA — both toggle and balance |
| `retirementAge` | PlannerContext | Determines window start and duration |

---

## Architecture

### `src/steps/ResultsStep.jsx`

**Step 1 — Destructure new fields**

`retirementAge`, `hasTrad401k`, `trad401k`, `hasTradIRA`, `tradIRA` are all available from `usePlanner()`. Check whether they are already destructured; add any that are missing.

Note: `hasTradAccounts` is already computed on line 47 of ResultsStep using this exact pattern:
```js
const hasTradAccounts = (hasTrad401k && trad401k > 0) || (hasTradIRA && tradIRA > 0) || ...
```
The Roth window detection mirrors this for primary accounts only (spouse accounts excluded per scope).

**Step 2 — Compute derived values**

After the existing `homeSaleYear` lookup, add:

```js
// Roth conversion window: show when user has active traditional accounts and retires with
// at least 2 years before RMDs begin at 73. rothWindowYears is an inclusive count of ages
// (e.g. retirementAge=65 → ages 65,66,67,68,69,70,71,72 = 8 years).
// Minimum of 2 years avoids showing "Ages 72–72" (single-age range, visually confusing).
// Note: intentionally checks only primary accounts (not spouse). The existing hasTradAccounts
// check on line 47 includes spouse accounts for RMD detection — this is an accepted asymmetry.
// A user whose only traditional accounts belong to the spouse will see the RMD callout but not
// this one. See Simplification #3.
const rothWindowYears = 73 - retirementAge;
const showRothWindow =
  ((hasTrad401k && trad401k > 0) || (hasTradIRA && tradIRA > 0)) &&
  rothWindowYears >= 2;
```

**Step 3 — Render the metric box**

Place after the home sale callout block and **before the `<p className="disclaimer">` paragraph** that closes the Tax & Cost Summary card:

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

**Color choice:** `value--yellow` signals "pay attention to this opportunity" — not green (a positive outcome) and not red (a cost). Consistent with how yellow is used elsewhere for moderate-risk scenarios.

**Note on "income may be lower":** This is accurate for users who haven't started SS yet or are drawing from savings before pension/SS income begins. It is a simplification for users who start SS at retirement age — their income may already be substantial. See Simplifications #2.

---

## Simplifications

1. **Today's balances used as the signal, not projected balances.** `trad401k + tradIRA` are the user's input values today. If these are non-zero and the account type is toggled on, the callout appears. This is correct behavior — a user with traditional accounts today will have a traditional balance at retirement (the accumulation phase grows, not zeroes, these accounts).

2. **"Income may be lower" premise depends on SS claiming age.** If the user configured their SS claiming age to start at or before `retirementAge`, they will be receiving SS income throughout the entire window. The "lower income" framing is still valid as a planning observation (RMD-forced withdrawals would *increase* income at 73), but is less dramatic in this case. Acceptable for a heads-up callout; not worth complicating the note text.

3. **Spouse traditional accounts excluded from the signal.** `spouseTrad401k` / `spouseTradIRA` are not checked. If only the spouse has traditional accounts, the callout does not appear. Conservative simplification — easy to extend later.

4. **Window end is hardcoded to 72.** Current law (SECURE 2.0) sets RMDs at 73. If this changes, the `73` in the detection logic and `72` in the display string both need updating.

5. **Minimum 2-year window required.** `retirementAge = 72` would produce "Ages 72–72" (a visually confusing single-age range). The `rothWindowYears >= 2` guard prevents this edge case. A one-year window is also negligibly short as a planning opportunity.

---

## Testing

No unit tests — pure JSX conditional rendering with trivial arithmetic. No component test framework in this project. Manual verification:

1. **Shows when expected:** `hasTrad401k = true`, `trad401k > 0`, `retirementAge = 65` → callout shows "Ages 65–72" and "8 years"
2. **Hidden when no traditional accounts:** `trad401k = 0`, `tradIRA = 0` → callout does not appear
3. **Hidden when account toggled off:** `trad401k > 0` but `hasTrad401k = false`, `hasTradIRA = false` → callout does not appear
4. **Hidden when retirementAge ≥ 72:** `retirementAge = 72` → `rothWindowYears = 1`, fails `>= 2` guard, callout does not appear
5. **Hidden when retirementAge = 73:** `rothWindowYears = 0`, callout does not appear
6. **Minimum window:** `retirementAge = 71` → callout shows "Ages 71–72" and "2 years"
7. **IRA-only path:** `hasTrad401k = false`, `trad401k = 0`, `hasTradIRA = true`, `tradIRA > 0`, `retirementAge = 65` → callout appears (IRA alone triggers it)
8. **Coexists with other callouts:** RMD, IRMAA, and home sale boxes still display correctly
