import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertOctagon, 
  FileText, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Calendar,
  User,
  ShieldCheck
} from 'lucide-react';
import '../../styles/LeadAuditor/ActionApproval.css';
import AIPanel from '../../components/AIPanel';
import { classifyFinding } from '../../ai/leadAuditorInsights';
import {
  CORRECTIVE_ACTIONS_EVENT,
  CorrectiveActionRecord,
  loadCorrectiveActions,
  updateCorrectiveAction,
  withHistory
} from '../../services/correctiveActions';

// --- Interfaces ---
interface ActionPlanRequest {
  id: string;
  sourceId: string; // id of the backing record in the shared corrective-action store
  auditId: string;
  auditTitle: string;
  clientName: string;
  findingType: 'Major' | 'Minor';
  findingDescription: string;
  rootCause: string;
  proposedAction: string;
  targetDate: string;
  submittedDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

// --- Shared corrective-action store mapping (replaces hardcoded mock data) ---
const toRequestStatus = (status: CorrectiveActionRecord['status']): ActionPlanRequest['status'] => {
  switch (status) {
    case 'Approved': return 'Approved';
    case 'Rejected': return 'Rejected';
    default: return 'Pending'; // 'Submitted' | 'Auditor Reviewed'
  }
};

const toRequest = (record: CorrectiveActionRecord): ActionPlanRequest => ({
  id: record.capId ?? record.id,
  sourceId: record.id,
  auditId: record.id,
  auditTitle: record.auditTitle ?? 'Untitled Audit',
  clientName: record.clientName ?? 'Client',
  findingType: record.severity === 'Major NC' ? 'Major' : 'Minor',
  findingDescription: record.description ?? '',
  rootCause: record.rootCause ?? 'Not provided',
  proposedAction: record.correctivePlan ?? 'Not provided',
  targetDate: record.dueDate ?? '—',
  submittedDate: record.submittedAt ? record.submittedAt.slice(0, 10) : '—',
  status: toRequestStatus(record.status)
});

// Only records the auditee has submitted are candidates for Lead Auditor approval.
const loadRequests = (): ActionPlanRequest[] =>
  loadCorrectiveActions()
    .filter(r => r.status !== 'Open')
    .map(toRequest);

const ActionApproval: React.FC = () => {
  const [requests, setRequests] = useState<ActionPlanRequest[]>(() => loadRequests());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<{ id: string, type: 'Approve' | 'Reject' } | null>(null);

  // Reload from the shared store when another role updates it (same-tab custom event + cross-tab storage event)
  useEffect(() => {
    const reload = () => setRequests(loadRequests());
    window.addEventListener(CORRECTIVE_ACTIONS_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(CORRECTIVE_ACTIONS_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  // --- AI Finding Classifier (feature 10) ---
  const classified = useMemo(() =>
    requests
      .filter(r => r.status === 'Pending')
      .map(r => ({ request: r, ai: classifyFinding(r.findingDescription) })),
  [requests]);

  // Toggle row expansion
  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Handle Approve/Reject Click
  const initiateDecision = (id: string, type: 'Approve' | 'Reject') => {
    setSelectedAction({ id, type });
    setApprovalComment('');
    setShowConfirmModal(true);
  };

  // Confirm Decision
  const confirmDecision = () => {
    if (!selectedAction) return;

    const target = requests.find(r => r.id === selectedAction.id);
    if (!target) return;

    const now = new Date().toISOString();
    const note = approvalComment.trim();
    const updated = updateCorrectiveAction(target.sourceId, record => withHistory({
      ...record,
      status: selectedAction.type === 'Approve' ? 'Approved' : 'Rejected',
      decidedAt: now
    }, 'Lead Auditor',
      selectedAction.type === 'Approve'
        ? (note ? `Action plan approved: ${note}` : 'Action plan approved')
        : (note ? `Action plan rejected: ${note}` : 'Action plan rejected'),
      now));

    setRequests(updated.filter(r => r.status !== 'Open').map(toRequest));

    setShowConfirmModal(false);
    setSelectedAction(null);
    setExpandedId(null);

    // Persisted to the shared corrective-action store; other roles see this live.
    alert(`Action Plan ${selectedAction.type}d successfully.`);
  };

  // Stats
  const pendingCount = requests.filter(r => r.status === 'Pending').length;
  const majorCount = requests.filter(r => r.status === 'Pending' && r.findingType === 'Major').length;

  return (
    <div className="action-approval-container">
      {/* Header */}
      <div className="approval-header">
        <div className="header-text">
          <h1>Action Plan Approval</h1>
          <p>Review and authorize corrective action plans submitted by auditees.</p>
        </div>
        <div className="header-stats">
          <div className="stat-pill orange">
            <span className="label">Pending Requests</span>
            <span className="value">{pendingCount}</span>
          </div>
          <div className="stat-pill red">
            <span className="label">Major Findings</span>
            <span className="value">{majorCount}</span>
          </div>
        </div>
      </div>

      {/* AI Finding Classifier */}
      <AIPanel
        title="Finding Classifier"
        subtitle="Suggested severity and ISO clause for each pending corrective action"
        onRefresh={() => setRequests(loadRequests())}
      >
        {classified.length === 0 ? (
          <p className="ai-panel-note">No pending corrective actions to classify.</p>
        ) : (
          <ul className="ai-insight-list">
            {classified.map(({ request, ai }) => {
              const current = `${request.findingType} NC`;
              const agrees = ai.suggestedSeverity === current;
              return (
                <li key={request.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 12.5 }}>{request.id} · {request.clientName}</strong>
                    <span className={'ai-chip ' + (ai.suggestedSeverity === 'Major NC' ? 'major' : ai.suggestedSeverity === 'Minor NC' ? 'minor' : 'info')}>
                      Suggests {ai.suggestedSeverity}
                    </span>
                    <span className="ai-chip info">Clause {ai.clause} — {ai.clauseTitle}</span>
                    <span className={'ai-chip ' + (agrees ? 'ok' : 'high')}>
                      {agrees ? `Agrees with current (${current})` : `Differs from current (${current})`}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    {ai.severityReasons.join('; ')} · Clause match: {ai.clauseReason}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="ai-panel-note">Keyword heuristics on the live corrective-action store — verify before overriding the auditee's grading.</p>
      </AIPanel>

      {/* Toolbar */}
      <div className="approval-toolbar">
        <div className="search-wrapper">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search by client, audit, or ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn-filter">
          <Filter size={16} /> Filter
        </button>
      </div>

      {/* Requests List */}
      <div className="requests-list">
        {requests.filter(r => 
          r.status === 'Pending' && 
          (r.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || r.auditTitle.toLowerCase().includes(searchTerm.toLowerCase()))
        ).map((request) => (
          <div key={request.id} className={`request-card ${expandedId === request.id ? 'expanded' : ''}`}>
            
            {/* Card Summary Row */}
            <div className="request-summary" onClick={() => toggleExpand(request.id)}>
              <div className="summary-left">
                <div className={`status-indicator ${request.findingType.toLowerCase()}`}></div>
                <div className="info-block">
                  <span className="req-id">{request.id}</span>
                  <span className="client-name">{request.clientName}</span>
                </div>
              </div>
              <div className="summary-center">
                <div className="audit-info">
                  <ShieldCheck size={14} /> {request.auditTitle}
                </div>
                <div className="audit-date">
                  <Calendar size={14} /> Due: {request.targetDate}
                </div>
              </div>
              <div className="summary-right">
                <span className={`badge ${request.findingType.toLowerCase()}`}>{request.findingType} NC</span>
                {expandedId === request.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </div>

            {/* Expanded Details Section */}
            {expandedId === request.id && (
              <div className="request-details">
                <div className="detail-grid">
                  <div className="detail-box warning">
                    <h4><AlertOctagon size={16}/> Non-Conformance</h4>
                    <p>{request.findingDescription}</p>
                  </div>
                  <div className="detail-box info">
                    <h4><FileText size={16}/> Root Cause Analysis</h4>
                    <p>{request.rootCause}</p>
                  </div>
                  <div className="detail-box success full-width">
                    <h4><CheckCircle size={16}/> Proposed Corrective Action</h4>
                    <p>{request.proposedAction}</p>
                  </div>
                </div>

                <div className="approval-actions">
                  <div className="meta-info">
                    <span><User size={14}/> Submitted by Client</span>
                    <span><Calendar size={14}/> {request.submittedDate}</span>
                  </div>
                  <div className="action-buttons">
                    <button 
                      className="btn-reject"
                      onClick={() => initiateDecision(request.id, 'Reject')}
                    >
                      <XCircle size={16} /> Reject Plan
                    </button>
                    <button 
                      className="btn-approve"
                      onClick={() => initiateDecision(request.id, 'Approve')}
                    >
                      <CheckCircle size={16} /> Approve Plan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {requests.filter(r => r.status === 'Pending').length === 0 && (
          <div className="empty-state">
            <CheckCircle size={48} className="text-gray-300" />
            <p>No pending action plans to approve.</p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedAction && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className={`modal-header ${selectedAction.type.toLowerCase()}`}>
              <h2>{selectedAction.type} Action Plan</h2>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to <strong>{selectedAction.type.toLowerCase()}</strong> the action plan for 
                <span className="highlight"> {requests.find(r => r.id === selectedAction.id)?.id}</span>?
              </p>
              
              <div className="form-group">
                <label>Reviewer Comments (Optional)</label>
                <textarea 
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  placeholder={selectedAction.type === 'Reject' ? "Please provide reason for rejection..." : "Add any approval notes..."}
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowConfirmModal(false)}>Cancel</button>
              <button 
                className={`btn-confirm ${selectedAction.type.toLowerCase()}`}
                onClick={confirmDecision}
              >
                Confirm {selectedAction.type}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionApproval;