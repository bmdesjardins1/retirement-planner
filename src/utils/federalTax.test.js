import { describe, it, expect } from 'vitest';
import { estimateFederalTax, estimateCapitalGainsTax } from './federalTax';

describe('estimateFederalTax', () => {
  it('returns { tax, taxableSS } shape', () => {
    const result = estimateFederalTax({
      ssAnnual: 24000, ordinaryIncome: 0, withdrawalEstimate: 0,
      married: false, age: 70,
    });
    expect(result).toHaveProperty('tax');
    expect(result).toHaveProperty('taxableSS');
    expect(typeof result.tax).toBe('number');
    expect(typeof result.taxableSS).toBe('number');
  });

  it('SS not taxable when combined income is below lower threshold ($25K single)', () => {
    // combined income = 0 + 0 + 12000/2 = 6000 < 25000
    const { taxableSS } = estimateFederalTax({
      ssAnnual: 12000, ordinaryIncome: 0, withdrawalEstimate: 0,
      married: false, age: 70,
    });
    expect(taxableSS).toBe(0);
  });

  it('up to 85% of SS is taxable above upper threshold ($34K single)', () => {
    // combined income = 40000 + 0 + 30000/2 = 55000 > 34000
    const { taxableSS } = estimateFederalTax({
      ssAnnual: 30000, ordinaryIncome: 40000, withdrawalEstimate: 0,
      married: false, age: 70,
    });
    expect(taxableSS).toBeLessThanOrEqual(Math.round(30000 * 0.85));
    expect(taxableSS).toBeGreaterThan(0);
  });

  it('applies senior standard deduction bonus at age 65+', () => {
    const { tax: under65 } = estimateFederalTax({
      ssAnnual: 0, ordinaryIncome: 30000, withdrawalEstimate: 0,
      married: false, age: 64,
    });
    const { tax: over65 } = estimateFederalTax({
      ssAnnual: 0, ordinaryIncome: 30000, withdrawalEstimate: 0,
      married: false, age: 65,
    });
    expect(over65).toBeLessThan(under65);
  });

  it('tax is zero for income below standard deduction', () => {
    const { tax } = estimateFederalTax({
      ssAnnual: 0, ordinaryIncome: 10000, withdrawalEstimate: 0,
      married: false, age: 65,
    });
    expect(tax).toBe(0);
  });
});

describe('estimateCapitalGainsTax', () => {
  it('0% rate when total income is below single threshold ($47,025)', () => {
    // 20000 + 10000 = 30000 < 47025
    const tax = estimateCapitalGainsTax({
      taxableGains: 10000, totalOrdinaryIncome: 20000, married: false,
    });
    expect(tax).toBe(0);
  });

  it('15% rate when ordinary income already exceeds 0% threshold', () => {
    // ordinary = 50000 > 47025 → all $10K gains in 15% bracket
    const tax = estimateCapitalGainsTax({
      taxableGains: 10000, totalOrdinaryIncome: 50000, married: false,
    });
    expect(tax).toBe(Math.round(10000 * 0.15));
  });

  it('married threshold is higher than single', () => {
    const single  = estimateCapitalGainsTax({ taxableGains: 50000, totalOrdinaryIncome: 60000, married: false });
    const married = estimateCapitalGainsTax({ taxableGains: 50000, totalOrdinaryIncome: 60000, married: true });
    expect(married).toBeLessThanOrEqual(single);
  });

  it('returns 0 for zero gains', () => {
    const tax = estimateCapitalGainsTax({ taxableGains: 0, totalOrdinaryIncome: 100000, married: false });
    expect(tax).toBe(0);
  });
});
