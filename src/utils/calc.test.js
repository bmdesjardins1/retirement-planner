import { describe, it, expect } from 'vitest';
import { runProjection } from './calc';

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
  savings401k: 300000, iraBalance: 75000, taxableInvestments: 50000,
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
