/**
 * workflowAI — the built-in "brain" behind CertiSphere's AI features
 * ----------------------------------------------------------------------
 * Works WITHOUT an API key, from the real workflow data in this browser
 * (live mode: the Supabase copy). Every function is pure + safe.
 *
 *   workflowClients()        clients joined with their workflow + flags
 *   workflowFindings()       all audit findings (+ corrective actions)
 *   staffNames(role)         people to suggest (live directory / demo list)
 *   workloadOf(name)         active audits a person is on
 *   stepSuggestion(step, w)  AI suggestion for one workflow panel row
 *   roleInsights(role)       "AI insights" card for each role dashboard
 *   reviewCorrectiveAction() quality check of a corrective action
 *   draftCorrectiveAction()  starter text for the auditee
 *
 * When Claude is configured, components can pass `claudePrompt(...)` to
 * Claude for a richer explanation — the built-in result is always shown first.
 */
import { readWorkflows, STAGE_ORDER, type WorkflowRecord } from '../utils/auditWorkflow';

/* ------------------------------- data -------------------------------- */
const read = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const DAY = 86400000;
export const daysSince = (iso?: string) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : 0);
export const daysUntil = (iso?: string) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / DAY) : 0);
const fmt = (iso?: string) => { if (!iso) return '—'; const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); };
const addDays = (iso: string, n: number) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString(); };

export interface WfFinding {
  id: string; severity?: string; clause?: string; description?: string; evidence?: string;
  correctiveAction?: string; actionSubmittedAt?: string; createdAt?: string;
}
export interface WfFlags { auditorReviewedAt?: string; certificateNumber?: string; certificateGeneratedAt?: string; deliveredAt?: string }
export interface WfClient {
  id: number; name: string; standard: string; reg: any; wf: WorkflowRecord; flags: WfFlags;
  stageNo: number; ageDays: number; sla: number; overdue: boolean; findings: WfFinding[];
}

/** Days a client may sit at each stage before the AI calls it "late". */
export const STAGE_SLA: Record<string, number> = {
  'Pre-Registration': 7, 'Registration Submitted': 2, 'Coordinator Assigned': 5, 'Requirements Reviewed': 5,
  'Schedule Proposed': 5, 'Assigned Auditors (Lead auditor, Auditor)': 5, 'Schedule Approved by Auditee': 3,
  'Schedule Approved by Auditor': 21, 'Audit In Progress': 5, 'Audit Completed': 2, 'Audit findings': 30,
  'Action items released to Auditor': 7, 'Review and Approval by Auditor': 5, 'Certification released': 7,
};

export const findingsOf = (clientId: number): WfFinding[] =>
  read<Record<string, WfFinding[]>>('cms_audit_findings_v1', {})[String(clientId)] || [];
const flagsOf = (clientId: number): WfFlags =>
  read<Record<string, WfFlags>>('cms_workflow_flags_v1', {})[String(clientId)] || {};

/** When the client entered its current stage. */
export const stageEnteredAt = (w: WorkflowRecord): string => {
  const h = [...(w.history || [])].reverse().find((e) => e.stage === w.currentStage);
  return h?.at || w.updatedAt || w.createdAt;
};

export const workflowClients = (): WfClient[] => {
  const regs = read<any[]>('cms_client_registrations', []);
  return readWorkflows().map((wf) => {
    const reg = regs.find((r) => Number(r.id) === Number(wf.clientId)) || {};
    const flags = flagsOf(wf.clientId);
    const age = daysSince(stageEnteredAt(wf));
    const sla = STAGE_SLA[wf.currentStage] ?? 7;
    const releasedDone = wf.currentStage === 'Certification released' && !!flags.deliveredAt;
    // waiting for the audit date is fine until 2 days after the date
    const waitingForDate = wf.currentStage === 'Schedule Approved by Auditor' && !!wf.schedule?.proposedDate;
    const overdue = releasedDone ? false : waitingForDate ? daysUntil(wf.schedule!.proposedDate) < -2 : age > sla;
    return {
      id: Number(wf.clientId), name: reg.organizationName || reg.name || `Client #${wf.clientId}`,
      standard: reg.standard || wf.requirements?.standards?.[0] || '', reg, wf, flags,
      stageNo: STAGE_ORDER.indexOf(wf.currentStage) + 1, ageDays: age, sla,
      overdue, findings: findingsOf(wf.clientId),
    };
  });
};
export const workflowFindings = () => workflowClients().flatMap((c) => c.findings.map((f) => ({ ...f, client: c })));

