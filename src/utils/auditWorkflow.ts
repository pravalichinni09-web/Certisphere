// Audit Workflow engine
// -----------------------------------------------------------------------------
// Tracks each client's progress through the certification workflow.
//
//   Stage 1  Pre-Registration
//   Stage 2  Registration Submitted   (auditee just registered)
//   Stage 3  Coordinator Assigned     (management picked an Audit Coordinator)
//   Stage 4  Requirements Reviewed    (coordinator/auditor finished checklist)
//   Stage 5  Schedule Proposed        (coordinator proposed an audit date)
//   Stage 6  Assigned Auditors       (lead auditor + auditor assigned)
//   Stage 7  Schedule Approved by Auditee
//   Stage 8  Schedule Approved by Auditor
//   Stage 9  Audit In Progress        (audit running)
//   Stage 10 Audit Completed
//   Stage 11 Audit findings
//   Stage 12 Action items released to Auditor
//   Stage 13 Review and Approval by Auditor
//   Stage 14 Certification released

export type WorkflowStage =
  | 'Pre-Registration'
  | 'Registration Submitted'
  | 'Coordinator Assigned'
  | 'Requirements Reviewed'
  | 'Schedule Proposed'
  | 'Assigned Auditors (Lead auditor, Auditor)'
  | 'Schedule Approved by Auditee'
  | 'Schedule Approved by Auditor'
  | 'Audit In Progress'
  | 'Audit Completed'
  | 'Audit findings'
  | 'Action items released to Auditor'
  | 'Review and Approval by Auditor'
  | 'Certification released';

export const STAGE_ORDER: WorkflowStage[] = [
  'Pre-Registration',
  'Registration Submitted',
  'Coordinator Assigned',
  'Requirements Reviewed',
  'Schedule Proposed',
  'Assigned Auditors (Lead auditor, Auditor)',
  'Schedule Approved by Auditee',
  'Schedule Approved by Auditor',
  'Audit In Progress',
  'Audit Completed',
  'Audit findings',
  'Action items released to Auditor',
  'Review and Approval by Auditor',
  'Certification released',
];

export interface WorkflowEvent {
  stage: WorkflowStage;
  at: string;       // ISO timestamp
  by?: string;      // who triggered it (role / name)
  note?: string;
}

export interface ProposedSchedule {
  proposedDate: string;          // YYYY-MM-DD
  proposedTime?: string;          // optional
  auditor?: string;
  leadAuditor?: string;
  notes?: string;
  proposedAt: string;
  proposedBy?: string;
  decision?: 'Pending' | 'Approved' | 'Declined';
  decisionAt?: string;
  decisionNote?: string;
}

export interface RequirementsReview {
  scope?: string;
  standards?: string[];
  documents?: string[];      // free-text "documents collected"
  notes?: string;
  reviewedAt: string;
  reviewedBy?: string;
}

export interface WorkflowRecord {
  clientId: number;
  currentStage: WorkflowStage;
  assignedCoordinator?: string;          // name/email of audit coordinator
  assignedAt?: string;
  requirements?: RequirementsReview;
  schedule?: ProposedSchedule;
  history: WorkflowEvent[];
  createdAt: string;
  updatedAt: string;
}

export const WORKFLOW_KEY = 'cms_audit_workflow';

// --- I/O ------------------------------------------------------------------

