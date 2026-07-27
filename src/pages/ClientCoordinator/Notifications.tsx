import React, { useState } from 'react';
import { Bell, AlertTriangle, CalendarClock, RefreshCw, Mail, CheckCircle2, X, Building2, FileText, Hash, Calendar, Clock } from 'lucide-react';
import { getNotifications, getOrg, RichNotification, AlertType } from './scope';
import { useRealtimeScope } from './useRealtimeScope';
import { LiveBar } from './LiveBar';

const TYPE_CFG: Record<AlertType, { icon: React.ReactNode; label: string; accent: string; bg: string; fg: string }> = {
  surveillance_due:    { icon: <CalendarClock size={16} />, label: 'Surveillance Audit Due',    accent: '#0891b2', bg: '#e0f2fe', fg: '#0c4a6e' },
  recertification_due: { icon: <RefreshCw size={16} />,    label: 'Recertification Audit Due', accent: '#7c3aed', bg: '#ede9fe', fg: '#4c1d95' },
  cert_expiring:       { icon: <AlertTriangle size={16} />, label: 'Certificate Expiring',      accent: '#dc2626', bg: '#fee2e2', fg: '#7f1d1d' },
};

const LEVEL_BORDER: Record<string, string> = { critical: '#dc2626', warn: '#f59e0b', info: '#3b82f6' };

