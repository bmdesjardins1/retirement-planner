import { estimateFederalTax } from "./federalTax";

export function verdictConfig(years, lifeExpectancy, age) {
  const remaining = lifeExpectancy - age;
  if (years >= remaining + 10) return {
    label: "Financially Secure",
    bannerClass: "verdict--secure",
    colorClass: "value--green",
    icon: "✦",
    desc: "Your savings are projected to outlast your life expectancy with a healthy buffer.",
  };
  if (years >= remaining) return {
    label: "On Track",
    bannerClass: "verdict--on-track",
    colorClass: "value--yellow",
    icon: "◈",
    desc: "Your savings should cover your retirement, but consider reducing spending or growing investments.",
  };
  if (years >= remaining * 0.75) return {
    label: "Moderate Risk",
    bannerClass: "verdict--moderate",
    colorClass: "value--orange",
    icon: "▲",
    desc: "Funds may run short near end of life. Some adjustments are recommended.",
  };
  return {
    label: "At Risk",
    bannerClass: "verdict--at-risk",
    colorClass: "value--red",
    icon: "⚠",
    desc: "Savings may be depleted significantly before end of life expectancy. Action needed.",
  };
}

export function runProjection(inputs) {
  const {
    age: currentAge, retirementAge, lifeExpectancy, hasSpouse,
    spouseAge = 0, spouseRetirementAge = 65, spouseLifeExpectancy = lifeExpectancy,
    ss1, ss2, pension, pensionCOLA = false, partTimeIncome, partTimeEndAge, rentalIncome,
    annualContrib401k, employerMatch = 0, annualContribIRA, annualContribOther,
    spouseAnnualContrib401k = 0, spouseEmployerMatch = 0,
    spouseAnnualContribIRA = 0, spouseAnnualContribOther = 0,
    savings401k, iraBalance, taxableInvestments, homeValue, homeOwned,
    investmentReturn, inflation, healthcareInflation,
    housing, food, healthcare, transport, leisure, other,
    longTermCare = 0, ltcStartAge = 80,
    stateInfo,
    survivorFactor = 1.0,
  } = inputs;

  const col = stateInfo.costOfLivingIndex / 100;
  const totalMonthlyExpenses = housing + food + healthcare + transport + leisure + other;

  // Split healthcare from other expenses so each can inflate at its own rate.
  // survivorFactor scales regular expenses for solo projections (0.6 = standard survivor assumption).
  // LTC is intentionally NOT scaled by survivorFactor (care costs are per-person, not household).
  // LTC is also NOT scaled by CoL index — facility rates don't correlate with general CoL the same way.
  const baseNonHealthcareNeed = (housing + food + transport + leisure + other) * col * survivorFactor;
  const baseHealthcareNeed    = healthcare * col;
  const baseLTCNeed           = longTermCare; // flat monthly — applied only from ltcStartAge onward

  const ssMonthly = ss1 + (hasSpouse ? ss2 : 0);
  const ssTaxableMonthly = stateInfo.hasSSIncomeTax ? ssMonthly : 0;
  const monthlyPropertyTax = homeOwned ? (homeValue * stateInfo.avgPropertyTaxRate) / 12 : 0;

  // Pension extracted so it can inflate independently (pensionCOLA toggle).
  const pensionStateTax   = pension * stateInfo.incomeTax;
  const pensionNetMonthly = pension - pensionStateTax;

  // Non-pension income (SS + part-time + rental) — always inflates with generalFactor
  const nonPensionGrossWithPT    = ssMonthly + partTimeIncome + rentalIncome;
  const nonPensionTaxWithPT      = (partTimeIncome + rentalIncome + ssTaxableMonthly) * stateInfo.incomeTax;
  const nonPensionNetWithPT      = nonPensionGrossWithPT - nonPensionTaxWithPT;

  const nonPensionGrossWithoutPT = ssMonthly + rentalIncome;
  const nonPensionTaxWithoutPT   = (rentalIncome + ssTaxableMonthly) * stateInfo.incomeTax;
  const nonPensionNetWithoutPT   = nonPensionGrossWithoutPT - nonPensionTaxWithoutPT;

  // Non-SS ordinary income — used for federal tax in real terms.
  // Pension is always its year-0 value in real terms (whether or not it has COLA).
  const nonSSWithPT    = pension + partTimeIncome + rentalIncome;
  const nonSSWithoutPT = pension + rentalIncome;

  // For summary cards (year-0, with part-time)
  const netMonthlyIncome = nonPensionNetWithPT + pensionNetMonthly;
  const stateTaxMonthly  = nonPensionTaxWithPT + pensionStateTax;

  const adjustedExpenses = (baseNonHealthcareNeed + baseHealthcareNeed);
  const totalMonthlyNeed = adjustedExpenses + monthlyPropertyTax;
  const monthlyGap = totalMonthlyNeed - netMonthlyIncome;
  const totalLiquidAssets = savings401k + iraBalance + taxableInvestments;

  const yearsData = [];
  let portfolio = totalLiquidAssets;
  let runOutYear = null;

  // ── Phase 1: Accumulation ────────────────────────────────────────────────────
  // Loop runs until the last person retires (per-person contributions stop at
  // each person's own retirement age).
  const yearsUntilPrimaryRetires = Math.max(retirementAge - currentAge, 0);
  const yearsUntilSpouseRetires  = hasSpouse ? Math.max(spouseRetirementAge - spouseAge, 0) : 0;
  const accumulationYears = Math.max(yearsUntilPrimaryRetires, yearsUntilSpouseRetires);

  for (let y = 0; y < accumulationYears; y++) {
    const primaryAgeY = currentAge + y;
    const spouseAgeY  = spouseAge + y;

    const primaryContrib = (primaryAgeY < retirementAge)
      ? annualContrib401k + employerMatch + annualContribIRA + annualContribOther
      : 0;
    const spouseContrib = (hasSpouse && spouseAgeY < spouseRetirementAge)
      ? spouseAnnualContrib401k + spouseEmployerMatch + spouseAnnualContribIRA + spouseAnnualContribOther
      : 0;

    const growth = portfolio * (investmentReturn / 100);
    portfolio += growth + primaryContrib + spouseContrib;
    yearsData.push({
      year: new Date().getFullYear() + y,
      age: currentAge + y,
      portfolio: Math.round(portfolio),
      withdrawal: 0,
      income: 0,
      expenses: 0,
    });
  }

  const portfolioAtRetirement = Math.round(portfolio);

  // ── Phase 2: Drawdown (retirementAge → effectiveLifeExpectancy + buffer) ────
  // For combined projections the household needs money until the last survivor dies.
  const effectiveLifeExpectancy = hasSpouse
    ? Math.max(lifeExpectancy, currentAge + (spouseLifeExpectancy - spouseAge))
    : lifeExpectancy;

  const yearsToProject = Math.max(effectiveLifeExpectancy - retirementAge + 15, 30);

  for (let y = 0; y <= yearsToProject; y++) {
    const currentYear = new Date().getFullYear() + accumulationYears + y;
    const generalFactor   = Math.pow(1 + inflation / 100, y);
    const healthcareFactor = Math.pow(1 + healthcareInflation / 100, y);

    const ageInYear = retirementAge + y;

    // LTC kicks in at ltcStartAge and inflates at the healthcare rate (it's a medical expense)
    const ltcActive = ageInYear >= ltcStartAge;
    const yearlyLTC = ltcActive ? baseLTCNeed * 12 * healthcareFactor : 0;

    const yearlyNeed =
      (baseNonHealthcareNeed + monthlyPropertyTax) * 12 * generalFactor +
      baseHealthcareNeed * 12 * healthcareFactor +
      yearlyLTC;
    const ptEnded = ageInYear >= partTimeEndAge;
    const baseNonPensionNet = ptEnded ? nonPensionNetWithoutPT : nonPensionNetWithPT;
    const pensionContrib = pensionCOLA
      ? pensionNetMonthly * 12 * generalFactor   // COLA: inflates with general inflation
      : pensionNetMonthly * 12;                  // Fixed: stays flat in nominal dollars
    const yearlyIncome = (baseNonPensionNet * 12 * generalFactor) + pensionContrib;

    // Estimate portfolio withdrawal needed before accounting for federal tax
    const preTaxGap = Math.max(yearlyNeed - yearlyIncome, 0);

    // Federal tax on all income sources + estimated withdrawal from savings
    const currentNonSS = ptEnded ? nonSSWithoutPT : nonSSWithPT;

    // Work in real (year-0 dollar) terms — equivalent to inflating brackets each year.
    // SS provisional income thresholds ($32K/$44K married; $25K/$34K single) inside
    // estimateFederalTax are intentionally left as frozen nominal values (unchanged since 1984).
    const realSS       = ssMonthly * 12;
    const realOrdinary = currentNonSS * 12;
    const realGap      = preTaxGap / generalFactor;

    // Iteration 1: tax on net gap
    const realTax1 = estimateFederalTax({
      ssAnnual: realSS, ordinaryIncome: realOrdinary,
      withdrawalEstimate: realGap,
      married: hasSpouse, age: ageInYear,
    });

    // Iteration 2: gross up — gap + iter-1 tax
    const realTax2 = estimateFederalTax({
      ssAnnual: realSS, ordinaryIncome: realOrdinary,
      withdrawalEstimate: realGap + realTax1,
      married: hasSpouse, age: ageInYear,
    });

    const federalTax     = realTax2 * generalFactor;

    // Actual withdrawal covers both the spending gap and the federal tax bill
    const yearlyWithdrawal = preTaxGap + federalTax;
    const growth = portfolio * (investmentReturn / 100);
    portfolio = portfolio + growth - yearlyWithdrawal;

    yearsData.push({
      year: currentYear,
      age: ageInYear,
      portfolio: Math.max(Math.round(portfolio), 0),
      withdrawal: Math.round(yearlyWithdrawal),
      income: Math.round(yearlyIncome),
      expenses: Math.round(yearlyNeed),
    });

    if (portfolio <= 0 && runOutYear === null) runOutYear = ageInYear;
    if (portfolio < 0) portfolio = 0;
  }

  const runwayYears = runOutYear ? runOutYear - retirementAge : yearsToProject;

  // Year-0 federal tax estimate for summary display
  const federalTaxMonthly = Math.round(estimateFederalTax({
    ssAnnual: ssMonthly * 12,
    ordinaryIncome: nonSSWithPT * 12,
    withdrawalEstimate: Math.max(monthlyGap, 0) * 12,
    married: hasSpouse,
    age: retirementAge,
  }) / 12);

  return {
    totalMonthlyExpenses: Math.round(totalMonthlyExpenses),
    adjustedExpenses: Math.round(adjustedExpenses),
    monthlyPropertyTax: Math.round(monthlyPropertyTax),
    totalMonthlyNeed: Math.round(totalMonthlyNeed),
    netMonthlyIncome: Math.round(netMonthlyIncome),
    stateTaxMonthly: Math.round(stateTaxMonthly),
    federalTaxMonthly,
    monthlyGap: Math.round(monthlyGap),
    costOfLivingDelta: stateInfo.costOfLivingIndex - 100,
    totalLiquidAssets,
    portfolioAtRetirement,
    runwayYears,
    runOutYear,
    yearsData,
    verdict: verdictConfig(runwayYears, effectiveLifeExpectancy, retirementAge),
  };
}
