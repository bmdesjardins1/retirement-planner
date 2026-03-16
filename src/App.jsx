import { PlannerProvider, usePlanner } from "./context/PlannerContext";
import ProfileStep  from "./steps/ProfileStep";
import IncomeStep   from "./steps/IncomeStep";
import AssetsStep   from "./steps/AssetsStep";
import SpendingStep from "./steps/SpendingStep";
import ResultsStep  from "./steps/ResultsStep";

const STEPS = ["Profile", "Income", "Assets", "Spending", "Results"];

function PlannerWizard() {
  const { step, setStep } = usePlanner();

  return (
    <div className="app">
      <header className="app-header">
        <p className="app-eyebrow">Retirement Planning Tool</p>
        <h1 className="app-headline">Will Your Money Last?</h1>
        <p className="app-sub">A personalized projection based on your real numbers.</p>
        <nav className="stepper">
          {STEPS.map((s, i) => (
            <button
              key={s}
              className={`step-btn${step === i ? " step-btn--active" : step > i ? " step-btn--done" : ""}`}
              onClick={() => step > i && setStep(i)}
            >
              {s}
            </button>
          ))}
        </nav>
      </header>

      <div className="content">
        {step === 0 && <ProfileStep />}
        {step === 1 && <IncomeStep />}
        {step === 2 && <AssetsStep />}
        {step === 3 && <SpendingStep />}
        {step === 4 && <ResultsStep />}

        <div className="nav">
          {step > 0
            ? <button className="btn-secondary" onClick={() => setStep(s => s - 1)}>← Back</button>
            : <div />}
          {step < 4 && (
            <button className="btn-primary" onClick={() => setStep(s => s + 1)}>
              {step === 3 ? "See Results →" : "Next →"}
            </button>
          )}
          {step === 4 && (
            <button className="btn-secondary" onClick={() => setStep(0)}>← Start Over</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RetirementPlanner() {
  return (
    <PlannerProvider>
      <PlannerWizard />
    </PlannerProvider>
  );
}
