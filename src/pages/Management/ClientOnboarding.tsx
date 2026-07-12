/**
 * Management → Client Onboarding
 * Approval queue for new clients forwarded by the Audit Coordinator.
 * Each card: client details, attached docs (view-only), Approve / Reject / Send back.
 * Approving a row promotes the client to live (issues credentials) and
 * advances the workflow.
 */
import React, { useEffect, useState } from 'react';
import { Users, CheckCircle2, XCircle, ArrowLeftRight, FileText, Mail, Phone, Globe, Building2, Eye, Search } from 'lucide-react';
import Tooltip from '../../components/Tooltip';
import { ensureCredentialsForClients } from '../AuditorCoordinator/utils/clientCredentials';
import ViewOnlyDoc from '../../components/ViewOnlyDoc';

interface OnboardingClient {
  id: number;
  organizationName: string;
  contactPerson: string;
  email: string;
  phone: string;
  country?: string;
  industry?: string;
  standard?: string;
  status: 'Pending Review' | 'Approved' | 'Rejected' | 'Sent Back';
  forwardedBy?: string;
  forwardedAt?: string;
  coordinatorNote?: string;
  doc?: { name: string; dataUrl: string };
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

const KEY = 'cms_client_onboarding_v1';

const safeJSON = <T,>(k: string, fb: T): T => {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; }
};

const seed = (): OnboardingClient[] => [
  {
    id: 901, organizationName: 'Global Bio Foods Ltd', contactPerson: 'Anika Sharma',
    email: 'anika@globalbio.com', phone: '+91 98765 43210', country: 'India',
    industry: 'Food Processing', standard: 'ISO 22000:2018',
    status: 'Pending Review',
    forwardedBy: 'Praveen Gangarapu (Coordinator)',
    forwardedAt: new Date(Date.now() - 86400000).toISOString(),
    coordinatorNote: 'All docs received, application clean. Recommend approval.',
  },
  {
    id: 902, organizationName: 'NorthStar Aviation', contactPerson: 'James Carter',
    email: 'jcarter@northstaravi.com', phone: '+1 415 555 0142', country: 'USA',
    industry: 'Aviation', standard: 'AS 9100:2016',
    status: 'Pending Review',
    forwardedBy: 'Praveen Gangarapu (Coordinator)',
    forwardedAt: new Date(Date.now() - 7200000).toISOString(),
    coordinatorNote: 'Aviation client — strong references.',
  },
];

