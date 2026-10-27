/**
 * AuditorAssignment — AI-powered auditor-to-client matching engine.
 * Scores every available auditor across 5 weighted criteria for each job.
 * Heuristic instant; Claude upgrade when key configured.
 */
import React, { useState, useRef, useMemo } from 'react';
import {
  Users, Wand2, Loader2, Info, Sparkles, Star,

  MapPin, Clock, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, Copy, Download, RefreshCw,
} from 'lucide-react';
import { isClaudeConfigured, getApiKey, getModel, anthropicFetch } from '../../ai/claudeClient';
import { getAuditors } from './utils/dataStorage';
import type { Auditor } from './mockData';

/* ─── Types ──────────────────────────────────────────────────────── */
type Confidence = 'High' | 'Medium' | 'Low';

interface AuditJob {
  id: string;
  clientName: string;
  standard: string;
  auditType: string;
  location: string;
  complexity: 'Low' | 'Medium' | 'High';
  preferredDate?: string;
}

interface AuditorScore {
  auditorId: number;
  auditorName: string;
  auditorRole: string;
  totalScore: number;         // 0–100 weighted
  expertiseScore: number;     // 0–100
  availabilityScore: number;  // 0–100
  proximityScore: number;     // 0–100
  capacityScore: number;      // 0–100
  historyScore: number;       // 0–100
  confidence: Confidence;
  strengths: string[];
  availableDates: string;
  reasoning: string;
}

interface JobMatch {
  job: AuditJob;
  ranked: AuditorScore[];     // best → worst
}

/* ─── Safe read ──────────────────────────────────────────────────── */
const safe = (k: string) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; } };

function loadJobs(): AuditJob[] {
  const dispatches: any[] = safe('cms_application_dispatch_v7') || [];
  const schedA: any[]     = safe('cms_audit_schedules')    || [];
  const schedB: any[]     = safe('cms_audit_schedules_v3') || [];
  const jobs: AuditJob[]  = [];

  dispatches.filter((d: any) => ['Received','Approved','Pending'].includes(d.status))
    .forEach((d: any) => {
      jobs.push({
        id: `D-${d.id}`,
        clientName: d.organization || d.clientName || `Client ${d.id}`,
        standard: d.certificationStandard || 'ISO 9001:2015',
        auditType: d.auditType || 'Surveillance',
        location: d.location || 'TBD',
        complexity: d.certificationStandard?.includes('27001') ? 'High'
          : d.auditType?.includes('Initial') ? 'Medium' : 'Low',
        preferredDate: d.proposedDate || d.dispatchedDate,
      });
    });

  [...schedA, ...schedB]
    .filter((s: any) => ['Pending','Scheduled'].includes(s.status))
    .forEach((s: any) => {
      if (jobs.find(j => j.clientName === (s.organization || s.clientName))) return;
      jobs.push({
        id: `S-${s.id}`,
        clientName: s.organization || s.clientName || `Schedule ${s.id}`,
        standard: s.certificationStandard || s.standard || 'ISO 9001:2015',
        auditType: s.auditType || 'Surveillance',
        location: s.location || 'TBD',
        complexity: 'Medium',
        preferredDate: s.date || s.proposedDate,
      });
    });

  return jobs.slice(0, 15);
}

/* ─── Workload count from schedules ─────────────────────────────── */
function buildWorkloadMap(auditors: Auditor[]): Record<string, number> {
  const schedA: any[] = safe('cms_audit_schedules')    || [];
  const schedB: any[] = safe('cms_audit_schedules_v3') || [];
  const all = [...schedA, ...schedB].filter((s: any) => !['Completed','Cancelled'].includes(s.status));
  const map: Record<string, number> = {};
  auditors.forEach(a => { map[a.name] = 0; });
  all.forEach((s: any) => {
    const name = s.leadAuditor || s.auditor || '';
    if (map[name] !== undefined) map[name]++;
  });
  return map;
}