/* ------------------------------- people ------------------------------ */
/** Staff directory cache filled in live mode from /api/staff (local only). */
export const STAFF_CACHE_KEY = 'certi_staff_directory';
export interface StaffEntry { name: string; role: string; email?: string }
export const staffDirectory = (): StaffEntry[] => {
  const live = read<StaffEntry[]>(STAFF_CACHE_KEY, []);
  if (live.length) return live;
  const people = [...read<any[]>('cms_auditors_data', []), ...read<any[]>('cms_auditors', [])]
    .filter((p) => p && p.name)
    .map((p) => ({ name: String(p.name), role: /lead/i.test(String(p.role || p.designation || '')) ? 'Lead Auditor' : 'Auditor' }));
  return people;
};
export const staffNames = (role: 'Lead Auditor' | 'Auditor' | 'Audit Coordinator', fallback: string[] = []): string[] => {
  const dir = staffDirectory().filter((s) => s.role === role).map((s) => s.name);
  return Array.from(new Set([...dir, ...fallback]));
};
/** The people offered in the workflow pickers — the AI suggests from the same list. */
export const candidateNames = (kind: 'Audit Coordinator' | 'Lead Auditor' | 'Auditor'): string[] => {
  const live = read<StaffEntry[]>(STAFF_CACHE_KEY, []);
  if (kind === 'Audit Coordinator') {
    const set = new Set<string>(live.length ? live.filter((p) => p.role === kind).map((p) => p.name) : ['Praveen Gangarapu', 'Cora Dinh']);
    readWorkflows().forEach((w) => { if (w.assignedCoordinator) set.add(w.assignedCoordinator); });
    return Array.from(set);
  }
  if (live.length) {
    const ok = kind === 'Lead Auditor' ? ['Lead Auditor'] : ['Auditor', 'Lead Auditor'];
    return Array.from(new Set(live.filter((p) => ok.includes(p.role)).map((p) => p.name)));
  }
  const people = [...read<any[]>('cms_auditors_data', []), ...read<any[]>('cms_auditors', [])];
  const names = people.filter((p) => p && p.name && (!p.status || p.status === 'Active'))
    .filter((p) => (kind === 'Lead Auditor' ? /lead/i.test(String(p.role || '')) : true)).map((p) => String(p.name));
  const fb = kind === 'Lead Auditor' ? ['Leo Ashford', 'Rajesh Kumar'] : ['Aaron Diaz', 'Anita Verma'];
  return Array.from(new Set([...names, ...fb]));
};
/** Active (not yet certified) audits a person is assigned to. */
export const workloadOf = (name: string): number => {
  const n = name.trim().toLowerCase();
  if (!n) return 0;
  return readWorkflows().filter((w) => w.currentStage !== 'Certification released' && [w.assignedCoordinator, w.schedule?.leadAuditor, w.schedule?.auditor]
    .some((x) => String(x || '').trim().toLowerCase() === n)).length;
};
const busyOn = (name: string, date?: string, exceptClient?: number) => {
  if (!date) return [] as WfClient[];
  const n = name.trim().toLowerCase();
  return workflowClients().filter((c) => c.id !== exceptClient && c.wf.schedule?.proposedDate === date
    && [c.wf.schedule?.leadAuditor, c.wf.schedule?.auditor].some((x) => String(x || '').trim().toLowerCase() === n));
};
const leastLoaded = (names: string[], date?: string, exceptClient?: number) =>
  names.map((n) => ({ n, load: workloadOf(n), clash: busyOn(n, date, exceptClient).length }))
    .sort((a, b) => a.clash - b.clash || a.load - b.load || a.n.localeCompare(b.n));

/* ---------------------- corrective-action quality ------------------- */
export interface CaReview { score: number; verdict: 'good' | 'weak' | 'missing'; tips: string[] }
export const reviewCorrectiveAction = (text: string | undefined, severity = ''): CaReview => {
  const t = String(text || '').trim();
  if (!t) return { score: 0, verdict: 'missing', tips: ['No corrective action written yet.'] };
  const low = t.toLowerCase();
  const tips: string[] = [];
  let score = 20;
  if (/root cause|because|due to|caused by|reason|why/.test(low)) score += 25; else tips.push('State the **root cause** (why it happened), not only the fix.');
  if (/\b(implement|update|revise|train|introduce|install|create|define|review|add|replace|establish|document|calibrat|retrain|amend)/.test(low)) score += 20; else tips.push('Say **what will be changed** (e.g. revise the procedure, retrain staff).');
  if (/\b(by|before|within|on)\s+(\d|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|next|end)|\d{1,2}[/-]\d{1,2}|\bdays?\b|\bweeks?\b/.test(low)) score += 15; else tips.push('Add a **target date**.');
  if (/\b(responsib|owner|manager|head|lead|supervisor|team|officer|department)\b/.test(low)) score += 10; else tips.push('Name **who is responsible**.');
  if (/\b(verify|verified|check|monitor|audit|effectiveness|evidence|record|measure)\b/.test(low)) score += 10; else tips.push('Explain **how effectiveness will be checked** (evidence / records).');
  if (t.length < 40) { score -= 15; tips.push('Too short — add detail.'); }
  if (/major/i.test(severity) && !/evidence|record|attached|photo|report/.test(low)) tips.push('Major NC: attach or describe **objective evidence** of the fix.');
  score = Math.max(5, Math.min(100, score));
  return { score, verdict: score >= 65 ? 'good' : 'weak', tips };
};

