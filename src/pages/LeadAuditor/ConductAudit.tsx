import React, { useState, useRef } from 'react';
import { 
  ClipboardList, 
  Calendar, 
  User, 
  Play, 
  FileCheck, 
  CheckSquare, 
  Upload, 
  CheckCircle,
  Search,
  FileText,
  Edit2, // Import Edit icon
  Plus,  // Import Plus icon
  Check, // Import Check icon for saving edit
  X      // Import X icon for canceling edit
} from 'lucide-react';
import { Sparkles } from 'lucide-react';
import '../../styles/LeadAuditor/ConductAudit.css';

// --- Interfaces ---
interface Audit {
  id: string;
  title: string;
  type: string;
  department: string;
  assignedAuditor: string;
  startDate: string;
  endDate: string;
  status: 'planned' | 'in-progress' | 'completed';
}

interface ChecklistItem {
  id: string;
  text: string;
  category: string;
  isRequired: boolean;
}

interface CheckpointData {
  checklistItemId: string;
  auditType: 'Minor NC' | 'Major NC' | 'OFI' | 'Observation' | 'Compliant' | '';
  observationNotes: string;
  evidenceFiles: string[];
  completed: boolean;
}

// --- Mock Data ---
const mockAudits: Audit[] = [
  { id: 'AUD-101', title: 'ISO 9001 Surveillance', type: 'QMS', department: 'Manufacturing', assignedAuditor: 'John Doe', startDate: '2025-10-20', endDate: '2025-10-22', status: 'in-progress' },
  { id: 'AUD-102', title: 'Internal Safety Review', type: 'OHSMS', department: 'Warehouse', assignedAuditor: 'Jane Smith', startDate: '2025-10-25', endDate: '2025-10-26', status: 'planned' },
  { id: 'AUD-103', title: 'Supplier Compliance', type: 'QMS', department: 'Procurement', assignedAuditor: 'Mike Ross', startDate: '2025-11-01', endDate: '2025-11-03', status: 'planned' },
];

// Load audit checklists from system data
const loadSystemChecklists = (): ChecklistItem[] => {
  try {
    const raw = localStorage.getItem('cms_audit_checklists');
    if (!raw) return [];
    const checklists = JSON.parse(raw);
    if (!Array.isArray(checklists) || checklists.length === 0) return [];
    
    // Use the first active checklist or the first one available
    const activeChecklist = checklists.find((c: any) => c.status === 'Active') || checklists[0];
    if (!activeChecklist || !activeChecklist.checklistItems) return [];
    
    // Convert system checklist items to component format
    return activeChecklist.checklistItems.map((item: any) => ({
      id: item.id,
      text: item.text,
      category: 'General',
      isRequired: true,
    }));
  } catch {
    return [];
  }
};

const standardChecklist: ChecklistItem[] = loadSystemChecklists() || [
  { id: 'CL-01', text: 'Is the quality policy available and understood by staff?', category: 'Leadership', isRequired: true },
  { id: 'CL-02', text: 'Are quality objectives established and measured?', category: 'Planning', isRequired: true },
  { id: 'CL-03', text: 'Is documented information controlled and updated?', category: 'Support', isRequired: true },
  { id: 'CL-04', text: 'Are calibrated monitoring resources verified?', category: 'Operation', isRequired: true },
  { id: 'CL-05', text: 'Is non-conforming output controlled effectively?', category: 'Operation', isRequired: false },
  { id: 'CL-06', text: 'Are internal audits conducted at planned intervals?', category: 'Performance', isRequired: true },
];

