/**
 * Client Onboarding Letter — QMICS letterhead, filled in automatically from
 * the client's registration and workflow (name, standard, client code,
 * coordinator, scope, next steps). View, download or email it per client.
 */
import jsPDF from 'jspdf';
import { preloadCertificateLogo, getCertificateLogo } from './certificatePdf';
import { showPdf } from './pdfViewer';

export interface OnboardingLetterData {
  clientId: number;
  organizationName: string;
  contactPerson?: string;
  email?: string;
  address?: string;
  clientCode?: string;
  standard: string;
  auditType?: string;
  scope?: string;
  registrationDate?: string;
  coordinator?: string;
  applicationReceived: boolean;
  letterDate?: string;
}

const COMPANY = 'QMICS Solutions Pvt. Ltd.';
const CONTACT = 'Hyderabad, Telangana, India  |  rk@qmicssolutions.com  |  +91 98494 99111  |  qmicscertifications.com';
const GREEN: [number, number, number] = [20, 83, 45];
const GREEN2: [number, number, number] = [22, 101, 52];
const GREY: [number, number, number] = [71, 85, 105];

const fmtDate = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? String(iso || '') : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
};

export const onboardingLetterFileName = (org: string) =>
  `${(org || 'Client').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()} - Onboarding Letter.pdf`;

