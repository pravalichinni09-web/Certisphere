import React, { useState, useEffect, useMemo } from 'react';
import { Edit2, Trash2, Send, CheckCircle, FileText, CheckSquare, Paperclip, HardDrive, Search, Eye, X } from 'lucide-react';
import StandardPicker from '../../components/StandardPicker';
import EmailTemplateEditor from '../../components/EmailTemplateEditor';
import { listEmailTemplates, renderTemplate, EmailTemplate } from '../../utils/emailTemplates';
import ClientEnquiry from './ClientEnquiry';
import QCSApplicationForm, { QCSFormMode, loadQCSRecord } from '../../components/QCSApplicationForm';
import '../../styles/AuditorCoordinator/ApplicationDispatch.css';
import '../../styles/EmailTemplateEditor.css';

interface DispatchRecord {
  id: number;
  clientName: string;
  organization: string;
  mobile?: string;
  applicationType: string;
  standard: string;
  email: string;
  dispatchedDate: string;
  status: 'Submitted' | 'Pending' | 'Sent' | 'Received' | 'Approved' | 'Rejected' | 'Hold';
  contactName?: string;
  reviewDate?: string;
  attachment?: { name: string; dataUrl: string; size: number; uploadedAt: string };
  agreement?: { name: string; dataUrl: string; size: number; uploadedAt: string };
  rejectNote?: string;
  sendReviewNote?: string;
  link: string;
  auditType?: string;
  preferredStart?: string;
  preferredEnd?: string;
  auditorsCount?: number;
  auditScope?: string;
  // Delivery telemetry
  sentAt?: string;       // ISO timestamp when last sent
  deliveredAt?: string;  // ISO timestamp when 'delivered'
  readAt?: string;       // ISO timestamp when 'read'
  deliveryHistory?: Array<{ at: string; via: 'email' | 'whatsapp'; templateId?: string }>;
  templateId?: string;
}

