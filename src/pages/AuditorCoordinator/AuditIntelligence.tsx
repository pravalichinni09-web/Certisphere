/**
 * Audit Intelligence — AI agent hub for the Audit Coordinator.
 * 7 AI-powered tools, each with a heuristic fallback and Claude upgrade.
 */
import React, { useMemo, useState, useRef } from 'react';
import { vectorSearch, ragAnswer, ensureVectorIndex, VectorHit } from '../../ai/models';
import {
  BrainCircuit, Sparkles, ClipboardCheck, AlertTriangle, CalendarClock,
  Loader2, Wand2, ShieldAlert, FileText, RefreshCw, Award, ChevronDown, ChevronUp,
  CheckCircle2, Info, Copy,
} from 'lucide-react';
import { isClaudeConfigured } from '../../ai/claudeClient';
import {
  classifyFinding, classifyFindingWithClaude, FindingClassification,
  generateChecklist, generateChecklistWithClaude, ChecklistItem,
  predictNonConformance, NCPrediction,
  planAudits, AuditPlanItem,
  analyseNCWithClaude, NCAnalysis,
  planAuditsWithClaude,
  generateReportHeuristic, generateReportWithClaude, ReportContext,
  scoreCertExpiryRisk, CertRisk,
} from '../../ai/auditIntelligence';
import { suggestActions, refineWithClaude, ActionSuggestion } from '../../ai/correctiveActions';

/* ─── Design tokens ──────────────────────────────────────────────── */
const GOLD = '#c9922a', BLUE = '#1d4ed8', CYAN = '#0891b2';
const card: React.CSSProperties = {
  background: 'var(--cms-bg-surface, #ffffff)', border: '1px solid var(--cms-border-subtle, rgba(15,23,42,0.10))', borderRadius: 16,
  padding: 24, marginBottom: 22, color: 'var(--cms-text-primary, #0f172a)',
};
const cardLight: React.CSSProperties = {
  background: 'var(--cms-bg-elevated, #f8fafc)', border: '1px solid var(--cms-border-subtle, rgba(15,23,42,0.10))', borderRadius: 12,
  padding: 16, marginBottom: 12, color: 'var(--cms-text-primary, #0f172a)',
};
const h3: React.CSSProperties = { margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'var(--cms-text-primary, #0f172a)', display: 'flex', alignItems: 'center', gap: 10 };
const sub: React.CSSProperties = { margin: '0 0 18px', color: 'var(--cms-text-muted, #64748b)', fontSize: 13 };
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--cms-text-muted, #64748b)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' };
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1.5px solid var(--cms-border-input, #cbd5e1)', borderRadius: 9, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', color: 'var(--cms-text-primary, #0f172a)', background: 'var(--cms-bg-elevated, #f8fafc)', outline: 'none' };
const btn = (color = BLUE): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: color, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'opacity .15s' });
const aiBadge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: 'rgba(201,146,42,0.15)', border: '1px solid rgba(201,146,42,0.4)', color: GOLD, fontSize: 11, fontWeight: 700 };
const STANDARDS = ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 45001:2018', 'ISO 27001:2022', 'ISO 22000:2018', 'ISO 13485:2016'];
const catColor: Record<string, string> = { Major: '#ef4444', Minor: '#f59e0b', Observation: '#38bdf8', OFI: '#38bdf8' };
const lvlColor: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };
const priColor: Record<string, string> = { Urgent: '#ef4444', Soon: '#f59e0b', Routine: '#94a3b8' };
const riskColor: Record<string, string> = { Critical: '#ef4444', High: '#f59e0b', Medium: '#fb923c', Low: '#22c55e' };

