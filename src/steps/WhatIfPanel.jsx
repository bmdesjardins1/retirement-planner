import { useState, useMemo } from "react";
import { usePlanner } from "../context/PlannerContext";
import Card from "../components/Card";
import FieldInput from "../components/FieldInput";
import { runProjection } from "../utils/calc";
import { ssAdjustmentFactor } from "../utils/ssUtils";

export default function WhatIfPanel() {
  const {
    results,
    age, lifeExpectancy, retirementAge,
    spouseAge, spouseRetirementAge, spouseLifeExpectancy,
    hasSpouse,
    ss1, ss2, ss1ClaimAge, ss2ClaimAge,
    trad401k, roth401k, tradIRA, rothIRA, taxableBrokerage,
    hasTrad401k, hasRoth401k, hasTradIRA, hasRothIRA, hasTaxableBrokerage,
    spouseTrad401k, spouseRoth401k, spouseTradIRA, spouseRothIRA, spouseTaxableBrokerage,
    spouseHasTrad401k, spouseHasRoth401k, spouseHasTradIRA, spouseHasRothIRA, spouseHasTaxableBrokerage,
    annualContrib401k, employerMatch, annualContribIRA, annualContribOther,
    spouseAnnualContrib401k, spouseEmployerMatch, spouseAnnualContribIRA, spouseAnnualContribOther,
    pension, pensionCOLA, pensionSurvivorPct,
    spousePension, spousePensionCOLA, spousePensionSurvivorPct,
    partTimeIncome, partTimeEndAge, rentalIncome,
    housing, food, healthcare, bridgeHealthcare, transport, leisure, other,
    longTermCare, ltcStartAge, healthcareInflation,
    housingType, mortgagePayoffAge,
    homeValue, homeOwned, mortgageBalance, homeSaleIntent, homeSaleAge,
    investmentReturn, inflation,
    stateInfo, planningToMove, moveAge, retirementStateInfo,
  } = usePlanner();

  // Baseline totals used to initialize state and compute scale factors
  const baseSpending = housing + food + healthcare + transport + leisure + other;
  const baseAnnualContribs =
    annualContrib401k + annualContribIRA + annualContribOther +
    (hasSpouse ? spouseAnnualContrib401k + spouseAnnualContribIRA + spouseAnnualContribOther : 0);

  // What If local state — initialized from current plan values on mount
  const [wiRetirementAge,   setWiRetirementAge]   = useState(retirementAge);
  const [wiSs1ClaimAge,     setWiSs1ClaimAge]     = useState(ss1ClaimAge);
  const [wiSs2ClaimAge,     setWiSs2ClaimAge]     = useState(ss2ClaimAge);
  const [wiAnnualContribs,  setWiAnnualContribs]  = useState(baseAnnualContribs);
  const [wiMonthlySpending, setWiMonthlySpending] = useState(baseSpending);
  const [wiPartTimeIncome,  setWiPartTimeIncome]  = useState(partTimeIncome);

  // Scale factors for proportional overrides
  const spendingScale = baseSpending > 0 ? wiMonthlySpending / baseSpending : 1;
  const contribScale  = baseAnnualContribs > 0 ? wiAnnualContribs / baseAnnualContribs : 1;

  // Alternate projection
  const wiResults = useMemo(() => runProjection({
    age, lifeExpectancy,
    retirementAge: wiRetirementAge,
    spouseAge, spouseRetirementAge, spouseLifeExpectancy,
    hasSpouse,
    ss1: ss1 * ssAdjustmentFactor(wiSs1ClaimAge),
    ss2: ss2 * ssAdjustmentFactor(wiSs2ClaimAge),
    trad401k: (hasTrad401k ? trad401k : 0) + (hasSpouse && spouseHasTrad401k ? spouseTrad401k : 0),
    roth401k: (hasRoth401k ? roth401k : 0) + (hasSpouse && spouseHasRoth401k ? spouseRoth401k : 0),
    tradIRA:  (hasTradIRA  ? tradIRA  : 0) + (hasSpouse && spouseHasTradIRA  ? spouseTradIRA  : 0),
    rothIRA:  (hasRothIRA  ? rothIRA  : 0) + (hasSpouse && spouseHasRothIRA  ? spouseRothIRA  : 0),
    taxableBrokerage: (hasTaxableBrokerage ? taxableBrokerage : 0) + (hasSpouse && spouseHasTaxableBrokerage ? spouseTaxableBrokerage : 0),
    annualContrib401k:        Math.round(annualContrib401k        * contribScale),
    employerMatch,
    annualContribIRA:         Math.round(annualContribIRA         * contribScale),
    annualContribOther:       Math.round(annualContribOther       * contribScale),
    spouseAnnualContrib401k:  Math.round(spouseAnnualContrib401k  * contribScale),
    spouseEmployerMatch,
    spouseAnnualContribIRA:   Math.round(spouseAnnualContribIRA   * contribScale),
    spouseAnnualContribOther: Math.round(spouseAnnualContribOther * contribScale),
    survivorFactor: 1.0,
    housing:    Math.round(housing    * spendingScale),
    food:       Math.round(food       * spendingScale),
    healthcare: Math.round(healthcare * spendingScale),
    transport:  Math.round(transport  * spendingScale),
    leisure:    Math.round(leisure    * spendingScale),
    other:      Math.round(other      * spendingScale),
    bridgeHealthcare,
    partTimeIncome: wiPartTimeIncome,
    partTimeEndAge, rentalIncome,
    pension, pensionCOLA, pensionSurvivorPct,
    spousePension, spousePensionCOLA, spousePensionSurvivorPct,
    longTermCare, ltcStartAge, healthcareInflation,
    housingType, mortgagePayoffAge,
    homeValue, homeOwned, mortgageBalance, homeSaleIntent, homeSaleAge,
    investmentReturn, inflation,
    stateInfo,
    moveAge: planningToMove ? moveAge : Infinity,
    retirementStateInfo: planningToMove ? retirementStateInfo : stateInfo,
  }), [
    wiRetirementAge, wiSs1ClaimAge, wiSs2ClaimAge,
    wiAnnualContribs, wiMonthlySpending, wiPartTimeIncome,
    age, lifeExpectancy, spouseAge, spouseRetirementAge, spouseLifeExpectancy,
    hasSpouse, ss1, ss2,
    trad401k, roth401k, tradIRA, rothIRA, taxableBrokerage,
    hasTrad401k, hasRoth401k, hasTradIRA, hasRothIRA, hasTaxableBrokerage,
    spouseTrad401k, spouseRoth401k, spouseTradIRA, spouseRothIRA, spouseTaxableBrokerage,
    spouseHasTrad401k, spouseHasRoth401k, spouseHasTradIRA, spouseHasRothIRA, spouseHasTaxableBrokerage,
    annualContrib401k, annualContribIRA, annualContribOther,
    spouseAnnualContrib401k, spouseAnnualContribIRA, spouseAnnualContribOther,
    employerMatch, spouseEmployerMatch,
    pension, pensionCOLA, pensionSurvivorPct,
    spousePension, spousePensionCOLA, spousePensionSurvivorPct,
    partTimeEndAge, rentalIncome,
    housing, food, healthcare, transport, leisure, other,
    bridgeHealthcare, longTermCare, ltcStartAge, healthcareInflation,
    housingType, mortgagePayoffAge,
    homeValue, homeOwned, mortgageBalance, homeSaleIntent, homeSaleAge,
    investmentReturn, inflation,
    stateInfo, planningToMove, moveAge, retirementStateInfo,
  ]);

  return (
    <div className="whatif-layout">
      {/* Left column: input panel */}
      <Card>
        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
          Adjust any variables — comparison updates automatically
        </div>
        <FieldInput
          label="Your Retirement Age"
          value={wiRetirementAge}
          min={age}
          max={80}
          step={1}
          suffix=" yrs"
          onChange={setWiRetirementAge}
          note={`Your plan: ${retirementAge} yrs`}
        />
        <FieldInput
          label="Your SS Claim Age"
          value={wiSs1ClaimAge}
          min={62}
          max={70}
          step={1}
          suffix=" yrs"
          onChange={setWiSs1ClaimAge}
          note={`Your plan: ${ss1ClaimAge} yrs`}
        />
        {hasSpouse && ss2 > 0 && (
          <FieldInput
            label="Spouse SS Claim Age"
            value={wiSs2ClaimAge}
            min={62}
            max={70}
            step={1}
            suffix=" yrs"
            onChange={setWiSs2ClaimAge}
            note={`Your plan: ${ss2ClaimAge} yrs`}
          />
        )}
        <FieldInput
          label="Annual Contributions"
          value={wiAnnualContribs}
          min={0}
          max={200000}
          step={500}
          prefix="$"
          onChange={setWiAnnualContribs}
          note={`Your plan: $${baseAnnualContribs.toLocaleString()}/yr`}
        />
        <FieldInput
          label="Monthly Spending"
          value={wiMonthlySpending}
          min={0}
          max={50000}
          step={100}
          prefix="$"
          suffix="/mo"
          onChange={setWiMonthlySpending}
          note={`Your plan: $${baseSpending.toLocaleString()}/mo`}
        />
        <FieldInput
          label="Part-Time Income"
          value={wiPartTimeIncome}
          min={0}
          max={20000}
          step={100}
          prefix="$"
          suffix="/mo"
          onChange={setWiPartTimeIncome}
          note={`Your plan: $${partTimeIncome.toLocaleString()}/mo · ends age ${partTimeEndAge}`}
        />
      </Card>

      {/* Right column: comparison output — completed in Task 4 */}
      <div>
        <div style={{ color: '#64748b', fontSize: 13, padding: 16 }}>
          Comparison output loading…
        </div>
      </div>
    </div>
  );
}
