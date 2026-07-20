/**
 * managementInsights.ts — heuristic AI insight builders for the Management role.
 *
 * Every builder computes purely from the liveData readers (localStorage), so
 * all insights work with NO API key. Pages re-run the builders on onCmsChange.
 * Each feature also exposes a `*ClaudePrompt` helper so pages can optionally
 * enhance the wording via claudeComplete when a key is configured.
 *
 * Features:
 *   1. buildExecutiveBriefing    — Management Dashboard executive summary
 *   2. buildRiskRadar            — per-client risk score (ClientCredentials)
 *   3. detectAssignmentAnomalies — schedule/report anomaly scan (AuditAssignments)
 */
import {
  getClients,
  getAuditors,
  getSchedules,
  getDispatches,
  getEnquiries,
  getCertificates,
  getCorrectiveActions,
  getFindings,
  getReports,
  daysFromNow,
  daysBetween,
} from './liveData';

export type ChipLevel = 'high' | 'med' | 'low' | 'info';

/* ---------- shared field normalisers (records are heterogeneous) ---------- */
const str = (v: unknown): string => (v == null ? '' : String(v));
const lower = (v: unknown): string => str(v).toLowerCase();

const certExpiry = (c: any): string => (c ? str(c.expiryDate || c.expirationDate || c.validUntil || '') : '');
const certClient = (c: any): string => (c ? str(c.organizationName || c.client || c.clientName || '') : '');
const scheduleClient = (s: any): string => (s ? str(s.organizationName || s.client || s.clientName || '') : '');
const scheduleWhen = (s: any): string => (s ? str(s.date || s.scheduledDate || s.startDate || '') : '');
const isClosedCA = (ca: any): boolean => !!ca && (lower(ca.status) === 'approved' || lower(ca.status) === 'closed');

/* ======================================================================
   1. EXECUTIVE AI BRIEFING — Management Dashboard
====================================================================== */
export interface BriefingHighlight {
  level: ChipLevel;
  chip: string;
  text: string;
}

export interface ExecutiveBriefing {
  paragraph: string;
  highlights: BriefingHighlight[];
  generatedAt: string;
}

