import { useEffect, useMemo, useState } from 'react';
import clientSvc from '../../services/clientCoordinatorService';

export default function AuditSchedules() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    setSchedules(clientSvc.getSchedulesForClient());
  }, []);

  const types = useMemo(() => Array.from(new Set(schedules.map(s => s.type).filter(Boolean))), [schedules]);
  const branches = useMemo(() => Array.from(new Set(schedules.map(s => s.branch).filter(Boolean))), [schedules]);

  const filtered = schedules.filter(s => {
    if (typeFilter && s.type !== typeFilter) return false;
    if (branchFilter && String(s.branch) !== String(branchFilter)) return false;
    if (from && new Date(s.scheduledDate) < new Date(from)) return false;
    if (to && new Date(s.scheduledDate) > new Date(to)) return false;
    return true;
  });

  return (
    <div>
      <h2>Audit Schedules</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="">All Branches</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <label>From <input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={e=>setTo(e.target.value)} /></label>
      </div>

      {filtered.length === 0 ? (
        <div className="card">No schedules found.</div>
      ) : (
        filtered.map(s => (
          <div key={s.id} className="card" style={{ marginBottom: 8 }}>
            <div><strong>{s.type || 'Audit'}</strong> — {s.scheduledDate}</div>
            <div>Auditor: {s.auditor || '—'}</div>
            <div>Branch/Unit: {s.branch || '—'}</div>
            <div>Status: {s.status}</div>
          </div>
        ))
      )}
    </div>
  );
}
