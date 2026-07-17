import React from 'react';
import RoleAIGuide from '../../components/RoleAIGuide';
import { Award, CalendarClock, AlertTriangle, FileCheck, Building2, ClipboardList, Bell, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCertifications, getAuditSchedules, getOrg, getNotifications } from './scope';
import { useRealtimeScope } from './useRealtimeScope';
import { LiveBar } from './LiveBar';

const StatCard: React.FC<{
  icon: React.ReactNode; label: string; value: number | string;
  color: string; bg: string; onClick: () => void;
}> = ({ icon, label, value, color, bg, onClick }) => (
  <div onClick={onClick} style={{
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
    padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'center',
    cursor: 'pointer', transition: 'box-shadow .15s',
  }}
    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,.08)')}
    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
  >
    <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{icon}</div>
    <div>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
    </div>
  </div>
);

const NavCard: React.FC<{ icon: React.ReactNode; label: string; desc: string; color: string; bg: string; onClick: () => void }> = ({ icon, label, desc, color, bg, onClick }) => (
  <div onClick={onClick} style={{
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
    padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
    cursor: 'pointer', transition: 'transform .12s, box-shadow .12s',
  }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,.08)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'none'; }}
  >
    <div style={{ width: 36, height: 36, borderRadius: 8, background: bg, color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{icon}</div>
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{label}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{desc}</div>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const { data: certs, refresh, lastUpdated, isLive } = useRealtimeScope(getCertifications);
  const { data: schedules } = useRealtimeScope(getAuditSchedules);
  const { data: notifications } = useRealtimeScope(getNotifications);
  const { data: org } = useRealtimeScope(getOrg);

  const total = certs.length;
  const expiringSoon = certs.filter(c => c.status === 'Expiring Soon').length;
  const expired = certs.filter(c => c.status === 'Expired').length;
  const issued = certs.filter(c => c.status === 'Active' || c.status === 'Expiring Soon').length;
  const upcoming = schedules.filter(s => new Date(s.date).getTime() >= Date.now() && (s.status === 'Scheduled' || s.status === 'Confirmed')).length;
  const alertCount = notifications.filter(n => n.level === 'critical' || n.level === 'warn').length;
  const go = (path: string) => navigate(`/client-coordinator/${path}`);

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <RoleAIGuide />
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
        Welcome, {org?.organizationName || 'Client Coordinator'}
      </h1>
      <p style={{ margin: '4px 0 12px', color: '#64748b', fontSize: 13 }}>
        Read-only portal · org-scoped data · {org?.country || ''}
      </p>

      <LiveBar lastUpdated={lastUpdated} isLive={isLive} onRefresh={refresh} count={total} unit="certifications" />

      {(expiringSoon > 0 || expired > 0) && (
        <div onClick={() => go('notifications')} style={{
          background: expired > 0 ? 'linear-gradient(135deg,#fee2e2,#fca5a5)' : 'linear-gradient(135deg,#fef3c7,#fde68a)',
          border: `1px solid ${expired > 0 ? '#ef4444' : '#f59e0b'}`,
          borderLeft: `4px solid ${expired > 0 ? '#dc2626' : '#f59e0b'}`,
          padding: '12px 16px', borderRadius: 8, marginBottom: 20,
          display: 'flex', alignItems: 'flex-start', gap: 10,
          color: expired > 0 ? '#7f1d1d' : '#7c2d12', cursor: 'pointer',
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>
              {expired > 0 && `${expired} certificate${expired > 1 ? 's' : ''} have EXPIRED. `}
              {expiringSoon > 0 && `${expiringSoon} certificate${expiringSoon > 1 ? 's' : ''} expiring within 30 days.`}
            </strong>
            <div style={{ fontSize: 12, marginTop: 3 }}>
              {certs.filter(c => c.status === 'Expiring Soon' || c.status === 'Expired').slice(0, 3).map(c => (
                <span key={c.id} style={{ display: 'inline-block', marginRight: 10, opacity: .85 }}>
                  {c.standard} ({c.certNumber}) · expires {c.expiryDate}
                </span>
              ))}
              {(expiringSoon + expired) > 3 && <span style={{ opacity: .7 }}>+ {expiringSoon + expired - 3} more → View Notifications</span>}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 28 }}>
        <StatCard icon={<Award size={20} />} label="Total Certifications" value={total} color="#0e7490" bg="#cffafe" onClick={() => go('certifications')} />
        <StatCard icon={<CalendarClock size={20} />} label="Upcoming Audits" value={upcoming} color="#1d4ed8" bg="#dbeafe" onClick={() => go('audit-schedules')} />
        <StatCard icon={<AlertTriangle size={20} />} label="Expiring Soon" value={expiringSoon} color="#a16207" bg="#fef3c7" onClick={() => go('due-dates')} />
        <StatCard icon={<FileCheck size={20} />} label="Certificates Issued" value={issued} color="#15803d" bg="#dcfce7" onClick={() => go('certifications')} />
      </div>

      <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Quick Navigation</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <NavCard icon={<Building2 size={17} />} label="Organization" desc="Profile, branches & contact info" color="#6366f1" bg="#ede9fe" onClick={() => go('organization')} />
        <NavCard icon={<Award size={17} />} label="Certifications" desc={`${total} certs · filter by category & branch`} color="#0e7490" bg="#cffafe" onClick={() => go('certifications')} />
        <NavCard icon={<CalendarClock size={17} />} label="Due Date Tracker" desc="Surveillance & recertification dates" color="#0891b2" bg="#e0f2fe" onClick={() => go('due-dates')} />
        <NavCard icon={<ClipboardList size={17} />} label="Audit Schedules" desc={`${upcoming} upcoming · filter by type`} color="#1d4ed8" bg="#dbeafe" onClick={() => go('audit-schedules')} />
        <NavCard icon={<FileSpreadsheet size={17} />} label="Audit Reports" desc="Completed reports · PDF download" color="#7c3aed" bg="#ede9fe" onClick={() => go('audit-reports')} />
        <NavCard
          icon={<Bell size={17} />}
          label={`Notifications${alertCount > 0 ? ` (${alertCount})` : ''}`}
          desc={alertCount > 0 ? `${alertCount} active alert${alertCount > 1 ? 's' : ''} require attention` : 'No active alerts'}
          color={alertCount > 0 ? '#dc2626' : '#15803d'}
          bg={alertCount > 0 ? '#fee2e2' : '#dcfce7'}
          onClick={() => go('notifications')}
        />
      </div>
    </div>
  );
};

export default Dashboard;
