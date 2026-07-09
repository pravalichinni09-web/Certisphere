/**
 * FlagImg — inline SVG country flags.
 *
 * Renders a stylised but recognisable SVG flag for each supported country
 * directly inside the document. No external network dependency, so the
 * flag always renders regardless of CDN blocks or font support.
 *
 * Usage:
 *   <FlagImg code="IN" />            // 24×18
 *   <FlagImg code="US" w={32} />
 *   <FlagImg code="GB" rounded />
 */
import React from 'react';

interface FlagImgProps {
  code: string;
  w?: number;
  rounded?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

/** Each entry returns the inner SVG nodes for a 60×40 viewBox flag. */
const FLAGS: Record<string, React.ReactNode> = {
  /* India — saffron / white / green + navy chakra */
  IN: (
    <>
      <rect width="60" height="14" y="0" fill="#FF9933" />
      <rect width="60" height="13" y="13" fill="#FFFFFF" />
      <rect width="60" height="14" y="26" fill="#138808" />
      <circle cx="30" cy="20" r="4" fill="none" stroke="#000080" strokeWidth="0.8" />
    </>
  ),
  /* USA — 13 stripes + blue canton with star pattern */
  US: (
    <>
      {Array.from({ length: 13 }).map((_, i) => (
        <rect key={i} x="0" y={i * (40 / 13)} width="60" height={40 / 13} fill={i % 2 === 0 ? '#B22234' : '#FFFFFF'} />
      ))}
      <rect x="0" y="0" width="24" height={40 * (7 / 13)} fill="#3C3B6E" />
      {Array.from({ length: 24 }).map((_, i) => {
        const col = i % 6, row = Math.floor(i / 6);
        return <circle key={i} cx={2 + col * 4} cy={2 + row * 4} r="0.8" fill="#FFFFFF" />;
      })}
    </>
  ),
  /* UK — Union Jack (simplified) */
  GB: (
    <>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#FFFFFF" strokeWidth="6" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="2" />
      <path d="M30,0 L30,40 M0,20 L60,20" stroke="#FFFFFF" strokeWidth="10" />
      <path d="M30,0 L30,40 M0,20 L60,20" stroke="#C8102E" strokeWidth="6" />
    </>
  ),
  /* Germany — black / red / yellow */
  DE: (
    <>
      <rect width="60" height="14" y="0" fill="#000000" />
      <rect width="60" height="13" y="13" fill="#DD0000" />
      <rect width="60" height="14" y="26" fill="#FFCE00" />
    </>
  ),
  /* France — blue / white / red vertical */
  FR: (
    <>
      <rect width="20" height="40" x="0" fill="#0055A4" />
      <rect width="20" height="40" x="20" fill="#FFFFFF" />
      <rect width="20" height="40" x="40" fill="#EF4135" />
    </>
  ),
  /* UAE — green/white/black horizontals + red hoist */
  AE: (
    <>
      <rect width="60" height="40" fill="#FFFFFF" />
      <rect width="60" height="13" y="0" fill="#00732F" />
      <rect width="60" height="14" y="26" fill="#000000" />
      <rect width="15" height="40" x="0" fill="#FF0000" />
    </>
  ),
  /* Singapore — red top, white bottom, crescent + 5 stars */
  SG: (
    <>
      <rect width="60" height="20" y="0" fill="#EF3340" />
      <rect width="60" height="20" y="20" fill="#FFFFFF" />
      <circle cx="14" cy="10" r="6" fill="#FFFFFF" />
      <circle cx="16.5" cy="10" r="5" fill="#EF3340" />
      {[[22,5],[27,9],[27,13],[22,17],[18,13],[18,9]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="0.7" fill="#FFFFFF" />
      ))}
    </>
  ),
  /* Australia — blue field with simplified Union Jack canton */
  AU: (
    <>
      <rect width="60" height="40" fill="#00247D" />
      {/* Canton (Union Jack simplified) */}
      <rect x="0" y="0" width="30" height="20" fill="#00247D" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#FFFFFF" strokeWidth="3" />
      <path d="M15,0 L15,20 M0,10 L30,10" stroke="#FFFFFF" strokeWidth="5" />
      <path d="M15,0 L15,20 M0,10 L30,10" stroke="#C8102E" strokeWidth="3" />
      {/* Southern Cross */}
      <circle cx="44" cy="14" r="1.5" fill="#FFFFFF" />
      <circle cx="50" cy="22" r="1.5" fill="#FFFFFF" />
      <circle cx="42" cy="28" r="1.2" fill="#FFFFFF" />
      <circle cx="52" cy="30" r="1" fill="#FFFFFF" />
      <circle cx="45" cy="34" r="0.9" fill="#FFFFFF" />
      {/* Commonwealth star under canton */}
      <circle cx="15" cy="30" r="2.4" fill="#FFFFFF" />
    </>
  ),
  /* Brazil — green field + yellow diamond + blue circle */
  BR: (
    <>
      <rect width="60" height="40" fill="#009C3B" />
      <polygon points="30,5 55,20 30,35 5,20" fill="#FFDF00" />
      <circle cx="30" cy="20" r="7" fill="#002776" />
    </>
  ),
  /* Japan — white field + red circle */
  JP: (
    <>
      <rect width="60" height="40" fill="#FFFFFF" />
      <circle cx="30" cy="20" r="8" fill="#BC002D" />
    </>
  ),
  /* China — red field + 5 yellow stars (simplified) */
  CN: (
    <>
      <rect width="60" height="40" fill="#DE2910" />
      <circle cx="12" cy="10" r="3" fill="#FFDE00" />
      <circle cx="22" cy="6" r="1" fill="#FFDE00" />
      <circle cx="26" cy="10" r="1" fill="#FFDE00" />
      <circle cx="26" cy="16" r="1" fill="#FFDE00" />
      <circle cx="22" cy="20" r="1" fill="#FFDE00" />
    </>
  ),
  /* Canada — red/white/red + maple leaf (simplified diamond) */
  CA: (
    <>
      <rect width="15" height="40" x="0" fill="#FF0000" />
      <rect width="30" height="40" x="15" fill="#FFFFFF" />
      <rect width="15" height="40" x="45" fill="#FF0000" />
      <polygon points="30,10 33,17 38,17 34,22 36,28 30,25 24,28 26,22 22,17 27,17" fill="#FF0000" />
    </>
  ),
  /* Mexico — green/white/red vertical */
  MX: (
    <>
      <rect width="20" height="40" x="0" fill="#006847" />
      <rect width="20" height="40" x="20" fill="#FFFFFF" />
      <rect width="20" height="40" x="40" fill="#CE1126" />
      <circle cx="30" cy="20" r="3" fill="none" stroke="#8B4513" strokeWidth="0.7" />
    </>
  ),
  /* South Africa — Y-shape design (simplified) */
  ZA: (
    <>
      <rect width="60" height="20" y="0" fill="#E03C31" />
      <rect width="60" height="20" y="20" fill="#001489" />
      <polygon points="0,0 25,20 0,40" fill="#000000" />
      <polygon points="0,4 22,20 0,36" fill="#FFB81C" />
      <polygon points="0,8 18,20 0,32" fill="#007749" />
    </>
  ),
};

const FlagImg: React.FC<FlagImgProps> = ({ code, w = 24, rounded, className, style, title }) => {
  const cc = (code || '').toUpperCase();
  if (cc.length !== 2) return null;
  const h = Math.round(w * (40 / 60));
  const flag = FLAGS[cc];
  return (
    <span
      className={className}
      title={title || cc}
      style={{
        display: 'inline-block',
        width: w,
        height: h,
        verticalAlign: 'middle',
        borderRadius: rounded ? 3 : 0,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.35)',
        background: '#475569',
        ...style,
      }}
    >
      <svg viewBox="0 0 60 40" width="100%" height="100%" preserveAspectRatio="none" aria-label={title || cc}>
        {flag ?? (
          <>
            <rect width="60" height="40" fill="#475569" />
            <text x="30" y="26" textAnchor="middle" fontFamily="Arial" fontSize="20" fill="#FFFFFF" fontWeight="bold">{cc}</text>
          </>
        )}
      </svg>
    </span>
  );
};

export default FlagImg;
