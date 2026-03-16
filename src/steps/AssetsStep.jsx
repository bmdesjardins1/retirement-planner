import { usePlanner } from "../context/PlannerContext";
import SliderInput from "../components/SliderInput";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

export default function AssetsStep() {
  const {
    savings401k, setSavings401k,
    iraBalance, setIraBalance,
    taxableInvestments, setTaxableInvestments,
    annualContrib401k, setAnnualContrib401k,
    employerMatch, setEmployerMatch,
    annualContribIRA, setAnnualContribIRA,
    annualContribOther, setAnnualContribOther,
    spouseSavings401k, setSpouseSavings401k,
    spouseIraBalance, setSpouseIraBalance,
    spouseTaxableInvestments, setSpouseTaxableInvestments,
    spouseAnnualContrib401k, setSpouseAnnualContrib401k,
    spouseEmployerMatch, setSpouseEmployerMatch,
    spouseAnnualContribIRA, setSpouseAnnualContribIRA,
    spouseAnnualContribOther, setSpouseAnnualContribOther,
    homeValue, setHomeValue,
    homeOwned, setHomeOwned,
    investmentReturn, setInvestmentReturn,
    inflation, setInflation,
    healthcareInflation, setHealthcareInflation,
    retirementAge, spouseRetirementAge,
    hasSpouse,
    stateInfo, state, results, primaryResults, spouseResults,
  } = usePlanner();
  return (
    <div>
      <SectionTitle sub="Your investable assets and how they might grow.">Assets & Investments</SectionTitle>

      {/* Retirement accounts row — yours + spouse's side by side */}
      <div className={`grid-2 mb-28`}>
        <Card>
          <h3 className="card-heading card-heading--green">Your Retirement Accounts</h3>
          <SliderInput label="Your 401(k) / 403(b) Balance" value={savings401k} min={0} max={2000000} step={10000} onChange={setSavings401k} prefix="$" />
          <SliderInput label="Annual 401(k) Contribution" value={annualContrib401k} min={0} max={30000} step={500} onChange={setAnnualContrib401k} prefix="$" suffix="/yr"
            note="2024 limit: $23,000 ($30,500 if age 50+)." />
          <SliderInput label="Employer Contributions / yr" value={employerMatch} min={0} max={15000} step={500} onChange={setEmployerMatch} prefix="$" suffix="/yr"
            note="Total your employer contributes to your retirement accounts each year. Check your HR portal or most recent pay stub." />

          <SliderInput label="Your IRA / Roth IRA Balance" value={iraBalance} min={0} max={1000000} step={5000} onChange={setIraBalance} prefix="$" />
          <SliderInput label="Annual IRA Contribution" value={annualContribIRA} min={0} max={8000} step={500} onChange={setAnnualContribIRA} prefix="$" suffix="/yr"
            note="2024 limit: $7,000 ($8,000 if age 50+). Includes Roth IRA." />

          <SliderInput label="Brokerage / Investment Accounts" value={taxableInvestments} min={0} max={1000000} step={5000} onChange={setTaxableInvestments} prefix="$"
            note="Investments held outside your 401(k) and IRA — stocks, index funds, ETFs in a regular brokerage account (e.g. Fidelity, Vanguard, Schwab)." />
          <SliderInput label="Annual Other Savings" value={annualContribOther} min={0} max={100000} step={1000} onChange={setAnnualContribOther} prefix="$" suffix="/yr"
            note="Additional savings to brokerage accounts, savings accounts, or other investments." />
        </Card>

        {hasSpouse && (
          <Card>
            <h3 className="card-heading card-heading--blue">Spouse Retirement Accounts</h3>
            <SliderInput label="Spouse 401(k) / 403(b) Balance" value={spouseSavings401k} min={0} max={2000000} step={10000} onChange={setSpouseSavings401k} prefix="$" />
            <SliderInput label="Annual Spouse 401(k) Contribution" value={spouseAnnualContrib401k} min={0} max={30000} step={500} onChange={setSpouseAnnualContrib401k} prefix="$" suffix="/yr"
              note="2024 limit: $23,000 ($30,500 if age 50+)." />
            <SliderInput label="Spouse Employer Contributions / yr" value={spouseEmployerMatch} min={0} max={15000} step={500} onChange={setSpouseEmployerMatch} prefix="$" suffix="/yr"
              note="Total your spouse's employer contributes annually to their retirement accounts." />

            <SliderInput label="Spouse IRA / Roth IRA Balance" value={spouseIraBalance} min={0} max={1000000} step={5000} onChange={setSpouseIraBalance} prefix="$" />
            <SliderInput label="Annual Spouse IRA Contribution" value={spouseAnnualContribIRA} min={0} max={8000} step={500} onChange={setSpouseAnnualContribIRA} prefix="$" suffix="/yr"
              note="2024 limit: $7,000 ($8,000 if age 50+)." />

            <SliderInput label="Spouse Brokerage / Investment Accounts" value={spouseTaxableInvestments} min={0} max={1000000} step={5000} onChange={setSpouseTaxableInvestments} prefix="$"
              note="Investments held outside their 401(k) and IRA — stocks, index funds, ETFs in a regular brokerage account." />
            <SliderInput label="Spouse Annual Other Savings" value={spouseAnnualContribOther} min={0} max={100000} step={1000} onChange={setSpouseAnnualContribOther} prefix="$" suffix="/yr"
              note="Additional savings to brokerage, savings accounts, etc." />
          </Card>
        )}
      </div>

      {/* Real Estate & Growth — full row */}
      <Card className="mb-28">
        <h3 className="card-heading card-heading--purple">Real Estate & Growth</h3>

        <div className="grid-2">
          <div>
            <div className="mb-20">
              <label className="field-label">Own Home?</label>
              <div className="toggle-group">
                <button className={`toggle${homeOwned ? " toggle--active" : ""}`}  onClick={() => setHomeOwned(true)}>Own</button>
                <button className={`toggle${!homeOwned ? " toggle--active" : ""}`} onClick={() => setHomeOwned(false)}>Rent</button>
              </div>
            </div>

            {homeOwned && (
              <SliderInput
                label="Home Value" value={homeValue} min={50000} max={1500000} step={10000}
                onChange={setHomeValue} prefix="$"
                note={`Est. property tax in ${state}: ~$${Math.round(homeValue * stateInfo.avgPropertyTaxRate / 12).toLocaleString()}/mo`}
              />
            )}
          </div>

          <div>
            <SliderInput label="Expected Return" value={investmentReturn} min={2} max={10}  step={0.5} onChange={setInvestmentReturn} suffix="% / yr"
              note="Conservative: 4-5%. Moderate: 6-7%. Aggressive: 8%+" />
            <SliderInput label="General Inflation Rate" value={inflation} min={1} max={6} step={0.5} onChange={setInflation} suffix="% / yr"
              note="How fast everyday costs rise. Historical avg ~3%. Higher = more conservative." />
            <SliderInput label="Healthcare Cost Growth" value={healthcareInflation} min={2} max={10} step={0.5} onChange={setHealthcareInflation} suffix="% / yr"
              note="Medical costs rise faster than general inflation — historically ~5-7%/yr. This is applied separately to your healthcare spending." />
          </div>
        </div>
      </Card>

      {/* Summary */}
      <Card>
        <div className="assets-total-label">Combined Total Liquid Assets</div>
        <div className="assets-total-value">${results.totalLiquidAssets.toLocaleString()}</div>
        <div className="assets-total-label mt-12">Your Projected Balance at Retirement (age {retirementAge})</div>
        <div className="assets-total-value value--green">${primaryResults.portfolioAtRetirement.toLocaleString()}</div>
        {hasSpouse && <>
          <div className="assets-total-label mt-12">Spouse Projected Balance at Retirement (age {spouseRetirementAge})</div>
          <div className="assets-total-value value--blue">${spouseResults.portfolioAtRetirement.toLocaleString()}</div>
        </>}
      </Card>
    </div>
  );
}
