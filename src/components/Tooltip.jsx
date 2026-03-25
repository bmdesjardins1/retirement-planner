import { useState } from "react";

export default function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="tooltip-anchor">
      {children}
      <span
        className="tooltip-icon"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        ⓘ
      </span>
      {visible && <span className="tooltip-popover">{text}</span>}
    </span>
  );
}
