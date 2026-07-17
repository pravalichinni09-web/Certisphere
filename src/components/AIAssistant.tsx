import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { ragAnswer, ragAnswerWithClaude } from '../ai/models';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Send,
  User,
  ArrowRight,
  Trash2,
  MessageCircle,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-react';
import QcsaiMark from './QcsaiMark';
import {
  ask,
  suggestionsForRole,
  AssistantBlock,
  AssistantResponse,
} from '../ai/aiAssistantEngine';
import {
  isClaudeConfigured,
  complete as claudeComplete,
  onClaudeConfigChange,
} from '../ai/claudeClient';
import AISettings from './AISettings';
import { useDraggable } from '../hooks/useDraggable';
import '../styles/AIAssistant.css';

interface AIAssistantProps {
  role: string;
}

interface ChatMessage {
  id: number;
  type: 'user' | 'assistant';
  text?: string;
  response?: AssistantResponse;
}

const STORAGE_KEY = 'cms_ai_chat_history';

const AIAssistant: React.FC<AIAssistantProps> = ({ role }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [pulse, setPulse] = useState(true);

  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<number>(1);

  const [showSettings, setShowSettings] = useState(false);
  const [claudeReady, setClaudeReady] = useState<boolean>(isClaudeConfigured());

  // Draggable FAB + panel — user can grab and move either to any
  // position on the viewport; position is persisted to localStorage.
  const fabDrag = useDraggable({
    storageKey: 'cms_ai_fab_pos',
    width: 230,
    height: 56,
    onClick: () => setOpen(true),
  });
  const panelDrag = useDraggable({
    storageKey: 'cms_ai_panel_pos',
    width: 400,
    height: 600,
  });

  useEffect(() => {
    return onClaudeConfigChange(() => setClaudeReady(isClaudeConfigured()));
  }, []);

  // Greet on first open per session
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          idRef.current = (parsed[parsed.length - 1]?.id ?? 0) + 1;
          return;
        }
      }
    } catch {
      /* ignore */
    }
    // Build greeting
    const isGuest = !role || role === 'Guest' || role === 'Visitor';
    const greeting: AssistantResponse = {
      blocks: [
        {
          kind: 'text',
          text: `Hi! I'm **QCSAI** — I can help with the CMS, ISO standards, audits, and any general question you have.`,
        },
        {
          kind: 'text',
          text: isGuest
            ? `You're not signed in yet, but feel free to ask me anything. Sign in to unlock role-specific features.`
            : `You're signed in as **${role}**. Try one of the suggestions below or ask me anything.`,
        },
      ],
      suggestions: isGuest
        ? [
            'What is ISO 9001?',
            'Explain the audit lifecycle',
            'How do I sign in?',
            'What can this app do?',
          ]
        : suggestionsForRole(role),
    };
    setMessages([
      {
        id: 0,
        type: 'assistant',
        response: greeting,
      },
    ]);
    idRef.current = 1;
  }, [role]);

  // Persist within the session
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, thinking, open]);

  // Stop pulse after first open
  useEffect(() => {
    if (open) setPulse(false);
  }, [open]);

  // Focus the input when opening
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  /** Detect slash-style commands the assistant routes through Claude. */
  const parseClaudeCommand = (text: string): {
    command: 'draft-ncr' | 'summarize' | 'explain' | 'ask';
    body: string;
    system: string;
  } | null => {
    const t = text.trim();
    if (/^\/rag\b/i.test(t)) {
      return {
        command: 'ask',
        body: t.replace(/^\/rag\b\s*/i, '').trim(),
        system: '__RAG__',
      };
    }
    if (/^\/draft-ncr\b/i.test(t)) {
      return {
        command: 'draft-ncr',
        body: t.replace(/^\/draft-ncr\b\s*/i, '').trim(),
        system:
          'You are an experienced ISO management-system auditor drafting a non-conformity report. ' +
          'Given a brief observation, produce a clear, neutral NCR with: (1) Statement of fact, ' +
          '(2) Requirement reference (clause / standard if obvious), (3) Evidence cited, (4) Severity (Major/Minor/Observation) with a short reason. ' +
          'Use plain language. Do not invent evidence that was not provided.',
      };
    }
    if (/^\/summarize\b/i.test(t)) {
      return {
        command: 'summarize',
        body: t.replace(/^\/summarize\b\s*/i, '').trim(),
        system:
          'You summarize audit reports for a busy reviewer. Produce: ' +
          '(1) One-line headline, (2) 3-5 bullet key findings (Major/Minor/OFI labels), ' +
          '(3) Top recommended next actions. Be concise.',
      };
    }
    if (/^\/explain\b/i.test(t)) {
      return {
        command: 'explain',
        body: t.replace(/^\/explain\b\s*/i, '').trim(),
        system:
          'You explain ISO checklist questions and management-system concepts to certification professionals. ' +
          'Be specific, cite the standard clause when known, and give a small example.',
      };
    }
    if (/^\/ask\b/i.test(t)) {
      return {
        command: 'ask',
        body: t.replace(/^\/ask\b\s*/i, '').trim(),
        system:
          'You assist with a Certification Management System. The user is a ' + role + '. ' +
          'Be concise and accurate. If uncertain, say so.',
      };
    }
    return null;
  };

  const submit = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const userMsg: ChatMessage = {
      id: idRef.current++,
      type: 'user',
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setThinking(true);

    const cmd = parseClaudeCommand(text);

    // /rag — retrieval-augmented answer over the live knowledge base.
    // Works without Claude (grounded heuristic answer); upgrades when configured.
    if (cmd && cmd.system === '__RAG__') {
      const question = cmd.body || 'summarize recent findings';
      const finish = (r: { answer: string; sources: Array<{ title: string; kind: string; similarity: number }>; generator: string }) => {
        const src = r.sources.length
          ? '\n\n**Sources:**\n' + r.sources.map((x, i) => `${i + 1}. ${x.title} _(${x.kind}, sim ${x.similarity})_`).join('\n')
          : '';
        const resp: AssistantResponse = {
          blocks: [{ kind: 'text', text: `${r.answer}${src}\n\n_Generator: ${r.generator}_` }],
          suggestions: ['/rag how were calibration issues resolved?', '/rag which clauses fail most often?'],
        };
        setMessages((prev) => [...prev, { id: idRef.current++, type: 'assistant', response: resp }]);
        setThinking(false);
      };
      ragAnswerWithClaude(question).then(finish).catch(() => finish(ragAnswer(question)));
      return;
    }

    // Slash command routes through Claude (if configured), else hint the user to set a key.
    if (cmd) {
      if (!claudeReady) {
        const fallback: AssistantResponse = {
          blocks: [
            {
              kind: 'text',
              text:
                'That command needs Claude. Click the **⚙ settings** button above the chat to add an Anthropic API key, then try again.',
            },
          ],
          suggestions: ['/ ', '/explain ISO 9001 clause 8.1', '/summarize the last audit'],
        };
        setMessages((prev) => [
          ...prev,
          { id: idRef.current++, type: 'assistant', response: fallback },
        ]);
        setThinking(false);
        return;
      }
      if (!cmd.body) {
        const ask: AssistantResponse = {
          blocks: [
            {
              kind: 'text',
              text:
                'Add a description after the command. Example: `/draft-ncr Operator could not show the latest internal audit plan during a Q3 audit at Site B`.',
            },
          ],
        };
        setMessages((prev) => [
          ...prev,
          { id: idRef.current++, type: 'assistant', response: ask },
        ]);
        setThinking(false);
        return;
      }
      claudeComplete(cmd.body, { system: cmd.system, maxTokens: 900, temperature: 0.5 })
        .then((reply) => {
          const resp: AssistantResponse = {
            blocks: [{ kind: 'text', text: reply }],
            suggestions:
              cmd.command === 'draft-ncr'
                ? ['/summarize this NCR', '/explain the cited clause']
                : cmd.command === 'summarize'
                ? ['/draft-ncr from the top finding']
                : undefined,
          };
          setMessages((prev) => [
            ...prev,
            { id: idRef.current++, type: 'assistant', response: resp },
          ]);
        })
        .catch((e: Error) => {
          const errResp: AssistantResponse = {
            blocks: [
              {
                kind: 'text',
                text: '**Claude couldn\'t complete that.** ' + (e?.message || 'Unknown error'),
              },
            ],
          };
          setMessages((prev) => [
            ...prev,
            { id: idRef.current++, type: 'assistant', response: errResp },
          ]);
        })
        .finally(() => setThinking(false));
      return;
    }

    // Free-form question handling.
    // Strategy: try the rule-based engine first (fast, deterministic, deep-linked navigation).
    // If the engine can't answer with confidence AND Claude is configured, route to Claude
    // with a general-purpose system prompt so the assistant can answer ANY question.
    const ruleResponse = ask(text, {
      role,
      navigate: (p: string) => {
        navigate(p);
        setOpen(false);
      },
    });

    const ruleHandled = isRuleHandled(ruleResponse);

    if (ruleHandled || !claudeReady) {
      window.setTimeout(() => {
        // The rule engine now always returns a useful response (CertMS knowledge,
        // smart fallback, or topic-shaped guidance). No need to nag about Claude.
        setMessages((prev) => [
          ...prev,
          { id: idRef.current++, type: 'assistant', response: ruleResponse },
        ]);
        setThinking(false);
      }, 250);
      return;
    }

    // Claude is configured and the rule engine had no confident answer — go general-purpose.
    const generalSystem =
      'You are QCSAI (Qmics Certification & Standards AI), a friendly and capable assistant. ' +
      'You help users with the Certification Management System (CMS), ISO standards (9001, 14001, 45001, 27001, 42001), ' +
      'audits, and certification workflows. You can ALSO answer general-knowledge questions on any topic ' +
      '(science, history, math, coding, language, etc.) — be helpful, concise, and accurate. ' +
      'The user is currently a ' + (role || 'guest') + '. ' +
      'If a question is about the app and you do not know the specific answer, say so honestly and suggest where the user might look.';

    claudeComplete(text, { system: generalSystem, maxTokens: 900, temperature: 0.6 })
      .then((reply) => {
        const resp: AssistantResponse = {
          blocks: [{ kind: 'text', text: reply }],
        };
        setMessages((prev) => [
          ...prev,
          { id: idRef.current++, type: 'assistant', response: resp },
        ]);
      })
      .catch((e: Error) => {
        // If Claude fails, fall back to whatever the rule engine produced.
        const errResp: AssistantResponse = {
          blocks: [
            ...(ruleResponse.blocks || []),
            {
              kind: 'text',
              text:
                '_Claude couldn\'t complete that — ' + (e?.message || 'unknown error') + '. Showing my best answer above._',
            },
          ],
          suggestions: ruleResponse.suggestions,
        };
        setMessages((prev) => [
          ...prev,
          { id: idRef.current++, type: 'assistant', response: errResp },
        ]);
      })
      .finally(() => setThinking(false));
  };

  // Heuristic: did the rule-based engine produce a confident answer?
  // We treat short generic "I'm not sure" responses as unhandled.
  const isRuleHandled = (r: AssistantResponse): boolean => {
    const blocks = r.blocks || [];
    if (blocks.length === 0) return false;
    // If the engine returned navigation, KPIs, cards, or lists — it knew the answer.
    if (blocks.some((b) => b.kind !== 'text')) return true;
    const combined = blocks
      .map((b) => (b.kind === 'text' ? b.text || '' : ''))
      .join(' ')
      .toLowerCase();
    const fallbackSignals = [
      "i'm not sure",
      "i am not sure",
      "i don't know",
      "i do not know",
      "i couldn't find",
      "i could not find",
      "no matching",
      "didn't catch that",
      "did not catch that",
      "not sure i understand",
      "don't have a built-in answer",
      "do not have a built-in answer",
      "i am here to help with",
    ];
    return !fallbackSignals.some((s) => combined.includes(s));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  };

  const handleClear = () => {
    if (!window.confirm('Clear the assistant chat history?')) return;
    sessionStorage.removeItem(STORAGE_KEY);
    const greeting: AssistantResponse = {
      blocks: [
        {
          kind: 'text',
          text: `Chat cleared. How can I help you, ${role}? — _QCSAI_`,
        },
      ],
      suggestions: suggestionsForRole(role),
    };
    idRef.current = 1;
    setMessages([{ id: 0, type: 'assistant', response: greeting }]);
  };

  const renderBlock = (block: AssistantBlock, key: number) => {
    switch (block.kind) {
      case 'text':
        return (
          <p
            key={key}
            className="ai-block-text"
            dangerouslySetInnerHTML={{ __html: formatText(block.text || '') }}
          />
        );
      case 'list':
        return (
          <ul key={key} className="ai-block-list">
            {(block.items || []).map((item, i) => (
              <li
                key={i}
                dangerouslySetInnerHTML={{ __html: formatText(item) }}
              />
            ))}
          </ul>
        );
      case 'cards':
        return (
          <div key={key} className="ai-block-cards">
            {(block.cards || []).map((c, i) => (
              <div className="ai-card" key={i}>
                <div className="ai-card-title">{c.title}</div>
                {c.subtitle && <div className="ai-card-subtitle">{c.subtitle}</div>}
                {c.meta && <div className="ai-card-meta">{c.meta}</div>}
              </div>
            ))}
          </div>
        );
      case 'kpi':
        return (
          <div key={key} className="ai-block-kpis">
            {(block.kpis || []).map((k, i) => (
              <div className="ai-kpi" key={i}>
                <div className="ai-kpi-value">{k.value}</div>
                <div className="ai-kpi-label">{k.label}</div>
              </div>
            ))}
          </div>
        );
      case 'navigate':
        return (
          <div key={key} className="ai-block-nav">
            {(block.nav || []).map((n, i) => (
              <button
                key={i}
                className="ai-nav-btn"
                onClick={() => {
                  navigate(n.path);
                  setOpen(false);
                }}
              >
                <ArrowRight size={14} />
                <span>{n.label}</span>
              </button>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Floating Action Button — draggable */}
      {!open && (
        <button
          data-draggable-root
          className={`ai-fab ${pulse ? 'pulse' : ''} ${fabDrag.isDragging ? 'is-dragging' : ''}`}
          onPointerDown={fabDrag.onPointerDown}
          style={
            fabDrag.position
              ? {
                  left: fabDrag.position.x,
                  top:  fabDrag.position.y,
                  right: 'auto',
                  bottom: 'auto',
                  cursor: fabDrag.isDragging ? 'grabbing' : 'grab',
                  touchAction: 'none',
                }
              : { cursor: fabDrag.isDragging ? 'grabbing' : 'grab', touchAction: 'none' }
          }
          title="Drag to move · click to open QCSAI"
          aria-label="Open QCSAI"
        >
          <span className="ai-fab-badge"><QcsaiMark size={22} /></span>
          <span className="ai-fab-label">QCSAI</span>
        </button>
      )}

      {/* Chat Panel — header is the drag handle */}
      {open && (
        <div
          data-draggable-root
          className={`ai-panel ${panelDrag.isDragging ? 'is-dragging' : ''}`}
          role="dialog"
          aria-label="QCSAI"
          style={
            panelDrag.position
              ? {
                  left: panelDrag.position.x,
                  top:  panelDrag.position.y,
                  right: 'auto',
                  bottom: 'auto',
                }
              : undefined
          }
        >
          <div
            className="ai-panel-header"
            onPointerDown={panelDrag.onPointerDown}
            style={{ cursor: panelDrag.isDragging ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}
          >
            <div className="ai-panel-title">
              <div className="ai-panel-icon">
                <QcsaiMark size={24} />
              </div>
              <div>
                <div className="ai-panel-name">QCSAI</div>
                <div className="ai-panel-status">
                  <span className={`ai-status-dot ${claudeReady ? 'is-claude' : ''}`} />
                  {claudeReady ? `Claude connected · ${role}` : `Online for ${role}`}
                </div>
              </div>
            </div>
            <div className="ai-panel-actions">
              <button
                className={`ai-icon-btn ${claudeReady ? 'is-connected' : ''}`}
                onClick={() => setShowSettings(true)}
                title={claudeReady ? 'Claude is connected · open AI settings' : 'Connect Claude (BYO key)'}
                aria-label="AI settings"
              >
                {claudeReady ? <Sparkles size={16} /> : <SettingsIcon size={16} />}
              </button>
              <button
                className="ai-icon-btn"
                onClick={handleClear}
                title="Clear chat"
              >
                <Trash2 size={16} />
              </button>
              <button
                className="ai-icon-btn"
                onClick={() => setOpen(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="ai-thread" ref={threadRef}>
            {messages.map((m) => (
              <div key={m.id} className={`ai-msg ai-msg-${m.type}`}>
                <div className="ai-avatar">
                  {m.type === 'user' ? <User size={14} /> : <QcsaiMark size={18} style={{ color: '#1f6bbf' }} />}
                </div>
                <div className="ai-bubble">
                  {m.type === 'user' ? (
                    <p className="ai-block-text">{m.text}</p>
                  ) : (
                    <>
                      {(m.response?.blocks || []).map((b, i) =>
                        renderBlock(b, i)
                      )}
                      {m.response?.suggestions && m.response.suggestions.length > 0 && (
                        <div className="ai-suggestions">
                          {m.response.suggestions.map((s, i) => (
                            <button
                              key={i}
                              className="ai-chip"
                              onClick={() => submit(s)}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="ai-msg ai-msg-assistant">
                <div className="ai-avatar">
                  <QcsaiMark size={18} style={{ color: '#1f6bbf' }} />
                </div>
                <div className="ai-bubble">
                  <div className="ai-typing">
                    <span /> <span /> <span />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="ai-input-row">
            <MessageCircle size={16} className="ai-input-icon" />
            <input
              ref={inputRef}
              className="ai-input"
              type="text"
              placeholder="Ask QCSAI anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="ai-send-btn"
              onClick={() => submit(input)}
              disabled={!input.trim()}
              title="Send"
            >
              <Send size={16} />
            </button>
          </div>
          <div className="ai-footer-hint">
            Press <kbd>Enter</kbd> to send. {claudeReady
              ? <>Ask anything — CMS, ISO, or general knowledge. Slash: <kbd>/rag</kbd>, <kbd>/draft-ncr</kbd>, <kbd>/summarize</kbd>, <kbd>/explain</kbd>.</>
              : <>Connect Claude (⚙) to answer general questions on any topic.</>}
          </div>
        </div>
      )}

      {showSettings && (
        <div className="ai-settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="ai-settings-stage" onClick={(e) => e.stopPropagation()}>
            <AISettings onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}
    </>
  );
};

// Tiny markdown-ish formatter — bold (**x**) and inline code (`x`).
function formatText(s: string): string {
  const escaped = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br />');
}

export default AIAssistant;
