import { estimateFederalTax, estimateCapitalGainsTax } from "./federalTax";
import { getRmdFactor } from "./rmdTable";
import { getIrmaaSurcharge } from './irmaaTable.js';

const MEDICARE_PART_B_MONTHLY_2024 = 174.70; // per person, 2024 base premium

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
    ss1, ss2, pension, pensionCOLA = false,
    pensionSurvivorPct = 100, spousePension = 0, spousePensionCOLA = false, spousePensionSurvivorPct = 100,
    partTimeIncome, partTimeEndAge, rentalIncome,
    annualContrib401k, employerMatch = 0, annualContribIRA, annualContribOther,
    spouseAnnualContrib401k = 0, spouseEmployerMatch = 0,
    spouseAnnualContribIRA = 0, spouseAnnualContribOther = 0,
    trad401k = 0, roth401k = 0, tradIRA = 0, rothIRA = 0, taxableBrokerage = 0,
    homeValue, homeOwned,
    mortgageBalance = 0,
    homeSaleIntent = "keep",
    homeSaleAge = Infinity,
    investmentReturn, inflation, healthcareInflation,
    housingType = "rent", housing, mortgagePayoffAge = Infinity,
    food, healthcare, bridgeHealthcare = 0, transport, leisure, other,
    longTermCare = 0, ltcStartAge = 80,
    stateInfo,
    moveAge = Infinity, retirementStateInfo = stateInfo,
    survivorFactor = 1.0,
    ssCola = 2.5,
  } = inputs;

  const col = stateInfo.costOfLivingIndex / 100;
  const totalMonthlyExpenses = housing + food + healthcare + transport + leisure + other;

  // Split healthcare from other expenses so each can inflate at its own rate.
  // survivorFactor scales regular expenses for solo projections (0.6 = standard survivor assumption).
  // LTC is intentionally NOT scaled by survivorFactor (care costs are per-person, not household).
  // LTC is also NOT scaled by CoL index — facility rates don't correlate with general CoL the same way.
  // Housing is split out separately so mortgage payments can drop to $0 after payoff age.
  const baseHousingNeed       = housing * col * survivorFactor;
  const baseNonHousingNeed    = (food + transport + leisure + other) * col * survivorFactor;
  const baseHealthcareNeed    = healthcare * col;

  // Pre-Medicare bridge: higher healthcare cost before age 65 (marketplace/COBRA).
  // lastMedicareAge is the primary age when the last person in the household hits 65.
  // For couples: if primary is 60 and spouse is 58, spouse hits 65 when primary is 67.
  const lastMedicareAge = hasSpouse
    ? Math.max(65, currentAge + (65 - spouseAge))
    : 65;
  const hasBridge = bridgeHealthcare > 0 && retirementAge < lastMedicareAge;

  const baseLTCNeed = longTermCare; // flat monthly — applied only from ltcStartAge onward

  // Pre-compute retirement state values for post-move phase.
  // If moveAge = Infinity (not moving), hasMoved is never true so these are unused.
  const retCol = retirementStateInfo.costOfLivingIndex / 100;
  const retMonthlyPropertyTax = homeOwned ? (homeValue * retirementStateInfo.avgPropertyTaxRate) / 12 : 0;

  const ssMonthly        = ss1 + (hasSpouse ? ss2 : 0);
  const ssMonthlyTaxable = stateInfo.hasSSIncomeTax ? ssMonthly : 0;
  const monthlyPropertyTax = homeOwned ? (homeValue * stateInfo.avgPropertyTaxRate) / 12 : 0;

  // Pension extracted so it can inflate independently (pensionCOLA toggle).
  const pensionStateTax   = pension * stateInfo.incomeTax;
  const pensionNetMonthly = pension - pensionStateTax;

  // Non-SS non-pension income (part-time + rental) — inflates with generalFactor.
  // SS is handled separately inside the drawdown loop with its own COLA rate.
  const nonSSNonPensionTaxWithPT    = (partTimeIncome + rentalIncome) * stateInfo.incomeTax;
  const nonSSNonPensionNetWithPT    = (partTimeIncome + rentalIncome) - nonSSNonPensionTaxWithPT;

  const nonSSNonPensionTaxWithoutPT = rentalIncome * stateInfo.incomeTax;
  const nonSSNonPensionNetWithoutPT = rentalIncome - nonSSNonPensionTaxWithoutPT;

  // Non-SS ordinary income — used for federal tax gross-up in real terms.
  // Pension is always its year-0 value in real terms (whether or not it has COLA).
  const nonSSWithPT    = pension + spousePension + partTimeIncome + rentalIncome;
  const nonSSWithoutPT = pension + spousePension + rentalIncome;

  // Retirement state income variants (post-move, non-survivor)
  const retNonSSNonPensionNetWithPT    = (partTimeIncome + rentalIncome) - (partTimeIncome + rentalIncome) * retirementStateInfo.incomeTax;
  const retNonSSNonPensionNetWithoutPT = rentalIncome - rentalIncome * retirementStateInfo.incomeTax;
  const retPensionNetMonthly           = pension - pension * retirementStateInfo.incomeTax;
  const retSSMonthlyTaxable            = retirementStateInfo.hasSSIncomeTax ? ssMonthly : 0;

  const spousePensionStateTax      = spousePension * stateInfo.incomeTax;
  const spousePensionNetMonthly    = spousePension - spousePensionStateTax;
  const retSpousePensionNetMonthly = spousePension - spousePension * retirementStateInfo.incomeTax;

  // For summary cards (year-0, with part-time) — SS at year-0 value (COLA not applied to summary)
  const ssStateTaxMonthly = ssMonthlyTaxable * stateInfo.incomeTax;
  const ssNetMonthly      = ssMonthly - ssStateTaxMonthly;
  const netMonthlyIncome  = ssNetMonthly + nonSSNonPensionNetWithPT + pensionNetMonthly + spousePensionNetMonthly;
  const stateTaxMonthly   = ssStateTaxMonthly + nonSSNonPensionTaxWithPT + pensionStateTax + spousePensionStateTax;

  const adjustedExpenses = (baseHousingNeed + baseNonHousingNeed + baseHealthcareNeed);
  const totalMonthlyNeed = adjustedExpenses + monthlyPropertyTax;
  const monthlyGap = totalMonthlyNeed - netMonthlyIncome;
  const totalLiquidAssets = trad401k + roth401k + tradIRA + rothIRA + taxableBrokerage;

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
      rmd: 0,
      irmaa: 0,
      homeSaleProceeds: 0,
    });
  }

  const portfolioAtRetirement = Math.round(portfolio);

  // Initialize drawdown buckets proportional to accumulation growth.
  // All asset types grow at the same expected return during accumulation.
  const growthFactor = totalLiquidAssets > 0 ? portfolioAtRetirement / totalLiquidAssets : 1;
  let taxableBucket = taxableBrokerage * growthFactor;
  let tradBucket    = (trad401k + tradIRA) * growthFactor;
  let rothBucket    = (roth401k + rothIRA) * growthFactor;

  // ── Survivor transition setup (combined projection only) ─────────────────
  // When hasSpouse && survivorFactor === 1.0, the combined projection models
  // both spouses alive. After the first death, SS drops to the higher benefit
  // and expenses scale down to 60% (survivorFactor for solo).
  const modelSurvivor = hasSpouse && survivorFactor === 1.0;
  const firstDeathAge = modelSurvivor
    ? Math.min(lifeExpectancy, currentAge + (spouseLifeExpectancy - spouseAge))
    : Infinity;

  // primaryDiesFirst: true when primary's life expectancy ≤ spouse's (converted to primary age scale).
  // Determines which pension amount gets the survivor % reduction in the drawdown loop.
  const primaryDiesFirst = !hasSpouse ? false
    : lifeExpectancy <= currentAge + (spouseLifeExpectancy - spouseAge);

  // Survivor-phase expense and income bases (housing split for payoff logic)
  const baseHousingNeedAlone    = housing * col * 0.6;
  const baseNonHousingNeedAlone = (food + transport + leisure + other) * col * 0.6;
  const ssMonthlyAlone          = Math.max(ss1, ss2);
  const ssMonthlyTaxableAlone   = stateInfo.hasSSIncomeTax ? ssMonthlyAlone : 0;

  const nonSSNonPensionNetWithPTAlone    = (partTimeIncome + rentalIncome) - (partTimeIncome + rentalIncome) * stateInfo.incomeTax;
  const nonSSNonPensionNetWithoutPTAlone = rentalIncome - rentalIncome * stateInfo.incomeTax;

  // Retirement state survivor variants
  const retSSMonthlyTaxableAlone            = retirementStateInfo.hasSSIncomeTax ? ssMonthlyAlone : 0;
  const retNonSSNonPensionNetWithPTAlone    = (partTimeIncome + rentalIncome) - (partTimeIncome + rentalIncome) * retirementStateInfo.incomeTax;
  const retNonSSNonPensionNetWithoutPTAlone = rentalIncome - rentalIncome * retirementStateInfo.incomeTax;

  // ── Phase 2: Drawdown (retirementAge → effectiveLifeExpectancy + buffer) ────
  // For combined projections the household needs money until the last survivor dies.
  const effectiveLifeExpectancy = hasSpouse
    ? Math.max(lifeExpectancy, currentAge + (spouseLifeExpectancy - spouseAge))
    : lifeExpectancy;

  // +30 buffer: ensures well-funded portfolios show meaningful runway beyond life expectancy
  const yearsToProject = Math.max(effectiveLifeExpectancy - retirementAge + 30, 30);

  // Home appreciation and mortgage state at sale — computed once, used in the loop
  const yearsUntilSale = Number.isFinite(homeSaleAge) ? homeSaleAge - currentAge : 0;
  const appreciatedHomeValue = homeValue * Math.pow(1 + inflation / 100, yearsUntilSale);
  // Known simplification: if mortgage isn't paid off before sale, we use the full current
  // balance (no amortization). Full amortization deferred to Track B.
  const mortgageBalanceAtSale = mortgagePayoffAge <= homeSaleAge ? 0 : mortgageBalance;

  for (let y = 0; y <= yearsToProject; y++) {
    const currentYear = new Date().getFullYear() + accumulationYears + y;
    const generalFactor   = Math.pow(1 + inflation / 100, y);
    const healthcareFactor = Math.pow(1 + healthcareInflation / 100, y);

    const ageInYear = retirementAge + y;

    // LTC kicks in at ltcStartAge and inflates at the healthcare rate (it's a medical expense)
    const ltcActive = ageInYear >= ltcStartAge;
    const yearlyLTC = ltcActive ? baseLTCNeed * 12 * healthcareFactor : 0;

    const ptEnded = ageInYear >= partTimeEndAge;

    // Work in real (year-0 dollar) terms — equivalent to inflating brackets each year.
    // SS provisional income thresholds ($32K/$44K married; $25K/$34K single) inside
    // estimateFederalTax are intentionally left as frozen nominal values (unchanged since 1984).
    // Not adjusted for survivor phase — pension and rental income don't necessarily
    // halve after one spouse's death. The overstatement of income and the overstatement
    // of taxes roughly cancel; accepted simplification.
    const realOrdinary = (ptEnded ? nonSSWithoutPT : nonSSWithPT) * 12;

    // Switch to survivor mode after the first spouse's death
    const isSurvivor = modelSurvivor && ageInYear > firstDeathAge;
    const activeSurvFactor = isSurvivor ? 0.6 : survivorFactor;

    // Switch to retirement state after moveAge (CoL, property tax, income tax all change)
    const hasMoved = ageInYear >= moveAge;
    const activeCol                = hasMoved ? retCol                : col;
    // Home sale: property tax stops in and after the sale year.
    // Stopping the full year (not prorated) is an accepted simplification.
    const homeSold = homeOwned && homeSaleIntent === "sell" && ageInYear >= homeSaleAge;
    const activeMonthlyPropertyTax = homeSold
      ? 0
      : (hasMoved ? retMonthlyPropertyTax : monthlyPropertyTax);

    // Expense bases: re-derived from activeCol + activeSurvFactor so both transitions compose cleanly
    const activeBaseNonHousingNeed = (food + transport + leisure + other) * activeCol * activeSurvFactor;
    const activeBaseHousingNeed    = housing * activeCol * activeSurvFactor;

    const activeMarried      = isSurvivor ? false : hasSpouse;
    const activeStateTaxRate = hasMoved ? retirementStateInfo.incomeTax : stateInfo.incomeTax;

    // Income bases: select from pre-computed variants (survivor × state × PT-ended)
    const activeNonSSNonPensionNetWithPT    = isSurvivor
      ? (hasMoved ? retNonSSNonPensionNetWithPTAlone    : nonSSNonPensionNetWithPTAlone)
      : (hasMoved ? retNonSSNonPensionNetWithPT         : nonSSNonPensionNetWithPT);
    const activeNonSSNonPensionNetWithoutPT = isSurvivor
      ? (hasMoved ? retNonSSNonPensionNetWithoutPTAlone : nonSSNonPensionNetWithoutPTAlone)
      : (hasMoved ? retNonSSNonPensionNetWithoutPT      : nonSSNonPensionNetWithoutPT);
    const activeNonSSNonPensionNet = ptEnded ? activeNonSSNonPensionNetWithoutPT : activeNonSSNonPensionNetWithPT;

    // SS: survivor-adjusted base, then COLA-compounded
    const activeSSMonthly        = isSurvivor ? ssMonthlyAlone        : ssMonthly;
    const activeSSTaxableMonthly = isSurvivor
      ? (hasMoved ? retSSMonthlyTaxableAlone : ssMonthlyTaxableAlone)
      : (hasMoved ? retSSMonthlyTaxable      : ssMonthlyTaxable);
    const ssColaFactor  = Math.pow(1 + ssCola / 100, y);
    const ssGrossAnnual = activeSSMonthly * 12 * ssColaFactor;
    const ssStateTax    = activeSSTaxableMonthly * 12 * ssColaFactor * activeStateTaxRate;
    const ssNetAnnual   = ssGrossAnnual - ssStateTax;

    // Primary pension: reduced by survivorPct when primary has died (isSurvivor && primaryDiesFirst)
    const activePrimaryPensionNet = (isSurvivor && primaryDiesFirst)
      ? (hasMoved ? retPensionNetMonthly : pensionNetMonthly) * (pensionSurvivorPct / 100)
      : (hasMoved ? retPensionNetMonthly : pensionNetMonthly);
    // Spouse pension: reduced by survivorPct when spouse has died (isSurvivor && !primaryDiesFirst)
    const activeSpousePensionNet = !hasSpouse ? 0
      : (isSurvivor && !primaryDiesFirst)
      ? (hasMoved ? retSpousePensionNetMonthly : spousePensionNetMonthly) * (spousePensionSurvivorPct / 100)
      : (hasMoved ? retSpousePensionNetMonthly : spousePensionNetMonthly);

    // Mortgage payoff: housing drops to $0 for owners after payoff age
    const housePaid = housingType === "own" && ageInYear >= mortgagePayoffAge;
    // Simplification: housing drops to $0 after payoff. Ongoing maintenance and homeowner's
    // insurance (~1–2% of home value/yr) are not modeled — users should include these in
    // their 'Other' spending category. Slightly non-conservative but acceptable.
    const effectiveHousingNeed = housePaid ? 0 : activeBaseHousingNeed;

    // Switch to standard Medicare healthcare cost once both people are covered
    const inBridgePhase = hasBridge && ageInYear < lastMedicareAge;
    // Conservative simplification: not scaled by activeSurvFactor — household healthcare stays
    // at the full entered amount after one spouse dies. Per-person Medicare costs don't drop
    // much when a spouse dies (premiums are per-person), so this overstatement is intentional.
    const activeBaseHealthcareNeed = inBridgePhase
      ? bridgeHealthcare * activeCol
      : healthcare * activeCol;

    // ── IRMAA: Medicare premium surcharge at age 65+ ─────────────────────────
    // MAGI approximated from guaranteed income only (no portfolio withdrawals —
    // including them would create a circular dependency with yearlyNeed).
    // Documented simplifications (see spec):
    //   1. Gross SS used instead of taxable SS portion (slightly conservative)
    //   2. realOrdinary is NOT adjusted for survivor phase — pension/rental don't
    //      necessarily halve after one spouse's death, so this is a reasonable
    //      approximation.
    // realSSAnnual: SS in real (year-0) terms — divides out generalFactor so IRMAA
    // brackets stay stable even when ssCola != inflation.
    const realSSAnnual = (activeSSMonthly * 12 * ssColaFactor) / generalFactor;
    const irmaaApplies = ageInYear >= 65;
    const irmaaMAGI = irmaaApplies ? realSSAnnual + realOrdinary : 0;
    const irmaaSurchargePerPerson = irmaaApplies
      ? getIrmaaSurcharge(irmaaMAGI, activeMarried)
      : 0;

    // medicareCount: both spouses on Medicare only while both alive and both ≥ 65.
    // Derives from isSurvivor (same flag as activeMarried) — always consistent.
    // In the drawdown loop y=0 corresponds to retirementAge (not currentAge), so the
    // spouse's age at drawdown year y = spouseAge + (retirementAge - currentAge) + y.
    const spouseAgeInYear = spouseAge + (retirementAge - currentAge) + y;
    const spouseOnMedicare = !isSurvivor && hasSpouse && spouseAgeInYear >= 65;
    const medicareCount = irmaaApplies ? (spouseOnMedicare ? 2 : 1) : 0;
    const irmaaAnnual = irmaaSurchargePerPerson * medicareCount * 12;

    // Medicare Part B base premium — auto-applied at age 65+.
    // Inflation exponent is (ageInYear - 65), NOT y (drawdown year).
    // This is intentional: MEDICARE_PART_B_MONTHLY_2024 is the 2024 cost at age 65.
    // Someone retiring at 67 has already been on Medicare 2 years, so their cost
    // has already inflated — (ageInYear - 65) = 2 correctly captures that.
    // Using y instead would understate Part B for post-65 retirees.
    const primaryPartB = ageInYear >= 65
      ? MEDICARE_PART_B_MONTHLY_2024 * Math.pow(1 + healthcareInflation / 100, ageInYear - 65)
      : 0;
    const spousePartB = !isSurvivor && hasSpouse && spouseAgeInYear >= 65
      ? MEDICARE_PART_B_MONTHLY_2024 * Math.pow(1 + healthcareInflation / 100, spouseAgeInYear - 65)
      : 0;
    const annualPartB = (primaryPartB + spousePartB) * 12;

    const yearlyNeed =
      (activeBaseNonHousingNeed + effectiveHousingNeed + activeMonthlyPropertyTax) * 12 * generalFactor +
      activeBaseHealthcareNeed * 12 * healthcareFactor +
      yearlyLTC +
      irmaaAnnual +
      annualPartB;
    // Each pension's COLA applies independently
    const pensionContrib =
      (pensionCOLA      ? activePrimaryPensionNet * 12 * generalFactor : activePrimaryPensionNet * 12) +
      (spousePensionCOLA ? activeSpousePensionNet  * 12 * generalFactor : activeSpousePensionNet  * 12);
    const yearlyIncome = ssNetAnnual + (activeNonSSNonPensionNet * 12 * generalFactor) + pensionContrib;

    // Estimate portfolio withdrawal needed before accounting for federal tax
    const preTaxGap = Math.max(yearlyNeed - yearlyIncome, 0);

    // --- Per-bucket growth (grow first, then withdraw — matches existing loop structure) ---
    const bucketGrowthRate = investmentReturn / 100;
    const priorTradBalance = tradBucket; // capture before growth for RMD calculation
    taxableBucket += taxableBucket * bucketGrowthRate;
    tradBucket    += tradBucket    * bucketGrowthRate;
    rothBucket    += rothBucket    * bucketGrowthRate;

    // Home sale proceeds: inject into taxableBucket at the sale year.
    // taxableBucket is the right destination — proceeds go into a taxable brokerage
    // account in practice.
    // Conservative: the 60%-gains assumption overstates the tax on home sale proceeds.
    // In reality, the $250K/$500K primary residence exclusion eliminates gains tax for
    // most users. Treating it as taxable is a modest conservative overstatement.
    // Net proceeds = 95% of equity after realtor fees + closing costs.
    // Note: mortgage amortization (paydown) before the sale date is not modeled — the full
    // current balance is used if the mortgage isn't paid off by sale. Deferred to Track B.
    let homeSaleProceeds = 0;
    if (homeOwned && homeSaleIntent === "sell" && ageInYear === homeSaleAge) {
      homeSaleProceeds = Math.max(0, appreciatedHomeValue - mortgageBalanceAtSale) * 0.95;
      taxableBucket += homeSaleProceeds;
    }

    // --- RMD: IRS requires minimum withdrawals from traditional accounts starting at 73 ---
    // RMD = prior year-end balance / IRS Uniform Lifetime factor for this age.
    // If planned trad spending < RMD, the difference is forced out and reinvested in
    // the taxable bucket (money stays in portfolio, but it's now taxable ordinary income).
    const rmdFactor = getRmdFactor(ageInYear);
    const rmdAmount = rmdFactor ? priorTradBalance / rmdFactor : 0;

    // --- Step 1: Spending allocation across buckets (taxable → Traditional → Roth) ---
    // Allocate only the net spending gap. Taxes computed from this split avoid circular dependency.
    const taxableSpend = Math.min(taxableBucket, preTaxGap);
    const remaining1   = preTaxGap - taxableSpend;
    // Trad spend must be at least the RMD amount (capped at available balance)
    const tradSpendNatural = Math.min(tradBucket, remaining1);
    const tradSpend        = Math.min(tradBucket, Math.max(tradSpendNatural, rmdAmount));
    const rmdExcess        = Math.max(tradSpend - tradSpendNatural, 0); // forced above spending need
    const rothSpend        = Math.min(rothBucket, remaining1 - tradSpendNatural);

    // --- Step 2: Tax computation based on spending split ---
    // State tax on Traditional spending (flat-rate gross-up is exact).
    // RMD excess is already included in tradSpend so it's captured here automatically.
    const tradGross      = activeStateTaxRate < 1 ? tradSpend / (1 - activeStateTaxRate) : tradSpend;
    const stateTaxOnTrad = tradGross - tradSpend;

    // Federal tax — two-iteration real-terms gross-up.
    // rmdExcess / generalFactor adds the forced RMD income to ordinary income for bracket purposes.
    const realTradGross    = tradGross / generalFactor;
    const realCapGains     = (taxableSpend * 0.60) / generalFactor;
    const realRmdOrdinary  = realOrdinary + rmdExcess / generalFactor;
    const { tax: realFed1 } = estimateFederalTax({
      ssAnnual: realSSAnnual, ordinaryIncome: realRmdOrdinary,
      withdrawalEstimate: realTradGross, capitalGains: realCapGains,
      married: activeMarried, age: ageInYear,
    });
    const { tax: realFed2, taxableSS } = estimateFederalTax({
      ssAnnual: realSSAnnual, ordinaryIncome: realRmdOrdinary,
      withdrawalEstimate: realTradGross + realFed1, capitalGains: realCapGains,
      married: activeMarried, age: ageInYear,
    });
    const federalTax = realFed2 * generalFactor;

    // Capital gains tax on taxable brokerage withdrawal (60% assumed gains, real terms)
    const capGainsTax = estimateCapitalGainsTax({
      taxableGains: (taxableSpend * 0.60) / generalFactor,
      totalOrdinaryIncome: realOrdinary + (tradGross / generalFactor) + taxableSS,
      married: activeMarried,
    }) * generalFactor;

    // 10% IRS penalty on trad withdrawals before age 59.5.
    // Computed on tradSpend (net of state tax) rather than tradGross — a minor
    // understatement for state-taxed accounts. Accepted simplification.
    // Rule 72(t) SEPP distributions can avoid this — not modeled.
    const earlyWithdrawalPenalty = ageInYear < 59.5 ? tradSpend * 0.10 : 0;

    // State tax on capital gains from taxable brokerage (60% of withdrawal assumed gains).
    // Most states tax capital gains as ordinary income at the state rate.
    // States with incomeTax=0 contribute $0 automatically.
    const stateTaxOnCapGains = taxableSpend * 0.60 * activeStateTaxRate;

    // --- Step 3: Total portfolio deduction ---
    const yearlyWithdrawal = preTaxGap + stateTaxOnTrad + capGainsTax + stateTaxOnCapGains + federalTax + earlyWithdrawalPenalty;

    // --- Bucket balance updates ---
    taxableBucket -= taxableSpend;
    tradBucket    -= tradGross;   // gross amount (includes state tax)
    rothBucket    -= rothSpend;
    // RMD excess is reinvested in taxable account (already withdrawn from trad above)
    taxableBucket += rmdExcess;

    // Remaining taxes drawn from buckets in same order
    let taxesLeft = capGainsTax + stateTaxOnCapGains + federalTax + earlyWithdrawalPenalty;
    const taxFromTaxable = Math.min(taxableBucket, taxesLeft);
    taxableBucket -= taxFromTaxable;
    taxesLeft     -= taxFromTaxable;
    const taxFromTrad = Math.min(tradBucket, taxesLeft);
    tradBucket    -= taxFromTrad;
    taxesLeft     -= taxFromTrad;
    rothBucket    -= Math.min(rothBucket, taxesLeft);

    // Clamp to zero, recompute portfolio
    taxableBucket = Math.max(taxableBucket, 0);
    tradBucket    = Math.max(tradBucket,    0);
    rothBucket    = Math.max(rothBucket,    0);
    portfolio     = taxableBucket + tradBucket + rothBucket;

    yearsData.push({
      year: currentYear,
      age: ageInYear,
      portfolio: Math.max(Math.round(portfolio), 0),
      withdrawal: Math.round(yearlyWithdrawal),
      income: Math.round(yearlyIncome),
      expenses: Math.round(yearlyNeed),
      rmd: Math.round(rmdAmount),
      irmaa: Math.round(irmaaSurchargePerPerson),   // monthly per-person
      homeSaleProceeds: Math.round(homeSaleProceeds),
    });

    if (portfolio <= 0 && runOutYear === null) runOutYear = ageInYear;
    if (portfolio < 0) portfolio = 0;
  }

  const runwayYears = runOutYear ? runOutYear - retirementAge : yearsToProject;

  // Year-0 federal tax estimate for summary display
  const { tax: federalTaxAnnual } = estimateFederalTax({
    ssAnnual: ssMonthly * 12,
    ordinaryIncome: nonSSWithPT * 12,
    withdrawalEstimate: Math.max(monthlyGap, 0) * 12,
    capitalGains: 0,
    married: hasSpouse,
    age: retirementAge,
  });
  const federalTaxMonthly = Math.round(federalTaxAnnual / 12);

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
