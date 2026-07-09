/**
 * auditorInsights.ts — heuristics powering the Auditor AI features.
 *
 * 12. Checklist Copilot   — question meaning + evidence to request +
 *                           "Draft finding" structuring of a short note.
 * 13. Voice-to-Finding    — the same structuring applied to a dictated
 *                           transcript (speech capture lives in the page).
 * 14. Evidence Summarizer — condense pasted evidence text into dates,
 *                           quantities, document names + 2-sentence summary.
 *
 * All heuristics run locally on live data; no API key required.
 */

import { safeJSON } from './liveData';

/* ======================================================================
 * Feature 12 — Checklist Copilot
 * ==================================================================== */

export interface ChecklistQuestion { id: string; text: string; }
export interface ChecklistDef {
  id: number | string;
  name: string;
  standard: string;
  questions: ChecklistQuestion[];
}

/** Live read of the coordinator-managed checklists (cms_audit_checklists). */
export const loadChecklistDefs = (): ChecklistDef[] =>
  safeJSON<any[]>('cms_audit_checklists', [])
    .map((c) => ({
      id: c?.id ?? '',
      name: String(c?.name || 'Checklist'),
      standard: String(c?.standard || ''),
      questions: (c?.checklistItems || []).map((i: any) => ({
        id: String(i?.id ?? ''),
        text: String(i?.text || ''),
      })).filter((q: ChecklistQuestion) => q.text),
    }))
    .filter((c) => c.questions.length > 0);

interface HelpTemplate {
  keywords: string[];
  meaning: string;
  evidence: string[];
  clause: string;
  requirement: string;
}

