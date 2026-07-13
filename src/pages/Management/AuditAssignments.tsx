/**
 * Management → Audit Assignments
 * Read-only consolidated view of the audit-schedule confirmation loop.
 * Merges both schedule keys ([cms_audit_schedules, cms_audit_schedules_v3])
 * with the auditor registry (cms_auditors) and reloads live on the
 * 'cms-schedules-updated' CustomEvent and the window 'storage' event.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  Search,
  UserCheck,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  Building2,
  Mail,
  Calendar,
  MapPin,
} from 'lucide-react';
import {
  MergedScheduleEntry,
  RegisteredAuditor,
  SCHEDULES_UPDATED_EVENT,
  StoredSchedule,
  entryKey,
  findAuditorByName,
  readAuditorsRegistry,
  readMergedSchedules,
  scheduleDate,
  scheduleOrg,
  scheduleStandard,
  scheduleStatus,
  scheduleTitle,
  updateSchedule,
} from '../../utils/auditScheduleStore';
import EmptyState from '../../components/EmptyState';
import { SkeletonRow } from '../../components/Skeleton';
import AIPanel from '../../components/AIPanel';
import { detectAssignmentAnomalies, anomaliesClaudePrompt, AssignmentAnomaly } from '../../ai/managementInsights';
import { onCmsChange, claudeComplete, isClaudeConfigured } from '../../ai/liveData';
import '../../styles/Management/AuditAssignments.css';

interface LoopBadge {
  label: string;
  color: string;
  bg: string;
}

/** Consolidated confirmation-loop state for one schedule record. */
const loopBadge = (r: StoredSchedule): LoopBadge => {
  const status = (scheduleStatus(r) || '').toLowerCase();
  if (status.includes('complete')) {
    return { label: 'Completed', color: '#1e40af', bg: 'rgba(59,130,246,.10)' };
  }
  if (r.auditeeApproval === 'Approved' || status === 'approved') {
    return { label: 'Auditee Approved', color: '#047857', bg: 'rgba(16,185,129,.12)' };
  }
  if (r.auditeeApproval === 'Alternative Proposed') {
    return { label: 'Alternative Proposed', color: '#b45309', bg: 'rgba(245,158,11,.12)' };
  }
  if (r.auditorConfirmation === 'Declined') {
    return { label: 'Auditor Declined', color: '#be123c', bg: 'rgba(244,63,94,.12)' };
  }
  if (r.auditorConfirmation === 'Confirmed') {
    return { label: 'Auditor Confirmed', color: '#0f766e', bg: 'rgba(20,184,166,.12)' };
  }
  return { label: 'Awaiting Confirmation', color: '#d97706', bg: 'rgba(245,158,11,.12)' };
};

const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const fmtStamp = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '—');

