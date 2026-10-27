/**
 * SmartScheduler — AI-powered audit schedule optimiser for the Coordinator.
 * Heuristic engine builds an optimised schedule instantly from live data.
 * Claude upgrade streams a richer plan when API key is configured.
 */
import React, { useState, useRef, useMemo } from 'react';
import {
  CalendarDays, Wand2, Loader2, Info, Sparkles,
  Copy, Download, RefreshCw, AlertTriangle, CheckCircle2,
  Users, Clock, MapPin, TrendingUp, Plus, ChevronDown, ChevronUp,
} from 'lucide-react';
import { isClaudeConfigured, getApiKey, getModel, anthropicFetch } from '../../ai/claudeClient';
import { getAuditors } from './utils/dataStorage';
import type { Auditor } from './mockData';

/* ─── Safe localStorage read ────────────────────────────────────── */
const safe = (k: string) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; } };

/* ─── Types ──────────────────────────────────────────────────────── */
interface AuditJob {
  id: string;
  clientName: string;
  standard: string;
  auditType: string;
  location: string;
  estimatedDays: number;
  complexity: 'Low' | 'Medium' | 'High';
  requiredSkill: string;
  preferredDate?: string;
  status: string;
}

interface ScheduledItem {
  jobId: string;
  auditorName: string;
  auditorRole: string;
  startDate: string;
  endDate: string;
  utilization: number;      // % of auditor capacity used
  travelRequired: boolean;
  conflict?: string;
  riskNote?: string;
}

interface ScheduleOutput {
  items: ScheduledItem[];
  utilizationSummary: Record<string, number>;
  conflicts: string[];
  risks: string[];
  unscheduled: string[];
  generatedAt: string;
}

/* ─── Read live jobs from dispatch / schedules ───────────────────── */
function loadJobs(): AuditJob[] {
  const dispatches: any[] = safe('cms_application_dispatch_v7') || [];
  const schedA: any[]     = safe('cms_audit_schedules')    || [];
  const schedB: any[]     = safe('cms_audit_schedules_v3') || [];
  const all = [...schedA, ...schedB];

  const jobs: AuditJob[] = [];

  // From dispatch records (pending / approved, not yet scheduled)
  dispatches.filter((d: any) => ['Received','Approved','Pending'].includes(d.status)).forEach((d: any) => {
    const days = d.auditType?.toLowerCase().includes('initial') ? 3
               : d.auditType?.toLowerCase().includes('recert') ? 2
               : 1;
    const complexity: AuditJob['complexity'] =
      d.certificationStandard?.includes('27001') ? 'High'
      : d.certificationStandard?.includes('9001') && d.auditType?.includes('Initial') ? 'High'
      : d.auditType?.includes('Initial') ? 'Medium' : 'Low';
    jobs.push({
      id: `D-${d.id}`,
      clientName: d.organization || d.clientName || `Client ${d.id}`,
      standard: d.certificationStandard || 'ISO 9001:2015',
      auditType: d.auditType || 'Surveillance',
      location: d.location || 'TBD',
      estimatedDays: days,
      complexity,
      requiredSkill: d.certificationStandard || 'ISO 9001:2015',
      preferredDate: d.proposedDate || d.dispatchedDate,
      status: d.status,
    });
  });

  // From schedule records (upcoming / pending confirmation)
  all.filter((s: any) => ['Pending','Scheduled'].includes(s.status)).forEach((s: any) => {
    if (jobs.find(j => j.clientName === (s.organization || s.clientName))) return; // dedup
    jobs.push({
      id: `S-${s.id}`,
      clientName: s.organization || s.clientName || `Schedule ${s.id}`,
      standard: s.certificationStandard || s.standard || 'ISO 9001:2015',
      auditType: s.auditType || 'Surveillance',
      location: s.location || 'TBD',
      estimatedDays: 1,
      complexity: 'Medium',
      requiredSkill: s.certificationStandard || s.standard || 'ISO 9001:2015',
      preferredDate: s.date || s.proposedDate,
      status: s.status,
    });
  });

  return jobs.slice(0, 20); // cap for display
}

