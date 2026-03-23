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
  };

  it('combined projection runway is no longer than a no-drop baseline with same total SS', () => {
    // withSurvivor drops SS at spouse death; noSurvivorDrop keeps full $3000 forever
    const withSurvivor   = runProjection({ ...base });
    const noSurvivorDrop = runProjection({ ...base, hasSpouse: false, ss1: 3000, survivorFactor: 1.0 });
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
    // homeValue 300000 - mortgageBalance 0 = 300000 × 0.95 = 285000
    expect(saleYear.homeSaleProceeds).toBeCloseTo(285000, -3);
  });

  it('property tax is lower in and after sale year compared to year before', () => {
    const sellResult = runProjection({ ...BASE, mortgageBalance: 0, homeSaleIntent: 'sell', homeSaleAge: 70 });
    const keepResult = runProjection({ ...BASE, mortgageBalance: 0, homeSaleIntent: 'keep', homeSaleAge: 70 });
    const sellYear = sellResult.yearsData.find(d => d.age === 70);
    const keepYear = keepResult.yearsData.find(d => d.age === 70);
    // sell scenario zeroes property tax at sale year; keep scenario retains it
    expect(sellYear.expenses).toBeLessThan(keepYear.expenses);
  });

  it('proceeds are 0 when mortgageBalance >= homeValue', () => {
    const result = runProjection({
      ...BASE, mortgageBalance: 400000, homeSaleIntent: 'sell', homeSaleAge: 70,
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
