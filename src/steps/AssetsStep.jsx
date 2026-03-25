import { useState } from "react";
import { usePlanner } from "../context/PlannerContext";
import FieldInput from "../components/FieldInput";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import AccountTypeBlock from "../components/AccountTypeBlock";

export default function AssetsStep() {
  const [activeTab, setActiveTab] = useState('primary');
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
    mortgageBalance, setMortgageBalance,
    homeSaleIntent, setHomeSaleIntent,
    homeSaleAge, setHomeSaleAge,
    investmentReturn, setInvestmentReturn,
    inflation, setInflation,
    healthcareInflation, setHealthcareInflation,
    retirementAge, spouseRetirementAge,
    lifeExpectancy,
    hasSpouse,
    stateInfo, state, results, primaryResults, spouseResults,
  } = usePlanner();

  return (
    <div>
      <SectionTitle sub="Your investable assets and how they might grow.">Assets & Investments</SectionTitle>

      <Card className="mb-28">
        {hasSpouse && (
          <div className="account-tabs">
            <button
              className={`account-tab${activeTab === 'primary' ? ' account-tab--green' : ''}`}
              onClick={() => setActiveTab('primary')}
            >
              Your Accounts
            </button>
            <button
              className={`account-tab${activeTab === 'spouse' ? ' account-tab--blue' : ''}`}
              onClick={() => setActiveTab('spouse')}
            >
              Spouse Accounts
            </button>
          </div>
        )}

        {(!hasSpouse || activeTab === 'primary') && (
          <>
            {!hasSpouse && <h3 className="card-heading card-heading--green">Your Retirement Accounts</h3>}
            <AccountTypeBlock
              label="Traditional 401(k) / 403(b)"
              note="Pre-tax retirement account through your employer. Withdrawals are taxed as regular income."
              hasAccount={hasTrad401k} onToggle={setHasTrad401k}
              balance={trad401k} onBalanceChange={setTrad401k}
              max={2000000} step={10000}
            />
            <AccountTypeBlock
              label="Roth 401(k) / 403(b)"
              note="After-tax employer retirement account. Withdrawals are completely tax-free."
              hasAccount={hasRoth401k} onToggle={setHasRoth401k}
              balance={roth401k} onBalanceChange={setRoth401k}
              max={2000000} step={10000}
            />
            <AccountTypeBlock
              label="Traditional IRA"
              note="Pre-tax individual retirement account — a tax-advantaged savings account you open yourself, not through an employer. Withdrawals are taxed as regular income."
              hasAccount={hasTradIRA} onToggle={setHasTradIRA}
              balance={tradIRA} onBalanceChange={setTradIRA}
              max={1000000} step={5000}
            />
            <AccountTypeBlock
              label="Roth IRA"
              note="After-tax individual retirement account. Withdrawals are completely tax-free."
              hasAccount={hasRothIRA} onToggle={setHasRothIRA}
              balance={rothIRA} onBalanceChange={setRothIRA}
              max={1000000} step={5000}
            />
            <AccountTypeBlock
              label="Brokerage / Investment Account"
              note="Regular investment account — not retirement-specific. Examples: Fidelity, Vanguard, Schwab taxable accounts. Only the gains portion is taxed when you withdraw, at lower long-term rates."
              hasAccount={hasTaxableBrokerage} onToggle={setHasTaxableBrokerage}
              balance={taxableBrokerage} onBalanceChange={setTaxableBrokerage}
              max={1000000} step={5000}
              balanceNote="We assume 60% of withdrawals are taxable gains — a conservative estimate for a long-held account."
            />
            <FieldInput label="Annual 401(k) Contribution" value={annualContrib401k} min={0} max={30000} step={500} onChange={setAnnualContrib401k} prefix="$" suffix="/yr"
              note="2024 limit: $23,000 ($30,500 if age 50+)." />
            <FieldInput label="Employer Contributions / yr" value={employerMatch} min={0} max={15000} step={500} onChange={setEmployerMatch} prefix="$" suffix="/yr"
              note="Total your employer contributes to your retirement accounts each year. Check your HR portal or most recent pay stub." />
            <FieldInput label="Annual IRA Contribution" value={annualContribIRA} min={0} max={8000} step={500} onChange={setAnnualContribIRA} prefix="$" suffix="/yr"
              note="2024 limit: $7,000 ($8,000 if age 50+). Includes Roth IRA." />
            <FieldInput label="Annual Other Savings" value={annualContribOther} min={0} max={100000} step={1000} onChange={setAnnualContribOther} prefix="$" suffix="/yr"
              tooltip="Additional savings to brokerage accounts, savings accounts, or other investments." />
          </>
        )}

        {hasSpouse && activeTab === 'spouse' && (
          <>
            <AccountTypeBlock
              label="Traditional 401(k) / 403(b)"
              note="Pre-tax retirement account through your spouse's employer. Withdrawals are taxed as regular income."
              hasAccount={spouseHasTrad401k} onToggle={setSpouseHasTrad401k}
              balance={spouseTrad401k} onBalanceChange={setSpouseTrad401k}
              max={2000000} step={10000}
            />
            <AccountTypeBlock
              label="Roth 401(k) / 403(b)"
              note="After-tax employer retirement account. Withdrawals are completely tax-free."
              hasAccount={spouseHasRoth401k} onToggle={setSpouseHasRoth401k}
              balance={spouseRoth401k} onBalanceChange={setSpouseRoth401k}
              max={2000000} step={10000}
            />
            <AccountTypeBlock
              label="Traditional IRA"
              note="Pre-tax individual retirement account — a tax-advantaged savings account your spouse opens themselves, not through an employer. Withdrawals are taxed as regular income."
              hasAccount={spouseHasTradIRA} onToggle={setSpouseHasTradIRA}
              balance={spouseTradIRA} onBalanceChange={setSpouseTradIRA}
              max={1000000} step={5000}
            />
            <AccountTypeBlock
              label="Roth IRA"
              note="After-tax individual retirement account. Withdrawals are completely tax-free."
              hasAccount={spouseHasRothIRA} onToggle={setSpouseHasRothIRA}
              balance={spouseRothIRA} onBalanceChange={setSpouseRothIRA}
              max={1000000} step={5000}
            />
            <AccountTypeBlock
              label="Brokerage / Investment Account"
              note="Regular investment account — not retirement-specific. Examples: Fidelity, Vanguard, Schwab taxable accounts. Only the gains portion is taxed when you withdraw, at lower long-term rates."
              hasAccount={spouseHasTaxableBrokerage} onToggle={setSpouseHasTaxableBrokerage}
              balance={spouseTaxableBrokerage} onBalanceChange={setSpouseTaxableBrokerage}
              max={1000000} step={5000}
              balanceNote="We assume 60% of withdrawals are taxable gains — a conservative estimate for a long-held account."
            />
            <FieldInput label="Annual Spouse 401(k) Contribution" value={spouseAnnualContrib401k} min={0} max={30000} step={500} onChange={setSpouseAnnualContrib401k} prefix="$" suffix="/yr"
              note="2024 limit: $23,000 ($30,500 if age 50+)." />
            <FieldInput label="Spouse Employer Contributions / yr" value={spouseEmployerMatch} min={0} max={15000} step={500} onChange={setSpouseEmployerMatch} prefix="$" suffix="/yr"
              note="Total your spouse's employer contributes annually to their retirement accounts." />
            <FieldInput label="Annual Spouse IRA Contribution" value={spouseAnnualContribIRA} min={0} max={8000} step={500} onChange={setSpouseAnnualContribIRA} prefix="$" suffix="/yr"
              note="2024 limit: $7,000 ($8,000 if age 50+)." />
            <FieldInput label="Spouse Annual Other Savings" value={spouseAnnualContribOther} min={0} max={100000} step={1000} onChange={setSpouseAnnualContribOther} prefix="$" suffix="/yr"
              tooltip="Additional savings to brokerage, savings accounts, etc." />
          </>
        )}
      </Card>

      {/* Real Estate & Growth — unchanged */}
      <Card className="mb-28">
        <h3 className="card-heading card-heading--purple">Real Estate & Growth</h3>
        <div className="grid-2 gap-32">
          <div>
            <div className="mb-20">
              <label className="field-label">Own Home?</label>
              <div className="toggle-group">
                <button className={`toggle${homeOwned ? " toggle--active" : ""}`}  onClick={() => setHomeOwned(true)}>Own</button>
                <button className={`toggle${!homeOwned ? " toggle--active" : ""}`} onClick={() => setHomeOwned(false)}>Rent</button>
              </div>
            </div>
            {homeOwned && (
              <FieldInput
                label="Home Value" value={homeValue} min={50000} max={1500000} step={10000}
                onChange={setHomeValue} prefix="$"
                note={`Est. property tax in ${state}: ~$${Math.round(homeValue * stateInfo.avgPropertyTaxRate / 12).toLocaleString()}/mo`}
              />
            )}
          </div>
          <div>
            <FieldInput label="Expected Return" value={investmentReturn} min={2} max={10}  step={0.5} onChange={setInvestmentReturn} suffix="% / yr"
              note="Conservative: 4-5%. Moderate: 6-7%. Aggressive: 8%+" />
            <FieldInput label="General Inflation Rate" value={inflation} min={1} max={6} step={0.5} onChange={setInflation} suffix="% / yr"
              note="How fast everyday costs rise. Historical avg ~3%. Higher = more conservative." />
            <FieldInput label="Healthcare Cost Growth" value={healthcareInflation} min={2} max={10} step={0.5} onChange={setHealthcareInflation} suffix="% / yr"
              note="Medical costs rise faster than general inflation — historically ~5-7%/yr. This is applied separately to your healthcare spending." />
          </div>
        </div>

        {homeOwned && (
          <>
            <FieldInput
              label="Remaining Mortgage Balance"
              value={mortgageBalance} min={0} max={homeValue} step={5000}
              onChange={setMortgageBalance} prefix="$"
              tooltip="What you still owe on your mortgage today. If it's paid off (or nearly so), enter $0."
            />
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: -12, marginBottom: 16 }}>
              Estimated Equity: <strong style={{ color: "#e2e8f0" }}>${Math.max(0, homeValue - mortgageBalance).toLocaleString()}</strong>
            </div>

            <div className="mb-20">
              <label className="field-label">What do you plan to do with this home?</label>
              <div className="toggle-group">
                <button
                  className={`toggle${homeSaleIntent === "sell" ? " toggle--active" : ""}`}
                  onClick={() => setHomeSaleIntent("sell")}
                >Sell &amp; Invest Proceeds</button>
                <button
                  className={`toggle${homeSaleIntent === "keep" ? " toggle--active" : ""}`}
                  onClick={() => setHomeSaleIntent("keep")}
                >Keep / Leave to Heirs</button>
              </div>
            </div>

            {homeSaleIntent === "sell" && (
              <FieldInput
                label="Planned Sale Age"
                value={homeSaleAge} min={retirementAge} max={lifeExpectancy} step={1}
                onChange={setHomeSaleAge} suffix=" yrs"
                note={`We'll add ~$${Math.round(Math.max(0, homeValue - mortgageBalance) * 0.95).toLocaleString()} to your portfolio at age ${homeSaleAge} (after realtor fees and closing costs).`}
              />
            )}
          </>
        )}
      </Card>

      {/* Summary — preserved verbatim */}
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
