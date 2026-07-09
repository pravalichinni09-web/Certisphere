import React from 'react';
import { Mail, Lock, LogIn, Users, Shield, ClipboardCheck, Briefcase, Building2 } from 'lucide-react';
import '../styles/LoginForm.css';

interface SelectedUser { role: string; email: string; password: string; description?: string; }

interface LoginFormProps {
  selectedUser: SelectedUser | null;
  email: string;
  password: string;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onLogin: (e: React.FormEvent) => void;
  /** Optional — when provided, an inline role picker is rendered at the top of the form. */
  onPickRole?: (user: SelectedUser) => void;
}

const ROLES: Array<SelectedUser & { icon: React.ReactNode; color: string; bg: string }> = [
  { role: 'Management',       email: 'management@cms.com',  password: 'Manage123!@#',     icon: <Shield size={14} />,          color: '#7c3aed', bg: '#ede9fe' },
  { role: 'Audit Coordinator',email: 'coordinator@cms.com', password: 'AuditCoord@123',   icon: <Users size={14} />,           color: '#0e7490', bg: '#cffafe' },
  { role: 'Lead Auditor',     email: 'lead@cms.com',        password: 'LeadAudit@123',    icon: <ClipboardCheck size={14} />,  color: '#b45309', bg: '#fef3c7' },
  { role: 'Auditor',          email: 'auditor@cms.com',     password: 'Auditor@123',      icon: <Briefcase size={14} />,       color: '#1d4ed8', bg: '#dbeafe' },
  { role: 'Auditee',          email: 'client@cms.com',      password: 'AuditClient@123',  icon: <Building2 size={14} />,       color: '#047857', bg: '#d1fae5' },
  { role: 'Client Coordinator', email: 'coord.client@cms.com', password: 'ClientCoord@123', icon: <Users size={14} />, color: '#065f46', bg: '#d1fae5' },
];

const LoginForm: React.FC<LoginFormProps> = ({
  selectedUser, email, password,
  onEmailChange, onPasswordChange, onLogin, onPickRole,
}) => {
  return (
    <form className="login-form" onSubmit={onLogin}>
      <h2 className="form-title">Login</h2>

      {/* Inline role picker — always visible regardless of viewport. */}
      {onPickRole && (
        <div className="role-picker">
          <p className="role-picker-label">Sign in as</p>
          <div className="role-picker-grid">
            {ROLES.map((r) => {
              const active = selectedUser?.role === r.role;
              return (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => onPickRole(r)}
                  className={'role-pick-btn' + (active ? ' is-active' : '')}
                  title={`Sign in as ${r.role}`}
                >
                  <span className="role-pick-icon">{r.icon}</span>
                  <span className="role-pick-label">{r.role}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="selected-user-info">
          <p className="info-label">Selected Role:</p>
          <p className="info-value">{selectedUser.role}</p>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="email" className="form-label">
          <Mail size={18} />
          Email Address
        </label>
        <input
          id="email" type="email" className="form-input"
          placeholder="Enter your email"
          value={email} onChange={(e) => onEmailChange(e.target.value)} required
        />
      </div>

      <div className="form-group">
        <label htmlFor="password" className="form-label">
          <Lock size={18} />
          Password
        </label>
        <input
          id="password" type="password" className="form-input"
          placeholder="Enter your password"
          value={password} onChange={(e) => onPasswordChange(e.target.value)} required
        />
      </div>

      <button type="submit" className="login-button">
        <LogIn size={20} />
        Sign In
      </button>


    </form>
  );
};

export default LoginForm;
