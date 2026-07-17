/**
 * advancedIntelligence.ts — GenAI / RAG / ML capabilities (per the
 * "CertiSphere AI Features — GenAI, RAG & ML" specification).
 *
 * Everything runs client-side on live cms_* data:
 *  · RAG-lite    — TF-IDF vector retrieval over findings, actions & reports
 *  · ML scoring  — predictive compliance, churn, auditor performance
 *  · NLP         — sentiment analysis, duplicate detection
 *  · Decision AI — certification recommendation with confidence
 *  · Time series — findings trend and trajectory
 */

const safeJSON = <T,>(key: string, fallback: T): T => {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fallback; } catch { return fallback; }
};

/* ================= corpus (RAG knowledge base) ================= */
export interface CorpusDoc { id: string; kind: string; title: string; text: string; ref?: string; }

const flattenFindings = (): any[] => {
  const raw = safeJSON<unknown>('cms_audit_findings_v1', []);
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).flatMap(([cid, list]) =>
      Array.isArray(list) ? list.map((f) => ({ ...(f as object), clientId: cid })) : []);
  }
  return [];
};

export const buildCorpus = (): CorpusDoc[] => {
  const docs: CorpusDoc[] = [];
  flattenFindings().forEach((f: any, i) => docs.push({
    id: `finding-${f.id ?? i}`, kind: 'Finding',
    title: f.title || f.description?.slice(0, 60) || 'Finding',
    text: [f.title, f.description, f.clause, f.standard, f.department, f.severity].filter(Boolean).join(' '),
    ref: f.clause ? `Clause ${f.clause}` : undefined,
  }));
  safeJSON<any[]>('cms_corrective_actions_v1', []).forEach((a, i) => docs.push({
    id: `cap-${a.id ?? i}`, kind: 'Corrective action',
    title: `${a.capId || a.id} — ${a.clientName || ''}`,
    text: [a.description, a.rootCause, a.correctivePlan, a.standard, a.severity, a.auditTitle].filter(Boolean).join(' '),
    ref: a.status,
  }));
  safeJSON<any[]>('cms_audit_reports_v1', []).forEach((r, i) => docs.push({
    id: `report-${r.id ?? i}`, kind: 'Report',
    title: `${r.client || r.organization || 'Report'} — ${r.standard || ''}`,
    text: [r.summary, r.recommendation, r.reviewComment, r.auditType, r.standard].filter(Boolean).join(' '),
    ref: r.status,
  }));
  return docs.filter((d) => d.text.trim().length > 0);
};

/* ================= TF-IDF vector retrieval ================= */
const tokenize = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);

export interface RetrievalHit { doc: CorpusDoc; score: number; }

export const retrieveSimilar = (query: string, k = 5, corpus?: CorpusDoc[]): RetrievalHit[] => {
  const docs = corpus ?? buildCorpus();
  if (docs.length === 0 || !query.trim()) return [];
  const df = new Map<string, number>();
  const docTokens = docs.map((d) => {
    const toks = tokenize(d.text);
    new Set(toks).forEach((t) => df.set(t, (df.get(t) || 0) + 1));
    return toks;
  });
  const N = docs.length;
  const idf = (t: string) => Math.log(1 + N / (1 + (df.get(t) || 0)));
  const vec = (toks: string[]) => {
    const tf = new Map<string, number>();
    toks.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
    const v = new Map<string, number>();
    tf.forEach((n, t) => v.set(t, (n / toks.length) * idf(t)));
    return v;
  };
  const cos = (a: Map<string, number>, b: Map<string, number>) => {
    let dot = 0, na = 0, nb = 0;
    a.forEach((x, t) => { dot += x * (b.get(t) || 0); na += x * x; });
    b.forEach((x) => { nb += x * x; });
    return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
  };
  const qv = vec(tokenize(query));
  return docs.map((d, i) => ({ doc: d, score: cos(qv, vec(docTokens[i])) }))
    .filter((h) => h.score > 0.02)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((h) => ({ ...h, score: Math.round(h.score * 100) / 100 }));
};

/* ================= NLP: duplicate finding detection ================= */
export interface DuplicatePair { a: string; b: string; similarity: number; }
export const detectDuplicateFindings = (threshold = 0.55): DuplicatePair[] => {
  const fs = flattenFindings();
  const out: DuplicatePair[] = [];
  for (let i = 0; i < fs.length; i++) {
    for (let j = i + 1; j < fs.length; j++) {
      const A = new Set(tokenize(fs[i].description || fs[i].title || ''));
      const B = new Set(tokenize(fs[j].description || fs[j].title || ''));
      if (A.size === 0 || B.size === 0) continue;
      let inter = 0; A.forEach((t) => { if (B.has(t)) inter++; });
      const sim = inter / Math.min(A.size, B.size);
      if (sim >= threshold) out.push({
        a: fs[i].title || fs[i].description?.slice(0, 50) || `#${i}`,
        b: fs[j].title || fs[j].description?.slice(0, 50) || `#${j}`,
        similarity: Math.round(sim * 100) / 100,
      });
    }
  }
  return out.slice(0, 8);
};

