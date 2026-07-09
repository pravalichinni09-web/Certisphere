import React, { useState, useMemo } from 'react';
import { UserPlus, X, CheckCircle2, Building2, Mail, Phone, MapPin, KeyRound, Copy } from 'lucide-react';
import { addClient } from '../pages/AuditorCoordinator/utils/clientCredentials';
import { ensureWorkflow } from '../utils/auditWorkflow';
import { getAuditTypeNames } from '../utils/auditTypes';
import '../styles/AuditeeRegistration.css';

interface Props {
  onClose: () => void;
}

const STANDARDS = [
  'ISO 9001:2015',
  'ISO 14001:2015',
  'ISO 45001:2018',
  'ISO 27001:2022',
  'ISO 22000:2018',
  'ISO 42001:2023',
];

const AuditeeRegistration: React.FC<Props> = ({ onClose }) => {
  const auditTypeNames = useMemo(() => getAuditTypeNames(), []);
  const defaultAuditType = auditTypeNames.length > 0 ? auditTypeNames[0] : 'Initial Certification';
  
  const [form, setForm] = useState({
    organizationName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    standard: STANDARDS[0],
    clientType: defaultAuditType,
  });
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ username: string; password: string; org: string } | null>(null);

  const change = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.organizationName.trim() || !form.contactPerson.trim() || !form.email.trim()) {
      setError('Organization, contact person, and email are required.');
      return;
    }
    const { client, credential } = addClient({
      organizationName: form.organizationName,
      contactPerson: form.contactPerson,
      email: form.email,
      phone: form.phone,
      address: form.address,
      standard: form.standard,
      clientType: form.clientType,
      status: 'Pending',
    });
    ensureWorkflow(client.id, form.contactPerson || form.organizationName);
    setIssued({
      username: credential.username,
      password: credential.password,
      org: credential.organizationName,
    });
  };

  const copy = (text: string) => {
    try { navigator.clipboard.writeText(text); } catch { /* ignore */ }
  };

  return (
    <div className="reg-backdrop" onClick={onClose}>
      <div className="reg-modal" onClick={(e) => e.stopPropagation()}>
        <button className="reg-close" onClick={onClose}><X size={18} /></button>

        {!issued ? (
          <>
            <div className="reg-head">
              <div className="reg-head-icon"><UserPlus size={22} /></div>
              <div>
                <h2>Register as a New Client</h2>
                <p>Submit your registration to begin the certification process. Management will review and assign an Audit Coordinator.</p>
              </div>
            </div>

            <form className="reg-form" onSubmit={submit}>
              <div className="reg-row">
                <div className="reg-field">
                  <label><Building2 size={12} /> Organization Name <span className="req">*</span></label>
                  <input value={form.organizationName} onChange={(e) => change('organizationName', e.target.value)} placeholder="Acme Industries Pvt Ltd" />
                </div>
                <div className="reg-field">
                  <label>Contact Person <span className="req">*</span></label>
                  <input value={form.contactPerson} onChange={(e) => change('contactPerson', e.target.value)} placeholder="Jane Doe" />
                </div>
              </div>
              <div className="reg-row">
                <div className="reg-field">
                  <label><Mail size={12} /> Email <span className="req">*</span></label>
                  <input type="email" value={form.email} onChange={(e) => change('email', e.target.value)} placeholder="contact@acme.com" />
                </div>
                <div className="reg-field">
                  <label><Phone size={12} /> Phone</label>
                  <input value={form.phone} onChange={(e) => change('phone', e.target.value)} placeholder="9876543210" />
                </div>
              </div>
              <div className="reg-field">
                <label><MapPin size={12} /> Address</label>
                <input value={form.address} onChange={(e) => change('address', e.target.value)} placeholder="Street, City, Country" />
              </div>
              <div className="reg-row">
                <div className="reg-field">
                  <label>Audit Standard</label>
                  <select value={form.standard} onChange={(e) => change('standard', e.target.value)}>
                    {STANDARDS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="reg-field">
                  <label>Audit Type</label>
                  <select value={form.clientType} onChange={(e) => change('clientType', e.target.value)}>
                    {auditTypeNames.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {error && <div className="reg-error">{error}</div>}

              <div className="reg-actions">
                <button type="button" className="reg-btn ghost" onClick={onClose}>Cancel</button>
                <button type="submit" className="reg-btn primary"><UserPlus size={16} /> Submit Registration</button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="reg-head success">
              <div className="reg-head-icon ok"><CheckCircle2 size={22} /></div>
              <div>
                <h2>Registration Submitted</h2>
                <p>Welcome, <strong>{issued.org}</strong>! Save your login credentials below — you will use them to sign in as <strong>Auditee</strong>.</p>
              </div>
            </div>

            <div className="reg-creds">
              <div className="reg-cred-row">
                <div>
                  <div className="reg-cred-label"><KeyRound size={12} /> Username</div>
                  <div className="reg-cred-value">{issued.username}</div>
                </div>
                <button className="reg-copy" onClick={() => copy(issued.username)} title="Copy"><Copy size={14} /></button>
              </div>
              <div className="reg-cred-row">
                <div>
                  <div className="reg-cred-label"><KeyRound size={12} /> Password</div>
                  <div className="reg-cred-value">{issued.password}</div>
                </div>
                <button className="reg-copy" onClick={() => copy(issued.password)} title="Copy"><Copy size={14} /></button>
              </div>
            </div>

            <div className="reg-info">
              Your registration is at stage <strong>1 — Registration Submitted</strong>. Management will assign an Audit Coordinator next. You can track progress on your dashboard after logging in.
            </div>

            <div className="reg-actions">
              <button className="reg-btn primary" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuditeeRegistration;
