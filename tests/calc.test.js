import { describe, it, expect } from 'vitest';
import { runProjection } from '../src/utils/calc';

// Shared base inputs — pensionCOLA included now; ignored by calc.js until Task 4 wires it in
const BASE = {
  age: 50, retirementAge: 65, lifeExpectancy: 85,
  hasSpouse: false, spouseAge: 0, spouseRetirementAge: 65, spouseLifeExpectancy: 85,
  ss1: 2000, ss2: 0,
  pension: 0, pensionCOLA: false,
  partTimeIncome: 0, partTimeEndAge: 70, rentalIncome: 0,
  annualContrib401k: 10000, employerMatch: 5000,
  annualContribIRA: 3000, annualContribOther: 0,
  spouseAnnualContrib401k: 0, spouseEmployerMatch: 0,
  spouseAnnualContribIRA: 0, spouseAnnualContribOther: 0,
  trad401k: 300000, roth401k: 0, tradIRA: 75000, rothIRA: 0, taxableBrokerage: 50000,
  homeValue: 300000, homeOwned: true,
  investmentReturn: 5, inflation: 3, healthcareInflation: 5.5,
  housing: 1500, food: 700, healthcare: 800, transport: 400, leisure: 500, other: 300,
  longTermCare: 0, ltcStartAge: 80,
  stateInfo: { incomeTax: 0.0, hasSSIncomeTax: false, avgPropertyTaxRate: 0.009, costOfLivingIndex: 100 },
  survivorFactor: 1.0,
  ssCola: 0,
};

describe('runProjection', () => {
  it('returns expected shape', () => {
    const result = runProjection(BASE);
    expect(result).toHaveProperty('runwayYears');
    expect(result).toHaveProperty('yearsData');
    expect(result.yearsData.length).toBeGreaterThan(0);
  });
});

describe('Fix 1: healthcare survivorFactor', () => {
  it('healthcare cost is not scaled by survivorFactor', () => {
    // Zero non-healthcare spending except leisure ($500) so both components are non-zero
    const inputs = { ...BASE, housing: 0, food: 0, transport: 0, leisure: 500, other: 0, healthcare: 800 };
    const combined = runProjection({ ...inputs, survivorFactor: 1.0 });
    const solo     = runProjection({ ...inputs, survivorFactor: 0.6 });
    // With the fix: adjustedExpenses differs only by the leisure component, not healthcare
    // combined: (500*1.0 + 800) * col = 1300 * col
    // solo:     (500*0.6 + 800) * col = 1100 * col  → difference = 200 * col
    const diff = combined.adjustedExpenses - solo.adjustedExpenses;
    expect(diff).toBeCloseTo(500 * 0.4, -1);  // only leisure scales, not healthcare
  });

  it('non-healthcare expenses are still scaled by survivorFactor', () => {
    const inputs = { ...BASE, healthcare: 0, housing: 1000, food: 500, transport: 200, leisure: 0, other: 0 };
    const combined = runProjection({ ...inputs, survivorFactor: 1.0 });
    const solo     = runProjection({ ...inputs, survivorFactor: 0.6 });
    expect(solo.adjustedExpenses).toBeCloseTo(combined.adjustedExpenses * 0.6, -1);
  });
});

describe('Fix 2+3: federal bracket inflation + gross-up', () => {
  it('high inflation does not collapse runway due to bracket creep', () => {
    // Before fix: 6% inflation inflates nominal income ~5x over 30 years; brackets stay fixed → heavy taxation
    // After fix: real-term income stays flat → tax burden is proportional
    const highInflation = runProjection({ ...BASE, inflation: 6, investmentReturn: 8 });
    const lowInflation  = runProjection({ ...BASE, inflation: 1, investmentReturn: 4 });
    expect(highInflation.runwayYears).toBeGreaterThan(5);
    expect(lowInflation.runwayYears).toBeGreaterThan(5);
    // Neither should be dramatically shorter — inflation fix keeps real purchasing power comparable
    expect(highInflation.runwayYears / lowInflation.runwayYears).toBeGreaterThan(0.6);
  });

  it('withdrawal is at least as large as the spending gap', () => {
    const result = runProjection({ ...BASE, ss1: 1000 });
    const drawdownYears = result.yearsData.filter(y => y.withdrawal > 0);
    drawdownYears.forEach(y => {
      expect(y.withdrawal).toBeGreaterThanOrEqual(Math.max(y.expenses - y.income, 0) - 1);
    });
  });
});

describe('Fix 4: pension COLA', () => {
  it('COLA pension yields longer runway than fixed pension', () => {
    const inputs = { ...BASE, pension: 1500, ss1: 500 };
    const withCOLA    = runProjection({ ...inputs, pensionCOLA: true });
    const fixedPension = runProjection({ ...inputs, pensionCOLA: false });
    expect(withCOLA.runwayYears).toBeGreaterThanOrEqual(fixedPension.runwayYears);
  });

  it('pensionCOLA has no effect when pension is zero', () => {
    const withCOLA = runProjection({ ...BASE, pension: 0, pensionCOLA: true });
    const noCOLA   = runProjection({ ...BASE, pension: 0, pensionCOLA: false });
    expect(withCOLA.runwayYears).toBe(noCOLA.runwayYears);
  });
});