export const onboardingLetterPdf = (d: OnboardingLetterData): jsPDF => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `${d.organizationName} – Onboarding Letter`, subject: 'Client Onboarding Letter', author: COMPANY });
  const W = 210, M = 18;
  let y = 0;

  // ── letterhead ──
  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 3, 'F');
  const logo = getCertificateLogo();
  if (logo) doc.addImage(logo, 'PNG', M, 9, 22, 21.4, undefined, 'FAST');
  doc.setTextColor(...GREEN); doc.setFont('times', 'bold'); doc.setFontSize(17);
  doc.text(COMPANY, M + 27, 17.5);
  doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2);
  doc.text('Management Systems Certification', M + 27, 22.5);
  doc.text(CONTACT, M + 27, 27);
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.5); doc.line(M, 34, W - M, 34);
  y = 42;

  // ── reference + date ──
  doc.setTextColor(15, 23, 42); doc.setFontSize(9.5);
  const year = new Date(d.letterDate || Date.now()).getFullYear();
  doc.text(`Ref: QMICS/ONB/${d.clientCode || d.clientId}/${year}`, M, y);
  doc.text(`Date: ${fmtDate(d.letterDate)}`, W - M, y, { align: 'right' });
  y += 9;

  // ── addressee ──
  doc.setFont('helvetica', 'normal'); doc.text('To,', M, y); y += 5;
  doc.setFont('helvetica', 'bold');
  if (d.contactPerson) { doc.text(d.contactPerson, M, y); y += 5; }
  doc.text(d.organizationName, M, y); y += 5;
  doc.setFont('helvetica', 'normal');
  if (d.address) { const a = doc.splitTextToSize(d.address, 110); doc.text(a, M, y); y += a.length * 4.6; }
  if (d.email) { doc.text(d.email, M, y); y += 5; }
  y += 4;

  // ── headings: Times Bold, white on a QMICS-green band ──
  const band = (text: string, size = 11.5) => {
    doc.setFont('times', 'bold'); doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, W - 2 * M - 8);
    const h = lines.length * size * 0.42 + 3.6;
    // Classic heading: green Times Bold between two thin gold rules
    doc.setDrawColor(201, 151, 0); doc.setLineWidth(0.5);
    doc.line(M, y, W - M, y); doc.line(M, y + h, W - M, y + h);
    doc.setLineWidth(0.2);
    doc.setTextColor(...GREEN); doc.text(lines, M + 1, y + size * 0.36 + 1.8);
    doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    y += h + 3;
  };

  // ── subject ──
  band(`Subject: Welcome to QMICS Solutions Pvt. Ltd. – ${d.standard}${d.auditType ? ` (${d.auditType})` : ''}`, 12);

  // ── body ──
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  const para = (t: string, gap = 3) => { const l = doc.splitTextToSize(t, W - 2 * M); doc.text(l, M, y); y += l.length * 4.9 + gap; };
  y += 3;
  para(`Dear ${d.contactPerson || 'Sir/Madam'},`);
  para(`Thank you for choosing QMICS Solutions Pvt. Ltd. as your certification body. We are pleased to confirm that ${d.organizationName} has been registered with us for ${d.standard} certification. Your registration details are given below.`);

  // ── details table ──
  band('Registration details');
  const rows: [string, string][] = [
    ['Client code', d.clientCode || `#${d.clientId}`],
    ['Organisation', d.organizationName],
    ['Standard', d.standard],
    ['Type of audit', d.auditType || 'Initial Certification'],
    ['Scope of certification', d.scope || 'To be confirmed during the application review'],
    ['Registration date', fmtDate(d.registrationDate)],
    ['Point of contact', 'Audit Coordinator, QMICS Solutions Pvt. Ltd.'],
  ];
  const c1 = 52, rowPad = 1.9;
  rows.forEach(([k, v], i) => {
    const lines = doc.splitTextToSize(v, W - 2 * M - c1 - 4);
    const h = Math.max(1, lines.length) * 4.8 + rowPad * 2 - 1;
    if (i % 2 === 0) { doc.setFillColor(240, 253, 244); doc.rect(M, y, W - 2 * M, h, 'F'); }
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREEN2); doc.text(k, M + 3, y + rowPad + 3.2);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42); doc.text(lines, M + c1, y + rowPad + 3.2);
    y += h;
  });
  doc.setDrawColor(187, 247, 208); doc.setLineWidth(0.3);
  y += 6;

  // ── next steps ──
  band('Next steps');
  y += 1;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(15, 23, 42);
  const steps = [
    d.applicationReceived
      ? 'Application for Certification: received – thank you.'
      : 'Please fill in, sign and return the Application for Certification (QMICS/F-01), if not already sent.',
    'Application review: we confirm the scope, sites and audit duration and share the quotation / agreement.',
    'Audit planning: the Audit Coordinator will propose the audit dates and audit team for your confirmation.',
    'Audit: the audit team visits your site; any findings are shared with you for corrective action.',
    'Certification: after the corrective actions are accepted, the certificate is issued and delivered to you.',
  ];
  steps.forEach((t, i) => {
    const l = doc.splitTextToSize(t, W - 2 * M - 8);
    doc.setFont('helvetica', 'bold'); doc.text(`${i + 1}.`, M + 1, y);
    doc.setFont('helvetica', 'normal'); doc.text(l, M + 8, y);
    y += l.length * 4.9 + 1.6;
  });
  y += 3;
  para('For any questions, please contact the Audit Coordinator at rk@qmicssolutions.com / +91 98494 99111. We look forward to working with you.', 6);

  // ── signature ──
  doc.text('Warm regards,', M, y); y += 5;
  doc.setFont('helvetica', 'bold'); doc.text('For QMICS Solutions Pvt. Ltd.', M, y); y += 13;
  doc.setDrawColor(148, 163, 184); doc.setLineWidth(0.3); doc.line(M, y, M + 55, y); y += 4.5;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...GREY); doc.text('Authorised Signatory', M, y);

  // ── footer ──
  doc.setDrawColor(203, 213, 225); doc.line(M, 284, W - M, 284);
  doc.setFontSize(7.5); doc.setTextColor(...GREY);
  doc.text('This letter is generated by CertiSphere for the client named above.', M, 289);
  doc.text('qmicscertifications.com', W - M, 289, { align: 'right' });
  return doc;
};

export const downloadOnboardingLetter = async (d: OnboardingLetterData): Promise<void> => {
  await preloadCertificateLogo();
  onboardingLetterPdf(d).save(onboardingLetterFileName(d.organizationName));
};
export const viewOnboardingLetter = async (d: OnboardingLetterData): Promise<void> => {
  await preloadCertificateLogo();
  showPdf(onboardingLetterPdf(d).output('blob'), onboardingLetterFileName(d.organizationName), `${d.organizationName} – Onboarding Letter`);
};
/** The letter as a File, ready to attach to an email. */
export const onboardingLetterFile = async (d: OnboardingLetterData): Promise<File> => {
  await preloadCertificateLogo();
  const blob = onboardingLetterPdf(d).output('blob');
  return new File([blob], onboardingLetterFileName(d.organizationName), { type: 'application/pdf' });
};
