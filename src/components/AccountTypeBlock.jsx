import SliderInput from "./SliderInput";

export default function AccountTypeBlock({
  label,
  note,
  hasAccount,
  onToggle,
  balance,
  onBalanceChange,
  max,
  step,
  balanceNote = null,
}) {
  return (
    <div className="mb-20">
      <label className="field-label">{label}</label>
      <p className="field-note">{note}</p>
      <div className="toggle-group">
        <button
          className={`toggle${hasAccount ? ' toggle--active' : ''}`}
          onClick={() => onToggle(true)}
        >
          I have this
        </button>
        <button
          className={`toggle${!hasAccount ? ' toggle--active' : ''}`}
          onClick={() => onToggle(false)}
        >
          I don't
        </button>
      </div>
      {hasAccount && (
        <SliderInput
          label="Current Balance"
          value={balance}
          min={0}
          max={max}
          step={step}
          onChange={onBalanceChange}
          prefix="$"
          note={balanceNote}
        />
      )}
    </div>
  );
}
