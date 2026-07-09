import React, { useState, useEffect, useMemo } from 'react';
import { EMAILJS_STORAGE, TEMPLATE_VARIABLE_GUIDES, getEmailJSConfig } from '../config/emailjsConfig';
import { sendEmail } from '../services/emailService';
import AIPanel from './AIPanel';
import { buildEmailDraft, EMAIL_PURPOSES, polishDraftWithClaude, isClaudeConfigured } from '../ai/coordinatorInsights';
import type { EmailPurpose, EmailDraft } from '../ai/coordinatorInsights';
import { getClients, onCmsChange } from '../ai/liveData';

/* ------------------------------------------------------------------
   AI — Email Draft Assistant panel (Feature 8)
------------------------------------------------------------------ */

const EmailDraftAssistantPanel: React.FC = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => onCmsChange(() => setTick((t) => t + 1)), []);

  const clients = useMemo(() => getClients(), [tick]);
  const [purpose, setPurpose] = useState<EmailPurpose>('dispatch');
  const [clientId, setClientId] = useState('');
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [copied, setCopied] = useState(false);
  const [polishing, setPolishing] = useState(false);

  const selectedClient =
    clients.find((c: any) => String(c.id) === clientId) || clients[0];

  const generate = () => {
    if (!selectedClient) return;
    setDraft(buildEmailDraft(purpose, selectedClient));
    setCopied(false);
  };

  const copyDraft = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const polish = async () => {
    if (!draft) return;
    setPolishing(true);
    const better = await polishDraftWithClaude(
      `Subject: ${draft.subject}\n\n${draft.body}`,
      EMAIL_PURPOSES.find((pp) => pp.id === purpose)?.label || 'email'
    );
    if (better) {
      const m = better.match(/^Subject:\s*(.+)\n+([\s\S]*)$/);
      if (m) setDraft({ ...draft, subject: m[1].trim(), body: m[2].trim() });
      else setDraft({ ...draft, body: better });
    }
    setPolishing(false);
  };

  const selStyle: React.CSSProperties = {
    padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6,
    fontSize: 13, width: '100%', boxSizing: 'border-box', background: '#fff',
  };

  return (
    <AIPanel
      title="Email Draft Assistant"
      subtitle="Generate polished client emails from live registration, schedule and certificate data"
      onRefresh={() => setTick((t) => t + 1)}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
          Purpose
          <select
            value={purpose}
            onChange={e => setPurpose(e.target.value as EmailPurpose)}
            style={{ ...selStyle, marginTop: 4 }}
          >
            {EMAIL_PURPOSES.map(pp => (
              <option key={pp.id} value={pp.id}>{pp.label}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
          Client
          <select
            value={clientId || (selectedClient ? String(selectedClient.id) : '')}
            onChange={e => setClientId(e.target.value)}
            style={{ ...selStyle, marginTop: 4 }}
          >
            {clients.length === 0 && <option value="">No registered clients found</option>}
            {clients.map((c: any) => (
              <option key={c.id} value={String(c.id)}>
                {c.organizationName || c.organization || `Client ${c.id}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button type="button" className="ai-action-btn" onClick={generate} disabled={!selectedClient}>
        Generate draft
      </button>

      {draft && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {draft.usedData.map(d => (
              <span key={d} className="ai-chip info">{d}</span>
            ))}
          </div>
          <input
            value={draft.subject}
            onChange={e => setDraft({ ...draft, subject: e.target.value })}
            style={{ ...selStyle, fontWeight: 600, marginBottom: 6 }}
          />
          <textarea
            value={draft.body}
            onChange={e => setDraft({ ...draft, body: e.target.value })}
            rows={14}
            style={{ ...selStyle, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="ai-action-btn" onClick={copyDraft}>
              {copied ? 'Copied!' : 'Copy email'}
            </button>
            {isClaudeConfigured() && (
              <button type="button" className="ai-action-btn" onClick={polish} disabled={polishing}>
                {polishing ? 'Polishing…' : 'Polish with Claude'}
              </button>
            )}
          </div>
        </div>
      )}
      <p className="ai-panel-note">
        Drafts pull live data: audit reminders use the next scheduled audit; certificate and surveillance
        emails use the issued certificate on file.
      </p>
    </AIPanel>
  );
};

const EmailJSSettings: React.FC = () => {
  const [cfg, setCfg] = useState(() => getEmailJSConfig());
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [testEmail, setTestEmail] = useState('');
  const [openGuide, setOpenGuide] = useState<string | null>(null);

  useEffect(() => { setCfg(getEmailJSConfig()); }, []);

  const save = () => {
    localStorage.setItem(EMAILJS_STORAGE.SERVICE_ID,       cfg.serviceId);
    localStorage.setItem(EMAILJS_STORAGE.PUBLIC_KEY,        cfg.publicKey);
    localStorage.setItem(EMAILJS_STORAGE.TPL_CONTACT,       cfg.templates.contact);
    localStorage.setItem(EMAILJS_STORAGE.TPL_AUDIT_NOTIFY,  cfg.templates.auditNotify);
    localStorage.setItem(EMAILJS_STORAGE.TPL_CERT_ISSUED,   cfg.templates.certIssued);
    localStorage.setItem(EMAILJS_STORAGE.TPL_EXPIRY_ALERT,  cfg.templates.expiryAlert);
    localStorage.setItem(EMAILJS_STORAGE.TPL_WELCOME,       cfg.templates.welcome);
    localStorage.setItem(EMAILJS_STORAGE.ENABLED, String(cfg.enabled));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const sendTest = async () => {
    if (!testEmail.trim()) return;
    setTestStatus('sending');
    const res = await sendEmail({
      type: 'contact',
      to: testEmail,
      subject: 'CertiSphere — EmailJS Test',
      body: 'This is a test email from CertiSphere. Your EmailJS integration is working correctly.',
      templateVars: {
        from_name: 'CertiSphere System',
        from_email: 'noreply@certisphere.com',
        company: 'CertiSphere',
        phone: '',
        message: 'This is a test email confirming your EmailJS configuration is working.',
      },
    });
    setTestStatus(res.status === 'sent' ? 'sent' : 'error');
    setTimeout(() => setTestStatus('idle'), 4000);
  };

  const configured = !cfg.serviceId.startsWith('YOUR_') && !cfg.publicKey.startsWith('YOUR_');

  // ── Styles ─────────────────────────────────────────────────────
  const section: React.CSSProperties = {
    background: '#fff', borderRadius: 12, padding: 24,
    border: '1px solid #E5E7EB', marginBottom: 20,
  };
  const label: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5,
  };
  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 13px', borderRadius: 8,
    border: '1.5px solid #E2E8F0', fontSize: 13, fontFamily: 'monospace',
    outline: 'none', boxSizing: 'border-box', background: '#FAFAFA',
  };
  const badge = (ok: boolean): React.CSSProperties => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: 999,
    fontSize: 11, fontWeight: 700,
    background: ok ? '#DCFCE7' : '#FEF3C7',
    color:      ok ? '#166534' : '#92400E',
  });

  return (
    <div style={{ maxWidth: 720, padding: 4 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
          📧 Email Configuration
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
          Connect CertiSphere to EmailJS to send real emails for audit notifications,
          certificate delivery, expiry alerts and enquiry forms.
        </p>
      </div>

      {/* AI: email draft assistant */}
      <EmailDraftAssistantPanel />

      {/* Status banner */}
      <div style={{ ...section, background: configured ? '#F0FDF4' : '#FFFBEB',
        border: `1px solid ${configured ? '#BBF7D0' : '#FCD34D'}`, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{configured ? '✅' : '⚠️'}</span>
          <div>
            <strong style={{ fontSize: 14, color: configured ? '#166534' : '#92400E' }}>
              {configured ? 'EmailJS is configured and active' : 'EmailJS not configured — emails are queued'}
            </strong>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280' }}>
              {configured
                ? 'Real emails will be sent via your connected EmailJS service.'
                : 'Fill in the Service ID and Public Key below to enable live email sending.'}
            </p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={cfg.enabled}
                onChange={e => setCfg(c => ({ ...c, enabled: e.target.checked }))} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Enabled</span>
            </label>
          </div>
        </div>
      </div>

      {/* Step-by-step guide */}
      <div style={{ ...section, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#1D4ED8' }}>
          🚀 Setup Guide — 5 Steps
        </h3>
        {[
          { n: 1, title: 'Create EmailJS account', body: 'Go to emailjs.com → Sign Up (free — 200 emails/month). No credit card needed.' },
          { n: 2, title: 'Add Email Service', body: 'Dashboard → Email Services → Add New Service. Connect Gmail, Outlook, or custom SMTP. Copy the Service ID (e.g. service_abc123).' },
          { n: 3, title: 'Create 5 Templates', body: 'Dashboard → Email Templates → Create Template. Build one template per type below. Use the {{variable}} names shown in each template guide.' },
          { n: 4, title: 'Copy Public Key', body: 'Account (top-right) → API Keys → copy your Public Key (e.g. aBcDeFgHiJkLmNoP). Paste it below.' },
          { n: 5, title: 'Paste keys here & Save', body: 'Fill in the fields below and click Save Configuration. Use the Test Email button to verify.' },
        ].map(s => (
          <div key={s.n} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1D4ED8',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{s.n}</div>
            <div>
              <strong style={{ fontSize: 13, color: '#1E3A8A' }}>{s.title}</strong>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#374151' }}>{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Service & Key */}
      <div style={section}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#111827' }}>
          🔑 Account Keys
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={label}>Service ID <span style={{ color: '#EF4444' }}>*</span></label>
            <input style={inp} type="text" placeholder="service_abc123"
              value={cfg.serviceId.startsWith('YOUR_') ? '' : cfg.serviceId}
              onChange={e => setCfg(c => ({ ...c, serviceId: e.target.value || 'YOUR_SERVICE_ID' }))} />
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0' }}>
              From Dashboard → Email Services
            </p>
          </div>
          <div>
            <label style={label}>Public Key <span style={{ color: '#EF4444' }}>*</span></label>
            <input style={inp} type="text" placeholder="aBcDeFgHiJkLmNoP"
              value={cfg.publicKey.startsWith('YOUR_') ? '' : cfg.publicKey}
              onChange={e => setCfg(c => ({ ...c, publicKey: e.target.value || 'YOUR_PUBLIC_KEY' }))} />
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0' }}>
              From Account → API Keys
            </p>
          </div>
        </div>
      </div>

      {/* Template IDs */}
      <div style={section}>
        <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#111827' }}>
          📄 Template IDs
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6B7280' }}>
          Create each template in the EmailJS dashboard. Click "View variables" to see which
          {'{{variables}}'} to use in each template.
        </p>

        {([
          { key: 'contact',     label: 'Contact / Enquiry Form',   guide: 'CONTACT',      field: 'contact'     },
          { key: 'auditNotify', label: 'Audit Notification',       guide: 'AUDIT_NOTIFY', field: 'auditNotify' },
          { key: 'certIssued',  label: 'Certificate Issued',       guide: 'CERT_ISSUED',  field: 'certIssued'  },
          { key: 'expiryAlert', label: 'Certificate Expiry Alert', guide: 'EXPIRY_ALERT', field: 'expiryAlert' },
          { key: 'welcome',     label: 'Welcome / Onboarding',     guide: 'WELCOME',      field: 'welcome'     },
        ] as const).map(t => (
          <div key={t.key} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <label style={{ ...label, margin: 0, flex: 1 }}>{t.label}</label>
              <span style={badge(!((cfg.templates as any)[t.field] || '').startsWith('YOUR_'))}>
                {((cfg.templates as any)[t.field] || '').startsWith('YOUR_') ? 'not set' : 'set'}
              </span>
              <button onClick={() => setOpenGuide(openGuide === t.guide ? null : t.guide)}
                style={{ fontSize: 11, color: '#1D4ED8', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '2px 6px', textDecoration: 'underline' }}>
                {openGuide === t.guide ? 'Hide' : 'View variables'}
              </button>
            </div>
            <input style={inp} type="text" placeholder="template_xxxxx"
              value={((cfg.templates as any)[t.field] || '').startsWith('YOUR_')
                ? '' : (cfg.templates as any)[t.field]}
              onChange={e => setCfg(c => ({
                ...c, templates: {
                  ...c.templates,
                  [t.field]: e.target.value || `YOUR_TEMPLATE_${t.guide}`,
                }
              }))} />
            {openGuide === t.guide && (
              <div style={{ marginTop: 8, padding: '10px 14px', background: '#F8FAFC',
                borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#374151' }}>
                  Use these {'{{variables}}'} in your EmailJS template:
                </p>
                {(TEMPLATE_VARIABLE_GUIDES[t.guide] || []).map(v => (
                  <div key={v.var} style={{ display: 'flex', gap: 10, fontSize: 12, marginBottom: 3 }}>
                    <code style={{ background: '#DBEAFE', color: '#1E40AF', padding: '1px 6px',
                      borderRadius: 4, minWidth: 170, flexShrink: 0 }}>{v.var}</code>
                    <span style={{ color: '#6B7280' }}>{v.desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Test + Save */}
      <div style={section}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#111827' }}>
          🧪 Test Email
        </h3>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input style={{ ...inp, fontFamily: 'inherit', flex: 1 }}
            type="email" placeholder="test@example.com"
            value={testEmail} onChange={e => setTestEmail(e.target.value)} />
          <button onClick={sendTest} disabled={testStatus === 'sending'}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: testStatus === 'sent' ? '#16A34A' : testStatus === 'error' ? '#DC2626' : '#1D4ED8',
              color: '#fff', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
            {testStatus === 'sending' ? 'Sending…'
              : testStatus === 'sent'    ? '✓ Sent!'
              : testStatus === 'error'   ? '✗ Failed'
              : 'Send Test'}
          </button>
        </div>
        <button onClick={save}
          style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none',
            background: saved ? '#16A34A' : '#1D4ED8', color: '#fff',
            fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          {saved ? '✓ Saved!' : 'Save Configuration'}
        </button>
      </div>

    </div>
  );
};

export default EmailJSSettings;
