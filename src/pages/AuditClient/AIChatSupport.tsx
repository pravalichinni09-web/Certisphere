/**
 * AIChatSupport — AI chatbot for Auditees to ask audit / compliance questions.
 * Uses Claude with full conversation history when a key is configured;
 * falls back to a keyword-matched FAQ engine when not.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle, Send, Sparkles, Bot, User,
  RefreshCw, Info,
} from 'lucide-react';
import { isClaudeConfigured, getApiKey, getModel } from '../../ai/claudeClient';

/* ─── Types ──────────────────────────────────────────────────────── */
interface Msg {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  source?: 'claude' | 'faq';
}

/* ─── FAQ fallback engine ────────────────────────────────────────── */
const FAQ: Array<{ keys: string[]; answer: string; followUp: string }> = [
  {
    keys: ['stage 1', 'stage1', 'document review', 'first stage'],
    answer: 'Stage 1 is the document review audit where the lead auditor assesses your quality manual, procedures, and key records to ensure readiness for Stage 2. It typically takes 1–2 days and is done remotely or on-site.',
    followUp: 'Would you like tips on which documents to prepare for Stage 1?',
  },
  {
    keys: ['stage 2', 'stage2', 'on-site', 'onsite', 'second stage'],
    answer: 'Stage 2 is the on-site audit where auditors verify implementation of your management system against the standard. They will interview staff, observe processes, and check records. Ensure all teams are briefed beforehand.',
    followUp: 'Shall I explain what happens after Stage 2 findings are raised?',
  },
  {
    keys: ['non-conformance', 'nonconformance', 'nc', 'finding', 'major', 'minor'],
    answer: 'Non-conformances (NCs) are gaps between your system and the standard. Major NCs indicate a system failure and must be closed before certification is granted. Minor NCs must be addressed within an agreed timeframe — typically 90 days.',
    followUp: 'Would you like guidance on writing an effective corrective action plan?',
  },
  {
    keys: ['corrective action', 'cap', 'root cause', '5 why', 'five why'],
    answer: 'A corrective action plan should include: (1) containment to stop the issue recurring immediately, (2) a 5-Why root cause analysis, (3) the corrective action taken, and (4) evidence of effectiveness. Submit all of this through the CertiSphere portal.',
    followUp: 'Want me to walk you through a 5-Why example for a common finding?',
  },
  {
    keys: ['document', 'documentation', 'record', 'procedure', 'manual'],
    answer: 'Core documents typically required include: quality manual, scope of certification, documented procedures (e.g. internal audit, management review, corrective action), and objective evidence records. The exact list depends on your standard.',
    followUp: 'Which standard are you certifying against? I can give you a more specific list.',
  },
  {
    keys: ['timeline', 'how long', 'duration', 'time', 'schedule', 'when'],
    answer: 'A typical initial certification takes 3–6 months: application review (1–2 weeks), Stage 1 audit, gap closure (2–4 weeks), Stage 2 audit, finding closure (2–6 weeks), then certificate issuance. Your coordinator will confirm exact dates.',
    followUp: 'Would you like tips on how to speed up your certification timeline?',
  },
  {
    keys: ['surveillance', 'renewal', 'recertification', 'annual'],
    answer: 'Surveillance audits happen annually to maintain your certificate. A full recertification audit occurs every 3 years. Missing a surveillance window can result in certificate suspension, so plan ahead and keep your system current.',
    followUp: 'Shall I explain what is checked during a surveillance audit?',
  },
  {
    keys: ['iso 9001', 'quality management', 'quality'],
    answer: 'ISO 9001:2015 is the world\'s most recognised quality management system standard. It requires you to demonstrate customer focus, leadership commitment, risk-based thinking, and continual improvement across your processes.',
    followUp: 'Would you like to know the most common ISO 9001 audit findings to avoid?',
  },
  {
    keys: ['iso 14001', 'environmental', 'environment'],
    answer: 'ISO 14001:2015 focuses on your environmental management system — identifying environmental aspects, setting objectives, ensuring legal compliance, and continually improving your environmental performance.',
    followUp: 'Shall I explain which environmental records auditors look for most often?',
  },
  {
    keys: ['iso 45001', 'health and safety', 'safety', 'ohs', 'occupational'],
    answer: 'ISO 45001:2018 covers occupational health and safety. Key areas include hazard identification, risk assessment, worker participation, legal compliance, and incident investigation. Auditors will look for a strong safety culture throughout.',
    followUp: 'Would you like tips on the most common OH&S audit findings?',
  },
  {
    keys: ['iso 27001', 'information security', 'cybersecurity', 'data'],
    answer: 'ISO 27001:2022 requires an Information Security Management System (ISMS) covering risk assessment, access controls, incident management, and business continuity. Auditors will test both technical controls and staff awareness.',
    followUp: 'Would you like guidance on preparing your Statement of Applicability?',
  },
  {
    keys: ['pass', 'tips', 'prepare', 'preparation', 'best practice', 'advice'],
    answer: 'Top tips for passing your audit: (1) conduct an internal audit beforehand, (2) brief all staff on scope and their role, (3) ensure documents are current and controlled, (4) have objective evidence ready for every process, (5) treat auditors as partners not inspectors.',
    followUp: 'Would you like more detail on running an effective internal pre-audit?',
  },
  {
    keys: ['coordinator', 'contact', 'help', 'support', 'who'],
    answer: 'Your Audit Coordinator manages all scheduling, documentation dispatch, and coordination between you and the audit team. For urgent queries, reach out directly via the CertiSphere portal or the email address in your schedule confirmation.',
    followUp: 'Is there anything specific about the process I can clarify for you?',
  },
  {
    keys: ['certisphere', 'portal', 'platform', 'system', 'how to use'],
    answer: 'CertiSphere is your certification management portal. Use it to: view your audit workflow status, approve schedules, submit corrective actions with evidence, upload supporting documents, and track your certificate expiry.',
    followUp: 'Would you like a walkthrough of any specific section of the portal?',
  },
  {
    keys: ['internal audit', 'self-assessment', 'readiness'],
    answer: 'An internal audit before your certification audit is highly recommended. It should cover all clauses of your standard, be conducted by someone independent of the area being audited, and produce a report with identified gaps and actions.',
    followUp: 'Shall I suggest a checklist for your internal audit preparation?',
  },
];

