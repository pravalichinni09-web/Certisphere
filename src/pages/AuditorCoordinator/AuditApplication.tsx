import React, { useState, ChangeEvent, FormEvent, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit2, ArrowLeft, ArrowRight, Save, Paperclip, X, Clock, FileText } from 'lucide-react';
import StandardPicker from '../../components/StandardPicker';
import WizardSteps, { WizardStep } from '../../components/WizardSteps';
import { saveDraft, readDraft, clearDraft, getDraftSavedAt } from '../../utils/draftStorage';
import { validateEmail } from '../../utils/validators';
import '../../styles/AuditorCoordinator.css';
import '../../styles/WizardSteps.css';

interface ScopeAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl?: string; // base64 (kept small)
}

interface AuditApplicationForm {
  organizationName: string;
  auditStandard: string;
  scopeOfAudit: string;
  preferredAuditDate: string;
  contactPerson: string;
  contactEmail: string;
  status?: string;
  attachments?: ScopeAttachment[];
}

interface AuditApplicationItem extends AuditApplicationForm {
  id: number | string;
}

const STEPS: WizardStep[] = [
  { key: 'org', label: 'Organization' },
  { key: 'scope', label: 'Audit & Scope' },
  { key: 'attach', label: 'Attachments', optional: true },
  { key: 'review', label: 'Review' },
];

const DRAFT_KEY = 'audit_application_form';
const STORAGE_KEY = 'cms_audit_applications_v2';
const MAX_ATTACHMENT_SIZE = 1.5 * 1024 * 1024; // 1.5 MB per file

const blankForm = (): AuditApplicationForm => ({
  organizationName: '',
  auditStandard: '',
  scopeOfAudit: '',
  preferredAuditDate: '',
  contactPerson: '',
  contactEmail: '',
  status: 'Pending',
  attachments: [],
});

const defaultApps: AuditApplicationItem[] = [
  { id: 1, organizationName: 'Tech Solutions Inc.', auditStandard: 'ISO 9001', scopeOfAudit: 'Software Development Department - Quality Management Systems', preferredAuditDate: '2025-02-15', contactPerson: 'John Doe', contactEmail: 'john.doe@techsol.com', status: 'Under Review', attachments: [] },
  { id: 2, organizationName: 'Green Earth NGO', auditStandard: 'ISO 14001', scopeOfAudit: 'Environmental Management across all facilities', preferredAuditDate: '2025-03-10', contactPerson: 'Jane Smith', contactEmail: 'jane.smith@greenearth.org', status: 'Approved', attachments: [] },
  { id: 3, organizationName: 'Metro City Council', auditStandard: 'ISO 27001', scopeOfAudit: 'Information Security Management for IT Operations', preferredAuditDate: '2025-02-28', contactPerson: 'Bob Johnson', contactEmail: 'bob.johnson@metrocity.gov', status: 'Pending', attachments: [] },
];

