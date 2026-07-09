/**
 * Cross-role workflow handoff service
 * -----------------------------------
 * Single source of truth for role-to-role handoffs. Every page that "passes
 * work to the next role" routes through here. The service:
 *
 *   1. Writes through the existing `cms_audit_workflow` store
 *      (so the 14-stage tracker stays in sync).
 *   2. Updates the auxiliary store(s) that page touches
 *      (e.g. `cms_audit_schedules`, `cms_auditor_requests_v1`).
 *   3. Broadcasts a uniform `cms-workflow-handoff` event so any open page
 *      in any role refreshes immediately.
 *
 * The `getPendingForRole(role)` query returns the inbox of items that
 * require the given role's action — that powers the RoleInbox card.
 */

import {
  WorkflowRecord,
  readWorkflows,
  ensureWorkflow,
  setStage,
  assignCoordinator,
  recordRequirementsReview,
  proposeSchedule,
  decideSchedule,
  STAGE_ORDER,
} from '../utils/auditWorkflow';

/* ---------- Roles --------------------------------------------------------- */

export type Role =
  | 'Audit Coordinator'
  | 'Management'
  | 'Lead Auditor'
  | 'Auditor'
  | 'Auditee'
  | 'Client Coordinator';

/* ---------- Inbox model --------------------------------------------------- */

export interface PendingItem {
  /** Stable id we can use as React key */
  id: string;
  /** Pretty title shown on the card */
  title: string;
  /** Sub-line explaining what's needed */
  subtitle: string;
  /** Stage / category badge */
  badge: string;
  /** Badge colours */
  badgeColor: string;
  badgeBg: string;
  /** Deep link the user should jump to */
  link: string;
  linkLabel: string;
  /** Optional ISO timestamp the item was created/handed-off */
  receivedAt?: string;
  /** Used for sorting — higher means more urgent */
  weight: number;
}

/* ---------- Internal helpers ---------------------------------------------- */

const safeJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const broadcast = () => {
  try {
    window.dispatchEvent(new CustomEvent('cms-workflow-handoff'));
  } catch { /* ignore */ }
};

const clientLabel = (clientId: number): string => {
  const clients = safeJSON<any[]>('cms_client_registrations', []);
  const hit = clients.find((c) => Number(c.id) === Number(clientId));
  return hit ? (hit.organizationName || hit.name || `Client #${clientId}`) : `Client #${clientId}`;
};

/* ---------- Handoff mutations -------------------------------------------- */

/** Coordinator submits the requirements review. */
export const submitRequirementsReview = (
  clientId: number,
  payload: {
    scope?: string;
    standards?: string[];
    documents?: string[];
    notes?: string;
  },
  by: string,
): WorkflowRecord | null => {
  ensureWorkflow(clientId, by);
  const r = recordRequirementsReview(clientId, payload, by);
  broadcast();
  return r;
};

/** Coordinator assigns a lead auditor + auditor to a workflow row. */
export const assignAuditors = (
  clientId: number,
  team: { leadAuditor: string; auditor?: string },
  by: string,
): WorkflowRecord | null => {
  ensureWorkflow(clientId, by);
  const r = setStage(
    clientId,
    'Assigned Auditors (Lead auditor, Auditor)',
    by,
    `Lead: ${team.leadAuditor}${team.auditor ? `, Auditor: ${team.auditor}` : ''}`,
  );
  broadcast();
  return r;
};

/** Coordinator proposes a schedule (date/time + team). */
export const proposeAuditSchedule = (
  clientId: number,
  schedule: {
    proposedDate: string;
    proposedTime?: string;
    leadAuditor?: string;
    auditor?: string;
    notes?: string;
  },
  by: string,
): WorkflowRecord | null => {
  ensureWorkflow(clientId, by);
  const r = proposeSchedule(clientId, schedule, by);
  broadcast();
  return r;
};

/** Auditee approves / declines the proposed schedule. */
export const auditeeDecideSchedule = (
  clientId: number,
  decision: 'Approved' | 'Declined',
  note: string | undefined,
  by: string,
): WorkflowRecord | null => {
  const r = decideSchedule(clientId, decision, note, by);
  broadcast();
  return r;
};