function faqAnswer(input: string): string {
  const q = input.toLowerCase();
  const match = FAQ.find(f => f.keys.some(k => q.includes(k)));
  if (match) return `${match.answer}\n\n💡 *${match.followUp}*`;
  return "That's a great question. For the most accurate answer specific to your certification, I'd recommend reaching out to your Audit Coordinator directly through the CertiSphere portal. They can provide guidance tailored to your audit scope and timeline.\n\n💡 *Is there anything else about the audit process I can help clarify?*";
}

/* ─── Suggested questions ────────────────────────────────────────── */
const SUGGESTIONS = [
  'What documents do I need for Stage 1?',
  'How long does certification take?',
  'What is a major non-conformance?',
  'How do I write a corrective action plan?',
  'Tips for passing my audit',
  'What happens at a surveillance audit?',
];

/* ─── Claude multi-turn call ─────────────────────────────────────── */
const SYSTEM = `You are a helpful audit support chatbot for certification clients. Answer questions about:
- Audit process and timeline
- Required documentation
- Compliance requirements
- Common non-conformities
- Best practices for passing audits

Keep responses:
- Clear and concise (max 3-4 sentences)
- Professional but friendly
- Action-oriented
- Include a brief follow-up suggestion at the end

If you don't know the answer, suggest contacting their audit coordinator.`;

