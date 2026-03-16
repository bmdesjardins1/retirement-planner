import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { usePlanner } from "../context/PlannerContext";
import Card from "../components/Card";

const tooltipStyle = { background: "#0f172a", border: "1px solid rgba(51,65,85,0.8)", borderRadius: 10, fontSize: 12 };

export default function ResultsStep() {
  const {
    results, primaryResults, spouseResults,
    hasSpouse, state,
    age, lifeExpectancy, retirementAge,
    spouseAge, spouseLifeExpectancy, spouseRetirementAge,
    longTermCare, ltcStartAge,
  } = usePlanner();
  const { verdict } = results;
  const gapPositive = results.monthlyGap > 0;

  // Projected monthly need when LTC kicks in (inflation-adjusted from yearsData)
  const ltcMonthlyAtStart = longTermCare > 0
    ? Math.round((results.yearsData.find(d => d.age >= ltcStartAge)?.expenses ?? 0) / 12)
    : 0;

  // Merge the three yearsData arrays by index (each index = one calendar year from today)
  const maxLen = Math.max(
    results.yearsData.length,
    primaryResults.yearsData.length,
    spouseResults?.yearsData.length ?? 0,
  );
  const chartData = Array.from({ length: maxLen }, (_, i) => {
    const base = results.yearsData[i];
    const lastAge = results.yearsData[results.yearsData.length - 1].age;
    return {
      age: base ? base.age : lastAge + (i - results.yearsData.length + 1),
      combined: results.yearsData[i]?.portfolio ?? 0,
      primary: primaryResults.yearsData[i]?.portfolio ?? 0,
      spouse: spouseResults?.yearsData[i]?.portfolio ?? 0,
    };
  });

  // Convert spouse ages to primary person's age axis
  const spouseRetirementOnPrimaryAxis = age + (spouseRetirementAge - spouseAge);
  const spouseLifeExpOnPrimaryAxis    = age + (spouseLifeExpectancy - spouseAge);

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
          <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 24, left: 8 }}>
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
            <Legend wrapperStyle={{ fontSize: 12, color: "#64748b" }} />

            <ReferenceLine x={retirementAge} stroke="#818cf8" strokeDasharray="4 4" label={{ value: "Your Retirement", fill: "#818cf8", fontSize: 10 }} />
            {hasSpouse && <ReferenceLine x={spouseRetirementOnPrimaryAxis} stroke="#60a5fa" strokeDasharray="4 4" label={{ value: "Spouse Retirement", fill: "#60a5fa", fontSize: 10 }} />}
            <ReferenceLine x={lifeExpectancy} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: "Your Life Exp.", fill: "#f43f5e", fontSize: 10 }} />
            {hasSpouse && <ReferenceLine x={spouseLifeExpOnPrimaryAxis} stroke="#fb923c" strokeDasharray="4 4" label={{ value: "Spouse Life Exp.", fill: "#fb923c", fontSize: 10 }} />}

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
            margin={{ top: 4, right: 8, bottom: 24, left: 8 }}
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
            <Legend wrapperStyle={{ fontSize: 12, color: "#64748b" }} />
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
        <p className="disclaimer">
          ⚠ This tool provides estimates for planning purposes only and is not financial advice. Consult a certified financial planner (CFP) for personalized guidance. Tax rates, Social Security rules, and cost of living figures are approximate and subject to change.
        </p>
      </Card>
    </div>
  );
}
