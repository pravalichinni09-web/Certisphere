import React, { useState, useEffect, useMemo } from 'react';
import { sendCertificateIssued } from '../../services/emailService';
import { Send, FileText, CheckCircle, Plus, Eye, Edit, X, Download, Upload, Save, CheckSquare, Layers, MessageCircle, Mail, Bell, CalendarClock } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { qrModules } from '../../utils/qrcode';

import '../../styles/AuditorCoordinator.css';
import { clients as mockClients, certificates as initialCertificatesMock } from './mockData';

/** Live client list — registered clients first (cms_client_registrations), mock as fallback. */
const readLiveClients = (): any[] => {
  try {
    const raw = localStorage.getItem('cms_client_registrations');
    const regs = raw ? JSON.parse(raw) : [];
    if (Array.isArray(regs) && regs.length > 0) {
      const mapped = regs.map((r: any) => ({
        id: String(r.id),
        name: r.organizationName || r.companyName || r.name || `Client ${r.id}`,
        email: r.email || r.contactEmail || '',
        industry: r.industry || '',
        address: r.address || '',
        phone: r.phone || r.contactPhone || '',
      }));
      // keep mock demo clients too so seeded certificates stay resolvable
      const seen = new Set(mapped.map((c: any) => c.id));
      return [...mapped, ...mockClients.filter((c) => !seen.has(c.id))];
    }
  } catch { /* ignore */ }
  return mockClients;
};
const clients = readLiveClients();

// --- DISPATCH & REMINDER LOG ---
const DISPATCH_LOG_KEY = 'cms_certificate_dispatch_log_v1';
const REMINDER_LOG_KEY = 'cms_certificate_reminder_log_v1';
const RENEWAL_DAYS = 60;

interface DispatchEntry {
  certId: string;
  channel: 'email' | 'whatsapp';
  to: string;
  at: string;
}

interface ReminderEntry {
  certId: string;
  expirationDate: string;
  remindedAt: string;
  daysBeforeExpiry: number;
}