const HELP_TEMPLATES: HelpTemplate[] = [
  {
    keywords: ['policy'],
    meaning: 'Checks that top management has defined, approved and communicated the policy, and that it is kept current.',
    evidence: ['Signed / approved policy document', 'Evidence of communication (intranet, notice boards, induction pack)', 'Latest review or re-approval record'],
    clause: '5.2',
    requirement: 'Top management shall establish, maintain and communicate a policy appropriate to the organization (clause 5.2).',
  },
  {
    keywords: ['objective', 'kpi', 'target'],
    meaning: 'Verifies that measurable objectives exist at relevant functions and that progress against them is tracked.',
    evidence: ['Objectives register / KPI dashboard', 'Trend data or monthly performance reports', 'Actions taken when targets were missed'],
    clause: '6.2',
    requirement: 'The organization shall establish measurable objectives and retain documented information on them (clause 6.2).',
  },
  {
    keywords: ['document', 'documented information', 'controlled', 'procedure', 'sop'],
    meaning: 'Confirms documents and records are versioned, approved, available at point of use, and obsolete copies withdrawn.',
    evidence: ['Document master list / register', 'Sample controlled documents with revision status', 'Access / distribution controls for obsolete versions'],
    clause: '7.5',
    requirement: 'Documented information shall be controlled — created, updated, approved and protected (clause 7.5).',
  },
  {
    keywords: ['internal audit', 'audit programme', 'planned intervals'],
    meaning: 'Checks the internal audit programme runs at planned intervals with impartial auditors and reported results.',
    evidence: ['Internal audit schedule / programme', 'Latest internal audit report and NC log', 'Auditor competence / independence records'],
    clause: '9.2',
    requirement: 'Internal audits shall be conducted at planned intervals and results reported to management (clause 9.2).',
  },
  {
    keywords: ['management review'],
    meaning: 'Confirms top management periodically reviews the system with the required inputs and records decisions/outputs.',
    evidence: ['Management review minutes / agenda', 'Attendance list including top management', 'Actions arising and their follow-up status'],
    clause: '9.3',
    requirement: 'Top management shall review the management system at planned intervals covering the required inputs (clause 9.3).',
  },
  {
    keywords: ['nonconform', 'non-conform', 'corrective'],
    meaning: 'Checks nonconformities are logged, root-caused, corrected and verified for effectiveness.',
    evidence: ['NC / CAPA log', 'Sample corrective-action records with root cause', 'Effectiveness verification evidence'],
    clause: '10.2',
    requirement: 'The organization shall react to nonconformities, evaluate root cause and implement corrective action (clause 10.2).',
  },
  {
    keywords: ['customer satisfaction', 'complaint', 'feedback'],
    meaning: 'Verifies customer perception is monitored (surveys, complaints, reviews) and the data is analysed and acted on.',
    evidence: ['Customer survey results / NPS data', 'Complaints log with closure status', 'Analysis presented at management review'],
    clause: '9.1.2',
    requirement: 'The organization shall monitor customer perceptions of the degree to which needs are met (clause 9.1.2).',
  },
  {
    keywords: ['supplier', 'external provider', 'vendor', 'purchas'],
    meaning: 'Checks external providers are evaluated, selected and monitored against defined criteria.',
    evidence: ['Approved supplier list with evaluation criteria', 'Recent supplier evaluations / scorecards', 'Incoming inspection or SCAR records'],
    clause: '8.4',
    requirement: 'Controls shall be applied to externally provided processes, products and services (clause 8.4).',
  },
  {
    keywords: ['training', 'competen', 'awareness', 'skill'],
    meaning: 'Confirms people are competent for their roles and competence evidence (training, education, experience) is retained.',
    evidence: ['Training matrix / plan', 'Attendance records and competency assessments', 'Job descriptions with competence requirements'],
    clause: '7.2',
    requirement: 'The organization shall ensure persons are competent and retain documented evidence of competence (clause 7.2).',
  },
  {
    keywords: ['calibrat', 'measuring equipment', 'measurement', 'instrument', 'gauge'],
    meaning: 'Checks measuring equipment is calibrated / verified against traceable standards and protected from invalidation.',
    evidence: ['Calibration register with due dates', 'Sample calibration certificates', 'Handling of out-of-calibration equipment'],
    clause: '7.1.5',
    requirement: 'Monitoring and measuring resources shall be calibrated or verified and traceable (clause 7.1.5).',
  },
  {
    keywords: ['risk', 'opportunit'],
    meaning: 'Verifies risks and opportunities are identified, assessed and treated, with actions integrated into processes.',
    evidence: ['Risk register / assessment', 'Treatment or mitigation action plans', 'Review dates and owners'],
    clause: '6.1',
    requirement: 'The organization shall determine risks and opportunities and plan actions to address them (clause 6.1).',
  },
  {
    keywords: ['incident', 'security event', 'breach', 'reporting'],
    meaning: 'Checks there is a defined route for reporting incidents/events and that reported ones are handled and learned from.',
    evidence: ['Incident reporting procedure', 'Incident log with response times', 'Post-incident review / lessons learned'],
    clause: '8.1',
    requirement: 'The organization shall plan and control the processes needed to respond to incidents (clause 8.1 / A.5.24).',
  },
  {
    keywords: ['access', 'privilege', 'user rights'],
    meaning: 'Confirms access rights are granted on least-privilege, reviewed periodically and removed on role change / exit.',
    evidence: ['Access control policy', 'Latest periodic access review', 'Joiner-mover-leaver records'],
    clause: '9.2',
    requirement: 'Access rights shall be provisioned, reviewed and revoked per the access control policy (A.5.15 / A.5.18).',
  },
  {
    keywords: ['backup'],
    meaning: 'Checks backups are taken to schedule, protected, and restoration is periodically tested.',
    evidence: ['Backup schedule / policy', 'Backup job logs', 'Most recent restore test result'],
    clause: '8.1',
    requirement: 'Backup copies shall be maintained and tested in line with the agreed policy (A.8.13).',
  },
  {
    keywords: ['waste', 'environment', 'aspect', 'emission', 'discharge'],
    meaning: 'Verifies environmental aspects/impacts are identified and operational controls (e.g. waste segregation) work in practice.',
    evidence: ['Aspects & impacts register', 'Waste transfer notes / disposal records', 'Site walk observation of segregation and labelling'],
    clause: '8.1',
    requirement: 'Operations linked to significant environmental aspects shall be controlled (clause 8.1 / 6.1.2).',
  },
  {
    keywords: ['emergency', 'preparedness', 'drill', 'evacuation'],
    meaning: 'Checks emergency scenarios are identified and response plans exist, are tested, and lessons are captured.',
    evidence: ['Emergency preparedness procedure', 'Drill / test records with dates', 'Post-drill improvement actions'],
    clause: '8.2',
    requirement: 'The organization shall establish, test and revise emergency preparedness and response processes (clause 8.2).',
  },
  {
    keywords: ['legal', 'compliance obligation', 'regulat', 'statutory'],
    meaning: 'Confirms applicable legal and other requirements are identified, kept current and compliance is evaluated.',
    evidence: ['Legal / compliance obligations register', 'Latest compliance evaluation', 'Permits or licences on file'],
    clause: '6.1.3',
    requirement: 'Compliance obligations shall be determined, accessed and taken into account (clause 6.1.3 / 9.1.2).',
  },
  {
    keywords: ['asset inventory', 'asset'],
    meaning: 'Checks an inventory of assets is maintained with owners assigned and acceptable-use rules defined.',
    evidence: ['Asset inventory / CMDB extract', 'Asset ownership assignments', 'Acceptable use policy acknowledgements'],
    clause: '7.5',
    requirement: 'An inventory of assets shall be developed and maintained with designated owners (A.5.9).',
  },
];