/* ─── History map: auditor → set of client names ────────────────── */
function buildHistoryMap(): Record<string, Set<string>> {
  const schedA: any[] = safe('cms_audit_schedules')    || [];
  const schedB: any[] = safe('cms_audit_schedules_v3') || [];
  const map: Record<string, Set<string>> = {};
  [...schedA, ...schedB].filter((s: any) => s.status === 'Completed').forEach((s: any) => {
    const name   = s.leadAuditor || s.auditor || '';
    const client = s.organization || s.clientName || '';
    if (!name || !client) return;
    if (!map[name]) map[name] = new Set();
    map[name].add(client.toLowerCase().trim());
  });
  return map;
}

/* ─── Heuristic scoring ──────────────────────────────────────────── */
const WEIGHTS = { expertise: 0.40, availability: 0.25, proximity: 0.15, capacity: 0.15, history: 0.05 };

function scoreAuditor(
  auditor: Auditor,
  job: AuditJob,
  workload: Record<string, number>,
  history: Record<string, Set<string>>,
): AuditorScore {
  const certs  = (auditor.certifications || []).map(c => c.toLowerCase());
  const skills  = Object.keys(auditor.skills || {}).map(s => s.toLowerCase());
  const stdLow  = job.standard.toLowerCase();
  const stdKey  = stdLow.replace(/[:\s]/g, '').slice(0, 9); // e.g. "iso900120"

  /* ── Expertise (40%) ── */
  let expertise = 0;
  if (certs.some(c => c.replace(/[:\s]/g,'').includes(stdKey))) expertise = 100;
  else if (certs.some(c => c.includes(stdLow.slice(0, 7)))) expertise = 80;
  else if (skills.some(s => s.includes(stdLow.slice(0, 7)))) expertise = 65;
  else if (certs.length > 0) expertise = 35;
  else expertise = 15;
  // Lead Auditor bonus for complex
  if (auditor.role === 'Lead Auditor' && job.complexity === 'High') expertise = Math.min(expertise + 10, 100);

  /* ── Availability (25%) ── */
  // Use workload count as proxy — 0 scheduled = fully available
  const sched = workload[auditor.name] || 0;
  const availability = sched === 0 ? 100 : sched <= 2 ? 80 : sched <= 4 ? 60 : sched <= 6 ? 40 : 20;

  /* ── Proximity (15%) ── */
  let proximity = 50; // neutral if unknown
  if (job.location !== 'TBD' && job.location) {
    const locLow    = job.location.toLowerCase();
    const country   = (auditor.country || '').toLowerCase();
    const region    = (auditor.region  || '').toLowerCase();
    if (locLow.includes(country) || country.includes(locLow.slice(0, 4))) proximity = 100;
    else if (locLow.includes(region) || region.includes(locLow.slice(0, 4))) proximity = 90;
    else {
      // Geography heuristic by keyword
      const US_CITIES = ['new york','san francisco','chicago','detroit','seattle','boston','los angeles','dallas','houston','miami'];
      const IN_CITIES = ['hyderabad','bangalore','mumbai','delhi','chennai','pune'];
      const jobIsUS = US_CITIES.some(c => locLow.includes(c));
      const jobIsIN = IN_CITIES.some(c => locLow.includes(c));
      const audIsIN = country.includes('india') || region.includes('hyderabad') || region.includes('india');
      if (jobIsUS && !audIsIN) proximity = 80;
      else if (jobIsIN && audIsIN) proximity = 95;
      else if (jobIsUS && audIsIN) proximity = 30;
      else proximity = 55;
    }
  }

  /* ── Capacity (15%) ── */
  const capacity = sched === 0 ? 100 : sched <= 2 ? 80 : sched <= 4 ? 55 : sched <= 6 ? 30 : 10;

  /* ── History (5%) ── */
  const audHistory  = history[auditor.name] || new Set();
  const clientLow   = job.clientName.toLowerCase().trim();
  const hasHistory  = audHistory.has(clientLow) || [...audHistory].some(h => clientLow.includes(h) || h.includes(clientLow));
  const historyScore = hasHistory ? 100 : 50;

  /* ── Total ── */
  const total = Math.round(
    expertise     * WEIGHTS.expertise +
    availability  * WEIGHTS.availability +
    proximity     * WEIGHTS.proximity +
    capacity      * WEIGHTS.capacity +
    historyScore  * WEIGHTS.history
  );

  /* ── Confidence ── */
  const confidence: Confidence = total >= 78 ? 'High' : total >= 55 ? 'Medium' : 'Low';

  /* ── Strengths ── */
  const strengths: string[] = [];
  if (expertise >= 80)    strengths.push(`Certified in ${auditor.certifications.find(c => c.toLowerCase().includes(stdLow.slice(0,6))) || job.standard}`);
  if (expertise >= 65)    strengths.push(`Strong ${job.standard} expertise`);
  if (availability >= 80) strengths.push('High availability — light current schedule');
  if (proximity >= 80)    strengths.push(`Geographic match (${job.location})`);
  if (capacity >= 80)     strengths.push('Ample capacity for this engagement');
  if (hasHistory)         strengths.push(`Prior audit history with ${job.clientName}`);
  if (auditor.role === 'Lead Auditor') strengths.push('Lead Auditor — qualified for complex engagements');
  const avgRating = auditor.ratings?.length
    ? auditor.ratings.reduce((s, r) => s + r.score, 0) / auditor.ratings.length : 0;
  if (avgRating >= 4) strengths.push(`High performance rating (${avgRating.toFixed(1)}/5)`);
  if (strengths.length === 0) strengths.push('General audit competence');

  /* ── Availability dates ── */
  const nextDate = job.preferredDate
    ? new Date(job.preferredDate).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
    : 'Flexible — confirm with auditor';
  const availableDates = sched <= 2
    ? `Available from ${nextDate}`
    : sched <= 5 ? `Likely available ${nextDate} — confirm schedule`
    : `Limited availability — ${sched} active assignments`;

  /* ── Reasoning ── */
  const reasoning =
    `${auditor.name} achieves a ${total}% match score for this ${job.auditType} audit against ${job.standard}. ` +
    `${expertise >= 80 ? `Certification in ${job.standard} provides direct expertise relevance.` : expertise >= 65 ? `Partial skill overlap with ${job.standard} requirements.` : `Limited direct certification match — consider supplementary support.`} ` +
    `${sched === 0 ? 'Currently unassigned with full capacity available.' : `${sched} active assignment${sched > 1 ? 's' : ''} — ${availability >= 60 ? 'capacity is adequate' : 'workload may be a constraint'}.`} ` +
    `${hasHistory ? `Previous engagement with ${job.clientName} provides valuable client context.` : ''}`;

  return {
    auditorId: auditor.id, auditorName: auditor.name, auditorRole: auditor.role,
    totalScore: total, expertiseScore: expertise, availabilityScore: availability,
    proximityScore: proximity, capacityScore: capacity, historyScore,
    confidence, strengths, availableDates, reasoning,
  };
}