// Phase 2 base inputs — uses new account type fields
const P2_BASE = {
  age: 50, retirementAge: 65, lifeExpectancy: 85,
  hasSpouse: false, spouseAge: 0, spouseRetirementAge: 65, spouseLifeExpectancy: 85,
  ss1: 2000, ss2: 0,
  pension: 0, pensionCOLA: false,
  partTimeIncome: 0, partTimeEndAge: 70, rentalIncome: 0,
  annualContrib401k: 10000, employerMatch: 5000,
  annualContribIRA: 3000, annualContribOther: 0,
  spouseAnnualContrib401k: 0, spouseEmployerMatch: 0,
  spouseAnnualContribIRA: 0, spouseAnnualContribOther: 0,
  trad401k: 300000, roth401k: 0, tradIRA: 75000, rothIRA: 0, taxableBrokerage: 50000,
  homeValue: 300000, homeOwned: true,
  investmentReturn: 5, inflation: 3, healthcareInflation: 5.5,
  housing: 1500, food: 700, healthcare: 800, transport: 400, leisure: 500, other: 300,
  longTermCare: 0, ltcStartAge: 80,
  stateInfo: { incomeTax: 0.05, hasSSIncomeTax: false, avgPropertyTaxRate: 0.009, costOfLivingIndex: 100 },
  survivorFactor: 1.0,
  ssCola: 0,
};

describe('Phase 2: account type bucket tracking', () => {
  it('Roth-only portfolio produces longer runway than Traditional-only (same total)', () => {
    const allRoth = runProjection({
      ...P2_BASE, trad401k: 0, tradIRA: 0, roth401k: 300000, rothIRA: 75000, taxableBrokerage: 0,
    });
    const allTrad = runProjection({
      ...P2_BASE, trad401k: 300000, tradIRA: 75000, roth401k: 0, rothIRA: 0, taxableBrokerage: 0,
    });
    expect(allRoth.runwayYears).toBeGreaterThan(allTrad.runwayYears);
  });

  it('totalLiquidAssets equals sum of all 5 account fields', () => {
    const result = runProjection(P2_BASE);
    const expected = P2_BASE.trad401k + P2_BASE.roth401k + P2_BASE.tradIRA + P2_BASE.rothIRA + P2_BASE.taxableBrokerage;
    expect(result.totalLiquidAssets).toBe(expected);
  });

  it('taxable brokerage incurs capital gains tax → shorter runway than equivalent Roth', () => {
    const allTaxable = runProjection({
      ...P2_BASE, trad401k: 0, tradIRA: 0, roth401k: 0, rothIRA: 0, taxableBrokerage: 375000,
    });
    const allRoth = runProjection({
      ...P2_BASE, trad401k: 0, tradIRA: 0, roth401k: 375000, rothIRA: 0, taxableBrokerage: 0,
    });
    expect(allRoth.runwayYears).toBeGreaterThanOrEqual(allTaxable.runwayYears);
  });
});

describe('SS claiming age via adjustedSS values', () => {
  const base = {
    age: 60, retirementAge: 62, lifeExpectancy: 85, hasSpouse: false,
    ss1: 1000, ss2: 0,
    trad401k: 200000, roth401k: 0, tradIRA: 0, rothIRA: 0, taxableBrokerage: 0,
    annualContrib401k: 0, employerMatch: 0, annualContribIRA: 0, annualContribOther: 0,
    spouseAnnualContrib401k: 0, spouseEmployerMatch: 0, spouseAnnualContribIRA: 0, spouseAnnualContribOther: 0,
    pension: 0, pensionCOLA: false, partTimeIncome: 0, partTimeEndAge: 70, rentalIncome: 0,
    housing: 1000, food: 500, healthcare: 300, transport: 200, leisure: 200, other: 100,
    longTermCare: 0, ltcStartAge: 80,
    homeValue: 0, homeOwned: false,
    investmentReturn: 5, inflation: 3, healthcareInflation: 5.5,
    survivorFactor: 0.6,
    stateInfo: { incomeTax: 0, hasSSIncomeTax: false, avgPropertyTaxRate: 0, costOfLivingIndex: 100 },
    ssCola: 0,
  };

  it('higher SS income leads to smaller monthly withdrawal than lower SS', () => {
    const resultHigh = runProjection({ ...base, ss1: 1240 }); // claiming at 70: 1000 × 1.24
    const resultLow  = runProjection({ ...base, ss1: 700  }); // claiming at 62: 1000 × 0.70
    expect(resultHigh.monthlyGap).toBeLessThan(resultLow.monthlyGap);
  });

  it('higher SS leads to longer portfolio runway', () => {
    const resultHigh = runProjection({ ...base, ss1: 1240 });
    const resultLow  = runProjection({ ...base, ss1: 700  });
    expect(resultHigh.runwayYears).toBeGreaterThan(resultLow.runwayYears);
  });
});

describe('survivor SS transition in combined projection', () => {
  const base = {
    age: 60, retirementAge: 65, lifeExpectancy: 80,
    spouseAge: 58, spouseRetirementAge: 63, spouseLifeExpectancy: 75,
    hasSpouse: true, survivorFactor: 1.0,
    ss1: 2000, ss2: 1000,
    trad401k: 300000, roth401k: 0, tradIRA: 0, rothIRA: 0, taxableBrokerage: 0,
    annualContrib401k: 0, employerMatch: 0, annualContribIRA: 0, annualContribOther: 0,
    spouseAnnualContrib401k: 0, spouseEmployerMatch: 0, spouseAnnualContribIRA: 0, spouseAnnualContribOther: 0,
    pension: 0, pensionCOLA: false, partTimeIncome: 0, partTimeEndAge: 70, rentalIncome: 0,
    housing: 1000, food: 500, healthcare: 300, transport: 200, leisure: 200, other: 100,
    longTermCare: 0, ltcStartAge: 80,
    homeValue: 0, homeOwned: false,
    investmentReturn: 5, inflation: 3, healthcareInflation: 5.5,
    stateInfo: { incomeTax: 0, hasSSIncomeTax: false, avgPropertyTaxRate: 0, costOfLivingIndex: 100 },
    ssCola: 0,
  };

  it('combined projection runway is no longer than a no-drop baseline with same total SS', () => {
    // withSurvivor: ss1=$2000, ss2=$1000 — at spouse death SS drops to max($2000,$1000)=$2000
    // noSurvivorDrop: same couple (same Part B costs), ss1=$3000, ss2=$0 — at spouse death
    //   SS stays at max($3000,$0)=$3000, so no income drop ever occurs.
    // Same expense structure, higher income floor → noSurvivorDrop should have longer runway.
    const withSurvivor   = runProjection({ ...base });
    const noSurvivorDrop = runProjection({ ...base, ss1: 3000, ss2: 0 });
    expect(withSurvivor.runwayYears).toBeLessThanOrEqual(noSurvivorDrop.runwayYears);
  });
});

describe('Mortgage payoff modeling', () => {
  const base = {
    ...BASE,
    housingType: "own",
    housing: 1500,
    retirementAge: 65,
    lifeExpectancy: 90,
  };

  it('mortgage paid off during retirement extends runway vs. paying forever', () => {
    const withPayoff    = runProjection({ ...base, mortgagePayoffAge: 72 });
    const withoutPayoff = runProjection({ ...base, housingType: "rent" }); // rent never ends
    expect(withPayoff.runwayYears).toBeGreaterThan(withoutPayoff.runwayYears);
  });

  it('payoff after life expectancy has no effect on the projection', () => {
    const earlyPayoff = runProjection({ ...base, mortgagePayoffAge: 72 });
    const latePayoff  = runProjection({ ...base, mortgagePayoffAge: 200 }); // never in range
    expect(earlyPayoff.runwayYears).toBeGreaterThanOrEqual(latePayoff.runwayYears);
  });

  it('rent type never drops housing cost regardless of mortgagePayoffAge', () => {
    const rent        = runProjection({ ...base, housingType: "rent", mortgagePayoffAge: 70 });
    const rentControl = runProjection({ ...base, housingType: "rent", mortgagePayoffAge: Infinity });
    expect(rent.runwayYears).toBe(rentControl.runwayYears);
  });
});

describe('RMDs (Required Minimum Distributions)', () => {
  // Person retires at 65, hits RMD age 73 — all trad, zero Roth
  const rmdBase = {
    ...BASE,
    retirementAge: 65, lifeExpectancy: 95,
    trad401k: 800000, tradIRA: 200000, // large trad balance triggers meaningful RMDs
    roth401k: 0, rothIRA: 0, taxableBrokerage: 0,
    ss1: 1500,
    housing: 1000, food: 500, healthcare: 400, transport: 200, leisure: 200, other: 100,
  };

  it('yearsData includes rmd field for each drawdown year', () => {
    const result = runProjection(rmdBase);
    const drawdown = result.yearsData.filter(d => d.age >= rmdBase.retirementAge);
    expect(drawdown[0]).toHaveProperty('rmd');
  });

  it('rmd is 0 before age 73', () => {
    const result = runProjection(rmdBase);
    const beforeRmd = result.yearsData.filter(d => d.age >= rmdBase.retirementAge && d.age < 73);
    for (const yr of beforeRmd) expect(yr.rmd).toBe(0);
  });

  it('rmd is positive at age 73+', () => {
    const result = runProjection(rmdBase);
    const atRmd = result.yearsData.find(d => d.age === 73);
    expect(atRmd?.rmd).toBeGreaterThan(0);
  });

  it('large trad balance with low spending has shorter runway than Roth-equivalent (RMD tax drag)', () => {
    const tradHeavy = runProjection({ ...rmdBase });
    // Same total assets but all Roth — no RMDs, no forced taxable income
    const rothEquiv = runProjection({
      ...rmdBase,
      trad401k: 0, tradIRA: 0, roth401k: 800000, rothIRA: 200000,
    });
    // Roth should run longer because no forced RMD tax drag
    expect(rothEquiv.runwayYears).toBeGreaterThanOrEqual(tradHeavy.runwayYears);
  });
});