const FALLBACK_HELP: HelpTemplate = {
  keywords: [],
  meaning: 'Assesses whether this requirement is implemented in practice — look for a defined process, someone accountable, and recent evidence it is followed.',
  evidence: ['Relevant procedure or process description', 'Recent records demonstrating the activity', 'Interview notes from the process owner'],
  clause: '8.1',
  requirement: 'The organization shall implement and control the processes needed to meet requirements (clause 8.1).',
};

const matchTemplate = (text: string): HelpTemplate => {
  const t = (text || '').toLowerCase();
  let best = FALLBACK_HELP;
  let bestHits = 0;
  HELP_TEMPLATES.forEach((tpl) => {
    const hits = tpl.keywords.filter((k) => t.includes(k)).length;
    if (hits > bestHits) { bestHits = hits; best = tpl; }
  });
  return best;
};

export interface QuestionHelp { meaning: string; evidence: string[]; clause: string; }

/** What a checklist question means + what evidence to request. */
export const explainQuestion = (questionText: string): QuestionHelp => {
  const tpl = matchTemplate(questionText);
  return { meaning: tpl.meaning, evidence: tpl.evidence, clause: tpl.clause };
};

/* ======================================================================
 * Features 12 + 13 — structure a short note / transcript into a finding
 * ==================================================================== */

export type FindingNature = 'Major NC' | 'Minor NC' | 'Observation' | 'Opportunity';

export interface StructuredFinding {
  observation: string;
  requirement: string;
  evidence: string;
  nature: FindingNature;
  clause: string;
  /** Full structured text ready for the finding description field. */
  text: string;
}

const NATURE_MAJOR = ['absence of', 'no process', 'no procedure', 'not established', 'not implemented', 'systemic', 'repeat', 'recurring', 'widespread', 'complete failure', 'total breakdown'];
const NATURE_MINOR = ['isolated', 'single instance', 'one instance', 'once', 'partial', 'expired', 'missing', 'not signed', 'outdated', 'lapse'];
const NATURE_OPP = ['improvement', 'opportunity', 'could', 'consider', 'would benefit', 'suggest', 'streamline'];

const suggestNature = (text: string): FindingNature => {
  const t = text.toLowerCase();
  if (NATURE_MAJOR.some((k) => t.includes(k))) return 'Major NC';
  if (NATURE_OPP.some((k) => t.includes(k))) return 'Opportunity';
  if (NATURE_MINOR.some((k) => t.includes(k))) return 'Minor NC';
  return 'Observation';
};

const sentenceCase = (s: string): string => {
  const trimmed = s.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const capped = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capped) ? capped : capped + '.';
};

/** Pull an evidence-ish fragment out of the note (things seen / reviewed). */
const extractEvidence = (note: string): string => {
  const m = note.match(/(?:saw|seen|reviewed|checked|sampled|shown|record(?:s)? (?:show|of)|per|as per)\s+([^.;]{5,120})/i);
  if (m) return sentenceCase(m[0]);
  const doc = note.match(/\b[\w-]+\.(?:pdf|docx?|xlsx?|png|jpe?g|csv)\b/i);
  if (doc) return `Document reviewed: ${doc[0]}.`;
  return 'Records and responses reviewed during the audit interview (attach references).';
};