const ConductAudit: React.FC = () => {
  const [conductingAuditId, setConductingAuditId] = useState<string | null>(null);
  
  // State for dynamic checklist items
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checkpoints, setCheckpoints] = useState<CheckpointData[]>([]);
  
  // State for editing titles
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');

  // const [, setIsSubmitting] = useState(false); // unused after truncation repair
  const [, setShowCASuggest] = useState(false);
  const [, setCaFinding] = useState<{description: string; severity?: 'Major'|'Minor'|'Observation'|'OFI'; standard?: string; clause?: string; category?: string;}>({description: ''});
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<{ [key: string]: HTMLInputElement }>({});

  // Derived state
  const conductingAudit = conductingAuditId ? mockAudits.find(a => a.id === conductingAuditId) : null;
  
  // Handlers
  const handleStartAudit = (auditId: string) => {
    setConductingAuditId(auditId);
    
    // Initialize checklist items from standard (deep copy to allow editing)
    const initialItems = [...standardChecklist];
    setChecklistItems(initialItems);

    // Initialize checkpoints
    const initialCheckpoints = initialItems.map(item => ({
      checklistItemId: item.id,
      auditType: '' as const,
      observationNotes: '',
      evidenceFiles: [],
      completed: false
    }));
    setCheckpoints(initialCheckpoints);
  };

  const updateCheckpoint = (itemId: string, field: keyof CheckpointData, value: any) => {
    setCheckpoints(prev => prev.map(cp => 
      cp.checklistItemId === itemId ? { ...cp, [field]: value } : cp
    ));
  };

  // --- NEW: Add New Checklist Item ---
  const handleAddChecklistItem = () => {
    const newId = `CL-NEW-${Date.now()}`;
    const newItem: ChecklistItem = {
      id: newId,
      text: 'New Checklist Item',
      category: 'General',
      isRequired: false // Default to not required
    };

    // Add to items list
    setChecklistItems(prev => [...prev, newItem]);

    // Add corresponding checkpoint
    setCheckpoints(prev => [...prev, {
      checklistItemId: newId,
      auditType: '' as const,
      observationNotes: '',
      evidenceFiles: [],
      completed: false
    }]);

    // Automatically start editing the new item
    setEditingItemId(newId);
    setTempTitle('New Checklist Item');
  };

  // --- NEW: Edit Title Handlers ---
  const startEditing = (item: ChecklistItem) => {
    setEditingItemId(item.id);
    setTempTitle(item.text);
  };

  const saveTitle = (id: string) => {
    setChecklistItems(prev => prev.map(item => 
      item.id === id ? { ...item, text: tempTitle } : item
    ));
    setEditingItemId(null);
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setTempTitle('');
  };

  const handleFileUpload = (itemId: string) => {
    if (!fileInputRef.current[itemId]) {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = '*/*';
      input.onchange = (e: any) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          const fileNames = Array.from(files).map((file: any) => file.name);
          setCheckpoints(prev => prev.map(cp => 
            cp.checklistItemId === itemId 
              ? { ...cp, evidenceFiles: [...cp.evidenceFiles, ...fileNames] } 
              : cp
          ));
        }
      };
      fileInputRef.current[itemId] = input;
    }
    fileInputRef.current[itemId].click();
  };


  const getStatusClass = (status: string) => {
    switch(status) {
      case 'planned': return 'status-planned';
      case 'in-progress': return 'status-in-progress';
      case 'completed': return 'status-completed';
      default: return '';
    }
  };

  const mapAuditTypeToSeverity = (t: CheckpointData['auditType']): 'Major'|'Minor'|'Observation'|'OFI'|undefined => {
    if (t === 'Major NC') return 'Major';
    if (t === 'Minor NC') return 'Minor';
    if (t === 'Observation') return 'Observation';
    if (t === 'OFI') return 'OFI';
    return undefined;
  };

  const openSuggestForItem = (itemId: string) => {
    const item = checklistItems.find(i => i.id === itemId);
    const cp = checkpoints.find(c => c.checklistItemId === itemId);
    if (!item) return;
    setCaFinding({
      description: [cp?.observationNotes, item.text].filter(Boolean).join(' — ') || item.text,
      severity: mapAuditTypeToSeverity(cp?.auditType ?? ''),
      standard: conductingAudit?.type,
      category: item.category,
    });
    setShowCASuggest(true);
  };

  const getAuditTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'Minor NC': return 'badge-minor';
      case 'Major NC': return 'badge-major';
      case 'OFI': return 'badge-ofi';
      case 'Observation': return 'badge-obs';
      case 'Compliant': return 'badge-compliant';
      default: return 'badge-default';
    }
  };

  return (
    <div className="conduct-audit-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon">
            <ClipboardList className="icon-white" size={24} />
          </div>
          <div>
            <h1>Conduct Audit</h1>
            <p>Execute scheduled audits using checklist-based methodology</p>
          </div>
        </div>
      </div>

      {!conductingAuditId ? (
        /* Audit List View */
        <div className="card">
          <div className="card-header-row">
            <div>
              <h3>Scheduled Audits</h3>
              <p className="card-subtitle">Select an audit to begin conducting</p>
            </div>
            <div className="search-wrapper">
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Search audits..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="table-responsive">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Audit Title</th>
                  <th>Type</th>
                  <th>Department</th>
                  <th>Auditor</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {mockAudits.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase())).map(audit => (
                  <tr key={audit.id}>
                    <td>
                      <div className="audit-name">
                        <FileText size={16} className="text-gray" />
                        {audit.title}
                      </div>
                    </td>
                    <td><span className="badge-outline">{audit.type}</span></td>
                    <td>{audit.department}</td>
                    <td>{audit.assignedAuditor}</td>
                    <td>{audit.startDate} - {audit.endDate}</td>
                    <td><span className={`status-badge ${getStatusClass(audit.status)}`}>{audit.status}</span></td>
                    <td>
                      <button className="btn-primary-sm" onClick={() => handleStartAudit(audit.id)}>
                        <Play size={14} /> Conduct
                      </button>
                    </td>
                  </tr>
                ))}
                {mockAudits.length === 0 && (
                  <tr><td colSpan={7} className="text-center">No audits found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Conducting Interface */
        <div className="audit-workspace">
          
          {/* Audit Context Header */}
          <div className="card context-card">
            <div className="context-header">
              <div className="context-info">
                <FileCheck size={24} className="text-purple" />
                <div>
                  <h2>{conductingAudit?.title}</h2>
                  <div className="meta-row">
                    <span>{conductingAudit?.department}</span>
                    <span className="bullet">•</span>
                    <span>{conductingAudit?.type} Audit</span>
                  </div>
                </div>
              </div>
              <span className="status-badge status-in-progress">In Progress</span>
            </div>
            <div className="context-details">
              <div className="detail-item"><Calendar size={14} /> {conductingAudit?.startDate} to {conductingAudit?.endDate}</div>
              <div className="detail-item"><User size={14} /> {conductingAudit?.assignedAuditor}</div>
            </div>
          </div>

          {/* Checklist Area */}
          <div className="checklist-container">
            <div className="checklist-header">
              <h3><CheckSquare size={18} /> Standard Checklist</h3>
              <div className="progress-indicator">
                {checkpoints.filter(cp => cp.completed).length}/{checklistItems.length} Completed
              </div>
            </div>

            {checklistItems.map((item, index) => {
              const cp = checkpoints.find(c => c.checklistItemId === item.id);
              if (!cp) return null;

              return (
                <div key={item.id} className={`checklist-card ${cp.completed ? 'completed' : ''}`}>
                  <div className="checklist-item-header">
                    <div className="item-title-row">
                      <input 
                        type="checkbox" 
                        checked={cp.completed} 
                        onChange={(e) => updateCheckpoint(item.id, 'completed', e.target.checked)}
                        className="custom-checkbox"
                      />
                      <div className="item-text-group" style={{ width: '100%' }}>
                        <div className="item-top-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          
                          {/* EDITABLE TITLE LOGIC */}
                          {editingItemId === item.id ? (
                            <div style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center' }}>
                              <input 
                                type="text" 
                                value={tempTitle}
                                onChange={(e) => setTempTitle(e.target.value)}
                                style={{ 
                                  padding: '4px 8px', 
                                  border: '1px solid #cbd5e1', 
                                  borderRadius: '4px',
                                  fontSize: '1rem',
                                  fontWeight: 600,
                                  flex: 1
                                }}
                                autoFocus
                              />
                              <button onClick={() => saveTitle(item.id)} className="btn-icon-sm text-green"><Check size={16} /></button>
                              <button onClick={cancelEditing} className="btn-icon-sm text-red"><X size={16} /></button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <h4>{index + 1}. {item.text}</h4>
                              <button 
                                onClick={() => startEditing(item)} 
                                className="btn-icon-sm text-gray hover-blue"
                                title="Edit Checklist Title"
                              >
                                <Edit2 size={14} />
                              </button>
                            </div>
                          )}

                          {item.isRequired && <span className="tag-required">Required</span>}
                        </div>
                        <span className="tag-category">{item.category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="checklist-form">
                    <div className="form-grid">
                      {/* Classification */}
                      <div className="form-group">
                        <label>Classification</label>
                        <select 
                          value={cp.auditType} 
                          onChange={(e) => updateCheckpoint(item.id, 'auditType', e.target.value)}
                          className="custom-select"
                        >
                          <option value="">Select Result...</option>
                          <option value="Compliant">✓ Compliant</option>
                          <option value="Observation">ℹ Observation</option>
                          <option value="OFI">💡 OFI</option>
                          <option value="Minor NC">⚠ Minor NC</option>
                          <option value="Major NC">⛔ Major NC</option>
                        </select>
                      </div>

                      {/* Evidence */}
                      <div className="form-group">
                        <label>Evidence</label>
                        <button className="btn-upload" onClick={() => handleFileUpload(item.id)}>
                          <Upload size={14} /> Upload ({cp.evidenceFiles.length})
                        </button>
                        {cp.evidenceFiles.length > 0 && (
                          <div className="file-list">
                            {cp.evidenceFiles.map((f, i) => (
                              <div key={i} className="file-chip"><FileCheck size={10}/> {f}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="form-group full-width">
                      <label>Observation Notes</label>
                      <textarea 
                        placeholder="Document observations..." 
                        value={cp.observationNotes}
                        onChange={(e) => updateCheckpoint(item.id, 'observationNotes', e.target.value)}
                        rows={2}
                      />
                    </div>

                    {/* Status Footer */}
                    {cp.auditType && (
                      <div className="item-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span className={`badge-pill ${getAuditTypeBadgeClass(cp.auditType)}`}>
                            {cp.auditType}
                          </span>
                          {cp.completed && (
                            <span className="badge-pill badge-success">
                              <CheckCircle size={12} /> Completed
                            </span>
                          )}
                        </div>
                        {(cp.auditType === 'Minor NC' || cp.auditType === 'Major NC' || cp.auditType === 'OFI' || cp.auditType === 'Observation') && (
                          <button
                            type="button"
                            onClick={() => openSuggestForItem(item.id)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                              background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', cursor: 'pointer'
                            }}
                          >
                            <Sparkles size={12} /> Suggest actions
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* NEW ADD CHECKLIST BUTTON */}
            <button 
              className="btn-add-checklist"
              onClick={handleAddChecklistItem}
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '10px',
                marginBottom: '20px',
                border: '2px dashed #cbd5e1',
                borderRadius: '8px',
                background: '#f8fafc',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
            >
              <Plus size={18} /> Add New Checklist Item
            </button>

          </div>

          {/* Action Bar */}
          <div className="action-bar">
            <div className="progress-bar-wrapper">
              <div className="progress-text">Audit Progress</div>
              <div className="progress-track">
                <div 
                  className="progress-fill"  ></div>
              </div>
            </div>
            <div className="action-buttons">
              <button className="btn-secondary" onClick={() => setConductingAuditId(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => setConductingAuditId(null)}>Save &amp; Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConductAudit;
