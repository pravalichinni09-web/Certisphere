import React from 'react';
import { useState, useEffect, type FormEvent } from 'react';
import { User, ShieldCheck, Globe, Award, Sparkles, Home } from 'lucide-react';
import '../styles/LoginPage.css';
import '../styles/LoginColors.css';
import '../styles/LoginBlack.css';
import UserCredentials from '../components/UserCredentials';
import LoginForm from '../components/LoginForm';
import DemoAccountModal, { DemoAccount } from '../components/DemoAccountModal';
import { showWelcomeToast } from '../components/WelcomeToast';
import { findCredentialByLogin, ensureCredentialsForClients, readCredentials } from './AuditorCoordinator/utils/clientCredentials';
import { signIn } from '../services/supabase/authService';
import { triggerSync } from '../utils/supabaseSync';
import { isSupabaseEnabled } from '../lib/supabase';
import AuditeeRegistration from '../components/AuditeeRegistration';
import AuditorRegistration from '../components/AuditorRegistration';
import { readGlobalConfig } from '../utils/globalConfig';
import FlagImg from '../components/FlagImg';

interface SelectedUser {
  role: string;
  email: string;
  password: string;
}

interface LoginPageProps { onLogin: (userRole: string) => void; }

/** Map of country name → flag emoji, for reliable cross-platform display. */
const COUNTRY_CODES: Record<string, string> = {
  India: 'IN', USA: 'US', UK: 'GB', Germany: 'DE', France: 'FR',
  UAE: 'AE',   Singapore: 'SG', Australia: 'AU', Brazil: 'BR',
  Japan: 'JP', China: 'CN',  Canada: 'CA',  Mexico: 'MX',
  'South Africa': 'ZA',
};

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showAuditorRegister, setShowAuditorRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [demoRole, setDemoRole] = useState<string | null>(null);

  const ROLE_DEMO: Record<string, { email: string; password: string; name: string }> = {
    'Management':         { email: 'management@cms.com',   password: 'Manage123!@#',    name: 'Morgan Avery' },
    'Audit Coordinator':  { email: 'coordinator@cms.com',  password: 'AuditCoord@123',  name: 'Cora Dinh' },
    'Lead Auditor':       { email: 'lead@cms.com',         password: 'LeadAudit@123',   name: 'Leo Ashford' },
    'Auditor':            { email: 'auditor@cms.com',      password: 'Auditor@123',     name: 'Aaron Diaz' },
    'Auditee':            { email: 'client@cms.com',       password: 'AuditClient@123', name: 'Demo Client' },
    'Client Coordinator': { email: 'coord.client@cms.com', password: 'ClientCoord@123', name: 'Casey Lin' },
  };

  const buildDemoAccounts = (role: string): DemoAccount[] => {
    if (role === 'Auditee') {
      const list: DemoAccount[] = [
        { role: 'Auditee', name: 'Demo Client', org: 'CertiSphere Demo', email: 'client@cms.com', password: 'AuditClient@123' },
      ];
      try {
        readCredentials().forEach((c) => {
          if (!c.password) return;
          list.push({
            role: 'Auditee',
            name: c.contactPerson || c.organizationName,
            org: c.organizationName,
            email: c.email || c.username,
            password: c.password,
            status: c.status,
          });
        });
      } catch { /* ignore */ }
      return list;
    }
    const d = ROLE_DEMO[role];
    return d ? [{ role, name: d.name, email: d.email, password: d.password }] : [];
  };

  // Selecting a role fills the form AND opens the demo-accounts popup.
  const handleRolePick = (user: SelectedUser) => {
    setSelectedUser(user);
    setEmail(user.email);
    setPassword(user.password);
    setDemoRole(user.role);
  };
  const cfg = readGlobalConfig();
  // "Sign in to access …" context carried from Home page cards (TC_CS_1.2)
  const loginIntent = React.useMemo(() => {
    try { return new URLSearchParams(window.location.search).get('intent') || ''; }
    catch { return ''; }
  }, []);

  const handleUserSelect = (user: SelectedUser) => {
    setSelectedUser(user);
    setEmail(user.email);
    setPassword(user.password);
  };

  const handleQuickSignIn = (user: SelectedUser) => {
    setSelectedUser(user);
    setEmail(user.email);
    setPassword(user.password);
    // Auditee role: try a registered client credential first so the
    // demo Auditee link still works for seeded clients.
    if (user.role === 'Auditee') {
      const cred = findCredentialByLogin(user.email, user.password);
      if (cred) {
        try { localStorage.setItem('cms_active_client_id', String(cred.clientId)); } catch { /* ignore */ }
        onLogin('Auditee');
        setTimeout(() => showWelcomeToast(`Welcome ${cred.organizationName}! You have logged in as Auditee.`), 350);
        return;
      }
    }
    onLogin(user.role);
    setTimeout(() => showWelcomeToast(`Welcome ${user.role}! You have successfully logged in.`), 350);
  };

  // Consume a one-click demo tour request from the home page (if any).
  // If sessionStorage has a fresh `cms_pending_demo` flag, sign in as that
  // role immediately and route to the destination path the home page picked.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('cms_pending_demo');
      if (!raw) return;
      const { role, at } = JSON.parse(raw) as { role: string; path: string; at: number };
      sessionStorage.removeItem('cms_pending_demo');
      // Ignore stale entries older than 30 s
      if (!role || Date.now() - (at || 0) > 30000) return;
      // SECURITY (TC_CS_1.1): never auto-sign-in. Pre-fill the role's demo
      // credentials and let the user click Sign In explicitly.
      const demo = ROLE_DEMO[role];
      if (demo) {
        setSelectedUser({ role, email: demo.email, password: demo.password });
        setEmail(demo.email);
        setPassword(demo.password);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

    // Seed Auditee credentials on first load.
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cms_client_registrations');
      if (raw) ensureCredentialsForClients(JSON.parse(raw));
    } catch { /* ignore */ }
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert('Please enter your email/username and password.');
      return;
    }

    // ── Try Supabase auth first (when configured) ──────────────
    // If Supabase returns an error (bad API key, missing user, network, …)
    // we silently fall through to the demo localStorage path so the app
    // remains usable in offline / mis-configured environments.
    if (isSupabaseEnabled()) {
      try {
        const { user, error } = await signIn(email, password);
        if (!error && user) {
          if (user.orgId) {
            try { localStorage.setItem('cms_active_org_id', String(user.orgId)); } catch { /* ignore */ }
          }
          triggerSync(); // migrate demo data → Supabase (no-op after first time)
          onLogin(user.role);
          return;
        }
        if (error) {
          console.warn('[CertiSphere] Supabase auth failed, falling back to demo:', error);
        }
      } catch (err) {
        console.warn('[CertiSphere] Supabase auth threw, falling back to demo:', err);
      }
    }

    // ── Demo / localStorage fallback ───────────────────────────
    const tryClientLogin = () => {
      const cred = findCredentialByLogin(email, password);
      if (cred) {
        try { localStorage.setItem('cms_active_client_id', String(cred.clientId)); } catch { /* ignore */ }
        onLogin('Auditee');
        setTimeout(() => showWelcomeToast(`Welcome ${cred.organizationName}! You have logged in as Auditee.`), 350);
        return true;
      }
      return false;
    };
    if (selectedUser) {
      if (selectedUser.role === 'Auditee' && tryClientLogin()) return;
      if (selectedUser.role === 'Client Coordinator') {
        try {
          const clients = JSON.parse(localStorage.getItem('cms_client_registrations') || '[]');
          const byEmail = clients.find((c: any) =>
            c.email?.toLowerCase() === selectedUser.email.toLowerCase() ||
            c.contactPerson?.toLowerCase().includes(selectedUser.email.split('@')[0].toLowerCase())
          );
          const resolved = byEmail || clients[0];
          if (resolved) localStorage.setItem('cms_active_org_id', String(resolved.id));
        } catch { /* ignore */ }
      }
      onLogin(selectedUser.role);
      setTimeout(() => showWelcomeToast(`Welcome ${selectedUser.role}! You have successfully logged in.`), 350);
      return;
    }
    if (tryClientLogin()) return;
    alert('Invalid credentials. Please select a role or use a registered client account.');
  };

  return (
    <div className="login-container cs-login-shell">
      {/* Decorative floating bubbles (CSS-only) */}
      <div className="cs-bubble-layer" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => <span key={i} className={'cs-bubble cs-bubble-' + (i % 6)} />)}
      </div>

      <a href="/" className="cs-back-home">← Back to home</a>

      {/* ===== Animated background mesh — three drifting orbs ===== */}
      <div className="cs-bg-mesh" aria-hidden="true">
        <span className="cs-orb cs-orb-1" />
        <span className="cs-orb cs-orb-2" />
        <span className="cs-orb cs-orb-3" />
      </div>

      {/* ===== Top country-flag strip ===== */}
      <div className="cs-top-strip" aria-hidden="true">
        <div className="cs-top-strip-inner">
          <Globe size={12} />
          <span className="cs-top-strip-label">Operating worldwide</span>
          <span className="cs-top-strip-flags">
            {cfg.supportedCountries.slice(0, 8).map((c) => (
              <span key={c} className="cs-flag-chip" title={c}>
                <FlagImg code={COUNTRY_CODES[c] || cfg.defaultCountryCode} w={22} rounded title={c} />
                <span className="cs-flag-name">{c}</span>
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* ===== LEFT — compact login form + Test Credentials toggle ===== */}
      <div className="login-section">
        {/* Glass-morphism form card */}
        <div className="cs-glass-card">
          {loginIntent && (
            <div style={{
              marginBottom: 14, padding: '9px 14px', borderRadius: 10,
              background: 'rgba(212,175,55,0.10)', border: '1px solid rgba(212,175,55,0.4)',
              color: '#f6d878', fontSize: 12.5, fontWeight: 600, letterSpacing: 0.4,
            }}>
              Sign in to access: {loginIntent}
            </div>
          )}
          <LoginForm
            selectedUser={selectedUser}
            email={email}
            password={password}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onLogin={handleLogin}
            onPickRole={handleRolePick}
          />
        </div>

        {/* Test Credentials sits directly below the form (per the sketch) */}
        <div className="cs-creds-below">
          <UserCredentials onUserSelect={handleRolePick} selectedUser={selectedUser} onQuickSignIn={handleQuickSignIn} />
        </div>
      </div>

      {demoRole && (
        <DemoAccountModal
          role={demoRole}
          accounts={buildDemoAccounts(demoRole)}
          onUse={(a) => { handleUserSelect({ role: a.role, email: a.email, password: a.password }); setDemoRole(null); }}
          onSignIn={(a) => { setDemoRole(null); handleQuickSignIn({ role: a.role, email: a.email, password: a.password }); }}
          onClose={() => setDemoRole(null)}
        />
      )}

      {/* ===== RIGHT — CertiSphere branding + trust + register links ===== */}
      <div className="credentials-section">
        <div className="logo-section">
          {/* Back to Home */}
          <button type="button" className="cs-home-link" onClick={() => { window.location.href = '/home'; }} title="Go to the CertiSphere home page">
            <Home size={14} /> Home
          </button>
          {/* Logo plate */}
          <div className="cs-logo-plate">
            <a
              href="https://qmicscertifications.com/"
              target="_blank"
              rel="noopener noreferrer"
              title="Visit the CertiSphere website"
              style={{ display: 'inline-flex', textDecoration: 'none', cursor: 'pointer' }}
            >
            <img
              src="/images/certisphere-logo.png"
              alt="CertiSphere"
              className="cs-logo-img"
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                if (!el.src.endsWith('certisphere-logo.jpeg')) {
                  el.src = '/images/certisphere-logo.jpeg';
                }
              }}
            />
            <span className="cs-logo-sheen" aria-hidden="true" />
            </a>
          </div>
          <div className="logo-icon-fallback" style={{ display: 'none' }}>
            <User size={32} />
          </div>


          {/* Trust strip */}
          <div className="cs-trust-strip">
            <span className="cs-trust-pill"><ShieldCheck size={12} /> ISO/IEC 17021-1</span>
            <span className="cs-trust-pill"><Globe size={12} /> {cfg.supportedCountries.length} countries</span>
            <span className="cs-trust-pill"><Award size={12} /> IAF Accredited</span>
            <span className="cs-trust-pill"><Sparkles size={12} /> Live workflow</span>
          </div>

          {/* Secondary action row */}
          <div className="cs-link-row">
            <button type="button" className="cs-link-btn cs-link-primary" onClick={() => setShowRegister(true)}>
              New client? Register here →
            </button>
            <a href="/enquiry" className="cs-link-btn cs-link-info">
              Quick website enquiry →
            </a>
            <button type="button" className="cs-link-btn cs-link-purple" onClick={() => setShowAuditorRegister(true)}>
              Auditor? Join CertMS →
            </button>
          </div>
        </div>
      </div>

      {showRegister && (
        <AuditeeRegistration onClose={() => setShowRegister(false)} />
      )}
      {showAuditorRegister && (
        <AuditorRegistration onClose={() => setShowAuditorRegister(false)} showDocumentUpload={false} />
      )}

      {/* Global product footer */}
      <footer className="cs-global-footer">
        <span>© {new Date().getFullYear()} {cfg.orgName}</span>
        <span className="cs-footer-dot">·</span>
        <a href={cfg.website} target="_blank" rel="noreferrer">{cfg.website.replace(/^https?:\/\//, '')}</a>
        <span className="cs-footer-dot">·</span>
        <a href={`mailto:${cfg.contactEmail}`}>{cfg.contactEmail}</a>
        <span className="cs-footer-dot">·</span>
        <a href={`tel:${cfg.contactPhone.replace(/\s+/g, '')}`}>{cfg.contactPhone}</a>
      </footer>
    </div>
  );
};

export default LoginPage;
