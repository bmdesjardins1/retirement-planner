/**
 * 2024 IRMAA (Income-Related Monthly Adjustment Amount) brackets.
 * Medicare Part B + Part D combined monthly surcharge per person.
 * Source: CMS 2024.
 *
 * Note: the top married bracket is $750K (1.5× single $500K, not 2×).
 */

// [maxIncome, monthlyPerPerson] — single filer thresholds
const SINGLE_BRACKETS = [
  [103000,  0],
  [129000,  82.80],
  [161000,  208.00],
  [193000,  333.30],
  [500000,  458.50],
  [Infinity, 500.30],
];

// [maxIncome, monthlyPerPerson] — married filing jointly thresholds
const MARRIED_BRACKETS = [
  [206000,  0],
  [258000,  82.80],
  [322000,  208.00],
  [386000,  333.30],
  [750000,  458.50],
  [Infinity, 500.30],
];

/**
 * Returns the monthly IRMAA surcharge per person.
 *
 * @param {number} annualIncome - Annual MAGI in dollars (real/year-0 terms)
 * @param {boolean} isMarried - Use married filing jointly thresholds when true
 * @returns {number} Monthly surcharge per person (0 if below base threshold)
 */
export function getIrmaaSurcharge(annualIncome, isMarried) {
  const brackets = isMarried ? MARRIED_BRACKETS : SINGLE_BRACKETS;
  for (const [max, surcharge] of brackets) {
    if (annualIncome <= max) return surcharge;
  }
  return 500.30; // fallback (should never be reached due to Infinity sentinel)
}