const loadDispatchLog = (): DispatchEntry[] => {
  try {
    const raw = localStorage.getItem(DISPATCH_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};
const saveDispatchLog = (l: DispatchEntry[]) => {
  try { localStorage.setItem(DISPATCH_LOG_KEY, JSON.stringify(l)); } catch {}
};

const loadReminderLog = (): ReminderEntry[] => {
  try {
    const raw = localStorage.getItem(REMINDER_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};
const saveReminderLog = (l: ReminderEntry[]) => {
  try { localStorage.setItem(REMINDER_LOG_KEY, JSON.stringify(l)); } catch {}
};

const daysUntil = (dateStr?: string): number | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const buildVerificationUrl = (cert: { certificateNumber: string; clientId: string }): string => {
  // Public-facing URL the QR will encode
  return `https://verify.qmics.com/cert/${encodeURIComponent(cert.certificateNumber)}?c=${encodeURIComponent(cert.clientId)}`;
};

// --- INTERFACES ---
type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

interface CertificateData {
  id: string;
  clientId: string;
  certificateNumber: string;
  address: string;
  scope: string;
  standard: string;
  auditStatus: string;
  issuedDate: string;
  expirationDate: string;
  recertificationDueDate: string;
  surveillance1Due: string;
  surveillance2Due: string;
  method: string;
  status: string;
  attachment: string | null;
  leadAuditorApprovalStatus: ApprovalStatus;
  leadAuditorName?: string;
  leadAuditorApprovalNote?: string;
  type?: 'Registration' | 'Surveillance'; 
}

interface CertificateFormData {
  clientId: string;
  certificateNumber: string;
  address: string;
  scope: string;
  standard: string;
  auditStatus: string;
  issuedDate: string;
  expirationDate: string;
  recertificationDueDate: string;
  surveillance1Due: string;
  surveillance2Due: string;
  method: string;
  attachment: string | null;
  leadAuditorApprovalStatus: ApprovalStatus;
  leadAuditorName: string;
  leadAuditorApprovalNote: string;
}

// --- MOCK DATA SETUP ---

// 1. UPDATED: Main Registration Certificates mapped from CLIENTS (Client Registration)
// This ensures every client row exists in the certificate table.
const enhancedInitialCertificates: CertificateData[] = clients.map(client => {
  // Check if this client already has a mock certificate
  const existingCert = initialCertificatesMock.find(c => c.clientId === client.id);

  // Use existing data if available, otherwise create default/draft data for the client
  const existingCertData = existingCert as unknown as { leadAuditorApprovalStatus?: ApprovalStatus; leadAuditorName?: string; leadAuditorApprovalNote?: string } | undefined;
  return {
    id: String(existingCert?.id || `cert-gen-${client.id}`),
    clientId: client.id,
    certificateNumber: existingCert?.certificateNumber || `CERT-${client.id}-2025`,
    address: (client as any).address || 'Rainbow Vistas Phase 2, 604, Green Hills Rd, Block O, Moosapet, Hyderabad, Telangana 500018', 
    scope: existingCert?.scope || `PROVISION OF MANAGEMENT SYSTEM FOR BUSINESS PROCESSES IN THE AREA OF REAL ESTATE, HEALTH CARE, FINANCIAL AND INSURANCE SERVICES.`,
    standard: existingCert?.standard || 'ISO 27001:2022',
    auditStatus: existingCert?.auditStatus || 'Pending',
    issuedDate: existingCert?.issuedDate || new Date().toISOString().split('T')[0],
    expirationDate: existingCert?.expirationDate || '',
    recertificationDueDate: existingCert?.recertificationDueDate || '',
    surveillance1Due: existingCert?.surveillance1Due || '',
    surveillance2Due: existingCert?.surveillance2Due || '',
    method: existingCert?.method || 'Email',
    status: existingCert?.status || 'Draft', 
    attachment: existingCert ? `Certificate_${existingCert.id}.pdf` : null,
    leadAuditorApprovalStatus: existingCertData?.leadAuditorApprovalStatus || 'Pending',
    leadAuditorName: existingCertData?.leadAuditorName || '',
    leadAuditorApprovalNote: existingCertData?.leadAuditorApprovalNote || '',
    type: 'Registration'
  };
});

// 2. New Surveillance Certificates Mock Data 
const initialSurveillanceCertificates: CertificateData[] = [
  {
    id: 'surv-1',
    clientId: '1', // ABC Manufacturing Ltd
    certificateNumber: 'SURV-2025-001',
    address: '123 Business Park, Cityville, ST 12345',
    scope: 'ISO 9001:2015 - Surveillance Audit 1',
    standard: 'ISO 9001:2015',
    auditStatus: 'Passed',
    issuedDate: '2025-02-15',
    expirationDate: '2027-01-15', 
    recertificationDueDate: '2026-10-01',
    surveillance1Due: 'Completed',
    surveillance2Due: '2026-02-15',
    method: 'Email',
    status: 'Draft',
    attachment: null,
    leadAuditorApprovalStatus: 'Pending',
    leadAuditorName: '',
    leadAuditorApprovalNote: '',
    type: 'Surveillance'
  },
  {
    id: 'surv-2',
    clientId: '2', // David Wilson
    certificateNumber: 'SURV-2025-002',
    address: '456 Tech Ave, Silicon Valley, CA 94000',
    scope: 'ISO 27001:2022 - Surveillance Audit 1',
    standard: 'ISO 27001:2022',
    auditStatus: 'Passed',
    issuedDate: '2025-03-10',
    expirationDate: '2026-02-20',
    recertificationDueDate: '2026-01-01',
    surveillance1Due: 'Completed',
    surveillance2Due: 'N/A',
    method: 'Portal Upload',
    status: 'Issued',
    attachment: 'Surv_Report_TechSol.pdf',
    leadAuditorApprovalStatus: 'Approved',
    leadAuditorName: 'Lead Auditor Team',
    leadAuditorApprovalNote: 'Lead auditor approved surveillance certification.',
    type: 'Surveillance'
  }
];

const CertificateDelivery: React.FC = () => {
  const [certificates, setCertificates] = useState<CertificateData[]>(() => {
    try {
      const raw = localStorage.getItem('cms_certificate_delivery_v1');
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* ignore */ }
    return enhancedInitialCertificates;
  });
  const [survCertificates, setSurvCertificates] = useState<CertificateData[]>(() => {
    try {
      const raw = localStorage.getItem('cms_certificate_delivery_surv_v1');
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* ignore */ }
    return initialSurveillanceCertificates;
  });
  // Persist both certificate lists — issued/approved certificates must survive refresh.
  useEffect(() => {
    try {
      localStorage.setItem('cms_certificate_delivery_v1', JSON.stringify(certificates));
      window.dispatchEvent(new CustomEvent('cms-certificates-updated'));
    } catch { /* ignore */ }
  }, [certificates]);
  useEffect(() => {
    try {
      localStorage.setItem('cms_certificate_delivery_surv_v1', JSON.stringify(survCertificates));
    } catch { /* ignore */ }
  }, [survCertificates]);
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<'main' | 'surv'>('main');

  // Notification State
  const [notification, setNotification] = useState<{message: string, visible: boolean, type: 'success' | 'info'}>({
    message: '',
    visible: false,
    type: 'success'
  });

  // Dispatch + reminder logs
  const [, setDispatchLog] = useState<DispatchEntry[]>(loadDispatchLog());
  const [reminderLog, setReminderLog] = useState<ReminderEntry[]>(loadReminderLog());

  // Auto-fire 60-day expiry reminders on mount + once per minute
  useEffect(() => {
    const fire = () => {
      const allCerts = [...certificates, ...survCertificates];
      let log = loadReminderLog();
      let changed = false;
      for (const cert of allCerts) {
        const d = daysUntil(cert.expirationDate);
        if (d === null || d > RENEWAL_DAYS || d < 0) continue;
        // Already reminded for this cert+expiration combo within last 7 days?
        const recent = log.find((r) =>
          r.certId === cert.id &&
          r.expirationDate === cert.expirationDate &&
          (Date.now() - new Date(r.remindedAt).getTime()) < 7 * 24 * 60 * 60 * 1000
        );
        if (recent) continue;
        log.push({
          certId: cert.id,
          expirationDate: cert.expirationDate,
          remindedAt: new Date().toISOString(),
          daysBeforeExpiry: d,
        });
        changed = true;
      }
      if (changed) {
        saveReminderLog(log);
        setReminderLog([...log]);
      }
    };
    fire();
    const handle = setInterval(fire, 60_000);
    return () => clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificates.length, survCertificates.length]);

  // Certs requiring renewal action — within RENEWAL_DAYS of expiry
  const renewalCandidates = useMemo(() => {
    return [...certificates, ...survCertificates]
      .map((c) => ({ cert: c, days: daysUntil(c.expirationDate) }))
      .filter((x) => x.days !== null && x.days <= RENEWAL_DAYS && x.days >= -30)
      .sort((a, b) => (a.days! - b.days!));
  }, [certificates, survCertificates, reminderLog]);

  // Form Data State
  const [formData, setFormData] = useState<CertificateFormData>({
    clientId: '',
    certificateNumber: '',
    address: '',
    scope: 'PROVISION OF INFORMATION SECURITY MANAGEMENT SYSTEM FOR BUSINESS PROCESSES',
    standard: 'ISO 27001:2022',
    auditStatus: 'Passed',
    issuedDate: '',
    expirationDate: '',
    recertificationDueDate: '',
    surveillance1Due: '',
    surveillance2Due: '',
    method: 'Email',
    attachment: null,
    leadAuditorApprovalStatus: 'Pending',
    leadAuditorName: '',
    leadAuditorApprovalNote: '',
  });

  // --- HELPERS ---
  const getClient = (id?: string) => clients.find(c => c.id === id);
  const getClientName = (id?: string) => getClient(id)?.name || 'Unknown Client';
  const getClientEmail = (id?: string) => getClient(id)?.email || 'unknown@example.com';

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, visible: true, type });
    setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 4000);
  };

  // --- FORM HANDLERS ---
  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'clientId' && formData.address === '') {
      const selectedClient = clients.find(c => c.id === value);
      if (selectedClient && selectedClient.address) {
        setFormData(prev => ({ ...prev, address: selectedClient.address || '' }));
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, attachment: e.target.files![0].name }));
    }
  };

  const resetForm = () => {
    setFormData({
      clientId: '',
      certificateNumber: '',
      address: '',
      scope: 'PROVISION OF INFORMATION SECURITY MANAGEMENT SYSTEM FOR BUSINESS PROCESSES',
      standard: 'ISO 27001:2022',
      auditStatus: 'Passed',
      issuedDate: '',
      expirationDate: '',
      recertificationDueDate: '',
      surveillance1Due: '',
      surveillance2Due: '',
      method: 'Email',
      attachment: null,
      leadAuditorApprovalStatus: 'Pending',
      leadAuditorName: '',
      leadAuditorApprovalNote: '',
    });
    setEditingId(null);
    setEditingType('main');
  };

  const toggleForm = () => {
    if (showForm) resetForm();
    setShowForm(!showForm);
  };

  // --- PDF GENERATION (UPDATED to QMICS format matching the ISMS document) ---
  const generatePDF = (data: CertificateFormData | CertificateData) => {
    const client = getClient(data.clientId);
    const clientName = client?.name || 'Unknown Client';
    
    // Switch to Portrait mode to accommodate extensive details & footer
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    // Borders
    doc.setLineWidth(1);
    doc.setDrawColor(22, 101, 52); // Dark Green
    doc.rect(10, 10, 190, 277); 
    doc.setLineWidth(0.5);
    doc.rect(12, 12, 186, 273); 

    // --- Logos Section ---
    // ASCB Logo Placeholder (Left)
    doc.setDrawColor(150);
    doc.rect(20, 18, 25, 25);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("ASCB", 32.5, 30, { align: "center" });
    doc.text("Accreditation", 32.5, 34, { align: "center" });

    // QMICS Logo (Right) - Load image synchronously
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', '/images/qmics-logo.png', false); // false = synchronous
      xhr.responseType = 'arraybuffer';
      xhr.send();
      
      if (xhr.status === 200) {
        const bytes = new Uint8Array(xhr.response);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const imgData = 'data:image/png;base64,' + btoa(binary);
        doc.addImage(imgData, 'PNG', 165, 18, 25, 25);
      }
    } catch (error) {
      // Fallback to text if image fails to load
      doc.rect(165, 18, 25, 25);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(22, 101, 52);
      doc.setFontSize(10);
      doc.text("QMICS", 177.5, 30, { align: "center" });
      doc.setFont("helvetica", "normal");
    }

    // --- Header ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(22, 101, 52);
    doc.text("QMICS SOLUTIONS AND COMPLIANCES PVT. LTD.", centerX, 25, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(50);
    doc.text("MANAGEMENT SYSTEMS CERTIFICATION", centerX, 33, { align: "center" });

    // Title
    doc.setFont("times", "bolditalic");
    doc.setFontSize(24);
    doc.setTextColor(0);
    doc.text("Certificate of Registration", centerX, 55, { align: "center" });

    // --- Body ---
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Awarded to:", centerX, 70, { align: "center" });

    // Client Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(clientName.toUpperCase(), centerX, 80, { align: "center" });

    // Address
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const addressText = `ADDRESS: ${data.address || 'N/A'}`;
    const addressLines = doc.splitTextToSize(addressText, 160);
    doc.text(addressLines, centerX, 90, { align: "center" });

    // Standard
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(22, 101, 52);
    doc.text(data.standard.toUpperCase(), centerX, 115, { align: "center" });

    // Compliance Declaration
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0);
    const complianceText = `The organization mentioned above has been assessed against the ${data.standard} and found to have successfully complied with its requirements.`;
    const complianceLines = doc.splitTextToSize(complianceText, 160);
    doc.text(complianceLines, centerX, 125, { align: "center", lineHeightFactor: 1.5 });

    // Scope
    doc.setFont("helvetica", "bold");
    doc.text("Scope of Certification:", centerX, 145, { align: "center" });
    doc.setFont("helvetica", "normal");
    const scopeLines = doc.splitTextToSize(data.scope || 'N/A', 160);
    doc.text(scopeLines, centerX, 153, { align: "center", lineHeightFactor: 1.5 });

    // --- Dates & Numbers Grid ---
    const startY = 185;
    const col1X = 30;
    const col2X = 90;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Issue Date", col1X, startY);
    doc.text(":", col2X - 5, startY);
    doc.setFont("helvetica", "normal");
    doc.text(data.issuedDate || 'N/A', col2X, startY);

    doc.setFont("helvetica", "bold");
    doc.text("Expiration Date", col1X, startY + 8);
    doc.text(":", col2X - 5, startY + 8);
    doc.setFont("helvetica", "normal");
    doc.text(data.expirationDate || 'N/A', col2X, startY + 8);

    doc.setFont("helvetica", "bold");
    doc.text("Certificate Number", col1X, startY + 16);
    doc.text(":", col2X - 5, startY + 16);
    doc.setFont("helvetica", "normal");
    doc.text(data.certificateNumber || 'N/A', col2X, startY + 16);

    doc.setFont("helvetica", "bold");
    doc.text("1ST Surveillance Audit Within", col1X, startY + 24);
    doc.text(":", col2X - 5, startY + 24);
    doc.setFont("helvetica", "normal");
    doc.text(data.surveillance1Due || 'N/A', col2X, startY + 24);

    doc.setFont("helvetica", "bold");
    doc.text("2ND Surveillance Audit Within", col1X, startY + 32);
    doc.text(":", col2X - 5, startY + 32);
    doc.setFont("helvetica", "normal");
    doc.text(data.surveillance2Due || 'N/A', col2X, startY + 32);

    doc.setFont("helvetica", "bold");
    doc.text("Re-certification Due Date", col1X, startY + 40);
    doc.text(":", col2X - 5, startY + 40);
    doc.setFont("helvetica", "normal");
    doc.text(data.recertificationDueDate || 'N/A', col2X, startY + 40);

    // --- Footer & Signatures ---
    // IRQAO Logo text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("IRQAO\nREGISTERED\nwww.irqao.com", 45, startY + 55, { align: "center" });

    // Signature Line
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(140, startY + 53, 190, startY + 53);
    doc.setFontSize(10);
    doc.text("RK CHINMAYA", 165, startY + 58, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("(Managing Director)", 165, startY + 63, { align: "center" });

    // Disclaimer Paragraph
    doc.setFontSize(6.5);
    doc.setTextColor(80);
    const disclaimer = "Validity of this Certificate is subject to Surveillance Audits to be conducted before scheduled due dates of surveillance audits as mentioned on the certificate, failing which the certificate will stand to be withdrawn and need to be treated as an initial certification process to reactivate its continuity on the register of ASCBE and QMICS. This Certificate is valid when confirmed by data listed on the \"International Register of Quality Assessed Organizations\" www.irqao.com. The authenticity & validity of this certificate may be re-affirmed by referring to our company website www.qmics.com. Lack of fulfillment of conditions as set out on the 'Certification Contract' (Annex 13) may render this certificate invalid. Any alteration, forgery or falsification of the content or appearance of this document is unlawful and offenders may be prosecuted to the fullest extent of law. This certificate remains the property of QMICS and to be returned on request.";
    const disclaimerLines = doc.splitTextToSize(disclaimer, 180);
    doc.text(disclaimerLines, centerX, 255, { align: "center", lineHeightFactor: 1.2 });

    // Company Footer Address - Centered with proper spacing
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(0);
    doc.text("QMICS SOLUTIONS AND COMPLIANCES PVT. LTD.", centerX, 273, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("REGISTERED OFFICE: Rainbow Vistas Phase 2, 604, Green Hills Rd, Block O, Moosapet,", centerX, 277, { align: "center" });
    doc.text("Hyderabad, Telangana 500018, INDIA.", centerX, 280, { align: "center" });
    doc.setFontSize(6.5);
    doc.text("Email: rk@qmicssolution.com  |  Call: +91 XXXXXXXXXX  |  Website: www.qmics.com", centerX, 283, { align: "center" });

    // --- QR Code (verification) ---
    try {
      const verifyUrl = buildVerificationUrl({
        certificateNumber: data.certificateNumber || 'unknown',
        clientId: data.clientId,
      });
      const { size, modules } = qrModules(verifyUrl);
      // Draw QR at bottom-left of body, ~28mm square
      const qrSizeMm = 28;
      const qrX = 22;
      const qrY = 215;
      const cell = qrSizeMm / size;
      // White background under the QR
      doc.setFillColor(255, 255, 255);
      doc.rect(qrX - 1, qrY - 1, qrSizeMm + 2, qrSizeMm + 2, 'F');
      doc.setFillColor(0, 0, 0);
      for (let yy = 0; yy < size; yy++) {
        for (let xx = 0; xx < size; xx++) {
          if (modules[yy][xx]) {
            doc.rect(qrX + xx * cell, qrY + yy * cell, cell, cell, 'F');
          }
        }
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(80);
      doc.text('Scan to verify authenticity', qrX + qrSizeMm / 2, qrY + qrSizeMm + 4, { align: 'center' });
    } catch (qrErr) {
      // QR rendering failure shouldn't block PDF
      console.warn('QR render failed', qrErr);
    }

    doc.save(`${clientName.replace(/\s+/g, '_')}_Certificate_${data.certificateNumber}.pdf`);
  };

  // --- ACTION BUTTON HANDLERS ---
  const recordDispatch = (entry: DispatchEntry) => {
    const next = [...loadDispatchLog(), entry];
    saveDispatchLog(next);
    setDispatchLog(next);
  };

  const getClientPhone = (id?: string): string => {
    const c: any = clients.find((cl) => cl.id === id);
    return c?.phone || c?.contact || '';
  };

  const handleEmailDispatch = (cert: CertificateData) => {
    const email = getClientEmail(cert.clientId);
    recordDispatch({
      certId: cert.id,
      channel: 'email',
      to: email,
      at: new Date().toISOString(),
    });
    showNotification(`Certificate emailed to ${email}`, 'success');
    // Send via EmailJS
    sendCertificateIssued({
      toEmail: email,
      clientName: getClientName(cert.clientId),
      certNumber: cert.certificateNumber,
      standard: cert.standard,
      issueDate: cert.issuedDate,
      expiryDate: cert.expirationDate,
    }).catch(() => {/* non-blocking */});
  };

  const handleWhatsAppDispatch = (cert: CertificateData) => {
    const phone = getClientPhone(cert.clientId);
    if (!phone) {
      showNotification('No phone number on file for this client.', 'info');
      return;
    }
    const verifyUrl = buildVerificationUrl(cert);
    const text = `Hello ${getClientName(cert.clientId)}, your certificate ${cert.certificateNumber} (${cert.standard}) is ready. Verify here: ${verifyUrl}`;
    const cleanPhone = phone.replace(/\D/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
    recordDispatch({
      certId: cert.id,
      channel: 'whatsapp',
      to: phone,
      at: new Date().toISOString(),
    });
    showNotification(`WhatsApp draft opened for ${phone}`, 'success');
  };

  // Send a 60-day renewal reminder for a single cert
  const handleSendRenewalReminder = (cert: CertificateData) => {
    const email = getClientEmail(cert.clientId);
    const d = daysUntil(cert.expirationDate);
    showNotification(
      `Renewal reminder sent to ${email} (${d !== null ? d + ' days' : 'TBD'} until expiry)`,
      'success'
    );
    const log = loadReminderLog();
    log.push({
      certId: cert.id,
      expirationDate: cert.expirationDate,
      remindedAt: new Date().toISOString(),
      daysBeforeExpiry: d ?? -1,
    });
    saveReminderLog(log);
    setReminderLog([...log]);
  };

  const handleBulkRenewalReminders = () => {
    if (renewalCandidates.length === 0) return;
    if (!window.confirm(`Send renewal reminders to ${renewalCandidates.length} clients?`)) return;
    const log = loadReminderLog();
    for (const { cert, days } of renewalCandidates) {
      log.push({
        certId: cert.id,
        expirationDate: cert.expirationDate,
        remindedAt: new Date().toISOString(),
        daysBeforeExpiry: days ?? -1,
      });
    }
    saveReminderLog(log);
    setReminderLog([...log]);
    showNotification(`Sent ${renewalCandidates.length} renewal reminders`, 'success');
  };

  const handleViewAction = (cert: CertificateData) => {
    alert(`Viewing details for Certificate #: ${cert.certificateNumber}\nClient: ${getClientName(cert.clientId)}\nAttachment: ${cert.attachment || 'None'}`);
  };

  const handleDownloadAction = (cert: CertificateData) => {
    generatePDF(cert);
    showNotification(`Certificate downloaded for ${getClientName(cert.clientId)}`, 'info');
  };

  const handleSubmitRowAction = (cert: CertificateData, type: 'main' | 'surv') => {
    setFormData({
      clientId: cert.clientId,
      certificateNumber: cert.certificateNumber,
      address: cert.address,
      scope: cert.scope,
      standard: cert.standard,
      auditStatus: cert.auditStatus,
      issuedDate: cert.issuedDate,
      expirationDate: cert.expirationDate,
      recertificationDueDate: cert.recertificationDueDate,
      surveillance1Due: cert.surveillance1Due,
      surveillance2Due: cert.surveillance2Due,
      method: cert.method,
      attachment: cert.attachment,
      leadAuditorApprovalStatus: cert.leadAuditorApprovalStatus || 'Pending',
      leadAuditorName: cert.leadAuditorName || '',
      leadAuditorApprovalNote: cert.leadAuditorApprovalNote || '',
    });
    setEditingId(cert.id);
    setEditingType(type);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- MAIN FORM SUBMISSION LOGIC ---
  const handleFinalize = (status: string) => {
    if (!formData.clientId || !formData.certificateNumber || !formData.issuedDate) {
      alert("Please fill in required fields (Client, Cert Number, Issued Date).");
      return;
    }

    if (status !== 'Draft' && formData.leadAuditorApprovalStatus !== 'Approved') {
      alert('Lead Auditor approval is required before this certificate can be approved or issued. Set Lead Auditor approval to Approved.');
      return;
    }

    const clientEmail = getClientEmail(formData.clientId);

    const updateList = (list: CertificateData[], isMain: boolean) => {
      if (editingId && ((isMain && editingType === 'main') || (!isMain && editingType === 'surv'))) {
         return list.map(c => c.id === editingId ? { ...c, ...formData, id: editingId, status: status } : c);
      }
      return list;
    };

    if (editingId) {
      // Update existing
      if (editingType === 'main') {
        setCertificates(prev => updateList(prev, true));
      } else {
        setSurvCertificates(prev => updateList(prev, false));
      }
      showNotification(`Certificate ${status.toLowerCase()} successfully for ${clientEmail}`);
    } else {
      // Create new
      const newCert: CertificateData = {
        id: `cert-${Date.now()}`,
        ...formData,
        status: status,
        type: 'Registration'
      };
      setCertificates([newCert, ...certificates]);
      showNotification(`Certificate ${status.toLowerCase()} successfully to ${clientEmail}`);
    }
    resetForm();
    setShowForm(false);
  };

  return (
    <div className="audit-scope-container" style={{ position: 'relative' }}>
       {notification.visible && (
        <div style={{
          position: 'fixed', top: '80px', right: '20px',
          backgroundColor: notification.type === 'success' ? '#10b981' : '#0ea5e9',
          color: 'white', padding: '16px 24px', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 500,
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <CheckCircle size={20} />
          <span>{notification.message}</span>
          <button onClick={() => setNotification(prev => ({...prev, visible: false}))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', marginLeft: 'auto' }}><X size={16} /></button>
        </div>
       )}

       <div className="scope-header">
         <div>
           <h1>Certificate Delivery</h1>
           <p>Issue, track, and download audit certificates with QR verification & 60-day renewal reminders.</p>
         </div>
         <button className="add-btn" onClick={toggleForm}>
           <Plus size={20} /> {showForm ? 'Close Form' : 'Issue Certificate'}
         </button>
       </div>

       {/* Renewal Reminders Panel */}
       <div style={{
         margin: '20px 0',
         padding: 20,
         backgroundColor: renewalCandidates.length > 0 ? '#fef3c7' : '#f0fdf4',
         border: `1px solid ${renewalCandidates.length > 0 ? '#fcd34d' : '#bbf7d0'}`,
         borderRadius: 12,
       }}>
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
             <div style={{
               width: 40, height: 40, borderRadius: 8,
               backgroundColor: renewalCandidates.length > 0 ? '#f59e0b' : '#16a34a',
               color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
             }}>
               <CalendarClock size={20} />
             </div>
             <div>
               <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>
                 60-Day Renewal Reminders
               </h3>
               <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                 {renewalCandidates.length === 0
                   ? 'No certificates require renewal in the next 60 days.'
                   : `${renewalCandidates.length} certificate(s) within ${RENEWAL_DAYS} days of expiry. Auto-reminders fire weekly per cert.`}
               </p>
             </div>
           </div>
           {renewalCandidates.length > 0 && (
             <button
               onClick={handleBulkRenewalReminders}
               style={{
                 display: 'inline-flex', alignItems: 'center', gap: 6,
                 padding: '8px 14px', backgroundColor: '#f59e0b', color: 'white',
                 border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
               }}
             >
               <Bell size={16} /> Send All Reminders Now
             </button>
           )}
         </div>
         {renewalCandidates.length > 0 && (
           <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
             {renewalCandidates.slice(0, 12).map(({ cert, days }) => {
               const overdue = (days ?? 0) < 0;
               const reminded = reminderLog.filter((r) => r.certId === cert.id).length;
               return (
                 <div key={cert.id} style={{
                   padding: 12, backgroundColor: 'white', borderRadius: 8,
                   border: `1px solid ${overdue ? '#fca5a5' : '#fcd34d'}`,
                 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                     <strong style={{ fontSize: 13, color: '#0f172a' }}>{getClientName(cert.clientId)}</strong>
                     <span style={{
                       fontSize: 11, fontWeight: 600,
                       padding: '2px 8px', borderRadius: 4,
                       backgroundColor: overdue ? '#fee2e2' : '#fef3c7',
                       color: overdue ? '#b91c1c' : '#92400e',
                     }}>
                       {overdue ? `${Math.abs(days!)}d overdue` : `${days}d left`}
                     </span>
                   </div>
                   <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                     {cert.certificateNumber} • Exp: {cert.expirationDate || '—'}
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                     <span style={{ fontSize: 10, color: '#94a3b8' }}>
                       {reminded > 0 ? `${reminded} reminder(s) sent` : 'No reminder yet'}
                     </span>
                     <button
                       onClick={() => handleSendRenewalReminder(cert)}
                       style={{
                         display: 'inline-flex', alignItems: 'center', gap: 4,
                         padding: '4px 8px', fontSize: 11, fontWeight: 600,
                         backgroundColor: '#0ea5e9', color: 'white',
                         border: 'none', borderRadius: 4, cursor: 'pointer',
                       }}
                     >
                       <Send size={11} /> Remind
                     </button>
                   </div>
                 </div>
               );
             })}
           </div>
         )}
       </div>

       {showForm && (
         <div className="checklist-form" style={{ marginBottom: '30px', border: '1px solid #e2e8f0', padding: '24px', borderRadius: '12px', backgroundColor: '#f8fafc', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
           <h3 style={{marginBottom: '20px', color: '#1e293b'}}>{editingId ? `Edit / Submit ${editingType === 'surv' ? 'Surveillance ' : ''}Certificate` : 'Issue New Certificate'}</h3>
           
           <div>
             {/* Attachment */}
             <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e0f2fe', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#0369a1' }}>Certificate Attachment (PDF)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                       <Upload size={16} color="#64748b"/>
                       <input type="file" onChange={handleFileChange} accept=".pdf" style={{ width: '100%' }} />
                    </div>
                  </div>
                  {editingId && (
                     <button type="button" onClick={() => generatePDF(formData)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '6px', border: '1px solid #7c3aed', color: '#7c3aed', backgroundColor: 'white', cursor: 'pointer', fontWeight: 500 }} title="Download/Preview the PDF for this row">
                        <FileText size={16} /> Preview Row PDF
                     </button>
                  )}
                </div>
                {formData.attachment && <div style={{ marginTop: '8px', fontSize: '13px', color: '#0369a1' }}>Current File: <strong>{formData.attachment}</strong></div>}
             </div>

             <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px'}}>
                <div className="form-group">
                  <label>Select Client *</label>
                  <select name="clientId" value={formData.clientId} onChange={handleInputChange} required style={{width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1'}}>
                    <option value="">-- Select Client --</option>
                    {clients.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Certificate Number *</label>
                  <input type="text" name="certificateNumber" value={formData.certificateNumber} onChange={handleInputChange} required style={{width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1'}}/>
                </div>
             </div>

             <div className="form-group" style={{marginBottom: '20px'}}>
                 <label>Client Address</label>
                 <textarea name="address" value={formData.address} onChange={handleInputChange} rows={2} style={{width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1'}} />
             </div>
             
             <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px'}}>
                <div className="form-group">
                  <label>Standard Applied</label>
                  <input type="text" name="standard" value={formData.standard} onChange={handleInputChange} style={{width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1'}}/>
                </div>
                <div className="form-group">
                  <label>Certificate Scope *</label>
                  <input type="text" name="scope" value={formData.scope} onChange={handleInputChange} required style={{width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1'}}/>
                </div>
             </div>

             <h4 style={{marginBottom: '10px', color: '#475569', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px'}}>Critical Dates</h4>
             <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px'}}>
               <div className="form-group"><label style={{fontSize:'13px'}}>Issued Date *</label><input type="date" name="issuedDate" value={formData.issuedDate} onChange={handleInputChange} required style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1'}}/></div>
               <div className="form-group"><label style={{fontSize:'13px'}}>Expiration Date</label><input type="date" name="expirationDate" value={formData.expirationDate} onChange={handleInputChange} style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1'}}/></div>
               <div className="form-group"><label style={{fontSize:'13px'}}>Recertification Due</label><input type="date" name="recertificationDueDate" value={formData.recertificationDueDate} onChange={handleInputChange} style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1'}}/></div>
               <div className="form-group"><label style={{fontSize:'13px'}}>1st Surveillance Due</label><input type="date" name="surveillance1Due" value={formData.surveillance1Due} onChange={handleInputChange} style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1'}}/></div>
               <div className="form-group"><label style={{fontSize:'13px'}}>2nd Surveillance Due</label><input type="date" name="surveillance2Due" value={formData.surveillance2Due} onChange={handleInputChange} style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1'}}/></div>
             </div>

             <div style={{ padding: '18px', borderRadius: '10px', border: '1px solid #c7d2fe', backgroundColor: '#eef2ff', marginBottom: '20px' }}>
               <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Lead Auditor Approval</h4>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                 <div className="form-group">
                   <label style={{ fontSize: '13px' }}>Approval Status</label>
                   <select name="leadAuditorApprovalStatus" value={formData.leadAuditorApprovalStatus} onChange={handleInputChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                     <option value="Pending">Pending</option>
                     <option value="Approved">Approved</option>
                     <option value="Rejected">Rejected</option>
                   </select>
                 </div>
                 <div className="form-group">
                   <label style={{ fontSize: '13px' }}>Lead Auditor</label>
                   <input type="text" name="leadAuditorName" value={formData.leadAuditorName} onChange={handleInputChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} placeholder="Enter lead auditor name" />
                 </div>
               </div>
               <div className="form-group" style={{ marginTop: '16px' }}>
                 <label style={{ fontSize: '13px' }}>Approval Notes</label>
                 <textarea
                   name="leadAuditorApprovalNote"
                   value={formData.leadAuditorApprovalNote}
                   onChange={handleInputChange}
                   rows={3}
                   style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                   placeholder="Optional notes from the lead auditor"
                 />
               </div>
             </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px', padding: '15px', backgroundColor: '#f1f5f9', borderRadius: '8px'}}>
                 <div className="form-group"><label>Audit Status</label><select name="auditStatus" value={formData.auditStatus} onChange={handleInputChange} style={{width: '100%', padding: '8px', borderRadius: '6px'}}><option>Passed</option><option>Failed</option><option>Pending</option></select></div>
                 <div className="form-group"><label>Delivery Method</label><select name="method" value={formData.method} onChange={handleInputChange} style={{width: '100%', padding: '8px', borderRadius: '6px'}}><option>Email</option><option>Courier</option><option>Portal Upload</option></select></div>
             </div>

             <div className="form-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px', flexWrap: 'wrap'}}>
               <button type="button" className="cancel-btn" onClick={toggleForm} style={{padding: '10px 20px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer'}}>Cancel</button>
               <button type="button" onClick={() => handleFinalize('Draft')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '6px', background: '#fbbf24', color: '#78350f', border: '1px solid #f59e0b', cursor: 'pointer', fontWeight: 600 }}>
                 <Save size={18} /> Save Draft
               </button>
               <button type="button" onClick={() => handleFinalize('Approved')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '6px', background: '#4ade80', color: '#14532d', border: '1px solid #22c55e', cursor: 'pointer', fontWeight: 600 }}>
                 <CheckSquare size={18} /> Approve
               </button>
               <button type="button" onClick={() => handleFinalize('Issued')} className="submit-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '6px', background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                 <Send size={18} /> {editingId ? 'Update & Issue' : 'Issue Certificate'}
               </button>
             </div>
           </div>
         </div>
       )}

       {/* --- ORIGINAL CERTIFICATE DELIVERY TABLE (Mapped from Client List) --- */}
       <div className="table-wrap">
         <table className="checklists-table">
           <thead>
               <tr>
                 <th>Cert No.</th>
                 <th>Client Name</th>
                 <th>Standard & Scope</th>
                 <th>Dates</th>
                 <th>Attachment</th>
                 <th>Status</th>
                 <th style={{ minWidth: '400px' }}>Action</th>
               </tr>
           </thead>
           <tbody>
             {certificates.map(cert => (
               <tr key={cert.id}>
                 <td><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={16} color="#2563eb"/><span style={{fontWeight: 600, color: '#1e293b'}}>{cert.certificateNumber}</span></div></td>
                 <td><div style={{display:'flex', flexDirection:'column'}}><strong>{getClientName(cert.clientId)}</strong><span style={{fontSize:'11px', color:'#64748b'}}>{cert.address}</span></div></td>
                 <td><div style={{fontSize:'12px'}}><div style={{fontWeight:600, color: '#0f766e'}}>{cert.standard}</div><div style={{color:'#475569'}}>{cert.scope}</div><div style={{marginTop:'6px', fontSize:'11px', color: cert.leadAuditorApprovalStatus === 'Approved' ? '#166534' : cert.leadAuditorApprovalStatus === 'Rejected' ? '#b91c1c' : '#475569'}}><strong>Lead approval:</strong> {cert.leadAuditorApprovalStatus}</div></div></td>
                 <td><div style={{fontSize:'12px', display:'flex', flexDirection:'column', gap:'4px'}}><div>Iss: {cert.issuedDate}</div><div style={{color: '#dc2626'}}>Exp: {cert.expirationDate}</div></div></td>
                 <td>
                    {cert.attachment ? (
                        <span style={{fontSize:'11px', color:'#0369a1', display:'flex', alignItems:'center', gap:'4px'}}><FileText size={12}/>{cert.attachment}</span>
                    ) : <span style={{fontSize:'11px', color:'#94a3b8'}}>No file</span>}
                 </td>
                 <td>
                    <span className="status-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content', fontSize:'12px', backgroundColor: cert.status === 'Draft' ? '#fef3c7' : cert.status === 'Approved' ? '#dcfce7' : '#e0f2fe', color: cert.status === 'Draft' ? '#d97706' : cert.status === 'Approved' ? '#166534' : '#0369a1' }}>
                        <CheckCircle size={12} /> {cert.status}
                    </span>
                 </td>
                 <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <ActionButton icon={<Mail size={14}/>} label="Email" color="#059669" onClick={() => handleEmailDispatch(cert)} title="Dispatch via email" />
                    <ActionButton icon={<MessageCircle size={14}/>} label="WhatsApp" color="#16a34a" onClick={() => handleWhatsAppDispatch(cert)} title="Dispatch via WhatsApp" />
                    <ActionButton icon={<Eye size={14}/>} label="View" color="#3b82f6" onClick={() => handleViewAction(cert)} />
                    <ActionButton icon={<Download size={14}/>} label="PDF+QR" color="#7c3aed" onClick={() => handleDownloadAction(cert)} title="Download PDF with QR verification"/>
                    <ActionButton icon={<Edit size={14}/>} label="Edit" color="#64748b" onClick={() => handleSubmitRowAction(cert, 'main')} />
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>

       {/* --- SURVEILLANCE CERTIFICATE DELIVERY TABLE --- */}
       <div style={{ marginTop: '40px' }}>
         <div className="scope-header">
            <div>
              <h2 style={{ fontSize: '1.25rem', color: '#1e293b' }}>Surveillance Certificate Delivery</h2>
            </div>
         </div>
         <div className="table-wrap">
           <table className="checklists-table">
             <thead>
                 <tr>
                   <th>Cert No.</th>
                   <th>Client Name</th>
                   <th>Standard & Scope</th>
                   <th>Dates</th>
                   <th>Attachment</th>
                   <th>Status</th>
                   <th style={{ minWidth: '400px' }}>Action</th>
                 </tr>
             </thead>
             <tbody>
               {survCertificates.map(cert => (
                 <tr key={cert.id}>
                   <td><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Layers size={16} color="#c026d3"/><span style={{fontWeight: 600, color: '#1e293b'}}>{cert.certificateNumber}</span></div></td>
                   <td><div style={{display:'flex', flexDirection:'column'}}><strong>{getClientName(cert.clientId)}</strong><span style={{fontSize:'11px', color:'#64748b'}}>{cert.address}</span></div></td>
                   <td><div style={{fontSize:'12px'}}><div style={{fontWeight:600, color: '#0f766e'}}>{cert.standard}</div><div style={{color:'#475569'}}>{cert.scope}</div></div></td>
                   <td><div style={{fontSize:'12px', display:'flex', flexDirection:'column', gap:'4px'}}><div>Iss: {cert.issuedDate}</div><div style={{color: '#dc2626'}}>Exp: {cert.expirationDate}</div></div></td>
                   <td>
                      {cert.attachment ? (
                          <span style={{fontSize:'11px', color:'#0369a1', display:'flex', alignItems:'center', gap:'4px'}}><FileText size={12}/>{cert.attachment}</span>
                      ) : <span style={{fontSize:'11px', color:'#94a3b8'}}>No file</span>}
                   </td>
                   <td>
                      <span className="status-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content', fontSize:'12px', backgroundColor: cert.status === 'Draft' ? '#fef3c7' : cert.status === 'Approved' ? '#dcfce7' : '#e0f2fe', color: cert.status === 'Draft' ? '#d97706' : cert.status === 'Approved' ? '#166534' : '#0369a1' }}>
                          <CheckCircle size={12} /> {cert.status}
                      </span>
                   </td>
                   <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <ActionButton icon={<Mail size={14}/>} label="Email" color="#059669" onClick={() => handleEmailDispatch(cert)} />
                      <ActionButton icon={<MessageCircle size={14}/>} label="WhatsApp" color="#16a34a" onClick={() => handleWhatsAppDispatch(cert)} />
                      <ActionButton icon={<Eye size={14}/>} label="View" color="#3b82f6" onClick={() => handleViewAction(cert)} />
                      <ActionButton icon={<Download size={14}/>} label="PDF+QR" color="#7c3aed" onClick={() => handleDownloadAction(cert)} title="Download PDF with QR verification"/>
                      <ActionButton icon={<Edit size={14}/>} label="Edit" color="#64748b" onClick={() => handleSubmitRowAction(cert, 'surv')} />
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       </div>

       <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
};

const ActionButton = ({ icon, label, color, onClick, title }: any) => (
    <button onClick={onClick} title={title || label} style={{ backgroundColor: color, color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 500, transition: 'background-color 0.2s', whiteSpace: 'nowrap' }}>{icon} {label}</button>
);

export default CertificateDelivery;