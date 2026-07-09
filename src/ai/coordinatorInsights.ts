/**
 * coordinatorInsights.ts — heuristic AI features for the Audit Coordinator role.
 * ---------------------------------------------------------------------------
 * All functions are pure rule-based helpers over live cms_* data (via liveData)
 * so every panel works with no API key. Claude enhancement is optional.
 *
 *  4. Enquiry auto-triage (standards detection, urgency, win-likelihood, reply drafts)
 *  5. Registration validation (GSTIN / PAN / CIN formats, missing contacts, duplicates)
 *  6. Smart scheduling copilot (reuses auditorMatcher scoring)
 *  7. IAF MD5-style audit-days calculator
 *  8. Email draft assistant (purpose + live client/certificate data)
 */

import {
  getAuditors,
  getSchedules,
  getDispatches,
  getCertificates,
  getClients,
  daysFromNow,
  claudeComplete,
  isClaudeConfigured,
} from './liveData';
import { matchAuditors } from './auditorMatcher';
import type { AuditorMatch } from './auditorMatcher';

/* ======================================================================
   Feature 4 — Enquiry Auto-Triage
====================================================================== */

const STANDARD_PATTERNS: Array<{ std: string; re: RegExp }> = [
  { std: 'ISO 9001:2015', re: /(9001|quality management|\bqms\b|process improvement)/i },
  { std: 'ISO 14001:2015', re: /(14001|environment|sustainab|emission|waste management)/i },
  { std: 'ISO 45001:2018', re: /(45001|occupational|health (and|&) safety|\bohs\b|workplace safety)/i },
  { std: 'ISO 27001:2022', re: /(27001|information security|cyber ?security|infosec|data protection|privacy)/i },
  { std: 'ISO 22000:2018', re: /(22000|food safety|fssai|haccp|beverage|catering)/i },
  { std: 'ISO 13485:2016', re: /(13485|medical device|diagnostic|pathology|clinical)/i },
  { std: 'ISO 50001:2018', re: /(50001|energy management|solar|energy efficiency)/i },
  { std: 'ISO 42001:2023', re: /(42001|artificial intelligence|\bai governance\b|genai|machine learning)/i },
];

export type TriageLevel = 'High' | 'Med' | 'Low';

export interface EnquiryTriage {
  id: string;
  company: string;
  /** Standards explicitly picked + detected from the message text. */
  detectedStandards: string[];
  urgency: TriageLevel;
  urgencyReasons: string[];
  /** 0..100 heuristic win-likelihood. */
  winScore: number;
  winLevel: TriageLevel;
  winReasons: string[];
}

const parseEmployees = (v: unknown): number => {
  const m = String(v ?? '').match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
};

/** Detect standards from enquiry text plus the explicit standards field. */
export const detectStandards = (enquiry: any): string[] => {
  const out = new Set<string>((enquiry?.standards || []).filter(Boolean));
  const text = `${enquiry?.industry || ''} ${enquiry?.message || ''} ${enquiry?.notes || ''}`;
  for (const { std, re } of STANDARD_PATTERNS) {
    if (re.test(text)) out.add(std);
  }
  return Array.from(out);
};

