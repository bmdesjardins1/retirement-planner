import { useState } from "react";

export default function SliderInput({ label, value, min, max, step, onChange, prefix = "", suffix = "", note }) {
  const [isEditing, setIsEditing] = useState(false);
  const [rawInput, setRawInput] = useState("");

  const startEdit = () => {
    setRawInput(String(value));
    setIsEditing(true);
  };

  const commitEdit = () => {
    const parsed = parseFloat(rawInput);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      const snapped = Math.round(clamped / step) * step;
      onChange(snapped);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter")  commitEdit();
    if (e.key === "Escape") setIsEditing(false);
  };

  return (
    <div className="slider-field">
      <div className="slider-header">
        <label className="slider-label">{label}</label>

        {isEditing ? (
          <input
            type="number"
            className="slider-value-input"
            value={rawInput}
            min={min}
            max={max}
            step={step}
            autoFocus
            onChange={e => setRawInput(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <span
            className="slider-value slider-value--editable"
            onClick={startEdit}
            title="Click to type a value"
          >
            {prefix}{typeof value === "number" ? value.toLocaleString() : value}{suffix}
          </span>
        )}
      </div>

      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="slider-range"
      />

      <div className="slider-bounds">
        <span>{prefix}{min.toLocaleString()}{suffix}</span>
        <span>{prefix}{max.toLocaleString()}{suffix}</span>
      </div>

      {note && <p className="slider-note">{note}</p>}
    </div>
  );
}
