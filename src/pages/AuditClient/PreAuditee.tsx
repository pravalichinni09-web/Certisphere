/**
 * Pre-Auditee
 *
 * Everything that happens BEFORE an entity becomes a fully registered
 * Auditee, consolidated into one view inside the Auditee role.
 *
 * Pulls from three live stores (read-only):
 *   - `cms_client_enquiries_v1`        → website / public enquiries
 *   - `cms_application_dispatch_v7`    → application dispatches sent
 *                                         (links / emails / WhatsApp)
 *   - `cms_audit_workflow`             → workflow rows still at
 *                                         Pre-Registration / Registration
 *                                         Submitted
 *
 * Each row exposes the actual mail/WhatsApp/portal links the coordinator
 * sent, the application form link, the documents attached, and what stage
 * the entity is currently sitting at.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Globe, Inbox, FileText, Link2, Search, MessageCircle, Clock, ChevronRight } from 'lucide-react';
import { readWorkflows, WorkflowRecord } from '../../utils/auditWorkflow';

/* ---------- Data shapes ------------------------------------------------- */

interface Enquiry {
  id: string;
  receivedAt: string;
  source?: string;
  company: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website?: string;
  country?: string;
  industry?: string;
  employees?: string;
  standards: string[];
  message?: string;
  status: string;
  notes?: string;
  convertedClientId?: string;
  convertedAt?: string;
}

interface Dispatch {
  id: number;
  clientName: string;
  organization: string;
  mobile?: string;
  applicationType?: string;
  standard?: string;
  email: string;
  dispatchedDate: string;
  status: string;
  contactName?: string;
  reviewDate?: string;
  attachment?: { name: string; dataUrl: string; size: number; uploadedAt: string };
  agreement?: { name: string; dataUrl: string; size: number; uploadedAt: string };
  rejectNote?: string;
  link: string;
  auditType?: string;
  preferredStart?: string;
  preferredEnd?: string;
  auditScope?: string;
}

/* ---------- I/O --------------------------------------------------------- */

const safeJSON = <T,>(key: string, fallback: T): T => {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fallback; } catch { return fallback; }
};

const ENQUIRY_KEY  = 'cms_client_enquiries_v1';
const DISPATCH_KEY = 'cms_application_dispatch_v7';

