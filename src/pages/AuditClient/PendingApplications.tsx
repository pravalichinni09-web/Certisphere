import React, { useEffect, useMemo, useState } from 'react';
import {
  Inbox,
  FileText,
  Send,
  Building2,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Tag,
  MessageSquare,
  X,
  Eye,
} from 'lucide-react';
import QCSApplicationForm, { QCSFormMode, loadQCSRecord } from '../../components/QCSApplicationForm';

/* -----------------------------------------------------------
   Types & storage — mirror the Coordinator's DispatchRecord
----------------------------------------------------------- */

interface DispatchRecord {
  id: number;
  clientName: string;
  organization: string;
  mobile?: string;
  applicationType: string;
  standard: string;
  email: string;
  dispatchedDate: string;
  status: string;
  rejectNote?: string;
  link?: string;
  auditType?: string;
  preferredStart?: string;
  preferredEnd?: string;
  auditorsCount?: number;
  auditScope?: string;
  contactName?: string;
  reviewDate?: string;
  attachment?: { name: string; dataUrl: string; size: number; uploadedAt: string };
  agreement?: { name: string; dataUrl: string; size: number; uploadedAt: string };

  // Filled by the Auditee
  clientSubmittedAt?: string;
  clientFormFields?: {
    address?: string;
    industry?: string;
    employees?: string;
    standardsInterested?: string[];
    preferredStart?: string;
    preferredEnd?: string;
    additionalNotes?: string;
  };
}

const STORAGE_KEY = 'cms_application_dispatch_v7';
const AUDITEE_PROFILE_KEY = 'auditeeProfile';
const CLIENT_REGISTRATIONS_KEY = 'cms_client_registrations';

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

const AUDIT_TYPES = ['Initial Audit', 'Surveillance 1', 'Surveillance 2', 'Transfer', 'Recertification'];

const safeJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
};

const today = (): string => new Date().toISOString().split('T')[0];

/* -----------------------------------------------------------
   Page
----------------------------------------------------------- */

