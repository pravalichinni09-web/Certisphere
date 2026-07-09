import React, { useState, useEffect, useMemo } from 'react';
import { 
  Filter, 
  ChevronDown, 
  AlertCircle, 
  CheckCircle, 
  X, 
  Save,
  FileText,
  MoreHorizontal,
  Download,
  Eye,
  Edit2,
  Search, // Icon for Root Causes
  Send // Icon for Submit Report
} from 'lucide-react';
import './AuditActions.css';
import {
  CORRECTIVE_ACTIONS_EVENT,
  CorrectiveActionRecord,
  CorrectiveActionStatus,
  loadCorrectiveActions,
  updateCorrectiveAction,
  withHistory
} from '../../services/correctiveActions';
import AIPanel from '../../components/AIPanel';
import { isClaudeConfigured } from '../../ai/liveData';
import { buildCoachPlan, refineCoachPlan, JARGON_TERMS } from '../../ai/auditeeInsights';
import type { ActionSuggestion } from '../../ai/correctiveActions';

// Row shape consumed by the existing UI, derived from the shared corrective-action records
interface AuditActionRow {
  id: string;
  auditName: string;
  department: string;
  auditorName: string;
  leadAuditor: string;
  findingsList: string[];
  rootCausesList: string[];
  correctionsList: string[];
  status: string;
  sharedStatus: CorrectiveActionStatus;
}

const statusLabel = (status: CorrectiveActionStatus): string => {
  switch (status) {
    case 'Open': return 'In Progress';
    case 'Submitted': return 'Pending Review';
    case 'Auditor Reviewed': return 'Auditor Reviewed';
    case 'Approved': return 'Completed';
    case 'Rejected': return 'Rejected';
  }
};

