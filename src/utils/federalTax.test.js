import { describe, it, expect } from 'vitest';
import { estimateFederalTax } from './federalTax';

describe('estimateFederalTax', () => {
  it('returns a number', () => {
    const result = estimateFederalTax({
      ssAnnual: 24000, ordinaryIncome: 0, withdrawalEstimate: 0,
      married: false, age: 70,
    });
    expect(typeof result).toBe('number');
  });
});
