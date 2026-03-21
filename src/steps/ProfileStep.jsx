import { STATE_DATA } from "../data/stateData";
import { usePlanner } from "../context/PlannerContext";
import SliderInput from "../components/SliderInput";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

export default function ProfileStep() {
  const {
    age, setAge,
    spouseAge, setSpouseAge,
    hasSpouse, setHasSpouse,
    lifeExpectancy, setLifeExpectancy,
    spouseLifeExpectancy, setSpouseLifeExpectancy,
    retirementAge, setRetirementAge,
    spouseRetirementAge, setSpouseRetirementAge,
    state, setState,
    stateInfo,
  } = usePlanner();
  return (
    <div>
      <SectionTitle sub="Tell us about yourselves and where you live.">Your Profile</SectionTitle>

      <div className="grid-2 mb-28">
        <Card>
          <SliderInput label="Your Current Age" value={age} min={18} max={80} step={1} onChange={setAge} suffix=" yrs" />
          <SliderInput
            label="Planned Retirement Age"
            value={retirementAge} min={age} max={80} step={1}
            onChange={setRetirementAge} suffix=" yrs"
            note="Age at which you plan to stop working full-time."
          />
          <SliderInput
            label="Life Expectancy"
            value={lifeExpectancy} min={Math.max(75, retirementAge + 1)} max={100} step={1}
            onChange={setLifeExpectancy} suffix=" yrs"
            note="Average US life expectancy is ~78M / ~82F. Adjust based on health."
          />
        </Card>

        <Card>
          <div className="mb-20">
            <label className="field-label">Married / Partner?</label>
            <div className="toggle-group">
              <button className={`toggle${hasSpouse ? " toggle--active" : ""}`} onClick={() => setHasSpouse(true)}>Yes</button>
              <button className={`toggle${!hasSpouse ? " toggle--active" : ""}`} onClick={() => setHasSpouse(false)}>No</button>
            </div>
          </div>
          {hasSpouse && (
            <SliderInput label="Spouse / Partner Age" value={spouseAge} min={18} max={80} step={1} onChange={setSpouseAge} suffix=" yrs" />
          )}
          {hasSpouse && (
            <SliderInput
              label="Spouse Planned Retirement Age"
              value={spouseRetirementAge} min={spouseAge} max={80} step={1}
              onChange={setSpouseRetirementAge} suffix=" yrs"
              note="Age at which your spouse plans to stop working full-time."
            />
          )}
          {hasSpouse && (
            <SliderInput
              label="Spouse Life Expectancy"
              value={spouseLifeExpectancy} min={Math.max(75, spouseRetirementAge + 1)} max={100} step={1}
              onChange={setSpouseLifeExpectancy} suffix=" yrs"
              note="Average US life expectancy is ~78M / ~82F. Adjust based on health."
            />
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-8">
          <label className="field-label">State of Residence</label>
          <div className="select-wrapper">
            <select className="select" value={state} onChange={e => setState(e.target.value)}>
              {Object.keys(STATE_DATA).sort().map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid-3 mt-24">
          <div className="metric-box metric-box--green">
            <div className="metric-box-label">State Income Tax</div>
            <div className="metric-box-value value--green">{(stateInfo.incomeTax * 100).toFixed(1)}%</div>
            {!stateInfo.hasSSIncomeTax && <div className="metric-box-note">SS benefits not taxed</div>}
            {stateInfo.hasSSIncomeTax  && <div className="metric-box-warn">⚠ SS benefits taxed</div>}
          </div>

          <div className="metric-box metric-box--purple">
            <div className="metric-box-label">Avg Property Tax</div>
            <div className="metric-box-value value--purple">{(stateInfo.avgPropertyTaxRate * 100).toFixed(2)}%</div>
            <div className="metric-box-note">of home value / year</div>
          </div>

          <div className="metric-box metric-box--yellow">
            <div className="metric-box-label">Cost of Living</div>
            <div className="metric-box-value value--yellow">{stateInfo.costOfLivingIndex}</div>
            <div className="metric-box-note">national avg = 100</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
