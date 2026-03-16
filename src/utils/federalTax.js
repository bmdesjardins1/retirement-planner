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

  return Math.round(applyBrackets(taxableIncome, brackets));
}
