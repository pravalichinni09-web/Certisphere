/**
 * WorkflowStagePanel
 * ----------------------------------------------------------------------
 * The manual way to move a client along the CertiSphere workflow map.
 * Each role's screen shows the step that role owns: the clients waiting
 * at that step, what to do, and the buttons to do it. Completing a step
 * moves the client to the next stage and hands it to the next role.
 *
 * Steps (matching the workflow map):
 *   mgmt-assign        Management · Client Onboarding      → Coordinator Assigned
 *   coord-team         Coordinator · Auditor Assignment     → Assigned Auditors
 *   auditee-schedule   Auditee · Schedule Approvals         → Schedule Approved by Auditee
 *   lead-confirm       Lead Auditor · Audit Schedules       → Schedule Approved by Auditor
 *   auditor-confirm    Auditor · Schedule Confirmations     → Schedule Approved by Auditor
 *   auditee-actions    Auditee · Audit Actions              → Action items released to Auditor
 *   auditor-review     Auditor · Action Review              (reviewed, forwarded to Lead Auditor)
 *   lead-accept        Lead Auditor · Action Approval       → Review and Approval by Auditor
 *   coord-certificate  Coordinator · Audit Certifications   (certificate generated)
 *   mgmt-certificate   Management · Dashboard               → Certification released
 *   coord-deliver      Coordinator · Certificate Delivery   (certificate delivered)
 *   cc-certificates    Client Coordinator · Certifications  (read-only)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, ArrowRight, Workflow, ChevronDown, ChevronUp } from 'lucide-react';
import { readWorkflows, WorkflowRecord, WorkflowStage, STAGE_ORDER } from '../utils/auditWorkflow';
import {
  assignCoordinatorTo,
  assignAuditors,
  auditeeDecideSchedule,
  auditorConfirmSchedule,
  releaseActionItems,
  approveActionItems,
  releaseCertification,
  sendBackForReview,
  returnActionsToAuditee,
  getWorkflowFlags,
  setWorkflowFlags,
  noteWorkflow,
  WorkflowFlags,
} from '../services/workflowHandoff';

export type WorkflowStepKey =
  | 'mgmt-assign'
  | 'coord-team'
  | 'auditee-schedule'
  | 'lead-confirm'
  | 'auditor-confirm'
  | 'auditee-actions'
  | 'auditor-review'
  | 'lead-accept'
  | 'coord-certificate'
  | 'mgmt-certificate'
  | 'coord-deliver'
  | 'cc-certificates';

interface Finding {
  id: string;
  severity?: string;
  clause?: string;
  description?: string;
  evidence?: string;
  correctiveAction?: string;
  actionSubmittedAt?: string;
}

type InputKind = 'select' | 'text' | 'date' | 'team';

interface StepAction {
  id: string;
  label: string;
  tone?: 'primary' | 'danger';
  input?: { kind: InputKind; label: string; placeholder?: string; options?: () => string[]; required?: boolean };
  /** Return a string to show as an error instead of running. */
  validate?: (w: WorkflowRecord, value: string, edits: Record<string, string>) => string | null;
  run: (w: WorkflowRecord, value: string, edits: Record<string, string>) => void;
  done: (org: string) => string;
}

interface StepConfig {
  mapStep: string;            // e.g. "Step 4 of 19"
  title: string;
  role: string;
  howTo: string;
  nextRole: string;           // who gets it next
  stages: WorkflowStage[];
  filter?: (w: WorkflowRecord, f: WorkflowFlags) => boolean;
  findings?: 'edit' | 'view';
  actions: StepAction[];
  readOnly?: boolean;
}