/* ================= ML: predictive compliance score ================= */
export interface ComplianceScore { score: number; grade: string; trajectory: 'improving' | 'stable' | 'declining'; factors: string[]; }
export const predictComplianceScore = (orgName?: string): ComplianceScore => {
  const actions = safeJSON<any[]>('cms_corrective_actions_v1', [])
    .filter((a) => !orgName || (a.clientName || '').toLowerCase() === orgName.toLowerCase());
  const findings = flattenFindings();
  const today = new Date().toISOString().slice(0, 10);
  let score = 88;
  const factors: string[] = [];
  const majors = actions.filter((a) => /major/i.test(a.severity || '')).length + findings.filter((f) => /major/i.test(f.severity || '')).length;
  const open = actions.filter((a) => a.status === 'Open').length;
  const overdue = actions.filter((a) => a.status !== 'Approved' && a.dueDate && a.dueDate < today).length;
  const closed = actions.filter((a) => a.status === 'Approved').length;
  if (majors) { score -= majors * 9; factors.push(`${majors} major non-conformit${majors > 1 ? 'ies' : 'y'} (−${majors * 9})`); }
  if (open)   { score -= open * 4;  factors.push(`${open} open corrective action(s) (−${open * 4})`); }
  if (overdue){ score -= overdue * 7; factors.push(`${overdue} overdue action(s) (−${overdue * 7})`); }
  if (closed) { score += Math.min(10, closed * 3); factors.push(`${closed} closed action(s) (+${Math.min(10, closed * 3)})`); }
  score = Math.max(5, Math.min(99, score));
  const trajectory = closed > open ? 'improving' : overdue > 0 ? 'declining' : 'stable';
  const grade = score >= 85 ? 'Audit-ready' : score >= 65 ? 'Minor gaps' : score >= 45 ? 'At risk' : 'High risk';
  if (factors.length === 0) factors.push('No negative signals in current data');
  return { score, grade, trajectory, factors };
};

/* ================= Decision AI: certification recommendation ================= */
export interface CertDecision { recommendation: 'Approve' | 'Conditional approval' | 'Reject'; confidence: number; rationale: string[]; }
export const certificationDecision = (client?: string): CertDecision => {
  const actions = safeJSON<any[]>('cms_corrective_actions_v1', [])
    .filter((a) => !client || (a.clientName || '').toLowerCase() === (client || '').toLowerCase());
  const majorsOpen = actions.filter((a) => /major/i.test(a.severity || '') && a.status !== 'Approved').length;
  const minorsOpen = actions.filter((a) => /minor/i.test(a.severity || '') && a.status !== 'Approved').length;
  const rationale: string[] = [];
  let rec: CertDecision['recommendation'] = 'Approve';
  let conf = 0.9;
  if (majorsOpen > 0) {
    rec = 'Reject'; conf = Math.min(0.95, 0.6 + majorsOpen * 0.1);
    rationale.push(`${majorsOpen} major NC(s) still open — certification cannot proceed until closed.`);
  } else if (minorsOpen > 2) {
    rec = 'Conditional approval'; conf = 0.75;
    rationale.push(`${minorsOpen} minor NCs open — approve with a follow-up verification window.`);
  } else {
    rationale.push(minorsOpen ? `${minorsOpen} minor NC(s) open with plans in place.` : 'No open non-conformities.');
    rationale.push('Corrective-action closure history supports certification.');
  }
  return { recommendation: rec, confidence: Math.round(conf * 100) / 100, rationale };
};

/* ================= ML: churn / satisfaction prediction ================= */
export interface ChurnRisk { client: string; risk: number; drivers: string[]; }
export const predictChurn = (): ChurnRisk[] => {
  const clients = safeJSON<any[]>('cms_client_registrations', []);
  const actions = safeJSON<any[]>('cms_corrective_actions_v1', []);
  const today = new Date().toISOString().slice(0, 10);
  return clients.map((c) => {
    const mine = actions.filter((a) => (a.clientName || '').toLowerCase() === (c.organizationName || '').toLowerCase());
    const overdue = mine.filter((a) => a.status !== 'Approved' && a.dueDate && a.dueDate < today).length;
    const majors = mine.filter((a) => /major/i.test(a.severity || '')).length;
    const drivers: string[] = [];
    let risk = 0.12;
    if (overdue) { risk += overdue * 0.2; drivers.push(`${overdue} overdue action(s)`); }
    if (majors)  { risk += majors * 0.15; drivers.push(`${majors} major NC(s)`); }
    if (!c.email) { risk += 0.1; drivers.push('no contact email on file'); }
    if (drivers.length === 0) drivers.push('healthy engagement');
    return { client: c.organizationName || `Client ${c.id}`, risk: Math.min(0.95, Math.round(risk * 100) / 100), drivers };
  }).sort((a, b) => b.risk - a.risk).slice(0, 6);
};

