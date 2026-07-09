/**
 * Corrective + Preventive action suggester.
 * ---------------------------------------------------------------------
 * Given a finding (free-text description, optional standard / clause /
 * severity / category), this module returns a ranked list of suggested
 * corrective and preventive actions drawn from a curated catalog.
 *
 * The catalog is organized by ISO clause families and by common finding
 * keywords. Suggestions are scored by keyword overlap and clause match;
 * the top 5 are returned.
 *
 * `refineWithClaude` optionally calls the BYO Claude API to expand or
 * rephrase a chosen suggestion in the auditor's voice.
 */

import { complete as claudeComplete, isClaudeConfigured } from './claudeClient';

export type Severity = 'Major' | 'Minor' | 'Observation' | 'OFI';

export interface FindingInput {
  /** Free-text description of the finding. */
  description: string;
  /** ISO standard label, e.g. "ISO 9001:2015". */
  standard?: string;
  /** Clause reference, e.g. "8.1", "9.2.2". */
  clause?: string;
  /** Severity tag. */
  severity?: Severity;
  /** Optional finding category (Documentation, Training, Process, etc.). */
  category?: string;
}

export interface ActionSuggestion {
  id: string;
  title: string;
  /** Short description of the corrective action. */
  correctiveAction: string;
  /** Short description of the preventive action. */
  preventiveAction: string;
  /** Suggested rough due-by horizon. */
  dueIn: '7 days' | '14 days' | '30 days' | '60 days' | '90 days';
  /** Tags that helped match this suggestion. */
  matchedOn: string[];
  /** Confidence score 0..1 for sorting. */
  score: number;
}

interface CatalogEntry {
  id: string;
  title: string;
  keywords: string[];
  clauses: string[];
  /** Standards this entry primarily applies to. Empty = all. */
  standards: string[];
  corrective: string;
  preventive: string;
  dueIn: ActionSuggestion['dueIn'];
}

