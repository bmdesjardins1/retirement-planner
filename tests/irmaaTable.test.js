import { describe, it, expect } from 'vitest';
import { getIrmaaSurcharge } from '../src/utils/irmaaTable';

describe('getIrmaaSurcharge — single filer', () => {
  it('returns 0 at exactly the base threshold', () => {
    expect(getIrmaaSurcharge(103000, false)).toBe(0);
  });

  it('returns 82.80 one dollar above first bracket', () => {
    expect(getIrmaaSurcharge(103001, false)).toBe(82.80);
  });

  it('returns 208.00 in the second bracket', () => {
    expect(getIrmaaSurcharge(150000, false)).toBe(208.00);
  });

  it('returns 500.30 at the top bracket', () => {
    expect(getIrmaaSurcharge(600000, false)).toBe(500.30);
  });
});

describe('getIrmaaSurcharge — married filer', () => {
  it('returns 0 at exactly the married base threshold', () => {
    expect(getIrmaaSurcharge(206000, true)).toBe(0);
  });

  it('returns 82.80 one dollar above married first bracket', () => {
    expect(getIrmaaSurcharge(206001, true)).toBe(82.80);
  });

  it('returns 500.30 at the married top bracket', () => {
    // Married top bracket is $750K (not 2× single $500K — it is 1.5×)
    expect(getIrmaaSurcharge(800000, true)).toBe(500.30);
  });
});
