import { useEffect, useMemo, useState } from 'react';
import clientSvc from '../../services/clientCoordinatorService';

export default function AuditReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [certFilter, setCertFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    setReports(clientSvc.getReportsForClient());
  }, []);

  const certs = useMemo(() => Array.from(new Set(reports.map(r=>r.standard).filter(Boolean))), [reports]);
  const branches = useMemo(() => Array.from(new Set(reports.map(r=>r.branch).filter(Boolean))), [reports]);

  const filtered = reports.filter(r => {
    if (certFilter && r.standard !== certFilter) return false;
    if (branchFilter && String(r.branch) !== String(branchFilter)) return false;
    if (from && new Date(r.auditDate) < new Date(from)) return false;
    if (to && new Date(r.auditDate) > new Date(to)) return false;
    return true;
  });

  return (
    <div>
      <h2>Audit Reports</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select value={certFilter} onChange={e=>setCertFilter(e.target.value)}>
          <option value="">All Certifications</option>
          {certs.map(c=> <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={branchFilter} onChange={e=>setBranchFilter(e.target.value)}>
          <option value="">All Branches</option>
          {branches.map(b=> <option key={b} value={b}>{b}</option>)}
        </select>
        <label>From <input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={e=>setTo(e.target.value)} /></label>
      </div>

      {filtered.length === 0 ? (
        <div className="card">No reports available.</div>
      ) : (
        filtered.map(r => (
          <div key={r.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>{r.standard}</strong> — {r.auditDate}
                <div style={{ fontSize: 13, color: '#64748b' }}>Auditor: {r.auditor}</div>
                <div style={{ marginTop: 6 }}>{r.findingSummary || '—'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {r.attachment ? (
                  <a href={`/${r.attachment}`} target="_blank" rel="noreferrer">Download report (PDF)</a>
                ) : (
                  <span style={{ color: '#94a3b8' }}>No file</span>
                )}
                <div style={{ marginTop: 8 }}>Status: {r.status || '—'}</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
