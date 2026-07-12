import React, { useState, useEffect } from 'react';
import {
  Plus,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  X,
  FileText,
  CheckCircle2,
  XCircle // Imported for Reject button
} from 'lucide-react';
import '../../styles/AuditorCoordinator.css';
import {
  AuditReport,
  getAuditReports,
  createAuditReport,
  deleteAuditReport,
  updateReportStatus,
  getAuditReportByScheduleId
} from './utils/auditReportStorage';
import {
  deriveReportStatus,
  loadAuditReports,
  removeAuditReport,
  subscribeAuditReports,
  updateAuditReport as updateSharedAuditReport,
} from '../../services/auditReports';

interface DispatchRecord {
  id: number;
  clientName: string;
  organization: string;
  dispatchedDate: string;
  auditType?: string;
}

// Records coming from the shared `cms_audit_reports_v1` key get this id prefix
// so decisions/deletes can be routed back to the shared store.
const SHARED_PREFIX = 'v1-';

/** Map shared Auditor/Lead Auditor/Auditee records into the Coordinator's shape. */
const mapSharedToCoordinator = (): AuditReport[] => {
  const day = (v?: string) => (v || '').split('T')[0];
  return Object.entries(loadAuditReports()).map(([key, r]) => {
    const st = deriveReportStatus(r);
    return {
      id: `${SHARED_PREFIX}${key}`,
      scheduleId: Number(key) || 0,
      clientName: r.clientName || `Client #${key}`,
      organization: r.clientName || '',
      auditType: r.source === 'Auditee' ? 'Auditee Submission' : 'Certification',
      audit: r.standard ? `${r.standard} Audit Report` : (r.fileName || 'Audit Report'),
      department: r.scope || '-',
      auditDate: day(r.draftedAt),
      leadAuditor: r.reviewedBy || 'Lead Auditor',
      assignedAuditor: r.draftedBy || 'Auditor',
      submittedDate: day(r.submittedAt),
      status: st === 'Approved' ? 'Approved' as const
        : st === 'Reviewed' ? 'In Review' as const
        : st === 'Submitted' ? 'Submitted' as const
        : 'Draft' as const,
      createdDate: day(r.draftedAt),
      lastModified: day(r.updatedAt || r.reviewedAt || r.submittedAt || r.draftedAt),
      sections: [],
      findings: []
    };
  });
};

// --- DEMO DATA ---
const demoReports: AuditReport[] = [
  {
    id: 'demo-rep-001',
    scheduleId: 2025001,
    clientName: 'John Doe',
    organization: 'Green Energy Solutions',
    auditType: 'Initial',
    audit: 'ISO 9001:2015 Certification Audit',
    department: 'Quality Assurance / Operations',
    auditDate: '2025-01-15',
    leadAuditor: 'Robert Wilson',
    assignedAuditor: 'Alice Brown',
    status: 'Approved',
    submittedDate: '2025-01-20',
    createdDate: '2025-01-10',
    lastModified: '2025-01-21',
    sections: [],
    findings: []
  },
  {
    id: 'demo-rep-002',
    scheduleId: 2025002,
    clientName: 'Sarah Smith',
    organization: 'Tech Innovations Ltd',
    auditType: 'Surveillance',
    audit: 'ISO 27001:2022 Surveillance Audit',
    department: 'IT Security / Infrastructure',
    auditDate: '2025-02-10',
    leadAuditor: 'Jennifer Lee',
    assignedAuditor: 'David Clark',
    status: 'In Review',
    submittedDate: '2025-02-12',
    createdDate: '2025-02-05',
    lastModified: '2025-02-12',
    sections: [],
    findings: []
  },
  {
    id: 'demo-rep-003',
    scheduleId: 2025003,
    clientName: 'Michael Johnson',
    organization: 'Quality Manufacturing Co',
    auditType: 'Recertification',
    audit: 'ISO 14001:2015 Recertification',
    department: 'Production / EHS',
    auditDate: '2025-03-05',
    leadAuditor: 'James Taylor',
    assignedAuditor: 'Patricia White',
    status: 'Draft',
    submittedDate: '',
    createdDate: '2025-03-01',
    lastModified: '2025-03-01',
    sections: [],
    findings: []
  }
];

