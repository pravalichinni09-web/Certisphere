/**
 * EvidenceValidation — AI evidence quality assessor for the Auditor role.
 * Scores each piece of evidence across 5 criteria. Heuristic instant,
 * Claude upgrade when key configured.
 */
import React, { useState, useRef, useMemo } from 'react';
import {
  Wand2, Loader2, Info, Sparkles,
  Copy, RefreshCw, Plus, Trash2, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, AlertCircle, FileCheck,
} from 'lucide-react';
import { isClaudeConfigured, getApiKey, getModel } from '../../ai/claudeClient';
import { loadCorrectiveActions } from '../../services/correctiveActions';

/* ──────────────────────── Types ────────────────────────────────── */
type Authenticity  = 'Authentic' | 'Questionable' | 'Fabricated';
type Completeness  = 'Complete' | 'Partial' | 'Incomplete';
type Clarity       = 'Clear' | 'Unclear' | 'Insufficient';
type Recommendation = 'Accept' | 'Request Additional Evidence' | 'Reject';

interface Assessment {
  relevance:        number;         // 0-100
  authenticity:     Authenticity;
  completeness:     Completeness;
  clarity:          Clarity;
  docQuality:       number;         // 0-100
  overallScore:     number;         // 0-100
  adequateForTrail: boolean;
  improvements:     string[];
  recommendation:   Recommendation;
  rationale:        string;
}

interface EvidenceItem {
  id: string;
  name: string;
  date: string;
  type: string;           // pdf, xlsx, photo, email, log, other
  description: string;    // user's description of what it shows
  finding: string;        // the NC/finding it relates to
  capId?: string;         // if pulled from a CAR
  severity?: string;
  standard?: string;
  assessment?: Assessment;
  assessing?: boolean;
}

/* ──────────────────────── Read live evidence from CARs ─────────── */
function loadLiveEvidence(): EvidenceItem[] {
  const actions = loadCorrectiveActions();
  const items: EvidenceItem[] = [];
  actions.forEach(a => {
    if (!a.evidence || a.evidence.length === 0) return;
    a.evidence.forEach((ev, idx) => {
      const ext  = ev.name.split('.').pop()?.toLowerCase() || 'other';
      const type = ['pdf','docx','doc','xlsx','xls'].includes(ext) ? ext
                 : ['jpg','jpeg','png','gif','bmp','webp'].includes(ext) ? 'photo'
                 : ['msg','eml'].includes(ext) ? 'email' : 'other';
      items.push({
        id: `${a.capId}-ev${idx}`,
        name: ev.name,
        date: ev.date,
        type,
        description: '',
        finding: a.description,
        capId: a.capId,
        severity: a.severity,
        standard: a.standard,
      });
    });
  });
  return items;
}

/* ──────────────────────── Heuristic scoring ────────────────────── */
const FILE_TYPES_SCORED: Record<string, number> = {
  pdf: 25, docx: 20, doc: 18, xlsx: 20, xls: 18,
  photo: 15, jpg: 15, jpeg: 15, png: 15,
  email: 18, msg: 18, eml: 18, other: 5,
};

