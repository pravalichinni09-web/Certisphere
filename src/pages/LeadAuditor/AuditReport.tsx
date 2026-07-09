import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Play, 
  Send, 
  Calendar, 
  User, 
  Eye, 
  Download,
  X,
  TrendingUp,
  Search,
  List,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import '../../styles/LeadAuditor/AuditReport.css';
import {
  AuditReportsMap,
  deriveReportStatus,
  loadAuditReports,
  subscribeAuditReports,
  updateAuditReport,
} from '../../services/auditReports';
import AIPanel from '../../components/AIPanel';
import { onCmsChange } from '../../ai/liveData';
import { reviewReportQuality } from '../../ai/leadAuditorInsights';

// --- Interfaces ---
interface Audit {
  id: string;
  title: string;
  type: string;
  department: string;
  assignedAuditor: string;
  startDate: string;
  endDate: string;
  status: 'in-progress' | 'completed' | 'review';
}

interface Finding {
  auditId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

interface ReportSection {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  category: string;
}

interface SectionContent {
  sectionId: string;
  content: string;
  completed: boolean;
}

// --- Shared storage (cms_audit_reports_v1) mapping helpers ---
const safeJSON = <T,>(k: string, fb: T): T => {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : fb; } catch { return fb; }
};

const mapSeverity = (sev: string): Finding['severity'] =>
  sev === 'Major NC' ? 'critical' : sev === 'Minor NC' ? 'high' : sev === 'Observation' ? 'medium' : 'low';

/** Findings recorded by auditors in `cms_audit_findings_v1`, keyed by clientId. */
const loadSharedFindings = (): Finding[] => {
  const map = safeJSON<Record<string, any[]>>('cms_audit_findings_v1', {});
  return Object.entries(map).flatMap(([clientId, list]) =>
    (list || []).map((f: any) => ({
      auditId: clientId,
      title: f.clause ? `Clause ${f.clause}` : String(f.severity || 'Finding'),
      severity: mapSeverity(String(f.severity || '')),
      description: String(f.description || ''),
      recommendation: f.evidence
        ? `Evidence: ${f.evidence}. Address and provide corrective action.`
        : 'Address and provide corrective action.',
    }))
  );
};

const reportSections: ReportSection[] = [
  { id: 'exec-summary', title: 'Executive Summary', description: 'High-level overview of the audit and key findings', isRequired: true, category: 'Overview' },
  { id: 'audit-scope', title: 'Audit Scope & Objectives', description: 'Define the boundaries and goals of the audit', isRequired: true, category: 'Overview' },
  { id: 'methodology', title: 'Audit Methodology', description: 'Approach and techniques used during the audit', isRequired: true, category: 'Overview' },
  { id: 'key-findings', title: 'Key Findings & Observations', description: 'Summary of significant discoveries', isRequired: true, category: 'Findings' },
  { id: 'risk-assessment', title: 'Risk Assessment', description: 'Evaluation of identified risks', isRequired: true, category: 'Findings' },
  { id: 'recommendations', title: 'Recommendations', description: 'Actionable recommendations for improvement', isRequired: true, category: 'Recommendations' },
  { id: 'conclusion', title: 'Conclusion', description: 'Final summary and overall assessment', isRequired: true, category: 'Conclusion' },
];