const toRow = (record: CorrectiveActionRecord): AuditActionRow => ({
  id: record.id,
  auditName: record.auditTitle,
  department: record.standard,
  auditorName: 'Priya Sharma',
  leadAuditor: 'David Chen',
  findingsList: [`${record.capId} (${record.severity}): ${record.description}`],
  rootCausesList: record.rootCause ? [record.rootCause] : [],
  correctionsList: record.correctivePlan ? [record.correctivePlan] : [],
  status: statusLabel(record.status),
  sharedStatus: record.status
});
const AuditActions = () => {
  // --- State Management ---
  const [rows, setRows] = useState<AuditActionRow[]>(() => loadCorrectiveActions().map(toRow));

  useEffect(() => {
    const reload = () => setRows(loadCorrectiveActions().map(toRow));
    window.addEventListener(CORRECTIVE_ACTIONS_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(CORRECTIVE_ACTIONS_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  const [filters, setFilters] = useState({
    auditName: '',
    department: '',
    auditorName: '',
    leadAuditor: ''
  });

  const [activeModal, setActiveModal] = useState<'findings' | 'corrections' | 'rootCauses' | 'report' | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [tempListItems, setTempListItems] = useState<any[]>([]);
  
  // State for Row Actions Dropdown
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // --- AI Corrective Action Coach (feature 15) + Plain-Language Explainer (feature 17) ---
  const openRecords = useMemo(
    () => loadCorrectiveActions().filter((r) => r.status === 'Open'),
    [rows]
  );
  const [coachFor, setCoachFor] = useState<CorrectiveActionRecord | null>(null);
  const [coachWhys, setCoachWhys] = useState<string[]>([]);
  const [coachRoot, setCoachRoot] = useState('');
  const [coachPlan, setCoachPlan] = useState('');
  const [coachSuggestion, setCoachSuggestion] = useState<ActionSuggestion | null>(null);
  const [coachRefining, setCoachRefining] = useState(false);
  const [jargonTerm, setJargonTerm] = useState('');

  const openCoach = (rec: CorrectiveActionRecord) => {
    const plan = buildCoachPlan(rec);
    setCoachFor(rec);
    setCoachWhys(plan.fiveWhys);
    setCoachRoot(rec.rootCause || plan.rootCauseDraft);
    setCoachPlan(rec.correctivePlan || plan.planDraft);
    setCoachSuggestion(plan.suggestion);
  };

  const applyCoach = () => {
    if (!coachFor) return;
    const updated = updateCorrectiveAction(coachFor.id, (record) => withHistory({
      ...record,
      rootCause: coachRoot.trim() || record.rootCause,
      correctivePlan: coachPlan.trim() || record.correctivePlan,
    }, 'Auditee', 'AI Coach: root cause and corrective plan drafted'));
    setRows(updated.map(toRow));
    setCoachFor(null);
    alert('Root cause and corrective plan saved to the action.\n\nUse "Submit Report" on the card when you are ready to submit closure evidence.');
  };

  const refinePlanWithClaude = async () => {
    if (!coachFor || !coachSuggestion) return;
    setCoachRefining(true);
    const refined = await refineCoachPlan(coachFor, coachSuggestion);
    setCoachRefining(false);
    if (refined) setCoachPlan(refined);
    else alert('Claude refinement unavailable — check the API key in AI Settings.');
  };

  // State for Report Configuration
  const [reportConfig, setReportConfig] = useState({
    auditName: '',
    department: '',
    auditorName: '',
    leadAuditor: '',
    format: 'PDF'
  });

  // --- Derived Data (Filtering Logic) ---
  const filterOptions = {
    auditNames: Array.from(new Set(rows.map(d => d.auditName))),
    departments: Array.from(new Set(rows.map(d => d.department))),
    auditors: Array.from(new Set(rows.map(d => d.auditorName))),
    leadAuditors: Array.from(new Set(rows.map(d => d.leadAuditor)))
  };

  const filteredData = rows.filter(row => {
    return (
      (!filters.auditName || row.auditName === filters.auditName) &&
      (!filters.department || row.department === filters.department) &&
      (!filters.auditorName || row.auditorName === filters.auditorName) &&
      (!filters.leadAuditor || row.leadAuditor === filters.leadAuditor)
    );
  });

  const selectedAudit = rows.find(a => a.id === selectedRowId);

  // --- Handlers ---

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleReportConfigChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setReportConfig({ ...reportConfig, [e.target.name]: e.target.value });
  };

  const openListModal = (type: 'findings' | 'corrections' | 'rootCauses', rowId: string) => {
    const row = rows.find(r => r.id === rowId);
    if (row) {
      let sourceList: string[] = [];
      if (type === 'findings') sourceList = row.findingsList;
      else if (type === 'rootCauses') sourceList = row.rootCausesList;
      else sourceList = row.correctionsList;

      const items = sourceList.map((text, idx) => ({ 
        id: `${row.id}-${type}-${idx}`, 
        text, 
        selected: false 
      }));
      setTempListItems(items);
      setSelectedRowId(rowId);
      setActiveModal(type);
      setOpenActionMenuId(null); // Close any open menus
    }
  };

  const toggleActionMenu = (id: string) => {
    setOpenActionMenuId(openActionMenuId === id ? null : id);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedRowId(null);
    setTempListItems([]);
  };

  const toggleItemSelection = (itemId: string) => {
    setTempListItems(prev => 
      prev.map(item => item.id === itemId ? { ...item, selected: !item.selected } : item)
    );
  };

  const handleSubmitModal = () => {
    const selectedCount = tempListItems.filter(i => i.selected).length;
    
    if (activeModal === 'rootCauses') {
      alert(`Successfully submitted ${selectedCount} Root Causes.\n\nAn email confirmation has been sent to the client.`);
    } else {
      console.log(`Submitting ${activeModal} for Audit ID ${selectedRowId}:`, tempListItems);
    }
    
    closeModal();
  };

  // --- NEW: Handle Submit Report Row Action (submits closure evidence to the shared store) ---
  const handleSubmitReport = (row: AuditActionRow) => {
     if (row.sharedStatus !== 'Open') {
         alert(`Closure evidence for "${row.auditName}" has already been submitted.\n\nCurrent status: ${row.status}.`);
         return;
     }
     // Logic to "check details" and submit
     if(window.confirm(`Are you sure you want to submit the report for:\n\n${row.auditName} (${row.department})?\n\nThis will trigger an email notification to the client.`)) {
         const now = new Date().toISOString();
         const updated = updateCorrectiveAction(row.id, record => withHistory({
             ...record,
             status: 'Submitted',
             submittedAt: now,
             evidence: [...(record.evidence ?? []), { name: `Closure_Evidence_${record.capId}.pdf`, date: now.slice(0, 10) }]
         }, 'Auditee', 'Closure evidence submitted', now));
         setRows(updated.map(toRow));
         alert(`Report Submitted Successfully!\n\nEmail sent to client regarding ${row.auditName}.`);
     }
  };

  const handleGenerateReport = () => {
    console.log("Generating report with config:", reportConfig);
    alert(`Report generated for ${reportConfig.auditName || 'All Audits'} in ${reportConfig.format} format.`);
    closeModal();
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Completed': return 'status-completed';
      case 'In Progress': return 'status-progress';
      case 'Pending Review': return 'status-pending';
      default: return 'status-default';
    }
  };

  const getModalTitle = () => {
    switch (activeModal) {
      case 'findings': return 'Audit Findings';
      case 'rootCauses': return 'Root Causes Analysis';
      case 'corrections': return 'Corrective Actions';
      default: return '';
    }
  };

  return (
    <div className="audit-container">
      
      {/* Header Section */}
      <div className="audit-header">
        <div className="audit-title">
          <h1>Audit Actions</h1>
          <p>Manage audit findings, root causes, corrections, and closures.</p>
        </div>
        <button 
          className="btn-report" 
          onClick={() => setActiveModal('report')}
        >
          <FileText className="icon-sm" />
          Generate Report
        </button>
      </div>

      {/* AI Corrective Action Coach */}
      <AIPanel
        title="Corrective Action Coach"
        subtitle="5-Why root-cause scaffold and plan suggestions for open actions"
      >
        {openRecords.length === 0 ? (
          <p className="ai-panel-note">No open actions right now — the coach activates when a finding needs a response.</p>
        ) : (
          <ul className="ai-insight-list">
            {openRecords.map((rec) => (
              <li key={rec.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 12.5 }}>{rec.capId}</strong>
                  <span className={'ai-chip ' + (rec.severity === 'Major NC' ? 'major' : rec.severity === 'Minor NC' ? 'minor' : 'info')}>{rec.severity}</span>
                  <span className="ai-chip info">{rec.standard}</span>
                </div>
                <div style={{ fontSize: 12, margin: '4px 0 0' }}>{rec.description}</div>
                <button className="ai-action-btn" onClick={() => openCoach(rec)}>AI Coach — draft root cause &amp; plan</button>
              </li>
            ))}
          </ul>
        )}
      </AIPanel>

      {/* AI Plain-Language Explainer */}
      <AIPanel
        title="Plain-Language Explainer"
        subtitle="Audit jargon explained, including what it means for your certificate"
        defaultCollapsed
      >
        <select
          className="filter-select"
          value={jargonTerm}
          onChange={(e) => setJargonTerm(e.target.value)}
          style={{ maxWidth: 360 }}
        >
          <option value="">Choose a term…</option>
          {JARGON_TERMS.map((t) => <option key={t.term} value={t.term}>{t.term}</option>)}
        </select>
        {(() => {
          const entry = JARGON_TERMS.find((t) => t.term === jargonTerm);
          if (!entry) return <p className="ai-panel-note">Pick a term to see it in plain language.</p>;
          return (
            <div style={{ marginTop: 8, fontSize: 12.5 }}>
              <p style={{ margin: '0 0 6px' }}><strong>In plain language:</strong> {entry.plain}</p>
              <p style={{ margin: 0 }}><strong>What it means for your certificate:</strong> {entry.certificate}</p>
            </div>
          );
        })()}
      </AIPanel>

      {/* Filter Section */}
      <div className="filter-card">
        <div className="filter-header">
          <Filter className="icon-sm" style={{ color: '#3b82f6' }} />
          Filter Actions
        </div>
        <div className="filter-grid">
          <div className="select-wrapper">
            <select name="auditName" className="filter-select" onChange={handleFilterChange} value={filters.auditName}>
              <option value="">Select Audit Name</option>
              {filterOptions.auditNames.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <ChevronDown className="select-icon" />
          </div>
          <div className="select-wrapper">
            <select name="department" className="filter-select" onChange={handleFilterChange} value={filters.department}>
              <option value="">Select Department</option>
              {filterOptions.departments.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <ChevronDown className="select-icon" />
          </div>
          <div className="select-wrapper">
            <select name="auditorName" className="filter-select" onChange={handleFilterChange} value={filters.auditorName}>
              <option value="">Select Auditor</option>
              {filterOptions.auditors.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <ChevronDown className="select-icon" />
          </div>
          <div className="select-wrapper">
            <select name="leadAuditor" className="filter-select" onChange={handleFilterChange} value={filters.leadAuditor}>
              <option value="">Select Lead Auditor</option>
              {filterOptions.leadAuditors.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <ChevronDown className="select-icon" />
          </div>
        </div>
      </div>

      {/* Modern card grid (replaces dense table) */}
      <div className="audit-card-grid" onClick={() => setOpenActionMenuId(null)}>
        {filteredData.length > 0 ? (
          filteredData.map((row) => (
            <article key={row.id} className="audit-card">
              {/* Card header — title + status */}
              <header className="audit-card-head">
                <div className="audit-card-title">
                  <h3>{row.auditName}</h3>
                  <span className="audit-card-sub">{row.department}</span>
                </div>
                <span className={`status-badge ${getStatusClass(row.status || 'Pending Review')}`}>
                  {row.status || 'Pending Review'}
                </span>
              </header>

              {/* Contact rows */}
              <div className="audit-card-contacts">
                <div className="audit-card-line"><span className="label">Auditor</span><span>{row.auditorName}</span></div>
                <div className="audit-card-line"><span className="label">Lead Auditor</span><span>{row.leadAuditor}</span></div>
              </div>

              {/* Stat pills — findings / root causes / corrections */}
              <div className="audit-card-stats">
                <button onClick={(e) => { e.stopPropagation(); openListModal('findings', row.id); }} className="audit-stat findings">
                  <span className="audit-stat-icon"><AlertCircle size={16} /></span>
                  <div className="audit-stat-body">
                    <span className="audit-stat-count">{row.findingsList.length}</span>
                    <span className="audit-stat-label">Findings</span>
                  </div>
                </button>
                <button onClick={(e) => { e.stopPropagation(); openListModal('rootCauses', row.id); }} className="audit-stat root-causes">
                  <span className="audit-stat-icon"><Search size={16} /></span>
                  <div className="audit-stat-body">
                    <span className="audit-stat-count">{row.rootCausesList.length}</span>
                    <span className="audit-stat-label">Root Causes</span>
                  </div>
                </button>
                <button onClick={(e) => { e.stopPropagation(); openListModal('corrections', row.id); }} className="audit-stat corrections">
                  <span className="audit-stat-icon"><CheckCircle size={16} /></span>
                  <div className="audit-stat-body">
                    <span className="audit-stat-count">{row.correctionsList.length}</span>
                    <span className="audit-stat-label">Corrections</span>
                  </div>
                </button>
              </div>

              {/* Actions footer */}
              <footer className="audit-card-actions">
                    <td style={{ fontWeight: 500 }}>{row.auditName}</td>
                    <td className="text-muted">{row.department}</td>
                    <td className="text-muted">{row.auditorName}</td>
                    <td className="text-muted">{row.leadAuditor}</td>
                    
                    {/* Findings Trigger */}
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); openListModal('findings', row.id); }}
                        className="btn-count btn-findings"
                      >
                        <AlertCircle className="icon-xs" />
                        {row.findingsList.length}
                      </button>
                    </td>

                    {/* Root Causes Trigger */}
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); openListModal('rootCauses', row.id); }}
                        className="btn-count"
                        style={{ backgroundColor: '#f3e8ff', color: '#7c3aed', border: '1px solid #d8b4fe' }}
                      >
                        <Search className="icon-xs" />
                        {row.rootCausesList.length}
                      </button>
                    </td>

                    {/* Corrections Trigger */}
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); openListModal('corrections', row.id); }}
                        className="btn-count btn-corrections"
                      >
                        <CheckCircle className="icon-xs" />
                        {row.correctionsList.length}
                      </button>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`status-badge ${getStatusClass(row.status || 'Pending Review')}`}>
                        {row.status || 'Pending Review'}
                      </span>
                    </td>

                {/* Action buttons row */}
                <div className="audit-card-actions-row">
                           
                           {/* Submit Report Button */}
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleSubmitReport(row); }}
                             className="btn-action"
                             title="Submit Report"
                             style={{ 
                                 padding: '6px', 
                                 borderRadius: '4px', 
                                 backgroundColor: '#dbeafe', 
                                 color: '#2563eb', 
                                 border: 'none', 
                                 cursor: 'pointer' 
                             }}
                           >
                             <Send size={16} />
                           </button>

                           {/* More Actions Menu */}
                           <div style={{ position: 'relative' }}>
                               <button 
                                className="btn-more" 
                                onClick={(e) => { e.stopPropagation(); toggleActionMenu(row.id); }}
                               >
                                 <MoreHorizontal className="icon-sm" />
                               </button>
                               
                               {openActionMenuId === row.id && (
                                 <div className="action-menu" style={{
                                   position: 'absolute', right: '0', top: '30px',
                                   backgroundColor: 'white', border: '1px solid #e5e7eb',
                                   borderRadius: '6px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                   zIndex: 50, width: '150px', textAlign: 'left', overflow: 'hidden'
                                 }}>
                                   <button className="menu-item" style={{ width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                                     <Eye size={14} /> View Details
                                   </button>
                                   <button className="menu-item" style={{ width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                                     <Edit2 size={14} /> Edit
                                   </button>
                                   <button className="menu-item" style={{ width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                                     <Download size={14} /> Download PDF
                                   </button>
                                 </div>
                               )}
                           </div>
                       </div>
              </footer>
            </article>
          ))
        ) : (
          <div className="audit-card-empty">No audit actions match your filters.</div>
        )}
      </div>

      {/* --- REPORT MODAL --- */}
      {activeModal === 'report' && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Generate Audit Report</h3>
              <button onClick={closeModal} className="btn-close"><X className="icon-sm" /></button>
            </div>
            <div className="modal-body">
              <div className="filter-grid" style={{ gridTemplateColumns: '1fr', gap: '1rem' }}>
                <div className="select-wrapper">
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Select Audit</label>
                  <select name="auditName" className="filter-select" style={{width: '100%'}} onChange={handleReportConfigChange}>
                    <option value="">All Audits</option>
                    {filterOptions.auditNames.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="select-wrapper">
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Format</label>
                  <select name="format" className="filter-select" style={{width: '100%'}} onChange={handleReportConfigChange}>
                    <option value="PDF">PDF Document</option>
                    <option value="Excel">Excel Spreadsheet</option>
                    <option value="CSV">CSV File</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={closeModal} className="btn-cancel">Cancel</button>
              <button onClick={handleGenerateReport} className="btn-submit">
                <FileText className="icon-xs" /> Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIST MODAL (Findings / Root Causes / Corrections) --- */}
      {(activeModal === 'findings' || activeModal === 'corrections' || activeModal === 'rootCauses') && selectedAudit && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <div>
                <h3>{getModalTitle()}</h3>
                <p className="modal-subtext">{selectedAudit.auditName} - {selectedAudit.department}</p>
              </div>
              <button onClick={closeModal} className="btn-close">
                <X className="icon-sm" />
              </button>
            </div>

            <div className="modal-body">
              {tempListItems.length > 0 ? (
                <div>
                  <p style={{ fontSize: '0.875rem', marginBottom: '1rem', color: '#4b5563' }}>
                    Select items to include in the submission:
                  </p>
                  {tempListItems.map((item) => (
                    <label 
                      key={item.id} 
                      className={`modal-list-item ${item.selected ? 'selected' : ''}`}
                    >
                      <input 
                        type="checkbox" 
                        checked={item.selected || false}
                        onChange={() => toggleItemSelection(item.id)}
                        className="checkbox-custom"
                      />
                      <div className="item-content">
                        <span className="item-id">{item.id}</span>
                        <span className="item-text">{item.text}</span>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <CheckCircle className="icon-sm" style={{ width: '3rem', height: '3rem', color: '#d1d5db', marginBottom: '0.5rem' }} />
                  <p>No records found for this category.</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={closeModal} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleSubmitModal} className="btn-submit">
                <Save className="icon-xs" />
                Submit
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- AI COACH MODAL (feature 15) --- */}
      {coachFor && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div>
                <h3>AI Coach — {coachFor.capId}</h3>
                <p className="modal-subtext">{coachFor.auditTitle} · {coachFor.severity}</p>
              </div>
              <button onClick={() => setCoachFor(null)} className="btn-close"><X className="icon-sm" /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <p style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: 0 }}>
                Work through the 5 Whys, then edit the drafts below — saving fills the action's root-cause and corrective-plan fields.
              </p>
              <ol style={{ paddingLeft: 18, fontSize: '0.8rem', color: '#374151', margin: '0 0 12px' }}>
                {coachWhys.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
              </ol>
              {coachSuggestion && (
                <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Suggested playbook: <strong>{coachSuggestion.title}</strong> (due within {coachSuggestion.dueIn})</p>
              )}
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Root cause (editable)</label>
              <textarea
                value={coachRoot}
                onChange={(e) => setCoachRoot(e.target.value)}
                rows={7}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.8rem', fontFamily: 'inherit', resize: 'vertical' }}
              />
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, margin: '10px 0 4px' }}>Corrective plan (editable)</label>
              <textarea
                value={coachPlan}
                onChange={(e) => setCoachPlan(e.target.value)}
                rows={6}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.8rem', fontFamily: 'inherit', resize: 'vertical' }}
              />
              {isClaudeConfigured() && coachSuggestion && (
                <button className="ai-action-btn" onClick={refinePlanWithClaude} disabled={coachRefining}>
                  {coachRefining ? 'Refining with Claude…' : 'Refine plan with Claude'}
                </button>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setCoachFor(null)} className="btn-cancel">Cancel</button>
              <button onClick={applyCoach} className="btn-submit"><Save className="icon-xs" /> Save to action</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AuditActions;