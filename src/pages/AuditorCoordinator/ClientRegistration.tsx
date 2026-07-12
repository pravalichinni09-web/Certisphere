import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Eye, Edit2, Download, Trash2, CheckCircle, Upload, Mail, Search, ImageIcon, AlertTriangle, Sparkles, X } from 'lucide-react';
import StandardPicker from '../../components/StandardPicker';
import { ensureCredentialsForClients } from './utils/clientCredentials';
import { validateGstin, validateCin, validatePan, validateEmail, validatePhone } from '../../utils/validators';
import { allocateClientCode } from '../../utils/clientCode';
import { detectDuplicates, DuplicateCandidate } from '../../utils/duplicateDetect';
import AIPanel from '../../components/AIPanel';
import { validateRegistrations } from '../../ai/coordinatorInsights';
import type { RegistrationIssue } from '../../ai/coordinatorInsights';
import { getDispatches, onCmsChange } from '../../ai/liveData';
import '../../styles/AuditorCoordinator/ClientRegistration.css';

interface ClientData {
  id: number;
  clientCode?: string;
  organizationName: string;
  contactPerson: string;
  registrationNumber: string;
  clientType: string;
  standard: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
  attachment?: string;
  agreement?: string;
  logo?: string;        // base64 data URL
  gstin?: string;
  cin?: string;
  pan?: string;
  submittedAt?: string;        // ISO — when the registration was emailed to client
  clientRespondedAt?: string;  // ISO — when client replied / approved
  clientResponseNote?: string; // free-text reply from the client
}

// Storage Keys
const DISPATCH_STORAGE_KEY = 'cms_application_dispatch_v7';
const LOCAL_STORAGE_KEY = 'cms_client_registrations';

// --- Default Data Fallback ---
const defaultClients: ClientData[] = [
  { id: 1, clientCode: 'CMS-2025-0001', organizationName: 'Green Energy Solutions', contactPerson: 'John Doe', registrationNumber: 'REG-2025-001', clientType: 'Initial Certification', standard: 'ISO 9001:2015', status: 'Registered', email: 'info@greenenergy.com', phone: '9876543210', address: '123 Green Way, NY' },
  { id: 2, clientCode: 'CMS-2025-0002', organizationName: 'Tech Innovations Ltd', contactPerson: 'Sarah Smith', registrationNumber: 'REG-2025-002', clientType: 'Initial Certification', standard: 'ISO 27001:2022', status: 'Pending', email: 'contact@techinnovations.com', phone: '9876543211', address: '456 Tech Park, CA' },
  { id: 6, clientCode: 'CMS-2025-0003', organizationName: 'AutoParts Manufacturing', contactPerson: 'Jennifer Taylor', registrationNumber: 'REG-2025-006', clientType: 'Surveillance 1', standard: 'ISO 9001:2015', status: 'Client Approved', email: 'j.taylor@autoparts.com', phone: '9876543212', address: '789 Auto Ave, MI' },
  { id: 3, clientCode: 'CMS-2025-0004', organizationName: 'SkyHigh Construction', contactPerson: 'Michael Brown', registrationNumber: 'REG-2025-003', clientType: 'Surveillance 1', standard: 'ISO 45001:2018', status: 'Registered', email: 'mbrown@skyhigh.com', phone: '9876543213', address: '101 Sky Blvd, TX' },
  { id: 7, clientCode: 'CMS-2025-0005', organizationName: 'Chemical Bros Ltd', contactPerson: 'Robert Miller', registrationNumber: 'REG-2025-007', clientType: 'Surveillance 2', standard: 'ISO 14001:2015', status: 'Pending', email: 'safety@chembros.com', phone: '9876543214', address: '202 Chem Road, OH' },
  { id: 4, clientCode: 'CMS-2025-0006', organizationName: 'Fresh Foods Packers', contactPerson: 'Emily Davis', registrationNumber: 'REG-2025-004', clientType: 'Surveillance 2', standard: 'ISO 22000:2018', status: 'Registered', email: 'quality@freshfoods.com', phone: '9876543215', address: '303 Food Court, FL' },
  { id: 8, clientCode: 'CMS-2025-0007', organizationName: 'HealthFirst Hospital', contactPerson: 'Lisa Anderson', registrationNumber: 'REG-2025-008', clientType: 'Transfer', standard: 'ISO 9001:2015', status: 'Client Approved', email: 'admin@healthfirst.org', phone: '9876543216', address: '404 Health Way, MA' },
  { id: 5, clientCode: 'CMS-2025-0008', organizationName: 'CyberSecure Systems', contactPerson: 'David Wilson', registrationNumber: 'REG-2025-005', clientType: 'Transfer', standard: 'ISO 27001:2022', status: 'Pending', email: 'david.w@cybersecure.io', phone: '9876543217', address: '505 Cyber Lane, WA' }
];

