/**
 * leadAuditorInsights.ts — heuristics powering the Lead Auditor AI panels.
 *
 *  9. Report Quality Reviewer  — QC score /100 + issue list per report.
 * 10. Finding Classifier       — severity suggestion + ISO clause mapping.
 * 11. Auditor Competence       — approve / review-further recommendation.
 *
 * Everything works on live localStorage data with no API key; pages
 * recompute on onCmsChange so the insights always track current data.
 */

import { getSchedules } from './liveData';

/* ======================================================================
 * Feature 9 — Report Quality Reviewer
 * ==================================================================== */

export interface ReportQCIssue {
  kind: 'missing' | 'short' | 'no-evidence' | 'vague' | 'severity';
  text: string;
}

export interface ReportQC {
  key: string;
  title: string;
  score: number;
  issues: ReportQCIssue[];
}

const VAGUE_WORDS = ['some', 'various', 'etc', 'maybe', 'several', 'somewhat'];
const MAJOR_LANGUAGE = ['critical', 'systemic', 'widespread', 'complete failure', 'total breakdown', 'severe'];

const wordCount = (s?: string): number =>
  (s || '').trim().split(/\s+/).filter(Boolean).length;

const findVagueWords = (s?: string): string[] => {
  const padded = ' ' + (s || '').toLowerCase().replace(/[^a-z]+/g, ' ') + ' ';
  return VAGUE_WORDS.filter((w) => padded.includes(' ' + w + ' '));
};

/**
 * Analyse one report (shape from cms_audit_reports_v1) plus its raw
 * findings (cms_audit_findings_v1[key]) and return a QC score + issues.
 */
export const reviewReportQuality = (
  key: string,
  title: string,
  report: { summary?: string; scope?: string; conclusion?: string },
  findings: Array<{ severity?: string; description?: string; evidence?: string; clause?: string }>
): ReportQC => {
  const issues: ReportQCIssue[] = [];
  let score = 100;

  // 1) Missing / short sections
  const sections: Array<[string, string | undefined]> = [
    ['Executive summary', report.summary],
    ['Scope', report.scope],
    ['Conclusion', report.conclusion],
  ];
  sections.forEach(([label, value]) => {
    if (!value || !value.trim()) {
      issues.push({ kind: 'missing', text: `${label} section is missing.` });
      score -= 15;
    }
  });
  const summaryWords = wordCount(report.summary);
  if (report.summary && report.summary.trim() && summaryWords < 20) {
    issues.push({
      kind: 'short',
      text: `Executive summary is only ${summaryWords} word${summaryWords === 1 ? '' : 's'} — expand it to at least 20.`,
    });
    score -= 10;
  }

  // 2) Vague wording across the narrative sections
  const vague = Array.from(new Set([
    ...findVagueWords(report.summary),
    ...findVagueWords(report.scope),
    ...findVagueWords(report.conclusion),
  ]));
  if (vague.length > 0) {
    issues.push({
      kind: 'vague',
      text: `Vague wording in the narrative: ${vague.map((w) => `"${w}"`).join(', ')} — replace with specifics.`,
    });
    score -= Math.min(15, 5 * vague.length);
  }

  // 3) Findings checks — missing evidence + severity/language mismatch
  findings.forEach((f, i) => {
    const ref = f.clause ? `clause ${f.clause}` : `#${i + 1}`;
    if (!String(f.evidence || '').trim()) {
      issues.push({ kind: 'no-evidence', text: `Finding ${ref} has no evidence text.` });
      score -= 8;
    }
    const sev = String(f.severity || '');
    const body = (String(f.description || '') + ' ' + String(f.evidence || '')).toLowerCase();
    if (!/major/i.test(sev)) {
      const hits = MAJOR_LANGUAGE.filter((w) => body.includes(w));
      if (hits.length > 0) {
        issues.push({
          kind: 'severity',
          text: `Finding ${ref} is graded "${sev || 'Minor'}" but uses major-severity language (${hits.join(', ')}) — re-check the grading.`,
        });
        score -= 10;
      }
    }
    const fVague = findVagueWords(f.description);
    if (fVague.length > 0) {
      issues.push({
        kind: 'vague',
        text: `Finding ${ref} uses vague wording (${fVague.map((w) => `"${w}"`).join(', ')}).`,
      });
      score -= 4;
    }
  });

  return { key, title, score: Math.max(0, Math.round(score)), issues };
};