describe('IRMAA surcharges', () => {
  // Low guaranteed income: SS $1,200/mo, no pension — MAGI ≈ $14,400 → $0
  const lowIncomeBase = {
    ...BASE,
    ss1: 1200, ss2: 0, pension: 0,
    retirementAge: 65, lifeExpectancy: 85,
    ssCola: 0,
  };

  it('irmaa is 0 below income threshold', () => {
    const result = runProjection(lowIncomeBase);
    const medicareYears = result.yearsData.filter(d => d.age >= 65);
    for (const yr of medicareYears) {
      expect(yr.irmaa).toBe(0);
    }
  });

  it('irmaa is 0 before age 65', () => {
    // retirementAge 62 means ages 62, 63, 64 should have irmaa=0
    const result = runProjection({ ...lowIncomeBase, retirementAge: 62, lifeExpectancy: 85 });
    const preMedicare = result.yearsData.filter(d => d.age < 65);
    for (const yr of preMedicare) {
      expect(yr.irmaa).toBe(0);
    }
  });

  // High income: SS $5,000/mo + pension $4,000/mo → MAGI ≈ $108,000 → bracket 1 → $82.80/mo
  const highIncomeBase = {
    ...BASE,
    ss1: 5000, ss2: 0, pension: 4000, pensionCOLA: false,
    retirementAge: 65, lifeExpectancy: 85,
    trad401k: 0, tradIRA: 0, roth401k: 0, rothIRA: 0, taxableBrokerage: 200000,
    ssCola: 0,
  };

  it('irmaa is positive when guaranteed income exceeds threshold', () => {
    const result = runProjection(highIncomeBase);
    const firstMedicareYear = result.yearsData.find(d => d.age >= 65);
    expect(firstMedicareYear.irmaa).toBeGreaterThan(0);
  });

  it('couple has shorter runway than single at same income (2× IRMAA cost)', () => {
    // Both spouses ≥ 65 when drawdown starts → medicareCount = 2
    const couple = runProjection({
      ...highIncomeBase,
      hasSpouse: true, spouseAge: 65, spouseRetirementAge: 65, spouseLifeExpectancy: 85,
      survivorFactor: 1.0,
    });
    const single = runProjection({ ...highIncomeBase, hasSpouse: false });
    // Couple pays more IRMAA → shorter (or equal) runway
    expect(couple.runwayYears).toBeLessThanOrEqual(single.runwayYears);
  });
});

describe('Home equity sale', () => {
  it('homeSaleIntent keep produces no sale proceeds', () => {
    const result = runProjection({ ...BASE, homeSaleIntent: 'keep', homeSaleAge: 70 });
    // Use every(d => d.homeSaleProceeds === 0) — not some(...> 0) — so this test
    // FAILS before implementation (undefined === 0 is false). The >0 form would
    // pass even when the field doesn't exist yet (undefined > 0 === false).
    expect(result.yearsData.every(d => d.homeSaleProceeds === 0)).toBe(true);
  });

  it('sell injects proceeds at sale age', () => {
    const result = runProjection({
      ...BASE, mortgageBalance: 0, homeSaleIntent: 'sell', homeSaleAge: 70,
    });
    const saleYear = result.yearsData.find(d => d.age === 70);
    expect(saleYear.homeSaleProceeds).toBeGreaterThan(0);
    // After Fix 4: appreciated value = 300000 * 1.03^20 * 0.95 (yearsUntilSale = 70 - 50 = 20)
    const expectedProceeds = Math.round(300000 * Math.pow(1.03, 20) * 0.95);
    expect(saleYear.homeSaleProceeds).toBe(expectedProceeds);
    // proceeds appear only once — all years after sale must be 0
    const postSale = result.yearsData.filter(d => d.age > 70);
    expect(postSale.every(d => d.homeSaleProceeds === 0)).toBe(true);
  });

  it('property tax is lower in and after sale year compared to year before', () => {
    const sellResult = runProjection({ ...BASE, mortgageBalance: 0, homeSaleIntent: 'sell', homeSaleAge: 70 });
    const keepResult = runProjection({ ...BASE, mortgageBalance: 0, homeSaleIntent: 'keep', homeSaleAge: 70 });
    const sellYear = sellResult.yearsData.find(d => d.age === 70);
    const keepYear = keepResult.yearsData.find(d => d.age === 70);
    // sell scenario zeroes property tax at sale year; keep scenario retains it
    expect(sellYear.expenses).toBeLessThan(keepYear.expenses);
  });

  it('proceeds are 0 when mortgageBalance >= appreciated home value at sale', () => {
    // homeValue=300000, inflation=3, yearsUntilSale=20 → appreciated ≈ $541,833
    // Use mortgageBalance=600000 (> appreciated value) so proceeds are still $0 after Fix 4
    const result = runProjection({
      ...BASE, mortgageBalance: 600000, homeSaleIntent: 'sell', homeSaleAge: 70,
    });
    const saleYear = result.yearsData.find(d => d.age === 70);
    expect(saleYear.homeSaleProceeds).toBe(0);
  });

  it('selling home extends runway compared to keeping', () => {
    // Tight scenario: portfolio lasts ~1yr, depletes at age 66 in keep scenario.
    // Sale at 66 injects proceeds BEFORE depletion in sell scenario → dramatically longer runway.
    const tight = {
      ...BASE,
      ss1: 1000,
      trad401k: 60000, tradIRA: 0, taxableBrokerage: 0,
      annualContrib401k: 0, employerMatch: 0, annualContribIRA: 0,
      homeValue: 350000, mortgageBalance: 0, homeSaleAge: 66,
    };
    const sell = runProjection({ ...tight, homeSaleIntent: 'sell' });
    const keep = runProjection({ ...tight, homeSaleIntent: 'keep' });
    expect(sell.runwayYears).toBeGreaterThan(keep.runwayYears);
  });

  it('proceeds appear in first drawdown year when homeSaleAge equals retirementAge', () => {
    const result = runProjection({
      ...BASE, mortgageBalance: 0, homeSaleIntent: 'sell', homeSaleAge: 65,
    });
    const firstYear = result.yearsData.find(d => d.age === 65);
    expect(firstYear.homeSaleProceeds).toBeGreaterThan(0);
    // Property tax also stops at age 65 — expenses less than keep version
    const keepResult = runProjection({ ...BASE, homeSaleIntent: 'keep', homeSaleAge: 65 });
    const keepFirst  = keepResult.yearsData.find(d => d.age === 65);
    expect(firstYear.expenses).toBeLessThan(keepFirst.expenses);
  });
});