const MAX_LOGO_BYTES = 250 * 1024; // 250 KB

/* ------------------------------------------------------------------
   AI — Application Auto-Fill & Validation panel (Feature 5)
------------------------------------------------------------------ */

const RegistrationValidationPanel: React.FC<{ clients: ClientData[] }> = ({ clients }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => onCmsChange(() => setTick((t) => t + 1)), []);

  const issues = useMemo<RegistrationIssue[]>(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => validateRegistrations(clients as any[], getDispatches()),
    [clients, tick]
  );
  const highCount = issues.filter((i) => i.severity === 'high').length;

  return (
    <AIPanel
      title="Application Validation"
      subtitle="GSTIN / PAN / CIN formats, missing contacts and duplicates across registrations & dispatches"
      onRefresh={() => setTick((t) => t + 1)}
    >
      {issues.length === 0 ? (
        <p className="ai-panel-note">All registrations look clean — no format issues, gaps or duplicates found.</p>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: '#475569' }}>
            {issues.length} issue{issues.length !== 1 ? 's' : ''} found across {clients.length} registration{clients.length !== 1 ? 's' : ''}
            {highCount > 0 ? <> — <strong style={{ color: '#b91c1c' }}>{highCount} high severity</strong></> : null}.
          </div>
          <ul className="ai-insight-list">
            {issues.slice(0, 12).map((iss, i) => (
              <li key={`${iss.clientId}-${iss.field}-${i}`}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span className={'ai-chip ' + iss.severity}>{iss.severity}</span>
                  <span className="ai-chip info">{iss.field}</span>
                  <strong style={{ fontSize: 12.5, color: '#0f172a' }}>{iss.organization}</strong>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{iss.reason}</div>
              </li>
            ))}
          </ul>
          {issues.length > 12 && (
            <p className="ai-panel-note">Showing the top 12 of {issues.length} issues, ranked by severity.</p>
          )}
        </>
      )}
      <p className="ai-panel-note">Recomputed live from current registrations and application dispatches.</p>
    </AIPanel>
  );
};

