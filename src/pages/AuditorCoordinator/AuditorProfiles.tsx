import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Edit2, Plus, Search, Calendar, History, X, Building2, UserPlus } from 'lucide-react';
import CertificationsPicker, { DEFAULT_CERTIFICATIONS } from '../../components/CertificationsPicker';
import RatingStars from '../../components/RatingStars';
import AvailabilityCalendar from '../../components/AvailabilityCalendar';
import { getAuditors, saveAuditorsData, getNextAuditorId } from './utils/dataStorage';
import { Auditor, AuditSchedule, AuditorRating } from './mockData';
import '../../styles/AuditorCoordinator.css';
import '../../styles/AvailabilityCalendar.css';

/* -----------------------------------------------------------
   Departments (storage-backed)
----------------------------------------------------------- */
interface Department {
  id: string;
  name: string;
  description: string;
}

const DEPARTMENTS_KEY = 'cms_departments_v1';

const DEFAULT_DEPARTMENTS: Department[] = [
  { id: 'DEPT-001', name: 'Quality',              description: 'Quality management & assurance' },
  { id: 'DEPT-002', name: 'Security',             description: 'Information security & compliance' },
  { id: 'DEPT-003', name: 'Safety',               description: 'Occupational health & safety' },
  { id: 'DEPT-004', name: 'HR',                   description: 'Human resources & people ops' },
  { id: 'DEPT-005', name: 'Admin',                description: 'General administration' },
  { id: 'DEPT-006', name: 'Software Development', description: 'Engineering & product' },
  { id: 'DEPT-007', name: 'Purchase',             description: 'Procurement & vendor management' },
];

