import { useEffect, useMemo, useState } from 'react';
import clientSvc from '../../services/clientCoordinatorService';

function statusForDate(iso?: string) {
  if (!iso) return { label: 'Unknown', color: 'gray' };
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diff = t - now;
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return { label: 'Overdue', color: 'red' };
  if (days <= 30) return { label: 'Due Soon', color: 'orange' };
  return { label: 'Safe', color: 'green' };
}

export default function DueDateTracker() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [certs, setCerts] = useState<any[]>([]);
  const [branchFilter, setBranchFilter] = useState('');

  useEffect(() => {
    setSchedules(clientSvc.getSchedulesForClient());
    setCerts(clientSvc.getCertificatesForClient());
  }, []);

  const branches = useMemo(() => Array.from(new Set([...schedules.map(s=>s.branch), ...certs.map(c=>c.branch || c.unit)].filter(Boolean))), [schedules, certs]);

  const filteredSchedules = schedules.filter(s => !branchFilter || String(s.branch) === String(branchFilter));
  const filteredCerts = certs.filter(c => !branchFilter || String(c.branch || c.unit) === String(branchFilter));

  return (
    <div>
      <h2>Due Date Tracker</h2>

      <div style={{ marginBottom: 12 }}>
        <label>Filter by branch/unit: </label>
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="">All</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div className="card">
        <h4>Upcoming Audit Dates</h4>
        {filteredSchedules.length === 0 ? <div>No upcoming schedules.</div> : filteredSchedules.map(s => {
          const st = statusForDate(s.scheduledDate);
          return (
            <div key={s.id} style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>{s.type || 'Audit'}</strong> — {s.scheduledDate}
                <div style={{ fontSize: 13, color: '#64748b' }}>{s.auditor || '—'}</div>
              </div>
              <div style={{ color: st.color }}>{st.label}</div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h4>Certificate Expiry Dates</h4>
        {filteredCerts.length === 0 ? <div>No certificates.</div> : filteredCerts.map(c => {
          const st = statusForDate(c.expirationDate);
          return (
            <div key={c.id} style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>{c.certificateNumber || c.standard}</strong>
                <div style={{ fontSize: 13, color: '#64748b' }}>{c.branch || c.unit || '—'}</div>
              </div>
              <div style={{ color: st.color }}>{st.label} — Expiry: {c.expirationDate || '—'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