/* ---------- data helpers ---------- */
const safeJSON = <T,>(k: string, fb: T): T => {
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : fb; } catch { return fb; }
};
const clientName = (id: number): string => {
  const c = safeJSON<any[]>('cms_client_registrations', []).find((x) => Number(x.id) === Number(id));
  return c ? c.organizationName || c.name || `Client #${id}` : `Client #${id}`;
};
const readFindings = (id: number): Finding[] =>
  safeJSON<Record<string, Finding[]>>('cms_audit_findings_v1', {})[String(id)] || [];
const writeFindings = (id: number, list: Finding[]) => {
  const all = safeJSON<Record<string, Finding[]>>('cms_audit_findings_v1', {});
  all[String(id)] = list;
  try { localStorage.setItem('cms_audit_findings_v1', JSON.stringify(all)); } catch { /* ignore */ }
};
const coordinators = (): string[] => {
  const set = new Set<string>(['Praveen Gangarapu', 'Cora Dinh']);
  readWorkflows().forEach((w) => { if (w.assignedCoordinator) set.add(w.assignedCoordinator); });
  return Array.from(set);
};
const auditorNames = (wantLead: boolean): string[] => {
  const people = [
    ...safeJSON<any[]>('cms_auditors_data', []),
    ...safeJSON<any[]>('cms_auditors', []),
  ];
  const names = people
    .filter((p) => p && p.name && (!p.status || p.status === 'Active'))
    .filter((p) => (wantLead ? /lead/i.test(String(p.role || '')) : true))
    .map((p) => String(p.name));
  const fallback = wantLead ? ['Leo Ashford', 'Rajesh Kumar'] : ['Aaron Diaz', 'Anita Verma'];
  return Array.from(new Set([...names, ...fallback]));
};
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const stageNo = (s: WorkflowStage) => STAGE_ORDER.indexOf(s) + 1;

