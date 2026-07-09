import React from 'react';
import '../styles/Skeleton.css';

export interface SkeletonProps {
  /** Block shape — text line, rounded chip, circle, or generic block. */
  variant?: 'text' | 'rect' | 'circle' | 'pill';
  /** Width — number = px, string = any CSS value. */
  width?: number | string;
  /** Height — number = px, string = any CSS value. */
  height?: number | string;
  /** Round corners override. */
  radius?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

const toCss = (val?: number | string) =>
  typeof val === 'number' ? `${val}px` : val;

const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rect',
  width,
  height,
  radius,
  className = '',
  style,
}) => {
  const computedStyle: React.CSSProperties = {
    width: toCss(width),
    height: toCss(height),
    borderRadius:
      radius !== undefined
        ? toCss(radius)
        : variant === 'circle'
        ? '50%'
        : variant === 'pill'
        ? '999px'
        : variant === 'text'
        ? '6px'
        : '10px',
    ...style,
  };
  return (
    <span
      aria-hidden="true"
      className={`cms-skeleton cms-skeleton--${variant} ${className}`.trim()}
      style={computedStyle}
    />
  );
};

/** Composite skeleton for a typical card layout. */
export const SkeletonCard: React.FC<{ rows?: number; className?: string }> = ({
  rows = 3,
  className = '',
}) => (
  <div className={`cms-skeleton-card ${className}`.trim()}>
    <Skeleton variant="rect" width="100%" height={18} />
    {Array.from({ length: rows }).map((_, idx) => (
      <Skeleton
        key={idx}
        variant="text"
        width={idx === rows - 1 ? '60%' : '100%'}
        height={12}
      />
    ))}
  </div>
);

/** Composite skeleton for a typical table row. */
export const SkeletonRow: React.FC<{ columns?: number }> = ({ columns = 4 }) => (
  <div className="cms-skeleton-row">
    {Array.from({ length: columns }).map((_, idx) => (
      <Skeleton
        key={idx}
        variant="text"
        width={idx === 0 ? '32%' : `${Math.floor(60 / Math.max(1, columns - 1))}%`}
        height={14}
      />
    ))}
  </div>
);

export default Skeleton;
