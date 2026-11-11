/**
 * certisphereGuide — QCSAI answers about the CertiSphere workflow itself
 * ----------------------------------------------------------------------
 * Built-in (no API key needed). Answers, from the live data in this browser:
 *   • "What should I do next?" / "my tasks"  → clients waiting on YOUR role
 *   • "Which clients are in audit / certified / need scheduling?"
 *   • "Who is the lead auditor for Delta Steel?" / "When is my audit?"
 *   • "When will I get my certificate?"       → steps left for the client
 *   • "How do I assign auditors / approve the schedule / record findings…?"
 *     → exact screen + button for the asking role
 *   • "What does a Lead Auditor do?", ISO 17021-1, IAF, audit days, NC deadlines
 */
import type { AssistantContext, AssistantResponse, AssistantBlock } from './aiAssistantEngine';
import { workflowClients, roleInsights, reviewCorrectiveAction } from './workflowAI';

/** Follow-up memory: the last client the user asked about ("and its auditor?"). */
let lastClientId: number | null = null;

/* ----------------------------- helpers ------------------------------ */
const wordRe = (n: string) => new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
const any = (t: string, ...n: string[]) => n.some((x) => wordRe(x).test(t));
const read = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const fmt = (s?: string) => { if (!s) return ''; const d = new Date(s); return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); };
const nav = (label: string, path: string): AssistantBlock => ({ kind: 'navigate', nav: [{ label, path }] });
const text = (t: string): AssistantBlock => ({ kind: 'text', text: t });
const list = (items: string[]): AssistantBlock => ({ kind: 'list', items });

/* ------------------------- the 14-stage flow ------------------------ */
type Who = { role: string; task: string; page: string; path: string };
export const FLOW: { stage: string; who: Who[] }[] = [
  { stage: 'Pre-Registration', who: [{ role: 'Auditee', task: 'complete the registration form', page: 'Sign-in page → New client? Register here', path: '/login' }] },
  { stage: 'Registration Submitted', who: [{ role: 'Management', task: 'approve the client and assign an Audit Coordinator', page: 'Client Onboarding', path: '/management/client-onboarding' }] },
  { stage: 'Coordinator Assigned', who: [{ role: 'Audit Coordinator', task: 'review the requirements (scope, standards, documents) and click "Save Requirements Review"', page: 'Audit Workflow', path: '/auditor-coordinator/audit-workflow' }] },
  { stage: 'Requirements Reviewed', who: [{ role: 'Audit Coordinator', task: 'propose the audit date', page: 'Audit Workflow', path: '/auditor-coordinator/audit-workflow' }] },
  { stage: 'Schedule Proposed', who: [
    { role: 'Audit Coordinator', task: 'assign the audit team (Lead Auditor + Auditor)', page: 'Auditor Assignment', path: '/auditor-coordinator/auditor-assignment' },
    { role: 'Auditee', task: 'approve or decline the proposed audit date', page: 'Schedule Approvals', path: '/audit-client/schedule-approvals' }] },
  { stage: 'Assigned Auditors (Lead auditor, Auditor)', who: [{ role: 'Auditee', task: 'approve or decline the proposed audit date', page: 'Schedule Approvals', path: '/audit-client/schedule-approvals' }] },
  { stage: 'Schedule Approved by Auditee', who: [
    { role: 'Lead Auditor', task: 'confirm the audit team', page: 'Audit Schedules', path: '/lead-auditor/audit-schedules' },
    { role: 'Auditor', task: 'confirm your availability', page: 'Schedule Confirmations', path: '/auditor/schedule-confirmations' }] },
  { stage: 'Schedule Approved by Auditor', who: [{ role: 'Auditor', task: 'start the audit ("Start audit")', page: 'Conduct Audit', path: '/auditor/conduct-audit' }] },
  { stage: 'Audit In Progress', who: [{ role: 'Auditor', task: 'record findings, then "Close out + release findings"', page: 'Conduct Audit', path: '/auditor/conduct-audit' }] },
  { stage: 'Audit Completed', who: [{ role: 'Auditor', task: 'click "Release findings to auditee"', page: 'Conduct Audit', path: '/auditor/conduct-audit' }] },
  { stage: 'Audit findings', who: [{ role: 'Auditee', task: 'submit corrective actions for each finding', page: 'Audit Actions', path: '/audit-client/audit-actions' }] },
  { stage: 'Action items released to Auditor', who: [
    { role: 'Auditor', task: 'review the corrective actions and forward to the Lead Auditor (or return to the auditee)', page: 'Action Review', path: '/auditor/action-review' },
    { role: 'Lead Auditor', task: 'accept the corrective actions and recommend certification', page: 'Action Approval', path: '/lead-auditor/action-approval' }] },
  { stage: 'Review and Approval by Auditor', who: [
    { role: 'Audit Coordinator', task: 'generate the certificate', page: 'Audit Certifications', path: '/auditor-coordinator/audit-certifications' },
    { role: 'Management', task: 'approve & release the certificate', page: 'Dashboard → Approve the certificate', path: '/management/dashboard' }] },
  { stage: 'Certification released', who: [
    { role: 'Audit Coordinator', task: 'mark the certificate as delivered', page: 'Certificate Delivery', path: '/auditor-coordinator/certificate-delivery' },
    { role: 'Client Coordinator', task: 'view / download the issued certificate', page: 'Certifications View', path: '/client-coordinator/certifications' }] },
];
const stageIdx = (s: string) => FLOW.findIndex((f) => f.stage === s);

