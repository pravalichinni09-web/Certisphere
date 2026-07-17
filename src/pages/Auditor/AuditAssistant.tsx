/**
 * AuditAssistant — real-time AI guide for Auditors during audit execution.
 * Multi-turn Claude chat with full history. Falls back to a 15-topic
 * auditor-specific FAQ engine when no API key is configured.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare, Send, Sparkles, Bot, User,
  RefreshCw, Info, Mic, Loader2,
} from 'lucide-react';
import { isClaudeConfigured, getApiKey, getModel } from '../../ai/claudeClient';
import { loadCorrectiveActions } from '../../services/correctiveActions';

/* ─── Types ──────────────────────────────────────────────────────── */
interface Msg {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  source?: 'claude' | 'faq';
}

/* ─── Auditor FAQ engine ─────────────────────────────────────────── */
const FAQ: Array<{ keys: string[]; answer: string; followUp: string }> = [
  {
    keys: ['major nc', 'major nonconformance', 'major non-conformance', 'major finding', 'classify', 'classification'],
    answer: `**Major Non-Conformance:** A systematic or significant failure to meet a standard requirement that impacts the integrity of the management system or poses a serious risk to certification.

Classify as Major when:
• A required element of the standard is completely absent
• A systemic failure affects multiple processes or sites
• A critical procedure exists but is not implemented
• A previous Major NC has recurred
• There is evidence of falsification or deliberate non-compliance

Document it with: clause reference, objective evidence found, extent of the non-conformance, and why it is classified as Major.`,
    followUp: 'Would you like help drafting the non-conformance statement?',
  },
  {
    keys: ['minor nc', 'minor nonconformance', 'minor non-conformance', 'ofi', 'opportunity for improvement'],
    answer: `**Minor NC vs OFI:**

**Minor NC** — An isolated lapse that does not represent a systemic failure. The element of the standard is substantially met but a specific requirement has not been fully implemented.
Examples: one record missing from an otherwise complete set, a procedure slightly out of date.

**OFI (Opportunity for Improvement)** — A situation where the organisation meets requirements but could perform better. Not a non-conformance — advisory only.
Examples: suggesting a more efficient process, recommending proactive monitoring.

Rule of thumb: If you can point to a specific clause requirement that is not met, it is at least a Minor NC.`,
    followUp: 'Want guidance on how to write the NC statement clearly?',
  },
  {
    keys: ['nc statement', 'write finding', 'document finding', 'record finding', 'nc wording'],
    answer: `**Writing a Strong NC Statement:**

A well-written NC has three parts:
1. **Requirement** — what the standard requires (cite the clause)
2. **Objective Evidence** — what you found (specific facts, records, people, dates)
3. **Non-conformance** — why it fails to meet the requirement

Example:
> *"ISO 9001:2015 Clause 7.2 requires the organisation to retain documented information as evidence of competence. During review of the engineering department, training records for 3 of 8 operators on CNC Machine Line 4 were not available. This is a non-conformance against Clause 7.2."*

Avoid vague language like "training needs improvement." Be specific and factual.`,
    followUp: 'Shall I help you draft a specific NC statement from your findings?',
  },
  {
    keys: ['evidence', 'acceptable evidence', 'objective evidence', 'what evidence', 'evidence for'],
    answer: `**Acceptable Audit Evidence:**

Objective evidence must be verifiable. Acceptable types include:
• **Records** — logs, registers, certificates, training records, meeting minutes
• **Documents** — procedures, policies, work instructions (check revision and date)
• **Physical inspection** — direct observation of process, equipment, workplace
• **Interviews** — staff knowledge checks (note who you spoke to and what was said)
• **System outputs** — reports, dashboards, data exports
• **Photos** — where physical condition is part of the finding

**Not acceptable:** Verbal assurances without corroborating records, future plans, or promises.

Rate evidence quality: Does it directly demonstrate the requirement is met? Is it current? Is it representative?`,
    followUp: 'Need help evaluating whether specific evidence is sufficient?',
  },
  {
    keys: ['sampling', 'sample', 'how many', 'how much to check', 'sampling strategy'],
    answer: `**Audit Sampling Strategy:**

Sampling must be sufficient to give confidence in your conclusions. General principles:
• **Risk-based sampling** — allocate more samples to high-risk processes
• **Representative sampling** — cover different shifts, teams, time periods, products
• **Minimum samples:** For records, audit at least 5–10 or 10% of the population (whichever is larger)
• **If a sample reveals an NC** — expand the sample to determine the extent
• **Document your sampling** — note sample size, basis for selection, and what you found

For ISO 9001 in a 50-person organisation, typically sample 3–5 processes in depth, check 5+ records per process, and interview 8–12 staff.`,
    followUp: 'Want a sampling plan recommendation for a specific process or organisation size?',
  },
  {
    keys: ['opening meeting', 'opening', 'start audit', 'begin audit', 'first meeting'],
    answer: `**Opening Meeting — Key Points to Cover:**

1. Introduce the audit team and confirm roles
2. Confirm the audit scope, objectives, and criteria
3. Explain the audit process and schedule for the day
4. Confirm confidentiality — findings are between client and CB
5. Explain the NC classification system (Major / Minor / OFI)
6. Confirm availability of guides and key personnel
7. Explain the closing meeting process
8. Ask: Any changes since the last audit? New processes, sites, products?
9. Request any outstanding documents not yet reviewed
10. Invite questions from the auditee

Keep it to 20–30 minutes. Set a professional but collaborative tone.`,
    followUp: 'Would you like a checklist for the closing meeting too?',
  },
  {
    keys: ['closing meeting', 'closing', 'end audit', 'summary meeting', 'present findings'],
    answer: `**Closing Meeting — Key Points:**

1. Thank the team for their cooperation and availability
2. Summarise audit scope and what was covered
3. Present findings clearly: Critical → Major → Minor → OFI
4. For each finding: read the clause, state the evidence, confirm the NC classification
5. Give the auditee opportunity to respond — note any factual corrections
6. Explain the corrective action process and deadlines
7. State the overall audit outcome / recommendation (if authorised to do so)
8. Confirm next steps: report timeline, CAR due dates, next audit window
9. Invite final questions
10. Close professionally

Tip: Never surprise the auditee in the closing meeting. Raise potential findings informally as you go.`,
    followUp: 'Need help summarising your findings for the closing meeting?',
  },
  {
    keys: ['root cause', '5 why', 'five why', 'fishbone', 'root cause analysis', 'rca'],
    answer: `**Root Cause Analysis — Guidance for Auditors:**

When reviewing a client's corrective action, verify the root cause analysis is genuine:

**5-Why Method:** Ask "why" 5 times to drill to the systemic cause.
- Finding: Calibration cert expired
- Why? → Not renewed on time
- Why? → Reminder not set
- Why? → Tracking done manually on spreadsheet
- Why? → No CMMS system in place
- Root cause: No systematic calibration management tool

**Red flags in submitted root causes:**
• "Human error" with no further analysis (too shallow)
• Root cause is the same as the symptom
• "Operator forgot" without addressing why the system allowed it
• No evidence the root cause was actually eliminated

The corrective action must address the root cause, not just the symptom.`,
    followUp: 'Want help evaluating a specific corrective action submission?',
  },
  {
    keys: ['audit report', 'write report', 'report writing', 'document audit', 'audit documentation'],
    answer: `**Audit Report — Required Sections:**

1. **Cover page** — client, standard, audit type, dates, audit team
2. **Executive summary** — outcome, overall compliance, key themes
3. **Audit scope and objectives** — confirmed scope, what was covered
4. **Methodology** — sampling approach, techniques used
5. **Findings summary table** — count of Major / Minor / OFI
6. **Detailed findings** — each NC with clause, evidence, classification
7. **Positive observations** — good practices noted
8. **Recommendations** — corrective action requirements and timelines
9. **Conclusion** — certification recommendation
10. **Signatures** — auditor, date, distribution

Issue the report within 5 working days of the audit. Ensure all findings are clearly cross-referenced to the audit evidence.`,
    followUp: 'Would you like a template for a specific section of the report?',
  },
  {
    keys: ['auditee disagrees', 'dispute', 'challenge', 'auditee objects', 'pushback', 'disagrees'],
    answer: `**Handling Auditee Disagreement with Findings:**

1. **Listen first** — allow the auditee to fully explain their position
2. **Remain calm and objective** — refer only to the standard and objective evidence
3. **Ask for additional evidence** — "Do you have a record that would demonstrate this requirement is met?"
4. **If evidence is produced and valid** — withdraw or downgrade the finding (document the reason)
5. **If you maintain the finding** — explain clearly why the evidence provided is insufficient
6. **Never argue** — state facts, reference the clause, cite what was observed
7. **Escalate if needed** — refer unresolved disputes to the Lead Auditor
8. **Document all disputes** — note in the audit report that the finding was contested and your rationale for maintaining it

Remember: the auditee has a formal appeals process after the report is issued.`,
    followUp: 'Need help responding to a specific objection?',
  },
  {
    keys: ['iso 9001 clause', '9001', 'clause 4', 'clause 5', 'clause 6', 'clause 7', 'clause 8', 'clause 9', 'clause 10'],
    answer: `**ISO 9001:2015 — Key Clause Structure:**

• **4** — Context (internal/external issues, interested parties, scope, processes)
• **5** — Leadership (commitment, policy, roles & responsibilities)
• **6** — Planning (risks & opportunities, objectives, change planning)
• **7** — Support (resources, competence, awareness, communication, documented info)
• **8** — Operation (planning, customer requirements, design, supplier control, production, NC output)
• **9** — Performance evaluation (monitoring, customer satisfaction, internal audit, management review)
• **10** — Improvement (NC & corrective action, continual improvement)

The most commonly raised NCs: Clause 7.2 (competence records), 8.4 (supplier control), 8.7 (nonconforming outputs), 9.2 (internal audit), 10.2 (corrective action quality).`,
    followUp: 'Which clause are you currently auditing? I can give detailed guidance.',
  },
  {
    keys: ['supplier', 'supplier audit', 'external provider', '8.4', 'supply chain', 'procurement'],
    answer: `**Auditing External Providers (Clause 8.4):**

Key areas to verify:
• **Approved supplier list** — is it current and maintained?
• **Supplier selection criteria** — how are new suppliers evaluated?
• **Supplier performance monitoring** — regular reviews, KPIs, or quality records
• **Supplier-specific controls** — purchase orders with quality requirements, incoming inspection
• **Critical supplier risk** — single-source suppliers, overseas suppliers, high-risk materials
• **Records** — delivery notes, inspection results, supplier corrective actions

Common NCs: no documented evaluation process, approved list not updated after supplier performance issues, no incoming inspection for critical components.`,
    followUp: 'Want a checklist of questions to ask in a supplier control process audit?',
  },
  {
    keys: ['internal audit', 'internal auditor', '9.2', 'audit programme', 'audit plan'],
    answer: `**Assessing Internal Audit Effectiveness (Clause 9.2):**

Verify:
• Internal audit **programme** is documented and covers all processes and clauses
• **Frequency** is risk-based — higher risk processes audited more frequently
• **Auditor competence** — internal auditors are trained and independent of areas they audit
• **Audit reports** are produced and findings are tracked
• **Corrective actions** from internal audits are raised and closed
• **Management review** receives internal audit results

Red flags: Internal audits always find zero NCs (suggests superficial auditing), same person auditing their own process, audits scheduled but reports missing, no linkage between internal audit findings and the corrective action system.`,
    followUp: 'Need help evaluating the quality of an internal audit programme?',
  },
  {
    keys: ['management review', '9.3', 'top management', 'management commitment'],
    answer: `**Management Review (Clause 9.3):**

Verify the review covers all required inputs:
• Status of actions from previous reviews
• External/internal issues changes
• QMS performance data (customer satisfaction, process KPIs, NC trends, audit results)
• Resource adequacy
• Risk and opportunity status
• Opportunities for improvement

Outputs must include: decisions on improvement opportunities, resource needs, and QMS changes.

Common NCs: Management review minutes too brief or generic, inputs missing (e.g. no customer satisfaction data discussed), no evidence of decisions made, held less frequently than required.`,
    followUp: 'Want guidance on what management review records to request?',
  },
  {
    keys: ['hi', 'hello', 'help', 'start', 'what can you do', 'how can you help', 'guide'],
    answer: `Hello! I'm your Real-time Audit Assistant. I can help you with:

🔍 **NC Classification** — Major / Minor / OFI guidance
📝 **Finding Documentation** — writing clear NC statements
🔎 **Evidence Assessment** — what counts as acceptable evidence
📋 **Audit Procedures** — opening/closing meetings, sampling, reporting
⚖️ **Standards Guidance** — ISO 9001, 14001, 45001, 27001 clause interpretation
🤝 **Auditee Disputes** — how to handle pushback professionally
📊 **Root Cause Analysis** — evaluating corrective action quality

Just ask your question — I'll give you practical, standards-based guidance.`,
    followUp: 'What are you working on in today\'s audit?',
  },
];

