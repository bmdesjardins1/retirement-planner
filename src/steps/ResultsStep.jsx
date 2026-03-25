import { useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { usePlanner } from "../context/PlannerContext";
import Card from "../components/Card";
import InfoTooltip from "../components/Tooltip";
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
    planningToMove, moveAge, retirementState, retirementStateInfo,
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

  // Home sale: find the year proceeds were injected (only appears for drawdown-phase sales,
  // since homeSaleAge is constrained to >= retirementAge by the context setters)
  const homeSaleYear = results.yearsData.find(d => d.homeSaleProceeds > 0);

  // Roth conversion window: show when user has active traditional accounts and retires with
  // at least 2 years before RMDs begin at 73. rothWindowYears is an inclusive count of ages
  // (e.g. retirementAge=65 → ages 65,66,67,68,69,70,71,72 = 8 years).
  // Minimum of 2 years avoids showing "Ages 72–72" (single-age range, visually confusing).
  // Note: intentionally checks only primary accounts (not spouse). The existing hasTradAccounts
  // check above includes spouse accounts for RMD detection — this is an accepted asymmetry.
  // A user whose only traditional accounts belong to the spouse will see the RMD callout but not
  // this one. See spec Simplification #3.
  const rothWindowYears = 73 - retirementAge;
  const showRothWindow =
    ((hasTrad401k && trad401k > 0) || (hasTradIRA && tradIRA > 0)) &&
    rothWindowYears >= 2;

  // Monte Carlo: run 500 simulations varying annual return (±10% std dev)
  // Only the combined projection gets the band — it's the primary planning view.
  const effectiveLifeExpectancy = hasSpouse
    ? Math.max(lifeExpectancy, age + (spouseLifeExpectancy - spouseAge))
    : lifeExpectancy;

  const portfolioAtLifeExp =
    results.yearsData.find(d => d.age >= effectiveLifeExpectancy)?.portfolio ?? 0;

  const portfolioAtLifeExpDisplay =
    portfolioAtLifeExp <= 0    ? "$0"
    : portfolioAtLifeExp < 1000 ? `$${Math.round(portfolioAtLifeExp)}`
    : portfolioAtLifeExp < 1e6  ? `$${Math.round(portfolioAtLifeExp / 1000)}k`
    :                             `$${(portfolioAtLifeExp / 1e6).toFixed(1)}M`;

  const portfolioAtLifeExpColor = portfolioAtLifeExp > 0 ? "value--green" : "value--red";

  const firstDeathAge = hasSpouse
    ? Math.min(lifeExpectancy, age + (spouseLifeExpectancy - spouseAge))
    : null;

  const { successRate } = useMemo(() => runMonteCarlo({
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
  const chartData = Array.from({ length: maxLen }, (_, i) => {
    const base = results.yearsData[i];
    const lastAge = results.yearsData[results.yearsData.length - 1].age;
    const chartAge = base ? base.age : lastAge + (i - results.yearsData.length + 1);
    return {
      age: chartAge,
      combined: results.yearsData[i]?.portfolio ?? 0,
      primary: primaryResults.yearsData[i]?.portfolio ?? 0,
      spouse: spouseResults?.yearsData[i]?.portfolio ?? 0,
    };
  });
  const visibleChartData = chartData.filter(d => d.age <= effectiveLifeExpectancy);

  return (
    <div>
      {/* Verdict Banner */}
      <div className={`verdict-banner ${verdict.bannerClass}`}>
        <div className="verdict-icon">
          <span style={{ color: "currentColor", fontSize: 20 }}>●</span>
        </div>
        <div>
          <div className="verdict-eyebrow">Retirement Outlook</div>
          <div className={`verdict-label ${verdict.colorClass}`}>{verdict.label}</div>
          <p className="verdict-desc">{verdict.desc}</p>
        </div>
        <div className="verdict-runway">
          <div className="verdict-runway-label">Portfolio at Age {effectiveLifeExpectancy}</div>
          <div className={`verdict-runway-num ${portfolioAtLifeExpColor}`}>
            {portfolioAtLifeExpDisplay}
          </div>
          <div className="verdict-runway-unit">projected balance</div>
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

      {/* Gap Analysis */}
      <div className="gap-analysis">
        <p className="gap-analysis-title">Monthly Retirement Picture</p>

        <div className="gap-analysis-row">
          <span className="gap-analysis-label">Monthly Need at Retirement</span>
          <span className="gap-analysis-value">${results.totalMonthlyNeed.toLocaleString()}</span>
        </div>

        <div className="gap-analysis-row">
          <span className="gap-analysis-label">
            <InfoTooltip text="Social Security + pension + rental income + part-time income, after state income tax.">
              <span>Guaranteed Income</span>
            </InfoTooltip>
          </span>
          <span className="gap-analysis-value" style={{ color: "#34d399" }}>
            − ${results.netMonthlyIncome.toLocaleString()}
          </span>
        </div>

        <div className="gap-analysis-row gap-analysis-row--total">
          <span className="gap-analysis-label">
            <InfoTooltip text="The amount drawn from your portfolio each month to cover the gap between income and spending. This drives your withdrawal rate.">
              <span>Monthly Portfolio Draw</span>
            </InfoTooltip>
          </span>
          <div style={{ textAlign: "right" }}>
            <div className={`gap-analysis-value ${gapPositive ? "value--orange" : "value--green"}`}>
              {gapPositive
                ? `$${results.monthlyGap.toLocaleString()}`
                : `+$${Math.abs(results.monthlyGap).toLocaleString()}`}
            </div>
            {gapPositive && (
              <div className={`gap-analysis-rate ${withdrawalRateColor}`}>
                {withdrawalRateDisplay}% withdrawal rate
              </div>
            )}
            {!gapPositive && (
              <div className="gap-analysis-rate" style={{ color: "#34d399" }}>
                Surplus — added to portfolio
              </div>
            )}
          </div>
        </div>

        {longTermCare > 0 && (
          <p style={{ fontSize: 12, color: "#f59e0b", margin: "12px 0 0" }}>
            Monthly need rises to ~${ltcMonthlyAtStart.toLocaleString()}/mo at age {ltcStartAge} when long-term care begins.
          </p>
        )}
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
            <Area type="monotone" dataKey="combined" stroke="#34d399" strokeWidth={2.5} fill="url(#portGrad)" dot={false} name="Combined" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Scenario Comparison Chart — couples only */}
      {hasSpouse && (
        <Card className="mb-28">
          <h3 className="chart-heading">Scenario Comparison: You vs. Spouse vs. Combined</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={visibleChartData} margin={{ top: 4, right: 8, bottom: 40, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.4)" />
              <XAxis
                dataKey="age"
                tick={{ fill: "#475569", fontSize: 11 }}
                label={{ value: "Age", position: "insideBottom", offset: -12, fill: "#475569", fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: "#475569", fontSize: 11 }}
                tickFormatter={v => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}k`}
                width={64}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={v => `Age ${v}`}
                formatter={(v, n) => [`$${v.toLocaleString()}`, n]}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12, color: "#64748b" }} />
              <Line type="monotone" dataKey="combined" stroke="#34d399" strokeWidth={2.5} dot={false} name="Combined" />
              <Line type="monotone" dataKey="primary"  stroke="#818cf8" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="You" />
              <Line type="monotone" dataKey="spouse"   stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="Spouse" />
            </LineChart>
          </ResponsiveContainer>
          <p className="disclaimer" style={{ marginTop: 8, marginBottom: 0 }}>
            Individual trajectories (You / Spouse) use 60% of household expenses — the standard survivor planning assumption. Combined uses 100%.
          </p>
        </Card>
      )}

      {/* Income vs Expenses Chart */}
      <Card className="mb-28">
        <h3 className="chart-heading">
          {hasSpouse ? "Combined Household Income vs. Expenses" : "Your Income vs. Expenses"} (inflation-adjusted)
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={results.yearsData.filter(
              d => d.age >= retirementAge && (d.age - retirementAge) % 5 === 0 && d.age <= effectiveLifeExpectancy
            )}
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
            {firstDeathAge && (
              <ReferenceLine
                x={firstDeathAge}
                stroke="#94a3b8" strokeDasharray="4 4"
                label={{ value: "Survivor phase", fill: "#94a3b8", fontSize: 10, position: "insideTopRight" }}
              />
            )}
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
            {planningToMove && (
              <div className="metric-box-note" style={{ marginTop: 8 }}>
                After your planned move to {retirementState} at age {moveAge}:{" "}
                state income tax changes to {(retirementStateInfo.incomeTax * 100).toFixed(1)}%
                {retirementStateInfo.hasSSIncomeTax
                  ? " (SS benefits are taxed in that state)"
                  : " (SS benefits are not taxed in that state)"}.
              </div>
            )}
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
        {medicareYears.length > 0 && (firstIrmaaYear ? (
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
        ))}

        {homeSaleYear && (
          <div className="metric-box metric-box--green mt-20" style={{ gridColumn: "1 / -1" }}>
            <div className="metric-box-label">Home Sale</div>
            <div className="metric-box-value value--green">
              +${homeSaleYear.homeSaleProceeds.toLocaleString()}
            </div>
            <div className="metric-box-note">
              At age {homeSaleYear.age} — one-time lump sum added to your portfolio after ~5% in realtor and closing costs.
              Capital gains tax is not modeled here — if your home has appreciated significantly, consult a tax advisor.
            </div>
          </div>
        )}

        {showRothWindow && (
          <div className="metric-box metric-box--yellow mt-20" style={{ gridColumn: "1 / -1" }}>
            <div className="metric-box-label">Roth Conversion Window</div>
            <div className="metric-box-value value--yellow">
              Ages {retirementAge}–72
            </div>
            <div className="metric-box-note">
              {rothWindowYears} years before RMDs begin at 73.
              Your income may be lower during this window — converting some traditional savings to Roth
              could reduce your lifetime tax bill. Roth accounts have no RMDs and withdrawals are tax-free.
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