const CATALOG: CatalogEntry[] = [
  {
    id: 'doc-control',
    title: 'Document control gap',
    keywords: ['document', 'document control', 'sop', 'procedure', 'outdated', 'old version', 'uncontrolled', 'no procedure'],
    clauses: ['7.5', '7.5.1', '7.5.2', '7.5.3'],
    standards: [],
    corrective:
      'Update the affected document to the current revision, withdraw obsolete copies, and re-issue under the controlled-document register. ' +
      'Notify all process owners and capture acknowledgement.',
    preventive:
      'Review the document master list quarterly; introduce a calendar reminder for owners on each document\'s review cycle. ' +
      'Restrict edit access to controlled folders only.',
    dueIn: '30 days',
  },
  {
    id: 'training',
    title: 'Training / competence shortfall',
    keywords: ['training', 'untrained', 'competence', 'awareness', 'unaware', 'skill gap', 'qualification'],
    clauses: ['7.2', '7.3'],
    standards: [],
    corrective:
      'Deliver targeted training to the affected personnel and record attendance, scores, and competency sign-off. ' +
      'Suspend high-risk activities until competency is confirmed.',
    preventive:
      'Add the topic to the new-hire onboarding curriculum and the annual refresher matrix. ' +
      'Set automated reminders for refresher due dates.',
    dueIn: '30 days',
  },
  {
    id: 'internal-audit',
    title: 'Internal audit programme weakness',
    keywords: ['internal audit', 'audit plan', 'audit programme', 'no internal audit'],
    clauses: ['9.2', '9.2.1', '9.2.2'],
    standards: [],
    corrective:
      'Create / refresh the internal audit schedule for the remaining cycle, assign a competent auditor for each engagement, ' +
      'and execute the next audit within 30 days.',
    preventive:
      'Anchor the audit programme to a rolling 12-month plan; review at every management review. ' +
      'Track planned-vs-actual completion as a KPI.',
    dueIn: '60 days',
  },
  {
    id: 'mgmt-review',
    title: 'Management review gap',
    keywords: ['management review', 'review meeting', 'top management'],
    clauses: ['9.3'],
    standards: [],
    corrective:
      'Hold the missing management review with the full required agenda within 30 days; ' +
      'document inputs, outputs, and resource decisions.',
    preventive:
      'Add management review to the annual calendar with quarterly check-ins; route minutes through the QMS.',
    dueIn: '30 days',
  },
  {
    id: 'records',
    title: 'Records / evidence missing',
    keywords: ['record', 'evidence', 'log missing', 'no log', 'not retained'],
    clauses: ['7.5.3', '8.5'],
    standards: [],
    corrective:
      'Reconstruct or retrieve the missing records from primary sources (logs, emails, PLC trends) and file them in the approved retention location.',
    preventive:
      'Move record creation onto a controlled form / e-form. Set retention rules and a periodic completeness audit.',
    dueIn: '14 days',
  },
  {
    id: 'risk',
    title: 'Risk / opportunity assessment gap',
    keywords: ['risk', 'opportunity', 'risk register', 'risk assessment'],
    clauses: ['6.1'],
    standards: [],
    corrective:
      'Complete a focused risk assessment for the affected process. Capture risks, controls, residual risk, and owners in the risk register.',
    preventive:
      'Refresh the risk register at every management review and after any significant change. ' +
      'Trigger re-assessment from change-management workflow.',
    dueIn: '30 days',
  },
  {
    id: 'objectives',
    title: 'Objectives / KPI not monitored',
    keywords: ['objective', 'kpi', 'performance indicator', 'targets', 'not measured', 'no metric'],
    clauses: ['6.2', '9.1', '9.1.1'],
    standards: [],
    corrective:
      'Define measurable objectives for the affected area, baseline the current performance, and start monthly tracking with a published dashboard.',
    preventive:
      'Tie objectives to the management-review agenda; auto-generate the dashboard on the first business day of each month.',
    dueIn: '30 days',
  },
  {
    id: 'calibration',
    title: 'Calibration / measurement traceability',
    keywords: ['calibration', 'gauge', 'measurement', 'instrument', 'uncertainty', 'traceability'],
    clauses: ['7.1.5'],
    standards: ['ISO 9001:2015', 'ISO 17025:2017'],
    corrective:
      'Quarantine affected equipment, recall the last batch of measurements, and recalibrate to a traceable standard. ' +
      'Issue a quality alert if released product is implicated.',
    preventive:
      'Tighten the calibration interval, add visual due-date stickers, and integrate the calibration register with the production schedule.',
    dueIn: '14 days',
  },
  {
    id: 'supplier',
    title: 'Supplier / external provider control',
    keywords: ['supplier', 'vendor', 'external provider', 'subcontractor', 'incoming', 'goods receipt'],
    clauses: ['8.4', '8.4.1', '8.4.2'],
    standards: [],
    corrective:
      'Issue a Supplier Corrective Action Request to the affected supplier with a 14-day response window. Inspect existing on-hand stock.',
    preventive:
      'Re-evaluate the supplier under the approved-vendor criteria; tighten incoming inspection until performance is verified.',
    dueIn: '30 days',
  },
  {
    id: 'change-mgmt',
    title: 'Change management not followed',
    keywords: ['change', 'mod', 'modification', 'unauthorised change', 'unapproved change'],
    clauses: ['8.1', '6.3'],
    standards: [],
    corrective:
      'Reverse or document the unapproved change. Run the formal change-management procedure retrospectively, including impact analysis and authorisation.',
    preventive:
      'Add a change-control gate in the workflow tooling so changes cannot be applied without an approved CM record.',
    dueIn: '14 days',
  },
  {
    id: 'access-control',
    title: 'Access control / least-privilege issue',
    keywords: ['access', 'privilege', 'permission', 'login', 'shared account', 'admin'],
    clauses: ['A.5.15', 'A.8', '9.2'],
    standards: ['ISO 27001:2022'],
    corrective:
      'Revoke excess access, rotate shared credentials, and reset privileged passwords. Capture an access review for the affected system.',
    preventive:
      'Move to role-based access with quarterly reviews; integrate joiner/mover/leaver processes with the IAM system.',
    dueIn: '7 days',
  },
  {
    id: 'incident-response',
    title: 'Incident response readiness',
    keywords: ['incident', 'breach', 'security event', 'response plan', 'tabletop'],
    clauses: ['A.5.24', 'A.5.25', '8.2'],
    standards: ['ISO 27001:2022'],
    corrective:
      'Run a tabletop exercise within 14 days against the most likely scenario. Update the IR runbook with the outcome.',
    preventive:
      'Add quarterly tabletop drills, define playbooks for the top 3 scenarios, and integrate alerting with the on-call rota.',
    dueIn: '14 days',
  },
  {
    id: 'phys-safety',
    title: 'Workplace health & safety control',
    keywords: ['ppe', 'hazard', 'safety', 'lockout', 'tagout', 'guard', 'incident'],
    clauses: ['8.1', '6.1.2'],
    standards: ['ISO 45001:2018'],
    corrective:
      'Stop the affected activity, restore the missing control (PPE, guarding, lockout), and brief the team. Investigate root cause.',
    preventive:
      'Add the control to the daily pre-start checklist; embed in the supervisor walk-around route.',
    dueIn: '7 days',
  },
  {
    id: 'env-aspect',
    title: 'Environmental aspect / impact control',
    keywords: ['environment', 'spill', 'waste', 'discharge', 'emission', 'aspect', 'impact'],
    clauses: ['6.1.2', '8.1'],
    standards: ['ISO 14001:2015'],
    corrective:
      'Contain and remediate the environmental release. Notify regulators if thresholds are exceeded. Update the aspects/impacts register.',
    preventive:
      'Re-engineer the source where feasible; add a daily inspection of secondary containment; train operators on response.',
    dueIn: '14 days',
  },
  {
    id: 'food-safety',
    title: 'Food safety / HACCP control',
    keywords: ['hazard', 'haccp', 'ccp', 'allergen', 'temperature', 'food safety', 'cleaning'],
    clauses: ['8.5.2', '8.6'],
    standards: ['ISO 22000:2018'],
    corrective:
      'Quarantine affected product, validate the CCP control, and re-verify the cleaning regime. Re-train the line crew.',
    preventive:
      'Tighten verification frequency at the affected CCP for 30 days; review the HACCP plan in the next team meeting.',
    dueIn: '14 days',
  },
  {
    id: 'ai-governance',
    title: 'AI system governance gap',
    keywords: ['ai', 'model', 'algorithm', 'bias', 'monitoring', 'data drift', 'training data'],
    clauses: ['6.1', '8.2', '9.1'],
    standards: ['ISO 42001:2023'],
    corrective:
      'Pause use of the affected AI system. Re-validate against the documented evaluation set; record results in the AI inventory.',
    preventive:
      'Add monitoring for drift / bias / fairness with thresholds and alerts. Re-validate quarterly and after retraining.',
    dueIn: '30 days',
  },
];

