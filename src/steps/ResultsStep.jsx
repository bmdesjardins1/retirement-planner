import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { usePlanner } from "../context/PlannerContext";
import Card from "../components/Card";
import { runMonteCarlo } from "../utils/monteCarlo";

const tooltipStyle = { background: "#0f172a", border: "1px solid rgba(51,65,85,0.8)", borderRadius: 10, fontSize: 12 };

export default function ResultsStep() {
  const {
    results, primaryResults, spouseResults,
    hasSpouse, state,
    age, lifeExpectancy, retirementAge,
    spouseAge, spouseLifeExpectancy, spouseRetirementAge,
    longTermCare, ltcStartAge,
    investmentReturn,
    trad401k, tradIRA, hasTrad401k, hasTradIRA,
    spouseTrad401k, spouseTradIRA, spouseHasTrad401k, spouseHasTradIRA,
  } = usePlanner();
  const { verdict } = results;
  const gapPositive = results.monthlyGap > 0;

  // Withdrawal rate: annual gap drawn from portfolio at retirement
  // Shows 0 if there's a surplus (no portfolio draw needed)
  const withdrawalRate = results.portfolioAtRetirement > 0 && results.monthlyGap > 0
    ? ((results.monthlyGap * 12) / results.portfolioAtRetirement * 100)
    : 0;

  const withdrawalRateDisplay = withdrawalRate === 0 ? "0.0" : withdrawalRate.toFixed(1);

  const withdrawalRateColor =
    withdrawalRate === 0   ? "value--green"  :
    withdrawalRate <= 4    ? "value--green"  :
    withdrawalRate <= 5    ? "value--yellow" :
    withdrawalRate <= 7    ? "value--orange" :
                             "value--red";

  // Projected monthly need when LTC kicks in (inflation-adjusted from yearsData)
  const ltcMonthlyAtStart = longTermCare > 0
    ? Math.round((results.yearsData.find(d => d.age >= ltcStartAge)?.expenses ?? 0) / 12)
    : 0;

  // RMD callout: find first year where a forced RMD appears in the projection
  const hasTradAccounts = (hasTrad401k && trad401k > 0) || (hasTradIRA && tradIRA > 0) ||
    (hasSpouse && ((spouseHasTrad401k && spouseTrad401k > 0) || (spouseHasTradIRA && spouseTradIRA > 0)));
  const firstRmdYear = hasTradAccounts
    ? results.yearsData.find(d => d.rmd > 0)
    : null;

  // IRMAA: find first Medicare-eligible year with a surcharge
  const medicareYears = results.yearsData.filter(
    d => d.age >= Math.max(retirementAge, 65)
  );
  const firstIrmaaYear = medicareYears.find(d => d.irmaa > 0);

  // Monte Carlo: run 500 simulations varying annual return (±10% std dev)
  // Only the combined projection gets the band — it's the primary planning view.
  const effectiveLifeExpectancy = hasSpouse
    ? Math.max(lifeExpectancy, age + (spouseLifeExpectancy - spouseAge))
    : lifeExpectancy;

  const { successRate, bands } = useMemo(() => runMonteCarlo({
    yearsData: results.yearsData,
    portfolioAtRetirement: results.portfolioAtRetirement,
    investmentReturn,
    retirementAge,
    effectiveLifeExpectancy,
  }), [results.yearsData, results.portfolioAtRetirement, investmentReturn, retirementAge, effectiveLifeExpectancy]);

  const successRateColor =
    successRate >= 90 ? "value--green"  :
    successRate >= 75 ? "value--yellow" :
    successRate >= 50 ? "value--orange" :
                        "value--red";

  // Convert spouse ages to primary person's age axis
  const spouseRetirementOnPrimaryAxis = age + (spouseRetirementAge - spouseAge);
  const spouseLifeExpOnPrimaryAxis    = age + (spouseLifeExpectancy - spouseAge);

  // Merge the three yearsData arrays by index (each index = one calendar year from today)
  const maxLen = Math.max(
    results.yearsData.length,
    primaryResults.yearsData.length,
    spouseResults?.yearsData.length ?? 0,
  );
  // Build a lookup from age → MC band so we can merge into chartData by index
  const bandByAge = Object.fromEntries(bands.map(b => [b.age, b]));

  const chartData = Array.from({ length: maxLen }, (_, i) => {
    const base = results.yearsData[i];
    const lastAge = results.yearsData[results.yearsData.length - 1].age;
    const chartAge = base ? base.age : lastAge + (i - results.yearsData.length + 1);
    const band = bandByAge[chartAge];
    return {
      age: chartAge,
      combined: results.yearsData[i]?.portfolio ?? 0,
      primary: primaryResults.yearsData[i]?.portfolio ?? 0,
      spouse: spouseResults?.yearsData[i]?.portfolio ?? 0,
      // MC band: p10 is the floor, bandWidth stacks on top to reach p90.
      // Rendered with stackId="mc" so Recharts fills the area between them.
      mcFloor: band?.p10 ?? null,
      mcBand:  band ? Math.max(band.p90 - band.p10, 0) : null,
    };
  });
  const chartCutoffAge = hasSpouse
    ? Math.max(lifeExpectancy, spouseLifeExpOnPrimaryAxis) + 5
    : lifeExpectancy + 5;
  const visibleChartData = chartData.filter(d => d.age <= chartCutoffAge);

  return (
    <div>
      {/* Verdict Banner */}
      <div className={`verdict-banner ${verdict.bannerClass}`}>
        <div className="verdict-icon">{verdict.icon}</div>
        <div>
          <div className="verdict-eyebrow">Retirement Outlook</div>
          <div className={`verdict-label ${verdict.colorClass}`}>{verdict.label}</div>
          <p className="verdict-desc">{verdict.desc}</p>
        </div>
        <div className="verdict-runway">
          <div className="verdict-runway-label">Savings Runway</div>
          <div className={`verdict-runway-num ${verdict.colorClass}`}>
            {results.runOutYear ? results.runwayYears : "30+"}
          </div>
          <div className="verdict-runway-unit">years</div>
        </div>
        <div className="verdict-runway" style={{ borderLeft: "1px solid rgba(51,65,85,0.4)", paddingLeft: 24 }}>
          <div className="verdict-runway-label">Withdrawal Rate</div>
          <div className={`verdict-runway-num ${withdrawalRateColor}`}>
            {withdrawalRateDisplay}%
          </div>
          <div className="verdict-runway-unit">of portfolio / yr</div>
          <div className="verdict-runway-unit" style={{ marginTop: 4, fontSize: 9, opacity: 0.6 }}>
            ≤4% considered safe
          </div>
        </div>
        <div className="verdict-runway" style={{ borderLeft: "1px solid rgba(51,65,85,0.4)", paddingLeft: 24 }}>
          <div className="verdict-runway-label">Success Rate</div>
          <div className={`verdict-runway-num ${successRateColor}`}>
            {successRate}%
          </div>
          <div className="verdict-runway-unit">of 500 simulations</div>
          <div className="verdict-runway-unit" style={{ marginTop: 4, fontSize: 9, opacity: 0.6 }}>
            portfolio survives to life exp.
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid-3 mb-28">
        <Card>
          <div className="metric-card-label">Net Monthly Income</div>
          <div className="metric-card-value value--green">${results.netMonthlyIncome.toLocaleString()}</div>
          <div className="metric-card-sub">after {state} income tax</div>
        </Card>
        <Card>
          <div className="metric-card-label">Monthly Need at Retirement</div>
          <div className="metric-card-value value--white">${results.totalMonthlyNeed.toLocaleString()}</div>
          <div className="metric-card-sub">CoL-adjusted + property tax</div>
          {longTermCare > 0 && (
            <div className="metric-card-sub" style={{ color: "#f59e0b", marginTop: 6 }}>
              Rises to ~${ltcMonthlyAtStart.toLocaleString()}/mo at age {ltcStartAge} (incl. long-term care)
            </div>
          )}
        </Card>
        <Card>
          <div className="metric-card-label">Monthly {gapPositive ? "Withdrawal" : "Surplus"}</div>
          <div className={`metric-card-value ${gapPositive ? "value--orange" : "value--green"}`}>
            {gapPositive ? `-$${results.monthlyGap.toLocaleString()}` : `+$${Math.abs(results.monthlyGap).toLocaleString()}`}
          </div>
          <div className="metric-card-sub">{gapPositive ? "from portfolio" : "added to portfolio"}</div>
        </Card>
      </div>

      {/* Portfolio Chart */}
      <Card className="mb-28">
        <h3 className="chart-heading">Portfolio Value Over Time</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={visibleChartData} margin={{ top: 4, right: 8, bottom: 40, left: 16 }}>
            <defs>
              <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.4)" />
            <XAxis
              dataKey="age"
              tick={{ fill: "#475569", fontSize: 11 }}
              label={{ value: "Age", position: "insideBottom", offset: -12, fill: "#475569", fontSize: 11 }}
            />
            <YAxis
              tick={{ fill: "#475569", fontSize: 11 }}
              tickFormatter={v => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}k`}
              label={{ value: "Portfolio Value", angle: -90, position: "insideLeft", offset: 16, fill: "#475569", fontSize: 11 }}
              width={64}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={v => `Age ${v}`}
              formatter={(v, n) => [`$${v.toLocaleString()}`, n]}
            />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12, color: "#64748b" }} />

            <ReferenceLine
              x={retirementAge}
              stroke="#818cf8" strokeDasharray="4 4"
              label={{ value: "Your Retirement", fill: "#818cf8", fontSize: 10, position: "insideTopRight" }}
            />
            {hasSpouse && (
              <ReferenceLine
                x={spouseRetirementOnPrimaryAxis}
                stroke="#60a5fa" strokeDasharray="4 4"
                label={{ value: "Spouse Retire", fill: "#60a5fa", fontSize: 10, position: "insideTopLeft" }}
              />
            )}
            <ReferenceLine
              x={lifeExpectancy}
              stroke="#f43f5e" strokeDasharray="4 4"
              label={{ value: "Life Exp.", fill: "#f43f5e", fontSize: 10, position: "insideTopRight" }}
            />
            {hasSpouse && (
              <ReferenceLine
                x={spouseLifeExpOnPrimaryAxis}
                stroke="#fb923c" strokeDasharray="4 4"
                label={{ value: "Spouse Life Exp.", fill: "#fb923c", fontSize: 10, position: "insideTopLeft" }}
              />
            )}

            {/* MC confidence band: mcFloor (transparent base) + mcBand (width) stack to fill p10→p90 */}
            <Area type="monotone" dataKey="mcFloor" stackId="mc" stroke="none" fill="transparent" dot={false} legendType="none" connectNulls={false} />
            <Area type="monotone" dataKey="mcBand"  stackId="mc" stroke="none" fill="rgba(52,211,153,0.12)" dot={false} name="Market range (10th–90th %ile)" connectNulls={false} />

            <Area type="monotone" dataKey="combined" stroke="#34d399" strokeWidth={2.5} fill="url(#portGrad)" dot={false} name="Combined" />
            <Area type="monotone" dataKey="primary"  stroke="#818cf8" strokeWidth={1.5} fill="none" strokeDasharray="5 3" dot={false} name="You" />
            {hasSpouse && <Area type="monotone" dataKey="spouse" stroke="#60a5fa" strokeWidth={1.5} fill="none" strokeDasharray="5 3" dot={false} name="Spouse" />}
          </AreaChart>
        </ResponsiveContainer>
        {hasSpouse && (
          <p className="disclaimer" style={{ marginTop: 8, marginBottom: 0 }}>
            Individual trajectories (You / Spouse) use 60% of household expenses — the standard survivor planning assumption. Combined uses 100%.
          </p>
        )}
      </Card>

      {/* Income vs Expenses Chart */}
      <Card className="mb-28">
        <h3 className="chart-heading">Annual Income vs. Expenses (inflation-adjusted)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={results.yearsData.filter(d => d.age >= retirementAge && (d.age - retirementAge) % 5 === 0)}
            margin={{ top: 4, right: 8, bottom: 40, left: 16 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.4)" />
            <XAxis
              dataKey="age"
              tick={{ fill: "#475569", fontSize: 11 }}
              label={{ value: "Age", position: "insideBottom", offset: -12, fill: "#475569", fontSize: 11 }}
            />
            <YAxis
              tick={{ fill: "#475569", fontSize: 11 }}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
              width={52}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={v => `Age ${v}`}
              formatter={v => `$${v.toLocaleString()}`}
            />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12, color: "#64748b" }} />
            <Bar dataKey="income"   fill="rgba(52,211,153,0.7)" name="Income Sources" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="rgba(244,63,94,0.6)"  name="Expenses"       radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="disclaimer" style={{ marginTop: 8, marginBottom: 0 }}>
          The gap between expenses and income is drawn from your portfolio each year. When expenses exceed income, your savings cover the difference.
        </p>
      </Card>

      {/* Tax & Cost Summary */}
      <Card>
        <h3 className="chart-heading">Taxes & Cost of Living Impact</h3>
        <div className="grid-2">
          <div className="metric-box metric-box--green">
            <div className="metric-box-label">Federal Tax (est.) /mo</div>
            <div className="metric-box-value value--red">−${results.federalTaxMonthly.toLocaleString()}</div>
            <div className="metric-box-note">Based on 2024 tax rates</div>
          </div>
          <div className="metric-box metric-box--green">
            <div className="metric-box-label">{state} State Tax /mo</div>
            <div className="metric-box-value value--red">−${results.stateTaxMonthly.toLocaleString()}</div>
          </div>
          <div className="metric-box metric-box--purple">
            <div className="metric-box-label">Property Tax /mo</div>
            <div className="metric-box-value value--purple">−${results.monthlyPropertyTax.toLocaleString()}</div>
          </div>
          {longTermCare > 0 ? (
            <div className="metric-box metric-box--yellow">
              <div className="metric-box-label">Long-Term Care /mo</div>
              <div className="metric-box-value value--yellow">−${longTermCare.toLocaleString()}</div>
              <div className="metric-box-note">starts age {ltcStartAge} · inflates ~5.5%/yr</div>
            </div>
          ) : (
            <div className="metric-box metric-box--yellow">
              <div className="metric-box-label">CoL Adjustment</div>
              <div className="metric-box-value value--yellow">
                {results.costOfLivingDelta > 0 ? "+" : ""}{results.costOfLivingDelta}%
              </div>
              <div className="metric-box-note">vs national avg</div>
            </div>
          )}
        </div>
        {firstRmdYear && (
          <div className="metric-box metric-box--yellow mt-20" style={{ gridColumn: "1 / -1" }}>
            <div className="metric-box-label">Required Minimum Distributions (RMDs)</div>
            <div className="metric-box-value value--yellow">${Math.round(firstRmdYear.rmd / 12).toLocaleString()}/mo</div>
            <div className="metric-box-note">
              Starting at age {firstRmdYear.age}, the IRS requires you to withdraw a minimum amount from your
              traditional (pre-tax) accounts each year — whether you need the money or not.
              Excess withdrawals above your spending need are reinvested in your taxable account but count as
              ordinary income, which can increase your tax bill. Consider Roth conversions before age 73 to reduce future RMDs.
            </div>
          </div>
        )}

        {/* IRMAA surcharge */}
        {firstIrmaaYear ? (
          <div className="metric-box metric-box--yellow mt-20" style={{ gridColumn: "1 / -1" }}>
            <div className="metric-box-label">Medicare IRMAA</div>
            <div className="metric-box-value value--yellow">
              +${firstIrmaaYear.irmaa.toLocaleString()}/mo per person
            </div>
            <div className="metric-box-note">
              Based on your guaranteed retirement income (SS, pension, other fixed sources).
              Actual surcharge may be higher if large traditional account withdrawals push
              your income up.
            </div>
            <div className="metric-box-note" style={{ marginTop: 4 }}>
              Roth conversions before 65 can reduce this — Roth withdrawals don't count
              toward the Medicare income limit.
            </div>
          </div>
        ) : (
          <div className="metric-box metric-box--green mt-20" style={{ gridColumn: "1 / -1" }}>
            <div className="metric-box-label">Medicare IRMAA</div>
            <div className="metric-box-value value--green">No surcharge</div>
            <div className="metric-box-note">
              Your projected income is below the Medicare IRMAA threshold (based on 2024 brackets —
              not adjusted for future premium changes).
            </div>
          </div>
        )}

        <p className="disclaimer">
          ⚠ This tool provides estimates for planning purposes only and is not financial advice. Consult a certified financial planner (CFP) for personalized guidance. Tax rates, Social Security rules, and cost of living figures are approximate and subject to change.
        </p>
      </Card>
    </div>
  );
}