const Badge = ({ text, color }: { text: string; color: string }) => (
  <span style={{ background: color + '22', color, border: `1px solid ${color}55`, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>{text}</span>
);
const Pill = ({ text, bg, fg }: { text: string; bg: string; fg?: string }) => (
  <span style={{ background: bg, color: fg || '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600, marginRight: 6, marginBottom: 4, display: 'inline-block' }}>{text}</span>
);

/* ─── No-key banner ─────────────────────────────────────────────── */
const NoKeyBanner: React.FC = () => (
  <div style={{ background: 'rgba(201,146,42,0.08)', border: '1px solid rgba(201,146,42,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
    <Info size={18} color={GOLD} style={{ flexShrink: 0 }} />
    <p style={{ margin: 0, fontSize: 13, color: 'var(--cms-text-primary, #0f172a)', lineHeight: 1.5 }}>
      <strong style={{ color: GOLD }}>Claude AI key not configured.</strong> Heuristic results are shown.{' '}
      Configure your Anthropic API key in <strong>Email Configuration → AI Settings</strong> to unlock live Claude agent responses for all tools.
    </p>
  </div>
);

/* ─── Section header ────────────────────────────────────────────── */
const SectionHead: React.FC<{ icon: React.ReactNode; title: string; desc: string; aiPowered?: boolean }> = ({ icon, title, desc, aiPowered }) => (
  <div style={{ marginBottom: 16 }}>
    <h3 style={h3}>{icon} {title} {aiPowered && <span style={aiBadge}><Sparkles size={11} /> AI Agent</span>}</h3>
    <p style={sub}>{desc}</p>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
const AuditIntelligence: React.FC = () => {
  const claude = isClaudeConfigured();

  /* ── 1. Finding Classifier ───────────────────────────────────────── */
  const [fcText, setFcText] = useState('');
  const [fcStd, setFcStd] = useState(STANDARDS[0]);
  const [fcRes, setFcRes] = useState<FindingClassification | null>(null);
  const [fcBusy, setFcBusy] = useState(false);

  /* ── 8. Semantic Search + RAG (Vector DB) ────────────────────────── */
  const [ssQuery, setSsQuery] = useState('');
  const [ssHits, setSsHits] = useState<VectorHit[] | null>(null);
  const [ssAnswer, setSsAnswer] = useState<string>('');
  const runSemanticSearch = () => {
    if (!ssQuery.trim()) return;
    ensureVectorIndex();
    setSsHits(vectorSearch(ssQuery, 6));
    const r = ragAnswer(ssQuery);
    setSsAnswer(r.answer);
  };
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

  /* ── 2. Smart Checklist Generator ───────────────────────────────── */
  const [clStd, setClStd] = useState(STANDARDS[0]);
  const [clInd, setClInd] = useState('');
  const [clRows, setClRows] = useState<ChecklistItem[] | null>(null);
  const [clBusy, setClBusy] = useState(false);
  const [clSource, setClSource] = useState<'heuristic' | 'ai'>('heuristic');
  const runChecklist = async () => {
    setClRows(generateChecklist(clStd, clInd)); setClSource('heuristic');
    if (claude) {
      setClBusy(true);
      const r = await generateChecklistWithClaude(clStd, clInd);
      if (r?.length) { setClRows(r); setClSource('ai'); }
      setClBusy(false);
    }
  };

  /* ── 3. NC Predictor + Claude analysis ──────────────────────────── */
  const predictions = useMemo<NCPrediction[]>(() => predictNonConformance(), []);
  const [ncAnalysis, setNcAnalysis] = useState<NCAnalysis | null>(null);
  const [ncBusy, setNcBusy] = useState(false);
  const runNcAnalysis = async () => {
    setNcBusy(true);
    const r = await analyseNCWithClaude(predictions);
    if (r) setNcAnalysis(r);
    setNcBusy(false);
  };

  /* ── 4. Audit Planner + Claude advice ───────────────────────────── */
  const plan = useMemo<AuditPlanItem[]>(() => planAudits(), []);
  const [planAdvice, setPlanAdvice] = useState<string | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const runPlanAdvice = async () => {
    setPlanBusy(true);
    const r = await planAuditsWithClaude(plan);
    if (r) setPlanAdvice(r);
    setPlanBusy(false);
  };

  /* ── 5. AI Report Writer (streaming) ────────────────────────────── */
  const [rpt, setRpt] = useState<ReportContext>({
    clientName: '', standard: STANDARDS[0], auditDate: new Date().toISOString().slice(0, 10),
    auditType: 'Surveillance', scope: '', leadAuditor: '', findings: '', overallResult: 'Minor NCs',
  });
  const [rptOut, setRptOut] = useState('');
  const [rptBusy, setRptBusy] = useState(false);
  const [rptSource, setRptSource] = useState<'heuristic' | 'ai' | null>(null);
  const rptAbort = useRef<AbortController | null>(null);
  const runReport = async () => {
    if (rptBusy) { rptAbort.current?.abort(); return; }
    setRptOut(''); setRptSource(null);
    if (claude) {
      setRptBusy(true);
      rptAbort.current = new AbortController();
      let buf = '';
      await generateReportWithClaude(rpt, chunk => { buf += chunk; setRptOut(buf); }, rptAbort.current.signal);
      setRptSource('ai'); setRptBusy(false);
    } else {
      setRptOut(generateReportHeuristic(rpt)); setRptSource('heuristic');
    }
  };
  const copyReport = () => { navigator.clipboard.writeText(rptOut); };

  /* ── 6. Corrective Action Recommender ───────────────────────────── */
  const [caText, setCaText] = useState('');
  const [caStd, setCaStd] = useState(STANDARDS[0]);
  const [caSev, setCaSev] = useState<'Major' | 'Minor' | 'Observation'>('Minor');
  const [caRes, setCaRes] = useState<ActionSuggestion[]>([]);
  const [caExpanded, setCaExpanded] = useState<string | null>(null);
  const [caRefined, setCaRefined] = useState<Record<string, string>>({});
  const [caRefBusy, setCaRefBusy] = useState<string | null>(null);
  const runCA = () => {
    if (!caText.trim()) return;
    setCaRes(suggestActions({ description: caText, standard: caStd, severity: caSev }));
  };
  const refineCA = async (item: any) => {
    if (!claude) return;
    setCaRefBusy(item.id);
    const r = await refineWithClaude({ description: caText, standard: caStd, severity: caSev }, item);
    if (r) setCaRefined(prev => ({ ...prev, [item.id]: r }));
    setCaRefBusy(null);
  };

  /* ── 7. Certificate Expiry Risk Scorer ──────────────────────────── */
  const certRisks = useMemo<CertRisk[]>(() => scoreCertExpiryRisk(), []);

  /* ── Layout ─────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto', fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg,#1d4ed8,#0891b2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BrainCircuit size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--cms-text-primary, #0f172a)' }}>Audit Intelligence</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--cms-text-muted, #64748b)' }}>7 AI agents — heuristic by default, Claude-powered when configured</p>
        </div>
      </div>
      {!claude && <NoKeyBanner />}

      {/* ═══ 1. FINDING CLASSIFIER ══════════════════════════════════ */}
      <div style={card}>
        <SectionHead icon={<ShieldAlert size={20} color={GOLD} />} title="Finding Classifier" desc="Paste an audit finding — AI categorises it as Major / Minor / Observation with rationale." aiPowered={claude} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={label}>Finding Description</label>
            <textarea value={fcText} onChange={e => setFcText(e.target.value)} rows={3}
              placeholder="e.g. No documented procedure found for internal audit process. Records are missing for 3 of 5 audits conducted this year."
              style={{ ...inp, resize: 'vertical', minHeight: 72 }} />
          </div>
          <div>
            <label style={label}>Standard</label>
            <select value={fcStd} onChange={e => setFcStd(e.target.value)} style={{ ...inp, marginBottom: 10 }}>
              {STANDARDS.map(s => <option key={s}>{s}</option>)}
            </select>
            <button style={btn(BLUE)} onClick={runClassify} disabled={fcBusy || !fcText.trim()}>
              {fcBusy ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />}
              {fcBusy ? 'Analysing…' : claude ? 'Run Agent' : 'Classify'}
            </button>
          </div>
        </div>
        {fcRes && (
          <div style={{ ...cardLight, borderLeft: `4px solid ${catColor[fcRes.category] || '#64748b'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Badge text={fcRes.category} color={catColor[fcRes.category] || '#64748b'} />
              <span style={{ fontSize: 13, color: 'var(--cms-text-muted, #64748b)' }}>Confidence: <strong style={{ color: 'var(--cms-text-primary, #0f172a)' }}>{Math.round(fcRes.confidence * 100)}%</strong></span>
              {claude && <span style={aiBadge}><Sparkles size={10} /> Claude</span>}
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--cms-text-primary, #0f172a)' }}>{fcRes.rationale}</p>
            {fcRes.signals.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {fcRes.signals.map((s, i) => <Pill key={i} text={`"${s}"`} bg="rgba(100,116,139,0.2)" fg="#94a3b8" />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ 2. SMART CHECKLIST GENERATOR ══════════════════════════ */}
      <div style={card}>
        <SectionHead icon={<ClipboardCheck size={20} color={CYAN} />} title="Smart Checklist Generator" desc="Generates a stage-specific audit checklist tailored to the standard and client industry." aiPowered={claude} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginBottom: 14, alignItems: 'flex-end' }}>
          <div>
            <label style={label}>Standard</label>
            <select value={clStd} onChange={e => setClStd(e.target.value)} style={inp}>
              {STANDARDS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Industry (optional)</label>
            <input value={clInd} onChange={e => setClInd(e.target.value)} style={inp} placeholder="e.g. Manufacturing, Healthcare" />
          </div>
          <button style={btn(CYAN)} onClick={runChecklist} disabled={clBusy}>
            {clBusy ? <Loader2 size={14} /> : <Wand2 size={14} />}
            {clBusy ? 'Generating…' : claude ? 'Run Agent' : 'Generate'}
          </button>
        </div>
        {clRows && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--cms-text-muted, #64748b)' }}>{clRows.length} checklist items</span>
              {clSource === 'ai' && <span style={aiBadge}><Sparkles size={10} /> Claude</span>}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Clause', 'Audit Item', 'Evidence to Seek'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--cms-border-subtle, rgba(15,23,42,0.12))', color: 'var(--cms-text-muted, #64748b)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clRows.map((r, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'var(--cms-bg-hover, rgba(14,165,233,0.05))' : 'transparent' }}>
                      <td style={{ padding: '8px 10px', color: GOLD, fontWeight: 700, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{r.clause}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--cms-text-primary, #0f172a)', verticalAlign: 'top' }}>{r.item}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--cms-text-muted, #64748b)', verticalAlign: 'top', fontSize: 12 }}>{r.focus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ═══ 3. NC PREDICTOR ════════════════════════════════════════ */}
      <div style={card}>
        <SectionHead icon={<AlertTriangle size={20} color="#f59e0b" />} title="Non-Conformance Predictor" desc="Live risk scores from your audit findings data. Claude adds strategic analysis." aiPowered={claude} />
        {predictions.length === 0 ? (
          <p style={{ color: 'var(--cms-text-muted, #64748b)', fontSize: 14 }}>No audit findings data found. Add findings to see predictions.</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, marginBottom: 16 }}>
              {predictions.slice(0, 6).map((p, i) => (
                <div key={i} style={{ ...cardLight, borderLeft: `3px solid ${lvlColor[p.level]}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--cms-text-primary, #0f172a)' }}>{p.client}</span>
                    <Badge text={p.level} color={lvlColor[p.level]} />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: lvlColor[p.level], marginBottom: 4 }}>{p.riskScore}<span style={{ fontSize: 12, color: 'var(--cms-text-muted, #64748b)' }}>/100</span></div>
                  <div style={{ fontSize: 11, color: 'var(--cms-text-muted, #64748b)' }}>{p.drivers.slice(0, 2).join(' · ')}</div>
                </div>
              ))}
            </div>
            {claude && (
              <button style={btn(GOLD)} onClick={runNcAnalysis} disabled={ncBusy}>
                {ncBusy ? <Loader2 size={14} /> : <BrainCircuit size={14} />}
                {ncBusy ? 'Analysing with Claude…' : 'Get AI Strategic Analysis'}
              </button>
            )}
            {ncAnalysis && (
              <div style={{ ...cardLight, marginTop: 14, borderLeft: `3px solid ${GOLD}` }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <span style={aiBadge}><Sparkles size={10} /> Claude Analysis</span>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--cms-text-primary, #0f172a)', lineHeight: 1.6 }}>{ncAnalysis.summary}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <p style={{ ...label, marginBottom: 6 }}>Top Risks</p>
                    {ncAnalysis.topRisks.map((r, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 13, color: 'var(--cms-text-primary, #0f172a)' }}><span style={{ color: '#ef4444' }}>●</span>{r}</div>)}
                  </div>
                  <div>
                    <p style={{ ...label, marginBottom: 6 }}>Recommendations</p>
                    {ncAnalysis.recommendations.map((r, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 13, color: 'var(--cms-text-primary, #0f172a)' }}><CheckCircle2 size={13} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />{r}</div>)}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ 4. AUDIT PLANNER ═══════════════════════════════════════ */}
      <div style={card}>
        <SectionHead icon={<CalendarClock size={20} color="#a855f7" />} title="AI Audit Planner" desc="Suggests what to schedule next based on risk scores, last audit dates, and auditor availability." aiPowered={claude} />
        {plan.length === 0 ? (
          <p style={{ color: 'var(--cms-text-muted, #64748b)', fontSize: 14 }}>No client data found. Register clients and add audit data to generate a plan.</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto', marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>{['Client', 'Priority', 'Window', 'Reason', 'Suggested Auditor'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--cms-border-subtle, rgba(15,23,42,0.12))', color: 'var(--cms-text-muted, #64748b)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {plan.slice(0, 8).map((p, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'var(--cms-bg-hover, rgba(14,165,233,0.05))' : 'transparent' }}>
                      <td style={{ padding: '8px 10px', color: 'var(--cms-text-primary, #0f172a)', fontWeight: 600 }}>{p.client}</td>
                      <td style={{ padding: '8px 10px' }}><Badge text={p.priority} color={priColor[p.priority]} /></td>
                      <td style={{ padding: '8px 10px', color: 'var(--cms-text-muted, #64748b)', whiteSpace: 'nowrap' }}>{p.suggestedWindow}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--cms-text-muted, #64748b)', fontSize: 12 }}>{p.reason}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--cms-text-muted, #64748b)', fontSize: 12 }}>{p.suggestedAuditor || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {claude && (
              <button style={btn('#7c3aed')} onClick={runPlanAdvice} disabled={planBusy}>
                {planBusy ? <Loader2 size={14} /> : <Sparkles size={14} />}
                {planBusy ? 'Generating advice…' : 'Get Claude Scheduling Advice'}
              </button>
            )}
            {planAdvice && (
              <div style={{ ...cardLight, marginTop: 14, borderLeft: `3px solid #7c3aed` }}>
                <span style={{ ...aiBadge, marginBottom: 8, display: 'inline-flex' }}><Sparkles size={10} /> Claude Advice</span>
                <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--cms-text-primary, #0f172a)', lineHeight: 1.7 }}>{planAdvice}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ 5. AI REPORT WRITER ════════════════════════════════════ */}
      <div style={card}>
        <SectionHead icon={<FileText size={20} color="#22c55e" />} title="AI Report Writer" desc={claude ? "Streams a complete audit report draft using Claude. Fill in the context below." : "Generates a structured audit report template. Configure Claude for a full AI-written draft."} aiPowered={claude} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {[
            { key: 'clientName', label: 'Client Name', placeholder: 'Acme Manufacturing Ltd' },
            { key: 'leadAuditor', label: 'Lead Auditor', placeholder: 'Your name' },
          ].map(f => (
            <div key={f.key}>
              <label style={label}>{f.label}</label>
              <input value={(rpt as any)[f.key]} onChange={e => setRpt(r => ({ ...r, [f.key]: e.target.value }))} style={inp} placeholder={f.placeholder} />
            </div>
          ))}
          <div>
            <label style={label}>Standard</label>
            <select value={rpt.standard} onChange={e => setRpt(r => ({ ...r, standard: e.target.value }))} style={inp}>
              {STANDARDS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Audit Type</label>
            <select value={rpt.auditType} onChange={e => setRpt(r => ({ ...r, auditType: e.target.value as any }))} style={inp}>
              {['Initial', 'Surveillance', 'Recertification', 'Special'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Audit Date</label>
            <input type="date" value={rpt.auditDate} onChange={e => setRpt(r => ({ ...r, auditDate: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={label}>Overall Result</label>
            <select value={rpt.overallResult} onChange={e => setRpt(r => ({ ...r, overallResult: e.target.value as any }))} style={inp}>
              {['Conforming', 'Minor NCs', 'Major NCs', 'Not Recommended'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={label}>Audit Scope</label>
          <input value={rpt.scope} onChange={e => setRpt(r => ({ ...r, scope: e.target.value }))} style={inp} placeholder="e.g. Design, manufacture and supply of industrial components" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={label}>Key Findings / Notes</label>
          <textarea value={rpt.findings} onChange={e => setRpt(r => ({ ...r, findings: e.target.value }))} rows={3} placeholder="Summarise findings, NCs, observations..." style={{ ...inp, resize: 'vertical', minHeight: 70 }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btn('#22c55e')} onClick={runReport}>
            {rptBusy ? <><Loader2 size={14} /> Stop</> : <><FileText size={14} /> {claude ? 'Generate with Claude (streaming)' : 'Generate Template'}</>}
          </button>
          {rptOut && <button style={{ ...btn('#334155'), background: 'var(--cms-bg-subtle, #eef2f7)', color: 'var(--cms-text-primary, #0f172a)' }} onClick={copyReport}><Copy size={14} /> Copy</button>}
        </div>
        {rptOut && (
          <div style={{ marginTop: 16, background: 'var(--cms-bg-subtle, #f1f5f9)', border: '1px solid var(--cms-border-subtle, rgba(15,23,42,0.10))', borderRadius: 10, padding: 16, position: 'relative' }}>
            {rptSource === 'ai' && <span style={{ ...aiBadge, position: 'absolute', top: 12, right: 12 }}><Sparkles size={10} /> Claude</span>}
            {rptBusy && <span style={{ ...aiBadge, position: 'absolute', top: 12, right: rptSource === 'ai' ? 110 : 12, background: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.4)', color: '#22c55e' }}><Loader2 size={10} /> Streaming…</span>}
            <pre style={{ margin: 0, fontSize: 13, color: 'var(--cms-text-primary, #0f172a)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>{rptOut}</pre>
          </div>
        )}
      </div>

      {/* ═══ 6. CORRECTIVE ACTION RECOMMENDER ══════════════════════ */}
      <div style={card}>
        <SectionHead icon={<RefreshCw size={20} color="#06b6d4" />} title="Corrective Action Recommender" desc="Suggests corrective and preventive actions for a finding. Claude refines the suggestion in professional language." aiPowered={claude} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={label}>Finding Description</label>
            <textarea value={caText} onChange={e => setCaText(e.target.value)} rows={2} placeholder="Describe the finding requiring corrective action..." style={{ ...inp, resize: 'vertical', minHeight: 60 }} />
          </div>
          <div>
            <label style={label}>Standard</label>
            <select value={caStd} onChange={e => setCaStd(e.target.value)} style={{ ...inp, marginBottom: 8 }}>
              {STANDARDS.map(s => <option key={s}>{s}</option>)}
            </select>
            <label style={label}>Severity</label>
            <select value={caSev} onChange={e => setCaSev(e.target.value as any)} style={inp}>
              {['Major', 'Minor', 'Observation'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button style={btn(CYAN)} onClick={runCA} disabled={!caText.trim()}>
              <Wand2 size={14} /> Suggest
            </button>
          </div>
        </div>
        {caRes.length > 0 && (
          <div>
            {caRes.slice(0, 4).map((item: any) => (
              <div key={item.id} style={{ ...cardLight, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--cms-text-primary, #0f172a)' }}>{item.title}</p>
                    <span style={{ fontSize: 11, color: 'var(--cms-text-muted, #64748b)' }}>Due in {item.dueIn} · Score {Math.round(item.score * 100)}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {claude && (
                      <button style={{ ...btn(GOLD), padding: '5px 10px', fontSize: 12 }} onClick={() => refineCA(item)} disabled={caRefBusy === item.id}>
                        {caRefBusy === item.id ? <Loader2 size={11} /> : <Sparkles size={11} />} Refine with Claude
                      </button>
                    )}
                    <button style={{ ...btn('#334155'), background: 'var(--cms-bg-subtle, #f1f5f9)', padding: '5px 10px', fontSize: 12 }} onClick={() => setCaExpanded(caExpanded === item.id ? null : item.id)}>
                      {caExpanded === item.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>
                </div>
                {caExpanded === item.id && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                    <div>
                      <p style={{ ...label, color: '#22c55e', marginBottom: 4 }}>Corrective Action</p>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--cms-text-primary, #0f172a)', lineHeight: 1.6 }}>{caRefined[item.id] ? caRefined[item.id].split('\n\n')[0] : item.correctiveAction}</p>
                    </div>
                    <div>
                      <p style={{ ...label, color: CYAN, marginBottom: 4 }}>Preventive Action</p>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--cms-text-primary, #0f172a)', lineHeight: 1.6 }}>{caRefined[item.id] ? caRefined[item.id].split('\n\n')[1] || item.preventiveAction : item.preventiveAction}</p>
                    </div>
                  </div>
                )}
                {caRefined[item.id] && <div style={{ marginTop: 8 }}><span style={aiBadge}><Sparkles size={10} /> Claude refined</span></div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ 7. CERTIFICATE EXPIRY RISK SCORER ═════════════════════ */}
      <div style={card}>
        <SectionHead icon={<Award size={20} color={GOLD} />} title="Certificate Expiry Risk Scorer" desc="Scans all active certificates and flags those at risk of lapsing." />
        {certRisks.length === 0 ? (
          <p style={{ color: 'var(--cms-text-muted, #64748b)', fontSize: 14 }}>No certificates found. Issue certificates from Audit Certifications to see expiry risks.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10 }}>
            {certRisks.map((r, i) => (
              <div key={i} style={{ ...cardLight, borderLeft: `3px solid ${riskColor[r.risk]}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--cms-text-primary, #0f172a)' }}>{r.client}</span>
                  <Badge text={r.risk} color={riskColor[r.risk]} />
                </div>
                <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--cms-text-muted, #64748b)' }}>Expires: <strong style={{ color: 'var(--cms-text-primary, #0f172a)' }}>{r.expiryDate}</strong></p>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: r.daysLeft < 0 ? '#ef4444' : '#94a3b8' }}>
                  {r.daysLeft < 0 ? `${Math.abs(r.daysLeft)} days overdue` : `${r.daysLeft} days remaining`}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: riskColor[r.risk], fontWeight: 600 }}>{r.action}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ 8. SEMANTIC SEARCH + RAG (Vector DB) ═══ */}
      <div style={card}>
        <SectionHead icon={<BrainCircuit size={20} color={GOLD} />} title="Semantic Search & RAG (Vector DB)"
          desc="256-dim embedding index over every finding, corrective action and report — search by meaning and get a grounded answer." />
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={ssQuery}
            onChange={(e) => setSsQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSemanticSearch(); }}
            placeholder="e.g. how were calibration issues handled?"
            style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--cms-border-input, #cbd5e1)', background: 'var(--cms-bg-elevated, #f8fafc)', color: 'var(--cms-text-primary, #0f172a)', fontSize: 13 }}
          />
          <button onClick={runSemanticSearch}
            style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: GOLD, color: '#0d1929', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Search
          </button>
        </div>
        {ssAnswer && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(201,146,42,0.10)', border: '1px solid rgba(201,146,42,0.35)', fontSize: 13, color: 'var(--cms-text-primary, #0f172a)', marginBottom: 10 }}>
            <strong style={{ color: GOLD }}>RAG answer:</strong> {ssAnswer}
          </div>
        )}
        {ssHits && (
          ssHits.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--cms-text-muted, #64748b)' }}>No matches in the knowledge base yet.</p>
            : (
              <div style={{ display: 'grid', gap: 8 }}>
                {ssHits.map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--cms-bg-subtle, #f1f5f9)', border: '1px solid var(--cms-border-subtle, rgba(15,23,42,0.10))', fontSize: 13 }}>
                    <span style={{ color: 'var(--cms-text-primary, #0f172a)' }}>{h.title}</span>
                    <span style={{ color: 'var(--cms-text-muted, #64748b)', whiteSpace: 'nowrap' }}>{h.kind} · sim {h.similarity}</span>
                  </div>
                ))}
              </div>
            )
        )}
      </div>

    </div>
  );
};

export default AuditIntelligence;
