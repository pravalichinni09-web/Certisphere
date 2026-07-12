/**
 * WelcomeToast — a colourful, classy welcome notification shown after login,
 * replacing the plain browser alert(). Mounted once at app root so it survives
 * the route change into the dashboard.
 *
 * Trigger from anywhere with: showWelcomeToast("Welcome ...")
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle2, X, Sparkles } from 'lucide-react';

const KEY = 'cms_welcome_toast';

export const showWelcomeToast = (message: string) => {
  try { sessionStorage.setItem(KEY, JSON.stringify({ message, at: Date.now() })); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent('cms-welcome', { detail: message })); } catch { /* ignore */ }
};

const WelcomeToast: React.FC = () => {
  const [msg, setMsg] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let hideTimer: number;
    const show = (m: string) => {
      setMsg(m);
      setLeaving(false);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setLeaving(true), 4200);
    };
    const onEvt = (e: Event) => show(String((e as CustomEvent).detail || ''));
    window.addEventListener('cms-welcome', onEvt);
    // sessionStorage fallback (covers the navigation into the dashboard)
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const { message, at } = JSON.parse(raw);
        sessionStorage.removeItem(KEY);
        if (message && Date.now() - at < 8000) show(message);
      }
    } catch { /* ignore */ }
    return () => { window.removeEventListener('cms-welcome', onEvt); window.clearTimeout(hideTimer); };
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => { setMsg(null); setLeaving(false); }, 420);
    return () => window.clearTimeout(t);
  }, [leaving]);

  if (!msg) return null;

  return (
    <div style={{ position: 'fixed', top: 22, left: 0, right: 0, zIndex: 100000, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        role="status"
        style={{
          pointerEvents: 'auto',
          position: 'relative',
          minWidth: 300, maxWidth: 460,
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 18px 14px 16px',
          borderRadius: 16,
          color: '#fff',
          background: 'linear-gradient(120deg, #1d4ed8 0%, #2563eb 30%, #7c3aed 62%, #d99a16 100%)',
          boxShadow: '0 18px 44px rgba(15,23,42,.35), 0 0 0 1px rgba(255,255,255,.14) inset',
          overflow: 'hidden',
          animation: leaving ? 'cs-wt-out .4s ease forwards' : 'cs-wt-in .5s cubic-bezier(.22,1,.36,1)',
        }}
      >
        {/* shimmer sweep */}
        <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg, transparent 20%, rgba(255,255,255,.28) 50%, transparent 80%)', backgroundSize: '220% 100%', animation: 'cs-wt-shine 2.4s linear infinite', pointerEvents: 'none' }} />
        <span style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.20)', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 0 0 4px rgba(255,255,255,.10)' }}>
          <CheckCircle2 size={22} />
        </span>
        <div style={{ position: 'relative', flex: 1, lineHeight: 1.35 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase', opacity: .92 }}>
            <Sparkles size={12} /> Signed in
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 2 }}>{msg}</div>
        </div>
        <button type="button" onClick={() => setLeaving(true)} aria-label="Dismiss"
          style={{ position: 'relative', background: 'rgba(255,255,255,.18)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <X size={15} />
        </button>
        {/* progress bar */}
        <span style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: '100%', background: 'rgba(255,255,255,.85)', transformOrigin: 'left', animation: leaving ? 'none' : 'cs-wt-bar 4.2s linear forwards' }} />
      </div>

      <style>{`
        @keyframes cs-wt-in { from { opacity:0; transform: translateY(-18px) scale(.96); } to { opacity:1; transform: translateY(0) scale(1); } }
        @keyframes cs-wt-out { to { opacity:0; transform: translateY(-14px) scale(.97); } }
        @keyframes cs-wt-shine { from { background-position: 120% 0; } to { background-position: -120% 0; } }
        @keyframes cs-wt-bar { from { transform: scaleX(1); } to { transform: scaleX(0); } }
      `}</style>
    </div>
  );
};

export default WelcomeToast;