function heuristicAssess(item: EvidenceItem): Assessment {
  const name = item.name.toLowerCase();
  const desc = (item.description + ' ' + item.finding).toLowerCase();
  const ext  = item.name.split('.').pop()?.toLowerCase() || '';

  /* ── Relevance ──────────────────────────────────────── */
  let relevance = 40; // base
  // name contains keywords from finding
  const findingWords = item.finding.toLowerCase()
    .split(/\s+/).filter(w => w.length > 4)
    .slice(0, 8);
  const matchCount = findingWords.filter(w => name.includes(w) || desc.includes(w)).length;
  relevance += Math.min(matchCount * 8, 35);
  // has date suffix in name
  if (/\d{4}/.test(item.name)) relevance += 10;
  // description provided
  if (item.description.trim().length > 20) relevance += 15;
  relevance = Math.min(relevance, 100);

  /* ── Authenticity ───────────────────────────────────── */
  let authScore = 0;
  if (item.date && item.date.trim()) authScore += 3;
  if (/\d{4}/.test(item.name)) authScore += 2;       // year in filename
  if (ext && ext !== 'other') authScore += 2;
  if (name.includes('screenshot') || name.includes('photo')) authScore += 1;
  const authenticity: Authenticity =
    authScore >= 6 ? 'Authentic' : authScore >= 3 ? 'Questionable' : 'Fabricated';

  /* ── Completeness ───────────────────────────────────── */
  let compScore = 0;
  if (item.name && item.name.trim().length > 5) compScore++;
  if (item.date && item.date.trim()) compScore++;
  if (item.description.trim().length > 20) compScore++;
  if (item.finding.trim().length > 10) compScore++;
  const completeness: Completeness =
    compScore >= 4 ? 'Complete' : compScore >= 2 ? 'Partial' : 'Incomplete';

  /* ── Clarity ────────────────────────────────────────── */
  const isGeneric = /^(document|doc|file|image|scan|photo|attachment|evidence)\d*\.(pdf|jpg|png|docx)$/i.test(item.name.trim());
  const isDescriptive = item.name.replace(/\.[a-z]+$/,'').split(/[_\-\s]/).filter(p => p.length > 2).length >= 3;
  const clarity: Clarity = isGeneric ? 'Insufficient'
    : isDescriptive ? 'Clear' : 'Unclear';

  /* ── Doc quality (0-100) ───────────────────────────── */
  let dq = 0;
  dq += Math.min((FILE_TYPES_SCORED[ext] || 5), 25);   // file type weight
  if (item.date) dq += 20;                              // dated
  if (isDescriptive) dq += 20;                          // descriptive name
  if (item.description.trim().length > 20) dq += 20;   // described
  if (/v\d|rev\d|_r\d/i.test(item.name)) dq += 10;    // version ref
  if (item.standard) dq += 5;                          // linked to standard

  /* ── Overall (weighted) ─────────────────────────────── */
  const authNum    = authenticity === 'Authentic' ? 100 : authenticity === 'Questionable' ? 55 : 10;
  const compNum    = completeness === 'Complete' ? 100 : completeness === 'Partial' ? 55 : 10;
  const clarNum    = clarity === 'Clear' ? 100 : clarity === 'Unclear' ? 55 : 10;
  const overall    = Math.round(relevance * 0.30 + authNum * 0.20 + compNum * 0.20 + clarNum * 0.15 + dq * 0.15);
  const adequate   = overall >= 65 && authenticity !== 'Fabricated' && completeness !== 'Incomplete';

  /* ── Improvements ───────────────────────────────────── */
  const improvements: string[] = [];
  if (relevance < 70)  improvements.push('Add a clear description explaining exactly which requirement this evidence addresses.');
  if (authenticity !== 'Authentic') improvements.push('Include a date, authorised signature, or document reference to confirm authenticity.');
  if (completeness !== 'Complete')  improvements.push('Provide a date for the evidence and link it explicitly to the finding.');
  if (clarity === 'Insufficient')   improvements.push(`Rename the file to be descriptive (e.g. "Training_Record_ISO9001_Jul2026.pdf").`);
  if (clarity === 'Unclear')        improvements.push('Use a structured filename: [Subject]_[Standard/Clause]_[Date].[ext].');
  if (dq < 60)                      improvements.push('Prefer PDF or signed documents over screenshots where possible for audit trail integrity.');
  if (item.description.trim().length === 0) improvements.push('Enter a description explaining what this evidence demonstrates and how it addresses the finding.');
  if (improvements.length === 0)    improvements.push('Evidence meets quality standards. No improvements required.');

  /* ── Recommendation ──────────────────────────────────── */
  const recommendation: Recommendation =
    overall >= 75 ? 'Accept'
    : overall >= 50 ? 'Request Additional Evidence'
    : 'Reject';

  const rationale =
    recommendation === 'Accept'
      ? `This evidence demonstrates sufficient relevance, authenticity, and completeness to support the audit trail for the identified finding.`
    : recommendation === 'Request Additional Evidence'
      ? `The evidence partially addresses the finding but has gaps in ${[
          relevance < 70 ? 'relevance' : '',
          authenticity !== 'Authentic' ? 'authenticity' : '',
          completeness !== 'Complete' ? 'completeness' : '',
          clarity !== 'Clear' ? 'clarity' : '',
        ].filter(Boolean).join(', ')}. Additional or improved evidence is required before closure can be accepted.`
      : `This evidence does not meet the minimum quality threshold for audit trail adequacy. It lacks sufficient ${authenticity === 'Fabricated' ? 'authenticity markers — this evidence may not be genuine' : 'detail and structure'} to support a formal corrective action closure.`;

  return { relevance, authenticity, completeness, clarity, docQuality: Math.min(dq, 100), overallScore: overall, adequateForTrail: adequate, improvements, recommendation, rationale };
}

