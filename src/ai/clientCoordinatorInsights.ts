/**
 * clientCoordinatorInsights.ts — heuristic AI insight builders for the
 * Client Coordinator role.
 *
 * All builders work with NO API key: everything is computed locally.
 * Certification rows come from the CC org-scoped data layer (passed in by
 * the page), while the Report Q&A searches the global liveData stores.
 * Pages re-run the builders on onCmsChange / realtime-scope refreshes.
 * `*ClaudePrompt` helpers let pages optionally enhance output via
 * claudeComplete when a key is configured.
 *
 * Features:
 *   18. buildComplianceCalendar — crunch windows + copyable reminder nudges
 *   19. buildSiteDigest         — per-site / per-certificate status digest
 *   20. answerReportQuestion    — keyword Q&A over reports/findings/actions
 */
import {
  getReports,
  getFindings,
  getCorrectiveActions,
  daysFromNow,
} from './liveData';

export type ChipLevel = 'high' | 'med' | 'low' | 'info';

const str = (v: unknown): string => (v == null ? '' : String(v));

/* ======================================================================
   18. COMPLIANCE CALENDAR COPILOT — Due Date Tracker page
====================================================================== */
export type ComplianceEventType = 'Certificate Expiry' | 'Surveillance' | 'Recertification';

export interface ComplianceEvent {
  id: string;
  type: ComplianceEventType;
  standard: string;
  certNumber: string;
  branch: string;
  date: string;
  /** Days from today (negative = overdue). */
  days: number;
  /** Ready-to-copy reminder text. */
  nudge: string;
}

export interface CrunchWindow {
  month: string;   // YYYY-MM
  label: string;   // e.g. "September 2026"
  events: ComplianceEvent[];
}

const monthLabel = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

