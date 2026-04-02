import { usePlanner } from "../context/PlannerContext";
import FieldInput from "../components/FieldInput";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

export default function SpendingStep() {
  const {
    housingType, setHousingType,
    housing, setHousing,
    mortgagePayoffAge, setMortgagePayoffAge,
    food, setFood,
    healthcare, setHealthcare,
    bridgeHealthcare, setBridgeHealthcare,
    transport, setTransport,
    leisure, setLeisure,
    other, setOther,
    longTermCare, setLongTermCare,
    ltcStartAge, setLtcStartAge,
    age, lifeExpectancy, retirementAge, spouseRetirementAge,
    hasSpouse,
    stateInfo, state, results,
  } = usePlanner();
  const gapPositive = results.monthlyGap > 0;

  return (
    <div>
      <SectionTitle sub={`Monthly expenses in today's dollars. These will be adjusted for ${state}'s cost of living index (${stateInfo.costOfLivingIndex}).`}>
        Monthly Spending
      </SectionTitle>

      {/* Housing Payment */}
      <Card className="mb-20">
        <h3 className="card-heading">Housing Payment</h3>
        <div className="toggle-group" style={{ marginBottom: 16 }}>
          <button
            className={`toggle${housingType === "own" ? " toggle--active" : ""}`}
            onClick={() => setHousingType("own")}
          >I have a mortgage</button>
          <button
            className={`toggle${housingType === "rent" ? " toggle--active" : ""}`}
            onClick={() => setHousingType("rent")}
          >I rent</button>
        </div>
        <div className="grid-2 gap-32">
          <FieldInput
            label={housingType === "own" ? "Monthly Mortgage Payment" : "Monthly Rent"}
            value={housing} min={0} max={5000} step={50}
            onChange={setHousing} prefix="$" suffix="/mo"
            note="Don't include property taxes here — we calculate those automatically from your home value on the Assets step."
          />
          {housingType === "own" && (
            <FieldInput
              label="Mortgage Paid Off At Age"
              value={mortgagePayoffAge} min={age} max={lifeExpectancy} step={1}
              onChange={setMortgagePayoffAge} suffix=" yrs"
              tooltip="After payoff, housing expenses drop to $0, freeing up that cash flow in your retirement projection."
            />
          )}
        </div>
      </Card>

      <div className="grid-2">
        <Card>
          <FieldInput label="Food & Groceries"            value={food}       min={0} max={2000} step={50} onChange={setFood}       prefix="$" suffix="/mo" />
          <FieldInput label="Monthly Healthcare in Retirement (on Medicare, age 65+)" value={healthcare} min={0} max={3000} step={50} onChange={setHealthcare} prefix="$" suffix="/mo"
            note="Medicare Part B (~$175/mo per person) is added automatically at age 65 — do not include it here. Add supplement/Medigap costs only (~$150–500/mo per person)." />
          {(retirementAge < 65 || (hasSpouse && spouseRetirementAge < 65)) && (
            <FieldInput
              label="Monthly Healthcare Before Medicare"
              value={bridgeHealthcare} min={0} max={5000} step={50}
              onChange={setBridgeHealthcare} prefix="$" suffix="/mo"
              note={`Private insurance before Medicare kicks in at 65. Marketplace/COBRA avg $800–1,500/mo per person. Applies from retirement until ${hasSpouse ? 'both of you are' : 'you are'} on Medicare.`}
            />
          )}
        </Card>

        <Card>
          <FieldInput label="Transportation"  value={transport} min={0} max={2000} step={50} onChange={setTransport} prefix="$" suffix="/mo" />
          <FieldInput label="Leisure & Travel" value={leisure}  min={0} max={3000} step={50} onChange={setLeisure}  prefix="$" suffix="/mo" />
          <FieldInput label="Other / Misc"     value={other}    min={0} max={2000} step={50} onChange={setOther}    prefix="$" suffix="/mo" />
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
          <FieldInput
            label="Monthly Long-Term Care Cost"
            value={longTermCare} min={0} max={10000} step={100}
            onChange={setLongTermCare} prefix="$" suffix="/mo"
            note="Avg costs (2024): In-home aide ~$5,000/mo · Assisted living ~$4,500/mo · Nursing home ~$8,500/mo"
          />
          <FieldInput
            label="Planned Start Age"
            value={ltcStartAge} min={retirementAge} max={lifeExpectancy} step={1}
            onChange={setLtcStartAge} suffix=" yrs"
            tooltip="Age at which you plan to account for long-term care costs in your budget."
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
