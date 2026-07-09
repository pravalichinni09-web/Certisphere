import React, { useMemo, useState } from 'react';
import { Eye, Download } from 'lucide-react';
import { getCertifications, getBranches } from './scope';
import { useRealtimeScope } from './useRealtimeScope';
import { LiveBar } from './LiveBar';
import ViewOnlyDoc from '../../components/ViewOnlyDoc';

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  'Active':       { bg: '#dcfce7', fg: '#15803d' },
  'Expiring Soon':{ bg: '#fef3c7', fg: '#a16207' },
  'Expired':      { bg: '#fee2e2', fg: '#b91c1c' },
};

const PAGE = 10;

const Certifications: React.FC = () => {
  const { data: certs, refresh, lastUpdated, isLive } = useRealtimeScope(getCertifications);
  const { data: branches } = useRealtimeScope(getBranches);
  const branchName = (id?: number) => branches.find(b => b.id === id)?.name || '—';

  const cats = Array.from(new Set(certs.map(c => c.category).filter(Boolean))) as string[];
  const [cat, setCat] = useState<string>('All');
  const [br, setBr] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<{ name: string; dataUrl: string } | null>(null);

  const filtered = useMemo(() => certs.filter(c =>
    (cat === 'All' || c.category === cat) &&
    (br === 'All' || branchName(c.branchId) === br) &&
    (statusFilter === 'All' || c.status === statusFilter)
  ), [certs, cat, br, statusFilter, branches]);

  const pages = Math.ceil(filtered.length / PAGE);
  const slice = filtered.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Certifications View</h1>
      <p style={{ margin: '4px 0 10px', color: '#64748b', fontSize: 13 }}>{certs.length} total · paginated · read-only</p>

      <LiveBar lastUpdated={lastUpdated} isLive={isLive} onRefresh={refresh} count={filtered.length} unit="shown" />

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <select value={cat} onChange={e => { setCat(e.target.value); setPage(0); }} style={selStyle}>
          <option>All</option>
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={br} onChange={e => { setBr(e.target.value); setPage(0); }} style={selStyle}>
          <option>All</option>
          {branches.map(b => <option key={b.id}>{b.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} style={selStyle}>
          <option>All</option>
          <option>Active</option>
          <option>Expiring Soon</option>
          <option>Expired</option>
        </select>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['Active', 'Expiring Soon', 'Expired'] as const).map(s => {
          const cnt = certs.filter(c => c.status === s).length;
          const sc = STATUS_COLORS[s];
          return (
            <span key={s} onClick={() => { setStatusFilter(statusFilter === s ? 'All' : s); setPage(0); }}
              style={{ background: sc.bg, color: sc.fg, padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: 'pointer', opacity: statusFilter !== 'All' && statusFilter !== s ? .5 : 1 }}>
              {s}: {cnt}
            </span>
          );
        })}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: '#f1f5f9' }}>
            <tr>
              {['Standard', 'Branch', 'Scope', 'Category', 'Issue Date', 'Expiry Date', 'Status', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#475569', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map(c => {
              const sc = STATUS_COLORS[c.status] || { bg: '#e2e8f0', fg: '#475569' };
              return (
                <tr key={c.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <strong>{c.standard}</strong>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.certNumber}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{branchName(c.branchId)}</td>
                  <td style={{ padding: '10px 12px', color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.scope}>{c.scope}</td>
                  <td style={{ padding: '10px 12px', color: '#475569' }}>{c.category || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#475569' }}>{c.issueDate}</td>
                  <td style={{ padding: '10px 12px', color: '#475569' }}>{c.expiryDate}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: sc.bg, color: sc.fg, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{c.status}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => setPreview({ name: `${c.standard}-${c.certNumber}.pdf`, dataUrl: '' })}
                        title="View certificate" style={btnSm}>
                        <Eye size={12} /> View
                      </button>
                      <button onClick={() => setPreview({ name: `${c.standard}-${c.certNumber}.pdf`, dataUrl: '' })}
                        title="Download certificate" style={{ ...btnSm, background: '#6366f1' }}>
                        <Download size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {slice.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>No certifications match the filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12, alignItems: 'center' }}>
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ ...pageBtn, opacity: page === 0 ? .4 : 1 }}>‹</button>
          {Array.from({ length: pages }).map((_, i) => (
            <button key={i} onClick={() => setPage(i)} style={{ ...pageBtn, background: page === i ? '#0e7490' : '#fff', color: page === i ? '#fff' : '#475569' }}>{i + 1}</button>
          ))}
          <button disabled={page === pages - 1} onClick={() => setPage(p => p + 1)} style={{ ...pageBtn, opacity: page === pages - 1 ? .4 : 1 }}>›</button>
        </div>
      )}

      <ViewOnlyDoc open={!!preview} onClose={() => setPreview(null)} title="Certificate (read-only)" fileName={preview?.name} dataUrl={preview?.dataUrl} />
    </div>
  );
};

const selStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' };
const btnSm: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#0e7490', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' };
const pageBtn: React.CSSProperties = { padding: '5px 11px', borderRadius: 6, border: '1px solid #cbd5e1', cursor: 'pointer', fontSize: 12, fontWeight: 700 };

export default Certifications;
