/**
 * CertiSphereLogo — img-based brand mark that loads
 *   1) /images/certisphere-logo.png   (preferred)
 *   2) /images/CertiSphere%20logo.jpeg (user's uploaded file)
 *   3) /images/certisphere-logo.svg   (recreated SVG fallback)
 *   4) Inline gold triangle + blue check glyph (final fallback)
 *
 * Sized square so it can drop into any FAB / avatar / header.
 */
import React, { useState } from 'react';

interface Props {
  size?: number;
  /** When true, only renders the icon glyph (square crop), not the wordmark. */
  iconOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

type Stage = 'hd' | 'png' | 'jpeg' | 'svg' | 'inline';

const CertiSphereLogo: React.FC<Props> = ({ size = 28, iconOnly = true, className, style }) => {
  const [stage, setStage] = useState<Stage>('hd');

  const srcFor = (s: Stage): string => {
    switch (s) {
      case 'hd':   return '/images/certisphere-logo-hd.png';
      case 'png':  return '/images/certisphere-logo-transparent.png';
      case 'jpeg': return '/images/CertiSphere%20logo.jpeg';
      case 'svg':  return '/images/certisphere-logo.svg';
      default:     return '';
    }
  };

  const next = (s: Stage): Stage => {
    if (s === 'hd')   return 'png';
    if (s === 'png')  return 'jpeg';
    if (s === 'jpeg') return 'svg';
    return 'inline';
  };

  if (stage === 'inline') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-label="CertiSphere" className={className} style={style}>
        <defs>
          <linearGradient id="csl-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#fde68a" />
            <stop offset="55%" stopColor="#f5c130" />
            <stop offset="100%" stopColor="#8b5a00" />
          </linearGradient>
        </defs>
        <path d="M16 3 L29 27 L3 27 Z" fill="none" stroke="url(#csl-g)" strokeWidth="2.6" strokeLinejoin="round" />
        <circle cx="15" cy="17" r="5.2" fill="none" stroke="#1f6bbf" strokeWidth="2" />
        <path d="M12 17 L15 20 L19 14" fill="none" stroke="#f5c130" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (iconOnly) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-block',
          width: size, height: size,
          background: 'transparent',
          borderRadius: 6,
          overflow: 'hidden',
          padding: 0,
          boxSizing: 'border-box',
          ...style,
        }}
      >
        <img
          src={srcFor(stage)}
          alt="CertiSphere"
          onError={() => setStage(next(stage))}
          style={{
            height: '100%',
            width: 'auto',
            display: 'block',
            objectFit: 'cover',
            objectPosition: 'left center',
          }}
        />
      </span>
    );
  }

  return (
    <img
      src={srcFor(stage)}
      alt="CertiSphere"
      className={className}
      onError={() => setStage(next(stage))}
      style={{ height: size, width: 'auto', display: 'block', ...style }}
    />
  );
};

export default CertiSphereLogo;