/* ─── Heuristic scheduler ────────────────────────────────────────── */
function runHeuristicSchedule(jobs: AuditJob[], auditors: Auditor[], startFrom: string): ScheduleOutput {
  const base = new Date(startFrom);
  const items: ScheduledItem[] = [];
  const conflicts: string[] = [];
  const risks: string[] = [];
  const unscheduled: string[] = [];
  const auditorDayMap: Record<string, number> = {}; // days allocated per auditor
  const auditorDateCursor: Record<string, Date> = {};

  // Sort jobs: High complexity first, then by preferred date
  const sorted = [...jobs].sort((a, b) => {
    const cOrd: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    if (cOrd[a.complexity] !== cOrd[b.complexity]) return cOrd[a.complexity] - cOrd[b.complexity];
    if (a.preferredDate && b.preferredDate) return a.preferredDate.localeCompare(b.preferredDate);
    return 0;
  });

  const activeAuditors = auditors.filter(a => a.status === 'Active');
  if (activeAuditors.length === 0) {
    return { items: [], utilizationSummary: {}, conflicts: ['No active auditors available in the system.'], risks: [], unscheduled: jobs.map(j => j.clientName), generatedAt: new Date().toISOString() };
  }

  sorted.forEach(job => {
    // Find best-fit auditor: skill match first, then least loaded
    const skillMatch = activeAuditors.filter(a => {
      const certs = (a.certifications || []).join(' ').toLowerCase();
      const skills = Object.keys(a.skills || {}).join(' ').toLowerCase();
      const reqLower = job.requiredSkill.toLowerCase().replace(/[:\s]/g,'');
      return certs.includes(reqLower.slice(0,7)) || skills.includes(reqLower.slice(0,7)) ||
             certs.includes('iso') || skills.includes('iso');
    });
    const pool = skillMatch.length > 0 ? skillMatch : activeAuditors;
    const chosen = pool.sort((a, b) => (auditorDayMap[a.name] || 0) - (auditorDayMap[b.name] || 0))[0];

    if (!chosen) { unscheduled.push(job.clientName); return; }

    // Determine start date
    let start = auditorDateCursor[chosen.name] || new Date(base);
    // Skip weekends
    while (start.getDay() === 0 || start.getDay() === 6) start = new Date(start.getTime() + 86400000);
    // Honour preferred date if it's later
    if (job.preferredDate) {
      const pref = new Date(job.preferredDate);
      if (pref > start) start = pref;
      while (start.getDay() === 0 || start.getDay() === 6) start = new Date(start.getTime() + 86400000);
    }

    const end = new Date(start.getTime() + (job.estimatedDays - 1) * 86400000);
    auditorDayMap[chosen.name] = (auditorDayMap[chosen.name] || 0) + job.estimatedDays;
    // Next available = end + 1 travel day
    auditorDateCursor[chosen.name] = new Date(end.getTime() + 2 * 86400000);

    // Utilization: assume 20 working days/month capacity
    const util = Math.min(Math.round(((auditorDayMap[chosen.name] || 0) / 20) * 100), 100);

    // Conflict: overloaded auditor
    let conflict: string | undefined;
    if (auditorDayMap[chosen.name] > 20) {
      conflict = `${chosen.name} exceeds monthly capacity (${auditorDayMap[chosen.name]} days allocated)`;
      conflicts.push(conflict);
    }

    // Risk note
    let riskNote: string | undefined;
    if (job.complexity === 'High' && chosen.role !== 'Lead Auditor') {
      riskNote = 'High-complexity audit assigned to non-Lead Auditor — consider Lead Auditor oversight';
      risks.push(`${job.clientName}: ${riskNote}`);
    }
    if (job.estimatedDays > 3) {
      risks.push(`${job.clientName}: Extended audit (${job.estimatedDays} days) — confirm client availability and accommodation`);
    }

    const travelRequired = job.location !== 'TBD' && job.location !== '' && job.location !== (chosen.country || chosen.region || '');

    items.push({
      jobId: job.id,
      auditorName: chosen.name,
      auditorRole: chosen.role,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      utilization: util,
      travelRequired,
      conflict,
      riskNote,
    });
  });

  // Utilization summary
  const utilizationSummary: Record<string, number> = {};
  activeAuditors.forEach(a => {
    const days = auditorDayMap[a.name] || 0;
    utilizationSummary[a.name] = Math.min(Math.round((days / 20) * 100), 100);
  });

  // Bottleneck risk
  const overloaded = Object.entries(utilizationSummary).filter(([, u]) => u > 80);
  if (overloaded.length > 0) risks.push(`Potential bottleneck: ${overloaded.map(([n, u]) => `${n} at ${u}%`).join(', ')} — consider redistributing or adding temporary resource`);
  const tightSchedules = items.filter(i => {
    if (!i.startDate || !i.endDate) return false;
    const gap = (new Date(i.endDate).getTime() - new Date(i.startDate).getTime()) / 86400000;
    return gap < 1;
  });
  if (tightSchedules.length > 0) risks.push(`${tightSchedules.length} audit(s) have zero buffer days — any delay will cascade`);

  return { items, utilizationSummary, conflicts, risks, unscheduled, generatedAt: new Date().toISOString() };
}

