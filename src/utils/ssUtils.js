/**
 * Returns the benefit multiplier for claiming SS at a given age.
 * FRA is assumed to be 67 (born 1960+).
 *
 * Early claiming: -5/9% per month for first 36 months before FRA,
 *                 -5/12% per month for months 37-60.
 * Delayed:        +8% per full year after FRA (max age 70).
 */
export function ssAdjustmentFactor(claimAge, fra = 67) {
  if (claimAge >= fra) return 1 + (claimAge - fra) * 0.08;
  const monthsEarly = (fra - claimAge) * 12;
  const reduction = monthsEarly <= 36
    ? monthsEarly * (5 / 9 / 100)
    : 36 * (5 / 9 / 100) + (monthsEarly - 36) * (5 / 12 / 100);
  return +(1 - reduction).toFixed(6);
}
