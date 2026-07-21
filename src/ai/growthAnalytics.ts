/**
 * growthAnalytics.ts — Growth Analytics for the Management role.
 *
 * Identifies ranked growth opportunities from the certification body's live
 * data. Heuristic core works with no API key; Claude produces a richer,
 * strategist-grade analysis when configured.
 */
import { complete, isClaudeConfigured } from './claudeClient';
import { getClients, getCertificates, getSchedules } from './liveData';

export type Size = 'Small' | 'Medium' | 'Large';
export type Effort = 'Low' | 'Medium' | 'High';

export interface GrowthOpportunity {
  rank: number;
  title: string;
  category: string;
  rationale: string;
  marketSize: Size;
  effort: Effort;
  roi: string;
  timeline: string;
  risk: string;
}

export interface GrowthAnalysis {
  summary: string;
  opportunities: GrowthOpportunity[];
  source: 'heuristic' | 'claude';
}

export const GROWTH_SYSTEM_PROMPT =
  'You are a business growth strategist. Identify growth opportunities for the organization.\n\n' +
  'Analyze:\n1. Market gaps and opportunities\n2. Underserved certifications\n3. Geographic expansion potential\n' +
  '4. New market segments\n5. Service line expansion\n6. Partnership opportunities\n7. Technology/capability investments needed\n\n' +
  'Return ONLY compact JSON: {"summary":"2-3 sentences","opportunities":[{"title":"...","category":"...",' +
  '"rationale":"...","marketSize":"Small|Medium|Large","effort":"Low|Medium|High","roi":"e.g. High / ~20%","timeline":"e.g. 3-6 months","risk":"short risk note"}]}. ' +
  'Rank the 3-5 most actionable, realistic opportunities first. Be specific and grounded in the data provided.';

/* ---------------- shared helpers ---------------- */
const str = (v: unknown) => (v == null ? '' : String(v));
const norm = (v: unknown) => str(v).trim().toLowerCase();

const STANDARD_CATALOG: { code: string; name: string; demand: Size }[] = [
  { code: 'ISO 9001', name: 'Quality Management', demand: 'Large' },
  { code: 'ISO 14001', name: 'Environmental Management', demand: 'Large' },
  { code: 'ISO 45001', name: 'Occupational Health & Safety', demand: 'Large' },
  { code: 'ISO 27001', name: 'Information Security', demand: 'Large' },
  { code: 'ISO 22000', name: 'Food Safety', demand: 'Medium' },
  { code: 'ISO 13485', name: 'Medical Devices', demand: 'Medium' },
  { code: 'ISO 50001', name: 'Energy Management', demand: 'Medium' },
  { code: 'ISO 42001', name: 'AI Management System', demand: 'Large' },
  { code: 'ISO 20000-1', name: 'IT Service Management', demand: 'Medium' },
  { code: 'ISO 37001', name: 'Anti-Bribery', demand: 'Small' },
];

const stdCode = (s: string): string => {
  const m = s.match(/ISO(?:\/IEC)?\s*\d+(?:-\d+)?/i);
  return m ? m[0].replace(/\s+/g, ' ').replace('ISO/IEC', 'ISO').trim() : '';
};

const clientStandard = (c: any) => str(c.standard || c.certificationStandard || c.certification || '');
const clientCountry = (c: any) => str(c.country || '');
const clientIndustry = (c: any) => str(c.clientType || c.industry || c.sector || '');

const INDUSTRY_GAPS = ['Healthcare', 'Software / IT', 'Food & Beverage', 'Construction', 'Energy', 'Manufacturing', 'Logistics', 'Financial Services'];

/* ---------------- period + client breakdown ---------------- */
export type GrowthPeriod = 'week' | 'month' | 'year' | 'all';
export const PERIOD_LABEL: Record<GrowthPeriod, string> = { week: 'This Week', month: 'This Month', year: 'This Year', all: 'All Time' };
const periodDays = (p: GrowthPeriod) => (p === 'week' ? 7 : p === 'month' ? 30 : p === 'year' ? 365 : Infinity);
const withinPeriod = (dateStr: string, p: GrowthPeriod): boolean => {
  if (p === 'all') return true;
  const d = new Date(dateStr).getTime();
  if (isNaN(d)) return false;
  return (Date.now() - d) <= periodDays(p) * 86400000;
};
const schedDate = (s: any) => str(s.date || s.scheduledDate || s.startDate || '');

export interface ClientGrowthRow {
  client: string;
  industry: string;
  standard: string;
  country: string;
  status: string;
  audits: number;
  certs: number;
}