/* ---------- step definitions ---------- */
const STEPS: Record<WorkflowStepKey, StepConfig> = {
  'mgmt-assign': {
    mapStep: 'Step 3 of 18', title: 'Approve client & assign an Audit Coordinator', role: 'Management',
    howTo: 'New clients registered from the login page ("New client? Register here") wait here. Pick the coordinator who will own the client and click Assign.',
    nextRole: 'Audit Coordinator (Audit Workflow screen)',
    stages: ['Registration Submitted'],
    actions: [{
      id: 'assign', label: 'Assign coordinator', tone: 'primary',
      input: { kind: 'select', label: 'Audit Coordinator', options: coordinators, required: true },
      run: (w, v) => { assignCoordinatorTo(w.clientId, v, 'Management'); },
      done: (o) => `${o}: coordinator assigned. Next: the coordinator reviews requirements on the Audit Workflow screen.`,
    }],
  },
  'coord-team': {
    mapStep: 'Step 6 of 18', title: 'Assign the audit team', role: 'Audit Coordinator',
    howTo: 'After you propose the date on the Audit Workflow screen, the client waits here. Confirm the Lead Auditor and Auditor for the audit.',
    nextRole: 'Auditee (Schedule Approvals screen)',
    stages: ['Schedule Proposed'],
    actions: [{
      id: 'team', label: 'Assign audit team', tone: 'primary',
      input: { kind: 'team', label: 'Audit team', required: true },
      validate: (_w, _v, e) => (!e.lead || !e.auditor ? 'Choose both a Lead Auditor and an Auditor.' : null),
      run: (w, _v, e) => { assignAuditors(w.clientId, { leadAuditor: e.lead, auditor: e.auditor }, 'Audit Coordinator'); },
      done: (o) => `${o}: audit team assigned. Next: the Auditee approves the date on Schedule Approvals.`,
    }],
  },
  'auditee-schedule': {
    mapStep: 'Step 7 of 18', title: 'Approve the proposed audit date', role: 'Auditee',
    howTo: 'Check the proposed date and audit team. Approve it, or decline with a reason so the coordinator can propose a new date.',
    nextRole: 'Lead Auditor (Audit Schedules) and Auditor (Schedule Confirmations)',
    stages: ['Schedule Proposed', 'Assigned Auditors (Lead auditor, Auditor)'],
    filter: (w) => !w.schedule?.decision || w.schedule.decision === 'Pending',
    actions: [
      {
        id: 'approve', label: 'Approve date', tone: 'primary',
        run: (w) => { auditeeDecideSchedule(w.clientId, 'Approved', undefined, 'Auditee'); },
        done: (o) => `${o}: date approved. Next: the Lead Auditor confirms the team on Audit Schedules.`,
      },
      {
        id: 'decline', label: 'Decline', tone: 'danger',
        input: { kind: 'text', label: 'Reason / preferred date', placeholder: 'e.g. Please move to the following week', required: true },
        run: (w, v) => { auditeeDecideSchedule(w.clientId, 'Declined', v, 'Auditee'); },
        done: (o) => `${o}: date declined. The coordinator will propose a new date on the Audit Workflow screen.`,
      },
    ],
  },
  'lead-confirm': {
    mapStep: 'Step 8 of 18', title: 'Confirm the audit team', role: 'Lead Auditor',
    howTo: 'The auditee has approved the date. Confirm the team so the date is locked and the audit can start.',
    nextRole: 'Auditor (Conduct Audit screen)',
    stages: ['Schedule Approved by Auditee'],
    actions: [{
      id: 'confirm', label: 'Confirm team', tone: 'primary',
      run: (w) => { auditorConfirmSchedule(w.clientId, 'Lead Auditor', 'Lead Auditor confirmed the audit team.'); },
      done: (o) => `${o}: team confirmed. Next: the Auditor starts the audit on Conduct Audit.`,
    }],
  },
  'auditor-confirm': {
    mapStep: 'Step 8 of 18', title: 'Confirm your availability', role: 'Auditor',
    howTo: 'The auditee has approved the date. Confirm you are available (the Lead Auditor can also confirm the team).',
    nextRole: 'Auditor (Conduct Audit screen)',
    stages: ['Schedule Approved by Auditee'],
    actions: [{
      id: 'confirm', label: 'Confirm availability', tone: 'primary',
      run: (w) => { auditorConfirmSchedule(w.clientId, 'Auditor', 'Auditor confirmed availability.'); },
      done: (o) => `${o}: availability confirmed. Next: start the audit on Conduct Audit.`,
    }],
  },
  'auditee-actions': {
    mapStep: 'Step 12 of 18', title: 'Submit corrective actions', role: 'Auditee',
    howTo: 'The auditor has released the findings. Write the root cause and corrective action for every finding, then submit them to the auditor.',
    nextRole: 'Auditor (Action Review screen)',
    stages: ['Audit findings'],
    findings: 'edit',
    actions: [{
      id: 'submit', label: 'Submit corrective actions', tone: 'primary',
      validate: (w, _v, e) => {
        const list = readFindings(w.clientId);
        if (list.length === 0) return null;
        const missing = list.filter((f) => !(e[`ca-${f.id}`] ?? f.correctiveAction ?? '').trim()).length;
        return missing ? `Write a corrective action for every finding (${missing} missing).` : null;
      },
      run: (w, _v, e) => {
        const now = new Date().toISOString();
        const list = readFindings(w.clientId).map((f) => ({
          ...f,
          correctiveAction: (e[`ca-${f.id}`] ?? f.correctiveAction ?? '').trim(),
          actionSubmittedAt: now,
        }));
        writeFindings(w.clientId, list);
        releaseActionItems(w.clientId, 'Auditee', `${list.length} corrective action(s) submitted.`);
      },
      done: (o) => `${o}: corrective actions submitted. Next: the Auditor reviews them on Action Review.`,
    }],
  },
  'auditor-review': {
    mapStep: 'Step 13 of 18', title: 'Review corrective actions', role: 'Auditor',
    howTo: 'Read each finding and the auditee\'s corrective action. Forward them to the Lead Auditor, or return them to the auditee if they are not good enough.',
    nextRole: 'Lead Auditor (Action Approval screen)',
    stages: ['Action items released to Auditor'],
    filter: (_w, f) => !f.auditorReviewedAt,
    findings: 'view',
    actions: [
      {
        id: 'forward', label: 'Reviewed — forward to Lead Auditor', tone: 'primary',
        run: (w) => {
          setWorkflowFlags(w.clientId, { auditorReviewedAt: new Date().toISOString() });
          noteWorkflow(w.clientId, 'Auditor', 'Corrective actions reviewed; forwarded to Lead Auditor.');
        },
        done: (o) => `${o}: forwarded. Next: the Lead Auditor accepts the actions on Action Approval.`,
      },
      {
        id: 'return', label: 'Return to auditee', tone: 'danger',
        input: { kind: 'text', label: 'What needs fixing?', required: true },
        run: (w, v) => { returnActionsToAuditee(w.clientId, 'Auditor', v); },
        done: (o) => `${o}: returned to the auditee for rework.`,
      },
    ],
  },
  'lead-accept': {
    mapStep: 'Step 14 of 18', title: 'Accept corrective actions', role: 'Lead Auditor',
    howTo: 'The auditor has reviewed these corrective actions. Accept them to recommend certification, or return them to the auditee.',
    nextRole: 'Audit Coordinator (Audit Certifications screen)',
    stages: ['Action items released to Auditor'],
    filter: (_w, f) => !!f.auditorReviewedAt,
    findings: 'view',
    actions: [
      {
        id: 'accept', label: 'Accept & recommend certification', tone: 'primary',
        run: (w) => { approveActionItems(w.clientId, 'Lead Auditor', 'Corrective actions accepted; certification recommended.'); },
        done: (o) => `${o}: accepted. Next: the coordinator generates the certificate on Audit Certifications.`,
      },
      {
        id: 'return', label: 'Return to auditee', tone: 'danger',
        input: { kind: 'text', label: 'What needs fixing?', required: true },
        run: (w, v) => { returnActionsToAuditee(w.clientId, 'Lead Auditor', v); },
        done: (o) => `${o}: returned to the auditee for rework.`,
      },
    ],
  },
  'coord-certificate': {
    mapStep: 'Step 15 of 18', title: 'Generate the certificate', role: 'Audit Coordinator',
    howTo: 'The Lead Auditor recommended certification. Generate the certificate number and send it to Management for final approval.',
    nextRole: 'Management (Dashboard)',
    stages: ['Review and Approval by Auditor'],
    filter: (_w, f) => !f.certificateGeneratedAt,
    actions: [{
      id: 'generate', label: 'Generate certificate', tone: 'primary',
      run: (w) => {
        const no = `CS-${new Date().getFullYear()}-${String(w.clientId).padStart(4, '0')}`;
        setWorkflowFlags(w.clientId, { certificateNumber: no, certificateGeneratedAt: new Date().toISOString() });
        noteWorkflow(w.clientId, 'Audit Coordinator', `Certificate ${no} generated; sent to Management for approval.`);
      },
      done: (o) => `${o}: certificate generated. Next: Management approves it on the Dashboard.`,
    }],
  },
  'mgmt-certificate': {
    mapStep: 'Step 16 of 18', title: 'Approve the certificate', role: 'Management',
    howTo: 'Final decision. Approve and release the certificate, or send the file back to the audit team with a reason.',
    nextRole: 'Audit Coordinator (Certificate Delivery screen)',
    stages: ['Review and Approval by Auditor'],
    filter: (_w, f) => !!f.certificateGeneratedAt,
    actions: [
      {
        id: 'release', label: 'Approve & release', tone: 'primary',
        run: (w) => { releaseCertification(w.clientId, 'Management', getWorkflowFlags(w.clientId).certificateNumber); },
        done: (o) => `${o}: certificate released. Next: the coordinator delivers it on Certificate Delivery.`,
      },
      {
        id: 'sendback', label: 'Send back', tone: 'danger',
        input: { kind: 'text', label: 'Reason', required: true },
        run: (w, v) => { sendBackForReview(w.clientId, 'Management', v); },
        done: (o) => `${o}: sent back. The auditor reviews the corrective actions again.`,
      },
    ],
  },
  'coord-deliver': {
    mapStep: 'Step 17 of 18', title: 'Deliver the certificate', role: 'Audit Coordinator',
    howTo: 'Management released these certificates. Send the certificate to the client, then mark it delivered.',
    nextRole: 'Client Coordinator (Certifications View)',
    stages: ['Certification released'],
    filter: (_w, f) => !f.deliveredAt,
    actions: [{
      id: 'deliver', label: 'Mark as delivered', tone: 'primary',
      run: (w) => {
        setWorkflowFlags(w.clientId, { deliveredAt: new Date().toISOString() });
        noteWorkflow(w.clientId, 'Audit Coordinator', 'Certificate delivered to the client.');
      },
      done: (o) => `${o}: certificate delivered. The Client Coordinator now tracks it.`,
    }],
  },
  'cc-certificates': {
    mapStep: 'Step 18 of 18', title: 'Issued certificates', role: 'Client Coordinator',
    howTo: 'Certificates released through the workflow. Track their surveillance and renewal dates from here.',
    nextRole: 'Next surveillance audit (Audit Coordinator)',
    stages: ['Certification released'],
    readOnly: true,
    actions: [],
  },
};

