import React, { useEffect, useMemo, useState } from 'react';
import RoleAIGuide from '../../../components/RoleAIGuide';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Building2,
  CheckSquare,
  Award,
  Plus,
  ListChecks,
  Calendar,
  FileText,
  Clipboard,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Activity,
  Target,
  AlertCircle,
} from 'lucide-react';
import '../../../styles/AuditorCoordinator/Dashboard.css';
import { loadProfile, CoordinatorProfile } from '../Profile';
import { seedDashboardDemoData } from './dashboardSeed';
import RoleWorkflowOverview from '../../../components/RoleWorkflowOverview';

// Seed Dashboard demo data on module load so the very first render reads non-empty
// localStorage. Idempotent and guarded by a one-time flag.
seedDashboardDemoData();

/* -----------------------------------------------------------
   Storage helpers
----------------------------------------------------------- */

const safeJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const STANDARDS = [
  { code: 'ISO 9001:2015', short: 'ISO 9001', color: '#0ea5e9' },
  { code: 'ISO 14001:2015', short: 'ISO 14001', color: '#10b981' },
  { code: 'ISO 45001:2018', short: 'ISO 45001', color: '#f59e0b' },
  { code: 'ISO 27001:2022', short: 'ISO 27001', color: '#8b5cf6' },
  { code: 'ISO 42001:2023', short: 'ISO 42001', color: '#ec4899' },
];

interface Stats {
  totalAuditors: number;
  activeAuditors: number;
  totalClients: number;
  approvedClients: number;
  pendingClients: number;
  scheduledAudits: number;
  upcomingAudits: number;
  inProgressAudits: number;
  completedAudits: number;
  totalCertifications: number;
  totalScopes: number;
  totalChecklists: number;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CoordinatorProfile | null>(null);
  const [now, setNow] = useState(new Date());
  const [coveragePeriod, setCoveragePeriod] = useState<'all' | 'year' | 'quarter' | 'month' | 'week' | 'day'>('all');
  const [recentPeriod, setRecentPeriod] = useState<'all' | 'year' | 'month' | 'week'>('all');

