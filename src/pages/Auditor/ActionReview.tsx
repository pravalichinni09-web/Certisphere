import React, { useState, useEffect } from 'react';
import AuditorRegistration from '../../components/AuditorRegistration';
import { 
  CheckCircle, 
  XCircle, 
  Calendar, 
  User, 
  FileText, 
  AlertTriangle, 
  Search,
  Filter,
  Eye,
  Download,
  Paperclip,
  CheckCircle2
} from 'lucide-react';
import { Sparkles } from 'lucide-react';
import '../../styles/Auditor/ActionReview.css';
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
  name: string;
  date: string;
  size: string;
}

interface ActionItem {
  id: string;
  auditId: string;
  auditTitle: string;
  findingId: string;
  findingTitle: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  assignedTo: string; // Client user
  dueDate: string;
  status: 'Pending Review' | 'In Progress' | 'Completed' | 'Rejected';
  rootCause: string;
  actionTaken: string;
  evidence: Evidence[];
  auditorNotes?: string;
}

// --- Shared corrective-action store mapping (replaces hardcoded mock data) ---
const toPriority = (severity: CorrectiveActionRecord['severity']): ActionItem['priority'] => {
  switch (severity) {
    case 'Major NC': return 'Critical';
    case 'Minor NC': return 'High';
    default: return 'Medium';
  }
};

const toItemStatus = (status: CorrectiveActionRecord['status']): ActionItem['status'] => {
  switch (status) {
    case 'Submitted': return 'Pending Review';
    case 'Open': return 'In Progress';
    case 'Rejected': return 'Rejected';
    default: return 'Completed'; // 'Auditor Reviewed' | 'Approved'
  }
};

const lastAuditorNote = (record: CorrectiveActionRecord): string | undefined => {
  const entries = (record.history ?? []).filter(h => h.by === 'Auditor');
  return entries.length > 0 ? entries[entries.length - 1].action : undefined;
};

const toActionItem = (record: CorrectiveActionRecord): ActionItem => ({
  id: record.id,
  auditId: record.capId ?? record.id,
  auditTitle: record.auditTitle ?? 'Untitled Audit',
  findingId: record.capId ?? record.id,
  findingTitle: `${record.severity ?? 'Finding'} — ${record.standard ?? record.auditType ?? ''}`.trim(),
  description: record.description ?? '',
  priority: toPriority(record.severity),
  assignedTo: record.clientName ?? 'Client',
  dueDate: record.dueDate ?? '—',
  status: toItemStatus(record.status),
  rootCause: record.rootCause ?? 'Not provided',
  actionTaken: record.correctivePlan ?? 'Not provided',
  evidence: (record.evidence ?? []).map((ev, idx) => ({
    id: `${record.id}-EV-${idx + 1}`,
    name: ev.name,
    date: ev.date,
    size: '—'
  })),
  auditorNotes: record.status === 'Submitted' || record.status === 'Open' ? undefined : lastAuditorNote(record)
});

const loadItems = (): ActionItem[] => loadCorrectiveActions().map(toActionItem);