export const buildExecutiveBriefing = (): ExecutiveBriefing => {
  const certs = getCertificates();
  const cas = getCorrectiveActions();
  const auditors = getAuditors();
  const schedules = getSchedules();
  const enquiries = getEnquiries();
  const dispatches = getDispatches();

  // Certificates: issued / active / expiring soon / expired
  let active = 0;
  let expiringSoon = 0;
  let expired = 0;
  certs.forEach((c) => {
    const exp = certExpiry(c);
    if (!exp) { active += 1; return; }
    const d = daysFromNow(exp);
    if (d < 0) expired += 1;
    else {
      active += 1;
      if (d <= 90) expiringSoon += 1;
    }
  });

  // Corrective actions: open vs overdue
  const openCAs = cas.filter((c) => !isClosedCA(c));
  const overdueCAs = openCAs.filter((c) => c.dueDate && daysFromNow(c.dueDate) < 0);
  const openMajor = openCAs.filter((c) => lower(c.severity).includes('major')).length;

  // Auditor utilisation: schedules per auditor
  const load = new Map<string, number>();
  schedules.forEach((s) => {
    const team: string[] = [s.leadAuditor, s.auditor, ...(Array.isArray(s.assignedAuditors) ? s.assignedAuditors : [])]
      .filter(Boolean)
      .map((n: unknown) => str(n));
    Array.from(new Set(team)).forEach((name) => load.set(name, (load.get(name) || 0) + 1));
  });
  const auditorName = (a: any): string => str(a.name || a.fullName || a.auditorName);
  const totalAuditors = auditors.length;
  const busyAuditors = totalAuditors
    ? auditors.filter((a) => (load.get(auditorName(a)) || 0) > 0).length
    : load.size;
  let busiest = '';
  let busiestCount = 0;
  load.forEach((n, name) => { if (n > busiestCount) { busiest = name; busiestCount = n; } });

  // Pipeline: enquiries by status + dispatches
  const enquiryByStatus = new Map<string, number>();
  enquiries.forEach((e) => {
    const s = str(e.status || 'New');
    enquiryByStatus.set(s, (enquiryByStatus.get(s) || 0) + 1);
  });
  const enquirySummary = Array.from(enquiryByStatus.entries())
    .map(([k, v]) => `${v} ${k.toLowerCase()}`)
    .join(', ');
  const inFlightDispatches = dispatches.filter(
    (d) => !['approved', 'rejected', 'closed'].includes(lower(d.status))
  ).length;

  const paragraph =
    `The certification portfolio currently holds ${certs.length} certificate record(s) — ` +
    `${active} active, ${expiringSoon} expiring within 90 days` +
    (expired ? ` and ${expired} already expired` : '') +
    `. Corrective actions stand at ${openCAs.length} open` +
    (overdueCAs.length
      ? ` (${overdueCAs.length} past their due date` + (openMajor ? `, including ${openMajor} Major NC${openMajor > 1 ? 's' : ''}` : '') + ')'
      : (openMajor ? ` (${openMajor} Major NC${openMajor > 1 ? 's' : ''})` : '')) +
    `. ${busyAuditors} of ${totalAuditors || busyAuditors} registered auditor(s) carry the ${schedules.length} schedule(s) on the books` +
    (busiest ? `; ${busiest} is the busiest with ${busiestCount} assignment(s)` : '') +
    `. The intake pipeline shows ${enquiries.length} enquiry(ies)` +
    (enquirySummary ? ` (${enquirySummary})` : '') +
    ` and ${dispatches.length} application dispatch(es), ${inFlightDispatches} still in flight.`;

  const highlights: BriefingHighlight[] = [
    {
      chip: 'Certificates',
      level: expired > 0 ? 'high' : expiringSoon > 0 ? 'med' : 'low',
      text: expired > 0
        ? `${expired} certificate(s) have lapsed and ${expiringSoon} more expire within 90 days — renewal outreach is urgent.`
        : expiringSoon > 0
          ? `${expiringSoon} certificate(s) enter their 90-day expiry window — schedule recertification audits now.`
          : `All ${active} active certificates are outside the 90-day expiry window.`,
    },
    {
      chip: 'CAPA',
      level: overdueCAs.length > 0 ? 'high' : openCAs.length > 0 ? 'med' : 'low',
      text: overdueCAs.length > 0
        ? `${overdueCAs.length} of ${openCAs.length} open corrective action(s) are overdue — chase closure evidence.`
        : openCAs.length > 0
          ? `${openCAs.length} corrective action(s) remain open; none are overdue yet.`
          : 'No open corrective actions — the CAPA loop is clear.',
    },
    {
      chip: 'Auditors',
      level: totalAuditors > 0 && busyAuditors < totalAuditors && busiestCount >= 3 ? 'med' : 'info',
      text: totalAuditors > 0 && busyAuditors < totalAuditors
        ? `${totalAuditors - busyAuditors} auditor(s) have no assignments while ${busiest || 'the busiest auditor'} carries ${busiestCount} — consider rebalancing.`
        : busiest
          ? `Workload is spread across ${load.size} auditor(s); ${busiest} leads with ${busiestCount} assignment(s).`
          : 'No auditor assignments recorded yet.',
    },
    {
      chip: 'Pipeline',
      level: 'info',
      text: `${enquiries.length} enquiry(ies) and ${inFlightDispatches} in-flight dispatch(es) feed the certification funnel.`,
    },
  ];

  return { paragraph, highlights, generatedAt: new Date().toISOString() };
};

