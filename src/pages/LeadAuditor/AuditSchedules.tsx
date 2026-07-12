import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Trash2, Users, Bell, MapPin, X, Search, CheckCircle, Edit2, CalendarDays, Eye } from 'lucide-react';
import '../../styles/LeadAuditor/AuditSchedules.css';
import Tooltip from '../../components/Tooltip';
import ViewOnlyDoc from '../../components/ViewOnlyDoc';
import {
  MergedScheduleEntry,
  SCHEDULES_UPDATED_EVENT,
  StoredSchedule,
  entryKey,
  readMergedSchedules,
  scheduleDate,
  scheduleOrg,
  scheduleStandard,
  scheduleStatus,
  scheduleTitle,
  updateSchedule,
} from '../../utils/auditScheduleStore';

// --- Interfaces ---
interface User {
  id: string;
  name: string;
  email: string;
  role: 'auditor' | 'lead-auditor' | 'client';
}

interface Audit {
  id: string;
  title: string;
  clientId: string; 
  status: 'planned' | 'in-progress' | 'completed';
}

interface Schedule {
  id: string;
  auditId: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  assignedAuditors: string[]; 
  status: 'scheduled' | 'completed' | 'cancelled' | 'confirmed' | 'approved' | 'rejected' | 'date-change-requested';
  /** Present when the row is backed by the shared schedule store. */
  entry?: MergedScheduleEntry;
  auditTitle?: string;
  clientName?: string;
  auditStatus?: string;
  attachmentName?: string;
  attachmentDataUrl?: string;
}

// --- Mock Data ---
const MOCK_USERS: User[] = [
  { id: 'u1', name: 'John Doe', email: 'john@audit.com', role: 'auditor' },
  { id: 'u2', name: 'Jane Smith', email: 'jane@audit.com', role: 'lead-auditor' },
  { id: 'u3', name: 'Acme Corp Admin', email: 'admin@acme.com', role: 'client' }, 
  { id: 'u4', name: 'Bob Wilson', email: 'bob@audit.com', role: 'auditor' },
];

const MOCK_AUDITS: Audit[] = [
  { id: 'a1', title: 'ISO 9001:2015 Surveillance', clientId: 'u3', status: 'planned' },
  { id: 'a2', title: 'Internal Security Audit', clientId: 'u3', status: 'planned' },
];

const MOCK_SCHEDULES: Schedule[] = [
  {
    id: 's1',
    auditId: 'a1',
    scheduledDate: '2025-01-15',
    startTime: '09:00',
    endTime: '17:00',
    location: 'Conference Room A',
    notes: 'Bring safety gear',
    assignedAuditors: ['u1'],
    status: 'scheduled'
  }
];

// --- Shared schedule store -> local row mapping (mocks are only a fallback) ---
const asOptString = (v: unknown): string | undefined =>
  typeof v === 'string' && v ? v : undefined;

const mapRowStatus = (r: StoredSchedule): Schedule['status'] => {
  const s = scheduleStatus(r).toLowerCase();
  if (s === 'cancelled') return 'cancelled';
  if (s === 'completed') return 'completed';
  if (s === 'approved') return 'approved';
  if (r.auditorConfirmation === 'Declined') return 'rejected';
  if (r.auditorConfirmation === 'Confirmed') return 'confirmed';
  if ((r.auditorConfirmationNote || '').toLowerCase().includes('date change')) return 'date-change-requested';
  return 'scheduled';
};

const mapEntryToRow = (e: MergedScheduleEntry): Schedule => {
  const r = e.record;
  const assigned = Array.from(new Set(
    [r.leadAuditor, r.auditor, ...(r.assignedAuditors || [])]
      .filter((n): n is string => Boolean(n && String(n).trim()))
  ));
  return {
    id: entryKey(e),
    auditId: '',
    scheduledDate: scheduleDate(r),
    startTime: r.startTime || '',
    endTime: r.endTime || '',
    location: r.location || '',
    notes: r.notes || r.auditScope || '',
    assignedAuditors: assigned,
    status: mapRowStatus(r),
    entry: e,
    auditTitle: r.auditName || r.auditTitle || (scheduleStandard(r) ? `${scheduleStandard(r)} Audit` : scheduleTitle(r)),
    clientName: scheduleOrg(r),
    auditStatus: scheduleStatus(r),
    attachmentName: asOptString(r.attachmentName),
    attachmentDataUrl: asOptString(r.attachmentDataUrl),
  };
};