export const draftCorrectiveAction = (f: WfFinding, org = 'the organisation'): string => {
  const clause = f.clause ? ` (clause ${f.clause})` : '';
  const days = /major/i.test(f.severity || '') ? 60 : 30;
  const due = fmt(addDays(new Date().toISOString(), days));
  return `Root cause: [why it happened — e.g. procedure unclear / staff not trained / no check in place] for "${(f.description || 'the finding').slice(0, 90)}"${clause}.\n`
    + `Correction: [immediate fix already done].\n`
    + `Corrective action: [what ${org} will change — revise procedure / train staff / add a check], owner: [name, role], target date: ${due}.\n`
    + `Effectiveness check: [how and when it will be verified — records, internal audit].`;
};

/* --------------------------- step suggestions ----------------------- */
export interface Suggestion {
  tone: 'ok' | 'warn' | 'bad' | 'info';
  headline: string;
  points: string[];
  /** Values the UI can apply with one click. */
  apply?: { label: string; values: Record<string, string> };
}
const pct = (n: number) => `${Math.round(n)}%`;

export const stepSuggestion = (step: string, w: WorkflowRecord): Suggestion | null => {
  const c = workflowClients().find((x) => x.id === Number(w.clientId));
  if (!c) return null;
  const late = c.overdue ? `Waiting **${c.ageDays} day(s)** at this step (target ${c.sla}).` : `At this step for ${c.ageDays} day(s).`;
  switch (step) {
    case 'mgmt-assign': {
      const names = candidateNames('Audit Coordinator');
      const ranked = leastLoaded(names);
      const best = ranked[0];
      return {
        tone: c.overdue ? 'warn' : 'info',
        headline: best ? `Assign **${best.n}** — lowest current workload (${best.load} active client${best.load === 1 ? '' : 's'}).` : 'Pick an Audit Coordinator.',
        points: [late, c.standard && `Standard requested: **${c.standard}**.`, ranked.length > 1 && `Workload: ${ranked.map((r) => `${r.n} ${r.load}`).join(' · ')}`].filter(Boolean) as string[],
        apply: best ? { label: `Use ${best.n}`, values: { value: best.n } } : undefined,
      };
    }
    case 'coord-team': {
      const date = w.schedule?.proposedDate;
      const leads = leastLoaded(candidateNames('Lead Auditor'), date, c.id);
      const auds = leastLoaded(candidateNames('Auditor'), date, c.id).filter((a) => a.n !== leads[0]?.n);
      const L = leads[0], A = auds[0];
      const clash = [L, A].filter((x) => x && x.clash);
      return {
        tone: clash.length ? 'warn' : 'ok',
        headline: L && A ? `Suggested team: **${L.n}** (Lead) + **${A.n}** (Auditor).` : 'Add Lead Auditors and Auditors to the directory to get team suggestions.',
        points: [
          date ? `Audit date ${fmt(date)} (${daysUntil(date)} day(s) away).` : 'No audit date yet.',
          L && `${L.n}: ${L.load} active audit(s)${L.clash ? ' — **already booked that day**' : ''}.`,
          A && `${A.n}: ${A.load} active audit(s)${A.clash ? ' — **already booked that day**' : ''}.`,
          c.standard && `Check both are qualified for **${c.standard}**.`,
        ].filter(Boolean) as string[],
        apply: L && A ? { label: 'Use suggested team', values: { lead: L.n, auditor: A.n } } : undefined,
      };
    }
    case 'auditee-schedule': {
      const d = w.schedule?.proposedDate;
      if (!d) return { tone: 'info', headline: 'No date proposed yet.', points: [] };
      const dd = new Date(d); const days = daysUntil(d); const wk = dd.getDay() === 0 || dd.getDay() === 6;
      const pts = [`Proposed **${fmt(d)}** — ${days} day(s) from today.`];
      if (wk) pts.push('It falls on a **weekend** — check your site will be open.');
      if (days < 7) pts.push('Less than a week away — make sure key staff and documents are available.');
      pts.push('Have ready: scope, policy, objectives, internal audit & management review records.');
      return { tone: wk || days < 3 ? 'warn' : 'ok', headline: wk || days < 3 ? 'Check this date before approving.' : 'Date looks workable — approve if your team is available.', points: pts };
    }
    case 'lead-confirm':
    case 'auditor-confirm': {
      const who = step === 'lead-confirm' ? w.schedule?.leadAuditor : w.schedule?.auditor;
      const clashes = who ? busyOn(who, w.schedule?.proposedDate, c.id) : [];
      return {
        tone: clashes.length ? 'bad' : 'ok',
        headline: clashes.length ? `**${who}** is also booked on ${fmt(w.schedule?.proposedDate)} for ${clashes.map((x) => x.name).join(', ')}.` : `No clash found for ${who || 'the assigned person'} on ${fmt(w.schedule?.proposedDate)}.`,
        points: [`Audit date ${fmt(w.schedule?.proposedDate)} (${daysUntil(w.schedule?.proposedDate)} day(s) away).`, who ? `${who} has ${workloadOf(who)} active audit(s).` : '', c.standard && `Prepare the **${c.standard}** checklist (Smart Checklist).`].filter(Boolean) as string[],
      };
    }
    case 'auditee-actions': {
      const rev = c.findings.map((f) => ({ f, r: reviewCorrectiveAction(f.correctiveAction, f.severity) }));
      const missing = rev.filter((x) => x.r.verdict === 'missing').length;
      const majors = c.findings.filter((f) => /major/i.test(f.severity || '')).length;
      return {
        tone: missing ? 'warn' : 'ok',
        headline: c.findings.length ? `${c.findings.length} finding(s) to answer${majors ? `, ${majors} Major` : ''}. Use **Draft with AI** for a starting point, then edit.` : 'No findings — you can submit straight away.',
        points: [
          majors ? 'Major NCs usually need corrective action **and evidence** before certification (often within 60–90 days).' : 'Minor NCs usually need an acceptable action plan within ~30 days.',
          'A good answer has: root cause → correction → corrective action → owner & date → how effectiveness is checked.',
          late,
        ],
      };
    }
    case 'auditor-review':
    case 'lead-accept': {
      const rev = c.findings.map((f) => ({ f, r: reviewCorrectiveAction(f.correctiveAction, f.severity) }));
      const weak = rev.filter((x) => x.r.verdict !== 'good');
      const avg = rev.length ? rev.reduce((s, x) => s + x.r.score, 0) / rev.length : 100;
      const reason = weak.map((x, i) => `${i + 1}) ${x.f.severity || 'Finding'}${x.f.clause ? ` ${x.f.clause}` : ''}: ${x.r.tips[0]?.replace(/\*\*/g, '')}`).join(' ');
      return {
        tone: weak.length ? (avg < 45 ? 'bad' : 'warn') : 'ok',
        headline: weak.length ? `Recommend **return to auditee** — ${weak.length} of ${rev.length} corrective action(s) are weak (quality ${pct(avg)}).` : `Recommend **${step === 'lead-accept' ? 'accept & recommend certification' : 'forward to Lead Auditor'}** — all ${rev.length} corrective action(s) look complete (quality ${pct(avg)}).`,
        points: weak.slice(0, 5).map((x) => `${x.f.severity || 'Finding'}${x.f.clause ? ` · ${x.f.clause}` : ''}: ${x.r.tips.slice(0, 2).join(' ')}`),
        apply: weak.length ? { label: 'Use as return reason', values: { value: `Please improve: ${reason}`.slice(0, 400) } } : undefined,
      };
    }
    case 'coord-certificate': {
      const scope = w.requirements?.scope || '[activities / products / sites]';
      const std = c.standard || w.requirements?.standards?.join(', ') || 'the standard';
      const issue = new Date().toISOString();
      const num = `CS-${new Date().getFullYear()}-${String(c.id).padStart(4, '0')}`;
      return {
        tone: 'info',
        headline: `Draft certificate for **${c.name}** — ${std}.`,
        points: [
          `Certificate number will be **${num}**.`,
          `Scope statement: "The ${std} management system of ${c.name} applicable to ${scope}."`,
          `Valid ${fmt(issue)} → ${fmt(addDays(issue, 3 * 365 - 1))}. Surveillance 1 by ${fmt(addDays(issue, 365))}, surveillance 2 by ${fmt(addDays(issue, 730))}.`,
          c.findings.some((f) => /major/i.test(f.severity || '') && !f.correctiveAction) ? '⚠ A Major NC has no corrective action recorded — check before generating.' : 'All findings have corrective actions recorded.',
        ],
      };
    }
    case 'mgmt-certificate': {
      const issues: string[] = [];
      if (!c.flags.certificateNumber) issues.push('Certificate not generated yet by the Coordinator.');
      const noCa = c.findings.filter((f) => !f.correctiveAction).length;
      if (noCa) issues.push(`${noCa} finding(s) have no corrective action.`);
      if (!w.history?.some((h) => h.stage === 'Audit In Progress')) issues.push('No record of the audit being conducted.');
      if (!w.schedule?.leadAuditor) issues.push('No Lead Auditor recorded.');
      return {
        tone: issues.length ? 'warn' : 'ok',
        headline: issues.length ? `Check ${issues.length} item(s) before releasing.` : 'Certification file is complete — ready to approve & release.',
        points: [...issues, `${c.findings.length} finding(s) closed · Lead Auditor ${w.schedule?.leadAuditor || '—'} · certificate ${c.flags.certificateNumber || '—'}.`],
      };
    }
    case 'coord-deliver':
    case 'cc-certificates': {
      const rel = [...(w.history || [])].reverse().find((h) => h.stage === 'Certification released')?.at || w.updatedAt;
      return {
        tone: 'info',
        headline: step === 'coord-deliver' ? (c.flags.deliveredAt ? 'Delivered.' : 'Send the certificate and mark it delivered.') : `Certificate ${c.flags.certificateNumber || ''} is active.`,
        points: [`Issued ${fmt(rel)} · expires ${fmt(addDays(rel, 3 * 365 - 1))}.`, `Surveillance audit 1 due by **${fmt(addDays(rel, 365))}** (${daysUntil(addDays(rel, 365))} days).`],
      };
    }
    default: return null;
  }
};