async function askClaude(
  messages: Msg[],
  signal: AbortSignal
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('not_configured');
  const body = {
    model: getModel(),
    max_tokens: 512,
    temperature: 0.5,
    system: SYSTEM,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Claude error ${res.status}`);
  const json = await res.json();
  return (json?.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const GOLD = '#c9922a', BLUE = '#1d4ed8';

const wrap: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)',
  maxHeight: 820, maxWidth: 800, margin: '0 auto',
  fontFamily: "'Inter',system-ui,sans-serif",
  padding: '20px 24px 0',
};

/* ═══════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
const AIChatSupport: React.FC = () => {
  const claude = isClaudeConfigured();
  const [msgs, setMsgs]     = useState<Msg[]>([]);
  const [input, setInput]   = useState('');
  const [busy, setBusy]     = useState(false);
  const [showSugg, setShowSugg] = useState(true);
  const abortRef            = useRef<AbortController | null>(null);
  const bottomRef           = useRef<HTMLDivElement>(null);
  const inputRef            = useRef<HTMLTextAreaElement>(null);

  /* Auto-scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, busy]);

  /* Greeting on mount */
  useEffect(() => {
    setMsgs([{
      role: 'assistant',
      content: "Hello! I'm your **AI Audit Support Assistant**. I can help you with questions about the audit process, required documentation, compliance requirements, and best practices.\n\nWhat would you like to know?",
      ts: Date.now(),
      source: claude ? 'claude' : 'faq',
    }]);
  }, []);

  /* Send message */
  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    setShowSugg(false);

    const userMsg: Msg = { role: 'user', content: q, ts: Date.now() };
    setMsgs(prev => [...prev, userMsg]);
    setBusy(true);

    if (claude) {
      abortRef.current = new AbortController();
      try {
        const history: Msg[] = [...msgs, userMsg].filter(m => m.role === 'user' || m.role === 'assistant');
        const reply = await askClaude(history, abortRef.current.signal);
        setMsgs(prev => [...prev, { role: 'assistant', content: reply, ts: Date.now(), source: 'claude' }]);
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          /* user cancelled */
        } else {
          // fallback to FAQ on Claude failure
          const reply = faqAnswer(q);
          setMsgs(prev => [...prev, { role: 'assistant', content: reply, ts: Date.now(), source: 'faq' }]);
        }
      }
    } else {
      // Simulate slight delay for UX
      await new Promise(r => setTimeout(r, 420));
      const reply = faqAnswer(q);
      setMsgs(prev => [...prev, { role: 'assistant', content: reply, ts: Date.now(), source: 'faq' }]);
    }
    setBusy(false);
    inputRef.current?.focus();
  }, [busy, msgs, claude]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const reset = () => {
    abortRef.current?.abort();
    setBusy(false);
    setShowSugg(true);
    setMsgs([{
      role: 'assistant',
      content: "Conversation cleared. How can I help you today?",
      ts: Date.now(),
      source: claude ? 'claude' : 'faq',
    }]);
  };

  /* Render markdown-lite: **bold**, *italic*, newlines, bullet • */
  const renderMd = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, li) => {
      // Replace **bold** and *italic*
      const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
      const nodes = parts.map((p, pi) => {
        if (p.startsWith('**') && p.endsWith('**'))
          return <strong key={pi} style={{ color: '#0f2547' }}>{p.slice(2, -2)}</strong>;
        if (p.startsWith('*') && p.endsWith('*'))
          return <em key={pi}>{p.slice(1, -1)}</em>;
        return <span key={pi}>{p}</span>;
      });
      return <p key={li} style={{ margin: '0 0 4px' }}>{nodes}</p>;
    });
  };

  return (
    <div style={wrap}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <MessageCircle size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#0f2547' }}>AI Audit Support</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            {claude ? 'Powered by Claude AI · Conversational audit advisor' : 'Smart FAQ mode · Configure Claude API key for full AI responses'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {claude && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: 'rgba(201,146,42,0.15)', border: '1px solid rgba(201,146,42,0.4)', color: GOLD, fontSize: 11, fontWeight: 700 }}>
              <Sparkles size={10} /> Claude AI
            </span>
          )}
          <button onClick={reset} title="New conversation"
            style={{ background: 'rgba(15,23,42,0.07)', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, padding: '6px 10px', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <RefreshCw size={13} /> New chat
          </button>
        </div>
      </div>

      {/* No-key notice */}
      {!claude && (
        <div style={{ background: 'rgba(201,146,42,0.07)', border: '1px solid rgba(201,146,42,0.25)', borderRadius: 9, padding: '9px 14px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <Info size={15} color={GOLD} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#0f2547', lineHeight: 1.5 }}>
            <strong style={{ color: GOLD }}>FAQ mode</strong> — instant answers from a built-in knowledge base. Configure your Claude API key in <strong>AI Settings</strong> for live conversational AI.
          </p>
        </div>
      )}

      {/* Chat messages */}
      <div style={{
        flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12,
        padding: '4px 2px 16px',
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(15,23,42,0.09) transparent',
      }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: m.role === 'assistant' ? 'linear-gradient(135deg,#7c3aed,#1d4ed8)' : 'linear-gradient(135deg,#0f2547,#1d4ed8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {m.role === 'assistant' ? <Bot size={16} color="#fff" /> : <User size={16} color="#fff" />}
            </div>

            {/* Bubble */}
            <div style={{
              maxWidth: '74%',
              background: m.role === 'assistant' ? '#ffffff' : '#1d4ed8',
              border: m.role === 'assistant' ? '1px solid rgba(15,23,42,0.09)' : 'none',
              borderRadius: m.role === 'assistant' ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
              padding: '12px 16px',
              color: '#334155',
              fontSize: 13.5,
              lineHeight: 1.65,
              position: 'relative',
            }}>
              {renderMd(m.content)}
              {/* Source badge */}
              {m.role === 'assistant' && m.source && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, paddingTop: 7, borderTop: '1px solid rgba(15,23,42,0.08)' }}>
                  {m.source === 'claude'
                    ? <><Sparkles size={10} color={GOLD} /><span style={{ fontSize: 10, color: GOLD, fontWeight: 600 }}>Claude AI</span></>
                    : <><Bot size={10} color="#64748b" /><span style={{ fontSize: 10, color: '#64748b' }}>Smart FAQ</span></>
                  }
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#475569' }}>
                    {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {busy && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={16} color="#fff" />
            </div>
            <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.09)', borderRadius: '16px 16px 16px 4px', padding: '14px 18px' }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 1, 2].map(d => (
                  <div key={d} style={{
                    width: 7, height: 7, borderRadius: '50%', background: GOLD,
                    animation: `chat-dot 1.2s ${d * 0.2}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Suggested questions — only shown at start */}
        {showSugg && msgs.length <= 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => send(s)}
                style={{ background: 'rgba(29,78,216,0.12)', border: '1px solid rgba(29,78,216,0.3)', borderRadius: 20, padding: '6px 14px', color: '#93c5fd', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(29,78,216,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(29,78,216,0.12)')}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ flexShrink: 0, paddingBottom: 20, paddingTop: 8, borderTop: '1px solid rgba(15,23,42,0.08)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about audit process, documentation, compliance..."
            rows={2}
            style={{
              flex: 1, padding: '11px 14px', background: '#f8fafc',
              border: '1.5px solid rgba(15,23,42,0.14)', borderRadius: 12,
              color: '#0f2547', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none',
              transition: 'border-color .15s', lineHeight: 1.5,
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(29,78,216,0.6)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(15,23,42,0.14)')}
          />
          <button
            onClick={() => busy ? (abortRef.current?.abort(), setBusy(false)) : send(input)}
            disabled={!busy && !input.trim()}
            style={{
              width: 44, height: 44, borderRadius: 12, border: 'none', flexShrink: 0,
              background: busy ? '#374151' : (input.trim() ? BLUE : 'rgba(29,78,216,0.3)'),
              color: '#fff', cursor: busy || input.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .15s',
            }}
          >
            {busy ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(15,23,42,0.28)', borderTopColor: '#fff', animation: 'chat-spin 0.7s linear infinite' }} />
                  : <Send size={17} />}
          </button>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#475569', textAlign: 'center' }}>
          Press Enter to send · Shift+Enter for new line · {claude ? 'Full conversation context sent to Claude' : 'FAQ mode — no data sent externally'}
        </p>
      </div>

      <style>{`
        @keyframes chat-dot  { 0%,80%,100%{transform:scale(0.6);opacity:.4} 40%{transform:scale(1);opacity:1} }
        @keyframes chat-spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
};

export default AIChatSupport;