function faqAnswer(input: string): { answer: string; followUp: string } | null {
  const q = input.toLowerCase();
  for (const f of FAQ) {
    if (f.keys.some(k => q.includes(k))) {
      return { answer: f.answer, followUp: f.followUp };
    }
  }
  return null;
}

/* ─── Claude API ─────────────────────────────────────────────────── */
const safe = (k: string) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; } };

function buildSystemPrompt(): string {
  const actions = loadCorrectiveActions();
  const schedules = [...(Array.isArray(safe('cms_audit_schedules')) ? safe('cms_audit_schedules') : []),
                     ...(Array.isArray(safe('cms_audit_schedules_v3')) ? safe('cms_audit_schedules_v3') : [])];
  const openMajors = actions.filter(a => a.severity === 'Major NC' && a.status !== 'Approved').length;
  const activeAudit = schedules.find((s: any) => s.status === 'In Progress' || s.status === 'Confirmed');
  
  return `You are an expert audit guide assisting auditors during audit execution. Provide guidance on complex audit procedures.

When auditors ask about:
- Audit procedures: Explain step-by-step approach
- Non-conformities: Suggest classification and documentation
- Evidence: Guide on what evidence is acceptable
- Standards: Clarify requirements from ISO/regulatory standards
- Documentation: Guide on proper documentation
- Risk assessment: Help evaluate audit findings

Provide:
- Clear, practical guidance
- References to relevant standards (cite specific clauses where relevant)
- Examples if helpful
- Next steps recommendation

Keep responses focused and actionable. Use markdown formatting for clarity (bold, bullet points, headers where appropriate).

Current audit context:
- Active audit: ${activeAudit ? `${activeAudit.standard || ''} ${activeAudit.auditType || ''} for ${activeAudit.clientName || ''}` : 'Not specified'}
- Open major NCs in system: ${openMajors}
- Total CARs in system: ${actions.length}`;
}

