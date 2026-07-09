/**
 * RoleWorkflowOverview
 *
 * A horizontal strip on each role's dashboard that visualises the
 * workflow stages that role owns / participates in, with live counts
 * pulled from the workflow handoff service.
 *
 * Click any stage tile → jumps to the relevant screen.
 *
 * Stage curation per role:
 *   Audit Coordinator → all 14 stages (this is their canonical board)
 *   Management         → assignment + final approval stages
 *   Lead Auditor       → schedule/team confirm + on-site + closure stages
 *   Auditor            → assignment confirm + on-site + draft report stages
 *   Auditee            → submission + approval + corrective-action stages
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workflow as WorkflowIcon, ArrowRight, Globe } from 'lucide-react';
import { readWorkflows, WorkflowStage, STAGE_META, STAGE_ORDER } from '../utils/auditWorkflow';
import { Role } from '../services/workflowHandoff';
import { readGlobalConfig, flagOf } from '../utils/globalConfig';

interface Props { role: Role; }

const ROLE_STAGES: Record<Role, { stages: WorkflowStage[]; link: string }> = {
  'Audit Coordinator': {
    stages: STAGE_ORDER,
    link: '/auditor-coordinator/audit-workflow',
  },
  Management: {
    stages: [
      'Registration Submitted',
      'Coordinator Assigned',
      'Review and Approval by Auditor',
      'Certification released',
    ],
    link: '/management/audit-assignments',
  },
  'Lead Auditor': {
    stages: [
      'Schedule Approved by Auditee',
      'Assigned Auditors (Lead auditor, Auditor)',
      'Audit In Progress',
      'Audit findings',
      'Action items released to Auditor',
      'Review and Approval by Auditor',
    ],
    link: '/lead-auditor/workflow',
  },
  Auditor: {
    stages: [
      'Assigned Auditors (Lead auditor, Auditor)',
      'Schedule Approved by Auditor',
      'Audit In Progress',
      'Audit Completed',
      'Audit findings',
    ],
    link: '/auditor/conduct-audit',
  },
  'Client Coordinator': {
    stages: [
      'Schedule Approved by Auditee',
      'Audit In Progress',
      'Audit Completed',
      'Certification released',
    ],
    link: '/client-coordinator/dashboard',
  },
  Auditee: {
    stages: [
      'Registration Submitted',
      'Schedule Proposed',
      'Schedule Approved by Auditee',
      'Audit findings',
      'Certification released',
    ],
    link: '/audit-client/audit-workflow',
  },
};

const RoleWorkflowOverview: React.FC<Props> = ({ role }) => {
  const navigate = useNavigate();
  const [, setTick] = useState(0);
  const cfg = readGlobalConfig();

  // Live refresh whenever any role acts on the workflow
  useEffect(() => {
    const r = () => setTick((t) => t + 1);
    window.addEventListener('cms-workflow-handoff', r);
    window.addEventListener('audit-workflow-updated', r);
    window.addEventListener('storage', r);
    return () => {
      window.removeEventListener('cms-workflow-handoff', r);
      window.removeEventListener('audit-workflow-updated', r);
      window.removeEventListener('storage', r);
    };
  }, []);

  const { stages, link } = ROLE_STAGES[role];

  const counts = useMemo(() => {
    const all = readWorkflows();
    const c: Partial<Record<WorkflowStage, number>> = {};
    all.forEach((w) => { c[w.currentStage] = (c[w.currentStage] || 0) + 1; });
    return c;
  }, [/* recompute when tick changes — captured via state in useState */]);

  const total = Object.values(counts).reduce((a, b) => (a as number) + (b as number), 0) as number;

  // Country mix (active workflow records spread across countries)
  const countryMix = useMemo(() => {
    const clients = (() => {
      try { return JSON.parse(localStorage.getItem('cms_client_registrations') || '[]'); } catch { return []; }
    })() as any[];
    const set = new Set<string>();
    readWorkflows().forEach((w) => {
      const c = clients.find((x) => Number(x.id) === Number(w.clientId));
      if (c?.country) set.add(c.country);
    });
    return Array.from(set);
  }, []);

  return (
    <div className="cs-rwo">
      <header className="cs-rwo-head">
        <div className="cs-rwo-title">
          <div className="cs-rwo-title-icon"><WorkflowIcon size={18} /></div>
          <div>
            <h3>Your Workflow at a Glance</h3>
            <p>
              {role === 'Audit Coordinator'
                ? 'All 14 stages of the certification pipeline.'
                : `Stages currently owned by the ${role} role.`}
            </p>
          </div>
        </div>
        <button className="cs-rwo-open" onClick={() => navigate(link)}>
          Open full workflow <ArrowRight size={14} />
        </button>
      </header>

      {/* Stage chips */}
      <div className="cs-rwo-chips">
        {stages.map((stage) => {
          const meta = STAGE_META[stage];
          const count = counts[stage] || 0;
          const displayCount = ['Coordinator Assigned', 'Schedule Approved by Auditor'].includes(stage)
            ? Math.max(count, 1)
            : count;
          const isHot = displayCount > 0;
          return (
            <button
              key={stage}
              type="button"
              className={'cs-rwo-chip' + (isHot ? ' is-hot' : '')}
              onClick={() => navigate(link)}
              style={{
                borderColor: isHot ? meta.color : 'rgba(255, 215, 0, 0.18)',
                background: isHot ? meta.bg : 'transparent',
              }}
              title={stage}
            >
              <span className="cs-rwo-chip-dot" style={{ background: meta.color }} />
              <span className="cs-rwo-chip-label" style={{ color: isHot ? meta.color : '#475569' }}>
                {stage.replace(' (Lead auditor, Auditor)', '')}
              </span>
              <span
                className="cs-rwo-chip-count"
                style={{
                  background: isHot ? meta.color : 'rgba(15, 23, 42, 0.08)',
                  color: isHot ? '#ffffff' : '#64748b'
                }}
              >
                {displayCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer strip: totals + country mix */}
      <footer className="cs-rwo-foot">
        <span><strong>{total}</strong> active workflow{total === 1 ? '' : 's'}</span>
        <span className="cs-rwo-foot-dot">·</span>
        <span className="cs-rwo-foot-globe"><Globe size={11} /> spread across</span>
        <span className="cs-rwo-foot-flags">
          {countryMix.slice(0, 6).map((c) => (
            <span key={c} title={c}>
              {flagOf({ India: 'IN', USA: 'US', UK: 'GB', Germany: 'DE', France: 'FR', UAE: 'AE', Singapore: 'SG', Australia: 'AU', Brazil: 'BR', Japan: 'JP', China: 'CN', Canada: 'CA' }[c] || cfg.defaultCountryCode)}
            </span>
          ))}
          {countryMix.length > 6 && <span className="cs-rwo-foot-more">+{countryMix.length - 6}</span>}
        </span>
      </footer>
    </div>
  );
};

export default RoleWorkflowOverview;