/** Auditor confirms the schedule from their side. */
export const auditorConfirmSchedule = (
  clientId: number,
  by: string,
  note?: string,
): WorkflowRecord | null => {
  const r = setStage(clientId, 'Schedule Approved by Auditor', by, note || 'Auditor confirmed availability.');
  broadcast();
  return r;
};

/** Lead Auditor / Auditor starts the on-site audit. */
export const startAudit = (
  clientId: number,
  by: string,
  note?: string,
): WorkflowRecord | null => {
  const r = setStage(clientId, 'Audit In Progress', by, note || 'On-site audit started.');
  broadcast();
  return r;
};

/** Lead Auditor closes the on-site audit. */
export const completeAudit = (
  clientId: number,
  by: string,
  note?: string,
): WorkflowRecord | null => {
  const r = setStage(clientId, 'Audit Completed', by, note || 'Closing meeting held.');
  broadcast();
  return r;
};

/** Auditor publishes findings to the auditee. */
export const releaseFindings = (
  clientId: number,
  by: string,
  note?: string,
): WorkflowRecord | null => {
  const r = setStage(clientId, 'Audit findings', by, note || 'Findings released to auditee.');
  broadcast();
  return r;
};

/** Auditee submits corrective actions; goes to the Auditor for review. */
export const releaseActionItems = (
  clientId: number,
  by: string,
  note?: string,
): WorkflowRecord | null => {
  const r = setStage(clientId, 'Action items released to Auditor', by, note || 'Corrective actions released.');
  broadcast();
  return r;
};

/** Lead Auditor accepts the corrective actions and recommends certification. */
export const approveActionItems = (
  clientId: number,
  by: string,
  note?: string,
): WorkflowRecord | null => {
  const r = setStage(clientId, 'Review and Approval by Auditor', by, note || 'Actions reviewed and accepted.');
  broadcast();
  return r;
};

/** Coordinator + Management release the certificate. */
export const releaseCertification = (
  clientId: number,
  by: string,
  certNumber?: string,
): WorkflowRecord | null => {
  const r = setStage(
    clientId,
    'Certification released',
    by,
    certNumber ? `Certificate #${certNumber} issued.` : 'Certificate issued.',
  );
  broadcast();
  return r;
};

/* ---------- Helper exported for callers ---------------------------------- */

export const beginRegistration = (
  clientId: number,
  by: string,
): WorkflowRecord => {
  const r = ensureWorkflow(clientId, by);
  broadcast();
  return r;
};

export const assignCoordinatorTo = (
  clientId: number,
  coordinator: string,
  by: string,
): WorkflowRecord | null => {
  const r = assignCoordinator(clientId, coordinator, by);
  broadcast();
  return r;
};

/* ---------- Inbox query: what does this role need to act on? ------------- */

interface BuildPendingCtx {
  workflows: WorkflowRecord[];
}

