/**
 * Auditee → Schedule Approvals
 * Live view of audit schedules proposed by the Audit Coordinator. Reads the
 * merged schedule store ([cms_audit_schedules, cms_audit_schedules_v3]),
 * scoped to the active client (`cms_active_client_id`, falling back to all
 * organisations when unset), and writes Approve / Propose-alternative
 * decisions back to whichever key each record came from via the additive
 * `auditeeApproval` fields.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Building2,
  ListChecks,
  History,
  Users,
} from 'lucide-react';
import {
  MergedScheduleEntry,
  SCHEDULES_UPDATED_EVENT,
  StoredSchedule,
  entryKey,
  readMergedSchedules,
  scheduleDate,
  scheduleOrg,
  scheduleStandard,
  updateSchedule,
} from '../../utils/auditScheduleStore';
import {
  ClientRecord,
  getAllClients,
} from '../AuditorCoordinator/utils/clientCredentials';
import EmptyState from '../../components/EmptyState';
import '../../styles/AuditClient/ScheduleApprovals.css';

const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const fmtStamp = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '—');

/** Resolve the logged-in auditee from the most recent login. */
const resolveActiveClient = (): ClientRecord | null => {
  try {
    const idRaw = localStorage.getItem('cms_active_client_id');
    if (!idRaw) return null;
    const id = Number(idRaw);
    return getAllClients().find((c) => c.id === id) ?? null;
  } catch {
    return null;
  }
};

/** Does a stored schedule belong to this client's organisation? */
const matchesClient = (r: StoredSchedule, client: ClientRecord): boolean => {
  const org = scheduleOrg(r).trim().toLowerCase();
  const clientOrg = (client.organizationName || '').trim().toLowerCase();
  if (clientOrg && org === clientOrg) return true;
  const email = (r.auditeeEmail || '').trim().toLowerCase();
  const clientEmail = (client.email || '').trim().toLowerCase();
  if (clientEmail && email === clientEmail) return true;
  return false;
};