/* ──────────────────────── Claude call ─────────────────────────── */
const SYSTEM = `You are an evidence quality assessor for audits. Evaluate the quality and adequacy of provided evidence.

Rate evidence on:
1. Relevance to finding (%)
2. Authenticity (Authentic/Questionable/Fabricated)
3. Completeness (Complete/Partial/Incomplete)
4. Clarity (Clear/Unclear/Insufficient)
5. Documentation quality (0-100)

Provide:
- Overall Quality Score (0-100)
- Adequacy for audit trail: true/false
- Required improvements (array of strings)
- Recommendation: Accept | Request Additional Evidence | Reject
- Rationale (1-2 sentences)

Return a JSON array, one object per evidence item, with fields:
id, relevance, authenticity, completeness, clarity, docQuality, overallScore, adequateForTrail, improvements, recommendation, rationale.
Return ONLY the JSON array. No markdown fences, no other text.`;

async function claudeAssessAll(items: EvidenceItem[], signal: AbortSignal): Promise<Assessment[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('not_configured');
  const payload = items.map(it => ({
    id: it.id, filename: it.name, date: it.date, fileType: it.type,
    userDescription: it.description, finding: it.finding,
    severity: it.severity, standard: it.standard, capId: it.capId,
  }));
  let buf = '';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: getModel(), max_tokens: 3000, temperature: 0.2, stream: true, system: SYSTEM, messages: [{ role: 'user', content: `Assess these ${items.length} evidence items:\n${JSON.stringify(payload, null, 0)}` }] }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Claude ${res.status}`);
  const reader = res.body.getReader(); const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    for (const line of dec.decode(value).split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim(); if (raw === '[DONE]') { break; }
      try { const d = JSON.parse(raw)?.delta?.text || ''; buf += d; } catch { /* */ }
    }
  }
  const m = buf.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('parse_error');
  return JSON.parse(m[0]) as Assessment[];
}

/* ──────────────────────── Style helpers ────────────────────────── */
const GOLD = '#c9922a', BLUE = '#1d4ed8';
const REC_STYLE: Record<Recommendation, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  'Accept':                     { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)',   icon: <CheckCircle2 size={14}/> },
  'Request Additional Evidence':{ color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', icon: <AlertCircle size={14}/> },
  'Reject':                     { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.35)', icon: <XCircle size={14}/> },
};
const AUTH_COLOR: Record<Authenticity, string> = { Authentic: '#22c55e', Questionable: '#f59e0b', Fabricated: '#ef4444' };
const COMP_COLOR: Record<Completeness, string> = { Complete: '#22c55e', Partial: '#f59e0b', Incomplete: '#ef4444' };
const CLAR_COLOR: Record<Clarity, string>       = { Clear: '#22c55e', Unclear: '#f59e0b', Insufficient: '#ef4444' };
const cardS: React.CSSProperties = { background: '#ffffff', border: '1px solid rgba(15,23,42,0.09)', borderRadius: 16, padding: 22, marginBottom: 18 };
const inp:   React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1.5px solid rgba(15,23,42,0.12)', borderRadius: 9, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', color: '#0f2547', background: '#f8fafc', outline: 'none' };
const lbl:   React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 800, color: '#64748b', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' };
const btnS = (c = BLUE, extra: React.CSSProperties = {}): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: c, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', ...extra });
const aiBadge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, background: 'rgba(201,146,42,0.15)', border: '1px solid rgba(201,146,42,0.4)', color: GOLD, fontSize: 10, fontWeight: 700 };
const FILE_TYPES = ['pdf', 'docx', 'xlsx', 'photo', 'email', 'log', 'other'];
const FILE_EMOJI: Record<string, string> = { pdf: '📄', docx: '📝', xlsx: '📊', photo: '📸', email: '📧', log: '🗒️', other: '📎' };

/* ──────────────────────── Score gauge ──────────────────────────── */
const ScoreGauge: React.FC<{ score: number; size?: number }> = ({ score, size = 80 }) => {
  const r = size / 2 - 8;
  const circ = Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ position: 'relative', width: size, height: size / 2 + 14, flexShrink: 0 }}>
      <svg width={size} height={size / 2 + 8} style={{ transform: 'rotate(180deg)' }}>
        <path d={`M 8,${size/2} A ${r},${r} 0 0,1 ${size-8},${size/2}`}
          fill="none" stroke="rgba(15,23,42,0.09)" strokeWidth="8" strokeLinecap="round" />
        <path d={`M 8,${size/2} A ${r},${r} 0 0,1 ${size-8},${size/2}`}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', bottom: 0, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: size * 0.28, fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>/ 100</div>
      </div>
    </div>
  );
};

/* ──────────────────────── Pill ─────────────────────────────────── */
const Pill: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: `${color}18`, border: `1px solid ${color}55`, color }}>{label}</span>
);

/* ──────────────────────── Bar ──────────────────────────────────── */
const Bar: React.FC<{ val: number; label: string }> = ({ val, label }) => {
  const color = val >= 75 ? '#22c55e' : val >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 3 }}>
        <span>{label}</span><span style={{ fontWeight: 700, color }}>{val}%</span>
      </div>
      <div style={{ height: 6, background: 'rgba(15,23,42,0.08)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${val}%`, background: color, borderRadius: 999, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════════ */
