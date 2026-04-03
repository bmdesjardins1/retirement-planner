export function computeStateTax({ grossAnnual, stateInfo, type, personCount = 1 }) {
  const rate = stateInfo.incomeTax;
  if (rate === 0) return 0;

  const exemptPerPerson =
    type === 'pension' ? (stateInfo.pensionExemptPerPerson ?? 0) :
    type === 'trad'    ? (stateInfo.tradExemptPerPerson    ?? 0) :
    0;

  const taxable = Math.max(0, grossAnnual - exemptPerPerson * personCount);
  return taxable * rate;
}
