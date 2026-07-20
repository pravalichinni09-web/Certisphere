/**
 * SmartCompliance — AI-powered compliance suggestion engine for Auditees.
 * Uses the system prompt from the product spec verbatim as the Claude system role.
 * Falls back to a deterministic heuristic when no API key is configured.
 */
import React, { useState, useRef, useMemo } from 'react';
import {
  BrainCircuit, Sparkles, Wand2, Loader2, Info,
  CheckCircle2, Clock, Layers,
  RefreshCw, Copy, ChevronDown, ChevronUp, ShieldCheck,
} from 'lucide-react';
import { isClaudeConfigured, complete } from '../../ai/claudeClient';

/* ─── Helpers ────────────────────────────────────────────────────── */
const safe = (k: string) => {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; }
};

/* ─── Read live data from localStorage ──────────────────────────── */
function readClientContext() {
  const actions: any[] = safe('cms_corrective_actions_v1') || [];
  const schedA: any[]  = Array.isArray(safe('cms_audit_schedules'))    ? safe('cms_audit_schedules')    : [];
  const schedB: any[]  = Array.isArray(safe('cms_audit_schedules_v3')) ? safe('cms_audit_schedules_v3') : [];
  const schedules      = [...schedA, ...schedB];
  const certs: any[]   = safe('cms_certificates') || [];
  const clients: any[] = safe('cms_clients') || [];

  const openActions  = actions.filter(a => a.status === 'Open');
  const majors       = actions.filter(a => (a.severity || '').includes('Major'));
  const standard     = schedules[0]?.standard || certs[0]?.standard || 'ISO 9001:2015';
  const industry     = clients[0]?.industry || 'General';
  const clientName   = clients[0]?.name || actions[0]?.clientName || 'Your Organisation';
  const nextAudit    = schedules.find(s => s.status !== 'Completed')?.proposedDate || null;
  const compliance   = actions.length
    ? Math.round((actions.filter(a => a.status === 'Approved').length / actions.length) * 100)
    : null;

  return { openActions, majors, standard, industry, clientName, nextAudit, compliance, actions, schedules };
}

/* ─── Heuristic suggestions (no API key) ────────────────────────── */
interface Suggestion {
  priority: number;
  title: string;
  detail: string;
  effort: string;
  resources: string;
  completionDate: string;
  risk: string;
  riskLevel: 'High' | 'Medium' | 'Low';
}