const buildEmail = (n: RichNotification, orgEmail: string, orgName: string) => {
  const subj = `[CertiSphere Alert] ${n.title} — ${orgName}`;
  const body = [
    `Dear Certification Team,`,
    ``,
    `This is an automated alert from CertiSphere for ${orgName}.`,
    ``,
    `📋 Alert Type    : ${TYPE_CFG[n.alertType].label}`,
    `🏢 Branch / Unit : ${n.branchName}`,
    `📜 Certification : ${n.standard} (${n.certNumber || 'N/A'})`,
    `📅 Expiry Date   : ${n.expiryDate}`,
    `⏰ Days Remaining: ${n.daysUntilExpiry >= 0 ? n.daysUntilExpiry + ' days' : 'EXPIRED'}`,
    ``,
    `✅ Required Action: ${n.actionRequired}`,
    ``,
    `— CertiSphere Notification System`,
  ].join('\n');
  return `mailto:${orgEmail}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
};

const DetailField: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; danger?: boolean }> = ({ icon, label, value, danger }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, minWidth: 0 }}>
    <span style={{ color: '#0e7490', display: 'inline-flex', marginTop: 2, flexShrink: 0 }}>{icon}</span>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: '#94a3b8' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: danger ? '#dc2626' : '#0f172a', wordBreak: 'break-word', lineHeight: 1.35 }}>{value}</div>
    </div>
  </div>
);

const Notifications: React.FC = () => {
  const { data: allItems, refresh, lastUpdated, isLive } = useRealtimeScope(getNotifications);
  const { data: org } = useRealtimeScope(getOrg);
  const [filter, setFilter] = useState<AlertType | 'all'>('all');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const shown = allItems.filter(n =>
    !dismissed.has(n.id) &&
    (filter === 'all' || (n as RichNotification).alertType === filter)
  ) as RichNotification[];

  const critical = shown.filter(n => n.level === 'critical').length;
  const warn     = shown.filter(n => n.level === 'warn').length;

  const filterBtns: { key: AlertType | 'all'; label: string }[] = [
    { key: 'all',               label: `All (${allItems.filter(n => !dismissed.has(n.id)).length})` },
    { key: 'surveillance_due',    label: 'Surveillance Due' },
    { key: 'recertification_due', label: 'Recertification Due' },
    { key: 'cert_expiring',       label: 'Expiring / Expired' },
  ];

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1180, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <Bell size={22} color="#0f172a" />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Notifications</h1>
        {critical > 0 && <span style={{ background: '#dc2626', color: '#fff', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{critical} CRITICAL</span>}
        {warn > 0 && <span style={{ background: '#f59e0b', color: '#fff', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{warn} Warning</span>}
      </div>
      <p style={{ margin: '0 0 10px', color: '#64748b', fontSize: 13 }}>Auto-alerts for certificates expiring ≤30 days · 3 distinct alert types</p>

      <LiveBar lastUpdated={lastUpdated} isLive={isLive} onRefresh={refresh} />

      {shown.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
          {(['surveillance_due', 'recertification_due', 'cert_expiring'] as AlertType[]).map(t => {
            const cfg = TYPE_CFG[t];
            const count = shown.filter(n => n.alertType === t).length;
            const active = filter === t;
            return (
              <div key={t} onClick={() => setFilter(t === filter ? 'all' : t)}
                style={{ background: cfg.bg, border: `1px solid ${cfg.accent}${active ? 'aa' : '40'}`, borderRadius: 12, padding: '12px 14px', cursor: 'pointer', opacity: filter !== 'all' && !active ? .5 : 1, transition: 'opacity .15s, box-shadow .15s', boxShadow: active ? `0 6px 16px ${cfg.accent}22` : 'none' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: cfg.fg, fontWeight: 700, fontSize: 12 }}>{cfg.icon} {cfg.label}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: cfg.accent, marginTop: 4 }}>{count}</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 7, marginBottom: 16, flexWrap: 'wrap' }}>
        {filterBtns.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filter === f.key ? '#0f172a' : '#fff', color: filter === f.key ? '#fff' : '#475569', border: '1px solid #cbd5e1', transition: 'all .15s' }}>
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 14, padding: 48, textAlign: 'center' }}>
          <CheckCircle2 size={36} color="#22c55e" style={{ marginBottom: 8 }} />
          <div style={{ color: '#15803d', fontWeight: 700, fontSize: 16 }}>All caught up!</div>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>No active alerts for {org?.organizationName || 'this organisation'}.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {shown.map(n => {
            const cfg = TYPE_CFG[n.alertType];
            const border = LEVEL_BORDER[n.level];
            const expired = n.daysUntilExpiry < 0;
            return (
              <article key={n.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: `4px solid ${border}`, borderRadius: 14, padding: '18px 18px 16px', position: 'relative', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px rgba(15,23,42,.04), 0 10px 26px rgba(15,23,42,.05)' }}>
                <button onClick={() => setDismissed(prev => new Set([...prev, n.id]))} title="Dismiss"
                  style={{ position: 'absolute', top: 12, right: 12, background: '#f1f5f9', border: 'none', borderRadius: 6, width: 24, height: 24, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#94a3b8' }}>
                  <X size={14} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap', paddingRight: 28 }}>
                  <span style={{ background: cfg.bg, color: cfg.fg, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>
                    {cfg.icon} {cfg.label}
                  </span>
                  <span style={{ background: n.level === 'critical' ? '#fee2e2' : '#fef3c7', color: n.level === 'critical' ? '#dc2626' : '#a16207', padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                    {n.level}
                  </span>
                </div>

                <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 14, lineHeight: 1.3 }}>{n.title}</div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 32px', marginBottom: 14 }}>
                  <DetailField icon={<Building2 size={15} />} label="Branch" value={n.branchName} />
                  <DetailField icon={<FileText size={15} />} label="Standard" value={n.standard} />
                  <DetailField icon={<Hash size={15} />} label="Cert #" value={n.certNumber || '—'} />
                  <DetailField icon={<Calendar size={15} />} label="Expiry" value={n.expiryDate} />
                  <DetailField icon={<Clock size={15} />} label="Days remaining" value={expired ? 'EXPIRED' : `${n.daysUntilExpiry} days`} danger={expired} />
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#0f172a', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <CheckCircle2 size={15} color="#16a34a" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span><strong>Required Action:</strong> {n.actionRequired}</span>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 'auto', paddingTop: 4 }}>
                  <a href={buildEmail(n, org?.email || '', org?.organizationName || 'Organisation')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#0e7490,#155e75)', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 12px rgba(14,116,144,.28)' }}>
                    <Mail size={13} /> Send Email Alert
                  </a>
                  <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{new Date(n.at).toLocaleString()}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
