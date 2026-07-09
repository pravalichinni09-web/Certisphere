import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, X } from 'lucide-react';
import '../../styles/AuditClient/SubmitReport.css';
import {
  AuditReportStatus,
  deriveReportStatus,
  loadAuditReports,
  subscribeAuditReports,
  updateAuditReport,
  upsertAuditReport,
} from '../../services/auditReports';

interface Report {
  id: string;
  fileName: string;
  uploadDate: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  // New fields to store submitted details
  proposedCompletionDate?: string;
  correction?: string;
  rootCause?: string;
  correctiveAction?: string;
  completionDate?: string;
}

// --- Shared storage (cms_audit_reports_v1) mapping helpers ---
const toLocalStatus = (s: AuditReportStatus): Report['status'] =>
  s === 'Approved' ? 'approved' : s === 'Rejected' ? 'rejected' : s === 'Draft' ? 'pending' : 'submitted';

/** Only records this Auditee submitted (source: 'Auditee'). */
const loadAuditeeReports = (): Report[] =>
  Object.entries(loadAuditReports())
    .filter(([, r]) => r.source === 'Auditee')
    .map(([key, r]) => ({
      id: key,
      fileName: r.fileName || 'Report.pdf',
      uploadDate: (r.draftedAt || '').split('T')[0],
      status: toLocalStatus(deriveReportStatus(r)),
      proposedCompletionDate: r.proposedCompletionDate,
      correction: r.correction,
      rootCause: r.rootCause,
      correctiveAction: r.correctiveAction,
      completionDate: r.completionDate,
    }))
    .sort((a, b) => (a.uploadDate < b.uploadDate ? 1 : -1));

