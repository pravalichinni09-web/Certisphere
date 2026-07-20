/**
 * ActionRiskPrediction — AI risk analyst for corrective actions.
 * Loads open CARs from localStorage, lets the user pick one or paste a custom
 * action description, then predicts success rate and risk using Claude or heuristics.
 */
import React, { useState, useMemo, useRef } from 'react';
import {
  TrendingUp, Sparkles, Wand2, Loader2, Info,
  CheckCircle2, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, RefreshCw, Copy,
  ShieldAlert, Target, Eye, Lightbulb,
} from 'lucide-react';
import { isClaudeConfigured, getApiKey, getModel } from '../../ai/claudeClient';
import { loadCorrectiveActions, type CorrectiveActionRecord } from '../../services/correctiveActions';

/* ─── Types ──────────────────────────────────────────────────────── */
interface RiskPrediction {
  actionSummary: string;
  feasibility: 'Easy' | 'Medium' | 'Difficult';
  successProbability: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  failurePoints: string[];
  mitigations: string[];
  monitoring: string;
  criticalSuccessFactors: string[];
}

/* ─── Heuristic engine ───────────────────────────────────────────── */
function heuristicPredict(record: CorrectiveActionRecord | null, customText: string): RiskPrediction {
  const text = (record
    ? `${record.description} ${record.correctivePlan || ''} ${record.rootCause || ''}`
    : customText
  ).toLowerCase();
  const sev = record?.severity || '';

  // Score factors
  let score = 72;
  const failurePoints: string[] = [];
  const mitigations: string[] = [];
  const csf: string[] = [];

  // Severity impact
  if (sev === 'Major NC') { score -= 18; failurePoints.push('Major NC requires complete system-level change — high implementation complexity.'); }
  else if (sev === 'Minor NC') { score -= 6; }

  // Positive signals
  if (text.includes('procedure') || text.includes('sop')) { score += 6; csf.push('Documented procedure update in place'); }
  if (text.includes('training')) { score += 5; csf.push('Training programme identified'); }
  if (text.includes('root cause')) { score += 7; csf.push('Root cause clearly identified'); }
  if (text.includes('monitor') || text.includes('review')) { score += 4; csf.push('Monitoring mechanism defined'); }
  if (text.includes('responsible') || text.includes('owner')) { score += 4; csf.push('Clear ownership assigned'); }
  if (text.includes('deadline') || text.includes('due') || text.includes('date')) { score += 3; csf.push('Timeline defined'); }

  // Risk signals
  if (text.includes('manual') || text.includes('spreadsheet')) { score -= 5; failurePoints.push('Manual/spreadsheet-based processes are prone to human error and inconsistency.'); mitigations.push('Evaluate automation or digital tracking tools for this process.'); }
  if (text.includes('complex') || text.includes('difficult') || text.includes('challenging')) { score -= 8; failurePoints.push('Complexity acknowledged — multi-team coordination increases risk of delays.'); }
  if (text.includes('resource') || text.includes('budget') || text.includes('cost')) { score -= 5; failurePoints.push('Resource dependency could delay implementation if budget approval is needed.'); mitigations.push('Confirm resource allocation and management approval before commencing.'); }
  if (text.includes('customer') || text.includes('external')) { score -= 6; failurePoints.push('External dependency on customer or third-party introduces timeline risk.'); mitigations.push('Establish SLAs or formal agreements with external parties.'); }

  // Fill defaults if empty
  if (failurePoints.length === 0) failurePoints.push('Insufficient staff awareness during rollout.', 'Lack of documented verification after implementation.');
  if (mitigations.length === 0) mitigations.push('Brief all relevant staff before implementation.', 'Set a 30-day effectiveness review checkpoint.');
  if (csf.length === 0) csf.push('Clear action scope defined', 'Responsible owner assigned', 'Completion deadline set');

  // Ensure minimum detail
  mitigations.push('Schedule a post-implementation effectiveness audit within 60 days.');
  csf.push('Management awareness and support');

  score = Math.max(30, Math.min(96, score));

  const feasibility: RiskPrediction['feasibility'] = score >= 78 ? 'Easy' : score >= 55 ? 'Medium' : 'Difficult';
  const riskLevel: RiskPrediction['riskLevel']     = score >= 75 ? 'Low'  : score >= 50 ? 'Medium'  : 'High';

  return {
    actionSummary: record
      ? `${record.capId}: ${record.description.slice(0, 120)}${record.description.length > 120 ? '…' : ''}`
      : customText.slice(0, 150),
    feasibility,
    successProbability: score,
    riskLevel,
    failurePoints: failurePoints.slice(0, 4),
    mitigations:   mitigations.slice(0, 4),
    criticalSuccessFactors: csf.slice(0, 4),
    monitoring: score >= 75
      ? 'Monthly internal verification for 3 months; confirm evidence logged in CertiSphere.'
      : 'Bi-weekly progress check for first 6 weeks; escalate to management if milestones slip.',
  };
}

/* ─── Parse Claude response ──────────────────────────────────────── */
function parseClaude(raw: string, actionSummary: string): RiskPrediction | null {
  try {
    const block = raw.match(/\{[\s\S]*\}/);
    if (!block) return null;
    const obj = JSON.parse(block[0]);
    return {
      actionSummary: obj.action || actionSummary,
      feasibility: obj.feasibility || 'Medium',
      successProbability: parseInt(obj.successProbability || obj.success_probability || '65'),
      riskLevel: obj.riskLevel || obj.risk_level || 'Medium',
      failurePoints: obj.failurePoints || obj.failure_points || obj.potentialFailurePoints || [],
      mitigations: obj.mitigations || obj.riskMitigation || obj.risk_mitigation || [],
      criticalSuccessFactors: obj.criticalSuccessFactors || obj.critical_success_factors || [],
      monitoring: obj.monitoring || obj.monitoringApproach || obj.monitoring_approach || '',
    };
  } catch { return null; }
}

/* ─── Claude call ────────────────────────────────────────────────── */
const SYSTEM = `You are an audit risk analyst. Analyze proposed corrective actions and predict their success rate.

For each action provided:
1. Assess feasibility (scale: Easy/Medium/Difficult)
2. Predict success probability (%)
3. Identify potential failure points
4. Suggest risk mitigation measures
5. Recommend monitoring approach

Return your analysis as a single JSON object with this exact structure:
{
  "action": "brief summary",
  "feasibility": "Easy|Medium|Difficult",
  "successProbability": 75,
  "riskLevel": "High|Medium|Low",
  "criticalSuccessFactors": ["...", "..."],
  "failurePoints": ["...", "..."],
  "mitigations": ["...", "..."],
  "monitoring": "..."
}`;