const AuditReport: React.FC = () => {
  // Shared audit reports (single source of truth: cms_audit_reports_v1)
  const [sharedReports, setSharedReports] = useState<AuditReportsMap>(() => loadAuditReports());
  useEffect(() => subscribeAuditReports(() => setSharedReports(loadAuditReports())), []);

  const audits: Audit[] = useMemo(() => Object.entries(sharedReports).map(([key, r]) => {
    const status = deriveReportStatus(r);
    return {
      id: key,
      title: `${r.clientName || `Report ${key}`} — ${r.standard || 'Audit'} Report`,
      type: r.source === 'Auditee' ? 'Auditee Submission' : (r.standard || 'Certification'),
      department: r.scope || r.standard || '—',
      assignedAuditor: r.draftedBy || 'Auditor',
      startDate: (r.draftedAt || '').split('T')[0],
      endDate: (r.submittedAt || r.draftedAt || '').split('T')[0],
      status: status === 'Approved' ? 'completed' as const
        : (status === 'Submitted' || status === 'Reviewed') ? 'review' as const
        : 'in-progress' as const,
    };
  }), [sharedReports]);

  const allFindings: Finding[] = useMemo(() => loadSharedFindings(), [sharedReports]);

  // --- AI Report Quality Reviewer (feature 9) ---
  const [aiTick, setAiTick] = useState(0);
  useEffect(() => onCmsChange(() => setAiTick((t) => t + 1)), []);
  const qcResults = useMemo(() => {
    const rawFindings = safeJSON<Record<string, any[]>>('cms_audit_findings_v1', {});
    return Object.entries(sharedReports)
      .filter(([, r]) => {
        const s = deriveReportStatus(r);
        return s === 'Submitted' || s === 'Reviewed';
      })
      .map(([key, r]) => reviewReportQuality(
        key,
        `${r.clientName || `Report ${key}`} — ${r.standard || 'Audit'}`,
        r,
        rawFindings[key] || []
      ));
  }, [sharedReports, aiTick]);

  // State
  const [creatingReportAuditId, setCreatingReportAuditId] = useState<string | null>(null);
  const [sectionContents, setSectionContents] = useState<SectionContent[]>([]);
  const [reportTitle, setReportTitle] = useState('');
  const [reportType, setReportType] = useState<'draft' | 'final'>('draft');
  const [viewingSectionId, setViewingSectionId] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Metadata State
  const [auditeeName, setAuditeeName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [clauseName, setClauseName] = useState('');
  const [systemReference, setSystemReference] = useState('');

  // Findings Modal State
  const [showFindingsModal, setShowFindingsModal] = useState(false);
  const [currentFindingsList, setCurrentFindingsList] = useState<Finding[]>([]);
  const [selectedFindingIndices, setSelectedFindingIndices] = useState<number[]>([]);
  const [findingsAuditContext, setFindingsAuditContext] = useState<Audit | null>(null);

  // Derived Data
  const activeAudit = creatingReportAuditId ? audits.find(a => a.id === creatingReportAuditId) : null;
  const activeFindings = activeAudit ? allFindings.filter(f => f.auditId === activeAudit.id) : [];

  // Handlers
  const handleStartReport = (auditId: string) => {
    const audit = audits.find(a => a.id === auditId);
    if (!audit) return;

    const shared = sharedReports[auditId];
    setCreatingReportAuditId(auditId);
    setReportTitle(`${audit.title} - Final Report`);
    setSectionContents(reportSections.map(s => {
      const content =
        s.id === 'exec-summary' ? (shared?.summary || '') :
        s.id === 'audit-scope' ? (shared?.scope || '') :
        s.id === 'conclusion' ? (shared?.conclusion || '') :
        s.id === 'recommendations' ? (shared?.recommendation || '') : '';
      return { sectionId: s.id, content, completed: Boolean(content) };
    }));

    // Reset form fields
    setAuditeeName(shared?.clientName || '');
    setCategoryName('');
    setClauseName('');
    setSystemReference('');
  };

  const updateSection = (sectionId: string, content: string) => {
    setSectionContents(prev => prev.map(s => s.sectionId === sectionId ? { ...s, content } : s));
  };

  const toggleSectionComplete = (sectionId: string) => {
    setSectionContents(prev => prev.map(s => s.sectionId === sectionId ? { ...s, completed: !s.completed } : s));
  };

  const autoGenerateContent = (sectionId: string) => {
    if (!activeAudit) return;
    
    let text = '';
    const section = reportSections.find(s => s.id === sectionId);
    
    if (sectionId === 'exec-summary') {
      text = `This audit for ${activeAudit.department} was conducted from ${activeAudit.startDate} to ${activeAudit.endDate}. We identified ${activeFindings.length} findings. The overall control environment is ${activeFindings.some(f => f.severity === 'critical') ? 'needs improvement' : 'effective'}.`;
    } else if (sectionId === 'key-findings') {
      text = activeFindings.length > 0 
        ? activeFindings.map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}: ${f.description}`).join('\n\n')
        : 'No significant findings to report.';
    } else if (sectionId === 'recommendations') {
      text = activeFindings.length > 0
        ? activeFindings.map((f, i) => `${i + 1}. ${f.recommendation}`).join('\n\n')
        : 'Maintain current standards.';
    } else {
      text = `[AI Generated Draft for ${section?.title}]\n\nBased on standard ISO protocols, this section addresses ${section?.description.toLowerCase()}...`;
    }

    updateSection(sectionId, text);
  };

  const collectReviewedContent = () => {
    const pick = (id: string) => sectionContents.find(s => s.sectionId === id)?.content?.trim();
    const summary = pick('exec-summary');
    const scope = pick('audit-scope');
    const conclusion = pick('conclusion');
    return {
      ...(summary ? { summary } : {}),
      ...(scope ? { scope } : {}),
      ...(conclusion ? { conclusion } : {}),
    };
  };

  const handleSubmitToClient = () => {
    if (creatingReportAuditId) {
      const now = new Date().toISOString();
      updateAuditReport(creatingReportAuditId, {
        ...collectReviewedContent(),
        status: 'Approved',
        reviewedAt: now,
        reviewedBy: 'Lead Auditor',
        approvedAt: now,
        reviewComment: `Approved by Lead Auditor (${reportType} version): ${reportTitle}`,
      });
    }
    setShowSubmitModal(true);
    setTimeout(() => {
      setShowSubmitModal(false);
      setCreatingReportAuditId(null);
      alert(`Report for ${activeAudit?.title} has been successfully submitted to the Client.`);
    }, 2000);
  };

  const handleSaveReview = () => {
    if (creatingReportAuditId) {
      const shared = sharedReports[creatingReportAuditId];
      updateAuditReport(creatingReportAuditId, {
        ...collectReviewedContent(),
        ...(shared && deriveReportStatus(shared) === 'Submitted'
          ? { status: 'Reviewed' as const, reviewedAt: new Date().toISOString(), reviewedBy: 'Lead Auditor' }
          : {}),
      });
    }
    setCreatingReportAuditId(null);
  };

  // --- Findings Modal Handlers ---
  const handleOpenFindings = (e: React.MouseEvent, audit: Audit) => {
    e.stopPropagation(); // Prevent opening report editor
    const findings = allFindings.filter(f => f.auditId === audit.id);
    
    if (findings.length === 0) return;

    setCurrentFindingsList(findings);
    setFindingsAuditContext(audit);
    setSelectedFindingIndices([]); // Reset selections
    setShowFindingsModal(true);
  };

  const handleToggleFinding = (index: number) => {
    setSelectedFindingIndices(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleSubmitSelectedFindings = () => {
    if (selectedFindingIndices.length === 0) {
      alert("Please select at least one finding to submit.");
      return;
    }
    const submittedCount = selectedFindingIndices.length;
    alert(`Successfully submitted ${submittedCount} selected findings for ${findingsAuditContext?.title}.`);
    setShowFindingsModal(false);
  };

  // Render Helpers
  const getStatusClass = (status: string) => {
    switch(status) {
      case 'in-progress': return 'status-in-progress';
      case 'completed': return 'status-completed';
      case 'review': return 'status-review';
      default: return '';
    }
  };

  return (
    <div className="audit-report-container">
      {/* Lead Auditor → Report flow */}
      <div className="cs-la-report-flow" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '1px solid #fbbf24', borderLeft: '4px solid #f59e0b', padding: '12px 16px', borderRadius: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          <span>📄 Report Flow</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            { n: 1, t: 'Draft',   d: 'Compile from on-site findings' },
            { n: 2, t: 'Open',    d: 'Click "Open Report" to preview' },
            { n: 3, t: 'Review',  d: 'Confirm sections + recommendation' },
            { n: 4, t: 'Submit',  d: 'Send for management approval' },
          ].map(s => (
            <div key={s.n} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #fbbf24', padding: '6px 12px', borderRadius: 8, fontSize: 12, color: '#0f172a' }}>
              <span style={{ background: '#f59e0b', color: '#fff', width: 18, height: 18, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>{s.n}</span>
              <span style={{ fontWeight: 700 }}>{s.t}</span>
              <span style={{ color: '#64748b' }}>· {s.d}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Header */}
      <div className="report-page-header">
        <div>
          <h1>Audit Report Management</h1>
          <p>Create, review, and submit final audit reports to clients.</p>
        </div>
        {!creatingReportAuditId && (
          <div className="search-box">
             <Search size={18} />
             <input 
               type="text" 
               placeholder="Search audits..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
        )}
      </div>

      {/* AI Report Quality Reviewer */}
      <AIPanel
        title="Report Quality Reviewer"
        subtitle="QC score and issue list for reports awaiting review"
        onRefresh={() => setAiTick((t) => t + 1)}
      >
        {qcResults.length === 0 ? (
          <p className="ai-panel-note">No reports awaiting review right now — QC runs on submitted reports.</p>
        ) : (
          <ul className="ai-insight-list">
            {qcResults.map((r) => (
              <li key={r.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 12.5 }}>{r.title}</strong>
                  <span className={'ai-chip ' + (r.score >= 80 ? 'ok' : r.score >= 60 ? 'med' : 'high')}>QC {r.score}/100</span>
                  <span className="ai-chip info">{r.issues.length} issue{r.issues.length === 1 ? '' : 's'}</span>
                </div>
                {r.issues.length === 0 ? (
                  <div style={{ fontSize: 12, marginTop: 4 }}>No quality issues detected — ready for review.</div>
                ) : (
                  <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12 }}>
                    {r.issues.slice(0, 6).map((iss, i) => <li key={i}>{iss.text}</li>)}
                    {r.issues.length > 6 && <li>…and {r.issues.length - 6} more.</li>}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="ai-panel-note">Checks: missing/short sections, findings without evidence, vague wording, severity-language mismatches.</p>
      </AIPanel>

      {!creatingReportAuditId ? (
        /* Audit Selection List */
        <div className="report-card">
          <div className="card-header">
            <h3>Audits Pending Report</h3>
          </div>
          <div className="table-responsive">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Audit Title</th>
                  <th>Department</th>
                  <th>Auditor</th>
                  <th>Findings</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {audits.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase())).map(audit => {
                  const findingCount = allFindings.filter(f => f.auditId === audit.id).length;
                  return (
                    <tr key={audit.id}>
                      <td>
                        <div className="audit-title-cell">
                          <FileText size={16} />
                          <span>{audit.title}</span>
                        </div>
                      </td>
                      <td>{audit.department}</td>
                      <td>{audit.assignedAuditor}</td>
                      
                      {/* Findings Column - Clickable */}
                      <td>
                        <div 
                          className={`findings-badge ${findingCount > 0 ? 'interactive' : 'disabled'}`}
                          onClick={(e) => handleOpenFindings(e, audit)}
                          title={findingCount > 0 ? "Click to view and submit findings" : "No findings"}
                          style={{ 
                            cursor: findingCount > 0 ? 'pointer' : 'default',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            backgroundColor: findingCount > 0 ? '#fee2e2' : '#dcfce7',
                            color: findingCount > 0 ? '#dc2626' : '#16a34a',
                            fontWeight: 600,
                            fontSize: '0.85rem'
                          }}
                        >
                          {findingCount > 0 ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                          {findingCount}
                        </div>
                      </td>

                      <td><span className={`status-badge ${getStatusClass(audit.status)}`}>{audit.status}</span></td>
                      <td>
                        <button onClick={() => { alert("Opening report for: " + (audit.title || "audit")); handleStartReport(audit.id); }} style={{ marginRight: 6, background: "#fff", color: "#f59e0b", border: "1px solid #f59e0b", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>📂 Open Report</button>
                        <button className="btn-primary-sm" onClick={() => handleStartReport(audit.id)}>
                          <Play size={14} /> Create Report
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Report Editor Interface */
        <div className="report-editor-layout">
          
          {/* Top Control Bar */}
          <div className="report-controls-card">
            <div className="control-group">
               <button className="btn-back" onClick={() => setCreatingReportAuditId(null)}>← Back</button>
               <div className="input-group">
                 <label>Report Title</label>
                 <input 
                   type="text" 
                   value={reportTitle} 
                   onChange={(e) => setReportTitle(e.target.value)} 
                   className="title-input"
                 />
               </div>
            </div>
            <div className="control-group right">
              <select value={reportType} onChange={(e) => setReportType(e.target.value as any)} className="type-select">
                <option value="draft">Draft Version</option>
                <option value="final">Final Version</option>
              </select>
              <div className="audit-meta">
                 <span><Calendar size={14}/> {activeAudit?.startDate}</span>
                 <span><User size={14}/> {activeAudit?.assignedAuditor}</span>
              </div>
            </div>
          </div>

          {/* Report Metadata Fields */}
          <div className="report-metadata-card">
            <div className="metadata-row">
              <div className="metadata-field">
                <label>Audit Date</label>
                <input 
                  type="text" 
                  value={activeAudit?.startDate || ''} 
                  readOnly 
                  className="metadata-input"
                />
              </div>
              <div className="metadata-field">
                <label>Department</label>
                <input 
                  type="text" 
                  value={activeAudit?.department || ''} 
                  readOnly 
                  className="metadata-input"
                />
              </div>
              <div className="metadata-field">
                <label>Auditee Name</label>
                <input 
                  type="text" 
                  value={auditeeName} 
                  onChange={(e) => setAuditeeName(e.target.value)} 
                  placeholder="Enter auditee name"
                  className="metadata-input"
                />
              </div>
            </div>
            <div className="metadata-row">
              <div className="metadata-field">
                <label>Category Name</label>
                <input 
                  type="text" 
                  value={categoryName} 
                  onChange={(e) => setCategoryName(e.target.value)} 
                  placeholder="Enter category name"
                  className="metadata-input"
                />
              </div>
              <div className="metadata-field">
                <label>Clause Name</label>
                <input 
                  type="text" 
                  value={clauseName} 
                  onChange={(e) => setClauseName(e.target.value)} 
                  placeholder="Enter clause name"
                  className="metadata-input"
                />
              </div>
              <div className="metadata-field">
                <label>System Reference</label>
                <input 
                  type="text" 
                  value={systemReference} 
                  onChange={(e) => setSystemReference(e.target.value)} 
                  placeholder="e.g., HR, Finance, IT"
                  className="metadata-input"
                />
              </div>
            </div>
          </div>

          <div className="editor-grid">
            {/* Sections List */}
            <div className="sections-column">
              {reportSections.map((section, index) => {
                 const data = sectionContents.find(s => s.sectionId === section.id);
                 return (
                   <div key={section.id} className={`section-card ${data?.completed ? 'completed' : ''}`}>
                     <div className="section-header">
                       <div className="section-title-row">
                         <input 
                           type="checkbox" 
                           checked={data?.completed} 
                           onChange={() => toggleSectionComplete(section.id)}
                         />
                         <h4>{index + 1}. {section.title}</h4>
                         {section.isRequired && <span className="required-tag">*</span>}
                       </div>
                       <button className="btn-ai" onClick={() => autoGenerateContent(section.id)}>
                         <TrendingUp size={14} /> AI Draft
                       </button>
                     </div>
                     <p className="section-desc">{section.description}</p>
                     
                     {/* Metadata Fields in Section */}
                     <div className="section-metadata">
                       <div className="metadata-row-compact">
                         <div className="metadata-field-compact">
                           <label>Audit Date</label>
                           <input type="text" value={activeAudit?.startDate || ''} readOnly className="metadata-input-compact"/>
                         </div>
                         <div className="metadata-field-compact">
                           <label>Department</label>
                           <input type="text" value={activeAudit?.department || ''} readOnly className="metadata-input-compact"/>
                         </div>
                         <div className="metadata-field-compact">
                           <label>Auditee Name</label>
                           <input type="text" value={auditeeName} onChange={(e) => setAuditeeName(e.target.value)} placeholder="Enter auditee name" className="metadata-input-compact"/>
                         </div>
                         <div className="metadata-field-compact">
                           <label>Category Name</label>
                           <input type="text" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Enter category name" className="metadata-input-compact"/>
                         </div>
                         <div className="metadata-field-compact">
                           <label>Clause Name</label>
                           <input type="text" value={clauseName} onChange={(e) => setClauseName(e.target.value)} placeholder="Enter clause name" className="metadata-input-compact"/>
                         </div>
                         <div className="metadata-field-compact">
                           <label>System Reference</label>
                           <input type="text" value={systemReference} onChange={(e) => setSystemReference(e.target.value)} placeholder="e.g., HR, Finance, IT" className="metadata-input-compact"/>
                         </div>
                       </div>
                     </div>
                     
                     <textarea 
                       className="section-editor" 
                       placeholder={`Enter ${section.title} content...`}
                       value={data?.content || ''}
                       onChange={(e) => updateSection(section.id, e.target.value)}
                     />
                     
                     <div className="section-footer">
                       <span className="char-count">{data?.content.length || 0} chars</span>
                       <div className="section-actions">
                         <button className="btn-icon" onClick={() => setViewingSectionId(section.id)} title="Preview">
                           <Eye size={16} />
                         </button>
                       </div>
                     </div>
                   </div>
                 );
              })}
            </div>

            {/* Sidebar Summary */}
            <div className="summary-column">
              <div className="summary-card">
                <h3>Progress</h3>
                <div className="progress-stats">
                   <div className="stat">
                     <span className="label">Completed</span>
                     <span className="value">{sectionContents.filter(s => s.completed).length}/{reportSections.length}</span>
                   </div>
                   <div className="stat">
                     <span className="label">Required</span>
                     <span className="value">{reportSections.filter(s => s.isRequired && sectionContents.find(sc => sc.sectionId === s.id)?.content).length}/{reportSections.filter(s => s.isRequired).length}</span>
                   </div>
                </div>
                <hr />
                <div className="action-buttons-stack">
                   <button className="btn-submit" onClick={handleSubmitToClient}>
                     <Send size={16} /> Submit to Client
                   </button>
                   <button className="btn-outline" onClick={handleSaveReview}>
                     Save as Draft
                   </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {viewingSectionId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Preview: {reportSections.find(s => s.id === viewingSectionId)?.title}</h2>
              <button onClick={() => setViewingSectionId(null)}><X size={20}/></button>
            </div>
            <div className="modal-body">
               <div className="preview-paper">
                 <div className="paper-header">
                   <span>QMICS SOLUTIONS LLP</span>
                   <span>CONFIDENTIAL</span>
                 </div>
                 <hr/>
                 <div className="paper-content">
                   <pre>{sectionContents.find(s => s.sectionId === viewingSectionId)?.content || 'No content generated yet.'}</pre>
                 </div>
               </div>
            </div>
            <div className="modal-footer">
               <button className="btn-primary" onClick={() => alert('Downloading PDF...')}>
                 <Download size={16}/> Download PDF
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Loading Modal */}
      {showSubmitModal && (
        <div className="modal-overlay">
           <div className="loading-card">
              <div className="spinner"></div>
              <h3>Submitting Report to Client...</h3>
              <p>Finalizing document and sending notification.</p>
           </div>
        </div>
      )}

      {/* --- FINDINGS BOX MODAL --- */}
      {showFindingsModal && (
        <div className="modal-overlay" onClick={() => setShowFindingsModal(false)} style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', 
          justifyContent: 'center', alignItems: 'center', zIndex: 2000
        }}>
          <div className="modal-content-box" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            width: '90%', maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <List size={24} className="text-blue" />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Audit Findings</h2>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>{findingsAuditContext?.title} ({findingsAuditContext?.department})</p>
                </div>
              </div>
              <button onClick={() => setShowFindingsModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '10px', width: '50px', textAlign: 'center' }}>Select</th>
                    <th style={{ padding: '10px' }}>Title</th>
                    <th style={{ padding: '10px' }}>Severity</th>
                    <th style={{ padding: '10px' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {currentFindingsList.map((finding, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: selectedFindingIndices.includes(index) ? '#eff6ff' : 'transparent' }}>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedFindingIndices.includes(index)} 
                          onChange={() => handleToggleFinding(index)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{finding.title}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ 
                          padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 500,
                          backgroundColor: finding.severity === 'critical' || finding.severity === 'high' ? '#fee2e2' : '#fef3c7',
                          color: finding.severity === 'critical' || finding.severity === 'high' ? '#991b1b' : '#92400e',
                          textTransform: 'capitalize'
                        }}>
                          {finding.severity}
                        </span>
                      </td>
                      <td style={{ padding: '10px', color: '#64748b' }}>{finding.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '20px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', color: '#64748b' }}>
                {selectedFindingIndices.length} finding(s) selected
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowFindingsModal(false)} style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>Cancel</button>
                <button 
                  onClick={handleSubmitSelectedFindings} 
                  disabled={selectedFindingIndices.length === 0} 
                  style={{ 
                    padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', 
                    background: selectedFindingIndices.length === 0 ? '#94a3b8' : '#2563eb', color: 'white', 
                    display: 'flex', alignItems: 'center', gap: '8px' 
                  }}
                >
                  <Send size={16} /> Submit Selected Findings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditReport;