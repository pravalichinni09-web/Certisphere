import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Edit, 
  X, 
  CheckSquare, 
  Save, 
  FileText,
  Upload,
  Download,
  GripVertical,
  GitBranch,
  Copy
} from 'lucide-react';
import '../../styles/AuditorCoordinator/AuditChecklists.css';

interface ChecklistItem {
  id: string;
  text: string;
  classification: string;
  evidence: string | null;
  notes?: string;
  followUpIf?: {
    whenAnswer: 'Yes' | 'No' | 'N/A';
    followUpText: string;
  };
}

interface Checklist {
  id: number;
  name: string;
  type: string;
  standard: string;
  items: number;
  created: string;
  status: 'Active' | 'Draft' | 'Archived';
  checklistItems: ChecklistItem[];
}

const AuditChecklists: React.FC = () => {
  // Mock Data with expanded fields
  const initialChecklists: Checklist[] = [
    {
      id: 1,
      name: 'ISO 9001:2015 QMS Audit',
      type: 'Internal',
      standard: 'ISO 9001:2015',
      items: 8,
      created: '2025-01-10',
      status: 'Active',
      checklistItems: [
        { id: '1-1', text: 'Is the quality policy available and maintained?', classification: '', evidence: null },
        { id: '1-2', text: 'Are quality objectives established at relevant functions?', classification: '', evidence: null },
        { id: '1-3', text: 'Is documented information required by the QMS controlled?', classification: '', evidence: null },
        { id: '1-4', text: 'Are internal audits conducted at planned intervals?', classification: '', evidence: null },
        { id: '1-5', text: 'Is there evidence of management reviews being conducted?', classification: '', evidence: null },
        { id: '1-6', text: 'Are nonconformities and corrective actions documented?', classification: '', evidence: null },
        { id: '1-7', text: 'Is customer satisfaction monitored and analyzed?', classification: '', evidence: null },
        { id: '1-8', text: 'Are external providers (suppliers) evaluated and monitored?', classification: '', evidence: null }
      ]
    },
    {
      id: 2,
      name: 'ISO 14001 Environmental Review',
      type: 'Surveillance',
      standard: 'ISO 14001:2015',
      items: 6,
      created: '2025-01-12',
      status: 'Active',
      checklistItems: [
        { id: '2-1', text: 'Have environmental aspects and impacts been identified?', classification: '', evidence: null },
        { id: '2-2', text: 'Are compliance obligations (legal requirements) determined?', classification: '', evidence: null },
        { id: '2-3', text: 'Are environmental objectives established?', classification: '', evidence: null },
        { id: '2-4', text: 'Is there a procedure for emergency preparedness?', classification: '', evidence: null },
        { id: '2-5', text: 'Are waste management practices compliant?', classification: '', evidence: null },
        { id: '2-6', text: 'Is monitoring and measuring equipment calibrated?', classification: '', evidence: null }
      ]
    },
    {
      id: 3,
      name: 'Information Security Baseline',
      type: 'Internal',
      standard: 'ISO 27001:2022',
      items: 5,
      created: '2025-01-14',
      status: 'Draft',
      checklistItems: [
        { id: '3-1', text: 'Is there an up-to-date asset inventory?', classification: '', evidence: null },
        { id: '3-2', text: 'Are access control policies defined and enforced?', classification: '', evidence: null },
        { id: '3-3', text: 'Is there a process for reporting information security incidents?', classification: '', evidence: null },
        { id: '3-4', text: 'Are backup copies of information taken?', classification: '', evidence: null },
        { id: '3-5', text: 'Is user access rights reviewed at regular intervals?', classification: '', evidence: null }
      ]
    },
    {
      id: 4,
      name: 'Occupational Health & Safety',
      type: 'Compliance',
      standard: 'ISO 45001:2018',
      items: 7,
      created: '2025-01-15',
      status: 'Active',
      checklistItems: [
        { id: '4-1', text: 'Have hazards been identified and risks assessed?', classification: '', evidence: null },
        { id: '4-2', text: 'Is the OH&S policy communicated to workers?', classification: '', evidence: null },
        { id: '4-3', text: 'Are workers consulted and participating in OH&S matters?', classification: '', evidence: null },
        { id: '4-4', text: 'Are legal and other requirements determined?', classification: '', evidence: null },
        { id: '4-5', text: 'Are emergency response plans tested periodically?', classification: '', evidence: null },
        { id: '4-6', text: 'Are incidents and nonconformities investigated?', classification: '', evidence: null },
        { id: '4-7', text: 'Is PPE available and used correctly?', classification: '', evidence: null }
      ]
    },
    {
      id: 5,
      name: 'Supplier Quality Assessment',
      type: 'External',
      standard: 'Internal Standard',
      items: 4,
      created: '2025-01-18',
      status: 'Active',
      checklistItems: [
        { id: '5-1', text: 'Does the supplier have a valid quality certification?', classification: '', evidence: null },
        { id: '5-2', text: 'Are raw materials inspected upon receipt?', classification: '', evidence: null },
        { id: '5-3', text: 'Is there a procedure for handling customer complaints?', classification: '', evidence: null },
        { id: '5-4', text: 'Is traceability of products maintained?', classification: '', evidence: null }
      ]
    }
  ];

  const [checklists, setChecklists] = useState<Checklist[]>(() => {
    try {
      const raw = localStorage.getItem('cms_audit_checklists');
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* ignore */ }
    return initialChecklists;
  });
  // Persist checklists so Lead Auditor / Auditor "Conduct Audit" pages consume the same data.
  React.useEffect(() => {
    try {
      localStorage.setItem('cms_audit_checklists', JSON.stringify(checklists));
      window.dispatchEvent(new CustomEvent('cms-audit-checklists-updated'));
    } catch { /* ignore */ }
  }, [checklists]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  
  // Modal State for Editing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [editingItems, setEditingItems] = useState<ChecklistItem[]>([]);
  // Added states for editing checklist metadata
  const [editingName, setEditingName] = useState('');
  const [editingType, setEditingType] = useState('');
  const [editingStandard, setEditingStandard] = useState('');
  
  // Selection State for Edit Mode
  const [selectedEditIds, setSelectedEditIds] = useState<string[]>([]);

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newChecklistName, setNewChecklistName] = useState('');
  const [newChecklistType, setNewChecklistType] = useState('Internal');
  const [newChecklistStandard, setNewChecklistStandard] = useState('');
  const [newChecklistItems, setNewChecklistItems] = useState<ChecklistItem[]>([]);
  
  // Selection State for Create Mode
  const [selectedCreateIds, setSelectedCreateIds] = useState<string[]>([]);


  // Drag-and-drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  
  // Clone-from-template state
  const [cloneTemplateId, setCloneTemplateId] = useState<number | ''>('');

  // Filter Logic
  const filteredChecklists = checklists.filter(c => 
    (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     c.standard.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterType ? c.type === filterType : true)
  );

  // Handlers for Edit
  const handleEditClick = (checklist: Checklist) => {
    setSelectedChecklist(checklist);
    setEditingItems(JSON.parse(JSON.stringify(checklist.checklistItems))); // Deep copy
    // Initialize editing states with current values
    setEditingName(checklist.name);
    setEditingType(checklist.type);
    setEditingStandard(checklist.standard);
    setSelectedEditIds([]); // Reset selection
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedChecklist(null);
    setEditingItems([]);
    setEditingName('');
    setEditingType('');
    setEditingStandard('');
    setSelectedEditIds([]);
  };

  const handleItemChange = (id: string, field: keyof ChecklistItem, value: any) => {
    setEditingItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleDeleteItem = (id: string) => {
    setEditingItems(prev => prev.filter(item => item.id !== id));
    setSelectedEditIds(prev => prev.filter(itemId => itemId !== id));
  };
  
  // Bulk Selection Handlers for Edit
  const handleEditSelectAll = () => {
    if (selectedEditIds.length === editingItems.length && editingItems.length > 0) {
      setSelectedEditIds([]);
    } else {
      setSelectedEditIds(editingItems.map(i => i.id));
    }
  };

  const handleEditToggleSelect = (id: string) => {
    setSelectedEditIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedEditItems = () => {
    if (window.confirm(`Delete ${selectedEditIds.length} selected items?`)) {
      setEditingItems(prev => prev.filter(item => !selectedEditIds.includes(item.id)));
      setSelectedEditIds([]);
    }
  };

  const handleAddItem = () => {
    const newItem: ChecklistItem = {
      id: `new-${Date.now()}`,
      text: '',
      classification: '',
      evidence: null
    };
    setEditingItems([...editingItems, newItem]);
  };

  // Create modal handlers
  const openCreateModal = () => {
    setNewChecklistName('');
    setNewChecklistType('Internal');
    setNewChecklistStandard('');
    setNewChecklistItems([
      { id: `c-${Date.now()}-1`, text: '', classification: '', evidence: null, notes: '' }
    ]);
    setSelectedCreateIds([]); // Reset selection
    setIsCreateOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
  };

  const handleNewItemChange = (id: string, field: keyof ChecklistItem, value: any) => {
    setNewChecklistItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };


  const handleCreateAddItem = () => {
    setNewChecklistItems(prev => [...prev, { id: `c-${Date.now()}`, text: '', classification: '', evidence: null, notes: '' }]);
  };

  // Reorder items helper - works for both create and edit lists
  const reorderList = (list: ChecklistItem[], dragId: string, dropId: string): ChecklistItem[] => {
    if (dragId === dropId) return list;
    const dragIdx = list.findIndex(i => i.id === dragId);
    const dropIdx = list.findIndex(i => i.id === dropId);
    if (dragIdx < 0 || dropIdx < 0) return list;
    const next = [...list];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(dropIdx, 0, moved);
    return next;
  };

  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== dragOverId) setDragOverId(id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleCreateDrop = (dropId: string) => {
    if (!draggingId) return;
    setNewChecklistItems(prev => reorderList(prev, draggingId, dropId));
    handleDragEnd();
  };

  const handleEditDrop = (dropId: string) => {
    if (!draggingId) return;
    setEditingItems(prev => reorderList(prev, draggingId, dropId));
    handleDragEnd();
  };

  // Conditional follow-up handlers
  const toggleCreateFollowUp = (id: string) => {
    setNewChecklistItems(prev => prev.map(i => i.id === id 
      ? { ...i, followUpIf: i.followUpIf ? undefined : { whenAnswer: 'Yes', followUpText: '' } } 
      : i
    ));
  };

  const updateCreateFollowUp = (id: string, key: 'whenAnswer' | 'followUpText', value: any) => {
    setNewChecklistItems(prev => prev.map(i => i.id === id && i.followUpIf
      ? { ...i, followUpIf: { ...i.followUpIf, [key]: value } }
      : i
    ));
  };

  const toggleEditFollowUp = (id: string) => {
    setEditingItems(prev => prev.map(i => i.id === id 
      ? { ...i, followUpIf: i.followUpIf ? undefined : { whenAnswer: 'Yes', followUpText: '' } } 
      : i
    ));
  };

  const updateEditFollowUp = (id: string, key: 'whenAnswer' | 'followUpText', value: any) => {
    setEditingItems(prev => prev.map(i => i.id === id && i.followUpIf
      ? { ...i, followUpIf: { ...i.followUpIf, [key]: value } }
      : i
    ));
  };

  // Clone from ISO template - copies items into the new checklist editor
  const handleCloneFromTemplate = () => {
    if (cloneTemplateId === '') return;
    const tpl = checklists.find(c => c.id === cloneTemplateId);
    if (!tpl) return;
    const stamp = Date.now();
    const cloned: ChecklistItem[] = tpl.checklistItems.map((it, idx) => ({
      ...it,
      id: `clone-${stamp}-${idx}`,
      followUpIf: it.followUpIf ? { ...it.followUpIf } : undefined,
    }));
    setNewChecklistItems(prev => {
      // If only blank starter exists, replace; otherwise append
      if (prev.length === 1 && prev[0].text.trim() === '') return cloned;
      return [...prev, ...cloned];
    });
    if (!newChecklistName) setNewChecklistName(`${tpl.name} (Copy)`);
    if (!newChecklistStandard) setNewChecklistStandard(tpl.standard);
    setCloneTemplateId('');
  };

  const handleCreateDeleteItem = (id: string) => {
    setNewChecklistItems(prev => prev.filter(i => i.id !== id));
    setSelectedCreateIds(prev => prev.filter(itemId => itemId !== id));
  };

  // Bulk Selection Handlers for Create
  const handleCreateSelectAll = () => {
    if (selectedCreateIds.length === newChecklistItems.length && newChecklistItems.length > 0) {
      setSelectedCreateIds([]);
    } else {
      setSelectedCreateIds(newChecklistItems.map(i => i.id));
    }
  };

  const handleCreateToggleSelect = (id: string) => {
    setSelectedCreateIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedCreateItems = () => {
    if (window.confirm(`Delete ${selectedCreateIds.length} selected items?`)) {
      setNewChecklistItems(prev => prev.filter(item => !selectedCreateIds.includes(item.id)));
      setSelectedCreateIds([]);
    }
  };

  // Handler for Template Upload
  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      console.log('Template uploaded:', e.target.files[0].name);
      alert(`Template '${e.target.files[0].name}' selected. Items would be populated here.`);
    }
  };

  // Handler for Excel Download
  const handleDownloadExcel = () => {
    const link = document.createElement('a');
    link.href = '/Master_Audit_checklist.xlsx';
    link.download = 'Master_Audit_checklist.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveNewChecklist = () => {
    const validItems = newChecklistItems.filter(i => i.text.trim() !== '');
    const nextId = checklists.length ? Math.max(...checklists.map(c => c.id)) + 1 : 1;
    const created = new Date().toISOString().slice(0, 10);
    const checklist: Checklist = {
      id: nextId,
      name: newChecklistName || 'New Checklist',
      type: newChecklistType,
      standard: newChecklistStandard || 'Custom',
      items: validItems.length,
      created,
      status: 'Draft',
      checklistItems: validItems
    };
    setChecklists(prev => [checklist, ...prev]);
    setIsCreateOpen(false);
  };

  const handleSaveChanges = () => {
    if (selectedChecklist) {
      const validItems = editingItems.filter(item => item.text.trim() !== '');
      setChecklists(prev => prev.map(c => 
        c.id === selectedChecklist.id 
          ? { 
              ...c, 
              name: editingName, 
              type: editingType, 
              standard: editingStandard, 
              checklistItems: validItems, 
              items: validItems.length 
            } 
          : c
      ));
      handleCloseModal();
    }
  };

  const handleDeleteChecklist = (id: number) => {
    if(window.confirm('Are you sure you want to delete this checklist?')) {
      setChecklists(prev => prev.filter(c => c.id !== id));
    }
  };

  return (
    <div className="checklist-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-title">
          <div className="icon-box">
            <CheckSquare size={24} color="white" />
          </div>
          <div>
            <h1>Audit Checklists</h1>
            <p>Manage and customize audit templates and criteria</p>
          </div>
        </div>
        <button className="btn-create" onClick={openCreateModal}>
          <Plus size={18} />
          New Checklist
        </button>
      </div>

      {/* Toolbar */}
      <div className="content-card">
        <div className="card-controls">
          <div className="search-bar">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search checklists..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <Filter size={18} color="#64748b" />
            <select 
              className="status-filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="Internal">Internal</option>
              <option value="External">External</option>
              <option value="Compliance">Compliance</option>
              <option value="Surveillance">Surveillance</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive">
          <table className="checklist-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Standard</th>
                <th style={{ textAlign: 'center' }}>Items</th>
                <th>Created</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredChecklists.map((checklist) => (
                <tr key={checklist.id}>
                  <td>
                    <div className="checklist-name">
                      <FileText size={16} className="text-gray" />
                      <span>{checklist.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`type-badge ${checklist.type.toLowerCase()}`}>
                      {checklist.type}
                    </span>
                  </td>
                  <td className="text-secondary">{checklist.standard}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="items-count">{checklist.items}</span>
                  </td>
                  <td className="text-secondary">{checklist.created}</td>
                  <td>
                    <span className={`status-badge ${checklist.status.toLowerCase()}`}>
                      {checklist.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn-edit-checklist"
                        onClick={() => handleEditClick(checklist)}
                      >
                        <Edit size={14} />
                        Edit Checklists
                      </button>
                      <button 
                        className="btn-icon-delete"
                        onClick={() => handleDeleteChecklist(checklist.id)}
                        title="Delete Checklist"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredChecklists.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No checklists found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fullscreen Create Checklist Editor */}
      {isCreateOpen && (
        <div className="fullscreen-editor">
          <div className="editor-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
              <button className="btn-back" onClick={closeCreateModal} title="Close editor">
                <X size={18} />
              </button>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={newChecklistName}
                  onChange={(e) => setNewChecklistName(e.target.value)}
                  placeholder="Checklist name"
                  className="editor-name-input"
                />
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <select
                    value={newChecklistType}
                    onChange={(e) => setNewChecklistType(e.target.value)}
                    className="status-filter modal-select"
                    style={{ width: 180 }}
                  >
                    <option>Internal</option>
                    <option>External</option>
                    <option>Compliance</option>
                    <option>Surveillance</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Standard (e.g. ISO 9001:2015)"
                    value={newChecklistStandard}
                    onChange={(e) => setNewChecklistStandard(e.target.value)}
                    style={{ padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', flex: 1 }}
                  />
                </div>
              </div>
            </div>

            <div className="editor-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Clone from ISO template picker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', backgroundColor: '#eef2ff', borderRadius: 8, border: '1px solid #c7d2fe' }}>
                <Copy size={14} color="#4338ca" />
                <select
                  value={cloneTemplateId}
                  onChange={(e) => setCloneTemplateId(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #c7d2fe', backgroundColor: 'white', fontSize: 13, minWidth: 200 }}
                  title="Clone questions from an existing ISO template"
                >
                  <option value="">Clone from ISO Template…</option>
                  {checklists.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.standard})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleCloneFromTemplate}
                  disabled={cloneTemplateId === ''}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: cloneTemplateId === '' ? '#cbd5e1' : '#4338ca',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: cloneTemplateId === '' ? 'not-allowed' : 'pointer',
                  }}
                >
                  Clone
                </button>
              </div>
              <input
                id="template-upload-input"
                type="file"
                accept=".csv,.xlsx,.json"
                style={{ display: 'none' }}
                onChange={handleTemplateUpload}
              />
              {/* New Download Template Button added beside Upload Template */}
              <button 
                className="btn-save" 
                style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }} 
                onClick={handleDownloadExcel}
              >
                <Download size={16} />
                Download Template
              </button>
              <button 
                className="btn-save" 
                style={{ backgroundColor: '#64748b' }} 
                onClick={() => document.getElementById('template-upload-input')?.click()}
              >
                <Upload size={16} />
                Upload Template
              </button>
            </div>
          </div>

          <div className="editor-body">
             {/* BULK ACTIONS ROW FOR CREATE MODE */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: 16, 
              padding: '8px 16px', 
              backgroundColor: '#f8fafc', 
              borderRadius: 8,
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input 
                  type="checkbox" 
                  checked={newChecklistItems.length > 0 && selectedCreateIds.length === newChecklistItems.length}
                  onChange={handleCreateSelectAll}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, fontWeight: 500, color: '#475569' }}>
                  Select All Questions ({newChecklistItems.length})
                </span>
              </div>
              
              {selectedCreateIds.length > 0 && (
                <button 
                  onClick={handleDeleteSelectedCreateItems}
                  style={{ 
                    marginLeft: 'auto', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    padding: '6px 12px', 
                    backgroundColor: '#fee2e2', 
                    color: '#ef4444', 
                    border: 'none', 
                    borderRadius: 6, 
                    fontSize: 13, 
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={14} />
                  Delete Selected ({selectedCreateIds.length})
                </button>
              )}
            </div>

            {newChecklistItems.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDrop={() => handleCreateDrop(item.id)}
                onDragEnd={handleDragEnd}
                className="item-card"
                style={{
                  borderLeft: selectedCreateIds.includes(item.id) ? '4px solid #3b82f6' : '1px solid #e2e8f0',
                  opacity: draggingId === item.id ? 0.5 : 1,
                  outline: dragOverId === item.id && draggingId && draggingId !== item.id ? '2px dashed #3b82f6' : 'none',
                  transition: 'outline 0.12s, opacity 0.12s',
                }}
              >
                <div className="item-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      title="Drag to reorder"
                      style={{ cursor: 'grab', color: '#94a3b8', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <GripVertical size={16} />
                    </span>
                    <input 
                      type="checkbox"
                      checked={selectedCreateIds.includes(item.id)}
                      onChange={() => handleCreateToggleSelect(item.id)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <div className="item-number">{index + 1}</div>
                  </div>
                  <div className="item-title">
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) => handleNewItemChange(item.id, 'text', e.target.value)}
                      placeholder="Enter checklist question or observation..."
                      className="item-input single-line-input"
                    />
                  </div>
                </div>

                <div className="item-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => toggleCreateFollowUp(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      backgroundColor: item.followUpIf ? '#ecfdf5' : '#f1f5f9',
                      color: item.followUpIf ? '#047857' : '#475569',
                      border: `1px solid ${item.followUpIf ? '#a7f3d0' : '#cbd5e1'}`,
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                    title="Add a conditional follow-up question"
                  >
                    <GitBranch size={14} />
                    {item.followUpIf ? 'Follow-up enabled' : 'Add follow-up'}
                  </button>
                  <div className="control-action">
                    <button className="btn-delete-item" onClick={() => handleCreateDeleteItem(item.id)} title="Remove">
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {item.followUpIf && (
                  <div style={{
                    marginTop: 10,
                    padding: 12,
                    backgroundColor: '#f0fdf4',
                    borderLeft: '3px solid #22c55e',
                    borderRadius: 6,
                  }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>If answer is</span>
                      <select
                        value={item.followUpIf.whenAnswer}
                        onChange={(e) => updateCreateFollowUp(item.id, 'whenAnswer', e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #86efac', fontSize: 12, backgroundColor: 'white' }}
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                        <option value="N/A">N/A</option>
                      </select>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>→ then ask:</span>
                    </div>
                    <input
                      type="text"
                      value={item.followUpIf.followUpText}
                      onChange={(e) => updateCreateFollowUp(item.id, 'followUpText', e.target.value)}
                      placeholder="Enter the follow-up question…"
                      style={{
                        width: '100%',
                        padding: 8,
                        borderRadius: 4,
                        border: '1px solid #86efac',
                        fontSize: 13,
                        backgroundColor: 'white',
                      }}
                    />
                  </div>
                )}

                <div className="item-notes">
                  <label className="control-label">Observation Notes</label>
                  <textarea
                    value={item.notes || ''}
                    onChange={(e) => handleNewItemChange(item.id, 'notes' as any, e.target.value)}
                    placeholder="Document observations..."
                    className="item-input item-textarea notes-textarea"
                    rows={4}
                  />
                </div>
              </div>
            ))}

            <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn-add-item" onClick={handleCreateAddItem}>
                <Plus size={16} /> Add New Question
              </button>
            </div>
          </div>

          <div className="editor-footer">
            <div className="items-summary">Total Items: {newChecklistItems.filter(i => i.text.trim()).length}</div>
            <div className="footer-actions">
              <button className="btn-cancel" onClick={closeCreateModal}>Cancel</button>
              <button className="btn-save" onClick={handleSaveNewChecklist}>
                <Save size={16} /> Save Checklist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-window Edit Checklist Editor */}
      {isModalOpen && selectedChecklist && (
        <div className="fullscreen-editor">
          <div className="editor-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
              <button className="btn-back" onClick={handleCloseModal} title="Close editor">
                <X size={18} />
              </button>
              {/* EDITABLE HEADER SECTION */}
              <div style={{ flex: 1 }}>
                 <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    placeholder="Checklist name"
                    className="editor-name-input"
                  />
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <select
                      value={editingType}
                      onChange={(e) => setEditingType(e.target.value)}
                      className="status-filter modal-select"
                      style={{ width: 180 }}
                    >
                      <option>Internal</option>
                      <option>External</option>
                      <option>Compliance</option>
                      <option>Surveillance</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Standard (e.g. ISO 9001:2015)"
                      value={editingStandard}
                      onChange={(e) => setEditingStandard(e.target.value)}
                      style={{ padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', flex: 1 }}
                    />
                  </div>
              </div>
            </div>
            <div className="editor-actions">
              <button className="btn-cancel" onClick={handleCloseModal}>Close</button>
              <button className="btn-save" onClick={handleSaveChanges}>
                <Save size={16} />
                Save Changes
              </button>
            </div>
          </div>

          <div className="editor-body">
            {/* BULK ACTIONS ROW FOR EDIT MODE */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: 16, 
              padding: '8px 16px', 
              backgroundColor: '#f8fafc', 
              borderRadius: 8,
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input 
                  type="checkbox" 
                  checked={editingItems.length > 0 && selectedEditIds.length === editingItems.length}
                  onChange={handleEditSelectAll}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, fontWeight: 500, color: '#475569' }}>
                  Select All Questions ({editingItems.length})
                </span>
              </div>
              
              {selectedEditIds.length > 0 && (
                <button 
                  onClick={handleDeleteSelectedEditItems}
                  style={{ 
                    marginLeft: 'auto', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    padding: '6px 12px', 
                    backgroundColor: '#fee2e2', 
                    color: '#ef4444', 
                    border: 'none', 
                    borderRadius: 6, 
                    fontSize: 13, 
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={14} />
                  Delete Selected ({selectedEditIds.length})
                </button>
              )}
            </div>

            {editingItems.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDrop={() => handleEditDrop(item.id)}
                onDragEnd={handleDragEnd}
                className="item-card"
                style={{
                  borderLeft: selectedEditIds.includes(item.id) ? '4px solid #3b82f6' : '1px solid #e2e8f0',
                  opacity: draggingId === item.id ? 0.5 : 1,
                  outline: dragOverId === item.id && draggingId && draggingId !== item.id ? '2px dashed #3b82f6' : 'none',
                  transition: 'outline 0.12s, opacity 0.12s',
                }}
              >
                <div className="item-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      title="Drag to reorder"
                      style={{ cursor: 'grab', color: '#94a3b8', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <GripVertical size={16} />
                    </span>
                    <input 
                      type="checkbox"
                      checked={selectedEditIds.includes(item.id)}
                      onChange={() => handleEditToggleSelect(item.id)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <div className="item-number">{index + 1}</div>
                  </div>
                  <div className="item-title">
                     {/* Allows editing the question text directly in Edit Mode */}
                     <input
                      type="text"
                      value={item.text}
                      onChange={(e) => handleItemChange(item.id, 'text', e.target.value)}
                      placeholder="Enter checklist question or observation..."
                      className="item-input single-line-input"
                    />
                  </div>
                </div>

                <div className="item-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => toggleEditFollowUp(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      backgroundColor: item.followUpIf ? '#ecfdf5' : '#f1f5f9',
                      color: item.followUpIf ? '#047857' : '#475569',
                      border: `1px solid ${item.followUpIf ? '#a7f3d0' : '#cbd5e1'}`,
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                    title="Add a conditional follow-up question"
                  >
                    <GitBranch size={14} />
                    {item.followUpIf ? 'Follow-up enabled' : 'Add follow-up'}
                  </button>
                  <div className="control-action">
                    <button
                      className="btn-delete-item"
                      onClick={() => handleDeleteItem(item.id)}
                      title="Remove Item"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {item.followUpIf && (
                  <div style={{
                    marginTop: 10,
                    padding: 12,
                    backgroundColor: '#f0fdf4',
                    borderLeft: '3px solid #22c55e',
                    borderRadius: 6,
                  }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>If answer is</span>
                      <select
                        value={item.followUpIf.whenAnswer}
                        onChange={(e) => updateEditFollowUp(item.id, 'whenAnswer', e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #86efac', fontSize: 12, backgroundColor: 'white' }}
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                        <option value="N/A">N/A</option>
                      </select>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>→ then ask:</span>
                    </div>
                    <input
                      type="text"
                      value={item.followUpIf.followUpText}
                      onChange={(e) => updateEditFollowUp(item.id, 'followUpText', e.target.value)}
                      placeholder="Enter the follow-up question…"
                      style={{
                        width: '100%',
                        padding: 8,
                        borderRadius: 4,
                        border: '1px solid #86efac',
                        fontSize: 13,
                        backgroundColor: 'white',
                      }}
                    />
                  </div>
                )}

                <div className="item-notes">
                  <label className="control-label">Observation Notes</label>
                  <textarea
                    value={(item as any).notes || ''}
                    onChange={(e) => handleItemChange(item.id, 'notes' as any, e.target.value)}
                    placeholder="Document observations..."
                    className="item-input item-textarea notes-textarea"
                    rows={4}
                  />
                </div>
              </div>
            ))}

            {editingItems.length === 0 && (
              <div className="empty-items-state">No items in this checklist. Add a new question below.</div>
            )}

            <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn-add-item" onClick={handleAddItem}>
                <Plus size={16} /> Add New Question
              </button>
            </div>
          </div>

          <div className="editor-footer">
            <div className="items-summary">Total Items: {editingItems.filter(i => i.text.trim()).length}</div>
            <div className="footer-actions">
              <button className="btn-cancel" onClick={handleCloseModal}>Cancel</button>
              <button className="btn-save" onClick={handleSaveChanges}>
                <Save size={16} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AuditChecklists;