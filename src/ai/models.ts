/**
 * models.ts — CertiSphere in-app AI MODEL LAYER.
 *
 * Real, trainable models running client-side on live cms_* data:
 *  · NaiveBayesClassifier — severity classifier trained on the live corpus,
 *    persisted to localStorage and retrainable at any time
 *  · k-means clustering    — groups findings into systemic-issue clusters
 *  · Holt forecasting      — time-series prediction of findings volume
 *  · VectorIndex           — 256-dim hashed embeddings + cosine search
 *    (a persistent mini vector DB, incrementally rebuilt from live data)
 *  · kNN recommender       — corrective-action recommendations
 *  · RAG pipeline          — retrieval-grounded answers; upgrades to Claude
 *    generation with retrieved context when an API key is configured
 */
import { buildCorpus, CorpusDoc } from './advancedIntelligence';
import { completeSafe, isClaudeConfigured } from './claudeClient';

const safeJSON = <T,>(key: string, fallback: T): T => {
  try { const r = localStorage.getItem(key); if (!r) return fallback; const v = JSON.parse(r); return (Array.isArray(v) ? v.filter((x: unknown) => x != null) : v) as T; } catch { return fallback; }
};
/** Array-guaranteed read (some keys hold objects/maps, not arrays). */
const arr = (key: string): any[] => { const v = safeJSON<any>(key, []); return Array.isArray(v) ? v : []; };
const tokenize = (s: string): string[] =>
  (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);

/* ═══════════════ 1. Naive Bayes severity classifier ═══════════════ */
export interface NBModel {
  classes: Record<string, number>;                    // class -> doc count
  wordCounts: Record<string, Record<string, number>>; // class -> word -> count
  totals: Record<string, number>;                     // class -> total words
  vocab: number;
  trainedAt: string;
  samples: number;
}
const NB_KEY = 'cms_ai_model_severity_nb_v1';

export const trainSeverityModel = (): NBModel => {
  // Assemble labelled training set from live findings + corrective actions
  const rows: Array<{ text: string; label: string }> = [];
  const norm = (sev: string): string =>
    /major/i.test(sev) ? 'Major NC' : /minor/i.test(sev) ? 'Minor NC' : /(ofi|opportun)/i.test(sev) ? 'OFI' : 'Observation';
  const rawFindings = safeJSON<unknown>('cms_audit_findings_v1', []);
  const flat: any[] = (Array.isArray(rawFindings)
    ? rawFindings
    : Object.values(rawFindings as Record<string, unknown>).flatMap((l) => (Array.isArray(l) ? l : []))
  ).filter((f) => f && typeof f === 'object');
  flat.forEach((f: any) => {
    if (f?.description && (f.severity || f.category)) rows.push({ text: f.description, label: norm(f.severity || f.category) });
  });
  arr('cms_corrective_actions_v1').filter((a) => a && typeof a === 'object').forEach((a) => {
    if (a?.description && a.severity) rows.push({ text: a.description, label: norm(a.severity) });
  });
  // Bootstrap corpus so the model always has a floor of ISO knowledge
  const BOOTSTRAP: Array<[string, string]> = [
    ['complete breakdown of documented process no records maintained systemic failure', 'Major NC'],
    ['management review not conducted for over a year requirement absent', 'Major NC'],
    ['certification requirement missing entirely no procedure exists', 'Major NC'],
    ['single record missing isolated lapse in otherwise effective process', 'Minor NC'],
    ['work instruction outdated at one station process otherwise compliant', 'Minor NC'],
    ['calibration sticker expired on one gauge others current', 'Minor NC'],
    ['process could be streamlined consider automating the checklist', 'OFI'],
    ['opportunity to improve training matrix visibility best practice suggestion', 'OFI'],
    ['observed good housekeeping noted minor documentation inconsistency to monitor', 'Observation'],
    ['staff aware of policy verbal knowledge strong documentation adequate', 'Observation'],
  ];
  BOOTSTRAP.forEach(([text, label]) => rows.push({ text, label }));

  const model: NBModel = { classes: {}, wordCounts: {}, totals: {}, vocab: 0, trainedAt: new Date().toISOString(), samples: rows.length };
  const vocab = new Set<string>();
  rows.forEach(({ text, label }) => {
    model.classes[label] = (model.classes[label] || 0) + 1;
    model.wordCounts[label] = model.wordCounts[label] || {};
    tokenize(text).forEach((w) => {
      vocab.add(w);
      model.wordCounts[label][w] = (model.wordCounts[label][w] || 0) + 1;
      model.totals[label] = (model.totals[label] || 0) + 1;
    });
  });
  model.vocab = vocab.size;
  try { localStorage.setItem(NB_KEY, JSON.stringify(model)); } catch { /* ignore */ }
  return model;
};

export const getSeverityModel = (): NBModel => {
  const cached = safeJSON<NBModel | null>(NB_KEY, null);
  return cached && cached.samples ? cached : trainSeverityModel();
};