const pendingForCoordinator = (ctx: BuildPendingCtx): PendingItem[] => {
  const items: PendingItem[] = [];

  // New auditor join requests waiting for coordinator review
  const auditorReqs = safeJSON<any[]>('cms_auditor_requests_v1', []);
  auditorReqs
    .filter((r) => r.status === 'New' || r.status === 'Form Returned')
    .forEach((r) => {
      items.push({
        id: `ar-${r.id}`,
        title: `Auditor join request — ${r.name}`,
        subtitle: `${r.role || 'Auditor'} · ${r.country || '—'} · received ${new Date(r.receivedAt).toLocaleDateString()}`,
        badge: r.status,
        badgeColor: '#0e7490',
        badgeBg: '#cffafe',
        link: '/auditor-coordinator/auditor-requests',
        linkLabel: 'Review',
        receivedAt: r.receivedAt,
        weight: 80,
      });
    });

  // Workflow rows that need coordinator action
  ctx.workflows.forEach((w) => {
    const cl = clientLabel(w.clientId);
    if (w.currentStage === 'Coordinator Assigned') {
      items.push({
        id: `wf-${w.clientId}-req`,
        title: `Requirements review — ${cl}`,
        subtitle: 'Collect scope docs and mark requirements reviewed.',
        badge: w.currentStage,
        badgeColor: '#7c3aed',
        badgeBg: '#ede9fe',
        link: '/auditor-coordinator/audit-workflow',
        linkLabel: 'Open',
        receivedAt: w.updatedAt,
        weight: 70,
      });
    }
    if (w.currentStage === 'Requirements Reviewed') {
      items.push({
        id: `wf-${w.clientId}-sched`,
        title: `Propose schedule — ${cl}`,
        subtitle: 'Propose audit date and assign Lead Auditor + Auditor.',
        badge: w.currentStage,
        badgeColor: '#0891b2',
        badgeBg: 'rgba(8,145,178,.10)',
        link: '/auditor-coordinator/audit-schedules',
        linkLabel: 'Schedule',
        receivedAt: w.updatedAt,
        weight: 75,
      });
    }
    if (w.currentStage === 'Review and Approval by Auditor') {
      items.push({
        id: `wf-${w.clientId}-cert`,
        title: `Issue certificate — ${cl}`,
        subtitle: 'Generate certificate and route to Management for approval.',
        badge: w.currentStage,
        badgeColor: '#9333ea',
        badgeBg: 'rgba(168,85,247,.12)',
        link: '/auditor-coordinator/audit-certifications',
        linkLabel: 'Generate',
        receivedAt: w.updatedAt,
        weight: 90,
      });
    }
  });

  return items;
};

const pendingForManagement = (ctx: BuildPendingCtx): PendingItem[] => {
  const items: PendingItem[] = [];

  // Workflow rows waiting for a coordinator assignment
  ctx.workflows
    .filter((w) => w.currentStage === 'Registration Submitted')
    .forEach((w) => {
      items.push({
        id: `mg-${w.clientId}-assign`,
        title: `Assign coordinator — ${clientLabel(w.clientId)}`,
        subtitle: 'New client registered; assign an Audit Coordinator.',
        badge: w.currentStage,
        badgeColor: '#1d4ed8',
        badgeBg: '#dbeafe',
        link: '/management/audit-assignments',
        linkLabel: 'Assign',
        receivedAt: w.updatedAt,
        weight: 85,
      });
    });

  // Cert approvals
  ctx.workflows
    .filter((w) => w.currentStage === 'Review and Approval by Auditor')
    .forEach((w) => {
      items.push({
        id: `mg-${w.clientId}-cert`,
        title: `Approve certificate — ${clientLabel(w.clientId)}`,
        subtitle: 'Coordinator generated the certificate; final management approval needed.',
        badge: w.currentStage,
        badgeColor: '#9333ea',
        badgeBg: 'rgba(168,85,247,.12)',
        link: '/management/audit-assignments',
        linkLabel: 'Approve',
        receivedAt: w.updatedAt,
        weight: 95,
      });
    });

  // Auditor join requests forwarded for final approval
  const auditorReqs = safeJSON<any[]>('cms_auditor_requests_v1', []);
  auditorReqs
    .filter((r) => r.status === 'Forwarded to Management')
    .forEach((r) => {
      items.push({
        id: `mg-ar-${r.id}`,
        title: `Approve auditor — ${r.name}`,
        subtitle: `${r.role || 'Auditor'} · ${r.country || '—'} · coordinator-reviewed.`,
        badge: r.status,
        badgeColor: '#0e7490',
        badgeBg: '#cffafe',
        link: '/management/client-credentials',
        linkLabel: 'Issue credentials',
        receivedAt: r.receivedAt,
        weight: 75,
      });
    });

  return items;
};

