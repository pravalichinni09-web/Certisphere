/**
 * AnomalyDetection — AI-powered audit anomaly scanner for the Auditor role.
 * Heuristic analysis runs immediately; Claude upgrade when key is configured.
 */
import React, { useState, useRef, useMemo } from 'react';
import {
  AlertTriangle, Wand2, Loader2, Info, Sparkles,
  Copy, RefreshCw, ShieldAlert, Eye, ChevronDown, ChevronUp,
  AlertCircle, Clock, FileX, TrendingUp, Zap,
} from 'lucide-react';
import { isClaudeConfigured, getApiKey, getModel } from '../../ai/claudeClient';
import { loadCorrectiveActions, type CorrectiveActionRecord } from '../../services/correctiveActions';

/* ──────────────────────── Types ───────────────────────────────── */
type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low';
interface Anomaly {
  id: string;
  category: string;
  description: string;
  riskLevel: RiskLevel;
  possibleCause: string;
  investigationRequired: string;
  impact: string;
  affectedRecords?: string[];
}

/* ──────────────────────── Safe localStorage read ───────────────── */
const safe = (k: string) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; } };

function readAllData() {
  const actions: CorrectiveActionRecord[] = loadCorrectiveActions();
  const schedA: any[] = Array.isArray(safe('cms_audit_schedules'))    ? safe('cms_audit_schedules')    : [];
  const schedB: any[] = Array.isArray(safe('cms_audit_schedules_v3')) ? safe('cms_audit_schedules_v3') : [];
  const schedules     = [...schedA, ...schedB];
  const certs: any[]  = safe('cms_certificates') || [];
  const clients: any[]= safe('cms_clients')      || [];
  return { actions, schedules, certs, clients };
}

