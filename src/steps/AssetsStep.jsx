import { usePlanner } from "../context/PlannerContext";
import SliderInput from "../components/SliderInput";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

export default function AssetsStep() {
  const {
    trad401k, setTrad401k,
    roth401k, setRoth401k,
    tradIRA, setTradIRA,
    rothIRA, setRothIRA,
    taxableBrokerage, setTaxableBrokerage,
    hasTrad401k, setHasTrad401k,
    hasRoth401k, setHasRoth401k,
    hasTradIRA, setHasTradIRA,
    hasRothIRA, setHasRothIRA,
    hasTaxableBrokerage, setHasTaxableBrokerage,
    spouseTrad401k, setSpouseTrad401k,
    spouseRoth401k, setSpouseRoth401k,
    spouseTradIRA, setSpouseTradIRA,
    spouseRothIRA, setSpouseRothIRA,
    spouseTaxableBrokerage, setSpouseTaxableBrokerage,
    spouseHasTrad401k, setSpouseHasTrad401k,
    spouseHasRoth401k, setSpouseHasRoth401k,
    spouseHasTradIRA, setSpouseHasTradIRA,
    spouseHasRothIRA, setSpouseHasRothIRA,
    spouseHasTaxableBrokerage, setSpouseHasTaxableBrokerage,
    annualContrib401k, setAnnualContrib401k,
    employerMatch, setEmployerMatch,
    annualContribIRA, setAnnualContribIRA,
    annualContribOther, setAnnualContribOther,
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

          {/* Traditional 401(k) */}
          <div className="mb-20">
            <label className="field-label">Traditional 401(k) / 403(b)</label>
            <p className="field-note">Pre-tax retirement account through your employer. Withdrawals are taxed as regular income.</p>
            <div className="toggle-group">
              <button className={`toggle${hasTrad401k ? ' toggle--active' : ''}`} onClick={() => setHasTrad401k(true)}>I have this</button>
              <button className={`toggle${!hasTrad401k ? ' toggle--active' : ''}`} onClick={() => setHasTrad401k(false)}>I don't</button>
            </div>
            {hasTrad401k && <SliderInput label="Current Balance" value={trad401k} min={0} max={2000000} step={10000} onChange={setTrad401k} prefix="$" />}
          </div>

          {/* Roth 401(k) */}
          <div className="mb-20">
            <label className="field-label">Roth 401(k) / 403(b)</label>
            <p className="field-note">After-tax employer retirement account. Withdrawals are completely tax-free.</p>
            <div className="toggle-group">
              <button className={`toggle${hasRoth401k ? ' toggle--active' : ''}`} onClick={() => setHasRoth401k(true)}>I have this</button>
              <button className={`toggle${!hasRoth401k ? ' toggle--active' : ''}`} onClick={() => setHasRoth401k(false)}>I don't</button>
            </div>
            {hasRoth401k && <SliderInput label="Current Balance" value={roth401k} min={0} max={2000000} step={10000} onChange={setRoth401k} prefix="$" />}
          </div>

          {/* Traditional IRA */}
          <div className="mb-20">
            <label className="field-label">Traditional IRA</label>
            <p className="field-note">Pre-tax individual retirement account — a tax-advantaged savings account you open yourself, not through an employer. Withdrawals are taxed as regular income.</p>
            <div className="toggle-group">
              <button className={`toggle${hasTradIRA ? ' toggle--active' : ''}`} onClick={() => setHasTradIRA(true)}>I have this</button>
              <button className={`toggle${!hasTradIRA ? ' toggle--active' : ''}`} onClick={() => setHasTradIRA(false)}>I don't</button>
            </div>
            {hasTradIRA && <SliderInput label="Current Balance" value={tradIRA} min={0} max={1000000} step={5000} onChange={setTradIRA} prefix="$" />}
          </div>

          {/* Roth IRA */}
          <div className="mb-20">
            <label className="field-label">Roth IRA</label>
            <p className="field-note">After-tax individual retirement account. Withdrawals are completely tax-free.</p>
            <div className="toggle-group">
              <button className={`toggle${hasRothIRA ? ' toggle--active' : ''}`} onClick={() => setHasRothIRA(true)}>I have this</button>
              <button className={`toggle${!hasRothIRA ? ' toggle--active' : ''}`} onClick={() => setHasRothIRA(false)}>I don't</button>
            </div>
            {hasRothIRA && <SliderInput label="Current Balance" value={rothIRA} min={0} max={1000000} step={5000} onChange={setRothIRA} prefix="$" />}
          </div>

          {/* Taxable Brokerage */}
          <div className="mb-20">
            <label className="field-label">Brokerage / Investment Account</label>
            <p className="field-note">Regular investment account — not retirement-specific. Examples: Fidelity, Vanguard, Schwab taxable accounts. Only the gains portion is taxed when you withdraw, at lower long-term rates.</p>
            <div className="toggle-group">
              <button className={`toggle${hasTaxableBrokerage ? ' toggle--active' : ''}`} onClick={() => setHasTaxableBrokerage(true)}>I have this</button>
              <button className={`toggle${!hasTaxableBrokerage ? ' toggle--active' : ''}`} onClick={() => setHasTaxableBrokerage(false)}>I don't</button>
            </div>
            {hasTaxableBrokerage && <SliderInput label="Current Balance" value={taxableBrokerage} min={0} max={1000000} step={5000} onChange={setTaxableBrokerage} prefix="$" note="We assume 60% of withdrawals are taxable gains — a conservative estimate for a long-held account." />}
          </div>

          {/* Contribution sliders — unchanged */}
          <SliderInput label="Annual 401(k) Contribution" value={annualContrib401k} min={0} max={30000} step={500} onChange={setAnnualContrib401k} prefix="$" suffix="/yr"
            note="2024 limit: $23,000 ($30,500 if age 50+)." />
          <SliderInput label="Employer Contributions / yr" value={employerMatch} min={0} max={15000} step={500} onChange={setEmployerMatch} prefix="$" suffix="/yr"
            note="Total your employer contributes to your retirement accounts each year. Check your HR portal or most recent pay stub." />
          <SliderInput label="Annual IRA Contribution" value={annualContribIRA} min={0} max={8000} step={500} onChange={setAnnualContribIRA} prefix="$" suffix="/yr"
            note="2024 limit: $7,000 ($8,000 if age 50+). Includes Roth IRA." />
          <SliderInput label="Annual Other Savings" value={annualContribOther} min={0} max={100000} step={1000} onChange={setAnnualContribOther} prefix="$" suffix="/yr"
            note="Additional savings to brokerage accounts, savings accounts, or other investments." />
        </Card>

        {hasSpouse && (
          <Card>
            <h3 className="card-heading card-heading--blue">Spouse Retirement Accounts</h3>

            {/* Spouse Traditional 401(k) */}
            <div className="mb-20">
              <label className="field-label">Traditional 401(k) / 403(b)</label>
              <p className="field-note">Pre-tax retirement account through your spouse's employer. Withdrawals are taxed as regular income.</p>
              <div className="toggle-group">
                <button className={`toggle${spouseHasTrad401k ? ' toggle--active' : ''}`} onClick={() => setSpouseHasTrad401k(true)}>I have this</button>
                <button className={`toggle${!spouseHasTrad401k ? ' toggle--active' : ''}`} onClick={() => setSpouseHasTrad401k(false)}>I don't</button>
              </div>
              {spouseHasTrad401k && <SliderInput label="Current Balance" value={spouseTrad401k} min={0} max={2000000} step={10000} onChange={setSpouseTrad401k} prefix="$" />}
            </div>

            {/* Spouse Roth 401(k) */}
            <div className="mb-20">
              <label className="field-label">Roth 401(k) / 403(b)</label>
              <p className="field-note">After-tax employer retirement account. Withdrawals are completely tax-free.</p>
              <div className="toggle-group">
                <button className={`toggle${spouseHasRoth401k ? ' toggle--active' : ''}`} onClick={() => setSpouseHasRoth401k(true)}>I have this</button>
                <button className={`toggle${!spouseHasRoth401k ? ' toggle--active' : ''}`} onClick={() => setSpouseHasRoth401k(false)}>I don't</button>
              </div>
              {spouseHasRoth401k && <SliderInput label="Current Balance" value={spouseRoth401k} min={0} max={2000000} step={10000} onChange={setSpouseRoth401k} prefix="$" />}
            </div>

            {/* Spouse Traditional IRA */}
            <div className="mb-20">
              <label className="field-label">Traditional IRA</label>
              <p className="field-note">Pre-tax individual retirement account — a tax-advantaged savings account your spouse opens themselves, not through an employer. Withdrawals are taxed as regular income.</p>
              <div className="toggle-group">
                <button className={`toggle${spouseHasTradIRA ? ' toggle--active' : ''}`} onClick={() => setSpouseHasTradIRA(true)}>I have this</button>
                <button className={`toggle${!spouseHasTradIRA ? ' toggle--active' : ''}`} onClick={() => setSpouseHasTradIRA(false)}>I don't</button>
              </div>
              {spouseHasTradIRA && <SliderInput label="Current Balance" value={spouseTradIRA} min={0} max={1000000} step={5000} onChange={setSpouseTradIRA} prefix="$" />}
            </div>

            {/* Spouse Roth IRA */}
            <div className="mb-20">
              <label className="field-label">Roth IRA</label>
              <p className="field-note">After-tax individual retirement account. Withdrawals are completely tax-free.</p>
              <div className="toggle-group">
                <button className={`toggle${spouseHasRothIRA ? ' toggle--active' : ''}`} onClick={() => setSpouseHasRothIRA(true)}>I have this</button>
                <button className={`toggle${!spouseHasRothIRA ? ' toggle--active' : ''}`} onClick={() => setSpouseHasRothIRA(false)}>I don't</button>
              </div>
              {spouseHasRothIRA && <SliderInput label="Current Balance" value={spouseRothIRA} min={0} max={1000000} step={5000} onChange={setSpouseRothIRA} prefix="$" />}
            </div>

            {/* Spouse Taxable Brokerage */}
            <div className="mb-20">
              <label className="field-label">Brokerage / Investment Account</label>
              <p className="field-note">Regular investment account — not retirement-specific. Examples: Fidelity, Vanguard, Schwab taxable accounts. Only the gains portion is taxed when you withdraw, at lower long-term rates.</p>
              <div className="toggle-group">
                <button className={`toggle${spouseHasTaxableBrokerage ? ' toggle--active' : ''}`} onClick={() => setSpouseHasTaxableBrokerage(true)}>I have this</button>
                <button className={`toggle${!spouseHasTaxableBrokerage ? ' toggle--active' : ''}`} onClick={() => setSpouseHasTaxableBrokerage(false)}>I don't</button>
              </div>
              {spouseHasTaxableBrokerage && <SliderInput label="Current Balance" value={spouseTaxableBrokerage} min={0} max={1000000} step={5000} onChange={setSpouseTaxableBrokerage} prefix="$" note="We assume 60% of withdrawals are taxable gains — a conservative estimate for a long-held account." />}
            </div>

            {/* Spouse contribution sliders — unchanged */}
            <SliderInput label="Annual Spouse 401(k) Contribution" value={spouseAnnualContrib401k} min={0} max={30000} step={500} onChange={setSpouseAnnualContrib401k} prefix="$" suffix="/yr"
              note="2024 limit: $23,000 ($30,500 if age 50+)." />
            <SliderInput label="Spouse Employer Contributions / yr" value={spouseEmployerMatch} min={0} max={15000} step={500} onChange={setSpouseEmployerMatch} prefix="$" suffix="/yr"
              note="Total your spouse's employer contributes annually to their retirement accounts." />
            <SliderInput label="Annual Spouse IRA Contribution" value={spouseAnnualContribIRA} min={0} max={8000} step={500} onChange={setSpouseAnnualContribIRA} prefix="$" suffix="/yr"
              note="2024 limit: $7,000 ($8,000 if age 50+)." />
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