async function claudePredict(record: CorrectiveActionRecord | null, customText: string, signal: AbortSignal): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('not_configured');

  const desc = record
    ? `CAP ID: ${record.capId}\nSeverity: ${record.severity}\nStandard: ${record.standard}\nFinding: ${record.description}\nRoot Cause: ${record.rootCause || 'Not specified'}\nProposed Corrective Plan: ${record.correctivePlan || 'Not specified'}\nDue Date: ${record.dueDate}\nCurrent Status: ${record.status}`
    : `Corrective Action Description:\n${customText}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: getModel(),
      max_tokens: 900,
      temperature: 0.25,
      system: SYSTEM,
      messages: [{ role: 'user', content: desc }],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const json = await res.json();
  return (json?.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
}

/* ─── Design helpers ─────────────────────────────────────────────── */
const GOLD = '#c9922a', BLUE = '#1d4ed8';
const RISK_COLOR: Record<string, string>  = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };
const FEAS_COLOR: Record<string, string>  = { Easy: '#22c55e', Medium: '#f59e0b', Difficult: '#ef4444' };
const PROB_COLOR = (p: number) => p >= 75 ? '#22c55e' : p >= 50 ? '#f59e0b' : '#ef4444';
const cardS: React.CSSProperties = { background: '#ffffff', border: '1px solid rgba(15,23,42,0.09)', borderRadius: 16, padding: 24, marginBottom: 20, color: '#334155' };
const inp: React.CSSProperties   = { width: '100%', padding: '10px 12px', border: '1.5px solid rgba(15,23,42,0.12)', borderRadius: 9, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', color: '#0f2547', background: '#f8fafc', outline: 'none' };
const lbl: React.CSSProperties   = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' };
const btnS = (c = BLUE): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 9, border: 'none', background: c, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' });
const aiBadge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: 'rgba(201,146,42,0.15)', border: '1px solid rgba(201,146,42,0.4)', color: GOLD, fontSize: 11, fontWeight: 700 };

const Badge = ({ text, color }: { text: string; color: string }) => (
  <span style={{ background: `${color}20`, color, border: `1px solid ${color}44`, padding: '3px 11px', borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{text}</span>
);

const SectionHead = ({ icon, title, color = '#64748b' }: { icon: React.ReactNode; title: string; color?: string }) => (
  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>{icon}{title}</p>
);

/* ─── Gauge arc ──────────────────────────────────────────────────── */
const ProbGauge: React.FC<{ value: number }> = ({ value }) => {
  const r = 54, cx = 70, cy = 70;
  const circ = Math.PI * r; // half-circle circumference
  const dash  = (value / 100) * circ;
  const color = PROB_COLOR(value);
  return (
    <svg viewBox="0 0 140 80" style={{ width: 160, flexShrink: 0 }}>
      {/* track */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(15,23,42,0.09)" strokeWidth="10" strokeLinecap="round" />
      {/* fill */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`} style={{ transition: 'stroke-dasharray 0.8s ease-out' }} />
      <text x={cx} y={cy - 8} textAnchor="middle" style={{ fontSize: 22, fontWeight: 900, fill: color }}>{value}%</text>
      <text x={cx} y={cy + 6} textAnchor="middle" style={{ fontSize: 9, fill: '#64748b' }}>SUCCESS PROBABILITY</text>
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
const ActionRiskPrediction: React.FC = () => {
  const claude = isClaudeConfigured();
  const actions = useMemo(() => loadCorrectiveActions(), []);
  const open    = actions.filter(a => a.status === 'Open' || a.status === 'Submitted');

  const [mode, setMode]             = useState<'select' | 'custom'>('select');
  const [selectedId, setSelectedId] = useState(open[0]?.id || '');
  const [customText, setCustomText] = useState('');
  const [result, setResult]         = useState<RiskPrediction | null>(null);
  const [source, setSource]         = useState<'heuristic' | 'claude' | null>(null);
  const [busy, setBusy]             = useState(false);
  const [copied, setCopied]         = useState(false);
  const [expandedSec, setExpandedSec] = useState<string | null>('failure');
  const abortRef                    = useRef<AbortController | null>(null);

  const selectedRecord = open.find(a => a.id === selectedId) || null;

  const run = async () => {
    if (busy) { abortRef.current?.abort(); setBusy(false); return; }
    const text = mode === 'custom' ? customText : '';
    if (mode === 'custom' && !text.trim()) return;
    if (mode === 'select' && !selectedRecord) return;

    // Show heuristic immediately
    const h = heuristicPredict(mode === 'select' ? selectedRecord : null, text);
    setResult(h); setSource('heuristic');

    if (!claude) return;

    setBusy(true);
    abortRef.current = new AbortController();
    try {
      const raw = await claudePredict(
        mode === 'select' ? selectedRecord : null,
        text,
        abortRef.current.signal
      );
      const parsed = parseClaude(raw, h.actionSummary);
      if (parsed) { setResult(parsed); setSource('claude'); }
    } catch { /* keep heuristic */ }
    finally { setBusy(false); }
  };

  const copyResult = () => {
    if (!result) return;
    const txt = [
      `Action: ${result.actionSummary}`,
      `Success Probability: ${result.successProbability}%`,
      `Risk Level: ${result.riskLevel}`,
      `Feasibility: ${result.feasibility}`,
      `\nCritical Success Factors:\n${result.criticalSuccessFactors.map(f => `  • ${f}`).join('\n')}`,
      `\nPotential Failure Points:\n${result.failurePoints.map(f => `  • ${f}`).join('\n')}`,
      `\nRisk Mitigation Measures:\n${result.mitigations.map(m => `  • ${m}`).join('\n')}`,
      `\nMonitoring Approach:\n  ${result.monitoring}`,
    ].join('\n');
    navigator.clipboard.writeText(txt);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const toggle = (sec: string) => setExpandedSec(expandedSec === sec ? null : sec);

  return (
    <div style={{ padding: '24px', maxWidth: 860, margin: '0 auto', fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#dc2626,#b45309)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <TrendingUp size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f2547' }}>Action Risk Prediction</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>AI risk analyst — predict corrective action success rate and identify failure points</p>
        </div>
      </div>

      {/* No-key banner */}
      {!claude && (
        <div style={{ background: 'rgba(201,146,42,0.07)', border: '1px solid rgba(201,146,42,0.25)', borderRadius: 9, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Info size={15} color={GOLD} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#0f2547', lineHeight: 1.5 }}>
            <strong style={{ color: GOLD }}>Heuristic mode</strong> — risk scored from your action data and keyword analysis.
            Configure your Claude API key in <strong>AI Settings</strong> for a full AI risk assessment.
          </p>
        </div>
      )}

      {/* Input card */}
      <div style={cardS}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, color: '#0f2547', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={17} color={GOLD} /> Select Action to Analyse
        </h3>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderRadius: 9, overflow: 'hidden', border: '1.5px solid rgba(15,23,42,0.12)', width: 'fit-content' }}>
          {(['select', 'custom'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ padding: '8px 20px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', background: mode === m ? BLUE : 'transparent', color: mode === m ? '#fff' : '#64748b', transition: 'all .15s' }}>
              {m === 'select' ? `From Open Actions (${open.length})` : 'Custom Action Text'}
            </button>
          ))}
        </div>

        {mode === 'select' ? (
          open.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>No open corrective actions found. Submit corrective actions in Audit Actions to use this feature.</p>
          ) : (
            <div>
              <label style={lbl}>Select Corrective Action</label>
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={inp}>
                {open.map(a => (
                  <option key={a.id} value={a.id}>{a.capId} — {a.description.slice(0, 80)}{a.description.length > 80 ? '…' : ''} [{a.severity}]</option>
                ))}
              </select>
              {selectedRecord && (
                <div style={{ marginTop: 12, background: '#eef4fb', borderRadius: 9, padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    ['Standard', selectedRecord.standard],
                    ['Severity', selectedRecord.severity],
                    ['Due Date', selectedRecord.dueDate],
                    ['Status',   selectedRecord.status],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</span>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: '#0f2547', fontWeight: 600 }}>{v}</p>
                    </div>
                  ))}
                  {selectedRecord.rootCause && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Root Cause</span>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: '#475569' }}>{selectedRecord.rootCause}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        ) : (
          <div>
            <label style={lbl}>Corrective Action Description</label>
            <textarea value={customText} onChange={e => setCustomText(e.target.value)} rows={4}
              placeholder="Describe the corrective action in detail — include what was found, root cause, proposed fix, responsible party, and timeline..."
              style={{ ...inp, resize: 'vertical', minHeight: 90 }} />
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button style={btnS(busy ? '#374151' : '#dc2626')} onClick={run}
            disabled={!busy && ((mode === 'select' && open.length === 0) || (mode === 'custom' && !customText.trim()))}>
            {busy
              ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Analysing…</>
              : <><Wand2 size={15} /> {claude ? 'Predict with AI' : 'Run Risk Assessment'}</>}
          </button>
          {result && (
            <button onClick={run} disabled={busy}
              style={{ ...btnS('transparent'), border: '1px solid rgba(15,23,42,0.14)', color: '#64748b', padding: '10px 14px' }}>
              <RefreshCw size={14} /> Re-run
            </button>
          )}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div>
          {/* Score strip */}
          <div style={{ ...cardS, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', padding: '20px 24px' }}>
            <ProbGauge value={result.successProbability} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <Badge text={`${result.riskLevel} Risk`} color={RISK_COLOR[result.riskLevel]} />
                <Badge text={result.feasibility} color={FEAS_COLOR[result.feasibility]} />
                {source === 'claude' && <span style={aiBadge}><Sparkles size={10} /> Claude AI</span>}
                {source === 'heuristic' && <span style={{ ...aiBadge, background: 'rgba(100,116,139,0.12)', borderColor: 'rgba(100,116,139,0.3)', color: '#64748b' }}>Heuristic</span>}
                <button style={{ marginLeft: 'auto', ...btnS('#eef2f7'), padding: '5px 12px', fontSize: 12, border: '1px solid rgba(15,23,42,0.12)' }} onClick={copyResult}>
                  <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                <strong style={{ color: '#0f2547' }}>Action: </strong>{result.actionSummary}
              </p>
            </div>
          </div>

          {/* Critical Success Factors */}
          <div style={{ ...cardS, borderLeft: `4px solid #22c55e` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: expandedSec === 'csf' ? 14 : 0 }} onClick={() => toggle('csf')}>
              <SectionHead icon={<CheckCircle2 size={14} color="#22c55e" />} title="Critical Success Factors" color="#22c55e" />
              {expandedSec === 'csf' ? <ChevronUp size={15} color="#64748b" /> : <ChevronDown size={15} color="#64748b" />}
            </div>
            {expandedSec === 'csf' && result.criticalSuccessFactors.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                <CheckCircle2 size={14} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>{f}</span>
              </div>
            ))}
          </div>

          {/* Failure Points */}
          <div style={{ ...cardS, borderLeft: `4px solid ${RISK_COLOR[result.riskLevel]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: expandedSec === 'failure' ? 14 : 0 }} onClick={() => toggle('failure')}>
              <SectionHead icon={<XCircle size={14} color={RISK_COLOR[result.riskLevel]} />} title="Potential Failure Points" color={RISK_COLOR[result.riskLevel]} />
              {expandedSec === 'failure' ? <ChevronUp size={15} color="#64748b" /> : <ChevronDown size={15} color="#64748b" />}
            </div>
            {expandedSec === 'failure' && result.failurePoints.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} color={RISK_COLOR[result.riskLevel]} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>{f}</span>
              </div>
            ))}
          </div>

          {/* Mitigations */}
          <div style={{ ...cardS, borderLeft: `4px solid #0891b2` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: expandedSec === 'mitigation' ? 14 : 0 }} onClick={() => toggle('mitigation')}>
              <SectionHead icon={<ShieldAlert size={14} color="#0891b2" />} title="Risk Mitigation Measures" color="#0891b2" />
              {expandedSec === 'mitigation' ? <ChevronUp size={15} color="#64748b" /> : <ChevronDown size={15} color="#64748b" />}
            </div>
            {expandedSec === 'mitigation' && result.mitigations.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                <Lightbulb size={14} color="#0891b2" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>{m}</span>
              </div>
            ))}
          </div>

          {/* Monitoring */}
          <div style={{ ...cardS, borderLeft: `4px solid #7c3aed` }}>
            <SectionHead icon={<Eye size={14} color="#7c3aed" />} title="Recommended Monitoring Approach" color="#7c3aed" />
            <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.7 }}>{result.monitoring}</p>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
};

export default ActionRiskPrediction;
