import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  Download, 
  Search, 
  Eye, 
  MessageSquare,
  ShieldCheck,
  Clock,
  Filter,
  Paperclip
} from 'lucide-react';
import CorrectiveActionSuggest from '../../components/CorrectiveActionSuggest';
import { Sparkles } from 'lucide-react';
import '../../styles/LeadAuditor/ActionReview.css';
import ViewOnlyDoc from '../../components/ViewOnlyDoc';
import {
  CORRECTIVE_ACTIONS_EVENT,
  CorrectiveActionRecord,
  loadCorrectiveActions,
  updateCorrectiveAction,
  withHistory
} from '../../services/correctiveActions';

// --- Interfaces ---
interface Evidence {
  id: string;
  fileName: string;
  uploadDate: string;
  size: string;
}

interface ActionPlan {
  id: string;
  auditId: string;
  auditTitle: string;
  findingId: string;
  findingType: 'Major NC' | 'Minor NC' | 'OFI';
  findingDescription: string;
  rootCause: string;
  correction: string; // Immediate fix
  correctiveAction: string; // Long-term prevention
  evidences: Evidence[];
  submissionDate: string;
  clientContact: string;
  status: 'Pending Review' | 'Approved' | 'Revision Requested' | 'Closed';
  reviewerComments?: string;
}

// --- Shared corrective-action store mapping (replaces hardcoded mock data) ---
const toPlanStatus = (status: CorrectiveActionRecord['status']): ActionPlan['status'] => {
  switch (status) {
    case 'Submitted': return 'Pending Review';
    case 'Auditor Reviewed': return 'Approved';
    case 'Approved': return 'Closed';
    default: return 'Revision Requested'; // 'Rejected'
  }
};

const lastReviewComment = (record: CorrectiveActionRecord): string | undefined => {
  const entries = (record.history ?? []).filter(h => h.by === 'Lead Auditor' || h.by === 'Auditor');
  return entries.length > 0 ? entries[entries.length - 1].action : undefined;
};

const toActionPlan = (record: CorrectiveActionRecord): ActionPlan => ({
  id: record.id,
  auditId: record.capId ?? record.id,
  auditTitle: record.auditTitle ?? 'Untitled Audit',
  findingId: record.capId ?? record.id,
  findingType: record.severity ?? 'Minor NC',
  findingDescription: record.description ?? '',
  rootCause: record.rootCause ?? 'Not provided',
  correction: record.correctivePlan ?? 'Not provided',
  correctiveAction: record.correctivePlan ?? 'Not provided',
  evidences: (record.evidence ?? []).map((ev, idx) => ({
    id: `${record.id}-E${idx + 1}`,
    fileName: ev.name,
    uploadDate: ev.date,
    size: '—'
  })),
  submissionDate: record.submittedAt ? record.submittedAt.slice(0, 10) : (record.dueDate ?? '—'),
  clientContact: record.clientName ?? 'Client',
  status: toPlanStatus(record.status),
  reviewerComments: record.status === 'Rejected' ? lastReviewComment(record) : undefined
});

// Lead Auditor works on submitted/reviewed records — 'Open' items are not yet reviewable.
const loadPlans = (): ActionPlan[] =>
  loadCorrectiveActions()
    .filter(r => r.status !== 'Open')
    .map(toActionPlan);

/**
 * Build a styled SVG 'document preview' for an evidence file so it
 * renders visibly inside the ViewOnlyDoc modal. The preview shows the
 * filename, upload date, size, file type, and an EVIDENCE watermark.
 */
