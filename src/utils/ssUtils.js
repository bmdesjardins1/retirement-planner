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

/**
 * Returns breakeven analysis for delaying SS claiming.
 * Pass the raw FRA-equivalent benefit (ss1/ss2 from context), NOT adjustedSS1/adjustedSS2 —
 * this function applies ssAdjustmentFactor internally.
 *
 * compareAge: FRA (67) if claimAge < FRA, else 70
 * breakevenAge: age at which cumulative SS income from delaying overtakes early claiming
 * Returns null if claimAge >= 70 (already at maximum — no delay possible)
 *
 * Uses nominal dollars with no time-value adjustment — matches SSA methodology.
 */
export function ssBreakeven(monthlyBenefit, claimAge, fra = 67) {
  if (claimAge >= 70) return null;

  const compareAge     = claimAge < fra ? fra : 70;
  const currentBenefit = Math.round(monthlyBenefit * ssAdjustmentFactor(claimAge, fra));
  const compareBenefit = Math.round(monthlyBenefit * ssAdjustmentFactor(compareAge, fra));
  const monthsMissed   = (compareAge - claimAge) * 12;
  const monthlyGain    = compareBenefit - currentBenefit;

  if (monthlyGain <= 0) return null; // shouldn't occur given SSA rules

  const breakevenAge = compareAge + (monthsMissed * currentBenefit) / monthlyGain / 12;

  return { compareAge, currentBenefit, compareBenefit, breakevenAge: +breakevenAge.toFixed(1) };
}
