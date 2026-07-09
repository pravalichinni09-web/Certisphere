import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, AlertTriangle, Copy, Check } from 'lucide-react';
import { getCertifications, getBranches } from './scope';
import { useRealtimeScope } from './useRealtimeScope';
import { LiveBar } from './LiveBar';
import AIPanel from '../../components/AIPanel';
import { buildComplianceCalendar, calendarClaudePrompt } from '../../ai/clientCoordinatorInsights';
import { onCmsChange, claudeComplete, isClaudeConfigured } from '../../ai/liveData';

const tag = (expiry: string) => {
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: 'Overdue', icon: '🔴', bg: '#fee2e2', fg: '#b91c1c', days };
  if (days <= 30) return { label: 'Due Soon', icon: '🟡', bg: '#fef3c7', fg: '#a16207', days };
  if (days <= 90) return { label: 'Upcoming', icon: '🟠', bg: '#ffedd5', fg: '#c2410c', days };
  return { label: 'Safe', icon: '🟢', bg: '#dcfce7', fg: '#15803d', days };
};

const DueDates: React.FC = () => {
  const { data: certs, refresh, lastUpdated, isLive } = useRealtimeScope(getCertifications);
  const { data: branches } = useRealtimeScope(getBranches);
  const [br, setBr] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // ---- Compliance Calendar Copilot (AI) -----------------------------------
  const [aiTick, setAiTick] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [aiCalText, setAiCalText] = useState<string | null>(null);
  const [aiCalBusy, setAiCalBusy] = useState(false);
  const [aiCalErr, setAiCalErr] = useState<string | null>(null);

  useEffect(() => onCmsChange(() => setAiTick((t) => t + 1)), []);

  const calendar = useMemo(() => {
    void aiTick;
    const branchNameOf = (id?: number) => branches.find(b => b.id === id)?.name || 'Head Office';
    return buildComplianceCalendar(certs, branchNameOf);
  }, [certs, branches, aiTick]);

  const copyNudge = (id: string, text: string) => {
    const done = () => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 1600);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => done());
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
      done();
    }
  };

  const enhanceCalendar = async () => {
    if (aiCalBusy) return;
    setAiCalBusy(true);
    setAiCalErr(null);
    const res = await claudeComplete(calendarClaudePrompt(calendar.windows, calendar.reminders), { maxTokens: 400 });
    setAiCalBusy(false);
    if (res.ok) setAiCalText(res.text);
    else setAiCalErr(res.error);
  };

  const rows = useMemo(() => certs
    .filter(c => br === 'All' || branches.find(b => b.id === c.branchId)?.name === br)
    .map(c => {
      const survDate   = c.surveillance1Due || (() => { const d = new Date(c.expiryDate); d.setMonth(d.getMonth() - 24); return d.toISOString().slice(0, 10); })();
      const recertDate = c.recertificationDue || (() => { const d = new Date(c.expiryDate); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); })();
      return {
        cert: c,
        branchName: branches.find(b => b.id === c.branchId)?.name || '—',
        surveillance:     survDate,
        recertification:  recertDate,
        expiryTag: tag(c.expiryDate),
      };
    })
    .filter(r => statusFilter === 'All' || r.expiryTag.label === statusFilter)
    .sort((a, b) => +new Date(a.cert.expiryDate) - +new Date(b.cert.expiryDate)),
  [certs, br, branches, statusFilter]);

  const overdue  = rows.filter(r => r.expiryTag.label === 'Overdue').length;
  const dueSoon  = rows.filter(r => r.expiryTag.label === 'Due Soon').length;
  const upcoming = rows.filter(r => r.expiryTag.label === 'Upcoming').length;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Due Date Tracker</h1>
      <p style={{ margin: '4px 0 10px', color: '#64748b', fontSize: 13 }}>🟢 Safe · 🟠 Upcoming (≤90d) · 🟡 Due Soon (≤30d) · 🔴 Overdue</p>

      <LiveBar lastUpdated={lastUpdated} isLive={isLive} onRefresh={refresh} />

      {/* Compliance Calendar Copilot — crunch windows + copyable reminder nudges */}
      <AIPanel
        title="Compliance Calendar Copilot"
        subtitle="Crunch months with stacked deadlines, plus ready-to-send reminders for the next 90 days"
        onRefresh={() => { setAiTick((t) => t + 1); setAiCalText(null); setAiCalErr(null); }}
      >
        {aiCalText && (
          <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.6, color: '#334155' }}>{aiCalText}</p>
        )}
        {calendar.windows.length === 0 ? (
          <p className="ai-panel-note">No crunch windows — no upcoming month stacks two or more compliance events.</p>
        ) : (
          <ul className="ai-insight-list">
            {calendar.windows.map((w) => (
              <li key={w.month}>
                <span className={`ai-chip ${w.events.length >= 3 ? 'high' : 'med'}`}>{w.events.length} events</span>
                <span>
                  <strong>{w.label}</strong> is a crunch window: {w.events.map((e) => `${e.type} for ${e.standard} (${e.date})`).join('; ')}.
                </span>
              </li>
            ))}
          </ul>
        )}
        {calendar.reminders.length > 0 && (
          <>
            <p style={{ margin: '10px 0 4px', fontSize: 12, fontWeight: 700, color: '#475569' }}>
              Reminder nudges — next 90 days ({calendar.reminders.length})
            </p>
            <ul className="ai-insight-list">
              {calendar.reminders.slice(0, 6).map((e) => (
                <li key={e.id}>
                  <span className={`ai-chip ${e.days < 0 ? 'high' : e.days <= 30 ? 'med' : 'info'}`}>
                    {e.days < 0 ? `${Math.abs(e.days)}d late` : `${e.days}d`}
                  </span>
                  <span style={{ flex: 1 }}>{e.nudge}</span>
                  <button
                    type="button"
                    className="ai-action-btn"
                    onClick={() => copyNudge(e.id, e.nudge)}
                    title="Copy reminder text"
                    style={{ flexShrink: 0 }}
                  >
                    {copiedId === e.id ? <Check size={12} /> : <Copy size={12} />} {copiedId === e.id ? 'Copied' : 'Copy'}
                  </button>
                </li>
              ))}
            </ul>
            {calendar.reminders.length > 6 && (
              <p className="ai-panel-note">Showing the 6 most urgent of {calendar.reminders.length} reminders.</p>
            )}
          </>
        )}
        {isClaudeConfigured() && !aiCalText && (
          <button type="button" className="ai-action-btn" onClick={enhanceCalendar} disabled={aiCalBusy} style={{ marginTop: 10 }}>
            {aiCalBusy ? 'Enhancing…' : 'Enhance with Claude'}
          </button>
        )}
        {aiCalErr && <p className="ai-panel-note">Claude enhancement failed: {aiCalErr} — local plan shown above.</p>}
      </AIPanel>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {overdue > 0 && (
          <span onClick={() => setStatusFilter(statusFilter === 'Overdue' ? 'All' : 'Overdue')}
            style={{ background: '#fee2e2', color: '#b91c1c', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={11} /> {overdue} Overdue
          </span>
        )}
        {dueSoon > 0 && (
          <span onClick={() => setStatusFilter(statusFilter === 'Due Soon' ? 'All' : 'Due Soon')}
            style={{ background: '#fef3c7', color: '#a16207', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
            🟡 {dueSoon} Due Soon
          </span>
        )}
        {upcoming > 0 && (
          <span onClick={() => setStatusFilter(statusFilter === 'Upcoming' ? 'All' : 'Upcoming')}
            style={{ background: '#ffedd5', color: '#c2410c', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
            🟠 {upcoming} Upcoming
          </span>
        )}
        {statusFilter !== 'All' && (
          <button onClick={() => setStatusFilter('All')} style={{ background: '#f1f5f9', border: 'none', borderRadius: 999, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#475569' }}>
            Clear filter ×
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={br} onChange={e => setBr(e.target.value)} style={sel}>
          <option>All</option>
          {branches.map(b => <option key={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: '#f1f5f9' }}>
            <tr>{['Certification', 'Branch', 'Surveillance Due', 'Recertification Due', 'Cert Expiry', 'Status', 'Days to Expiry'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#475569', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const t = r.expiryTag;
              return (
                <tr key={r.cert.id} style={{ borderTop: '1px solid #e2e8f0', background: t.label === 'Overdue' ? '#fff5f5' : 'transparent' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <strong>{r.cert.standard}</strong>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.cert.certNumber}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{r.branchName}</td>
                  <td style={{ padding: '10px 12px', color: '#475569' }}>
                    <CalendarClock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {r.surveillance}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#475569' }}>
                    <CalendarClock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {r.recertification}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#475569', fontWeight: 600 }}>{r.cert.expiryDate}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: t.bg, color: t.fg, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>{t.icon} {t.label}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: t.fg, fontWeight: 700 }}>
                    {t.days >= 0 ? `${t.days}d` : `${Math.abs(t.days)}d ago`}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Nothing matches this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const sel: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' };

export default DueDates;