/** Triage a single enquiry: urgency + win-likelihood with human-readable reasons. */
export const triageEnquiry = (e: any): EnquiryTriage => {
  const text = `${e?.message || ''} ${e?.notes || ''}`;

  // ---- Urgency: keywords + tight timelines + recency ----
  let urgencyScore = 0;
  const urgencyReasons: string[] = [];
  if (/deadline/i.test(text)) { urgencyScore += 2; urgencyReasons.push('Mentions a deadline'); }
  if (/\brfp\b|tender/i.test(text)) { urgencyScore += 2; urgencyReasons.push('RFP / tender requirement'); }
  if (/urgent|asap|immediately/i.test(text)) { urgencyScore += 2; urgencyReasons.push('Marked urgent'); }
  const weeksMatch = text.match(/(\d+)\s*[-–]?\s*(\d+)?\s*weeks?/i);
  const monthsMatch = text.match(/(\d+)\s*months?/i);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1], 10);
    if (!Number.isNaN(weeks) && weeks <= 12) {
      urgencyScore += 2;
      urgencyReasons.push(`Timeline of ~${weeksMatch[2] ? `${weeksMatch[1]}-${weeksMatch[2]}` : weeksMatch[1]} weeks`);
    }
  } else if (monthsMatch && parseInt(monthsMatch[1], 10) <= 3) {
    urgencyScore += 1;
    urgencyReasons.push('Timeline of 3 months or less');
  }
  const ageDays = e?.receivedAt ? -daysFromNow(e.receivedAt) : 999;
  if (ageDays <= 2) { urgencyScore += 1; urgencyReasons.push('Received in the last 48h'); }
  else if (ageDays >= 10 && ageDays < 900 && e?.status === 'New') {
    urgencyScore += 1; urgencyReasons.push(`Still New after ${ageDays} days — going stale`);
  }
  const urgency: TriageLevel = urgencyScore >= 4 ? 'High' : urgencyScore >= 2 ? 'Med' : 'Low';
  if (urgencyReasons.length === 0) urgencyReasons.push('No urgency signals in the message');

  // ---- Win likelihood ----
  let win = 0;
  const winReasons: string[] = [];
  const emp = parseEmployees(e?.employees);
  if (emp >= 200) { win += 25; winReasons.push(`Large org (${emp} employees)`); }
  else if (emp >= 50) { win += 18; winReasons.push(`Mid-size org (${emp} employees)`); }
  else if (emp >= 10) { win += 10; winReasons.push(`Small org (${emp} employees)`); }
  else { win += 4; winReasons.push('Employee count unknown / very small'); }

  const stds = detectStandards(e);
  if (stds.length >= 2) { win += 20; winReasons.push(`${stds.length} standards in scope`); }
  else if (stds.length === 1) { win += 12; winReasons.push('One standard identified'); }
  else { winReasons.push('No standard identified yet'); }

  const sourceBoost: Record<string, [number, string]> = {
    Referral: [20, 'Referral lead — highest conversion'],
    'Trade Show': [14, 'Trade-show lead'],
    Website: [10, 'Website enquiry'],
    Email: [8, 'Direct email'],
    Phone: [6, 'Phone enquiry'],
    Other: [4, 'Unclassified source'],
  };
  const [srcPts, srcReason] = sourceBoost[e?.source as string] || [4, 'Unclassified source'];
  win += srcPts;
  winReasons.push(srcReason);

  let completeness = 0;
  if (e?.contactEmail) completeness += 6;
  if (e?.contactPhone) completeness += 4;
  if (e?.website) completeness += 5;
  if (e?.industry) completeness += 5;
  if (e?.country) completeness += 3;
  if ((e?.message || '').length > 80) completeness += 7;
  win += completeness;
  winReasons.push(`Profile ${completeness >= 22 ? 'complete' : completeness >= 12 ? 'partly complete' : 'sparse'} (+${completeness})`);

  const winScore = Math.max(0, Math.min(100, win));
  const winLevel: TriageLevel = winScore >= 65 ? 'High' : winScore >= 40 ? 'Med' : 'Low';

  return {
    id: String(e?.id ?? ''),
    company: e?.company || 'Unknown company',
    detectedStandards: stds,
    urgency,
    urgencyReasons,
    winScore,
    winLevel,
    winReasons,
  };
};

/** Draft a qualification reply email for an enquiry (plain text, copyable). */
export const draftEnquiryReply = (e: any): string => {
  const stds = detectStandards(e);
  const stdLine = stds.length ? stds.join(', ') : 'the ISO standard best suited to your operations';
  const name = e?.contactName || 'there';
  return [
    `Subject: ${e?.company || 'Your organisation'} — ${stds[0] ? stds[0].split(':')[0] : 'ISO'} certification enquiry`,
    '',
    `Dear ${name},`,
    '',
    `Thank you for reaching out to us regarding certification for ${e?.company || 'your organisation'}.`,
    `Based on your enquiry, we understand you are interested in ${stdLine}.`,
    '',
    'To prepare an accurate proposal and audit-day estimate, could you please confirm:',
    `  1. Total number of employees${e?.employees ? ` (you mentioned ~${e.employees})` : ''} and number of sites/locations.`,
    '  2. A short description of your scope of operations (products / services).',
    '  3. Whether this is an initial certification, a transfer from another body, or a recertification.',
    '  4. Any target date or external deadline we should plan around.',
    '',
    'Our typical next steps:',
    '  - We send you a short digital application form.',
    '  - We prepare a quotation with the recommended audit duration.',
    '  - On acceptance, we schedule the Stage 1 (readiness) audit.',
    '',
    'We would be happy to arrange a brief call this week to walk through the process.',
    '',
    'Best regards,',
    'Audit Coordinator',
    'Qmics Certification',
  ].join('\n');
};

