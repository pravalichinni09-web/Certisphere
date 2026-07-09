/**
 * CertBgParticles
 * Floating background animation: certification docs, ISO seals,
 * firm buildings, client icons drifting slowly behind the home page.
 */

import React, { useMemo } from 'react';
import '../styles/HomeCertBg.css';

/* ── SVG icon shapes ── */
const IconDoc = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/>
    <line x1="8" y1="17" x2="16" y2="17"/>
    <line x1="8" y1="9"  x2="10" y2="9"/>
  </svg>
);

const IconCert = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="6"/>
    <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
  </svg>
);

const IconShield = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);

const IconBuilding = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="1"/>
    <path d="M3 9h18M9 21V9M15 21V9"/>
    <rect x="6"  y="6"  width="2" height="2"/>
    <rect x="10" y="6"  width="2" height="2"/>
    <rect x="14" y="6"  width="2" height="2"/>
    <rect x="6"  y="13" width="2" height="2"/>
    <rect x="14" y="13" width="2" height="2"/>
  </svg>
);

const IconUser = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconCheck = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const IconSeal = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="3"  x2="12" y2="7"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
    <line x1="3"  y1="12" x2="7"  y2="12"/>
    <line x1="17" y1="12" x2="21" y2="12"/>
  </svg>
);

const IconClip = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1"/>
    <line x1="8"  y1="12" x2="16" y2="12"/>
    <line x1="8"  y1="16" x2="12" y2="16"/>
  </svg>
);

const IconGlobe = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

type IconType = 'doc' | 'cert' | 'shield' | 'building' | 'user' | 'check' | 'seal' | 'clip' | 'globe';
type ColourType = 'cp-gold' | 'cp-blue' | 'cp-cyan' | 'cp-white' | 'cp-green' | 'cp-orange';
type SizeType = 'sz-sm' | 'sz-md' | 'sz-lg' | 'sz-xl';

const ICONS: IconType[] = ['doc','cert','shield','building','user','check','seal','clip','globe','doc','cert','shield','building','user','check','seal','clip'];
const COLOURS: ColourType[] = ['cp-gold','cp-gold','cp-cyan','cp-blue','cp-white','cp-green','cp-orange','cp-gold','cp-cyan'];
const SIZES: SizeType[] = ['sz-sm','sz-md','sz-md','sz-md','sz-lg','sz-lg','sz-xl'];

function seeded(seed: number, min: number, max: number) {
  const x = Math.sin(seed + 1) * 10000;
  return min + (x - Math.floor(x)) * (max - min);
}

const PARTICLE_COUNT = 42;

interface Particle {
  id: number;
  icon: IconType;
  colour: ColourType;
  size: SizeType;
  left: number;       // % from left
  bottom: number;     // % start position (negative = below viewport)
  duration: number;   // animation duration seconds
  delay: number;      // animation delay seconds
  rotation: number;   // max rotation degrees
  sway: number;       // px left-right drift
  swayDur: number;    // sway duration
  opacity: number;    // particle opacity
}

const CertBgParticles: React.FC = () => {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      icon:     ICONS[Math.floor(seeded(i * 3.1, 0, ICONS.length))],
      colour:   COLOURS[Math.floor(seeded(i * 7.3, 0, COLOURS.length))],
      size:     SIZES[Math.floor(seeded(i * 2.7, 0, SIZES.length))],
      left:     seeded(i * 5.9, 2, 97),
      bottom:   seeded(i * 4.1, -20, -5),
      duration: seeded(i * 6.3, 18, 45),
      delay:    seeded(i * 8.7, 0, 35),
      rotation: seeded(i * 3.5, -180, 180),
      sway:     seeded(i * 9.1, 20, 80) * (i % 2 === 0 ? 1 : -1),
      swayDur:  seeded(i * 2.3, 6, 14),
      opacity:  seeded(i * 1.7, 0.45, 0.80),
    }));
  }, []);

  const renderIcon = (type: IconType, size: SizeType) => {
    const px = size === 'sz-sm' ? 18 : size === 'sz-md' ? 28 : size === 'sz-lg' ? 40 : 54;
    switch (type) {
      case 'doc':      return <IconDoc size={px} />;
      case 'cert':     return <IconCert size={px} />;
      case 'shield':   return <IconShield size={px} />;
      case 'building': return <IconBuilding size={px} />;
      case 'user':     return <IconUser size={px} />;
      case 'check':    return <IconCheck size={px} />;
      case 'seal':     return <IconSeal size={px} />;
      case 'clip':     return <IconClip size={px} />;
      case 'globe':    return <IconGlobe size={px} />;
    }
  };

  return (
    <div className="cs-cert-bg" aria-hidden="true">
      {particles.map(p => (
        <div
          key={p.id}
          className={`cs-cert-particle ${p.size}`}
          style={{
            left: `${p.left}%`,
            bottom: `${p.bottom}%`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            '--p-opacity': p.opacity,
            '--p-rot': `${p.rotation}deg`,
            '--p-sway': `${p.sway}px`,
            '--p-sway-dur': `${p.swayDur}s`,
            '--p-pulse-dur': `${Math.round(seeded(p.id * 11.3, 2.5, 5.5) * 10) / 10}s`,
          } as React.CSSProperties}
        >
          <div className={`cp-icon ${p.colour}`}>
            {renderIcon(p.icon, p.size)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CertBgParticles;