/* ---------- component ---------- */
const WorkflowStagePanel: React.FC<{ step: WorkflowStepKey }> = ({ step }) => {
  const cfg = STEPS[step];
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState<string | null>(null); // `${clientId}:${actionId}` awaiting input
  const [value, setValue] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

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

  const rows = useMemo(
    () => readWorkflows().filter((w) => cfg.stages.includes(w.currentStage) && (!cfg.filter || cfg.filter(w, getWorkflowFlags(w.clientId)))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, step],
  );

  const run = (w: WorkflowRecord, a: StepAction, v: string) => {
    const org = clientName(w.clientId);
    if (a.input?.required && a.input.kind !== 'team' && !v.trim()) { setMsg({ ok: false, text: `Enter ${a.input.label.toLowerCase()} first.` }); return; }
    const scoped: Record<string, string> = {};
    Object.entries(edits).forEach(([k, val]) => { if (k.startsWith(`${w.clientId}|`)) scoped[k.slice(String(w.clientId).length + 1)] = val; });
    const err = a.validate?.(w, v, scoped);
    if (err) { setMsg({ ok: false, text: err }); return; }
    try {
      a.run(w, v, scoped);
      setMsg({ ok: true, text: a.done(org) });
      setActive(null); setValue('');
      setTick((t) => t + 1);
      try { window.dispatchEvent(new CustomEvent('cms-workflow-handoff')); } catch { /* ignore */ }
    } catch (e) {
      setMsg({ ok: false, text: `Could not complete this step: ${(e as Error)?.message || 'unknown error'}` });
    }
  };

  const onAction = (w: WorkflowRecord, a: StepAction) => {
    const key = `${w.clientId}:${a.id}`;
    if (a.input && active !== key) {
      setActive(key); setMsg(null);
      if (a.input.kind === 'select') setValue(a.input.options?.()[0] ?? '');
      else if (a.input.kind === 'team') {
        setValue('');
        setEdits((e) => ({
          ...e,
          [`${w.clientId}|lead`]: e[`${w.clientId}|lead`] ?? w.schedule?.leadAuditor ?? auditorNames(true)[0] ?? '',
          [`${w.clientId}|auditor`]: e[`${w.clientId}|auditor`] ?? w.schedule?.auditor ?? auditorNames(false)[0] ?? '',
        }));
      } else setValue('');
      return;
    }
    run(w, a, value);
  };

  /* styles (theme-neutral, readable on the app's light screens) */
  const card: React.CSSProperties = { background: '#ffffff', border: '1px solid #c7d2fe', borderRadius: 12, marginBottom: 18, boxShadow: '0 1px 3px rgba(15,23,42,.06)', overflow: 'hidden', color: '#0f172a' };
  const btn = (tone?: string): React.CSSProperties => ({
    padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${tone === 'danger' ? '#fecdd3' : '#1d4ed8'}`,
    background: tone === 'danger' ? '#fff' : '#1d4ed8', color: tone === 'danger' ? '#be123c' : '#fff',
  });
  const inp: React.CSSProperties = { padding: '7px 9px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, minWidth: 200, background: '#fff', color: '#0f172a' };

  return (
    <section style={card} aria-label={`Workflow step: ${cfg.title}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'linear-gradient(135deg,#eef2ff,#ffffff 70%)', border: 'none', borderBottom: open ? '1px solid #e2e8f0' : 'none', cursor: 'pointer', textAlign: 'left', color: '#0f172a' }}
        aria-expanded={open}
      >
        <Workflow size={18} color="#1d4ed8" />
        <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Certification workflow · {cfg.mapStep} · {cfg.role}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{cfg.title}</span>
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: rows.length ? '#1d4ed8' : '#e2e8f0', color: rows.length ? '#fff' : '#475569' }}>
          {rows.length} {cfg.readOnly ? 'issued' : 'waiting'}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div style={{ padding: '12px 16px 14px', display: 'grid', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>
            {cfg.howTo}{' '}
            {!cfg.readOnly && <span style={{ whiteSpace: 'nowrap' }}><ArrowRight size={12} style={{ verticalAlign: '-1px' }} /> Goes next to <strong>{cfg.nextRole}</strong>.</span>}
          </p>

          {msg && (
            <div role="status" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: msg.ok ? '#ecfdf5' : '#fff1f2', color: msg.ok ? '#047857' : '#be123c' }}>
              {msg.ok ? <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 2 }} /> : <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />}
              <span>{msg.text}</span>
            </div>
          )}

          {rows.length === 0 ? (
            <div style={{ fontSize: 13, color: '#64748b', padding: '8px 0' }}>
              Nothing waiting at this step. Clients appear here when they reach stage {stageNo(cfg.stages[0])} · <em>{cfg.stages[0]}</em>.
            </div>
          ) : rows.map((w) => {
            const flags = getWorkflowFlags(w.clientId);
            const findings = cfg.findings ? readFindings(w.clientId) : [];
            return (
              <div key={w.clientId} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'grid', gap: 8, background: '#f8fafc' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: 14 }}>{clientName(w.clientId)}</strong>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Stage {stageNo(w.currentStage)} · {w.currentStage}</span>
                  {w.assignedCoordinator && <span style={{ fontSize: 12, color: '#64748b' }}>Coordinator: {w.assignedCoordinator}</span>}
                  {w.schedule?.proposedDate && <span style={{ fontSize: 12, color: '#64748b' }}>Audit date: {w.schedule.proposedDate}{w.schedule.proposedTime ? ` ${w.schedule.proposedTime}` : ''}</span>}
                  {(w.schedule?.leadAuditor || w.schedule?.auditor) && <span style={{ fontSize: 12, color: '#64748b' }}>Team: {[w.schedule?.leadAuditor, w.schedule?.auditor].filter(Boolean).join(', ')}</span>}
                  {flags.certificateNumber && <span style={{ fontSize: 12, color: '#047857', fontWeight: 700 }}>Certificate {flags.certificateNumber}</span>}
                  {cfg.readOnly && <span style={{ fontSize: 12, color: '#64748b' }}>Released {fmt(w.updatedAt)}{flags.deliveredAt ? ` · delivered ${fmt(flags.deliveredAt)}` : ' · not delivered yet'}</span>}
                </div>

                {cfg.findings && (
                  findings.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: '#64748b' }}>No findings were recorded for this audit.</div>
                  ) : (
                    <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
                      {findings.map((f) => (
                        <li key={f.id} style={{ fontSize: 13 }}>
                          <div><strong>{f.severity || 'Finding'}</strong>{f.clause ? ` · clause ${f.clause}` : ''} — {f.description}</div>
                          {cfg.findings === 'edit' ? (
                            <textarea
                              id={`ca-${w.clientId}-${f.id}`}
                              aria-label={`Corrective action for ${f.description}`}
                              rows={2}
                              placeholder="Root cause and corrective action…"
                              value={edits[`${w.clientId}|ca-${f.id}`] ?? f.correctiveAction ?? ''}
                              onChange={(e) => setEdits((x) => ({ ...x, [`${w.clientId}|ca-${f.id}`]: e.target.value }))}
                              style={{ ...inp, width: '100%', marginTop: 4, fontFamily: 'inherit' }}
                            />
                          ) : (
                            <div style={{ marginTop: 2, color: f.correctiveAction ? '#0f172a' : '#be123c' }}>
                              <span style={{ color: '#64748b' }}>Corrective action: </span>{f.correctiveAction || 'Not provided'}
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  )
                )}

                {!cfg.readOnly && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                    {cfg.actions.map((a) => {
                      const key = `${w.clientId}:${a.id}`;
                      const asking = active === key && a.input;
                      return (
                        <React.Fragment key={a.id}>
                          {asking && a.input!.kind === 'team' && (
                            <>
                              <label style={{ display: 'grid', gap: 3, fontSize: 11.5, fontWeight: 600, color: '#475569' }}>Lead Auditor
                                <select style={inp} value={edits[`${w.clientId}|lead`] ?? ''} onChange={(e) => setEdits((x) => ({ ...x, [`${w.clientId}|lead`]: e.target.value }))}>
                                  {auditorNames(true).map((n) => <option key={n} value={n}>{n}</option>)}
                                </select>
                              </label>
                              <label style={{ display: 'grid', gap: 3, fontSize: 11.5, fontWeight: 600, color: '#475569' }}>Auditor
                                <select style={inp} value={edits[`${w.clientId}|auditor`] ?? ''} onChange={(e) => setEdits((x) => ({ ...x, [`${w.clientId}|auditor`]: e.target.value }))}>
                                  {auditorNames(false).map((n) => <option key={n} value={n}>{n}</option>)}
                                </select>
                              </label>
                            </>
                          )}
                          {asking && a.input!.kind === 'select' && (
                            <label style={{ display: 'grid', gap: 3, fontSize: 11.5, fontWeight: 600, color: '#475569' }}>{a.input!.label}
                              <select style={inp} value={value} onChange={(e) => setValue(e.target.value)}>
                                {(a.input!.options?.() || []).map((n) => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </label>
                          )}
                          {asking && (a.input!.kind === 'text' || a.input!.kind === 'date') && (
                            <label style={{ display: 'grid', gap: 3, fontSize: 11.5, fontWeight: 600, color: '#475569' }}>{a.input!.label}
                              <input style={inp} type={a.input!.kind === 'date' ? 'date' : 'text'} value={value} placeholder={a.input!.placeholder}
                                onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') run(w, a, value); }} />
                            </label>
                          )}
                          <button type="button" style={btn(a.tone)} onClick={() => onAction(w, a)}>
                            {asking ? `Confirm: ${a.label}` : a.label}
                          </button>
                          {asking && (
                            <button type="button" style={{ ...btn('danger'), color: '#475569', borderColor: '#cbd5e1' }} onClick={() => { setActive(null); setValue(''); }}>Cancel</button>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default WorkflowStagePanel;
