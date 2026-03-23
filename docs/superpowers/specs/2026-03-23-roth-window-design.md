# Roth Conversion Window Callout — Design Spec

**Date:** 2026-03-23
**Feature:** #10 — Roth conversion window callout
**Branch:** feat/roth-window

---

## Overview

Between retirement and age 73 (when RMDs begin), many retirees experience a "low income valley" — Social Security may not have started yet, part-time income has ended, and RMD-forced withdrawals haven't kicked in. This is a well-known planning opportunity: converting traditional dollars to Roth during this window locks in a lower tax rate and reduces future RMD burden.

The tool already surfaces RMDs and IRMAA as callouts in the Tax & Cost Summary card. This feature adds a companion callout that surfaces the *pre-RMD opportunity* for users who have traditional accounts and retire before 73.

---

## Scope

**In scope:**
- Detect the Roth conversion window from existing context state (no new inputs, no calc changes)
- Display a metric box in the Tax & Cost Summary card showing the window duration and a plain-language explanation
- Callout only appears when: `(trad401k + tradIRA) > 0` AND `retirementAge < 73`

**Out of scope:**
- Modeling actual Roth conversions (would require new inputs: annual conversion amount, target bracket)
- Quantifying the tax savings from converting
- Spouse traditional accounts (`spouseTrad401k`, `spouseTradIRA`) — the primary person's traditional balance is sufficient to signal the opportunity; adding spouse accounts is a minor enhancement for later

---

## Data Model

No new state. Detection uses values already in PlannerContext:

| Value | Source | Purpose |
|---|---|---|
| `trad401k` | PlannerContext | Primary traditional 401(k) balance |
| `tradIRA` | PlannerContext | Primary traditional IRA balance |
| `retirementAge` | PlannerContext | Determines window start |

Both `trad401k` and `tradIRA` are today's input values — they are not the projected balance at retirement. This is an acceptable simplification: if the user enters non-zero traditional balances today, they will have a non-zero traditional balance at retirement (even after growth, the bucket remains non-zero unless fully depleted before retirement, which is not modeled during accumulation).

---

## Architecture

### `src/steps/ResultsStep.jsx`

**Step 1 — Destructure new fields**

Add `trad401k` and `tradIRA` to the `usePlanner()` destructuring. `retirementAge` is already destructured.

**Step 2 — Compute derived values**

After the existing `homeSaleYear` lookup, add:

```js
// Roth conversion window: window exists when user has traditional accounts and retires before RMDs begin
const rothWindowYears = 73 - retirementAge;
const showRothWindow = (trad401k + tradIRA) > 0 && rothWindowYears > 0;
```

**Step 3 — Render the metric box**

Place after the home sale callout block, before the closing `</div>` of the Tax & Cost Summary card:

```jsx
{showRothWindow && (
  <div className="metric-box mt-20" style={{ gridColumn: "1 / -1" }}>
    <div className="metric-box-label">Roth Conversion Window</div>
    <div className="metric-box-value value--yellow">
      Ages {retirementAge}–72
    </div>
    <div className="metric-box-note">
      {rothWindowYears} year{rothWindowYears !== 1 ? 's' : ''} before RMDs begin at 73.
      Your income may be lower during this window — converting some traditional savings to Roth
      could reduce your lifetime tax bill. Roth accounts have no RMDs and withdrawals are tax-free.
    </div>
  </div>
)}
```

**Color choice:** `value--yellow` signals "pay attention to this opportunity" — not green (a positive outcome) and not red (a cost). Consistent with how yellow is used elsewhere in the verdict banner for moderate-risk scenarios.

---

## Simplifications

1. **Today's balances used as the signal, not projected balances.** If `trad401k + tradIRA > 0` today, we show the callout. If the user has traditional accounts that will be zero at retirement (e.g. they entered $0), no callout appears. This is correct behavior — users with zero traditional accounts have nothing to convert.

2. **Spouse traditional accounts not included in the signal.** `spouseTrad401k` and `spouseTradIRA` are not checked. If only the spouse has traditional accounts, the callout does not appear. This is a conservative simplification — the opportunity still exists for the spouse's accounts. Acceptable for now; easy to extend later by changing the condition to `(trad401k + tradIRA + spouseTrad401k + spouseTradIRA) > 0`.

3. **No quantification of conversion amount or tax savings.** The callout is a heads-up nudge, not a recommendation engine. Quantifying the benefit requires modeling conversions (annual conversion amount, marginal rate comparison) — a separate, larger feature.

4. **Window end is hardcoded to 72 (RMDs begin at 73).** Current law sets RMDs at 73 (SECURE 2.0). If this changes, the hardcoded `73` in the detection logic and display string would need updating.

---

## Testing

No unit tests — this feature is pure JSX conditional rendering with trivial arithmetic. No component test framework exists in the project. Verification is manual:

1. **Shows when expected:** Set `trad401k > 0`, `retirementAge = 65` → callout appears with "Ages 65–72" and "8 years"
2. **Hidden when no traditional accounts:** Set `trad401k = 0`, `tradIRA = 0` → callout does not appear
3. **Hidden when retirementAge ≥ 73:** Set `retirementAge = 73` → `rothWindowYears = 0`, callout does not appear
4. **Pluralization:** Set `retirementAge = 72` → note reads "1 year before RMDs begin"
5. **Coexists with other callouts:** Verify RMD, IRMAA, and home sale boxes still display correctly alongside the new box