const ActionReview: React.FC = () => {
  const [items, setItems] = useState<ActionItem[]>(() => loadItems());
  const [selectedItem, setSelectedItem] = useState<ActionItem | null>(null);
  const [showAudReg, setShowAudReg] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [, setShowCASuggest] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All');

  // Reload from the shared store when another role updates it (same-tab custom event + cross-tab storage event)
  useEffect(() => {
    const reload = () => setItems(loadItems());
    window.addEventListener(CORRECTIVE_ACTIONS_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(CORRECTIVE_ACTIONS_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  // handlers
  const handleOpenReview = (item: ActionItem) => {
    setSelectedItem(item);
    setReviewNotes(item.auditorNotes || '');
    setShowReviewModal(true);
  };

  const handleCloseModal = () => {
    setShowReviewModal(false);
    setSelectedItem(null);
    setReviewNotes('');
  };

  const handleApprove = () => {
    if (!selectedItem) return;

    const now = new Date().toISOString();
    const updated = updateCorrectiveAction(selectedItem.id, record => withHistory({
      ...record,
      status: 'Auditor Reviewed',
      reviewedAt: now
    }, 'Auditor', reviewNotes.trim() ? `Closure accepted: ${reviewNotes.trim()}` : 'Closure accepted by auditor', now));
    setItems(updated.map(toActionItem));
    alert(`Action Item ${selectedItem.id} Approved & Closed.`);
    handleCloseModal();
  };

  const handleReject = () => {
    if (!selectedItem) return;
    if (!reviewNotes.trim()) {
      alert('Please provide review notes explaining the rejection.');
      return;
    }

    const now = new Date().toISOString();
    const updated = updateCorrectiveAction(selectedItem.id, record => withHistory({
      ...record,
      status: 'Rejected',
      reviewedAt: now,
      decidedAt: now
    }, 'Auditor', `Closure rejected: ${reviewNotes.trim()}`, now));
    setItems(updated.map(toActionItem));
    alert(`Action Item ${selectedItem.id} Rejected. Sent back to client.`);
    handleCloseModal();
  };

  // Helper functions for styles
  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'priority-critical';
      case 'High': return 'priority-high';
      case 'Medium': return 'priority-medium';
      default: return 'priority-low';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Completed': return 'status-completed';
      case 'Pending Review': return 'status-pending';
      case 'Rejected': return 'status-rejected';
      default: return 'status-default';
    }
  };

  const filteredItems = filterStatus === 'All' 
    ? items 
    : items.filter(i => i.status === filterStatus);


  const handleDownloadFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || 'txt';
    let mimeType = 'text/plain';
    let fileContent = `Evidence file: ${fileName}\n\nThis file was submitted as audit evidence.`;
    if (ext === 'pdf') {
      mimeType = 'application/pdf';
      fileContent = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n9\n%%EOF';
    } else if (ext === 'xlsx') {
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (ext === 'jpg' || ext === 'jpeg') { mimeType = 'image/jpeg'; }
    else if (ext === 'png') { mimeType = 'image/png'; }
    else if (ext === 'docx') { mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; }
    const blob = new Blob([fileContent], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="auditor-action-review">
      {/* Header */}
      <div className="page-header">
        <div className="header-title">
          <div className="icon-box">
            <CheckCircle2 size={24} className="text-white" />
          </div>
          <div>
            <h1>Action Items Review</h1>
            <p>Verify corrective actions and close audit findings</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-link" onClick={() => setShowAudReg(true)}>Auditor details</button>
        </div>
      </div>

      {/* Stats / Overview */}
      <div className="overview-cards">
        <div className="stat-card">
          <h3>{items.filter(i => i.status === 'Pending Review').length}</h3>
          <p>Pending Review</p>
        </div>
        <div className="stat-card">
          <h3>{items.filter(i => i.priority === 'Critical' && i.status !== 'Completed').length}</h3>
          <p>Open Critical Items</p>
        </div>
        <div className="stat-card">
          <h3>{items.filter(i => i.status === 'Completed').length}</h3>
          <p>Closed Items</p>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="content-card">
        <div className="toolbar">
          <div className="search-bar">
            <Search size={18} />
            <input type="text" placeholder="Search findings or audits..." />
          </div>
          <div className="filter-group">
            <Filter size={16} />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="All">All Status</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="actions-table">
            <thead>
              <tr>
                <th>Finding</th>
                <th>Audit</th>
                <th>Assigned To</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id}>
                  <td>
                    <div className="finding-cell">
                      <span className="finding-id">{item.findingId}</span>
                      <span className="finding-title">{item.findingTitle}</span>
                    </div>
                  </td>
                  <td>{item.auditTitle}</td>
                  <td>
                    <div className="user-cell">
                      <User size={14} /> {item.assignedTo}
                    </div>
                  </td>
                  <td>
                    <span className={`priority-badge ${getPriorityClass(item.priority)}`}>
                      {item.priority}
                    </span>
                  </td>
                  <td>
                    <div className="date-cell">
                      <Calendar size={14} /> {item.dueDate}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusClass(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn-icon" 
                      onClick={() => handleOpenReview(item)}
                      title="Review"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr><td colSpan={7} className="empty-row">No action items found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && selectedItem && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2>Review Implementation: {selectedItem.findingId}</h2>
              <button className="btn-close" onClick={handleCloseModal}><XCircle size={24}/></button>
            </div>
            
            <div className="modal-body">
              {/* Finding Details */}
              <div className="detail-section bg-gray">
                <div className="section-row">
                  <div>
                    <span className="label">Finding:</span>
                    <p className="value">{selectedItem.findingTitle}</p>
                  </div>
                  <div>
                    <span className="label">Priority:</span>
                    <span className={`priority-badge ${getPriorityClass(selectedItem.priority)}`}>
                      {selectedItem.priority}
                    </span>
                  </div>
                </div>
                <div className="mt-2">
                  <span className="label">Description:</span>
                  <p className="value">{selectedItem.description}</p>
                </div>
              </div>

              {/* Action Taken */}
              <div className="detail-section">
                <h3><CheckCircle size={18}/> Client Response</h3>
                <div className="form-group">
                  <label>Root Cause Analysis</label>
                  <div className="read-only-box">{selectedItem.rootCause}</div>
                </div>
                <div className="form-group">
                  <label>Action Taken</label>
                  <div className="read-only-box">{selectedItem.actionTaken}</div>
                </div>
              </div>

              {/* Evidence */}
              <div className="detail-section">
                <h3><Paperclip size={18}/> Submitted Evidence</h3>
                {selectedItem.evidence.length > 0 ? (
                  <div className="evidence-list">
                    {selectedItem.evidence.map(ev => (
                      <div key={ev.id} className="evidence-item">
                        <FileText size={16} className="file-icon" />
                        <div className="file-info">
                          <span className="file-name">{ev.name}</span>
                          <span className="file-meta">{ev.date} • {ev.size}</span>
                        </div>
                        <button className="btn-download" onClick={() => handleDownloadFile(ev.name)} title="Download file"><Download size={14} /></button>
                      </div>
                    ))}
                    {showAudReg && <AuditorRegistration onClose={() => setShowAudReg(false)} />}
                  </div>
                ) : (
                  <p className="no-data">No evidence files attached.</p>
                )}
              </div>

              {/* Auditor Review */}
              <div className="detail-section review-input-section">
                <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={18}/> Auditor Assessment</span>
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
                <div className="form-group">
                  <label>Review Notes</label>
                  <textarea 
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Enter your feedback, approval notes, or reasons for rejection..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseModal}>Cancel</button>
              <div className="action-buttons">
                <button className="btn-reject" onClick={handleReject}>
                  <XCircle size={16} /> Reject
                </button>
                <button className="btn-approve" onClick={handleApprove}>
                  <CheckCircle size={16} /> Approve & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* CorrectiveActionSuggest reference removed (truncated in source); placeholder div */}
    </div>
  );
};

export default ActionReview;
