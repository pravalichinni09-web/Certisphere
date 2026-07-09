import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import '../styles/WorkflowTimeline.css';
import {
  STAGE_ORDER,
  WorkflowStage,
  stageIndex,
} from '../utils/auditWorkflow';

interface Props {
  current: WorkflowStage;
  compact?: boolean;
}

const stageBlurb: Record<WorkflowStage, string> = {
  'Pre-Registration':                         'Client onboarding in progress',
  'Registration Submitted':                   'Auditee registered',
  'Coordinator Assigned':                     'Management assigned coordinator',
  'Requirements Reviewed':                    'Requirements reviewed and confirmed',
  'Schedule Proposed':                        'Schedule proposed to auditee',
  'Assigned Auditors (Lead auditor, Auditor)': 'Audit team assigned',
  'Schedule Approved by Auditee':             'Auditee approved the schedule',
  'Schedule Approved by Auditor':             'Auditor approved the schedule',
  'Audit In Progress':                        'Audit underway',
  'Audit Completed':                          'Audit fieldwork complete',
  'Audit findings':                           'Findings documented',
  'Action items released to Auditor':         'Action items sent to auditor',
  'Review and Approval by Auditor':           'Auditor review and approval',
  'Certification released':                   'Certification issued',
};

const WorkflowTimeline: React.FC<Props> = ({ current, compact }) => {
  const ci = stageIndex(current);
  return (
    <div className={`wf-timeline ${compact ? 'wf-timeline-compact' : ''}`}>
      {STAGE_ORDER.map((stage, i) => {
        const state = i < ci ? 'done' : i === ci ? 'current' : 'pending';
        return (
          <div key={stage} className={`wf-step wf-step-${state}`}>
            <div className="wf-step-icon">
              {state === 'done' && <CheckCircle2 size={18} />}
              {state === 'current' && <Loader2 size={18} className="wf-spin" />}
              {state === 'pending' && <Circle size={18} />}
            </div>
            <div className="wf-step-text">
              <div className="wf-step-title">{stage}</div>
              {!compact && <div className="wf-step-blurb">{stageBlurb[stage]}</div>}
            </div>
            {i < STAGE_ORDER.length - 1 && <div className="wf-step-line" />}
          </div>
        );
      })}
    </div>
  );
};

export default WorkflowTimeline;
