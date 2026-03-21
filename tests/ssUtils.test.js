import { describe, it, expect } from 'vitest';
import { ssAdjustmentFactor } from '../src/utils/ssUtils';

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