function runHeuristicMatching(jobs: AuditJob[], auditors: Auditor[]): JobMatch[] {
  const active   = auditors.filter(a => a.status === 'Active');
  const workload = buildWorkloadMap(active);
  const history  = buildHistoryMap();
  return jobs.map(job => ({
    job,
    ranked: active
      .map(a => scoreAuditor(a, job, workload, history))
      .sort((a, b) => b.totalScore - a.totalScore),
  }));
}

/* ─── Claude call ────────────────────────────────────────────────── */
const SYSTEM = `You are an auditor-to-client matching expert. Match auditors to audit assignments based on optimal fit.

Evaluation criteria:
1. Relevant certification/industry expertise (weighted: 40%)
2. Auditor availability (weighted: 25%)
3. Geographic proximity (weighted: 15%)
4. Current workload capacity (weighted: 15%)
5. Client preference/history (weighted: 5%)

Return a JSON array, one object per job:
{ "jobId": string, "ranked": [{ "auditorId": number, "auditorName": string, "auditorRole": string, "totalScore": number, "expertiseScore": number, "availabilityScore": number, "proximityScore": number, "capacityScore": number, "historyScore": number, "confidence": "High"|"Medium"|"Low", "strengths": [string], "availableDates": string, "reasoning": string }] }

Return ONLY the JSON array. No markdown, no other text.`;

