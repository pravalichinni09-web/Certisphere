/**
 * Cross-role inbox seeder
 * -----------------------
 * Idempotent (one-shot) demo seeder that guarantees every role's RoleInbox
 * has realistic pending handoffs on first load. Runs *after* the existing
 * `globalDemoSeeder` so it can safely look at live client IDs already in
 * `cms_client_registrations`.
 *
 * Flag: `cms_inbox_seed_v1`. Clear the key to re-seed.
 *
 * What it produces:
 *   - At least one workflow row at every key stage so each role's inbox
 *     shows at least one item.
 *   - A "Forwarded to Management" auditor join request so Management's
 *     inbox is populated.
 *   - An "Awaiting Auditee" application dispatch so Auditee's inbox shows
 *     an outstanding application form.
 */

import {
  readWorkflows,
  ensureWorkflow,
  setStage,
  proposeSchedule,
  decideSchedule,
  recordRequirementsReview,
  assignCoordinator,
  WORKFLOW_KEY,
  WorkflowStage,
} from './auditWorkflow';

const SEED_FLAG = 'cms_inbox_seed_v1';

const safe = <T,>(k: string, fallback: T): T => {
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : fallback; } catch { return fallback; }
};
const write = (k: string, v: unknown) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
};

const futureDate = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};
const daysAgo = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString();
};

/** Force a workflow row to a specific stage by replaying minimal handoffs. */
const advanceTo = (clientId: number, target: WorkflowStage) => {
  ensureWorkflow(clientId, 'demo');
  // Always set straight to target — `setStage` records history with note.
  setStage(clientId, target, 'demo', 'Demo seeded.');
};

export const seedInboxDemo = (): boolean => {
  try {
    if (localStorage.getItem(SEED_FLAG) === '1') return false;

    const clients = safe<any[]>('cms_client_registrations', []);
    if (clients.length < 6) {
      // Wait for global seeder to provide enough clients
      return false;
    }

    const ids = clients.map((c) => Number(c.id)).filter((n) => Number.isFinite(n));

    // 1) Coordinator inbox — give it a "Coordinator Assigned" row + "Requirements Reviewed"
    if (ids[0] != null) {
      ensureWorkflow(ids[0], 'demo');
      assignCoordinator(ids[0], 'Praveen Gangarapu', 'Management');
    }
    if (ids[1] != null) {
      ensureWorkflow(ids[1], 'demo');
      assignCoordinator(ids[1], 'Praveen Gangarapu', 'Management');
      recordRequirementsReview(
        ids[1],
        { scope: 'Demo seeded.', standards: ['ISO 9001:2015'], documents: ['Quality Manual'], notes: 'Ready for scheduling.' },
        'Praveen Gangarapu'
      );
    }

    // 2) Auditee inbox — workflow at Schedule Proposed (Pending)
    if (ids[2] != null) {
      ensureWorkflow(ids[2], 'demo');
      assignCoordinator(ids[2], 'Praveen Gangarapu', 'Management');
      recordRequirementsReview(
        ids[2],
        { scope: 'Demo seeded.', standards: ['ISO 14001:2015'], documents: ['Env policy'], notes: 'OK' },
        'Praveen Gangarapu'
      );
      proposeSchedule(
        ids[2],
        { proposedDate: futureDate(10), proposedTime: '10:00', leadAuditor: 'Anita Verma', auditor: 'Sandeep Joshi', notes: 'Surveillance 1' },
        'Praveen Gangarapu'
      );
    }

    // 3) Lead Auditor inbox — workflow at "Schedule Approved by Auditee"
    if (ids[3] != null) {
      ensureWorkflow(ids[3], 'demo');
      assignCoordinator(ids[3], 'Praveen Gangarapu', 'Management');
      recordRequirementsReview(
        ids[3],
        { scope: 'Demo seeded.', standards: ['ISO 27001:2022'], documents: ['SoA'], notes: 'OK' },
        'Praveen Gangarapu'
      );
      proposeSchedule(
        ids[3],
        { proposedDate: futureDate(14), proposedTime: '09:30', leadAuditor: 'Rajesh Kumar', auditor: 'Priya Reddy', notes: 'Surveillance 2' },
        'Praveen Gangarapu'
      );
      decideSchedule(ids[3], 'Approved', 'Confirmed.', 'Auditee · Sarah Smith');
    }

    // 4) Auditor inbox — workflow at "Assigned Auditors"
    if (ids[4] != null) {
      ensureWorkflow(ids[4], 'demo');
      advanceTo(ids[4], 'Assigned Auditors (Lead auditor, Auditor)');
    }

    // 5) Audit-in-progress (visible to LA + Auditor)
    if (ids[5] != null) {
      ensureWorkflow(ids[5], 'demo');
      advanceTo(ids[5], 'Audit In Progress');
    }

    // 6) Auditee inbox — Audit findings (needs corrective actions)
    if (ids[6] != null) {
      ensureWorkflow(ids[6], 'demo');
      advanceTo(ids[6], 'Audit findings');
    }

    // 7) Lead Auditor inbox — Action items released to Auditor
    if (ids[7] != null) {
      ensureWorkflow(ids[7], 'demo');
      advanceTo(ids[7], 'Action items released to Auditor');
    }

    // 8) Coordinator + Management inbox — Review and Approval by Auditor
    if (ids[0] != null) {
      // overwrite ids[0] to a later stage so coord/mgmt both see cert work
      ensureWorkflow(ids[0], 'demo');
      advanceTo(ids[0], 'Review and Approval by Auditor');
    }

    // ----- Auditor join request forwarded to Management -----
    const ARS_KEY = 'cms_auditor_requests_v1';
    const reqs = safe<any[]>(ARS_KEY, []);
    let touched = false;
    if (reqs.length > 0) {
      const idx = reqs.findIndex((r: any) => r.status === 'New' || r.status === 'Under Review');
      if (idx >= 0 && reqs[idx].status !== 'Forwarded to Management') {
        reqs[idx] = {
          ...reqs[idx],
          status: 'Forwarded to Management',
          forwardedToManagementAt: daysAgo(1),
          reviewedByCoordinator: { by: 'Praveen Gangarapu', at: daysAgo(2), note: 'Looks good — pass to management.' },
        };
        touched = true;
      }
      // Also keep one in "Under Review" for Lead Auditor inbox
      const ur = reqs.findIndex((r: any) => r.status === 'New');
      if (ur >= 0) {
        reqs[ur] = { ...reqs[ur], status: 'Under Review' };
        touched = true;
      }
    }
    if (touched) write(ARS_KEY, reqs);

    // ----- Application dispatches awaiting auditee submission -----
    const APP_KEY = 'cms_application_dispatch_v7';
    const apps = safe<any[]>(APP_KEY, []);
    if (apps.length === 0 && clients[1]) {
      const c = clients[1];
      apps.push({
        id: 'demo-app-1',
        organizationName: c.organizationName || c.name || 'Demo Org',
        email: c.email || 'demo@example.com',
        status: 'Awaiting Auditee',
        sentAt: daysAgo(2),
        createdAt: daysAgo(2),
      });
      write(APP_KEY, apps);
    }

    // After all the writes, broadcast so any mounted inbox refreshes.
    try {
      window.dispatchEvent(new CustomEvent('audit-workflow-updated', { detail: readWorkflows() }));
      window.dispatchEvent(new CustomEvent('cms-workflow-handoff'));
    } catch { /* ignore */ }

    localStorage.setItem(SEED_FLAG, '1');
    return true;
  } catch {
    return false;
  }
};

// Re-export so consumers can clear the workflow if they need to reseed manually
export { WORKFLOW_KEY };
