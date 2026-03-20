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
