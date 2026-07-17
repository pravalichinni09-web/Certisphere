/**
 * FindingsCategorization — auto-classifies audit findings across 7 dimensions.
 * Heuristic engine runs instantly; Claude upgrade when key configured.
 */
import React, { useState, useRef, useMemo } from 'react';
import {
  LayoutList, Wand2, Loader2, Info, Sparkles,
  Plus, Trash2, Copy, Download, RefreshCw,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { isClaudeConfigured, getApiKey, getModel } from '../../ai/claudeClient';
import { loadCorrectiveActions } from '../../services/correctiveActions';

/* ──────────────────────── Types ─────────────────────────────────── */
type ClassificationType = 'Non-Conformity (Critical)' | 'Non-Conformity (Major)' | 'Non-Conformity (Minor)' | 'Observation' | 'Opportunity for Improvement';
type ImpactLevel        = 'High' | 'Medium' | 'Low';
type EffortLevel        = 'High (>3 months)' | 'Medium (1–3 months)' | 'Low (<1 month)';
type RootCauseCategory  =
  | 'Training & Competence'
  | 'Process & Procedure'
  | 'Documentation & Records'
  | 'Technology & Systems'
  | 'Management & Leadership'
  | 'Resource & Capacity'
  | 'Communication'
  | 'External / Supplier'
  | 'Unknown';

interface Classification {
  classification:    ClassificationType;
  impact:            ImpactLevel;
  rootCauseCategory: RootCauseCategory;
  effort:            EffortLevel;
  priority:          1 | 2 | 3 | 4 | 5;
  targetDate:        string;      // ISO date string
  rationale:         string;
}

interface Finding {
  id: string;
  findingId: string;   // display ID e.g. F-001
  description: string;
  clause?: string;
  source?: string;     // CAP ID if imported
  severity?: string;   // from CAR if imported
  classification?: Classification;
  editing?: boolean;
}

/* ──────────────────────── Heuristic engine ──────────────────────── */
const KEYWORDS = {
  critical:     ['fabricat', 'falsif', 'deliberate', 'fraud', 'systemic failure', 'complete absence', 'entirely absent', 'no system', 'no process', 'not implemented at all'],
  major:        ['major', 'not implemented', 'missing completely', 'no evidence', 'no record', 'absent', 'systemic', 'recurring', 'repeated', 'multiple instances', 'management system failure'],
  minor:        ['minor', 'isolated', 'single instance', 'one record', 'partially', 'not fully', 'incomplete', 'not always', 'occasionally'],
  ofi:          ['could be', 'consider', 'opportunity', 'recommend', 'enhance', 'improve', 'better practice', 'suggested', 'would benefit'],
  observation:  ['noted', 'observed', 'awareness', 'monitoring', 'trending'],
  highImpact:   ['customer', 'safety', 'regulatory', 'legal', 'critical process', 'product quality', 'certification risk', 'patient', 'food safety', 'financial', 'data breach', 'security'],
  lowImpact:    ['label', 'housekeeping', 'minor admin', 'formatting', 'colour', 'version number'],
  training:     ['train', 'competenc', 'skill', 'induction', 'awareness', 'knowledge', 'staff', 'personnel', 'operator'],
  process:      ['process', 'procedure', 'workflow', 'method', 'practice', 'sop', 'work instruction', 'step'],
  docs:         ['document', 'record', 'form', 'log', 'register', 'manual', 'certificate', 'evidence', 'file'],
  tech:         ['system', 'software', 'erp', 'plm', 'cmms', 'automation', 'it ', 'digital', 'database', 'computer'],
  mgmt:         ['management', 'leadership', 'top management', 'commitment', 'policy', 'objective', 'strategy', 'review'],
  resource:     ['resource', 'budget', 'capacity', 'overload', 'understaffed', 'equipment', 'infrastructure', 'time'],
  comms:        ['communication', 'notif', 'inform', 'escalat', 'report', 'feedback', 'handover'],
  supplier:     ['supplier', 'vendor', 'contractor', 'external provider', 'sub-contractor', 'third party', 'outsource'],
};

function hasAny(text: string, keys: string[]) {
  return keys.some(k => text.includes(k));
}

function heuristicClassify(finding: Finding): Classification {
  const t = (finding.description + ' ' + (finding.clause || '') + ' ' + (finding.severity || '')).toLowerCase();
  const now = new Date();

  /* ── Classification ── */
  let classification: ClassificationType;
  if (finding.severity === 'Major NC' || hasAny(t, KEYWORDS.critical)) {
    classification = hasAny(t, KEYWORDS.critical) ? 'Non-Conformity (Critical)' : 'Non-Conformity (Major)';
  } else if (finding.severity === 'Minor NC' || hasAny(t, KEYWORDS.major)) {
    classification = hasAny(t, KEYWORDS.major) && !hasAny(t, KEYWORDS.minor) ? 'Non-Conformity (Major)' : 'Non-Conformity (Minor)';
  } else if (hasAny(t, KEYWORDS.minor)) {
    classification = 'Non-Conformity (Minor)';
  } else if (finding.severity === 'OFI' || hasAny(t, KEYWORDS.ofi)) {
    classification = 'Opportunity for Improvement';
  } else if (hasAny(t, KEYWORDS.observation)) {
    classification = 'Observation';
  } else {
    classification = 'Non-Conformity (Minor)';
  }

  /* ── Impact ── */
  let impact: ImpactLevel =
    classification === 'Non-Conformity (Critical)' ? 'High'
    : classification === 'Non-Conformity (Major)'  ? 'High'
    : classification === 'Non-Conformity (Minor)'  ? 'Medium'
    : 'Low';
  if (hasAny(t, KEYWORDS.highImpact)) impact = 'High';
  if (hasAny(t, KEYWORDS.lowImpact) && classification !== 'Non-Conformity (Major)') impact = 'Low';

  /* ── Root Cause ── */
  let rootCauseCategory: RootCauseCategory = 'Unknown';
  if      (hasAny(t, KEYWORDS.supplier))  rootCauseCategory = 'External / Supplier';
  else if (hasAny(t, KEYWORDS.mgmt))      rootCauseCategory = 'Management & Leadership';
  else if (hasAny(t, KEYWORDS.tech))      rootCauseCategory = 'Technology & Systems';
  else if (hasAny(t, KEYWORDS.resource))  rootCauseCategory = 'Resource & Capacity';
  else if (hasAny(t, KEYWORDS.comms))     rootCauseCategory = 'Communication';
  else if (hasAny(t, KEYWORDS.training))  rootCauseCategory = 'Training & Competence';
  else if (hasAny(t, KEYWORDS.docs))      rootCauseCategory = 'Documentation & Records';
  else if (hasAny(t, KEYWORDS.process))   rootCauseCategory = 'Process & Procedure';

  /* ── Effort ── */
  const effort: EffortLevel =
    rootCauseCategory === 'Technology & Systems'  ? 'High (>3 months)'
    : rootCauseCategory === 'Management & Leadership' ? 'High (>3 months)'
    : rootCauseCategory === 'Training & Competence'   ? 'Medium (1–3 months)'
    : rootCauseCategory === 'Process & Procedure'     ? 'Medium (1–3 months)'
    : rootCauseCategory === 'External / Supplier'     ? 'Medium (1–3 months)'
    : 'Low (<1 month)';

  /* ── Priority (1–5) ── */
  const priority: 1 | 2 | 3 | 4 | 5 =
    classification === 'Non-Conformity (Critical)'  ? 1
    : classification === 'Non-Conformity (Major)' && impact === 'High' ? 1
    : classification === 'Non-Conformity (Major)'   ? 2
    : classification === 'Non-Conformity (Minor)' && impact === 'High' ? 3
    : classification === 'Non-Conformity (Minor)'   ? 4
    : 5;

  /* ── Target date ── */
  const daysMap: Record<ClassificationType, number> = {
    'Non-Conformity (Critical)': 14,
    'Non-Conformity (Major)':    30,
    'Non-Conformity (Minor)':    90,
    'Observation':              180,
    'Opportunity for Improvement': 180,
  };
  const target = new Date(now.getTime() + daysMap[classification] * 86400000);
  const targetDate = target.toISOString().slice(0, 10);

  /* ── Rationale ── */
  const rationale =
    `Classified as ${classification} based on ${
      hasAny(t, KEYWORDS.critical) ? 'critical language indicating systemic or deliberate failure'
      : finding.severity === 'Major NC' ? 'imported Major NC severity from corrective action record'
      : hasAny(t, KEYWORDS.major) ? 'language indicating systemic or widespread failure'
      : hasAny(t, KEYWORDS.ofi) ? 'advisory/improvement language without a specific requirement breach'
      : hasAny(t, KEYWORDS.observation) ? 'observational language without a clear requirement gap'
      : 'isolated or partial failure language'
    }. Impact assessed as ${impact} due to ${
      hasAny(t, KEYWORDS.highImpact) ? 'reference to high-impact areas (customer/safety/regulatory)'
      : impact === 'High' ? 'the severity of the non-conformance'
      : 'limited scope of the issue'
    }. Root cause likely in ${rootCauseCategory}.`;

  return { classification, impact, rootCauseCategory, effort, priority, targetDate, rationale };
}

/* ──────────────────────── Claude call ──────────────────────────── */
const SYSTEM = `You are an audit findings classifier. Categorize and prioritize audit findings automatically.

For each finding:
1. Classify as: Non-Conformity (Critical), Non-Conformity (Major), Non-Conformity (Minor), Observation, or Opportunity for Improvement
2. Assess impact: High, Medium, or Low
3. Assign root cause category from: Training & Competence, Process & Procedure, Documentation & Records, Technology & Systems, Management & Leadership, Resource & Capacity, Communication, External / Supplier, Unknown
4. Estimate corrective action effort: High (>3 months), Medium (1–3 months), Low (<1 month)
5. Set priority: 1–5 (1 = highest)
6. Recommend a target resolution date (ISO date string, YYYY-MM-DD) from today: ${new Date().toISOString().slice(0,10)}
7. Provide a brief rationale (1–2 sentences)

Return a JSON array. Each object has:
id (string, finding id), classification, impact, rootCauseCategory, effort, priority (number 1-5), targetDate (YYYY-MM-DD string), rationale.

Return ONLY the JSON array. No markdown fences, no other text. Be precise and consistent with ISO audit standards.`;

async function claudeClassify(findings: Finding[], signal: AbortSignal): Promise<Classification[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('not_configured');
  let buf = '';
  const payload = findings.map(f => ({ id: f.id, description: f.description, clause: f.clause, severity: f.severity }));
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: getModel(), max_tokens: 2800, temperature: 0.1, stream: true, system: SYSTEM, messages: [{ role: 'user', content: `Classify these ${findings.length} audit findings:\n${JSON.stringify(payload)}` }] }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Claude ${res.status}`);
  const reader = res.body.getReader(); const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    for (const line of dec.decode(value).split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim(); if (raw === '[DONE]') break;
      try { buf += JSON.parse(raw)?.delta?.text || ''; } catch { /* */ }
    }
  }
  const m = buf.match(/\[[\s\S]*\]/); if (!m) throw new Error('parse');
  return JSON.parse(m[0]) as Classification[];
}

/* ──────────────────────── Style tokens ─────────────────────────── */
const GOLD = '#c9922a', BLUE = '#1d4ed8';
const CLASS_STYLE: Record<ClassificationType, { color: string; bg: string; short: string }> = {
  'Non-Conformity (Critical)': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  short: 'NC-Critical' },
  'Non-Conformity (Major)':    { color: '#f97316', bg: 'rgba(249,115,22,0.12)', short: 'NC-Major' },
  'Non-Conformity (Minor)':    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', short: 'NC-Minor' },
  'Observation':               { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', short: 'Obs' },
  'Opportunity for Improvement': { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', short: 'OFI' },
};
const IMPACT_COLOR: Record<ImpactLevel, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };
const PRIORITY_COLOR = (p: number) => p <= 1 ? '#ef4444' : p === 2 ? '#f97316' : p === 3 ? '#f59e0b' : p === 4 ? '#38bdf8' : '#22c55e';
const ROOT_EMOJI: Record<RootCauseCategory, string> = {
  'Training & Competence': '🎓', 'Process & Procedure': '⚙️', 'Documentation & Records': '📄',
  'Technology & Systems': '💻', 'Management & Leadership': '👔', 'Resource & Capacity': '🏗️',
  'Communication': '📢', 'External / Supplier': '🔗', 'Unknown': '❓',
};
const cardS: React.CSSProperties = { background: '#0d1929', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, marginBottom: 16 };
const inp:   React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', color: '#f1f5f9', background: '#0a1525', outline: 'none' };
const lbl:   React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 800, color: '#94a3b8', marginBottom: 3, letterSpacing: '0.06em', textTransform: 'uppercase' };
const btnS = (c = BLUE, extra: React.CSSProperties = {}): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: 'none', background: c, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', ...extra });
const aiBadge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: 'rgba(201,146,42,0.15)', border: '1px solid rgba(201,146,42,0.4)', color: GOLD, fontSize: 10, fontWeight: 700 };

/* ──────────────────────── Pill ─────────────────────────────────── */
const Pill: React.FC<{ label: string; color: string; bg?: string }> = ({ label, color, bg }) => (
  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color, background: bg || `${color}18`, border: `1px solid ${color}44`, whiteSpace: 'nowrap' }}>{label}</span>
);

/* ──────────────────────── Priority badge ────────────────────────── */
const PriBadge: React.FC<{ p: number }> = ({ p }) => (
  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${PRIORITY_COLOR(p)}20`, border: `2px solid ${PRIORITY_COLOR(p)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <span style={{ fontSize: 14, fontWeight: 900, color: PRIORITY_COLOR(p) }}>{p}</span>
  </div>
);

/* ══════════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════════ */
const FindingsCategorization: React.FC = () => {
  const claude = isClaudeConfigured();

  /* ── Seed from live CARs ── */
  const seedFindings = useMemo((): Finding[] => {
    const actions = loadCorrectiveActions();
    return actions.map((a, i) => ({
      id: a.id,
      findingId: a.capId || `F-${String(i + 1).padStart(3, '0')}`,
      description: a.description,
      clause: a.standard,
      source: a.capId,
      severity: a.severity,
    }));
  }, []);

  const [findings, setFindings] = useState<Finding[]>(seedFindings);
  const [busy, setBusy]         = useState(false);
  const [source, setSource]     = useState<'heuristic' | 'claude' | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filterCls, setFilterCls] = useState<ClassificationType | 'All'>('All');
  const [copied, setCopied]     = useState(false);
  const [counter, setCounter]   = useState(seedFindings.length + 1);
  const abortRef                = useRef<AbortController | null>(null);

  /* ── Stats ── */
  const classified = findings.filter(f => f.classification);
  const stats = useMemo(() => {
    const s: Record<string, number> = {};
    classified.forEach(f => { const k = f.classification!.classification; s[k] = (s[k] || 0) + 1; });
    return s;
  }, [classified]);

  const visible = filterCls === 'All' ? findings : findings.filter(f => f.classification?.classification === filterCls);

  /* ── Add finding ── */
  const addFinding = () => {
    const id = `custom-${Date.now()}`;
    const n = counter;
    setCounter(n + 1);
    setFindings(p => [...p, { id, findingId: `F-${String(n).padStart(3,'0')}`, description: '', clause: '', editing: true }]);
    setExpanded(p => ({ ...p, [id]: true }));
  };
  const remove = (id: string) => setFindings(p => p.filter(f => f.id !== id));
  const update = (id: string, patch: Partial<Finding>) => setFindings(p => p.map(f => f.id === id ? { ...f, ...patch } : f));

  /* ── Classify ── */
  const classify = async () => {
    if (busy) { abortRef.current?.abort(); setBusy(false); return; }
    if (findings.length === 0) return;

    // Heuristic immediately
    setFindings(p => p.map(f => ({ ...f, classification: heuristicClassify(f) })));
    setSource('heuristic');

    if (!claude) return;
    setBusy(true);
    abortRef.current = new AbortController();
    try {
      const results = await claudeClassify(findings, abortRef.current.signal);
      // Map by position (Claude returns array in same order)
      setFindings(p => p.map((f, i) => results[i] ? { ...f, classification: results[i] } : f));
      setSource('claude');
    } catch { /* keep heuristic */ }
    finally { setBusy(false); }
  };

  /* ── Export ── */
  const exportCSV = () => {
    const header = 'Finding ID,Description,Classification,Impact,Root Cause Category,Priority,Effort,Target Date';
    const rows = findings.filter(f => f.classification).map(f => {
      const c = f.classification!;
      return [f.findingId, `"${f.description.replace(/"/g,'""')}"`, c.classification, c.impact, c.rootCauseCategory, c.priority, c.effort, c.targetDate].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'audit_findings.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const copyAll = () => {
    const text = findings.filter(f => f.classification).map(f => {
      const c = f.classification!;
      return `${f.findingId} | ${c.classification} | P${c.priority} | ${c.impact} Impact\n${f.description}\nRoot Cause: ${c.rootCauseCategory} | Effort: ${c.effort} | Target: ${c.targetDate}`;
    }).join('\n\n────────────\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  /* ── Render ── */
  return (
    <div style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#1e1b4b,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <LayoutList size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#f1f5f9' }}>Findings Categorization</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            {claude ? 'AI classifier — auto-categorizes findings across 7 dimensions with Claude precision' : 'Heuristic classifier — instant multi-dimension finding categorization'}
          </p>
        </div>
      </div>

      {!claude && (
        <div style={{ background: 'rgba(201,146,42,0.07)', border: '1px solid rgba(201,146,42,0.25)', borderRadius: 9, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Info size={14} color={GOLD} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#f1f5f9', lineHeight: 1.5 }}>
            <strong style={{ color: GOLD }}>Heuristic mode</strong> — keyword-based classification across all 7 dimensions. Configure Claude API key in <strong>AI Settings</strong> for precise, context-aware AI classification.
          </p>
        </div>
      )}

      {/* Controls */}
      <div style={{ ...cardS, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
            {findings.length} finding{findings.length !== 1 ? 's' : ''}
            {seedFindings.length > 0 && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400, marginLeft: 6 }}>({seedFindings.length} from live CARs)</span>}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={btnS('#1e293b', { border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8' })} onClick={addFinding}>
              <Plus size={13} /> Add Finding
            </button>
            <button style={btnS(busy ? '#374151' : '#4f46e5')} onClick={classify} disabled={findings.length === 0}>
              {busy
                ? <><Loader2 size={14} style={{ animation: 'fc-spin 1s linear infinite' }} />{claude ? ' Classifying… (stop)' : ' Classifying…'}</>
                : <><Wand2 size={14} />{claude ? ' Classify with Claude' : ' Run Classification'}</>}
            </button>
            {classified.length > 0 && !busy && (
              <button style={btnS('transparent', { border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8' })} onClick={classify}>
                <RefreshCw size={13} /> Re-run
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats + filter row */}
      {classified.length > 0 && (
        <div style={cardS}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>
              <CheckCircle2 size={14} color="#22c55e" style={{ verticalAlign: 'middle', marginRight: 5 }} />
              {classified.length} classified
            </span>
            {source === 'claude'    && <span style={aiBadge}><Sparkles size={9} /> Claude AI</span>}
            {source === 'heuristic' && <span style={{ ...aiBadge, background: 'rgba(100,116,139,0.12)', borderColor: 'rgba(100,116,139,0.3)', color: '#94a3b8' }}>Heuristic</span>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
              <button style={btnS('#1e293b', { padding: '5px 11px', fontSize: 12, border: '1px solid rgba(255,255,255,0.1)' })} onClick={copyAll}>
                <Copy size={12} />{copied ? ' Copied!' : ' Copy'}
              </button>
              <button style={btnS('#064e3b', { padding: '5px 11px', fontSize: 12 })} onClick={exportCSV}>
                <Download size={12} /> Export CSV
              </button>
            </div>
          </div>

          {/* Summary stat chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <button onClick={() => setFilterCls('All')}
              style={{ ...btnS('transparent', { padding: '4px 12px', fontSize: 11, border: `1px solid ${filterCls === 'All' ? BLUE : 'rgba(255,255,255,0.1)'}`, color: filterCls === 'All' ? '#93c5fd' : '#64748b' }) }}>
              All ({findings.length})
            </button>
            {(Object.entries(CLASS_STYLE) as [ClassificationType, typeof CLASS_STYLE[ClassificationType]][]).map(([cls, s]) => {
              const count = stats[cls] || 0;
              if (!count) return null;
              const active = filterCls === cls;
              return (
                <button key={cls} onClick={() => setFilterCls(active ? 'All' : cls)}
                  style={{ ...btnS('transparent', { padding: '4px 12px', fontSize: 11, border: `1px solid ${active ? s.color : 'rgba(255,255,255,0.1)'}`, color: active ? s.color : '#64748b', background: active ? s.bg : 'transparent' }) }}>
                  {s.short} <span style={{ background: s.color, color: '#fff', borderRadius: 999, padding: '0 5px', fontSize: 10, marginLeft: 4 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Priority distribution */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[1,2,3,4,5].map(p => {
              const count = classified.filter(f => f.classification!.priority === p).length;
              return (
                <div key={p} style={{ flex: 1, background: '#070f1a', borderRadius: 8, padding: '8px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: PRIORITY_COLOR(p) }}>P{p}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#f1f5f9', marginTop: 1 }}>{count}</div>
                  <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>
                    {p === 1 ? 'Critical' : p === 2 ? 'Urgent' : p === 3 ? 'High' : p === 4 ? 'Normal' : 'Low'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Finding cards */}
      {visible.map(finding => {
        const c    = finding.classification;
        const cs   = c ? CLASS_STYLE[c.classification] : null;
        const isExp = expanded[finding.id] ?? !c;

        return (
          <div key={finding.id} style={{ ...cardS, borderColor: cs ? `${cs.color}40` : 'rgba(255,255,255,0.08)', borderWidth: c?.priority === 1 ? 2 : 1 }}>

            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              {c && <PriBadge p={c.priority} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b', fontFamily: 'monospace' }}>{finding.findingId}</span>
                  {c && <Pill label={CLASS_STYLE[c.classification].short} color={CLASS_STYLE[c.classification].color} bg={CLASS_STYLE[c.classification].bg} />}
                  {c && <Pill label={`${c.impact} Impact`} color={IMPACT_COLOR[c.impact]} />}
                  {finding.clause && <span style={{ fontSize: 11, color: '#475569' }}>{finding.clause}</span>}
                </div>
                <p style={{ margin: 0, fontSize: 13.5, color: '#e2e8f0', lineHeight: 1.5 }}>
                  {finding.description || <span style={{ color: '#334155', fontStyle: 'italic' }}>No description — expand to edit</span>}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }} onClick={() => setExpanded(p => ({ ...p, [finding.id]: !isExp }))}>
                  {isExp ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151' }} onClick={() => remove(finding.id)} title="Remove">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {isExp && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {/* Edit fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={lbl}>Finding Description</label>
                    <textarea value={finding.description} onChange={e => update(finding.id, { description: e.target.value })}
                      rows={3} style={{ ...inp, resize: 'vertical', minHeight: 68 }}
                      placeholder="Describe the finding precisely — reference the clause, evidence found, and extent…" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <label style={lbl}>Clause / Standard</label>
                      <input value={finding.clause || ''} onChange={e => update(finding.id, { clause: e.target.value })} style={inp} placeholder="e.g. ISO 9001 Clause 7.2" />
                    </div>
                    <div>
                      <label style={lbl}>Finding ID</label>
                      <input value={finding.findingId} onChange={e => update(finding.id, { findingId: e.target.value })} style={inp} placeholder="F-001" />
                    </div>
                  </div>
                </div>

                {/* Classification result */}
                {c && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 4 }}>
                    {[
                      { label: 'Classification', value: c.classification, color: cs!.color },
                      { label: 'Impact Level',   value: c.impact,         color: IMPACT_COLOR[c.impact] },
                      { label: 'Priority',       value: `P${c.priority} — ${c.priority === 1 ? 'Critical' : c.priority === 2 ? 'Urgent' : c.priority === 3 ? 'High' : c.priority === 4 ? 'Normal' : 'Low'}`, color: PRIORITY_COLOR(c.priority) },
                      { label: 'Root Cause Category', value: `${ROOT_EMOJI[c.rootCauseCategory]} ${c.rootCauseCategory}`, color: '#94a3b8' },
                      { label: 'Effort Estimate', value: c.effort,       color: c.effort.startsWith('High') ? '#ef4444' : c.effort.startsWith('Medium') ? '#f59e0b' : '#22c55e' },
                      { label: 'Target Resolution Date', value: c.targetDate, color: '#38bdf8' },
                    ].map(field => (
                      <div key={field.label} style={{ background: '#070f1a', borderRadius: 9, padding: '10px 12px' }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{field.label}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: field.color, lineHeight: 1.4 }}>{field.value}</div>
                      </div>
                    ))}
                    <div style={{ gridColumn: 'span 3', background: '#070f1a', borderRadius: 9, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>📋 Classification Rationale</div>
                      <p style={{ margin: 0, fontSize: 12.5, color: '#94a3b8', lineHeight: 1.55 }}>{c.rationale}</p>
                    </div>
                  </div>
                )}

                {!c && (
                  <div style={{ textAlign: 'center', padding: '10px 0', color: '#475569', fontSize: 12 }}>
                    <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                    Fill in the description and click <strong>Run Classification</strong> to categorize this finding.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {findings.length === 0 && (
        <div style={{ ...cardS, textAlign: 'center', padding: 40 }}>
          <LayoutList size={40} color="#1e3a5f" style={{ marginBottom: 12 }} />
          <p style={{ color: '#475569', margin: '0 0 16px', fontSize: 14 }}>No findings yet. Add manually or connect corrective action records.</p>
          <button style={btnS(BLUE)} onClick={addFinding}><Plus size={14} /> Add Finding</button>
        </div>
      )}

      <style>{`@keyframes fc-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
};

export default FindingsCategorization;
