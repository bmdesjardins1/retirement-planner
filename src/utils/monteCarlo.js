/**
 * Monte Carlo simulation for the drawdown phase.
 *
 * Keeps the income/expense path deterministic (same SS, pension, spending as
 * the main projection) and only varies the annual portfolio return. This is the
 * standard approach: uncertainty in spending is much smaller than uncertainty
 * in market returns, so return variance drives the confidence band.
 *
 * Normal returns are sampled via the Box-Muller transform — no library needed.
 */

function normalSample(mean, stddev) {
  // Box-Muller: transforms two uniform samples into one standard normal
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stddev * z;
}

/**
 * @param {object} opts
 * @param {Array}  opts.yearsData             - Full yearsData from runProjection()
 * @param {number} opts.portfolioAtRetirement  - Portfolio value at retirement (year 0 of drawdown)
 * @param {number} opts.investmentReturn       - Mean annual return (%, e.g. 5)
 * @param {number} opts.retirementAge          - Primary retirement age
 * @param {number} opts.effectiveLifeExpectancy - Last age that needs to be funded
 * @param {number} [opts.stdDev=10]            - Annual return std deviation (%, e.g. 10)
 * @param {number} [opts.simCount=1000]        - Number of simulations
 *
 * @returns {{ successRate: number, bands: Array<{age, p10, p50, p90}>, medianFailureAge: number|null, p10DepletionAge: number|null }}
 */
export function runMonteCarlo({
  yearsData,
  portfolioAtRetirement,
  investmentReturn,
  retirementAge,
  effectiveLifeExpectancy,
  stdDev = 10,
  simCount = 1000,
}) {
  // Only simulate the drawdown phase
  const drawdown = yearsData.filter(d => d.age >= retirementAge);
  if (drawdown.length === 0) return { successRate: 100, bands: [], medianFailureAge: null, p10DepletionAge: null };

  const meanReturn = investmentReturn / 100;
  const stdReturn  = stdDev / 100;

  // Collect portfolio value at each year across all simulations
  const perYear = Array.from({ length: drawdown.length }, () => []);
  let successes = 0;
  const failureAges = [];

  for (let sim = 0; sim < simCount; sim++) {
    let portfolio = portfolioAtRetirement;
    let failed = false;

    for (let i = 0; i < drawdown.length; i++) {
      if (failed) {
        perYear[i].push(0);
        continue;
      }

      const annualReturn = normalSample(meanReturn, stdReturn);
      // Grow first, then withdraw — matches the deterministic loop structure
      portfolio = portfolio * (1 + annualReturn) - drawdown[i].withdrawal;

      if (portfolio <= 0) {
        portfolio = 0;
        // Only count as failure if the portfolio runs dry before life expectancy
        if (drawdown[i].age <= effectiveLifeExpectancy) {
          failed = true;
          failureAges.push(drawdown[i].age);
        }
      }

      perYear[i].push(Math.round(portfolio));
    }

    if (!failed) successes++;
  }

  // Sort each year's values to compute percentiles
  const bands = drawdown.map((year, i) => {
    const sorted = perYear[i].slice().sort((a, b) => a - b);
    return {
      age: year.age,
      p10: sorted[Math.floor(simCount * 0.10)],
      p50: sorted[Math.floor(simCount * 0.50)],
      p90: sorted[Math.floor(simCount * 0.90)],
    };
  });

  // Compute medianFailureAge: median of all failure ages, or null if no failures
  let medianFailureAge = null;
  if (failureAges.length > 0) {
    const sorted = failureAges.slice().sort((a, b) => a - b);
    const mid = (sorted.length - 1) / 2;
    medianFailureAge = Math.round((sorted[Math.floor(mid)] + sorted[Math.ceil(mid)]) / 2);
  }

  // Compute p10DepletionAge: first age where p10 === 0, or null if never hits 0
  const p10DepletionAge = bands.find(b => b.p10 === 0)?.age ?? null;

  return {
    successRate: Math.round((successes / simCount) * 100),
    bands,
    medianFailureAge,
    p10DepletionAge,
  };
}
