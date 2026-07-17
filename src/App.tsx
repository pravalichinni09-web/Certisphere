import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import LoginPage from './pages/LoginPage';
import Home from './pages/Home';
import PublicEnquiry from './pages/PublicEnquiry';
import { supabase, isSupabaseEnabled } from './lib/supabase';
import { useSupabaseData } from './hooks/useSupabaseData';
import { seedGlobalDemo } from './utils/globalDemoSeeder';
import { seedInboxDemo } from './utils/inboxSeed';
import { seedConnectedDemo } from './utils/connectedDemoSeed';

// Run the global demo seeder once on module load so every CMS surface has
// realistic data on first render.
seedGlobalDemo();
// Ensure every role's inbox shows at least one pending handoff item.
seedInboxDemo();
// Connected cross-role demo data — runs once per browser.
seedConnectedDemo();
import AuditorCoordinatorLayout from './pages/AuditorCoordinator/Layout';
import LeadAuditorLayout from './pages/LeadAuditor/Layout';
import AuditorLayout from './pages/Auditor/Layout';
import AuditClientLayout from './pages/AuditClient/Layout';
import ManagementLayout from './pages/Management/Layout';
import ClientCoordinatorLayout from './pages/ClientCoordinator/Layout';
import AIAssistant from './components/AIAssistant';
import ErrorBoundary from './components/ErrorBoundary';
import WelcomeToast from './components/WelcomeToast';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<string>('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Load Supabase DB data into localStorage whenever user logs in
  useSupabaseData(isLoggedIn);

  // Restore Supabase session on page reload
  React.useEffect(() => {
    if (!isSupabaseEnabled()) return;

    // Restore existing session immediately
    supabase!.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await (supabase as any)
          .from('users')
          .select('role, org_id')
          .eq('id', session.user.id)
          .single();
        if (profile?.role) {
          if (profile.org_id) {
            try { localStorage.setItem('cms_active_org_id', String(profile.org_id)); } catch { /* noop */ }
          }
          setIsLoggedIn(true);
          setLoggedInUser(profile.role);
        }
      }
    });

    // Listen for auth changes (sign in / sign out in other tabs)
    const { data: { subscription } } = supabase!.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setIsLoggedIn(false);
        setLoggedInUser('');
        return;
      }
      if (event === 'SIGNED_IN' && session.user) {
        const { data: profile } = await (supabase as any)
          .from('users')
          .select('role, org_id')
          .eq('id', session.user.id)
          .single();
        if (profile?.role) {
          if (profile.org_id) {
            try { localStorage.setItem('cms_active_org_id', String(profile.org_id)); } catch { /* noop */ }
          }
          setIsLoggedIn(true);
          setLoggedInUser(profile.role);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = (userRole: string) => {
    setIsLoggedIn(true);
    setLoggedInUser(userRole);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    if (isSupabaseEnabled()) {
      await supabase!.auth.signOut();
    }
    // Clear auth state — the logout splash covers the blank-page flash
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

  return (
    <Router>
      <ErrorBoundary>
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
