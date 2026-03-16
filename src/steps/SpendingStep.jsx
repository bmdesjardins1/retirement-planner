import { usePlanner } from "../context/PlannerContext";
import SliderInput from "../components/SliderInput";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

export default function SpendingStep() {
  const {
    housing, setHousing,
    food, setFood,
    healthcare, setHealthcare,
    transport, setTransport,
    leisure, setLeisure,
    other, setOther,
    longTermCare, setLongTermCare,
    ltcStartAge, setLtcStartAge,
    lifeExpectancy, retirementAge,
    stateInfo, state, results,
  } = usePlanner();
  const gapPositive = results.monthlyGap > 0;

  return (
    <div>
      <SectionTitle sub={`Monthly expenses in today's dollars. These will be adjusted for ${state}'s cost of living index (${stateInfo.costOfLivingIndex}).`}>
        Monthly Spending
      </SectionTitle>

      <div className="grid-2">
        <Card>
          <SliderInput label="Housing (rent/mortgage/HOA)" value={housing}    min={0} max={5000} step={50} onChange={setHousing}    prefix="$" suffix="/mo"
            note="Don't include property taxes here — we calculate those automatically from your home value on the Assets step." />
          <SliderInput label="Food & Groceries"            value={food}       min={0} max={2000} step={50} onChange={setFood}       prefix="$" suffix="/mo" />
          <SliderInput label="Healthcare & Insurance"      value={healthcare} min={0} max={3000} step={50} onChange={setHealthcare} prefix="$" suffix="/mo"
            note="Medicare + supplement avg ~$500-900/mo for a couple." />
        </Card>

        <Card>
          <SliderInput label="Transportation"  value={transport} min={0} max={2000} step={50} onChange={setTransport} prefix="$" suffix="/mo" />
          <SliderInput label="Leisure & Travel" value={leisure}  min={0} max={3000} step={50} onChange={setLeisure}  prefix="$" suffix="/mo" />
          <SliderInput label="Other / Misc"     value={other}    min={0} max={2000} step={50} onChange={setOther}    prefix="$" suffix="/mo" />
        </Card>
      </div>

      {/* Long-Term Care */}
      <Card className="mt-20">
        <h3 className="card-heading card-heading--purple">Long-Term Care Planning</h3>
        <p className="card-intro-note">
          70% of people turning 65 will need some form of long-term care. Average start age is around 80,
          and the average need lasts 2–3 years. Medicare does <strong>not</strong> cover ongoing custodial care
          (help with daily living). Set to $0 if you plan to self-insure or have long-term care insurance.
        </p>
        <div className="grid-2">
          <SliderInput
            label="Monthly Long-Term Care Cost"
            value={longTermCare} min={0} max={10000} step={100}
            onChange={setLongTermCare} prefix="$" suffix="/mo"
            note="Avg costs (2024): In-home aide ~$5,000/mo · Assisted living ~$4,500/mo · Nursing home ~$8,500/mo"
          />
          <SliderInput
            label="Planned Start Age"
            value={ltcStartAge} min={retirementAge} max={lifeExpectancy} step={1}
            onChange={setLtcStartAge} suffix=" yrs"
            note="Age at which you plan to account for long-term care costs in your budget."
          />
        </div>
      </Card>

      <Card className="mt-20">
        <div className="grid-3">
          <div>
            <div className="spending-summary-item-label">Base Monthly</div>
            <div className="spending-summary-item-value value--dim">${results.totalMonthlyExpenses.toLocaleString()}</div>
          </div>
          <div>
            <div className="spending-summary-item-label">After CoL Adj. + Property Tax</div>
            <div className="spending-summary-item-value value--white">${results.totalMonthlyNeed.toLocaleString()}</div>
          </div>
          <div>
            <div className="spending-summary-item-label">Monthly Gap</div>
            <div className={`spending-summary-item-value ${gapPositive ? "value--red" : "value--green"}`}>
              {gapPositive
                ? `−$${results.monthlyGap.toLocaleString()}`
                : `+$${Math.abs(results.monthlyGap).toLocaleString()}`}
            </div>
            <div className="spending-summary-item-note">
              {gapPositive ? "drawn from savings" : "surplus monthly"}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