const AuditReports: React.FC = () => {
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AuditReport | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [availableSchedules, setAvailableSchedules] = useState<DispatchRecord[]>([]);

  const [formData, setFormData] = useState({
    scheduleId: '',
    clientName: '',
    organization: '',
    audit: '',
    department: '',
    auditType: '',
    auditDate: '',
    leadAuditor: '',
    assignedAuditor: '',
    submittedDate: '',
  });

  useEffect(() => {
    loadData();
    // Reload when any role updates the shared key (custom event + 'storage').
    return subscribeAuditReports(loadData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = () => {
    try {
      const storedReports = getAuditReports();
      const base = storedReports.length === 0 ? demoReports : storedReports;
      // Consolidated view: coordinator's own reports + shared cms_audit_reports_v1
      setReports([...base, ...mapSharedToCoordinator()]);

      const dispatchRaw = localStorage.getItem('cms_application_dispatch_v7');
      const dispatchData = dispatchRaw ? JSON.parse(dispatchRaw) : [];
      const receivedApps = dispatchData.filter((d: any) => d.status === 'Received' || d.status === 'Approved');
      setAvailableSchedules(receivedApps);
    } catch (e) {
      console.error('Failed to load data', e);
      handleToast('Error loading data');
    }
  };

  const handleToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'scheduleId') {
      const selectedSchedule = availableSchedules.find(s => String(s.id) === value);
      if (selectedSchedule) {
        setFormData(prev => ({
          ...prev,
          scheduleId: value,
          clientName: selectedSchedule.clientName,
          organization: selectedSchedule.organization,
          auditType: selectedSchedule.auditType || 'Initial',
          auditDate: selectedSchedule.dispatchedDate
        }));
        return;
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.scheduleId || !formData.clientName || !formData.leadAuditor || !formData.assignedAuditor || !formData.audit || !formData.department) {
      handleToast('Please fill in all required fields');
      return;
    }

    const existingReport = getAuditReportByScheduleId(Number(formData.scheduleId));
    if (existingReport) {
      handleToast('Report already exists for this schedule');
      return;
    }

    const newReport = createAuditReport({
      scheduleId: Number(formData.scheduleId),
      clientName: formData.clientName,
      organization: formData.organization,
      audit: formData.audit,
      department: formData.department,
      auditType: formData.auditType,
      auditDate: formData.auditDate,
      leadAuditor: formData.leadAuditor,
      assignedAuditor: formData.assignedAuditor,
      submittedDate: formData.submittedDate,
    });

    if (newReport) {
      handleToast('Audit Report created successfully');
      setReports([...getAuditReports(), ...mapSharedToCoordinator()]);
      setShowForm(false);
      setFormData({
        scheduleId: '',
        clientName: '',
        organization: '',
        audit: '',
        department: '',
        auditType: '',
        auditDate: '',
        leadAuditor: '',
        assignedAuditor: '',
        submittedDate: '',
      });
    }
  };

  const handleDelete = (reportId: string) => {
    if (window.confirm('Are you sure you want to delete this audit report?')) {
      if (reportId.startsWith(SHARED_PREFIX)) {
        removeAuditReport(reportId.slice(SHARED_PREFIX.length));
      } else {
        deleteAuditReport(reportId);
      }
      handleToast('Audit Report deleted successfully');
      loadData();
    }
  };

  // --- NEW: Approve / Reject Logic ---
  const handleDecision = (report: AuditReport, decision: 'Approved' | 'Rejected') => {
    const newStatus = decision === 'Approved' ? 'Approved' : 'Draft'; // Rejection sends back to Draft
    const actionMsg = decision === 'Approved' ? 'Approved' : 'Rejected';
    
    // 1. Update State (Optimistic UI update)
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: newStatus } : r));

    // 2. Persist — shared cms_audit_reports_v1 records vs coordinator-local records
    if (report.id.startsWith(SHARED_PREFIX)) {
        const key = report.id.slice(SHARED_PREFIX.length);
        const now = new Date().toISOString();
        updateSharedAuditReport(key, decision === 'Approved'
          ? { status: 'Approved', approvedAt: now, reviewedAt: now, reviewedBy: report.leadAuditor }
          : { status: 'Rejected', reviewComment: 'Rejected by Auditor Coordinator' });
    } else if (!report.id.startsWith('demo')) {
        updateReportStatus(report.id, newStatus);
    }

    // 3. Approved reports unlock the certification stage — upsert a
    //    cms_audit_certifications entry so Audit Certifications sees it.
    if (decision === 'Approved') {
      try {
        const KEY = 'cms_audit_certifications';
        const raw = localStorage.getItem(KEY);
        const certs: any[] = raw ? JSON.parse(raw) : [];
        const clientName = report.clientName || report.organization;
        const exists = certs.some((c) =>
          (c?.client || '').toLowerCase() === (clientName || '').toLowerCase() &&
          (c?.description || '').includes(report.audit || ''));
        if (!exists && clientName) {
          const year = new Date().getFullYear();
          const seq = certs.length + 1;
          certs.push({
            id: Date.now(),
            name: `${report.audit || 'Audit'} Certification`,
            certificateId: `CERT-${year}-${String(seq).padStart(4, '0')}`,
            certificateDate: new Date().toISOString().split('T')[0],
            client: clientName,
            clientId: '',
            description: `Auto-created from approved report: ${report.audit || report.id}`,
            standard: (report as any).standard || (report as any).certificationStandard || 'ISO 9001:2015',
            validity: 36,
            renewalPeriod: 'Annual surveillance',
          });
          localStorage.setItem(KEY, JSON.stringify(certs));
          window.dispatchEvent(new CustomEvent('cms-audit-certifications-updated'));
        }
      } catch { /* ignore */ }
    }

    // 4. Show Notification
    handleToast(`Audit Report ${actionMsg} & Email sent to ${report.clientName}`);
  };

  const handleViewReport = (report: AuditReport) => {
    setSelectedReport(report);
    setShowView(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return '#f59e0b';
      case 'In Review': return '#3b82f6';
      case 'Approved': return '#10b981';
      case 'Submitted': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  return (
    <div className="audit-scope-container">
      {showToast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#10b981', color: 'white', padding: '16px 32px', borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 2000, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <CheckCircle2 size={20} />
          {toastMessage}
        </div>
      )}

      <div className="scope-header">
        <div>
          <h1>Audit Reports</h1>
          <p>Manage and review audit reports for completed audits</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="add-btn" style={{ background: '#64748b' }} onClick={loadData} title="Refresh Data">
            <RefreshCw size={20} />
          </button>
          <button className="add-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? <X size={20} /> : <Plus size={20} />}
            {showForm ? 'Cancel' : 'New Report'}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeftColor: '#f59e0b' }}>
          <div className="stat-icon" style={{ color: '#f59e0b' }}><FileText size={24} /></div>
          <div className="stat-content">
            <p className="stat-label">Total Reports</p>
            <p className="stat-value">{reports.length}</p>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: '#3b82f6' }}>
          <div className="stat-icon" style={{ color: '#3b82f6' }}><Edit size={24} /></div>
          <div className="stat-content">
            <p className="stat-label">Draft</p>
            <p className="stat-value">{reports.filter(r => r.status === 'Draft').length}</p>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: '#10b981' }}>
          <div className="stat-icon" style={{ color: '#10b981' }}><CheckCircle2 size={24} /></div>
          <div className="stat-content">
            <p className="stat-label">Approved</p>
            <p className="stat-value">{reports.filter(r => r.status === 'Approved').length}</p>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: '#8b5cf6' }}>
          <div className="stat-icon" style={{ color: '#8b5cf6' }}><FileText size={24} /></div>
          <div className="stat-content">
            <p className="stat-label">Submitted</p>
            <p className="stat-value">{reports.filter(r => r.status === 'Submitted').length}</p>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="checklist-form" style={{ marginBottom: '30px' }}>
          <h3>Create New Audit Report</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Select Schedule *</label>
              <select name="scheduleId" value={formData.scheduleId} onChange={handleFormChange} required>
                <option value="">-- Choose Schedule --</option>
                {availableSchedules.map(schedule => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.clientName} - {schedule.organization} ({schedule.dispatchedDate})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Client Name *</label>
                <input type="text" name="clientName" value={formData.clientName} onChange={handleFormChange} disabled style={{ background: '#f1f5f9' }} />
              </div>
              <div className="form-group">
                <label>Organization *</label>
                <input type="text" name="organization" value={formData.organization} onChange={handleFormChange} disabled style={{ background: '#f1f5f9' }} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Audit Date *</label>
                <input type="date" name="auditDate" value={formData.auditDate} onChange={handleFormChange} disabled style={{ background: '#f1f5f9' }} />
              </div>
              <div className="form-group">
                <label>Audit Type *</label>
                <input type="text" name="auditType" value={formData.auditType} onChange={handleFormChange} disabled style={{ background: '#f1f5f9' }} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Audit Name *</label>
                <input type="text" name="audit" value={formData.audit} onChange={handleFormChange} placeholder="Enter Audit Name" required />
              </div>
              <div className="form-group">
                <label>Department *</label>
                <input type="text" name="department" value={formData.department} onChange={handleFormChange} placeholder="Enter Department" required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Lead Auditor *</label>
                <input type="text" name="leadAuditor" value={formData.leadAuditor} onChange={handleFormChange} placeholder="Enter Lead Auditor Name" required />
              </div>
              <div className="form-group">
                <label>Assigned Auditor *</label>
                <input type="text" name="assignedAuditor" value={formData.assignedAuditor} onChange={handleFormChange} placeholder="Enter Assigned Auditor Name" required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Submitted Date</label>
                <input type="date" name="submittedDate" value={formData.submittedDate} onChange={handleFormChange} />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn">Add</button>
              <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrap">
        <table className="checklists-table">
          <thead>
            <tr>
              <th>Client Name</th>
              <th>Organization</th>
              <th>Audit Type</th>
              <th>Audit Name</th>
              <th>Department</th>
              <th>Audit Date</th>
              <th>Lead Auditor</th>
              <th>Assigned Auditor</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                  No audit reports found. Create a new report to get started.
                </td>
              </tr>
            ) : (
              reports.map((report) => (
                <tr key={report.id}>
                  <td><strong>{report.clientName}</strong></td>
                  <td>{report.organization || '-'}</td>
                  <td><span style={{fontSize: '12px', background: '#e0f2fe', color: '#0284c7', padding: '2px 6px', borderRadius: '4px'}}>{report.auditType}</span></td>
                  <td>{report.audit}</td>
                  <td>{report.department || '-'}</td>
                  <td style={{whiteSpace: 'nowrap'}}>{report.auditDate}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                        {report.leadAuditor.charAt(0)}
                      </div>
                      <span style={{fontSize: '13px'}}>{report.leadAuditor}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#64748b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                        {report.assignedAuditor.charAt(0)}
                      </div>
                      <span style={{fontSize: '13px'}}>{report.assignedAuditor}</span>
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        border: `1px solid ${getStatusColor(report.status)}`,
                        color: getStatusColor(report.status),
                        fontWeight: 600,
                        fontSize: '12px',
                        background: 'white',
                        display: 'inline-block'
                      }}
                    >
                      {report.status}
                    </span>
                  </td>
                  <td>{report.submittedDate || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {/* View Button */}
                      <button className="link-btn" onClick={() => handleViewReport(report)} title="View Report" style={{color: '#2563eb', background:'#eff6ff', padding: '6px', borderRadius: 4}}>
                        <Eye size={16} />
                      </button>
                      
                      {/* Approve Button */}
                      <button 
                        className="link-btn" 
                        onClick={() => handleDecision(report, 'Approved')} 
                        title="Approve Report"
                        style={{color: '#16a34a', background:'#dcfce7', padding: '6px', borderRadius: 4}}
                      >
                        <CheckCircle2 size={16} />
                      </button>

                      {/* Reject Button */}
                      <button 
                        className="link-btn" 
                        onClick={() => handleDecision(report, 'Rejected')} 
                        title="Reject Report"
                        style={{color: '#dc2626', background:'#fee2e2', padding: '6px', borderRadius: 4}}
                      >
                        <XCircle size={16} />
                      </button>

                      <button className="link-btn danger" onClick={() => handleDelete(report.id)} title="Delete" style={{padding: '6px'}}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Read-only report details modal */}
      {showView && selectedReport && (
        <div className="modal-overlay" onClick={() => setShowView(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--card-bg, #fff)', color: 'var(--text-dark, #0f172a)', borderRadius: 12, padding: 24, maxWidth: 520, width: '92%', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginTop: 0 }}>Audit Report — {selectedReport.clientName}</h3>
            {[
              ['Organization', selectedReport.organization],
              ['Audit', selectedReport.audit],
              ['Department', selectedReport.department],
              ['Audit Type', selectedReport.auditType],
              ['Audit Date', selectedReport.auditDate],
              ['Lead Auditor', selectedReport.leadAuditor],
              ['Assigned Auditor', selectedReport.assignedAuditor],
              ['Submitted', selectedReport.submittedDate],
              ['Status', selectedReport.status],
            ].map(([k, v]) => (
              <p key={k as string} style={{ margin: '6px 0', fontSize: 14 }}>
                <strong>{k}:</strong> {v || '—'}
              </p>
            ))}
            <div style={{ textAlign: 'right', marginTop: 14 }}>
              <button className="link-btn" onClick={() => setShowView(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditReports;