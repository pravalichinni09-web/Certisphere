/**
 * Audit Intelligence — AI-assisted certification helpers.
 *
 * Each capability has a deterministic heuristic core (works offline, no key)
 * plus an optional Claude refinement when an API key is configured.
 *
 *   1. classifyFinding        — Finding Classifier (Major / Minor / Observation)
 *   2. generateChecklist      — Smart Checklist Generator (standard + industry)
 *   3. predictNonConformance  — Non-Conformance Predictor (per-client risk)
 *   4. planAudits             — AI Audit Planner (what to schedule next)
 *
 * The heuristics read the app's real findings store so results reflect actual data.
 */
import { complete, isClaudeConfigured } from './claudeClient';
import { loadFindings, AuditFinding, FindingCategory } from '../pages/shared/auditAnalysisData';

const safeArr = <T,>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
};

/* =========================================================================
 * 1. FINDING CLASSIFIER
 * =======================================================================*/
export interface FindingClassification {
  category: FindingCategory;
  confidence: number; // 0..1
  rationale: string;
  signals: string[];
}

const MAJOR_CUES = [
  'no procedure', 'not implemented', 'absence of', 'no evidence', 'systemic', 'repeated',
  'recurring', 'failure', 'breach', 'non-existent', 'missing', 'not established',
  'not maintained', 'widespread', 'critical', 'legal', 'regulatory non-compliance',
  'safety incident', 'data breach', 'no records', 'not performed',
];
const MINOR_CUES = [
  'isolated', 'single', 'one instance', 'partially', 'incomplete', 'not fully',
  'minor gap', 'outdated', 'overdue', 'not signed', 'not dated', 'lapse', 'inconsistent',
  'one record', 'a few',
];
const OBSERVATION_CUES = [
  'could improve', 'opportunity', 'recommend', 'consider', 'suggestion', 'potential',
  'best practice', 'might', 'observation', 'enhance', 'streamline',
];

export const classifyFinding = (text: string, standard?: string): FindingClassification => {
  const t = (text || '').toLowerCase();
  if (!t.trim()) {
    return { category: 'Minor', confidence: 0, rationale: 'No finding text provided.', signals: [] };
  }
  const hit = (cues: string[]) => cues.filter((c) => t.includes(c));
  const major = hit(MAJOR_CUES);
  const minor = hit(MINOR_CUES);
  const obs = hit(OBSERVATION_CUES);

  let category: FindingCategory = 'Minor';
  let score = 0;
  const signals: string[] = [];

  if (obs.length && obs.length >= major.length && obs.length >= minor.length) {
    category = 'Observation';
    score = 0.55 + Math.min(0.4, obs.length * 0.12);
    signals.push(...obs.slice(0, 3));
  } else if (major.length > minor.length) {
    category = 'Major';
    score = 0.6 + Math.min(0.38, major.length * 0.12);
    signals.push(...major.slice(0, 3));
  } else if (minor.length) {
    category = 'Minor';
    score = 0.55 + Math.min(0.4, minor.length * 0.12);
    signals.push(...minor.slice(0, 3));
  } else {
    category = 'Minor';
    score = 0.4;
  }

  const rationale =
    category === 'Major'
      ? 'Language indicates a systemic gap or absence of a required control — typically a Major non-conformity.'
      : category === 'Observation'
      ? 'Wording suggests an improvement opportunity rather than a non-conformity (OFI / Observation).'
      : 'Appears to be an isolated or partial lapse against a requirement — typically a Minor non-conformity.';

  return {
    category,
    confidence: Math.min(0.97, score),
    rationale: standard ? `${rationale} (Assessed against ${standard}.)` : rationale,
    signals,
  };
};

export const classifyFindingWithClaude = async (
  text: string,
  standard?: string,
  signal?: AbortSignal
): Promise<FindingClassification | null> => {
  if (!isClaudeConfigured()) return null;
  const system =
    'You are a lead ISO auditor classifying an audit finding. Respond ONLY as compact JSON: ' +
    '{"category":"Major|Minor|Observation","confidence":0-1,"rationale":"one sentence","signals":["..."]}. ' +
    'Major = systemic failure or absent required control; Minor = isolated lapse; Observation = improvement opportunity (OFI).';
  const prompt = `Standard: ${standard || 'unspecified'}\nFinding note:\n${text}`;
  try {
    const out = await complete(prompt, { system, maxTokens: 300, temperature: 0.2, signal });
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    const cat = ['Major', 'Minor', 'Observation'].includes(j.category) ? j.category : 'Minor';
    return {
      category: cat,
      confidence: Math.max(0, Math.min(1, Number(j.confidence) || 0.7)),
      rationale: String(j.rationale || '').slice(0, 240),
      signals: Array.isArray(j.signals) ? j.signals.slice(0, 4).map(String) : [],
    };
  } catch {
    return null;
  }
};

/* =========================================================================
 * 2. SMART CHECKLIST GENERATOR
 * =======================================================================*/
export interface ChecklistItem {
  clause: string;
  item: string;
  focus: string;
}

type StandardKey = 'ISO 9001' | 'ISO 14001' | 'ISO 45001' | 'ISO 27001' | 'GENERIC';

const normaliseStandard = (s: string): StandardKey => {
  const u = (s || '').toUpperCase();
  if (u.includes('9001')) return 'ISO 9001';
  if (u.includes('14001')) return 'ISO 14001';
  if (u.includes('45001')) return 'ISO 45001';
  if (u.includes('27001')) return 'ISO 27001';
  return 'GENERIC';
};

const BASE: Record<StandardKey, ChecklistItem[]> = {
  'ISO 9001': [
    { clause: '4.1', item: 'Context of the organization defined and monitored', focus: 'Internal/external issues register up to date' },
    { clause: '5.1', item: 'Top-management leadership & commitment evidence', focus: 'Quality policy communicated and understood' },
    { clause: '6.1', item: 'Risks & opportunities addressed', focus: 'Actions planned and effectiveness evaluated' },
    { clause: '7.1.5', item: 'Monitoring & measuring resources calibrated', focus: 'Calibration records and traceability' },
    { clause: '8.5', item: 'Production / service provision controlled', focus: 'Process controls, identification & traceability' },
    { clause: '9.2', item: 'Internal audit programme executed', focus: 'Coverage, independence, follow-up' },
    { clause: '10.2', item: 'Nonconformity & corrective action', focus: 'Root-cause rigor and verification of effectiveness' },
  ],
  'ISO 14001': [
    { clause: '4.2', item: 'Needs of interested parties (environmental)', focus: 'Compliance obligations captured' },
    { clause: '6.1.2', item: 'Environmental aspects & impacts evaluated', focus: 'Significance methodology and register' },
    { clause: '6.1.3', item: 'Compliance obligations identified', focus: 'Legal register current; evaluation of compliance' },
    { clause: '8.1', item: 'Operational planning & control', focus: 'Controls for significant aspects' },
    { clause: '8.2', item: 'Emergency preparedness & response', focus: 'Tested scenarios and records' },
    { clause: '9.1.2', item: 'Evaluation of compliance', focus: 'Frequency and corrective follow-up' },
  ],
  'ISO 45001': [
    { clause: '5.4', item: 'Worker consultation & participation', focus: 'Mechanisms and evidence of participation' },
    { clause: '6.1.2', item: 'Hazard identification & risk assessment', focus: 'Methodology, coverage, residual risk' },
    { clause: '8.1.2', item: 'Eliminating hazards / reducing OH&S risks', focus: 'Hierarchy of controls applied' },
    { clause: '8.2', item: 'Emergency preparedness & response', focus: 'Drills, equipment, records' },
    { clause: '9.1', item: 'Monitoring, measurement & evaluation', focus: 'Incident metrics and leading indicators' },
    { clause: '10.2', item: 'Incident, nonconformity & corrective action', focus: 'Investigation depth and timeliness' },
  ],
  'ISO 27001': [
    { clause: 'A.5', item: 'Information security policies', focus: 'Approved, communicated, reviewed' },
    { clause: 'A.6', item: 'Organization of information security', focus: 'Roles, segregation of duties' },
    { clause: 'A.8', item: 'Asset management', focus: 'Inventory, classification, handling' },
    { clause: 'A.9', item: 'Access control', focus: 'Least privilege, reviews, MFA' },
    { clause: 'A.12', item: 'Operations security', focus: 'Logging, malware, backups' },
    { clause: 'A.16', item: 'Incident management', focus: 'Detection, response, lessons learned' },
    { clause: '9.3', item: 'Management review', focus: 'Inputs/outputs including risk treatment' },
  ],
  GENERIC: [
    { clause: '5.1', item: 'Leadership & commitment', focus: 'Policy and objectives evidence' },
    { clause: '6.1', item: 'Risk-based planning', focus: 'Risks/opportunities and actions' },
    { clause: '7.2', item: 'Competence & training', focus: 'Records and effectiveness' },
    { clause: '9.2', item: 'Internal audit', focus: 'Programme and follow-up' },
    { clause: '10.2', item: 'Corrective action', focus: 'Root cause and verification' },
  ],
};

const INDUSTRY_FOCUS: { match: string[]; items: ChecklistItem[] }[] = [
  { match: ['software', 'it', 'tech', 'saas'], items: [
    { clause: 'A.14', item: 'Secure development lifecycle', focus: 'Code review, SAST/DAST, change control' },
    { clause: '8.5', item: 'Release & deployment control', focus: 'CI/CD approvals and rollback' },
  ]},
  { match: ['manufactur', 'factory', 'production', 'plant'], items: [
    { clause: '7.1.5', item: 'Equipment calibration & maintenance', focus: 'Preventive maintenance records' },
    { clause: '8.6', item: 'Release of products', focus: 'Inspection & test acceptance criteria' },
  ]},
  { match: ['food', 'beverage', 'agri'], items: [
    { clause: '8.5.1', item: 'Hygiene & contamination controls', focus: 'HACCP linkage, cleaning records' },
  ]},
  { match: ['health', 'hospital', 'pharma', 'medical'], items: [
    { clause: '8.5', item: 'Patient/sample handling controls', focus: 'Traceability and sterilisation records' },
  ]},
  { match: ['construct', 'energy', 'oil', 'mining'], items: [
    { clause: '8.1.2', item: 'High-risk work permits', focus: 'Permit-to-work and contractor control' },
  ]},
];

export const generateChecklist = (standard: string, industry?: string): ChecklistItem[] => {
  const key = normaliseStandard(standard);
  const base = [...BASE[key]];
  const ind = (industry || '').toLowerCase();
  if (ind) {
    for (const grp of INDUSTRY_FOCUS) {
      if (grp.match.some((m) => ind.includes(m))) base.push(...grp.items);
    }
  }
  return base;
};

export const generateChecklistWithClaude = async (
  standard: string,
  industry?: string,
  signal?: AbortSignal
): Promise<ChecklistItem[] | null> => {
  if (!isClaudeConfigured()) return null;
  const system =
    'You are an ISO lead auditor. Produce a focused audit checklist as JSON array only: ' +
    '[{"clause":"x.x","item":"what to audit","focus":"what evidence to seek"}]. 8-12 rows, specific to the standard and industry.';
  const prompt = `Standard: ${standard}\nClient industry: ${industry || 'general'}`;
  try {
    const out = await complete(prompt, { system, maxTokens: 1100, temperature: 0.3, signal });
    const m = out.match(/\[[\s\S]*\]/);
    if (!m) return null;
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return null;
    return arr
      .filter((r: any) => r && (r.item || r.clause))
      .slice(0, 14)
      .map((r: any) => ({
        clause: String(r.clause || '—'),
        item: String(r.item || '').slice(0, 160),
        focus: String(r.focus || '').slice(0, 160),
      }));
  } catch {
    return null;
  }
};

/* =========================================================================
 * 3. NON-CONFORMANCE PREDICTOR
 * =======================================================================*/
export interface NCPrediction {
  client: string;
  riskScore: number; // 0..100
  level: 'High' | 'Medium' | 'Low';
  drivers: string[];
  likelyAreas: string[];
}

const monthsSince = (dateStr: string): number => {
  const d = new Date(dateStr).getTime();
  if (isNaN(d)) return 99;
  return (Date.now() - d) / (1000 * 60 * 60 * 24 * 30);
};

