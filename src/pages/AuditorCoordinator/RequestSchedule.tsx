import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  X,
  Send,
  User,
  Building2,
  Users,
  Trash2,
} from 'lucide-react';
import { getAuditors } from './utils/dataStorage';
import AIPanel from '../../components/AIPanel';
import { suggestAuditorsFor, topPickNote, calcAuditDays } from '../../ai/coordinatorInsights';
import type { AuditStage } from '../../ai/coordinatorInsights';
import { onCmsChange } from '../../ai/liveData';

// ---------- Types ----------

interface ScheduleLike {
  id: string | number;
  organization?: string;
  date: string; // YYYY-MM-DD
  duration?: string;
  auditor?: string;
  leadAuditor?: string;
  auditType?: string;
  status?: string;
  certificationStandard?: string;
}

interface ScheduleRequest {
  id: string;
  organization: string;
  auditor: string;
  leadAuditor: string;
  date: string;
  duration: string;
  auditType: string;
  certificationStandard: string;
  notes?: string;
  status: 'Pending' | 'Confirmed' | 'Rejected';
  createdAt: string;
  hasConflict: boolean;
  conflictWith?: string;
}

const REQUESTS_KEY = 'cms_schedule_requests_v1';
const SCHEDULES_KEY = 'cms_audit_schedules_v3';

// ---------- Helpers ----------

const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const monthLabel = (d: Date) =>
  d.toLocaleString('en-US', { month: 'long', year: 'numeric' });

const parseDuration = (s?: string): number => {
  if (!s) return 1;
  const m = s.match(/(\d+(\.\d+)?)/);
  return m ? Math.max(1, Math.round(Number(m[1]))) : 1;
};

const dayRange = (start: string, days: number): string[] => {
  const out: string[] = [];
  const d0 = new Date(start);
  for (let i = 0; i < days; i++) {
    const d = new Date(d0);
    d.setDate(d0.getDate() + i);
    out.push(ymd(d));
  }
  return out;
};

const monthGrid = (anchor: Date): Array<{ date: Date; inMonth: boolean }> => {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startWeekday = first.getDay(); // 0=Sun
  const start = new Date(first);
  start.setDate(first.getDate() - startWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { date: d, inMonth: d.getMonth() === anchor.getMonth() };
  });
};

// Heatmap color from count (0..max) — light slate -> deep blue -> red for hot
const heatColor = (count: number, max: number): string => {
  if (count === 0) return '#f8fafc';
  const ratio = Math.min(1, count / Math.max(1, max));
  if (ratio < 0.34) return '#dbeafe'; // blue-100
  if (ratio < 0.67) return '#60a5fa'; // blue-400
  if (ratio < 0.9) return '#2563eb'; // blue-600
  return '#dc2626'; // red-600 — over capacity
};

const heatTextColor = (count: number, max: number): string => {
  if (count === 0) return '#475569';
  const ratio = Math.min(1, count / Math.max(1, max));
  return ratio < 0.34 ? '#1e3a8a' : 'white';
};

// Conflict check: does (auditor + date for `days` days) overlap anything existing?
const findConflict = (
  auditor: string,
  start: string,
  days: number,
  existingSchedules: ScheduleLike[],
  existingRequests: ScheduleRequest[]
): { conflict: boolean; with?: string } => {
  if (!auditor || !start) return { conflict: false };
  const requested = new Set(dayRange(start, days));
  // Check committed schedules
  for (const s of existingSchedules) {
    const sameAuditor =
      s.auditor === auditor || s.leadAuditor === auditor;
    if (!sameAuditor) continue;
    const sDays = dayRange(s.date, parseDuration(s.duration));
    for (const day of sDays) {
      if (requested.has(day)) {
        return {
          conflict: true,
          with: `${s.organization || 'audit'} on ${s.date}`,
        };
      }
    }
  }
  // Check pending requests
  for (const r of existingRequests) {
    if (r.status === 'Rejected') continue;
    const sameAuditor = r.auditor === auditor || r.leadAuditor === auditor;
    if (!sameAuditor) continue;
    const rDays = dayRange(r.date, parseDuration(r.duration));
    for (const day of rDays) {
      if (requested.has(day)) {
        return {
          conflict: true,
          with: `request for ${r.organization} on ${r.date}`,
        };
      }
    }
  }
  return { conflict: false };
};