export interface NBPrediction { label: string; confidence: number; probabilities: Record<string, number>; modelInfo: string; }
export const predictSeverity = (text: string): NBPrediction => {
  const m = getSeverityModel();
  const words = tokenize(text);
  const totalDocs = Object.values(m.classes).reduce((a, b) => a + b, 0) || 1;
  const logp: Record<string, number> = {};
  Object.keys(m.classes).forEach((c) => {
    let lp = Math.log(m.classes[c] / totalDocs);
    words.forEach((w) => {
      const count = m.wordCounts[c]?.[w] || 0;
      lp += Math.log((count + 1) / ((m.totals[c] || 0) + m.vocab + 1));
    });
    logp[c] = lp;
  });
  const max = Math.max(...Object.values(logp));
  const exp: Record<string, number> = {};
  let sum = 0;
  Object.entries(logp).forEach(([c, lp]) => { exp[c] = Math.exp(lp - max); sum += exp[c]; });
  const probabilities: Record<string, number> = {};
  Object.entries(exp).forEach(([c, v]) => { probabilities[c] = Math.round((v / sum) * 100) / 100; });
  const label = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0];
  return { label, confidence: probabilities[label], probabilities, modelInfo: `Naive Bayes · ${m.samples} samples · vocab ${m.vocab} · trained ${m.trainedAt.slice(0, 10)}` };
};

