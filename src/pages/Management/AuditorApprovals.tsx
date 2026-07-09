/**
 * Management → Auditor Approvals
 *
 * Shows every auditor join request, with the focus on those forwarded by
 * the Audit Coordinator that need Management's final approval.
 *
 * The page is read+write — Management can:
 *   - Approve a forwarded request   → status: 'Approved'
 *   - Reject a forwarded request    → status: 'Rejected' (with reason)
 *   - Send back to Coordinator      → status: 'Under Review'
 *
 * Data lives in `cms_auditor_requests_v1` (same store the Coordinator's
 * "Auditor Requests" page writes to). The page broadcasts the standard
 * `cms-workflow-handoff` event so every other open role page refreshes.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowLeftRight,
  Mail,
  Phone,
  Globe,
  Briefcase,
  Calendar,
  FileText,
  Filter,
} from 'lucide-react';

type RequestStatus =
  | 'New' | 'Form Sent' | 'Form Returned' | 'Under Review'
  | 'Forwarded to Management' | 'Approved' | 'Rejected';

interface AuditorRequest {
  id: string;
  receivedAt: string;
  source: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  role: string;
  specialization: string;
  yearsOverall: string;
  yearsAudit: string;
  department: string;
  certifications: string[];
  message: string;
  status: RequestStatus;
  notes: string;
  formSentAt?: string;
  formReturnedAt?: string;
  uploadedDocs?: { kind: string; name: string; uploadedAt: string }[];
  reviewedByCoordinator?: { by: string; at: string; note?: string };
  reviewedByLeadAuditor?: { by: string; at: string; note?: string };
  forwardedToManagementAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

const STORAGE_KEY = 'cms_auditor_requests_v1';

const STATUS_COLORS: Record<RequestStatus, { bg: string; fg: string }> = {
  New:                       { bg: '#dbeafe', fg: '#1e40af' },
  'Form Sent':               { bg: '#fef3c7', fg: '#a16207' },
  'Form Returned':           { bg: '#e9d5ff', fg: '#7e22ce' },
  'Under Review':            { bg: '#fed7aa', fg: '#9a3412' },
  'Forwarded to Management': { bg: '#cffafe', fg: '#0e7490' },
  Approved:                  { bg: '#dcfce7', fg: '#15803d' },
  Rejected:                  { bg: '#fee2e2', fg: '#b91c1c' },
};

const readReqs = (): AuditorRequest[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuditorRequest[]) : [];
  } catch { return []; }
};

const writeReqs = (reqs: AuditorRequest[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reqs));
    window.dispatchEvent(new CustomEvent('cms-workflow-handoff'));
  } catch { /* ignore */ }
};

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const ManagementAuditorApprovals: React.FC = () => {
  const [reqs, setReqs] = useState<AuditorRequest[]>(() => readReqs());
  const [filter, setFilter] = useState<'Pending' | 'Approved' | 'Rejected' | 'All'>('Pending');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AuditorRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Live refresh when other pages mutate the same store
  useEffect(() => {
    const refresh = () => setReqs(readReqs());
    window.addEventListener('cms-workflow-handoff', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('cms-workflow-handoff', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const visible = useMemo(() => {
    return reqs.filter((r) => {
      if (filter === 'Pending' && r.status !== 'Forwarded to Management') return false;
      if (filter === 'Approved' && r.status !== 'Approved') return false;
      if (filter === 'Rejected' && r.status !== 'Rejected') return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [r.name, r.email, r.country, r.role, r.specialization, r.department].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reqs, filter, search]);

  // Stats banner
  const stats = useMemo(() => ({
    pending:  reqs.filter((r) => r.status === 'Forwarded to Management').length,
    approved: reqs.filter((r) => r.status === 'Approved').length,
    rejected: reqs.filter((r) => r.status === 'Rejected').length,
    underReview: reqs.filter((r) => r.status === 'Under Review').length,
    total:    reqs.length,
  }), [reqs]);

  const mutate = (id: string, change: Partial<AuditorRequest>) => {
    const updated = reqs.map((r) => r.id === id ? { ...r, ...change } : r);
    setReqs(updated);
    writeReqs(updated);
    if (selected?.id === id) setSelected({ ...selected, ...change });
  };

  const approve = (r: AuditorRequest) =>
    mutate(r.id, {
      status: 'Approved',
      approvedAt: new Date().toISOString(),
      approvedBy: 'Management',
    });

  const sendBack = (r: AuditorRequest) =>
    mutate(r.id, {
      status: 'Under Review',
      notes: (r.notes ? r.notes + '\n' : '') + `[${new Date().toLocaleDateString()}] Sent back to coordinator for more info.`,
    });

  const reject = (r: AuditorRequest, reason: string) => {
    mutate(r.id, {
      status: 'Rejected',
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason || 'Not specified',
    });
    setRejectReason('');
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          background: '#ede9fe', color: '#7c3aed', width: 40, height: 40,
          borderRadius: 10, display: 'grid', placeItems: 'center',
        }}>
          <ShieldCheck size={22} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Auditor Approvals</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
            Auditor requests forwarded by the Audit Coordinator — review credentials and issue final approval.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Awaiting Mgmt',    value: stats.pending,     color: '#0e7490', bg: '#cffafe' },
          { label: 'Under Review',     value: stats.underReview, color: '#9a3412', bg: '#fed7aa' },
          { label: 'Approved',         value: stats.approved,    color: '#15803d', bg: '#dcfce7' },
          { label: 'Rejected',         value: stats.rejected,    color: '#b91c1c', bg: '#fee2e2' },
          { label: 'Total received',   value: stats.total,       color: '#1f2937', bg: '#e5e7eb' },
        ].map((s, i) => (
          <div key={i} style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: 14, boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
          }}>
            <div style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>
              {s.label}
            </div>
            <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Filter size={14} color="#64748b" />
        <span style={{ fontSize: 12, color: '#64748b' }}>Filter:</span>
        {(['Pending', 'Approved', 'Rejected', 'All'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              border: '1px solid ' + (filter === f ? '#0f172a' : '#cbd5e1'),
              background: filter === f ? '#0f172a' : '#fff',
              color: filter === f ? '#fff' : '#475569',
              padding: '4px 12px', borderRadius: 999,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {f}
          </button>
        ))}
        <div style={{ position: 'relative', marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, color: '#94a3b8' }} />
          <input
            type="text" placeholder="Search by name, country, spec…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '6px 10px 6px 30px', borderRadius: 6, border: '1px solid #cbd5e1', width: 280, fontSize: 13, outline: 'none' }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: '#f1f5f9' }}>
            <tr>
              {['Auditor', 'Role · Specialisation', 'Country', 'Years', 'Coordinator note', 'Status', 'Actions'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#475569', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>No requests match this filter.</td></tr>
            ) : visible.map((r) => {
              const sc = STATUS_COLORS[r.status];
              return (
                <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{r.email}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div>{r.role}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{r.specialization || '—'}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{r.country || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {r.yearsOverall || '—'} <span style={{ color: '#94a3b8' }}>· audit</span> {r.yearsAudit || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', maxWidth: 240, color: '#475569' }}>
                    {r.reviewedByCoordinator?.note ?? <span style={{ color: '#94a3b8' }}>—</span>}
                    {r.forwardedToManagementAt && (
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Forwarded {fmt(r.forwardedToManagementAt)}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: sc.bg, color: sc.fg, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      onClick={() => setSelected(r)}
                      style={{ background: '#0e7490', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Review modal */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
            display: 'grid', placeItems: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12, width: 'min(680px, 92vw)',
              maxHeight: '90vh', overflow: 'auto', padding: 24,
              boxShadow: '0 24px 60px rgba(15,23,42,0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{selected.name}</h2>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{selected.role} · {selected.specialization || '—'}</div>
              </div>
              <span style={{ background: STATUS_COLORS[selected.status].bg, color: STATUS_COLORS[selected.status].fg, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                {selected.status}
              </span>
            </div>

            {/* Profile facts */}
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: 13 }}>
              <Fact icon={<Mail size={14} />}     label="Email"    value={selected.email} />
              <Fact icon={<Phone size={14} />}    label="Phone"    value={selected.phone || '—'} />
              <Fact icon={<Globe size={14} />}    label="Country"  value={selected.country || '—'} />
              <Fact icon={<Briefcase size={14} />} label="Dept"    value={selected.department || '—'} />
              <Fact icon={<Calendar size={14} />} label="Yrs overall" value={selected.yearsOverall || '—'} />
              <Fact icon={<Calendar size={14} />} label="Yrs audit"   value={selected.yearsAudit || '—'} />
            </div>

            {/* Certifications */}
            {selected.certifications?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4 }}>Certifications held</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selected.certifications.map((c) => (
                    <span key={c} style={{ background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Uploaded documents */}
            {selected.uploadedDocs && selected.uploadedDocs.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4 }}>Documents uploaded</h4>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selected.uploadedDocs.map((d, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569' }}>
                      <FileText size={14} color="#0e7490" />
                      <strong style={{ color: '#0f172a' }}>{d.kind}:</strong>
                      {d.name}
                      <span style={{ color: '#94a3b8' }}>· {fmt(d.uploadedAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Coordinator + Lead Auditor review trail */}
            {(selected.reviewedByCoordinator || selected.reviewedByLeadAuditor) && (
              <div style={{ marginTop: 14, padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4 }}>Review trail</h4>
                {selected.reviewedByCoordinator && (
                  <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                    <strong>Coordinator:</strong> {selected.reviewedByCoordinator.by} · {fmt(selected.reviewedByCoordinator.at)}
                    {selected.reviewedByCoordinator.note && <div style={{ color: '#64748b' }}>“{selected.reviewedByCoordinator.note}”</div>}
                  </div>
                )}
                {selected.reviewedByLeadAuditor && (
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    <strong>Lead Auditor:</strong> {selected.reviewedByLeadAuditor.by} · {fmt(selected.reviewedByLeadAuditor.at)}
                    {selected.reviewedByLeadAuditor.note && <div style={{ color: '#64748b' }}>“{selected.reviewedByLeadAuditor.note}”</div>}
                  </div>
                )}
              </div>
            )}

            {/* Rejection reason input only if currently pending */}
            {selected.status === 'Forwarded to Management' && (
              <div style={{ marginTop: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#475569', fontWeight: 700, marginBottom: 4 }}>
                  Optional rejection reason
                </label>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="If rejecting, briefly note why"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                />
              </div>
            )}

            {/* Actions */}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {selected.status === 'Forwarded to Management' && (
                <>
                  <button
                    onClick={() => sendBack(selected)}
                    title="Return to coordinator for more info"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid #cbd5e1', color: '#475569', padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <ArrowLeftRight size={14} /> Send back
                  </button>
                  <button
                    onClick={() => reject(selected, rejectReason)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#b91c1c', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <XCircle size={14} /> Reject
                  </button>
                  <button
                    onClick={() => approve(selected)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#15803d', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <CheckCircle2 size={14} /> Approve
                  </button>
                </>
              )}
              <button
                onClick={() => setSelected(null)}
                style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Fact: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ color: '#64748b' }}>{icon}</span>
    <span style={{ color: '#64748b', fontSize: 12 }}>{label}:</span>
    <span style={{ color: '#0f172a', fontWeight: 600 }}>{value}</span>
  </div>
);

export default ManagementAuditorApprovals;
