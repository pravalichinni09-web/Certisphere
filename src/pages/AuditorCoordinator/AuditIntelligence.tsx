/**
 * Audit Intelligence — coordinator hub for the AI-assisted certification tools.
 * Each tool runs a deterministic heuristic instantly, and upgrades to a Claude
 * response when an API key is configured (AI Settings).
 */
import React, { useMemo, useState } from 'react';
import {
  BrainCircuit, Sparkles, ClipboardCheck, AlertTriangle, CalendarClock,
  Loader2, Wand2, ShieldAlert,
} from 'lucide-react';
import { isClaudeConfigured } from '../../ai/claudeClient';
import {
  classifyFinding, classifyFindingWithClaude, FindingClassification,
  generateChecklist, generateChecklistWithClaude, ChecklistItem,
  predictNonConformance, NCPrediction,
  planAudits, AuditPlanItem,
} from '../../ai/auditIntelligence';

const STANDARDS = ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 45001:2018', 'ISO 27001:2022'];

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e7ecf3', borderRadius: 16,
  padding: 22, boxShadow: '0 1px 3px rgba(15,23,42,.05), 0 8px 22px rgba(15,23,42,.04)',
  marginBottom: 22,
};
const h3: React.CSSProperties = { margin: 0, fontSize: 18, fontWeight: 800, color: '#0f2547', display: 'flex', alignItems: 'center', gap: 10 };
const sub: React.CSSProperties = { margin: '4px 0 16px', color: '#64748b', fontSize: 13 };
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', margin: '0 0 6px' };
const inputS: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1.5px solid #cbd5e1', borderRadius: 9, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', color: '#0f172a' };
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' };

const catColor: Record<string, string> = { Major: '#dc2626', Minor: '#f59e0b', Observation: '#0ea5e9', OFI: '#0ea5e9' };
const lvlColor: Record<string, string> = { High: '#dc2626', Medium: '#f59e0b', Low: '#16a34a' };
const priColor: Record<string, string> = { Urgent: '#dc2626', Soon: '#f59e0b', Routine: '#64748b' };

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color + '1f', color, border: `1px solid ${color}55`, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{text}</span>
);

