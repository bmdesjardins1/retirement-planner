import { describe, it, expect } from 'vitest';
import { computeStateTax } from '../src/utils/stateTax';

// Helpers for test stateInfo objects
const state = (incomeTax, pensionExempt = 0, tradExempt = 0) => ({
  incomeTax,
  pensionExemptPerPerson: pensionExempt,
  tradExemptPerPerson: tradExempt,
  hasSSIncomeTax: false,
  avgPropertyTaxRate: 0.01,
  costOfLivingIndex: 100,
});

describe('computeStateTax', () => {
  it('returns 0 for zero-rate state regardless of exemption', () => {
    expect(computeStateTax({ grossAnnual: 100000, stateInfo: state(0, Infinity, Infinity), type: 'pension' })).toBe(0);
  });

  it('applies full flat rate when no exemption', () => {
    // 5% of $60,000/yr = $3,000
    expect(computeStateTax({ grossAnnual: 60000, stateInfo: state(0.05, 0, 0), type: 'pension' })).toBe(3000);
  });

  it('returns 0 tax when income is below full-exemption cap (Infinity)', () => {
    expect(computeStateTax({ grossAnnual: 60000, stateInfo: state(0.05, Infinity, 0), type: 'pension' })).toBe(0);
  });

  it('taxes only the amount above a partial exemption cap', () => {
    // $65,000 cap, $80,000 income → taxable = $15,000, tax = $15,000 * 0.055 = $825
    expect(computeStateTax({ grossAnnual: 80000, stateInfo: state(0.055, 65000, 0), type: 'pension' })).toBe(825);
  });

  it('returns 0 when income is exactly at the exemption cap', () => {
    expect(computeStateTax({ grossAnnual: 65000, stateInfo: state(0.055, 65000, 0), type: 'pension' })).toBe(0);
  });

  it('returns 0 when income is below the exemption cap', () => {
    expect(computeStateTax({ grossAnnual: 40000, stateInfo: state(0.055, 65000, 0), type: 'pension' })).toBe(0);
  });

  it('uses tradExemptPerPerson when type is trad', () => {
    // tradExempt = $20,000, grossAnnual = $50,000 → taxable = $30,000, tax = $30,000 * 0.05 = $1,500
    expect(computeStateTax({ grossAnnual: 50000, stateInfo: state(0.05, 0, 20000), type: 'trad' })).toBe(1500);
  });

  it('applies no exemption for unknown type (e.g. ss)', () => {
    // type 'ss' has no exemption → full flat rate
    expect(computeStateTax({ grossAnnual: 30000, stateInfo: state(0.05, Infinity, Infinity), type: 'ss' })).toBe(1500);
  });

  it('doubles exemption for personCount 2 (couple)', () => {
    // Georgia-style $65K cap per person → $130K total exempt for couple
    // grossAnnual = $150,000 → taxable = $150,000 - $130,000 = $20,000, tax = $20,000 * 0.055 = $1,100
    expect(computeStateTax({ grossAnnual: 150000, stateInfo: state(0.055, 0, 65000), type: 'trad', personCount: 2 })).toBe(1100);
  });

  it('survivor phase uses personCount 1 (default)', () => {
    // Same inputs as above but personCount = 1 (default) → exempt = $65K only
    // taxable = $150,000 - $65,000 = $85,000, tax = $85,000 * 0.055 = $4,675
    expect(computeStateTax({ grossAnnual: 150000, stateInfo: state(0.055, 0, 65000), type: 'trad' })).toBe(4675);
  });
});