/* ======================================================================
   Feature 5 — Application validation & duplicate detection
====================================================================== */

export type IssueSeverity = 'high' | 'med' | 'low';

export interface RegistrationIssue {
  clientId: number | string;
  organization: string;
  severity: IssueSeverity;
  field: string;
  reason: string;
}

// GSTIN: 15 chars — 2-digit state code + 10-char PAN + entity code + 'Z' + checksum.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
// PAN: AAAAA9999A
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
// CIN: 21 chars — L/U + 5-digit industry + 2-letter state + 4-digit year + 3-letter type + 6-digit number.
const CIN_RE = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;

const norm = (s: unknown): string => String(s ?? '').trim().toLowerCase();

const SEV_RANK: Record<IssueSeverity, number> = { high: 0, med: 1, low: 2 };

/**
 * Validate current registrations: statutory ID formats, missing contact data,
 * and duplicates across registrations + application dispatches.
 * Returns a ranked issue list (high severity first).
 */
export const validateRegistrations = (
  clients: any[] = getClients(),
  dispatches: any[] = getDispatches()
): RegistrationIssue[] => {
  const issues: RegistrationIssue[] = [];

  const push = (c: any, severity: IssueSeverity, field: string, reason: string) =>
    issues.push({
      clientId: c?.id ?? '?',
      organization: c?.organizationName || c?.organization || 'Unknown org',
      severity,
      field,
      reason,
    });

  // Index for duplicate detection across registrations AND dispatches.
  const seenName = new Map<string, string[]>();
  const seenEmail = new Map<string, string[]>();
  const seenGstin = new Map<string, string[]>();
  const addKey = (map: Map<string, string[]>, key: string, label: string) => {
    if (!key) return;
    const arr = map.get(key) || [];
    arr.push(label);
    map.set(key, arr);
  };
  for (const c of clients) {
    addKey(seenName, norm(c?.organizationName), `registration ${c?.clientCode || c?.id}`);
    addKey(seenEmail, norm(c?.email), `registration ${c?.clientCode || c?.id}`);
    addKey(seenGstin, norm(c?.gstin), `registration ${c?.clientCode || c?.id}`);
  }
  for (const d of dispatches) {
    addKey(seenName, norm(d?.organization), `dispatch #${d?.id}`);
    addKey(seenEmail, norm(d?.email), `dispatch #${d?.id}`);
  }

  for (const c of clients) {
    const gstin = String(c?.gstin || '').toUpperCase().trim();
    const pan = String(c?.pan || '').toUpperCase().trim();
    const cin = String(c?.cin || '').toUpperCase().trim();

    // ---- Format checks ----
    if (gstin && !GSTIN_RE.test(gstin)) {
      push(c, 'high', 'GSTIN',
        gstin.length !== 15
          ? `GSTIN "${gstin}" is ${gstin.length} chars — must be exactly 15 (2-digit state + PAN + 3).`
          : `GSTIN "${gstin}" does not match the 2-digits + PAN-pattern + entity/Z/checksum format.`);
    }
    if (pan && !PAN_RE.test(pan)) {
      push(c, 'high', 'PAN', `PAN "${pan}" must match AAAAA9999A (5 letters, 4 digits, 1 letter).`);
    }
    if (cin && !CIN_RE.test(cin)) {
      push(c, 'high', 'CIN',
        cin.length !== 21
          ? `CIN "${cin}" is ${cin.length} chars — must be exactly 21 starting with L or U.`
          : `CIN "${cin}" does not match the L/U + industry + state + year + type + number pattern.`);
    }
    // Cross-check: GSTIN chars 3-12 embed the PAN.
    if (gstin && pan && GSTIN_RE.test(gstin) && PAN_RE.test(pan) && gstin.slice(2, 12) !== pan) {
      push(c, 'high', 'GSTIN/PAN', `GSTIN embeds PAN ${gstin.slice(2, 12)} but the PAN on file is ${pan} — one of them is wrong.`);
    }

    // ---- Missing contact data ----
    if (!c?.email) push(c, 'med', 'Email', 'No email on file — registration cannot be submitted to the client.');
    if (!c?.contactPerson) push(c, 'med', 'Contact', 'No contact person recorded.');
    if (!c?.phone) push(c, 'low', 'Phone', 'No phone number — harder to chase confirmations.');
    if (!gstin && !pan && !cin) push(c, 'low', 'Statutory IDs', 'No GSTIN / PAN / CIN captured — needed for the contract.');

    // ---- Duplicates ----
    const label = `registration ${c?.clientCode || c?.id}`;
    const nameHits = (seenName.get(norm(c?.organizationName)) || []).filter((l) => l !== label);
    if (norm(c?.organizationName) && nameHits.length > 0) {
      push(c, 'high', 'Duplicate', `Same organisation name also appears in ${nameHits.slice(0, 2).join(', ')}${nameHits.length > 2 ? '…' : ''}.`);
    }
    const emailHits = (seenEmail.get(norm(c?.email)) || []).filter((l) => l !== label);
    if (norm(c?.email) && emailHits.length > 0) {
      push(c, 'high', 'Duplicate', `Email ${c.email} is also used by ${emailHits.slice(0, 2).join(', ')}${emailHits.length > 2 ? '…' : ''}.`);
    }
    const gstinHits = (seenGstin.get(norm(gstin)) || []).filter((l) => l !== label);
    if (norm(gstin) && gstinHits.length > 0) {
      push(c, 'high', 'Duplicate', `GSTIN ${gstin} is also on ${gstinHits.slice(0, 2).join(', ')}${gstinHits.length > 2 ? '…' : ''}.`);
    }
  }

  return issues.sort(
    (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.organization.localeCompare(b.organization)
  );
};

/* ======================================================================
   Feature 6 — Smart Scheduling Copilot (reuses auditorMatcher)
====================================================================== */

export type { AuditorMatch } from './auditorMatcher';

export interface CopilotContext {
  standard?: string;
  location?: string;
  sector?: string;
  date?: string;
}

/** Top-N auditor suggestions for one schedule/request record, using live data. */
export const suggestAuditorsFor = (ctx: CopilotContext, limit = 3): AuditorMatch[] => {
  const auditors = getAuditors();
  const schedules = getSchedules();
  return matchAuditors(
    auditors as any,
    {
      standard: ctx.standard,
      location: ctx.location,
      sector: ctx.sector,
      proposedDate: ctx.date,
      role: 'lead',
    },
    schedules as any,
    limit
  );
};

/** One-line plain-language note explaining why the top pick wins. */
export const topPickNote = (matches: AuditorMatch[]): string => {
  if (!matches.length) return 'No auditors found — add auditors under Auditor Profiles.';
  const top = matches[0];
  const why = top.reasons.slice(0, 3).join(', ') || 'best overall score';
  const caveat = top.warnings.length ? ` Watch out: ${top.warnings[0].toLowerCase()}.` : '';
  const runnerUp = matches[1]
    ? ` ${matches[1].auditor.name} is the backup (${matches[1].score.toFixed(1)} vs ${top.score.toFixed(1)}).`
    : '';
  return `${top.auditor.name} leads because: ${why}.${caveat}${runnerUp}`;
};

/* ======================================================================
   Feature 7 — IAF MD5-style Audit-Days Calculator
====================================================================== */

export type AuditStage = 'initial' | 'surveillance' | 'recert';

export interface AuditDaysResult {
  /** Base initial-audit days from the man-day table. */
  baseDays: number;
  /** Base after the stage multiplier (surveillance 1/3, recert 2/3). */
  stageDays: number;
  /** Extra days for additional sites (+0.5 each). */
  siteExtra: number;
  /** Recommended total. */
  totalDays: number;
  tierLabel: string;
  notes: string[];
}

// QMS/EMS man-day tiers: [minEmployees, maxEmployees, initial audit days]
const MANDAY_TIERS: Array<[number, number, number]> = [
  [1, 5, 1.5],
  [6, 25, 2],
  [26, 45, 3],
  [46, 65, 4],
  [66, 85, 5],
  [86, 125, 6],
  [126, 175, 7],
  [176, 275, 8],
  [276, 425, 9],
  [426, 625, 10],
];

const roundHalf = (n: number): number => Math.max(0.5, Math.round(n * 2) / 2);

export const calcAuditDays = (
  employees: number,
  sites: number,
  standard: string,
  stage: AuditStage
): AuditDaysResult => {
  const emp = Math.max(1, Math.floor(employees || 1));
  const siteCount = Math.max(1, Math.floor(sites || 1));
  const notes: string[] = [];

  let baseDays: number;
  let tierLabel: string;
  const tier = MANDAY_TIERS.find(([lo, hi]) => emp >= lo && emp <= hi);
  if (tier) {
    baseDays = tier[2];
    tierLabel = `${tier[0]}–${tier[1]} employees → ${tier[2]} days (initial)`;
  } else {
    // Above 625 — extrapolate conservatively (+1 day per additional ~250 staff).
    baseDays = 10 + Math.ceil((emp - 625) / 250);
    tierLabel = `>625 employees → extrapolated ${baseDays} days (initial)`;
    notes.push('Above the standard table — extrapolated at +1 day per additional 250 employees. Verify against IAF MD5.');
  }

  const mult = stage === 'surveillance' ? 1 / 3 : stage === 'recert' ? 2 / 3 : 1;
  const stageDays = roundHalf(baseDays * mult);
  if (stage === 'surveillance') notes.push('Surveillance visit = 1/3 of the initial audit duration.');
  if (stage === 'recert') notes.push('Recertification = 2/3 of the initial audit duration.');

  const siteExtra = (siteCount - 1) * 0.5;
  if (siteCount > 1) notes.push(`${siteCount - 1} additional site${siteCount > 2 ? 's' : ''} adds ${siteExtra} day${siteExtra !== 1 ? 's' : ''} (+0.5 each).`);

  if (/14001|45001/.test(standard || '')) {
    notes.push('EMS/OHS audits often need extra time for site/aspect complexity — treat this as a floor.');
  }

  return {
    baseDays,
    stageDays,
    siteExtra,
    totalDays: roundHalf(stageDays + siteExtra),
    tierLabel,
    notes,
  };
};

/* ======================================================================
   Feature 8 — Email Draft Assistant
====================================================================== */

export type EmailPurpose = 'dispatch' | 'reminder' | 'certificate' | 'surveillance';

export const EMAIL_PURPOSES: Array<{ id: EmailPurpose; label: string }> = [
  { id: 'dispatch', label: 'Application dispatch' },
  { id: 'reminder', label: 'Audit reminder' },
  { id: 'certificate', label: 'Certificate delivery' },
  { id: 'surveillance', label: 'Surveillance due' },
];

export interface EmailDraft {
  subject: string;
  body: string;
  /** Data points pulled from live records, shown as context chips. */
  usedData: string[];
}

const fmtDate = (d?: string): string => {
  if (!d) return 'TBC';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const findCertFor = (org: string): any | undefined => {
  const n = norm(org);
  return getCertificates().find(
    (c: any) => norm(c?.organizationName) === n || norm(c?.clientId) === n || norm(c?.client) === n
  );
};

const findUpcomingScheduleFor = (org: string): any | undefined => {
  const n = norm(org);
  return getSchedules()
    .filter((s: any) => norm(s?.organization) === n && (s?.date || s?.scheduledDate))
    .sort((a: any, b: any) => String(a.date || a.scheduledDate).localeCompare(String(b.date || b.scheduledDate)))
    .find((s: any) => daysFromNow(s.date || s.scheduledDate) >= -1);
};

/** Build a polished plain-text email from live client / certificate / schedule data. */
export const buildEmailDraft = (purpose: EmailPurpose, client: any): EmailDraft => {
  const org = client?.organizationName || client?.organization || 'your organisation';
  const contact = client?.contactPerson || client?.contactName || 'Sir/Madam';
  const standard = client?.standard || 'your certification standard';
  const code = client?.clientCode ? ` (Client Code: ${client.clientCode})` : '';
  const usedData: string[] = [`Client: ${org}`, `Contact: ${contact}`, `Standard: ${standard}`];

  const signature = ['Best regards,', 'Audit Coordinator', 'Qmics Certification'].join('\n');

  if (purpose === 'dispatch') {
    return {
      subject: `Application for Certification — ${org}`,
      usedData,
      body: [
        `Dear ${contact},`,
        '',
        `Thank you for choosing Qmics Certification for ${org}${code}.`,
        `Please find attached the digital Application for Certification covering ${standard} (${client?.clientType || 'Initial Certification'}).`,
        '',
        'Kindly complete and return the form at your earliest convenience. You can also fill it directly in your Auditee portal under "Pending Applications".',
        '',
        'Once received, we will confirm the scope, issue the quotation with the recommended audit duration, and propose Stage 1 dates.',
        '',
        signature,
      ].join('\n'),
    };
  }

  if (purpose === 'reminder') {
    const sched = findUpcomingScheduleFor(org);
    if (sched) {
      usedData.push(`Audit: ${sched.auditType || 'Audit'} on ${fmtDate(sched.date || sched.scheduledDate)}`);
      if (sched.leadAuditor) usedData.push(`Lead: ${sched.leadAuditor}`);
    }
    return {
      subject: `Reminder: ${sched?.auditType || 'audit'} for ${org} on ${fmtDate(sched?.date || sched?.scheduledDate)}`,
      usedData,
      body: [
        `Dear ${contact},`,
        '',
        `This is a friendly reminder of the upcoming ${sched?.auditType ? sched.auditType + ' ' : ''}audit for ${org}${code}.`,
        '',
        `  Audit date:      ${fmtDate(sched?.date || sched?.scheduledDate)}`,
        `  Standard:        ${sched?.certificationStandard || standard}`,
        `  Lead auditor:    ${sched?.leadAuditor || 'To be confirmed'}`,
        `  Team member:     ${sched?.auditor || 'To be confirmed'}`,
        `  Location:        ${sched?.location || 'As per the audit plan'}`,
        '',
        'Please ensure the management representative, relevant process owners, and documented information are available on the day. The detailed audit plan is attached for reference.',
        '',
        signature,
      ].join('\n'),
    };
  }

  if (purpose === 'certificate') {
    const cert = findCertFor(org);
    if (cert) {
      usedData.push(`Certificate: ${cert.certificateNumber || cert.id}`);
      if (cert.expiryDate || cert.expirationDate) usedData.push(`Expiry: ${fmtDate(cert.expiryDate || cert.expirationDate)}`);
    }
    return {
      subject: `Your ${cert?.standard || standard} certificate — ${org}`,
      usedData,
      body: [
        `Dear ${contact},`,
        '',
        `Congratulations! We are pleased to deliver the certification for ${org}${code}.`,
        '',
        `  Certificate no.: ${cert?.certificateNumber || 'Issued — number on the attached certificate'}`,
        `  Standard:        ${cert?.standard || standard}`,
        `  Issue date:      ${fmtDate(cert?.issueDate || cert?.issuedDate)}`,
        `  Valid until:     ${fmtDate(cert?.expiryDate || cert?.expirationDate)}`,
        '',
        'The certificate and the certification mark usage guidelines are attached. Please remember that continued certification depends on satisfactory surveillance audits — we will contact you ahead of the first surveillance window.',
        '',
        signature,
      ].join('\n'),
    };
  }

  // surveillance
  const cert = findCertFor(org);
  const due = cert?.surveillance1Due || cert?.surveillance2Due || cert?.recertificationDueDate;
  if (cert) {
    usedData.push(`Certificate: ${cert.certificateNumber || cert.id}`);
    if (due) usedData.push(`Surveillance due: ${fmtDate(due)}`);
  }
  return {
    subject: `Surveillance audit due — ${org} (${cert?.standard || standard})`,
    usedData,
    body: [
      `Dear ${contact},`,
      '',
      `As part of maintaining your ${cert?.standard || standard} certification, the next surveillance audit for ${org}${code} is now due${due ? ` by ${fmtDate(due)}` : ''}.`,
      '',
      'To keep your certificate valid, please reply with 2-3 preferred dates in the coming weeks. The surveillance visit typically takes about one third of the initial audit duration.',
      '',
      'We will confirm the auditor and share the audit plan as soon as a date is agreed.',
      '',
      signature,
    ].join('\n'),
  };
};

/* ======================================================================
   Optional Claude enhancement (shared by the panels)
====================================================================== */

/** Ask Claude to polish a heuristic draft. Returns null when unconfigured/failed. */
export const polishDraftWithClaude = async (draft: string, kind: string): Promise<string | null> => {
  if (!isClaudeConfigured()) return null;
  const res = await claudeComplete(
    `Polish the following ${kind} so it reads as a professional, warm, concise business email from a certification body. ` +
      'Keep every factual detail (names, dates, standards, numbers) exactly as given. Do not invent details. ' +
      'Return only the final email text (keep a Subject: line if present).\n\n' +
      draft,
    { system: 'You are an assistant for an ISO certification body audit coordinator.', maxTokens: 800, temperature: 0.4 }
  );
  return res.ok ? res.text : null;
};

export { isClaudeConfigured };