export const buildComplianceCalendar = (
  certs: any[],
  branchNameOf: (branchId?: number) => string = () => 'Head Office'
): { windows: CrunchWindow[]; reminders: ComplianceEvent[]; total: number } => {
  const events: ComplianceEvent[] = [];
  const seen = new Set<string>();

  const push = (type: ComplianceEventType, c: any, date?: string) => {
    if (!date) return;
    const days = daysFromNow(date);
    if (days < -30 || days > 365) return; // 12-month working horizon
    const branch = branchNameOf(c.branchId);
    const certNumber = str(c.certNumber || c.certificateNumber || '—');
    const standard = str(c.standard || 'Certification');
    const id = `${type}-${certNumber}-${date}`;
    if (seen.has(id)) return;
    seen.add(id);
    const nudge = days < 0
      ? `URGENT: the ${type.toLowerCase()} for ${standard} (${certNumber}, ${branch}) was due on ${date} — ${Math.abs(days)} day(s) ago. Please contact the certification body today to arrange the audit and avoid a certificate lapse.`
      : `Reminder: ${type.toLowerCase()} for ${standard} (${certNumber}, ${branch}) is due on ${date} — ${days} day(s) from now. Please confirm the audit booking and start preparing the required documentation.`;
    events.push({ id, type, standard, certNumber, branch, date, days, nudge });
  };

  certs.forEach((c) => {
    push('Certificate Expiry', c, c.expiryDate || c.expirationDate);
    push('Surveillance', c, c.surveillance1Due);
    push('Surveillance', c, c.surveillance2Due);
    push('Recertification', c, c.recertificationDue || c.recertificationDueDate);
  });
  events.sort((a, b) => a.days - b.days);

  // Crunch windows: calendar months with >= 2 upcoming events
  const byMonth = new Map<string, ComplianceEvent[]>();
  events.filter((e) => e.days >= 0).forEach((e) => {
    const key = e.date.slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) || []), e]);
  });
  const windows: CrunchWindow[] = Array.from(byMonth.entries())
    .filter(([, evs]) => evs.length >= 2)
    .map(([month, evs]) => ({ month, label: monthLabel(evs[0].date), events: evs }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Every event within 90 days (incl. overdue) gets a copyable nudge
  const reminders = events.filter((e) => e.days <= 90);

  return { windows, reminders, total: events.length };
};

export const calendarClaudePrompt = (windows: CrunchWindow[], reminders: ComplianceEvent[]): string =>
  'You are a compliance-calendar assistant for a certified organization. Using the data below, ' +
  'write a short plan (max 110 words) that names the busiest months, what stacks up in them, and ' +
  'the first two bookings to make. Keep dates and counts accurate. Return only the paragraph.\n\n' +
  'CRUNCH MONTHS:\n' +
  (windows.map((w) => `- ${w.label}: ${w.events.length} events (${w.events.map((e) => e.type).join(', ')})`).join('\n') || '- none') +
  '\n\nNEXT 90 DAYS:\n' +
  (reminders.slice(0, 8).map((r) => `- ${r.date}: ${r.type} · ${r.standard} (${r.branch})`).join('\n') || '- none');

/* ======================================================================
   19. MULTI-SITE STATUS DIGEST — Organization view
====================================================================== */
export interface SiteDigestEntry {
  branch: string;
  standard: string;
  certNumber: string;
  status: string;
  days: number;
  atRisk: boolean;
  level: ChipLevel;
  sentence: string;
}

export interface SiteDigest {
  entries: SiteDigestEntry[];
  summary: string;
  openActions: number;
}

export const buildSiteDigest = (
  certs: any[],
  branchNameOf: (branchId?: number) => string = () => 'Head Office',
  orgName?: string
): SiteDigest => {
  const openActions = orgName
    ? getCorrectiveActions().filter(
        (c) => str(c.clientName) === orgName &&
          !['approved', 'closed'].includes(str(c.status).toLowerCase())
      ).length
    : 0;

  const entries: SiteDigestEntry[] = certs
    .map((c) => {
      const expiry = str(c.expiryDate || c.expirationDate || '');
      const days = expiry ? daysFromNow(expiry) : 9999;
      const status = str(c.status || (days < 0 ? 'Expired' : days <= 30 ? 'Expiring Soon' : 'Active'));
      const branch = branchNameOf(c.branchId);
      const certNumber = str(c.certNumber || c.certificateNumber || '—');
      const standard = str(c.standard || 'Certification');
      const surveillanceOverdue = !!(c.surveillance1Due && daysFromNow(c.surveillance1Due) < 0);
      const atRisk = days < 60 || surveillanceOverdue || status.toLowerCase() !== 'active';
      const reason = days < 0
        ? `the certificate expired ${Math.abs(days)} day(s) ago`
        : days < 60
          ? `only ${days} day(s) remain before expiry`
          : surveillanceOverdue
            ? 'its surveillance due date has already passed'
            : `its status is "${status}"`;
      const sentence = atRisk
        ? `${branch} — ${standard} (${certNumber}) is at risk because ${reason}. Prioritise this site when planning the next audit cycle.`
        : `${branch} — ${standard} (${certNumber}) is ${status.toLowerCase()} with ${days} day(s) to expiry. No action needed right now.`;
      return {
        branch,
        standard,
        certNumber,
        status,
        days,
        atRisk,
        level: (days < 0 ? 'high' : atRisk ? 'med' : 'low') as ChipLevel,
        sentence,
      };
    })
    .sort((a, b) => a.days - b.days);

  const risky = entries.filter((e) => e.atRisk).length;
  const sites = new Set(entries.map((e) => e.branch)).size;
  const summary = entries.length === 0
    ? 'No certificates found for this organization yet — the digest will populate as certificates are issued.'
    : `${entries.length} certificate(s) across ${sites} site(s): ${risky} need attention, ${entries.length - risky} healthy.` +
      (openActions ? ` ${openActions} corrective action(s) remain open organization-wide.` : '');

  return { entries, summary, openActions };
};

export const digestClaudePrompt = (digest: SiteDigest): string =>
  'You are a multi-site compliance coordinator. Rewrite the following site digest as one flowing ' +
  'status update paragraph (max 110 words) suitable for a weekly ops email: lead with overall health, ' +
  'call out the at-risk sites and why, and close with the recommended next step. Keep every fact ' +
  'accurate. Return only the paragraph.\n\n' +
  `OVERVIEW: ${digest.summary}\n` +
  digest.entries.slice(0, 10).map((e) => `- ${e.sentence}`).join('\n');

/* ======================================================================
   20. REPORT Q&A — Audit Reports page
====================================================================== */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'for', 'to', 'is', 'are', 'was', 'were',
  'what', 'which', 'who', 'how', 'when', 'where', 'why', 'did', 'does', 'do', 'with', 'at',
  'by', 'be', 'been', 'has', 'have', 'had', 'any', 'all', 'show', 'me', 'list', 'about',
  'that', 'this', 'it', 'its', 'our', 'my', 'we', 'you', 'your', 'tell', 'give', 'find',
  'there', 'from', 'audits',
]);

export interface QAMatch {
  source: 'Report' | 'Finding' | 'Corrective Action';
  client: string;
  date: string;
  title: string;
  snippet: string;
  score: number;
}

