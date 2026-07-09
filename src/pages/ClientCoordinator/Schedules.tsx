import React, { useMemo, useState } from 'react';
import { getAuditSchedules, getBranches } from './scope';
import { useRealtimeScope } from './useRealtimeScope';
import { LiveBar } from './LiveBar';

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  Completed:  { bg: '#dcfce7', fg: '#15803d' },
  Confirmed:  { bg: '#dbeafe', fg: '#1d4ed8' },
  Scheduled:  { bg: '#e0f2fe', fg: '#0369a1' },
  Pending:    { bg: '#fef3c7', fg: '#a16207' },
  'In Progress': { bg: '#ede9fe', fg: '#7c3aed' },
};

const Schedules: React.FC = () => {
  const { data: rows, refresh, lastUpdated, isLive } = useRealtimeScope(getAuditSchedules);
  const { data: branches } = useRealtimeScope(getBranches);
  const [type, setType] = useState('All');
  const [br, setBr] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('All');

  const types    = Array.from(new Set(rows.map(r => r.type).filter(Boolean)));
  const statuses = Array.from(new Set(rows.map(r => r.status).filter(Boolean)));

  const branchName = (id?: number) => branches.find(b => b.id === id)?.name || '—';

  const filtered = useMemo(() => rows.filter(r => {
    if (type !== 'All' && r.type !== type) return false;
    if (br !== 'All' && branchName(r.branchId) !== br) return false;
    if (status !== 'All' && r.status !== status) return false;
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    return true;
  }), [rows, type, br, status, from, to, branches]);

  const upcoming = rows.filter(r => new Date(r.date) >= new Date() && r.status !== 'Completed').length;
  const completed = rows.filter(r => r.status === 'Completed').length;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Audit Schedules</h1>
      <p style={{ margin: '4px 0 10px', color: '#64748b', fontSize: 13 }}>
        {upcoming} upcoming · {completed} completed · read-only
      </p>

      <LiveBar lastUpdated={lastUpdated} isLive={isLive} onRefresh={refresh} count={filtered.length} unit="schedules" />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <select value={type} onChange={e => setType(e.target.value)} style={sel}>
          <option>All</option>{types.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={br} onChange={e => setBr(e.target.value)} style={sel}>
          <option>All</option>{branches.map(b => <option key={b.id}>{b.name}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} style={sel}>
          <option>All</option>{statuses.map(s => <option key={s}>{s}</option>)}
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={sel} title="From date" />
        <input type="date" value={to}   onChange={e => setTo(e.target.value)}   style={sel} title="To date" />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: '#f1f5f9' }}>
            <tr>{['Type', 'Standard', 'Branch', 'Date', 'Auditor', 'Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const sc = STATUS_COLORS[r.status] || { bg: '#e2e8f0', fg: '#475569' };
              const isPast = r.date && new Date(r.date) < new Date();
              return (
                <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0', background: isPast && r.status !== 'Completed' ? '#fffbeb' : 'transparent' }}>
                  <td style={td}><strong>{r.type}</strong></td>
                  <td style={td}>{r.standard || '—'}</td>
                  <td style={td}>{branchName(r.branchId)}</td>
                  <td style={td}>{r.date}</td>
                  <td style={td}>{r.auditor}</td>
                  <td style={td}>
                    <span style={{ background: sc.bg, color: sc.fg, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{r.status}</span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>No schedules match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const sel: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' };
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', color: '#475569', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 };
const td: React.CSSProperties = { padding: '10px 12px', color: '#475569' };

export default Schedules;
