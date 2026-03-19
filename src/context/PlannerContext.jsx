import { createContext, useContext, useState, useMemo } from "react";
import { STATE_DATA } from "../data/stateData";
import { runProjection } from "../utils/calc";

const PlannerContext = createContext(null);

export function PlannerProvider({ children }) {
  // UI
  const [step, setStep] = useState(0);

  // Profile
  const [age, setAge]                                 = useState(45);
  const [spouseAge, setSpouseAge]                     = useState(43);
  const [hasSpouse, setHasSpouse]                     = useState(true);
  const [lifeExpectancy, setLifeExpectancy]           = useState(88);
  const [spouseLifeExpectancy, setSpouseLifeExpectancy] = useState(86);
  const [retirementAge, setRetirementAge]             = useState(65);
  const [spouseRetirementAge, setSpouseRetirementAge] = useState(63);
  const [state, setState]                             = useState("Florida");

  // Income
  const [ss1, setSs1]                         = useState(1800);
  const [ss2, setSs2]                         = useState(1400);
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

  // Primary assets
  const [savings401k, setSavings401k]               = useState(270000);
  const [iraBalance, setIraBalance]                 = useState(75000);
  const [taxableInvestments, setTaxableInvestments] = useState(50000);

  // Spouse assets
  const [spouseSavings401k, setSpouseSavings401k]               = useState(180000);
  const [spouseIraBalance, setSpouseIraBalance]                 = useState(45000);
  const [spouseTaxableInvestments, setSpouseTaxableInvestments] = useState(30000);

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

  // Derived
  const stateInfo = STATE_DATA[state] || STATE_DATA["Florida"];

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
    ss1, ss2,
    savings401k: savings401k + (hasSpouse ? spouseSavings401k : 0),
    iraBalance: iraBalance + (hasSpouse ? spouseIraBalance : 0),
    taxableInvestments: taxableInvestments + (hasSpouse ? spouseTaxableInvestments : 0),
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
    hasSpouse, ss1, ss2,
    savings401k, iraBalance, taxableInvestments,
    spouseSavings401k, spouseIraBalance, spouseTaxableInvestments,
    annualContrib401k, employerMatch, annualContribIRA, annualContribOther,
    spouseAnnualContrib401k, spouseEmployerMatch, spouseAnnualContribIRA, spouseAnnualContribOther,
    ...Object.values(sharedInputs),
  ]);

  // Primary solo — primary assets + contributions, 60% expenses
  const primaryResults = useMemo(() => runProjection({
    age, retirementAge, lifeExpectancy,
    hasSpouse: false,
    ss1, ss2: 0,
    savings401k, iraBalance, taxableInvestments,
    annualContrib401k, employerMatch, annualContribIRA, annualContribOther,
    spouseAnnualContrib401k: 0, spouseEmployerMatch: 0,
    spouseAnnualContribIRA: 0, spouseAnnualContribOther: 0,
    survivorFactor: 0.6,
    ...sharedInputs,
  }), [
    age, retirementAge, lifeExpectancy,
    ss1,
    savings401k, iraBalance, taxableInvestments,
    annualContrib401k, employerMatch, annualContribIRA, annualContribOther,
    ...Object.values(sharedInputs),
  ]);

  // Spouse solo — spouse assets + contributions, spouse's own timeline, 60% expenses
  const spouseResults = useMemo(() => hasSpouse ? runProjection({
    age: spouseAge, retirementAge: spouseRetirementAge, lifeExpectancy: spouseLifeExpectancy,
    hasSpouse: false,
    ss1: ss2, ss2: 0,
    savings401k: spouseSavings401k, iraBalance: spouseIraBalance, taxableInvestments: spouseTaxableInvestments,
    annualContrib401k: spouseAnnualContrib401k, employerMatch: spouseEmployerMatch,
    annualContribIRA: spouseAnnualContribIRA, annualContribOther: spouseAnnualContribOther,
    spouseAnnualContrib401k: 0, spouseEmployerMatch: 0,
    spouseAnnualContribIRA: 0, spouseAnnualContribOther: 0,
    survivorFactor: 0.6,
    ...sharedInputs,
  }) : null, [
    hasSpouse, spouseAge, spouseRetirementAge, spouseLifeExpectancy,
    ss2,
    spouseSavings401k, spouseIraBalance, spouseTaxableInvestments,
    spouseAnnualContrib401k, spouseEmployerMatch, spouseAnnualContribIRA, spouseAnnualContribOther,
    ...Object.values(sharedInputs),
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
      pension, setPension,
      pensionCOLA, setPensionCOLA,
      partTimeIncome, setPartTimeIncome,
      partTimeEndAge, setPartTimeEndAge,
      rentalIncome, setRentalIncome,
      // Primary assets
      savings401k, setSavings401k,
      iraBalance, setIraBalance,
      taxableInvestments, setTaxableInvestments,
      // Spouse assets
      spouseSavings401k, setSpouseSavings401k,
      spouseIraBalance, setSpouseIraBalance,
      spouseTaxableInvestments, setSpouseTaxableInvestments,
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