/* ──────────────────────── Heuristic anomaly engine ─────────────── */
function detectHeuristic(data: ReturnType<typeof readAllData>): Anomaly[] {
  const { actions, schedules, certs } = data;
  const anomalies: Anomaly[] = [];
  const now = new Date();

  /* 1. Overdue open major NCs ─────────────────────────────────── */
  const overdueMajors = actions.filter(a => {
    if (a.severity !== 'Major NC') return false;
    if (a.status === 'Approved') return false;
    return a.dueDate && new Date(a.dueDate) < now;
  });
  if (overdueMajors.length > 0) {
    anomalies.push({
      id: 'h-001',
      category: 'Timing Anomaly',
      description: `${overdueMajors.length} major non-conformance${overdueMajors.length > 1 ? 's are' : ' is'} overdue without closure. Major NCs must be resolved within the certification body's mandated timeframe.`,
      riskLevel: 'Critical',
      possibleCause: 'Insufficient management priority, resource constraints, or lack of effective corrective action implementation.',
      investigationRequired: 'Review each overdue Major NC. Obtain written explanation from client management. Escalate to Lead Auditor if no response within 5 working days.',
      impact: 'Suspension or withdrawal of certification if not resolved promptly. Regulatory/contractual non-compliance risk.',
      affectedRecords: overdueMajors.map(a => a.capId),
    });
  }

  /* 2. Actions open >90 days without any submission ───────────── */
  const stalledOpen = actions.filter(a => {
    if (a.status !== 'Open') return false;
    const age = (now.getTime() - new Date(a.dueDate).getTime()) / 86400000;
    return age > 90;
  });
  if (stalledOpen.length > 0) {
    anomalies.push({
      id: 'h-002',
      category: 'Authorization Issue',
      description: `${stalledOpen.length} action${stalledOpen.length > 1 ? 's' : ''} remain in "Open" status with no submission for over 90 days. No corrective action plan has been initiated.`,
      riskLevel: 'High',
      possibleCause: 'Action owner unassigned, communication breakdown, or systemic process non-compliance.',
      investigationRequired: 'Contact client to confirm awareness of each action. Verify action owner exists and is accountable. Consider escalation to management.',
      impact: 'Uncorrected systemic issues may lead to recurring non-conformances and loss of customer confidence.',
      affectedRecords: stalledOpen.map(a => a.capId),
    });
  }

  /* 3. Duplicate NC descriptions (possible data entry error) ──── */
  const descMap = new Map<string, CorrectiveActionRecord[]>();
  actions.forEach(a => {
    const key = a.description.trim().toLowerCase().slice(0, 80);
    if (!descMap.has(key)) descMap.set(key, []);
    descMap.get(key)!.push(a);
  });
  const dupes = [...descMap.values()].filter(g => g.length > 1);
  if (dupes.length > 0) {
    const dupIds = dupes.flatMap(g => g.map(a => a.capId));
    anomalies.push({
      id: 'h-003',
      category: 'Duplicate Records',
      description: `${dupes.length} set${dupes.length > 1 ? 's' : ''} of corrective actions share near-identical descriptions (${dupIds.length} records total). Possible duplicate entries or data import error.`,
      riskLevel: 'Medium',
      possibleCause: 'Manual data entry duplication, batch import error, or the same finding being logged multiple times by different users.',
      investigationRequired: 'Cross-check each duplicate pair against original audit report. Merge or close duplicates in the system with documented justification.',
      impact: 'Inflated NC count skews compliance metrics. Client may close one and inadvertently leave the other open.',
      affectedRecords: dupIds,
    });
  }

  /* 4. Actions closed suspiciously fast (<24 hours) ───────────── */
  const tooFast = actions.filter(a => {
    if (!a.submittedAt || a.status === 'Open') return false;
    const sub = new Date(a.submittedAt);
    const created = new Date(a.dueDate);
    // Flag if submitted same day as created (dueDate is proxy for open date)
    return (sub.getTime() - created.getTime()) < 86400000 && (sub.getTime() - created.getTime()) > 0;
  });
  if (tooFast.length > 0) {
    anomalies.push({
      id: 'h-004',
      category: 'Timing Anomaly',
      description: `${tooFast.length} corrective action${tooFast.length > 1 ? 's were' : ' was'} submitted within 24 hours of creation. Root cause analysis and corrective action planning typically require more time.`,
      riskLevel: 'Medium',
      possibleCause: 'Superficial corrective actions submitted without genuine root cause analysis, or pre-existing fix being backdated.',
      investigationRequired: 'Request objective evidence for each rapid closure. Verify root cause analysis depth. Sample-check effectiveness post-implementation.',
      impact: 'Recurrence of the same non-conformance if root cause was not genuinely addressed.',
      affectedRecords: tooFast.map(a => a.capId),
    });
  }

  /* 5. Missing root cause on major NCs ────────────────────────── */
  const noRootCause = actions.filter(a =>
    a.severity === 'Major NC' &&
    a.status !== 'Open' &&
    (!a.rootCause || a.rootCause.trim().length < 20)
  );
  if (noRootCause.length > 0) {
    anomalies.push({
      id: 'h-005',
      category: 'Documentation Inconsistency',
      description: `${noRootCause.length} major NC${noRootCause.length > 1 ? 's' : ''} progressed past "Open" status without a documented root cause analysis. Root cause is mandatory for Major NCs.`,
      riskLevel: 'High',
      possibleCause: 'Workflow bypass, system validation gap, or root cause field left blank during submission.',
      investigationRequired: 'Return each affected CAR to "Open" and request compliant root cause analysis. Review system validation rules.',
      impact: 'Certification body may reject the corrective action. Systemic recurrence without addressing root cause.',
      affectedRecords: noRootCause.map(a => a.capId),
    });
  }

  /* 6. Recurring NC in same area (≥3 same standard clause) ────── */
  const stdMap = new Map<string, CorrectiveActionRecord[]>();
  actions.forEach(a => {
    if (!stdMap.has(a.standard)) stdMap.set(a.standard, []);
    stdMap.get(a.standard)!.push(a);
  });
  stdMap.forEach((recs, std) => {
    const majorsInStd = recs.filter(r => r.severity === 'Major NC');
    if (majorsInStd.length >= 3) {
      anomalies.push({
        id: `h-006-${std.replace(/\s/g, '')}`,
        category: 'Unusual Pattern',
        description: `${majorsInStd.length} major NCs recorded against ${std} — unusually high concentration suggesting a systemic management system failure rather than isolated incidents.`,
        riskLevel: 'High',
        possibleCause: 'Systemic weakness in the management system for this standard. Possible lack of senior management commitment or inadequate implementation.',
        investigationRequired: 'Conduct a root cause investigation at system level. Consider recommending a focused follow-up audit on the affected standard.',
        impact: 'Pattern of recurring major NCs may trigger enhanced oversight by the certification body.',
        affectedRecords: majorsInStd.map(a => a.capId),
      });
    }
  });

  /* 7. Rejected actions with no re-submission ─────────────────── */
  const rejectedStale = actions.filter(a => {
    if (a.status !== 'Rejected') return false;
    if (!a.decidedAt) return true;
    const age = (now.getTime() - new Date(a.decidedAt).getTime()) / 86400000;
    return age > 14;
  });
  if (rejectedStale.length > 0) {
    anomalies.push({
      id: 'h-007',
      category: 'Authorization Issue',
      description: `${rejectedStale.length} corrective action${rejectedStale.length > 1 ? 's were' : ' was'} rejected but not re-submitted within 14 days. Unresolved rejected CARs leave NCs open.`,
      riskLevel: 'High',
      possibleCause: 'Client unaware of rejection, poor notification system, or deliberate avoidance of re-submission.',
      investigationRequired: 'Contact client directly. Confirm rejection notification was received. Set a firm deadline for re-submission or escalate.',
      impact: 'NC remains open indefinitely. Certification decision delayed or negative recommendation at next review.',
      affectedRecords: rejectedStale.map(a => a.capId),
    });
  }

  /* 8. Audits with no associated corrective actions (schedule gap) */
  const completedAudits = schedules.filter((s: any) => s.status === 'Completed');
  const auditTitles     = new Set(actions.map(a => a.auditTitle));
  const auditsNoCARs    = completedAudits.filter((s: any) => !auditTitles.has(s.title) && !auditTitles.has(s.auditTitle));
  if (auditsNoCARs.length > 0) {
    anomalies.push({
      id: 'h-008',
      category: 'Missing Records',
      description: `${auditsNoCARs.length} completed audit${auditsNoCARs.length > 1 ? 's' : ''} have no associated corrective actions in the system. Either no findings were raised (verify) or records are missing.`,
      riskLevel: 'Medium',
      possibleCause: 'Audit findings not entered into the system, findings recorded on paper only, or audit completed with zero NCs (confirm with report).',
      investigationRequired: 'Retrieve audit reports for each affected audit. Verify whether findings were raised. If zero NCs confirmed, mark audit as clean in system.',
      impact: 'Audit trail incomplete. Certification body cannot verify compliance if findings are not traceable.',
      affectedRecords: auditsNoCARs.map((s: any) => s.title || s.id),
    });
  }

  /* 9. Expiring certificates with open major NCs ──────────────── */
  const expiringSoon = certs.filter((c: any) => {
    if (!c.expiryDate) return false;
    const days = (new Date(c.expiryDate).getTime() - now.getTime()) / 86400000;
    return days > 0 && days < 60;
  });
  if (expiringSoon.length > 0 && overdueMajors.length > 0) {
    anomalies.push({
      id: 'h-009',
      category: 'Timing Anomaly',
      description: `${expiringSoon.length} certificate${expiringSoon.length > 1 ? 's' : ''} expire within 60 days while open major NCs remain unresolved. Certification renewal is at risk.`,
      riskLevel: 'Critical',
      possibleCause: 'Poor planning, delayed corrective action implementation, or overlooked renewal timeline.',
      investigationRequired: 'Urgently coordinate with client and Lead Auditor. Initiate recertification audit planning immediately. Escalate to management.',
      impact: 'Certificate lapse results in loss of certification status, potential customer contract termination, and regulatory non-compliance.',
      affectedRecords: expiringSoon.map((c: any) => c.certificateNumber || c.id),
    });
  }

  /* 10. All good ──────────────────────────────────────────────── */
  if (anomalies.length === 0) {
    anomalies.push({
      id: 'h-clean',
      category: 'Clean Report',
      description: 'No anomalies detected in the current dataset. All corrective actions appear to be within normal parameters.',
      riskLevel: 'Low',
      possibleCause: 'N/A',
      investigationRequired: 'Continue routine monitoring. Schedule next anomaly scan after the next audit cycle.',
      impact: 'No immediate risk identified.',
    });
  }

  return anomalies;
}

/* ──────────────────────── Claude call ──────────────────────────── */
const SYSTEM = `You are a data analysis expert specializing in audit anomalies. Review the provided audit data and identify suspicious patterns.

Analyze for:
1. Unusual transaction patterns
2. Inconsistencies in documentation
3. Duplicate or missing records
4. Data entry errors or irregularities
5. Timing anomalies
6. Authorization issues
7. Amounts outside normal range
8. Unexplained changes or gaps

Return a JSON array of anomaly objects. Each object must have:
- id (string)
- category (string)
- description (string)
- riskLevel ("Critical"|"High"|"Medium"|"Low")
- possibleCause (string)
- investigationRequired (string)
- impact (string)
- affectedRecords (string array, may be empty)

Flag immediately if critical anomalies detected by placing them first.
Return ONLY the JSON array, no markdown fences, no other text.`;

async function callClaude(prompt: string, signal: AbortSignal): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('not_configured');
  let buf = '';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
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
      try { const d = JSON.parse(raw)?.delta?.text || ''; buf += d; } catch { /* */ }
    }
  }
  return buf;
}

function parseAnomalies(raw: string): Anomaly[] | null {
  try {
    const m = raw.match(/\[[\s\S]*\]/); if (!m) return null;
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr as Anomaly[];
  } catch { return null; }
}

