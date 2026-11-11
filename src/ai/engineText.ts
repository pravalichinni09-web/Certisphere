/**
 * engineText — QCSAI's built-in answer as plain markdown text, so other AI
 * chat screens (Auditee AI Chat Support, Auditor Audit Assistant) can use the
 * same workflow-aware knowledge when no API key is configured.
 */
import { ask } from './aiAssistantEngine';

export const builtInAnswer = (question: string, role: string): string | null => {
  try {
    const r = ask(question, { role } as Parameters<typeof ask>[1]);
    if (r.fallback) return null;
    const text = r.blocks.map((b) => {
      if (b.kind === 'text') return b.text || '';
      if (b.kind === 'list') return (b.items || []).map((i) => `• ${i}`).join('\n');
      if (b.kind === 'cards') return (b.cards || []).map((c) => `• **${c.title}**${c.subtitle ? ` — ${c.subtitle}` : ''}${c.meta ? ` (${c.meta})` : ''}`).join('\n');
      if (b.kind === 'kpi') return (b.kpis || []).map((k) => `• ${k.label}: **${k.value}**`).join('\n');
      if (b.kind === 'navigate') return (b.nav || []).map((n) => `→ Open **${n.label}** from the sidebar.`).join('\n');
      return '';
    }).filter(Boolean).join('\n\n');
    if (!text || /don't have a built-in answer/i.test(text)) return null;
    return text;
  } catch { return null; }
};