export const predictNonConformance = (findings?: AuditFinding[]): NCPrediction[] => {
  const data = findings || loadFindings();
  const byClient = new Map<string, AuditFinding[]>();
  for (const f of data) {
    if (!byClient.has(f.client)) byClient.set(f.client, []);
    byClient.get(f.client)!.push(f);
  }
  const out: NCPrediction[] = [];
  for (const [client, fs] of byClient) {
    const total = fs.length;
    const majors = fs.filter((f) => f.category === 'Major').length;
    const open = fs.filter((f) => f.status !== 'Closed').length;
    const recent = fs.filter((f) => monthsSince(f.date) <= 12).length;
    // recurring departments / clauses
    const deptCount = new Map<string, number>();
    fs.forEach((f) => deptCount.set(f.department, (deptCount.get(f.department) || 0) + 1));
    const recurringDepts = [...deptCount.entries()].filter(([, c]) => c >= 2).map(([d]) => d);

    let score = 0;
    const drivers: string[] = [];
    if (majors > 0) { score += Math.min(40, majors * 14); drivers.push(`${majors} prior major NC${majors > 1 ? 's' : ''}`); }
    if (open > 0) { score += Math.min(25, open * 7); drivers.push(`${open} finding(s) still open`); }
    if (recent > 0) { score += Math.min(20, recent * 4); drivers.push(`${recent} finding(s) in last 12 months`); }
    if (recurringDepts.length) { score += Math.min(20, recurringDepts.length * 8); drivers.push(`recurring issues in ${recurringDepts.slice(0, 2).join(', ')}`); }
    if (total >= 5) { score += 8; }
    score = Math.max(5, Math.min(100, Math.round(score)));

    const level: NCPrediction['level'] = score >= 66 ? 'High' : score >= 36 ? 'Medium' : 'Low';
    const likelyAreas = recurringDepts.length
      ? recurringDepts.slice(0, 3)
      : [...new Set(fs.map((f) => f.department))].slice(0, 3);

    out.push({ client, riskScore: score, level, drivers: drivers.length ? drivers : ['Limited history — baseline risk'], likelyAreas });
  }
  return out.sort((a, b) => b.riskScore - a.riskScore);
};

/* =========================================================================
 * 4. AI AUDIT PLANNER
 * =======================================================================*/
export interface AuditPlanItem {
  client: string;
  priority: 'Urgent' | 'Soon' | 'Routine';
  suggestedWindow: string;
  reason: string;
  standardHint?: string;
  suggestedAuditor?: string;
}

export const planAudits = (findings?: AuditFinding[]): AuditPlanItem[] => {
  const data = findings || loadFindings();
  const predictions = predictNonConformance(data);
  const auditors = safeArr<any>('cms_auditors').concat(safeArr<any>('cms_auditors_data'));
  const auditorNames = auditors.map((a) => a?.name).filter(Boolean) as string[];

  const lastAuditByClient = new Map<string, string>();
  const standardByClient = new Map<string, string>();
  for (const f of data) {
    const prev = lastAuditByClient.get(f.client);
    if (!prev || new Date(f.date) > new Date(prev)) lastAuditByClient.set(f.client, f.date);
    if (!standardByClient.has(f.client)) standardByClient.set(f.client, f.standard);
  }

  let ai = 0;
  return predictions.map((p) => {
    const last = lastAuditByClient.get(p.client);
    const ageM = last ? monthsSince(last) : 99;
    let priority: AuditPlanItem['priority'] = 'Routine';
    let window = 'Next 90 days';
    const reasons: string[] = [];

    if (p.level === 'High' || ageM >= 11) { priority = 'Urgent'; window = 'Next 30 days'; }
    else if (p.level === 'Medium' || ageM >= 8) { priority = 'Soon'; window = 'Next 60 days'; }

    if (p.level !== 'Low') reasons.push(`${p.level.toLowerCase()} predicted NC risk (${p.riskScore})`);
    if (ageM >= 8) reasons.push(`~${Math.round(ageM)} months since last audit`);
    if (!reasons.length) reasons.push('Routine surveillance cadence');

    const suggestedAuditor = auditorNames.length ? auditorNames[ai++ % auditorNames.length] : undefined;
    return {
      client: p.client,
      priority,
      suggestedWindow: window,
      reason: reasons.join(' · '),
      standardHint: standardByClient.get(p.client),
      suggestedAuditor,
    };
  }).sort((a, b) => {
    const rank = { Urgent: 0, Soon: 1, Routine: 2 } as const;
    return rank[a.priority] - rank[b.priority];
  });
};

