import React, { useState, useEffect } from 'react';
import { CheckSquare, Eye, X, Bell, List, MailCheck, Search, Send, CheckCheck, AlertCircle, Timer } from 'lucide-react';
import '../../styles/AuditorCoordinator.css';
import { schedules, clients, confirmations as initialConfirmations, Confirmation } from './mockData';


// 48-hour auto-reminder configuration
const REMINDER_INTERVAL_MS = 48 * 60 * 60 * 1000;
const REMINDER_LOG_KEY = 'cms_audit_reminder_log_v1';

interface ReminderLog {
  scheduleId: string;
  lastSentAt: string;
  count: number;
}

const loadReminderLog = (): Record<string, ReminderLog> => {
  try {
    const raw = localStorage.getItem(REMINDER_LOG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveReminderLog = (log: Record<string, ReminderLog>) => {
  try {
    localStorage.setItem(REMINDER_LOG_KEY, JSON.stringify(log));
  } catch {}
};

const formatHoursAgo = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'in the future';
  const hrs = ms / (1000 * 60 * 60);
  if (hrs < 1) return `${Math.round(hrs * 60)}m ago`;
  if (hrs < 48) return `${Math.round(hrs)}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

const formatHoursUntil = (lastIso: string): string => {
  const next = new Date(lastIso).getTime() + REMINDER_INTERVAL_MS;
  const ms = next - Date.now();
  if (ms <= 0) return 'due now';
  const hrs = ms / (1000 * 60 * 60);
  if (hrs < 1) return `in ${Math.round(hrs * 60)}m`;
  return `in ${Math.round(hrs)}h`;
};

// Extend the Confirmation interface locally to include dueDate2
interface ExtendedConfirmation extends Omit<Confirmation, 'status'> {
  status: string;
  dueDate2?: string;
}

const AuditConfirmation: React.FC = () => {
  const [viewTab, setViewTab] = useState<'confirmations' | 'alerts'>('confirmations');
  const [confirmations, setConfirmations] = useState<ExtendedConfirmation[]>(
    initialConfirmations.map(c => ({ ...c, dueDate2: '' }))
  );
  
  const [showForm, setShowForm] = useState(false);
  const [viewModalData, setViewModalData] = useState<{conf: ExtendedConfirmation, clientName: string, clientAddress: string} | null>(null);
  
  // State for Top-Right Alerts
  const [activeAlert, setActiveAlert] = useState<{title: string, d1: string, d2: string} | null>(null);

  // State for Search
  const [searchTerm, setSearchTerm] = useState('');

  // Reminder log: tracks 48-hour auto-reminder dispatch per pending schedule
  const [reminderLog, setReminderLog] = useState<Record<string, ReminderLog>>(loadReminderLog());

  // Selection for bulk approve-all
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(new Set());

  // Auto-reminder tick: every 60s, scan pending schedules and dispatch reminders due
  useEffect(() => {
    const sendDueReminders = () => {
      const log = loadReminderLog();
      let changed = false;
      const now = Date.now();
      pendingSchedules.forEach((s) => {
        const id = String(s.id);
        const existing = log[id];
        const due =
          !existing ||
          now - new Date(existing.lastSentAt).getTime() >= REMINDER_INTERVAL_MS;
        if (due) {
          log[id] = {
            scheduleId: id,
            lastSentAt: new Date().toISOString(),
            count: (existing?.count || 0) + 1,
          };
          changed = true;
        }
      });
      if (changed) {
        saveReminderLog(log);
        setReminderLog({ ...log });
      }
    };
    // initial pass + interval
    sendDueReminders();
    const handle = setInterval(sendDueReminders, 60_000);
    return () => clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmations.length]);

  const [formData, setFormData] = useState({
    scheduleId: '',
    confirmedBy: '',
    confirmedAt: new Date().toISOString().split('T')[0],
    dueDate: '',
    dueDate2: '',
    notes: ''
  });

  const getClientName = (clientId?: string) => clients.find(c => c.id === clientId)?.name || 'Unknown Client';
  const getClientAddress = (clientId?: string) => (clients.find(c => c.id === clientId) as any)?.address || 'Address not available';
  const getClientEmail = (clientId?: string) => clients.find(c => c.id === clientId)?.email || 'client@example.com';
  
  const getScheduleDetails = (scheduleId: string | number) => {
    const sched = schedules.find(s => String(s.id) === String(scheduleId));
    if (!sched) return 'Unknown Schedule';
    return `${getClientName(sched.clientId)} - ${(sched as any).date ?? (sched as any).scheduledDate ?? 'N/A'}`;
  }; 

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.scheduleId || !formData.confirmedBy) return;

    const newConfirmation: ExtendedConfirmation = {
      id: `conf-${Date.now()}`,
      scheduleId: formData.scheduleId,
      confirmedBy: formData.confirmedBy,
      confirmedAt: formData.confirmedAt,
      dueDate: formData.dueDate,
      dueDate2: formData.dueDate2,
      notes: formData.notes || '',
      status: 'Confirmed',
    }; 

    setConfirmations([...confirmations, newConfirmation]);
    setFormData({
      scheduleId: '', confirmedBy: '', confirmedAt: new Date().toISOString().split('T')[0],
      dueDate: '', dueDate2: '', notes: ''
    });
    setShowForm(false);
  };

  // Handle Client Auto-Accept from Alert Email
  const handleClientAccept = (schedule: any) => {
    const targetDate = schedule.date || schedule.scheduledDate || new Date().toISOString().split('T')[0];
    const newConfirmation: ExtendedConfirmation = {
      id: `conf-${Date.now()}`,
      scheduleId: String(schedule.id),
      confirmedBy: getClientName(schedule.clientId), // Auto-populated as Client
      confirmedAt: new Date().toISOString().split('T')[0],
      dueDate: targetDate,
      dueDate2: '',
      notes: 'Client accepted via automated email link.',
      status: 'Confirmed',
    }; 

    setConfirmations([...confirmations, newConfirmation]);
    
    // Trigger Success Alert
    setActiveAlert({
        title: `Client Accepted: ${getClientName(schedule.clientId)}`,
        d1: 'Moved to Confirmations Tab',
        d2: ''
    });
    setTimeout(() => setActiveAlert(null), 4000);
  };

  const handleSendAlertEmail = (schedule: any) => {
    alert(`System Email sent to ${getClientEmail(schedule.clientId)} for upcoming audit.`);
    // Stamp reminder log so 48-hour clock resets
    const log = loadReminderLog();
    log[String(schedule.id)] = {
      scheduleId: String(schedule.id),
      lastSentAt: new Date().toISOString(),
      count: (log[String(schedule.id)]?.count || 0) + 1,
    };
    saveReminderLog(log);
    setReminderLog({ ...log });
  };

  // Toggle selection for an alert row
  const toggleAlertSelect = (id: string) => {
    setSelectedAlertIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Approve every visible alert in one click — bulk-creates Confirmation entries
  const handleApproveAll = () => {
    const targets = filteredAlerts.filter((s) => {
      // If user has selected any, only approve selection; else approve all visible.
      if (selectedAlertIds.size === 0) return true;
      return selectedAlertIds.has(String(s.id));
    });
    if (targets.length === 0) {
      alert('No pending schedules to approve.');
      return;
    }
    if (
      !window.confirm(
        `Approve ${targets.length} pending audit schedule${targets.length !== 1 ? 's' : ''} in one click?`
      )
    ) {
      return;
    }
    const stamp = Date.now();
    const today = new Date().toISOString().split('T')[0];
    const newConfs: ExtendedConfirmation[] = targets.map((schedule, idx) => {
      const targetDate =
        (schedule as any).date || (schedule as any).scheduledDate || today;
      return {
        id: `conf-bulk-${stamp}-${idx}`,
        scheduleId: String(schedule.id),
        confirmedBy: getClientName(schedule.clientId),
        confirmedAt: today,
        dueDate: targetDate,
        dueDate2: '',
        notes: 'Bulk approved via single-click Approve All.',
        status: 'Confirmed',
      };
    });
    setConfirmations([...confirmations, ...newConfs]);
    setSelectedAlertIds(new Set());
    setActiveAlert({
      title: `Approved ${newConfs.length} audits`,
      d1: 'All selected confirmations moved to Confirmations tab.',
      d2: '',
    });
    setTimeout(() => setActiveAlert(null), 4000);
  };

  const handleViewRow = (conf: ExtendedConfirmation) => {
    const sched = schedules.find(s => String(s.id) === String(conf.scheduleId));
    const clientName = sched ? getClientName(sched.clientId) : 'Unknown';
    const clientAddress = sched ? getClientAddress(sched.clientId) : 'Unknown';
    setViewModalData({ conf, clientName, clientAddress });
  };

  // Handle Row Submit
  const handleRowSubmit = (conf: ExtendedConfirmation) => {
    if(window.confirm('Are you sure you want to submit this confirmation?')) {
        setConfirmations(confirmations.map(c => c.id === conf.id ? { ...c, status: 'Submitted' } : c));
        setActiveAlert({
            title: 'Success',
            d1: 'Confirmation submitted successfully.',
            d2: ''
        });
        setTimeout(() => setActiveAlert(null), 3000);
    }
  };

  const pendingSchedules = schedules.filter(s => 
    !confirmations.find(c => String(c.scheduleId) === String(s.id))
  );

  const sortedConfirmations = [...confirmations].sort((a, b) => {
    const dateA1 = new Date(a.dueDate || 0);
    const dateB1 = new Date(b.dueDate || 0);
    return dateB1.getTime() - dateA1.getTime();
  });

  // Calculate if date is within 1 month (30 days) for automatic email trigger representation
  const getEmailStatus = (dateStr?: string) => {
    if (!dateStr) return 'Pending Target Date';
    const due = new Date(dateStr);
    if (isNaN(due.getTime())) return 'Pending Target Date';
    
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // If within 30 days of the audit date, consider the email auto-sent
    if (diffDays <= 30 && diffDays >= 0) return 'Auto-Sent (1 Month Prior)';
    if (diffDays < 0) return 'Overdue';
    return 'Pending (Scheduled > 1m)';
  };

  // --- Filtering Logic for Search ---
  const filteredConfirmations = sortedConfirmations.filter(conf => {
    const search = searchTerm.toLowerCase();
    const sched = schedules.find(s => String(s.id) === String(conf.scheduleId));
    const clientName = sched ? getClientName(sched.clientId).toLowerCase() : '';
    const ref = `ref: ${conf.scheduleId}`.toLowerCase();
    return clientName.includes(search) || ref.includes(search) || (conf.confirmedBy || '').toLowerCase().includes(search);
  });

  const filteredAlerts = pendingSchedules.filter(sched => {
    const search = searchTerm.toLowerCase();
    const clientName = getClientName(sched.clientId).toLowerCase();
    const auditName = (sched.auditName || 'Surveillance Audit').toLowerCase();
    return clientName.includes(search) || auditName.includes(search);
  });

  // Determine Scheduled Date dynamically for the selected schedule in the form
  const selectedScheduleObj = pendingSchedules.find(s => String(s.id) === formData.scheduleId);
  const selectedScheduledDate = selectedScheduleObj ? ((selectedScheduleObj as any).date || (selectedScheduleObj as any).scheduledDate || '') : '';

  return (
    <div className="audit-scope-container" style={{ position: 'relative' }}>
      {/* TOP RIGHT ALERT NOTIFICATION */}
      {activeAlert && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 2000, background: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderLeft: '4px solid #10b981', minWidth: '250px', animation: 'slideIn 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '14px', color: '#1e293b' }}>System Notification</strong>
                <X size={14} style={{ cursor: 'pointer' }} onClick={() => setActiveAlert(null)} />
            </div>
            <p style={{ fontSize: '13px', margin: '0 0 5px 0', fontWeight: 'bold' }}>{activeAlert.title}</p>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
                <div>{activeAlert.d1}</div>
                {activeAlert.d2 && <div>{activeAlert.d2}</div>}
            </div>
        </div>
      )}

      <div className="scope-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1>Surveillance Audit Confirmation</h1>
            <p>Track and log audit confirmations received from clients</p>
          </div>
          
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            {/* Unified Search Bar */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={18} style={{ position: 'absolute', left: '10px', color: '#6b7280' }} />
                <input 
                  type="text" 
                  placeholder="Search audits, clients..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ 
                    padding: '8px 12px 8px 36px', 
                    borderRadius: '6px', 
                    border: '1px solid #d1d5db', 
                    width: '250px',
                    outline: 'none',
                    fontSize: '14px'
                  }}
                />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                className={`add-btn ${viewTab === 'confirmations' ? 'active' : ''}`} 
                onClick={() => setViewTab('confirmations')}
                style={{ background: viewTab === 'confirmations' ? '#166534' : '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                <List size={16} /> Audit Confirmations
                </button>
                <button 
                className={`add-btn ${viewTab === 'alerts' ? 'active' : ''}`} 
                onClick={() => setViewTab('alerts')}
                style={{ background: viewTab === 'alerts' ? '#dc2626' : '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                <Bell size={16} /> Alerts & Pending
                </button>
            </div>
          </div>
        </div>
      </div>

      {showForm && viewTab === 'confirmations' && (
        <div className="checklist-form" style={{ marginBottom: '30px' }}>
          <h3>Receive Surveillance Confirmation</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Select Audit Schedule *</label>
              <select name="scheduleId" value={formData.scheduleId} onChange={handleInputChange} required>
                <option value="">-- Select Pending Audit --</option>
                {pendingSchedules.map(s => (
                  <option key={s.id} value={s.id}>{getScheduleDetails(s.id)}</option>
                ))}
              </select>
            </div>
            {/* Added Scheduled Date beside Confirmed Date */}
            <div className="form-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="form-group"><label>Confirmed By *</label><input type="text" name="confirmedBy" value={formData.confirmedBy} onChange={handleInputChange} required /></div>
              <div className="form-group"><label>Confirmation Date *</label><input type="date" name="confirmedAt" value={formData.confirmedAt} onChange={handleInputChange} required /></div>
              <div className="form-group"><label>Scheduled Date</label><input type="date" value={selectedScheduledDate} disabled style={{ backgroundColor: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }} title="Auto-populated from schedule" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>1st Due Date *</label><input type="date" name="dueDate" value={formData.dueDate} onChange={handleInputChange} required /></div>
              <div className="form-group"><label>2nd Due Date</label><input type="date" name="dueDate2" value={formData.dueDate2} onChange={handleInputChange} /></div>
            </div>
            <div className="form-actions">
              <button type="submit" className="submit-btn"><CheckSquare size={16} /> Confirm Audit</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrap">
        {viewTab === 'confirmations' ? (
          <>
            <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                 <button className="add-btn" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Log Confirmation'}</button>
            </div>
            <table className="checklists-table">
              <thead>
                <tr>
                  <th>Audit Reference</th>
                  <th>Client</th>
                  <th>Confirmed By</th>
                  <th>Confirmed Date</th>
                  <th>Scheduled Date</th>
                  <th>1st Due Date</th>
                  <th>2nd Due Date</th>
                  <th>Status</th>
                  <th>Email</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredConfirmations.map(conf => {
                  const schedule = schedules.find(s => String(s.id) === String(conf.scheduleId));
                  return (
                    <tr key={conf.id}>
                      <td><span className="mono" style={{ fontSize: '12px' }}>{schedule ? `Ref: ${schedule.id}` : 'N/A'}</span></td>
                      <td><strong>{schedule ? getClientName(schedule.clientId) : 'Unknown'}</strong></td>
                      <td>{conf.confirmedBy}</td>
                      <td>{conf.confirmedAt || '—'}</td>
                      <td>{schedule ? ((schedule as any).date || (schedule as any).scheduledDate || '—') : '—'}</td>
                      <td>{conf.dueDate || '—'}</td>
                      <td>{conf.dueDate2 || '—'}</td>
                      <td>
                         <span className="status-badge" style={{
                             background: conf.status === 'Submitted' ? '#dbeafe' : '#dcfce7',
                             color: conf.status === 'Submitted' ? '#1e40af' : '#166534',
                         }}>
                            {conf.status}
                         </span>
                      </td>
                      {/* Email field */}
                      <td>
                         <span style={{color: '#0369a1', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px'}}>
                            <MailCheck size={14} /> {schedule ? getClientEmail(schedule.clientId) : 'N/A'}
                         </span>
                      </td>
                      {/* View & Submit Actions */}
                      <td>
                         <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="view-btn" onClick={() => handleViewRow(conf)} title="View Details">
                                <Eye size={14} />
                            </button>
                            {conf.status !== 'Submitted' && (
                                <button 
                                    className="view-btn" 
                                    style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: '4px' }} 
                                    onClick={() => handleRowSubmit(conf)} 
                                    title="Submit Confirmation"
                                >
                                    <Send size={14} /> Submit
                                </button>
                            )}
                         </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredConfirmations.length === 0 && (
                   <tr><td colSpan={10} style={{textAlign: 'center', padding: '20px', color: '#64748b'}}>No audit confirmations found matching your search.</td></tr>
                )}
              </tbody>
            </table>
          </>
        ) : (
          <>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {selectedAlertIds.size > 0
                ? `${selectedAlertIds.size} selected`
                : `${filteredAlerts.length} pending`}
            </span>
            <button
              onClick={handleApproveAll}
              disabled={filteredAlerts.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                backgroundColor: filteredAlerts.length === 0 ? '#cbd5e1' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: filteredAlerts.length === 0 ? 'not-allowed' : 'pointer',
              }}
              title="Single-click approve all pending audits (or selected subset)"
            >
              <CheckCheck size={16} />
              {selectedAlertIds.size > 0 ? `Approve Selected (${selectedAlertIds.size})` : 'Approve All'}
            </button>
          </div>
          <table className="checklists-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={
                      filteredAlerts.length > 0 &&
                      selectedAlertIds.size === filteredAlerts.length
                    }
                    onChange={() => {
                      if (selectedAlertIds.size === filteredAlerts.length) {
                        setSelectedAlertIds(new Set());
                      } else {
                        setSelectedAlertIds(new Set(filteredAlerts.map(s => String(s.id))));
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>Audit Name</th>
                <th>Client Name</th>
                <th>Email</th>
                <th>Scheduled Date</th>
                <th>Email Status</th>
                <th>Auto-Reminder</th>
                <th style={{ minWidth: '220px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map(schedule => {
                const sid = String(schedule.id);
                const targetDate = (schedule as any).date || (schedule as any).scheduledDate;
                const emailStatus = getEmailStatus(targetDate);
                const isSent = emailStatus.includes('Auto-Sent') || emailStatus === 'Overdue';
                const reminderEntry = reminderLog[sid];
                const checked = selectedAlertIds.has(sid);

                return (
                  <tr key={`alert-${schedule.id}`} style={{ backgroundColor: checked ? '#eff6ff' : undefined }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAlertSelect(sid)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td><strong>{schedule.auditName || 'Surveillance Audit'}</strong></td>
                    {/* Client Name and Email Fields */}
                    <td>{getClientName(schedule.clientId)}</td>
                    <td><span style={{color: '#475569', fontSize: '13px'}}>{getClientEmail(schedule.clientId)}</span></td>
                    <td>{targetDate || '—'}</td>
                    <td>
                      <span className="status-badge" style={{ 
                          background: isSent ? '#dcfce7' : '#f1f5f9', 
                          color: isSent ? '#166534' : '#475569',
                          fontWeight: 600
                      }}>
                        {emailStatus}
                      </span>
                    </td>
                    <td>
                      {reminderEntry ? (
                        <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0369a1', fontWeight: 600 }}>
                            <CheckCheck size={12} /> Sent {formatHoursAgo(reminderEntry.lastSentAt)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b' }}>
                            <Timer size={12} /> Next {formatHoursUntil(reminderEntry.lastSentAt)}
                          </div>
                          <div style={{ color: '#94a3b8' }}>
                            Total: {reminderEntry.count} reminder{reminderEntry.count !== 1 ? 's' : ''}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertCircle size={12} /> Not yet sent
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            className="view-btn" 
                            style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd' }} 
                            onClick={() => handleSendAlertEmail(schedule)}
                            title="Resend/Send Alert Email manually"
                        >
                          <Bell size={14} /> <span style={{ marginLeft: 4 }}>Alert</span>
                        </button>
                        <button 
                            className="view-btn" 
                            style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }} 
                            onClick={() => handleClientAccept(schedule)}
                            title="Simulate Client Accepting the Audit from Email"
                        >
                          <CheckSquare size={14} /> <span style={{ marginLeft: 4 }}>Client Accept</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredAlerts.length === 0 && (
                 <tr><td colSpan={8} style={{textAlign: 'center', padding: '20px', color: '#64748b'}}>No pending schedules require alerts or match your search.</td></tr>
              )}
            </tbody>
          </table>
          </>
        )}
      </div>

      {/* VIEW MODAL (PDF STYLE) */}
      {viewModalData && (
        <div className="modal-overlay" onClick={() => setViewModalData(null)} style={{position: 'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200}}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{background:'#fff', borderRadius:8, width:'90%', maxWidth:800, padding: '40px'}}>
             <div style={{ border: '4px double #166534', padding: '20px', fontFamily: 'serif', textAlign: 'center' }}>
                <h1 style={{ color: '#166534' }}>CMS MANAGEMENT PVT. LTD.</h1>
                <h2>SURVEILLANCE AUDIT DETAILS</h2>
                <h3 style={{ fontSize: '24px', margin: '20px 0' }}>{viewModalData.clientName}</h3>
                <p>{viewModalData.clientAddress}</p>
                <div style={{ margin: '20px 0', borderTop: '1px solid #eee', padding: '20px' }}>
                    <p><strong>Ref:</strong> {viewModalData.conf.scheduleId} | <strong>By:</strong> {viewModalData.conf.confirmedBy}</p>
                    <p style={{ color: '#64748b', fontSize: '14px', marginTop: '10px' }}>
                        <strong>Confirmed Date:</strong> {viewModalData.conf.confirmedAt} | <strong>Scheduled Date:</strong> {schedules.find(s => String(s.id) === String(viewModalData.conf.scheduleId))?.date || 'N/A'}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
                        <div><p>1st Due</p><strong>{viewModalData.conf.dueDate}</strong></div>
                        <div><p>2nd Due</p><strong>{viewModalData.conf.dueDate2 || 'N/A'}</strong></div>
                    </div>
                </div>
                <button onClick={() => setViewModalData(null)} style={{ marginTop: '20px', padding: '8px 20px', cursor: 'pointer', background: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '4px' }}>Close Window</button>
             </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AuditConfirmation;