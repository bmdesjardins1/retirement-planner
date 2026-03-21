import { createContext, useContext, useState, useMemo } from "react";
import { STATE_DATA } from "../data/stateData";
import { runProjection } from "../utils/calc";
import { ssAdjustmentFactor } from "../utils/ssUtils";

const PlannerContext = createContext(null);

export function PlannerProvider({ children }) {
  // UI
  const [step, setStep] = useState(0);

  // Profile
  const [age, setAgeRaw]                                       = useState(45);
  const [spouseAge, setSpouseAgeRaw]                           = useState(43);
  const [hasSpouse, setHasSpouse]                              = useState(true);
  const [lifeExpectancy, setLifeExpectancyRaw]                 = useState(88);
  const [spouseLifeExpectancy, setSpouseLifeExpectancyRaw]     = useState(86);
  const [retirementAge, setRetirementAgeRaw]                   = useState(65);
  const [spouseRetirementAge, setSpouseRetirementAgeRaw]       = useState(63);
  const [state, setState]                                      = useState("Florida");

  // Income
  const [ss1, setSs1]                         = useState(1800);
  const [ss2, setSs2]                         = useState(1400);
  const [ss1ClaimAge, setSs1ClaimAge]         = useState(67);
  const [ss2ClaimAge, setSs2ClaimAge]         = useState(67);
  const [pension, setPension]                 = useState(0);
  const [pensionCOLA, setPensionCOLA]         = useState(false);
  const [partTimeIncome, setPartTimeIncome]   = useState(0);
  const [partTimeEndAge, setPartTimeEndAge]   = useState(70);
  const [rentalIncome, setRentalIncome]       = useState(0);

  // Primary contributions
  const [annualContrib401k, setAnnualContrib401k]   = useState(10000);
  const [employerMatch, setEmployerMatch]           = useState(5000);
  const [annualContribIRA, setAnnualContribIRA]     = useState(3000);
  const [annualContribOther, setAnnualContribOther] = useState(0);

  // Spouse contributions
  const [spouseAnnualContrib401k, setSpouseAnnualContrib401k]   = useState(8000);
  const [spouseEmployerMatch, setSpouseEmployerMatch]           = useState(4000);
  const [spouseAnnualContribIRA, setSpouseAnnualContribIRA]     = useState(3000);
  const [spouseAnnualContribOther, setSpouseAnnualContribOther] = useState(0);

  // Primary assets — 5 typed account fields
  const [trad401k, setTrad401k]                       = useState(270000);
  const [roth401k, setRoth401k]                       = useState(0);
  const [tradIRA, setTradIRA]                         = useState(75000);
  const [rothIRA, setRothIRA]                         = useState(0);
  const [taxableBrokerage, setTaxableBrokerage]       = useState(50000);

  // Primary account visibility toggles (default visible: trad401k, tradIRA, taxableBrokerage)
  const [hasTrad401k, setHasTrad401k]                 = useState(true);
  const [hasRoth401k, setHasRoth401k]                 = useState(false);
  const [hasTradIRA, setHasTradIRA]                   = useState(true);
  const [hasRothIRA, setHasRothIRA]                   = useState(false);
  const [hasTaxableBrokerage, setHasTaxableBrokerage] = useState(true);

  // Spouse assets — 5 typed account fields
  const [spouseTrad401k, setSpouseTrad401k]                       = useState(180000);
  const [spouseRoth401k, setSpouseRoth401k]                       = useState(0);
  const [spouseTradIRA, setSpouseTradIRA]                         = useState(45000);
  const [spouseRothIRA, setSpouseRothIRA]                         = useState(0);
  const [spouseTaxableBrokerage, setSpouseTaxableBrokerage]       = useState(30000);

  // Spouse account visibility toggles
  const [spouseHasTrad401k, setSpouseHasTrad401k]                 = useState(true);
  const [spouseHasRoth401k, setSpouseHasRoth401k]                 = useState(false);
  const [spouseHasTradIRA, setSpouseHasTradIRA]                   = useState(true);
  const [spouseHasRothIRA, setSpouseHasRothIRA]                   = useState(false);
  const [spouseHasTaxableBrokerage, setSpouseHasTaxableBrokerage] = useState(true);

  // Shared assets & growth
  const [homeValue, setHomeValue]                       = useState(320000);
  const [homeOwned, setHomeOwned]                       = useState(true);
  const [investmentReturn, setInvestmentReturn]         = useState(5);
  const [inflation, setInflation]                       = useState(3);
  const [healthcareInflation, setHealthcareInflation]   = useState(5.5);

  // Spending
  const [housing, setHousing]           = useState(1500);
  const [food, setFood]                 = useState(700);
  const [healthcare, setHealthcare]     = useState(800);
  const [transport, setTransport]       = useState(400);
  const [leisure, setLeisure]           = useState(500);
  const [other, setOther]               = useState(300);
  const [longTermCare, setLongTermCare] = useState(0);
  const [ltcStartAge, setLtcStartAge]   = useState(80);

  // Constrained setters — enforce cross-field ordering rules
  const setAge = (v) => {
    setAgeRaw(v);
    if (retirementAge < v)   setRetirementAgeRaw(v);
    if (lifeExpectancy <= v) setLifeExpectancyRaw(v + 1);
  };

  const setRetirementAge = (v) => {
    setRetirementAgeRaw(v);
    if (lifeExpectancy <= v) setLifeExpectancyRaw(v + 1);
    if (partTimeEndAge < v)  setPartTimeEndAge(v);
    if (ltcStartAge < v)     setLtcStartAge(v);
  };

  const setLifeExpectancy = (v) => {
    setLifeExpectancyRaw(Math.max(v, retirementAge + 1));
    if (ltcStartAge > v)     setLtcStartAge(v);
  };

  const setSpouseAge = (v) => {
    setSpouseAgeRaw(v);
    if (spouseRetirementAge < v)   setSpouseRetirementAgeRaw(v);
    if (spouseLifeExpectancy <= v) setSpouseLifeExpectancyRaw(v + 1);
  };

  const setSpouseRetirementAge = (v) => {
    setSpouseRetirementAgeRaw(v);
    if (spouseLifeExpectancy <= v) setSpouseLifeExpectancyRaw(v + 1);
  };

  const setSpouseLifeExpectancy = (v) => {
    setSpouseLifeExpectancyRaw(Math.max(v, spouseRetirementAge + 1));
  };

  // Derived
  const stateInfo = STATE_DATA[state] || STATE_DATA["Florida"];
  const adjustedSS1 = ss1 * ssAdjustmentFactor(ss1ClaimAge);
  const adjustedSS2 = ss2 * ssAdjustmentFactor(ss2ClaimAge);

  // Shared inputs passed to every projection
  const sharedInputs = {
    pension, pensionCOLA, partTimeIncome, partTimeEndAge, rentalIncome,
    homeValue, homeOwned, investmentReturn, inflation, healthcareInflation,
    housing, food, healthcare, transport, leisure, other,
    longTermCare, ltcStartAge,
    stateInfo,
  };

  // Combined projection — primary source of truth for verdict / runway
  const results = useMemo(() => runProjection({
    age, retirementAge, lifeExpectancy,
    spouseAge, spouseRetirementAge, spouseLifeExpectancy,
    hasSpouse,
    ss1: adjustedSS1, ss2: adjustedSS2,
    trad401k: (hasTrad401k ? trad401k : 0) + (hasSpouse && spouseHasTrad401k ? spouseTrad401k : 0),
    roth401k: (hasRoth401k ? roth401k : 0) + (hasSpouse && spouseHasRoth401k ? spouseRoth401k : 0),
    tradIRA: (hasTradIRA ? tradIRA : 0) + (hasSpouse && spouseHasTradIRA ? spouseTradIRA : 0),
    rothIRA: (hasRothIRA ? rothIRA : 0) + (hasSpouse && spouseHasRothIRA ? spouseRothIRA : 0),
    taxableBrokerage: (hasTaxableBrokerage ? taxableBrokerage : 0) + (hasSpouse && spouseHasTaxableBrokerage ? spouseTaxableBrokerage : 0),
    annualContrib401k, employerMatch, annualContribIRA, annualContribOther,
    spouseAnnualContrib401k: hasSpouse ? spouseAnnualContrib401k : 0,
    spouseEmployerMatch:     hasSpouse ? spouseEmployerMatch     : 0,
    spouseAnnualContribIRA:  hasSpouse ? spouseAnnualContribIRA  : 0,
    spouseAnnualContribOther: hasSpouse ? spouseAnnualContribOther : 0,
    survivorFactor: 1.0,
    ...sharedInputs,
  }), [
    age, retirementAge, lifeExpectancy,
    spouseAge, spouseRetirementAge, spouseLifeExpectancy,
    hasSpouse, ss1, ss1ClaimAge, ss2, ss2ClaimAge,
    trad401k, roth401k, tradIRA, rothIRA, taxableBrokerage,
    hasTrad401k, hasRoth401k, hasTradIRA, hasRothIRA, hasTaxableBrokerage,
    spouseTrad401k, spouseRoth401k, spouseTradIRA, spouseRothIRA, spouseTaxableBrokerage,
    spouseHasTrad401k, spouseHasRoth401k, spouseHasTradIRA, spouseHasRothIRA, spouseHasTaxableBrokerage,
    annualContrib401k, employerMatch, annualContribIRA, annualContribOther,
    spouseAnnualContrib401k, spouseEmployerMatch, spouseAnnualContribIRA, spouseAnnualContribOther,
    pension, pensionCOLA, partTimeIncome, partTimeEndAge, rentalIncome,
    housing, food, healthcare, transport, leisure, other,
    longTermCare, ltcStartAge,
    homeValue, homeOwned, investmentReturn, inflation, healthcareInflation,
    stateInfo,
  ]);

  // Primary solo — primary assets + contributions, 60% expenses
  const primaryResults = useMemo(() => runProjection({
    age, retirementAge, lifeExpectancy,
    hasSpouse: false,
    ss1: adjustedSS1, ss2: 0,
    trad401k: hasTrad401k ? trad401k : 0,
    roth401k: hasRoth401k ? roth401k : 0,
    tradIRA: hasTradIRA ? tradIRA : 0,
    rothIRA: hasRothIRA ? rothIRA : 0,
    taxableBrokerage: hasTaxableBrokerage ? taxableBrokerage : 0,
    annualContrib401k, employerMatch, annualContribIRA, annualContribOther,
    spouseAnnualContrib401k: 0, spouseEmployerMatch: 0,
    spouseAnnualContribIRA: 0, spouseAnnualContribOther: 0,
    survivorFactor: 0.6,
    ...sharedInputs,
  }), [
    age, retirementAge, lifeExpectancy,
    ss1, ss1ClaimAge,
    trad401k, roth401k, tradIRA, rothIRA, taxableBrokerage,
    hasTrad401k, hasRoth401k, hasTradIRA, hasRothIRA, hasTaxableBrokerage,
    annualContrib401k, employerMatch, annualContribIRA, annualContribOther,
    pension, pensionCOLA, partTimeIncome, partTimeEndAge, rentalIncome,
    housing, food, healthcare, transport, leisure, other,
    longTermCare, ltcStartAge,
    homeValue, homeOwned, investmentReturn, inflation, healthcareInflation,
    stateInfo,
  ]);

  // Spouse solo — spouse assets + contributions, spouse's own timeline, 60% expenses
  const spouseResults = useMemo(() => hasSpouse ? runProjection({
    age: spouseAge, retirementAge: spouseRetirementAge, lifeExpectancy: spouseLifeExpectancy,
    hasSpouse: false,
    ss1: adjustedSS2, ss2: 0,
    trad401k: spouseHasTrad401k ? spouseTrad401k : 0,
    roth401k: spouseHasRoth401k ? spouseRoth401k : 0,
    tradIRA: spouseHasTradIRA ? spouseTradIRA : 0,
    rothIRA: spouseHasRothIRA ? spouseRothIRA : 0,
    taxableBrokerage: spouseHasTaxableBrokerage ? spouseTaxableBrokerage : 0,
    annualContrib401k: spouseAnnualContrib401k, employerMatch: spouseEmployerMatch,
    annualContribIRA: spouseAnnualContribIRA, annualContribOther: spouseAnnualContribOther,
    spouseAnnualContrib401k: 0, spouseEmployerMatch: 0,
    spouseAnnualContribIRA: 0, spouseAnnualContribOther: 0,
    survivorFactor: 0.6,
    ...sharedInputs,
  }) : null, [
    hasSpouse, spouseAge, spouseRetirementAge, spouseLifeExpectancy,
    ss2, ss2ClaimAge,
    spouseTrad401k, spouseRoth401k, spouseTradIRA, spouseRothIRA, spouseTaxableBrokerage,
    spouseHasTrad401k, spouseHasRoth401k, spouseHasTradIRA, spouseHasRothIRA, spouseHasTaxableBrokerage,
    spouseAnnualContrib401k, spouseEmployerMatch, spouseAnnualContribIRA, spouseAnnualContribOther,
    pension, pensionCOLA, partTimeIncome, partTimeEndAge, rentalIncome,
    housing, food, healthcare, transport, leisure, other,
    longTermCare, ltcStartAge,
    homeValue, homeOwned, investmentReturn, inflation, healthcareInflation,
    stateInfo,
  ]);

  return (
    <PlannerContext.Provider value={{
      // UI
      step, setStep,
      // Profile
      age, setAge,
      spouseAge, setSpouseAge,
      hasSpouse, setHasSpouse,
      lifeExpectancy, setLifeExpectancy,
      spouseLifeExpectancy, setSpouseLifeExpectancy,
      retirementAge, setRetirementAge,
      spouseRetirementAge, setSpouseRetirementAge,
      state, setState,
      stateInfo,
      // Primary contributions
      annualContrib401k, setAnnualContrib401k,
      employerMatch, setEmployerMatch,
      annualContribIRA, setAnnualContribIRA,
      annualContribOther, setAnnualContribOther,
      // Spouse contributions
      spouseAnnualContrib401k, setSpouseAnnualContrib401k,
      spouseEmployerMatch, setSpouseEmployerMatch,
      spouseAnnualContribIRA, setSpouseAnnualContribIRA,
      spouseAnnualContribOther, setSpouseAnnualContribOther,
      // Income
      ss1, setSs1,
      ss2, setSs2,
      ss1ClaimAge, setSs1ClaimAge,
      ss2ClaimAge, setSs2ClaimAge,
      adjustedSS1, adjustedSS2,
      pension, setPension,
      pensionCOLA, setPensionCOLA,
      partTimeIncome, setPartTimeIncome,
      partTimeEndAge, setPartTimeEndAge,
      rentalIncome, setRentalIncome,
      // Primary assets
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
      // Spouse assets
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
      // Shared assets
      homeValue, setHomeValue,
      homeOwned, setHomeOwned,
      investmentReturn, setInvestmentReturn,
      inflation, setInflation,
      healthcareInflation, setHealthcareInflation,
      // Spending
      housing, setHousing,
      food, setFood,
      healthcare, setHealthcare,
      transport, setTransport,
      leisure, setLeisure,
      other, setOther,
      longTermCare, setLongTermCare,
      ltcStartAge, setLtcStartAge,
      // Derived
      results,
      primaryResults,
      spouseResults,
    }}>
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlanner() {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used inside PlannerProvider");
  return ctx;
}