/* ──────────────────────── Styles ───────────────────────────────── */
const GOLD = '#c9922a';
const BLUE = '#1d4ed8';
const RISK: Record<RiskLevel, { color: string; bg: string; border: string }> = {
  Critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.35)' },
  High:     { color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' },
  Medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  Low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)'  },
};
const RISK_ICON: Record<RiskLevel, React.ReactNode> = {
  Critical: <Zap size={13} />,
  High:     <AlertTriangle size={13} />,
  Medium:   <AlertCircle size={13} />,
  Low:      <Eye size={13} />,
};
const CATEGORY_ICON: Record<string, React.ReactNode> = {
  'Timing Anomaly':              <Clock size={15} />,
  'Duplicate Records':           <FileX size={15} />,
  'Missing Records':             <FileX size={15} />,
  'Documentation Inconsistency': <AlertCircle size={15} />,
  'Authorization Issue':         <ShieldAlert size={15} />,
  'Unusual Pattern':             <TrendingUp size={15} />,
  'Clean Report':                <Eye size={15} />,
};

const cardS: React.CSSProperties = { background: '#ffffff', border: '1px solid rgba(15,23,42,0.09)', borderRadius: 16, padding: 22, marginBottom: 18 };
const btnS = (c = BLUE, extra: React.CSSProperties = {}): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 9, border: 'none', background: c, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', ...extra });
const aiBadge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: 'rgba(201,146,42,0.15)', border: '1px solid rgba(201,146,42,0.4)', color: GOLD, fontSize: 11, fontWeight: 700 };