const pendingForLeadAuditor = (ctx: BuildPendingCtx): PendingItem[] => {
  const items: PendingItem[] = [];

  // Schedules approved by auditee; LA confirms team availability
  ctx.workflows
    .filter((w) => w.currentStage === 'Schedule Approved by Auditee')
    .forEach((w) => {
      items.push({
        id: `la-${w.clientId}-confirm`,
        title: `Confirm team — ${clientLabel(w.clientId)}`,
        subtitle: `Auditee approved ${w.schedule?.proposedDate ?? 'the date'}; lock the team.`,
        badge: w.currentStage,
        badgeColor: '#047857',
        badgeBg: 'rgba(16,185,129,.12)',
        link: '/lead-auditor/audit-schedules',
        linkLabel: 'Confirm',
        receivedAt: w.updatedAt,
        weight: 80,
      });
    });

  // Audits in progress that the LA leads
  ctx.workflows
    .filter((w) => w.currentStage === 'Audit In Progress')
    .forEach((w) => {
      items.push({
        id: `la-${w.clientId}-progress`,
        title: `On-site audit — ${clientLabel(w.clientId)}`,
        subtitle: 'Capture findings and close out the audit.',
        badge: w.currentStage,
        badgeColor: '#4338ca',
        badgeBg: 'rgba(99,102,241,.10)',
        link: '/lead-auditor/conduct-audit',
        linkLabel: 'Open',
        receivedAt: w.updatedAt,
        weight: 85,
      });
    });

  // Action items returned by auditee for LA review
  ctx.workflows
    .filter((w) => w.currentStage === 'Action items released to Auditor')
    .forEach((w) => {
      items.push({
        id: `la-${w.clientId}-actions`,
        title: `Review corrective actions — ${clientLabel(w.clientId)}`,
        subtitle: 'Auditee submitted corrective actions; review and accept.',
        badge: w.currentStage,
        badgeColor: '#831843',
        badgeBg: 'rgba(236,72,153,.12)',
        link: '/lead-auditor/action-review',
        linkLabel: 'Review',
        receivedAt: w.updatedAt,
        weight: 90,
      });
    });

  // Auditor approval queue forwarded by coordinator
  const auditorReqs = safeJSON<any[]>('cms_auditor_requests_v1', []);
  auditorReqs
    .filter((r) => r.status === 'Under Review')
    .forEach((r) => {
      items.push({
        id: `la-ar-${r.id}`,
        title: `Technical review — ${r.name}`,
        subtitle: `${r.role || 'Auditor'} · ${r.specialization || '—'}`,
        badge: 'Under Review',
        badgeColor: '#9a3412',
        badgeBg: '#fed7aa',
        link: '/lead-auditor/auditor-approvals',
        linkLabel: 'Open',
        receivedAt: r.receivedAt,
        weight: 70,
      });
    });

  return items;
};

const pendingForAuditor = (ctx: BuildPendingCtx): PendingItem[] => {
  const items: PendingItem[] = [];

  // Auditor needs to confirm assigned schedule
  ctx.workflows
    .filter((w) => w.currentStage === 'Assigned Auditors (Lead auditor, Auditor)' ||
                   w.currentStage === 'Schedule Approved by Auditee')
    .forEach((w) => {
      items.push({
        id: `au-${w.clientId}-confirm`,
        title: `Confirm assignment — ${clientLabel(w.clientId)}`,
        subtitle: `Assigned for ${w.schedule?.proposedDate ?? 'a scheduled audit'}.`,
        badge: w.currentStage,
        badgeColor: '#0f766e',
        badgeBg: 'rgba(20,184,166,.12)',
        link: '/auditor/schedule-confirmations',
        linkLabel: 'Confirm',
        receivedAt: w.updatedAt,
        weight: 80,
      });
    });

  // On-site audit work
  ctx.workflows
    .filter((w) => w.currentStage === 'Audit In Progress')
    .forEach((w) => {
      items.push({
        id: `au-${w.clientId}-onsite`,
        title: `On-site audit — ${clientLabel(w.clientId)}`,
        subtitle: 'Execute checklist and capture findings.',
        badge: w.currentStage,
        badgeColor: '#4338ca',
        badgeBg: 'rgba(99,102,241,.10)',
        link: '/auditor/conduct-audit',
        linkLabel: 'Open',
        receivedAt: w.updatedAt,
        weight: 90,
      });
    });

  // Audit findings drafts / report drafting
  ctx.workflows
    .filter((w) => w.currentStage === 'Audit Completed' || w.currentStage === 'Audit findings')
    .forEach((w) => {
      items.push({
        id: `au-${w.clientId}-report`,
        title: `Draft audit report — ${clientLabel(w.clientId)}`,
        subtitle: 'Compile the audit report from on-site findings.',
        badge: w.currentStage,
        badgeColor: '#b45309',
        badgeBg: 'rgba(245,158,11,.12)',
        link: '/auditor/audit-report',
        linkLabel: 'Draft',
        receivedAt: w.updatedAt,
        weight: 85,
      });
    });

  return items;
};

const pendingForAuditee = (ctx: BuildPendingCtx): PendingItem[] => {
  const items: PendingItem[] = [];

  // Schedule proposals awaiting auditee approval
  ctx.workflows
    .filter((w) => w.currentStage === 'Schedule Proposed' && (!w.schedule?.decision || w.schedule.decision === 'Pending'))
    .forEach((w) => {
      items.push({
        id: `ae-${w.clientId}-sched`,
        title: `Approve proposed date — ${clientLabel(w.clientId)}`,
        subtitle: `Coordinator proposed ${w.schedule?.proposedDate ?? 'a date'} ${w.schedule?.proposedTime ?? ''}.`,
        badge: w.currentStage,
        badgeColor: '#d97706',
        badgeBg: 'rgba(245,158,11,.12)',
        link: '/audit-client/schedule-approvals',
        linkLabel: 'Approve',
        receivedAt: w.updatedAt,
        weight: 90,
      });
    });

  // Findings awaiting corrective actions
  ctx.workflows
    .filter((w) => w.currentStage === 'Audit findings')
    .forEach((w) => {
      items.push({
        id: `ae-${w.clientId}-actions`,
        title: `Submit corrective actions — ${clientLabel(w.clientId)}`,
        subtitle: 'Findings released by the auditor; submit your corrective actions.',
        badge: w.currentStage,
        badgeColor: '#b45309',
        badgeBg: 'rgba(245,158,11,.12)',
        link: '/audit-client/submit-report',
        linkLabel: 'Submit',
        receivedAt: w.updatedAt,
        weight: 85,
      });
    });

  // Pending applications
  const apps = safeJSON<any[]>('cms_application_dispatch_v7', []);
  apps
    .filter((a) => a.status === 'Sent' || a.status === 'Awaiting Auditee')
    .forEach((a) => {
      items.push({
        id: `ae-app-${a.id}`,
        title: `Complete application — ${a.organizationName || a.email || 'pending application'}`,
        subtitle: 'Coordinator dispatched the certification application form.',
        badge: 'Awaiting auditee',
        badgeColor: '#1d4ed8',
        badgeBg: '#dbeafe',
        link: '/audit-client/pending-applications',
        linkLabel: 'Open',
        receivedAt: a.sentAt || a.createdAt,
        weight: 70,
      });
    });

  return items;
};

/** Returns the inbox for a role, sorted high-priority first. */
export const getPendingForRole = (role: Role): PendingItem[] => {
  const workflows = readWorkflows();
  const ctx: BuildPendingCtx = { workflows };

  let items: PendingItem[] = [];
  switch (role) {
    case 'Audit Coordinator': items = pendingForCoordinator(ctx); break;
    case 'Management':        items = pendingForManagement(ctx); break;
    case 'Lead Auditor':      items = pendingForLeadAuditor(ctx); break;
    case 'Auditor':           items = pendingForAuditor(ctx); break;
    case 'Auditee':           items = pendingForAuditee(ctx); break;
    case 'Client Coordinator': items = pendingForAuditee(ctx); break;
  }

  // Sort: weight desc, then receivedAt desc
  items.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    const ta = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
    const tb = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
    return tb - ta;
  });
  return items;
};

/** Convenience: count of pending items for a role. */
export const countPendingForRole = (role: Role): number =>
  getPendingForRole(role).length;

/** Re-export the canonical stage list for callers. */
export { STAGE_ORDER };