async function askClaude(messages: Msg[], signal: AbortSignal): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('not_configured');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: getModel(), max_tokens: 1200, temperature: 0.4,
      system: buildSystemPrompt(),
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

/* ─── Markdown renderer (lightweight) ───────────────────────────── */
function renderMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3} (.+)$/gm, '<div style="font-weight:800;margin:10px 0 4px;color:#f1f5f9">$1</div>')
    .replace(/^• (.+)$/gm, '<div style="padding-left:14px;margin:2px 0">• $1</div>')
    .replace(/^- (.+)$/gm, '<div style="padding-left:14px;margin:2px 0">• $1</div>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const GOLD = '#c9922a', BLUE = '#1d4ed8';
const aiBadge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 999, background: 'rgba(201,146,42,0.15)', border: '1px solid rgba(201,146,42,0.4)', color: GOLD, fontSize: 10, fontWeight: 700 };

const SUGGESTED = [
  'How do I classify this as Major or Minor NC?',
  'Write a finding statement for missing training records',
  'What evidence is acceptable for corrective action closure?',
  'How should I handle an auditee disputing a finding?',
  'What do I check for ISO 9001 Clause 8.4 (supplier control)?',
  'Guide me through the closing meeting',
];

/* ═══════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
const AuditAssistant: React.FC = () => {
  const claude = isClaudeConfigured();
  const [msgs, setMsgs]         = useState<Msg[]>([]);
  const [input, setInput]       = useState('');
  const [typing, setTyping]     = useState(false);
  const [showSugg, setShowSugg] = useState(true);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const abortRef                = useRef<AbortController | null>(null);
  const inputRef                = useRef<HTMLTextAreaElement>(null);

  /* Greeting on mount */
  useEffect(() => {
    setMsgs([{
      role: 'assistant', ts: Date.now(), source: 'faq',
      content: `Hello! I'm your **Real-time Audit Assistant** — here to help you throughout today's audit.\n\nAsk me anything about:\n• NC classification and statement writing\n• Evidence requirements and evaluation\n• ISO/regulatory clause interpretation\n• Handling auditee disputes\n• Sampling strategy and audit procedures\n• Report writing and documentation${claude ? '\n\n✨ *Claude AI is active — I can handle complex, context-specific questions.*' : '\n\n💡 *Configure your Claude API key in AI Settings for advanced, context-aware guidance.*'}`,
    }]);
  }, [claude]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, typing]);

  const send = useCallback(async (text = input.trim()) => {
    if (!text || typing) return;
    setInput(''); setShowSugg(false);

    const userMsg: Msg = { role: 'user', content: text, ts: Date.now() };
    setMsgs(p => [...p, userMsg]);
    setTyping(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      if (claude) {
        const history = [...msgs, userMsg];
        const reply = await askClaude(history, abortRef.current.signal);
        setMsgs(p => [...p, { role: 'assistant', content: reply, ts: Date.now(), source: 'claude' }]);
      } else {
        await new Promise(r => setTimeout(r, 600));
        const faq = faqAnswer(text);
        const answer = faq
          ? `${faq.answer}\n\n💡 *${faq.followUp}*`
          : `I don't have a specific FAQ answer for that query. For precise guidance on complex audit situations, configure your Claude API key in **AI Settings** — Claude can handle detailed, context-specific questions.\n\nIn the meantime, try asking about: NC classification, evidence requirements, finding statement writing, ISO clause interpretation, or handling auditee disputes.`;
        setMsgs(p => [...p, { role: 'assistant', content: answer, ts: Date.now(), source: 'faq' }]);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      const faq = faqAnswer(text);
      const fallback = faq
        ? `${faq.answer}\n\n💡 *${faq.followUp}*`
        : 'I encountered an issue reaching Claude. Please check your API key in AI Settings or try again.';
      setMsgs(p => [...p, { role: 'assistant', content: fallback, ts: Date.now(), source: 'faq' }]);
    } finally {
      setTyping(false);
    }
  }, [input, typing, msgs, claude]);

  const reset = () => {
    abortRef.current?.abort();
    setMsgs([]);
    setInput('');
    setTyping(false);
    setShowSugg(true);
    setTimeout(() => {
      setMsgs([{
        role: 'assistant', ts: Date.now(), source: 'faq',
        content: 'Conversation cleared. Ask me anything about your current audit.',
      }]);
    }, 50);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  /* ── Render ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', maxWidth: 860, margin: '0 auto', padding: '0 16px 16px', fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0 12px', flexShrink: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#0f2547,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <MessageSquare size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: '#f1f5f9' }}>Real-time Audit Assistant</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            {claude ? 'Claude AI — standards-based, context-aware audit guidance' : 'Audit FAQ engine — configure Claude API key for full AI guidance'}
          </p>
        </div>
        <button title="Clear conversation" onClick={reset}
          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '7px 10px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <RefreshCw size={13} /> Clear
        </button>
      </div>

      {!claude && (
        <div style={{ background: 'rgba(201,146,42,0.07)', border: '1px solid rgba(201,146,42,0.25)', borderRadius: 9, padding: '9px 13px', marginBottom: 10, display: 'flex', gap: 9, alignItems: 'center', flexShrink: 0 }}>
          <Info size={14} color={GOLD} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 11.5, color: '#f1f5f9', lineHeight: 1.5 }}>
            <strong style={{ color: GOLD }}>FAQ mode</strong> — 15 auditor topics covered. Configure Claude API key in <strong>AI Settings</strong> for intelligent, clause-level guidance on any audit scenario.
          </p>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 4 }}>
        {msgs.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }}>
              {/* Avatar */}
              <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isUser ? BLUE : m.source === 'claude' ? 'linear-gradient(135deg,#7c3aed,#1d4ed8)' : '#1e293b',
                border: isUser ? 'none' : '1px solid rgba(255,255,255,0.08)' }}>
                {isUser ? <User size={16} color="#fff" /> : m.source === 'claude' ? <Sparkles size={16} color="#fbbf24" /> : <Bot size={16} color="#94a3b8" />}
              </div>
              {/* Bubble */}
              <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                {!isUser && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {m.source === 'claude' && <span style={aiBadge}><Sparkles size={9} /> Claude</span>}
                    {m.source === 'faq' && <span style={{ ...aiBadge, background: 'rgba(100,116,139,0.12)', borderColor: 'rgba(100,116,139,0.3)', color: '#64748b' }}><Bot size={9} /> Audit FAQ</span>}
                  </div>
                )}
                <div style={{
                  padding: '12px 15px', borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                  background: isUser ? BLUE : '#0d1929',
                  border: isUser ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  fontSize: 13.5, color: '#e2e8f0', lineHeight: 1.65,
                }}>
                  {isUser
                    ? m.content
                    : <span dangerouslySetInnerHTML={{ __html: renderMd(m.content) }} />}
                </div>
                <span style={{ fontSize: 10, color: '#334155' }}>
                  {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typing && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={16} color="#fbbf24" />
            </div>
            <div style={{ background: '#0d1929', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px 14px 14px 14px', padding: '14px 18px' }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: GOLD, animation: `aa-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {showSugg && msgs.length <= 1 && (
        <div style={{ padding: '10px 0 8px', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 7, fontWeight: 600 }}>Suggested questions</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SUGGESTED.map(q => (
              <button key={q} onClick={() => send(q)}
                style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)', background: '#0d1929', color: '#94a3b8', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = GOLD; (e.currentTarget as HTMLElement).style.color = '#f1f5f9'; }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', paddingTop: 10, flexShrink: 0 }}>
        <div style={{ flex: 1, background: '#0d1929', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'flex-end', gap: 8, transition: 'border-color 0.15s' }}
          onFocus={() => {}} onClick={() => inputRef.current?.focus()}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
            placeholder="Ask about NC classification, evidence, standards, procedures…"
            rows={1} style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', color: '#f1f5f9', fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }} />
          <Mic size={16} color="#334155" style={{ flexShrink: 0, marginBottom: 2 }} />
        </div>
        <button onClick={() => send()}
          disabled={!input.trim() || typing}
          style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: input.trim() && !typing ? BLUE : '#1e293b', cursor: input.trim() && !typing ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.2s' }}>
          {typing
            ? <Loader2 size={18} color="#475569" style={{ animation: 'aa-spin 1s linear infinite' }} />
            : <Send size={18} color={input.trim() ? '#fff' : '#475569'} />}
        </button>
      </div>
      <div style={{ textAlign: 'center', fontSize: 10, color: '#1e293b', marginTop: 5, flexShrink: 0 }}>
        Enter to send · Shift+Enter for new line
      </div>

      <style>{`
        @keyframes aa-dot  { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
        @keyframes aa-spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
};


export default AuditAssistant;
