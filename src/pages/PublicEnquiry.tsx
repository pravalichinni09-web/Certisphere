import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  Tag,
  MessageSquare,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';

/* -----------------------------------------------------------
   Public Enquiry page — accessible without login.
   Mirrors the shape of `cms_client_enquiries_v1` records so the
   Coordinator's existing Client Enquiry tab picks it up natively.
----------------------------------------------------------- */

const STORAGE_KEY = 'cms_client_enquiries_v1';

const STANDARDS_OPTIONS = [
  'ISO 9001:2015',
  'ISO 14001:2015',
  'ISO 45001:2018',
  'ISO 27001:2022',
  'ISO 22000:2018',
  'ISO 13485:2016',
  'ISO 50001:2018',
  'ISO 42001:2023',
];

const INDUSTRY_OPTIONS = [
  'Manufacturing',
  'Software / IT',
  'Healthcare',
  'Pharmaceutical',
  'Food & Beverage',
  'Construction',
  'Logistics',
  'Energy',
  'Education',
  'Financial Services',
  'Other',
];

const blank = () => ({
  company: '',
  industry: '',
  country: '',
  employees: '',
  website: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  standards: [] as string[],
  message: '',
});

const PublicEnquiry: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(blank());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null); // enquiry id when done

  const setF = <K extends keyof ReturnType<typeof blank>>(k: K, v: ReturnType<typeof blank>[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const toggleStandard = (s: string) => {
    setForm((prev) => ({
      ...prev,
      standards: prev.standards.includes(s)
        ? prev.standards.filter((x) => x !== s)
        : [...prev.standards, s],
    }));
  };

  const canSubmit = useMemo(() => {
    return (
      form.company.trim().length > 1 &&
      form.contactName.trim().length > 1 &&
      (form.contactEmail.trim().length > 3 || form.contactPhone.trim().length > 4)
    );
  }, [form]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const id = `enq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const enquiry = {
      id,
      receivedAt: new Date().toISOString(),
      source: 'Website',
      company: form.company.trim(),
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim(),
      website: form.website.trim(),
      country: form.country.trim(),
      industry: form.industry.trim(),
      employees: form.employees.trim(),
      standards: form.standards,
      message: form.message.trim(),
      status: 'New',
      notes: '',
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const arr = Array.isArray(existing) ? existing : [];
      const next = [enquiry, ...arr];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    // Brief feedback delay so the button click reads as a save action
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(id);
    }, 350);
  };

  /* ------ Thank-you screen ------ */
  if (submitted) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #eff6ff 0%, #ede9fe 100%)',
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: 32,
            maxWidth: 520,
            width: '100%',
            boxShadow: '0 20px 50px rgba(15,23,42,0.15)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#dcfce7',
              color: '#16a34a',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={32} strokeWidth={2.5} />
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 22, color: '#0f172a' }}>
            Thank you — we've got your enquiry
          </h1>
          <p style={{ margin: '0 0 20px', color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
            One of our Audit Coordinators will reach out shortly to discuss your
            certification needs.
          </p>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 24,
              textAlign: 'left',
              fontSize: 13,
            }}
          >
            <div style={{ color: '#64748b', marginBottom: 4 }}>Reference number</div>
            <code
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#1e40af',
                fontFamily: 'monospace',
              }}
            >
              {submitted}
            </code>
            <div style={{ color: '#64748b', marginTop: 10 }}>What happens next</div>
            <ol style={{ margin: '4px 0 0 18px', padding: 0, color: '#334155', lineHeight: 1.6 }}>
              <li>An Audit Coordinator will pick up your enquiry from their inbox.</li>
              <li>You'll receive an application form by email with a digital form to fill.</li>
              <li>Once you submit the form, the Coordinator reviews and approves.</li>
              <li>We schedule the audit and onboard you as a certified client.</li>
            </ol>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/')}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ArrowLeft size={14} /> Back to login
            </button>
            <button
              onClick={() => {
                setSubmitted(null);
                setForm(blank());
              }}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Submit another enquiry
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ------ Form screen ------ */
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0c4a6e 100%)',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            color: '#fff',
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Q
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>
                Qmics Certification
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                ISO certification body · 9001 / 14001 / 45001 / 27001 / 22000 / 42001
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backdropFilter: 'blur(4px)',
            }}
          >
            <ArrowLeft size={14} /> Back to login
          </button>
        </div>

        {/* Hero */}
        <div
          style={{
            color: '#fff',
            marginBottom: 18,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: -0.5, color: '#ffffff', textShadow: '0 2px 12px rgba(0,0,0,0.45)' }}>
            Submit a certification enquiry
          </h1>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 15,
              color: 'rgba(255,255,255,0.92)',
              maxWidth: 640,
              lineHeight: 1.65,
              textShadow: '0 1px 8px rgba(0,0,0,0.4)',
            }}
          >
            Tell us a little about your organisation. An Audit Coordinator will reach out
            with the application form, costs, and a proposed timeline. No account is
            required to submit this form.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 20px 50px rgba(15,23,42,0.30)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Company / Organisation *" full icon={<Building2 size={13} />}>
              <input
                value={form.company}
                onChange={(e) => setF('company', e.target.value)}
                placeholder="Acme Corporation"
                style={inp}
                required
              />
            </Field>

            <Field label="Industry" icon={<Tag size={13} />}>
              <select
                value={form.industry}
                onChange={(e) => setF('industry', e.target.value)}
                style={inp}
              >
                <option value="">— Select —</option>
                {INDUSTRY_OPTIONS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Country / Region" icon={<Globe size={13} />}>
              <input
                value={form.country}
                onChange={(e) => setF('country', e.target.value)}
                placeholder="India"
                style={inp}
              />
            </Field>

            <Field label="Approx. employees">
              <input
                value={form.employees}
                onChange={(e) => setF('employees', e.target.value)}
                placeholder="50 — 100"
                style={inp}
              />
            </Field>

            <Field label="Website">
              <input
                value={form.website}
                onChange={(e) => setF('website', e.target.value)}
                placeholder="https://acme.example"
                style={inp}
              />
            </Field>

            <Field label="Contact person *" full icon={<User size={13} />}>
              <input
                value={form.contactName}
                onChange={(e) => setF('contactName', e.target.value)}
                placeholder="Jane Doe"
                style={inp}
                required
              />
            </Field>

            <Field label="Contact email" icon={<Mail size={13} />}>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setF('contactEmail', e.target.value)}
                placeholder="jane@acme.example"
                style={inp}
              />
            </Field>

            <Field label="Contact phone" icon={<Phone size={13} />}>
              <input
                value={form.contactPhone}
                onChange={(e) => setF('contactPhone', e.target.value)}
                placeholder="+91 90000 00000"
                style={inp}
              />
            </Field>

            <Field label="Standards you're interested in" full icon={<ShieldCheck size={13} />}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {STANDARDS_OPTIONS.map((s) => {
                  const on = form.standards.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStandard(s)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 14,
                        border: '1px solid ' + (on ? '#4338ca' : '#cbd5e1'),
                        background: on ? '#eef2ff' : '#fff',
                        color: on ? '#4338ca' : '#475569',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="What can we help you with?" full icon={<MessageSquare size={13} />}>
              <textarea
                value={form.message}
                onChange={(e) => setF('message', e.target.value)}
                rows={4}
                placeholder="Tell us about your current state, the standard you're targeting, your timeline, and anything else we should know."
                style={{ ...inp, minHeight: 90, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Field>
          </div>

          <div
            style={{
              borderTop: '1px solid #e2e8f0',
              paddingTop: 16,
              marginTop: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 11, color: '#64748b' }}>
              By submitting you agree to be contacted by Qmics Certification regarding your
              enquiry. We never share your details with third parties.
            </div>
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              style={{
                padding: '10px 22px',
                borderRadius: 8,
                border: 'none',
                background: canSubmit && !submitting ? '#2563eb' : '#cbd5e1',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Send size={14} /> {submitting ? 'Sending…' : 'Submit enquiry'}
            </button>
          </div>
        </form>

        <div
          style={{
            color: '#cbd5e1',
            fontSize: 11,
            textAlign: 'center',
            marginTop: 16,
            opacity: 0.7,
          }}
        >
          © {new Date().getFullYear()} Qmics Certification · qmicscertification.com
        </div>
      </div>
    </div>
  );
};

/* ---------- Sub-components ---------- */

const inp: React.CSSProperties = {
  width: '100%',
  padding: 9,
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
  children: React.ReactNode;
}> = ({ label, full, icon, children }) => (
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
  </label>
);

export default PublicEnquiry;