const ApplicationDispatch: React.FC = () => {
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'enquiry' | 'received' | 'review'>('enquiry');
  // Sub-tab inside the Client Enquiry section: enquiries list vs. sent applications
  const [enquirySubTab, setEnquirySubTab] = useState<'enquiries' | 'sent'>('enquiries');
  const [qcsFormFor, setQcsFormFor] = useState<{ id: number; mode: QCSFormMode } | null>(null);

  // Tab badges — count fresh items in each lifecycle bucket
  const tabCounts = useMemo(() => {
    let newEnquiries = 0;
    try {
      const raw = localStorage.getItem('cms_client_enquiries_v1');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) newEnquiries = arr.filter((e: any) => e.status === 'New').length;
      }
    } catch {}
    const recentlyReceived = dispatches.filter((d) => d.status === 'Received').length;
    const awaitingReview = dispatches.filter(
      (d) => d.status === 'Received' || d.status === 'Hold'
    ).length;
    return { newEnquiries, recentlyReceived, awaitingReview };
  }, [dispatches]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  // Bulk dispatch state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTemplateId, setBulkTemplateId] = useState<string>('');
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkBody, setBulkBody] = useState('');
  // Template editor state
  const [tplEditorOpen, setTplEditorOpen] = useState(false);
  // Templates (re-loaded on event)
  const [dispatchTemplates, setDispatchTemplates] = useState<EmailTemplate[]>(() => listEmailTemplates('dispatch'));

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'Approved' | 'Rejected'>('Approved');
  const [reviewNote, setReviewNote] = useState('');

  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [sendConfirmId, setSendConfirmId] = useState<number | null>(null);
  const [sendReviewNote, setSendReviewNote] = useState('');

  const STORAGE_KEY = 'cms_application_dispatch_v7'; // Updated version
  const DEFAULT_LINK = 'Application For Certification - QCS 3.31.32 PM (3).doc';
  
  const handleOpenDocument = (docName: string) => {
    // Simulates opening/downloading the document
    const link = document.createElement('a');
    const cleanName = docName.split('\\').pop() || docName;
    link.href = `/${cleanName}`; 
    link.download = cleanName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenDrive = () => {
    window.open('https://drive.google.com', '_blank');
  };

  const [formData, setFormData] = useState({
    clientName: '',
    organization: '',
    mobile: '', // Added mobile
    standard: 'ISO 9001:2015',
    email: '',
    dispatchedDate: new Date().toISOString().split('T')[0],
    status: 'Sent' as 'Sent' | 'Pending' | 'Received' | 'Approved' | 'Rejected' | 'Submitted' | 'Hold',
    link: DEFAULT_LINK,
    auditType: 'Initial',
    preferredStart: new Date().toISOString().split('T')[0],
    preferredEnd: new Date().toISOString().split('T')[0],
    auditorsCount: 1,
    auditScope: '',
  });

  const defaultDispatches: DispatchRecord[] = [
    {
      id: 1,
      clientName: 'John Doe',
      organization: 'Green Energy Solutions',
      mobile: '+1 555-0101',
      applicationType: 'Audit Application Form',
      standard: 'ISO 14001:2015',
      email: 'info@greenenergy.com',
      dispatchedDate: '2025-10-20',
      status: 'Received',
      link: DEFAULT_LINK,
    },
    {
      id: 6,
      clientName: 'Jennifer Taylor',
      organization: 'AutoParts Manufacturing',
      mobile: '+1 555-0102',
      applicationType: 'Audit Application Form',
      standard: 'ISO 9001:2015',
      email: 'j.taylor@autoparts.com',
      dispatchedDate: '2025-09-15',
      status: 'Approved',
      link: DEFAULT_LINK,
    },
    {
      id: 7,
      clientName: 'Robert Miller',
      organization: 'Chemical Bros Ltd',
      mobile: '+1 555-0103',
      applicationType: 'Audit Application Form',
      standard: 'ISO 14001:2015',
      email: 'safety@chembros.com',
      dispatchedDate: '2025-10-05',
      status: 'Received',
      link: DEFAULT_LINK,
    },
    {
      id: 2,
      clientName: 'Sarah Smith',
      organization: 'Tech Innovations Ltd',
      mobile: '+1 555-0104',
      applicationType: 'Audit Application Form',
      standard: 'ISO 9001:2015',
      email: 'contact@techinnovations.com',
      dispatchedDate: '2025-10-25',
      status: 'Sent',
      link: DEFAULT_LINK,
    },
    {
      id: 3,
      clientName: 'Michael Brown',
      organization: 'SkyHigh Construction',
      mobile: '+1 555-0105',
      applicationType: 'Audit Application Form',
      standard: 'ISO 45001:2018',
      email: 'mbrown@skyhigh.com',
      dispatchedDate: '2025-10-28',
      status: 'Pending',
      link: DEFAULT_LINK,
    }
  ];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setDispatches(JSON.parse(raw));
        return;
      }
    } catch (e) {
      console.error('Failed to load dispatches from storage', e);
    }
    setDispatches(defaultDispatches);
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const refresh = () => setDispatchTemplates(listEmailTemplates('dispatch'));
    window.addEventListener('email-templates-updated', refresh);
    return () => window.removeEventListener('email-templates-updated', refresh);
  }, []);

  const persist = (items: DispatchRecord[]) => {
    setDispatches(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save dispatches to storage', e);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target as any;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (item: DispatchRecord) => {
    setEditingId(item.id);
    setFormData({
      clientName: item.clientName,
      organization: item.organization || '',
      mobile: item.mobile || '',
      standard: item.standard,
      email: item.email,
      dispatchedDate: item.dispatchedDate,
      status: item.status,
      link: item.link || DEFAULT_LINK,
      auditType: item.auditType || 'Initial',
      preferredStart: item.preferredStart || new Date().toISOString().split('T')[0],
      preferredEnd: item.preferredEnd || new Date().toISOString().split('T')[0],
      auditorsCount: item.auditorsCount || 1,
      auditScope: item.auditScope || '',
    });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('Are you sure you want to delete this dispatch record?')) return;
    persist(dispatches.filter(c => c.id !== id));
  };

  /* ----- Application Status quick-toggle (Submitted / Pending) ----- */
  const updateStatus = (id: number, status: DispatchRecord['status']) => {
    persist(
      dispatches.map((d) => (d.id === id ? { ...d, status } : d))
    );
  };

  /* ----- File upload handlers (Application Attachment + Agreement) ----- */
  const fileToDataUrl = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

  const handleUploadFile = async (
    id: number,
    field: 'attachment' | 'agreement',
    file: File
  ) => {
    if (!file) return;
    // Cap to ~3MB to avoid blowing past localStorage limits
    if (file.size > 3 * 1024 * 1024) {
      setNotification('File is too large. Keep it under 3 MB.');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const meta = {
        name: file.name,
        dataUrl,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };
      persist(
        dispatches.map((d) => (d.id === id ? { ...d, [field]: meta } : d))
      );
      setNotification(
        `${field === 'attachment' ? 'Application attachment' : 'Agreement'} uploaded.`
      );
    } catch {
      setNotification('Could not read the selected file.');
    }
  };

  const handleClearFile = (id: number, field: 'attachment' | 'agreement') => {
    if (!window.confirm(`Remove the ${field === 'attachment' ? 'application attachment' : 'agreement'}?`)) return;
    persist(
      dispatches.map((d) => (d.id === id ? { ...d, [field]: undefined } : d))
    );
  };

  const stampDelivery = (id: number, templateId?: string): DispatchRecord[] => {
    const now = new Date().toISOString();
    return dispatches.map(d => {
      if (d.id !== id) return d;
      const history = (d.deliveryHistory || []).slice();
      history.push({ at: now, via: 'email', templateId });
      return {
        ...d,
        status: d.status === 'Pending' ? 'Sent' : d.status,
        sentAt: now,
        deliveryHistory: history,
        templateId,
      };
    });
  };

  const simulateDeliveryReceipt = (id: number) => {
    // Mark delivered ~1s later, read ~3-6s later — purely client-side simulation
    setTimeout(() => {
      setDispatches(curr => {
        const next = curr.map(d => d.id === id && !d.deliveredAt ? { ...d, deliveredAt: new Date().toISOString() } : d);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    }, 1000);
    setTimeout(() => {
      setDispatches(curr => {
        const next = curr.map(d => d.id === id && !d.readAt ? { ...d, readAt: new Date().toISOString() } : d);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    }, 3000 + Math.floor(Math.random() * 3000));
  };

  const handleSendEmail = (item: DispatchRecord, templateId?: string) => {
    setNotification(`Email sent to ${item.clientName} successfully`);
    const updated = stampDelivery(item.id, templateId);
    persist(updated);
    simulateDeliveryReceipt(item.id);
  };

  const openSendReviewModal = (id: number) => {
    setSendConfirmId(id);
    setSendReviewNote('');
    setSendConfirmOpen(true);
  };

  const handleConfirmSend = () => {
    if (sendConfirmId == null) return;
    const item = dispatches.find((d) => d.id === sendConfirmId);
    if (!item) return;
    handleSendEmail(item, item.templateId);
    persist(
      dispatches.map((d) =>
        d.id === item.id
          ? { ...d, sendReviewNote: sendReviewNote.trim() || d.sendReviewNote }
          : d
      )
    );
    setSendConfirmOpen(false);
    setSendConfirmId(null);
    setSendReviewNote('');
  };

  // Toggle selection for bulk dispatch (SENT tab only)
      const handleBulkTemplateChange = (id: string) => {
    setBulkTemplateId(id);
    const tpl = dispatchTemplates.find(t => t.id === id);
    if (tpl) {
      setBulkSubject(tpl.subject);
      setBulkBody(tpl.body);
    }
  };

  const handleBulkSend = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    let next = dispatches.slice();
    ids.forEach(id => {
      const recipient = next.find(d => d.id === id);
      if (!recipient) return;
      // Render with this recipient's vars (just to "stamp" subject for log)
      const tpl = dispatchTemplates.find(t => t.id === bulkTemplateId);
      const renderVars = {
        clientName: recipient.organization,
        contactName: recipient.clientName,
        standard: recipient.standard,
        clientCode: '',
        senderName: 'Audit Coordinator',
        dueDate: recipient.dispatchedDate,
      };
      if (tpl) renderTemplate({ ...tpl, subject: bulkSubject, body: bulkBody }, renderVars);
      const now = new Date().toISOString();
      const history = (recipient.deliveryHistory || []).slice();
      history.push({ at: now, via: 'email', templateId: bulkTemplateId });
      next = next.map(d => d.id === id ? {
        ...d,
        status: d.status === 'Pending' ? 'Sent' : d.status,
        sentAt: now,
        deliveryHistory: history,
        templateId: bulkTemplateId,
      } : d);
    });
    persist(next);
    setNotification(`Bulk dispatch sent to ${ids.length} recipient${ids.length === 1 ? '' : 's'}`);
    ids.forEach(id => simulateDeliveryReceipt(id));
    setSelectedIds(new Set());
    setBulkOpen(false);
  };

    // Opens Review Modal
  const openReviewModal = (id: number) => {
    setReviewingId(id);
    setReviewStatus('Approved');
    setReviewNote('');
    setReviewModalOpen(true);
  };

  // Handles Review Submission
  const handleReviewSubmit = () => {
    if (reviewingId) {
      const updated = dispatches.map(d => d.id === reviewingId ? { 
        ...d, 
        status: reviewStatus, 
        rejectNote: reviewStatus === 'Rejected' ? reviewNote : undefined 
      } : d);
      persist(updated);
      setNotification(`Application ${reviewStatus.toLowerCase()} successfully`);
    }
    setReviewModalOpen(false);
    setReviewingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentAppType = 'Audit Application Form';

    if (editingId) {
      const updated = dispatches.map(c => c.id === editingId ? { 
        ...c, 
        ...formData,
        applicationType: currentAppType
      } as DispatchRecord : c);
      persist(updated);
      setEditingId(null);
    } else {
      const nextId = dispatches.length > 0 ? Math.max(...dispatches.map(c => c.id)) + 1 : 1;
      const newItem: DispatchRecord = {
        id: nextId,
        clientName: formData.clientName,
        organization: formData.organization,
        mobile: formData.mobile,
        applicationType: currentAppType,
        standard: formData.standard,
        email: formData.email,
        dispatchedDate: formData.dispatchedDate,
        status: formData.status,
        link: formData.link,
      };
      persist([...dispatches, newItem]);
    }
    resetForm();
    setShowForm(false);
  };

  const resetForm = () => {
    setFormData({
      clientName: '',
      organization: '',
      mobile: '',
      standard: 'ISO 9001:2015',
      email: '',
      dispatchedDate: new Date().toISOString().split('T')[0],
      status: 'Sent',
      link: DEFAULT_LINK,
      auditType: 'Initial',
      preferredStart: new Date().toISOString().split('T')[0],
      preferredEnd: new Date().toISOString().split('T')[0],
      auditorsCount: 1,
      auditScope: '',
    });
  };

  const handleCancel = () => {
    resetForm();
    setEditingId(null);
    setShowForm(false);
  };

  // Filtering based on Search Term and Active Tab
  const filteredDispatches = dispatches.filter(item => {
    const matchesSearch = 
      item.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if ((activeTab === 'enquiry' && enquirySubTab === 'sent')) {
      return item.status === 'Sent' || item.status === 'Pending';
    } else if (activeTab === 'received') {
      return item.status === 'Received' || item.status === 'Approved' || item.status === 'Rejected';
    } else if (activeTab === 'review') {
      return ['Received', 'Approved', 'Hold', 'Rejected', 'Submitted', 'Sent'].includes(item.status);
    }
    return true;
  });

  return (
    <div className="application-dispatch-container">
      {/* Review-before-send reminder */}
      <div style={{ background: '#ecfeff', border: '1px solid #67e8f9', borderLeft: '4px solid #06b6d4', padding: '10px 14px', borderRadius: 8, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#155e75', fontWeight: 600 }} title="Click the eye icon on any application to review the full details before dispatching">
        <span aria-hidden="true">👁️</span>
        <span><strong>Review before sending:</strong> Open each application with the View (👁) icon, verify the details, then use Send. The application carries the full audit trail.</span>
      </div>
      {notification && (
        <div className="notification-toast">
           <CheckCircle size={18} /> {notification}
        </div>
      )}

      <div className="scope-header" style={{ flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div>
            <h1>Application</h1>
            <p>Manage sent, received, and review audit applications</p>
          </div>
          
          <div className="header-actions" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
             {/* Global Search Bar — hidden on the Client Enquiry tab (it has its own filters) */}
             {!(activeTab === 'enquiry' && enquirySubTab === 'enquiries') && (
               <div className="search-container" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={18} style={{ position: 'absolute', left: '10px', color: '#6b7280' }} />
                  <input
                    type="text"
                    placeholder="Search applications..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      padding: '8px 12px 8px 36px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      width: '250px',
                      outline: 'none'
                    }}
                  />
               </div>
             )}
             
             {/* Templates + 'Sent Application' header buttons removed per requirement */}
          </div>
        </div>

        {/* Top-level tabs: Client Enquiry / Receive / Review */}
        <div className="toggle-switch-container" style={{ flex: '1 1 auto' }}>
            <div
                className="toggle-indicator"
                style={{
                  width: 'calc(33.33% - 4px)',
                  left:
                    activeTab === 'enquiry'
                      ? '4px'
                      : activeTab === 'received'
                      ? 'calc(33.33% + 2px)'
                      : 'calc(66.66% - 2px)',
                }}
            />
            <button
                className={`toggle-option ${activeTab === 'enquiry' ? 'active' : ''}`}
                onClick={() => { setActiveTab('enquiry'); }}
            >
                Client Enquiry
                {tabCounts.newEnquiries > 0 && <TabBadge color="#dc2626" value={tabCounts.newEnquiries} />}
            </button>
            <button
                className={`toggle-option ${activeTab === 'received' ? 'active' : ''}`}
                onClick={() => setActiveTab('received')}
            >
                Receive Application
                {tabCounts.recentlyReceived > 0 && <TabBadge color="#0ea5e9" value={tabCounts.recentlyReceived} />}
            </button>
            <button
                className={`toggle-option ${activeTab === 'review' ? 'active' : ''}`}
                onClick={() => setActiveTab('review')}
            >
                Review Application
                {tabCounts.awaitingReview > 0 && <TabBadge color="#f59e0b" value={tabCounts.awaitingReview} />}
            </button>
        </div>
      </div>

      {/* Nested sub-tab strip — visible only when on the Client Enquiry tab */}
      {activeTab === 'enquiry' && (
        <div
          style={{
            display: 'inline-flex',
            background: '#f1f5f9',
            padding: 4,
            borderRadius: 10,
            gap: 2,
            margin: '14px 0 4px',
          }}
        >
          {([
            { key: 'enquiries', label: 'Enquiries' },
            { key: 'sent', label: 'Sent Application' },
          ] as const).map((s) => (
            <button
              key={s.key}
              onClick={() => setEnquirySubTab(s.key)}
              style={{
                background: enquirySubTab === s.key ? '#fff' : 'transparent',
                color: enquirySubTab === s.key ? '#0f172a' : '#64748b',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: enquirySubTab === s.key ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Client Enquiry tab — embeds the standalone Client Enquiry surface */}
      {activeTab === 'enquiry' && enquirySubTab === 'enquiries' && (
        <div style={{ marginTop: 16 }}>
          <ClientEnquiry />
        </div>
      )}

      {/* Sent Application Form */}
      {activeTab !== 'enquiry' && showForm && (
        <div className="scope-form">
          <h3>{editingId ? 'Edit Record' : 'Sent Application Details'}</h3>
          
          <form onSubmit={handleSubmit}>
            {/* ROW 1: Organization then Name */}
            <div className="form-row">
                <div className="form-group">
                  <label>Organization</label>
                  <input 
                    name="organization" 
                    value={formData.organization} 
                    onChange={handleFormChange} 
                    type="text" 
                    placeholder="Enter organization" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Name (Contact Person)</label>
                  <input 
                    name="clientName" 
                    value={formData.clientName} 
                    onChange={handleFormChange} 
                    type="text" 
                    placeholder="Enter name" 
                    required 
                  />
                </div>
            </div>
            
            {/* ROW 2: Mobile Number then Email */}
            <div className="form-row">
              <div className="form-group">
                <label>Mobile Number</label>
                <input 
                  name="mobile" 
                  value={formData.mobile} 
                  onChange={handleFormChange} 
                  type="tel" 
                  placeholder="Enter mobile number" 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input 
                  name="email" 
                  value={formData.email} 
                  onChange={handleFormChange} 
                  type="email" 
                  placeholder="client@example.com" 
                  required 
                />
              </div>
            </div>

            {/* ROW 3: Standard then Status */}
            <div className="form-row">
                <div className="form-group">
                    <label>Standard</label>
                    <StandardPicker
                      value={formData.standard}
                      onChange={(v) => setFormData((prev: any) => ({ ...prev, standard: v }))}
                      required
                      placeholder="Select a standard"
                    />
                </div>
                <div className="form-group">
                    <label>Status</label>
                    <select name="status" value={formData.status} onChange={handleFormChange} required>
                    <option value="Sent">Sent</option>
                    <option value="Pending">Pending</option>
                    </select>
                </div>
            </div>

            {/* ROW 4: Application Link & Attachment */}
            <div className="form-group">
              <label>Application Link & Attachment</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div className="input-with-icon" style={{ flex: 1, position: 'relative' }}>
                    <input 
                        name="link" 
                        value={formData.link} 
                        onChange={handleFormChange} 
                        type="text" 
                        style={{ width: '100%', paddingLeft: 34 }}
                        placeholder="Document name or Link..."
                    />
                    <Paperclip size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                </div>
                
                <button 
                    type="button" 
                    className="doc-attachment-btn" 
                    style={{ background: '#1FA463' }} 
                    onClick={handleOpenDrive}
                    title="Open Google Drive to select files"
                >
                    <HardDrive size={16} />
                    <span>Google Drive</span>
                </button>

                <button 
                    type="button" 
                    className="doc-attachment-btn" 
                    title="Open Word Document Template" 
                    onClick={() => handleOpenDocument(formData.link)}
                >
                    <FileText size={16} />
                    <span>Open Word Doc</span>
                </button>
              </div>
            </div>

            {/* ROW 5: Date Field (Moved to bottom) */}
            <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input 
                    name="dispatchedDate" 
                    value={formData.dispatchedDate} 
                    onChange={handleFormChange} 
                    type="date" 
                    required 
                  />
                </div>
                <div className="form-group"></div>
            </div>

            <div className="form-actions" style={{ marginTop: '20px' }}>
              <button type="submit" className="submit-btn">
                {editingId ? 'Submit' : 'Add'}
              </button>
              <button type="button" className="cancel-btn" onClick={handleCancel}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Tables based on Active Tab — hidden on the Client Enquiry tab */}
      {!(activeTab === 'enquiry' && enquirySubTab === 'enquiries') && (
      <div className="checklists-table-wrap">
        <div className="table-wrap">
          <table className="checklists-table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Organization</th>
                {activeTab === 'review' && <th>Contact Name</th>}
                {((activeTab === 'enquiry' && enquirySubTab === 'sent') || activeTab === 'received' || activeTab === 'review') && <th>Email</th>}
                <th>{activeTab === 'review' ? 'Application Review Date' : 'Application Date'}</th>
                {((activeTab === 'enquiry' && enquirySubTab === 'sent') || activeTab === 'received' || activeTab === 'review') && <th>Application Status</th>}
                {(activeTab === 'enquiry' && enquirySubTab === 'sent') && <th>Application Attachment</th>}
                {(activeTab === 'enquiry' && enquirySubTab === 'sent') && <th>Agreement</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDispatches.length === 0 ? (
                  <tr>
                      <td colSpan={activeTab === 'review' ? 7 : ((activeTab === 'enquiry' && enquirySubTab === 'sent') ? 7 : 5)} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                          No {activeTab} applications found matching "{searchTerm}".
                      </td>
                  </tr>
              ) : (
                filteredDispatches.map((item) => (
                    <tr key={item.id}>
                    <td><strong>{item.clientName}</strong></td>
                    <td>{item.organization}</td>
                    {activeTab === 'review' && (
                      <td>{item.contactName || item.clientName}</td>
                    )}
                    {((activeTab === 'enquiry' && enquirySubTab === 'sent') || activeTab === 'received' || activeTab === 'review') && <td>{item.email}</td>}
                    <td>{activeTab === 'review' ? (item.reviewDate || item.dispatchedDate) : item.dispatchedDate}</td>
                    {(activeTab === 'review') && (
                      <td>
                        <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => updateStatus(item.id, 'Approved')}
                            title="Approve application"
                            style={{
                              padding: '4px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 14,
                              border: '1px solid ' + (item.status === 'Approved' ? '#16a34a' : '#cbd5e1'),
                              background: item.status === 'Approved' ? '#16a34a' : '#fff',
                              color: item.status === 'Approved' ? '#fff' : '#475569',
                              cursor: 'pointer',
                            }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(item.id, 'Hold')}
                            title="Put on hold"
                            style={{
                              padding: '4px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 14,
                              border: '1px solid ' + (item.status === 'Hold' ? '#f59e0b' : '#cbd5e1'),
                              background: item.status === 'Hold' ? '#f59e0b' : '#fff',
                              color: item.status === 'Hold' ? '#fff' : '#475569',
                              cursor: 'pointer',
                            }}
                          >
                            Hold
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(item.id, 'Rejected')}
                            title="Reject application"
                            style={{
                              padding: '4px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 14,
                              border: '1px solid ' + (item.status === 'Rejected' ? '#dc2626' : '#cbd5e1'),
                              background: item.status === 'Rejected' ? '#dc2626' : '#fff',
                              color: item.status === 'Rejected' ? '#fff' : '#475569',
                              cursor: 'pointer',
                            }}
                          >
                            Rejected
                          </button>
                        </div>
                      </td>
                    )}
                    {((activeTab === 'enquiry' && enquirySubTab === 'sent') || activeTab === 'received') && (
                      <td>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => updateStatus(item.id, activeTab === 'received' ? 'Received' : 'Submitted')}
                            title={activeTab === 'received' ? 'Mark as Received' : 'Mark as Submitted'}
                            style={{
                              padding: '4px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 14,
                              border: '1px solid ' + ((item.status === 'Submitted' || item.status === 'Sent' || item.status === 'Approved') ? '#16a34a' : '#cbd5e1'),
                              background: (item.status === 'Submitted' || item.status === 'Sent' || item.status === 'Approved') ? '#16a34a' : '#fff',
                              color: (item.status === 'Submitted' || item.status === 'Sent' || item.status === 'Approved') ? '#fff' : '#475569',
                              cursor: 'pointer',
                            }}
                          >
                            {activeTab === 'received' ? 'Received' : 'Submitted'}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(item.id, 'Pending')}
                            title="Mark as Pending"
                            style={{
                              padding: '4px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 14,
                              border: '1px solid ' + (item.status === 'Pending' || item.status === 'Received' ? '#f59e0b' : '#cbd5e1'),
                              background: (item.status === 'Pending' || item.status === 'Received') ? '#f59e0b' : '#fff',
                              color: (item.status === 'Pending' || item.status === 'Received') ? '#fff' : '#475569',
                              cursor: 'pointer',
                            }}
                          >
                            Pending
                          </button>
                        </div>
                      </td>
                    )}
                    {(activeTab === 'enquiry' && enquirySubTab === 'sent') && (
                      <td>
                        <FileCell
                          file={item.attachment}
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                          label="Application"
                          onUpload={(f) => handleUploadFile(item.id, 'attachment', f)}
                          onClear={() => handleClearFile(item.id, 'attachment')}
                        />
                      </td>
                    )}
                    {(activeTab === 'enquiry' && enquirySubTab === 'sent') && (
                      <td>
                        <FileCell
                          file={item.agreement}
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                          label="Agreement"
                          onUpload={(f) => handleUploadFile(item.id, 'agreement', f)}
                          onClear={() => handleClearFile(item.id, 'agreement')}
                        />
                      </td>
                    )}
                    <td>
                        <div className="action-buttons">
                            {/* Actions for SENT Tab */}
                            {(activeTab === 'enquiry' && enquirySubTab === 'sent') && (
                                <>
                                    <button
                                      className="link-btn"
                                      title={loadQCSRecord(item.id)?.submittedAt ? 'View client\'s submitted QCS form' : 'Preview / open QCS application form for this client'}
                                      onClick={() => setQcsFormFor({ id: item.id, mode: loadQCSRecord(item.id)?.submittedAt ? 'view' : 'preview' })}
                                      style={{ color: loadQCSRecord(item.id)?.submittedAt ? '#16a34a' : '#7c3aed' }}
                                    >
                                      <FileText size={16} />
                                    </button>
                                    <button className="link-btn" title="Edit" onClick={() => handleEdit(item)}>
                                        <Edit2 size={16} />
                                    </button>
                                    <button className="link-btn success" title="Review and send application" onClick={() => openSendReviewModal(item.id)}>
                                        <Send size={16} />
                                    </button>
                                    <button className="link-btn danger" title="Delete" onClick={() => handleDelete(item.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            )}

                            {/* Actions for RECEIVED Tab */}
                            {activeTab === 'received' && (
                                <>
                                    <button className="link-btn" title="View Application Details" onClick={() => handleOpenDocument(item.link || DEFAULT_LINK)}>
                                        <Eye size={16} />
                                    </button>
                                    <button className="link-btn danger" title="Delete" onClick={() => handleDelete(item.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            )}

                            {/* Actions for REVIEW Tab */}
                            {activeTab === 'review' && (
                                <>
                                    <button className="link-btn" title="View Details" onClick={() => handleOpenDocument(item.link || DEFAULT_LINK)}>
                                        <Eye size={16} />
                                    </button>
                                    <button 
                                        className="doc-attachment-btn" 
                                        style={{ padding: '6px 12px', fontSize: '12px' }}
                                        onClick={() => openReviewModal(item.id)}
                                    >
                                        <CheckSquare size={14} /> Submit
                                    </button>
                                </>
                            )}
                        </div>
                    </td>
                    </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Bulk Dispatch Modal */}
      {bulkOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: 600, maxWidth: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Send size={18} /> Bulk Dispatch — {selectedIds.size} recipient{selectedIds.size === 1 ? '' : 's'}
              </h3>
              <button onClick={() => setBulkOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="#64748b" />
              </button>
            </div>
            <div className="form-group">
              <label>Template</label>
              <select
                value={bulkTemplateId}
                onChange={(e) => handleBulkTemplateChange(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
              >
                <option value="">— Custom message —</option>
                {dispatchTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <small style={{ color: '#64748b', fontSize: 11 }}>
                Tokens like {'{{contactName}}'} expand per recipient.
              </small>
            </div>
            <div className="form-group">
              <label>Subject</label>
              <input
                value={bulkSubject}
                onChange={(e) => setBulkSubject(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
              />
            </div>
            <div className="form-group">
              <label>Body</label>
              <textarea
                rows={7}
                value={bulkBody}
                onChange={(e) => setBulkBody(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="cancel-btn" onClick={() => setBulkOpen(false)}>Cancel</button>
              <button className="submit-btn" onClick={handleBulkSend} disabled={!bulkSubject.trim()}>
                <Send size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Send to {selectedIds.size}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {tplEditorOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setTplEditorOpen(false); }}>
          <EmailTemplateEditor
            tag="dispatch"
            sampleVars={{
              clientName: 'Sample Org',
              contactName: 'Jane Doe',
              standard: 'ISO 9001:2015',
              clientCode: 'CMS-2025-0009',
              dueDate: '2026-05-15',
              senderName: 'Audit Coordinator',
            }}
            onClose={() => setTplEditorOpen(false)}
          />
        </div>
      )}

      {/* Send Review Confirmation Modal */}
      {sendConfirmOpen && sendConfirmId != null && (() => {
        const item = dispatches.find((d) => d.id === sendConfirmId);
        return item ? (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 540 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                 <h3 style={{ margin: 0 }}>Review & Send Application</h3>
                 <button onClick={() => setSendConfirmOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#64748b" /></button>
              </div>
              <div style={{ marginBottom: 16, color: '#334155' }}>
                Please review the application details before sending it to the client.
              </div>
              <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: '#475569' }}><strong>Client:</strong> {item.clientName}</div>
                <div style={{ fontSize: 13, color: '#475569' }}><strong>Organisation:</strong> {item.organization}</div>
                <div style={{ fontSize: 13, color: '#475569' }}><strong>Email:</strong> {item.email}</div>
                <div style={{ fontSize: 13, color: '#475569' }}><strong>Application Link:</strong> {item.link}</div>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#334155' }}>Review note (optional)</label>
                <textarea
                  value={sendReviewNote}
                  onChange={(e) => setSendReviewNote(e.target.value)}
                  placeholder="Document anything important before sending..."
                  rows={4}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="cancel-btn" onClick={() => setSendConfirmOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="submit-btn" onClick={handleConfirmSend}>
                  Send application
                </button>
              </div>
            </div>
          </div>
        ) : null;
      })()}

      {/* Review Submit Modal */}
      {reviewModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
               <h3 style={{ margin: 0 }}>Review Application</h3>
               <button onClick={() => setReviewModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#64748b" /></button>
            </div>
            
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#334155' }}>Decision</label>
              <select 
                value={reviewStatus} 
                onChange={(e) => setReviewStatus(e.target.value as any)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="Approved">Approved</option>
                <option value="Rejected">Not Approved</option>
              </select>
            </div>

            {reviewStatus === 'Rejected' && (
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#334155' }}>Why Rejected? (Note)</label>
                <textarea 
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Enter the reason for rejection..."
                  rows={4}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                  required
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button 
                type="button" 
                className="cancel-btn" 
                onClick={() => setReviewModalOpen(false)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="submit-btn" 
                onClick={handleReviewSubmit}
                disabled={reviewStatus === 'Rejected' && !reviewNote.trim()}
              >
                Submit Decision
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .toggle-switch-container {
            display: flex;
            background: #f1f5f9;
            border-radius: 8px;
            padding: 4px;
            width: 500px;
            border: 1px solid #e2e8f0;
            position: relative;
        }
        .toggle-indicator {
            position: absolute;
            top: 4px;
            width: calc(33.33% - 4px);
            height: calc(100% - 8px);
            background: white;
            border-radius: 6px;
            box-shadow: 0 2px 4px rgba(15,23,42,0.06);
            transition: left 0.3s ease;
            z-index: 1;
        }
        .toggle-option {
            flex: 1;
            padding: 8px 0;
            text-align: center;
            border-radius: 6px;
            font-weight: 500;
            font-size: 14px;
            color: #64748b;
            cursor: pointer;
            border: none;
            background: transparent;
            z-index: 2;
            transition: color 0.3s;
        }
        .toggle-option.active {
            color: #0f172a;
            font-weight: 600;
        }
        .notification-toast {
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #27ae60;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
            font-weight: 500;
        }
        .doc-attachment-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            background-color: #0284c7; 
            color: white;
            border: none;
            padding: 9px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            font-size: 13px;
            transition: background 0.2s;
            white-space: nowrap;
        }
        .doc-attachment-btn:hover {
            opacity: 0.9;
        }
        .input-with-icon input:focus {
             border-color: #3b82f6;
             outline: none;
             box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }
        
        /* Modal Styles */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(15, 23, 42, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        .modal-content {
            background: white;
            padding: 24px;
            border-radius: 12px;
            width: 450px;
            max-width: 90%;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            animation: slideUp 0.3s ease-out;
        }

        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {qcsFormFor && (
        <QCSApplicationForm
          dispatchId={qcsFormFor.id}
          mode={qcsFormFor.mode}
          onClose={() => setQcsFormFor(null)}
        />
      )}
    </div>
  );
};

/* -----------------------------------------------------------------
   FileCell — inline file uploader / preview cell used by the
   Sent Application table for Application Attachment and Agreement.
----------------------------------------------------------------- */
interface FileCellProps {
  file?: { name: string; dataUrl: string; size: number; uploadedAt: string };
  accept: string;
  label: string;
  onUpload: (file: File) => void;
  onClear: () => void;
}

const FileCell: React.FC<FileCellProps> = ({ file, accept, label, onUpload, onClear }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const handlePick = () => inputRef.current?.click();
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onUpload(f);
    if (inputRef.current) inputRef.current.value = '';
  };
  const formatSize = (n: number) => {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={onChange}
      />
      {file ? (
        <>
          <a
            href={file.dataUrl}
            download={file.name}
            target="_blank"
            rel="noreferrer"
            title={`${file.name} · ${formatSize(file.size)}`}
            style={{
              fontSize: 12,
              color: '#1d4ed8',
              fontWeight: 500,
              maxWidth: 130,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Paperclip size={12} /> {file.name}
          </a>
          <button
            type="button"
            onClick={handlePick}
            title={`Replace ${label.toLowerCase()}`}
            style={{
              padding: '3px 8px',
              fontSize: 11,
              borderRadius: 4,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            Replace
          </button>
          <button
            type="button"
            onClick={onClear}
            title={`Remove ${label.toLowerCase()}`}
            style={{
              padding: '3px 6px',
              fontSize: 11,
              borderRadius: 4,
              border: '1px solid #fecaca',
              background: '#fff',
              color: '#b91c1c',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handlePick}
          style={{
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            border: '1px dashed #cbd5e1',
            background: '#f8fafc',
            color: '#475569',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <HardDrive size={12} /> Upload
        </button>
      )}
    </div>
  );
};

const TabBadge: React.FC<{ value: number; color: string }> = ({ value, color }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 18,
      height: 18,
      padding: '0 6px',
      marginLeft: 8,
      background: color,
      color: '#fff',
      borderRadius: 9,
      fontSize: 11,
      fontWeight: 700,
      lineHeight: 1,
    }}
    aria-label={`${value} new`}
  >
    {value > 99 ? '99+' : value}
  </span>
);

export default ApplicationDispatch;