const STOP = new Set([
  'the','a','an','of','to','for','in','on','at','is','are','was','were','be','by',
  'with','and','or','not','no','do','does','did','from','that','this','it','as','its',
]);

const tokens = (s: string): string[] =>
  (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9.\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && t.length > 1 && !STOP.has(t));

const matchScore = (entry: CatalogEntry, finding: FindingInput): { score: number; matched: string[] } => {
  const t = tokens(finding.description);
  const matched: string[] = [];
  let score = 0;

  // Keyword overlap (each unique hit = +2)
  entry.keywords.forEach((kw) => {
    const kwTokens = kw.toLowerCase().split(/\s+/);
    const all = kwTokens.every((k) => t.includes(k));
    if (all) {
      score += 2;
      matched.push(kw);
    }
  });

  // Clause match (+3 if exact clause, +1 if family)
  if (finding.clause) {
    const fc = finding.clause.trim();
    if (entry.clauses.includes(fc)) {
      score += 3;
      matched.push(`Clause ${fc}`);
    } else {
      const fam = fc.split('.')[0];
      if (entry.clauses.some((c) => c.startsWith(fam + '.'))) {
        score += 1;
        matched.push(`Clause family ${fam}.x`);
      }
    }
  }

  // Standard match (+2 when constrained and matches)
  if (entry.standards.length > 0 && finding.standard) {
    if (entry.standards.includes(finding.standard)) {
      score += 2;
      matched.push(finding.standard);
    } else {
      // Penalize if entry is standard-specific and standard does not match
      score -= 1;
    }
  }

  // Category boost
  if (finding.category) {
    const cat = finding.category.toLowerCase();
    if (
      (cat.includes('doc') && entry.id === 'doc-control') ||
      (cat.includes('train') && entry.id === 'training') ||
      (cat.includes('record') && entry.id === 'records') ||
      (cat.includes('risk') && entry.id === 'risk')
    ) {
      score += 2;
      matched.push(`Category ${finding.category}`);
    }
  }

  // Severity nudge — Majors get a small bump because catalog responses are robust
  if (finding.severity === 'Major') score += 0.25;

  return { score, matched };
};

export const suggestActions = (finding: FindingInput, limit = 5): ActionSuggestion[] => {
  if (!finding || !(finding.description || '').trim()) return [];
  const ranked = CATALOG
    .map((entry) => {
      const { score, matched } = matchScore(entry, finding);
      return { entry, score, matched };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked.map(({ entry, score, matched }) => ({
    id: entry.id,
    title: entry.title,
    correctiveAction: entry.corrective,
    preventiveAction: entry.preventive,
    dueIn: entry.dueIn,
    matchedOn: matched,
    score: Math.min(1, score / 8),
  }));
};

/**
 * Optionally refine a chosen suggestion with Claude. Returns the refined
 * narrative, or null if Claude is not configured / errored.
 */
export const refineWithClaude = async (
  finding: FindingInput,
  picked: ActionSuggestion,
  signal?: AbortSignal
): Promise<string | null> => {
  if (!isClaudeConfigured()) return null;
  const system =
    'You are an experienced ISO management-system auditor refining a suggested corrective and preventive action. ' +
    'Keep the structure: 1) Containment, 2) Root cause focus, 3) Corrective action, 4) Preventive action, 5) Verification. ' +
    'Be specific to the finding the user supplied. Do not invent facts.';
  const prompt =
    `Finding:\n${finding.description}\n\n` +
    `Standard: ${finding.standard || 'unspecified'}\n` +
    `Clause: ${finding.clause || 'unspecified'}\n` +
    `Severity: ${finding.severity || 'unspecified'}\n\n` +
    `Suggested baseline (please refine and tailor):\n` +
    `Title: ${picked.title}\n` +
    `Corrective action: ${picked.correctiveAction}\n` +
    `Preventive action: ${picked.preventiveAction}\n` +
    `Suggested due-by horizon: ${picked.dueIn}.\n\n` +
    `Output the refined plan in the 5-step structure above.`;
  try {
    return await claudeComplete(prompt, {
      system,
      maxTokens: 700,
      temperature: 0.4,
      signal,
    });
  } catch {
    return null;
  }
};