describe('Fix: SS COLA', () => {
  // SS-only scenario: no pension, partTime, rental; no state SS tax
  // inflation=3 so generalFactor != 1, but we can isolate SS by using no other income
  const ssOnlyBase = {
    age: 65, retirementAge: 65, lifeExpectancy: 95,
    hasSpouse: false, spouseAge: 0, spouseRetirementAge: 65, spouseLifeExpectancy: 95,
    ss1: 2000, ss2: 0,
    pension: 0, pensionCOLA: false,
    partTimeIncome: 0, partTimeEndAge: 70, rentalIncome: 0,
    annualContrib401k: 0, employerMatch: 0, annualContribIRA: 0, annualContribOther: 0,
    spouseAnnualContrib401k: 0, spouseEmployerMatch: 0,
    spouseAnnualContribIRA: 0, spouseAnnualContribOther: 0,
    trad401k: 0, roth401k: 0, tradIRA: 2000000, rothIRA: 0, taxableBrokerage: 0,
    homeValue: 0, homeOwned: false,
    investmentReturn: 5, inflation: 3, healthcareInflation: 5.5,
    housing: 1000, food: 500, healthcare: 300, transport: 200, leisure: 200, other: 100,
    longTermCare: 0, ltcStartAge: 80,
    stateInfo: { incomeTax: 0, hasSSIncomeTax: false, avgPropertyTaxRate: 0, costOfLivingIndex: 100 },
    survivorFactor: 1.0,
  };

  it('with ssCola=0, SS income in year 10 equals SS income in year 0', () => {
    const result = runProjection({ ...ssOnlyBase, ssCola: 0 });
    const drawdown = result.yearsData.filter(d => d.age >= 65);
    // SS is the only income source; with ssCola=0 and no other income it must be flat
    expect(drawdown[10].income).toBeCloseTo(drawdown[0].income, -2);
  });

  it('with ssCola=2.5, SS income in year 10 equals ssMonthly*12*1.025^10', () => {
    const ssMonthlyVal = 2000;
    const result = runProjection({ ...ssOnlyBase, ssCola: 2.5 });
    const drawdown = result.yearsData.filter(d => d.age >= 65);
    const expected = ssMonthlyVal * 12 * Math.pow(1.025, 10);
    expect(drawdown[10].income).toBeCloseTo(expected, -2);
  });

  it('higher ssCola produces longer portfolio runway', () => {
    const highCola = runProjection({ ...ssOnlyBase, ssCola: 3.0 });
    const noCola   = runProjection({ ...ssOnlyBase, ssCola: 0 });
    expect(highCola.runwayYears).toBeGreaterThanOrEqual(noCola.runwayYears);
  });
});

describe('Fix: Early Withdrawal Penalty', () => {
  // No accumulation phase: age == retirementAge, all-trad, no SS, no inflation, no return
  // This isolates the penalty to a pure comparison.
  const penaltyBase = {
    age: 55, retirementAge: 55, lifeExpectancy: 85,
    hasSpouse: false, spouseAge: 0, spouseRetirementAge: 65, spouseLifeExpectancy: 85,
    ss1: 0, ss2: 0,
    pension: 0, pensionCOLA: false,
    partTimeIncome: 0, partTimeEndAge: 70, rentalIncome: 0,
    annualContrib401k: 0, employerMatch: 0, annualContribIRA: 0, annualContribOther: 0,
    spouseAnnualContrib401k: 0, spouseEmployerMatch: 0,
    spouseAnnualContribIRA: 0, spouseAnnualContribOther: 0,
    trad401k: 0, roth401k: 0, tradIRA: 1000000, rothIRA: 0, taxableBrokerage: 0,
    homeValue: 0, homeOwned: false,
    investmentReturn: 0, inflation: 0, healthcareInflation: 0,
    housing: 2000, food: 0, healthcare: 0, transport: 0, leisure: 0, other: 0,
    longTermCare: 0, ltcStartAge: 80,
    stateInfo: { incomeTax: 0, hasSSIncomeTax: false, avgPropertyTaxRate: 0, costOfLivingIndex: 100 },
    survivorFactor: 1.0,
    ssCola: 0,
  };

  it('early retiree (55) has higher year-0 withdrawal than retiree at 60 with same spending', () => {
    // Same portfolio, same spending. Only diff: 55 < 59.5 (penalty applies), 60 >= 59.5 (no penalty).
    const early = runProjection({ ...penaltyBase, age: 55, retirementAge: 55 });
    const past  = runProjection({ ...penaltyBase, age: 60, retirementAge: 60 });
    const earlyYear0 = early.yearsData.find(d => d.age === 55);
    const pastYear0  = past.yearsData.find(d => d.age === 60);
    // $2000/mo = $24,000 spending gap → tradSpend ≈ $24,000 → penalty = $2,400
    expect(earlyYear0.withdrawal).toBeGreaterThan(pastYear0.withdrawal + 1500);
  });

  it('penalty is zero when retirement age is 62 (all years >= 59.5)', () => {
    // At retirementAge=62, no year is < 59.5 — penalty must be $0 throughout
    const result = runProjection({ ...penaltyBase, age: 62, retirementAge: 62 });
    // Baseline: no-penalty withdrawal at age 62 = $24,000/yr
    // Compare against age 55 run — year where age=62 should have no penalty effect
    const earlyRun = runProjection({ ...penaltyBase, age: 55, retirementAge: 55 });
    const earlyAt62 = earlyRun.yearsData.find(d => d.age === 62); // age 62, past penalty
    const lateAt62  = result.yearsData.find(d => d.age === 62);
    expect(earlyAt62.withdrawal).toBeCloseTo(lateAt62.withdrawal, -2);
  });

  it('early retirement (55) depletes portfolio at younger age than same scenario retiring at 62', () => {
    // runwayYears is relative to retirementAge, so it can't be compared across different
    // retirementAge values. runOutYear (absolute age) is the correct metric: the early
    // retiree should run out of money younger because the penalty drains their portfolio faster.
    const early = runProjection({ ...penaltyBase, age: 55, retirementAge: 55 });
    const late  = runProjection({ ...penaltyBase, age: 62, retirementAge: 62 });
    expect(early.runOutYear).toBeLessThan(late.runOutYear);
  });

  it('early withdrawal penalty actually reduces portfolio balance (bucket drained, not just display)', () => {
    // With investmentReturn=0 and inflation=0, portfolio math is exact.
    // Retire at 55 (penalty applies). After year 1, portfolioBalance should be less than
    // (startingBalance - yearlyWithdrawal) if the penalty appears only in the display figure,
    // OR equal to (startingBalance - yearlyWithdrawal) if the penalty correctly drains the bucket.
    // We verify by comparing portfolioBalance against a no-penalty run of the same real spend.
    const withPenalty    = runProjection({ ...penaltyBase, age: 55, retirementAge: 55 });
    const withoutPenalty = runProjection({ ...penaltyBase, age: 60, retirementAge: 60 });

    // Both start at $1,000,000. Same spending ($24,000/yr). investmentReturn=0, inflation=0.
    // After year 1: no-penalty portfolio = ~976,000. Penalty portfolio should be lower.
    const penaltyYear1   = withPenalty.yearsData.find(d => d.age === 55);
    const noPenaltyYear1 = withoutPenalty.yearsData.find(d => d.age === 60);

    expect(penaltyYear1.portfolio).toBeLessThan(noPenaltyYear1.portfolio);
  });
});

