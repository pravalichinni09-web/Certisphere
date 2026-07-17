/**
 * QcsaiMark — animated AI-agent avatar for the QCSAI assistant.
 * A friendly robot-agent head: blinking eyes, pulsing antenna, subtle bob,
 * and a scanning visor sweep. Pure SVG + CSS (classes animated in
 * AIAssistant.css) — inherits `currentColor` so it adapts to any surface.
 */
import React from 'react';

interface Props { size?: number; className?: string; style?: React.CSSProperties; }

const QcsaiMark: React.FC<Props> = ({ size = 24, className, style }) => (
  <svg
    width={size} height={size} viewBox="0 0 48 48" fill="none"
    className={'qcsai-agent ' + (className || '')}
    style={{ display: 'block', overflow: 'visible', ...style }}
    aria-hidden="true"
  >
    <g className="qcsai-agent-head">
      {/* Antenna */}
      <line x1="24" y1="7" x2="24" y2="12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle className="qcsai-antenna-dot" cx="24" cy="5.2" r="2.6" fill="currentColor" />

      {/* Head */}
      <rect x="8" y="12" width="32" height="26" rx="9" stroke="currentColor" strokeWidth="2.6" fill="none" />

      {/* Visor scan line */}
      <rect className="qcsai-visor" x="11.5" y="19" width="6" height="12" rx="3" fill="currentColor" opacity="0.14" />

      {/* Eyes (blink) */}
      <g className="qcsai-eyes">
        <circle className="qcsai-eye" cx="17.5" cy="24.5" r="3.1" fill="currentColor" />
        <circle className="qcsai-eye" cx="30.5" cy="24.5" r="3.1" fill="currentColor" />
      </g>

      {/* Smile */}
      <path d="M18 31.5 Q24 35.5 30 31.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />

      {/* Ears / side nodes */}
      <rect x="4" y="21" width="4" height="8" rx="2" fill="currentColor" opacity="0.85" />
      <rect x="40" y="21" width="4" height="8" rx="2" fill="currentColor" opacity="0.85" />

      {/* AI spark by the head */}
      <path className="qcsai-spark" d="M41.5 10.5 l1.1 2.5 2.5 1.1 -2.5 1.1 -1.1 2.5 -1.1 -2.5 -2.5 -1.1 2.5 -1.1 Z" fill="currentColor" />
    </g>
  </svg>
);

export default QcsaiMark;