const ClientRegistration: React.FC = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [logoError, setLogoError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    clientCode: '',
    organizationName: '',
    contactPerson: '',
    registrationNumber: '',
    clientType: 'Initial Certification',
    standard: 'ISO 9001:2015',
    status: 'Pending',
    email: '',
    phone: '',
    address: '',
    attachment: '' as string,
    agreement: '' as string,
    logo: '' as string,
    gstin: '',
    cin: '',
    pan: '',
  });

  useEffect(() => { loadClients(); }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const loadClients = () => {
    try {
      const localRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
      let localClients: ClientData[] = localRaw ? JSON.parse(localRaw) : defaultClients;

      const dispatchRaw = localStorage.getItem(DISPATCH_STORAGE_KEY);
      if (dispatchRaw) {
        const dispatchRecords: any[] = JSON.parse(dispatchRaw);
        const receivedApps = dispatchRecords.filter(
          (d: any) => d.status === 'Received' || d.status === 'Approved'
        );

        const mergedClients = receivedApps.map((app: any) => {
          const existing = localClients.find(c => c.id === app.id);
          if (existing) return existing;
          return {
            id: app.id,
            organizationName: app.organization || 'Unknown Org',
            contactPerson: app.clientName || 'Unknown Contact',
            registrationNumber: `REG-2025-${String(app.id).padStart(3, '0')}`,
            clientType: app.auditType || 'Initial Certification',
            standard: app.standard || 'ISO 9001:2015',
            email: app.email,
            phone: app.mobile || '',
            address: app.address || '',
            status: 'Pending',
            attachment: '',
          };
        });

        const allClients = [...mergedClients];
        localClients.forEach(lc => {
          if (!allClients.find(mc => mc.id === lc.id)) allClients.push(lc);
        });

        setClients(allClients);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allClients));
        ensureCredentialsForClients(allClients);
      } else {
        setClients(localClients);
        ensureCredentialsForClients(localClients);
      }
    } catch (e) {
      console.error('Failed to load data', e);
    }
  };

  const persist = (items: ClientData[]) => {
    setClients(items);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    ensureCredentialsForClients(items);
  };

  // ---------- Validation memos ----------
  const gstinResult = useMemo(() => formData.gstin ? validateGstin(formData.gstin) : { ok: true }, [formData.gstin]);
  const cinResult = useMemo(() => formData.cin ? validateCin(formData.cin) : { ok: true }, [formData.cin]);
  const panResult = useMemo(() => formData.pan ? validatePan(formData.pan) : { ok: true }, [formData.pan]);
  const emailResult = useMemo(() => formData.email ? validateEmail(formData.email) : { ok: true }, [formData.email]);
  const phoneResult = useMemo(() => formData.phone ? validatePhone(formData.phone) : { ok: true }, [formData.phone]);

  // ---------- Duplicate detection ----------
  const duplicates: DuplicateCandidate[] = useMemo(() => {
    if (!formData.email && !formData.phone) return [];
    const haystack = clients
      .filter(c => c.id !== editingId)
      .map(c => ({ id: c.id, label: c.organizationName, email: c.email, phone: c.phone }));
    return detectDuplicates({ email: formData.email, phone: formData.phone }, haystack);
  }, [formData.email, formData.phone, clients, editingId]);

  // ---------- Handlers ----------
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target as any;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, attachment: e.target.files![0].name }));
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('Logo must be an image file (PNG, JPG, SVG, etc.)');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(`Logo too large (${Math.round(file.size / 1024)} KB). Max ${Math.round(MAX_LOGO_BYTES / 1024)} KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, logo: String(reader.result || '') }));
    };
    reader.onerror = () => setLogoError('Could not read file. Please try again.');
    reader.readAsDataURL(file);
  };

  const handleClearLogo = () => {
    setFormData(prev => ({ ...prev, logo: '' }));
    setLogoError(null);
  };

  const handleAutoCode = () => {
    const code = allocateClientCode();
    setFormData(prev => ({ ...prev, clientCode: code }));
    setNotification(`Client code ${code} generated`);
  };

  const openCreateForm = () => {
    setFormData({
      clientCode: '',
      organizationName: '',
      contactPerson: '',
      registrationNumber: '',
      clientType: 'Initial Certification',
      standard: 'ISO 9001:2015',
      status: 'Pending',
      email: '',
      phone: '',
      address: '',
      attachment: '',
      agreement: '',
      logo: '',
      gstin: '',
      cin: '',
      pan: '',
    });
    setLogoError(null);
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (item: ClientData) => {
    setEditingId(item.id);
    setFormData({
      clientCode: item.clientCode || '',
      organizationName: item.organizationName,
      contactPerson: item.contactPerson,
      registrationNumber: item.registrationNumber,
      clientType: item.clientType || 'Initial Certification',
      standard: item.standard,
      status: item.status || 'Pending',
      email: item.email || '',
      phone: item.phone || '',
      address: item.address || '',
      attachment: item.attachment || '',
      agreement: item.agreement || '',
      logo: item.logo || '',
      gstin: item.gstin || '',
      cin: item.cin || '',
      pan: item.pan || '',
    });
    setLogoError(null);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    persist(clients.filter(c => c.id !== id));
    setNotification('Client deleted successfully');
  };

  const handleSubmitToEmail = (client: ClientData) => {
    const to = client.email || '';
    if (!to) {
      setNotification('Add an email address before submitting to the client.');
      return;
    }
    const subject = encodeURIComponent(
      `Registration & Certification Contract — ${client.organizationName}`
    );
    const body = encodeURIComponent(
      [
        `Dear ${client.contactPerson || 'Client'},`,
        '',
        `Please find your registration details for ${client.organizationName} below.`,
        '',
        `Client Code:   ${client.clientCode || '—'}`,
        `Audit Type:    ${client.clientType}`,
        `Standard:      ${client.standard}`,
        `Audit Status:  ${client.status || 'Pending'}`,
        '',
        'Reply to this email with your confirmation. Once confirmed, we will set the audit status to Approved and proceed.',
        '',
        'Best regards,',
        'Audit Coordinator',
        'Qmics Certification',
      ].join('\n')
    );
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, '_blank');
    const submittedAt = new Date().toISOString();
    const next = clients.map((c) =>
      c.id === client.id ? { ...c, submittedAt } : c
    );
    setClients(next);
    try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next)); } catch {}
    setNotification(`Registration emailed to ${to}. Awaiting client reply.`);
  };

  const forwardToManagement = (client: ClientData) => {
    if (!window.confirm(`Forward ${client.organizationName} to Management for onboarding approval?`)) return;
    try {
      const key = 'cms_client_onboarding_v1';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      // De-dupe by id
      const next = existing.filter((x: any) => x.id !== client.id);
      next.unshift({
        id: client.id,
        organizationName: client.organizationName,
        contactPerson: client.contactPerson,
        email: client.email,
        phone: client.phone,
        country: (client as any).country || 'India',
        industry: (client as any).industry || 'Other',
        standard: client.standard,
        status: 'Pending Review',
        forwardedBy: 'Praveen Gangarapu (Coordinator)',
        forwardedAt: new Date().toISOString(),
        coordinatorNote: `Application reviewed by Coordinator. ${client.clientType} for ${client.standard}.`,
      });
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('cms-workflow-handoff'));
      setNotification(`${client.organizationName} forwarded to Management for onboarding approval.`);
    } catch (e) {
      setNotification('Could not forward — try again.');
    }
  };

    const handleClientApproved = (client: ClientData) => {
    const note = window.prompt(
      `Confirm: ${client.contactPerson || client.organizationName} replied with approval.\n\nOptional note from the client:`,
      ''
    );
    if (note === null) return;
    const respondedAt = new Date().toISOString();
    const next = clients.map((c) =>
      c.id === client.id
        ? {
            ...c,
            status: 'Approved',
            clientRespondedAt: respondedAt,
            clientResponseNote: (note || '').trim() || undefined,
          }
        : c
    );
    setClients(next);
    try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next)); } catch {}
    setNotification(`${client.organizationName} marked as Approved by client.`);
  };

  // View functionality - shows logo and statutory IDs in the document
  const handleView = (client: ClientData) => {
    const logoBlock = client.logo
      ? `<img src="${client.logo}" alt="logo" style="max-height: 60px; max-width: 180px; margin-bottom: 12px;" />`
      : '';
    const docContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset="utf-8"><title>Application For Certification</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 11pt; margin: 40px; }
        .header { text-align: center; font-weight: bold; font-size: 16pt; margin-bottom: 5px; }
        .sub-header { text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 20px; }
        .address { text-align: center; font-size: 10pt; margin-bottom: 30px; border-bottom: 1px solid #000; padding-bottom: 10px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .table td { padding: 8px; border: 1px solid #000; vertical-align: top; }
        .bold { font-weight: bold; background-color: #f2f2f2; width: 40%; }
        .section-title { font-weight: bold; text-decoration: underline; margin-top: 20px; margin-bottom: 10px; }
      </style></head>
      <body>
        <div style="text-align:center;">${logoBlock}</div>
        <div class="header">CMS Management Pvt. Ltd.</div>
        <div class="sub-header">Application for Certification</div>
        <div class="address">Regd. Office: 37 E/1(310) 2nd Street, Modern park, Santoshpur, Kolkata-700075. West Bengal, India.</div>
        <div class="section-title">Client Information Details</div>
        <table class="table">
          <tr><td class="bold">Client Code</td><td>${client.clientCode || 'N/A'}</td></tr>
          <tr><td class="bold">Organization Name</td><td>${client.organizationName}</td></tr>
          <tr><td class="bold">Contact Person Name</td><td>${client.contactPerson}</td></tr>
          <tr><td class="bold">Registration Number</td><td>${client.registrationNumber}</td></tr>
          <tr><td class="bold">GSTIN</td><td>${client.gstin || 'N/A'}</td></tr>
          <tr><td class="bold">CIN</td><td>${client.cin || 'N/A'}</td></tr>
          <tr><td class="bold">PAN</td><td>${client.pan || 'N/A'}</td></tr>
          <tr><td class="bold">Application / Audit Type</td><td>${client.clientType}</td></tr>
          <tr><td class="bold">Standard / Certification Scheme</td><td>${client.standard}</td></tr>
          <tr><td class="bold">Current Status</td><td>${client.status || 'Pending'}</td></tr>
        </table>
        <div class="section-title">Contact &amp; Communication Details</div>
        <table class="table">
          <tr><td class="bold">Email Address</td><td>${client.email || 'N/A'}</td></tr>
          <tr><td class="bold">Phone / Mobile</td><td>${client.phone || 'N/A'}</td></tr>
          <tr><td class="bold">Registered Address</td><td>${client.address || 'N/A'}</td></tr>
          <tr><td class="bold">Attached Contract Document</td><td>${client.attachment || 'None'}</td></tr>
        </table>
        <br><br>
        <div style="margin-top: 30px;">
          <strong>Declaration:</strong><br>
          I acknowledge that the information provided by me is correct as per my best knowledge and the offer is based on the above information. If during assessments any variation is found, arrangements may be revised.<br><br><br>
          <table width="100%">
            <tr><td>Name of Authorized Representative: <strong>${client.contactPerson}</strong></td></tr>
            <tr><td style="padding-top: 30px;">Sign: ___________________________</td>
                <td style="padding-top: 30px;" align="right">Date: ___________________________</td></tr>
          </table>
        </div>
      </body></html>
    `;
    const blob = new Blob([docContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${client.organizationName.replace(/\s+/g, '_')}_Application.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setNotification('Opening Application Document...');
  };

  const handleDownload = (client: ClientData) => {
    const currentDate = new Date().toLocaleDateString();
    const docContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset="utf-8"><title>Certification Contract</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 12pt; margin: 40px; }
        .header { text-align: center; font-weight: bold; font-size: 16pt; margin-bottom: 10px; }
        .sub-header { text-align: center; font-weight: bold; font-size: 12pt; margin-bottom: 20px; text-decoration: underline; }
        .section { margin-bottom: 15px; }
        .bold { font-weight: bold; }
        .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .table td { padding: 5px; vertical-align: top; }
      </style></head>
      <body>
        <div class="header">CMS Management Pvt. Ltd.</div>
        <div class="sub-header">Certification Contract (Annexure 13)</div>
        <div class="section">This Contract is made on this day <strong>${currentDate}</strong> by and between:</div>
        <table class="table">
          <tr><td width="150" class="bold">Name:</td><td>${client.organizationName}</td></tr>
          <tr><td class="bold">Client Code:</td><td>${client.clientCode || 'N/A'}</td></tr>
          <tr><td class="bold">Contact Person:</td><td>${client.contactPerson}</td></tr>
          <tr><td class="bold">Address:</td><td>${client.address || 'Address not registered'}</td></tr>
          <tr><td class="bold">GSTIN:</td><td>${client.gstin || 'N/A'}</td></tr>
          <tr><td class="bold">CIN:</td><td>${client.cin || 'N/A'}</td></tr>
          <tr><td class="bold">Scope:</td><td>${client.clientType} Activities related to ${client.standard}</td></tr>
          <tr><td class="bold">Standard:</td><td>${client.standard}</td></tr>
        </table>
        <div class="section" style="margin-top: 20px;"><strong>(here-in-after called Client)</strong></div>
        <div class="section" style="text-align: center; margin: 20px 0;"><strong>And</strong></div>
        <div class="section"><strong>CMS Management Pvt. Ltd.</strong><br>Regd. Office: 37 E/1(310) 2nd Street, Modern Park, Santoshpur, Kolkata 700075, India.<br>(here-in-after called CMS)</div>
        <div class="section">for the provision of Certification Activities as follows:</div>
        <div class="section"><strong>Article 1: Purpose of Contract</strong><br>The purpose of this contract is to describe the rights and duties of CMS and Client in performing certification Audit applied by Client as per the CMS certification requirements.</div>
        <br><br><br>
        <table width="100%" style="margin-top: 40px;">
          <tr><td align="center"><strong>(Client)</strong><br><br>__________________________<br>Signature with Stamp</td>
              <td align="center"><strong>(CMS)</strong><br><br>__________________________<br>Authorized Signatory</td></tr>
        </table>
        <div style="margin-top: 30px; font-size: 9pt; text-align: center;">ANNEX 13, ISSUE 01, REV 06 | CMS Management Pvt. Ltd.</div>
      </body></html>
    `;
    const blob = new Blob([docContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${client.organizationName.replace(/\s+/g, '_')}_Contract.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setNotification('Downloading Contract Word Document...');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Block submit on hard validation failures
    const errs: string[] = [];
    if (formData.gstin && !gstinResult.ok) errs.push(gstinResult.message || 'Invalid GSTIN');
    if (formData.cin && !cinResult.ok) errs.push(cinResult.message || 'Invalid CIN');
    if (formData.pan && !panResult.ok) errs.push(panResult.message || 'Invalid PAN');
    if (formData.email && !emailResult.ok) errs.push(emailResult.message || 'Invalid email');
    if (formData.phone && !phoneResult.ok) errs.push(phoneResult.message || 'Invalid phone');
    if (errs.length) {
      setNotification(`Cannot save: ${errs[0]}`);
      return;
    }

    const clientEmail = formData.email || 'client@example.com';
    let clientCode = formData.clientCode;
    if (!clientCode) clientCode = allocateClientCode();

    if (editingId) {
      const updated = clients.map(c => c.id === editingId ? { ...c, ...formData, clientCode } as ClientData : c);
      persist(updated);
      setEditingId(null);
      setNotification(`Client Updated & Email sent to ${clientEmail}`);
    } else {
      const numericIds = clients.map(c => Number(c.id)).filter(n => Number.isFinite(n));
      const nextId = Math.max(0, ...numericIds) + 1;
      const newItem: ClientData = { id: nextId, ...formData, clientCode };
      persist([...clients, newItem]);
      setNotification(`Client ${clientCode} Registered & Email sent to ${clientEmail}`);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      clientCode: '',
      organizationName: '',
      contactPerson: '',
      registrationNumber: '',
      clientType: 'Initial Certification',
      standard: 'ISO 9001:2015',
      status: 'Pending',
      email: '',
      phone: '',
      address: '',
      attachment: '',
      agreement: '',
      logo: '',
      gstin: '',
      cin: '',
      pan: '',
    });
    setLogoError(null);
    setShowForm(false);
  };

  const getOptions = (field: keyof ClientData) => {
    const unique = Array.from(new Set(clients.map(c => c[field]).filter(Boolean)));
    return unique as string[];
  };

  const filteredClients = clients.filter(client => {
    const searchStr = searchTerm.toLowerCase();
    return (
      client.organizationName.toLowerCase().includes(searchStr) ||
      client.contactPerson.toLowerCase().includes(searchStr) ||
      client.registrationNumber.toLowerCase().includes(searchStr) ||
      (client.clientCode || '').toLowerCase().includes(searchStr)
    );
  });

  // Inline error renderer
  const fieldError = (msg?: string) =>
    msg ? (
      <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        <AlertTriangle size={12} /> {msg}
      </div>
    ) : null;

  return (
    <div className="audit-scope-container">
      {/* Coordinator → Management onboarding flow banner */}
      <div style={{ background: 'linear-gradient(135deg, #ede9fe 0%, #f5f3ff 100%)', border: '1px solid #c4b5fd', borderLeft: '4px solid #7c3aed', padding: '10px 14px', borderRadius: 8, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#4c1d95', fontWeight: 600 }}>
        <span aria-hidden="true">🔄</span>
        <span><strong>Coordinator → Management approval flow:</strong> Clients you register here can be forwarded to Management for onboarding approval using the ↗ icon. Working models (audit types, schedules, workflow) stay under Coordinator control.</span>
      </div>
      {/* AI: registration validation & duplicate detection */}
      <RegistrationValidationPanel clients={clients} />

      {notification && (
        <div className="notification-toast" style={{
          position: 'fixed', top: 20, right: 20, background: '#10b981', color: 'white',
          padding: '12px 24px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500, animation: 'slideIn 0.3s ease-out'
        }}>
          <Mail size={18} /> {notification}
        </div>
      )}

      <div className="scope-header">
        <div>
          <h1>Client Registration</h1>
          <p>Register and manage audit clients (Synced with Received Applications)</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div className="search-container" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', color: '#6b7280' }} />
            <input
              type="text" placeholder="Search by code, name, registration..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '8px 12px 8px 36px', borderRadius: '6px', border: '1px solid #d1d5db', width: '260px', outline: 'none' }}
            />
          </div>
          <button className="add-btn" onClick={openCreateForm}>
            <Plus size={20} /> Client Registration
          </button>
        </div>
      </div>

      {showForm && (
        <div className="scope-form">
          <h3>{editingId ? 'Edit Client Registration' : 'Create New Client Registration'}</h3>
          <form onSubmit={handleSubmit}>

            {/* CLIENT CODE + LOGO */}
            <div className="form-row">
              <div className="form-group">
                <label>Client Code</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    name="clientCode" value={formData.clientCode} onChange={handleFormChange}
                    placeholder="e.g. CMS-2025-0009"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button" onClick={handleAutoCode}
                    style={{ padding: '6px 10px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                    title="Auto-generate next code"
                  >
                    <Sparkles size={14} /> Auto
                  </button>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Leave blank to auto-allocate on save.
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ImageIcon size={14} /> Company Logo
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {formData.logo ? (
                    <img src={formData.logo} alt="logo preview"
                      style={{ height: 48, maxWidth: 120, borderRadius: 6, border: '1px solid #e5e7eb', objectFit: 'contain', background: '#fff' }} />
                  ) : (
                    <div style={{ height: 48, width: 48, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                      <ImageIcon size={20} />
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleLogoChange} />
                  {formData.logo && (
                    <button type="button" onClick={handleClearLogo}
                      style={{ background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
                {fieldError(logoError || undefined)}
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  PNG/JPG/SVG, up to 250 KB.
                </div>
              </div>
            </div>

            {/* ORG + CONTACT */}
            <div className="form-group">
              <label>Organization Name</label>
              <input list="org-list" name="organizationName" value={formData.organizationName} onChange={handleFormChange} placeholder="Enter or select organization" required />
              <datalist id="org-list">
                <option value="Green Energy Solutions" />
                <option value="Tech Innovations Ltd" />
                <option value="Quality Manufacturing Co" />
                {getOptions('organizationName').map((opt, i) => (<option key={`org-${i}`} value={opt} />))}
              </datalist>
            </div>

            <div className="form-group">
              <label>Name (Contact Person)</label>
              <input list="contact-list" name="contactPerson" value={formData.contactPerson} onChange={handleFormChange} placeholder="Enter or select contact person" required />
              <datalist id="contact-list">
                <option value="John Doe" />
                <option value="Sarah Smith" />
                {getOptions('contactPerson').map((opt, i) => (<option key={`contact-${i}`} value={opt} />))}
              </datalist>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input name="email" type="email" value={formData.email} onChange={handleFormChange} placeholder="client@example.com" />
                {!emailResult.ok && fieldError(emailResult.message)}
              </div>
              <div className="form-group">
                <label>Phone / Mobile</label>
                <input name="phone" type="tel" value={formData.phone} onChange={handleFormChange} placeholder="Enter mobile number" />
                {!phoneResult.ok && fieldError(phoneResult.message)}
              </div>
            </div>

            <div className="form-group">
              <label>Registration Number</label>
              <input list="reg-list" name="registrationNumber" value={formData.registrationNumber} onChange={handleFormChange} placeholder="Enter or select registration number" required />
              <datalist id="reg-list">
                <option value="REG-2025-001" />
                <option value="REG-2025-002" />
                {getOptions('registrationNumber').map((opt, i) => (<option key={`reg-${i}`} value={opt} />))}
              </datalist>
            </div>

            {/* STATUTORY IDS */}
            <div className="form-row">
              <div className="form-group">
                <label>GSTIN</label>
                <input name="gstin" value={formData.gstin} onChange={handleFormChange} placeholder="22AAAAA0000A1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} />
                {!gstinResult.ok && fieldError(gstinResult.message)}
              </div>
              <div className="form-group">
                <label>CIN</label>
                <input name="cin" value={formData.cin} onChange={handleFormChange} placeholder="U12345AB6789CDE012345" maxLength={21} style={{ textTransform: 'uppercase' }} />
                {!cinResult.ok && fieldError(cinResult.message)}
              </div>
              <div className="form-group">
                <label>PAN</label>
                <input name="pan" value={formData.pan} onChange={handleFormChange} placeholder="ABCDE1234F" maxLength={10} style={{ textTransform: 'uppercase' }} />
                {!panResult.ok && fieldError(panResult.message)}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Audit Type</label>
                <select name="clientType" value={formData.clientType} onChange={handleFormChange} required>
                  <option value="">-- Select Type --</option>
                  <option value="Initial Certification">Initial Audit</option>
                  <option value="Surveillance 1">Surveillance 1</option>
                  <option value="Surveillance 2">Surveillance 2</option>
                  <option value="Transfer">Transfer</option>
                </select>
              </div>
              <div className="form-group">
                <label>Standard</label>
                <StandardPicker
                  value={formData.standard}
                  onChange={(v) => setFormData((prev) => ({ ...prev, standard: v }))}
                  required placeholder="Select a standard"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Audit Status</label>
              <select name="status" value={formData.status} onChange={handleFormChange} required>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
              </select>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Default <strong>Pending</strong>. After the client confirms via email, mark as <strong>Approved</strong>.
              </div>
            </div>

            {/* DUPLICATE CHIPS */}
            {duplicates.length > 0 && (
              <div style={{
                background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
                padding: '10px 12px', margin: '8px 0', color: '#92400e', fontSize: 13
              }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <AlertTriangle size={14} /> Possible duplicate{duplicates.length > 1 ? 's' : ''} detected
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {duplicates.map((d, i) => (
                    <span key={`${d.existingId}-${i}`} style={{
                      background: '#fef3c7', borderRadius: 999, padding: '3px 10px', fontSize: 12,
                      border: '1px solid #fcd34d', display: 'inline-flex', alignItems: 'center', gap: 4
                    }}>
                      {d.existingLabel} <em style={{ color: '#78716c' }}>({d.field})</em>
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11, marginTop: 6 }}>
                  Verify before saving — same {duplicates.map(d => d.field).join(', ')} already on file.
                </div>
              </div>
            )}

            <div className="form-group" style={{ backgroundColor: '#f0f9ff', padding: '15px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
              <label style={{ color: '#0369a1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={16} /> Certification Contract (Attachment)
              </label>
              <input type="file" onChange={handleFileChange} style={{ marginTop: '8px', width: '100%' }} />
              {formData.attachment && (
                <div style={{ fontSize: '12px', color: '#0369a1', marginTop: '5px' }}>
                  Selected: <strong>{formData.attachment}</strong>
                </div>
              )}
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Please attach the signed Annexure 13 Certification Contract here.
              </div>
            </div>

            <div className="form-group" style={{ backgroundColor: '#f5f3ff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd6fe' }}>
              <label style={{ color: '#5b21b6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={16} /> Attach Agreement
              </label>
              <input
                type="file"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFormData(prev => ({ ...prev, agreement: e.target.files![0].name }));
                  }
                }}
                style={{ marginTop: '8px', width: '100%' }}
              />
              {formData.agreement && (
                <div style={{ fontSize: '12px', color: '#5b21b6', marginTop: '5px' }}>
                  Selected: <strong>{formData.agreement}</strong>
                </div>
              )}
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Upload the agreement document the client will counter-sign and return.
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn">{editingId ? 'Submit' : 'Add'}</button>
              <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="checklists-table-wrap">
        <div className="table-wrap">
          <table className="checklists-table">
            <thead>
              <tr>
                <th>Logo</th>
                <th>Code</th>
                <th>Organization</th>
                <th>Name</th>
                <th>Registration</th>
                <th>Audit Type</th>
                <th>Country</th>
                <th>Standard</th>
                <th>Audit Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 20 }}>No clients found matching your search.</td></tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      {client.logo ? (
                        <img src={client.logo} alt="logo" style={{ height: 28, maxWidth: 60, objectFit: 'contain' }} />
                      ) : (
                        <div style={{ height: 28, width: 28, borderRadius: 4, background: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                          <ImageIcon size={14} />
                        </div>
                      )}
                    </td>
                    <td><code style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{client.clientCode || '—'}</code></td>
                    <td><strong>{client.organizationName}</strong></td>
                    <td>{client.contactPerson}</td>
                    <td>{client.registrationNumber}</td>
                    <td>{client.clientType}</td>
                    <td>
                      {(client as any).country ? (
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: '#eff6ff', color: '#1e40af', fontWeight: 600 }}>
                          🌐 {(client as any).country}
                        </span>
                      ) : (<span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>)}
                    </td>
                    <td><span className="iso-standard">{client.standard}</span></td>
                    <td>
                      <span style={{
                        fontSize: 12, padding: '3px 8px', borderRadius: 12,
                        background:
                          client.status === 'Approved' ? '#dcfce7'
                            : client.status === 'Pending' || !client.status ? '#fef3c7'
                            : client.status === 'Registered' ? '#dbeafe'
                            : '#f3f4f6',
                        color:
                          client.status === 'Approved' ? '#166534'
                            : client.status === 'Pending' || !client.status ? '#92400e'
                            : client.status === 'Registered' ? '#1e40af'
                            : '#4b5563',
                        fontWeight: 600
                      }}>
                        {client.status || 'Pending'}
                      </span>
                      {client.submittedAt && (
                        <div style={{ fontSize: 10, color: '#7c3aed', marginTop: 2 }}>
                          ✉ Submitted {new Date(client.submittedAt).toLocaleDateString()}
                        </div>
                      )}
                      {client.clientRespondedAt && (
                        <div style={{ fontSize: 10, color: '#16a34a', marginTop: 2 }}>
                          ✓ Replied {new Date(client.clientRespondedAt).toLocaleDateString()}
                        </div>
                      )}
                      {client.attachment && <span style={{ display: 'block', fontSize: '10px', color: '#64748b', marginTop: '2px' }}>📎 {client.attachment}</span>}
                      {client.agreement && <span style={{ display: 'block', fontSize: '10px', color: '#64748b', marginTop: '2px' }}>📋 {client.agreement}</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="link-btn" title="View Application Details" onClick={() => handleView(client)}><Eye size={16} /></button>
                        <button className="link-btn" title="Edit" onClick={() => handleEdit(client)}><Edit2 size={16} /></button>
                        <button className="link-btn" title="Download Word Contract" onClick={() => handleDownload(client)}><Download size={16} /></button>
                        <button
                          className="link-btn"
                          title={client.submittedAt ? `Re-send registration email — last sent ${new Date(client.submittedAt).toLocaleString()}` : 'Submit registration to client by email'}
                          onClick={() => handleSubmitToEmail(client)}
                          style={{ color: client.submittedAt ? '#7c3aed' : '#0ea5e9' }}
                        >
                          <Mail size={16} />
                        </button>
                        {client.submittedAt && (client.status === 'Pending' || !client.status) && (
                          <button
                            className="link-btn success"
                            title="Mark as Approved (client replied)"
                            onClick={() => handleClientApproved(client)}
                            style={{ color: '#16a34a' }}
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                        <button
                          className="link-btn"
                          title="Forward to Management for onboarding approval"
                          onClick={() => forwardToManagement(client)}
                          style={{ color: '#7c3aed' }}
                        >
                          ↗
                        </button>
                        <button className="link-btn danger" title="Delete" onClick={() => handleDelete(client.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ClientRegistration;