const loadDepartments = (): Department[] => {
  try {
    const raw = localStorage.getItem(DEPARTMENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  // Seed defaults
  try { localStorage.setItem(DEPARTMENTS_KEY, JSON.stringify(DEFAULT_DEPARTMENTS)); } catch {}
  return [...DEFAULT_DEPARTMENTS];
};

const saveDepartments = (rows: Department[]) => {
  try { localStorage.setItem(DEPARTMENTS_KEY, JSON.stringify(rows)); } catch {}
};

const allocateDepartmentId = (existing: Department[]): string => {
  const nums = existing
    .map(d => d.id.match(/(\d+)$/)?.[1])
    .filter(Boolean)
    .map(n => parseInt(n!, 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `DEPT-${String(next).padStart(3, '0')}`;
};

/* -----------------------------------------------------------
   Skill families (storage-backed, extensible)
----------------------------------------------------------- */



const SCHEDULE_KEYS = ['cms_audit_schedules', 'cms_audit_schedules_v3'];

interface AuditorFormData {
  name: string;
  email: string;
  role: string;
  specialization: string;
  department: string;
  certifications: string[];
  skills: Record<string, number>;
}

const blankForm = (): AuditorFormData => ({
  name: '',
  email: '',
  role: 'Lead Auditor',
  specialization: '',
  department: '',
  certifications: [],
  skills: {},
});

const aggregateRating = (ratings?: AuditorRating[]): { value: number; count: number } => {
  if (!ratings || ratings.length === 0) return { value: 0, count: 0 };
  const sum = ratings.reduce((s, r) => s + (r.score || 0), 0);
  return { value: sum / ratings.length, count: ratings.length };
};

const AuditorProfiles: React.FC = () => {
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [schedules, setSchedules] = useState<AuditSchedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<AuditorFormData>(blankForm());

  // Side-modal state
  const [calendarFor, setCalendarFor] = useState<Auditor | null>(null);
  const [ratingsFor, setRatingsFor] = useState<Auditor | null>(null);
  const [newRating, setNewRating] = useState({ score: 5, audit: '', note: '' });

  // Departments + skill families state
  const [departments, setDepartments] = useState<Department[]>(() => loadDepartments());
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptForm, setDeptForm] = useState<Department>({ id: '', name: '', description: '' });


  const isEditing = editingId !== null;
  const navigate = useNavigate();

  useEffect(() => {
    const loaded = getAuditors();
    const normalized: Auditor[] = loaded.map((a, idx) => {
      const raw = a as any;
      return {
        id: raw.id ?? (raw._id ? Number(raw._id) : idx + 1),
        name: raw.name ?? '',
        email: raw.email ?? '',
        role: raw.role ?? 'Lead Auditor',
        specialization: raw.specialization ?? '',
        department: raw.department ?? '',
        certifications: Array.isArray(raw.certifications) ? raw.certifications : raw.certifications ? [raw.certifications] : [],
        status: raw.status ?? 'Active',
        joinDate: raw.joinDate ?? new Date().toISOString().split('T')[0],
        skills: raw.skills && typeof raw.skills === 'object' ? raw.skills : {},
        ratings: Array.isArray(raw.ratings) ? raw.ratings : [],
        approvalStatus: raw.approvalStatus ?? 'Pending Approval',
        approvedBy: raw.approvedBy,
        approvedAt: raw.approvedAt,
        approvalNotes: raw.approvalNotes,
      };
    });
    setAuditors(normalized);
    saveAuditorsData(normalized);

    // Load schedules from any of the known sources
    const allSchedules: AuditSchedule[] = [];
    SCHEDULE_KEYS.forEach(key => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((p: any) => {
            const date = p.date || p.scheduledDate || p.proposedDate || p.preferredStart;
            if (!date) return;
            allSchedules.push({
              id: p.id ?? `${key}-${allSchedules.length}`,
              date, scheduledDate: date,
              leadAuditor: p.leadAuditor || p.lead || '',
              auditor: p.auditor || '',
              status: (p.status as any) || 'Scheduled',
              clientId: p.clientId || p.client,
              auditName: p.auditName || p.title,
            });
          });
        }
      } catch {}
    });
    setSchedules(allSchedules);
  }, []);

  const handleEdit = (auditor: Auditor) => {
    setEditingId(auditor.id);
    setFormData({
      name: auditor.name,
      email: auditor.email,
      role: auditor.role,
      specialization: auditor.specialization ?? '',
      department: auditor.department ?? '',
      certifications: Array.isArray(auditor.certifications) ? auditor.certifications : [],
      skills: auditor.skills || {},
    });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('Are you sure you want to delete this auditor?')) return;
    const next = auditors.filter((a) => a.id !== id);
    setAuditors(next);
    saveAuditorsData(next);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCertsChange = (certs: string[]) => {
    setFormData((prev) => ({ ...prev, certifications: certs }));
  };


  const resetForm = () => { setFormData(blankForm()); setEditingId(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.department) { alert('Please select a department.'); return; }

    const payload = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
      specialization: formData.specialization,
      department: formData.department,
      certifications: formData.certifications,
      skills: formData.skills,
    };

    let updated: Auditor[];
    if (isEditing && editingId !== null) {
      // Editing an existing profile re-triggers Lead Auditor validation
      updated = auditors.map((a) =>
        a.id === editingId
          ? {
              ...a,
              ...payload,
              approvalStatus: 'Pending Approval' as const,
              approvedBy: undefined,
              approvedAt: undefined,
              approvalNotes: undefined,
              status: 'Inactive' as const,
            }
          : a
      );
    } else {
      const newAuditor: Auditor = {
        id: getNextAuditorId(),
        ...payload,
        status: 'Inactive',
        joinDate: new Date().toISOString().split('T')[0],
        ratings: [],
        approvalStatus: 'Pending Approval',
      };
      updated = [...auditors, newAuditor];
    }
    setAuditors(updated);
    saveAuditorsData(updated);
    resetForm();
    setShowForm(false);
  };

  const handleCancel = () => { resetForm(); setShowForm(false); };
  const toggleForm = () => { if (showForm) handleCancel(); else { resetForm(); setShowForm(true); } };

  const handleAddRating = () => {
    if (!ratingsFor) return;
    const r: AuditorRating = {
      at: new Date().toISOString(),
      score: Math.max(0, Math.min(5, Number(newRating.score) || 0)),
      audit: newRating.audit || undefined,
      note: newRating.note || undefined,
    };
    const next = auditors.map(a => a.id === ratingsFor.id ? { ...a, ratings: [...(a.ratings || []), r] } : a);
    setAuditors(next);
    saveAuditorsData(next);
    setRatingsFor(next.find(a => a.id === ratingsFor.id) || null);
    setNewRating({ score: 5, audit: '', note: '' });
  };

  const handleDeleteRating = (idx: number) => {
    if (!ratingsFor) return;
    const next = auditors.map(a => {
      if (a.id !== ratingsFor.id) return a;
      const nextRatings = (a.ratings || []).filter((_, i) => i !== idx);
      return { ...a, ratings: nextRatings };
    });
    setAuditors(next);
    saveAuditorsData(next);
    setRatingsFor(next.find(a => a.id === ratingsFor.id) || null);
  };

  const filteredAuditors = useMemo(() => auditors.filter((auditor) => {
    const q = searchQuery.toLowerCase();
    const skillKeys = Object.keys(auditor.skills || {}).join(' ').toLowerCase();
    return (
      auditor.name.toLowerCase().includes(q) ||
      auditor.email.toLowerCase().includes(q) ||
      (auditor.specialization ?? '').toLowerCase().includes(q) ||
      (auditor.department ?? '').toLowerCase().includes(q) ||
      auditor.role.toLowerCase().includes(q) ||
      skillKeys.includes(q)
    );
  }), [auditors, searchQuery]);

  /* -------- Departments handlers -------- */
  const openDeptManager = () => {
    setEditingDeptId(null);
    setDeptForm({ id: allocateDepartmentId(departments), name: '', description: '' });
    setShowDeptModal(true);
  };

  const closeDeptManager = () => {
    setShowDeptModal(false);
    setEditingDeptId(null);
    setDeptForm({ id: '', name: '', description: '' });
  };

  const handleDeptFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setDeptForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveDepartment = () => {
    if (!deptForm.name.trim()) { alert('Department name is required.'); return; }
    if (!deptForm.id.trim()) { alert('Department ID is required.'); return; }
    let next: Department[];
    if (editingDeptId) {
      next = departments.map(d => d.id === editingDeptId ? { ...deptForm } : d);
    } else {
      // Prevent duplicate IDs and names (case-insensitive)
      const dupId = departments.some(d => d.id.toLowerCase() === deptForm.id.toLowerCase());
      const dupName = departments.some(d => d.name.toLowerCase() === deptForm.name.toLowerCase());
      if (dupId) { alert('A department with that ID already exists.'); return; }
      if (dupName) { alert('A department with that name already exists.'); return; }
      next = [...departments, { ...deptForm }];
    }
    setDepartments(next);
    saveDepartments(next);
    setEditingDeptId(null);
    setDeptForm({ id: allocateDepartmentId(next), name: '', description: '' });
  };

  const handleEditDepartment = (d: Department) => {
    setEditingDeptId(d.id);
    setDeptForm({ ...d });
  };

  const handleDeleteDepartment = (id: string) => {
    if (!window.confirm('Delete this department? Auditors assigned to it will keep their value but you cannot pick it again.')) return;
    const next = departments.filter(d => d.id !== id);
    setDepartments(next);
    saveDepartments(next);
    if (editingDeptId === id) {
      setEditingDeptId(null);
      setDeptForm({ id: allocateDepartmentId(next), name: '', description: '' });
    }
  };



  return (
    <div className="auditor-profiles-container">
      <div style={{
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        color: '#1e3a8a',
        padding: '10px 14px',
        borderRadius: 8,
        marginBottom: 16,
        fontSize: 13,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}>
        <span style={{ fontSize: 16 }}>i</span>
        <div>
          <strong>Approval workflow:</strong> Newly created or edited auditor profiles are sent to a
          Lead Auditor for validation. Profiles remain <em>Inactive</em> until approved.
        </div>
      </div>
      <div className="profiles-header">
        <div>
          <h1>Auditor Profiles</h1>
          <p>Manage auditor skills, availability, and rating history</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div className="search-container" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', color: '#6b7280' }} />
            <input
              type="text" placeholder="Search by name, skill, dept..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '8px 12px 8px 36px', borderRadius: 6, border: '1px solid #d1d5db', width: 260, outline: 'none' }}
            />
          </div>
          <button
            className="add-btn"
            onClick={() => navigate('/auditor-coordinator/auditor-requests')}
            style={{ background: '#06b6d4' }}
            title="View auditor join requests received from the website"
          >
            <UserPlus size={18} /> Auditor Requests
          </button>
          <button
            className="add-btn"
            onClick={openDeptManager}
            style={{ background: '#7c3aed' }}
            title="Add department"
          >
            <Building2 size={18} /> Add department
          </button>
          <button className="add-btn" onClick={toggleForm}>
            <Plus size={20} /> {showForm ? 'Close Form' : 'Add Auditor'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="profile-form">
          <h3>{isEditing ? 'Edit Auditor Profile' : 'Create New Auditor Profile'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full Name</label>
              <input name="name" value={formData.name} onChange={handleFormChange} required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Email Address</label>
                <input name="email" type="email" value={formData.email} onChange={handleFormChange} required />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select name="role" value={formData.role} onChange={handleFormChange}>
                  <option>Lead Auditor</option>
                  <option>Auditor</option>
                  <option>Junior Auditor</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Specialization</label>
                <input name="specialization" value={formData.specialization} onChange={handleFormChange} placeholder="e.g. Finance, IT, Safety" required />
              </div>
              <div className="form-group">
                <label>Department</label>
                <select name="department" value={formData.department} onChange={handleFormChange} required>
                  <option value="">-- Select Department --</option>
                  {departments.map((d) => (<option key={d.id} value={d.name}>{d.name}</option>))}
                </select>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Need a new department? Click <strong>Add department</strong> at the top right.
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Certifications</label>
              <CertificationsPicker
                value={formData.certifications}
                onChange={handleCertsChange}
                options={DEFAULT_CERTIFICATIONS}
                placeholder="Click to select certifications"
              />
            </div>

            <div className="form-actions">
              <button type="button" className="cancel-btn" onClick={handleCancel}>Cancel</button>
              <button type="submit" className="submit-btn">{isEditing ? 'Submit' : 'Add'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="profiles-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Country</th>
              <th>Department</th>
              <th>Skills</th>
              <th>Rating</th>
              <th>Approval</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAuditors.length > 0 ? (
              filteredAuditors.map((a) => {
                const agg = aggregateRating(a.ratings);
                const skillEntries = Object.entries(a.skills || {}).sort((x, y) => y[1] - x[1]);
                return (
                  <tr key={a.id}>
                    <td>
                      <div className="auditor-name" style={{ fontWeight: 600 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{a.email}</div>
                    </td>
                    <td>
                      <span className={`role-badge role-${(a.role || 'unknown').toLowerCase().replace(/\s+/g, '-')}`}>{a.role || 'Unknown'}</span>
                    </td>
                    <td>
                      {(a as any).country ? (
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: '#eff6ff', color: '#1e40af', fontWeight: 600 }}>
                          🌐 {(a as any).country}
                        </span>
                      ) : (<span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>)}
                    </td>
                    <td>{a.department || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 220 }}>
                        {skillEntries.length === 0 && <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                        {skillEntries.slice(0, 4).map(([k, v]) => (
                          <span key={k} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#eef2ff', color: '#4338ca' }}>
                            {k} <strong>·{v}</strong>
                          </span>
                        ))}
                        {skillEntries.length > 4 && (
                          <span style={{ fontSize: 11, color: '#64748b' }}>+{skillEntries.length - 4} more</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {agg.count > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <RatingStars value={agg.value} size={12} />
                          <span style={{ fontSize: 10, color: '#64748b' }}>{agg.count} rating{agg.count === 1 ? '' : 's'}</span>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>No ratings</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`validator-badge validator-${(a.approvalStatus || 'Pending Approval').toLowerCase().replace(/\s+/g, '-')}`}
                        title={
                          a.approvalStatus === 'Approved'
                            ? `Approved by ${a.approvedBy || 'Lead Auditor'}${a.approvedAt ? ' on ' + new Date(a.approvedAt).toLocaleDateString() : ''}`
                            : a.approvalStatus === 'Rejected'
                            ? `Rejected by ${a.approvedBy || 'Lead Auditor'}${a.approvalNotes ? ' — ' + a.approvalNotes : ''}`
                            : 'Awaiting Lead Auditor validation'
                        }
                      >
                        {a.approvalStatus || 'Pending Approval'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${(a.status || 'inactive').toLowerCase()}`}>{a.status || 'Inactive'}</span>
                    </td>
                    <td className="actions">
                      <button className="action-btn" onClick={() => setCalendarFor(a)} title="Availability calendar">
                        <Calendar size={16} />
                      </button>
                      <button className="action-btn" onClick={() => setRatingsFor(a)} title="Rating history">
                        <History size={16} />
                      </button>
                      <button className="action-btn edit" onClick={() => handleEdit(a)} title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button className="action-btn delete" onClick={() => handleDelete(a.id)} title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 20 }}>No auditors found{searchQuery ? ` matching "${searchQuery}"` : ''}.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Calendar modal */}
      {calendarFor && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCalendarFor(null); }}>
          <div className="modal-content" style={{ width: 'min(960px, 96vw)', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={18} /> Availability — {calendarFor.name}
              </h3>
              <button onClick={() => setCalendarFor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="#64748b" />
              </button>
            </div>
            <AvailabilityCalendar
              auditors={[calendarFor]}
              schedules={schedules}
              daysAhead={21}
              highlightAuditor={calendarFor.name}
            />
          </div>
        </div>
      )}

      {/* Ratings modal */}
      {ratingsFor && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setRatingsFor(null); }}>
          <div className="modal-content" style={{ width: 'min(560px, 95vw)', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>Rating History — {ratingsFor.name}</h3>
              <button onClick={() => setRatingsFor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="#64748b" />
              </button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <RatingStars value={aggregateRating(ratingsFor.ratings).value} size={18} />
              <span style={{ marginLeft: 6, fontSize: 12, color: '#64748b' }}>
                {aggregateRating(ratingsFor.ratings).count} entries
              </span>
            </div>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
              <strong style={{ fontSize: 13 }}>Add rating</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                <label style={{ fontSize: 12, color: '#475569' }}>Score: {newRating.score}</label>
                <input type="range" min="0" max="5" step="0.5" value={newRating.score} onChange={(e) => setNewRating({ ...newRating, score: Number(e.target.value) })} />
                <input value={newRating.audit} onChange={(e) => setNewRating({ ...newRating, audit: e.target.value })} placeholder="Audit ref (optional)" style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1' }} />
                <textarea rows={2} value={newRating.note} onChange={(e) => setNewRating({ ...newRating, note: e.target.value })} placeholder="Note (optional)" style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1' }} />
                <button className="submit-btn" type="button" onClick={handleAddRating}>Add rating</button>
              </div>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(ratingsFor.ratings || []).slice().reverse().map((r, i) => {
                const realIdx = (ratingsFor.ratings!.length - 1 - i);
                return (
                  <li key={`${r.at}-${i}`} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <RatingStars value={r.score} size={12} showLabel={false} />
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{new Date(r.at).toLocaleString()}{r.audit ? ` · ${r.audit}` : ''}</div>
                      {r.note && <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{r.note}</div>}
                    </div>
                    <button onClick={() => handleDeleteRating(realIdx)} style={{ background: 'transparent', border: 'none', color: '#b91c1c', cursor: 'pointer' }} title="Delete rating">
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
              {(ratingsFor.ratings || []).length === 0 && (
                <li style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>No ratings yet</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Department manager modal */}
      {showDeptModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeDeptManager(); }}>
          <div className="modal-content" style={{ width: 'min(720px, 96vw)', maxHeight: '92vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={18} /> Add department
              </h3>
              <button onClick={closeDeptManager} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="#64748b" />
              </button>
            </div>

            {/* Form */}
            <div style={{
              background: '#f8fafc', padding: 14, borderRadius: 10,
              border: '1px solid #e2e8f0', marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#0f172a' }}>
                {editingDeptId ? 'Edit department' : 'Add a new department'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Department Name</label>
                  <input
                    name="name"
                    value={deptForm.name}
                    onChange={handleDeptFormChange}
                    placeholder="e.g. Quality"
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Department ID</label>
                  <input
                    name="id"
                    value={deptForm.id}
                    onChange={handleDeptFormChange}
                    placeholder="DEPT-008"
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Department Description</label>
                  <textarea
                    name="description"
                    value={deptForm.description}
                    onChange={handleDeptFormChange}
                    rows={2}
                    placeholder="What does this department do?"
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                {editingDeptId && (
                  <button
                    type="button"
                    onClick={() => { setEditingDeptId(null); setDeptForm({ id: allocateDepartmentId(departments), name: '', description: '' }); }}
                    style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                  >Cancel edit</button>
                )}
                <button
                  type="button"
                  onClick={handleSaveDepartment}
                  style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} /> {editingDeptId ? 'Save changes' : 'Add department'}
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>ID</th>
                    <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Name</th>
                    <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</th>
                    <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No departments yet — add your first one above.</td></tr>
                  ) : departments.map((d) => (
                    <tr key={d.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <code style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{d.id}</code>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{d.name}</td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>{d.description || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleEditDepartment(d)}
                          title="Edit"
                          style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 4, padding: 4, cursor: 'pointer', color: '#475569', marginRight: 4 }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteDepartment(d.id)}
                          title="Delete"
                          style={{ background: 'transparent', border: '1px solid #fecaca', borderRadius: 4, padding: 4, cursor: 'pointer', color: '#b91c1c' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <style>{`
    .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: #fff; padding: 22px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
      `}</style>
    </div>
  );
};

export default AuditorProfiles;
