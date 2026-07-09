/**
 * DemoAccountModal — shows demo login account(s) for a selected role.
 * Credentials stay hidden until the user clicks "Show". "Use account" fills
 * the main sign-in form; "Sign in" logs straight in.
 */
import React, { useState } from 'react';
import { X, Copy, Check, Eye, EyeOff, ArrowRight, User, Building2 } from 'lucide-react';

export interface DemoAccount {
  role: string;
  name: string;
  email: string;
  password: string;
  org?: string;
  status?: string;
}

interface Props {
  role: string;
  accounts: DemoAccount[];
  onUse: (a: DemoAccount) => void;
  onSignIn: (a: DemoAccount) => void;
  onClose: () => void;
}

const ROLE_COLOR: Record<string, string> = {
  Management: '#7c3aed',
  'Audit Coordinator': '#0e7490',
  'Lead Auditor': '#b45309',
  Auditor: '#1d4ed8',
  Auditee: '#047857',
  'Client Coordinator': '#065f46',
};

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(2,6,23,.62)',
  backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const cardS: React.CSSProperties = {
  width: '100%', maxWidth: 500, background: '#fff', borderRadius: 18, overflow: 'hidden',
  boxShadow: '0 30px 80px rgba(2,6,23,.45)', display: 'flex', flexDirection: 'column', maxHeight: '88vh',
};
const miniBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, border: '1px solid #e2e8f0',
  background: '#f8fafc', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: '#475569', fontSize: 12,
};

const CopyRow: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* ignore */ }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <span style={{ width: 70, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</span>
      <code style={{ flex: 1, fontSize: 13, color: '#0f172a', background: '#f1f5f9', borderRadius: 7, padding: '6px 10px', fontFamily: 'ui-monospace,Menlo,monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </code>
      <button type="button" style={miniBtn} onClick={copy} title="Copy">
        {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
      </button>
    </div>
  );
};

const AccountCard: React.FC<{ a: DemoAccount; color: string; onUse: (a: DemoAccount) => void; onSignIn: (a: DemoAccount) => void }> = ({ a, color, onUse, onSignIn }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <div style={{ border: '1px solid #e7ecf3', borderRadius: 12, padding: 14, marginBottom: 12, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f2547' }}>{a.name}</div>
          {a.org && <div style={{ fontSize: 12, color: '#64748b' }}>{a.org}</div>}
        </div>
        {a.status && (
          <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
            background: a.status === 'Active' ? '#dcfce7' : '#fee2e2', color: a.status === 'Active' ? '#166534' : '#b91c1c' }}>{a.status}</span>
        )}
      </div>

      {/* Credentials hidden by default */}
      {!revealed ? (
        <button type="button" onClick={() => setRevealed(true)}
          style={{ ...miniBtn, marginTop: 12, width: '100%', padding: '9px 10px', fontSize: 12.5, fontWeight: 700, color, borderColor: '#e2e8f0', background: '#f8fafc' }}>
          <Eye size={14} /> Show credentials
        </button>
      ) : (
        <div style={{ marginTop: 6 }}>
          <CopyRow label="Email" value={a.email} />
          <CopyRow label="Password" value={a.password} />
          <button type="button" onClick={() => setRevealed(false)} style={{ ...miniBtn, marginTop: 8, fontSize: 11.5 }}>
            <EyeOff size={13} /> Hide
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={() => onUse(a)}
          style={{ flex: 1, border: `1.5px solid ${color}`, background: '#fff', color, borderRadius: 9, padding: '9px 10px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Use account
        </button>
        <button type="button" onClick={() => onSignIn(a)}
          style={{ flex: 1, border: 'none', background: color, color: '#fff', borderRadius: 9, padding: '9px 10px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          Sign in <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

const DemoAccountModal: React.FC<Props> = ({ role, accounts, onUse, onSignIn, onClose }) => {
  const color = ROLE_COLOR[role] || '#1d4ed8';
  const isClient = role === 'Auditee';
  return (
    <div style={overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={`Demo accounts for ${role}`}>
      <div style={cardS} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`, color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center' }}>
              {isClient ? <Building2 size={18} /> : <User size={18} />}
            </span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Demo accounts</div>
              <div style={{ fontSize: 12, opacity: .9 }}>{role}{isClient && accounts.length > 1 ? ` · ${accounts.length} accounts` : ''}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'rgba(255,255,255,.16)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 16, overflowY: 'auto' }}>
          {accounts.length === 0 && (
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>No demo accounts available for this role.</p>
          )}
          {accounts.map((a, i) => (
            <AccountCard key={i} a={a} color={color} onUse={onUse} onSignIn={onSignIn} />
          ))}
          <p style={{ fontSize: 11.5, color: '#94a3b8', margin: '4px 2px 0' }}>
            Demo data only. Click <strong>Show credentials</strong> to view them. <strong>Use account</strong> fills the sign-in form &mdash; then press <strong>Sign In</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DemoAccountModal;