interface ClientRow { id: number; name: string; stage: string; idx: number; wf: any; reg: any }
const clients = (): ClientRow[] => {
  const regs = read<any[]>('cms_client_registrations', []);
  const wfs = read<any[]>('cms_audit_workflow', []);
  return regs.map((c) => {
    const id = Number(c.id);
    const wf = wfs.find((w) => Number(w.clientId) === id) || null;
    const stage = wf?.currentStage || `${c.status || 'Registered'} (no workflow yet)`;
    return { id, name: c.organizationName || c.name || `Client #${id}`, stage, idx: stageIdx(stage), wf, reg: c };
  });
};
const card = (c: ClientRow, extra?: string) => ({
  title: c.name,
  subtitle: c.idx >= 0 ? `Step ${c.idx + 1}/14 · ${c.stage}` : `Status: ${c.stage}`,
  meta: [extra, c.reg?.standard, c.wf?.schedule?.proposedDate && `audit date ${fmt(c.wf.schedule.proposedDate)}`].filter(Boolean).join(' • '),
});
const myClientId = (): number | null => {
  for (const k of ['cms_active_client_id', 'cms_current_client_id', 'cms_active_org_id']) {
    const v = localStorage.getItem(k);
    const n = v ? Number(String(v).replace(/"/g, '')) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
};
const isClientRole = (r: string) => r === 'Auditee' || r === 'Client Coordinator';
const findNamed = (input: string, rows: ClientRow[]) => rows.find((c) => {
  const short = c.name.toLowerCase().replace(/\s+(pvt\.?|private)?\s*(ltd\.?|limited|llp|inc\.?)?$/, '').trim();
  return short.length > 3 && input.includes(short);
});

/* ---------------------- stage groups for filters -------------------- */
const GROUPS: { keys: string[]; label: string; stages: string[] }[] = [
  { keys: ['in audit', 'being audited', 'audit in progress', 'audits in progress', 'ongoing audit', 'under audit', 'currently audit', 'in progress', 'audits running', 'audits going on'], label: 'being audited', stages: ['Audit In Progress', 'Audit Completed'] },
  { keys: ['certified', 'certificate issued', 'certificates issued', 'got certificate', 'got their certificate', 'completed certification', 'released certificate'], label: 'certified', stages: ['Certification released'] },
  { keys: ['need scheduling', 'needs scheduling', 'awaiting schedule', 'waiting for schedule', 'schedule pending', 'pending schedule', 'to be scheduled', 'in scheduling', 'scheduling'], label: 'in scheduling', stages: ['Requirements Reviewed', 'Schedule Proposed', 'Assigned Auditors (Lead auditor, Auditor)', 'Schedule Approved by Auditee', 'Schedule Approved by Auditor'] },
  { keys: ['requirements review', 'review requirements', 'need review'], label: 'waiting for requirements review', stages: ['Coordinator Assigned'] },
  { keys: ['corrective action', 'capa', 'findings open', 'open findings', 'with findings', 'have findings', 'non-conformit'], label: 'working on findings / corrective actions', stages: ['Audit findings', 'Action items released to Auditor'] },
  { keys: ['awaiting coordinator', 'need a coordinator', 'need coordinator', 'without coordinator', 'unassigned', 'waiting for approval', 'awaiting approval'], label: 'waiting for Management approval', stages: ['Registration Submitted'] },
  { keys: ['certificate pending', 'awaiting certificate', 'waiting for certificate', 'certificate approval'], label: 'waiting for the certificate', stages: ['Review and Approval by Auditor'] },
];

/* ------------------------- how-to (per role) ------------------------ */
interface HowTo { keys: string[][]; title: string; steps: (role: string) => { steps: string[]; nav?: [string, string] } }
const HOWTOS: HowTo[] = [
  { keys: [['assign', 'coordinator'], ['approve', 'client'], ['onboard']], title: 'Approve a client & assign an Audit Coordinator (Management)',
    steps: () => ({ steps: ['Open **Client Onboarding** in the sidebar.', 'Find the client under "Approve client & assign an Audit Coordinator" (stage: Registration Submitted).', 'Choose the **Audit Coordinator** and click **Assign coordinator**.', 'The client moves to **Coordinator Assigned** and appears on the Coordinator\'s Audit Workflow.'], nav: ['Client Onboarding', '/management/client-onboarding'] }) },
  { keys: [['add', 'user'], ['create', 'user'], ['create', 'account'], ['add', 'staff'], ['new', 'login'], ['create', 'login'], ['add', 'auditor', 'account']], title: 'Add a person (Management)',
    steps: () => ({ steps: ['Open **Users & Access** in the sidebar.', 'Under **Add a person**, enter email, full name and role. For Auditee / Client Coordinator also pick the client.', 'Click **Create account** — the password is shown **once**; click **Copy** and share it privately.', 'They sign in with that email and password.'], nav: ['Users & Access', '/management/users'] }) },
  { keys: [['reset', 'password'], ['forgot', 'password'], ['change', 'password']], title: 'Reset a password',
    steps: (r) => r === 'Management'
      ? { steps: ['Open **Users & Access**.', 'Click **Reset password** on the person\'s row.', 'Copy the new password shown and send it to them privately.'], nav: ['Users & Access', '/management/users'] }
      : { steps: ['Ask Management to click **Reset password** for you in Users & Access — they will give you a new password.', 'Or use **Forgot your password?** on the sign-in page (works when email delivery is set up).'] } },
  { keys: [['disable', 'user'], ['remove', 'user'], ['block', 'user'], ['deactivate'], ['disable', 'account']], title: 'Disable an account (Management)',
    steps: () => ({ steps: ['Open **Users & Access**.', 'Click **Disable** on that person\'s row — they can no longer sign in; their past work stays.', 'Click **Enable** to restore access.'], nav: ['Users & Access', '/management/users'] }) },
  { keys: [['demo', 'credential'], ['demo', 'login'], ['demo', 'password']], title: 'Edit the demo credentials on the sign-in page (Management)',
    steps: () => ({ steps: ['Open **Users & Access**.', 'In **Sign-in page demo credentials**, type the new password and click **Apply to all shown accounts**.', 'Use the **Login page** column to **Show** or remove accounts from the sign-in page.'], nav: ['Users & Access', '/management/users'] }) },
  { keys: [['requirement'], ['review', 'scope']], title: 'Review the client\'s requirements (Audit Coordinator)',
    steps: () => ({ steps: ['Open **Audit Workflow**.', 'Select the client (stage: Coordinator Assigned).', 'Fill scope, standards, documents collected and notes.', 'Click **Save Requirements Review** → stage becomes **Requirements Reviewed**.'], nav: ['Audit Workflow', '/auditor-coordinator/audit-workflow'] }) },
  { keys: [['propose'], ['schedule', 'audit'], ['audit', 'date'], ['create', 'schedule'], ['plan', 'audit']], title: 'Propose the audit date (Audit Coordinator)',
    steps: (r) => r === 'Auditee' || r === 'Client Coordinator' ? HOWTOS[7].steps(r) : { steps: ['Open **Audit Workflow** and select the client (stage: Requirements Reviewed).', 'Pick the proposed date (and time / notes).', 'Click the propose button → stage becomes **Schedule Proposed**; the Auditee is asked to approve it.'], nav: ['Audit Workflow', '/auditor-coordinator/audit-workflow'] } },
  { keys: [['approve', 'schedule'], ['approve', 'date'], ['accept', 'date'], ['decline', 'date'], ['confirm', 'schedule'], ['confirm', 'availability'], ['confirm', 'team']], title: 'Approve / confirm the audit schedule',
    steps: (r) => {
      if (r === 'Lead Auditor') return { steps: ['Open **Audit Schedules**.', 'Under **Confirm the audit team**, pick the client (stage: Schedule Approved by Auditee).', 'Click **Confirm team**.'], nav: ['Audit Schedules', '/lead-auditor/audit-schedules'] };
      if (r === 'Auditor') return { steps: ['Open **Schedule Confirmations**.', 'Under **Confirm your availability**, pick the client.', 'Click **Confirm availability** → stage becomes **Schedule Approved by Auditor** and you can start the audit.'], nav: ['Schedule Confirmations', '/auditor/schedule-confirmations'] };
      return { steps: ['Open **Schedule Approvals**.', 'Check the proposed audit date.', 'Click **Approve date** — or **Decline** and type your preferred date (the Coordinator then proposes again).'], nav: ['Schedule Approvals', '/audit-client/schedule-approvals'] };
    } },
  { keys: [['assign', 'auditor'], ['audit', 'team'], ['assign', 'lead']], title: 'Assign the audit team (Audit Coordinator)',
    steps: () => ({ steps: ['Open **Auditor Assignment**.', 'Under **Assign the audit team**, pick the client (stage: Schedule Proposed).', 'Choose the **Lead Auditor** and **Auditor** (Smart Assign can suggest them).', 'Click **Assign audit team**.'], nav: ['Auditor Assignment', '/auditor-coordinator/auditor-assignment'] }) },
  { keys: [['convert', 'enquir'], ['enquir']], title: 'Handle a website enquiry (Audit Coordinator)',
    steps: () => ({ steps: ['Open **Client Enquiry**.', 'Review the enquiry details.', 'Click **Convert** — the client is created at **Registration Submitted** and an Auditee login is created; the password is shown so you can send it to the client.'], nav: ['Client Enquiry', '/auditor-coordinator/client-enquiry'] }) },
  { keys: [['register', 'client'], ['new', 'client'], ['add', 'client']], title: 'Register a new client',
    steps: (r) => r === 'Management' || r === 'Audit Coordinator'
      ? { steps: ['The client can self-register: sign-in page → **New client? Register here** (they choose their own password).', 'Or convert a website enquiry: **Client Enquiry** → **Convert**.', 'Or create a client login yourself in **Users & Access** (role Auditee, pick the client).', 'New clients appear in **Client Onboarding** at stage Registration Submitted.'], nav: r === 'Management' ? ['Client Onboarding', '/management/client-onboarding'] : ['Client Enquiry', '/auditor-coordinator/client-enquiry'] }
      : { steps: ['On the sign-in page click **New client? Register here**.', 'Fill organisation details and choose a password.', 'Sign in with that email and password; Management will approve you and assign a Coordinator.'] } },
  { keys: [['start', 'audit'], ['begin', 'audit'], ['conduct', 'audit']], title: 'Start / conduct the audit (Auditor)',
    steps: () => ({ steps: ['Open **Conduct Audit**.', 'Select the client (stage: Schedule Approved by Auditor).', 'Click **Start audit** → stage **Audit In Progress**.', 'Add findings as you go (clause, type, description).'], nav: ['Conduct Audit', '/auditor/conduct-audit'] }) },
  { keys: [['record', 'finding'], ['add', 'finding'], ['raise', 'non-conformity'], ['log', 'finding'], ['enter', 'finding']], title: 'Record audit findings (Auditor)',
    steps: () => ({ steps: ['Open **Conduct Audit** and select the client in **Audit In Progress**.', 'Add each finding: clause, type (Major NC / Minor NC / Observation / OFI) and description.', 'When finished click **Close out + release findings**.'], nav: ['Conduct Audit', '/auditor/conduct-audit'] }) },
  { keys: [['release', 'finding'], ['send', 'finding'], ['close', 'audit'], ['complete', 'audit'], ['finish', 'audit']], title: 'Close the audit & release findings to the auditee (Auditor)',
    steps: () => ({ steps: ['Open **Conduct Audit** and select the client.', 'Click **Close out + release findings** (or **Release findings to auditee** if the audit is already completed).', 'Stage becomes **Audit findings** and the Auditee is asked for corrective actions.'], nav: ['Conduct Audit', '/auditor/conduct-audit'] }) },
  { keys: [['respond', 'finding'], ['submit', 'corrective'], ['answer', 'finding'], ['reply', 'finding'], ['close', 'non-conformit'], ['fix', 'finding']], title: 'Respond to findings (Auditee)',
    steps: () => ({ steps: ['Open **Audit Actions**.', 'For each finding enter the **root cause**, **corrective action** and target date (attach evidence if asked).', 'Click **Submit corrective actions** → it goes to the Auditor for review.', 'If it is returned, fix what is noted and submit again.'], nav: ['Audit Actions', '/audit-client/audit-actions'] }) },
  { keys: [['review', 'corrective'], ['approve', 'corrective'], ['accept', 'corrective'], ['review', 'action'], ['approve', 'action']], title: 'Review corrective actions',
    steps: (r) => r === 'Lead Auditor'
      ? { steps: ['Open **Action Approval**.', 'Check the Auditor-reviewed corrective actions.', 'Click **Accept & recommend certification** — or **Return to auditee** with what needs fixing.'], nav: ['Action Approval', '/lead-auditor/action-approval'] }
      : { steps: ['Open **Action Review**.', 'Check each corrective action and its evidence.', 'Click **Reviewed — forward to Lead Auditor** — or **Return to auditee** with what needs fixing.'], nav: ['Action Review', '/auditor/action-review'] } },
  { keys: [['generate', 'certificate'], ['issue', 'certificate'], ['create', 'certificate'], ['release', 'certificate'], ['approve', 'certificate'], ['deliver', 'certificate']], title: 'Issue the certificate',
    steps: (r) => r === 'Management'
      ? { steps: ['After the Coordinator generates it, open the **Dashboard**.', 'Under **Approve the certificate**, check it and click **Approve & release** (or **Send back** with a reason).'], nav: ['Dashboard', '/management/dashboard'] }
      : { steps: ['**Generate**: Audit Certifications → pick the client (stage: Review and Approval by Auditor) → **Generate certificate**.', '**Approve**: Management clicks **Approve & release** on their Dashboard → stage **Certification released**.', '**Deliver**: Certificate Delivery → **Mark as delivered**.'], nav: ['Audit Certifications', '/auditor-coordinator/audit-certifications'] } },
  { keys: [['audit', 'report'], ['submit', 'report'], ['write', 'report'], ['prepare', 'report']], title: 'Audit report',
    steps: (r) => r === 'Auditor' || r === 'Lead Auditor'
      ? { steps: ['Open **Audit Report** in the sidebar.', 'Pick the client and audit, check the findings pulled from Conduct Audit.', 'Add the summary, conclusion and recommendation, then save / submit.', 'The Lead Auditor reviews it; the Coordinator sees it in Audit Report.'], nav: ['Audit Report', r === 'Auditor' ? '/auditor/audit-report' : '/lead-auditor/audit-report'] }
      : r === 'Auditee' || r === 'Client Coordinator'
        ? { steps: ['Open **Submit Report** (Auditee) to send your own reports/documents.', '**Auto Report** can draft a summary of your audit and corrective actions.', 'The audit report itself is written by the audit team; you see it in Audit Reports once released.'], nav: r === 'Auditee' ? ['Submit Report', '/audit-client/submit-report'] : ['Audit Reports', '/client-coordinator/audit-reports'] }
        : { steps: ['Audit reports are written by the Auditor / Lead Auditor on **Audit Report**.', 'The Coordinator reviews them on **Audit Report** in the sidebar.'], nav: ['Audit Report', '/auditor-coordinator/audit-report'] } },
  { keys: [['upload', 'document'], ['submit', 'document'], ['share', 'document'], ['upload', 'evidence']], title: 'Upload documents / evidence (Auditee)',
    steps: () => ({ steps: ['For corrective-action evidence: **Audit Actions** → the finding → attach / describe the evidence → **Submit corrective actions**.', 'For reports and other documents: **Submit Report** in the sidebar.', 'Document Analysis can check a document against the standard before you submit.'], nav: ['Submit Report', '/audit-client/submit-report'] }) },
];

/* ------------------------------ roles ------------------------------- */
const ROLES: Record<string, string> = {
  'Management': 'approves new clients and assigns an Audit Coordinator, approves & releases certificates, manages user accounts (Users & Access) and watches overall growth.',
  'Audit Coordinator': 'runs each client file: reviews requirements, proposes the audit date, assigns the audit team, handles enquiries, generates and delivers certificates.',
  'Lead Auditor': 'leads the audit team: confirms the team and schedule, oversees the audit, and accepts corrective actions / recommends certification.',
  'Auditor': 'confirms availability, conducts the audit (Start audit), records findings, releases them to the auditee and reviews corrective actions.',
  'Auditee': 'the client organisation\'s contact: registers, approves the proposed audit date, responds to findings with corrective actions and receives the certificate.',
  'Client Coordinator': 'the client-side coordinator: follows the company\'s audits, schedules, due dates, reports and issued certificates.',
};

/* ------------------------- extra knowledge -------------------------- */
const EXTRA: { keys: string[][]; answer: string[] }[] = [
  { keys: [['what', 'audit report'], ['audit report', 'contain'], ['audit report', 'include']], answer: ['An **audit report** records the result of the audit: scope, criteria (standard), dates, audit team, sites/processes covered, **findings** (Major NC, Minor NC, observations, OFIs), positive points, the **conclusion** and the **recommendation** (e.g. recommend certification once NCs are closed).', 'In CertiSphere the Auditor / Lead Auditor prepare it on **Audit Report**; findings come from **Conduct Audit**.'] },
  { keys: [['17021']], answer: ['**ISO/IEC 17021-1** sets the requirements for bodies that **audit and certify management systems** (like CertiSphere\'s certification body).', 'It covers impartiality, auditor competence, the audit programme (Stage 1, Stage 2, surveillance, recertification), certification decisions and handling of appeals and complaints.'] },
  { keys: [['iaf'], ['accreditation', 'forum']], answer: ['**IAF (International Accreditation Forum)** is the global association of accreditation bodies.', 'Certificates issued by a certification body accredited by an IAF MLA signatory are recognised worldwide. IAF also publishes mandatory documents such as **IAF MD 5** (audit time) and **IAF MD 1** (multi-site sampling).'] },
  { keys: [['man-day'], ['man day'], ['mandays'], ['audit day'], ['audit time'], ['audit duration'], ['calculate', 'days'], ['how long', 'audit take']], answer: ['**Audit time (man-days)** is set by **IAF MD 5**, mainly from the number of **effective employees** and the **complexity/risk** of the organisation.', 'Rough guide for ISO 9001 initial certification (Stage 1 + Stage 2): ~1.5 days for 1–5 people, ~3 days for 26–45, ~5 days for 86–125, ~7 days for 176–275. Surveillance ≈ ⅓ and recertification ≈ ⅔ of the initial time.', 'Adjust up or down (max ±30%) for complexity, multiple sites, shifts or integrated systems. Always confirm with your certification body\'s procedure.'] },
  { keys: [['how long', 'close'], ['deadline', 'non-conformit'], ['time', 'close', 'non-conformit'], ['days', 'corrective'], ['how long', 'corrective'], ['timeline', 'corrective']], answer: ['Typical certification-body practice (check your own procedure):', '• **Major NC** — correction and corrective action verified **before** a certificate can be issued, usually within **90 days** (often 30–60 days for surveillance).', '• **Minor NC** — an acceptable corrective-action **plan** within about **30 days**; implementation verified at the next audit.', '• **Observations / OFIs** — no formal response required.'] },
  { keys: [['what', 'is', 'cms'], ['what', 'is', 'certisphere'], ['about', 'certisphere'], ['what', 'is', 'this', 'app']], answer: ['**CertiSphere (CertMS)** is QMICS\'s ISO certification-body management system.', 'It runs a client from registration through a **14-step workflow** — approval, requirements review, scheduling, audit, findings, corrective actions and certificate release — with separate screens for Management, Audit Coordinator, Lead Auditor, Auditor, Auditee and Client Coordinator.'] },
];

/* ============================== main =============================== */
export function matchCertiSphere(input: string, ctx: AssistantContext): AssistantResponse | null {
  const role = ctx.role || '';
  const rows = clients();
  const isHow = (/^(how|where|can i|steps|what are the steps|guide|help me|process to|procedure)\b/.test(input) && !/^how (many|much|long|often)\b/.test(input)) || any(input, 'how do', 'how to', 'how can', 'how should', 'where do', 'steps to');

  /* 0a. "check this corrective action: …" */
  const caMatch = /(?:check|review|rate|score|improve|evaluate)\s+(?:my|this|the)?\s*corrective action[s]?\s*[:\-–]?\s*(.{3,})$/.exec(input);
  if (caMatch) {
    const r = reviewCorrectiveAction(caMatch[1]);
    return { blocks: [text(`**AI quality score: ${r.score}%** — ${r.verdict === 'good' ? 'this corrective action looks complete.' : 'it needs more detail:'}`), ...(r.tips.length ? [list(r.tips)] : [])], suggestions: ['How do I respond to findings?', 'What is root cause analysis?'] };
  }

  /* 0. late / at risk / report */
  if (any(input, 'late', 'overdue', 'delayed', 'delay', 'stuck', 'bottleneck', 'at risk', 'behind schedule', 'pending too long') && !isClientRole(role)) {
    const late = workflowClients().filter((c) => c.overdue).sort((a, b) => (b.ageDays - b.sla) - (a.ageDays - a.sla));
    if (!late.length) return { blocks: [text('Nothing is late — every client is within the target time for its current step.')], suggestions: ['Give me a pipeline report', 'What should I do next?'] };
    return { blocks: [text(`**${late.length} client(s) behind schedule** (most delayed first):`), { kind: 'cards', cards: late.slice(0, 10).map((c) => ({ title: c.name, subtitle: `Step ${c.stageNo}/14 · ${c.wf.currentStage}`, meta: `${c.ageDays} day(s) at this step (target ${c.sla}) • waiting on ${FLOW[c.stageNo - 1]?.who.map((w) => w.role).join(' / ') || '—'}` })) }], suggestions: ['Give me a pipeline report', 'What should I do next?'] };
  }
  if (any(input, 'report', 'summary', 'summarise', 'summarize', 'pipeline', 'insight', 'briefing', 'brief me', 'status update') && !any(input, 'how do', 'how to', 'submit', 'audit report', 'upload') && !/\bwhat is\b/.test(input)) {
    const wc = workflowClients();
    const byStage = FLOW.map((f, i) => ({ i, f, n: wc.filter((c) => c.wf.currentStage === f.stage).length })).filter((x) => x.n);
    const ins = roleInsights(role);
    return {
      blocks: [
        text(`**${isClientRole(role) ? 'Your audit summary' : 'Pipeline report'}** — ${new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}`),
        ...(isClientRole(role) ? [] : [{ kind: 'kpi' as const, kpis: [
          { label: 'Clients', value: wc.length },
          { label: 'In audit', value: wc.filter((c) => ['Audit In Progress', 'Audit Completed'].includes(c.wf.currentStage)).length },
          { label: 'Certified', value: wc.filter((c) => c.wf.currentStage === 'Certification released').length },
          { label: 'Late', value: wc.filter((c) => c.overdue).length },
        ] }, list(byStage.map((x) => `Step ${x.i + 1} · ${x.f.stage}: **${x.n}**`))]),
        text('**AI insights**'), list(ins.map((x) => x.text)),
      ],
      suggestions: ['What is late?', 'What should I do next?'],
    };
  }

  /* 1. extra knowledge */
  for (const e of EXTRA) if (e.keys.some((k) => k.every((w) => input.includes(w)))) return { blocks: e.answer.map(text) };

  /* 3. how-to for the asking role */
  if (isHow || /^(steps|process)\b/.test(input)) {
    const h = HOWTOS.find((x) => x.keys.some((k) => k.every((w) => wordRe(w).test(input))));
    if (h) {
      const s = h.steps(role);
      return { blocks: [text(`**${h.title}**`), list(s.steps), ...(s.nav ? [nav(`Open ${s.nav[0]}`, s.nav[1])] : [])], suggestions: ['What should I do next?', 'Which clients are in audit?'] };
    }
  }

  /* 4. "what should I do next" / "my tasks" / "my audits" */
  if (any(input, 'what should i do', 'what do i do next', 'next step', 'my task', 'to do', 'todo', 'pending for me', 'waiting for me', 'my work', 'my audits', 'my pending', 'my action', 'what is pending', 'what\'s pending', 'anything pending') && !findNamed(input, rows)) {
    if (isClientRole(role) || any(input, 'my audit status', 'my company')) return myStatus(rows, role);
    const mine = rows.filter((c) => c.idx >= 0).flatMap((c) => FLOW[c.idx]?.who.filter((w) => w.role === role).map((w) => ({ c, w })) || []);
    if (!mine.length) return { blocks: [text(`Nothing is waiting for you (**${role}**) right now. ${rows.length ? `There are ${rows.length} client(s) in the workflow; none are at a step you own.` : 'No clients are registered yet.'}`)], suggestions: ['Which clients are in audit?', 'Who are the new clients onboarding?'] };
    const byPage = new Map<string, { w: Who; cs: ClientRow[] }>();
    mine.forEach(({ c, w }) => { const g = byPage.get(w.task) || { w, cs: [] }; g.cs.push(c); byPage.set(w.task, g); });
    const blocks: AssistantBlock[] = [text(`**${mine.length} task(s) waiting for you:**`)];
    byPage.forEach(({ w, cs }) => {
      blocks.push(text(`**${w.page}** — ${w.task}:`));
      blocks.push({ kind: 'cards', cards: cs.slice(0, 6).map((c) => card(c)) });
      blocks.push(nav(`Open ${w.page}`, w.path));
    });
    return { blocks, suggestions: ['Which clients are in audit?', 'Who are the new clients onboarding?'] };
  }

  /* 2. role descriptions: "what does a lead auditor do" / "my role" */
  if (any(input, 'what does', 'what do', 'role of', 'responsibilit', 'duties', 'job of', 'my role')) {
    const r = Object.keys(ROLES).sort((a, b) => b.length - a.length).find((k) => input.includes(k.toLowerCase())) || (any(input, 'my role', 'what do i') ? role : '');
    if (r && ROLES[r] && !isHow) {
      const tasks = FLOW.flatMap((f) => f.who.filter((w) => w.role === r).map((w) => `**${w.page}** — ${w.task} (at *${f.stage}*)`));
      return { blocks: [text(`**${r}** ${ROLES[r]}`), ...(tasks.length ? [text('Their steps in the workflow:'), list([...new Set(tasks)])] : [])], suggestions: ['What should I do next?', 'What are the workflow stages?'] };
    }
  }

  /* 5. client-specific: own company status, audit date, certificate ETA */
  if (isClientRole(role) && any(input, 'my audit', 'my company', 'my status', 'my certificate', 'my organi', 'our audit', 'our certificate', 'our status', 'when is', 'when will', 'audit date')) return myStatus(rows, role);

  /* 6. named client: lead auditor / coordinator / date / status / certificate */
  const refersBack = /\b(it|its|they|their|them|that client|this client|same client|that company|this company)\b/.test(input) || /^(and|what about|how about)\b/.test(input);
  const named = findNamed(input, rows) || (refersBack && lastClientId !== null ? rows.find((r) => r.id === lastClientId) : undefined);
  if (named) lastClientId = named.id;
  if (named && named.idx >= 0) {
    const s = named.wf?.schedule || {};
    if (any(input, 'lead auditor', 'auditor', 'audit team', 'team')) {
      const lead = s.leadAuditor || named.wf?.leadAuditor; const aud = s.auditor || named.wf?.auditor;
      return { blocks: [text(lead || aud ? `**${named.name}** — Lead Auditor: **${lead || 'not assigned yet'}**, Auditor: **${aud || 'not assigned yet'}**.` : `No audit team is assigned to **${named.name}** yet (it is at step ${named.idx + 1}: ${named.stage}). The Audit Coordinator assigns the team in **Auditor Assignment** once a date is proposed.`)] };
    }
    if (any(input, 'coordinator')) return { blocks: [text(named.wf?.assignedCoordinator ? `**${named.name}**'s Audit Coordinator is **${named.wf.assignedCoordinator}**.` : `**${named.name}** has no Audit Coordinator yet — Management assigns one in **Client Onboarding**.`)] };
    if (any(input, 'when', 'date', 'schedule')) return { blocks: [text(s.proposedDate ? `**${named.name}** audit date: **${fmt(s.proposedDate)}**${s.proposedTime ? ` at ${s.proposedTime}` : ''} — ${s.decision === 'Approved' ? 'approved by the auditee' : s.decision === 'Declined' ? 'declined by the auditee (a new date is needed)' : 'waiting for the auditee\'s approval'}.` : `No audit date has been proposed for **${named.name}** yet (step ${named.idx + 1}: ${named.stage}).`)] };
    if (any(input, 'certificate', 'certified')) return { blocks: [text(named.stage === 'Certification released' ? `**${named.name}** is certified — the certificate has been released.` : `**${named.name}** is not certified yet — it is at step ${named.idx + 1} of 14 (**${named.stage}**), ${13 - named.idx} step(s) before the certificate.`)] };
    // generic status → let the client matcher in the engine answer
  }

  /* 6b. website enquiries */
  if (any(input, 'enquir', 'inquir', 'lead', 'leads') && !any(input, 'lead auditor') && any(input, 'show', 'list', 'new', 'how many', 'any', 'which', 'who', 'pending', 'open', 'latest', 'recent')) {
    const enq = read<any[]>('cms_client_enquiries_v1', []);
    const open = enq.filter((e) => !e.convertedClientId && !/convert|closed|reject/i.test(String(e.status || '')));
    const blocks: AssistantBlock[] = [];
    if (any(input, 'how many', 'count', 'number of')) blocks.push({ kind: 'kpi', kpis: [{ label: 'Open enquiries', value: open.length }, { label: 'All enquiries', value: enq.length }] });
    else if (!open.length) blocks.push(text(enq.length ? `No open enquiries — all ${enq.length} have been handled.` : 'No website enquiries yet. They arrive from the sign-in page → **Quick website enquiry**.'));
    else blocks.push(text(`**${open.length} open enquir${open.length === 1 ? 'y' : 'ies'}** (newest first):`), { kind: 'cards', cards: open.slice().sort((a, b) => String(b.receivedAt || '').localeCompare(String(a.receivedAt || ''))).slice(0, 8).map((e) => ({ title: e.company || e.organizationName || e.name || 'Enquiry', subtitle: [Array.isArray(e.standards) ? e.standards.join(', ') : e.standard, e.contactName || e.contactPerson, e.status].filter(Boolean).join(' · '), meta: [e.contactEmail || e.email, e.country, fmt(e.receivedAt || e.createdAt)].filter(Boolean).join(' • ') })) });
    if (role === 'Audit Coordinator' || role === 'Management') blocks.push(nav('Open Client Enquiry', '/auditor-coordinator/client-enquiry'));
    return { blocks, suggestions: ['How do I convert an enquiry?', 'Who are the new clients onboarding?'] };
  }

  /* 7. stage filters: "which clients are in audit", "how many certified" */
  const g = GROUPS.find((x) => x.keys.some((k) => input.includes(k)));
  if (g && (any(input, 'client', 'compan', 'organi', 'which', 'who', 'how many', 'list', 'show', 'any', 'count', 'audits', 'certificate') )) {
    const hit = rows.filter((c) => g.stages.includes(c.stage));
    const count = any(input, 'how many', 'count', 'number of', 'total');
    if (count) return { blocks: [{ kind: 'kpi', kpis: [{ label: `Clients ${g.label}`, value: hit.length }, { label: 'All clients', value: rows.length }] }], suggestions: [`Which clients are ${g.label}?`] };
    if (!hit.length) return { blocks: [text(`No clients are ${g.label} right now${rows.length ? ` (${rows.length} client(s) in total)` : ''}.`)], suggestions: ['List all clients', 'Who are the new clients onboarding?'] };
    return { blocks: [text(`**${hit.length} client(s) ${g.label}:**`), { kind: 'cards', cards: hit.slice(0, 10).map((c) => card(c, FLOW[c.idx]?.who.map((w) => `next: ${w.role} — ${w.task}`).join('; '))) }], suggestions: ['What should I do next?', 'List all clients'] };
  }

  /* 8. workflow overview */
  if (any(input, 'workflow', 'stages', 'steps', 'process', 'lifecycle', 'flow') && any(input, 'what', 'explain', 'show', 'list', 'all', '14', 'stages', 'certisphere', 'cms', 'tell')) {
    return { blocks: [text('**CertiSphere workflow — 14 stages** (who acts at each):'), list(FLOW.map((f, i) => `**${i + 1}. ${f.stage}** — ${f.who.map((w) => `${w.role}: ${w.task}`).join('; ')}`))], suggestions: ['What should I do next?', 'What does an Auditor do?'] };
  }

  /* 9. out of scope */
  if (any(input, 'weather', 'cricket', 'movie', 'song', 'recipe', 'stock price', 'bitcoin', 'joke', 'news today')) {
    return { fallback: true, blocks: [text('I\'m QCSAI, the CertiSphere assistant — I can only help with **CertiSphere, ISO standards, audits and certification**. Try "What should I do next?" or "Which clients are in audit?".')] };
  }
  return null;
}

function myStatus(rows: ClientRow[], role: string): AssistantResponse {
  const id = myClientId();
  const c = rows.find((r) => r.id === id) || (rows.length === 1 ? rows[0] : undefined);
  if (!c) return { blocks: [text('I could not find your company\'s audit file yet. If you just registered, Management still has to approve it — check again later.')] };
  const s = c.wf?.schedule || {};
  const mine = FLOW[c.idx]?.who.find((w) => w.role === role || (role === 'Client Coordinator' && w.role === 'Auditee'));
  const others = FLOW[c.idx]?.who.filter((w) => w !== mine).map((w) => `${w.role} — ${w.task}`) || [];
  const left = 13 - c.idx;
  const lines = [
    c.idx >= 0 ? `**${c.name}** is at **step ${c.idx + 1} of 14 — ${c.stage}**.` : `**${c.name}** — status: **${c.stage}**.`,
    s.proposedDate ? `Audit date: **${fmt(s.proposedDate)}**${s.proposedTime ? ` at ${s.proposedTime}` : ''} (${s.decision === 'Approved' ? 'approved' : s.decision === 'Declined' ? 'declined — a new date will be proposed' : 'waiting for your approval'}).` : 'No audit date has been proposed yet.',
    c.stage === 'Certification released' ? 'Your **certificate has been released**.' : c.idx >= 0 ? `Certificate: ${left} step(s) to go.` : '',
  ];
  return {
    blocks: [text(lines.filter(Boolean).join('\n\n')),
      ...(mine ? [text(`**Your action:** ${mine.task}.`), nav(`Open ${mine.page}`, mine.path)] : others.length ? [text(`Waiting on: ${others.join('; ')}.`)] : [])],
    suggestions: ['How do I respond to findings?', 'How do I approve the schedule?'],
  };
}
