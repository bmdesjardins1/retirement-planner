import { usePlanner } from "../context/PlannerContext";
import SliderInput from "../components/SliderInput";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

export default function IncomeStep() {
  const {
    age, retirementAge,
    hasSpouse,
    ss1, setSs1,
    ss2, setSs2,
    pension, setPension,
    partTimeIncome, setPartTimeIncome,
    partTimeEndAge, setPartTimeEndAge,
    rentalIncome, setRentalIncome,
    state, results,
  } = usePlanner();
  return (
    <div>
      <SectionTitle sub="Include all monthly income sources in today's dollars.">Monthly Income</SectionTitle>

      <div className="grid-2">
        <Card>
          <h3 className="card-heading card-heading--green">Social Security</h3>
          <SliderInput label="Your Social Security Benefit" value={ss1} min={0} max={4000} step={50} onChange={setSs1} prefix="$" suffix="/mo"
            note="Check ssa.gov for your estimate (avg. ~$1,900/mo). Your ssa.gov estimate is already in today's dollars." />
          {hasSpouse && (
            <SliderInput label="Spouse Social Security Benefit" value={ss2} min={0} max={4000} step={50} onChange={setSs2} prefix="$" suffix="/mo" />
          )}
        </Card>

        <Card>
          <h3 className="card-heading card-heading--purple">Other Income</h3>
          <SliderInput label="Pension"          value={pension}         min={0} max={5000} step={50}  onChange={setPension}         prefix="$" suffix="/mo" />
          <SliderInput label="Part-Time Work"   value={partTimeIncome}  min={0} max={5000} step={100} onChange={setPartTimeIncome}  prefix="$" suffix="/mo" />
          {partTimeIncome > 0 && (
            <SliderInput
              label="Stop working at age"
              value={partTimeEndAge} min={retirementAge} max={85} step={1}
              onChange={setPartTimeEndAge} suffix=" yrs"
              note="Part-time income will be removed from your projection after this age."
            />
          )}
          <SliderInput label="Rental / Other Income" value={rentalIncome} min={0} max={5000} step={100} onChange={setRentalIncome} prefix="$" suffix="/mo"
            note="Rental income, dividends, annuities, or any other recurring income." />
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
