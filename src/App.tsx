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

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<string>('');

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
    if (isSupabaseEnabled()) {
      await supabase!.auth.signOut();
    }
    setIsLoggedIn(false);
    setLoggedInUser('');
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
      <AIAssistant role={isLoggedIn ? loggedInUser : 'Guest'} />
    </Router>
  );
}

export default App;
