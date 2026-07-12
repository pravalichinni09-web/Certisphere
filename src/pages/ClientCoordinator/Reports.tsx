import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Search } from 'lucide-react';
import { getAuditReports, getBranches } from './scope';
import { useRealtimeScope } from './useRealtimeScope';
import { LiveBar } from './LiveBar';
import ViewOnlyDoc from '../../components/ViewOnlyDoc';
import AIPanel from '../../components/AIPanel';
import { answerReportQuestion, qaClaudePrompt, QAResult } from '../../ai/clientCoordinatorInsights';
import { onCmsChange, claudeComplete, isClaudeConfigured } from '../../ai/liveData';

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  Approved:      { bg: '#dcfce7', fg: '#15803d' },
  Issued:        { bg: '#dcfce7', fg: '#15803d' },
  'Under Review':{ bg: '#dbeafe', fg: '#1d4ed8' },
  Draft:         { bg: '#fef3c7', fg: '#a16207' },
};

const Reports: React.FC = () => {
  const { data: rows, refresh, lastUpdated, isLive } = useRealtimeScope(getAuditReports);
  const { data: branches } = useRealtimeScope(getBranches);
  const [cert, setCert] = useState('All');
  const [br, setBr] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preview, setPreview] = useState<{ name: string; dataUrl: string } | null>(null);

  // ---- Report Q&A (AI) ------------------------------------------------------
  const [question, setQuestion] = useState('');
  const [qa, setQa] = useState<QAResult | null>(null);
  const [aiQaText, setAiQaText] = useState<string | null>(null);
  const [aiQaBusy, setAiQaBusy] = useState(false);
  const [aiQaErr, setAiQaErr] = useState<string | null>(null);

  // Re-run the last question when underlying CMS data changes
  useEffect(() => onCmsChange(() => {
    setQa((prev) => (prev && question.trim() ? answerReportQuestion(question) : prev));
  }), [question]);

  const askQuestion = () => {
    if (!question.trim()) return;
    setQa(answerReportQuestion(question));
    setAiQaText(null);
    setAiQaErr(null);
  };

  const synthesizeAnswer = async () => {
    if (!qa || qa.matches.length === 0 || aiQaBusy) return;
    setAiQaBusy(true);
    setAiQaErr(null);
    const res = await claudeComplete(qaClaudePrompt(question, qa.matches), { maxTokens: 400 });
    setAiQaBusy(false);
    if (res.ok) setAiQaText(res.text);
    else setAiQaErr(res.error);
  };

  const branchName = (id?: number) => branches.find(b => b.id === id)?.name || '—';
  const uniqueStandards = Array.from(new Set(rows.map(r => r.standard).filter(Boolean)));

  const filtered = useMemo(() => rows.filter(r => {
    if (cert !== 'All' && r.standard !== cert) return false;
    if (br !== 'All' && branchName(r.branchId) !== br) return false;
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    return true;
  }), [rows, cert, br, from, to, branches]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Audit Reports</h1>
      <p style={{ margin: '4px 0 10px', color: '#64748b', fontSize: 13 }}>
        {rows.length} reports · read-only · PDF download available
      </p>

      <LiveBar lastUpdated={lastUpdated} isLive={isLive} onRefresh={refresh} count={filtered.length} unit="shown" />

      {/* Report Q&A — keyword search over reports, findings and corrective actions */}
      <AIPanel
        title="Report Q&A"
        subtitle="Ask a question about audit reports, findings or corrective actions — answers cite matched records"
        onRefresh={qa ? askQuestion : undefined}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') askQuestion(); }}
            placeholder='e.g. "major findings for document control" or "overdue corrective actions"'
            style={{ flex: 1, minWidth: 220, padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
          />
          <button type="button" className="ai-action-btn" onClick={askQuestion} disabled={!question.trim()}>
            <Search size={12} /> Ask
          </button>
        </div>
        {qa && (
          <>
            <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.6, color: '#334155' }}>
              {aiQaText || qa.answer}
            </p>
            {qa.matches.length > 0 && (
              <ul className="ai-insight-list">
                {qa.matches.map((m, i) => (
                  <li key={`${m.source}-${m.client}-${m.date}-${i}`}>
                    <span className={`ai-chip ${m.source === 'Corrective Action' ? 'med' : m.source === 'Finding' ? 'high' : 'info'}`}>{m.source}</span>
                    <span>
                      <strong>{m.client}</strong> · {m.date} · {m.title}
                      <br />
                      <em style={{ color: '#64748b' }}>“{m.snippet}”</em>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {isClaudeConfigured() && qa.matches.length > 0 && !aiQaText && (
              <button type="button" className="ai-action-btn" onClick={synthesizeAnswer} disabled={aiQaBusy} style={{ marginTop: 10 }}>
                {aiQaBusy ? 'Synthesizing…' : 'Synthesize answer with Claude'}
              </button>
            )}
            {aiQaErr && <p className="ai-panel-note">Claude synthesis failed: {aiQaErr} — keyword answer shown above.</p>}
            {aiQaText && <p className="ai-panel-note">Answer synthesized by Claude from the cited records above.</p>}
          </>
        )}
        {!qa && <p className="ai-panel-note">Matches are ranked by keyword hits across live reports, findings and corrective actions.</p>}
      </AIPanel>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <select value={cert} onChange={e => setCert(e.target.value)} style={sel}>
          <option value="All">All certifications</option>
          {uniqueStandards.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={br} onChange={e => setBr(e.target.value)} style={sel}>
          <option>All</option>{branches.map(b => <option key={b.id}>{b.name}</option>)}
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={sel} title="From" />
        <input type="date" value={to}   onChange={e => setTo(e.target.value)}   style={sel} title="To" />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: '#f1f5f9' }}>
            <tr>{['Date', 'Standard', 'Auditor', 'Branch', 'Findings', 'Status', 'Report'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const sc = STATUS_COLORS[r.status] || { bg: '#e2e8f0', fg: '#475569' };
              return (
                <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={td}>{r.date}</td>
                  <td style={td}><strong>{r.standard}</strong></td>
                  <td style={td}>{r.auditor}</td>
                  <td style={td}>{branchName(r.branchId)}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{r.findings} total</span>
                      {r.major !== undefined && r.major > 0 && <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 800 }}>M:{r.major}</span>}
                      {r.minor !== undefined && r.minor > 0 && <span style={{ background: '#fef3c7', color: '#a16207', padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 800 }}>m:{r.minor}</span>}
                      {r.ofi !== undefined && r.ofi > 0 && <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 800 }}>OFI:{r.ofi}</span>}
                    </div>
                    {r.summary && <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.summary}>{r.summary}</div>}
                  </td>
                  <td style={td}>
                    <span style={{ background: sc.bg, color: sc.fg, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{r.status}</span>
                  </td>
                  <td style={td}>
                    <button onClick={() => setPreview({ name: `${r.standard}-${r.date}.pdf`, dataUrl: '' })}
                      title="Preview report (read-only)"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#0e7490', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      <Download size={12} /> PDF
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
                <FileText size={24} style={{ marginBottom: 6, opacity: .4 }} />
                <div>No reports match the filters.</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ViewOnlyDoc open={!!preview} onClose={() => setPreview(null)} title="Audit Report (read-only)" fileName={preview?.name} dataUrl={preview?.dataUrl} />
    </div>
  );
};

const sel: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' };
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', color: '#475569', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 };
const td: React.CSSProperties = { padding: '10px 12px', color: '#475569' };

export default Reports;