/* ═══════════════ 2. Hashed-embedding vector index (mini vector DB) ═══════════════ */
const DIM = 256;
const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
};
/** Feature-hashed embedding over words + bigrams. */
export const embed = (text: string): Float64Array => {
  const v = new Float64Array(DIM);
  const toks = tokenize(text);
  toks.forEach((t, i) => {
    v[hash(t) % DIM] += 1;
    if (i < toks.length - 1) v[hash(t + '_' + toks[i + 1]) % DIM] += 0.6;
  });
  let n = 0; for (let i = 0; i < DIM; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= n;
  return v;
};
const cosine = (a: Float64Array, b: Float64Array): number => {
  let d = 0; for (let i = 0; i < DIM; i++) d += a[i] * b[i];
  return d;
};

interface IndexedDoc { doc: CorpusDoc; vec: number[]; }
let memIndex: { docs: IndexedDoc[]; size: number } | null = null;

export const ensureVectorIndex = (): { size: number; dim: number } => {
  const corpus = buildCorpus();
  if (!memIndex || memIndex.size !== corpus.length) {
    memIndex = { docs: corpus.map((doc) => ({ doc, vec: Array.from(embed(doc.text)) })), size: corpus.length };
  }
  return { size: memIndex.size, dim: DIM };
};

export interface VectorHit { title: string; kind: string; similarity: number; ref?: string; }
export const vectorSearch = (query: string, k = 5): VectorHit[] => {
  ensureVectorIndex();
  if (!memIndex || memIndex.docs.length === 0) return [];
  const qv = embed(query);
  return memIndex.docs
    .map((d) => ({ title: d.doc.title, kind: d.doc.kind, ref: d.doc.ref, similarity: Math.round(cosine(qv, Float64Array.from(d.vec)) * 100) / 100 }))
    .filter((h) => h.similarity > 0.05)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
};

/* ═══════════════ 3. k-means clustering of findings ═══════════════ */
export interface Cluster { label: string; size: number; topTerms: string[]; members: string[]; }
export const clusterFindings = (k = 3): Cluster[] => {
  ensureVectorIndex();
  const docs = (memIndex?.docs || []).filter((d) => d.doc.kind === 'Finding' || d.doc.kind === 'Corrective action');
  if (docs.length === 0) return [];
  const kk = Math.min(k, docs.length);
  // init centroids spread across the set
  let centroids = Array.from({ length: kk }, (_, i) => Float64Array.from(docs[Math.floor((i * docs.length) / kk)].vec));
  let assign = new Array(docs.length).fill(0);
  for (let iter = 0; iter < 8; iter++) {
    assign = docs.map((d) => {
      let best = 0, bs = -Infinity;
      centroids.forEach((c, ci) => { const s = cosine(Float64Array.from(d.vec), c); if (s > bs) { bs = s; best = ci; } });
      return best;
    });
    centroids = centroids.map((_, ci) => {
      const members = docs.filter((_, di) => assign[di] === ci);
      const v = new Float64Array(DIM);
      members.forEach((m) => { for (let i = 0; i < DIM; i++) v[i] += m.vec[i]; });
      let n = 0; for (let i = 0; i < DIM; i++) n += v[i] * v[i];
      n = Math.sqrt(n) || 1;
      for (let i = 0; i < DIM; i++) v[i] /= n;
      return v;
    });
  }
  return Array.from({ length: kk }, (_, ci) => {
    const members = docs.filter((_, di) => assign[di] === ci);
    const termCount = new Map<string, number>();
    members.forEach((m) => tokenize(m.doc.text).forEach((t) => termCount.set(t, (termCount.get(t) || 0) + 1)));
    const topTerms = Array.from(termCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t);
    return {
      label: topTerms.length ? `Systemic theme: ${topTerms.slice(0, 2).join(' / ')}` : `Cluster ${ci + 1}`,
      size: members.length,
      topTerms,
      members: members.slice(0, 3).map((m) => m.doc.title),
    };
  }).filter((c) => c.size > 0).sort((a, b) => b.size - a.size);
};

/* ═══════════════ 4. Holt double-exponential forecast ═══════════════ */
export interface ForecastResult { history: Array<{ month: string; count: number }>; forecast: Array<{ month: string; predicted: number }>; reading: string; }
export const forecastFindings = (horizon = 3): ForecastResult => {
  const raw = safeJSON<unknown>('cms_audit_findings_v1', []);
  const flat: any[] = (Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>).flatMap((l) => (Array.isArray(l) ? l : []))).filter((f) => f && typeof f === 'object');
  const actions = arr('cms_corrective_actions_v1');
  const byMonth = new Map<string, number>();
  [...flat, ...actions].filter((f) => f && typeof f === 'object').forEach((f: any) => {
    const d = (f.date || f.createdAt || f.dueDate || '').slice(0, 7);
    if (d) byMonth.set(d, (byMonth.get(d) || 0) + 1);
  });
  const history = Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }));
  if (history.length < 2) {
    return { history, forecast: [], reading: 'Not enough monthly history to fit the model yet — log more findings.' };
  }
  // Holt's linear method
  const alpha = 0.5, beta = 0.3;
  let level = history[0].count, trend = history[1].count - history[0].count;
  for (let i = 1; i < history.length; i++) {
    const prevLevel = level;
    level = alpha * history[i].count + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const lastMonth = history[history.length - 1].month;
  const nextMonth = (m: string, add: number): string => {
    const [y, mo] = m.split('-').map(Number);
    const d = new Date(y, mo - 1 + add, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const forecast = Array.from({ length: horizon }, (_, h) => ({
    month: nextMonth(lastMonth, h + 1),
    predicted: Math.max(0, Math.round((level + trend * (h + 1)) * 10) / 10),
  }));
  const dirNum = forecast[forecast.length - 1].predicted - history[history.length - 1].count;
  const reading = dirNum > 0.5
    ? `Model projects findings RISING to ~${forecast[forecast.length - 1].predicted}/month — schedule preventive reviews.`
    : dirNum < -0.5
      ? `Model projects findings FALLING to ~${forecast[forecast.length - 1].predicted}/month — controls are working.`
      : 'Model projects a stable findings rate.';
  return { history: history.slice(-6), forecast, reading };
};

/* ═══════════════ 5. kNN corrective-action recommender ═══════════════ */
export interface ActionRecommendation { forFinding: string; recommended: string; basis: string; similarity: number; }
export const recommendActions = (findingText: string, k = 3): ActionRecommendation[] => {
  ensureVectorIndex();
  const caps = (memIndex?.docs || []).filter((d) => d.doc.kind === 'Corrective action');
  if (caps.length === 0) return [];
  const qv = embed(findingText);
  return caps
    .map((d) => ({ d, s: cosine(qv, Float64Array.from(d.vec)) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .filter((x) => x.s > 0.03)
    .map((x) => ({
      forFinding: findingText.slice(0, 60),
      recommended: x.d.doc.text.slice(0, 160),
      basis: x.d.doc.title,
      similarity: Math.round(x.s * 100) / 100,
    }));
};

/* ═══════════════ 6. RAG pipeline (retrieval → grounded generation) ═══════════════ */
export interface RAGAnswer { answer: string; sources: Array<{ title: string; kind: string; similarity: number }>; generator: 'heuristic' | 'claude'; }
export const ragAnswer = (question: string, k = 4): RAGAnswer => {
  const hits = vectorSearch(question, k);
  if (hits.length === 0) {
    return { answer: 'No relevant context found in the knowledge base yet. Log findings, actions or reports first.', sources: [], generator: 'heuristic' };
  }
  const answer =
    `Based on ${hits.length} retrieved record(s): the most relevant is “${hits[0].title}” (${hits[0].kind}, similarity ${hits[0].similarity}). ` +
    (hits[1] ? `Related context includes “${hits[1].title}”. ` : '') +
    'Review the cited records for the applicable clauses and previously accepted corrective approaches.';
  return { answer, sources: hits.map((h) => ({ title: h.title, kind: h.kind, similarity: h.similarity })), generator: 'heuristic' };
};

export const ragAnswerWithClaude = async (question: string, k = 4): Promise<RAGAnswer> => {
  const base = ragAnswer(question, k);
  if (!isClaudeConfigured() || base.sources.length === 0) return base;
  const context = vectorSearch(question, k)
    .map((h, i) => `[${i + 1}] (${h.kind}) ${h.title}`)
    .join('\n');
  const res = await completeSafe(
    `You are CertiSphere's compliance RAG assistant. Using ONLY this retrieved context:\n${context}\n\nAnswer the question concisely and cite sources as [n]:\n${question}`,
    { maxTokens: 400 } as any
  );
  if (res.ok) return { ...base, answer: res.text, generator: 'claude' };
  return base;
};