/* ================= NLP: sentiment analysis ================= */
const POS = ['thanks', 'great', 'good', 'excellent', 'happy', 'appreciate', 'smooth', 'helpful', 'satisfied', 'perfect'];
const NEG = ['delay', 'late', 'issue', 'problem', 'unhappy', 'complaint', 'fail', 'urgent', 'frustrat', 'escalat', 'bad', 'poor', 'missing'];
export interface SentimentResult { text: string; sentiment: 'positive' | 'neutral' | 'negative'; score: number; }
export const analyzeSentiment = (text: string): SentimentResult => {
  const t = (text || '').toLowerCase();
  let s = 0;
  POS.forEach((w) => { if (t.includes(w)) s++; });
  NEG.forEach((w) => { if (t.includes(w)) s--; });
  return { text: text.slice(0, 90), sentiment: s > 0 ? 'positive' : s < 0 ? 'negative' : 'neutral', score: s };
};
export const clientSentiment = (): SentimentResult[] =>
  safeJSON<any[]>('cms_client_enquiries_v1', [])
    .filter((e) => e.message)
    .slice(0, 6)
    .map((e) => analyzeSentiment(`${e.company}: ${e.message}`));

/* ================= ML: auditor performance scoring ================= */
export interface AuditorPerformance { name: string; score: number; drivers: string[]; }
export const auditorPerformance = (): AuditorPerformance[] => {
  const auditors = safeJSON<any[]>('cms_auditors', []);
  const schedA = safeJSON<any[]>('cms_audit_schedules', []);
  const schedB = safeJSON<any[]>('cms_audit_schedules_v3', []);
  const schedules = [...schedA, ...schedB];
  return auditors.slice(0, 8).map((a) => {
    const load = schedules.filter((s) => (s.auditor || '') === a.name || (s.leadAuditor || '') === a.name).length;
    const rating = Array.isArray(a.ratings) && a.ratings.length
      ? a.ratings.reduce((x: number, y: number) => x + y, 0) / a.ratings.length : 3.5;
    const skills = Object.keys(a.skills || {}).length;
    const score = Math.min(99, Math.round(rating * 14 + Math.min(load, 6) * 4 + skills * 3));
    const drivers = [`avg rating ${rating.toFixed(1)}`, `${load} assignment(s)`, `${skills} skill area(s)`];
    return { name: a.name, score, drivers };
  }).sort((x, y) => y.score - x.score);
};

/* ================= ML: workload balancing ================= */
export interface WorkloadEntry { name: string; assignments: number; status: 'overloaded' | 'balanced' | 'idle'; }
export const workloadBalance = (): { entries: WorkloadEntry[]; advice: string } => {
  const auditors = safeJSON<any[]>('cms_auditors', []);
  const schedules = [...safeJSON<any[]>('cms_audit_schedules', []), ...safeJSON<any[]>('cms_audit_schedules_v3', [])];
  const entries: WorkloadEntry[] = auditors.map((a) => {
    const n = schedules.filter((s) => s.auditor === a.name || s.leadAuditor === a.name).length;
    const status: WorkloadEntry['status'] = n >= 5 ? 'overloaded' : n === 0 ? 'idle' : 'balanced';
    return { name: a.name, assignments: n, status };
  }).sort((x, y) => y.assignments - x.assignments);
  const over = entries.filter((e) => e.status === 'overloaded');
  const idle = entries.filter((e) => e.status === 'idle');
  const advice = over.length && idle.length
    ? `Rebalance: move work from ${over[0].name} (${over[0].assignments}) to ${idle[0].name} (0).`
    : over.length ? `${over[0].name} is overloaded — consider redistributing.` : 'Workload is reasonably balanced.';
  return { entries: entries.slice(0, 8), advice };
};

/* ================= Time series: findings trend ================= */
export interface TrendPoint { month: string; count: number; }
export const findingsTrend = (): { points: TrendPoint[]; direction: string } => {
  const fs = flattenFindings();
  const byMonth = new Map<string, number>();
  fs.forEach((f) => {
    const d = (f.date || f.createdAt || '').slice(0, 7);
    if (d) byMonth.set(d, (byMonth.get(d) || 0) + 1);
  });
  const points = Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count })).slice(-6);
  let direction = 'stable';
  if (points.length >= 2) {
    const last = points[points.length - 1].count, prev = points[points.length - 2].count;
    direction = last > prev ? 'rising — investigate systemic causes' : last < prev ? 'falling — controls improving' : 'stable';
  }
  return { points, direction };
};
