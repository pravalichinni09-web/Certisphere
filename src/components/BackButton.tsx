import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

interface BackButtonProps {
  /** Optional fallback route when there's no history to pop. */
  homePath?: string;
  /** Hide the button on these path suffixes. Default: empty (always show). */
  hideOn?: string[];
}

/**
 * Universal Back button — appears on every screen of every role.
 * Visible on all pages by default (including dashboards) so users can
 * always retreat to the previous view.
 */
const BackButton: React.FC<BackButtonProps> = ({
  homePath,
  hideOn = [],
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hovered, setHovered] = useState<'back' | 'home' | null>(null);

  const path = location.pathname.replace(/\/+$/, '');
  const shouldHide = hideOn.some((suffix) => {
    const s = suffix.replace(/\/+$/, '');
    return path === s || path.endsWith(s);
  });
  if (shouldHide) return null;

  // Detect which role's dashboard to use as the "home" fallback
  const detectHome = (): string => {
    if (homePath) return homePath;
    const segs = path.split('/').filter(Boolean);
    // e.g. /coordinator/audit-scope -> /coordinator/dashboard
    if (segs.length > 0) return '/' + segs[0] + '/dashboard';
    return '/';
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(detectHome());
    }
  };

  const handleHome = () => navigate(detectHome());

  // Don't show Home button if we're already on a dashboard page
  const onDashboard = path.endsWith('/dashboard');

  const baseBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.08)',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
    lineHeight: 1,
    userSelect: 'none',
  };

  const backStyle: React.CSSProperties = {
    ...baseBtn,
    backgroundColor: hovered === 'back' ? '#1e40af' : '#2563eb',
    color: '#ffffff',
    borderColor: hovered === 'back' ? '#1e40af' : '#2563eb',
    transform: hovered === 'back' ? 'translateX(-2px)' : 'translateX(0)',
  };

  const homeStyle: React.CSSProperties = {
    ...baseBtn,
    backgroundColor: hovered === 'home' ? '#f1f5f9' : '#ffffff',
    color: '#334155',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 0 14px 0',
        marginBottom: 6,
        width: '100%',
      }}
    >
      <button
        onClick={handleBack}
        title="Go back to the previous screen"
        aria-label="Go back"
        style={backStyle}
        onMouseEnter={() => setHovered('back')}
        onMouseLeave={() => setHovered(null)}
      >
        <ArrowLeft size={15} strokeWidth={2.5} />
        Back
      </button>
      {!onDashboard && (
        <button
          onClick={handleHome}
          title="Go to dashboard"
          aria-label="Go to dashboard"
          style={homeStyle}
          onMouseEnter={() => setHovered('home')}
          onMouseLeave={() => setHovered(null)}
        >
          <Home size={14} strokeWidth={2.2} />
          Dashboard
        </button>
      )}
    </div>
  );
};

export default BackButton;
