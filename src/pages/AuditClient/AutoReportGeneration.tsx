/**
 * AutoReportGeneration — auto-generates a formal 8-section audit report
 * for the Auditee. Streams from Claude when configured; uses a structured
 * heuristic template as immediate fallback.
 */
import React, { useState, useRef, useMemo } from 'react';
import {
  FileText, Wand2, Loader2, Info, Sparkles,
  Copy, Download, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { isClaudeConfigured, getApiKey, getModel, anthropicFetch } from '../../ai/claudeClient';
import { loadCorrectiveActions } from '../../services/correctiveActions';

/* ─── Read live context ──────────────────────────────────────────── */
const safe = (k: string) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; } };

function readContext() {
  const actions: any[] = loadCorrectiveActions();
  const schedA: any[]  = Array.isArray(safe('cms_audit_schedules'))    ? safe('cms_audit_schedules')    : [];
  const schedB: any[]  = Array.isArray(safe('cms_audit_schedules_v3')) ? safe('cms_audit_schedules_v3') : [];
  const schedules      = [...schedA, ...schedB];
  const clients: any[] = safe('cms_clients') || [];
  const certs: any[]   = safe('cms_certificates') || [];

  const latest   = schedules.find(s => s.status === 'Completed') || schedules[0];
  const openActs = actions.filter(a => a.status === 'Open');
  const majors   = actions.filter(a => a.severity === 'Major NC');
  const minors   = actions.filter(a => a.severity === 'Minor NC');
  const ofis     = actions.filter(a => a.severity === 'OFI');
  const approved = actions.filter(a => a.status === 'Approved');
  const compliance = actions.length ? Math.round((approved.length / actions.length) * 100) : 92;

  return {
    clientName:  clients[0]?.name   || actions[0]?.clientName || '',
    standard:    latest?.standard   || certs[0]?.standard     || 'ISO 9001:2015',
    auditDate:   latest?.proposedDate || latest?.confirmedDate  || new Date().toISOString().slice(0, 10),
    auditType:   latest?.auditType  || 'Surveillance',
    scope:       latest?.scope      || clients[0]?.scope       || '',
    auditor:     latest?.leadAuditor|| '',
    majors, minors, ofis, openActs, approved, compliance, actions,
  };
}

