import { describe, it, expect } from 'vitest';
import { ssAdjustmentFactor, ssBreakeven } from '../src/utils/ssUtils';

describe('ssAdjustmentFactor', () => {
  it('returns 1.0 at FRA (67)', () => {
    expect(ssAdjustmentFactor(67)).toBeCloseTo(1.0);
  });

  it('returns 0.70 at age 62 (max early reduction)', () => {
    expect(ssAdjustmentFactor(62)).toBeCloseTo(0.70, 4);
  });

  it('returns 0.80 at age 64 (36 months early)', () => {
    expect(ssAdjustmentFactor(64)).toBeCloseTo(0.80, 4);
  });

  it('returns 1.24 at age 70 (3 years of 8% credits)', () => {
    expect(ssAdjustmentFactor(70)).toBeCloseTo(1.24, 4);
  });

  it('returns 1.08 at age 68 (1 year delay)', () => {
    expect(ssAdjustmentFactor(68)).toBeCloseTo(1.08, 4);
  });
});

describe('ssBreakeven', () => {
  it('returns null when claimAge >= 70 (over-boundary: 71)', () => {
    expect(ssBreakeven(1800, 71)).toBeNull();
  });

  it('returns null when claimAge === 70 (at-boundary)', () => {
    expect(ssBreakeven(1800, 70)).toBeNull();
  });

  it('compareAge is FRA (67) when claimAge < 67', () => {
    const result = ssBreakeven(1800, 62);
    expect(result.compareAge).toBe(67);
  });

  it('compareAge is 70 when claimAge >= 67 and < 70', () => {
    const result = ssBreakeven(1800, 68);
    expect(result.compareAge).toBe(70);
  });

  it('breakevenAge is always after compareAge', () => {
    const result = ssBreakeven(1800, 62);
    expect(result.breakevenAge).toBeGreaterThan(result.compareAge);
  });

  it('known value: ssBreakeven(1800, 62) — early claiming to FRA', () => {
    const result = ssBreakeven(1800, 62);
    expect(result.compareAge).toBe(67);
    expect(result.currentBenefit).toBe(1260);
    expect(result.compareBenefit).toBe(1800);
    expect(result.breakevenAge).toBeCloseTo(78.7, 1);
  });

  it('known value: ssBreakeven(1800, 67) — FRA to max', () => {
    const result = ssBreakeven(1800, 67);
    expect(result.compareAge).toBe(70);
    expect(result.currentBenefit).toBe(1800);
    expect(result.compareBenefit).toBe(2232);
    expect(result.breakevenAge).toBeCloseTo(82.5, 1);
  });

  it('known value: ssBreakeven(1800, 68) — between FRA and max', () => {
    const result = ssBreakeven(1800, 68);
    expect(result.compareAge).toBe(70);
    expect(result.currentBenefit).toBe(1944);
    expect(result.compareBenefit).toBe(2232);
    expect(result.breakevenAge).toBeCloseTo(83.5, 1);
  });
});