/** Rows come from the shared schedule store; mock rows only when the store is empty. */
const buildRows = (): Schedule[] => {
  const merged = readMergedSchedules();
  if (merged.length === 0) return MOCK_SCHEDULES;
  return merged
    .filter((e) => scheduleStatus(e.record).toLowerCase() !== 'cancelled')
    .map(mapEntryToRow);
};

export default function AuditSchedules() {
  // --- State ---
  const [schedules, setSchedules] = useState<Schedule[]>(() => buildRows());
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [docPreview, setDocPreview] = useState<{ name: string; dataUrl: string } | null>(null);

  // Reload rows whenever the shared schedule store changes (same tab or cross-tab)
  useEffect(() => {
    const refresh = () => setSchedules(buildRows());
    window.addEventListener(SCHEDULES_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(SCHEDULES_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  
  // Edit Modal State
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState({
    auditId: '',
    scheduledDate: '',
    startTime: '',
    endTime: '',
    location: '',
    notes: '',
    assignedAuditors: [] as string[],
  });

  // Response Modal State
  const [responseSchedule, setResponseSchedule] = useState<Schedule | null>(null);
  const [responseType, setResponseType] = useState<'approved' | 'rejected' | 'date-change' | null>(null);
  const [suggestedDate, setSuggestedDate] = useState('');

  // --- Helper Functions ---
  const getAudit = (id: string) => MOCK_AUDITS.find(a => a.id === id);
  const getUser = (id: string) => MOCK_USERS.find(u => u.id === id);
  const availableAuditors = MOCK_USERS.filter(u => u.role === 'auditor' || u.role === 'lead-auditor');

  // --- Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAuditorSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setFormData(prev => ({ ...prev, assignedAuditors: selectedOptions }));
  };

  const openEditModal = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      auditId: schedule.auditId,
      scheduledDate: schedule.scheduledDate,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      location: schedule.location,
      notes: schedule.notes,
      assignedAuditors: schedule.assignedAuditors,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;

    if (editingSchedule.entry) {
      // Store-backed row: persist through the shared schedule store
      updateSchedule(editingSchedule.entry, {
        date: formData.scheduledDate,
        scheduledDate: formData.scheduledDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        location: formData.location,
        notes: formData.notes,
      });
    } else {
      const updatedSchedules = schedules.map(s => 
        s.id === editingSchedule.id ? { ...s, ...formData } as Schedule : s
      );
      setSchedules(updatedSchedules);
    }

    alert('Schedule updated successfully.');
    setEditingSchedule(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      const row = schedules.find(s => s.id === id);
      if (row?.entry) {
        // Store-backed row: hide via a status patch so the Coordinator still sees it
        updateSchedule(row.entry, { status: 'Cancelled' });
      } else {
        setSchedules(schedules.filter(s => s.id !== id));
      }
    }
  };

  const handleConfirm = (id: string) => {
    if (window.confirm('Confirm this audit schedule?')) {
      const row = schedules.find(s => s.id === id);
      if (row?.entry) {
        updateSchedule(row.entry, {
          auditorConfirmation: 'Confirmed',
          auditorConfirmationAt: new Date().toISOString(),
          auditorConfirmationNote: 'Confirmed by Lead Auditor',
        });
      } else {
        setSchedules(schedules.map(s => s.id === id ? { ...s, status: 'confirmed' } : s));
      }
    }
  };

  const handleResponseSubmit = () => {
    if (!responseSchedule || !responseType) return;

    if (responseType === 'date-change' && !suggestedDate) {
      alert('Please select a suggested date to send to the coordinator.');
      return;
    }

    if (responseSchedule.entry) {
      // Store-backed row: persist the decision so the Coordinator sees it
      const nowIso = new Date().toISOString();
      if (responseType === 'approved') {
        updateSchedule(responseSchedule.entry, {
          status: 'Approved',
          auditorConfirmation: 'Confirmed',
          auditorConfirmationAt: nowIso,
          auditorConfirmationNote: 'Schedule approved by Lead Auditor',
        });
      } else if (responseType === 'rejected') {
        updateSchedule(responseSchedule.entry, {
          auditorConfirmation: 'Declined',
          auditorConfirmationAt: nowIso,
          auditorConfirmationNote: 'Schedule rejected by Lead Auditor',
        });
      } else {
        updateSchedule(responseSchedule.entry, {
          auditorConfirmationAt: nowIso,
          auditorConfirmationNote: `Date change requested: suggested new date is ${suggestedDate}`,
        });
      }
    } else {
      setSchedules(schedules.map(s => {
        if (s.id === responseSchedule.id) {
          return { 
            ...s, 
            status: responseType === 'date-change' ? 'date-change-requested' : responseType,
            notes: responseType === 'date-change' ? `${s.notes}\n[Date Change Requested: Suggested new date is ${suggestedDate}]` : s.notes
          };
        }
        return s;
      }));
    }

    if (responseType === 'date-change') {
      alert(`Date change request sent to coordinator. Suggested Date: ${suggestedDate}`);
    } else {
      alert(`Schedule status updated to: ${responseType}`);
    }

    setResponseSchedule(null);
    setResponseType(null);
    setSuggestedDate('');
  };

  // --- Search Filtering ---
  const filteredSchedules = schedules.filter(schedule => {
    const search = searchTerm.toLowerCase();
    const audit = getAudit(schedule.auditId);
    const client = audit ? getUser(audit.clientId) : null;
    
    return (
      (audit?.title || schedule.auditTitle || '').toLowerCase().includes(search) ||
      (client?.name || schedule.clientName || '').toLowerCase().includes(search) ||
      (schedule.location || '').toLowerCase().includes(search)
    );
  });

  return (
    <div className="audit-schedules-container" style={{ padding: '20px', maxWidth: '100%', overflowX: 'auto' }}>
      {/* User-friendly flow steps for Lead Auditor */}
      <div className="cs-la-flow" style={{ background: 'linear-gradient(135deg, #ecfeff 0%, #f0fdfa 100%)', border: '1px solid #67e8f9', borderLeft: '4px solid #06b6d4', padding: '12px 16px', borderRadius: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#155e75', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          <span>📋 Lead Auditor Flow</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            { n: 1, t: 'Receive', d: 'Schedule lands here from Coordinator' },
            { n: 2, t: 'Review',  d: 'Click 👁 to view docs (read-only)' },
            { n: 3, t: 'Approve', d: 'Click ✓ to confirm the schedule' },
            { n: 4, t: 'Close',   d: 'Audit completes → finalise report' },
          ].map(s => (
            <div key={s.n} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 8, fontSize: 12, color: '#0f172a' }}>
              <span style={{ background: '#06b6d4', color: '#fff', width: 18, height: 18, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>{s.n}</span>
              <span style={{ fontWeight: 700 }}>{s.t}</span>
              <span style={{ color: '#64748b' }}>· {s.d}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Header & Search */}
      <div className="header-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', margin: '0 0 8px 0', color: '#0f172a' }}>Audit Schedules</h1>
          <p style={{ color: '#64748b', margin: 0 }}>Manage timelines, review, and confirm audit schedules</p>
        </div>
        
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', color: '#64748b' }} />
            <input 
              type="text" 
              placeholder="Search by Title, Client, Location..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                padding: '10px 14px 10px 38px', 
                borderRadius: '8px', 
                border: '1px solid #cbd5e1', 
                width: '320px',
                outline: 'none',
                fontSize: '14px'
              }}
            />
            <button
              type="button"
              onClick={() => setViewMode(v => v === 'table' ? 'calendar' : 'table')}
              style={{ marginLeft: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: viewMode === 'calendar' ? '#0e7490' : '#fff', color: viewMode === 'calendar' ? '#fff' : '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              title="Toggle calendar view"
            >
              <CalendarDays size={14} /> {viewMode === 'calendar' ? 'Table View' : 'Calendar View'}
            </button>
        </div>
      </div>

      {/* Calendar view */}
      {viewMode === 'calendar' && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 18, marginBottom: 16, border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 14px 0', color: '#0f172a', fontSize: 15 }}>Audits on the Calendar</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {filteredSchedules.map(sc => {
              const audit = getAudit(sc.auditId);
              return (
                <div key={sc.id} style={{ padding: 12, border: '1px solid #e2e8f0', borderLeft: '4px solid #0e7490', borderRadius: 8, background: '#f8fafc', cursor: 'pointer' }}
                  onClick={() => openEditModal(sc)}>
                  <div style={{ fontSize: 11, color: '#0e7490', fontWeight: 700 }}>{sc.scheduledDate}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: '#0f172a' }}>{audit?.title || sc.auditTitle || 'Audit'}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{sc.startTime} – {sc.endTime}</div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 6, padding: '2px 6px', background: '#e2e8f0', borderRadius: 4, display: 'inline-block' }}>{sc.status}</div>
                </div>
              );
            })}
            {filteredSchedules.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#94a3b8', padding: 30 }}>No schedules in this view.</div>
            )}
          </div>
        </div>
      )}

      {/* Table view */}
      {viewMode === 'table' && (
      <div className="card" style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '16px 20px', color: '#334155', fontWeight: 600 }}>Audit Title</th>
              <th style={{ padding: '16px 20px', color: '#334155', fontWeight: 600 }}>Client</th>
              <th style={{ padding: '16px 20px', color: '#334155', fontWeight: 600 }}>Audit Status</th>
              <th style={{ padding: '16px 20px', color: '#334155', fontWeight: 600 }}>Date & Time</th>
              <th style={{ padding: '16px 20px', color: '#334155', fontWeight: 600 }}>Location</th>
              <th style={{ padding: '16px 20px', color: '#334155', fontWeight: 600 }}>Assigned To</th>
              <th style={{ padding: '16px 20px', color: '#334155', fontWeight: 600 }}>Notes</th>
              <th style={{ padding: '16px 20px', color: '#334155', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '16px 20px', color: '#334155', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSchedules.map(schedule => {
              const audit = getAudit(schedule.auditId);
              const client = audit ? getUser(audit.clientId) : null;
              const assignedNames = schedule.assignedAuditors
                .map(id => {
                  const u = getUser(id);
                  return u ? `${u.name}${u.role === 'lead-auditor' ? ' (Lead)' : ''}` : id;
                })
                .filter(Boolean);

              return (
                <tr key={schedule.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '16px 20px' }}><strong>{audit?.title || schedule.auditTitle || 'Unknown Audit'}</strong></td>
                  <td style={{ padding: '16px 20px' }}>{client?.name || schedule.clientName || '—'}</td>
                  <td style={{ padding: '16px 20px', textTransform: 'capitalize', color: '#334155' }}>{audit?.status || schedule.auditStatus || '—'}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} color="#64748b"/> {schedule.scheduledDate}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                      <Clock size={13} /> {schedule.startTime} - {schedule.endTime}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} color="#64748b"/> {schedule.location}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                        <Users size={14} color="#64748b"/>
                        <span>{assignedNames.length} Auditor(s)</span>
                      </div>
                      {assignedNames.length > 0 && (
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{assignedNames.join(', ')}</div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', maxWidth: '240px' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} title={schedule.notes || ''}>
                        {schedule.notes || '—'}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span className={`status-badge status-${schedule.status}`} style={{ textTransform: 'capitalize' }}>
                      {schedule.status.replace(/-/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      {schedule.attachmentDataUrl && (
                        <Tooltip label="View attached schedule document (read-only)">
                          <button className="icon-btn" style={{ color: '#0e7490', background: '#cffafe' }} onClick={() => setDocPreview({ name: (schedule.attachmentName || 'Schedule-' + schedule.id + '.pdf'), dataUrl: schedule.attachmentDataUrl! })}>
                            <Eye size={16} />
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip label="Edit schedule">
                        <button className="icon-btn" style={{ color: '#2563eb', background: '#eff6ff' }} onClick={() => openEditModal(schedule)}>
                          <Edit2 size={16} />
                        </button>
                      </Tooltip>
                      <Tooltip label="Respond / propose new date">
                        <button className="icon-btn" style={{ color: '#f59e0b', background: '#fef3c7' }} onClick={() => setResponseSchedule(schedule)}>
                          <Bell size={16} />
                        </button>
                      </Tooltip>
                      <Tooltip label="Approve / confirm schedule">
                        <button className="icon-btn" style={{ color: '#166534', background: '#dcfce7' }} onClick={() => handleConfirm(schedule.id)}>
                          <CheckCircle size={16} />
                        </button>
                      </Tooltip>
                      <Tooltip label="Delete schedule">
                        <button className="icon-btn" style={{ color: '#dc2626', background: '#fee2e2' }} onClick={() => handleDelete(schedule.id)}>
                          <Trash2 size={16} />
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredSchedules.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  No schedules found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {docPreview && (
        <ViewOnlyDoc
          open={true}
          onClose={() => setDocPreview(null)}
          title="Schedule Document Preview"
          fileName={docPreview.name}
          dataUrl={docPreview.dataUrl}
        />
      )}

      {/* --- Edit Modal --- */}
      {editingSchedule && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ background: '#fff', borderRadius: '12px', padding: '30px', width: '90%', maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#0f172a' }}>Edit Schedule</h2>
              <button onClick={() => setEditingSchedule(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={24} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Audit Title</label>
                <input type="text" className="form-input" value={getAudit(formData.auditId)?.title || editingSchedule.auditTitle || ''} disabled style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9' }} />
              </div>

              <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Date *</label>
                  <input type="date" name="scheduledDate" className="form-input" value={formData.scheduledDate} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Location *</label>
                  <input type="text" name="location" className="form-input" value={formData.location} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                </div>
              </div>

              <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Start Time</label>
                  <input type="time" name="startTime" className="form-input" value={formData.startTime} onChange={handleInputChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>End Time</label>
                  <input type="time" name="endTime" className="form-input" value={formData.endTime} onChange={handleInputChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Assign Auditors (Hold Ctrl/Cmd to select multiple)</label>
                <select multiple name="assignedAuditors" className="form-select" value={formData.assignedAuditors} onChange={handleAuditorSelection} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', height: '100px' }}>
                  {availableAuditors.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Notes</label>
                <textarea name="notes" className="form-textarea" rows={3} value={formData.notes} onChange={handleInputChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setEditingSchedule(null)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>Update Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Response / Reminder Modal --- */}
      {responseSchedule && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ background: '#fff', borderRadius: '12px', padding: '30px', width: '90%', maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#0f172a' }}>Schedule Response</h2>
              <button onClick={() => { setResponseSchedule(null); setResponseType(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={24} color="#64748b" />
              </button>
            </div>
            
            <p style={{ color: '#475569', marginBottom: '24px' }}>Please review the schedule and select your response to be sent back to the Audit Coordinator.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <button 
                  onClick={() => setResponseType('approved')} 
                  style={{ padding: '12px', borderRadius: '8px', border: responseType === 'approved' ? '2px solid #166534' : '1px solid #cbd5e1', background: responseType === 'approved' ? '#dcfce7' : '#fff', textAlign: 'left', fontWeight: 500, cursor: 'pointer' }}
                >
                    ✅ Approve Schedule
                </button>
                <button 
                  onClick={() => setResponseType('rejected')} 
                  style={{ padding: '12px', borderRadius: '8px', border: responseType === 'rejected' ? '2px solid #dc2626' : '1px solid #cbd5e1', background: responseType === 'rejected' ? '#fee2e2' : '#fff', textAlign: 'left', fontWeight: 500, cursor: 'pointer' }}
                >
                    ❌ Reject Schedule
                </button>
                <button 
                  onClick={() => setResponseType('date-change')} 
                  style={{ padding: '12px', borderRadius: '8px', border: responseType === 'date-change' ? '2px solid #d97706' : '1px solid #cbd5e1', background: responseType === 'date-change' ? '#fef3c7' : '#fff', textAlign: 'left', fontWeight: 500, cursor: 'pointer' }}
                >
                    📅 Request Date Change
                </button>
            </div>

            {responseType === 'date-change' && (
               <div style={{ marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#0f172a' }}>Suggest New Date *</label>
                  <input 
                    type="date" 
                    value={suggestedDate} 
                    onChange={(e) => setSuggestedDate(e.target.value)} 
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
                  />
               </div>
            )}

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => { setResponseSchedule(null); setResponseType(null); }} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button 
                onClick={handleResponseSubmit} 
                disabled={!responseType}
                style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', background: !responseType ? '#94a3b8' : '#2563eb', color: '#fff', cursor: !responseType ? 'not-allowed' : 'pointer', fontWeight: 500 }}
              >
                Submit Response
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}