const fmt = (iso?: string) => iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const ClientOnboarding: React.FC = () => {
  const [items, setItems] = useState<OnboardingClient[]>(() => {
    const stored = safeJSON<OnboardingClient[]>(KEY, []);
    if (stored.length === 0) {
      const s = seed();
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
      return s;
    }
    return stored;
  });
  const [filter, setFilter] = useState<'Pending Review' | 'Approved' | 'Rejected' | 'All'>('Pending Review');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<OnboardingClient | null>(null);
  const [docOpen, setDocOpen] = useState<{ name: string; dataUrl: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items]);

  const mutate = (id: number, patch: Partial<OnboardingClient>) => {
    setItems(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x));
    if (viewing?.id === id) setViewing({ ...viewing, ...patch });
  };

  const approve = (c: OnboardingClient) => {
    mutate(c.id, { status: 'Approved', approvedAt: new Date().toISOString() });
    // Issue real access: merge into client registrations + generate a login credential.
    try {
      const REG_KEY = 'cms_client_registrations';
      const raw = localStorage.getItem(REG_KEY);
      const regs: any[] = raw ? JSON.parse(raw) : [];
      const exists = regs.some((r) =>
        (r.email || '').toLowerCase() === (c.email || '').toLowerCase() ||
        (r.organizationName || '').toLowerCase() === (c.organizationName || '').toLowerCase());
      if (!exists) {
        const numericIds = regs.map((r) => Number(r.id)).filter(Number.isFinite);
        regs.push({
          id: Math.max(1000, ...numericIds) + 1,
          organizationName: c.organizationName,
          contactPerson: c.contactPerson,
          email: c.email,
          country: (c as any).country || '',
          industry: (c as any).industry || '',
          status: 'Approved',
          clientCode: `CMS-${new Date().getFullYear()}-${String(regs.length + 1).padStart(4, '0')}`,
          registeredAt: new Date().toISOString(),
        });
        localStorage.setItem(REG_KEY, JSON.stringify(regs));
      }
      // Regenerate the credential set for ALL registered clients (keeps existing ones).
      ensureCredentialsForClients(regs.map((r) => ({
        id: Number(r.id),
        organizationName: r.organizationName,
        contactPerson: r.contactPerson,
        email: r.email,
      })));
      window.dispatchEvent(new CustomEvent('cms-workflow-handoff'));
      alert(`✓ ${c.organizationName} approved. Login credentials issued — see Client Credentials.`);
    } catch {
      alert(`✓ ${c.organizationName} approved. (Credential issue failed — check Client Credentials.)`);
    }
  };
  const reject = (c: OnboardingClient, reason: string) => {
    mutate(c.id, { status: 'Rejected', rejectedAt: new Date().toISOString(), rejectionReason: reason || 'Not specified' });
    setRejectReason('');
  };
  const sendBack = (c: OnboardingClient) => {
    mutate(c.id, { status: 'Sent Back' });
  };

  const visible = items.filter(c => {
    if (filter !== 'All' && c.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [c.organizationName, c.contactPerson, c.email, c.country, c.industry].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const stats = {
    pending: items.filter(x => x.status === 'Pending Review').length,
    approved: items.filter(x => x.status === 'Approved').length,
    rejected: items.filter(x => x.status === 'Rejected').length,
    sent_back: items.filter(x => x.status === 'Sent Back').length,
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ background: '#ede9fe', color: '#7c3aed', width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center' }}>
          <Users size={22} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Client Onboarding</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
            Approve new clients forwarded by the Audit Coordinator. Approval promotes the auditee to a live client account.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Awaiting Approval', value: stats.pending, color: '#0e7490', bg: '#cffafe' },
          { label: 'Sent Back', value: stats.sent_back, color: '#9a3412', bg: '#fed7aa' },
          { label: 'Approved', value: stats.approved, color: '#15803d', bg: '#dcfce7' },
          { label: 'Rejected', value: stats.rejected, color: '#b91c1c', bg: '#fee2e2' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>{s.label}</div>
            <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        {(['Pending Review', 'Approved', 'Rejected', 'All'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            border: '1px solid ' + (filter === f ? '#0f172a' : '#cbd5e1'),
            background: filter === f ? '#0f172a' : '#fff',
            color: filter === f ? '#fff' : '#475569',
            padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{f}</button>
        ))}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#94a3b8' }} />
          <input type="text" placeholder="Search organisation, contact, country…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '6px 10px 6px 30px', borderRadius: 6, border: '1px solid #cbd5e1', width: 260, fontSize: 13, outline: 'none' }} />
        </div>
      </div>

      {visible.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: 12, background: '#f8fafc' }}>No clients in this view.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 12 }}>
          {visible.map(c => (
            <article key={c.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{c.organizationName}</h3>
                  <div style={{ fontSize: 11, color: '#64748b' }}>ID #{c.id} · {c.country || '—'} · {c.industry || '—'}</div>
                </div>
                <span style={{ background: c.status === 'Approved' ? '#dcfce7' : c.status === 'Rejected' ? '#fee2e2' : c.status === 'Sent Back' ? '#fed7aa' : '#cffafe', color: c.status === 'Approved' ? '#15803d' : c.status === 'Rejected' ? '#b91c1c' : c.status === 'Sent Back' ? '#9a3412' : '#0e7490', padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>{c.status}</span>
              </header>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12, color: '#475569', marginBottom: 10 }}>
                <span><Mail size={11} style={{ verticalAlign: 'middle' }} /> {c.email}</span>
                <span><Phone size={11} style={{ verticalAlign: 'middle' }} /> {c.phone}</span>
                <span><Globe size={11} style={{ verticalAlign: 'middle' }} /> {c.country || '—'}</span>
                <span><Building2 size={11} style={{ verticalAlign: 'middle' }} /> {c.standard || '—'}</span>
              </div>

              {c.coordinatorNote && (
                <div style={{ padding: 8, background: '#f1f5f9', borderLeft: '3px solid #0e7490', borderRadius: 4, fontSize: 11, color: '#475569', marginBottom: 10 }}>
                  <strong>Coordinator:</strong> {c.coordinatorNote}
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{c.forwardedBy} · {fmt(c.forwardedAt)}</div>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <Tooltip label="View application details">
                  <button onClick={() => setViewing(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#0e7490', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <Eye size={13} /> View
                  </button>
                </Tooltip>
                {c.doc && (
                  <Tooltip label="View attached document (read-only)">
                    <button onClick={() => setDocOpen(c.doc!)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <FileText size={13} /> Document
                    </button>
                  </Tooltip>
                )}
                {c.status === 'Pending Review' && (
                  <>
                    <Tooltip label="Send back to Coordinator for more info">
                      <button onClick={() => sendBack(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', color: '#9a3412', border: '1px solid #fed7aa', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        <ArrowLeftRight size={13} /> Send Back
                      </button>
                    </Tooltip>
                    <Tooltip label="Reject application">
                      <button onClick={() => { const r = prompt('Rejection reason (optional):') || ''; reject(c, r); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#b91c1c', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        <XCircle size={13} /> Reject
                      </button>
                    </Tooltip>
                    <Tooltip label="Approve and onboard as live client">
                      <button onClick={() => approve(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#15803d', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        <CheckCircle2 size={13} /> Approve
                      </button>
                    </Tooltip>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Application detail modal */}
      {viewing && (
        <div onClick={() => setViewing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(7,15,38,0.7)', display: 'grid', placeItems: 'center', zIndex: 900, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(620px, 96vw)', maxHeight: '88vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>{viewing.organizationName}</h2>
                <p style={{ margin: 2, fontSize: 12, color: '#64748b' }}>ID #{viewing.id} · {viewing.country} · {viewing.industry}</p>
              </div>
              <button onClick={() => setViewing(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, color: '#475569', marginBottom: 12 }}>
              <div><strong>Contact:</strong> {viewing.contactPerson}</div>
              <div><strong>Email:</strong> {viewing.email}</div>
              <div><strong>Phone:</strong> {viewing.phone}</div>
              <div><strong>Standard:</strong> {viewing.standard || '—'}</div>
            </div>
            {viewing.coordinatorNote && <div style={{ padding: 10, background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#475569' }}><strong>Coordinator note:</strong> {viewing.coordinatorNote}</div>}
            {viewing.rejectionReason && <div style={{ padding: 10, background: '#fee2e2', color: '#b91c1c', borderRadius: 6, fontSize: 12, marginTop: 8 }}><strong>Rejected:</strong> {viewing.rejectionReason}</div>}
          </div>
        </div>
      )}

      <ViewOnlyDoc
        open={!!docOpen}
        onClose={() => setDocOpen(null)}
        title="Application Document"
        fileName={docOpen?.name}
        dataUrl={docOpen?.dataUrl}
      />

      {/* Suppress unused-warning placeholder for rejectReason setter */}
      <span style={{ display: 'none' }}>{rejectReason}</span>
    </div>
  );
};

export default ClientOnboarding;
