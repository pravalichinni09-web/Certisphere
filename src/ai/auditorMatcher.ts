/**
 * Smart auditor assignment scorer.
 * ---------------------------------------------------------------------
 * Given an audit context (standard, sector, location, dates) and a list
 * of available auditors, produce a ranked list of recommendations with
 * human-readable reasons. Pure rule-based; no API call required.
 *
 * `refineWithClaude` optionally calls the BYO Claude API to summarize
 * the top picks in plain language.
 */

import { complete as claudeComplete, isClaudeConfigured } from './claudeClient';
import type { Auditor, AuditSchedule } from '../pages/AuditorCoordinator/mockData';

export interface AuditContext {
  /** Standard, e.g. "ISO 9001:2015" or "ISO 27001". */
  standard?: string;
  /** Optional client sector / industry for soft match. */
  sector?: string;
  /** Optional client location for soft match. */
  location?: string;
  /** Proposed audit date (YYYY-MM-DD) — used for workload checks. */
  proposedDate?: string;
  /** Role being assigned: 'lead' or 'auditor'. */
  role?: 'lead' | 'auditor';
}

export interface AuditorMatch {
  auditor: Auditor;
  score: number;
  /** 0..1 normalized score for display. */
  confidence: number;
  reasons: string[];
  warnings: string[];
}

/**
 * Lowercased standard family extraction. "ISO 9001:2015" → "iso 9001".
 */
const standardFamily = (s: string): string => {
  return s.toLowerCase().replace(/[:\-\s]+/g, ' ').replace(/\b(20\d{2})\b/g, '').trim();
};

/**
 * Tokenize a free-text string into lowercased word tokens (length >= 3).
 */
const tokens = (s: string): string[] => {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
};

/**
 * Build a workload map from current schedules: { auditorName: openCount }.
 * "Open" = not Completed.
 */
const buildWorkload = (schedules: AuditSchedule[]): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const s of schedules) {
    if (s.status === 'Completed') continue;
    const names = [s.leadAuditor, s.auditor].filter(Boolean) as string[];
    for (const n of names) {
      m[n] = (m[n] || 0) + 1;
    }
  }
  return m;
};

/**
 * Returns true if the auditor has a clash on the proposed date.
 */
const hasDateClash = (auditor: Auditor, proposedDate: string, schedules: AuditSchedule[]): boolean => {
  if (!proposedDate) return false;
  return schedules.some((s) => {
    const d = s.date || s.scheduledDate;
    if (d !== proposedDate) return false;
    if (s.status === 'Completed') return false;
    return s.leadAuditor === auditor.name || s.auditor === auditor.name;
  });
};

/**
 * Score one auditor against the context.
 */
