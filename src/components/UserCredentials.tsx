import React, { useState } from 'react';
import {
  KeyRound, ChevronDown, Eye, EyeOff,
  Shield, Users, ClipboardCheck, Briefcase, Building2, ArrowRight,
} from 'lucide-react';
import '../styles/UserCredentials.css';

interface User {
  role: string;
  email: string;
  password: string;
  description?: string;
}

interface UserCredentialsProps {
  onUserSelect: (user: User) => void;
  selectedUser: User | null;
  /** Optional — if provided, clicking a role card signs in immediately. */
  onQuickSignIn?: (user: User) => void;
}

const ROLE_ICONS: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  Management:        { icon: <Shield size={14} />,         color: '#d4af37', bg: 'rgba(212,175,55,0.12)' },
  'Audit Coordinator':{ icon: <Users size={14} />,         color: '#d4af37', bg: 'rgba(212,175,55,0.12)' },
  'Client Coordinator':{ icon: <Users size={14} />,         color: '#d4af37', bg: 'rgba(212,175,55,0.12)' },
  'Lead Auditor':    { icon: <ClipboardCheck size={14} />, color: '#d4af37', bg: 'rgba(212,175,55,0.12)' },
  Auditor:           { icon: <Briefcase size={14} />,      color: '#d4af37', bg: 'rgba(212,175,55,0.12)' },
  Auditee:           { icon: <Building2 size={14} />,      color: '#d4af37', bg: 'rgba(212,175,55,0.12)' },
};

const UserCredentials: React.FC<UserCredentialsProps> = ({ onUserSelect, selectedUser }) => {
  // Demo creds collapsed by default — user clicks the toggle to reveal them.
  const [open, setOpen] = useState(false);

  const users: User[] = [
    { role: 'Management',        email: 'management@cms.com',  password: 'Manage123!@#',     description: 'Administrative management role' },
    { role: 'Audit Coordinator', email: 'coordinator@cms.com', password: 'AuditCoord@123',   description: 'Coordinates audit activities' },
    { role: 'Lead Auditor',      email: 'lead@cms.com',        password: 'LeadAudit@123',    description: 'Leads audit teams' },
    { role: 'Auditor',           email: 'auditor@cms.com',     password: 'Auditor@123',      description: 'Conducts audits' },
    { role: 'Auditee',           email: 'client@cms.com',      password: 'AuditClient@123',  description: 'Client login — registered clients use credentials issued by Management' },
    { role: 'Client Coordinator', email: 'coord.client@cms.com', password: 'ClientCoord@123', description: 'Client-side coordinator for an organisation' },
  ];

  // Clicking a role fills the login form with that role's credentials (clear + predictable).
  const onCardClick = (user: User) => {
    onUserSelect(user);
  };

  return (
    <div className="credentials-container">
      <div className="credentials-header">
        <h2>Test Credentials</h2>
        <p>Click on any role to populate login form</p>
      </div>

      {/* Toggle — hidden by default; reveals roles with smooth animation */}
      <button
        type="button"
        className={'cs-creds-toggle' + (open ? ' is-open' : '')}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="cs-demo-creds-panel"
      >
        <span className="cs-creds-toggle-left">
          {open ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>{open ? 'Hide Demo Login Credentials' : 'Show Demo Login Credentials'}</span>
        </span>
        <span className="cs-creds-toggle-right">
          <KeyRound size={14} />
          <ChevronDown size={14} className="cs-creds-toggle-chevron" />
        </span>
      </button>

      {/* Collapsible panel — role NAME only; click to instant-sign-in */}
      <div
        id="cs-demo-creds-panel"
        className={'cs-creds-collapse' + (open ? ' is-open' : '')}
        aria-hidden={!open}
      >
        <div className="cs-creds-collapse-inner">
          <div className="credentials-list cs-roles-only">
            {users.map((user, i) => {
              const meta = ROLE_ICONS[user.role];
              return (
                <button
                  type="button"
                  key={user.role}
                  className={`credential-card cs-role-card cs-creds-card-anim ${selectedUser?.role === user.role ? 'selected' : ''}`}
                  onClick={() => onCardClick(user)}
                  style={{ animationDelay: open ? `${i * 70}ms` : '0ms' }}
                  title={`Use ${user.role} credentials`}
                >
                  <span className="cs-role-card-icon" style={{ background: meta?.bg, color: meta?.color }}>
                    {meta?.icon}
                  </span>
                  <span className="cs-role-card-text">
                    <span className="cs-role-card-name">{user.role}</span>
                    <span className="cs-role-card-desc">{user.description}</span>
                  </span>
                  <span className="cs-role-card-cta">
                    Use <ArrowRight size={13} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="info-box">
            <p>
              <strong>Note:</strong> Demo credentials for testing only. Registered clients sign in with the credentials Management issued them.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserCredentials;