/* ---------- Helpers ----------------------------------------------------- */

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const PreAuditee: React.FC = () => {
  const navigate = useNavigate();
  const [enquiries, setEnquiries] = useState<Enquiry[]>(() => safeJSON(ENQUIRY_KEY, []));
  const [dispatches, setDispatches] = useState<Dispatch[]>(() => safeJSON(DISPATCH_KEY, []));
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>(() => readWorkflows());
  const [tab, setTab] = useState<'overview' | 'enquiries' | 'dispatches' | 'workflow'>('overview');
  const [search, setSearch] = useState('');

  // Live refresh
  useEffect(() => {
    const refresh = () => {
      setEnquiries(safeJSON(ENQUIRY_KEY, []));
      setDispatches(safeJSON(DISPATCH_KEY, []));
      setWorkflows(readWorkflows());
    };
    window.addEventListener('cms-workflow-handoff', refresh);
    window.addEventListener('audit-workflow-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('cms-workflow-handoff', refresh);
      window.removeEventListener('audit-workflow-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Pre-auditee workflow rows = entities still at Pre-Registration / Registration Submitted
  const preWorkflow = useMemo(
    () => workflows.filter((w) => w.currentStage === 'Pre-Registration' || w.currentStage === 'Registration Submitted'),
    [workflows],
  );

  // Filter helpers
  const matchSearch = (txt: string) => txt.toLowerCase().includes(search.toLowerCase().trim());
  const visEnq = useMemo(() =>
    enquiries.filter((e) => !search || matchSearch([e.company, e.contactName, e.contactEmail, e.country, e.industry].filter(Boolean).join(' '))),
    [enquiries, search],
  );
  const visDisp = useMemo(() =>
    dispatches.filter((d) => !search || matchSearch([d.organization, d.clientName, d.email, d.standard].filter(Boolean).join(' '))),
    [dispatches, search],
  );

  /* ---------- Render ----------------------------------------------------- */

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <button
        onClick={() => navigate('/audit-client/dashboard')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#0e7490', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 12, padding: 0 }}
      >
        <ArrowLeft size={14} /> Back to Auditee Dashboard
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <div style={{
          background: '#fef3c7', color: '#a16207', width: 40, height: 40,
          borderRadius: 10, display: 'grid', placeItems: 'center',
        }}>
          <Inbox size={22} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Pre-Auditee</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
            Everything that happens before an organisation becomes a registered Auditee — enquiries, application dispatches, mail links, and pending applications.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 16, marginBottom: 16 }}>
        <StatCard label="Enquiries" value={enquiries.length} hint="Public site + email leads" color="#7c3aed" bg="#ede9fe" />
        <StatCard label="App. dispatches sent" value={dispatches.length} hint="Forms emailed / WhatsApped" color="#0e7490" bg="#cffafe" />
        <StatCard label="Pre-registration rows" value={preWorkflow.length} hint="Workflows pre-stage 3" color="#a16207" bg="#fef3c7" />
        <StatCard label="Converted to clients" value={enquiries.filter((e) => !!e.convertedClientId).length} hint="Became registered Auditees" color="#15803d" bg="#dcfce7" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #e2e8f0', marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { k: 'overview',   label: 'Overview' },
          { k: 'enquiries',  label: `Enquiries (${enquiries.length})` },
          { k: 'dispatches', label: `App. Dispatches (${dispatches.length})` },
          { k: 'workflow',   label: `Pre-Registration Workflow (${preWorkflow.length})` },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as typeof tab)}
            style={{
              background: 'transparent', border: 'none',
              padding: '10px 14px', fontSize: 13, fontWeight: 700,
              color: tab === t.k ? '#0e7490' : '#64748b',
              borderBottom: '2px solid ' + (tab === t.k ? '#0e7490' : 'transparent'),
              cursor: 'pointer',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Search */}
      {tab !== 'overview' && (
        <div style={{ position: 'relative', marginBottom: 14, maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#94a3b8' }} />
          <input
            placeholder="Search organisation, contact, country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
          />
        </div>
      )}

      {/* Body */}
      {tab === 'overview'   && <OverviewPanel enquiries={enquiries} dispatches={dispatches} preWorkflow={preWorkflow} onJump={setTab} />}
      {tab === 'enquiries'  && <EnquiriesPanel enquiries={visEnq} />}
      {tab === 'dispatches' && <DispatchesPanel dispatches={visDisp} />}
      {tab === 'workflow'   && <WorkflowPanel rows={preWorkflow} />}
    </div>
  );
};

/* ---------- Sub-panels -------------------------------------------------- */

const StatCard: React.FC<{ label: string; value: number; hint?: string; color: string; bg: string }> = ({ label, value, hint, color, bg }) => (
  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
    <div style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: bg, color, fontSize: 11, fontWeight: 700 }}>{label}</div>
    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{value}</div>
    {hint && <div style={{ fontSize: 11, color: '#94a3b8' }}>{hint}</div>}
  </div>
);

const OverviewPanel: React.FC<{
  enquiries: Enquiry[];
  dispatches: Dispatch[];
  preWorkflow: WorkflowRecord[];
  onJump: (t: 'overview' | 'enquiries' | 'dispatches' | 'workflow') => void;
}> = ({ enquiries, dispatches, preWorkflow, onJump }) => {
  const latestEnq = [...enquiries].sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt)).slice(0, 3);
  const latestDisp = [...dispatches].sort((a, b) => +new Date(b.dispatchedDate) - +new Date(a.dispatchedDate)).slice(0, 3);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <OverviewCard
        title="Latest enquiries"
        emptyMsg="No enquiries received yet."
        items={latestEnq.length}
        onSeeAll={() => onJump('enquiries')}
      >
        {latestEnq.map((e) => (
          <div key={e.id} style={{ padding: '8px 0', borderTop: '1px dashed #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong style={{ fontSize: 13, color: '#0f172a' }}>{e.company}</strong>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmtDate(e.receivedAt)}</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{e.contactName} · {e.contactEmail}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{(e.standards || []).join(', ') || '—'}</div>
          </div>
        ))}
      </OverviewCard>

      <OverviewCard
        title="Recent application dispatches"
        emptyMsg="No applications dispatched yet."
        items={latestDisp.length}
        onSeeAll={() => onJump('dispatches')}
      >
        {latestDisp.map((d) => (
          <div key={d.id} style={{ padding: '8px 0', borderTop: '1px dashed #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong style={{ fontSize: 13, color: '#0f172a' }}>{d.organization}</strong>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmtDate(d.dispatchedDate)}</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{d.email} · {d.standard ?? '—'}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Status: {d.status}</div>
          </div>
        ))}
      </OverviewCard>

      <OverviewCard
        title="Pre-registration workflow"
        emptyMsg="Nothing currently at Pre-Registration / Registration Submitted."
        items={preWorkflow.length}
        onSeeAll={() => onJump('workflow')}
        full
      >
        {preWorkflow.slice(0, 5).map((w) => (
          <div key={w.clientId} style={{ padding: '8px 0', borderTop: '1px dashed #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong style={{ fontSize: 13, color: '#0f172a' }}>Client #{w.clientId}</strong>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmtDate(w.updatedAt)}</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Stage: {w.currentStage}</div>
          </div>
        ))}
      </OverviewCard>
    </div>
  );
};

const OverviewCard: React.FC<{
  title: string; emptyMsg: string; items: number; full?: boolean;
  onSeeAll: () => void; children: React.ReactNode;
}> = ({ title, emptyMsg, items, full, onSeeAll, children }) => (
  <div style={{
    gridColumn: full ? 'span 2' : undefined,
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
    padding: 16, boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
      <button
        onClick={onSeeAll}
        style={{ background: 'transparent', border: 'none', color: '#0e7490', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >See all <ChevronRight size={14} /></button>
    </div>
    {items === 0 ? <div style={{ padding: 16, color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>{emptyMsg}</div> : children}
  </div>
);

const EnquiriesPanel: React.FC<{ enquiries: Enquiry[] }> = ({ enquiries }) => {
  const [open, setOpen] = useState<string | null>(null);
  if (enquiries.length === 0)
    return <Empty label="No enquiries found." />;

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead style={{ background: '#f1f5f9' }}>
          <tr>
            {['Received', 'Organisation', 'Contact', 'Country / Industry', 'Standards', 'Status', ''].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#475569', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {enquiries.map((e) => (
            <React.Fragment key={e.id}>
              <tr style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: '10px 12px', color: '#475569' }}>{fmtDate(e.receivedAt)}</td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{e.company}</div>
                  {e.website && (
                    <a href={e.website} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#0e7490', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Globe size={11} /> {e.website}
                    </a>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div>{e.contactName}</div>
                  <div style={{ fontSize: 11, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {e.contactEmail && <a href={`mailto:${e.contactEmail}`} style={{ color: '#0e7490', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Mail size={11} /> {e.contactEmail}</a>}
                    {e.contactPhone && <a href={`tel:${e.contactPhone}`} style={{ color: '#0e7490', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Phone size={11} /> {e.contactPhone}</a>}
                  </div>
                </td>
                <td style={{ padding: '10px 12px', color: '#475569' }}>{e.country || '—'} <span style={{ color: '#94a3b8' }}>·</span> {e.industry || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#475569' }}>{(e.standards || []).join(', ') || '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{e.status}</span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <button
                    onClick={() => setOpen(open === e.id ? null : e.id)}
                    style={{ background: '#0e7490', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {open === e.id ? 'Hide' : 'View'}
                  </button>
                </td>
              </tr>
              {open === e.id && (
                <tr style={{ background: '#f8fafc' }}>
                  <td colSpan={7} style={{ padding: '10px 16px' }}>
                    {e.message && <p style={{ margin: 0, fontSize: 12, color: '#475569' }}><strong>Message:</strong> {e.message}</p>}
                    {e.notes && <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#475569' }}><strong>Notes:</strong> {e.notes}</p>}
                    {e.convertedClientId && (
                      <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#15803d' }}>
                        ✔ Converted to client #{e.convertedClientId} on {fmtDate(e.convertedAt)}
                      </p>
                    )}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DispatchesPanel: React.FC<{ dispatches: Dispatch[] }> = ({ dispatches }) => {
  if (dispatches.length === 0)
    return <Empty label="No application dispatches found." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {dispatches.map((d) => (
        <div key={d.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{d.organization}</h4>
              <div style={{ fontSize: 12, color: '#64748b' }}>{d.clientName} · {d.applicationType || 'Application'}{d.auditType ? ` · ${d.auditType}` : ''}</div>
            </div>
            <span style={{
              background: '#fef3c7', color: '#a16207',
              padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
            }}>{d.status}</span>
          </div>

          {/* Contact / link row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginTop: 10 }}>
            {d.email && (
              <a href={`mailto:${d.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#0e7490', textDecoration: 'none', fontSize: 12 }}>
                <Mail size={12} /> {d.email}
              </a>
            )}
            {d.mobile && (
              <a href={`https://wa.me/${d.mobile.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer"
                 style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#15803d', textDecoration: 'none', fontSize: 12 }}>
                <MessageCircle size={12} /> WhatsApp {d.mobile}
              </a>
            )}
            {d.link && (
              <a href={d.link} target="_blank" rel="noreferrer"
                 style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1d4ed8', textDecoration: 'none', fontSize: 12 }}>
                <Link2 size={12} /> Application form link
              </a>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
              <Clock size={12} /> Sent {fmt(d.dispatchedDate)}
            </span>
          </div>

          {/* Scope summary */}
          {(d.auditScope || d.standard) && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#475569' }}>
              {d.standard && <><strong>Standard:</strong> {d.standard}</>}
              {d.standard && d.auditScope && <span style={{ color: '#94a3b8' }}> · </span>}
              {d.auditScope && <><strong>Scope:</strong> {d.auditScope}</>}
            </div>
          )}

          {/* Attachments */}
          {(d.attachment || d.agreement) && (
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {d.attachment && (
                <a href={d.attachment.dataUrl} download={d.attachment.name}
                   style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eef2ff', color: '#4338ca', padding: '4px 10px', borderRadius: 6, textDecoration: 'none', fontSize: 12 }}>
                  <FileText size={12} /> {d.attachment.name}
                </a>
              )}
              {d.agreement && (
                <a href={d.agreement.dataUrl} download={d.agreement.name}
                   style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: 6, textDecoration: 'none', fontSize: 12 }}>
                  <FileText size={12} /> {d.agreement.name}
                </a>
              )}
            </div>
          )}

          {d.rejectNote && (
            <div style={{ marginTop: 8, padding: 8, background: '#fee2e2', color: '#b91c1c', borderRadius: 6, fontSize: 12 }}>
              <strong>Reject note:</strong> {d.rejectNote}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const WorkflowPanel: React.FC<{ rows: WorkflowRecord[] }> = ({ rows }) => {
  if (rows.length === 0) return <Empty label="No entities at Pre-Registration or Registration Submitted right now." />;

  const clients = safeJSON<any[]>('cms_client_registrations', []);
  const labelFor = (id: number) => {
    const c = clients.find((x) => Number(x.id) === Number(id));
    return c ? (c.organizationName || c.name || `Client #${id}`) : `Client #${id}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((w) => (
        <div key={w.clientId} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{labelFor(w.clientId)}</h4>
              <div style={{ fontSize: 12, color: '#64748b' }}>Last updated {fmt(w.updatedAt)}</div>
            </div>
            <span style={{ background: '#fef3c7', color: '#a16207', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
              {w.currentStage}
            </span>
          </div>

          {w.history && w.history.length > 0 && (
            <ol style={{ listStyle: 'none', margin: '10px 0 0 0', padding: 0 }}>
              {w.history.slice(0, 4).map((h, i) => (
                <li key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, fontSize: 12, padding: '4px 0' }}>
                  <span style={{ color: '#94a3b8' }}>{fmtDate(h.at)}</span>
                  <span style={{ color: '#475569' }}>
                    <strong style={{ color: '#0f172a' }}>{h.stage}</strong>{h.by ? ` · ${h.by}` : ''}{h.note ? ` — ${h.note}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
};

const Empty: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ padding: 32, textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: 12, background: '#f8fafc' }}>
    {label}
  </div>
);

export default PreAuditee;
