/**
 * documentAnalysis.ts — Auto Document Analysis for the Auditee (Audit Client) role.
 *
 * Analyzes an audit document and returns a structured breakdown:
 * Summary · Key Findings · Non-Conformities (Critical/Major/Minor) · Recommendations · Next Steps.
 *
 * Heuristic core works with no API key; Claude produces a richer analysis when configured.
 */
import { complete, isClaudeConfigured } from './claudeClient';

export type NCSeverity = 'Critical' | 'Major' | 'Minor';

export interface NonConformity {
  text: string;
  severity: NCSeverity;
}

export interface DocumentAnalysis {
  summary: string;
  keyFindings: string[];
  nonConformities: NonConformity[];
  recommendations: string[];
  nextSteps: string[];
  source: 'heuristic' | 'claude';
}

/* The system prompt supplied for this feature. */
export const DOC_ANALYSIS_SYSTEM_PROMPT =
  'You are an audit expert AI assistant. Your task is to analyze uploaded audit documents and extract key findings.\n\n' +
  'When analyzing documents:\n' +
  '1. Identify all compliance requirements mentioned\n' +
  '2. Extract non-conformities and areas of concern\n' +
  '3. List positive findings and strengths\n' +
  '4. Highlight critical issues that need immediate attention\n' +
  '5. Summarize in bullet points\n\n' +
  'Return ONLY compact JSON with this exact shape:\n' +
  '{"summary":"2-3 sentences","keyFindings":["..."],' +
  '"nonConformities":[{"text":"...","severity":"Critical|Major|Minor"}],' +
  '"recommendations":["..."],"nextSteps":["..."]}\n' +
  'Be professional, accurate and thorough.';

/* ---------------- Heuristic analyzer ---------------- */
const CRITICAL_CUES = ['critical', 'no evidence', 'not implemented', 'absence of', 'breach', 'safety incident', 'data breach', 'legal', 'regulatory non-compliance', 'systemic', 'no procedure', 'not established'];
const MAJOR_CUES = ['major', 'missing', 'not maintained', 'repeated', 'recurring', 'failure', 'overdue', 'not performed', 'inadequate', 'non-conformity', 'nonconformity', 'non conformance'];
const MINOR_CUES = ['minor', 'isolated', 'incomplete', 'partially', 'not signed', 'not dated', 'inconsistent', 'outdated', 'single instance', 'lapse'];
const STRENGTH_CUES = ['compliant', 'well documented', 'effective', 'strong', 'robust', 'maintained', 'up to date', 'satisfactory', 'good practice', 'conforms', 'in place', 'implemented'];
const COMPLIANCE_CUES = ['iso 9001', 'iso 14001', 'iso 45001', 'iso 27001', 'iso/iec 17021', 'clause', 'requirement', 'policy', 'procedure', 'standard', 'regulation', 'legal requirement', 'audit criteria'];

const splitSentences = (text: string): string[] =>
  text
    .replace(/\r/g, '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

const hasAny = (lc: string, cues: string[]) => cues.some((c) => lc.includes(c));
const cap = (arr: string[], n: number) => Array.from(new Set(arr)).slice(0, n);
const trim = (s: string, n = 200) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export const analyzeDocumentHeuristic = (text: string): DocumentAnalysis => {
  const sentences = splitSentences(text || '');
  const keyFindings: string[] = [];
  const ncs: NonConformity[] = [];
  const recommendations: string[] = [];
  const complianceReqs: string[] = [];

  sentences.forEach((s) => {
    const lc = s.toLowerCase();
    if (hasAny(lc, COMPLIANCE_CUES)) complianceReqs.push(trim(s));
    if (hasAny(lc, STRENGTH_CUES) && !hasAny(lc, MAJOR_CUES) && !hasAny(lc, CRITICAL_CUES)) {
      keyFindings.push(trim(s));
    }
    let sev: NCSeverity | null = null;
    if (hasAny(lc, CRITICAL_CUES)) sev = 'Critical';
    else if (hasAny(lc, MAJOR_CUES)) sev = 'Major';
    else if (hasAny(lc, MINOR_CUES)) sev = 'Minor';
    if (sev) ncs.push({ text: trim(s), severity: sev });
    if (/should|must|recommend|ensure|need to|improve|implement|review|corrective/i.test(s)) {
      recommendations.push(trim(s));
    }
  });

  const critCount = ncs.filter((n) => n.severity === 'Critical').length;
  const majCount = ncs.filter((n) => n.severity === 'Major').length;
  const minCount = ncs.filter((n) => n.severity === 'Minor').length;

  const summary =
    sentences.length === 0
      ? 'No readable content was found in the document.'
      : `Reviewed a document of ~${text.trim().split(/\s+/).length} words covering ${complianceReqs.length} compliance-related point(s). ` +
        `Detected ${ncs.length} potential non-conformit${ncs.length === 1 ? 'y' : 'ies'} ` +
        `(${critCount} critical, ${majCount} major, ${minCount} minor) and ${keyFindings.length} positive finding(s).`;

  const nextSteps: string[] = [];
  if (critCount) nextSteps.push('Escalate and contain the critical issue(s) immediately, then open corrective actions.');
  if (majCount) nextSteps.push('Log major non-conformities and assign owners with due dates.');
  if (minCount) nextSteps.push('Track minor non-conformities for closure at the next review.');
  nextSteps.push('Confirm root-cause analysis and verify effectiveness of corrective actions.');

  return {
    summary,
    keyFindings: cap(keyFindings.length ? keyFindings : complianceReqs, 8),
    nonConformities: ncs.slice(0, 12),
    recommendations: cap(recommendations, 8).length
      ? cap(recommendations, 8)
      : ['Maintain current controls and continue monitoring compliance obligations.'],
    nextSteps,
    source: 'heuristic',
  };
};

/* ---------------- Claude-powered analyzer ---------------- */
export const analyzeDocumentWithClaude = async (
  text: string,
  signal?: AbortSignal
): Promise<DocumentAnalysis | null> => {
  if (!isClaudeConfigured()) return null;
  try {
    const out = await complete(`Analyze this audit document:\n\n"""\n${text.slice(0, 12000)}\n"""`, {
      system: DOC_ANALYSIS_SYSTEM_PROMPT,
      maxTokens: 1300,
      temperature: 0.3,
      signal,
    });
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    const sev = (v: unknown): NCSeverity =>
      v === 'Critical' || v === 'Major' || v === 'Minor' ? v : 'Minor';
    return {
      summary: String(j.summary || '').slice(0, 600),
      keyFindings: Array.isArray(j.keyFindings) ? j.keyFindings.map(String).slice(0, 12) : [],
      nonConformities: Array.isArray(j.nonConformities)
        ? j.nonConformities
            .filter((n: any) => n && (n.text || typeof n === 'string'))
            .map((n: any) => (typeof n === 'string' ? { text: n, severity: 'Minor' as NCSeverity } : { text: String(n.text), severity: sev(n.severity) }))
            .slice(0, 15)
        : [],
      recommendations: Array.isArray(j.recommendations) ? j.recommendations.map(String).slice(0, 12) : [],
      nextSteps: Array.isArray(j.nextSteps) ? j.nextSteps.map(String).slice(0, 12) : [],
      source: 'claude',
    };
  } catch {
    return null;
  }
};

/** Run heuristic instantly, then upgrade with Claude when available. */
export const analyzeDocument = async (text: string, signal?: AbortSignal): Promise<DocumentAnalysis> => {
  const claude = await analyzeDocumentWithClaude(text, signal);
  return claude || analyzeDocumentHeuristic(text);
};
