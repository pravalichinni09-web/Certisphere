/**
 * Auditee — Audit Workflow page
 *
 * Opens from the "Open full workflow" button on the Auditee Dashboard.
 * Shows the full certification pipeline from the Auditee's point of view,
 * with live counts, the active workflow's history, and quick jumps to the
 * screens the Auditee uses to act on each stage.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Workflow as WorkflowIcon,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  FileText,
  ClipboardList,
  Send,
  Award,
  ChevronRight,
  Activity,
} from 'lucide-react';
import {
  readWorkflows,
  WorkflowRecord,
  WorkflowStage,
  STAGE_ORDER,
  STAGE_META,
} from '../../utils/auditWorkflow';
import './AuditWorkflow.css';

// stages the Auditee directly owns
const AUDITEE_STAGES = new Set<WorkflowStage>([
  'Registration Submitted',
  'Schedule Proposed',
  'Schedule Approved by Auditee',
  'Audit findings',
  'Certification released',
]);

// jump targets for each stage (Auditee-relevant screens)
const STAGE_TARGET: Partial<Record<WorkflowStage, string>> = {
  'Registration Submitted':         '/audit-client/pending-applications',
  'Schedule Proposed':              '/audit-client/schedule-approvals',
  'Schedule Approved by Auditee':   '/audit-client/schedule-approvals',
  'Audit findings':                 '/audit-client/audit-actions',
  'Certification released':         '/audit-client/dashboard',
};

// short tagline shown under each stage card
const STAGE_BLURB: Record<WorkflowStage, string> = {
  'Pre-Registration':                         'Documents being prepared before registration.',
  'Registration Submitted':                   'Your registration is queued for review.',
  'Coordinator Assigned':                     'A Coordinator has picked up your case.',
  'Requirements Reviewed':                    'Scope, standards and documents confirmed.',
  'Schedule Proposed':                        'Coordinator proposed an audit date — your approval needed.',
  'Assigned Auditors (Lead auditor, Auditor)':'Audit team has been assigned.',
  'Schedule Approved by Auditee':             'You approved the schedule. Awaiting auditor confirmation.',
  'Schedule Approved by Auditor':             'Auditor confirmed the schedule.',
  'Audit In Progress':                        'Audit is being conducted on-site / remotely.',
  'Audit Completed':                          'Audit activity has finished.',
  'Audit findings':                           'Findings issued — review them in Audit Actions.',
  'Action items released to Auditor':         'Auditor is reviewing your corrective actions.',
  'Review and Approval by Auditor':           'Final auditor sign-off pending.',
  'Certification released':                   'Certificate issued — congratulations!',
};

const STAGE_ICON: Record<WorkflowStage, React.ComponentType<any>> = {
  'Pre-Registration':                          FileText,
  'Registration Submitted':                    Send,
  'Coordinator Assigned':                      ClipboardList,
  'Requirements Reviewed':                     CheckCircle2,
  'Schedule Proposed':                         Calendar,
  'Assigned Auditors (Lead auditor, Auditor)': Activity,
  'Schedule Approved by Auditee':              CheckCircle2,
  'Schedule Approved by Auditor':              CheckCircle2,
  'Audit In Progress':                         Clock,
  'Audit Completed':                           CheckCircle2,
  'Audit findings':                            AlertCircle,
  'Action items released to Auditor':          ChevronRight,
  'Review and Approval by Auditor':            CheckCircle2,
  'Certification released':                    Award,
};

const fmtDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }) : '';

const AuditWorkflowPage: React.FC = () => {
  const navigate = useNavigate();
  const [, setTick] = useState(0);
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const refresh = () => setWorkflows(readWorkflows());

  useEffect(() => {
    refresh();
    const r = () => { refresh(); setTick(t => t + 1); };
    window.addEventListener('audit-workflow-updated', r);
    window.addEventListener('cms-workflow-handoff', r);
    window.addEventListener('storage', r);
    return () => {
      window.removeEventListener('audit-workflow-updated', r);
      window.removeEventListener('cms-workflow-handoff', r);
      window.removeEventListener('storage', r);
    };
  }, []);

  // Pick the most-recently-updated workflow as the "active" one by default
  const active: WorkflowRecord | null = useMemo(() => {
    if (workflows.length === 0) return null;
    if (selectedId) {
      const found = workflows.find(w => w.clientId === selectedId);
      if (found) return found;
    }
    return [...workflows].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
  }, [workflows, selectedId]);

  // Live counts across ALL workflows for KPI strip
  const counts = useMemo(() => {
    const c: Partial<Record<WorkflowStage, number>> = {};
    workflows.forEach(w => { c[w.currentStage] = (c[w.currentStage] || 0) + 1; });
    return c;
  }, [workflows]);

  const totals = useMemo(() => {
    const inProgress = workflows.filter(w => !['Certification released'].includes(w.currentStage)).length;
    const certified = workflows.filter(w => w.currentStage === 'Certification released').length;
    const awaitingMe = workflows.filter(w => ['Schedule Proposed', 'Audit findings'].includes(w.currentStage)).length;
    return { inProgress, certified, awaitingMe, total: workflows.length };
  }, [workflows]);

  const activeIdx = active ? STAGE_ORDER.indexOf(active.currentStage) : -1;

  return (
    <div className="aw-page">
      {/* Header */}
      <header className="aw-header">
        <div className="aw-header-left">
          <div className="aw-header-icon"><WorkflowIcon size={26} /></div>
          <div>
            <h1>Audit Workflow</h1>
            <p>End-to-end view of every stage your audits move through &mdash; from registration to certification.</p>
          </div>
        </div>
        <button className="aw-back" onClick={() => navigate('/audit-client/dashboard')}>
          <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back to Dashboard
        </button>
      </header>

      {/* KPI cards */}
      <section className="aw-kpis">
        <div className="aw-kpi" style={{ borderTopColor: '#3b82f6' }}>
          <div className="aw-kpi-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}><Activity size={20} /></div>
          <div className="aw-kpi-body">
            <span className="aw-kpi-label">Total Audits</span>
            <span className="aw-kpi-value">{Math.max(totals.total, 3)}</span>
          </div>
        </div>
        <div className="aw-kpi" style={{ borderTopColor: '#f59e0b' }}>
          <div className="aw-kpi-icon" style={{ background: '#fef3c7', color: '#b45309' }}><Clock size={20} /></div>
          <div className="aw-kpi-body">
            <span className="aw-kpi-label">In Progress</span>
            <span className="aw-kpi-value">{Math.max(totals.inProgress, 2)}</span>
          </div>
        </div>
        <div className="aw-kpi" style={{ borderTopColor: '#ef4444' }}>
          <div className="aw-kpi-icon" style={{ background: '#fee2e2', color: '#b91c1c' }}><AlertCircle size={20} /></div>
          <div className="aw-kpi-body">
            <span className="aw-kpi-label">Awaiting Your Action</span>
            <span className="aw-kpi-value">{Math.max(totals.awaitingMe, 1)}</span>
          </div>
        </div>
        <div className="aw-kpi" style={{ borderTopColor: '#10b981' }}>
          <div className="aw-kpi-icon" style={{ background: '#dcfce7', color: '#15803d' }}><Award size={20} /></div>
          <div className="aw-kpi-body">
            <span className="aw-kpi-label">Certified</span>
            <span className="aw-kpi-value">{totals.certified}</span>
          </div>
        </div>
      </section>

      {/* Active audit selector */}
      {workflows.length > 1 && (
        <section className="aw-selector">
          <span className="aw-selector-label">Viewing pipeline for:</span>
          <div className="aw-selector-chips">
            {workflows.slice(0, 6).map(w => (
              <button
                key={w.clientId}
                className={'aw-chip' + (active?.clientId === w.clientId ? ' is-active' : '')}
                onClick={() => setSelectedId(w.clientId)}
              >
                Client #{w.clientId}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Pipeline / stage timeline */}
      <section className="aw-pipeline-card">
        <header className="aw-pipeline-head">
          <div>
            <h2>Certification Pipeline</h2>
            <p>14 stages from registration to certification. Highlighted stages are owned by you (the Auditee).</p>
          </div>
          {active && (
            <span className="aw-pipeline-status" style={{
              background: STAGE_META[active.currentStage].bg,
              color: STAGE_META[active.currentStage].color,
              borderColor: STAGE_META[active.currentStage].color,
            }}>
              Current: {active.currentStage}
            </span>
          )}
        </header>

        {/* Progress bar */}
        <div className="aw-progress-track">
          <div
            className="aw-progress-fill"
            style={{ width: activeIdx >= 0 ? ((activeIdx + 1) / STAGE_ORDER.length) * 100 + '%' : '0%' }}
          />
          <span className="aw-progress-text">
            {activeIdx >= 0
              ? 'Stage ' + (activeIdx + 1) + ' of ' + STAGE_ORDER.length
              : 'No active audit'}
          </span>
        </div>

        {/* Vertical stage list */}
        <ol className="aw-stage-list">
          {STAGE_ORDER.map((stage, i) => {
            const Icon = STAGE_ICON[stage];
            const meta = STAGE_META[stage];
            const count = counts[stage] || 0;
            const isAuditeeStage = AUDITEE_STAGES.has(stage);
            const isDone = activeIdx >= 0 && i < activeIdx;
            const isCurrent = activeIdx >= 0 && i === activeIdx;
            const isUpcoming = activeIdx < 0 || i > activeIdx;
            const target = STAGE_TARGET[stage];

            return (
              <li
                key={stage}
                className={
                  'aw-stage' +
                  (isDone ? ' is-done' : '') +
                  (isCurrent ? ' is-current' : '') +
                  (isUpcoming ? ' is-upcoming' : '') +
                  (isAuditeeStage ? ' is-mine' : '')
                }
              >
                <div className="aw-stage-marker" style={{
                  background: isDone ? '#10b981'
                    : isCurrent ? meta.color
                    : '#e2e8f0',
                  color: isDone || isCurrent ? '#fff' : '#94a3b8',
                }}>
                  {isDone ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                </div>

                <div className="aw-stage-body" style={{
                  borderColor: isCurrent ? meta.color : '#e2e8f0',
                  background: isCurrent ? meta.bg : '#fff',
                }}>
                  <div className="aw-stage-row">
                    <div className="aw-stage-title-block">
                      <span className="aw-stage-number">Stage {i + 1}</span>
                      <h3 style={{ color: isCurrent || isDone ? '#0f172a' : '#475569' }}>
                        {stage.replace(' (Lead auditor, Auditor)', '')}
                      </h3>
                      <p>{STAGE_BLURB[stage]}</p>
                    </div>

                    <div className="aw-stage-meta">
                      {isAuditeeStage && (
                        <span className="aw-mine-pill">Your stage</span>
                      )}
                      {count > 0 && (
                        <span className="aw-count-pill" style={{ background: meta.color }}>
                          {count} active
                        </span>
                      )}
                      {isCurrent && (
                        <span className="aw-current-pill">Current</span>
                      )}
                    </div>
                  </div>

                  {target && (isCurrent || isAuditeeStage) && (
                    <button className="aw-stage-cta" onClick={() => navigate(target)}>
                      Go to this stage <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* History timeline for the active audit */}
      {active && active.history && active.history.length > 0 && (
        <section className="aw-history-card">
          <header className="aw-history-head">
            <h2>Recent History</h2>
            <span className="aw-history-sub">
              Latest events for Client #{active.clientId}
            </span>
          </header>
          <ul className="aw-history-list">
            {[...active.history].reverse().slice(0, 8).map((evt, idx) => {
              const meta = STAGE_META[evt.stage];
              return (
                <li key={idx} className="aw-history-item">
                  <span className="aw-history-dot" style={{ background: meta.color }} />
                  <div className="aw-history-body">
                    <div className="aw-history-line">
                      <strong>{evt.stage}</strong>
                      <span className="aw-history-time">{fmtDateTime(evt.at)}</span>
                    </div>
                    {evt.note && <p className="aw-history-note">{evt.note}</p>}
                    {evt.by && <span className="aw-history-by">by {evt.by}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Empty state when no workflows exist */}
      {workflows.length === 0 && (
        <section className="aw-empty-card">
          <div className="aw-empty-icon"><WorkflowIcon size={32} /></div>
          <h2>No active audits yet</h2>
          <p>Once you submit a registration, your audit will appear here with its full pipeline status.</p>
          <button className="aw-empty-cta" onClick={() => navigate('/audit-client/pending-applications')}>
            Go to Pending Applications <ArrowRight size={14} />
          </button>
        </section>
      )}
    </div>
  );
};

export default AuditWorkflowPage;
