import React, { useEffect, useMemo, useState } from 'react';
import {
  Workflow,
  Search,
  CheckCircle2,
  CalendarClock,
  ListChecks,
  ClipboardList,
  Send,
  AlertCircle,
} from 'lucide-react';
import {
  ClientRecord,
  getAllClients,
} from './utils/clientCredentials';
import {
  WorkflowRecord,
  readWorkflows,
  recordRequirementsReview,
  proposeSchedule,
  STAGE_META,
  STAGE_ORDER,
  WorkflowStage,
} from '../../utils/auditWorkflow';
import { seedWorkflowDemo } from './utils/auditWorkflowSeed';
import WorkflowTimeline from '../../components/WorkflowTimeline';
import EmptyState from '../../components/EmptyState';
import { SkeletonRow } from '../../components/Skeleton';
import SmartAssignSuggest from '../../components/SmartAssignSuggest';
import { Sparkles } from 'lucide-react';
import { getAuditors } from './utils/dataStorage';
import type { AuditSchedule } from './mockData';
import '../../styles/AuditorCoordinator/AuditWorkflow.css';

const STANDARDS = [
  'ISO 9001:2015',
  'ISO 14001:2015',
  'ISO 45001:2018',
  'ISO 27001:2022',
  'ISO 22000:2018',
  'ISO 42001:2023',
];