export const getClientBreakdown = (period: GrowthPeriod = 'all'): ClientGrowthRow[] => {
  const clients = getClients();
  const schedules = getSchedules();
  const certs = getCertificates();
  const byName = new Map<string, ClientGrowthRow>();
  clients.filter((c) => c && typeof c === 'object').forEach((c: any) => {
    const name = str(c.organizationName || c.client || c.clientName || c.name);
    if (!name) return;
    byName.set(name, {
      client: name,
      industry: clientIndustry(c) || 'General',
      standard: stdCode(clientStandard(c)) || '—',
      country: str(c.country) || '—',
      status: str(c.status) || 'Active',
      audits: 0, certs: 0,
    });
  });
  schedules.filter((s) => s && typeof s === 'object').forEach((s: any) => {
    if (!withinPeriod(schedDate(s), period)) return;
    const name = str(s.organizationName || s.client || s.clientName);
    if (!name) return;
    const row = byName.get(name) || { client: name, industry: 'General', standard: stdCode(str(s.standard)) || '—', country: str(s.country) || '—', status: 'Active', audits: 0, certs: 0 };
    row.audits += 1;
    byName.set(name, row);
  });
  certs.filter((c) => c && typeof c === 'object').forEach((ct: any) => {
    const name = str(ct.organizationName || ct.client || ct.clientName);
    const row = byName.get(name);
    if (row) row.certs += 1;
  });
  return [...byName.values()].sort((a, b) => (b.audits + b.certs) - (a.audits + a.certs));
};

/* ---------------- heuristic analyzer ---------------- */
export const analyzeGrowthHeuristic = (period: GrowthPeriod = 'all'): GrowthAnalysis => {
  const clients = getClients();
  const certs = getCertificates();
  const schedules = getSchedules();
  const rows = [...clients, ...schedules].filter((x) => x && typeof x === 'object');

  // served standards
  const servedStd = new Set<string>();
  rows.forEach((r) => { const c = stdCode(clientStandard(r)); if (c) servedStd.add(c); });
  // served countries
  const servedCountry = new Set<string>();
  rows.forEach((r) => { const c = norm(clientCountry(r)); if (c) servedCountry.add(c); });
  // served industries
  const servedInd = new Set<string>();
  clients.forEach((c) => { const i = norm(clientIndustry(c)); if (i) servedInd.add(i); });

  const opps: Omit<GrowthOpportunity, 'rank'>[] = [];

  // 1. Underserved high-demand standards
  const missing = STANDARD_CATALOG.filter((s) => !servedStd.has(s.code));
  const topMissing = missing.sort((a, b) => (b.demand === 'Large' ? 1 : 0) - (a.demand === 'Large' ? 1 : 0)).slice(0, 2);
  topMissing.forEach((s) => {
    opps.push({
      title: `Add ${s.code} (${s.name}) certification service`,
      category: 'Underserved Certification',
      rationale: `${s.code} is in ${s.demand.toLowerCase()} demand but is not yet part of your active scheme portfolio (${servedStd.size} standard(s) currently served).`,
      marketSize: s.demand,
      effort: s.code.includes('42001') || s.code.includes('27001') ? 'High' : 'Medium',
      roi: s.demand === 'Large' ? 'High' : 'Medium',
      timeline: '3–6 months',
      risk: 'Requires accreditation scope extension and competent auditors for the new standard.',
    });
  });

  // 2. Geographic expansion
  if (servedCountry.size <= 3) {
    opps.push({
      title: 'Expand into adjacent geographies / new regions',
      category: 'Geographic Expansion',
      rationale: `Active audits are concentrated in ${servedCountry.size || 'a few'} country(ies). Neighbouring markets with the same standards offer near-term expansion with existing capability.`,
      marketSize: 'Large',
      effort: 'High',
      roi: 'Medium',
      timeline: '6–12 months',
      risk: 'Local accreditation recognition, travel cost and local-language auditor availability.',
    });
  }

  // 3. Service line expansion (surveillance capture)
  const activeCerts = certs.filter((c) => c && typeof c === 'object').length;
  const inPeriod = schedules.filter((s) => withinPeriod(schedDate(s), period));
  const surveillance = inPeriod.filter((s) => /surveillance|recert/i.test(str((s as any).auditType))).length;
  if (activeCerts > 0 && surveillance < activeCerts) {
    opps.push({
      title: 'Capture recurring surveillance & recertification revenue',
      category: 'Service Line Expansion',
      rationale: `You hold ~${activeCerts} certificate(s) but only ~${surveillance} surveillance/recert audit(s) are scheduled. Automated surveillance scheduling converts one-off certifications into recurring revenue.`,
      marketSize: 'Medium',
      effort: 'Low',
      roi: 'High',
      timeline: '1–3 months',
      risk: 'Low — mostly process/automation; leverages existing clients.',
    });
  }
  opps.push({
    title: 'Add advisory service lines (gap assessments, training, pre-audits)',
    category: 'Service Line Expansion',
    rationale: 'Gap assessments, awareness training and pre-audits are high-margin adjacencies that warm leads for full certification while respecting impartiality boundaries.',
    marketSize: 'Medium',
    effort: 'Medium',
    roi: 'High',
    timeline: '2–4 months',
    risk: 'Must ring-fence advisory from certification to protect impartiality (ISO/IEC 17021-1).',
  });

  // 4. New segments
  const gapIndustries = INDUSTRY_GAPS.filter((i) => !servedInd.has(i.toLowerCase())).slice(0, 1);
  gapIndustries.forEach((ind) => {
    opps.push({
      title: `Target the ${ind} segment`,
      category: 'New Market Segment',
      rationale: `${ind} clients are under-represented in the current book of business but have strong, mandated certification needs.`,
      marketSize: 'Medium',
      effort: 'Medium',
      roi: 'Medium',
      timeline: '3–6 months',
      risk: 'Sector-specific competence and referrals needed to build credibility.',
    });
  });

  // 5. Partnership / technology
  opps.push({
    title: 'Form referral partnerships with consultancies & industry bodies',
    category: 'Partnership',
    rationale: 'Management consultancies and trade associations are a steady, low-cost pipeline of certification-ready clients.',
    marketSize: 'Medium',
    effort: 'Low',
    roi: 'Medium',
    timeline: '1–3 months',
    risk: 'Channel conflict / impartiality — keep referral terms transparent.',
  });

  const ranked = rankOpportunities(opps);
  const summary =
    `[${PERIOD_LABEL[period]}] Analysed ${clients.length} client(s), ${activeCerts} certificate(s) across ${servedStd.size} standard(s) and ${servedCountry.size} region(s). ` +
    `Identified ${ranked.length} actionable growth levers — the fastest wins are recurring surveillance revenue and advisory service lines, with new standards and geography as larger, higher-effort plays.`;

  return { summary, opportunities: ranked, source: 'heuristic' };
};

