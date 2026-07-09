/**
 * QcsaiMark — transparent brand symbol for the QCSAI assistant.
 * A stylised "Q" (chat ring + send tail) with an AI spark inside.
 * Uses currentColor so it adapts to any background; no solid fill.
 */
import React from 'react';

interface Props { size?: number; className?: string; style?: React.CSSProperties; }

const QcsaiMark: React.FC<Props> = ({ size = 24, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none"
    className={className} style={{ display: 'block', ...style }} aria-hidden="true">
    {/* chat ring (the Q body) */}
    <circle cx="21" cy="21" r="13.5" stroke="currentColor" strokeWidth="3.1" fill="none" opacity="0.95" />
    {/* send / Q-tail */}
    <path d="M30.5 30.5 L39 39" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    {/* AI spark */}
    <path d="M21 12.4 l1.7 4.0 4.0 1.7 -4.0 1.7 -1.7 4.0 -1.7 -4.0 -4.0 -1.7 4.0 -1.7 Z"
      fill="currentColor" />
    {/* small twinkle */}
    <circle cx="32" cy="14" r="1.7" fill="currentColor" opacity="0.85" />
  </svg>
);

export default QcsaiMark;