/* ---------------------------- role insights ------------------------- */
export interface Insight { tone: 'ok' | 'warn' | 'bad' | 'info'; text: string; path?: string }
const OWNER: Record<string, string[]> = {
  'Management': ['Registration Submitted', 'Review and Approval by Auditor'],
  'Audit Coordinator': ['Coordinator Assigned', 'Requirements Reviewed', 'Schedule Proposed', 'Review and Approval by Auditor', 'Certification released'],
  'Lead Auditor': ['Schedule Approved by Auditee', 'Action items released to Auditor'],
  'Auditor': ['Schedule Approved by Auditee', 'Schedule Approved by Auditor', 'Audit In Progress', 'Audit Completed', 'Action items released to Auditor'],
  'Auditee': ['Schedule Proposed', 'Assigned Auditors (Lead auditor, Auditor)', 'Audit findings'],
  'Client Coordinator': ['Schedule Proposed', 'Assigned Auditors (Lead auditor, Auditor)', 'Audit findings', 'Certification released'],
};
const myClientId = (): number | null => {
  for (const k of ['cms_active_client_id', 'cms_current_client_id', 'cms_active_org_id']) {
    const n = Number(String(localStorage.getItem(k) || '').replace(/"/g, ''));
    if (localStorage.getItem(k) && Number.isFinite(n)) return n;
  }
  return null;
};

export const roleInsights = (role: string): Insight[] => {
  let all = workflowClients();
  const out: Insight[] = [];
  if (role === 'Auditee' || role === 'Client Coordinator') {
    const id = myClientId();
    all = all.filter((c) => id === null || c.id === id);
    const c = all[0];
    if (!c) return [{ tone: 'info', text: 'Your audit file will appear here once Management approves your registration.' }];
    out.push({ tone: 'info', text: `${c.name}: step ${c.stageNo} of 14 — **${c.wf.currentStage}**.` });
    const d = c.wf.schedule?.proposedDate;
    if (d && daysUntil(d) >= 0) out.push({ tone: daysUntil(d) <= 7 ? 'warn' : 'info', text: `Audit on **${fmt(d)}** (${daysUntil(d)} day(s)). Prepare scope, objectives, internal audit and management review records.` });
    if (c.wf.currentStage === 'Schedule Proposed' || c.wf.currentStage === 'Assigned Auditors (Lead auditor, Auditor)') out.push({ tone: 'warn', text: 'Action needed: **approve or decline the proposed audit date**.', path: '/audit-client/schedule-approvals' });
    if (c.wf.currentStage === 'Audit findings') {
      const majors = c.findings.filter((f) => /major/i.test(f.severity || '')).length;
      out.push({ tone: majors ? 'bad' : 'warn', text: `Action needed: answer **${c.findings.length} finding(s)**${majors ? ` (${majors} Major)` : ''} with corrective actions.`, path: '/audit-client/audit-actions' });
    }
    if (c.wf.currentStage === 'Certification released') {
      const rel = c.wf.updatedAt;
      out.push({ tone: 'ok', text: `Certified. Next surveillance audit due by **${fmt(addDays(rel, 365))}**.` });
    }
    if (c.overdue) out.push({ tone: 'warn', text: `This step has taken ${c.ageDays} day(s) (usual: ${c.sla}).` });
    return out;
  }

  const mine = all.filter((c) => OWNER[role]?.includes(c.wf.currentStage));
  const late = mine.filter((c) => c.overdue).sort((a, b) => b.ageDays - b.sla - (a.ageDays - a.sla));
  if (mine.length) out.push({ tone: 'info', text: `**${mine.length}** client(s) are at a step you handle.` });
  late.slice(0, 3).forEach((c) => out.push({ tone: 'bad', text: `**${c.name}** is late at *${c.wf.currentStage}* — ${c.ageDays} day(s) (target ${c.sla}).` }));
  const soon = all.filter((c) => c.wf.schedule?.proposedDate && daysUntil(c.wf.schedule.proposedDate) >= 0 && daysUntil(c.wf.schedule.proposedDate) <= 7 && STAGE_ORDER.indexOf(c.wf.currentStage) < STAGE_ORDER.indexOf('Audit In Progress'));
  soon.slice(0, 3).forEach((c) => out.push({ tone: 'warn', text: `Audit for **${c.name}** in ${daysUntil(c.wf.schedule!.proposedDate)} day(s) — still at *${c.wf.currentStage}*.` }));
  if (role === 'Auditor' || role === 'Lead Auditor' || role === 'Management') {
    const weak = all.filter((c) => c.wf.currentStage === 'Action items released to Auditor')
      .flatMap((c) => c.findings.map((f) => ({ c, r: reviewCorrectiveAction(f.correctiveAction, f.severity) }))).filter((x) => x.r.verdict !== 'good');
    if (weak.length) out.push({ tone: 'warn', text: `AI review: **${weak.length}** submitted corrective action(s) look weak (missing root cause, owner or date).` });
  }
  if (role === 'Management' || role === 'Audit Coordinator') {
    const total = all.length, cert = all.filter((c) => c.wf.currentStage === 'Certification released').length;
    const lateAll = all.filter((c) => c.overdue).length;
    out.push({ tone: lateAll ? 'warn' : 'ok', text: `Pipeline: **${total}** client(s), **${cert}** certified, **${lateAll}** behind schedule.` });
    const people = Array.from(new Set(all.flatMap((c) => [c.wf.schedule?.leadAuditor, c.wf.schedule?.auditor]).filter(Boolean) as string[]));
    const loads = people.map((p) => ({ p, n: workloadOf(p) })).sort((a, b) => b.n - a.n);
    if (loads.length > 1 && loads[0].n - loads[loads.length - 1].n >= 3) out.push({ tone: 'warn', text: `Workload imbalance: **${loads[0].p}** has ${loads[0].n} active audits, ${loads[loads.length - 1].p} has ${loads[loads.length - 1].n}.` });
    const expiring = all.filter((c) => c.wf.currentStage === 'Certification released' && daysUntil(addDays(c.wf.updatedAt, 365)) <= 60);
    if (expiring.length) out.push({ tone: 'warn', text: `**${expiring.length}** certified client(s) need a surveillance audit within 60 days.` });
  }
  if (!out.length) out.push({ tone: 'ok', text: 'All clear — nothing is waiting on you and nothing is late.' });
  return out;
};

/** Prompt for Claude to expand a built-in result (used only when a key is configured). */
export const claudePrompt = (what: string, facts: string[]) =>
  `You are the AI assistant inside CertiSphere, an ISO certification-body management system. ${what}\n\nFacts from the system:\n- ${facts.join('\n- ')}\n\nReply in at most 6 short bullet points, practical and specific. Do not invent data.`;

/* ------------- adapters: workflow data in the shapes older AI pages use ------------- */
const caSeverity = (s?: string): 'Major NC' | 'Minor NC' | 'OFI' => (/major/i.test(s || '') ? 'Major NC' : /minor/i.test(s || '') ? 'Minor NC' : 'OFI');

/** Workflow findings as corrective-action records (ids start with "WF-"). */
export const workflowCorrectiveActions = () => workflowClients().flatMap((c) => c.findings.map((f) => {
  const st = c.wf.currentStage;
  const stIdx = STAGE_ORDER.indexOf(st);
  const status = stIdx >= STAGE_ORDER.indexOf('Review and Approval by Auditor') ? 'Approved'
    : st === 'Action items released to Auditor' ? (c.flags.auditorReviewedAt ? 'Auditor Reviewed' : 'Submitted')
      : f.correctiveAction ? 'Submitted' : 'Open';
  const created = f.createdAt || stageEnteredAt(c.wf);
  const sev = caSeverity(f.severity);
  return {
    id: `WF-${c.id}-${f.id}`, capId: `CAP-${c.id}-${String(f.id).slice(-4)}`, clientName: c.name,
    auditTitle: `${c.standard || 'Certification'} audit`, auditType: 'Initial certification', standard: c.standard || '',
    severity: sev, description: [f.clause && `Clause ${f.clause}:`, f.description].filter(Boolean).join(' '),
    rootCause: undefined, correctivePlan: f.correctiveAction || undefined,
    evidence: f.evidence ? [{ name: f.evidence, date: created }] : [],
    dueDate: addDays(created, sev === 'Major NC' ? 60 : sev === 'Minor NC' ? 30 : 90).slice(0, 10),
    status: status as 'Open' | 'Submitted' | 'Auditor Reviewed' | 'Approved' | 'Rejected',
    submittedAt: f.actionSubmittedAt, reviewedAt: c.flags.auditorReviewedAt,
    history: (c.wf.history || []).map((h) => ({ at: h.at, by: h.by || 'System', action: h.note || h.stage })),
  };
}));

/** Workflow audit dates as schedule rows. */
export const workflowSchedules = () => workflowClients().filter((c) => c.wf.schedule?.proposedDate).map((c) => ({
  id: `WF-${c.id}`, clientId: c.id, clientName: c.name, organizationName: c.name, standard: c.standard,
  date: c.wf.schedule!.proposedDate, scheduledDate: c.wf.schedule!.proposedDate, startDate: c.wf.schedule!.proposedDate,
  leadAuditor: c.wf.schedule!.leadAuditor, auditor: c.wf.schedule!.auditor, auditorName: c.wf.schedule!.leadAuditor || c.wf.schedule!.auditor,
  status: STAGE_ORDER.indexOf(c.wf.currentStage) >= STAGE_ORDER.indexOf('Audit Completed') ? 'Completed' : c.wf.schedule!.decision === 'Approved' ? 'Approved' : 'Pending',
  auditType: 'Initial certification', source: 'workflow',
}));

/** Released workflow certificates. */
export const workflowCertificates = () => workflowClients().filter((c) => c.wf.currentStage === 'Certification released').map((c) => {
  const rel = [...(c.wf.history || [])].reverse().find((h) => h.stage === 'Certification released')?.at || c.wf.updatedAt;
  return {
    id: `WF-${c.id}`, certificateNumber: c.flags.certificateNumber || `CS-${c.id}`, clientName: c.name, organizationName: c.name,
    standard: c.standard, issueDate: rel.slice(0, 10), expiryDate: addDays(rel, 3 * 365 - 1).slice(0, 10), status: 'Active', source: 'workflow',
  };
});

/** The signed-in client's own audit file (Auditee / Client Coordinator pages). */
export const myClientContext = () => {
  const id = myClientId();
  const all = workflowClients();
  const client = all.find((c) => c.id === id) || (all.length === 1 ? all[0] : undefined);
  if (!client) return null;
  const actions = workflowCorrectiveActions().filter((a) => a.clientName === client.name);
  const sch = client.wf.schedule;
  return {
    client, actions, clientName: client.name, standard: client.standard || 'ISO 9001:2015',
    industry: client.reg?.industry || client.reg?.businessType || 'General',
    scope: client.wf.requirements?.scope || client.reg?.scope || '',
    auditDate: sch?.proposedDate || '', auditor: sch?.leadAuditor || sch?.auditor || '',
    schedules: workflowSchedules().filter((s) => s.clientId === client.id),
    certificates: workflowCertificates().filter((c) => c.clientName === client.name),
  };
};

/** Clients that still need an audit scheduled / staffed (Smart Scheduler jobs). */
export const workflowSchedulingJobs = () => workflowClients()
  .filter((c) => ['Coordinator Assigned', 'Requirements Reviewed', 'Schedule Proposed', 'Assigned Auditors (Lead auditor, Auditor)'].includes(c.wf.currentStage))
  .map((c) => {
    const std = c.standard || 'ISO 9001:2015';
    const emp = Number(c.reg?.employees || c.reg?.numberOfEmployees || c.reg?.employeeCount || 0);
    const days = emp > 125 ? 5 : emp > 45 ? 3 : emp > 0 ? 2 : /27001|22000|45001/.test(std) ? 3 : 2;
    return {
      id: `WF-${c.id}`, clientName: c.name, standard: std, auditType: 'Initial certification',
      location: c.reg?.address || c.reg?.city || 'TBD', estimatedDays: days,
      complexity: (/27001|22000/.test(std) || days >= 3 ? 'High' : 'Medium') as 'Low' | 'Medium' | 'High',
      requiredSkill: std, preferredDate: c.wf.schedule?.proposedDate, status: c.wf.currentStage,
    };
  });

/* ------------- Coordinator: requirements review + date proposal ------------- */
const DOCS: Record<string, string[]> = {
  '9001': ['Quality policy & objectives', 'Scope statement', 'Process map', 'Risk & opportunity register', 'Internal audit report', 'Management review minutes', 'Customer satisfaction data', 'Nonconformity & corrective action log'],
  '14001': ['Environmental policy', 'Aspects & impacts register', 'Compliance obligations register', 'Environmental objectives', 'Emergency preparedness plan', 'Monitoring & measurement records', 'Internal audit report', 'Management review minutes'],
  '45001': ['OH&S policy', 'Hazard identification & risk assessment', 'Legal requirements register', 'Incident / near-miss log', 'Worker consultation records', 'Emergency drills', 'Internal audit report', 'Management review minutes'],
  '27001': ['ISMS scope', 'Information security policy', 'Risk assessment & treatment plan', 'Statement of Applicability', 'Asset inventory', 'Incident log', 'Internal audit report', 'Management review minutes'],
  '22000': ['Food safety policy', 'HACCP plan / hazard analysis', 'PRP & OPRP records', 'Traceability & recall procedure', 'Supplier approval records', 'Internal audit report', 'Management review minutes'],
  '50001': ['Energy policy', 'Energy review & baseline (EnB)', 'EnPIs', 'Significant energy uses list', 'Action plans', 'Internal audit report', 'Management review minutes'],
  '13485': ['Quality manual', 'Medical device file', 'Design & development records', 'Risk management file (ISO 14971)', 'Complaint & vigilance records', 'Internal audit report', 'Management review minutes'],
  '42001': ['AI policy', 'AI system inventory', 'AI risk & impact assessment', 'Statement of Applicability', 'Data governance records', 'Internal audit report', 'Management review minutes'],
};
export const auditDaysFor = (employees: number, standard: string) => {
  const e = employees || 0;
  let d = e <= 5 ? 1.5 : e <= 10 ? 2 : e <= 15 ? 2.5 : e <= 25 ? 3 : e <= 45 ? 4 : e <= 65 ? 5 : e <= 85 ? 6 : e <= 125 ? 7 : e <= 175 ? 8 : e <= 275 ? 9 : 10;
  if (/27001|22000|13485/.test(standard)) d += 1;
  return d;
};
export const requirementsSuggestion = (clientId: number, standard: string): Suggestion => {
  const c = workflowClients().find((x) => x.id === Number(clientId));
  const reg = c?.reg || {};
  const key = Object.keys(DOCS).find((k) => standard.includes(k)) || '9001';
  const emp = Number(reg.employees || reg.numberOfEmployees || reg.employeeCount || 0);
  const days = auditDaysFor(emp, standard);
  const activity = reg.industry || reg.businessType || reg.scope || 'its products and services';
  const scope = `${reg.organizationName || c?.name || 'The organisation'} — ${activity}${reg.address ? ` at ${String(reg.address).split(',').slice(-2).join(',').trim()}` : ''}`;
  return {
    tone: 'info',
    headline: `Collect the **${standard}** core documents and plan about **${days} audit day(s)** (Stage 1 + Stage 2${emp ? `, ${emp} employees` : ', employee count unknown'}).`,
    points: [`Documents: ${DOCS[key].join(', ')}.`, `Suggested scope: "${scope}".`, 'Audit time follows IAF MD 5 — adjust for sites, shifts and complexity.'],
    apply: { label: 'Fill scope & documents', values: { scope, documents: DOCS[key].join(', ') } },
  };
};
export const scheduleSuggestion = (clientId: number): Suggestion => {
  const leads = candidateNames('Lead Auditor');
  const auds = candidateNames('Auditor');
  const d = new Date(); d.setDate(d.getDate() + 14);
  for (let i = 0; i < 60; i++) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      const iso = d.toISOString().slice(0, 10);
      const L = leastLoaded(leads, iso, clientId)[0];
      const A = leastLoaded(auds.filter((x) => x !== L?.n), iso, clientId)[0];
      if ((!L || !L.clash) && (!A || !A.clash)) {
        return {
          tone: 'info',
          headline: `Propose **${fmt(iso)}** with **${L?.n || '—'}** (Lead) and **${A?.n || '—'}** (Auditor) — both free that day.`,
          points: ['At least 2 weeks ahead so the auditee can prepare; weekends skipped.', L ? `${L.n}: ${L.load} active audit(s); ${A ? `${A.n}: ${A.load}` : ''}` : 'Add Lead Auditors to get team suggestions.'],
          apply: { label: 'Use this date & team', values: { proposedDate: iso, leadAuditor: L?.n || '', auditor: A?.n || '', notes: 'Please have your scope, policy, objectives, internal audit report and management review minutes ready.' } },
        };
      }
    }
    d.setDate(d.getDate() + 1);
  }
  return { tone: 'warn', headline: 'No free date found in the next 2 months for the available team.', points: [] };
};
