/**
 * AIAssist — small AI building blocks used across CertiSphere screens
 * ----------------------------------------------------------------------
 *  <AISuggestionBox>   built-in suggestion (tone, headline, points, 1-click apply)
 *                      + "Ask Claude" when an API key is configured
 *  <CaQualityBadge>    live quality score for a corrective action
 *  <RoleAIInsights>    "AI insights" card for a role dashboard
 * Everything works without an API key (built-in rules over real data).
 */
import React, { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle, CheckCircle2, Info, XCircle, Bot, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isClaudeConfigured, completeSafe, onClaudeConfigChange } from '../ai/claudeClient';
import { reviewCorrectiveAction, roleInsights, claudePrompt, type Suggestion, type Insight } from '../ai/workflowAI';

const TONE: Record<string, { bg: string; bd: string; fg: string; Icon: LucideIcon }> = {
  ok:   { bg: '#ecfdf5', bd: '#a7f3d0', fg: '#065f46', Icon: CheckCircle2 },
  warn: { bg: '#fffbeb', bd: '#fde68a', fg: '#92400e', Icon: AlertTriangle },
  bad:  { bg: '#fff1f2', bd: '#fecdd3', fg: '#9f1239', Icon: XCircle },
  info: { bg: '#eef2ff', bd: '#c7d2fe', fg: '#3730a3', Icon: Info },
};

/** **bold** and *italic* only. */
const md = (s: string): React.ReactNode =>
  s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((p, i) =>
    p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith('*') && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em> : <React.Fragment key={i}>{p}</React.Fragment>);

const useClaude = () => {
  const [on, setOn] = useState(isClaudeConfigured());
  useEffect(() => onClaudeConfigChange(() => setOn(isClaudeConfigured())), []);
  return on;
};

const ClaudeMore: React.FC<{ ask: string; facts: string[] }> = ({ ask, facts }) => {
  const claude = useClaude();
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  if (!claude) return null;
  const go = async () => {
    setBusy(true); setOut(null);
    const r = await completeSafe(claudePrompt(ask, facts), { maxTokens: 500, temperature: 0.3 });
    setBusy(false);
    setOut(r.ok ? r.text : `Claude could not answer: ${r.error}`);
  };
  return (
    <div style={{ marginTop: 6 }}>
      <button type="button" onClick={() => void go()} disabled={busy}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, padding: '4px 9px', borderRadius: 7, border: '1px solid #c4b5fd', background: '#f5f3ff', color: '#5b21b6', cursor: 'pointer' }}>
        <Bot size={12} /> {busy ? 'Asking Claude…' : 'Ask Claude for more'}
      </button>
      {out && <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, marginTop: 6, color: '#1e1b4b' }}>{out}</div>}
    </div>
  );
};

export const AISuggestionBox: React.FC<{ s: Suggestion | null; onApply?: (values: Record<string, string>) => void; claudeAsk?: string; testId?: string }> = ({ s, onApply, claudeAsk, testId }) => {
  if (!s) return null;
  const t = TONE[s.tone] || TONE.info;
  return (
    <div data-testid={testId || 'ai-suggestion'} style={{ border: `1px solid ${t.bd}`, background: t.bg, color: t.fg, borderRadius: 9, padding: '8px 10px', fontSize: 12.5, display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <Sparkles size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 800, letterSpacing: '.03em', fontSize: 10.5, textTransform: 'uppercase', marginRight: 6 }}>AI suggestion</span>
          {md(s.headline)}
        </div>
        {s.apply && onApply && (
          <button type="button" onClick={() => onApply(s.apply!.values)}
            style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, padding: '4px 9px', borderRadius: 7, border: `1px solid ${t.fg}`, background: '#fff', color: t.fg, cursor: 'pointer' }}>
            {s.apply.label}
          </button>
        )}
      </div>
      {s.points.length > 0 && (
        <ul style={{ margin: '0 0 0 20px', padding: 0, display: 'grid', gap: 2, color: '#334155' }}>
          {s.points.map((p, i) => <li key={i}>{md(p)}</li>)}
        </ul>
      )}
      {claudeAsk && <ClaudeMore ask={claudeAsk} facts={[s.headline, ...s.points].map((x) => x.replace(/\*/g, ''))} />}
    </div>
  );
};

export const CaQualityBadge: React.FC<{ text?: string; severity?: string; showTips?: boolean }> = ({ text, severity, showTips }) => {
  const r = reviewCorrectiveAction(text, severity);
  const col = r.verdict === 'good' ? '#047857' : r.verdict === 'weak' ? '#b45309' : '#be123c';
  return (
    <span style={{ display: 'inline-grid', gap: 2, fontSize: 11.5, color: col }}>
      <span><Sparkles size={11} style={{ verticalAlign: '-1px' }} /> <strong>AI quality {r.score}%</strong> · {r.verdict === 'good' ? 'complete' : r.verdict === 'weak' ? 'needs detail' : 'missing'}</span>
      {showTips && r.tips.length > 0 && r.verdict !== 'good' && <span style={{ color: '#475569' }}>{md(r.tips.slice(0, 3).join(' '))}</span>}
    </span>
  );
};

export const RoleAIInsights: React.FC<{ role: string }> = ({ role }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Insight[]>(() => roleInsights(role));
  useEffect(() => {
    const r = () => setItems(roleInsights(role));
    const ev = ['storage', 'cms-workflow-handoff', 'audit-workflow-updated', 'cms-data-changed'];
    ev.forEach((e) => window.addEventListener(e, r));
    const t = window.setInterval(r, 60000);
    return () => { ev.forEach((e) => window.removeEventListener(e, r)); window.clearInterval(t); };
  }, [role]);
  return (
    <section data-testid="role-ai-insights" aria-label="AI insights" style={{ background: '#fff', border: '1px solid #ddd6fe', borderRadius: 12, padding: '12px 14px', margin: '0 0 16px', color: '#0f172a', boxShadow: '0 1px 3px rgba(15,23,42,.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: '#fff' }}><Sparkles size={15} /></span>
        <strong style={{ fontSize: 14 }}>AI insights</strong>
        <span style={{ fontSize: 11.5, color: '#64748b' }}>from your live workflow · {role}</span>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {items.map((it, i) => {
          const t = TONE[it.tone] || TONE.info;
          return (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, padding: '6px 9px', borderRadius: 8, background: t.bg, color: t.fg, border: `1px solid ${t.bd}` }}>
              <t.Icon size={14} />
              <span style={{ flex: 1, color: '#1e293b' }}>{md(it.text)}</span>
              {it.path && <button type="button" onClick={() => navigate(it.path!)} style={{ fontSize: 11.5, fontWeight: 700, border: 'none', background: 'transparent', color: t.fg, cursor: 'pointer', whiteSpace: 'nowrap' }}>Open →</button>}
            </div>
          );
        })}
      </div>
      <ClaudeMore ask={`Give the ${role} a short prioritised plan for today.`} facts={items.map((i) => i.text.replace(/\*/g, ''))} />
    </section>
  );
};