export const scoreAuditor = (
  a: Auditor,
  ctx: AuditContext,
  schedules: AuditSchedule[],
  workload: Record<string, number>
): AuditorMatch => {
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Active gate
  if (a.status !== 'Active') {
    warnings.push('Currently inactive');
    score -= 5;
  }

  // Authorization gate (audit validator)
  if (a.auditValidator === 'Authorized') {
    score += 2;
    reasons.push('Authorized to validate');
  } else if (a.auditValidator === 'Not Authorized') {
    warnings.push('Not authorized as validator');
    score -= 1.5;
  }

  // Role match
  if (ctx.role === 'lead') {
    if (/lead/i.test(a.role)) {
      score += 3;
      reasons.push('Lead Auditor role');
    } else {
      warnings.push(`Role is ${a.role}, not Lead`);
      score -= 1;
    }
  } else if (ctx.role === 'auditor') {
    if (/^auditor$/i.test(a.role) || /lead/i.test(a.role)) {
      score += 1.5;
      reasons.push(`${a.role} role`);
    }
  }

  // Standard match — primary signal
  if (ctx.standard) {
    const fam = standardFamily(ctx.standard);
    const certs = (a.certifications || []).map(standardFamily);
    const exact = (a.certifications || []).some((c) => c.toLowerCase() === ctx.standard!.toLowerCase());
    const familyHit = certs.some((c) => c === fam || c.startsWith(fam) || fam.startsWith(c));
    if (exact) {
      score += 5;
      reasons.push(`Holds ${ctx.standard}`);
    } else if (familyHit) {
      score += 3;
      reasons.push(`Certified in ${ctx.standard.split(':')[0]} family`);
    } else {
      warnings.push(`No ${ctx.standard.split(':')[0]} certification`);
      score -= 1;
    }
  }

  // Sector / department / specialization soft match
  const ctxBag = [ctx.sector, ctx.location].filter(Boolean).join(' ').toLowerCase();
  if (ctxBag) {
    const auditorBag = [a.department, a.specialization].filter(Boolean).join(' ').toLowerCase();
    const ctxToks = new Set(tokens(ctxBag));
    const auditorToks = new Set(tokens(auditorBag));
    let overlap = 0;
    ctxToks.forEach((t) => { if (auditorToks.has(t)) overlap += 1; });
    if (overlap > 0) {
      score += Math.min(2, overlap * 0.75);
      const matched = [...ctxToks].filter((t) => auditorToks.has(t)).slice(0, 2);
      reasons.push(`Matches sector/specialization (${matched.join(', ')})`);
    }
  }

  // Workload — fewer open audits is better
  const open = workload[a.name] || 0;
  if (open === 0) {
    score += 1.5;
    reasons.push('Currently free');
  } else if (open <= 2) {
    score += 0.5;
    reasons.push(`Light workload (${open} open)`);
  } else if (open <= 4) {
    // neutral
  } else {
    warnings.push(`Heavy workload (${open} open audits)`);
    score -= 1;
  }

  // Date clash
  if (ctx.proposedDate && hasDateClash(a, ctx.proposedDate, schedules)) {
    warnings.push(`Already scheduled on ${ctx.proposedDate}`);
    score -= 4;
  }

  // Tenure boost (joinDate older than 2 years gets a small nudge)
  if (a.joinDate) {
    const years = (Date.now() - new Date(a.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (years >= 5) {
      score += 0.75;
      reasons.push(`${Math.floor(years)}y tenure`);
    } else if (years >= 2) {
      score += 0.3;
    }
  }

  // Confidence — squash to 0..1, treating ~10 as a strong match.
  const confidence = Math.max(0, Math.min(1, score / 12));

  return { auditor: a, score, confidence, reasons, warnings };
};

/**
 * Score all auditors and return top N by score.
 * Inactive auditors are still returned (with warnings) so callers can decide.
 */
export const matchAuditors = (
  auditors: Auditor[],
  ctx: AuditContext,
  schedules: AuditSchedule[] = [],
  limit = 3
): AuditorMatch[] => {
  const workload = buildWorkload(schedules);
  return auditors
    .map((a) => scoreAuditor(a, ctx, schedules, workload))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

/**
 * Optionally ask Claude for a one-paragraph summary of the top picks
 * in plain language (e.g. for a "Why these?" tooltip).
 */
export const summarizeWithClaude = async (
  ctx: AuditContext,
  matches: AuditorMatch[],
  signal?: AbortSignal
): Promise<string | null> => {
  if (!isClaudeConfigured() || matches.length === 0) return null;
  const system =
    'You are a certification body coordinator helping to assign auditors. ' +
    'Given the audit context and the top candidate auditors with their match data, ' +
    'write a brief, neutral paragraph (3-5 sentences) explaining the trade-offs and who you would prioritize. ' +
    'Be specific. Do not invent qualifications.';
  const lines = matches.map((m, i) => {
    const w = m.warnings.length ? ` Warnings: ${m.warnings.join('; ')}.` : '';
    return `${i + 1}. ${m.auditor.name} (${m.auditor.role}) — score ${m.score.toFixed(1)}; reasons: ${m.reasons.join('; ') || 'n/a'}.${w}`;
  });
  const prompt =
    `Audit context:\n` +
    `- Standard: ${ctx.standard || 'unspecified'}\n` +
    `- Sector: ${ctx.sector || 'unspecified'}\n` +
    `- Location: ${ctx.location || 'unspecified'}\n` +
    `- Proposed date: ${ctx.proposedDate || 'unspecified'}\n` +
    `- Role: ${ctx.role || 'auditor'}\n\n` +
    `Top candidates:\n${lines.join('\n')}\n\n` +
    `Write the summary now.`;
  try {
    return await claudeComplete(prompt, {
      system,
      maxTokens: 400,
      temperature: 0.4,
      signal,
    });
  } catch {
    return null;
  }
};