const SubmitReport: React.FC = () => {
  const [reports, setReports] = useState<Report[]>(() => loadAuditeeReports());

  // Live-refresh when any role updates the shared key (same tab or another tab).
  useEffect(() => subscribeAuditReports(() => setReports(loadAuditeeReports())), []);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    proposedCompletionDate: '',
    correction: '',
    rootCause: '',
    correctiveAction: '',
    completionDate: '',
  });

  // Demo Data Options for Dropdowns
  const options = {
    corrections: [
      'Immediate repair of equipment',
      'Updated documentation version',
      'Staff retraining session completed',
      'Segregation of non-conforming product',
      'Data entry correction',
      'Recalibration of instruments'
    ],
    rootCauses: [
      'Lack of training/knowledge',
      'Outdated standard operating procedure',
      'Equipment wear and tear',
      'Human error',
      'Inadequate resources',
      'Software system bug'
    ],
    correctiveActions: [
      'Revise SOP to include new control steps',
      'Implement annual refresher training program',
      'Replace hardware components',
      'Automate validation process',
      'Increase frequency of internal audits',
      'Update quality policy'
    ]
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    setIsUploading(true);
    // Simulate file upload, then append to the shared key (cms_audit_reports_v1)
    setTimeout(() => {
      const now = new Date().toISOString();
      upsertAuditReport(`auditee-${Date.now()}`, {
        summary: `Auditee report upload: ${selectedFile.name}`,
        scope: '',
        conclusion: '',
        recommendation: 'Recommend certification',
        draftedAt: now,
        draftedBy: 'Auditee',
        submittedAt: now,
        status: 'Submitted',
        source: 'Auditee',
        fileName: selectedFile.name,
        clientName: 'Auditee',
      });
      setReports(loadAuditeeReports());
      setSelectedFile(null);
      setIsUploading(false);
      alert('Report submitted successfully');
    }, 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#10b981';
      case 'rejected': return '#ef4444';
      case 'submitted': return '#3b82f6';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle size={18} color="#10b981" />;
      case 'rejected': return <AlertCircle size={18} color="#ef4444" />;
      case 'submitted': return <CheckCircle size={18} color="#3b82f6" />;
      case 'pending': return <AlertCircle size={18} color="#f59e0b" />;
      default: return null;
    }
  };

  // --- Modal Handlers ---

  const handleOpenSubmitModal = (reportId: string) => {
    setCurrentReportId(reportId);
    // Reset form or load existing data if needed
    setFormData({
      proposedCompletionDate: '',
      correction: '',
      rootCause: '',
      correctiveAction: '',
      completionDate: '',
    });
    setIsModalOpen(true);
  };

  const handleModalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentReportId) return;

    // Update the shared record with the corrective-action details
    updateAuditReport(currentReportId, {
      ...formData,
      status: 'Submitted',
      submittedAt: new Date().toISOString(),
    });
    setReports(loadAuditeeReports());
    setIsModalOpen(false);
    alert('Report details submitted successfully!');
  };

  return (
    <div className="submit-report-container">
      <div className="submit-report-header">
        <h1>Submit Report</h1>
        <p>Upload and manage your audit reports</p>
      </div>

      <div className="upload-section">
        <div className="upload-card">
          <div className="upload-icon">
            <Upload size={40} color="#3b82f6" />
          </div>
          <h2>Upload New Report</h2>
          <p>Select a PDF or document file to upload</p>

          <div className="file-input-wrapper">
            <input
              type="file"
              id="file-input"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.txt"
              disabled={isUploading}
            />
            <label htmlFor="file-input" className="file-label">
              Choose File
            </label>
          </div>

          {selectedFile && (
            <div className="selected-file">
              <p>Selected: <strong>{selectedFile.name}</strong></p>
            </div>
          )}

          <button
            className="submit-btn"
            onClick={handleUpload}
            disabled={isUploading || !selectedFile}
          >
            {isUploading ? 'Uploading...' : 'Submit Report'}
          </button>
        </div>
      </div>

      <div className="reports-section">
        <h2>Submitted Reports</h2>
        {reports.length === 0 ? (
          <p className="no-reports">No reports submitted yet</p>
        ) : (
          <div className="reports-table">
            <table>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Upload Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>{report.fileName}</td>
                    <td>{new Date(report.uploadDate).toLocaleDateString()}</td>
                    <td>
                      <div className="status-cell">
                        {getStatusIcon(report.status)}
                        <span style={{ color: getStatusColor(report.status) }}>
                          {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <button 
                        className="action-btn"
                        onClick={() => handleOpenSubmitModal(report.id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        Submit Report
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submit Details Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
             style={{
               position: 'fixed',
               top: 0, 
               left: 0, 
               right: 0, 
               bottom: 0,
               backgroundColor: 'rgba(0,0,0,0.5)',
               display: 'flex',
               justifyContent: 'center',
               alignItems: 'center',
               zIndex: 1000
             }}>
          <div className="bg-white p-6 rounded-lg w-full max-w-lg relative" 
               style={{
                 backgroundColor: 'white',
                 padding: '2rem',
                 borderRadius: '8px',
                 width: '90%',
                 maxWidth: '500px',
                 maxHeight: '90vh',
                 overflowY: 'auto',
                 position: 'relative'
               }}>
            
            <button 
              onClick={() => setIsModalOpen(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <X size={24} className="text-gray-500 hover:text-gray-700" />
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  padding: '6px 14px',
                  flexShrink: 0,
                }}
              >
                ← Back
              </button>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e2e8f0', margin: 0 }}>
                Submit Report Details
              </h2>
            </div>
            
            <form onSubmit={handleSubmitDetails} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  Proposed Completion Date
                </label>
                <input 
                  type="date" 
                  name="proposedCompletionDate"
                  value={formData.proposedCompletionDate}
                  onChange={handleModalChange}
                  required
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  Correction
                </label>
                <select 
                  name="correction"
                  value={formData.correction}
                  onChange={handleModalChange}
                  required
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white' }}
                >
                  <option value="">Select Correction</option>
                  {options.corrections.map((opt, idx) => (
                    <option key={idx} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  Root Cause
                </label>
                <select 
                  name="rootCause"
                  value={formData.rootCause}
                  onChange={handleModalChange}
                  required
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white' }}
                >
                  <option value="">Select Root Cause</option>
                  {options.rootCauses.map((opt, idx) => (
                    <option key={idx} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  Corrective Action
                </label>
                <select 
                  name="correctiveAction"
                  value={formData.correctiveAction}
                  onChange={handleModalChange}
                  required
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white' }}
                >
                  <option value="">Select Corrective Action</option>
                  {options.correctiveActions.map((opt, idx) => (
                    <option key={idx} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  Completion Date
                </label>
                <input 
                  type="date" 
                  name="completionDate"
                  value={formData.completionDate}
                  onChange={handleModalChange}
                  required
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                />
              </div>

              <button 
                type="submit"
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                Submit Details
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmitReport;