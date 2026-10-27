/**
 * Growth Analytics — Management tool.
 * Identifies ranked growth opportunities from the certification body's live data,
 * with market size, effort, ROI, timeline and risk. Heuristic + optional Claude.
 */
import React, { useState } from 'react';
import { TrendingUp, Sparkles, Wand2, Loader2, Target, Gauge, Clock, AlertTriangle, Users, CalendarRange } from 'lucide-react';
import { isClaudeConfigured } from '../../ai/claudeClient';
import { analyzeGrowthHeuristic, analyzeGrowthWithClaude, GrowthAnalysis, GrowthPeriod, PERIOD_LABEL, getClientBreakdown, ClientGrowthRow } from '../../ai/growthAnalytics';

const sizeColor: Record<string, string> = { Large: '#16a34a', Medium: '#2563eb', Small: '#64748b' };
const effortColor: Record<string, string> = { Low: '#16a34a', Medium: '#f59e0b', High: '#dc2626' };

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e7ecf3', borderRadius: 16, padding: 22,
  boxShadow: '0 1px 3px rgba(15,23,42,.05), 0 8px 22px rgba(15,23,42,.04)', marginBottom: 20,
};
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color + '1f', color, border: `1px solid ${color}55`, padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 800 }}>{text}</span>
);
const meta: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#475569' };

const GrowthAnalytics: React.FC = () => {
  const claude = isClaudeConfigured();
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState<GrowthPeriod>('all');
  const [result, setResult] = useState<GrowthAnalysis | null>(null);
  const [clients, setClients] = useState<ClientGrowthRow[]>([]);

  const run = async (pd: GrowthPeriod = period) => {
    setBusy(true);
    setPeriod(pd);
    setResult(analyzeGrowthHeuristic(pd));
    setClients(getClientBreakdown(pd));
    if (claude) {
      const r = await analyzeGrowthWithClaude(pd);
      if (r && r.opportunities.length) setResult(r);
    }
    setBusy(false);
  };

  return (
    <div style={{ padding: '0 8px', maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f2547', display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingUp size={26} color="#2563eb" /> Growth Analytics
          </h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
            Ranked, actionable growth opportunities from your live certification data — market size, effort, ROI, timeline and risk.
          </p>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
          background: claude ? '#ecfdf5' : '#f1f5f9', color: claude ? '#047857' : '#475569', border: `1px solid ${claude ? '#a7f3d0' : '#e2e8f0'}` }}>
          <Sparkles size={14} /> {claude ? 'Claude connected' : 'Heuristic mode · AI not enabled on server'}
        </span>
      </div>

      <div style={{ ...card }}>
        <div style={{ color: '#475569', fontSize: 13.5, marginBottom: 14 }}>Analyse the current book of business for market gaps, underserved standards, geographic and segment expansion, service lines, and partnerships.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#64748b' }}><CalendarRange size={14} /> Period:</span>
            {(['week', 'month', 'year', 'all'] as GrowthPeriod[]).map((pd) => (
              <button key={pd} type="button" onClick={() => run(pd)} disabled={busy}
                style={{ padding: '6px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                  border: '1px solid ' + (period === pd ? '#2563eb' : '#cbd5e1'),
                  background: period === pd ? '#2563eb' : '#fff', color: period === pd ? '#fff' : '#475569' }}>
                {PERIOD_LABEL[pd]}
              </button>
            ))}
          </div>
          <button type="button" style={btn} onClick={() => run(period)} disabled={busy}>
            {busy ? <Loader2 size={16} className="cs-spin" /> : <Wand2 size={16} />} Analyze Growth
          </button>
        </div>
      </div>

      {result && (
        <>
          <div style={card}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 800, color: '#0f2547', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} color="#2563eb" /> Summary
            </h3>
            <p style={{ margin: 0, color: '#334155', fontSize: 14, lineHeight: 1.6 }}>{result.summary}</p>
            <div style={{ marginTop: 10, fontSize: 11.5, color: '#94a3b8' }}>{result.source === 'claude' ? 'AI strategist (Claude)' : 'Heuristic analysis'} · {PERIOD_LABEL[period]}</div>
          </div>

          {clients.length > 0 && (
            <div style={card}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: '#0f2547', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} color="#2563eb" /> Clients in scope <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>· {clients.length}</span>
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Client</th>
                      <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Industry</th>
                      <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Standard</th>
                      <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Country</th>
                      <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>Audits</th>
                      <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>Certs</th>
                      <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.slice(0, 20).map((c, i) => (
                      <tr key={i}>
                        <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f2547' }}>{c.client}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{c.industry}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9', color: '#1d4ed8', fontWeight: 600 }}>{c.standard}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{c.country}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', color: '#0f2547', fontWeight: 700 }}>{c.audits}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', color: '#0f2547', fontWeight: 700 }}>{c.certs}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: c.status === 'Active' ? '#dcfce7' : '#fee2e2', color: c.status === 'Active' ? '#166534' : '#b91c1c' }}>{c.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.opportunities.map((o) => (
            <div key={o.rank} style={{ ...card, marginBottom: 14, borderLeft: `4px solid ${sizeColor[o.marketSize]}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
                  <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: '#eef4ff', color: '#1d4ed8', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14 }}>{o.rank}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 800, color: '#0f2547' }}>{o.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{o.category}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Badge text={`${o.marketSize} market`} color={sizeColor[o.marketSize]} />
                  <Badge text={`${o.effort} effort`} color={effortColor[o.effort]} />
                </div>
              </div>
              <p style={{ margin: '10px 0 12px', color: '#334155', fontSize: 13.5, lineHeight: 1.55 }}>{o.rationale}</p>
              <div style={{ display: 'flex', gap: '8px 26px', flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                <span style={meta}><Target size={14} color="#16a34a" /> ROI: <strong style={{ color: '#0f2547' }}>{o.roi}</strong></span>
                <span style={meta}><Clock size={14} color="#2563eb" /> Timeline: <strong style={{ color: '#0f2547' }}>{o.timeline}</strong></span>
                <span style={meta}><Gauge size={14} color="#f59e0b" /> Effort: <strong style={{ color: '#0f2547' }}>{o.effort}</strong></span>
                <span style={{ ...meta, flex: '1 1 240px', minWidth: 200 }}><AlertTriangle size={14} color="#dc2626" /> <span style={{ color: '#64748b' }}>{o.risk}</span></span>
              </div>
            </div>
          ))}
        </>
      )}

      <style>{`.cs-spin{animation:cs-spin 1s linear infinite}@keyframes cs-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default GrowthAnalytics;