/* ======================================================================
 * Feature 10 — Finding Classifier (severity + ISO clause)
 * ==================================================================== */

export type SuggestedSeverity = 'Major NC' | 'Minor NC' | 'OFI';

export interface FindingClassification {
  suggestedSeverity: SuggestedSeverity;
  severityReasons: string[];
  clause: string;
  clauseTitle: string;
  clauseReason: string;
}

const MAJOR_SIGNALS = [
  'absence of', 'no process', 'no procedure', 'not established', 'not implemented',
  'systemic', 'repeat', 'recurring', 'widespread', 'complete failure', 'total breakdown', 'violating',
];
const MINOR_SIGNALS = [
  'isolated', 'single instance', 'one instance', 'one occurrence', 'once',
  'partial', 'minor lapse', 'sampled', 'of 10', 'one of',
];
const OFI_SIGNALS = [
  'improvement', 'opportunity', 'could', 'consider', 'would benefit',
  'suggest', 'reduce effort', 'streamline', 'automating',
];

/** Context clause table — keyword → ISO high-level clause family. */
const CLAUSE_TABLE: Array<{ clause: string; title: string; keywords: string[] }> = [
  { clause: '5', title: 'Leadership', keywords: ['leadership', 'policy', 'top management', 'commitment', 'roles', 'responsibilit'] },
  { clause: '6', title: 'Planning', keywords: ['planning', 'risk', 'opportunit', 'objective', 'change management'] },
  { clause: '7', title: 'Support', keywords: ['support', 'training', 'competence', 'awareness', 'resource', 'calibration', 'document', 'record', 'communication', 'infrastructure', 'onboarding'] },
  { clause: '8', title: 'Operation', keywords: ['operation', 'process control', 'production', 'supplier', 'vendor', 'external provider', 'design', 'delivery', 'service', 'visitor', 'waste', 'segregation'] },
  { clause: '9', title: 'Performance evaluation', keywords: ['performance', 'monitoring', 'measurement', 'internal audit', 'audit programme', 'management review', 'analysis', 'customer satisfaction', 'access review'] },
  { clause: '10', title: 'Improvement', keywords: ['nonconformity', 'non-conformity', 'corrective action', 'recurrence', 'continual improvement'] },
];

export const classifyFinding = (description: string): FindingClassification => {
  const text = (description || '').toLowerCase();

  const majorHits = MAJOR_SIGNALS.filter((k) => text.includes(k));
  const minorHits = MINOR_SIGNALS.filter((k) => text.includes(k));
  const ofiHits = OFI_SIGNALS.filter((k) => text.includes(k));

  let suggestedSeverity: SuggestedSeverity;
  let severityReasons: string[];
  if (majorHits.length > 0 && majorHits.length >= ofiHits.length) {
    suggestedSeverity = 'Major NC';
    severityReasons = majorHits.map((k) => `"${k}" suggests a process-level / systemic breakdown`);
  } else if (ofiHits.length > 0 && minorHits.length === 0) {
    suggestedSeverity = 'OFI';
    severityReasons = ofiHits.map((k) => `"${k}" reads as an improvement opportunity, not a breach`);
  } else if (minorHits.length > 0) {
    suggestedSeverity = 'Minor NC';
    severityReasons = minorHits.map((k) => `"${k}" indicates an isolated lapse in an otherwise working process`);
  } else {
    suggestedSeverity = 'Minor NC';
    severityReasons = ['No systemic or improvement-only signals found — defaulting to an isolated nonconformity'];
  }

  // Clause mapping — pick the clause family with the most keyword hits.
  let best: { clause: string; title: string; hits: string[] } = { clause: '8', title: 'Operation', hits: [] };
  let bestCount = 0;
  CLAUSE_TABLE.forEach((row) => {
    const hits = row.keywords.filter((k) => text.includes(k));
    if (hits.length > bestCount) {
      bestCount = hits.length;
      best = { clause: row.clause, title: row.title, hits };
    }
  });

  return {
    suggestedSeverity,
    severityReasons: severityReasons.slice(0, 2),
    clause: best.clause,
    clauseTitle: best.title,
    clauseReason: best.hits.length > 0
      ? `matched: ${best.hits.slice(0, 3).join(', ')}`
      : 'no strong keyword match — defaulted to Operation (clause 8)',
  };
};

