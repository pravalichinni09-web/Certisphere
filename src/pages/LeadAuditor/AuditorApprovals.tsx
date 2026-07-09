import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  ShieldOff,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  User,
  Building2,
  Award,
  Star,
} from 'lucide-react';
import {
  getAuditors,
  saveAuditorsData,
} from '../AuditorCoordinator/utils/dataStorage';
import AIPanel from '../../components/AIPanel';
import { onCmsChange } from '../../ai/liveData';
import { assessAuditorCompetence } from '../../ai/leadAuditorInsights';
import { Auditor } from '../AuditorCoordinator/mockData';

type Tab = 'pending' | 'approved' | 'rejected';

interface ApprovalLogEntry {
  at: string;
  auditorId: number;
  auditorName: string;
  action: 'Approved' | 'Rejected';
  by: string;
  notes?: string;
}

const APPROVAL_LOG_KEY = 'cms_auditor_approval_log_v1';
const LEAD_AUDITOR_NAME_KEY = 'cms_lead_auditor_name';

const loadLog = (): ApprovalLogEntry[] => {
  try {
    const raw = localStorage.getItem(APPROVAL_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ApprovalLogEntry[];
  } catch {
    return [];
  }
};

const saveLog = (entries: ApprovalLogEntry[]) => {
  try {
    localStorage.setItem(APPROVAL_LOG_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
};

const getLeadAuditorName = (): string => {
  try {
    return localStorage.getItem(LEAD_AUDITOR_NAME_KEY) || 'Lead Auditor';
  } catch {
    return 'Lead Auditor';
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

const AuditorApprovals: React.FC = () => {
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [tab, setTab] = useState<Tab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [decisionFor, setDecisionFor] = useState<{
    auditor: Auditor;
    action: 'Approved' | 'Rejected';
  } | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [log, setLog] = useState<ApprovalLogEntry[]>(loadLog());

  // Load auditors on mount and refresh when storage changes elsewhere
  const refresh = () => {
    setAuditors(getAuditors());
    setLog(loadLog());
  };

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === 'cms_auditors_data' ||
        e.key === APPROVAL_LOG_KEY ||
        e.key === null
      ) {
        refresh();
      }
    };
    window.addEventListener('storage', onStorage);
    const onCustom = () => refresh();
    window.addEventListener('cms-auditors-updated', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('cms-auditors-updated', onCustom);
    };
  }, []);

  // --- AI Auditor Competence Insights (feature 11) ---
  const [aiTick, setAiTick] = useState(0);
  useEffect(() => onCmsChange(() => setAiTick((t) => t + 1)), []);
  const pendingCompetence = useMemo(
    () =>
      auditors
        .filter((a) => (a.approvalStatus || 'Pending Approval') === 'Pending Approval')
        .map((a) => ({ id: a.id, insight: assessAuditorCompetence(a) })),
    [auditors, aiTick]
  );

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    auditors.forEach((a) => {
      const s = a.approvalStatus || 'Pending Approval';
      if (s === 'Approved') c.approved++;
      else if (s === 'Rejected') c.rejected++;
      else c.pending++;
    });
    return c;
  }, [auditors]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return auditors.filter((a) => {
      const status = a.approvalStatus || 'Pending Approval';
      if (tab === 'pending' && status !== 'Pending Approval') return false;
      if (tab === 'approved' && status !== 'Approved') return false;
      if (tab === 'rejected' && status !== 'Rejected') return false;
      if (!q) return true;
      const skillKeys = Object.keys(a.skills || {}).join(' ').toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.specialization || '').toLowerCase().includes(q) ||
        (a.department || '').toLowerCase().includes(q) ||
        (a.role || '').toLowerCase().includes(q) ||
        skillKeys.includes(q)
      );
    });
  }, [auditors, tab, searchQuery]);

  const persistDecision = (
    auditor: Auditor,
    action: 'Approved' | 'Rejected',
    notes?: string
  ) => {
    const by = getLeadAuditorName();
    const at = new Date().toISOString();
    const updated = auditors.map((a) =>
      a.id === auditor.id
        ? {
            ...a,
            approvalStatus: action,
            approvedBy: by,
            approvedAt: at,
            approvalNotes: notes || undefined,
            // Approved auditors become Active; rejected stay Inactive
            status: action === 'Approved' ? ('Active' as const) : ('Inactive' as const),
          }
        : a
    );
    setAuditors(updated);
    saveAuditorsData(updated);
    const entry: ApprovalLogEntry = {
      at,
      auditorId: auditor.id,
      auditorName: auditor.name,
      action,
      by,
      notes: notes || undefined,
    };
    const nextLog = [entry, ...log].slice(0, 200);
    setLog(nextLog);
    saveLog(nextLog);
    window.dispatchEvent(new Event('cms-auditors-updated'));
  };

  const openDecision = (auditor: Auditor, action: 'Approved' | 'Rejected') => {
    setDecisionFor({ auditor, action });
    setDecisionNotes('');
  };

  const submitDecision = () => {
    if (!decisionFor) return;
    if (decisionFor.action === 'Rejected' && !decisionNotes.trim()) {
      alert('Please add a short reason when rejecting a profile.');
      return;
    }
    persistDecision(decisionFor.auditor, decisionFor.action, decisionNotes.trim());
    setDecisionFor(null);
    setDecisionNotes('');
  };

  const quickApproveAll = () => {
    if (counts.pending === 0) return;
    if (
      !window.confirm(
        `Approve all ${counts.pending} pending auditor profile(s)? This action will activate them.`
      )
    ) {
      return;
    }
    const by = getLeadAuditorName();
    const at = new Date().toISOString();
    const newLog: ApprovalLogEntry[] = [];
    const updated = auditors.map((a) => {
      if ((a.approvalStatus || 'Pending Approval') !== 'Pending Approval') return a;
      newLog.push({
        at,
        auditorId: a.id,
        auditorName: a.name,
        action: 'Approved',
        by,
        notes: 'Bulk approved',
      });
      return {
        ...a,
        approvalStatus: 'Approved' as const,
        approvedBy: by,
        approvedAt: at,
        approvalNotes: 'Bulk approved',
        status: 'Active' as const,
      };
    });
    setAuditors(updated);
    saveAuditorsData(updated);
    const nextLog = [...newLog, ...log].slice(0, 200);
    setLog(nextLog);
    saveLog(nextLog);
    window.dispatchEvent(new Event('cms-auditors-updated'));
  };

  return (
    <div style={{ padding: '0 8px', maxWidth: 1280, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 18,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
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
            <ShieldCheck size={26} color="#2563eb" /> Auditor Approvals
          </h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
            Validate and approve auditor profiles created by the Audit Coordinator.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, color: '#94a3b8' }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search auditors..."
              style={{
                padding: '8px 12px 8px 32px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                width: 240,
                outline: 'none',
                fontSize: 13,
              }}
            />
          </div>
          {tab === 'pending' && counts.pending > 0 && (
            <button
              onClick={quickApproveAll}
              style={{
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <CheckCircle2 size={15} /> Approve All ({counts.pending})
            </button>
          )}
        </div>
      </div>

      {/* AI Auditor Competence Insights */}
      <AIPanel
        title="Auditor Competence Insights"
        subtitle="Live evidence summary for each profile awaiting approval"
        onRefresh={() => { refresh(); setAiTick((t) => t + 1); }}
      >
        {pendingCompetence.length === 0 ? (
          <p className="ai-panel-note">No pending auditor profiles to assess.</p>
        ) : (
          <ul className="ai-insight-list">
            {pendingCompetence.map(({ id, insight }) => (
              <li key={id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 12.5 }}>{insight.name}</strong>
                  <span className={'ai-chip ' + (insight.recommendation === 'Approve' ? 'ok' : 'med')}>{insight.recommendation}</span>
                  <span className="ai-chip info">{insight.schedulesCompleted}/{insight.schedulesTotal} schedules done</span>
                  <span className="ai-chip info">{insight.standards.length} standard{insight.standards.length === 1 ? '' : 's'}</span>
                  {insight.avgRating !== null && <span className="ai-chip info">Rating {insight.avgRating}/5</span>}
                  <span className={'ai-chip ' + (insight.qualityProxy === 'Strong' ? 'ok' : insight.qualityProxy === 'Moderate' ? 'med' : 'high')}>
                    Findings quality proxy: {insight.qualityProxy}
                  </span>
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{insight.reasons.join(' · ')}</div>
              </li>
            ))}
          </ul>
        )}
        <p className="ai-panel-note">Built from live schedules, ratings and skill matrices — the final decision stays with you.</p>
      </AIPanel>

      {/* Stat row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <StatCard
          color="#f59e0b"
          icon={<Clock size={18} />}
          label="Pending Approval"
          value={counts.pending}
        />
        <StatCard
          color="#16a34a"
          icon={<CheckCircle2 size={18} />}
          label="Approved Auditors"
          value={counts.approved}
        />
        <StatCard
          color="#dc2626"
          icon={<XCircle size={18} />}
          label="Rejected"
          value={counts.rejected}
        />
        <StatCard
          color="#0ea5e9"
          icon={<User size={18} />}
          label="Total Profiles"
          value={auditors.length}
        />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'inline-flex',
          background: '#f1f5f9',
          padding: 4,
          borderRadius: 10,
          gap: 2,
          marginBottom: 16,
        }}
      >
        <TabBtn
          active={tab === 'pending'}
          onClick={() => setTab('pending')}
          icon={<Clock size={14} />}
          label={`Pending (${counts.pending})`}
        />
        <TabBtn
          active={tab === 'approved'}
          onClick={() => setTab('approved')}
          icon={<CheckCircle2 size={14} />}
          label={`Approved (${counts.approved})`}
        />
        <TabBtn
          active={tab === 'rejected'}
          onClick={() => setTab('rejected')}
          icon={<XCircle size={14} />}
          label={`Rejected (${counts.rejected})`}
        />
      </div>

      {/* Auditor cards */}
      {filtered.length === 0 ? (
        <div
          style={{
            background: '#fff',
            border: '1px dashed #cbd5e1',
            borderRadius: 12,
            padding: 40,
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          {tab === 'pending'
            ? 'No auditor profiles waiting for approval. The Coordinator hasn\'t added any new ones.'
            : tab === 'approved'
            ? 'No approved auditors yet. Approved profiles will appear here.'
            : 'No rejected profiles. Rejected profiles will appear here for re-review.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((a) => (
            <AuditorCard
              key={a.id}
              auditor={a}
              tab={tab}
              onApprove={() => openDecision(a, 'Approved')}
              onReject={() => openDecision(a, 'Rejected')}
              onReopen={() =>
                persistDecision(a, 'Approved', a.approvalNotes ?? 'Re-approved')
              }
            />
          ))}
        </div>
      )}

      {/* Recent activity log */}
      {log.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
            Recent decisions
          </h3>
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              padding: '8px 12px',
              maxHeight: 220,
              overflowY: 'auto',
            }}
          >
            {log.slice(0, 25).map((e, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  borderBottom: i < log.length - 1 ? '1px solid #f1f5f9' : 'none',
                  fontSize: 13,
                }}
              >
                <span>
                  <strong>{e.auditorName}</strong>{' '}
                  <span
                    style={{
                      color: e.action === 'Approved' ? '#16a34a' : '#dc2626',
                      fontWeight: 600,
                    }}
                  >
                    {e.action}
                  </span>{' '}
                  by {e.by}
                  {e.notes ? <span style={{ color: '#64748b' }}> — {e.notes}</span> : null}
                </span>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>
                  {new Date(e.at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decision modal */}
      {decisionFor && (
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
          onClick={() => setDecisionFor(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 22,
              width: 'min(520px, 96vw)',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <h3
              style={{
                margin: '0 0 12px',
                fontSize: 18,
                color: decisionFor.action === 'Approved' ? '#15803d' : '#b91c1c',
              }}
            >
              {decisionFor.action === 'Approved' ? 'Approve' : 'Reject'} —{' '}
              {decisionFor.auditor.name}
            </h3>
            <p style={{ margin: '0 0 12px', color: '#475569', fontSize: 13 }}>
              {decisionFor.action === 'Approved'
                ? 'You are validating this profile. The auditor will be activated and eligible for audit assignments.'
                : 'You are rejecting this profile. Please add a short reason — the Coordinator will see it.'}
            </p>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
              Validation notes {decisionFor.action === 'Rejected' ? '(required)' : '(optional)'}
            </label>
            <textarea
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              rows={4}
              placeholder={
                decisionFor.action === 'Rejected'
                  ? 'e.g. Missing ISO 27001 certification proof. Please attach.'
                  : 'e.g. Verified credentials and skill matrix.'
              }
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                marginTop: 6,
                fontFamily: 'inherit',
                fontSize: 13,
                resize: 'vertical',
                outline: 'none',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 14,
              }}
            >
              <button
                onClick={() => setDecisionFor(null)}
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
                onClick={submitDecision}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: decisionFor.action === 'Approved' ? '#16a34a' : '#dc2626',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {decisionFor.action === 'Approved' ? (
                  <>
                    <CheckCircle2 size={14} /> Approve & Activate
                  </>
                ) : (
                  <>
                    <ShieldOff size={14} /> Reject
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* -----------------------------------------------------------
   Sub-components
----------------------------------------------------------- */

const StatCard: React.FC<{
  color: string;
  icon: React.ReactNode;
  label: string;
  value: number;
}> = ({ color, icon, label, value }) => (
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
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  </div>
);

const TabBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    style={{
      background: active ? '#fff' : 'transparent',
      color: active ? '#0f172a' : '#64748b',
      border: 'none',
      borderRadius: 8,
      padding: '8px 14px',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      boxShadow: active ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
    }}
  >
    {icon}
    {label}
  </button>
);

const AuditorCard: React.FC<{
  auditor: Auditor;
  tab: Tab;
  onApprove: () => void;
  onReject: () => void;
  onReopen: () => void;
}> = ({ auditor: a, tab, onApprove, onReject, onReopen }) => {
  const skillEntries = Object.entries(a.skills || {}).sort((x, y) => y[1] - x[1]);
  const initials = a.name
    .split(' ')
    .map((n) => n.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const statusColor =
    tab === 'approved' ? '#16a34a' : tab === 'rejected' ? '#dc2626' : '#f59e0b';

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 16,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 16,
        alignItems: 'flex-start',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#dbeafe',
              color: '#1e40af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            {initials || <User size={18} />}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{a.name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{a.email}</div>
          </div>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 12,
              background: statusColor + '20',
              color: statusColor,
            }}
          >
            {a.approvalStatus || 'Pending Approval'}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            fontSize: 12,
            color: '#475569',
            marginBottom: 8,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <User size={12} /> {a.role || 'Auditor'}
          </span>
          {a.department && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Building2 size={12} /> {a.department}
            </span>
          )}
          {a.specialization && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Award size={12} /> {a.specialization}
            </span>
          )}
          {a.joinDate && (
            <span style={{ color: '#94a3b8' }}>Joined {formatDate(a.joinDate)}</span>
          )}
        </div>

        {a.certifications && a.certifications.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {a.certifications.map((c) => (
              <span
                key={c}
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #e2e8f0',
                }}
              >
                {c}
              </span>
            ))}
          </div>
        )}

        {skillEntries.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              <Star size={11} style={{ marginRight: 2, verticalAlign: '-2px' }} />
              Skills:
            </span>
            {skillEntries.slice(0, 6).map(([k, v]) => (
              <span
                key={k}
                style={{
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: '#eef2ff',
                  color: '#4338ca',
                }}
              >
                {k} <strong>·{v}</strong>
              </span>
            ))}
          </div>
        )}

        {(a.approvedBy || a.approvalNotes) && (
          <div
            style={{
              fontSize: 11,
              color: '#64748b',
              marginTop: 10,
              borderTop: '1px dashed #e2e8f0',
              paddingTop: 8,
            }}
          >
            {a.approvedBy && (
              <span>
                {a.approvalStatus} by <strong>{a.approvedBy}</strong>
                {a.approvedAt ? ` on ${formatDate(a.approvedAt)}` : ''}
              </span>
            )}
            {a.approvalNotes && (
              <div style={{ marginTop: 4, color: '#475569' }}>
                <em>"{a.approvalNotes}"</em>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tab === 'pending' && (
          <>
            <button
              onClick={onApprove}
              style={{
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <CheckCircle2 size={14} /> Approve
            </button>
            <button
              onClick={onReject}
              style={{
                background: '#fff',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <XCircle size={14} /> Reject
            </button>
          </>
        )}
        {tab === 'rejected' && (
          <button
            onClick={onReopen}
            style={{
              background: '#16a34a',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <CheckCircle2 size={14} /> Re-approve
          </button>
        )}
        {tab === 'approved' && (
          <span
            style={{
              fontSize: 11,
              padding: '6px 10px',
              borderRadius: 6,
              background: '#dcfce7',
              color: '#15803d',
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            Active &amp; eligible
          </span>
        )}
      </div>
    </div>
  );
};

export default AuditorApprovals;
