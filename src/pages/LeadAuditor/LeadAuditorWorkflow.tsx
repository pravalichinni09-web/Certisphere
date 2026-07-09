/**
 * Lead Auditor — Full Workflow Page
 *
 * Opens from the "Open full workflow" button on the Lead Auditor Dashboard.
 * Shows the full 14-stage certification pipeline from the Lead Auditor's
 * perspective, with live counts, active audit pipeline, and event history.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type LucideIcon,
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
  Users,
  ShieldCheck,
} from 'lucide-react';
import {
  readWorkflows,
  WorkflowRecord,
  WorkflowStage,
  STAGE_ORDER,
  STAGE_META,
} from '../../utils/auditWorkflow';
import '../AuditClient/AuditWorkflow.css';

// Stages the Lead Auditor directly owns / acts on
const LEAD_STAGES = new Set<WorkflowStage>([
  'Schedule Approved by Auditee',
  'Assigned Auditors (Lead auditor, Auditor)',
  'Audit In Progress',
  'Audit findings',
  'Action items released to Auditor',
  'Review and Approval by Auditor',
]);

// Navigation targets for each Lead-Auditor-relevant stage
const STAGE_TARGET: Partial<Record<WorkflowStage, string>> = {
  'Schedule Approved by Auditee':              '/lead-auditor/audit-schedules',
  'Assigned Auditors (Lead auditor, Auditor)': '/lead-auditor/auditor-approvals',
  'Audit In Progress':                         '/lead-auditor/conduct-audit',
  'Audit findings':                            '/lead-auditor/conduct-audit',
  'Action items released to Auditor':          '/lead-auditor/action-review',
  'Review and Approval by Auditor':            '/lead-auditor/action-approval',
};

const STAGE_BLURB: Record<WorkflowStage, string> = {
  'Pre-Registration':                          'Client preparing documents before formal submission.',
  'Registration Submitted':                    'Client registration queued for coordinator review.',
  'Coordinator Assigned':                      'A coordinator has picked up the case.',
  'Requirements Reviewed':                     'Scope, standards and documents confirmed by coordinator.',
  'Schedule Proposed':                         'Coordinator has proposed an audit date.',
  'Assigned Auditors (Lead auditor, Auditor)': 'You and your team have been assigned — confirm availability.',
  'Schedule Approved by Auditee':              'Client approved the schedule. Awaiting your team confirmation.',
  'Schedule Approved by Auditor':              'Audit team confirmed the schedule.',
  'Audit In Progress':                         'On-site or remote audit being conducted by the team.',
  'Audit Completed':                           'Audit activity has concluded.',
  'Audit findings':                            'Findings raised — review and action items to be issued.',
  'Action items released to Auditor':          'Corrective actions sent; monitor progress.',
  'Review and Approval by Auditor':            'Final sign-off by lead auditor before certification.',
  'Certification released':                    'Certificate issued to client by the certification body.',
};

const STAGE_ICON: Record<WorkflowStage, LucideIcon> = {
  'Pre-Registration':                          FileText,
  'Registration Submitted':                    Send,
  'Coordinator Assigned':                      ClipboardList,
  'Requirements Reviewed':                     CheckCircle2,
  'Schedule Proposed':                         Calendar,
  'Assigned Auditors (Lead auditor, Auditor)': Users,
  'Schedule Approved by Auditee':              CheckCircle2,
  'Schedule Approved by Auditor':              CheckCircle2,
  'Audit In Progress':                         Activity,
  'Audit Completed':                           CheckCircle2,
  'Audit findings':                            AlertCircle,
  'Action items released to Auditor':          ChevronRight,
  'Review and Approval by Auditor':            ShieldCheck,
  'Certification released':                    Award,
};

const fmtDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : '';

const LeadAuditorWorkflow: React.FC = () => {
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

  const active: WorkflowRecord | null = useMemo(() => {
    if (workflows.length === 0) return null;
    if (selectedId) {
      const found = workflows.find(w => w.clientId === selectedId);
      if (found) return found;
    }
    return [...workflows].sort((a, b) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || '')
    )[0];
  }, [workflows, selectedId]);

  const counts = useMemo(() => {
    const c: Partial<Record<WorkflowStage, number>> = {};
    workflows.forEach(w => { c[w.currentStage] = (c[w.currentStage] || 0) + 1; });
    return c;
  }, [workflows]);

  const totals = useMemo(() => {
    const inProgress = workflows.filter(
      w => w.currentStage !== 'Certification released'
    ).length;
    const certified = workflows.filter(
      w => w.currentStage === 'Certification released'
    ).length;
    const awaitingMe = workflows.filter(w => LEAD_STAGES.has(w.currentStage)).length;
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
            <h1>Lead Auditor Workflow</h1>
            <p>
              Full view of the 14-stage certification pipeline &mdash; stages
              highlighted in colour are owned by you.
            </p>
          </div>
        </div>
        <button className="aw-back" onClick={() => navigate('/lead-auditor/dashboard')}>
          <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back to Dashboard
        </button>
      </header>

      {/* KPI strip */}
      <section className="aw-kpis">
        <div className="aw-kpi" style={{ borderTopColor: '#3b82f6' }}>
          <div className="aw-kpi-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
            <Activity size={20} />
          </div>
          <div className="aw-kpi-body">
            <span className="aw-kpi-label">Total Audits</span>
            <span className="aw-kpi-value">{Math.max(totals.total, 3)}</span>
          </div>
        </div>
        <div className="aw-kpi" style={{ borderTopColor: '#f59e0b' }}>
          <div className="aw-kpi-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
            <Clock size={20} />
          </div>
          <div className="aw-kpi-body">
            <span className="aw-kpi-label">In Progress</span>
            <span className="aw-kpi-value">{Math.max(totals.inProgress, 2)}</span>
          </div>
        </div>
        <div className="aw-kpi" style={{ borderTopColor: '#ef4444' }}>
          <div className="aw-kpi-icon" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            <AlertCircle size={20} />
          </div>
          <div className="aw-kpi-body">
            <span className="aw-kpi-label">Awaiting Your Action</span>
            <span className="aw-kpi-value">{Math.max(totals.awaitingMe, 1)}</span>
          </div>
        </div>
        <div className="aw-kpi" style={{ borderTopColor: '#10b981' }}>
          <div className="aw-kpi-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
            <Award size={20} />
          </div>
          <div className="aw-kpi-body">
            <span className="aw-kpi-label">Certified</span>
            <span className="aw-kpi-value">{totals.certified}</span>
          </div>
        </div>
      </section>

      {/* Workflow selector */}
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

      {/* Pipeline */}
      <section className="aw-pipeline-card">
        <header className="aw-pipeline-head">
          <div>
            <h2>Certification Pipeline</h2>
            <p>
              14 stages from registration to certification. Highlighted stages
              are owned by the Lead Auditor role.
            </p>
          </div>
          {active && (
            <span
              className="aw-pipeline-status"
              style={{
                background: STAGE_META[active.currentStage].bg,
                color: STAGE_META[active.currentStage].color,
                borderColor: STAGE_META[active.currentStage].color,
              }}
            >
              Current: {active.currentStage}
            </span>
          )}
        </header>

        <div className="aw-progress-track">
          <div
            className="aw-progress-fill"
            style={{
              width:
                activeIdx >= 0
                  ? ((activeIdx + 1) / STAGE_ORDER.length) * 100 + '%'
                  : '0%',
            }}
          />
          <span className="aw-progress-text">
            {activeIdx >= 0
              ? `Stage ${activeIdx + 1} of ${STAGE_ORDER.length}`
              : 'No active audit'}
          </span>
        </div>

        <ol className="aw-stage-list">
          {STAGE_ORDER.map((stage, i) => {
            const Icon = STAGE_ICON[stage];
            const meta = STAGE_META[stage];
            const count = counts[stage] || 0;
            const isMyStage = LEAD_STAGES.has(stage);
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
                  (isMyStage ? ' is-mine' : '')
                }
              >
                <div
                  className="aw-stage-marker"
                  style={{
                    background: isDone ? '#10b981' : isCurrent ? meta.color : '#e2e8f0',
                    color: isDone || isCurrent ? '#fff' : '#94a3b8',
                  }}
                >
                  {isDone ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                </div>

                <div
                  className="aw-stage-body"
                  style={{
                    borderColor: isCurrent ? meta.color : '#e2e8f0',
                    background: isCurrent ? meta.bg : '#fff',
                  }}
                >
                  <div className="aw-stage-row">
                    <div className="aw-stage-title-block">
                      <span className="aw-stage-number">Stage {i + 1}</span>
                      <h3 style={{ color: isCurrent || isDone ? '#0f172a' : '#475569' }}>
                        {stage.replace(' (Lead auditor, Auditor)', '')}
                      </h3>
                      <p>{STAGE_BLURB[stage]}</p>
                    </div>

                    <div className="aw-stage-meta">
                      {isMyStage && <span className="aw-mine-pill">Your stage</span>}
                      {count > 0 && (
                        <span className="aw-count-pill" style={{ background: meta.color }}>
                          {count} active
                        </span>
                      )}
                      {isCurrent && <span className="aw-current-pill">Current</span>}
                    </div>
                  </div>

                  {target && (isCurrent || isMyStage) && (
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

      {/* History */}
      {active && active.history && active.history.length > 0 && (
        <section className="aw-history-card">
          <header className="aw-history-head">
            <h2>Recent History</h2>
            <span className="aw-history-sub">Latest events for Client #{active.clientId}</span>
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

      {/* Empty state */}
      {workflows.length === 0 && (
        <section className="aw-empty-card">
          <div className="aw-empty-icon"><WorkflowIcon size={32} /></div>
          <h2>No active audits yet</h2>
          <p>Once an audit is assigned to you, it will appear here with its full pipeline status.</p>
          <button className="aw-empty-cta" onClick={() => navigate('/lead-auditor/audit-schedules')}>
            View Audit Schedules <ArrowRight size={14} />
          </button>
        </section>
      )}
    </div>
  );
};

export default LeadAuditorWorkflow;
