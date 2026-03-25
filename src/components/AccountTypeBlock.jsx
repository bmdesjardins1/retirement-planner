import FieldInput from "./FieldInput";
import Tooltip from "./Tooltip";

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
      {note
        ? (
          <Tooltip text={note}>
            <span className="account-type-heading">{label}</span>
          </Tooltip>
        )
        : <span className="account-type-heading">{label}</span>
      }
      <div className="toggle-group" style={{ marginTop: 8 }}>
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
      <div className={`collapsible${!hasAccount ? ' collapsible--collapsed' : ''}`}>
        <FieldInput
          label="Current Balance"
          value={balance}
          min={0}
          max={max}
          step={step}
          onChange={onBalanceChange}
          prefix="$"
          note={balanceNote}
        />
      </div>
    </div>
  );
}