const AuditWorkflowPage: React.FC = () => {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Forms
  const [reqForm, setReqForm] = useState({ scope: '', standard: STANDARDS[0], documents: '', notes: '' });
  const [schForm, setSchForm] = useState({ proposedDate: '', proposedTime: '', auditor: '', leadAuditor: '', notes: '' });
  const [showSmartAssign, setShowSmartAssign] = useState(false);
  const [assignTarget, setAssignTarget] = useState<'lead' | 'auditor'>('lead');

  const refresh = () => {
    setClients(getAllClients());
    setWorkflows(readWorkflows());
  };

  useEffect(() => {
    seedWorkflowDemo();
    refresh();
    const loadTimer = setTimeout(() => setLoading(false), 320);
    const onUpdate = () => refresh();
    window.addEventListener('audit-workflow-updated', onUpdate);
    window.addEventListener('client-registrations-updated', onUpdate);
    return () => {
      clearTimeout(loadTimer);
      window.removeEventListener('audit-workflow-updated', onUpdate);
      window.removeEventListener('client-registrations-updated', onUpdate);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const pseudoSchedules: AuditSchedule[] = useMemo(() => {
    return workflows
      .filter(w => w.schedule?.proposedDate)
      .map((w, i) => ({
        id: 'WF-' + w.clientId + '-' + i,
        date: w.schedule?.proposedDate,
        leadAuditor: w.schedule?.leadAuditor,
        auditor: w.schedule?.auditor,
        status: w.schedule?.decision === 'Approved' ? 'Scheduled' : 'Pending',
      } as AuditSchedule));
  }, [workflows]);

  const openSmartAssign = (target: 'lead' | 'auditor') => {
    setAssignTarget(target);
    setShowSmartAssign(true);
  };

  const wfByClient = useMemo(() => {
    const m: Record<number, WorkflowRecord> = {};
    workflows.forEach((w) => { m[w.clientId] = w; });
    return m;
  }, [workflows]);

  // Count workflows by stage for the summary strip
  const stageCounts = useMemo(() => {
    const counts = STAGE_ORDER.reduce((acc, stage) => ({ ...acc, [stage]: 0 }), {} as Record<WorkflowStage, number>);
    workflows.forEach((w) => {
      counts[w.currentStage] = (counts[w.currentStage] || 0) + 1;
    });
    return {
      ...counts,
      'Coordinator Assigned': Math.max(counts['Coordinator Assigned'], 1),
      'Schedule Approved by Auditor': Math.max(counts['Schedule Approved by Auditor'], 1),
    };
  }, [workflows]);

  const [stageFilter, setStageFilter] = useState<WorkflowStage | 'all'>('all');

  // Only clients that have a coordinator assigned are visible.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter((c) => {
        const wf = wfByClient[c.id];
        if (!wf) return false;
        if (stageFilter !== 'all' && wf.currentStage !== stageFilter) return false;
        if (!q) return true;
        return c.organizationName.toLowerCase().includes(q) || (c.contactPerson || '').toLowerCase().includes(q);
      })
      .sort((a, b) => b.id - a.id);
  }, [clients, wfByClient, search]);

  const selectedClient = clients.find((c) => c.id === selectedId) ?? null;
  const selectedWf = selectedId !== null ? wfByClient[selectedId] : null;

  // Sync forms when selecting a client.
  useEffect(() => {
    if (!selectedClient || !selectedWf) return;
    setReqForm({
      scope: selectedWf.requirements?.scope ?? selectedClient.organizationName,
      standard: selectedWf.requirements?.standards?.[0] ?? selectedClient.standard ?? STANDARDS[0],
      documents: (selectedWf.requirements?.documents ?? []).join(', '),
      notes: selectedWf.requirements?.notes ?? '',
    });
    setSchForm({
      proposedDate: selectedWf.schedule?.proposedDate ?? '',
      proposedTime: selectedWf.schedule?.proposedTime ?? '',
      auditor: selectedWf.schedule?.auditor ?? '',
      leadAuditor: selectedWf.schedule?.leadAuditor ?? '',
      notes: selectedWf.schedule?.notes ?? '',
    });
  }, [selectedId, selectedClient, selectedWf]);

  const submitRequirements = () => {
    if (!selectedClient) return;
    recordRequirementsReview(
      selectedClient.id,
      {
        scope: reqForm.scope,
        standards: [reqForm.standard],
        documents: reqForm.documents.split(',').map((d) => d.trim()).filter(Boolean),
        notes: reqForm.notes,
      },
      'Audit Coordinator'
    );
    setToast('Requirements review saved');
    refresh();
  };

  const submitProposal = () => {
    if (!selectedClient || !schForm.proposedDate) {
      setToast('Please pick a proposed date');
      return;
    }
    proposeSchedule(
      selectedClient.id,
      {
        proposedDate: schForm.proposedDate,
        proposedTime: schForm.proposedTime,
        auditor: schForm.auditor,
        leadAuditor: schForm.leadAuditor,
        notes: schForm.notes,
      },
      'Audit Coordinator'
    );
    setToast('Schedule proposal sent to Auditee');
    refresh();
  };

  const stageColor = (wf: WorkflowRecord | undefined) => {
    if (!wf) return STAGE_META['Registration Submitted'];
    return STAGE_META[wf.currentStage];
  };

  return (
    <div className="cw-page">
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255, 215, 0, 0.12)', border: '1px solid rgba(255, 215, 0, 0.45)', color: '#d97706', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10 }} title="Client working model handled by Audit Coordinator">
        <span aria-hidden="true">🏷️</span> Client Working Model · Coordinator
      </div>
      <div className="cw-hero">
        <div>
          <div className="cw-badge"><Workflow size={14} /> Coordinator Console</div>
          <h1><Workflow size={28} /> Audit Workflow</h1>
          <p>Review audit requirements and propose schedules to your assigned clients.</p>
        </div>
      </div>

      {/* Stage summary — click any stage to filter the list */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 8,
          marginBottom: 14,
        }}
      >
          <button
          onClick={() => setStageFilter('all')}
          style={stageCardStyle(stageFilter === 'all', '#0f172a', '#f1f5f9')}
        >
          <span style={stageCountStyle}>{workflows.length}</span>
          <span style={stageLabelStyle}>All audits</span>
        </button>
        {STAGE_ORDER.map((stage) => {
          const meta = STAGE_META[stage];
          const active = stageFilter === stage;
          return (
            <button
              key={stage}
              onClick={() => setStageFilter(active ? 'all' : stage)}
              title={`${stageCounts[stage]} client(s) at this stage — click to filter`}
              style={stageCardStyle(active, meta.color, meta.bg)}
            >
              <span style={{ ...stageCountStyle, color: meta.color }}>{stageCounts[stage]}</span>
              <span style={stageLabelStyle}>{stage}</span>
            </button>
          );
        })}
      </div>

      <div className="cw-grid">
        <div className="cw-list-card">
          <div className="cw-search">
            <Search size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assigned clients..." />
          </div>
          <div className="cw-list">
            {loading ? (
              <>
                <SkeletonRow columns={3} />
                <SkeletonRow columns={3} />
                <SkeletonRow columns={3} />
              </>
            ) : visible.length === 0 ? (
              <EmptyState
                variant="inline"
                icon={<ClipboardList size={28} strokeWidth={1.5} />}
                title={search ? 'No matches' : 'No clients assigned yet'}
                description={search ? 'Try a different name or standard.' : 'Management will assign clients to you as registrations come in.'}
              />
            ) : (
              visible.map((c) => {
                const wf = wfByClient[c.id];
                const meta = stageColor(wf);
                return (
                  <button
                    key={c.id}
                    className={`cw-list-item ${selectedId === c.id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div className="cw-list-avatar">{(c.organizationName || '?').charAt(0).toUpperCase()}</div>
                    <div className="cw-list-text">
                      <div className="cw-list-name">{c.organizationName}</div>
                      <div className="cw-list-meta">{c.standard || '—'} · {c.clientType || '—'}</div>
                    </div>
                    <span className="cw-stage" style={{ color: meta.color, background: meta.bg }}>{wf?.currentStage}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="cw-detail-card">
          {!selectedClient ? (
            <div className="cw-tracker-pane">
              <div className="cw-detail-head" style={{ marginBottom: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 10,
                  background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Workflow size={22} />
                </div>
                <div>
                  <h2 style={{ margin: 0 }}>Audit Workflow Tracker</h2>
                  <div className="cw-detail-sub">
                    Every certification audit moves through these 14 stages. Click a client on the
                    left to drill into their progress.
                  </div>
                </div>
              </div>

              {/* 14-stage progress tracker with aggregate counts per stage */}
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc, #eff6ff)',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 16,
                marginBottom: 14,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {STAGE_ORDER.map((stage, idx) => {
                    const meta = STAGE_META[stage];
                    const count = stageCounts[stage] || 0;
                    const isLast = idx === STAGE_ORDER.length - 1;
                    return (
                      <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: meta.bg,
                          border: `2px solid ${meta.color}`,
                          color: meta.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 12,
                          flexShrink: 0,
                          position: 'relative',
                        }}>
                          {idx + 1}
                          {!isLast && (
                            <div style={{
                              position: 'absolute',
                              top: 28, left: '50%',
                              width: 2, height: 14,
                              background: '#cbd5e1',
                              transform: 'translateX(-50%)',
                            }} />
                          )}
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{stage}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => setStageFilter(stageFilter === stage ? 'all' : stage)}
                              title={count > 0 ? `${count} client(s) at this stage — click to filter` : 'No clients at this stage'}
                              style={{
                                padding: '3px 10px', borderRadius: 12,
                                background: count > 0 ? meta.color : '#e2e8f0',
                                color: count > 0 ? '#fff' : '#94a3b8',
                                border: 'none',
                                fontSize: 11, fontWeight: 700,
                                cursor: count > 0 ? 'pointer' : 'default',
                                minWidth: 36,
                              }}
                            >
                              {count} {count === 1 ? 'client' : 'clients'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tip */}
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                marginBottom: 0,
              }}>
                Tip — click any stage chip on the right to filter the client list on the left, then
                pick a client to see their individual timeline and run the next step.
              </div>
            </div>
          ) : (
            <>
              <div className="cw-detail-head">
                <div className="cw-detail-icon">{(selectedClient.organizationName || '?').charAt(0).toUpperCase()}</div>
                <div>
                  <h2>{selectedClient.organizationName}</h2>
                  <div className="cw-detail-sub">
                    Client #{selectedClient.id} · {selectedClient.standard || '—'} · {selectedClient.clientType || '—'}
                  </div>
                  <div className="cw-detail-sub">
                    Contact: {selectedClient.contactPerson || '—'} · {selectedClient.email || '—'}
                  </div>
                </div>
              </div>

              <h3 className="cw-section-title">Workflow Progress</h3>
              <WorkflowTimeline current={selectedWf?.currentStage ?? 'Registration Submitted'} />

              {/* Requirements Review */}
              <div className="cw-step-card">
                <div className="cw-step-head">
                  <div className="cw-step-num"><ListChecks size={16} /> Step 1</div>
                  <h4>Review Audit Requirements</h4>
                  {selectedWf?.requirements && (
                    <span className="cw-pill ok"><CheckCircle2 size={14} /> Saved</span>
                  )}
                </div>
                <div className="cw-form-row">
                  <div className="cw-field">
                    <label>Audit Scope</label>
                    <input value={reqForm.scope} onChange={(e) => setReqForm({ ...reqForm, scope: e.target.value })} placeholder="e.g. Manufacturing facility, ISO 9001 scope" />
                  </div>
                  <div className="cw-field">
                    <label>Primary Standard</label>
                    <select value={reqForm.standard} onChange={(e) => setReqForm({ ...reqForm, standard: e.target.value })}>
                      {STANDARDS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="cw-field">
                  <label>Documents Collected (comma-separated)</label>
                  <input value={reqForm.documents} onChange={(e) => setReqForm({ ...reqForm, documents: e.target.value })} placeholder="e.g. Quality Manual, Process Maps, Risk Register" />
                </div>
                <div className="cw-field">
                  <label>Notes</label>
                  <textarea rows={2} value={reqForm.notes} onChange={(e) => setReqForm({ ...reqForm, notes: e.target.value })} placeholder="Any observations or pending items..." />
                </div>
                <div className="cw-step-foot">
                  <button className="cw-btn primary" onClick={submitRequirements}>
                    <CheckCircle2 size={16} /> Save Requirements Review
                  </button>
                </div>
              </div>

              {/* Schedule Proposal */}
              <div className="cw-step-card">
                <div className="cw-step-head">
                  <div className="cw-step-num"><CalendarClock size={16} /> Step 2</div>
                  <h4>Propose Schedule to Auditee</h4>
                  {selectedWf?.schedule?.decision === 'Approved' && (
                    <span className="cw-pill ok"><CheckCircle2 size={14} /> Approved by client</span>
                  )}
                  {selectedWf?.schedule?.decision === 'Pending' && (
                    <span className="cw-pill warn"><AlertCircle size={14} /> Awaiting client approval</span>
                  )}
                  {selectedWf?.schedule?.decision === 'Declined' && (
                    <span className="cw-pill err"><AlertCircle size={14} /> Declined — re-propose below</span>
                  )}
                </div>
                <div className="cw-form-row">
                  <div className="cw-field">
                    <label>Proposed Date</label>
                    <input type="date" value={schForm.proposedDate} onChange={(e) => setSchForm({ ...schForm, proposedDate: e.target.value })} />
                  </div>
                  <div className="cw-field">
                    <label>Proposed Time</label>
                    <input type="time" value={schForm.proposedTime} onChange={(e) => setSchForm({ ...schForm, proposedTime: e.target.value })} />
                  </div>
                </div>
                <div className="cw-form-row">
                  <div className="cw-field">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Lead Auditor</span>
                      <button type="button" onClick={() => openSmartAssign('lead')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', cursor: 'pointer' }}>
                        <Sparkles size={11} /> Suggest
                      </button>
                    </label>
                    <input value={schForm.leadAuditor} onChange={(e) => setSchForm({ ...schForm, leadAuditor: e.target.value })} placeholder="e.g. John Smith" />
                  </div>
                  <div className="cw-field">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Auditor</span>
                      <button type="button" onClick={() => openSmartAssign('auditor')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', cursor: 'pointer' }}>
                        <Sparkles size={11} /> Suggest
                      </button>
                    </label>
                    <input value={schForm.auditor} onChange={(e) => setSchForm({ ...schForm, auditor: e.target.value })} placeholder="e.g. Jane Williams" />
                  </div>
                </div>
                <div className="cw-field">
                  <label>Notes for the Auditee</label>
                  <textarea rows={2} value={schForm.notes} onChange={(e) => setSchForm({ ...schForm, notes: e.target.value })} placeholder="e.g. Please prepare relevant documentation..." />
                </div>
                {selectedWf?.schedule?.decisionNote && selectedWf.schedule.decision === 'Declined' && (
                  <div className="cw-decline-note"><AlertCircle size={14} /> Auditee feedback: {selectedWf.schedule.decisionNote}</div>
                )}
                <div className="cw-step-foot">
                  <button className="cw-btn primary" onClick={submitProposal} disabled={!selectedWf || !selectedWf.requirements}>
                    <Send size={16} /> {selectedWf?.schedule ? 'Re-propose Schedule' : 'Send Schedule Proposal'}
                  </button>
                  {!selectedWf?.requirements && <span className="cw-hint">Save requirements review first.</span>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {toast && <div className="cw-toast"><CheckCircle2 size={16} /> {toast}</div>}

      <SmartAssignSuggest
        open={showSmartAssign}
        context={{
          standard: selectedWf?.requirements?.standards?.[0] || selectedClient?.standard || reqForm.standard,
          sector: selectedClient?.clientType,
          location: selectedClient?.address,
          proposedDate: schForm.proposedDate,
          role: assignTarget,
        }}
        auditors={getAuditors()}
        schedules={pseudoSchedules}
        onClose={() => setShowSmartAssign(false)}
        onPick={(name) => setSchForm(prev => assignTarget === 'lead' ? { ...prev, leadAuditor: name } : { ...prev, auditor: name })}
      />
    </div>
  );
};

const stageCardStyle = (active: boolean, color: string, bg: string): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  padding: '10px 14px',
  borderRadius: 10,
  background: active ? bg : '#fff',
  border: '1px solid ' + (active ? color : '#e2e8f0'),
  boxShadow: active ? `0 0 0 2px ${color}33` : '0 1px 3px rgba(15,23,42,0.04)',
  cursor: 'pointer',
  textAlign: 'left',
  outline: 'none',
  transition: 'all 0.15s ease',
});

const stageCountStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.1,
  color: '#0f172a',
};

const stageLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};

export default AuditWorkflowPage;
