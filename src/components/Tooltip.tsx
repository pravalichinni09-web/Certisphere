/**
 * Tooltip — hover-on icon helper.
 * Usage: <Tooltip label="Approve application"><CheckCircle2 size={16} /></Tooltip>
 */
import React, { useState } from 'react';

interface Props {
  label: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<Props> = ({ label, children, side = 'top' }) => {
  const [show, setShow] = useState(false);
  return (
    <span
      className={'cs-tt cs-tt-' + side + (show ? ' is-on' : '')}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && <span className="cs-tt-box">{label}</span>}
    </span>
  );
};

export default Tooltip;