/* =========================================================================
 * 5. NC PREDICTOR — Claude-enhanced narrative analysis
 * =======================================================================*/
export interface NCAnalysis {
  summary: string;
  topRisks: string[];
  recommendations: string[];
}

export const analyseNCWithClaude = async (
  predictions: NCPrediction[],
  signal?: AbortSignal
): Promise<NCAnalysis | null> => {
  if (!predictions.length) return null;
  const system =
    'You are a senior ISO certification auditor. Given a risk summary of clients, provide a brief strategic analysis. ' +
    'Respond ONLY as JSON: {"summary":"2-3 sentence overview","topRisks":["...","...","..."],"recommendations":["...","...","..."]}. ' +
    'Be specific, concise, and actionable.';
  const data = predictions.slice(0, 8).map(p =>
    `${p.client}: Risk=${p.level} (${p.riskScore}/100), Drivers=${p.drivers.join(', ')}, Areas=${p.likelyAreas.join(', ')}`
  ).join('\n');
  const prompt = `NC Risk Predictions:\n${data}\n\nProvide strategic analysis.`;
  try {
    const out = await (await import('./claudeClient')).complete(prompt, {
      system, maxTokens: 600, temperature: 0.35, signal
    });
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    return {
      summary: String(j.summary || '').slice(0, 400),
      topRisks: Array.isArray(j.topRisks) ? j.topRisks.slice(0, 5).map(String) : [],
      recommendations: Array.isArray(j.recommendations) ? j.recommendations.slice(0, 5).map(String) : [],
    };
  } catch { return null; }
};

/* =========================================================================
 * 6. AI AUDIT PLANNER — Claude-enhanced schedule suggestions
 * =======================================================================*/
export const planAuditsWithClaude = async (
  plan: AuditPlanItem[],
  signal?: AbortSignal
): Promise<string | null> => {
  if (!plan.length) return null;
  const system =
    'You are an ISO audit scheduling specialist. Review this audit plan and provide prioritised scheduling advice. ' +
    'Be concise — 3-5 sentences covering top priorities, resource allocation, and scheduling conflicts to watch.';
  const data = plan.slice(0, 8).map(p =>
    `${p.client}: ${p.priority} | Window: ${p.suggestedWindow} | ${p.reason}${p.suggestedAuditor ? ` | Auditor: ${p.suggestedAuditor}` : ''}`
  ).join('\n');
  const prompt = `Proposed Audit Schedule:\n${data}\n\nProvide scheduling recommendations.`;
  try {
    const out = await (await import('./claudeClient')).complete(prompt, {
      system, maxTokens: 400, temperature: 0.3, signal
    });
    return out.trim();
  } catch { return null; }
};

/* =========================================================================
 * 7. AI REPORT WRITER — full streaming audit report draft
 * =======================================================================*/
export interface ReportContext {
  clientName: string;
  standard: string;
  auditDate: string;
  auditType: 'Initial' | 'Surveillance' | 'Recertification' | 'Special';
  scope: string;
  leadAuditor: string;
  findings: string; // free-text or structured
  overallResult: 'Conforming' | 'Minor NCs' | 'Major NCs' | 'Not Recommended';
}