/* ─── Claude streaming ───────────────────────────────────────────── */
const SYSTEM = `You are an audit scheduling optimization AI. Create optimal audit schedules considering multiple factors.

Input factors:
- Team members and their expertise
- Client requirements and availability
- Audit complexity and estimated hours
- Travel requirements
- Auditor workload and capacity
- Skill requirements for each audit

Return a JSON object with:
{
  "items": [{ "jobId": string, "auditorName": string, "auditorRole": string, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "utilization": number, "travelRequired": boolean, "conflict": string|null, "riskNote": string|null }],
  "utilizationSummary": { "AuditorName": utilization_percent },
  "conflicts": [string],
  "risks": [string],
  "unscheduled": [string],
  "generatedAt": "ISO datetime"
}

Optimize for: Efficiency, cost, quality, team satisfaction.
Return ONLY the JSON object. No markdown fences, no other text.`;

async function streamSchedule(prompt: string, signal: AbortSignal): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('not_configured');
  let buf = '';
  const res = await anthropicFetch({
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: getModel(), max_tokens: 3000, temperature: 0.2, stream: true, system: SYSTEM, messages: [{ role: 'user', content: prompt }] }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Claude ${res.status}`);
  const reader = res.body.getReader(); const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    for (const line of dec.decode(value).split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim(); if (raw === '[DONE]') return buf;
      try { buf += JSON.parse(raw)?.delta?.text || ''; } catch { /* */ }
    }
  }
  return buf;
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const GOLD = '#c9922a', BLUE = '#1d4ed8';
const cardS: React.CSSProperties = { background: 'var(--cms-bg-surface, #ffffff)', border: '1px solid var(--cms-border-subtle, rgba(15,23,42,0.10))', borderRadius: 16, padding: 20, marginBottom: 16 };
const inp:   React.CSSProperties = { padding: '9px 11px', border: '1.5px solid var(--cms-border-input, #cbd5e1)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: 'var(--cms-text-primary, #0f172a)', background: 'var(--cms-bg-elevated, #f8fafc)', outline: 'none' };
const lbl:   React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--cms-text-muted, #64748b)', marginBottom: 3, letterSpacing: '0.06em', textTransform: 'uppercase' };
const btnS = (c = BLUE, extra: React.CSSProperties = {}): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: 'none', background: c, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', ...extra });
const aiBadge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: 'rgba(201,146,42,0.15)', border: '1px solid rgba(201,146,42,0.4)', color: GOLD, fontSize: 10, fontWeight: 700 };
const UTIL_COLOR = (u: number) => u >= 90 ? '#ef4444' : u >= 70 ? '#f59e0b' : u >= 40 ? '#22c55e' : '#38bdf8';

/* ─── Util bar ───────────────────────────────────────────────────── */
const UtilBar: React.FC<{ name: string; pct: number }> = ({ name, pct }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--cms-text-muted, #64748b)', marginBottom: 3 }}>
      <span>{name}</span>
      <span style={{ fontWeight: 700, color: UTIL_COLOR(pct) }}>{pct}%</span>
    </div>
    <div style={{ height: 7, background: 'var(--cms-bg-elevated, #f8fafc)', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: UTIL_COLOR(pct), borderRadius: 999, transition: 'width 0.5s ease' }} />
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════════ */
const SmartScheduler: React.FC = () => {
  const claude = isClaudeConfigured();

  // Live data
  const liveJobs      = useMemo(() => loadJobs(), []);
  const liveAuditors  = useMemo(() => getAuditors().filter(a => a.status === 'Active'), []);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [planDays,  setPlanDays]  = useState(30);
  const [notes,     setNotes]     = useState('');
  const [output,    setOutput]    = useState<ScheduleOutput | null>(null);
  const [busy,      setBusy]      = useState(false);
  const [source,    setSource]    = useState<'heuristic' | 'claude' | null>(null);
  const [copied,    setCopied]    = useState(false);
  const [expanded,  setExpanded]  = useState<Record<string, boolean>>({});
  const [streamMsg, setStreamMsg] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  /* ── Generate ── */
  const generate = async () => {
    if (busy) { abortRef.current?.abort(); setBusy(false); return; }
    if (liveJobs.length === 0) return;

    const heuristic = runHeuristicSchedule(liveJobs, liveAuditors, startDate);
    setOutput(heuristic); setSource('heuristic');

    if (!claude) return;
    setBusy(true); setStreamMsg('Optimising with Claude…');
    abortRef.current = new AbortController();

    const prompt = `Build an optimal audit schedule with this data:

PLANNING WINDOW: ${startDate} to ${new Date(new Date(startDate).getTime() + planDays * 86400000).toISOString().slice(0,10)} (${planDays} days)

AUDIT JOBS (${liveJobs.length}):
${JSON.stringify(liveJobs.map(j => ({ id: j.id, client: j.clientName, standard: j.standard, type: j.auditType, days: j.estimatedDays, complexity: j.complexity, skill: j.requiredSkill, location: j.location, preferredDate: j.preferredDate })), null, 0)}

AUDITOR TEAM (${liveAuditors.length} active):
${JSON.stringify(liveAuditors.map(a => ({ name: a.name, role: a.role, certs: a.certifications, skills: Object.keys(a.skills || {}), country: a.country, region: a.region })), null, 0)}

COORDINATOR NOTES: ${notes || 'None'}

Assign each job to the best-fit auditor. Avoid conflicts. Flag bottlenecks and travel requirements. Return JSON only.`;

    try {
      const raw = await streamSchedule(prompt, abortRef.current.signal);
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed: ScheduleOutput = JSON.parse(m[0]);
        setOutput(parsed); setSource('claude');
      }
    } catch { /* keep heuristic */ }
    finally { setBusy(false); setStreamMsg(''); }
  };

  /* ── Copy / Export ── */
  const copyOutput = () => {
    if (!output) return;
    const lines = [
      `AUDIT SCHEDULE — Generated ${new Date().toLocaleDateString()}`,
      `Planning window: ${startDate} + ${planDays} days`,
      '',
      ...output.items.map(item => {
        const job = liveJobs.find(j => j.id === item.jobId);
        return `${job?.clientName || item.jobId} | ${item.auditorName} | ${item.startDate}–${item.endDate}${item.travelRequired ? ' ✈' : ''}${item.conflict ? ` ⚠ ${item.conflict}` : ''}`;
      }),
      '',
      'UTILISATION:',
      ...Object.entries(output.utilizationSummary).map(([n, u]) => `  ${n}: ${u}%`),
      output.conflicts.length ? `\nCONFLICTS:\n${output.conflicts.map(c => `  • ${c}`).join('\n')}` : '',
      output.risks.length     ? `\nRISKS:\n${output.risks.map(r => `  • ${r}`).join('\n')}` : '',
      output.unscheduled.length ? `\nUNSCHEDULED: ${output.unscheduled.join(', ')}` : '',
    ].filter(l => l !== undefined).join('\n');
    navigator.clipboard.writeText(lines);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const exportCSV = () => {
    if (!output) return;
    const rows = output.items.map(item => {
      const job = liveJobs.find(j => j.id === item.jobId);
      return [job?.clientName || item.jobId, job?.standard || '', job?.auditType || '', item.auditorName, item.auditorRole, item.startDate, item.endDate, `${item.utilization}%`, item.travelRequired ? 'Yes' : 'No', item.conflict || '', item.riskNote || ''].join(',');
    });
    const csv = ['Client,Standard,Audit Type,Auditor,Role,Start,End,Utilization,Travel,Conflict,Risk', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'audit_schedule.csv'; a.click(); URL.revokeObjectURL(url);
  };

  /* ── Render ── */
  return (
    <div style={{ padding: 24, maxWidth: 1020, margin: '0 auto', fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#0c2340,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CalendarDays size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--cms-text-primary, #0f172a)' }}>Smart Scheduler</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--cms-text-muted, #64748b)' }}>
            {claude ? 'AI-optimised schedule — assigns auditors, detects conflicts, flags bottlenecks' : 'Heuristic scheduler — instant optimised schedule from live jobs and team capacity'}
          </p>
        </div>
      </div>

      {!claude && (
        <div style={{ background: 'rgba(201,146,42,0.07)', border: '1px solid rgba(201,146,42,0.25)', borderRadius: 9, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Info size={14} color={GOLD} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: 'var(--cms-text-primary, #0f172a)', lineHeight: 1.5 }}>
            <strong style={{ color: GOLD }}>Heuristic mode</strong> — skill-matching, capacity-based assignment, conflict detection and travel flagging. Configure Claude API key in <strong>AI Settings</strong> for full AI optimisation.
          </p>
        </div>
      )}

      {/* Config panel */}
      <div style={cardS}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: 'var(--cms-text-primary, #0f172a)' }}>Planning Parameters</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Schedule from</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={lbl}>Planning window (days)</label>
            <select value={planDays} onChange={e => setPlanDays(Number(e.target.value))} style={{ ...inp, width: '100%', boxSizing: 'border-box' }}>
              {[14, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Coordinator Notes / Constraints</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} placeholder="e.g. Avoid last week of month, prioritise ISO 27001 audits, auditor X on leave 15–20" />
          </div>
        </div>

        {/* Live data summary */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {[
            { label: 'Jobs to schedule', val: liveJobs.length,    color: BLUE },
            { label: 'Active auditors',  val: liveAuditors.length, color: '#22c55e' },
            { label: 'High complexity',  val: liveJobs.filter(j => j.complexity === 'High').length, color: '#ef4444' },
            { label: 'Total audit days', val: liveJobs.reduce((s, j) => s + j.estimatedDays, 0), color: GOLD },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--cms-bg-subtle, #f1f5f9)', border: '1px solid var(--cms-border-subtle, rgba(15,23,42,0.10))', borderRadius: 9, padding: '8px 16px', textAlign: 'center', minWidth: 90 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <button style={btnS(busy ? '#374151' : BLUE)} onClick={generate} disabled={liveJobs.length === 0}>
            {busy
              ? <><Loader2 size={14} style={{ animation: 'ss-spin 1s linear infinite' }} />{claude ? ' Optimising… (stop)' : ' Scheduling…'}</>
              : <><Wand2 size={14} />{claude ? ' Optimise with Claude' : ' Generate Schedule'}</>}
          </button>
          {output && !busy && (
            <button style={btnS('transparent', { border: '1px solid var(--cms-border-input, #cbd5e1)', color: 'var(--cms-text-muted, #64748b)' })} onClick={generate}>
              <RefreshCw size={13} /> Regenerate
            </button>
          )}
        </div>
        {streamMsg && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Loader2 size={13} color={GOLD} style={{ animation: 'ss-spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 12, color: 'var(--cms-text-muted, #64748b)' }}>{streamMsg}</span>
          </div>
        )}
      </div>

      {output && (
        <>
          {/* Summary row */}
          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--cms-text-primary, #0f172a)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={15} color="#22c55e" /> Schedule ready — {output.items.length} audits assigned
              </span>
              {source === 'claude' && <span style={aiBadge}><Sparkles size={9} /> Claude AI</span>}
              {source === 'heuristic' && <span style={{ ...aiBadge, background: 'rgba(100,116,139,0.12)', borderColor: 'rgba(100,116,139,0.3)', color: 'var(--cms-text-muted, #64748b)' }}>Heuristic</span>}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
                <button style={btnS('#1e293b', { padding: '6px 11px', fontSize: 12, border: '1px solid var(--cms-border-subtle, rgba(15,23,42,0.12))' })} onClick={copyOutput}><Copy size={12} />{copied ? ' Copied!' : ' Copy'}</button>
                <button style={btnS('#064e3b', { padding: '6px 11px', fontSize: 12 })} onClick={exportCSV}><Download size={12} /> CSV</button>
              </div>
            </div>

            {/* Conflicts + Risks */}
            {output.conflicts.length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 9, padding: '10px 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', marginBottom: 5 }}>⚠ {output.conflicts.length} Conflict{output.conflicts.length > 1 ? 's' : ''}</div>
                {output.conflicts.map((c, i) => <p key={i} style={{ margin: '2px 0', fontSize: 12, color: '#fca5a5' }}>• {c}</p>)}
              </div>
            )}
            {output.risks.length > 0 && (
              <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 9, padding: '10px 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', marginBottom: 5 }}>🔶 {output.risks.length} Risk Area{output.risks.length > 1 ? 's' : ''}</div>
                {output.risks.map((r, i) => <p key={i} style={{ margin: '2px 0', fontSize: 12, color: '#fcd34d' }}>• {r}</p>)}
              </div>
            )}
            {output.unscheduled.length > 0 && (
              <div style={{ background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 9, padding: '10px 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--cms-text-muted, #64748b)', marginBottom: 4 }}>⭕ Unscheduled ({output.unscheduled.length})</div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--cms-text-muted, #64748b)' }}>{output.unscheduled.join(', ')}</p>
              </div>
            )}

            {/* Utilization bars */}
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--cms-text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                <Users size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Team Utilisation
              </div>
              {Object.entries(output.utilizationSummary).map(([name, pct]) => (
                <UtilBar key={name} name={name} pct={pct} />
              ))}
            </div>
          </div>

          {/* Schedule items */}
          {output.items.map(item => {
            const job  = liveJobs.find(j => j.id === item.jobId);
            const isExp = expanded[item.jobId];
            const hasIssue = !!(item.conflict || item.riskNote);
            return (
              <div key={item.jobId} style={{ ...cardS, borderColor: item.conflict ? 'rgba(239,68,68,0.35)' : item.riskNote ? 'rgba(245,158,11,0.3)' : 'var(--cms-border-subtle, rgba(15,23,42,0.10))', borderWidth: hasIssue ? 2 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Date badge */}
                  <div style={{ background: 'var(--cms-bg-subtle, #f1f5f9)', borderRadius: 10, padding: '8px 12px', textAlign: 'center', flexShrink: 0, minWidth: 68 }}>
                    <div style={{ fontSize: 10, color: 'var(--cms-text-muted, #64748b)', fontWeight: 700 }}>{new Date(item.startDate).toLocaleString('default', { month: 'short' }).toUpperCase()}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--cms-text-primary, #0f172a)', lineHeight: 1 }}>{new Date(item.startDate).getDate()}</div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>→ {new Date(item.endDate).getDate()}</div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cms-text-primary, #0f172a)', marginBottom: 4 }}>
                      {job?.clientName || item.jobId}
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--cms-text-muted, #64748b)' }}>{job?.standard}</span>
                      <span style={{ fontSize: 11, color: '#475569' }}>•</span>
                      <span style={{ fontSize: 11, color: 'var(--cms-text-muted, #64748b)' }}>{job?.auditType}</span>
                      {job?.location && job.location !== 'TBD' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#475569' }}>
                          <MapPin size={10} /> {job.location}
                        </span>
                      )}
                      {item.travelRequired && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8' }}>✈ Travel</span>
                      )}
                      {item.conflict && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 7px', borderRadius: 999 }}>
                          <AlertTriangle size={10} /> Conflict
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Auditor + util */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--cms-text-primary, #0f172a)' }}>{item.auditorName}</div>
                    <div style={{ fontSize: 11, color: 'var(--cms-text-muted, #64748b)', marginBottom: 4 }}>{item.auditorRole}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                      <TrendingUp size={11} color={UTIL_COLOR(item.utilization)} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: UTIL_COLOR(item.utilization) }}>{item.utilization}%</span>
                    </div>
                  </div>

                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', flexShrink: 0, marginTop: 2 }}
                    onClick={() => setExpanded(p => ({ ...p, [item.jobId]: !isExp }))}>
                    {isExp ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>

                {isExp && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--cms-bg-elevated, #f8fafc)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'Duration', icon: <Clock size={11} />, val: `${job?.estimatedDays || 1} day${(job?.estimatedDays || 1) > 1 ? 's' : ''} (${item.startDate} → ${item.endDate})` },
                      { label: 'Complexity', icon: <TrendingUp size={11} />, val: job?.complexity || 'Medium' },
                      { label: 'Required Skill', icon: <CheckCircle2 size={11} />, val: job?.requiredSkill || '' },
                      item.conflict ? { label: '⚠ Conflict', icon: <AlertTriangle size={11} />, val: item.conflict } : null,
                      item.riskNote ? { label: '🔶 Risk Note', icon: <AlertTriangle size={11} />, val: item.riskNote } : null,
                    ].filter(Boolean).map((f: any) => (
                      <div key={f.label} style={{ background: 'var(--cms-bg-subtle, #f1f5f9)', borderRadius: 9, padding: '10px 12px', gridColumn: f.label.includes('Conflict') || f.label.includes('Risk') ? 'span 3' : undefined }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {f.icon} {f.label}
                        </div>
                        <div style={{ fontSize: 12.5, color: f.label.includes('Conflict') ? '#fca5a5' : f.label.includes('Risk') ? '#fcd34d' : '#cbd5e1', fontWeight: f.label.includes('Conflict') || f.label.includes('Risk') ? 600 : 400 }}>{f.val}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {output.items.length === 0 && (
            <div style={{ ...cardS, textAlign: 'center', padding: 32 }}>
              <Plus size={36} color="#1e3a5f" style={{ marginBottom: 10 }} />
              <p style={{ color: '#475569', margin: 0 }}>No schedule items generated. Ensure active auditors and pending audit jobs exist in the system.</p>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes ss-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
};

export default SmartScheduler;