export const briefingClaudePrompt = (b: ExecutiveBriefing): string =>
  'You are the executive assistant of an ISO certification body. Rewrite the following ' +
  'operational summary as one crisp, board-ready briefing paragraph (max 110 words). ' +
  'Keep every number exactly accurate, keep a confident professional tone, and end with ' +
  'the single most important action. Return only the paragraph.\n\n' +
  `SUMMARY:\n${b.paragraph}\n\nKEY POINTS:\n${b.highlights.map((h) => `- [${h.chip}] ${h.text}`).join('\n')}`;

/* ======================================================================
   2. RISK RADAR — Management ClientCredentials
====================================================================== */
export interface ClientRiskEntry {
  client: string;
  score: number; // 0-100
  level: ChipLevel;
  reason: string;
}

export const buildRiskRadar = (): ClientRiskEntry[] => {
  const certs = getCertificates();
  const cas = getCorrectiveActions();
  const schedules = getSchedules();

  const names = new Set<string>();
  getClients().forEach((c) => names.add(str(c.organizationName || c.name)));
  certs.forEach((c) => names.add(certClient(c)));
  cas.forEach((c) => names.add(str(c.clientName)));
  names.delete('');

  const out: ClientRiskEntry[] = [];
  names.forEach((name) => {
    let score = 0;
    const reasons: Array<{ w: number; text: string }> = [];

    // Overdue surveillance / expiry pressure
    const myCerts = certs.filter((c) => certClient(c) === name);
    const expiredCerts = myCerts.filter((c) => certExpiry(c) && daysFromNow(certExpiry(c)) < 0).length;
    const nearExpiry = myCerts.filter((c) => {
      const e = certExpiry(c);
      if (!e) return false;
      const d = daysFromNow(e);
      return d >= 0 && d <= 60;
    }).length;
    const overdueSurveillance = myCerts.filter((c) =>
      (c.surveillance1Due && daysFromNow(c.surveillance1Due) < 0) ||
      (c.surveillance2Due && daysFromNow(c.surveillance2Due) < 0)
    ).length;
    if (expiredCerts) { score += Math.min(40, expiredCerts * 35); reasons.push({ w: 40, text: `${expiredCerts} certificate(s) already expired` }); }
    if (nearExpiry) { score += Math.min(25, nearExpiry * 20); reasons.push({ w: 25, text: `${nearExpiry} certificate(s) expiring within 60 days` }); }
    if (overdueSurveillance) { score += Math.min(20, overdueSurveillance * 15); reasons.push({ w: 20, text: `surveillance window passed on ${overdueSurveillance} certificate(s)` }); }

    // Open NC pressure
    const myCAs = cas.filter((c) => str(c.clientName) === name);
    const openList = myCAs.filter((c) => !isClosedCA(c));
    const openMajor = openList.filter((c) => lower(c.severity).includes('major')).length;
    const openOther = openList.length - openMajor;
    const overdueOpen = openList.filter((c) => c.dueDate && daysFromNow(c.dueDate) < 0).length;
    if (openMajor) { score += Math.min(50, openMajor * 25); reasons.push({ w: 50, text: `${openMajor} open Major NC(s)` }); }
    if (openOther) { score += Math.min(16, openOther * 8); reasons.push({ w: 16, text: `${openOther} open minor/OFI action(s)` }); }
    if (overdueOpen) { score += Math.min(20, overdueOpen * 10); reasons.push({ w: 20, text: `${overdueOpen} corrective action(s) past due date` }); }

    // Slow closure history — how long open actions have been sitting
    const ages = openList
      .map((c) => {
        const raised = c.history && c.history[0] && c.history[0].at ? c.history[0].at : c.submittedAt;
        return raised ? -daysFromNow(raised) : null;
      })
      .filter((n): n is number => n !== null && n >= 0);
    const avgAge = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;
    if (avgAge > 45) { score += 12; reasons.push({ w: 12, text: `slow closure history (~${Math.round(avgAge)} days average open)` }); }

    // Stalled schedules — audit date passed but never completed
    const stalled = schedules.filter((s) =>
      scheduleClient(s) === name &&
      scheduleWhen(s) &&
      daysFromNow(scheduleWhen(s)) < -3 &&
      !lower(s.status).includes('complet') &&
      !lower(s.status).includes('cancel')
    ).length;
    if (stalled) { score += Math.min(24, stalled * 12); reasons.push({ w: 24, text: `${stalled} stalled schedule(s) past their audit date` }); }

    score = Math.max(0, Math.min(100, Math.round(score)));
    reasons.sort((a, b) => b.w - a.w);
    out.push({
      client: name,
      score,
      level: score >= 60 ? 'high' : score >= 30 ? 'med' : 'low',
      reason: reasons.length ? reasons.slice(0, 2).map((r) => r.text).join('; ') : 'no open risk signals in live data',
    });
  });

  return out.sort((a, b) => b.score - a.score || a.client.localeCompare(b.client));
};