const ScheduleApprovals: React.FC = () => {
  const [entries, setEntries] = useState<MergedScheduleEntry[]>(() => readMergedSchedules());
  const [client, setClient] = useState<ClientRecord | null>(() => resolveActiveClient());
  const [decide, setDecide] = useState<{ key: string; mode: 'approve' | 'decline' } | null>(null);
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      setEntries(readMergedSchedules());
      setClient(resolveActiveClient());
    };
    window.addEventListener(SCHEDULES_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('client-registrations-updated', refresh);
    return () => {
      window.removeEventListener(SCHEDULES_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('client-registrations-updated', refresh);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // Schedules for this organisation; if no active client is set (or nothing
  // matches it) fall back to the full merged list so the page stays useful.
  const { visible, scopedToClient } = useMemo(() => {
    if (client) {
      const mine = entries.filter((e) => matchesClient(e.record, client));
      if (mine.length > 0) return { visible: mine, scopedToClient: true };
    }
    return { visible: entries, scopedToClient: false };
  }, [entries, client]);

  const sorted = useMemo(
    () => [...visible].sort((a, b) => scheduleDate(b.record).localeCompare(scheduleDate(a.record))),
    [visible]
  );

  const counts = useMemo(() => {
    let pending = 0, approved = 0, alternative = 0;
    visible.forEach((e) => {
      const a = e.record.auditeeApproval;
      if (a === 'Approved') approved += 1;
      else if (a === 'Alternative Proposed') alternative += 1;
      else pending += 1;
    });
    return { pending, approved, alternative };
  }, [visible]);

  const decisionHistory = useMemo(
    () =>
      entries
        .filter((e) => e.record.auditeeApproval && e.record.auditeeApprovalAt)
        .sort((a, b) => String(b.record.auditeeApprovalAt).localeCompare(String(a.record.auditeeApprovalAt)))
        .slice(0, 8),
    [entries]
  );

  const submitDecision = (entry: MergedScheduleEntry, mode: 'approve' | 'decline') => {
    const now = new Date().toISOString();
    const trimmed = note.trim();
    if (mode === 'approve') {
      updateSchedule(entry, {
        auditeeApproval: 'Approved',
        auditeeApprovalAt: now,
        auditeeApprovalNote: trimmed || undefined,
        // Mirror the coordinator's own contract: auditee approval flips the
        // core status to 'Approved' (see handleApprove in AuditSchedules.tsx).
        status: 'Approved',
      });
      setToast('Schedule approved!');
    } else {
      updateSchedule(entry, {
        auditeeApproval: 'Alternative Proposed',
        auditeeApprovalAt: now,
        auditeeApprovalNote: trimmed || 'Auditee requested an alternative slot.',
      });
      setToast('Alternative requested — coordinator notified');
    }
    setDecide(null);
    setNote('');
    setEntries(readMergedSchedules());
  };

  return (
    <div className="sa-page">
      <div className="sa-hero">
        <div>
          <div className="sa-badge">
            <Building2 size={14} /> {client ? client.organizationName : 'All Organisations'}
          </div>
          <h1><CalendarCheck size={28} /> Schedule Approvals</h1>
          <p>Review and approve audit schedules proposed by your Audit Coordinator.</p>
        </div>
        <span
          className="sa-current-stage"
          style={{ background: 'rgba(245,158,11,.12)', color: '#d97706' }}
        >
          {counts.pending} awaiting your decision
        </span>
      </div>

      <div className="sa-grid">
        {/* Proposed schedules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sorted.length === 0 ? (
            <div className="sa-card">
              <h3 className="sa-section-title"><CalendarCheck size={16} /> Proposed Audit Schedules</h3>
              <EmptyState
                variant="inline"
                icon={<Clock size={28} strokeWidth={1.5} />}
                title="No schedule has been proposed yet"
                description="Your Audit Coordinator will send schedule proposals here once your requirements review is complete."
              />
            </div>
          ) : (
            sorted.map((e) => {
              const r = e.record;
              const key = entryKey(e);
              const approval = r.auditeeApproval;
              const isApproved = approval === 'Approved';
              const isAlternative = approval === 'Alternative Proposed';
              const isPending = !approval || approval === 'Pending';
              const deciding = decide && decide.key === key ? decide.mode : null;
              return (
                <div className="sa-card" key={key}>
                  <h3 className="sa-section-title">
                    <CalendarCheck size={16} /> {scheduleOrg(r)}
                  </h3>
                  <div className="sa-schedule-grid">
                    <div>
                      <div className="sa-lbl">Proposed Date</div>
                      <div className="sa-val sa-val-strong">
                        {fmtDate(scheduleDate(r))}{r.startTime ? ` · ${r.startTime}` : ''}
                      </div>
                    </div>
                    <div>
                      <div className="sa-lbl">Lead Auditor</div>
                      <div className="sa-val">{r.leadAuditor || '—'}</div>
                    </div>
                    <div>
                      <div className="sa-lbl">Auditor</div>
                      <div className="sa-val">{r.auditor || '—'}</div>
                    </div>
                    <div>
                      <div className="sa-lbl">Standard</div>
                      <div className="sa-val">{scheduleStandard(r) || '—'}</div>
                    </div>
                    <div>
                      <div className="sa-lbl">Audit Type</div>
                      <div className="sa-val">{r.auditType || '—'}</div>
                    </div>
                    <div>
                      <div className="sa-lbl">Location</div>
                      <div className="sa-val">{r.location || '—'}</div>
                    </div>
                    {(r.notes || r.auditScope) && (
                      <div className="sa-notes">
                        <div className="sa-lbl">Coordinator's Notes</div>
                        <div className="sa-val">{r.notes || r.auditScope}</div>
                      </div>
                    )}
                  </div>

                  <div className="sa-decision">
                    {isApproved && (
                      <div className="sa-status approved">
                        <CheckCircle2 size={18} /> You approved this schedule on {fmtStamp(r.auditeeApprovalAt)}.
                      </div>
                    )}
                    {isAlternative && (
                      <div className="sa-status declined">
                        <XCircle size={18} /> Alternative proposed{r.auditeeApprovalNote ? ` — "${r.auditeeApprovalNote}"` : ''}. Waiting for the coordinator to re-propose.
                      </div>
                    )}
                    {isPending && !deciding && (
                      <div className="sa-action-row">
                        <button className="sa-btn approve" onClick={() => { setDecide({ key, mode: 'approve' }); setNote(''); }}>
                          <CheckCircle2 size={16} /> Approve Schedule
                        </button>
                        <button className="sa-btn decline" onClick={() => { setDecide({ key, mode: 'decline' }); setNote(''); }}>
                          <XCircle size={16} /> Propose Alternative
                        </button>
                      </div>
                    )}
                    {isPending && deciding && (
                      <div className="sa-confirm">
                        <label>
                          {deciding === 'approve'
                            ? 'Optional message to coordinator:'
                            : 'Preferred alternative (so the coordinator can re-propose):'}
                        </label>
                        <textarea
                          rows={3}
                          value={note}
                          onChange={(ev) => setNote(ev.target.value)}
                          placeholder={
                            deciding === 'approve'
                              ? 'Anything you want them to know...'
                              : 'e.g. We need at least 2 weeks notice; please propose a date in May.'
                          }
                        />
                        <div className="sa-action-row">
                          <button className="sa-btn ghost" onClick={() => { setDecide(null); setNote(''); }}>Cancel</button>
                          {deciding === 'approve' ? (
                            <button className="sa-btn approve" onClick={() => submitDecision(e, 'approve')}>
                              <CheckCircle2 size={16} /> Confirm Approval
                            </button>
                          ) : (
                            <button className="sa-btn decline" onClick={() => submitDecision(e, 'decline')}>
                              <XCircle size={16} /> Send Alternative Request
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Side panel: summary + decision history */}
        <div className="sa-card">
          <h3 className="sa-section-title"><ListChecks size={16} /> Approval Summary</h3>
          <div className="sa-req">
            <div><span className="sa-lbl">Scope</span><span className="sa-val">{scopedToClient ? client?.organizationName : 'All organisations (no active client set)'}</span></div>
            <div><span className="sa-lbl">Awaiting decision</span><span className="sa-val">{counts.pending}</span></div>
            <div><span className="sa-lbl">Approved</span><span className="sa-val">{counts.approved}</span></div>
            <div><span className="sa-lbl">Alternative proposed</span><span className="sa-val">{counts.alternative}</span></div>
          </div>

          {client && (
            <>
              <h3 className="sa-section-title"><Users size={16} /> Your Contact</h3>
              <div className="sa-coord">{client.contactPerson || '—'}{client.email ? ` · ${client.email}` : ''}</div>
            </>
          )}

          {decisionHistory.length > 0 && (
            <>
              <h3 className="sa-section-title"><History size={16} /> Decision History</h3>
              <ul className="sa-history">
                {decisionHistory.map((e) => {
                  const r = e.record;
                  const approved = r.auditeeApproval === 'Approved';
                  return (
                    <li key={entryKey(e)}>
                      <span
                        className="sa-history-stage"
                        style={{
                          color: approved ? '#047857' : '#b45309',
                          background: approved ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.12)',
                        }}
                      >
                        {approved ? 'Approved' : 'Alternative Proposed'}
                      </span>
                      <span className="sa-history-when">{scheduleOrg(r)} · {fmtStamp(r.auditeeApprovalAt)}</span>
                      {r.auditeeApprovalNote && <span className="sa-history-note">{r.auditeeApprovalNote}</span>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>

      {toast && <div className="sa-toast"><AlertCircle size={16} /> {toast}</div>}
    </div>
  );
};

export default ScheduleApprovals;