const buildEvidencePreview = (fileName: string, uploadDate: string, size: string, findingId?: string): string => {
  const ext = (fileName.split('.').pop() || 'file').toUpperCase();
  const safe = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const isImage = /^(JPG|JPEG|PNG|GIF|WEBP|BMP|SVG)$/.test(ext);
  const accent = isImage ? '#06b6d4' : ext === 'PDF' ? '#dc2626' : ext.startsWith('XLS') ? '#10b981' : '#7c3aed';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 1000' width='800' height='1000'>
    <defs>
      <linearGradient id='hdr' x1='0' y1='0' x2='1' y2='0'>
        <stop offset='0%' stop-color='${accent}'/>
        <stop offset='100%' stop-color='#0a2540'/>
      </linearGradient>
    </defs>
    <rect width='800' height='1000' fill='#FFFFFF'/>
    <rect x='0' y='0' width='800' height='110' fill='url(#hdr)'/>
    <text x='40' y='55' font-family='Georgia,serif' font-size='28' font-weight='800' fill='#FFFFFF'>EVIDENCE PREVIEW</text>
    <text x='40' y='90' font-family='Arial' font-size='14' fill='#E2E8F0' letter-spacing='2'>CERTISPHERE · LEAD AUDITOR · ACTION REVIEW</text>

    <text x='40' y='180' font-family='Arial' font-size='12' fill='#94a3b8'>FILE</text>
    <text x='40' y='215' font-family='Arial' font-size='22' font-weight='700' fill='#0f172a'>${safe(fileName)}</text>

    <line x1='40' y1='250' x2='760' y2='250' stroke='#e2e8f0' stroke-width='1'/>

    <text x='40'  y='290' font-family='Arial' font-size='11' fill='#94a3b8'>TYPE</text>
    <text x='40'  y='320' font-family='Arial' font-size='18' font-weight='700' fill='${accent}'>${ext}</text>
    <text x='280' y='290' font-family='Arial' font-size='11' fill='#94a3b8'>UPLOADED</text>
    <text x='280' y='320' font-family='Arial' font-size='18' font-weight='700' fill='#0f172a'>${safe(uploadDate)}</text>
    <text x='520' y='290' font-family='Arial' font-size='11' fill='#94a3b8'>SIZE</text>
    <text x='520' y='320' font-family='Arial' font-size='18' font-weight='700' fill='#0f172a'>${safe(size)}</text>

    <line x1='40' y1='360' x2='760' y2='360' stroke='#e2e8f0' stroke-width='1'/>

    <text x='40' y='400' font-family='Arial' font-size='11' fill='#94a3b8'>LINKED FINDING</text>
    <text x='40' y='430' font-family='Arial' font-size='18' font-weight='700' fill='#0f172a'>${safe(findingId || '—')}</text>

    <rect x='40' y='480' width='720' height='240' fill='#f8fafc' stroke='#e2e8f0' stroke-width='1' rx='8'/>
    <text x='60' y='515' font-family='Arial' font-size='11' fill='#94a3b8' letter-spacing='2'>DOCUMENT CONTENT</text>
    <text x='60' y='560' font-family='Arial' font-size='14' fill='#475569'>This evidence document was submitted by the auditee in support of</text>
    <text x='60' y='585' font-family='Arial' font-size='14' fill='#475569'>their corrective action plan for the finding referenced above.</text>
    <text x='60' y='625' font-family='Arial' font-size='14' fill='#475569'>The original artifact would render here in a production deployment</text>
    <text x='60' y='650' font-family='Arial' font-size='14' fill='#475569'>(scanned report, photo, certificate, log file, calibration record …).</text>
    <text x='60' y='695' font-family='Arial' font-size='13' fill='#0a2540' font-weight='700'>Status: Received — pending Lead Auditor review.</text>

    <rect x='40' y='770' width='720' height='90' fill='#fff7ed' stroke='#fed7aa' stroke-width='1' rx='8'/>
    <text x='60' y='800' font-family='Arial' font-size='11' fill='#9a3412' letter-spacing='2'>REVIEW CHECKLIST</text>
    <text x='60' y='825' font-family='Arial' font-size='13' fill='#7c2d12'>☐ Evidence aligns with finding scope</text>
    <text x='60' y='845' font-family='Arial' font-size='13' fill='#7c2d12'>☐ Corrective action verifiable from this artifact</text>

    <text x='40' y='930' font-family='Arial' font-size='10' fill='#94a3b8'>READ-ONLY PREVIEW · downloads disabled · generated by CertiSphere</text>
    <g opacity='0.06' transform='translate(400 600) rotate(-25)'>
      <text font-family='Arial' font-size='130' font-weight='900' fill='${accent}' text-anchor='middle'>EVIDENCE</text>
    </g>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
};