export const generateReportHeuristic = (ctx: ReportContext): string => {
  const date = ctx.auditDate || new Date().toLocaleDateString('en-GB');
  return `AUDIT REPORT — DRAFT

Client:         ${ctx.clientName || 'N/A'}
Standard:       ${ctx.standard || 'N/A'}
Audit Type:     ${ctx.auditType || 'N/A'}
Audit Date:     ${date}
Lead Auditor:   ${ctx.leadAuditor || 'N/A'}
Overall Result: ${ctx.overallResult || 'N/A'}

1. SCOPE
${ctx.scope || 'The audit covered the management system as defined in the client\'s quality manual.'}

2. AUDIT SUMMARY
The ${ctx.auditType?.toLowerCase()} audit of ${ctx.clientName} was conducted on ${date} against ${ctx.standard}. ${
  ctx.overallResult === 'Conforming'
    ? 'The organization demonstrated effective implementation and maintenance of its management system. No non-conformities were identified.'
    : ctx.overallResult === 'Minor NCs'
    ? 'The organization\'s management system is generally effective. Minor non-conformities were identified and corrective action is required.'
    : ctx.overallResult === 'Major NCs'
    ? 'Significant gaps were identified in the management system. Major non-conformities require immediate corrective action before certification can proceed.'
    : 'The management system does not meet the requirements of the standard. Certification is not recommended at this time.'
}

3. FINDINGS
${ctx.findings || 'No findings recorded.'}

4. CONCLUSION
[To be completed by Lead Auditor]

5. SIGNATURES
Lead Auditor: ________________________   Date: __________
Client Representative: _______________   Date: __________`;
};

export const generateReportWithClaude = async (
  ctx: ReportContext,
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string | null> => {
  const system =
    'You are a professional ISO lead auditor. Write a formal, structured audit report. ' +
    'Use professional certification body language. Include: Executive Summary, Scope, ' +
    'Audit Process, Findings Summary, Detailed Findings, Conclusion, and Recommendations. ' +
    'Be thorough but concise. Format with clear section headers.';
  const prompt = `Write a complete audit report for:\n
Client: ${ctx.clientName}
Standard: ${ctx.standard}
Audit Type: ${ctx.auditType}
Audit Date: ${ctx.auditDate}
Lead Auditor: ${ctx.leadAuditor}
Audit Scope: ${ctx.scope}
Overall Result: ${ctx.overallResult}
Findings / Notes: ${ctx.findings || 'No specific findings noted.'}`;

  const apiKey = (await import('./claudeClient')).getApiKey();
  if (!apiKey) return null;
  const model = (await import('./claudeClient')).getModel();

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1800,
        temperature: 0.4,
        stream: true,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal,
    });

    if (!res.ok || !res.body) return null;

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = dec.decode(value).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') break;
        try {
          const ev = JSON.parse(raw);
          const delta = ev?.delta?.text || '';
          if (delta) { full += delta; onChunk?.(delta); }
        } catch { /* ignore parse errors */ }
      }
    }
    return full || null;
  } catch { return null; }
};

/* =========================================================================
 * 8. CERTIFICATE EXPIRY RISK SCORER
 * =======================================================================*/
export interface CertRisk {
  client: string;
  expiryDate: string;
  daysLeft: number;
  risk: 'Critical' | 'High' | 'Medium' | 'Low';
  action: string;
}

export const scoreCertExpiryRisk = (): CertRisk[] => {
  const certs = safeArr<any>('cms_certificates');
  const now = Date.now();
  const results: CertRisk[] = [];
  for (const c of certs) {
    const exp = new Date(c.expiryDate || c.expiry_date || '').getTime();
    if (isNaN(exp)) continue;
    const daysLeft = Math.round((exp - now) / 86400000);
    let risk: CertRisk['risk'] = 'Low';
    let action = 'No action needed — schedule routine surveillance.';
    if (daysLeft < 0) { risk = 'Critical'; action = 'EXPIRED — immediate recertification required.'; }
    else if (daysLeft <= 30) { risk = 'Critical'; action = 'Expires within 30 days — initiate recertification now.'; }
    else if (daysLeft <= 90) { risk = 'High'; action = 'Expires within 90 days — schedule recertification audit.'; }
    else if (daysLeft <= 180) { risk = 'Medium'; action = 'Expires within 6 months — plan surveillance audit.'; }
    results.push({
      client: c.clientName || c.company || `Cert #${c.id}`,
      expiryDate: c.expiryDate || c.expiry_date || '—',
      daysLeft,
      risk,
      action,
    });
  }
  return results.sort((a, b) => a.daysLeft - b.daysLeft);
};