async function claudeMatch(jobs: AuditJob[], auditors: Auditor[], workload: Record<string,number>, signal: AbortSignal): Promise<JobMatch[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('not_configured');
  let buf = '';
  const res = await anthropicFetch({
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model: getModel(), max_tokens: 3500, temperature: 0.2, stream: true, system: SYSTEM,
      messages: [{ role: 'user', content:
        `Match these jobs to auditors:\n\nJOBS:\n${JSON.stringify(jobs)}\n\nAUDITORS:\n${JSON.stringify(auditors.map(a => ({ id: a.id, name: a.name, role: a.role, certs: a.certifications, skills: Object.keys(a.skills||{}), country: a.country, region: a.region, activeJobs: workload[a.name]||0 })))}\n\nReturn JSON array only.`
      }],
    }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Claude ${res.status}`);
  const reader = res.body.getReader(); const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    for (const line of dec.decode(value).split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim(); if (raw === '[DONE]') break;
      try { buf += JSON.parse(raw)?.delta?.text || ''; } catch { /**/ }
    }
  }
  const m = buf.match(/\[[\s\S]*\]/); if (!m) throw new Error('parse');
  const arr: any[] = JSON.parse(m[0]);
  return arr.map(item => ({
    job: jobs.find(j => j.id === item.jobId) || jobs[0],
    ranked: item.ranked as AuditorScore[],
  }));
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const GOLD = '#c9922a', BLUE = '#1d4ed8';
const CONF_STYLE: Record<Confidence, { color: string; bg: string }> = {
  High:   { color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  Medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  Low:    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
};
const SCORE_COLOR = (s: number) => s >= 80 ? '#22c55e' : s >= 60 ? '#f59e0b' : '#ef4444';
const cardS: React.CSSProperties = { background: 'var(--cms-bg-surface, #ffffff)', border: '1px solid var(--cms-border-subtle, rgba(15,23,42,0.10))', borderRadius: 16, padding: 20, marginBottom: 16 };
const btnS = (c = BLUE, extra: React.CSSProperties = {}): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: 'none', background: c, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', ...extra });
const aiBadge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: 'rgba(201,146,42,0.15)', border: '1px solid rgba(201,146,42,0.4)', color: GOLD, fontSize: 10, fontWeight: 700 };

/* ─── Score ring ─────────────────────────────────────────────────── */
const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 56 }) => {
  const r = size / 2 - 5; const circ = 2 * Math.PI * r;
  const color = SCORE_COLOR(score);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--cms-border-strong, rgba(15,23,42,0.16))" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${(score/100)*circ} ${circ}`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.27, fontWeight: 900, color }}>{score}%</span>
      </div>
    </div>
  );
};

