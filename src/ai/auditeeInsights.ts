/**
 * auditeeInsights.ts — heuristics powering the Auditee (Audit Client) AI features.
 *
 * 15. Corrective Action Coach   — 5-Why scaffold + plan suggestion (reuses
 *                                 ai/correctiveActions.suggestActions, with
 *                                 optional Claude refinement).
 * 16. Readiness Self-Assessment — standard picker + 8 yes/no questions →
 *                                 readiness %, gap list, next step.
 * 17. Plain-Language Explainer  — certification jargon in plain words.
 */

import {
  suggestActions,
  refineWithClaude,
  ActionSuggestion,
  Severity,
  FindingInput,
} from './correctiveActions';

/* ======================================================================
 * Feature 15 — Corrective Action Coach
 * ==================================================================== */

export interface CoachPlan {
  fiveWhys: string[];
  rootCauseDraft: string;
  planDraft: string;
  suggestion: ActionSuggestion | null;
}

const toSeverity = (s?: string): Severity | undefined => {
  if (!s) return undefined;
  if (s.startsWith('Major')) return 'Major';
  if (s.startsWith('Minor')) return 'Minor';
  if (s === 'OFI') return 'OFI';
  return undefined;
};

const shorten = (s: string, max = 90): string => {
  const clean = (s || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean;
};

/**
 * Build a coaching pack for one corrective-action record: a 5-Why
 * root-cause scaffold plus a corrective/preventive plan suggestion drawn
 * from the shared action catalog.
 */
export const buildCoachPlan = (record: {
  description: string;
  standard?: string;
  severity?: string;
}): CoachPlan => {
  const [suggestion] = suggestActions(
    {
      description: record.description,
      standard: record.standard,
      severity: toSeverity(record.severity),
    },
    1
  );

  const fiveWhys = [
    `Why 1 — Why did it happen? (immediate cause of: "${shorten(record.description)}")`,
    'Why 2 — Why was that condition present at the time?',
    'Why 3 — Why did the process or control not prevent it?',
    'Why 4 — Why was the process designed, resourced or monitored that way?',
    'Why 5 — Why did the management system not detect it earlier? → likely root cause',
  ];

  const rootCauseDraft =
    fiveWhys.map((w) => w + '\nAnswer: ').join('\n') +
    '\n\nRoot cause (from Why 5): ';

  const planDraft = suggestion
    ? `Corrective action: ${suggestion.correctiveAction}\n\n` +
      `Preventive action: ${suggestion.preventiveAction}\n\n` +
      `Target completion: within ${suggestion.dueIn}.`
    : 'Corrective action: correct the immediate issue and contain any affected output.\n\n' +
      'Preventive action: address the root cause identified in the 5-Why analysis so it cannot recur.\n\n' +
      'Target completion: within 30 days.';

  return { fiveWhys, rootCauseDraft, planDraft, suggestion: suggestion || null };
};

/** Optional Claude refinement of the suggested plan (null if unconfigured). */
export const refineCoachPlan = async (
  record: { description: string; standard?: string; severity?: string },
  suggestion: ActionSuggestion
): Promise<string | null> => {
  const finding: FindingInput = {
    description: record.description,
    standard: record.standard,
    severity: toSeverity(record.severity),
  };
  return refineWithClaude(finding, suggestion);
};

/* ======================================================================
 * Feature 16 — Readiness Self-Assessment
 * ==================================================================== */

export const READINESS_STANDARDS = [
  'ISO 9001:2015',
  'ISO 14001:2015',
  'ISO 45001:2018',
  'ISO 27001:2022',
] as const;

export interface ReadinessQuestion { id: string; label: string; gap: string; }

export const READINESS_QUESTIONS: ReadinessQuestion[] = [
  { id: 'policy', label: 'Documented policy approved by top management', gap: 'Draft and approve the policy, then communicate it to all staff.' },
  { id: 'internal-audit', label: 'Internal audit completed in the last 12 months', gap: 'Run at least one full internal audit covering all clauses before the certification audit.' },
  { id: 'mgmt-review', label: 'Management review held with recorded minutes', gap: 'Hold a management review with the required inputs and record the outputs.' },
  { id: 'training', label: 'Staff trained with competence records kept', gap: 'Deliver role-based training and retain attendance / competence records.' },
  { id: 'objectives', label: 'Measurable objectives set and tracked', gap: 'Define measurable objectives and start tracking progress against them.' },
  { id: 'nc-process', label: 'Nonconformity & corrective-action process in place', gap: 'Set up an NC log with root-cause analysis and corrective-action workflow.' },
  { id: 'records', label: 'Records / documented information controlled', gap: 'Introduce document and record control (versioning, approval, retention).' },
  { id: 'risk', label: 'Risk assessment performed and reviewed', gap: 'Complete a risk assessment and keep the register current.' },
];

export interface ReadinessResult {
  score: number;               // 0..100
  answered: number;            // how many of the 8 have an answer
  gaps: string[];              // gap text for every "No"
  unanswered: string[];        // labels not yet answered
  nextStep: string;
}

export const assessReadiness = (
  standard: string,
  answers: Record<string, boolean | null | undefined>
): ReadinessResult => {
  const yes = READINESS_QUESTIONS.filter((q) => answers[q.id] === true);
  const no = READINESS_QUESTIONS.filter((q) => answers[q.id] === false);
  const unanswered = READINESS_QUESTIONS.filter((q) => answers[q.id] == null);

  const score = Math.round((yes.length / READINESS_QUESTIONS.length) * 100);

  const flavour =
    standard.includes('27001') ? ' For ISO 27001 also prepare your Statement of Applicability and risk-treatment plan.'
    : standard.includes('45001') ? ' For ISO 45001 make sure hazard identification and worker consultation are evidenced.'
    : standard.includes('14001') ? ' For ISO 14001 keep the aspects & impacts register and compliance obligations current.'
    : '';

  let nextStep: string;
  if (unanswered.length === READINESS_QUESTIONS.length) {
    nextStep = `Answer the questions above to estimate your ${standard} readiness.`;
  } else if (score >= 90) {
    nextStep = `You look ready for ${standard} — request a Stage 1 (documentation) audit date from your certification body.` + flavour;
  } else if (score >= 60) {
    nextStep = `Close the listed gaps, then run a quick internal verification before booking the Stage 1 audit for ${standard}.` + flavour;
  } else if (score >= 30) {
    nextStep = `Focus on the fundamentals first (policy, internal audit, management review) — plan 2–3 months of preparation for ${standard}.` + flavour;
  } else {
    nextStep = `Start with a structured gap analysis against ${standard} — most core elements are not yet in place.` + flavour;
  }

  return {
    score,
    answered: yes.length + no.length,
    gaps: no.map((q) => q.gap),
    unanswered: unanswered.map((q) => q.label),
    nextStep,
  };
};

/* ======================================================================
 * Feature 17 — Plain-Language Explainer
 * ==================================================================== */

export interface JargonEntry {
  term: string;
  plain: string;
  certificate: string;
}

export const JARGON_TERMS: JargonEntry[] = [
  {
    term: 'Major NC (Major Nonconformity)',
    plain: 'A serious problem — a whole requirement is missing or a process has broken down completely (or keeps failing repeatedly).',
    certificate: 'Certification is normally blocked (or at risk of suspension) until you fix it and the auditor verifies the fix, often within 60–90 days.',
  },
  {
    term: 'Minor NC (Minor Nonconformity)',
    plain: 'A small, isolated slip — the process exists and mostly works, but one instance did not follow it.',
    certificate: 'You can usually still be certified; you must submit a corrective-action plan and show the fix at the next audit.',
  },
  {
    term: 'OFI (Opportunity for Improvement)',
    plain: 'Not a rule break at all — just a suggestion where you could do something better or more efficiently.',
    certificate: 'No impact on your certificate. Acting on OFIs is optional but looks good at the next audit.',
  },
  {
    term: 'Surveillance audit',
    plain: 'A shorter yearly check-up between full audits to confirm your system is still working.',
    certificate: 'Required to keep your certificate valid. Skipping or failing one can lead to suspension.',
  },
  {
    term: 'Stage 1 audit',
    plain: 'The first visit: the auditor reviews your documentation and readiness — like a rehearsal before the real exam.',
    certificate: 'No certificate yet; it decides whether you are ready to proceed to Stage 2.',
  },
  {
    term: 'Stage 2 audit',
    plain: 'The full on-site audit: the auditor checks that what your documents say actually happens in practice.',
    certificate: 'Passing Stage 2 is what earns you the certificate (valid 3 years with yearly surveillance).',
  },
  {
    term: 'Recertification',
    plain: 'A full re-audit near the end of the 3-year certificate cycle to renew it for another 3 years.',
    certificate: 'If completed on time your certificate continues without a break; if late, it expires and you may need to restart.',
  },
  {
    term: 'Suspension',
    plain: 'Your certificate is temporarily put on hold — usually after unresolved major findings or a missed surveillance audit.',
    certificate: 'You may not claim to be certified while suspended. Fix the issues within the deadline or the certificate is withdrawn entirely.',
  },
];