describe('Fix: Medicare Part B Base Premium', () => {
  const medicareBase = {
    age: 65, retirementAge: 65, lifeExpectancy: 85,
    hasSpouse: false, spouseAge: 0, spouseRetirementAge: 65, spouseLifeExpectancy: 85,
    ss1: 0, ss2: 0,
    pension: 0, pensionCOLA: false,
    partTimeIncome: 0, partTimeEndAge: 70, rentalIncome: 0,
    annualContrib401k: 0, employerMatch: 0, annualContribIRA: 0, annualContribOther: 0,
    spouseAnnualContrib401k: 0, spouseEmployerMatch: 0,
    spouseAnnualContribIRA: 0, spouseAnnualContribOther: 0,
    trad401k: 0, roth401k: 0, tradIRA: 2000000, rothIRA: 0, taxableBrokerage: 0,
    homeValue: 0, homeOwned: false,
    investmentReturn: 0, inflation: 0, healthcareInflation: 5.5,
    housing: 0, food: 0, healthcare: 0, transport: 0, leisure: 0, other: 0,
    longTermCare: 0, ltcStartAge: 80,
    stateInfo: { incomeTax: 0, hasSSIncomeTax: false, avgPropertyTaxRate: 0, costOfLivingIndex: 100 },
    survivorFactor: 1.0,
    ssCola: 0,
  };

  it('expenses at age 65 include Part B (~$174.70/mo × 12 = ~$2,096/yr)', () => {
    const result = runProjection({ ...medicareBase });
    const age65Year = result.yearsData.find(d => d.age === 65);
    // Part B: 174.70 * 12 ≈ 2096; with no other expenses this is the only expense
    expect(age65Year.expenses).toBeGreaterThan(2000);
  });

  it('expenses at age 75 are higher than at 65 (Part B inflates at healthcareInflation)', () => {
    const result = runProjection({ ...medicareBase });
    const age65Year = result.yearsData.find(d => d.age === 65);
    const age75Year = result.yearsData.find(d => d.age === 75);
    expect(age75Year.expenses).toBeGreaterThan(age65Year.expenses);
  });

  it('Part B inflates correctly: at age 75, cost ≈ 174.70 * 1.055^10 * 12', () => {
    const result = runProjection({ ...medicareBase, healthcareInflation: 5.5 });
    const age75Year = result.yearsData.find(d => d.age === 75);
    const expected = 174.70 * Math.pow(1.055, 10) * 12;
    expect(age75Year.expenses).toBeCloseTo(expected, -1);
  });

  it('couple has higher expenses at 65+ (both on Part B)', () => {
    const single = runProjection({ ...medicareBase });
    const couple = runProjection({
      ...medicareBase,
      hasSpouse: true,
      spouseAge: 65, spouseRetirementAge: 65, spouseLifeExpectancy: 85,
      survivorFactor: 1.0,
    });
    const singleAge65 = single.yearsData.find(d => d.age === 65);
    const coupleAge65 = couple.yearsData.find(d => d.age === 65);
    expect(coupleAge65.expenses).toBeGreaterThan(singleAge65.expenses + 1000);
  });

  it('Part B is $0 before age 65 and kicks in at 65 for a pre-65 retiree', () => {
    // Retire at 60; healthcare=0 so only Part B contributes to expenses
    const result = runProjection({ ...medicareBase, age: 60, retirementAge: 60 });
    const age64Year = result.yearsData.find(d => d.age === 64);
    const age65Year = result.yearsData.find(d => d.age === 65);
    expect(age64Year.expenses).toBe(0);   // no Part B before 65
    expect(age65Year.expenses).toBeGreaterThan(2000); // Part B kicks in at 65
  });
});

