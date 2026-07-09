import React, { useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { loadProfile, CoordinatorProfile } from '../pages/AuditorCoordinator/Profile';
import '../styles/CoordinatorGreeting.css';

const SESSION_KEY = 'coordinatorGreetingShown';

const getTimeGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
};

const firstName = (name: string): string => {
  if (!name) return 'there';
  return name.split(' ')[0];
};

const CoordinatorGreeting: React.FC = () => {
  const [profile, setProfile] = useState<CoordinatorProfile>(() => loadProfile());
  const [visible, setVisible] = useState<boolean>(() => {
    return sessionStorage.getItem(SESSION_KEY) !== 'true';
  });
  const [leaving, setLeaving] = useState(false);

  // Listen for profile updates so the greeting reflects a renamed user
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CoordinatorProfile>).detail;
      if (detail) setProfile(detail);
    };
    window.addEventListener('coordinator-profile-updated', handler);
    return () => window.removeEventListener('coordinator-profile-updated', handler);
  }, []);

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => close(), 6000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const close = () => {
    setLeaving(true);
    window.setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem(SESSION_KEY, 'true');
    }, 250);
  };

  if (!visible) return null;

  const initials = (profile.name || 'AC')
    .split(' ')
    .map((s) => s.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`greeting-overlay ${leaving ? 'leaving' : ''}`} onClick={close}>
      <div
        className={`greeting-card ${leaving ? 'leaving' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Welcome"
      >
        <button className="greeting-close" onClick={close} aria-label="Dismiss">
          <X size={16} />
        </button>

        <div className="greeting-avatar">
          {profile.photo ? (
            <img src={profile.photo} alt={profile.name} />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="greeting-sparkle">
          <Sparkles size={14} /> <span>{getTimeGreeting()}</span>
        </div>

        <h2 className="greeting-title">
          Welcome back, <span className="greeting-name">{firstName(profile.name)}</span>!
        </h2>
        <p className="greeting-sub">
          You're signed in as the <strong>Audit Coordinator</strong>. Wishing you a productive day.
        </p>

        <button className="greeting-cta" onClick={close}>
          Let's get started
        </button>
      </div>
    </div>
  );
};

export default CoordinatorGreeting;
