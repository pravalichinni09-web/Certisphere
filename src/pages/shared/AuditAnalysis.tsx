import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Search,
  Building2,
  Calendar,
  PieChart as PieIcon,
  Filter,
} from 'lucide-react';
import {
  AuditFinding,
  Period,
  periodLabel,
  loadFindings,
  seedFindings,
  inPeriod,
} from '../shared/auditAnalysisData';

/* -----------------------------------------------------------
   Audit Analysis page — shared by Coordinator and Lead Auditor
----------------------------------------------------------- */

interface AuditAnalysisProps {
  role?: 'coordinator' | 'lead-auditor';
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'year', label: '1 Year' },
  { key: 'quarter', label: '1 Quarter' },
  { key: 'month', label: '1 Month' },
  { key: 'week', label: '1 Week' },
  { key: 'day', label: '1 Day' },
];

const CAT_COLORS = {
  Major: '#dc2626',
  Minor: '#f59e0b',
  OFI: '#0ea5e9',
  Observation: '#64748b',
} as const;

const STATUS_COLORS = {
  Open: '#dc2626',
  'In Progress': '#f59e0b',
  Closed: '#16a34a',
} as const;

const AuditAnalysis: React.FC<AuditAnalysisProps> = ({ role = 'coordinator' }) => {
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [period, setPeriod] = useState<Period>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [standardFilter, setStandardFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Seed + load on mount
  useEffect(() => {
    seedFindings();
    setFindings(loadFindings());
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'cms_audit_findings_v1') setFindings(loadFindings());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const allClients = useMemo(() => {
    return Array.from(new Set(findings.map(f => f.client))).sort();
  }, [findings]);

  const allStandards = useMemo(() => {
    return Array.from(new Set(findings.map(f => f.standard))).sort();
  }, [findings]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return findings.filter(f => {
      if (!inPeriod(f.date, period)) return false;
      if (clientFilter !== 'all' && f.client !== clientFilter) return false;
      if (standardFilter !== 'all' && f.standard !== standardFilter) return false;
      if (!q) return true;
      return (
        f.title.toLowerCase().includes(q) ||
        f.client.toLowerCase().includes(q) ||
        f.standard.toLowerCase().includes(q) ||
        f.clause.toLowerCase().includes(q) ||
        f.department.toLowerCase().includes(q) ||
        f.auditTitle.toLowerCase().includes(q)
      );
    });
  }, [findings, period, clientFilter, standardFilter, searchQuery]);

  /* -------- Aggregations -------- */
  const stats = useMemo(() => {
    const total = filtered.length;
    const major = filtered.filter(f => f.category === 'Major').length;
    const minor = filtered.filter(f => f.category === 'Minor').length;
    const ofi = filtered.filter(f => f.category === 'OFI' || f.category === 'Observation').length;
    const open = filtered.filter(f => f.status === 'Open').length;
    const inProg = filtered.filter(f => f.status === 'In Progress').length;
    const closed = filtered.filter(f => f.status === 'Closed').length;
    const audits = new Set(filtered.map(f => f.auditId)).size;
    const clients = new Set(filtered.map(f => f.client)).size;
    return { total, major, minor, ofi, open, inProg, closed, audits, clients };
  }, [filtered]);

  // Findings per audit
  const findingsPerAudit = useMemo(() => {
    const map: Record<string, { auditId: string; auditTitle: string; client: string; major: number; minor: number; ofi: number; total: number }> = {};
    for (const f of filtered) {
      if (!map[f.auditId]) {
        map[f.auditId] = { auditId: f.auditId, auditTitle: f.auditTitle, client: f.client, major: 0, minor: 0, ofi: 0, total: 0 };
      }
      map[f.auditId].total++;
      if (f.category === 'Major') map[f.auditId].major++;
      else if (f.category === 'Minor') map[f.auditId].minor++;
      else map[f.auditId].ofi++;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Audits per client
  const auditsPerClient = useMemo(() => {
    const map: Record<string, { client: string; audits: Set<string>; findings: number; major: number }> = {};
    for (const f of filtered) {
      if (!map[f.client]) map[f.client] = { client: f.client, audits: new Set(), findings: 0, major: 0 };
      map[f.client].audits.add(f.auditId);
      map[f.client].findings++;
      if (f.category === 'Major') map[f.client].major++;
    }
    return Object.values(map)
      .map(r => ({ ...r, audits: r.audits.size }))
      .sort((a, b) => b.findings - a.findings);
  }, [filtered]);

  // Top recurring findings (by title)
  const recurringFindings = useMemo(() => {
    const map: Record<string, { title: string; count: number; clients: Set<string>; clauses: Set<string>; categories: Set<string> }> = {};
    for (const f of filtered) {
      const key = f.title.toLowerCase();
      if (!map[key]) map[key] = { title: f.title, count: 0, clients: new Set(), clauses: new Set(), categories: new Set() };
      map[key].count++;
      map[key].clients.add(f.client);
      map[key].clauses.add(f.clause);
      map[key].categories.add(f.category);
    }
    return Object.values(map)
      .map(r => ({
        title: r.title,
        count: r.count,
        clientCount: r.clients.size,
        clauses: Array.from(r.clauses),
        categories: Array.from(r.categories),
      }))
      .filter(r => r.count >= 2 || r.clientCount >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filtered]);

  // Findings by department (donut)
  const byDepartment = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of filtered) {
      map[f.department] = (map[f.department] || 0) + 1;
    }
    return Object.entries(map)
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  // Findings by category (donut)
  const byCategory = useMemo(() => {
    const map: Record<string, number> = { Major: 0, Minor: 0, OFI: 0, Observation: 0 };
    for (const f of filtered) {
      map[f.category] = (map[f.category] || 0) + 1;
    }
    return Object.entries(map)
      .filter(([, n]) => n > 0)
      .map(([category, count]) => ({ category, count }));
  }, [filtered]);

  // Findings by clause (table)
  const byClause = useMemo(() => {
    const map: Record<string, { clause: string; standard: string; major: number; minor: number; ofi: number; total: number }> = {};
    for (const f of filtered) {
      const key = `${f.standard}::${f.clause}`;
      if (!map[key]) map[key] = { clause: f.clause, standard: f.standard, major: 0, minor: 0, ofi: 0, total: 0 };
      map[key].total++;
      if (f.category === 'Major') map[key].major++;
      else if (f.category === 'Minor') map[key].minor++;
      else map[key].ofi++;
    }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 12);
  }, [filtered]);

  // Insights / gaps
  const insights = useMemo(() => {
    const out: string[] = [];
    const topRecur = recurringFindings[0];
    if (topRecur) {
      out.push(`The most-repeated finding is "${topRecur.title}" — observed ${topRecur.count} times across ${topRecur.clientCount} client(s). Worth a process-wide fix.`);
    }
    const topDept = byDepartment[0];
    if (topDept && stats.total > 0) {
      const pct = Math.round((topDept.count / stats.total) * 100);
      out.push(`${pct}% of findings are concentrated in the ${topDept.department} department — investigate root-cause patterns there.`);
    }
    const topClient = auditsPerClient[0];
    if (topClient && topClient.findings >= 4) {
      out.push(`${topClient.client} has the highest finding count (${topClient.findings}). Schedule an extended close-out review.`);
    }
    const openShare = stats.total > 0 ? Math.round((stats.open / stats.total) * 100) : 0;
    if (openShare > 40) {
      out.push(`${openShare}% of findings are still Open. Push corrective-action follow-ups this week.`);
    }
    const topClause = byClause[0];
    if (topClause && topClause.major > 0) {
      out.push(`Clause ${topClause.clause} (${topClause.standard}) is repeatedly flagged with ${topClause.major} Major + ${topClause.minor} Minor — share with all clients in the next bulletin.`);
    }
    if (out.length === 0) out.push('No findings for this slice. Try widening the period or removing filters.');
    return out;
  }, [filtered, recurringFindings, byDepartment, auditsPerClient, byClause, stats]);

  const role_label = role === 'lead-auditor' ? 'Lead Auditor' : 'Audit Coordinator';

  return (
    <div style={{ padding: '0 8px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 18,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <BarChart3 size={26} color="#2563eb" /> Audit Analysis
          </h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
            {role_label} view — findings, clients, departments, and ISO clauses across the selected period.
          </p>
        </div>
      </div>

      {/* Filter row */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 12,
          background: '#fff',
          padding: 12,
          borderRadius: 12,
          border: '1px solid #e2e8f0',
        }}
      >
        <Filter size={14} color="#64748b" />
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Period:</span>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            title={periodLabel[p.key]}
            style={{
              padding: '5px 12px',
              borderRadius: 14,
              border: '1px solid ' + (period === p.key ? '#2563eb' : '#cbd5e1'),
              background: period === p.key ? '#2563eb' : '#fff',
              color: period === p.key ? '#fff' : '#475569',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
        <span style={{ width: 1, height: 22, background: '#e2e8f0', margin: '0 4px' }} />

        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, color: '#475569', outline: 'none' }}
        >
          <option value="all">All clients ({allClients.length})</option>
          {allClients.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={standardFilter}
          onChange={(e) => setStandardFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, color: '#475569', outline: 'none' }}
        >
          <option value="all">All standards ({allStandards.length})</option>
          {allStandards.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, color: '#94a3b8' }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search findings..."
            style={{
              padding: '6px 10px 6px 32px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              width: 240,
              outline: 'none',
              fontSize: 12,
            }}
          />
        </div>
      </div>

      {/* KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <Stat color="#0ea5e9"  label="Findings"        value={stats.total}    icon={<AlertTriangle size={16} />} />
        <Stat color="#dc2626"  label="Major"           value={stats.major}    icon={<AlertTriangle size={16} />} />
        <Stat color="#f59e0b"  label="Minor"           value={stats.minor}    icon={<AlertTriangle size={16} />} />
        <Stat color="#0ea5e9"  label="OFI / Obs."       value={stats.ofi}      icon={<Lightbulb size={16} />} />
        <Stat color="#16a34a"  label="Closed"          value={stats.closed}   icon={<TrendingUp size={16} />} />
        <Stat color="#7c3aed"  label="Audits covered"  value={stats.audits}   icon={<Calendar size={16} />} />
        <Stat color="#475569"  label="Clients"         value={stats.clients}  icon={<Building2 size={16} />} />
      </div>

      {/* Insights / gaps */}
      <div
        style={{
          background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
          border: '1px solid #bfdbfe',
          padding: '12px 16px',
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Lightbulb size={16} color="#1e40af" />
          <strong style={{ fontSize: 14, color: '#1e3a8a' }}>Insights & gaps</strong>
        </div>
        <ul style={{ margin: 0, paddingLeft: 22, fontSize: 13, color: '#1e3a8a', lineHeight: 1.6 }}>
          {insights.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      </div>

      {/* Two-column row 1: Findings per audit + Audits per client */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Card title="Findings per audit" subtitle="Each row is one audit; coloured stack shows the split.">
          {findingsPerAudit.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {findingsPerAudit.slice(0, 8).map((row) => {
                const max = Math.max(...findingsPerAudit.map(r => r.total), 1);
                const w = (n: number) => (n / max) * 100;
                return (
                  <div key={row.auditId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: '#0f172a', fontWeight: 600 }}>{row.auditTitle}</span>
                      <span style={{ color: '#64748b' }}>{row.client} · {row.total}</span>
                    </div>
                    <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden', background: '#f1f5f9' }}>
                      {row.major > 0 && <div title={`${row.major} Major`} style={{ width: `${w(row.major)}%`, background: CAT_COLORS.Major }} />}
                      {row.minor > 0 && <div title={`${row.minor} Minor`} style={{ width: `${w(row.minor)}%`, background: CAT_COLORS.Minor }} />}
                      {row.ofi   > 0 && <div title={`${row.ofi} OFI`}     style={{ width: `${w(row.ofi)}%`,   background: CAT_COLORS.OFI   }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Legend
            items={[
              { color: CAT_COLORS.Major, label: 'Major' },
              { color: CAT_COLORS.Minor, label: 'Minor' },
              { color: CAT_COLORS.OFI, label: 'OFI / Obs.' },
            ]}
          />
        </Card>

        <Card title="Audits per client" subtitle="How many distinct audits each client has had in the selected window.">
          {auditsPerClient.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {auditsPerClient.slice(0, 8).map((row) => {
                const max = Math.max(...auditsPerClient.map(r => r.audits), 1);
                return (
                  <div key={row.client}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: '#0f172a', fontWeight: 600 }}>{row.client}</span>
                      <span style={{ color: '#64748b' }}>
                        {row.audits} audit{row.audits === 1 ? '' : 's'} · {row.findings} findings · {row.major} major
                      </span>
                    </div>
                    <div style={{ height: 10, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${(row.audits / max) * 100}%`,
                        background: '#2563eb',
                        height: '100%',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Two-column row 2: Recurring findings + Departments donut */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Card title="Most-repeated findings" subtitle="Ranked by how often the same observation recurs.">
          {recurringFindings.length === 0 ? (
            <Empty hint="No recurring patterns in this slice." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recurringFindings.map((r, i) => (
                <div key={i} style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                      ×{r.count} · {r.clientCount} client{r.clientCount === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {r.clauses.map(c => (
                      <span key={c} style={{ background: '#eef2ff', color: '#4338ca', padding: '1px 6px', borderRadius: 10 }}>
                        clause {c}
                      </span>
                    ))}
                    {r.categories.map(c => (
                      <span key={c} style={{
                        padding: '1px 6px', borderRadius: 10,
                        background: (CAT_COLORS as any)[c] + '20',
                        color: (CAT_COLORS as any)[c],
                        fontWeight: 700,
                      }}>{c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Findings by department" subtitle="Where the gaps cluster across the org chart.">
          {byDepartment.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <DonutChart
                slices={byDepartment.map((d, i) => ({
                  label: d.department,
                  value: d.count,
                  color: ['#2563eb','#7c3aed','#0ea5e9','#16a34a','#f59e0b','#dc2626','#475569','#0f766e'][i % 8],
                }))}
              />
              <div style={{ flex: 1, fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {byDepartment.map((d, i) => (
                  <div key={d.department} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, background: ['#2563eb','#7c3aed','#0ea5e9','#16a34a','#f59e0b','#dc2626','#475569','#0f766e'][i % 8], borderRadius: '50%', display: 'inline-block' }} />
                    <span style={{ flex: 1 }}>{d.department}</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Two-column row 3: Categories donut + By-clause table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12, marginBottom: 16 }}>
        <Card title="Findings by category" subtitle="Major / Minor / OFI / Observation distribution.">
          {byCategory.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <DonutChart
                slices={byCategory.map(c => ({
                  label: c.category,
                  value: c.count,
                  color: (CAT_COLORS as any)[c.category],
                }))}
              />
              <div style={{ fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {byCategory.map(c => (
                  <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, background: (CAT_COLORS as any)[c.category], borderRadius: '50%' }} />
                    <span style={{ flex: 1 }}>{c.category}</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="Major / Minor by ISO clause" subtitle="Which clauses are most flagged across audits.">
          {byClause.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                    <th style={th}>Clause</th>
                    <th style={th}>Standard</th>
                    <th style={{ ...th, textAlign: 'right' }}>Major</th>
                    <th style={{ ...th, textAlign: 'right' }}>Minor</th>
                    <th style={{ ...th, textAlign: 'right' }}>OFI</th>
                    <th style={{ ...th, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {byClause.map((row, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={td}><code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>{row.clause}</code></td>
                      <td style={td}><span style={{ fontSize: 11, color: '#64748b' }}>{row.standard}</span></td>
                      <td style={{ ...td, textAlign: 'right', color: row.major > 0 ? CAT_COLORS.Major : '#94a3b8', fontWeight: 700 }}>{row.major || '—'}</td>
                      <td style={{ ...td, textAlign: 'right', color: row.minor > 0 ? CAT_COLORS.Minor : '#94a3b8', fontWeight: 700 }}>{row.minor || '—'}</td>
                      <td style={{ ...td, textAlign: 'right', color: row.ofi > 0 ? CAT_COLORS.OFI : '#94a3b8', fontWeight: 700 }}>{row.ofi || '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Detail listing */}
      <Card title="Finding records" subtitle={`Showing ${filtered.length} record${filtered.length === 1 ? '' : 's'}.`}>
        {filtered.length === 0 ? (
          <Empty hint="No findings match the current filters." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={th}>Date</th>
                  <th style={th}>Client</th>
                  <th style={th}>Standard / Clause</th>
                  <th style={th}>Department</th>
                  <th style={th}>Title</th>
                  <th style={th}>Category</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map(f => (
                  <tr key={f.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={td}>{new Date(f.date).toLocaleDateString()}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{f.client}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{f.auditTitle}</div>
                    </td>
                    <td style={td}>
                      <div style={{ fontSize: 11, color: '#475569' }}>{f.standard}</div>
                      <div style={{ fontSize: 11 }}><code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>{f.clause}</code></div>
                    </td>
                    <td style={td}>{f.department}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{f.title}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{f.description}</div>
                    </td>
                    <td style={td}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                        background: (CAT_COLORS as any)[f.category] + '20',
                        color: (CAT_COLORS as any)[f.category],
                      }}>{f.category}</span>
                    </td>
                    <td style={td}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                        background: (STATUS_COLORS as any)[f.status] + '20',
                        color: (STATUS_COLORS as any)[f.status],
                      }}>{f.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 50 && (
              <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 8 }}>
                Showing first 50 of {filtered.length}. Refine filters to see more.
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

/* -----------------------------------------------------------
   Sub-components
----------------------------------------------------------- */

const th: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 10,
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const td: React.CSSProperties = {
  padding: '8px 10px',
  verticalAlign: 'top',
  color: '#334155',
};

const Stat: React.FC<{ color: string; label: string; value: number; icon: React.ReactNode }> = ({ color, label, value, icon }) => (
  <div
    style={{
      background: '#fff',
      borderRadius: 10,
      padding: 12,
      borderLeft: `4px solid ${color}`,
      boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}
  >
    <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '20', color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
    </div>
  </div>
);

const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <PieIcon size={14} color="#2563eb" />
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
      </div>
      {subtitle && <p style={{ margin: '2px 0 0 22px', fontSize: 11, color: '#64748b' }}>{subtitle}</p>}
    </div>
    {children}
  </div>
);

const Empty: React.FC<{ hint?: string }> = ({ hint }) => (
  <div style={{ padding: '20px', color: '#94a3b8', textAlign: 'center', fontSize: 12 }}>
    {hint || 'No data for this slice.'}
  </div>
);

const Legend: React.FC<{ items: { color: string; label: string }[] }> = ({ items }) => (
  <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: '#64748b' }}>
    {items.map(it => (
      <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 10, height: 10, background: it.color, borderRadius: 2, display: 'inline-block' }} />
        {it.label}
      </span>
    ))}
  </div>
);

/* Pure-SVG donut so we don't pull in another chart lib */
const DonutChart: React.FC<{ slices: { label: string; value: number; color: string }[] }> = ({ slices }) => {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = 38;
  const cx = 50;
  const cy = 50;
  let acc = 0;
  return (
    <svg width="120" height="120" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
      {slices.map((s, i) => {
        const fraction = s.value / total;
        const dasharray = `${fraction * 2 * Math.PI * r} ${2 * Math.PI * r}`;
        const dashoffset = -acc * 2 * Math.PI * r;
        acc += fraction;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="14"
            strokeDasharray={dasharray}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          >
            <title>{`${s.label}: ${s.value}`}</title>
          </circle>
        );
      })}
      <text x="50" y="48" textAnchor="middle" fontSize="14" fontWeight="700" fill="#0f172a">{total}</text>
      <text x="50" y="60" textAnchor="middle" fontSize="8" fill="#64748b">total</text>
    </svg>
  );
};

export default AuditAnalysis;
