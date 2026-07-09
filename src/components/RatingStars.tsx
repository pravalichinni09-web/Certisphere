import React from 'react';
import { Star } from 'lucide-react';

interface Props {
  value: number;       // 0..5 (can be fractional)
  size?: number;
  showLabel?: boolean;
}

const RatingStars: React.FC<Props> = ({ value, size = 14, showLabel = true }) => {
  const v = Math.max(0, Math.min(5, value));
  const stars = [1, 2, 3, 4, 5].map((n) => {
    const fill = v >= n ? 1 : Math.max(0, v - (n - 1));
    return (
      <span key={n} style={{ position: 'relative', display: 'inline-block', width: size, height: size }}>
        <Star size={size} color="#cbd5e1" />
        {fill > 0 && (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              overflow: 'hidden',
              width: `${fill * 100}%`,
            }}
          >
            <Star size={size} color="#f59e0b" fill="#f59e0b" />
          </span>
        )}
      </span>
    );
  });
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {stars}
      {showLabel ? <small style={{ color: '#64748b', fontSize: 12 }}>{v.toFixed(1)}</small> : null}
    </span>
  );
};

export default RatingStars;
