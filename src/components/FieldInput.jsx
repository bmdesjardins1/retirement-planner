import { useState, useEffect } from "react";
import Tooltip from "./Tooltip";

export default function FieldInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  prefix = "",
  suffix = "",
  note,
  tooltip,
}) {
  const [rawInput, setRawInput] = useState(String(value));

  // Sync with external value changes (constrained setters, parent state updates)
  useEffect(() => {
    setRawInput(String(value));
  }, [value]);

  const commit = (raw) => {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      const snapped = Math.round(clamped / step) * step;
      onChange(snapped);
      setRawInput(String(snapped));
    } else {
      setRawInput(String(value)); // revert on invalid input
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter")  e.target.blur();
    if (e.key === "Escape") { setRawInput(String(value)); e.target.blur(); }
  };

  return (
    <div className="field-input">
      <div className="slider-header">
        {tooltip
          ? <Tooltip text={tooltip}><label className="field-label">{label}</label></Tooltip>
          : <label className="field-label">{label}</label>
        }
        <span className="field-value-row">
          {prefix && <span className="slider-value">{prefix}</span>}
          <input
            type="number"
            className="slider-value-input"
            value={rawInput}
            min={min}
            max={max}
            step={step}
            onChange={e => setRawInput(e.target.value)}
            onBlur={e => commit(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {suffix && <span className="slider-value">{suffix}</span>}
        </span>
      </div>
      {note && <p className="field-note">{note}</p>}
    </div>
  );
}