export interface QAResult {
  answer: string;
  matches: QAMatch[];
  tokens: string[];
}

const tokenize = (q: string): string[] =>
  Array.from(new Set(
    q.toLowerCase().split(/[^a-z0-9:]+/).filter((t) => t.length > 2 && !STOPWORDS.has(t))
  ));

const snippetFor = (text: string, tokens: string[]): string => {
  const low = text.toLowerCase();
  let idx = -1;
  for (const t of tokens) {
    const i = low.indexOf(t);
    if (i >= 0) { idx = i; break; }
  }
  if (idx < 0) return text.slice(0, 140).trim() + (text.length > 140 ? '…' : '');
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + 110);
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
};

export const answerReportQuestion = (question: string): QAResult => {
  const tokens = tokenize(question);
  if (tokens.length === 0) {
    return {
      answer: 'Please ask a more specific question — e.g. "major findings for BritEnergy", "document control issues" or "overdue corrective actions".',
      matches: [],
      tokens,
    };
  }

  interface Candidate { text: string; match: QAMatch; }
  const candidates: Candidate[] = [];

  getReports().forEach((r) => {
    const text = [r.client, r.organizationName, r.standard, r.auditType, r.leadAuditor, r.auditor, r.status, r.summary, r.recommendation]
      .map((s) => str(s)).filter(Boolean).join(' · ');
    candidates.push({
      text,
      match: {
        source: 'Report',
        client: str(r.client || r.organizationName) || '—',
        date: str(r.auditDate || r.date) || '—',
        title: `${str(r.standard) || 'Audit'} · ${str(r.auditType || r.reportType) || 'Report'}`,
        snippet: '',
        score: 0,
      },
    });
  });

  getFindings().forEach((f) => {
    const text = [f.client, f.standard, f.category, f.severity, f.clause, f.department, f.title, f.description, f.recommendation, f.status]
      .map((s: unknown) => str(s)).filter(Boolean).join(' · ');
    candidates.push({
      text,
      match: {
        source: 'Finding',
        client: str(f.client) || '—',
        date: str(f.date) || '—',
        title: `${str(f.category) || 'Finding'} — ${str(f.title) || str(f.clause) || 'untitled'}`,
        snippet: '',
        score: 0,
      },
    });
  });

  getCorrectiveActions().forEach((c) => {
    const text = [c.clientName, c.auditTitle, c.auditType, c.standard, c.severity, c.description, c.rootCause, c.correctivePlan, c.status]
      .map((s: unknown) => str(s)).filter(Boolean).join(' · ');
    candidates.push({
      text,
      match: {
        source: 'Corrective Action',
        client: str(c.clientName) || '—',
        date: str(c.dueDate) || '—',
        title: `${str(c.capId || c.id) || 'CAP'} · ${str(c.severity) || ''} (${str(c.status) || 'Open'})`,
        snippet: '',
        score: 0,
      },
    });
  });

  candidates.forEach((c) => {
    const low = c.text.toLowerCase();
    let score = 0;
    tokens.forEach((t) => {
      if (low.includes(t)) {
        score += 1;
        const repeats = low.split(t).length - 2; // extra occurrences beyond the first
        if (repeats > 0) score += Math.min(2, repeats) * 0.25;
      }
    });
    c.match.score = Math.round(score * 100) / 100;
    c.match.snippet = snippetFor(c.text, tokens);
  });

  const matches = candidates
    .filter((c) => c.match.score > 0)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, 3)
    .map((c) => c.match);

  const answer = matches.length === 0
    ? `No records matched "${question}". Try client names, ISO standards (e.g. ISO 27001), severities (major, minor) or statuses (open, overdue).`
    : `Found ${matches.length} matching record(s) across reports, findings and corrective actions. ` +
      `Best match: ${matches[0].source.toLowerCase()} for ${matches[0].client} (${matches[0].date}) — "${matches[0].snippet}"`;

  return { answer, matches, tokens };
};

export const qaClaudePrompt = (question: string, matches: QAMatch[]): string =>
  'You are an audit-records assistant. Answer the user question using ONLY the matched records ' +
  'below. Cite each record you use as (client, date). If the records do not answer the question, ' +
  'say so plainly. Keep the answer under 120 words.\n\n' +
  `QUESTION: ${question}\n\nMATCHED RECORDS:\n` +
  matches.map((m, i) => `${i + 1}. [${m.source}] ${m.client} · ${m.date} · ${m.title}\n   ${m.snippet}`).join('\n');
