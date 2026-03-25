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
        <h1 className="app-headline">Retirement Planner</h1>
        <nav className="stepper">
          {STEPS.flatMap((s, i) => {
            const isDone   = step > i;
            const isActive = step === i;
            const items = [
              <div key={`step-${i}`} className="stepper-item">
                <button
                  className={`stepper-circle${isActive ? ' stepper-circle--active' : isDone ? ' stepper-circle--done' : ''}`}
                  onClick={() => isDone && setStep(i)}
                >
                  {isDone ? '✓' : i + 1}
                </button>
                <span className={`stepper-label${isActive ? ' stepper-label--active' : isDone ? ' stepper-label--done' : ''}`}>
                  {s}
                </span>
              </div>,
            ];
            if (i < STEPS.length - 1) {
              items.push(
                <div key={`conn-${i}`} className={`stepper-connector${isDone ? ' stepper-connector--done' : ''}`} />
              );
            }
            return items;
          })}
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