const PendingApplications: React.FC = () => {
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [auditeeEmail, setAuditeeEmail] = useState<string>('');
  const [filling, setFilling] = useState<DispatchRecord | null>(null);
  const [viewing, setViewing] = useState<DispatchRecord | null>(null);
  const [form, setForm] = useState<{
    address: string;
    industry: string;
    employees: string;
    standardsInterested: string[];
    preferredStart: string;
    preferredEnd: string;
    additionalNotes: string;
  }>({
    address: '',
    industry: '',
    employees: '',
    standardsInterested: [],
    preferredStart: today(),
    preferredEnd: today(),
    additionalNotes: '',
  });
  const [notification, setNotification] = useState<string | null>(null);
  const [qcsFormFor, setQcsFormFor] = useState<{ id: number; mode: QCSFormMode } | null>(null);

  // Load on mount
  const refresh = () => {
    setDispatches(safeJSON<DispatchRecord[]>(STORAGE_KEY, []));
    const profile = safeJSON<any>(AUDITEE_PROFILE_KEY, null);
    const profileEmail = profile?.email || '';
    // Fallback: try to read the matched client registration's email
    if (profileEmail) {
      setAuditeeEmail(profileEmail);
    } else {
      // If the Auditee logged in but has no profile email, try matching by name
      // against the registered clients table — best effort, common in demos.
      const clients = safeJSON<any[]>(CLIENT_REGISTRATIONS_KEY, []);
      if (clients.length === 1) setAuditeeEmail(clients[0].email || '');
    }
  };

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === AUDITEE_PROFILE_KEY || e.key === null) {
        refresh();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // Filter dispatches addressed to this Auditee — by email match, or show all in demo mode
  const myApplications = useMemo(() => {
    const lower = (auditeeEmail || '').toLowerCase().trim();
    if (!lower) return dispatches;
    return dispatches.filter(
      (d) => (d.email || '').toLowerCase().trim() === lower
    );
  }, [dispatches, auditeeEmail]);

  const pendingFill = myApplications.filter((d) => !d.clientSubmittedAt);
  const submitted = myApplications.filter((d) => d.clientSubmittedAt);

  /* -------- Form handlers -------- */
  const startFill = (d: DispatchRecord) => {
    setFilling(d);
    const existing = d.clientFormFields || {};
    setForm({
      address: existing.address || '',
      industry: existing.industry || '',
      employees: existing.employees || '',
      standardsInterested: existing.standardsInterested || (d.standard ? [d.standard] : []),
      preferredStart: existing.preferredStart || d.preferredStart || today(),
      preferredEnd: existing.preferredEnd || d.preferredEnd || today(),
      additionalNotes: existing.additionalNotes || '',
    });
  };

  const closeFill = () => setFilling(null);

  const setF = (k: keyof typeof form, v: any) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const toggleStandard = (s: string) => {
    setForm((prev) => ({
      ...prev,
      standardsInterested: prev.standardsInterested.includes(s)
        ? prev.standardsInterested.filter((x) => x !== s)
        : [...prev.standardsInterested, s],
    }));
  };

  const handleSubmit = () => {
    if (!filling) return;
    if (!form.address.trim()) {
      alert('Please add your registered address.');
      return;
    }
    if (form.standardsInterested.length === 0) {
      alert('Please select at least one standard of interest.');
      return;
    }
    const submittedAt = new Date().toISOString();
    const next = dispatches.map((d) =>
      d.id === filling.id
        ? {
            ...d,
            status: 'Received',
            clientSubmittedAt: submittedAt,
            clientFormFields: { ...form },
            // Mirror preferred dates onto the dispatch record so the Coordinator's
            // existing fields show the Auditee's input.
            preferredStart: form.preferredStart,
            preferredEnd: form.preferredEnd,
          }
        : d
    );
    setDispatches(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    closeFill();
    setNotification('Application submitted to the Audit Coordinator.');
  };

  /* -------- Render -------- */
  return (
    <div style={{ padding: '0 8px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 700,
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Inbox size={26} color="#2563eb" /> Pending Applications
        </h1>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
          The Audit Coordinator has sent you an application form. Open it, fill in your
          organisation details, and submit back. You can return later to check the status.
        </p>
      </div>

      {/* Notification */}
      {notification && (
        <div
          style={{
            background: '#dcfce7',
            border: '1px solid #86efac',
            color: '#15803d',
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 14,
            fontSize: 13,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle2 size={14} /> {notification}
        </div>
      )}

      {/* Stat row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
          marginBottom: 18,
        }}
      >
        <Stat
          color="#f59e0b"
          icon={<AlertCircle size={18} />}
          label="Awaiting your input"
          value={pendingFill.length}
        />
        <Stat
          color="#16a34a"
          icon={<CheckCircle2 size={18} />}
          label="Submitted"
          value={submitted.length}
        />
        <Stat
          color="#0ea5e9"
          icon={<FileText size={18} />}
          label="Total applications"
          value={myApplications.length}
        />
      </div>

      {!auditeeEmail && (
        <div
          style={{
            background: '#fef9c3',
            border: '1px solid #fde047',
            color: '#854d0e',
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 14,
            fontSize: 13,
          }}
        >
          We couldn't detect your account email — showing all applications in storage as a
          fallback. To filter to your own applications, save your email in the Auditee profile.
        </div>
      )}

      {/* To-fill list */}
      <Section
        title="Awaiting your input"
        subtitle="The Coordinator is waiting on these. Open each and fill in the details."
        empty={pendingFill.length === 0 ? 'Nothing to fill in right now.' : undefined}
      >
        {pendingFill.map((d) => (
          <ApplicationCard
            key={d.id}
            d={d}
            primaryAction={{
              label: 'Fill Application',
              icon: <FileText size={14} />,
              color: '#2563eb',
              onClick: () => startFill(d),
            }}
            secondaryAction={{
              label: loadQCSRecord(d.id)?.submittedAt ? 'View QCS form' : 'Fill QCS form',
              onClick: () => setQcsFormFor({ id: d.id, mode: loadQCSRecord(d.id)?.submittedAt ? 'view' : 'fill' }),
            }}
            onView={() => setViewing(d)}
          />
        ))}
      </Section>

      {/* Submitted list */}
      <div style={{ marginTop: 24 }}>
        <Section
          title="Submitted"
          subtitle="You've sent these back. Awaiting Coordinator review."
          empty={submitted.length === 0 ? "You haven't submitted anything yet." : undefined}
        >
          {submitted.map((d) => (
            <ApplicationCard
              key={d.id}
              d={d}
              statusOverride="Submitted"
              statusColor="#16a34a"
              primaryAction={{
                label: 'Review submission',
                icon: <Eye size={14} />,
                color: '#475569',
                onClick: () => setViewing(d),
              }}
              secondaryAction={{
                label: 'Edit & resubmit',
                onClick: () => startFill(d),
              }}
            />
          ))}
        </Section>
      </div>

      {/* View modal */}
      {viewing && (
        <Modal title={`Application — ${viewing.organization}`} onClose={() => setViewing(null)}>
          <ViewRow label="Coordinator sent on" value={formatDate(viewing.dispatchedDate)} icon={<Calendar size={13} />} />
          <ViewRow label="Status" value={viewing.status} />
          <ViewRow label="Standard" value={viewing.standard || '—'} icon={<Tag size={13} />} />
          <ViewRow label="Type" value={viewing.applicationType || '—'} />
          <hr style={{ border: 'none', borderTop: '1px dashed #e2e8f0', margin: '10px 0' }} />
          <ViewRow label="Client name" value={viewing.clientName} />
          <ViewRow label="Organisation" value={viewing.organization} icon={<Building2 size={13} />} />
          <ViewRow label="Email" value={viewing.email} icon={<Mail size={13} />} />
          <ViewRow label="Phone" value={viewing.mobile || '—'} icon={<Phone size={13} />} />
          {viewing.clientSubmittedAt && (
            <>
              <hr style={{ border: 'none', borderTop: '1px dashed #e2e8f0', margin: '10px 0' }} />
              <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600, marginBottom: 8 }}>
                Submitted on {formatDate(viewing.clientSubmittedAt)}
              </div>
              <ViewRow label="Address" value={viewing.clientFormFields?.address || '—'} />
              <ViewRow label="Industry" value={viewing.clientFormFields?.industry || '—'} />
              <ViewRow label="Employees" value={viewing.clientFormFields?.employees || '—'} />
              <ViewRow
                label="Standards"
                value={(viewing.clientFormFields?.standardsInterested || []).join(', ') || '—'}
              />
              <ViewRow
                label="Preferred dates"
                value={`${formatDate(viewing.clientFormFields?.preferredStart)} → ${formatDate(viewing.clientFormFields?.preferredEnd)}`}
              />
              {viewing.clientFormFields?.additionalNotes && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    Additional notes
                  </div>
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      padding: 10,
                      borderRadius: 8,
                      marginTop: 4,
                      fontSize: 13,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {viewing.clientFormFields.additionalNotes}
                  </div>
                </div>
              )}
            </>
          )}
          {viewing.attachment && (
            <div style={{ marginTop: 12 }}>
              <a
                href={viewing.attachment.dataUrl}
                download={viewing.attachment.name}
                style={{ fontSize: 13, color: '#2563eb', fontWeight: 600 }}
              >
                📎 Download application form: {viewing.attachment.name}
              </a>
            </div>
          )}
          {viewing.agreement && (
            <div style={{ marginTop: 4 }}>
              <a
                href={viewing.agreement.dataUrl}
                download={viewing.agreement.name}
                style={{ fontSize: 13, color: '#7c3aed', fontWeight: 600 }}
              >
                📋 Download agreement: {viewing.agreement.name}
              </a>
            </div>
          )}
        </Modal>
      )}

      {/* QCS Application Form modal */}
      {qcsFormFor && (() => {
        const target = myApplications.find((d) => d.id === qcsFormFor.id);
        return (
          <QCSApplicationForm
            dispatchId={qcsFormFor.id}
            mode={qcsFormFor.mode}
            onClose={() => setQcsFormFor(null)}
            onSubmitted={() => setNotification('QCS application form submitted to the Audit Coordinator.')}
            prefill={target ? {
              organizationName: target.organization,
              contactPersonName: target.clientName,
              contactMobile: target.mobile || '',
              contactEmail: target.email,
              schemes: target.standard ? [target.standard.split(':')[0].trim()] : [],
            } : undefined}
          />
        );
      })()}

      {/* Fill form modal */}
      {filling && (
        <Modal
          title={`Fill Application — ${filling.organization}`}
          onClose={closeFill}
          width={780}
        >
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              padding: '10px 14px',
              borderRadius: 8,
              marginBottom: 14,
              fontSize: 13,
              color: '#1e3a8a',
            }}
          >
            Confirm the details the Coordinator pre-filled and complete the rest.
          </div>

          {/* Pre-filled (read-only-ish) */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: 12,
              borderRadius: 10,
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>
              Sent by Coordinator
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
              <div><strong>Client Name:</strong> {filling.clientName}</div>
              <div><strong>Organisation:</strong> {filling.organization}</div>
              <div><strong>Contact No:</strong> {filling.mobile || '—'}</div>
              <div><strong>Email:</strong> {filling.email}</div>
              <div><strong>Enquiry Date:</strong> {formatDate(filling.dispatchedDate)}</div>
              <div><strong>Status:</strong> <span style={{ color: '#1e40af', fontWeight: 600 }}>{filling.status}</span></div>
            </div>
            {filling.attachment && (
              <a
                href={filling.attachment.dataUrl}
                download={filling.attachment.name}
                style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: '#2563eb', fontWeight: 600 }}
              >
                📎 Download the application form template ({filling.attachment.name})
              </a>
            )}
          </div>

          {/* Digital form */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Address *" full>
              <textarea
                value={form.address}
                onChange={(e) => setF('address', e.target.value)}
                rows={2}
                placeholder="Registered office address"
                style={{ ...inp, minHeight: 60, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Field>

            <Field label="Industry">
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

            <Field label="Approx. number of employees">
              <input
                value={form.employees}
                onChange={(e) => setF('employees', e.target.value)}
                style={inp}
                placeholder="e.g. 50 — 100"
              />
            </Field>

            <Field label="Standards of interest *" full>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {STANDARDS_OPTIONS.map((s) => {
                  const on = form.standardsInterested.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStandard(s)}
                      style={{
                        padding: '5px 10px',
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

            <Field label="Audit Type" full>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {AUDIT_TYPES.map((t) => {
                  const on = filling.applicationType === t;
                  return (
                    <span
                      key={t}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 14,
                        border: '1px solid ' + (on ? '#0ea5e9' : '#cbd5e1'),
                        background: on ? '#dbeafe' : '#fff',
                        color: on ? '#1e40af' : '#475569',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {t} {on && '· selected'}
                    </span>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Set by the Coordinator. Reach out if this needs to change.
              </div>
            </Field>

            <Field label="Preferred audit start">
              <input
                type="date"
                value={form.preferredStart.slice(0, 10)}
                onChange={(e) => setF('preferredStart', e.target.value)}
                style={inp}
              />
            </Field>

            <Field label="Preferred audit end">
              <input
                type="date"
                value={form.preferredEnd.slice(0, 10)}
                onChange={(e) => setF('preferredEnd', e.target.value)}
                style={inp}
              />
            </Field>

            <Field label="Additional notes" full>
              <textarea
                value={form.additionalNotes}
                onChange={(e) => setF('additionalNotes', e.target.value)}
                rows={3}
                placeholder="Anything else the Coordinator should know?"
                style={{ ...inp, minHeight: 70, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Field>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 16,
              borderTop: '1px solid #e2e8f0',
              paddingTop: 14,
            }}
          >
            <button
              onClick={closeFill}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#16a34a',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Send size={14} /> Submit to Coordinator
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

/* -----------------------------------------------------------
   Sub-components
----------------------------------------------------------- */

const Stat: React.FC<{ color: string; icon: React.ReactNode; label: string; value: number }> = ({
  color, icon, label, value,
}) => (
  <div
    style={{
      background: '#fff',
      borderRadius: 10,
      padding: 14,
      borderLeft: `4px solid ${color}`,
      boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}
  >
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        background: color + '20',
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
    </div>
  </div>
);

const Section: React.FC<{
  title: string;
  subtitle: string;
  empty?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, empty, children }) => (
  <div>
    <div style={{ marginBottom: 8 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{subtitle}</p>
    </div>
    {empty ? (
      <div
        style={{
          background: '#fff',
          border: '1px dashed #cbd5e1',
          borderRadius: 10,
          padding: 24,
          color: '#64748b',
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        {empty}
      </div>
    ) : (
      <div style={{ display: 'grid', gap: 10 }}>{children}</div>
    )}
  </div>
);

interface ActionDef {
  label: string;
  icon?: React.ReactNode;
  color?: string;
  onClick: () => void;
}

const ApplicationCard: React.FC<{
  d: DispatchRecord;
  primaryAction: ActionDef;
  secondaryAction?: ActionDef;
  statusOverride?: string;
  statusColor?: string;
  onView?: () => void;
}> = ({ d, primaryAction, secondaryAction, statusOverride, statusColor, onView }) => (
  <div
    style={{
      background: '#fff',
      borderRadius: 10,
      border: '1px solid #e2e8f0',
      padding: 14,
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 14,
      alignItems: 'center',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    }}
  >
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Building2 size={14} color="#475569" />
        <strong style={{ fontSize: 14, color: '#0f172a' }}>{d.organization}</strong>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 12,
            background: (statusColor || '#1e40af') + '20',
            color: statusColor || '#1e40af',
          }}
        >
          {statusOverride || d.status}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: '#64748b' }}>
        <span>👤 {d.clientName}</span>
        <span><Mail size={11} style={{ verticalAlign: '-1px' }} /> {d.email}</span>
        {d.mobile && <span><Phone size={11} style={{ verticalAlign: '-1px' }} /> {d.mobile}</span>}
        <span><Calendar size={11} style={{ verticalAlign: '-1px' }} /> Sent {formatDate(d.dispatchedDate)}</span>
        {d.standard && <span><Tag size={11} style={{ verticalAlign: '-1px' }} /> {d.standard}</span>}
      </div>
      {d.clientSubmittedAt && (
        <div style={{ fontSize: 11, color: '#15803d', marginTop: 4, fontWeight: 600 }}>
          ✓ Submitted on {formatDate(d.clientSubmittedAt)}
        </div>
      )}
    </div>
    <div style={{ display: 'flex', gap: 6 }}>
      {onView && (
        <button
          onClick={onView}
          title="View details"
          style={{
            padding: '7px 12px',
            borderRadius: 6,
            border: '1px solid #e2e8f0',
            background: '#fff',
            color: '#475569',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Eye size={13} />
        </button>
      )}
      {secondaryAction && (
        <button
          onClick={secondaryAction.onClick}
          style={{
            padding: '7px 12px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: '#fff',
            color: '#475569',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {secondaryAction.label}
        </button>
      )}
      <button
        onClick={primaryAction.onClick}
        style={{
          padding: '7px 14px',
          borderRadius: 6,
          border: 'none',
          background: primaryAction.color || '#2563eb',
          color: '#fff',
          fontWeight: 600,
          fontSize: 12,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        {primaryAction.icon}
        {primaryAction.label}
      </button>
    </div>
  </div>
);

const Field: React.FC<{ label: string; full?: boolean; children: React.ReactNode }> = ({
  label, full, children,
}) => (
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
    {label}
    {children}
  </label>
);

const inp: React.CSSProperties = {
  width: '100%',
  padding: 8,
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const ViewRow: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({
  label, value, icon,
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '160px 1fr',
      gap: 8,
      padding: '4px 0',
      fontSize: 13,
      alignItems: 'center',
    }}
  >
    <span style={{ color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {icon} {label}
    </span>
    <span style={{ color: '#0f172a', fontWeight: 500 }}>{value}</span>
  </div>
);

const Modal: React.FC<{
  title: string;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}> = ({ title, onClose, width = 540, children }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 16,
    }}
    onClick={onClose}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 22,
        width: `min(${width}px, 96vw)`,
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
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
        <h3 style={{ margin: 0, fontSize: 17, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={16} /> {title}
        </h3>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default PendingApplications;