function heuristicSuggestions(ctx: ReturnType<typeof readClientContext>): Suggestion[] {
  const today = new Date();
  const dd = (days: number) => {
    const d = new Date(today); d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const suggestions: Suggestion[] = [];

  if (ctx.majors.length > 0) {
    suggestions.push({
      priority: 1,
      title: `Close ${ctx.majors.length} Major Non-Conformance${ctx.majors.length > 1 ? 's' : ''}`,
      detail: `${ctx.majors.length} major NC${ctx.majors.length > 1 ? 's' : ''} remain open. Prepare a documented root cause analysis and corrective action plan for each using the 5-Why method. Submit evidence of implementation within the audit timeframe.`,
      effort: `${ctx.majors.length * 3}–${ctx.majors.length * 5} days`,
      resources: 'Quality Manager, Department Heads, Documentary Evidence',
      completionDate: dd(ctx.majors.length * 4),
      risk: 'Certificate suspension or withdrawal if not addressed before next audit.',
      riskLevel: 'High',
    });
  }

  if (ctx.openActions.length > 0) {
    suggestions.push({
      priority: suggestions.length + 1,
      title: `Resolve ${ctx.openActions.length} Open Corrective Action${ctx.openActions.length > 1 ? 's' : ''}`,
      detail: `Submit documented corrective actions for all ${ctx.openActions.length} open items in the CertiSphere portal. Each submission should include: containment action, root cause, corrective measure and evidence of closure.`,
      effort: `2–4 days per action`,
      resources: 'Process Owners, Quality Team, CertiSphere portal access',
      completionDate: dd(Math.min(ctx.openActions.length * 3, 30)),
      risk: 'Audit finding escalation and delayed certification timeline.',
      riskLevel: ctx.openActions.length > 3 ? 'High' : 'Medium',
    });
  }

  if (ctx.nextAudit) {
    const daysLeft = Math.round((new Date(ctx.nextAudit).getTime() - today.getTime()) / 86400000);
    if (daysLeft < 45) {
      suggestions.push({
        priority: suggestions.length + 1,
        title: 'Complete Pre-Audit Documentation Review',
        detail: `Your next audit is in ${daysLeft} days. Conduct an internal review of all ${ctx.standard} required documents: quality manual, procedures, work instructions, and records. Identify and close any document control gaps.`,
        effort: '3–5 days',
        resources: 'Document Controller, Quality Manager, Internal Auditor',
        completionDate: dd(Math.min(daysLeft - 7, 14)),
        risk: 'Stage 1 audit failure due to documentation non-conformance.',
        riskLevel: daysLeft < 21 ? 'High' : 'Medium',
      });
    }
  }

  suggestions.push({
    priority: suggestions.length + 1,
    title: `Conduct Internal Self-Assessment against ${ctx.standard}`,
    detail: `Run a full internal audit against all clauses of ${ctx.standard}. Use the CertiSphere AI Checklist Generator for a structured clause-by-clause review. Document findings and create a gap-closure register.`,
    effort: '5–7 days',
    resources: 'Internal Auditor, Department Leads, Management Representative',
    completionDate: dd(21),
    risk: 'Undetected gaps lead to certification failures and rework costs.',
    riskLevel: 'Medium',
  });

  suggestions.push({
    priority: suggestions.length + 1,
    title: 'Train Staff on Audit Participation & Evidence Collection',
    detail: 'Ensure all auditee-facing staff understand how to respond to auditor questions and present objective evidence. Brief teams on audit scope, their clause responsibilities, and documentation requirements.',
    effort: '1 day (workshop)',
    resources: 'HR / Training Manager, Quality Manager, Department Heads',
    completionDate: dd(10),
    risk: 'Poor auditor interaction increases finding rate by up to 40%.',
    riskLevel: 'Medium',
  });

  return suggestions.slice(0, 5);
}

/* ─── Parse Claude JSON or plain text ──────────────────────────────*/
function parseClaude(raw: string): Suggestion[] | null {
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return null;
    return arr.map((s: any, i: number) => ({
      priority: i + 1,
      title: s.title || s.action || `Priority ${i + 1}`,
      detail: s.detail || s.description || s.steps || '',
      effort: s.effort || s.estimatedEffort || s.time || '—',
      resources: s.resources || s.resourceRequirements || '—',
      completionDate: s.completionDate || s.expectedCompletion || '—',
      risk: s.risk || s.riskIfNotAddressed || '—',
      riskLevel: (s.riskLevel || s.risk_level || 'Medium') as 'High' | 'Medium' | 'Low',
    }));
  } catch { return null; }
}

/* ─── Design tokens ──────────────────────────────────────────────── */
const GOLD = '#c9922a', BLUE = '#1d4ed8';
const card: React.CSSProperties = { background: '#ffffff', border: '1px solid rgba(15,23,42,0.09)', borderRadius: 16, padding: 24, marginBottom: 20, color: '#334155' };
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1.5px solid rgba(15,23,42,0.12)', borderRadius: 9, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', color: '#0f2547', background: '#f8fafc', outline: 'none' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' };
const btn = (c = BLUE): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 9, border: 'none', background: c, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' });
const aiBadge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: 'rgba(201,146,42,0.15)', border: '1px solid rgba(201,146,42,0.4)', color: GOLD, fontSize: 11, fontWeight: 700 };
const RISK_COLOR: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };
const STANDARDS = ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 45001:2018', 'ISO 27001:2022', 'ISO 22000:2018', 'ISO 13485:2016', 'SOC 2', 'GDPR', 'HIPAA', 'CMMI'];