// ---------- Component ----------

// ---------- AI panels (Features 6 + 7) ----------

/** Smart Scheduling Copilot — auditor suggestions for pending requests. */
const RequestCopilotPanel: React.FC<{ requests: ScheduleRequest[] }> = ({ requests }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => onCmsChange(() => setTick((t) => t + 1)), []);

  const suggestions = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () =>
      requests
        .filter((r) => r.status === 'Pending')
        .slice(0, 4)
        .map((r) => ({
          r,
          matches: suggestAuditorsFor({
            standard: r.certificationStandard,
            date: r.date,
          }),
        })),
    [requests, tick]
  );

  return (
    <AIPanel
      title="Smart Scheduling Copilot"
      subtitle="Top auditor matches for each pending request — standard fit, availability and workload"
      onRefresh={() => setTick((t) => t + 1)}
    >
      {suggestions.length === 0 ? (
        <p className="ai-panel-note">No pending schedule requests — nothing to match right now.</p>
      ) : (
        <ul className="ai-insight-list">
          {suggestions.map(({ r, matches }) => (
            <li key={r.id}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <strong style={{ fontSize: 13, color: '#0f172a' }}>{r.organization}</strong>
                <span className="ai-chip info">{r.certificationStandard}</span>
                <span className="ai-chip info">{r.date}</span>
                {r.hasConflict && <span className="ai-chip high">Conflict</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {matches.map((m, i) => (
                  <span
                    key={m.auditor.name}
                    className={'ai-chip ' + (i === 0 ? 'low' : 'info')}
                    title={[...m.reasons, ...m.warnings].join(' · ') || 'No signals'}
                  >
                    #{i + 1} {m.auditor.name} · {Math.round(m.confidence * 100)}%
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{topPickNote(matches)}</div>
            </li>
          ))}
        </ul>
      )}
      <p className="ai-panel-note">Hover a chip for the full reasoning. Requested auditors with clashes are scored down automatically.</p>
    </AIPanel>
  );
};

/** IAF MD5-style Audit-Days Calculator. */
const AuditDaysCalculatorPanel: React.FC = () => {
  const [employees, setEmployees] = useState(50);
  const [sites, setSites] = useState(1);
  const [standard, setStandard] = useState('ISO 9001:2015');
  const [stage, setStage] = useState<AuditStage>('initial');

  const result = useMemo(
    () => calcAuditDays(employees, sites, standard, stage),
    [employees, sites, standard, stage]
  );

  const calcInput: React.CSSProperties = {
    padding: '7px 9px',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    fontSize: 13,
    width: '100%',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  return (
    <AIPanel
      title="Audit-Days Calculator"
      subtitle="IAF MD5-style man-day estimate from employees, sites and audit stage"
      defaultCollapsed
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
          Employees
          <input
            type="number"
            min={1}
            value={employees}
            onChange={(e) => setEmployees(Math.max(1, Number(e.target.value) || 1))}
            style={{ ...calcInput, marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
          Sites
          <input
            type="number"
            min={1}
            value={sites}
            onChange={(e) => setSites(Math.max(1, Number(e.target.value) || 1))}
            style={{ ...calcInput, marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
          Standard
          <select value={standard} onChange={(e) => setStandard(e.target.value)} style={{ ...calcInput, marginTop: 4 }}>
            <option>ISO 9001:2015</option>
            <option>ISO 14001:2015</option>
            <option>ISO 45001:2018</option>
            <option>ISO 27001:2022</option>
            <option>ISO 22000:2018</option>
          </select>
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
          Audit stage
          <select value={stage} onChange={(e) => setStage(e.target.value as AuditStage)} style={{ ...calcInput, marginTop: 4 }}>
            <option value="initial">Initial certification</option>
            <option value="surveillance">Surveillance</option>
            <option value="recert">Recertification</option>
          </select>
        </label>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: '10px 14px',
          background: 'rgba(212,175,55,0.08)',
          border: '1px solid rgba(212,175,55,0.35)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#b8860b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Recommended
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
            {result.totalDays} day{result.totalDays !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span className="ai-chip info">Tier: {result.tierLabel}</span>
          <span className="ai-chip info">Stage: {result.stageDays}d</span>
          {result.siteExtra > 0 && <span className="ai-chip med">Sites: +{result.siteExtra}d</span>}
        </div>
      </div>
      {result.notes.map((n) => (
        <p key={n} className="ai-panel-note">{n}</p>
      ))}
    </AIPanel>
  );
};

const RequestSchedule: React.FC = () => {
  const [anchor, setAnchor] = useState(new Date());
  const [schedules, setSchedules] = useState<ScheduleLike[]>([]);
  const [requests, setRequests] = useState<ScheduleRequest[]>([]);
  const [auditors, setAuditors] = useState<any[]>(getAuditors());

  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({
    organization: '',
    auditor: '',
    leadAuditor: '',
    date: ymd(new Date()),
    duration: '1',
    auditType: 'Initial',
    certificationStandard: 'ISO 9001:2015',
    notes: '',
  });

  // Filter for the heatmap (which auditor's load to show)
  const [filterAuditor, setFilterAuditor] = useState<string>('');

  // ---------- Load data ----------

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCHEDULES_KEY);
      if (raw) setSchedules(JSON.parse(raw));
    } catch {}
    try {
      const raw = localStorage.getItem(REQUESTS_KEY);
      if (raw) setRequests(JSON.parse(raw));
    } catch {}
    setAuditors(getAuditors());
  }, []);

  // Persist requests
  useEffect(() => {
    try {
      localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
    } catch {}
  }, [requests]);

  // ---------- Heatmap data ----------

  // Combine committed schedules + non-rejected requests
  const allBookings: ScheduleLike[] = useMemo(() => {
    const reqAsSched: ScheduleLike[] = requests
      .filter((r) => r.status !== 'Rejected')
      .map((r) => ({
        id: r.id,
        organization: r.organization,
        date: r.date,
        duration: r.duration,
        auditor: r.auditor,
        leadAuditor: r.leadAuditor,
        auditType: r.auditType,
        status: r.status,
      }));
    return [...schedules, ...reqAsSched];
  }, [schedules, requests]);

  // Map of YYYY-MM-DD => bookings for that day
  const bookingsByDay = useMemo(() => {
    const map = new Map<string, ScheduleLike[]>();
    for (const b of allBookings) {
      if (filterAuditor && b.auditor !== filterAuditor && b.leadAuditor !== filterAuditor) {
        continue;
      }
      const days = dayRange(b.date, parseDuration(b.duration));
      for (const d of days) {
        const arr = map.get(d) ?? [];
        arr.push(b);
        map.set(d, arr);
      }
    }
    return map;
  }, [allBookings, filterAuditor]);

  const grid = useMemo(() => monthGrid(anchor), [anchor]);
  const maxCount = useMemo(() => {
    let m = 1;
    bookingsByDay.forEach((arr) => {
      if (arr.length > m) m = arr.length;
    });
    return m;
  }, [bookingsByDay]);

  // ---------- Form: live conflict ----------

  const formDays = parseDuration(form.duration);
  const formConflict = useMemo(
    () =>
      findConflict(form.auditor || form.leadAuditor, form.date, formDays, schedules, requests),
    [form.auditor, form.leadAuditor, form.date, formDays, schedules, requests]
  );
  const leadConflict = useMemo(
    () =>
      form.leadAuditor && form.leadAuditor !== form.auditor
        ? findConflict(form.leadAuditor, form.date, formDays, schedules, requests)
        : { conflict: false },
    [form.leadAuditor, form.auditor, form.date, formDays, schedules, requests]
  );

  // ---------- Actions ----------

  const submitRequest = () => {
    if (!form.organization.trim() || !form.auditor || !form.date) {
      alert('Please fill organization, auditor and date.');
      return;
    }
    const conflict = findConflict(form.auditor, form.date, formDays, schedules, requests);
    const leadConf = form.leadAuditor && form.leadAuditor !== form.auditor
      ? findConflict(form.leadAuditor, form.date, formDays, schedules, requests)
      : { conflict: false };
    const totalConflict = conflict.conflict || leadConf.conflict;
    if (totalConflict) {
      const proceed = window.confirm(
        `Conflict detected with ${conflict.with || leadConf.with}. Submit request anyway?`
      );
      if (!proceed) return;
    }
    const req: ScheduleRequest = {
      id: `req-${Date.now()}`,
      organization: form.organization,
      auditor: form.auditor,
      leadAuditor: form.leadAuditor || form.auditor,
      date: form.date,
      duration: form.duration,
      auditType: form.auditType,
      certificationStandard: form.certificationStandard,
      notes: form.notes,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      hasConflict: totalConflict,
      conflictWith: conflict.with || leadConf.with,
    };
    setRequests((prev) => [req, ...prev]);
    setNewOpen(false);
    setForm({
      organization: '',
      auditor: '',
      leadAuditor: '',
      date: ymd(new Date()),
      duration: '1',
      auditType: 'Initial',
      certificationStandard: 'ISO 9001:2015',
      notes: '',
    });
  };

  const confirmRequest = (id: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'Confirmed' } : r))
    );
  };

  const rejectRequest = (id: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'Rejected' } : r))
    );
  };

  const deleteRequest = (id: string) => {
    if (!window.confirm('Delete this schedule request?')) return;
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  // ---------- Render ----------

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const totalReq = requests.length;
  const pendingCount = requests.filter((r) => r.status === 'Pending').length;
  const conflictCount = requests.filter((r) => r.hasConflict && r.status !== 'Rejected').length;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: '#4338ca',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CalendarIcon size={22} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, color: '#0f172a' }}>Request Schedule</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Calendar heatmap with availability & conflict detection
            </p>
          </div>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            backgroundColor: '#4338ca',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={16} /> New Schedule Request
        </button>
      </div>

      {/* AI: scheduling copilot + audit-days calculator */}
      <RequestCopilotPanel requests={requests} />
      <AuditDaysCalculatorPanel />

      {/* Stat row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <StatCard
          icon={<CalendarIcon size={18} color="#2563eb" />}
          label="Total Requests"
          value={totalReq}
          tone="#dbeafe"
        />
        <StatCard
          icon={<Clock size={18} color="#d97706" />}
          label="Pending"
          value={pendingCount}
          tone="#fef3c7"
        />
        <StatCard
          icon={<AlertTriangle size={18} color="#dc2626" />}
          label="With Conflict"
          value={conflictCount}
          tone="#fee2e2"
        />
        <StatCard
          icon={<Users size={18} color="#0891b2" />}
          label="Auditors"
          value={auditors.length}
          tone="#cffafe"
        />
      </div>

      {/* Calendar heatmap */}
      <div
        style={{
          backgroundColor: 'white',
          padding: 20,
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
              style={iconBtn}
              title="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 style={{ margin: 0, fontSize: 18, color: '#0f172a', minWidth: 180, textAlign: 'center' }}>
              {monthLabel(anchor)}
            </h2>
            <button
              onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
              style={iconBtn}
              title="Next month"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => setAnchor(new Date())}
              style={{
                padding: '6px 12px',
                backgroundColor: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Today
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>
              Filter by auditor:
            </label>
            <select
              value={filterAuditor}
              onChange={(e) => setFilterAuditor(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                minWidth: 180,
              }}
            >
              <option value="">All auditors</option>
              {auditors.map((a: any) => (
                <option key={a.id} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>Less</span>
              {[0, 1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 2,
                    backgroundColor: heatColor(n, 4),
                    border: '1px solid #e2e8f0',
                  }}
                />
              ))}
              <span style={{ fontSize: 11, color: '#64748b' }}>More</span>
            </div>
          </div>
        </div>

        {/* Day name row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 6,
            marginBottom: 6,
          }}
        >
          {dayNames.map((n) => (
            <div
              key={n}
              style={{
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: '#64748b',
                textTransform: 'uppercase',
                padding: '4px 0',
              }}
            >
              {n}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 6,
          }}
        >
          {grid.map(({ date, inMonth }) => {
            const key = ymd(date);
            const list = bookingsByDay.get(key) ?? [];
            const count = list.length;
            const today = ymd(new Date()) === key;
            return (
              <div
                key={key}
                title={
                  count
                    ? list
                        .map(
                          (b) =>
                            `${b.organization || 'audit'} • ${b.auditor || b.leadAuditor || ''}`
                        )
                        .join('\n')
                    : 'No bookings'
                }
                style={{
                  minHeight: 76,
                  borderRadius: 8,
                  border: today ? '2px solid #4338ca' : '1px solid #e2e8f0',
                  backgroundColor: heatColor(count, maxCount),
                  color: heatTextColor(count, maxCount),
                  padding: 8,
                  opacity: inMonth ? 1 : 0.4,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: count ? 'pointer' : 'default',
                  transition: 'transform 0.1s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{date.getDate()}</span>
                  {count > maxCount * 0.8 && (
                    <AlertTriangle size={12} />
                  )}
                </div>
                {count > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 500 }}>
                    {count} audit{count !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Requests list */}
      <div
        style={{
          backgroundColor: 'white',
          padding: 20,
          borderRadius: 12,
          border: '1px solid #e2e8f0',
        }}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#0f172a' }}>
          Schedule Requests
        </h2>
        {requests.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
            No schedule requests yet. Click "New Schedule Request" to create one.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={th}>Organization</th>
                  <th style={th}>Auditor / Lead</th>
                  <th style={th}>Date</th>
                  <th style={th}>Duration</th>
                  <th style={th}>Type</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: r.hasConflict && r.status !== 'Rejected' ? '#fef2f2' : 'white',
                    }}
                  >
                    <td style={td}>
                      <div style={{ fontWeight: 500, color: '#0f172a' }}>
                        {r.organization}
                      </div>
                      {r.notes && (
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {r.notes.slice(0, 60)}
                          {r.notes.length > 60 ? '…' : ''}
                        </div>
                      )}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <User size={12} color="#64748b" /> {r.auditor}
                      </div>
                      {r.leadAuditor && r.leadAuditor !== r.auditor && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 2,
                          }}
                        >
                          Lead: {r.leadAuditor}
                        </div>
                      )}
                    </td>
                    <td style={td}>{r.date}</td>
                    <td style={td}>{r.duration} day{parseDuration(r.duration) !== 1 ? 's' : ''}</td>
                    <td style={td}>{r.auditType}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor:
                              r.status === 'Confirmed'
                                ? '#d1fae5'
                                : r.status === 'Rejected'
                                ? '#fee2e2'
                                : '#fef3c7',
                            color:
                              r.status === 'Confirmed'
                                ? '#047857'
                                : r.status === 'Rejected'
                                ? '#b91c1c'
                                : '#92400e',
                            display: 'inline-block',
                            width: 'fit-content',
                          }}
                        >
                          {r.status}
                        </span>
                        {r.hasConflict && r.status !== 'Rejected' && (
                          <span
                            title={r.conflictWith}
                            style={{
                              fontSize: 10,
                              color: '#dc2626',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <AlertTriangle size={11} />
                            Conflict
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {r.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => confirmRequest(r.id)}
                              style={smallBtn('#10b981')}
                              title="Confirm"
                            >
                              <CheckCircle2 size={12} /> Confirm
                            </button>
                            <button
                              onClick={() => rejectRequest(r.id)}
                              style={smallBtn('#ef4444')}
                              title="Reject"
                            >
                              <X size={12} /> Reject
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => deleteRequest(r.id)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                            border: '1px solid #cbd5e1',
                            borderRadius: 4,
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                          title="Delete request"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Request Modal */}
      {newOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setNewOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              maxWidth: 600,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>New Schedule Request</h3>
              <button onClick={() => setNewOpen(false)} style={iconBtn}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Organization" icon={<Building2 size={14} color="#64748b" />}>
                <input
                  type="text"
                  value={form.organization}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  placeholder="Client / Organization name"
                  style={input}
                />
              </Field>
              <div style={row2}>
                <Field label="Auditor (assigned)">
                  <select
                    value={form.auditor}
                    onChange={(e) => setForm({ ...form, auditor: e.target.value })}
                    style={input}
                  >
                    <option value="">Select auditor</option>
                    {auditors.map((a: any) => (
                      <option key={a.id} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Lead Auditor (optional)">
                  <select
                    value={form.leadAuditor}
                    onChange={(e) => setForm({ ...form, leadAuditor: e.target.value })}
                    style={input}
                  >
                    <option value="">Same as auditor</option>
                    {auditors.map((a: any) => (
                      <option key={a.id} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div style={row2}>
                <Field label="Start Date">
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    style={input}
                  />
                </Field>
                <Field label="Duration (days)">
                  <input
                    type="number"
                    min={1}
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    style={input}
                  />
                </Field>
              </div>
              <div style={row2}>
                <Field label="Audit Type">
                  <select
                    value={form.auditType}
                    onChange={(e) => setForm({ ...form, auditType: e.target.value })}
                    style={input}
                  >
                    <option>Initial</option>
                    <option>Surveillance 1</option>
                    <option>Surveillance 2</option>
                    <option>Recertification</option>
                    <option>Special</option>
                  </select>
                </Field>
                <Field label="Standard">
                  <input
                    type="text"
                    value={form.certificationStandard}
                    onChange={(e) =>
                      setForm({ ...form, certificationStandard: e.target.value })
                    }
                    placeholder="e.g. ISO 9001:2015"
                    style={input}
                  />
                </Field>
              </div>
              <Field label="Notes (optional)">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  style={{ ...input, resize: 'vertical' }}
                  placeholder="Anything the auditor should know…"
                />
              </Field>

              {/* Live conflict banner */}
              {(formConflict.conflict || leadConflict.conflict) && (
                <div
                  style={{
                    padding: 12,
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <AlertTriangle size={18} color="#dc2626" style={{ marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>
                    <strong>Scheduling conflict.</strong>{' '}
                    {formConflict.conflict && (
                      <>Auditor already booked for {formConflict.with}. </>
                    )}
                    {leadConflict.conflict && (
                      <>Lead auditor already booked for {leadConflict.with}.</>
                    )}
                    <br />
                    You can still submit, but it will be flagged for resolution.
                  </div>
                </div>
              )}
              {!formConflict.conflict && !leadConflict.conflict && form.auditor && form.date && (
                <div
                  style={{
                    padding: 12,
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <CheckCircle2 size={18} color="#16a34a" />
                  <div style={{ fontSize: 12, color: '#166534' }}>
                    No conflicts found. Auditor is available for the selected window.
                  </div>
                </div>
              )}
            </div>
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              <button
                onClick={() => setNewOpen(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitRequest}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#4338ca',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Send size={14} /> Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Small components ----------

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
}> = ({ icon, label, value, tone }) => (
  <div
    style={{
      padding: 16,
      backgroundColor: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}
  >
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: tone,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, color: '#0f172a', fontWeight: 700 }}>{value}</div>
    </div>
  </div>
);

const Field: React.FC<{ label: string; icon?: React.ReactNode; children: React.ReactNode }> = ({
  label,
  icon,
  children,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: '#475569',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {icon} {label}
    </label>
    {children}
  </div>
);

// ---------- Inline styles ----------

const iconBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  backgroundColor: 'white',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#475569',
};

const input: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 13,
  width: '100%',
  fontFamily: 'inherit',
};

const row2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
};

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 11,
  textTransform: 'uppercase',
  color: '#64748b',
  fontWeight: 600,
  borderBottom: '1px solid #e2e8f0',
};

const td: React.CSSProperties = {
  padding: '12px',
  verticalAlign: 'top',
  color: '#334155',
};

const smallBtn = (color: string): React.CSSProperties => ({
  padding: '4px 10px',
  backgroundColor: color,
  color: 'white',
  border: 'none',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
});

export default RequestSchedule;
