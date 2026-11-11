import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import LoginPage from './pages/LoginPage';
import Home from './pages/Home';
import PublicEnquiry from './pages/PublicEnquiry';
import { supabase } from './lib/supabase';
import { isLiveMode, currentLiveProfile, liveSignOut, LiveProfile } from './lib/liveAuth';
import { startCloudSync, stopCloudSync } from './lib/cloudSync';
import { loadStaffDirectory, clearStaffDirectory } from './lib/staffDirectory';
import ResetPassword from './pages/ResetPassword';
import { seedGlobalDemo } from './utils/globalDemoSeeder';
import { seedInboxDemo } from './utils/inboxSeed';
import { seedConnectedDemo, repairFutureDemoDates } from './utils/connectedDemoSeed';

// Demo mode only: fill every screen with sample data. The live site starts
// empty and loads real data from Supabase after sign-in.
if (!isLiveMode()) {
  seedGlobalDemo();
  seedInboxDemo();
  seedConnectedDemo();
  repairFutureDemoDates();
}
import AuditorCoordinatorLayout from './pages/AuditorCoordinator/Layout';
import LeadAuditorLayout from './pages/LeadAuditor/Layout';
import AuditorLayout from './pages/Auditor/Layout';
import AuditClientLayout from './pages/AuditClient/Layout';
import ManagementLayout from './pages/Management/Layout';
import ClientCoordinatorLayout from './pages/ClientCoordinator/Layout';
import AIAssistant from './components/AIAssistant';
import ErrorBoundary from './components/ErrorBoundary';
import WelcomeToast from './components/WelcomeToast';

/* ── Session persistence ──────────────────────────────────────────
   Login state used to live only in React memory, so any page refresh
   (F5 / Ctrl+F5) dropped the user back on /login. We now keep the
   signed-in role in localStorage (expires after SESSION_TTL_MS) and
   restore it on load, so a refresh reopens the same page. */
const SESSION_KEY = 'cms_session_v1';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const VALID_ROLES = ['Management', 'Audit Coordinator', 'Lead Auditor', 'Auditor', 'Auditee', 'Client Coordinator'];

const readSession = (): string => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return '';
    const { role, at } = JSON.parse(raw) as { role?: string; at?: number };
    if (!role || !VALID_ROLES.includes(role)) return '';
    if (!at || Date.now() - at > SESSION_TTL_MS) {
      localStorage.removeItem(SESSION_KEY);
      return '';
    }
    return role;
  } catch {
    return '';
  }
};
const writeSession = (role: string) => {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ role, at: Date.now() })); } catch { /* noop */ }
};
const clearSession = () => {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
};

const LIVE = isLiveMode();

/** Client users see only their own client: point the client screens at it. */
const applyProfileScope = (p: LiveProfile) => {
  try {
    if (p.clientId !== null) {
      localStorage.setItem('cms_active_client_id', String(p.clientId));
      localStorage.setItem('cms_active_org_id', String(p.clientId));
    } else {
      localStorage.removeItem('cms_active_client_id');
    }
  } catch { /* ignore */ }
};