export const riskRadarClaudePrompt = (entries: ClientRiskEntry[]): string =>
  'You are a certification-body risk analyst. Given these heuristic client risk scores, ' +
  'write a short narrative risk assessment (max 100 words): name the riskiest clients, why, ' +
  'and one recommended intervention. Keep numbers accurate. Return only the paragraph.\n\n' +
  entries.slice(0, 8).map((e) => `- ${e.client}: ${e.score}/100 (${e.reason})`).join('\n');

/* ======================================================================
   3. ANOMALY DETECTION — Management AuditAssignments
====================================================================== */
export type AnomalyType = 'Impartiality' | 'Zero Findings' | 'Fast Completion' | 'Approval Gap';

export interface AssignmentAnomaly {
  id: string;
  type: AnomalyType;
  level: ChipLevel;
  text: string;
}

export const detectAssignmentAnomalies = (): AssignmentAnomaly[] => {
  const schedules = getSchedules();
  const reports = getReports();
  const findings = getFindings();
  const out: AssignmentAnomaly[] = [];

  // 1. Impartiality — same auditor repeatedly assigned to the same client
  const pairCount = new Map<string, number>();
  schedules.forEach((s) => {
    const client = scheduleClient(s);
    if (!client) return;
    const team = Array.from(new Set([s.leadAuditor, s.auditor].filter(Boolean).map((n: unknown) => str(n))));
    team.forEach((auditor) => {
      const k = `${auditor}|||${client}`;
      pairCount.set(k, (pairCount.get(k) || 0) + 1);
    });
  });
  pairCount.forEach((n, k) => {
    if (n >= 2) {
      const [auditor, client] = k.split('|||');
      out.push({
        id: `imp-${k}`,
        type: 'Impartiality',
        level: n >= 3 ? 'high' : 'med',
        text: `${auditor} has been assigned to ${client} ${n} times — rotate the audit team to protect impartiality.`,
      });
    }
  });

  // 2. Zero-finding audits (report says 0 findings, or completed audit left no trace)
  const clientsWithFindings = new Set(findings.filter(Boolean).map((f) => str(f.client)));
  const clientsWithReports = new Set(reports.filter(Boolean).map((r) => str(r.client || r.organizationName)));
  reports.forEach((r, i) => {
    const total = Number(r.findingsTotal ?? r.findings);
    if (Number.isFinite(total) && total === 0) {
      out.push({
        id: `zero-rpt-${str(r.id) || i}`,
        type: 'Zero Findings',
        level: 'med',
        text: `${str(r.client || r.organizationName) || 'Unknown client'} — ${str(r.standard) || 'audit'} report dated ${str(r.auditDate || r.date) || 'n/a'} recorded zero findings; verify audit depth.`,
      });
    }
  });
  schedules.forEach((s, i) => {
    if (!lower(s.status).includes('complet')) return;
    const client = scheduleClient(s);
    if (client && !clientsWithFindings.has(client) && !clientsWithReports.has(client)) {
      out.push({
        id: `zero-sch-${str(s.id) || i}`,
        type: 'Zero Findings',
        level: 'info',
        text: `${client} — audit completed on ${scheduleWhen(s) || 'n/a'} but no findings or report exist for this client yet.`,
      });
    }
  });

  // 3. Suspiciously fast completion (start == end, or report filed the same day)
  schedules.forEach((s, i) => {
    if (!lower(s.status).includes('complet')) return;
    const start = s.startDate || s.date || s.scheduledDate;
    const end = s.endDate || s.completedAt || s.completedDate;
    if (start && end && Math.abs(daysBetween(start, end)) < 1) {
      out.push({
        id: `fast-sch-${str(s.id) || i}`,
        type: 'Fast Completion',
        level: 'med',
        text: `${scheduleClient(s) || 'Unknown client'} — ${str(s.auditType) || 'audit'} started and closed on the same day (${str(start).slice(0, 10)}); check the audit-duration justification.`,
      });
    }
  });
  reports.forEach((r, i) => {
    const auditDay = r.auditDate || r.date;
    if (auditDay && r.submittedAt && Math.abs(daysBetween(auditDay, r.submittedAt)) < 1) {
      out.push({
        id: `fast-rpt-${str(r.id) || i}`,
        type: 'Fast Completion',
        level: 'info',
        text: `${str(r.client) || 'Unknown client'} — final report submitted on the same day the audit ran (${str(auditDay).slice(0, 10)}).`,
      });
    }
  });

  // 4. Auditee approval missing on completed audits
  schedules.forEach((s, i) => {
    if (!lower(s.status).includes('complet')) return;
    if (s.auditeeApproval !== 'Approved') {
      out.push({
        id: `appr-${str(s.id) || i}`,
        type: 'Approval Gap',
        level: 'high',
        text: `${scheduleClient(s) || 'Unknown client'} — audit marked completed (${scheduleWhen(s) || 'n/a'}) without auditee approval on record.`,
      });
    }
  });

  const order: Record<ChipLevel, number> = { high: 0, med: 1, low: 2, info: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
};

export const anomaliesClaudePrompt = (anomalies: AssignmentAnomaly[]): string =>
  'You are a certification-body quality manager. Summarise the following audit-assignment ' +
  'anomalies into a short paragraph (max 100 words) that groups them by theme and states the ' +
  'single most urgent follow-up. Keep facts accurate. Return only the paragraph.\n\n' +
  anomalies.slice(0, 12).map((a) => `- [${a.type}] ${a.text}`).join('\n');

/* ═════════════════════════════════════════════════════════════════
   Executive Dashboard AI — KPI dashboard for management review.
   7 metric groups, each metric with current value, target, trend,
   RAG status and an insight, plus actionable recommendations.
   All values derive from live stores; financial figures use a stated
   revenue-proxy assumption (average certification fee per audit).
   ═════════════════════════════════════════════════════════════════ */
export interface KpiMetric {
  name: string;
  current: string;
  target: string;
  trend: 'up' | 'down' | 'stable';
  status: 'Green' | 'Yellow' | 'Red';
  insight: string;
}
export interface KpiSection { title: string; metrics: KpiMetric[]; }
export interface KpiDashboard { sections: KpiSection[]; actions: string[]; assumption: string; }

const AVG_FEE = 4500;   // USD revenue proxy per completed audit (stated assumption)
const AVG_COST = 2600;  // USD delivery-cost proxy per audit

export const buildKpiDashboard = (): KpiDashboard => {
  const arr = (k: string): any[] => {
    try { const r = localStorage.getItem(k); const v = r ? JSON.parse(r) : []; return Array.isArray(v) ? v.filter((x) => x != null) : []; } catch { return []; }
  };
  const schedules = [...arr('cms_audit_schedules'), ...arr('cms_audit_schedules_v3')];
  const certs = [...arr('cms_certificates'), ...arr('cms_audit_certifications')];
  const actions = arr('cms_corrective_actions_v1');
  const auditors = arr('cms_auditors');
  const enquiries = arr('cms_client_enquiries_v1');
  const clients = arr('cms_client_registrations');
  const today = new Date().toISOString().slice(0, 10);

  /* 1 ─ Audit pipeline */
  const inProgress = schedules.filter((s) => !/completed|cancelled/i.test(s.status || '')).length;
  const onTrack = schedules.filter((s) => !s.date || s.date >= today || /completed|approved/i.test(s.status || '')).length;
  const onTrackPct = schedules.length ? Math.round((onTrack / schedules.length) * 100) : 100;

  /* 2 ─ Financial (revenue proxy) */
  const completed = certs.length;
  const revenue = completed * AVG_FEE;
  const cost = completed * AVG_COST;
  const margin = revenue ? Math.round(((revenue - cost) / revenue) * 100) : 0;

  /* 3 ─ Quality */
  const closed = actions.filter((a) => a.status === 'Approved').length;
  const closureRate = actions.length ? Math.round((closed / actions.length) * 100) : 100;
  const repeatClients = clients.filter((c) =>
    certs.filter((x) => (x.client || x.clientName || '').toLowerCase() === (c.organizationName || '').toLowerCase()).length > 1).length;
  const repeatRate = clients.length ? Math.round((repeatClients / clients.length) * 100) : 0;

  /* 4 ─ Team */
  const activeAud = auditors.filter((a) => a.status === 'Active').length || auditors.length;
  const assigned = new Set(schedules.flatMap((s) => [s.auditor, s.leadAuditor]).filter(Boolean)).size;
  const utilization = activeAud ? Math.round((Math.min(assigned, activeAud) / activeAud) * 100) : 0;
  const avgRating = auditors.length
    ? (auditors.reduce((sum, a) => sum + (Array.isArray(a.ratings) && a.ratings.length ? a.ratings.reduce((x: number, y: number) => x + y, 0) / a.ratings.length : 3.8), 0) / auditors.length)
    : 0;

  /* 5 ─ Growth */
  const yearNow = new Date().getFullYear();
  const certsThisYear = certs.filter((c) => String(c.certificateDate || c.issuedDate || '').startsWith(String(yearNow))).length;
  const certsLastYear = certs.filter((c) => String(c.certificateDate || c.issuedDate || '').startsWith(String(yearNow - 1))).length;
  const yoy = certsLastYear ? Math.round(((certsThisYear - certsLastYear) / certsLastYear) * 100) : (certsThisYear ? 100 : 0);
  const pipeline = enquiries.filter((e) => ['New', 'Contacted', 'Qualified'].includes(e.status)).length;

  /* 6 ─ Risk */
  const overdue = actions.filter((a) => a.status !== 'Approved' && a.dueDate && a.dueDate < today).length;
  const delayed = schedules.filter((s) => s.date && s.date < today && !/completed|approved/i.test(s.status || '')).length;

  /* 7 ─ Forecast */
  const nextQ = Math.max(1, Math.round(certsThisYear / 4 + pipeline * 0.4));

  const M = (name: string, current: string, target: string, good: boolean, warn: boolean, trend: KpiMetric['trend'], insight: string): KpiMetric =>
    ({ name, current, target, trend, status: good ? 'Green' : warn ? 'Yellow' : 'Red', insight });

  const sections: KpiSection[] = [
    { title: '1 · Audit Pipeline', metrics: [
      M('Audits in progress', String(inProgress), '—', inProgress > 0, true, 'stable', `${schedules.length} total scheduled engagements.`),
      M('On-track %', `${onTrackPct}%`, '≥ 85%', onTrackPct >= 85, onTrackPct >= 70, onTrackPct >= 85 ? 'up' : 'down', onTrackPct >= 85 ? 'Pipeline healthy.' : 'Slippage detected — review delayed engagements.'),
    ]},
    { title: '2 · Financial (proxy)', metrics: [
      M('Revenue YTD', `$${revenue.toLocaleString()}`, `$${(Math.max(completed, 10) * AVG_FEE).toLocaleString()}`, revenue > 0, true, revenue > 0 ? 'up' : 'stable', `${completed} certified audits × $${AVG_FEE} average fee.`),
      M('Margin', `${margin}%`, '≥ 35%', margin >= 35, margin >= 25, 'stable', `Cost proxy $${AVG_COST}/audit.`),
      M('Cost per audit', `$${AVG_COST.toLocaleString()}`, `$${AVG_COST.toLocaleString()}`, true, true, 'stable', 'Benchmark assumption — refine with actuals.'),
    ]},
    { title: '3 · Quality', metrics: [
      M('CAP closure rate', `${closureRate}%`, '≥ 80%', closureRate >= 80, closureRate >= 60, closureRate >= 80 ? 'up' : 'down', `${closed}/${actions.length} corrective actions closed.`),
      M('Repeat business', `${repeatRate}%`, '≥ 40%', repeatRate >= 40, repeatRate >= 20, 'stable', `${repeatClients} client(s) hold multiple certificates.`),
    ]},
    { title: '4 · Team', metrics: [
      M('Auditor utilisation', `${utilization}%`, '70–90%', utilization >= 70 && utilization <= 90, utilization >= 50, utilization > 90 ? 'up' : 'stable', utilization > 90 ? 'Over-utilised — burnout risk.' : `${assigned}/${activeAud} auditors carrying assignments.`),
      M('Avg performance rating', avgRating.toFixed(1), '≥ 4.0', avgRating >= 4, avgRating >= 3.5, 'stable', 'From auditor rating history.'),
    ]},
    { title: '5 · Growth', metrics: [
      M('YoY certifications', `${yoy >= 0 ? '+' : ''}${yoy}%`, '≥ +10%', yoy >= 10, yoy >= 0, yoy > 0 ? 'up' : yoy < 0 ? 'down' : 'stable', `${certsThisYear} this year vs ${certsLastYear} last year.`),
      M('Active pipeline', String(pipeline), '≥ 5', pipeline >= 5, pipeline >= 2, pipeline >= 5 ? 'up' : 'stable', `${enquiries.length} total enquiries captured.`),
    ]},
    { title: '6 · Risk Indicators', metrics: [
      M('Delayed audits', String(delayed), '0', delayed === 0, delayed <= 2, delayed ? 'down' : 'stable', delayed ? 'Reschedule or escalate delayed engagements.' : 'No schedule slippage.'),
      M('Overdue actions', String(overdue), '0', overdue === 0, overdue <= 2, overdue ? 'down' : 'stable', overdue ? 'Client follow-up required this week.' : 'CAP discipline holding.'),
    ]},
    { title: '7 · Forecast', metrics: [
      M('Next-quarter certifications', `~${nextQ}`, '—', true, true, pipeline > 2 ? 'up' : 'stable', `Run-rate + ${pipeline} pipeline enquiries at 40% conversion.`),
    ]},
  ];

  const actionsOut: string[] = [];
  if (onTrackPct < 85) actionsOut.push('Review delayed engagements in Audit Schedules and re-sequence the calendar.');
  if (overdue > 0) actionsOut.push(`Chase ${overdue} overdue corrective action(s) — churn risk grows with every overdue week.`);
  if (utilization > 90) actionsOut.push('Utilisation above 90% — approve pending auditor requests to add capacity.');
  if (utilization < 50) actionsOut.push('Utilisation under 50% — accelerate pipeline conversion or rebalance the bench.');
  if (yoy < 0) actionsOut.push('Certifications trending below last year — prioritise enquiry follow-ups this month.');
  if (repeatRate < 40) actionsOut.push('Repeat-business below benchmark — launch surveillance-audit outreach to certified clients.');
  if (actionsOut.length === 0) actionsOut.push('All KPI groups within target — maintain cadence and review again next week.');

  return { sections, actions: actionsOut, assumption: `Financial figures are proxies: $${AVG_FEE} avg fee and $${AVG_COST} avg delivery cost per audit. Replace with actuals when finance data is connected.` };
};