/* ──────────────────────── Component ────────────────────────────── */
const AnomalyDetection: React.FC = () => {
  const claude = isClaudeConfigured();
  const [anomalies, setAnomalies]   = useState<Anomaly[]>([]);
  const [busy, setBusy]             = useState(false);
  const [source, setSource]         = useState<'heuristic' | 'claude' | null>(null);
  const [expanded, setExpanded]     = useState<Record<string, boolean>>({});
  const [filterRisk, setFilterRisk] = useState<RiskLevel | 'All'>('All');
  const [copied, setCopied]         = useState(false);
  const [streamMsg, setStreamMsg]   = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const data = useMemo(() => readAllData(), []);

  /* ── Stats ── */
  const stats = useMemo(() => ({
    critical: anomalies.filter(a => a.riskLevel === 'Critical').length,
    high:     anomalies.filter(a => a.riskLevel === 'High').length,
    medium:   anomalies.filter(a => a.riskLevel === 'Medium').length,
    low:      anomalies.filter(a => a.riskLevel === 'Low').length,
  }), [anomalies]);

  const visible = useMemo(() =>
    filterRisk === 'All' ? anomalies : anomalies.filter(a => a.riskLevel === filterRisk),
    [anomalies, filterRisk]
  );

  /* ── Scan ── */
  const scan = async () => {
    if (busy) { abortRef.current?.abort(); setBusy(false); return; }
    setExpanded({});
    const heuristic = detectHeuristic(data);
    setAnomalies(heuristic); setSource('heuristic'); setStreamMsg('');

    // Auto-expand critical
    const autoExp: Record<string, boolean> = {};
    heuristic.forEach(a => { if (a.riskLevel === 'Critical') autoExp[a.id] = true; });
    setExpanded(autoExp);

    if (!claude) return;
    setBusy(true);
    abortRef.current = new AbortController();

    const { actions, schedules, certs } = data;
    const prompt = `Analyze this audit data for anomalies:

CORRECTIVE ACTIONS (${actions.length} total):
${JSON.stringify(actions.map(a => ({
  id: a.capId, client: a.clientName, severity: a.severity, status: a.status,
  standard: a.standard, dueDate: a.dueDate, submittedAt: a.submittedAt,
  decidedAt: a.decidedAt, rootCause: a.rootCause?.slice(0, 60),
  description: a.description.slice(0, 80),
})), null, 0)}

AUDIT SCHEDULES (${schedules.length} total):
${JSON.stringify(schedules.slice(0, 20).map((s: any) => ({ id: s.id, status: s.status, date: s.proposedDate || s.confirmedDate, type: s.auditType })), null, 0)}

CERTIFICATES (${certs.length} total):
${JSON.stringify(certs.slice(0, 20).map((c: any) => ({ id: c.id, expiry: c.expiryDate, status: c.status })), null, 0)}

Today: ${new Date().toISOString().slice(0, 10)}

Identify all anomalies. Place Critical ones first. Return JSON array only.`;

    try {
      setStreamMsg('Scanning with Claude AI…');
      const raw = await callClaude(prompt, abortRef.current.signal);
      const parsed = parseAnomalies(raw);
      if (parsed && parsed.length > 0) {
        setAnomalies(parsed); setSource('claude');
        const ce: Record<string, boolean> = {};
        parsed.forEach(a => { if (a.riskLevel === 'Critical') ce[a.id] = true; });
        setExpanded(ce);
      }
    } catch { /* keep heuristic */ }
    finally { setBusy(false); setStreamMsg(''); }
  };

  /* ── Copy ── */
  const copyReport = () => {
    const text = anomalies.map(a =>
      `[${a.riskLevel}] ${a.category}\n${a.description}\nCause: ${a.possibleCause}\nInvestigation: ${a.investigationRequired}\nImpact: ${a.impact}${a.affectedRecords?.length ? `\nRecords: ${a.affectedRecords.join(', ')}` : ''}`
    ).join('\n\n────────────────────────────────\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  /* ── Render ── */
  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto', fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#3b0000,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AlertTriangle size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f2547' }}>Anomaly Detection</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            {claude ? 'AI-powered pattern analysis — scans all audit data for suspicious irregularities' : 'Heuristic anomaly scanner — configure Claude API key for deep AI pattern analysis'}
          </p>
        </div>
      </div>

      {!claude && (
        <div style={{ background: 'rgba(201,146,42,0.07)', border: '1px solid rgba(201,146,42,0.25)', borderRadius: 9, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Info size={15} color={GOLD} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#0f2547', lineHeight: 1.5 }}>
            <strong style={{ color: GOLD }}>Heuristic mode</strong> — scans for 9 anomaly types across corrective actions, schedules, and certificates. Configure your Claude API key in <strong>AI Settings</strong> for deep AI pattern recognition.
          </p>
        </div>
      )}

      {/* Scan controls */}
      <div style={cardS}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: '#0f2547' }}>Data Sources</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: 'CARs', val: data.actions.length },
                { label: 'Schedules', val: data.schedules.length },
                { label: 'Certificates', val: data.certs.length },
                { label: 'Clients', val: data.clients.length },
              ].map(d => (
                <div key={d.label} style={{ background: '#eef4fb', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 8, padding: '6px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: BLUE }}>{d.val}</div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{d.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
            <button style={btnS(busy ? '#374151' : '#7f1d1d')} onClick={scan}>
              {busy
                ? <><Loader2 size={15} style={{ animation: 'ad-spin 1s linear infinite' }} />{claude ? ' Analyzing… (click to stop)' : ' Scanning…'}</>
                : <><Wand2 size={15} />{claude ? ' Deep Scan with Claude' : ' Run Anomaly Scan'}</>}
            </button>
            {anomalies.length > 0 && !busy && (
              <button style={{ ...btnS('transparent'), border: '1px solid rgba(15,23,42,0.14)', color: '#64748b', padding: '7px 14px', fontSize: 12 }} onClick={scan}>
                <RefreshCw size={13} /> Re-scan
              </button>
            )}
          </div>
        </div>
        {streamMsg && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={13} color={GOLD} style={{ animation: 'ad-spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 12, color: '#64748b' }}>{streamMsg}</span>
          </div>
        )}
      </div>

      {/* Stats + filter bar */}
      {anomalies.length > 0 && (
        <div style={{ ...cardS, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
              {(['All', 'Critical', 'High', 'Medium', 'Low'] as const).map(r => {
                const count = r === 'All' ? anomalies.length : stats[r.toLowerCase() as keyof typeof stats];
                const active = filterRisk === r;
                const col = r === 'All' ? BLUE : RISK[r as RiskLevel]?.color || BLUE;
                return (
                  <button key={r} onClick={() => setFilterRisk(r)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 999, border: `1px solid ${active ? col : 'rgba(15,23,42,0.12)'}`, background: active ? `${col}22` : 'transparent', color: active ? col : '#64748b', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    {r !== 'All' && RISK_ICON[r as RiskLevel]} {r} {count > 0 && <span style={{ background: col, color: '#fff', borderRadius: 999, padding: '0 5px', fontSize: 10 }}>{count}</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {source === 'claude'    && <span style={aiBadge}><Sparkles size={10} /> Claude AI</span>}
              {source === 'heuristic' && <span style={{ ...aiBadge, background: 'rgba(100,116,139,0.12)', borderColor: 'rgba(100,116,139,0.3)', color: '#64748b' }}>Heuristic</span>}
              <button style={{ ...btnS('#eef2f7'), padding: '6px 12px', fontSize: 12, border: '1px solid rgba(15,23,42,0.12)' }} onClick={copyReport}>
                <Copy size={12} />{copied ? ' Copied!' : ' Copy Report'}
              </button>
            </div>
          </div>
          {stats.critical > 0 && (
            <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 9, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={14} color="#ef4444" />
              <span style={{ fontSize: 12, color: '#fca5a5', fontWeight: 700 }}>
                {stats.critical} CRITICAL anomaly{stats.critical > 1 ? 'ies' : ''} detected — immediate investigation required
              </span>
            </div>
          )}
        </div>
      )}

      {/* Anomaly cards */}
      {visible.map(anomaly => {
        const r = RISK[anomaly.riskLevel];
        const isExp = expanded[anomaly.id];
        const catIcon = CATEGORY_ICON[anomaly.category] || <AlertCircle size={15} />;
        return (
          <div key={anomaly.id} style={{ ...cardS, borderColor: r.border, borderWidth: anomaly.riskLevel === 'Critical' ? 2 : 1 }}>
            <button style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left' }}
              onClick={() => setExpanded(p => ({ ...p, [anomaly.id]: !isExp }))}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: r.bg, border: `1px solid ${r.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: r.color }}>
                {catIcon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 999, color: r.color, background: r.bg, border: `1px solid ${r.border}` }}>
                    {RISK_ICON[anomaly.riskLevel]} {anomaly.riskLevel}
                  </span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{anomaly.category}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#334155', lineHeight: 1.5 }}>{anomaly.description}</p>
              </div>
              {isExp ? <ChevronUp size={16} color="#64748b" style={{ flexShrink: 0, marginTop: 4 }} /> : <ChevronDown size={16} color="#64748b" style={{ flexShrink: 0, marginTop: 4 }} />}
            </button>

            {isExp && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(15,23,42,0.07)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { label: 'Possible Cause',          icon: '🔍', text: anomaly.possibleCause },
                  { label: 'Investigation Required',  icon: '📋', text: anomaly.investigationRequired },
                  { label: 'Impact if Unresolved',    icon: '⚠️', text: anomaly.impact },
                ].map(field => (
                  <div key={field.label} style={{ background: '#eef4fb', borderRadius: 9, padding: '12px 14px', gridColumn: field.label === 'Investigation Required' ? 'span 2' : undefined }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{field.icon} {field.label}</div>
                    <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.55 }}>{field.text}</p>
                  </div>
                ))}
                {anomaly.affectedRecords && anomaly.affectedRecords.length > 0 && (
                  <div style={{ gridColumn: 'span 2', background: '#eef4fb', borderRadius: 9, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>📎 Affected Records</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {anomaly.affectedRecords.map(r => (
                        <span key={r} style={{ fontSize: 11, fontFamily: 'monospace', background: 'rgba(29,78,216,0.15)', border: '1px solid rgba(29,78,216,0.3)', color: '#93c5fd', padding: '2px 8px', borderRadius: 6 }}>{r}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <style>{`@keyframes ad-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
};

export default AnomalyDetection;