const ActionReview: React.FC = () => {
  const [previewFile, setPreviewFile] = useState<Evidence | null>(null);
  const [previewParent, setPreviewParent] = useState<string | undefined>();
  const [reviews, setReviews] = useState<ActionPlan[]>(() => loadPlans());
  const [selectedReview, setSelectedReview] = useState<ActionPlan | null>(null);
  const [comment, setComment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [viewingEvidences, setViewingEvidences] = useState<Evidence[] | null>(null);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [showCASuggest, setShowCASuggest] = useState(false);

  // Reload from the shared store when another role updates it (same-tab custom event + cross-tab storage event)
  useEffect(() => {
    const reload = () => setReviews(loadPlans());
    window.addEventListener(CORRECTIVE_ACTIONS_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(CORRECTIVE_ACTIONS_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  // Stats
  const pendingCount = reviews.filter(r => r.status === 'Pending Review').length;
  const approvedCount = reviews.filter(r => r.status === 'Approved' || r.status === 'Closed').length;
  const revisionCount = reviews.filter(r => r.status === 'Revision Requested').length;

  // Handlers
  const handleOpenReview = (actionPlan: ActionPlan) => {
    setSelectedReview(actionPlan);
    setComment(actionPlan.reviewerComments || '');
    setShowReviewModal(true);
  };

  const handleOpenEvidences = (evidences: Evidence[]) => {
    setViewingEvidences(evidences);
    setShowEvidenceModal(true);
  };

  const handleCloseEvidenceModal = () => {
    setShowEvidenceModal(false);
    setViewingEvidences(null);
  };


  const handleDownloadFile = (fileName: string, fileData?: string) => {
    // If real base64 data exists, use it
    if (fileData) {
      const link = document.createElement('a');
      link.href = fileData;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    // Generate a realistic stub file based on extension
    const ext = fileName.split('.').pop()?.toLowerCase() || 'txt';
    let mimeType = 'text/plain';
    let content = `Evidence file: ${fileName}\n\nThis file was submitted as audit evidence.\nIn production, the actual file content would be stored and retrieved here.`;
    if (ext === 'pdf') {
      mimeType = 'application/pdf';
      // Minimal valid PDF stub
      content = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n217\n%%EOF`;
    } else if (ext === 'xlsx' || ext === 'xls') {
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (ext === 'jpg' || ext === 'jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === 'png') {
      mimeType = 'image/png';
    } else if (ext === 'docx' || ext === 'doc') {
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };


  const handleCloseModal = () => {
    setShowReviewModal(false);
    setSelectedReview(null);
    setComment('');
  };

  const handleSubmitDecision = (decision: 'Approve' | 'Reject') => {
    if (!selectedReview) return;

    const now = new Date().toISOString();
    const note = comment.trim();
    const updated = decision === 'Approve'
      ? updateCorrectiveAction(selectedReview.id, record => withHistory({
          ...record,
          status: 'Auditor Reviewed',
          reviewedAt: now
        }, 'Lead Auditor', note ? `Action plan reviewed and accepted: ${note}` : 'Action plan reviewed and accepted', now))
      : updateCorrectiveAction(selectedReview.id, record => withHistory({
          ...record,
          status: 'Rejected',
          decidedAt: now
        }, 'Lead Auditor', note ? `Revision requested: ${note}` : 'Revision requested', now));

    setReviews(updated.filter(r => r.status !== 'Open').map(toActionPlan));

    alert(`Action Plan ${decision === 'Approve' ? 'Approved' : 'Returned for Revision'}. Client will be notified.`);
    handleCloseModal();
  };

  const getStatusBadgeClass = (status: string) => {
    switch(status) {
      case 'Pending Review': return 'badge-pending';
      case 'Approved': return 'badge-approved';
      case 'Revision Requested': return 'badge-revision';
      case 'Closed': return 'badge-closed';
      default: return 'badge-default';
    }
  };

  const getSeverityBadgeClass = (type: string) => {
    if (type === 'Major NC') return 'severity-major';
    if (type === 'Minor NC') return 'severity-minor';
    return 'severity-ofi';
  };

  return (
    <div className="action-review-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-title">
          <div className="icon-box">
            <ShieldCheck size={24} className="text-white" />
          </div>
          <div>
            <h1>Review Action Plans</h1>
            <p>Evaluate client corrective actions and evidences for audit findings</p>
          </div>
        </div>
        <div className="header-actions">
           {/* Placeholder for potential header actions */}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-row">
        <div className="stat-card blue">
          <div className="stat-content">
            <h3>{pendingCount}</h3>
            <p>Pending Review</p>
          </div>
          <Clock className="stat-icon" size={24} />
        </div>
        <div className="stat-card green">
          <div className="stat-content">
            <h3>{approvedCount}</h3>
            <p>Actions Approved</p>
          </div>
          <CheckCircle2 className="stat-icon" size={24} />
        </div>
        <div className="stat-card orange">
          <div className="stat-content">
            <h3>{revisionCount}</h3>
            <p>Revisions Requested</p>
          </div>
          <AlertTriangle className="stat-icon" size={24} />
        </div>
      </div>

      {/* Main Content Table */}
      <div className="content-card">
        <div className="card-controls">
          <div className="search-bar">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search by Audit or Finding ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn-filter">
            <Filter size={16} /> Filter
          </button>
        </div>

        <div className="table-responsive">
          <table className="review-table">
            <thead>
              <tr>
                <th>Audit Details</th>
                <th>Finding</th>
                <th>Submission Date</th>
                <th>Evidences</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reviews.filter(r => 
                r.auditTitle.toLowerCase().includes(searchTerm.toLowerCase()) || 
                r.findingId.toLowerCase().includes(searchTerm.toLowerCase())
              ).map(plan => (
                <tr key={plan.id}>
                  <td>
                    <div className="audit-info">
                      <span className="audit-title">{plan.auditTitle}</span>
                      <span className="audit-id">{plan.auditId}</span>
                    </div>
                  </td>
                  <td>
                    <div className="finding-info">
                      <span className={`severity-badge ${getSeverityBadgeClass(plan.findingType)}`}>
                        {plan.findingType}
                      </span>
                      <span className="finding-id">{plan.findingId}</span>
                    </div>
                  </td>
                  <td>
                    <div className="date-info">
                      <Clock size={14} /> {plan.submissionDate}
                    </div>
                    <div className="client-name">{plan.clientContact}</div>
                  </td>
                  <td>
                    <button 
                      className="evidence-count-btn"
                      onClick={() => handleOpenEvidences(plan.evidences)}
                      disabled={plan.evidences.length === 0}
                    >
                      <Paperclip size={14} /> {plan.evidences.length} Files
                    </button>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(plan.status)}`}>
                      {plan.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn-review" onClick={() => handleOpenReview(plan)}>
                      <Eye size={16} /> Review
                    </button>
                  </td>
                </tr>
              ))}
              {reviews.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">No action plans found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evidence Viewer Modal */}
      <ViewOnlyDoc
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
        title={previewFile ? `Evidence — ${previewFile.fileName}` : 'Evidence'}
        fileName={previewFile?.fileName}
        dataUrl={previewFile ? buildEvidencePreview(previewFile.fileName, previewFile.uploadDate, previewFile.size, previewParent) : undefined}
      />

      {showEvidenceModal && viewingEvidences !== null && (
        <div className="modal-overlay">
          <div className="modal-container evidence-modal">
            <div className="modal-header">
              <h2>Evidence Files ({viewingEvidences.length})</h2>
              <button className="btn-close" onClick={handleCloseEvidenceModal}><XCircle size={24} /></button>
            </div>
            
            <div className="modal-body">
              {viewingEvidences.length > 0 ? (
                <div className="evidence-list-full">
                  {viewingEvidences.map(file => (
                    <div key={file.id} className="evidence-item-full">
                      <FileText size={24} className="file-icon-large" />
                      <div className="file-info-full">
                        <span className="file-name-full">{file.fileName}</span>
                        <span className="file-meta-full">{file.uploadDate} • {file.size}</span>
                      </div>
                      <button
                        className="btn-download-full"
                        title="View evidence (read-only)"
                        onClick={() => { setPreviewFile(file); setPreviewParent(selectedReview?.findingId); }}
                        style={{ marginRight: 6 }}
                      >
                        <Eye size={18}/>
                      </button>
                      <button 
                        className="btn-download-full" 
                        title="Download file"
                        onClick={() => handleDownloadFile(file.fileName)}
                      >
                        <Download size={18}/>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-data">No evidence files available.</p>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCloseEvidenceModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedReview && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2>Review Action Plan: {selectedReview.findingId}</h2>
              <button className="btn-close" onClick={handleCloseModal}><XCircle size={24} /></button>
            </div>
            
            <div className="modal-body">
              {/* Finding Section */}
              <div className="review-section warning-bg">
                <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={18}/> Non-Conformance Details</span>
                  <button
                    type="button"
                    onClick={() => setShowCASuggest(true)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', cursor: 'pointer'
                    }}
                  >
                    <Sparkles size={12} /> Suggest actions
                  </button>
                </h3>
                <div className="detail-grid">
                  <div className="label">Finding Type:</div>
                  <div className={`value ${getSeverityBadgeClass(selectedReview.findingType)}`}>{selectedReview.findingType}</div>
                  <div className="label">Description:</div>
                  <div className="value">{selectedReview.findingDescription}</div>
                </div>
              </div>

              {/* Action Plan Section */}
              <div className="review-section">
                <h3><FileText size={18}/> Client Response</h3>
                <div className="field-group">
                  <label>Root Cause Analysis</label>
                  <p className="read-only-text">{selectedReview.rootCause}</p>
                </div>
                <div className="field-group">
                  <label>Correction (Immediate Fix)</label>
                  <p className="read-only-text">{selectedReview.correction}</p>
                </div>
                <div className="field-group">
                  <label>Corrective Action (Preventive)</label>
                  <p className="read-only-text">{selectedReview.correctiveAction}</p>
                </div>
              </div>

              {/* Evidence Section */}
              <div className="review-section">
                <h3><Paperclip size={18}/> Attached Evidences</h3>
                {selectedReview.evidences.length > 0 ? (
                  <div className="evidence-list">
                    {selectedReview.evidences.map(file => (
                      <div key={file.id} className="evidence-item" style={{ cursor: 'pointer' }} onClick={() => { setPreviewFile(file); setPreviewParent(selectedReview.findingId); }} title="Click to preview">
                        <FileText size={20} className="file-icon" />
                        <div className="file-info">
                          <span className="file-name">{file.fileName}</span>
                          <span className="file-meta">{file.uploadDate} • {file.size}</span>
                        </div>
                        <button 
                          className="btn-download"
                          onClick={() => handleDownloadFile(file.fileName)}
                        >
                          <Download size={16}/>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-data">No evidence files uploaded.</p>
                )}
              </div>

              {/* Reviewer Action Section */}
              <div className="review-section action-bg">
                <h3><MessageSquare size={18}/> Lead Auditor Review</h3>
                <div className="field-group">
                  <label>Reviewer Comments / Instructions</label>
                  <textarea 
                    placeholder="Enter comments for approval or reasons for rejection..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCloseModal}>Cancel</button>
              <div className="action-buttons-group">
                <button 
                  className="btn-reject" 
                  onClick={() => handleSubmitDecision('Reject')}
                >
                  <XCircle size={18} /> Request Revision
                </button>
                <button 
                  className="btn-approve" 
                  onClick={() => handleSubmitDecision('Approve')}
                >
                  <CheckCircle2 size={18} /> Approve & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <CorrectiveActionSuggest
        open={showCASuggest}
        finding={selectedReview ? {
          description: [selectedReview.findingDescription, selectedReview.rootCause].filter(Boolean).join(' — '),
          severity: selectedReview.findingType === 'Major NC' ? 'Major' : selectedReview.findingType === 'Minor NC' ? 'Minor' : 'OFI',
          standard: selectedReview.auditTitle,
        } : { description: '' }}
        onClose={() => setShowCASuggest(false)}
      />
    </div>
  );
};

export default ActionReview;