export const readWorkflows = (): WorkflowRecord[] => {
  try {
    const raw = localStorage.getItem(WORKFLOW_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const writeWorkflows = (items: WorkflowRecord[]): void => {
  localStorage.setItem(WORKFLOW_KEY, JSON.stringify(items));
  try {
    window.dispatchEvent(
      new CustomEvent('audit-workflow-updated', { detail: items })
    );
  } catch { /* ignore */ }
};

export const getWorkflow = (clientId: number): WorkflowRecord | null => {
  return readWorkflows().find((w) => w.clientId === clientId) || null;
};

// --- Mutations ------------------------------------------------------------

const NOW = () => new Date().toISOString();

export const ensureWorkflow = (
  clientId: number,
  by?: string
): WorkflowRecord => {
  const all = readWorkflows();
  const existing = all.find((w) => w.clientId === clientId);
  if (existing) return existing;
  const created: WorkflowRecord = {
    clientId,
    currentStage: 'Registration Submitted',
    history: [{ stage: 'Registration Submitted', at: NOW(), by }],
    createdAt: NOW(),
    updatedAt: NOW(),
  };
  writeWorkflows([...all, created]);
  return created;
};

const advance = (clientId: number, mutate: (w: WorkflowRecord) => void): WorkflowRecord | null => {
  const all = readWorkflows();
  const idx = all.findIndex((w) => w.clientId === clientId);
  if (idx === -1) return null;
  const next = { ...all[idx], updatedAt: NOW() };
  mutate(next);
  all[idx] = next;
  writeWorkflows(all);
  return next;
};

export const assignCoordinator = (
  clientId: number,
  coordinator: string,
  by?: string
): WorkflowRecord | null =>
  advance(clientId, (w) => {
    w.assignedCoordinator = coordinator;
    w.assignedAt = NOW();
    w.currentStage = 'Coordinator Assigned';
    w.history.push({
      stage: 'Coordinator Assigned',
      at: NOW(),
      by,
      note: `Assigned to ${coordinator}`,
    });
  });

export const recordRequirementsReview = (
  clientId: number,
  payload: Omit<RequirementsReview, 'reviewedAt'>,
  by?: string
): WorkflowRecord | null =>
  advance(clientId, (w) => {
    w.requirements = { ...payload, reviewedAt: NOW(), reviewedBy: by };
    w.currentStage = 'Requirements Reviewed';
    w.history.push({
      stage: 'Requirements Reviewed',
      at: NOW(),
      by,
      note: payload.notes,
    });
  });

export const proposeSchedule = (
  clientId: number,
  payload: Omit<ProposedSchedule, 'proposedAt' | 'decision'>,
  by?: string
): WorkflowRecord | null =>
  advance(clientId, (w) => {
    w.schedule = {
      ...payload,
      proposedAt: NOW(),
      proposedBy: by,
      decision: 'Pending',
    };
    w.currentStage = 'Schedule Proposed';
    w.history.push({
      stage: 'Schedule Proposed',
      at: NOW(),
      by,
      note: `Proposed ${payload.proposedDate}${payload.proposedTime ? ' ' + payload.proposedTime : ''}`,
    });
  });

export const decideSchedule = (
  clientId: number,
  decision: 'Approved' | 'Declined',
  note: string | undefined,
  by?: string
): WorkflowRecord | null =>
  advance(clientId, (w) => {
    if (!w.schedule) return;
    w.schedule = {
      ...w.schedule,
      decision,
      decisionAt: NOW(),
      decisionNote: note,
    };
    if (decision === 'Approved') {
      w.currentStage = 'Schedule Approved by Auditee';
      w.history.push({ stage: 'Schedule Approved by Auditee', at: NOW(), by, note });
    } else {
      // stay at Schedule Proposed so coordinator can re-propose; record event
      w.history.push({
        stage: 'Schedule Proposed',
        at: NOW(),
        by,
        note: `Declined${note ? ': ' + note : ''}`,
      });
    }
  });

export const setStage = (
  clientId: number,
  stage: WorkflowStage,
  by?: string,
  note?: string
): WorkflowRecord | null =>
  advance(clientId, (w) => {
    w.currentStage = stage;
    w.history.push({ stage, at: NOW(), by, note });
  });

// --- Helpers --------------------------------------------------------------

export const stageIndex = (s: WorkflowStage): number => STAGE_ORDER.indexOf(s);

export const isAtOrBefore = (stage: WorkflowStage, target: WorkflowStage): boolean =>
  stageIndex(stage) <= stageIndex(target);

export const isAtOrAfter = (stage: WorkflowStage, target: WorkflowStage): boolean =>
  stageIndex(stage) >= stageIndex(target);

/** Friendly label + color for a stage. */
export const STAGE_META: Record<WorkflowStage, { color: string; bg: string }> = {
  'Pre-Registration':                         { color: '#475569', bg: 'rgba(148,163,184,.10)' },
  'Registration Submitted':                   { color: '#1d4ed8', bg: 'rgba(59,130,246,.10)' },
  'Coordinator Assigned':                     { color: '#4338ca', bg: 'rgba(99,102,241,.18)' },
  'Requirements Reviewed':                    { color: '#0891b2', bg: 'rgba(8,145,178,.10)' },
  'Schedule Proposed':                        { color: '#d97706', bg: 'rgba(245,158,11,.12)' },
  'Assigned Auditors (Lead auditor, Auditor)':{ color: '#0f766e', bg: 'rgba(20,184,166,.12)' },
  'Schedule Approved by Auditee':             { color: '#047857', bg: 'rgba(16,185,129,.12)' },
  'Schedule Approved by Auditor':             { color: '#0f766e', bg: 'rgba(20,184,166,.18)' },
  'Audit In Progress':                        { color: '#4338ca', bg: 'rgba(99,102,241,.10)' },
  'Audit Completed':                          { color: '#1e40af', bg: 'rgba(59,130,246,.10)' },
  'Audit findings':                           { color: '#b45309', bg: 'rgba(245,158,11,.12)' },
  'Action items released to Auditor':         { color: '#831843', bg: 'rgba(236,72,153,.12)' },
  'Review and Approval by Auditor':           { color: '#9333ea', bg: 'rgba(168,85,247,.12)' },
  'Certification released':                   { color: '#064e3b', bg: 'rgba(5,150,105,.12)' },
};