const fmtTime = (ms: number | null): string => {
  if (!ms) return '';
  const d = new Date(ms);
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60000)}m ago`;
  return d.toLocaleString();
};

const AuditApplication: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [stepIdx, setStepIdx] = useState(0);
  const [formData, setFormData] = useState<AuditApplicationForm>(blankForm());
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [applications, setApplications] = useState<AuditApplicationItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : defaultApps;
    } catch {
      return defaultApps;
    }
  });

  // Persist applications
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(applications)); } catch {}
  }, [applications]);

  // On mount, see if there is a draft to offer
  useEffect(() => {
    const ts = getDraftSavedAt(DRAFT_KEY);
    setHasDraft(!!ts);
    setDraftSavedAt(ts);
  }, []);

  // Autosave debounced
  useEffect(() => {
    if (!showForm || editingId) return;
    const t = setTimeout(() => {
      saveDraft<AuditApplicationForm>(DRAFT_KEY, formData);
      setDraftSavedAt(Date.now());
      setHasDraft(true);
    }, 800);
    return () => clearTimeout(t);
  }, [formData, showForm, editingId]);

  const handleToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (item: AuditApplicationItem) => {
    setEditingId(item.id);
    setFormData({
      organizationName: item.organizationName,
      auditStandard: item.auditStandard,
      scopeOfAudit: item.scopeOfAudit,
      preferredAuditDate: item.preferredAuditDate,
      contactPerson: item.contactPerson,
      contactEmail: item.contactEmail,
      status: item.status,
      attachments: item.attachments || [],
    });
    setStepIdx(0);
    setShowForm(true);
  };

  const handleDelete = (id: number | string) => {
    if (!window.confirm('Are you sure you want to delete this application?')) return;
    setApplications(applications.filter(a => a.id !== id));
    handleToast('Application deleted successfully');
  };

  const handleNewApplication = () => {
    if (showForm) {
      setShowForm(false);
      setEditingId(null);
      return;
    }
    setEditingId(null);
    setFormData(blankForm());
    setStepIdx(0);
    setShowForm(true);
  };

  const handleResumeDraft = () => {
    const draft = readDraft<AuditApplicationForm>(DRAFT_KEY);
    if (!draft) {
      handleToast('No saved draft found');
      return;
    }
    setEditingId(null);
    setFormData({ ...blankForm(), ...draft });
    setStepIdx(0);
    setShowForm(true);
    handleToast('Draft restored');
  };

  const handleDiscardDraft = () => {
    clearDraft(DRAFT_KEY);
    setDraftSavedAt(null);
    setHasDraft(false);
    handleToast('Draft cleared');
  };

  // ----- Step validation -----
  const stepIsValid = (idx: number): boolean => {
    if (idx === 0) {
      return !!formData.organizationName.trim() &&
        !!formData.contactPerson.trim() &&
        !!formData.contactEmail.trim() &&
        validateEmail(formData.contactEmail).ok;
    }
    if (idx === 1) {
      return !!formData.auditStandard && !!formData.scopeOfAudit.trim() && !!formData.preferredAuditDate;
    }
    return true;
  };

  const goNext = () => {
    if (!stepIsValid(stepIdx)) {
      handleToast('Please complete this step before continuing');
      return;
    }
    setStepIdx(i => Math.min(i + 1, STEPS.length - 1));
  };
  const goBack = () => setStepIdx(i => Math.max(0, i - 1));

  // ----- Attachments -----
  const handleAttachFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    const next: ScopeAttachment[] = [];
    for (const f of arr) {
      if (f.size > MAX_ATTACHMENT_SIZE) {
        handleToast(`${f.name} skipped (>${Math.round(MAX_ATTACHMENT_SIZE / 1024)} KB)`);
        continue;
      }
      const dataUrl: string = await new Promise(res => {
        const reader = new FileReader();
        reader.onload = () => res(String(reader.result || ''));
        reader.onerror = () => res('');
        reader.readAsDataURL(f);
      });
      next.push({ name: f.name, size: f.size, type: f.type, dataUrl });
    }
    setFormData(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...next] }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (idx: number) => {
    setFormData(prev => ({ ...prev, attachments: (prev.attachments || []).filter((_, i) => i !== idx) }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!stepIsValid(0) || !stepIsValid(1)) {
      handleToast('Please complete all required fields');
      return;
    }
    if (editingId) {
      const updated = applications.map(a => a.id === editingId ? { id: editingId, ...formData } : a);
      setApplications(updated);
      handleToast('Application updated successfully');
      setEditingId(null);
    } else {
      const newApp: AuditApplicationItem = { id: `app-${Date.now()}`, ...formData };
      setApplications([newApp, ...applications]);
      handleToast('Application submitted successfully');
      clearDraft(DRAFT_KEY);
      setHasDraft(false);
      setDraftSavedAt(null);
    }
    setFormData(blankForm());
    setShowForm(false);
    setStepIdx(0);
  };

  const handleCancel = () => {
    setFormData(blankForm());
    setEditingId(null);
    setShowForm(false);
    setStepIdx(0);
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'status-pending';
    const lower = status.toLowerCase();
    if (lower === 'approved') return 'status-completed';
    if (lower === 'rejected') return 'status-pending';
    return 'status-in-progress';
  };

  const completedKeys = new Set<string>(
    STEPS.filter((_, i) => i < stepIdx && stepIsValid(i)).map(s => s.key)
  );

  const renderStepContent = () => {
    if (stepIdx === 0) {
      return (
        <div className="cms-wizard__panel">
          <div className="form-group">
            <label>Organization Name *</label>
            <input type="text" name="organizationName" value={formData.organizationName} onChange={handleInputChange} placeholder="Enter Organization Name" required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Contact Person *</label>
              <input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleInputChange} placeholder="Name" required />
            </div>
            <div className="form-group">
              <label>Contact Email *</label>
              <input type="email" name="contactEmail" value={formData.contactEmail} onChange={handleInputChange} placeholder="Email" required />
              {formData.contactEmail && !validateEmail(formData.contactEmail).ok && (
                <small style={{ color: '#b91c1c' }}>Invalid email</small>
              )}
            </div>
          </div>
        </div>
      );
    }
    if (stepIdx === 1) {
      return (
        <div className="cms-wizard__panel">
          <div className="form-row">
            <div className="form-group">
              <label>Audit Standard *</label>
              <StandardPicker
                value={formData.auditStandard}
                onChange={(v) => setFormData((prev: any) => ({ ...prev, auditStandard: v }))}
                required placeholder="Select a standard"
              />
            </div>
            <div className="form-group">
              <label>Preferred Audit Date *</label>
              <input type="date" name="preferredAuditDate" value={formData.preferredAuditDate} onChange={handleInputChange} required />
            </div>
          </div>
          <div className="form-group">
            <label>Scope of Audit *</label>
            <textarea name="scopeOfAudit" value={formData.scopeOfAudit} onChange={handleInputChange} placeholder="Describe the scope (e.g., Software Development Department)" rows={4} required />
          </div>
        </div>
      );
    }
    if (stepIdx === 2) {
      return (
        <div className="cms-wizard__panel">
          <div className="form-group" style={{ background: '#f0f9ff', padding: 16, borderRadius: 8, border: '1px solid #bae6fd' }}>
            <label style={{ color: '#0369a1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Paperclip size={16} /> Scope Documents (PDF / DOCX / images)
            </label>
            <input
              ref={fileInputRef}
              type="file" multiple
              onChange={(e) => handleAttachFiles(e.target.files)}
              style={{ marginTop: 8 }}
            />
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Up to {Math.round(MAX_ATTACHMENT_SIZE / 1024)} KB per file. Stored locally.
            </div>
            {(formData.attachments || []).length > 0 && (
              <ul style={{ marginTop: 12, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(formData.attachments || []).map((a, i) => (
                  <li key={`${a.name}-${i}`} style={{
                    display: 'flex', alignItems: 'center', gap: 8, background: '#fff',
                    border: '1px solid #e0f2fe', borderRadius: 6, padding: '6px 10px'
                  }}>
                    <FileText size={14} style={{ color: '#0369a1' }} />
                    <span style={{ flex: 1, fontSize: 13 }}>{a.name}</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{Math.round(a.size / 1024)} KB</span>
                    <button type="button" onClick={() => removeAttachment(i)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#b91c1c' }}>
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      );
    }
    // review
    return (
      <div className="cms-wizard__panel">
        <h4 style={{ marginTop: 0 }}>Review &amp; Submit</h4>
        <table className="checklists-table" style={{ marginTop: 8 }}>
          <tbody>
            <tr><td><strong>Organization</strong></td><td>{formData.organizationName}</td></tr>
            <tr><td><strong>Contact</strong></td><td>{formData.contactPerson} — {formData.contactEmail}</td></tr>
            <tr><td><strong>Standard</strong></td><td>{formData.auditStandard}</td></tr>
            <tr><td><strong>Preferred Date</strong></td><td>{formData.preferredAuditDate}</td></tr>
            <tr><td><strong>Scope</strong></td><td>{formData.scopeOfAudit}</td></tr>
            <tr><td><strong>Attachments</strong></td><td>{(formData.attachments || []).length} file(s)</td></tr>
            <tr>
              <td><strong>Status</strong></td>
              <td>
                <select name="status" value={formData.status || 'Pending'} onChange={handleInputChange}>
                  <option value="Pending">Pending</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="audit-scope-container">
      {showToast && <div className="toast-notification">{toastMessage}</div>}

      <div className="scope-header">
        <div>
          <h1>Audit Applications</h1>
          <p>Submit audit requests with a guided multi-step wizard</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {hasDraft && !showForm && (
            <button
              type="button"
              onClick={handleResumeDraft}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fde68a', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 600 }}
              title={`Saved ${fmtTime(draftSavedAt)}`}
            >
              <Clock size={14} /> Resume draft
            </button>
          )}
          <button className="add-btn" onClick={handleNewApplication}>
            <Plus size={20} /> {showForm ? 'Cancel' : 'New Application'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="checklist-form" style={{ marginBottom: 30 }}>
          <h3>{editingId ? 'Edit Audit Application' : 'New Audit Application'}</h3>

          <WizardSteps
            steps={STEPS}
            currentIndex={stepIdx}
            completedKeys={completedKeys}
            onSelect={(i) => {
              // allow jumping back to any earlier step or to current
              if (i <= stepIdx) setStepIdx(i);
              // forward jumps are gated: only if all prior steps validate
              else if ([0, 1].slice(0, i).every(stepIsValid)) setStepIdx(i);
            }}
          />

          {!editingId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 14, fontSize: 12, color: '#64748b' }}>
              <Save size={12} />
              <span>
                {draftSavedAt ? `Auto-saved · ${fmtTime(draftSavedAt)}` : 'Auto-save will activate as you type'}
              </span>
              {draftSavedAt && (
                <button type="button" onClick={handleDiscardDraft}
                  style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>
                  Discard draft
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {renderStepContent()}

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
              <button type="button" className="cancel-btn" onClick={handleCancel}>Cancel</button>
              <div style={{ display: 'flex', gap: 8 }}>
                {stepIdx > 0 && (
                  <button type="button" className="cancel-btn" onClick={goBack}>
                    <ArrowLeft size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Back
                  </button>
                )}
                {stepIdx < STEPS.length - 1 ? (
                  <button type="button" className="submit-btn" onClick={goNext}>
                    Next <ArrowRight size={14} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                  </button>
                ) : (
                  <button type="submit" className="submit-btn">
                    {editingId ? 'Submit' : 'Add'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrap">
        <table className="checklists-table">
          <thead>
            <tr>
              <th>Organization</th>
              <th>Audit Standard</th>
              <th>Scope</th>
              <th>Preferred Date</th>
              <th>Contact</th>
              <th>Files</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {applications.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>
                  No applications submitted yet. Create one to get started.
                </td>
              </tr>
            ) : (
              applications.map(app => (
                <tr key={app.id}>
                  <td><strong>{app.organizationName}</strong></td>
                  <td><span className="iso-standard">{app.auditStandard}</span></td>
                  <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={app.scopeOfAudit}>
                    {app.scopeOfAudit}
                  </td>
                  <td>{app.preferredAuditDate}</td>
                  <td>
                    <div style={{ fontSize: 13 }}>
                      <div><strong>{app.contactPerson}</strong></div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{app.contactEmail}</div>
                    </div>
                  </td>
                  <td>{(app.attachments || []).length > 0 ? <span style={{ fontSize: 12, color: '#0369a1' }}>📎 {(app.attachments || []).length}</span> : <span style={{ color: '#94a3b8' }}>—</span>}</td>
                  <td><span className={`status-badge ${getStatusColor(app.status)}`}>{app.status || 'Pending'}</span></td>
                  <td>
                    <button className="link-btn" title="Edit" onClick={() => handleEdit(app)}><Edit2 size={16} /></button>
                    <button className="link-btn danger" title="Delete" onClick={() => handleDelete(app.id)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditApplication;