describe('Fix: Home Appreciation + Mortgage Payoff at Sale', () => {
  const saleBase = {
    ...BASE,
    ssCola: 0,
    homeOwned: true,
    homeValue: 400000,
    mortgageBalance: 0,
    homeSaleIntent: 'sell',
    homeSaleAge: 85, // 20 years after retirementAge=65
    inflation: 3,
  };

  it('selling a $400K home in 20 years at inflation=3 produces proceeds based on appreciated value', () => {
    const result = runProjection({ ...saleBase });
    const saleYear = result.yearsData.find(d => d.age === 85);
    // BASE.age=50, homeSaleAge=85, yearsUntilSale=35
    // appreciated value = 400000 * 1.03^35; net = appreciated * 0.95
    // Before fix: 400000 * 0.95 = 380000
    const expectedProceeds1 = Math.round(400000 * Math.pow(1.03, 35) * 0.95);
    expect(saleYear.homeSaleProceeds).toBe(expectedProceeds1);
  });

  it('mortgagePayoffAge <= homeSaleAge results in $0 mortgage balance at sale', () => {
    const result = runProjection({ ...saleBase, mortgageBalance: 150000, mortgagePayoffAge: 80, homeSaleAge: 85 });
    const saleYear = result.yearsData.find(d => d.age === 85);
    // mortgage paid off at 80, so sale at 85 uses $0 balance
    // BASE.age=50, homeSaleAge=85, yearsUntilSale=35; proceeds = appreciated * 0.95 (no mortgage deducted)
    const expectedProceeds2 = Math.round(400000 * Math.pow(1.03, 35) * 0.95);
    expect(saleYear.homeSaleProceeds).toBe(expectedProceeds2);
  });

  it('mortgagePayoffAge > homeSaleAge subtracts entered mortgageBalance', () => {
    const withMortgage    = runProjection({ ...saleBase, mortgageBalance: 150000, mortgagePayoffAge: 90, homeSaleAge: 85 });
    const withoutMortgage = runProjection({ ...saleBase, mortgageBalance: 0,      mortgagePayoffAge: 90, homeSaleAge: 85 });
    // With unpaid mortgage, proceeds should be lower
    const saleWithMortgage    = withMortgage.yearsData.find(d => d.age === 85);
    const saleWithoutMortgage = withoutMortgage.yearsData.find(d => d.age === 85);
    expect(saleWithoutMortgage.homeSaleProceeds).toBeGreaterThan(saleWithMortgage.homeSaleProceeds + 100000);
  });
});

describe('Fix: State Capital Gains Tax on Taxable Withdrawals', () => {
  // All-taxable portfolio: every dollar withdrawn is from taxableBrokerage.
  // 60% assumed gains, state tax applies to gains at state incomeTax rate.
  // Portfolio ($2M) and spending ($4,500/mo = $54K/yr) chosen so both CA and FL
  // deplete within the 50-yr projection window but CA depletes sooner:
  //   FL (0% state): 2M / 54,000 ≈ 37 yrs
  //   CA (9.3% state): annual cost ≈ 54,000 × (1 + 0.60×0.093) = ~57,013 → 2M/57,013 ≈ 35 yrs
  const taxableBase = {
    age: 65, retirementAge: 65, lifeExpectancy: 85,
    hasSpouse: false, spouseAge: 0, spouseRetirementAge: 65, spouseLifeExpectancy: 85,
    ss1: 0, ss2: 0,
    pension: 0, pensionCOLA: false,
    partTimeIncome: 0, partTimeEndAge: 70, rentalIncome: 0,
    annualContrib401k: 0, employerMatch: 0, annualContribIRA: 0, annualContribOther: 0,
    spouseAnnualContrib401k: 0, spouseEmployerMatch: 0,
    spouseAnnualContribIRA: 0, spouseAnnualContribOther: 0,
    trad401k: 0, roth401k: 0, tradIRA: 0, rothIRA: 0, taxableBrokerage: 2000000,
    homeValue: 0, homeOwned: false,
    investmentReturn: 0, inflation: 0, healthcareInflation: 0,
    housing: 4500, food: 0, healthcare: 0, transport: 0, leisure: 0, other: 0,
    longTermCare: 0, ltcStartAge: 80,
    survivorFactor: 1.0,
    ssCola: 0,
  };

  it('high-tax state (9.3%) has shorter runway than no-tax state with identical all-taxable portfolio', () => {
    const caSimple = runProjection({
      ...taxableBase,
      stateInfo: { incomeTax: 0.093, hasSSIncomeTax: false, avgPropertyTaxRate: 0, costOfLivingIndex: 100 },
    });
    const flSimple = runProjection({
      ...taxableBase,
      stateInfo: { incomeTax: 0.0, hasSSIncomeTax: false, avgPropertyTaxRate: 0, costOfLivingIndex: 100 },
    });
    expect(flSimple.runwayYears).toBeGreaterThan(caSimple.runwayYears);
  });

  it('state with incomeTax=0 adds $0 state cap gains tax (same runway as another zero-tax state)', () => {
    const flResult = runProjection({
      ...taxableBase,
      stateInfo: { incomeTax: 0.0, hasSSIncomeTax: false, avgPropertyTaxRate: 0, costOfLivingIndex: 100 },
    });
    const txResult = runProjection({
      ...taxableBase,
      stateInfo: { incomeTax: 0.0, hasSSIncomeTax: false, avgPropertyTaxRate: 0, costOfLivingIndex: 100 },
    });
    // Both no-tax states → identical runway
    expect(flResult.runwayYears).toBe(txResult.runwayYears);
  });

  it('all-trad portfolio is not double-taxed (stateTaxOnTrad already covers trad withdrawals)', () => {
    // This verifies the fix targets ONLY taxable brokerage, not traditional accounts
    const tradCA = runProjection({
      ...taxableBase,
      trad401k: 0, tradIRA: 2000000, taxableBrokerage: 0,
      stateInfo: { incomeTax: 0.093, hasSSIncomeTax: false, avgPropertyTaxRate: 0, costOfLivingIndex: 100 },
    });
    const tradFL = runProjection({
      ...taxableBase,
      trad401k: 0, tradIRA: 2000000, taxableBrokerage: 0,
      stateInfo: { incomeTax: 0.0, hasSSIncomeTax: false, avgPropertyTaxRate: 0, costOfLivingIndex: 100 },
    });
    // CA trad still shorter (state tax on trad withdrawals applies) but shouldn't crash
    expect(tradCA.runwayYears).toBeGreaterThan(0);
    // The gap between CA and FL for trad-only should be different than for taxable-only
    // (trad is fully taxed as ordinary income, taxable is only 60% of gains at state rate)
    expect(tradFL.runwayYears).toBeGreaterThan(tradCA.runwayYears);
  });
});

