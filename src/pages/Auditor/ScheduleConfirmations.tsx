/**
 * Auditor → Schedule Confirmations
 * The auditor's own queue of upcoming audits assigned to them. Reads the real
 * merged schedule store ([cms_audit_schedules, cms_audit_schedules_v3]) and
 * writes Confirm / Decline back to whichever key each record came from, using
 * the additive `auditorConfirmation` field ('Pending'|'Confirmed'|'Declined').
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, CheckCircle2, AlertTriangle, MapPin, Users, FileText, Clock,
} from 'lucide-react';
import {
  MergedScheduleEntry,
  SCHEDULES_UPDATED_EVENT,
  entryKey,
  isAssignedTo,
  readMergedSchedules,
  resolveDemoAuditorName,
  scheduleDate,
  scheduleOrg,
  updateSchedule,
} from '../../utils/auditScheduleStore';

const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const ScheduleConfirmations: React.FC = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<MergedScheduleEntry[]>(() => readMergedSchedules());
  const [filter, setFilter] = useState<'pending' | 'confirmed' | 'all'>('pending');
  const [conflict, setConflict] = useState<{ id: string; reason: string } | null>(null);

  useEffect(() => {
    const refresh = () => setEntries(readMergedSchedules());
    window.addEventListener(SCHEDULES_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(SCHEDULES_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const demoAuditor = useMemo(() => resolveDemoAuditorName(), [entries]);

  const visible = useMemo(() => {
    // Schedules assigned to the demo auditor. If none of the stored records
    // reference that name (e.g. coordinator picked other auditors), fall back
    // to the full queue so the demo stays usable.
    const assigned = entries.filter((e) => isAssignedTo(e.record, demoAuditor));
    const pool = assigned.length > 0 ? assigned : entries;
    return pool
      .filter((e) => {
        const confirmation = e.record.auditorConfirmation;
        const isPending = !confirmation || confirmation === 'Pending';
        const isConfirmed = confirmation === 'Confirmed';
        if (filter === 'pending') return isPending;
        if (filter === 'confirmed') return isConfirmed;
        return true;
      })
      .sort((a, b) => scheduleDate(b.record).localeCompare(scheduleDate(a.record)));
  }, [entries, filter, demoAuditor]);

  const confirm = (e: MergedScheduleEntry) => {
    updateSchedule(e, {
      auditorConfirmation: 'Confirmed',
      auditorConfirmationAt: new Date().toISOString(),
      auditorConfirmationNote: 'Confirmed availability for proposed slot.',
    });
  };
  const submitConflict = () => {
    if (!conflict) return;
    if (conflict.reason.trim().length < 3) { alert('Please describe the conflict.'); return; }
    const target = entries.find((e) => entryKey(e) === conflict.id);
    if (target) {
      updateSchedule(target, {
        auditorConfirmation: 'Declined',
        auditorConfirmationAt: new Date().toISOString(),
        auditorConfirmationNote: `Conflict reported: ${conflict.reason}`,
      });
    }
    setConflict(null);
  };

  return (
    <div style={{ padding: '20px', maxWidth: 1200, margin: '0 auto' }}>
      <button onClick={() => navigate('/auditor/dashboard')} style={btnGhost}>
        <ArrowLeft size={14} /> Back
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <div style={{ background: '#cffafe', color: '#0e7490', width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center' }}><Calendar size={22} /></div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Schedule Confirmations</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Confirm or flag conflicts for audits assigned to you ({demoAuditor}).</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
        {(['pending', 'confirmed', 'all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={pillStyle(filter === f)}>
            {f === 'pending' ? 'Awaiting confirmation' : f === 'confirmed' ? 'Confirmed' : 'All'}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: 12, background: '#f8fafc' }}>
            No schedules in this view.
          </div>
        ) : visible.map((e) => {
          const r = e.record;
          const confirmation = r.auditorConfirmation;
          const isPending = !confirmation || confirmation === 'Pending';
          const badgeText = confirmation === 'Confirmed'
            ? 'Confirmed by Auditor'
            : confirmation === 'Declined'
              ? 'Declined — conflict flagged'
              : `Awaiting confirmation · ${r.status || 'Scheduled'}`;
          const notes = r.notes || r.auditScope;
          return (
            <article key={entryKey(e)} style={card}>
              <header style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{scheduleOrg(r)}</h3>
                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={12} /> {r.location || '—'}
                  </div>
                </div>
                <span style={badgeStyle(isPending)}>{badgeText}</span>
              </header>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: 13 }}>
                <KV icon={<Calendar size={13} />} label="Date" value={fmtDate(scheduleDate(r))} />
                <KV icon={<Clock size={13} />}    label="Time" value={r.startTime || '—'} />
                <KV icon={<Users size={13} />}    label="Lead" value={r.leadAuditor || '—'} />
                <KV icon={<Users size={13} />}    label="Auditor" value={r.auditor || '—'} />
              </div>
              {notes && (
                <div style={{ marginTop: 8, padding: 8, background: '#f8fafc', borderLeft: '3px solid #cbd5e1', fontSize: 12, color: '#475569' }}>
                  <FileText size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {notes}
                </div>
              )}
              {confirmation === 'Declined' && r.auditorConfirmationNote && (
                <div style={{ marginTop: 8, padding: 8, background: '#fffbeb', borderLeft: '3px solid #f59e0b', fontSize: 12, color: '#92400e' }}>
                  {r.auditorConfirmationNote}
                </div>
              )}
              {isPending && (
                <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
                  <button onClick={() => confirm(e)} style={btnPrimary}><CheckCircle2 size={13} /> Confirm availability</button>
                  <button onClick={() => setConflict({ id: entryKey(e), reason: '' })} style={btnWarn}><AlertTriangle size={13} /> Flag conflict</button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {conflict && (
        <div onClick={() => setConflict(null)} style={modalBg}>
          <div onClick={(e) => e.stopPropagation()} style={modalBox}>
            <h3 style={{ margin: 0 }}>Flag a conflict</h3>
            <p style={{ margin: '6px 0 10px 0', fontSize: 12, color: '#64748b' }}>The coordinator will be notified to re-schedule.</p>
            <textarea value={conflict.reason} onChange={(e) => setConflict({ ...conflict, reason: e.target.value })}
              placeholder="What's the conflict? (e.g., overlapping audit, travel issue, …)" rows={3} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
              <button onClick={() => setConflict(null)} style={btnGhost}>Cancel</button>
              <button onClick={submitConflict} style={btnWarn}>Submit conflict</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const KV: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{ color: '#64748b' }}>{icon}</span>
    <span style={{ fontSize: 11, color: '#64748b' }}>{label}:</span>
    <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{value}</span>
  </div>
);

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, boxShadow: '0 1px 2px rgba(15,23,42,0.04)' };
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cbd5e1', color: '#475569', padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#15803d', color: '#fff', border: 'none', padding: '7px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const btnWarn: React.CSSProperties    = { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#b45309', color: '#fff', border: 'none', padding: '7px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const pillStyle = (on: boolean): React.CSSProperties => ({ background: on ? '#0f172a' : '#fff', color: on ? '#fff' : '#475569', border: '1px solid ' + (on ? '#0f172a' : '#cbd5e1'), padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer' });
const badgeStyle = (pending: boolean): React.CSSProperties => ({ background: pending ? '#fef3c7' : '#dcfce7', color: pending ? '#a16207' : '#15803d', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' });
const modalBg: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'grid', placeItems: 'center', zIndex: 1000 };
const modalBox: React.CSSProperties = { background: '#fff', borderRadius: 12, width: 'min(520px, 92vw)', padding: 20, boxShadow: '0 24px 60px rgba(15,23,42,0.25)' };

export default ScheduleConfirmations;