/* ─── Criteria bar ───────────────────────────────────────────────── */
const CriteriaBar: React.FC<{ label: string; val: number; weight: string }> = ({ label, val, weight }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--cms-text-muted, #64748b)', marginBottom: 2 }}>
      <span>{label} <span style={{ color: '#475569' }}>({weight})</span></span>
      <span style={{ fontWeight: 700, color: SCORE_COLOR(val) }}>{val}</span>
    </div>
    <div style={{ height: 5, background: 'var(--cms-bg-elevated, #f8fafc)', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${val}%`, background: SCORE_COLOR(val), borderRadius: 999, transition: 'width 0.5s ease' }} />
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════════ */
const AuditorAssignment: React.FC = () => {
  const claude = isClaudeConfigured();
  const liveJobs      = useMemo(() => loadJobs(), []);
  const liveAuditors  = useMemo(() => getAuditors().filter(a => a.status === 'Active'), []);

  const [matches,   setMatches]   = useState<JobMatch[]>([]);
  const [busy,      setBusy]      = useState(false);
  const [source,    setSource]    = useState<'heuristic' | 'claude' | null>(null);
  const [expanded,  setExpanded]  = useState<Record<string, boolean>>({});
  const [altExp,    setAltExp]    = useState<Record<string, boolean>>({});
  const [copied,    setCopied]    = useState(false);
  const [streamMsg, setStreamMsg] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  /* ── Run matching ── */
  const run = async () => {
    if (busy) { abortRef.current?.abort(); setBusy(false); return; }
    if (liveJobs.length === 0 || liveAuditors.length === 0) return;

    const heuristic = runHeuristicMatching(liveJobs, liveAuditors);
    setMatches(heuristic); setSource('heuristic');

    if (!claude) return;
    setBusy(true); setStreamMsg('Evaluating matches with Claude…');
    abortRef.current = new AbortController();
    const workload = buildWorkloadMap(liveAuditors);
    try {
      const result = await claudeMatch(liveJobs, liveAuditors, workload, abortRef.current.signal);
      setMatches(result); setSource('claude');
    } catch { /* keep heuristic */ }
    finally { setBusy(false); setStreamMsg(''); }
  };

  /* ── Copy ── */
  const copyReport = () => {
    const lines = matches.map(m => {
      const top = m.ranked[0];
      return `${m.job.clientName} (${m.job.standard} ${m.job.auditType})\n  → ${top?.auditorName} — ${top?.totalScore}% match (${top?.confidence} confidence)\n  Strengths: ${top?.strengths.join(', ')}\n  ${top?.availableDates}`;
    }).join('\n\n');
    navigator.clipboard.writeText(lines);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const exportCSV = () => {
    const rows = matches.map(m => {
      const t = m.ranked[0];
      return [m.job.clientName, m.job.standard, m.job.auditType, t?.auditorName, t?.auditorRole, `${t?.totalScore}%`, t?.confidence, t?.availableDates, `"${t?.strengths.join('; ')}"`].join(',');
    });
    const csv = ['Client,Standard,Type,Recommended Auditor,Role,Match Score,Confidence,Availability,Strengths', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'auditor_assignments.csv'; a.click(); URL.revokeObjectURL(url);
  };

  /* ── Render ── */
  return (
    <div style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#1a0533,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Users size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--cms-text-primary, #0f172a)' }}>Auditor Assignment AI</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--cms-text-muted, #64748b)' }}>
            {claude ? 'AI-powered matching — scores every auditor across 5 weighted criteria per job' : 'Heuristic matching engine — expertise, availability, proximity, capacity, history'}
          </p>
        </div>
      </div>

      {!claude && (
        <div style={{ background: 'rgba(201,146,42,0.07)', border: '1px solid rgba(201,146,42,0.25)', borderRadius: 9, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Info size={14} color={GOLD} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: 'var(--cms-text-primary, #0f172a)', lineHeight: 1.5 }}>
            <strong style={{ color: GOLD }}>Heuristic mode</strong> — weighted scoring across all 5 criteria using live certification, schedule, and location data. Configure Claude API key in <strong>AI Settings</strong> for AI-depth matching analysis.
          </p>
        </div>
      )}

      {/* Controls */}
      <div style={cardS}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
            {[
              { label: 'Jobs to match',    val: liveJobs.length,     color: BLUE },
              { label: 'Active auditors',  val: liveAuditors.length, color: '#7c3aed' },
              { label: 'Possible matches', val: liveJobs.length * liveAuditors.length, color: GOLD },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--cms-bg-subtle, #f1f5f9)', border: '1px solid var(--cms-border-subtle, rgba(15,23,42,0.10))', borderRadius: 9, padding: '8px 16px', textAlign: 'center', minWidth: 90 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={btnS(busy ? '#374151' : '#7c3aed')} onClick={run}
              disabled={liveJobs.length === 0 || liveAuditors.length === 0}>
              {busy
                ? <><Loader2 size={14} style={{ animation: 'aa2-spin 1s linear infinite' }} />{claude ? ' Matching… (stop)' : ' Matching…'}</>
                : <><Wand2 size={14} />{claude ? ' Match with Claude' : ' Run Matching'}</>}
            </button>
            {matches.length > 0 && !busy && (
              <button style={btnS('transparent', { border: '1px solid var(--cms-border-input, #cbd5e1)', color: 'var(--cms-text-muted, #64748b)' })} onClick={run}>
                <RefreshCw size={13} /> Re-run
              </button>
            )}
          </div>
        </div>
        {streamMsg && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Loader2 size={13} color={GOLD} style={{ animation: 'aa2-spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 12, color: 'var(--cms-text-muted, #64748b)' }}>{streamMsg}</span>
          </div>
        )}
      </div>

      {/* Results header */}
      {matches.length > 0 && (
        <div style={{ ...cardS, padding: '12px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <CheckCircle2 size={15} color="#22c55e" />
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--cms-text-primary, #0f172a)' }}>{matches.length} jobs matched</span>
            {source === 'claude'    && <span style={aiBadge}><Sparkles size={9} /> Claude AI</span>}
            {source === 'heuristic' && <span style={{ ...aiBadge, background: 'rgba(100,116,139,0.12)', borderColor: 'rgba(100,116,139,0.3)', color: 'var(--cms-text-muted, #64748b)' }}>Heuristic</span>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
              <button style={btnS('#1e293b', { padding: '5px 11px', fontSize: 12, border: '1px solid var(--cms-border-subtle, rgba(15,23,42,0.12))' })} onClick={copyReport}>
                <Copy size={12} />{copied ? ' Copied!' : ' Copy'}
              </button>
              <button style={btnS('#064e3b', { padding: '5px 11px', fontSize: 12 })} onClick={exportCSV}>
                <Download size={12} /> CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match cards */}
      {matches.map(m => {
        const top    = m.ranked[0];
        const alts   = m.ranked.slice(1, 3);
        const isExp  = expanded[m.job.id];
        const isAlt  = altExp[m.job.id];
        if (!top) return null;
        const cs = CONF_STYLE[top.confidence];

        return (
          <div key={m.job.id} style={cardS}>
            {/* Job header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--cms-text-primary, #0f172a)', marginBottom: 3 }}>{m.job.clientName}</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--cms-text-muted, #64748b)' }}>{m.job.standard}</span>
                  <span style={{ fontSize: 11, color: '#475569' }}>•</span>
                  <span style={{ fontSize: 11, color: 'var(--cms-text-muted, #64748b)' }}>{m.job.auditType}</span>
                  {m.job.location !== 'TBD' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#475569' }}>
                      <MapPin size={10} /> {m.job.location}
                    </span>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                    color: m.job.complexity === 'High' ? '#ef4444' : m.job.complexity === 'Medium' ? '#f59e0b' : '#22c55e',
                    background: m.job.complexity === 'High' ? 'rgba(239,68,68,0.1)' : m.job.complexity === 'Medium' ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)' }}>
                    {m.job.complexity}
                  </span>
                </div>
              </div>
            </div>

            {/* Top recommendation */}
            <div style={{ background: 'var(--cms-bg-subtle, #f1f5f9)', borderRadius: 12, padding: '14px 16px', border: `1px solid ${cs.color}30` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ScoreRing score={top.totalScore} />

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontWeight: 900, fontSize: 15, color: 'var(--cms-text-primary, #0f172a)' }}>{top.auditorName}</span>
                    <span style={{ fontSize: 11, color: 'var(--cms-text-muted, #64748b)' }}>{top.auditorRole}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 999, color: cs.color, background: cs.bg, border: `1px solid ${cs.color}44` }}>
                      <Star size={10} /> {top.confidence} Confidence
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--cms-text-muted, #64748b)', marginBottom: 6 }}>
                    <Clock size={11} /> {top.availableDates}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {top.strengths.slice(0, 3).map((s, i) => (
                      <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', color: '#c4b5fd' }}>{s}</span>
                    ))}
                  </div>
                </div>

                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', flexShrink: 0, alignSelf: 'flex-start' }}
                  onClick={() => setExpanded(p => ({ ...p, [m.job.id]: !isExp }))}>
                  {isExp ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              </div>

              {/* Expanded detail */}
              {isExp && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--cms-bg-elevated, #f8fafc)' }}>
                  {/* Criteria breakdown */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Criteria Breakdown</div>
                      <CriteriaBar label="Expertise"    val={top.expertiseScore}    weight="40%" />
                      <CriteriaBar label="Availability" val={top.availabilityScore} weight="25%" />
                      <CriteriaBar label="Proximity"    val={top.proximityScore}    weight="15%" />
                      <CriteriaBar label="Capacity"     val={top.capacityScore}     weight="15%" />
                      <CriteriaBar label="History"      val={top.historyScore}      weight="5%"  />
                    </div>
                    <div style={{ background: 'var(--cms-bg-elevated, #f8fafc)', borderRadius: 9, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>💬 Reasoning</div>
                      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--cms-text-muted, #64748b)', lineHeight: 1.6 }}>{top.reasoning}</p>
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>✅ All Strengths</div>
                        {top.strengths.map((s, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginBottom: 3 }}>
                            <CheckCircle2 size={11} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
                            <span style={{ fontSize: 12, color: 'var(--cms-text-secondary, #475569)' }}>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Alternatives toggle */}
            {alts.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 0' }}
                  onClick={() => setAltExp(p => ({ ...p, [m.job.id]: !isAlt }))}>
                  <AlertCircle size={12} /> {isAlt ? 'Hide' : 'Show'} {alts.length} alternative{alts.length > 1 ? 's' : ''}
                  {isAlt ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {isAlt && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {alts.map((alt, idx) => (
                      <div key={alt.auditorId} style={{ background: 'var(--cms-bg-subtle, #f1f5f9)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--cms-border-subtle, rgba(15,23,42,0.08))' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', minWidth: 20 }}>#{idx + 2}</span>
                        <ScoreRing score={alt.totalScore} size={44} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--cms-text-secondary, #475569)' }}>{alt.auditorName} <span style={{ fontSize: 11, color: '#475569', fontWeight: 400 }}>{alt.auditorRole}</span></div>
                          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{alt.strengths[0]} · {alt.availableDates}</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: CONF_STYLE[alt.confidence].color, background: CONF_STYLE[alt.confidence].bg, padding: '2px 8px', borderRadius: 999, border: `1px solid ${CONF_STYLE[alt.confidence].color}44` }}>
                          {alt.confidence}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {matches.length === 0 && liveJobs.length === 0 && (
        <div style={{ ...cardS, textAlign: 'center', padding: 36 }}>
          <Users size={40} color="#1e3a5f" style={{ marginBottom: 12 }} />
          <p style={{ color: '#475569', margin: 0, fontSize: 14 }}>No pending audit jobs found. Create dispatch records or audit schedules to populate the matching engine.</p>
        </div>
      )}

      <style>{`@keyframes aa2-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
};

export default AuditorAssignment;