/**
 * Turn the auditor's short note (or a dictated transcript) into a
 * structured finding: observation, requirement, evidence, nature + clause.
 */
export const structureFinding = (note: string, questionText?: string): StructuredFinding => {
  const clean = (note || '').trim();
  const tpl = matchTemplate(questionText ? `${questionText} ${clean}` : clean);
  const nature = suggestNature(clean);
  const observation = sentenceCase(clean) || 'No observation text provided.';
  const requirement = tpl.requirement;
  const evidence = extractEvidence(clean);
  const text =
    `Observation: ${observation}\n` +
    `Requirement: ${requirement}\n` +
    (questionText ? `Checklist item: ${questionText.trim()}\n` : '') +
    `Nature: ${nature}`;
  return { observation, requirement, evidence, nature, clause: tpl.clause, text };
};

/* ======================================================================
 * Feature 14 — Evidence Summarizer
 * ==================================================================== */

export interface EvidenceSummary {
  dates: string[];
  quantities: string[];
  documents: string[];
  summary: string;
}

const MONTHS = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';

const uniq = (arr: string[]): string[] => Array.from(new Set(arr.map((s) => s.trim()))).filter(Boolean);

export const summarizeEvidence = (raw: string): EvidenceSummary => {
  const text = (raw || '').trim();
  if (!text) return { dates: [], quantities: [], documents: [], summary: 'No evidence text supplied.' };

  const dates = uniq([
    ...(text.match(/\b\d{4}-\d{2}-\d{2}\b/g) || []),
    ...(text.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g) || []),
    ...(text.match(new RegExp(`\\b${MONTHS}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, 'gi')) || []),
    ...(text.match(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTHS}\\.?,?\\s+\\d{4}\\b`, 'gi')) || []),
    ...(text.match(new RegExp(`\\b${MONTHS}\\.?\\s+\\d{4}\\b`, 'gi')) || []),
  ]).slice(0, 8);

  const quantities = uniq([
    ...(text.match(/\b\d+(?:\.\d+)?\s?(?:%|percent)\b/gi) || []),
    ...(text.match(/\b\d+\s+(?:of|out of)\s+\d+\b/gi) || []),
    ...(text.match(/\b\d+(?:\.\d+)?\s?(?:records?|samples?|items?|units?|employees?|staff|days?|hours?|sites?|batches?|instances?|findings?|certificates?)\b/gi) || []),
  ]).slice(0, 8);

  const documents = uniq([
    ...(text.match(/\b[\w-]+\.(?:pdf|docx?|xlsx?|pptx?|png|jpe?g|csv|txt)\b/gi) || []),
    ...(text.match(/\b(?:SOP|QP|WI|POL|PR|DOC|FRM|REG)[-_ ]?\d+[\w.-]*\b/g) || []),
    ...(text.match(/["“]([^"”]{4,60})["”]/g) || []).map((s) => s.replace(/["“”]/g, '')),
  ]).slice(0, 8);

  // 2-sentence condensed note: lead sentence + extraction recap.
  const firstSentence = (text.split(/(?<=[.!?])\s+/)[0] || text).replace(/\s+/g, ' ').trim();
  const lead = firstSentence.length > 180 ? firstSentence.slice(0, 177).trimEnd() + '…' : firstSentence;
  const parts: string[] = [];
  if (dates.length) parts.push(`${dates.length} date reference${dates.length > 1 ? 's' : ''} (${dates.slice(0, 2).join(', ')}${dates.length > 2 ? '…' : ''})`);
  if (quantities.length) parts.push(`${quantities.length} quantity/metric mention${quantities.length > 1 ? 's' : ''}`);
  if (documents.length) parts.push(`${documents.length} document name${documents.length > 1 ? 's' : ''} (${documents.slice(0, 2).join(', ')}${documents.length > 2 ? '…' : ''})`);
  const second = parts.length > 0
    ? `The evidence contains ${parts.join(', ')}.`
    : 'No explicit dates, quantities or document names were detected — request concrete records.';

  return { dates, quantities, documents, summary: `${sentenceCase(lead)} ${second}` };
};