/* ======================================================================
 * Feature 11 — Auditor Competence Insights
 * ==================================================================== */

export interface AuditorCompetence {
  name: string;
  schedulesTotal: number;
  schedulesCompleted: number;
  standards: string[];
  avgRating: number | null;
  qualityProxy: 'Strong' | 'Moderate' | 'Limited';
  recommendation: 'Approve' | 'Review further';
  reasons: string[];
}

export const assessAuditorCompetence = (auditor: {
  name?: string;
  certifications?: string[];
  skills?: Record<string, number>;
  ratings?: Array<{ score: number }>;
}): AuditorCompetence => {
  const name = String(auditor?.name || 'Auditor');
  const lower = name.toLowerCase();

  const schedules = getSchedules().filter((s: any) =>
    [s?.auditor, s?.leadAuditor].some((n) => String(n || '').toLowerCase() === lower)
  );
  const schedulesCompleted = schedules.filter(
    (s: any) => String(s?.status || '').toLowerCase() === 'completed'
  ).length;

  const standards = Array.from(new Set([
    ...(auditor?.certifications || []),
    ...Object.keys(auditor?.skills || {}),
  ]));

  const ratingScores = (auditor?.ratings || [])
    .map((r) => Number(r?.score))
    .filter((n) => Number.isFinite(n));
  const avgRating = ratingScores.length > 0
    ? Math.round((ratingScores.reduce((a, b) => a + b, 0) / ratingScores.length) * 10) / 10
    : null;

  // Findings-raised quality proxy: skill-matrix depth stands in for finding
  // quality because findings are not attributed to auditors in the store.
  const skillLevels = Object.values(auditor?.skills || {}).filter((n) => Number.isFinite(n));
  const avgSkill = skillLevels.length > 0
    ? skillLevels.reduce((a, b) => a + b, 0) / skillLevels.length
    : 0;
  const qualityProxy: AuditorCompetence['qualityProxy'] =
    avgSkill >= 3.5 || (avgRating !== null && avgRating >= 4) ? 'Strong'
      : avgSkill >= 2.5 || (avgRating !== null && avgRating >= 3) ? 'Moderate'
      : 'Limited';

  const reasons: string[] = [];
  let points = 0;

  if (standards.length >= 2) { points += 1; reasons.push(`Covers ${standards.length} standards (${standards.slice(0, 3).join(', ')}${standards.length > 3 ? '…' : ''})`); }
  else if (standards.length === 1) { reasons.push(`Only 1 standard on file (${standards[0]})`); }
  else { reasons.push('No certifications or skill matrix on file'); }

  if (schedulesCompleted > 0) { points += 1; reasons.push(`${schedulesCompleted} of ${schedules.length} assigned schedule(s) completed`); }
  else if (schedules.length > 0) { reasons.push(`${schedules.length} schedule(s) assigned, none completed yet`); }
  else { reasons.push('No audit schedules on record yet'); }

  if (avgRating !== null) {
    if (avgRating >= 3.5) { points += 1; reasons.push(`Average rating ${avgRating}/5`); }
    else { points -= 1; reasons.push(`Low average rating ${avgRating}/5`); }
  }

  if (qualityProxy === 'Strong') { points += 1; reasons.push('Strong skill matrix (findings-quality proxy)'); }
  else if (qualityProxy === 'Limited') { reasons.push('Limited skill depth — verify competence evidence'); }

  return {
    name,
    schedulesTotal: schedules.length,
    schedulesCompleted,
    standards,
    avgRating,
    qualityProxy,
    recommendation: points >= 2 ? 'Approve' : 'Review further',
    reasons,
  };
};
