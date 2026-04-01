import { usePlanner } from "../context/PlannerContext";
import FieldInput from "../components/FieldInput";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

export default function IncomeStep() {
  const {
    age, retirementAge,
    hasSpouse,
    ss1, setSs1,
    ss2, setSs2,
    ss1ClaimAge, setSs1ClaimAge,
    ss2ClaimAge, setSs2ClaimAge,
    ssCola, setSsCola,
    adjustedSS1, adjustedSS2,
    pension, setPension,
    pensionCOLA, setPensionCOLA,
    pensionSurvivorPct, setPensionSurvivorPct,
    spousePension, setSpousePension,
    spousePensionCOLA, setSpousePensionCOLA,
    spousePensionSurvivorPct, setSpousePensionSurvivorPct,
    partTimeIncome, setPartTimeIncome,
    partTimeEndAge, setPartTimeEndAge,
    rentalIncome, setRentalIncome,
    state, results,
  } = usePlanner();

  function claimPreviewNote(claimAge, fraAmount, adjustedAmount) {
    const delta = Math.round(Math.abs(adjustedAmount - fraAmount));
    const adj = Math.round(adjustedAmount);
    if (claimAge === 67) return `At 67 (Full Retirement Age): $${adj.toLocaleString()}/mo`;
    if (claimAge < 67)  return `At ${claimAge}: $${adj.toLocaleString()}/mo — $${delta.toLocaleString()}/mo less than waiting until 67`;
    return `At ${claimAge}: $${adj.toLocaleString()}/mo — $${delta.toLocaleString()}/mo more than claiming at 67`;
  }
  return (
    <div>
      <SectionTitle sub="Include all monthly income sources in today's dollars.">Monthly Income</SectionTitle>

      <div className="grid-2">
        <Card>
          <h3 className="card-heading card-heading--green">Social Security</h3>
          <FieldInput label="Your Social Security Benefit (at Full Retirement Age, 67)" value={ss1} min={0} max={4000} step={50} onChange={setSs1} prefix="$" suffix="/mo"
            note="Check ssa.gov for your estimate (avg. ~$1,900/mo). Your ssa.gov estimate is already in today's dollars." />
          <FieldInput
            label="Your Planned Claiming Age"
            value={ss1ClaimAge} min={62} max={70} step={1}
            onChange={setSs1ClaimAge} suffix=" yrs"
            note={claimPreviewNote(ss1ClaimAge, ss1, adjustedSS1)}
          />
          {hasSpouse && (
            <>
              <FieldInput label="Spouse Social Security Benefit (at Full Retirement Age, 67)" value={ss2} min={0} max={4000} step={50} onChange={setSs2} prefix="$" suffix="/mo" />
              <FieldInput
                label="Spouse Planned Claiming Age"
                value={ss2ClaimAge} min={62} max={70} step={1}
                onChange={setSs2ClaimAge} suffix=" yrs"
                note={claimPreviewNote(ss2ClaimAge, ss2, adjustedSS2)}
              />
            </>
          )}
          {ss1 > 0 && (
            <FieldInput
              label="SS Annual COLA Rate"
              value={ssCola} min={0} max={4} step={0.1}
              onChange={setSsCola} suffix="%"
              note="SSA historical average ~2.5%/yr. Use 0% to model no COLA."
            />
          )}
        </Card>

        <Card>
          <h3 className="card-heading card-heading--purple">Other Income</h3>
          <FieldInput label="Pension"         value={pension}        min={0} max={5000} step={50}  onChange={setPension}        prefix="$" suffix="/mo" />
          {pension > 0 && (
            <div className="mb-20">
              <label className="field-label">Does this pension increase with inflation each year?</label>
              <p className="field-note">Most pensions pay a fixed dollar amount for life. Some government pensions include annual cost-of-living increases.</p>
              <div className="toggle-group">
                <button className={`toggle${pensionCOLA ? ' toggle--active' : ''}`} onClick={() => setPensionCOLA(true)}>Yes</button>
                <button className={`toggle${!pensionCOLA ? ' toggle--active' : ''}`} onClick={() => setPensionCOLA(false)}>No (fixed)</button>
              </div>
            </div>
          )}
          {pension > 0 && hasSpouse && (
            <div className="mb-20">
              <label className="field-label">What % of your pension does your spouse receive after your death?</label>
              <p className="field-note">Most pensions require you to elect a survivor benefit at retirement — check your plan documents. Single life pays more now but nothing to your spouse after your death.</p>
              <div className="toggle-group">
                {[0, 50, 75, 100].map(pct => (
                  <button
                    key={pct}
                    className={`toggle${pensionSurvivorPct === pct ? ' toggle--active' : ''}`}
                    onClick={() => setPensionSurvivorPct(pct)}
                  >
                    {pct === 0 ? '0% (Single Life)' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>
          )}
          {hasSpouse && (
            <>
              <FieldInput label="Spouse's Pension" value={spousePension} min={0} max={5000} step={50}  onChange={setSpousePension}  prefix="$" suffix="/mo" />
              {spousePension > 0 && (
                <div className="mb-20">
                  <label className="field-label">Does your spouse's pension increase with inflation each year?</label>
                  <p className="field-note">Most pensions pay a fixed dollar amount for life. Some government pensions include annual cost-of-living increases.</p>
                  <div className="toggle-group">
                    <button className={`toggle${spousePensionCOLA ? ' toggle--active' : ''}`} onClick={() => setSpousePensionCOLA(true)}>Yes</button>
                    <button className={`toggle${!spousePensionCOLA ? ' toggle--active' : ''}`} onClick={() => setSpousePensionCOLA(false)}>No (fixed)</button>
                  </div>
                </div>
              )}
              {spousePension > 0 && (
                <div className="mb-20">
                  <label className="field-label">What % of your spouse's pension do you receive after their death?</label>
                  <p className="field-note">Most pensions require you to elect a survivor benefit at retirement — check your plan documents.</p>
                  <div className="toggle-group">
                    {[0, 50, 75, 100].map(pct => (
                      <button
                        key={pct}
                        className={`toggle${spousePensionSurvivorPct === pct ? ' toggle--active' : ''}`}
                        onClick={() => setSpousePensionSurvivorPct(pct)}
                      >
                        {pct === 0 ? '0% (Single Life)' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <FieldInput label="Part-Time Work"  value={partTimeIncome} min={0} max={5000} step={100} onChange={setPartTimeIncome} prefix="$" suffix="/mo" />
          {partTimeIncome > 0 && (
            <FieldInput
              label="Stop working at age"
              value={partTimeEndAge} min={retirementAge} max={85} step={1}
              onChange={setPartTimeEndAge} suffix=" yrs"
              tooltip="Part-time income will be removed from your projection after this age."
            />
          )}
          <FieldInput label="Rental / Other Income" value={rentalIncome} min={0} max={5000} step={100} onChange={setRentalIncome} prefix="$" suffix="/mo"
            tooltip="Rental income, dividends, annuities, or any other recurring income." />
        </Card>
      </div>

      <Card className="mt-20">
        <div className="income-summary">
          <div>
            <div className="income-summary-left-label">
              Est. Net Monthly Income (after {state} state tax)
            </div>
            <div className="income-summary-amount value--green">
              ${results.netMonthlyIncome.toLocaleString()}
              <span className="income-summary-per-mo">/mo</span>
            </div>
          </div>
          <div>
            <div className="income-summary-tax-label">State tax est.</div>
            <div className="income-summary-tax-amount value--red">
              −${results.stateTaxMonthly.toLocaleString()}/mo
            </div>
          </div>
          <div>
            <div className="income-summary-tax-label">Federal tax est.</div>
            <div className="income-summary-tax-amount value--red">
              −${results.federalTaxMonthly.toLocaleString()}/mo
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
