import React from 'react';

interface QmicsLogoProps {
  size?: number;
  className?: string;
  /** When true, render in a single-color (white) variant for use over gradients */
  inverted?: boolean;
}

/**
 * Qmics brand logo — yellow rounded triangle wrapping a blue Q circle with a
 * yellow checkmark inside.
 */
const QmicsLogo: React.FC<QmicsLogoProps> = ({ size = 28, className, inverted = false }) => {
  const triangleStroke = inverted ? '#ffffff' : '#f5b400';
  const ringStroke = inverted ? '#ffffff' : '#1577ad';
  const checkStroke = inverted ? '#ffd564' : '#f5b400';

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Qmics"
    >
      {/* Outer rounded triangle */}
      <path
        d="M60 10 L108 92 L12 92 Z"
        fill="none"
        stroke={triangleStroke}
        strokeWidth={6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Q ring */}
      <circle
        cx="60"
        cy="58"
        r="28"
        fill="none"
        stroke={ringStroke}
        strokeWidth={8}
      />
      {/* Q tail */}
      <line
        x1="78"
        y1="76"
        x2="90"
        y2="88"
        stroke={ringStroke}
        strokeWidth={8}
        strokeLinecap="round"
      />
      {/* Yellow check mark inside the Q */}
      <path
        d="M46 58 L57 70 L76 48"
        fill="none"
        stroke={checkStroke}
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default QmicsLogo;