const AuditIntelligence: React.FC = () => {
  const claude = isClaudeConfigured();

  /* ---- Finding Classifier ---- */
  const [fcText, setFcText] = useState('');
  const [fcStd, setFcStd] = useState(STANDARDS[0]);
  const [fcRes, setFcRes] = useState<FindingClassification | null>(null);
  const [fcBusy, setFcBusy] = useState(false);
  const runClassify = async () => {
    if (!fcText.trim()) return;
    setFcRes(classifyFinding(fcText, fcStd));
    if (claude) {
      setFcBusy(true);
      const r = await classifyFindingWithClaude(fcText, fcStd);
      if (r) setFcRes(r);
      setFcBusy(false);
    }
  };

  /* ---- Checklist Generator ---- */
  const [clStd, setClStd] = useState(STANDARDS[0]);
  const [clInd, setClInd] = useState('');
  const [clRows, setClRows] = useState<ChecklistItem[] | null>(null);
  const [clBusy, setClBusy] = useState(false);
  const [clSource, setClSource] = useState<'heuristic' | 'ai'>('heuristic');
  const runChecklist = async () => {
    setClRows(generateChecklist(clStd, clInd));
    setClSource('heuristic');
    if (claude) {
      setClBusy(true);
      const r = await generateChecklistWithClaude(clStd, clInd);
      if (r && r.length) { setClRows(r); setClSource('ai'); }
      setClBusy(false);
    }
  };

  /* ---- Predictor + Planner (read live data) ---- */
  const predictions = useMemo<NCPrediction[]>(() => predictNonConformance(), []);
  const plan = useMemo<AuditPlanItem[]>(() => planAudits(), []);

  return (
    <div style={{ padding: '0 8px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f2547', display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrainCircuit size={26} color="#2563eb" /> Audit Intelligence
          </h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
            AI-assisted planning, prediction, checklists and finding classification across your certification programme.
          </p>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
          background: claude ? '#ecfdf5' : '#f1f5f9', color: claude ? '#047857' : '#475569', border: `1px solid ${claude ? '#a7f3d0' : '#e2e8f0'}` }}>
          <Sparkles size={14} /> {claude ? 'Claude connected' : 'Heuristic mode · add a key in AI Settings'}
        </span>
      </div>
      <div style={{ height: 16 }} />

      {/* 1. Finding Classifier */}
      <div style={card}>
        <h3 style={h3}><ShieldAlert size={20} color="#2563eb" /> Finding Classifier</h3>
        <p style={sub}>Paste auditor notes — get an instant Major / Minor / Observation classification with rationale.</p>
        <label style={label}>Auditor note / finding</label>
        <textarea style={{ ...inputS, minHeight: 84, resize: 'vertical' }} value={fcText} onChange={(e) => setFcText(e.target.value)}
          placeholder="e.g. No documented procedure exists for calibration and several gauges were found out of date across the production line." />
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 220 }}>
            <label style={label}>Standard</label>
            <select style={inputS} value={fcStd} onChange={(e) => setFcStd(e.target.value)}>
              {STANDARDS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <button style={btn} onClick={runClassify} disabled={fcBusy || !fcText.trim()}>
            {fcBusy ? <Loader2 size={16} className="cs-spin" /> : <Wand2 size={16} />} Classify
          </button>
        </div>
        {fcRes && (
          <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', border: '1px solid #e7ecf3', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Badge text={fcRes.category} color={catColor[fcRes.category]} />
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{Math.round(fcRes.confidence * 100)}% confidence</span>
            </div>
            <p style={{ margin: '0 0 8px', color: '#334155', fontSize: 13.5 }}>{fcRes.rationale}</p>
            {fcRes.signals.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {fcRes.signals.map((s, i) => <span key={i} style={{ fontSize: 11, color: '#475569', background: '#eef2f7', borderRadius: 6, padding: '2px 8px' }}>{s}</span>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Smart Checklist Generator */}
      <div style={card}>
        <h3 style={h3}><ClipboardCheck size={20} color="#2563eb" /> Smart Checklist Generator</h3>
        <p style={sub}>Generate a focused, clause-mapped audit checklist for a standard and client industry.</p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 220 }}>
            <label style={label}>Standard</label>
            <select style={inputS} value={clStd} onChange={(e) => setClStd(e.target.value)}>
              {STANDARDS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={label}>Client industry (optional)</label>
            <input style={inputS} value={clInd} onChange={(e) => setClInd(e.target.value)} placeholder="e.g. Software / Manufacturing / Food" />
          </div>
          <button style={btn} onClick={runChecklist} disabled={clBusy}>
            {clBusy ? <Loader2 size={16} className="cs-spin" /> : <Wand2 size={16} />} Generate
          </button>
        </div>
        {clRows && (
          <div style={{ marginTop: 16, overflowX: 'auto' }}>
            <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 8 }}>{clRows.length} items · {clSource === 'ai' ? 'AI-tailored' : 'standard library'}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0', width: 70 }}>Clause</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Audit item</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Evidence focus</th>
                </tr>
              </thead>
              <tbody>
                {clRows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#2563eb' }}>{r.clause}</td>
                    <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>{r.item}</td>
                    <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{r.focus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Non-Conformance Predictor */}
      <div style={card}>
        <h3 style={h3}><AlertTriangle size={20} color="#2563eb" /> Non-Conformance Predictor</h3>
        <p style={sub}>Clients ranked by predicted likelihood of findings, from their audit history.</p>
        {predictions.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13 }}>No finding history yet — predictions appear once audits are recorded.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
            {predictions.slice(0, 9).map((p) => (
              <div key={p.client} style={{ border: '1px solid #e7ecf3', borderRadius: 12, padding: 14, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 14, color: '#0f2547' }}>{p.client}</strong>
                  <Badge text={p.level} color={lvlColor[p.level]} />
                </div>
                <div style={{ height: 8, background: '#eef2f7', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: `${p.riskScore}%`, height: '100%', background: lvlColor[p.level] }} />
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Risk score {p.riskScore}/100</div>
                <ul style={{ margin: '0 0 8px', paddingLeft: 16, color: '#475569', fontSize: 12 }}>
                  {p.drivers.slice(0, 3).map((d, i) => <li key={i}>{d}</li>)}
                </ul>
                <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Watch: {p.likelyAreas.join(', ')}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. AI Audit Planner */}
      <div style={card}>
        <h3 style={h3}><CalendarClock size={20} color="#2563eb" /> AI Audit Planner</h3>
        <p style={sub}>Suggested next audits, prioritised by risk and time since last audit.</p>
        {plan.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13 }}>No data to plan from yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Priority</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Client</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Window</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Why</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Suggested auditor</th>
                </tr>
              </thead>
              <tbody>
                {plan.slice(0, 12).map((p, i) => (
                  <tr key={i}>
                    <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9' }}><Badge text={p.priority} color={priColor[p.priority]} /></td>
                    <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f2547' }}>{p.client}</td>
                    <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>{p.suggestedWindow}</td>
                    <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{p.reason}</td>
                    <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{p.suggestedAuditor || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`.cs-spin{animation:cs-spin 1s linear infinite}@keyframes cs-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default AuditIntelligence;