  useEffect(() => {
    setProfile(loadProfile());
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail) setProfile(ce.detail as CoordinatorProfile);
    };
    window.addEventListener('coordinator-profile-updated', handler);
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.removeEventListener('coordinator-profile-updated', handler);
      window.clearInterval(t);
    };
  }, []);

  // Compute live stats from localStorage. Memo on date so it refreshes once a minute.
  const stats: Stats = useMemo(() => {
    const auditors = safeJSON<any[]>('cms_auditors', []);
    const clients = safeJSON<any[]>('cms_client_registrations', []);
    const schedules = [...safeJSON<any[]>('cms_audit_schedules', []), ...safeJSON<any[]>('cms_audit_schedules_v3', [])];
    const certifications = safeJSON<any[]>('cms_audit_certifications', []);
    const scopes = safeJSON<any[]>('cms_audit_scopes', []);
    const checklists = safeJSON<any[]>('cms_audit_checklists', []);

    const today = Date.now();
    const upcoming = schedules.filter((s: any) => {
      const dt = new Date(s.date || s.scheduledDate || s.startDate || 0).getTime();
      return dt > today;
    }).length;

    const inProgress = schedules.filter((s: any) => {
      const status = (s.status || '').toLowerCase();
      return status.includes('progress') || status === 'ongoing';
    }).length;

    const completed = schedules.filter((s: any) => {
      const status = (s.status || '').toLowerCase();
      return status === 'completed' || status === 'closed' || status === 'done';
    }).length;

    return {
      totalAuditors: auditors.length,
      activeAuditors: auditors.filter((a: any) => (a.status || 'Active') === 'Active').length,
      totalClients: clients.length,
      approvedClients: clients.filter((c: any) => c.status === 'Client Approved').length,
      pendingClients: clients.filter((c: any) => c.status === 'Pending').length,
      scheduledAudits: schedules.length,
      upcomingAudits: upcoming,
      inProgressAudits: inProgress,
      completedAudits: completed,
      totalCertifications: certifications.length,
      totalScopes: scopes.length,
      totalChecklists: checklists.length,
    };
  }, [now]);

  const recentCutoffMs = useMemo(() => {
    if (recentPeriod === 'all') return 0;
    const map = { year: 365, month: 30, week: 7 } as const;
    return Date.now() - (map as any)[recentPeriod] * 86400000;
  }, [recentPeriod]);

  const recentSchedules = useMemo(() => {
    const schedules = [...safeJSON<any[]>('cms_audit_schedules', []), ...safeJSON<any[]>('cms_audit_schedules_v3', [])];
    return schedules
      .slice()
      .filter((s: any) => {
        if (recentCutoffMs === 0) return true;
        const t = new Date(s.date || s.scheduledDate || s.startDate || 0).getTime();
        return !isNaN(t) && t >= recentCutoffMs;
      })
      .sort((a: any, b: any) => {
        const da = new Date(a.date || a.scheduledDate || a.startDate || 0).getTime();
        const db = new Date(b.date || b.scheduledDate || b.startDate || 0).getTime();
        return db - da;
      })
      .slice(0, 5);
  }, [now, recentCutoffMs]);

  const standardsCoverage = useMemo(() => {
    const scopes = safeJSON<any[]>('cms_audit_scopes', []);
    const clients = safeJSON<any[]>('cms_client_registrations', []);

    // Compute the cutoff timestamp for the selected period; 0 means "all time"
    const periodMs: Record<typeof coveragePeriod, number> = {
      all: 0,
      year: 365 * 86400000,
      quarter: 90 * 86400000,
      month: 30 * 86400000,
      week: 7 * 86400000,
      day: 1 * 86400000,
    };
    const cutoff = coveragePeriod === 'all' ? 0 : Date.now() - periodMs[coveragePeriod];

    const inWindow = (iso: any): boolean => {
      if (cutoff === 0) return true;
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return !isNaN(t) && t >= cutoff;
    };

    const filteredScopes = scopes.filter((s: any) =>
      inWindow(s.createdAt || s.updatedAt || s.date)
    );
    const filteredClients = clients.filter((c: any) =>
      inWindow(c.registrationDate || c.createdAt || c.submittedAt)
    );

    const counts = STANDARDS.map((s) => {
      const inScopes = filteredScopes.filter((sc: any) => sc.standard === s.code).length;
      const inClients = filteredClients.filter((c: any) => c.standard === s.code).length;
      return { ...s, count: inScopes + inClients };
    });
    return counts;
  }, [now, coveragePeriod]);

  const recentClients = useMemo(() => {
    const clients = safeJSON<any[]>('cms_client_registrations', []);
    return clients
      .slice()
      .filter((c: any) => {
        if (recentCutoffMs === 0) return true;
        const t = new Date(c.registrationDate || c.createdAt || 0).getTime();
        return !isNaN(t) && t >= recentCutoffMs;
      })
      .sort((a: any, b: any) => {
        const da = new Date(a.registrationDate || a.createdAt || 0).getTime();
        const db = new Date(b.registrationDate || b.createdAt || 0).getTime();
        return db - da;
      })
      .slice(0, 6)
      .map((c: any) => ({
        name: c.organizationName || c.name || 'Unnamed Client',
        standard: c.standard || 'No standard',
        status: c.status || 'Pending',
        date: c.registrationDate || c.createdAt || '',
      }));
  }, [now, recentCutoffMs]);

  const greetingTitle = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
  }, [now]);

  const formattedDate = now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Donut chart math for audit status distribution
  const donut = useMemo(() => {
    const upcoming = stats.upcomingAudits;
    const inProgress = stats.inProgressAudits;
    const completed = stats.completedAudits;
    const totalRaw = upcoming + inProgress + completed;
    const total = totalRaw > 0 ? totalRaw : 1;
    const segments = [
      { label: 'Upcoming', value: upcoming || (totalRaw === 0 ? 1 : 0), color: '#0ea5e9' },
      { label: 'In Progress', value: inProgress, color: '#f59e0b' },
      { label: 'Completed', value: completed, color: '#10b981' },
    ];
    let acc = 0;
    const arcs = segments.map((seg) => {
      const fraction = seg.value / total;
      const start = acc;
      const end = acc + fraction;
      acc = end;
      return { ...seg, start, end, fraction };
    });
    return { arcs, total: totalRaw, hasData: totalRaw > 0 };
  }, [stats]);

  const polarToCart = (cx: number, cy: number, r: number, frac: number) => {
    const angle = -Math.PI / 2 + frac * Math.PI * 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const arcPath = (cx: number, cy: number, r: number, start: number, end: number) => {
    const [sx, sy] = polarToCart(cx, cy, r, start);
    const [ex, ey] = polarToCart(cx, cy, r, end);
    const large = end - start > 0.5 ? 1 : 0;
    return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z`;
  };

  const profileFirstName =
    (profile?.name || 'Coordinator').split(' ')[0] || 'Coordinator';

  const coverageMax = Math.max(1, ...standardsCoverage.map((s) => s.count));

  const getStatusClass = (status: string) => {
    const s = (status || 'pending').toLowerCase().replace(/\s+/g, '-');
    return `status-badge status-${s}`;
  };

  /* -------------------- Render -------------------- */
  return (
    <div className="dashboard-container coord-dashboard">
      <RoleAIGuide />
      <RoleWorkflowOverview role="Audit Coordinator" />
      {/* HERO */}
      <div className="dash-hero">
        <div className="dash-hero-bg" />
        <div className="dash-hero-content">
          <div className="dash-hero-left">
            <div className="dash-hero-avatar">
              {profile?.photo ? (
                <img src={profile.photo} alt={profile?.name || 'Profile'} />
              ) : (
                <div className="dash-hero-avatar-fallback">
                  {profileFirstName.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <p className="dash-hero-eyebrow">
                <Sparkles size={14} /> {greetingTitle}
              </p>
              <h1 className="dash-hero-title">
                Welcome back, {profileFirstName}
              </h1>
              <p className="dash-hero-sub">
                In the Audit Coordinator role, we need to work now.
              </p>
              <div className="dash-hero-meta">
                <span><Calendar size={14} /> {formattedDate}</span>
                <span><Clock size={14} /> {formattedTime}</span>
                <span><ShieldCheck size={14} /> {STANDARDS.length} standards in play</span>
              </div>
            </div>
          </div>
          <div className="dash-hero-right">
            <button
              className="dash-hero-cta primary"
              onClick={() => navigate('/auditor-coordinator/audit-schedules')}
            >
              <Plus size={16} /> Audit Schedule
            </button>
            <button
              className="dash-hero-cta ghost"
              onClick={() => navigate('/auditor-coordinator/profile')}
            >
              View Profile <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid">
        <div
          className="kpi-card kpi-cyan"
          onClick={() => navigate('/auditor-coordinator/auditor-profiles')}
        >
          <div className="kpi-icon"><Users size={22} /></div>
          <div className="kpi-body">
            <p className="kpi-label">Total Auditors</p>
            <p className="kpi-value">{stats.totalAuditors}</p>
            <p className="kpi-trend up"><TrendingUp size={12} /> {stats.activeAuditors} active</p>
          </div>
          <ArrowUpRight size={16} className="kpi-arrow" />
        </div>

        <div
          className="kpi-card kpi-violet"
          onClick={() => navigate('/auditor-coordinator/client-registration')}
        >
          <div className="kpi-icon"><Building2 size={22} /></div>
          <div className="kpi-body">
            <p className="kpi-label">Registered Clients</p>
            <p className="kpi-value">{stats.totalClients}</p>
            <p className="kpi-trend">
              <span className="dot dot-green" /> {stats.approvedClients} approved
              <span className="dot dot-amber" /> {stats.pendingClients} pending
            </p>
          </div>
          <ArrowUpRight size={16} className="kpi-arrow" />
        </div>

        <div
          className="kpi-card kpi-amber"
          onClick={() => navigate('/auditor-coordinator/audit-schedules')}
        >
          <div className="kpi-icon"><CheckSquare size={22} /></div>
          <div className="kpi-body">
            <p className="kpi-label">Audit Schedules</p>
            <p className="kpi-value">{stats.scheduledAudits}</p>
            <p className="kpi-trend up"><Activity size={12} /> {stats.upcomingAudits} upcoming</p>
          </div>
          <ArrowUpRight size={16} className="kpi-arrow" />
        </div>

        <div
          className="kpi-card kpi-emerald"
          onClick={() => navigate('/auditor-coordinator/audit-certifications')}
        >
          <div className="kpi-icon"><Award size={22} /></div>
          <div className="kpi-body">
            <p className="kpi-label">Certifications</p>
            <p className="kpi-value">{stats.totalCertifications}</p>
            <p className="kpi-trend"><Target size={12} /> {stats.totalScopes} scopes defined</p>
          </div>
          <ArrowUpRight size={16} className="kpi-arrow" />
        </div>
      </div>

      {/* Status donut + Quick actions */}
      <div className="dash-row">
        <div className="dash-card chart-card">
          <div className="dash-card-head">
            <div>
              <h2>Audit Status Overview</h2>
              <p>Distribution of all scheduled audits</p>
            </div>
            <button
              className="dash-link"
              onClick={() => navigate('/auditor-coordinator/audit-schedules')}
            >
              View all <ChevronRight size={14} />
            </button>
          </div>

          <div className="chart-body">
            <div className="donut-wrap">
              <svg viewBox="0 0 200 200" width="200" height="200" className="donut">
                {donut.arcs.map((arc, i) =>
                  arc.fraction > 0 ? (
                    <path
                      key={i}
                      d={arcPath(100, 100, 90, arc.start, arc.end)}
                      fill={donut.hasData ? arc.color : '#e2e8f0'}
                    />
                  ) : null
                )}
                <circle cx="100" cy="100" r="58" fill="#fff" />
              </svg>
              <div className="donut-center">
                <div className="donut-center-value">{stats.scheduledAudits}</div>
                <div className="donut-center-label">Total audits</div>
              </div>
            </div>

            <div className="donut-legend">
              <div className="legend-row">
                <span className="legend-swatch" style={{ background: '#0ea5e9' }} />
                <span className="legend-name">Upcoming</span>
                <span className="legend-value">{stats.upcomingAudits}</span>
              </div>
              <div className="legend-row">
                <span className="legend-swatch" style={{ background: '#f59e0b' }} />
                <span className="legend-name">In Progress</span>
                <span className="legend-value">{stats.inProgressAudits}</span>
              </div>
              <div className="legend-row">
                <span className="legend-swatch" style={{ background: '#10b981' }} />
                <span className="legend-name">Completed</span>
                <span className="legend-value">{stats.completedAudits}</span>
              </div>
              {!donut.hasData && (
                <div className="legend-empty">
                  <AlertCircle size={14} /> No schedules yet — create one to get started.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="dash-card actions-card">
          <div className="dash-card-head">
            <div>
              <h2>Quick Actions</h2>
              <p>Jump to the most common tasks</p>
            </div>
          </div>
          <div className="action-grid">
            <button
              className="action-tile tile-cyan"
              onClick={() => navigate('/auditor-coordinator/audit-schedules')}
            >
              <span className="tile-icon"><Plus size={20} /></span>
              <span className="tile-label">New Audit</span>
              <span className="tile-sub">Schedule a new audit</span>
            </button>
            <button
              className="action-tile tile-violet"
              onClick={() => navigate('/auditor-coordinator/auditor-profiles')}
            >
              <span className="tile-icon"><Users size={20} /></span>
              <span className="tile-label">Add Auditor</span>
              <span className="tile-sub">Create a profile</span>
            </button>
            <button
              className="action-tile tile-amber"
              onClick={() => navigate('/auditor-coordinator/audit-checklists')}
            >
              <span className="tile-icon"><ListChecks size={20} /></span>
              <span className="tile-label">Create Checklist</span>
              <span className="tile-sub">Build a new checklist</span>
            </button>
            <button
              className="action-tile tile-emerald"
              onClick={() => navigate('/auditor-coordinator/client-registration')}
            >
              <span className="tile-icon"><Building2 size={20} /></span>
              <span className="tile-label">Register Client</span>
              <span className="tile-sub">Onboard a new client</span>
            </button>
            <button
              className="action-tile tile-pink"
              onClick={() => navigate('/auditor-coordinator/audit-scope')}
            >
              <span className="tile-icon"><Clipboard size={20} /></span>
              <span className="tile-label">Define Scope</span>
              <span className="tile-sub">Set audit scope</span>
            </button>
            <button
              className="action-tile tile-indigo"
              onClick={() => navigate('/auditor-coordinator/audit-report')}
            >
              <span className="tile-icon"><FileText size={20} /></span>
              <span className="tile-label">Audit Reports</span>
              <span className="tile-sub">Review reports</span>
            </button>
          </div>
        </div>
      </div>

      {/* Period filter for Recent Audits + Recent Clients */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4 }}>
          Recent period
        </span>
        {([
          { key: 'week', label: '1 Week' },
          { key: 'month', label: '1 Month' },
          { key: 'year', label: '1 Year' },
          { key: 'all', label: 'All' },
        ] as const).map(p => (
          <button
            key={p.key}
            type="button"
            onClick={() => setRecentPeriod(p.key)}
            style={{
              padding: '4px 11px', borderRadius: 14,
              border: '1px solid ' + (recentPeriod === p.key ? '#2563eb' : '#cbd5e1'),
              background: recentPeriod === p.key ? '#2563eb' : '#fff',
              color: recentPeriod === p.key ? '#fff' : '#475569',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', lineHeight: 1.2,
            }}
          >{p.label}</button>
        ))}
      </div>

      {/* Recent audits + activity feed */}
      <div className="dash-row dash-row-2">
        <div className="dash-card recent-table-card">
          <div className="dash-card-head">
            <div>
              <h2>Recent Audits</h2>
              <p>Latest schedules and their status</p>
            </div>
            <button
              className="dash-link"
              onClick={() => navigate('/auditor-coordinator/audit-schedules')}
            >
              See all <ChevronRight size={14} />
            </button>
          </div>
          {recentSchedules.length === 0 ? (
            <div className="empty-state">
              <Calendar size={28} />
              <p>No audits scheduled yet.</p>
              <button
                className="empty-cta"
                onClick={() => navigate('/auditor-coordinator/audit-schedules')}
              >
                Create your first schedule
              </button>
            </div>
          ) : (
            <div className="table-wrap-clean">
              <table className="audits-table">
                <thead>
                  <tr>
                    <th>Audit</th>
                    <th>Standard</th>
                    <th>Status</th>
                    <th>Lead</th>
                    <th>Date</th>
                    <th>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSchedules.map((s: any, idx: number) => (
                    <tr key={s.id || idx}>
                      <td className="audit-name">
                        {s.organizationName || s.client || s.title || 'Audit'}
                      </td>
                      <td><span className="std-chip">{s.standard || '—'}</span></td>
                      <td>
                        <span className={getStatusClass(s.status || 'Pending')}>
                          {s.status || 'Pending'}
                        </span>
                      </td>
                      <td>{s.leadAuditor || s.assignedTo || '—'}</td>
                      <td>{s.date || s.scheduledDate || '—'}</td>
                      <td style={{ fontSize: 11, color: '#64748b' }}>
                        {(() => {
                          const t = new Date(s.date || s.scheduledDate || s.createdAt || 0).getTime();
                          if (!t || isNaN(t)) return '—';
                          const diff = Date.now() - t;
                          const d = Math.floor(diff / 86400000);
                          if (d < 0) return `in ${Math.abs(d)}d`;
                          if (d === 0) return 'today';
                          if (d < 30) return `${d}d ago`;
                          if (d < 365) return `${Math.floor(d / 30)}mo ago`;
                          return `${Math.floor(d / 365)}y ago`;
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="dash-card activity-card">
          <div className="dash-card-head">
            <div>
              <h2>Recent Clients</h2>
              <p>Most recently registered clients</p>
            </div>
          </div>
          {recentClients.length === 0 ? (
            <div className="empty-state-mini">
              <Building2 size={20} />
              <p>No clients registered yet.</p>
            </div>
          ) : (
            <div className="activity-list">
              {recentClients.map((c, i) => (
                <div
                  key={i}
                  className="activity-item activity-doc"
                  onClick={() => navigate('/auditor-coordinator/client-registration')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="activity-icon">
                    <Building2 size={14} />
                  </div>
                  <div className="activity-body">
                    <p className="activity-title">{c.name}</p>
                    <p className="activity-meta">
                      {c.standard} <span className={getStatusClass(c.status)} style={{ marginLeft: 6 }}>{c.status}</span>
                      {c.date && (() => {
                        const t = new Date(c.date).getTime();
                        if (!t || isNaN(t)) return null;
                        const diff = Date.now() - t;
                        const d = Math.floor(diff / 86400000);
                        const label = d < 0 ? `in ${Math.abs(d)}d` : d === 0 ? 'today' :
                          d < 30 ? `${d}d ago` : d < 365 ? `${Math.floor(d/30)}mo ago` :
                          `${Math.floor(d/365)}y ago`;
                        return <span style={{ marginLeft: 6, fontSize: 11, color: '#94a3b8' }}>· {label}</span>;
                      })()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Standards coverage */}
      <div className="dash-card coverage-card">
        <div className="dash-card-head">
          <div>
            <h2>Audit (Standards) Coverage</h2>
            <p>How your scopes and clients are distributed across ISO standards · <strong>{coveragePeriod === 'all' ? 'all time' : coveragePeriod === 'year' ? 'last year' : coveragePeriod === 'quarter' ? 'last 90 days' : coveragePeriod === 'month' ? 'last 30 days' : coveragePeriod === 'week' ? 'last 7 days' : 'last 24 hours'}</strong></p>
          </div>
          <button
            className="dash-link"
            onClick={() => navigate('/auditor-coordinator/audit-scope')}
          >
            Manage scopes <ChevronRight size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {([
            { key: 'all',     label: 'All' },
            { key: 'year',    label: '1 Year' },
            { key: 'quarter', label: '1 Quarter' },
            { key: 'month',   label: '1 Month' },
            { key: 'week',    label: '1 Week' },
            { key: 'day',     label: '1 Day' },
          ] as const).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setCoveragePeriod(p.key)}
              style={{
                padding: '4px 12px',
                borderRadius: 14,
                border: '1px solid ' + (coveragePeriod === p.key ? '#2563eb' : '#cbd5e1'),
                background: coveragePeriod === p.key ? '#2563eb' : '#fff',
                color: coveragePeriod === p.key ? '#fff' : '#475569',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                lineHeight: 1.2,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="coverage-list">
          {standardsCoverage.map((s) => (
            <div key={s.code} className="coverage-row">
              <div className="coverage-meta">
                <span className="coverage-dot" style={{ background: s.color }} />
                <span className="coverage-name">{s.short}</span>
                <span className="coverage-full">{s.code}</span>
              </div>
              <div className="coverage-bar">
                <div
                  className="coverage-fill"
                  style={{
                    width: `${(s.count / coverageMax) * 100}%`,
                    background: s.color,
                  }}
                />
              </div>
              <div className="coverage-value">{s.count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