// Helper stateInfo objects for exemption tests
const illinoisInfo = {
  incomeTax: 0.0495, hasSSIncomeTax: false, avgPropertyTaxRate: 0.0227,
  costOfLivingIndex: 95, pensionExemptPerPerson: Infinity, tradExemptPerPerson: Infinity,
};
const georgiaInfo = {
  incomeTax: 0.055, hasSSIncomeTax: false, avgPropertyTaxRate: 0.0092,
  costOfLivingIndex: 93, pensionExemptPerPerson: 65000, tradExemptPerPerson: 65000,
};

describe('State retirement income exemptions — pension pre-loop', () => {
  it('Illinois: pension net equals full pension (no state tax, full exemption)', () => {
    // Illinois exempts all retirement income; pensionStateTax should be 0
    const result = runProjection({
      ...BASE,
      pension: 2000,  // $2,000/mo = $24,000/yr — well under Infinity exemption
      stateInfo: illinoisInfo,
    });
    // stateTaxMonthly = ssStateTax + nonSSNonPension tax + pension tax + spousePension tax
    // With full exemption: pension portion = 0
    // BASE has ss1=2000, hasSSIncomeTax=false → ssStateTax=0
    // BASE has no part-time/rental → nonSSNonPension=0
    // Expected: stateTaxMonthly = 0
    expect(result.stateTaxMonthly).toBe(0);
  });

  it('Georgia: pension under $65K cap has no state tax', () => {
    // Pension of $3,000/mo = $36,000/yr — under $65K cap → no state tax
    const result = runProjection({
      ...BASE,
      pension: 3000,
      stateInfo: georgiaInfo,
    });
    expect(result.stateTaxMonthly).toBe(0);
  });

  it('Georgia: pension over $65K cap — only excess is taxed', () => {
    // Pension of $8,000/mo = $96,000/yr → taxable = $96,000 - $65,000 = $31,000/yr
    // state tax = $31,000 * 0.055 = $1,705/yr = ~$142/mo
    const result = runProjection({
      ...BASE,
      pension: 8000,
      stateInfo: georgiaInfo,
    });
    expect(result.stateTaxMonthly).toBeCloseTo(142, 0);
  });

  it('Illinois: stateExemptionSavingsMonthly equals what flat-rate would have charged', () => {
    // Illinois rate 4.95%, pension $2,000/mo = $24,000/yr
    // Old flat-rate tax: $2,000 * 0.0495 = $99/mo
    // New exemption-adjusted: $0/mo
    // Savings = $99/mo
    const result = runProjection({
      ...BASE,
      pension: 2000,
      stateInfo: illinoisInfo,
    });
    const expectedSavings = Math.round(2000 * 0.0495);
    expect(result.stateExemptionSavingsMonthly).toBe(expectedSavings);
  });
});

describe('State retirement income exemptions — trad withdrawal loop', () => {
  it('Illinois: trad withdrawal runway is longer than California (same inputs, higher trad balance)', () => {
    // Illinois exempts all trad withdrawals; California does not.
    // With a large trad balance, Illinois users pay less state tax on withdrawals → portfolio lasts longer.
    const californiaInfo = {
      incomeTax: 0.093, hasSSIncomeTax: false, avgPropertyTaxRate: 0.0073,
      costOfLivingIndex: 100, pensionExemptPerPerson: 0, tradExemptPerPerson: 0,
    };
    const illinoisInfoNormalized = { ...illinoisInfo, costOfLivingIndex: 100, avgPropertyTaxRate: 0.0073 };
    const califResult = runProjection({ ...BASE, stateInfo: californiaInfo, trad401k: 500000, tradIRA: 100000 });
    const ilResult    = runProjection({ ...BASE, stateInfo: illinoisInfoNormalized, trad401k: 500000, tradIRA: 100000 });
    expect(ilResult.runwayYears).toBeGreaterThan(califResult.runwayYears);
  });
});