const rankOpportunities = (opps: Omit<GrowthOpportunity, 'rank'>[]): GrowthOpportunity[] => {
  const sizeW = { Large: 3, Medium: 2, Small: 1 } as const;
  const effortW = { Low: 3, Medium: 2, High: 1 } as const;
  return opps
    .map((o) => ({ o, score: sizeW[o.marketSize] * 1.2 + effortW[o.effort] + (o.roi.toLowerCase().includes('high') ? 1.5 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x, i) => ({ ...x.o, rank: i + 1 }));
};

/* ---------------- Claude analyzer ---------------- */
export const analyzeGrowthWithClaude = async (period: GrowthPeriod = 'all', signal?: AbortSignal): Promise<GrowthAnalysis | null> => {
  if (!isClaudeConfigured()) return null;
  const clients = getClients();
  const certs = getCertificates();
  const schedules = getSchedules();
  const served = Array.from(new Set([...clients, ...schedules].map((r: any) => stdCode(clientStandard(r))).filter(Boolean)));
  const countries = Array.from(new Set([...clients, ...schedules].map((r: any) => str(r.country)).filter(Boolean)));
  const industries = Array.from(new Set(clients.map((c: any) => clientIndustry(c)).filter(Boolean)));
  const snapshot =
    `Clients: ${clients.length}\nActive certificates: ${certs.length}\nScheduled audits: ${schedules.length}\n` +
    `Standards served: ${served.join(', ') || 'none'}\nCountries served: ${countries.join(', ') || 'none'}\n` +
    `Industries served: ${industries.slice(0, 12).join(', ') || 'none'}\nAnalysis window: ${PERIOD_LABEL[period]}`;
  try {
    const out = await complete(`Certification body data snapshot:\n${snapshot}`, {
      system: GROWTH_SYSTEM_PROMPT, maxTokens: 1400, temperature: 0.4, signal,
    });
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    const size = (v: unknown): Size => (v === 'Large' || v === 'Small' ? v : 'Medium');
    const eff = (v: unknown): Effort => (v === 'High' || v === 'Low' ? v : 'Medium');
    const list = Array.isArray(j.opportunities) ? j.opportunities : [];
    return {
      summary: str(j.summary).slice(0, 600),
      opportunities: list.slice(0, 6).map((o: any, i: number) => ({
        rank: i + 1,
        title: str(o.title).slice(0, 140),
        category: str(o.category || 'Growth'),
        rationale: str(o.rationale).slice(0, 300),
        marketSize: size(o.marketSize),
        effort: eff(o.effort),
        roi: str(o.roi || 'Medium').slice(0, 40),
        timeline: str(o.timeline || 'TBD').slice(0, 40),
        risk: str(o.risk || '').slice(0, 200),
      })),
      source: 'claude',
    };
  } catch {
    return null;
  }
};
