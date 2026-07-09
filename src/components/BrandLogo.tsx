/**
 * BrandLogo — inline SVG of the CertiSphere brand mark.
 * Vector-based so it stays razor-sharp at any size.
 */
import React from 'react';

interface Props {
  variant?: 'full' | 'icon';
  height?: number | string;
  width?: number | string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

const BrandLogo: React.FC<Props> = ({
  variant = 'full', height, width, className, style, title = 'CertiSphere',
}) => {
  const id = React.useId();
  const gold = `g-gold-${id}`;
  const blue = `g-blue-${id}`;
  const shine = `g-shine-${id}`;
  const shadow = `g-shadow-${id}`;

  return (
    <svg
      viewBox={variant === 'icon' ? '0 0 220 220' : '0 0 1100 240'}
      role="img"
      aria-label={title}
      width={width}
      height={height}
      className={className}
      style={{ display: 'block', ...style }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffefb0" />
          <stop offset="18%" stopColor="#fde68a" />
          <stop offset="42%" stopColor="#f5c130" />
          <stop offset="65%" stopColor="#b07a0d" />
          <stop offset="100%" stopColor="#4d3000" />
        </linearGradient>
        <linearGradient id={blue} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d7e9ff" />
          <stop offset="22%" stopColor="#7fb7e6" />
          <stop offset="50%" stopColor="#1f6bbf" />
          <stop offset="78%" stopColor="#082351" />
          <stop offset="100%" stopColor="#01081d" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="38%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id={shadow} x="-10%" y="-10%" width="120%" height="130%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.6" />
          <feOffset dx="2" dy="5" result="off" />
          <feComponentTransfer in="off" result="shd">
            <feFuncA type="linear" slope="0.55" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="shd" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter={`url(#${shadow})`} transform={variant === 'icon' ? 'translate(8 12)' : 'translate(34 32)'}>
        <path d="M96 2 L188 178 L4 178 Z" fill="none" stroke="#190a00" strokeWidth="11" strokeLinejoin="round" />
        <path d="M96 22 L174 168 L18 168 Z" fill="none" stroke={`url(#${gold})`} strokeWidth="12" strokeLinejoin="round" />
        <circle cx="86" cy="118" r="34" fill="none" stroke={`url(#${blue})`} strokeWidth="9" />
        <path d="M110 142 L130 162" fill="none" stroke={`url(#${blue})`} strokeWidth="9" strokeLinecap="round" />
        <path d="M64 116 L82 134 L114 96" fill="none" stroke={`url(#${gold})`} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {variant === 'full' && (
        <g
          filter={`url(#${shadow})`}
          fontFamily="Verdana, Geneva, 'DejaVu Sans', sans-serif"
          fontWeight={900}
          fontStyle="italic"
          fontSize="136"
          letterSpacing="-3"
          paintOrder="stroke"
        >
          <text x="228" y="162" fill={`url(#${blue})`} stroke="#01081d" strokeWidth="6">Certi</text>
          <text x="572" y="162" fill={`url(#${gold})`} stroke="#190a00" strokeWidth="6">Sphere</text>
          <text x="228" y="162" fill={`url(#${shine})`} stroke="none" pointerEvents="none">Certi</text>
          <text x="572" y="162" fill={`url(#${shine})`} stroke="none" pointerEvents="none">Sphere</text>
        </g>
      )}
    </svg>
  );
};

export default BrandLogo;