/* ─── Heuristic report template ─────────────────────────────────── */
function buildHeuristicReport(f: ReturnType<typeof readContext>, form: FormState): string {
  const date   = new Date(form.auditDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const result = f.majors.length > 0 ? 'Not Recommended for Certification' : f.minors.length > 0 ? 'Conditional — Minor NCs to be addressed' : 'Recommended for Certification';
  const now    = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `AUDIT REPORT
${form.standard} | ${form.auditType} Audit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CLIENT INFORMATION
Organisation : ${form.clientName}
Audit Date   : ${date}
Audit Type   : ${form.auditType}
Standard     : ${form.standard}
Lead Auditor : ${form.auditor || 'To be confirmed'}
Report Date  : ${now}
Overall Result: ${result}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This report presents the findings and conclusions from the ${form.auditType.toLowerCase()} audit of ${form.clientName}'s management system conducted against the requirements of ${form.standard} on ${date}. The audit assessed the organisation's compliance with the standard across all defined scope areas. A total of ${f.actions.length} audit findings were identified, comprising ${f.majors.length} major non-conformance${f.majors.length !== 1 ? 's' : ''}, ${f.minors.length} minor non-conformance${f.minors.length !== 1 ? 's' : ''}, and ${f.ofis.length} opportunity${f.ofis.length !== 1 ? 'ies' : 'y'} for improvement. The overall compliance score stands at ${f.compliance}%. The organisation ${f.majors.length === 0 ? 'demonstrated an acceptable level of conformity and' : 'must address identified major non-conformances prior to'} certification ${f.majors.length === 0 ? 'is recommended.' : 'being recommended.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. AUDIT SCOPE AND OBJECTIVES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Scope:
${form.scope || 'The audit covered the full management system as defined in the organisation\'s quality manual and certification scope document.'}

Objectives:
• Verify the effective implementation and maintenance of the management system
• Assess conformity with all applicable requirements of ${form.standard}
• Evaluate the organisation's ability to achieve its stated policy objectives
• Identify opportunities for continual improvement
• Confirm readiness for ${form.auditType === 'Initial' ? 'initial certification' : form.auditType === 'Recertification' ? 'recertification' : 'continued certification'}

${form.additionalContext ? `Additional Context:\n${form.additionalContext}\n` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. METHODOLOGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The audit was conducted in accordance with ISO 19011:2018 (Guidelines for auditing management systems) and ISO/IEC 17021-1:2015 (Requirements for bodies providing audit and certification of management systems).

Audit activities included:
• Opening meeting with senior management and process owners
• Review of documented information, procedures, and records
• Interviews with relevant personnel across all departments in scope
• Observation of processes and activities in the workplace
• Sampling of objective evidence across applicable standard clauses
• Closing meeting to present preliminary findings

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. FINDINGS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Category                  | Count | Status
─────────────────────────────────────────────
Major Non-Conformances    |   ${String(f.majors.length).padStart(2)}  | Must be closed before certification
Minor Non-Conformances    |   ${String(f.minors.length).padStart(2)}  | To be closed within agreed timeframe
Opportunities for Improvement |  ${String(f.ofis.length).padStart(2)}  | Advisory — no mandatory closure
─────────────────────────────────────────────
Total Findings            |   ${String(f.actions.length).padStart(2)}  |
Closed / Approved         |   ${String(f.approved.length).padStart(2)}  |
Compliance Score          |  ${f.compliance}%  |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. DETAILED FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${f.majors.length === 0 && f.minors.length === 0 ? 'No critical or major findings were identified during this audit.\n' : ''}
${f.majors.map((m: any, i: number) => `MAJOR NON-CONFORMANCE ${i + 1} — ${m.capId || m.id}
Finding  : ${m.description}
Clause   : ${m.standard || form.standard}
Root Cause: ${m.rootCause || 'Root cause analysis pending'}
Status   : ${m.status}
Due Date : ${m.dueDate}
`).join('\n')}${f.minors.map((m: any, i: number) => `MINOR NON-CONFORMANCE ${i + 1} — ${m.capId || m.id}
Finding  : ${m.description}
Clause   : ${m.standard || form.standard}
Status   : ${m.status}
Due Date : ${m.dueDate}
`).join('\n')}${f.ofis.map((o: any, i: number) => `OPPORTUNITY FOR IMPROVEMENT ${i + 1} — ${o.capId || o.id}
Observation: ${o.description}
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. POSITIVE OBSERVATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The following positive aspects were noted during the audit:
• Management commitment to the ${form.standard} management system was evident throughout the audit
• Personnel demonstrated good awareness of their roles and responsibilities within the system
• Documentation was generally well-maintained and accessible
• The organisation showed a proactive approach to addressing previously identified issues
${f.compliance >= 80 ? '• High closure rate of corrective actions demonstrates strong follow-through on commitments\n' : ''}${f.majors.length === 0 ? '• No major system failures were identified, indicating a fundamentally sound management system\n' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. RECOMMENDATIONS FOR IMPROVEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${f.majors.length > 0 ? '1. Prioritise closure of all major non-conformances with documented corrective action plans submitted through the CertiSphere portal.\n' : ''}${f.openActs.length > 0 ? `${f.majors.length > 0 ? '2' : '1'}. Address all ${f.openActs.length} open corrective actions before the next surveillance audit to maintain certification standing.\n` : ''}• Implement a structured internal audit programme to proactively identify gaps between audit cycles
• Strengthen management review processes to ensure system-level issues are addressed at executive level
• Invest in staff awareness training to embed the management system into daily operational practice
• Consider conducting a formal gap analysis against the latest version of ${form.standard} to identify emerging areas for improvement

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. CONCLUSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Based on the evidence gathered during the ${form.auditType.toLowerCase()} audit conducted on ${date}, the management system of ${form.clientName} has been assessed against the requirements of ${form.standard}.

Overall Audit Result: ${result.toUpperCase()}

${f.majors.length > 0
  ? `Certification cannot be recommended at this time. The organisation must address ${f.majors.length} major non-conformance${f.majors.length > 1 ? 's' : ''} and provide documented evidence of effective corrective action before a recommendation can be made.`
  : f.minors.length > 0
  ? `Certification is recommended subject to satisfactory closure of ${f.minors.length} minor non-conformance${f.minors.length > 1 ? 's' : ''} within the agreed timeframe. The organisation has demonstrated an overall conforming management system with isolated areas requiring improvement.`
  : `The organisation has demonstrated full conformity with the requirements of ${form.standard}. Certification is recommended. The management system is effectively implemented and maintained, supporting the achievement of the organisation's quality objectives.`}

This report is issued by the Certification Body and represents the official audit findings. Matters of disagreement should be raised through the formal appeals process within 30 days of receipt.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Lead Auditor Signature: _______________________    Date: ${now}
Certification Body Authorisation: ____________    Ref: ${form.standard}-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

/* ─── Streaming Claude call ──────────────────────────────────────── */
const SYSTEM = `You are a professional audit report writer. Generate a formal audit report from provided data.

Report Structure:
1. Executive Summary (1 paragraph)
2. Audit Scope and Objectives
3. Methodology
4. Findings Summary (categorized by severity)
5. Detailed Findings (critical/major issues with evidence)
6. Positive Observations
7. Recommendations for Improvement
8. Conclusion

Use professional language, be accurate, maintain objectivity.
Format: Professional business document tone.`;

async function streamReport(
  prompt: string,
  onChunk: (c: string) => void,
  signal: AbortSignal
): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('not_configured');
  const res = await anthropicFetch({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: getModel(), max_tokens: 2400, temperature: 0.35,
      stream: true, system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Claude ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value).split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') return;
      try { const delta = JSON.parse(raw)?.delta?.text || ''; if (delta) onChunk(delta); } catch { /* */ }
    }
  }
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const GOLD = '#c9922a', BLUE = '#1d4ed8';
const STANDARDS = ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 45001:2018', 'ISO 27001:2022', 'ISO 22000:2018', 'ISO 13485:2016', 'SOC 2', 'GDPR', 'HIPAA'];
const AUDIT_TYPES = ['Initial', 'Surveillance', 'Recertification', 'Special'];
const cardS: React.CSSProperties = { background: '#ffffff', border: '1px solid rgba(15,23,42,0.09)', borderRadius: 16, padding: 24, marginBottom: 20 };
const inp: React.CSSProperties   = { width: '100%', padding: '10px 12px', border: '1.5px solid rgba(15,23,42,0.12)', borderRadius: 9, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', color: '#0f2547', background: '#f8fafc', outline: 'none' };
const lbl: React.CSSProperties   = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' };
const btnS = (c = BLUE, extra: React.CSSProperties = {}): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 9, border: 'none', background: c, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', ...extra });
const aiBadge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: 'rgba(201,146,42,0.15)', border: '1px solid rgba(201,146,42,0.4)', color: GOLD, fontSize: 11, fontWeight: 700 };

/* ─── Form shape ─────────────────────────────────────────────────── */
interface FormState {
  clientName: string; standard: string; auditDate: string;
  auditType: string; scope: string; auditor: string; additionalContext: string;
}

/* ═══════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
const AutoReportGeneration: React.FC = () => {
  const claude = isClaudeConfigured();
  const ctx    = useMemo(() => readContext(), []);

  const [form, setForm] = useState<FormState>({
    clientName: ctx.clientName, standard: ctx.standard,
    auditDate: ctx.auditDate,   auditType: ctx.auditType,
    scope: ctx.scope,           auditor: ctx.auditor,
    additionalContext: '',
  });

  const [report, setReport]   = useState('');
  const [busy, setBusy]       = useState(false);
  const [source, setSource]   = useState<'heuristic' | 'claude' | null>(null);
  const [copied, setCopied]   = useState(false);
  const abortRef              = useRef<AbortController | null>(null);

  /* ── Generate ────────────────────────────────────────────────── */
  const generate = async () => {
    if (busy) { abortRef.current?.abort(); setBusy(false); return; }

    // Always show heuristic immediately
    const heuristic = buildHeuristicReport(ctx, form);
    setReport(heuristic); setSource('heuristic');

    if (!claude) return;

    // Stream Claude on top
    setBusy(true);
    abortRef.current = new AbortController();
    setReport('');

    const prompt = `Generate a formal ${form.auditType} audit report with these details:

Organisation: ${form.clientName}
Standard: ${form.standard}
Audit Date: ${form.auditDate}
Audit Type: ${form.auditType}
Lead Auditor: ${form.auditor || 'Not specified'}
Audit Scope: ${form.scope || 'Full management system scope'}
Compliance Score: ${ctx.compliance}%

Findings Data:
- Major Non-Conformances (${ctx.majors.length}): ${ctx.majors.map((m: any) => `${m.capId}: ${m.description}`).join(' | ') || 'None'}
- Minor Non-Conformances (${ctx.minors.length}): ${ctx.minors.map((m: any) => `${m.capId}: ${m.description}`).join(' | ') || 'None'}
- Opportunities for Improvement (${ctx.ofis.length}): ${ctx.ofis.map((o: any) => o.description).join(' | ') || 'None'}
- Open Actions: ${ctx.openActs.length}
- Approved/Closed: ${ctx.approved.length}
${form.additionalContext ? `Additional Context: ${form.additionalContext}` : ''}

Include all 8 sections. Use formal certification body language. Be thorough and professional.`;

    try {
      let buf = '';
      await streamReport(prompt, chunk => { buf += chunk; setReport(buf); }, abortRef.current.signal);
      setSource('claude');
    } catch { setReport(heuristic); setSource('heuristic'); }
    finally { setBusy(false); }
  };

  /* ── Copy ─────────────────────────────────────────────────────── */
  const copy = () => { navigator.clipboard.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  /* ── Download as .txt ─────────────────────────────────────────── */
  const download = () => {
    const blob = new Blob([report], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `Audit_Report_${form.clientName.replace(/\s+/g, '_')}_${form.auditDate}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  /* ── Render ─────────────────────────────────────────────────────*/
  return (
    <div style={{ padding: '24px', maxWidth: 920, margin: '0 auto', fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#0f2547,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileText size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f2547' }}>Auto Report Generation</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            {claude ? 'AI-generated formal 8-section audit report — streaming live' : 'Structured report from your live audit data — configure Claude API key for full AI draft'}
          </p>
        </div>
      </div>

      {/* No-key banner */}
      {!claude && (
        <div style={{ background: 'rgba(201,146,42,0.07)', border: '1px solid rgba(201,146,42,0.25)', borderRadius: 9, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Info size={15} color={GOLD} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#0f2547', lineHeight: 1.5 }}>
            <strong style={{ color: GOLD }}>Template mode</strong> — fully structured report auto-filled from your live findings data.
            Live Claude AI (enabled by your administrator) is needed for a fully written AI draft.
          </p>
        </div>
      )}

      {/* Context form */}
      <div style={cardS}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, color: '#0f2547', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={17} color={GOLD} /> Report Details
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b', fontWeight: 400 }}>Pre-filled from your audit data</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {[
            { key: 'clientName', label: 'Organisation Name', placeholder: 'Your company' },
            { key: 'auditor',    label: 'Lead Auditor',      placeholder: 'Auditor name' },
          ].map(f => (
            <div key={f.key}>
              <label style={lbl}>{f.label}</label>
              <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inp} placeholder={f.placeholder} />
            </div>
          ))}
          <div>
            <label style={lbl}>Standard</label>
            <select value={form.standard} onChange={e => setForm(p => ({ ...p, standard: e.target.value }))} style={inp}>
              {STANDARDS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Audit Type</label>
            <select value={form.auditType} onChange={e => setForm(p => ({ ...p, auditType: e.target.value }))} style={inp}>
              {AUDIT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Audit Date</label>
            <input type="date" value={form.auditDate} onChange={e => setForm(p => ({ ...p, auditDate: e.target.value }))} style={inp} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Audit Scope</label>
          <textarea value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value }))} rows={2}
            placeholder="e.g. Design, manufacture and supply of industrial components — Facility: HQ, Chennai"
            style={{ ...inp, resize: 'vertical', minHeight: 60 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Additional Context (optional)</label>
          <textarea value={form.additionalContext} onChange={e => setForm(p => ({ ...p, additionalContext: e.target.value }))} rows={2}
            placeholder="Any specific observations, management commitment notes, prior audit history..."
            style={{ ...inp, resize: 'vertical', minHeight: 52 }} />
        </div>

        {/* Live stats strip */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            { label: 'Major NCs',   val: ctx.majors.length,   color: '#ef4444' },
            { label: 'Minor NCs',   val: ctx.minors.length,   color: '#f59e0b' },
            { label: 'OFIs',        val: ctx.ofis.length,     color: '#38bdf8' },
            { label: 'Compliance',  val: `${ctx.compliance}%`,color: ctx.compliance >= 75 ? '#22c55e' : '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{ background: '#eef4fb', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 9, padding: '8px 16px', textAlign: 'center', minWidth: 72 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={btnS(busy ? '#374151' : BLUE)} onClick={generate}>
            {busy
              ? <><Loader2 size={15} style={{ animation: 'rg-spin 1s linear infinite' }} /> {claude ? 'Streaming… (click to stop)' : 'Generating…'}</>
              : <><Wand2 size={15} /> {claude ? 'Generate with Claude (streaming)' : 'Generate Report'}</>}
          </button>
          {report && !busy && (
            <button style={{ ...btnS('transparent', { border: '1px solid rgba(15,23,42,0.14)', color: '#64748b' }) }} onClick={generate}>
              <RefreshCw size={14} /> Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Report output */}
      {(report || busy) && (
        <div style={cardS}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#0f2547', display: 'flex', alignItems: 'center', gap: 7 }}>
              <CheckCircle2 size={16} color="#22c55e" /> Audit Report
            </span>
            {source === 'claude' && <span style={aiBadge}><Sparkles size={10} /> Claude AI</span>}
            {source === 'heuristic' && <span style={{ ...aiBadge, background: 'rgba(100,116,139,0.12)', borderColor: 'rgba(100,116,139,0.3)', color: '#64748b' }}>Auto Template</span>}
            {busy && <span style={{ ...aiBadge, background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.35)', color: '#22c55e' }}><Loader2 size={10} style={{ animation: 'rg-spin 0.8s linear infinite' }} /> Streaming…</span>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button style={{ ...btnS('#eef2f7', { padding: '7px 13px', fontSize: 12, border: '1px solid rgba(15,23,42,0.12)' }) }} onClick={copy}>
                <Copy size={13} /> {copied ? 'Copied!' : 'Copy'}
              </button>
              <button style={{ ...btnS('#064e3b', { padding: '7px 13px', fontSize: 12 }) }} onClick={download}>
                <Download size={13} /> Download .txt
              </button>
            </div>
          </div>

          {/* Report body */}
          <pre style={{
            margin: 0, fontSize: 12.5, color: '#334155', whiteSpace: 'pre-wrap',
            lineHeight: 1.75, fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace",
            background: '#eef4fb', borderRadius: 10, padding: 20,
            border: '1px solid rgba(15,23,42,0.07)',
            maxHeight: 680, overflowY: 'auto',
          }}>
            {report}
            {busy && <span style={{ animation: 'rg-blink 1s step-end infinite', color: GOLD }}>▌</span>}
          </pre>
        </div>
      )}

      <style>{`
        @keyframes rg-spin  { to { transform: rotate(360deg) } }
        @keyframes rg-blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  );
};

export default AutoReportGeneration;