const EvidenceValidation: React.FC = () => {
  const claude = isClaudeConfigured();
  const liveEvidence = useMemo(() => loadLiveEvidence(), []);

  const [items, setItems]         = useState<EvidenceItem[]>(liveEvidence);
  const [busy, setBusy]           = useState(false);
  const [source, setSource]       = useState<'heuristic' | 'claude' | null>(null);
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({});
  const [copied, setCopied]       = useState(false);
  const [streamMsg, setStreamMsg] = useState('');
  const [filterRec, setFilterRec] = useState<Recommendation | 'All'>('All');
  const abortRef = useRef<AbortController | null>(null);

  /* ── Add blank item ── */
  const addItem = () => {
    const id = `custom-${Date.now()}`;
    setItems(p => [...p, { id, name: '', date: '', type: 'pdf', description: '', finding: '' }]);
    setExpanded(p => ({ ...p, [id]: true }));
  };
  const removeItem = (id: string) => setItems(p => p.filter(it => it.id !== id));
  const updateItem = (id: string, patch: Partial<EvidenceItem>) =>
    setItems(p => p.map(it => it.id === id ? { ...it, ...patch } : it));

  /* ── Run assessment ── */
  const assess = async () => {
    if (busy) { abortRef.current?.abort(); setBusy(false); return; }
    if (items.length === 0) return;

    // Heuristic immediately
    setItems(p => p.map(it => ({ ...it, assessing: false, assessment: heuristicAssess(it) })));
    setSource('heuristic');

    if (!claude) return;
    setBusy(true); setStreamMsg('Sending to Claude…');
    abortRef.current = new AbortController();
    try {
      const results = await claudeAssessAll(items, abortRef.current.signal);
      const byId = new Map(results.map((r: any) => [r.id as string, r as Assessment]));
      // Claude may use index-based id; fall back to position
      setItems(p => p.map((it, idx) => {
        const a = byId.get(it.id) || results[idx];
        return a ? { ...it, assessment: a } : it;
      }));
      setSource('claude');
    } catch { /* keep heuristic */ }
    finally { setBusy(false); setStreamMsg(''); }
  };

  /* ── Stats ── */
  const assessed = items.filter(i => i.assessment);
  const avgScore = assessed.length ? Math.round(assessed.reduce((s, i) => s + (i.assessment!.overallScore), 0) / assessed.length) : 0;
  const recCounts = { Accept: 0, 'Request Additional Evidence': 0, Reject: 0 };
  assessed.forEach(i => { if (i.assessment) recCounts[i.assessment.recommendation]++; });

  /* ── Visible items ── */
  const visible = filterRec === 'All' ? items : items.filter(i => i.assessment?.recommendation === filterRec);

  /* ── Copy report ── */
  const copyReport = () => {
    const lines = assessed.map(it => {
      const a = it.assessment!;
      return `${it.name} (${it.capId || 'manual'})\nScore: ${a.overallScore}/100 | Relevance: ${a.relevance}% | ${a.authenticity} | ${a.completeness} | ${a.clarity}\nRecommendation: ${a.recommendation}\n${a.rationale}\nImprovements:\n${a.improvements.map(x => `  • ${x}`).join('\n')}`;
    }).join('\n\n────────────────\n\n');
    navigator.clipboard.writeText(lines);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  /* ── Render ── */
  return (
    <div style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#0c3b2e,#22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileCheck size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f2547' }}>Evidence Validation</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            {claude ? 'AI quality assessor — rates every piece of evidence across 5 professional criteria' : 'Heuristic evidence quality scorer — add Claude API key for deep AI assessment'}
          </p>
        </div>
      </div>

      {!claude && (
        <div style={{ background: 'rgba(201,146,42,0.07)', border: '1px solid rgba(201,146,42,0.25)', borderRadius: 9, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Info size={15} color={GOLD} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#0f2547', lineHeight: 1.5 }}>
            <strong style={{ color: GOLD }}>Heuristic mode</strong> — scores against 5 quality dimensions using filename analysis, metadata, and description completeness. Configure Claude API key in <strong>AI Settings</strong> for professional-grade AI assessment.
          </p>
        </div>
      )}

      {/* Controls row */}
      <div style={{ ...cardS, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f2547' }}>
            {items.length} evidence item{items.length !== 1 ? 's' : ''}
            {liveEvidence.length > 0 && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400, marginLeft: 6 }}>({liveEvidence.length} from live CARs)</span>}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={btnS('#eef2f7', { border: '1px solid rgba(15,23,42,0.14)', color: '#64748b' })} onClick={addItem}>
              <Plus size={14} /> Add Evidence
            </button>
            <button style={btnS(busy ? '#374151' : '#166534')} onClick={assess} disabled={items.length === 0}>
              {busy
                ? <><Loader2 size={14} style={{ animation: 'ev-spin 1s linear infinite' }} />{claude ? ' Assessing… (stop)' : ' Scoring…'}</>
                : <><Wand2 size={14} />{claude ? ' Assess with Claude' : ' Run Assessment'}</>}
            </button>
            {assessed.length > 0 && !busy && (
              <button style={btnS('transparent', { border: '1px solid rgba(15,23,42,0.14)', color: '#64748b' })} onClick={assess}>
                <RefreshCw size={13} /> Re-assess
              </button>
            )}
          </div>
        </div>
        {streamMsg && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={13} color={GOLD} style={{ animation: 'ev-spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 12, color: '#64748b' }}>{streamMsg}</span>
          </div>
        )}
      </div>

      {/* Summary stats + filter */}
      {assessed.length > 0 && (
        <div style={cardS}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
            <ScoreGauge score={avgScore} size={90} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Portfolio Average Score</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                {(['Accept', 'Request Additional Evidence', 'Reject'] as Recommendation[]).map(r => {
                  const s = REC_STYLE[r];
                  return (
                    <button key={r} onClick={() => setFilterRec(filterRec === r ? 'All' : r)}
                      style={{ ...btnS('transparent', { padding: '4px 12px', fontSize: 11, border: `1px solid ${filterRec === r ? s.color : 'rgba(15,23,42,0.12)'}`, color: filterRec === r ? s.color : '#64748b', background: filterRec === r ? s.bg : 'transparent' })}}>
                      {s.icon} {r} <span style={{ background: s.color, color: '#fff', borderRadius: 999, padding: '0 5px', fontSize: 10, marginLeft: 2 }}>{recCounts[r]}</span>
                    </button>
                  );
                })}
                {filterRec !== 'All' && (
                  <button onClick={() => setFilterRec('All')} style={btnS('transparent', { padding: '4px 10px', fontSize: 11, border: '1px solid rgba(15,23,42,0.12)', color: '#64748b' })}>All</button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {source === 'claude'    && <span style={aiBadge}><Sparkles size={10} /> Claude AI</span>}
              {source === 'heuristic' && <span style={{ ...aiBadge, background: 'rgba(100,116,139,0.12)', borderColor: 'rgba(100,116,139,0.3)', color: '#64748b' }}>Heuristic</span>}
              <button style={btnS('#eef2f7', { padding: '6px 12px', fontSize: 12, border: '1px solid rgba(15,23,42,0.12)' })} onClick={copyReport}>
                <Copy size={12} /> {copied ? 'Copied!' : 'Copy Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence cards */}
      {visible.map(item => {
        const a    = item.assessment;
        const isExp = expanded[item.id] ?? !a;
        const rec  = a ? REC_STYLE[a.recommendation] : null;
        return (
          <div key={item.id} style={{ ...cardS, borderColor: rec ? rec.border : 'rgba(15,23,42,0.09)', borderWidth: a?.recommendation === 'Reject' ? 2 : 1 }}>

            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isExp ? 16 : 0 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{FILE_EMOJI[item.type] || '📎'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f2547', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name || <span style={{ color: '#475569', fontStyle: 'italic' }}>Untitled evidence</span>}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                  {item.capId && <span>{item.capId}</span>}
                  {item.severity && <span style={{ color: item.severity === 'Major NC' ? '#ef4444' : '#f59e0b' }}>{item.severity}</span>}
                  {item.date && <span>📅 {item.date}</span>}
                </div>
              </div>
              {a && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <ScoreGauge score={a.overallScore} size={68} />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999, color: rec!.color, background: rec!.bg, border: `1px solid ${rec!.border}` }}>
                    {rec!.icon} {a.recommendation}
                  </span>
                </div>
              )}
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}
                onClick={() => setExpanded(p => ({ ...p, [item.id]: !isExp }))}>
                {isExp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', flexShrink: 0 }}
                onClick={() => removeItem(item.id)} title="Remove">
                <Trash2 size={14} />
              </button>
            </div>

            {isExp && (
              <>
                {/* Edit fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={lbl}>File / Evidence Name</label>
                    <input value={item.name} onChange={e => updateItem(item.id, { name: e.target.value })} style={inp} placeholder="e.g. Training_Record_Jul2026.pdf" />
                  </div>
                  <div>
                    <label style={lbl}>Date</label>
                    <input type="date" value={item.date} onChange={e => updateItem(item.id, { date: e.target.value })} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>File Type</label>
                    <select value={item.type} onChange={e => updateItem(item.id, { type: e.target.value })} style={inp}>
                      {FILE_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Related Finding / NC Description</label>
                  <textarea value={item.finding} onChange={e => updateItem(item.id, { finding: e.target.value })} rows={2}
                    style={{ ...inp, resize: 'vertical', minHeight: 52 }}
                    placeholder="Paste the non-conformance or finding text this evidence addresses…" />
                </div>
                <div style={{ marginBottom: a ? 16 : 0 }}>
                  <label style={lbl}>What This Evidence Demonstrates</label>
                  <textarea value={item.description} onChange={e => updateItem(item.id, { description: e.target.value })} rows={2}
                    style={{ ...inp, resize: 'vertical', minHeight: 52 }}
                    placeholder="Briefly describe what this document shows and how it closes the finding…" />
                </div>

                {/* Assessment result */}
                {a && (
                  <div style={{ marginTop: 4, paddingTop: 16, borderTop: '1px solid rgba(15,23,42,0.08)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                      {/* Scores */}
                      <div style={{ background: '#eef4fb', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Criteria Scores</div>
                        <Bar val={a.relevance} label="Relevance to Finding" />
                        <Bar val={a.docQuality} label="Documentation Quality" />
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                          <Pill label={a.authenticity} color={AUTH_COLOR[a.authenticity]} />
                          <Pill label={a.completeness} color={COMP_COLOR[a.completeness]} />
                          <Pill label={a.clarity}      color={CLAR_COLOR[a.clarity]} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          {a.adequateForTrail
                            ? <><CheckCircle2 size={14} color="#22c55e" /><span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>Adequate for audit trail</span></>
                            : <><XCircle size={14} color="#ef4444" /><span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>Not adequate for audit trail</span></>}
                        </div>
                      </div>

                      {/* Rationale + improvements */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ background: '#eef4fb', borderRadius: 10, padding: '12px 14px', flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>📋 Assessor Rationale</div>
                          <p style={{ margin: 0, fontSize: 12.5, color: '#475569', lineHeight: 1.55 }}>{a.rationale}</p>
                        </div>
                        <div style={{ background: '#eef4fb', borderRadius: 10, padding: '12px 14px', flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>🔧 Required Improvements</div>
                          <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {a.improvements.map((imp, i) => (
                              <li key={i} style={{ fontSize: 12, color: a.improvements[0] === 'Evidence meets quality standards. No improvements required.' ? '#22c55e' : '#fbbf24', lineHeight: 1.45 }}>{imp}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {items.length === 0 && (
        <div style={{ ...cardS, textAlign: 'center', padding: 40 }}>
          <FileCheck size={40} color="#1e3a5f" style={{ marginBottom: 12 }} />
          <p style={{ color: '#475569', margin: 0, fontSize: 14 }}>No evidence items yet. Add evidence manually or submit corrective actions with evidence attachments.</p>
          <button style={{ ...btnS(BLUE), marginTop: 16 }} onClick={addItem}><Plus size={14} /> Add Evidence Item</button>
        </div>
      )}

      <style>{`@keyframes ev-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
};

export default EvidenceValidation;
