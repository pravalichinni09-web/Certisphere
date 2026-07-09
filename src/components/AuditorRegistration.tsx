import React, { useMemo, useState } from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  Globe,
  ShieldCheck,
  Plus,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { SUPPORTED_COUNTRIES } from '../utils/globalDemoSeeder';

/* -----------------------------------------------------------
   Auditor details form.
   Mounted in two places:
   1. LoginPage → "Are you a certified auditor? Join CertMS →"
   2. Auditor role dashboard → "Auditor details" button
----------------------------------------------------------- */

const AUDITORS_KEY = 'cms_auditors';
const AUDITORS_DATA_KEY = 'cms_auditors_data';

const ROLE_OPTIONS = ['Lead Auditor', 'Auditor', 'Junior Auditor'];

const DEPARTMENT_OPTIONS = [
  'Quality',
  'Security',
  'Safety',
  'HR',
  'Admin',
  'Software Development',
  'Purchase',
];

const LANGUAGE_OPTIONS = [
  'English', 'Spanish', 'Portuguese', 'German', 'French',
  'Arabic', 'Mandarin', 'Hindi', 'Japanese', 'Italian',
];

interface UploadedDoc {
  name: string;
  dataUrl: string;
  size: number;
  uploadedAt: string;
}

interface AuditorRegistrationProps {
  onClose: () => void;
  onSubmitted?: (auditorName: string) => void;
  showDocumentUpload?: boolean;
}