function App() {
  // Demo mode remembers the picked role in this browser; live mode uses the
  // Supabase session and the role stored on the server.
  const [loggedInUser, setLoggedInUser] = useState<string>(() => (LIVE ? '' : readSession()));
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => (LIVE ? false : !!readSession()));
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [booting, setBooting] = useState<boolean>(LIVE);
  const [syncError, setSyncError] = useState<string | null>(null);

  /** Live mode: load the user's data from Supabase, then open their workspace. */
  const enterLive = async (p: LiveProfile) => {
    setBooting(true);
    applyProfileScope(p);
    const res = await startCloudSync();
    setSyncError(res.ok ? null : `Could not load data from the server: ${res.error}`);
    void loadStaffDirectory(p.role);
    setLoggedInUser(p.role);
    setIsLoggedIn(true);
    setBooting(false);
  };

  // Live mode: restore the session on load/refresh and react to sign-out
  // in another tab or an expired session.
  React.useEffect(() => {
    if (!LIVE || !supabase) return;
    let cancelled = false;
    currentLiveProfile().then((p) => {
      if (cancelled) return;
      if (p) void enterLive(p);
      else setBooting(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        void stopCloudSync(); clearStaffDirectory();
        setIsLoggedIn(false);
        setLoggedInUser('');
      }
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = (userRole: string, profile?: LiveProfile) => {
    if (LIVE) {
      if (profile) void enterLive(profile);
      return;
    }
    setIsLoggedIn(true);
    setLoggedInUser(userRole);
    writeSession(userRole);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    if (LIVE) {
      await stopCloudSync(); clearStaffDirectory();   // saves pending changes, then wipes this browser's copy
      await liveSignOut();
    }
    // Clear auth state — the logout splash covers the blank-page flash
    clearSession();
    setIsLoggedIn(false);
    setLoggedInUser('');
    // Keep splash up briefly so the navigate to /login feels instant
    setTimeout(() => setIsLoggingOut(false), 600);
  };

  const getRedirectPath = (role: string) => {
    switch (role) {
      case 'Audit Coordinator':
        return '/auditor-coordinator/dashboard';
      case 'Auditee':
        return '/audit-client/dashboard';
      case 'Lead Auditor':
        return '/lead-auditor/dashboard';
      case 'Client Coordinator':
        return '/client-coordinator/dashboard';
      default:
        return `/${role.toLowerCase().replace(/\s+/g, '-')}/dashboard`;
    }
  };

  if (booting) {
    return (
      <div role="status" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#0f2547', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 42, height: 42, margin: '0 auto 14px', borderRadius: '50%', border: '3px solid rgba(255,255,255,.2)', borderTopColor: '#f6d878', animation: 'cs-boot-spin .8s linear infinite' }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Loading your CertiSphere workspace…</div>
          <style>{'@keyframes cs-boot-spin { to { transform: rotate(360deg); } }'}</style>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <ErrorBoundary>
      {syncError && isLoggedIn && (
        <div role="alert" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99998, background: '#b91c1c', color: '#fff', padding: '8px 16px', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
          {syncError} Changes may not be saved — refresh the page or sign in again.
        </div>
      )}
      {/* ── Logout splash — covers blank-page flash between roles ── */}
      {isLoggingOut && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: '#0f2547',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 20,
          animation: 'cs-lo-in 0.15s ease-out',
        }}>
          <style>{`
            @keyframes cs-lo-in    { from { opacity:0 } to { opacity:1 } }
            @keyframes cs-lo-spin  { to { transform: rotate(360deg) } }
            @keyframes cs-lo-pulse { 0%,100%{transform:scale(1)}50%{transform:scale(0.94)} }
          `}</style>

          {/* Icon + circular spinner wrapper */}
          <div style={{ position: 'relative', width: 108, height: 108 }}>
            {/* Outer spinning arc — gold */}
            <svg
              viewBox="0 0 108 108"
              style={{
                position: 'absolute', inset: 0, width: 108, height: 108,
                animation: 'cs-lo-spin 1.2s linear infinite',
              }}
            >
              <circle cx="54" cy="54" r="50"
                fill="none" stroke="rgba(201,146,42,0.18)" strokeWidth="4" />
              <circle cx="54" cy="54" r="50"
                fill="none" stroke="#c9922a" strokeWidth="4"
                strokeDasharray="80 235" strokeLinecap="round"
                transform="rotate(-90 54 54)" />
            </svg>
            {/* Inner spinning arc — blue, counter-rotate */}
            <svg
              viewBox="0 0 108 108"
              style={{
                position: 'absolute', inset: 6, width: 96, height: 96,
                animation: 'cs-lo-spin 1.8s linear infinite reverse',
              }}
            >
              <circle cx="48" cy="48" r="44"
                fill="none" stroke="#1d4ed8" strokeWidth="3"
                strokeDasharray="55 221" strokeLinecap="round"
                transform="rotate(-90 48 48)" />
            </svg>
            {/* Triangle icon centre */}
            <div style={{
              position: 'absolute', inset: 14,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'cs-lo-pulse 1.8s ease-in-out infinite',
            }}>
              <img
                src="/images/certisphere-icon.png"
                alt="CertiSphere"
                style={{ width: 52, height: 52, objectFit: 'contain' }}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).src = '/images/certisphere-logo-transparent.png';
                }}
              />
            </div>
          </div>

          {/* Label */}
          <span style={{
            color: 'rgba(255,255,255,0.5)', fontSize: 13,
            fontFamily: 'Inter,system-ui,sans-serif',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            Signing out…
          </span>

          {/* QMICS logo bottom */}
          <img
            src="/images/qmics-logo.png"
            alt="QMICS"
            style={{ position: 'absolute', bottom: 28, height: 30, objectFit: 'contain', opacity: 0.35 }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <Routes>
        {/* Public enquiry route — accessible without login */}
        <Route path="/enquiry" element={<PublicEnquiry />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Home → Login (public funnel) */}
        <Route
          path="/"
          element={
            isLoggedIn
              ? <Navigate to={getRedirectPath(loggedInUser)} />
              : <Navigate to="/home" />
          }
        />
        <Route
          path="/home"
          element={isLoggedIn ? <Navigate to={getRedirectPath(loggedInUser)} /> : <Home />}
        />
        <Route
          path="/login"
          element={isLoggedIn ? <Navigate to={getRedirectPath(loggedInUser)} /> : <LoginPage onLogin={handleLogin} />}
        />
        <Route 
          path="/auditor-coordinator/*" 
          element={
            isLoggedIn && loggedInUser === 'Audit Coordinator' ? (
              <AuditorCoordinatorLayout onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        
        <Route 
          path="/auditor/*"
          element={
            isLoggedIn && loggedInUser === 'Auditor' ? (
              <AuditorLayout onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/audit-client/*"
          element={
            isLoggedIn && loggedInUser === 'Auditee' ? (
              <AuditClientLayout onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route 
          path="/lead-auditor/*"
          element={
            isLoggedIn && loggedInUser === 'Lead Auditor' ? (
              <LeadAuditorLayout onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/management/*"
          element={
            isLoggedIn && loggedInUser === 'Management' ? (
              <ManagementLayout onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/client-coordinator/*"
          element={
            isLoggedIn && loggedInUser === 'Client Coordinator' ? (
              <ClientCoordinatorLayout onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
      </ErrorBoundary>
      <AIAssistant role={isLoggedIn ? loggedInUser : 'Guest'} />
      <WelcomeToast />
    </Router>
  );
}

export default App;