const AuditAssignments: React.FC = () => {
  const [entries, setEntries] = useState<MergedScheduleEntry[]>([]);
  const [auditors, setAuditors] = useState<RegisteredAuditor[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [leadPick, setLeadPick] = useState('');
  const [auditorPick, setAuditorPick] = useState('');
  const [saved, setSaved] = useState(false);

  // ---- Anomaly Detection (AI) ---------------------------------------------
  const [anomalies, setAnomalies] = useState<AssignmentAnomaly[]>([]);
  const [aiAnomText, setAiAnomText] = useState<string | null>(null);
  const [aiAnomBusy, setAiAnomBusy] = useState(false);
  const [aiAnomErr, setAiAnomErr] = useState<string | null>(null);

  const runAnomalyScan = () => {
    setAnomalies(detectAssignmentAnomalies());
    setAiAnomText(null);
    setAiAnomErr(null);
  };

  useEffect(() => {
    runAnomalyScan();
    const off = onCmsChange(runAnomalyScan);
    return off;
  }, []);

  const enhanceAnomalies = async () => {
    if (anomalies.length === 0 || aiAnomBusy) return;
    setAiAnomBusy(true);
    setAiAnomErr(null);
    const res = await claudeComplete(anomaliesClaudePrompt(anomalies), { maxTokens: 400 });
    setAiAnomBusy(false);
    if (res.ok) setAiAnomText(res.text);
    else setAiAnomErr(res.error);
  };

  const refresh = () => {
    setEntries(readMergedSchedules());
    setAuditors(readAuditorsRegistry());
  };

  useEffect(() => {
    refresh();
    const loadTimer = setTimeout(() => setLoading(false), 320);
    const onUpdate = () => refresh();
    window.addEventListener(SCHEDULES_UPDATED_EVENT, onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      clearTimeout(loadTimer);
      window.removeEventListener(SCHEDULES_UPDATED_EVENT, onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, []);

  const stats = useMemo(() => {
    let awaiting = 0, confirmed = 0, approved = 0, done = 0;
    entries.forEach((e) => {
      const label = loopBadge(e.record).label;
      if (label === 'Completed') done += 1;
      else if (label === 'Auditee Approved') approved += 1;
      else if (label === 'Auditor Confirmed') confirmed += 1;
      else awaiting += 1;
    });
    return { awaiting, confirmed, approved, done };
  }, [entries]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => {
        const r = e.record;
        const label = loopBadge(r).label;
        if (filter === 'pending' && (label === 'Completed' || label === 'Auditee Approved')) {
          return false;
        }
        if (!q) return true;
        return (
          scheduleOrg(r).toLowerCase().includes(q) ||
          (r.leadAuditor || '').toLowerCase().includes(q) ||
          (r.auditor || '').toLowerCase().includes(q) ||
          scheduleStandard(r).toLowerCase().includes(q) ||
          (r.auditType || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => scheduleDate(b.record).localeCompare(scheduleDate(a.record)));
  }, [entries, search, filter]);

  const selected = useMemo(
    () => (selectedKey ? entries.find((e) => entryKey(e) === selectedKey) ?? null : null),
    [entries, selectedKey]
  );

  const auditorNames = useMemo(
    () => auditors.map((a) => a.name).filter(Boolean) as string[],
    [auditors]
  );

  // Keep the assignment pickers in sync with the selected schedule.
  useEffect(() => {
    if (selected) {
      setLeadPick(selected.record.leadAuditor || '');
      setAuditorPick(selected.record.auditor || '');
      setSaved(false);
    }
  }, [selected]);

  const handleAssign = () => {
    if (!selected) return;
    const leadInfo = findAuditorByName(leadPick);
    const audInfo = findAuditorByName(auditorPick);
    const assignedAuditors = Array.from(
      new Set([leadPick, auditorPick].filter(Boolean))
    ) as string[];
    const curStatus = scheduleStatus(selected.record);
    updateSchedule(selected, {
      leadAuditor: leadPick || undefined,
      leadAuditorEmail: leadInfo?.email,
      auditor: auditorPick || undefined,
      auditorEmail: audInfo?.email,
      assignedAuditors,
      status: !selected.record.status || /unassigned/i.test(curStatus) ? 'Scheduled' : selected.record.status,
      // Reassigning restarts the auditor confirmation loop.
      auditorConfirmation: 'Pending',
      auditorConfirmationAt: '',
      auditorConfirmationNote: '',
    });
    refresh();
    runAnomalyScan();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2600);
  };

  const team = useMemo(() => {
    if (!selected) return [];
    const r = selected.record;
    const roles: Array<{ role: string; name?: string }> = [
      { role: 'Lead Auditor', name: r.leadAuditor },
      { role: 'Auditor', name: r.auditor },
    ];
    (r.assignedAuditors || []).forEach((name) => {
      if (name && name !== r.leadAuditor && name !== r.auditor) {
        roles.push({ role: 'Team Member', name });
      }
    });
    return roles
      .filter((m) => m.name)
      .map((m) => ({ ...m, info: findAuditorByName(m.name) }));
  }, [selected]);

  return (
    <div className="aa-page">
      <div className="aa-hero">
        <div>
          <div className="aa-hero-badge">
            <ClipboardList size={14} /> Workflow Console · {auditors.length} registered auditors
          </div>
          <h1><ClipboardList size={28} /> Audit Assignments</h1>
          <p>Assign auditors to every audit schedule and track the confirmation loop across Coordinator, Auditor and Auditee.</p>
        </div>
        <div className="aa-hero-stats">
          <div className="aa-stat">
            <div className="aa-stat-icon" style={{ background: 'rgba(245,158,11,.14)', color: '#b45309' }}>
              <Clock size={18} />
            </div>
            <div>
              <div className="aa-stat-value">{stats.awaiting}</div>
              <div className="aa-stat-label">Awaiting Confirmation</div>
            </div>
          </div>
          <div className="aa-stat">
            <div className="aa-stat-icon" style={{ background: 'rgba(99,102,241,.14)', color: '#4338ca' }}>
              <UserCheck size={18} />
            </div>
            <div>
              <div className="aa-stat-value">{stats.confirmed}</div>
              <div className="aa-stat-label">Auditor Confirmed</div>
            </div>
          </div>
          <div className="aa-stat">
            <div className="aa-stat-icon" style={{ background: 'rgba(8,145,178,.14)', color: '#0e7490' }}>
              <ArrowRight size={18} />
            </div>
            <div>
              <div className="aa-stat-value">{stats.approved}</div>
              <div className="aa-stat-label">Auditee Approved</div>
            </div>
          </div>
          <div className="aa-stat">
            <div className="aa-stat-icon" style={{ background: 'rgba(16,185,129,.14)', color: '#047857' }}>
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div className="aa-stat-value">{stats.done}</div>
              <div className="aa-stat-label">Completed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Anomaly Detection — impartiality, zero findings, fast completions, approval gaps */}
      <AIPanel
        title="Assignment Anomaly Detection"
        subtitle="Scans live schedules, reports and findings for impartiality and process anomalies"
        onRefresh={runAnomalyScan}
      >
        {anomalies.length === 0 ? (
          <p className="ai-panel-note">No anomalies detected in the current schedules, reports and findings.</p>
        ) : (
          <>
            {aiAnomText && (
              <p style={{ margin: '0 0 6px', fontSize: 13, lineHeight: 1.6, color: '#334155' }}>{aiAnomText}</p>
            )}
            <ul className="ai-insight-list">
              {anomalies.slice(0, 10).map((a) => (
                <li key={a.id}>
                  <span className={`ai-chip ${a.level}`}>{a.type}</span>
                  <span>{a.text}</span>
                </li>
              ))}
            </ul>
            {anomalies.length > 10 && (
              <p className="ai-panel-note">Showing 10 of {anomalies.length} anomalies, most severe first.</p>
            )}
            {isClaudeConfigured() && !aiAnomText && (
              <button type="button" className="ai-action-btn" onClick={enhanceAnomalies} disabled={aiAnomBusy} style={{ marginTop: 10 }}>
                {aiAnomBusy ? 'Enhancing…' : 'Enhance with Claude'}
              </button>
            )}
            {aiAnomErr && <p className="ai-panel-note">Claude enhancement failed: {aiAnomErr} — heuristic scan shown above.</p>}
          </>
        )}
      </AIPanel>

      <div className="aa-grid">
        {/* List */}
        <div className="aa-list-card">
          <div className="aa-toolbar">
            <div className="aa-search">
              <Search size={16} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search schedules, auditors..." />
            </div>
            <div className="aa-pills">
              <button className={`aa-pill ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>In Loop</button>
              <button className={`aa-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
            </div>
          </div>

          <div className="aa-list">
            {loading ? (
              <>
                <SkeletonRow columns={3} />
                <SkeletonRow columns={3} />
                <SkeletonRow columns={3} />
              </>
            ) : visible.length === 0 ? (
              <EmptyState
                variant="inline"
                icon={<Users size={28} strokeWidth={1.5} />}
                title={search ? 'No matches' : 'No schedules to show'}
                description={search ? 'Try a different organisation or auditor name.' : 'Schedules created by the Audit Coordinator will appear here.'}
              />
            ) : (
              visible.map((e) => {
                const r = e.record;
                const badge = loopBadge(r);
                const key = entryKey(e);
                return (
                  <button
                    key={key}
                    className={`aa-list-item ${selectedKey === key ? 'selected' : ''}`}
                    onClick={() => setSelectedKey(key)}
                  >
                    <div className="aa-list-avatar">{(scheduleOrg(r) || '?').charAt(0).toUpperCase()}</div>
                    <div className="aa-list-text">
                      <div className="aa-list-name">{scheduleOrg(r)}</div>
                      <div className="aa-list-meta">
                        {fmtDate(scheduleDate(r))} · {r.leadAuditor || r.auditor || 'Unassigned'}
                      </div>
                    </div>
                    <span className="aa-stage" style={{ color: badge.color, background: badge.bg }}>
                      {badge.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail (read-only) */}
        <div className="aa-detail-card">
          {!selected ? (
            <EmptyState
              variant="card"
              icon={<ClipboardList size={36} strokeWidth={1.5} />}
              title="Select a schedule"
              description="Pick an audit schedule from the list to review its assigned auditors and confirmation status."
            />
          ) : (
            (() => {
              const r = selected.record;
              const badge = loopBadge(r);
              return (
                <>
                  <div className="aa-detail-head">
                    <div className="aa-detail-icon">{(scheduleOrg(r) || '?').charAt(0).toUpperCase()}</div>
                    <div>
                      <h2>{scheduleOrg(r)}</h2>
                      <div className="aa-detail-sub">
                        {scheduleTitle(r)} · {scheduleStandard(r) || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="aa-info-grid">
                    <div><span className="aa-info-lbl"><Calendar size={12} /> Audit Date</span><span className="aa-info-val">{fmtDate(scheduleDate(r))}</span></div>
                    <div><span className="aa-info-lbl"><MapPin size={12} /> Location</span><span className="aa-info-val">{r.location || '—'}</span></div>
                    <div><span className="aa-info-lbl"><Building2 size={12} /> Department</span><span className="aa-info-val">{r.department || '—'}</span></div>
                    <div><span className="aa-info-lbl"><Mail size={12} /> Auditee</span><span className="aa-info-val">{r.auditee || r.auditeeEmail || '—'}</span></div>
                  </div>

                  <h3 className="aa-section-title">Status</h3>
                  <div className="aa-assigned">
                    <UserCheck size={16} />
                    <span>
                      Schedule status <strong>{scheduleStatus(r)}</strong> ·{' '}
                      <span style={{ color: badge.color }}>{badge.label}</span>
                    </span>
                  </div>

                  <h3 className="aa-section-title">Assign / Reassign Team</h3>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#475569', flex: 1, minWidth: 190 }}>
                      Lead Auditor
                      <select value={leadPick} onChange={(ev) => setLeadPick(ev.target.value)}
                        style={{ padding: '9px 11px', border: '1.5px solid #cbd5e1', borderRadius: 9, fontSize: 14, color: '#0f172a', background: '#fff' }}>
                        <option value="">— Select lead auditor —</option>
                        {auditorNames.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#475569', flex: 1, minWidth: 190 }}>
                      Auditor
                      <select value={auditorPick} onChange={(ev) => setAuditorPick(ev.target.value)}
                        style={{ padding: '9px 11px', border: '1.5px solid #cbd5e1', borderRadius: 9, fontSize: 14, color: '#0f172a', background: '#fff' }}>
                        <option value="">— Select auditor —</option>
                        {auditorNames.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                    <button type="button" onClick={handleAssign} disabled={!leadPick && !auditorPick}
                      style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: (!leadPick && !auditorPick) ? 'not-allowed' : 'pointer', opacity: (!leadPick && !auditorPick) ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                      Save Assignment
                    </button>
                  </div>
                  {saved && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, background: '#dcfce7', color: '#166534', border: '1px solid #a7f3d0', borderRadius: 9, padding: '9px 12px', fontSize: 13, fontWeight: 600 }}>
                      <CheckCircle2 size={16} /> Assignment saved — sent to the auditor for confirmation.
                    </div>
                  )}

                  <h3 className="aa-section-title">Assigned Audit Team</h3>
                  {team.length === 0 ? (
                    <div className="aa-detail-sub">No auditors assigned yet.</div>
                  ) : (
                    team.map((m) => (
                      <div className="aa-assigned" key={`${m.role}-${m.name}`}>
                        <Users size={16} />
                        <span>
                          {m.role}: <strong>{m.name}</strong>
                          {m.info?.email ? ` · ${m.info.email}` : ''}
                          {m.info?.specialization ? ` · ${m.info.specialization}` : ''}
                        </span>
                      </div>
                    ))
                  )}

                  <h3 className="aa-section-title">Confirmation Loop</h3>
                  <ul className="aa-history">
                    <li>
                      <span
                        className="aa-history-stage"
                        style={
                          r.auditorConfirmation === 'Confirmed'
                            ? { color: '#0f766e', background: 'rgba(20,184,166,.12)' }
                            : r.auditorConfirmation === 'Declined'
                              ? { color: '#be123c', background: 'rgba(244,63,94,.12)' }
                              : { color: '#d97706', background: 'rgba(245,158,11,.12)' }
                        }
                      >
                        Auditor · {r.auditorConfirmation || 'Pending'}
                      </span>
                      <span className="aa-history-when">{fmtStamp(r.auditorConfirmationAt)}</span>
                      {r.auditorConfirmationNote && <span className="aa-history-note">{r.auditorConfirmationNote}</span>}
                    </li>
                    <li>
                      <span
                        className="aa-history-stage"
                        style={
                          r.auditeeApproval === 'Approved'
                            ? { color: '#047857', background: 'rgba(16,185,129,.12)' }
                            : r.auditeeApproval === 'Alternative Proposed'
                              ? { color: '#b45309', background: 'rgba(245,158,11,.12)' }
                              : { color: '#d97706', background: 'rgba(245,158,11,.12)' }
                        }
                      >
                        Auditee · {r.auditeeApproval || 'Pending'}
                      </span>
                      <span className="aa-history-when">{fmtStamp(r.auditeeApprovalAt)}</span>
                      {r.auditeeApprovalNote && <span className="aa-history-note">{r.auditeeApprovalNote}</span>}
                    </li>
                  </ul>
                </>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditAssignments;