const AuditorRegistration: React.FC<AuditorRegistrationProps> = ({ onClose, onSubmitted }) => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Auditor',
    country: '',
    region: '',
    specialization: '',
    department: 'Quality',
    yearsOverall: '',
    yearsAudit: '',
    certifications: [] as string[],
    languages: [] as string[],
    certificateDoc: undefined as UploadedDoc | undefined,
    experienceDoc: undefined as UploadedDoc | undefined,
    auditLogsDoc: undefined as UploadedDoc | undefined,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const [certInput, setCertInput] = useState('');
  const addCertification = () => {
    const value = certInput.trim();
    if (!value) return;
    setForm((prev) => (
      prev.certifications.includes(value)
        ? prev
        : { ...prev, certifications: [...prev.certifications, value] }
    ));
    setCertInput('');
  };
  const removeCertification = (c: string) => {
    setForm((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((x) => x !== c),
    }));
  };

  const toggleLanguage = (l: string) => {
    setForm((prev) => ({
      ...prev,
      languages: prev.languages.includes(l)
        ? prev.languages.filter((x) => x !== l)
        : [...prev.languages, l],
    }));
  };


  const canSubmit = useMemo(() => {
    return (
      form.name.trim().length > 1 &&
      form.email.trim().length > 3 &&
      form.email.includes('@') &&
      form.country.trim().length > 0 &&
      form.role.length > 0 &&
      form.specialization.trim().length > 0
    );
  }, [form]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    try {
      const raw = localStorage.getItem(AUDITORS_KEY);
      const existing: any[] = raw ? JSON.parse(raw) : [];
      const arr = Array.isArray(existing) ? existing : [];

      // Email duplicate detection (case-insensitive)
      const dup = arr.find(
        (a: any) => (a.email || '').toLowerCase() === form.email.toLowerCase()
      );
      if (dup) {
        alert(
          `An auditor with email ${form.email} already exists. Please contact your Lead Auditor for access.`
        );
        setSubmitting(false);
        return;
      }

      const nextId = arr.length ? Math.max(...arr.map((a: any) => a.id ?? 0)) + 1 : 1001;
      const newAuditor = {
        id: nextId,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
        country: form.country,
        region: form.region.trim(),
        specialization: form.specialization.trim(),
        department: form.department,
        yearsOverall: form.yearsOverall.trim(),
        yearsAudit: form.yearsAudit.trim(),
        certifications: form.certifications,
        languages: form.languages,
        documents: {
          certificate: form.certificateDoc,
          experience: form.experienceDoc,
          auditLogs: form.auditLogsDoc,
        },
        status: 'Inactive',
        joinDate: new Date().toISOString().split('T')[0],
        skills: {},
        ratings: [],
        approvalStatus: 'Pending Approval' as const,
      };

      const nextAll = [...arr, newAuditor];
      localStorage.setItem(AUDITORS_KEY, JSON.stringify(nextAll));
      localStorage.setItem(AUDITORS_DATA_KEY, JSON.stringify(nextAll));
      window.dispatchEvent(new Event('cms-auditors-updated'));

      setTimeout(() => {
        setSubmitting(false);
        setSubmitted(newAuditor.name);
        onSubmitted?.(newAuditor.name);
      }, 350);
    } catch {
      setSubmitting(false);
      alert('We could not save your registration. Try again.');
    }
  };

  /* ------ Thank-you screen ------ */
  if (submitted) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: 16,
        }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#fff',
            borderRadius: 14,
            padding: 30,
            maxWidth: 480,
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: '#dcfce7',
              color: '#16a34a',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={30} strokeWidth={2.5} />
          </div>
          <h2 style={{ margin: '0 0 10px', color: '#0f172a', fontSize: 22 }}>
            Welcome to CertMS, {submitted.split(' ')[0]}!
          </h2>
          <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>
            Your auditor profile has been created with status <strong>Pending Approval</strong>.
            The Coordinator will review and forward your application to the Lead Auditor and
            Management for final approval. You'll be notified once you're approved.
          </p>
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12,
              color: '#92400e',
              marginBottom: 20,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertTriangle size={14} /> Until approved, your account is inactive and cannot
            be assigned to audits.
          </div>
          <div>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ------ Form ------ */
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: 24,
          width: 'min(820px, 96vw)',
          maxHeight: '94vh',
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <ShieldCheck size={22} color="#2563eb" /> Auditor details form
            </h2>
            <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
              Apply to join our global panel of certification auditors. Your country's Lead
              Auditor and Management will review and approve your profile.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: 4,
            }}
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Full name *" icon={<User size={13} />}>
              <input
                value={form.name}
                onChange={(e) => setF('name', e.target.value)}
                placeholder="Jane Doe"
                style={inp}
                required
              />
            </Field>

            <Field label="Role *">
              <select
                value={form.role}
                onChange={(e) => setF('role', e.target.value)}
                style={inp}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>

            <Field label="Email *" icon={<Mail size={13} />}>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setF('email', e.target.value)}
                placeholder="jane@example.com"
                style={inp}
                required
              />
            </Field>

            <Field label="Phone" icon={<Phone size={13} />}>
              <input
                value={form.phone}
                onChange={(e) => setF('phone', e.target.value)}
                placeholder="+44 20 7946 0000"
                style={inp}
              />
            </Field>

            <Field label="Country *" icon={<Globe size={13} />}>
              <select
                value={form.country}
                onChange={(e) => setF('country', e.target.value)}
                style={inp}
                required
              >
                <option value="">— Select your country —</option>
                {SUPPORTED_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>

            <Field label="Region / State">
              <input
                value={form.region}
                onChange={(e) => setF('region', e.target.value)}
                placeholder="e.g. California / Bavaria / Tamil Nadu"
                style={inp}
              />
            </Field>

            <Field label="Specialization *" full>
              <input
                value={form.specialization}
                onChange={(e) => setF('specialization', e.target.value)}
                placeholder="e.g. Information Security, Food Safety, Medical Devices"
                style={inp}
                required
              />
            </Field>

            <Field label="Department">
              <select
                value={form.department}
                onChange={(e) => setF('department', e.target.value)}
                style={inp}
              >
                {DEPARTMENT_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>

            <Field label="Years overall">
              <input
                value={form.yearsOverall}
                onChange={(e) => setF('yearsOverall', e.target.value)}
                placeholder="e.g. 8"
                style={inp}
                inputMode="numeric"
              />
            </Field>

            <Field label="Years auditing" full>
              <input
                value={form.yearsAudit}
                onChange={(e) => setF('yearsAudit', e.target.value)}
                placeholder="e.g. 5"
                style={inp}
                inputMode="numeric"
              />
            </Field>

            <Field label="Certifications held" full>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={certInput}
                  onChange={(e) => setCertInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addCertification(); }
                  }}
                  placeholder="Type a certification and press Add (e.g. ISO 9001:2015)"
                  style={{ ...inp, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={addCertification}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#4338ca',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Add
                </button>
              </div>
              {form.certifications.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {form.certifications.map((c) => (
                    <span
                      key={c}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '5px 10px',
                        borderRadius: 14,
                        border: '1px solid #4338ca',
                        background: '#eef2ff',
                        color: '#4338ca',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => removeCertification(c)}
                        title={'Remove ' + c}
                        style={{
                          background: 'transparent', border: 'none',
                          color: '#4338ca', cursor: 'pointer',
                          padding: 0, fontSize: 14, lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Field>

            <Field label="Languages" full>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {LANGUAGE_OPTIONS.map((l) => {
                  const on = form.languages.includes(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => toggleLanguage(l)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 14,
                        border: '1px solid ' + (on ? '#0e7490' : '#cbd5e1'),
                        background: on ? '#cffafe' : '#fff',
                        color: on ? '#0e7490' : '#475569',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </Field>

          </div>

          <div
            style={{
              borderTop: '1px solid #e2e8f0',
              paddingTop: 14,
              marginTop: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 11, color: '#64748b' }}>
              By submitting you agree to CertMS's auditor terms and consent to verification of
              your credentials by your country's Lead Auditor and Management.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit || submitting}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: canSubmit && !submitting ? '#2563eb' : '#cbd5e1',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={14} /> {submitting ? 'Submitting…' : 'Add'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ---------- Helpers ---------- */
const inp: React.CSSProperties = {
  width: '100%',
  padding: 8,
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const Field: React.FC<{
  label: string;
  full?: boolean;
  icon?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, full, icon, hint, children }) => (
  <label
    style={{
      gridColumn: full ? '1 / -1' : 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      fontSize: 12,
      fontWeight: 600,
      color: '#334155',
    }}
  >
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {icon} {label}
    </span>
    {children}
    {hint && (
      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
        {hint}
      </span>
    )}
  </label>
);

export default AuditorRegistration;