/* ═══════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
const SmartCompliance: React.FC = () => {
  const claude = isClaudeConfigured();
  const ctx = useMemo(() => readClientContext(), []);

  /* Form state — pre-filled from live data */
  const [form, setForm] = useState({
    clientName:    ctx.clientName,
    industry:      ctx.industry,
    standard:      ctx.standard,
    auditTimeline: ctx.nextAudit ? `Next audit: ${ctx.nextAudit}` : '4–6 weeks',
    openFindings:  ctx.openActions.length
      ? ctx.openActions.slice(0, 3).map((a: any) => a.description || a.capId || 'Open finding').join('; ')
      : '',
    additionalContext: '',
  });

  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [source, setSource]           = useState<'heuristic' | 'claude' | null>(null);
  const [busy, setBusy]               = useState(false);
  const [expanded, setExpanded]       = useState<number | null>(null);
  const [copied, setCopied]           = useState(false);
  const abortRef                      = useRef<AbortController | null>(null);

  /* ── Run ────────────────────────────────────────────────────────── */
  const run = async () => {
    if (busy) { abortRef.current?.abort(); setBusy(false); return; }

    // Always generate heuristic immediately as baseline
    const heuristic = heuristicSuggestions({ ...ctx,
      standard: form.standard, industry: form.industry,
      clientName: form.clientName,
    });
    setSuggestions(heuristic);
    setSource('heuristic');
    setExpanded(null);

    if (!claude) return;

    setBusy(true);
    abortRef.current = new AbortController();

    const systemPrompt = `You are a compliance advisor for certification audits. Based on the client's current status and audit requirements, provide actionable compliance recommendations.

Analyze:
1. Current compliance gaps identified
2. Client industry and certification type
3. Timeline for audit completion

Provide:
- Top 5 Priority Actions
- Estimated effort/time for each
- Resource requirements
- Expected completion date
- Risk if not addressed

Return your response as a JSON array with this exact structure:
[
  {
    "title": "...",
    "detail": "...",
    "effort": "...",
    "resources": "...",
    "completionDate": "...",
    "risk": "...",
    "riskLevel": "High|Medium|Low"
  }
]
Format as clear, actionable steps the client can implement immediately.`;

    const userPrompt = `Client: ${form.clientName}
Industry: ${form.industry}
Certification Standard: ${form.standard}
Audit Timeline: ${form.auditTimeline}
Open Findings/Gaps: ${form.openFindings || 'None identified yet'}
Compliance Score: ${ctx.compliance !== null ? `${ctx.compliance}%` : 'Unknown'}
Major NCs: ${ctx.majors.length}
Open Actions: ${ctx.openActions.length}
${form.additionalContext ? `Additional Context: ${form.additionalContext}` : ''}

Provide the top 5 priority compliance actions in the JSON format specified.`;

    try {
      const raw = await complete(userPrompt, {
        system: systemPrompt,
        maxTokens: 1400,
        temperature: 0.3,
        signal: abortRef.current.signal,
      });
      if (raw) {
        const parsed = parseClaude(raw);
        if (parsed && parsed.length > 0) {
          setSuggestions(parsed);
          setSource('claude');
        }
      }
    } catch {
      // heuristic already shown
    } finally {
      setBusy(false);
    }
  };

  /* ── Copy plain text ────────────────────────────────────────────── */
  const copyAll = () => {
    if (!suggestions) return;
    const text = suggestions.map((s, i) =>
      `${i + 1}. ${s.title}\n   ${s.detail}\n   Effort: ${s.effort} | Resources: ${s.resources}\n   Completion: ${s.completionDate}\n   Risk: ${s.risk} [${s.riskLevel}]`
    ).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: '24px', maxWidth: 860, margin: '0 auto', fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BrainCircuit size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f2547' }}>Smart Compliance Suggestions</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>AI compliance advisor — top 5 priority actions tailored to your audit status</p>
        </div>
      </div>

      {/* No-key banner */}
      {!claude && (
        <div style={{ background: 'rgba(201,146,42,0.08)', border: '1px solid rgba(201,146,42,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
          <Info size={17} color={GOLD} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 13, color: '#0f2547', lineHeight: 1.5 }}>
            <strong style={{ color: GOLD }}>Heuristic mode</strong> — structured recommendations from your live audit data.
            Configure your Claude API key in <strong>AI Settings</strong> for a fully personalised AI response.
          </p>
        </div>
      )}

      {/* Context form */}
      <div style={card}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: '#0f2547', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={17} color={GOLD} /> Audit Context
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b', fontWeight: 400 }}>Pre-filled from your live data</span>
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {[
            { key: 'clientName', label: 'Organisation Name', placeholder: 'Your company name' },
            { key: 'industry',   label: 'Industry',          placeholder: 'e.g. Manufacturing, Healthcare' },
          ].map(f => (
            <div key={f.key}>
              <label style={lbl}>{f.label}</label>
              <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inp} placeholder={f.placeholder} />
            </div>
          ))}
          <div>
            <label style={lbl}>Certification Standard</label>
            <select value={form.standard} onChange={e => setForm(p => ({ ...p, standard: e.target.value }))} style={inp}>
              {STANDARDS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Audit Timeline</label>
            <input value={form.auditTimeline} onChange={e => setForm(p => ({ ...p, auditTimeline: e.target.value }))} style={inp} placeholder="e.g. 4 weeks, Next audit: Jan 30" />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Current Compliance Gaps / Open Findings</label>
          <textarea value={form.openFindings} onChange={e => setForm(p => ({ ...p, openFindings: e.target.value }))} rows={2}
            placeholder="Describe open non-conformances, findings or known gaps..."
            style={{ ...inp, resize: 'vertical', minHeight: 60 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Additional Context (optional)</label>
          <textarea value={form.additionalContext} onChange={e => setForm(p => ({ ...p, additionalContext: e.target.value }))} rows={2}
            placeholder="Any specific concerns, upcoming deadlines, management requirements..."
            style={{ ...inp, resize: 'vertical', minHeight: 52 }} />
        </div>

        {/* Live stats strip */}
        {(ctx.openActions.length > 0 || ctx.majors.length > 0 || ctx.compliance !== null) && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            {ctx.compliance !== null && (
              <div style={{ background: '#f8fafc', border: '1px solid rgba(15,23,42,0.09)', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: ctx.compliance >= 75 ? '#22c55e' : '#f59e0b' }}>{ctx.compliance}%</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Compliance Score</div>
              </div>
            )}
            {ctx.openActions.length > 0 && (
              <div style={{ background: '#f8fafc', border: '1px solid rgba(15,23,42,0.09)', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#f59e0b' }}>{ctx.openActions.length}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Open Actions</div>
              </div>
            )}
            {ctx.majors.length > 0 && (
              <div style={{ background: '#f8fafc', border: '1px solid rgba(15,23,42,0.09)', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#ef4444' }}>{ctx.majors.length}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Major NCs</div>
              </div>
            )}
          </div>
        )}

        <button style={btn(busy ? '#374151' : '#7c3aed')} onClick={run}>
          {busy
            ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Stop</>
            : <><Wand2 size={15} /> {claude ? 'Generate AI Suggestions' : 'Generate Suggestions'}</>
          }
        </button>
      </div>

      {/* Results */}
      {suggestions && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <ShieldCheck size={18} color={GOLD} />
            <span style={{ fontWeight: 800, fontSize: 15, color: '#0f2547' }}>Top 5 Priority Actions</span>
            {source === 'claude' && <span style={aiBadge}><Sparkles size={10} /> Claude AI</span>}
            {source === 'heuristic' && <span style={{ ...aiBadge, background: 'rgba(100,116,139,0.15)', borderColor: 'rgba(100,116,139,0.4)', color: '#64748b' }}>Smart Heuristic</span>}
            <button style={{ marginLeft: 'auto', ...btn('#eef2f7'), padding: '6px 12px', fontSize: 12 }} onClick={copyAll}>
              <Copy size={13} /> {copied ? 'Copied!' : 'Copy All'}
            </button>
          </div>

          {suggestions.map((s, i) => (
            <div key={i} style={{ background: '#ffffff', border: `1px solid rgba(15,23,42,0.09)`, borderLeft: `4px solid ${RISK_COLOR[s.riskLevel]}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
              {/* Header row */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }}
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${RISK_COLOR[s.riskLevel]}22`, border: `2px solid ${RISK_COLOR[s.riskLevel]}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontWeight: 900, fontSize: 13, color: RISK_COLOR[s.riskLevel] }}>{i + 1}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#0f2547' }}>{s.title}</p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{s.effort}</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Due: {s.completionDate}</span>
                    <span style={{ background: `${RISK_COLOR[s.riskLevel]}22`, color: RISK_COLOR[s.riskLevel], border: `1px solid ${RISK_COLOR[s.riskLevel]}44`, padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>{s.riskLevel} Risk</span>
                  </div>
                </div>
                {expanded === i ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
              </div>

              {/* Expanded detail */}
              {expanded === i && (
                <div style={{ borderTop: '1px solid rgba(15,23,42,0.07)', padding: '14px 18px', background: '#f8fafc' }}>
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: '#334155', lineHeight: 1.7 }}>{s.detail}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ background: '#ffffff', borderRadius: 8, padding: '10px 12px' }}>
                      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resources Required</p>
                      <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>{s.resources}</p>
                    </div>
                    <div style={{ background: '#ffffff', borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${RISK_COLOR[s.riskLevel]}` }}>
                      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Risk if Not Addressed</p>
                      <p style={{ margin: 0, fontSize: 13, color: RISK_COLOR[s.riskLevel] }}>{s.risk}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <CheckCircle2 size={14} color="#22c55e" />
                    <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>Target completion: {s.completionDate}</span>
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>· Effort: {s.effort}</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Regenerate */}
          <button style={{ ...btn('#0f172a'), border: '1px solid rgba(15,23,42,0.12)', marginTop: 4 }} onClick={run} disabled={busy}>
            <RefreshCw size={14} /> Regenerate
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
};

export default SmartCompliance;
