// 2024 federal income tax brackets
const BRACKETS_MARRIED = [
  [23200,  0.10],
  [94300,  0.12],
  [201050, 0.22],
  [383900, 0.24],
  [Infinity, 0.32],
];

const BRACKETS_SINGLE = [
  [11600,  0.10],
  [47150,  0.12],
  [100525, 0.22],
  [191950, 0.24],
  [Infinity, 0.32],
];

function applyBrackets(taxableIncome, brackets) {
  let tax = 0;
  let prev = 0;
  for (const [limit, rate] of brackets) {
    if (taxableIncome <= prev) break;
    tax += Math.min(taxableIncome - prev, limit - prev) * rate;
    prev = limit;
  }
  return tax;
}

/**
 * Estimates annual federal income tax for a retiree.
 *
 * ssAnnual         — total Social Security income for the year
 * ordinaryIncome   — pension + part-time + rental income for the year (before federal tax)
 * withdrawalEstimate — estimated portfolio withdrawal for the year (taxable portion)
 * married          — true if filing jointly with a spouse
 * age              — primary filer's age (used for senior standard deduction bonus)
 */
export function estimateFederalTax({ ssAnnual, ordinaryIncome, withdrawalEstimate, married, age }) {
  // The IRS uses "combined income" to decide how much of Social Security is taxable.
  // Combined income = other income + half of your SS benefits.
  const combinedIncome = ordinaryIncome + withdrawalEstimate + ssAnnual / 2;

  const lowerThreshold = married ? 32000 : 25000;
  const upperThreshold = married ? 44000 : 34000;

  let taxableSS;
  if (combinedIncome <= lowerThreshold) {
    taxableSS = 0;
  } else if (combinedIncome <= upperThreshold) {
    // Up to 50% of SS becomes taxable in this range
    taxableSS = Math.min(ssAnnual * 0.5, (combinedIncome - lowerThreshold) * 0.5);
  } else {
    // Up to 85% of SS becomes taxable above the upper threshold
    taxableSS = Math.min(
      ssAnnual * 0.85,
      0.85 * (combinedIncome - upperThreshold) + 0.5 * (upperThreshold - lowerThreshold)
    );
  }

  // Total income subject to federal tax
  const grossFederalIncome = ordinaryIncome + withdrawalEstimate + taxableSS;

  // Standard deduction (2024) — seniors 65+ get a bonus deduction
  let standardDeduction = married ? 29200 : 14600;
  if (age >= 65) standardDeduction += married ? 3100 : 1950;

  const taxableIncome = Math.max(0, grossFederalIncome - standardDeduction);
  const brackets = married ? BRACKETS_MARRIED : BRACKETS_SINGLE;

  return {
    tax: Math.round(applyBrackets(taxableIncome, brackets)),
    taxableSS: Math.round(taxableSS),
  };
}

/**
 * Estimates long-term capital gains tax.
 * All inputs must be in real (year-0) dollar terms. Caller scales result back to nominal.
 *
 * taxableGains        — the gains portion of a taxable brokerage withdrawal (real terms)
 * totalOrdinaryIncome — all ordinary income stacked below gains: pension + rental + PT +
 *                       Traditional account withdrawals (gross) + taxable SS (real terms)
 * married             — true if filing jointly
 *
 * Gains are stacked on top of ordinary income to find the applicable bracket.
 */
export function estimateCapitalGainsTax({ taxableGains, totalOrdinaryIncome, married }) {
  if (taxableGains <= 0) return 0;

  // 2024 long-term capital gains bracket thresholds (lower bound of each rate)
  const thresholds = married ? [94050, 583750] : [47025, 518900];
  const rates      = [0.00, 0.15, 0.20];

  const totalIncome = totalOrdinaryIncome + taxableGains;
  let tax = 0;

  for (let i = 0; i < rates.length; i++) {
    const bandBottom = i === 0 ? 0 : thresholds[i - 1];
    const bandTop    = i < thresholds.length ? thresholds[i] : Infinity;

    if (totalIncome <= bandBottom) break;

    // Gains portion that falls in this band = overlap of [ordinaryIncome, totalIncome] with [bandBottom, bandTop]
    const gainsStart  = Math.max(totalOrdinaryIncome, bandBottom);
    const gainsEnd    = Math.min(totalIncome, bandTop);
    const gainsInBand = Math.max(gainsEnd - gainsStart, 0);

    tax += gainsInBand * rates[i];
  }

  return Math.round(tax);
}
