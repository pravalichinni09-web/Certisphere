/**
 * Client Onboarding Letter — QMICS letterhead, filled in automatically from
 * the client's registration and workflow (name, standard, client code,
 * coordinator, scope, next steps). View, download or email it per client.
 */
import jsPDF from 'jspdf';
import { preloadCertificateLogo, getCertificateLogo } from './certificatePdf';

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

const COMPANY = 'QMICS SOLUTIONS AND COMPLIANCES PVT. LTD.';
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
  doc.setTextColor(...GREEN); doc.setFont('helvetica', 'bold'); doc.setFontSize(13.5);
  doc.text(COMPANY, M + 27, 17);
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

  // ── subject ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
  const subj = doc.splitTextToSize(`Subject: Welcome to QMICS Certification – ${d.standard}${d.auditType ? ` (${d.auditType})` : ''}`, W - 2 * M);
  doc.text(subj, M, y); y += subj.length * 5.2 + 3;

  // ── body ──
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  const para = (t: string, gap = 3) => { const l = doc.splitTextToSize(t, W - 2 * M); doc.text(l, M, y); y += l.length * 4.9 + gap; };
  para(`Dear ${d.contactPerson || 'Sir/Madam'},`);
  para(`Thank you for choosing QMICS Solutions and Compliances Pvt. Ltd. as your certification body. We are pleased to confirm that ${d.organizationName} has been registered with us for ${d.standard} certification. Your registration details are given below.`);

  // ── details table ──
  const rows: [string, string][] = [
    ['Client code', d.clientCode || `#${d.clientId}`],
    ['Organisation', d.organizationName],
    ['Standard', d.standard],
    ['Type of audit', d.auditType || 'Initial Certification'],
    ['Scope of certification', d.scope || 'To be confirmed during the application review'],
    ['Registration date', fmtDate(d.registrationDate)],
    ['Your Audit Coordinator', d.coordinator || 'Will be assigned shortly'],
  ];
  const c1 = 52, rowPad = 2.4;
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
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...GREEN); doc.text('Next steps', M, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(15, 23, 42);
  const steps = [
    d.applicationReceived
      ? 'Application for Certification: received – thank you.'
      : 'Please fill in, sign and return the Application for Certification (QMICS/F-01), if not already sent.',
    'Application review: we confirm the scope, sites and audit duration and share the quotation / agreement.',
    `Audit planning: ${d.coordinator || 'your Audit Coordinator'} will propose the audit dates and audit team for your confirmation.`,
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
  para(`For any questions, please contact ${d.coordinator ? `${d.coordinator} (Audit Coordinator) or ` : ''}us at rk@qmicssolutions.com / +91 98494 99111. We look forward to working with you.`, 6);

  // ── signature ──
  doc.text('Warm regards,', M, y); y += 5;
  doc.setFont('helvetica', 'bold'); doc.text('For QMICS Solutions and Compliances Pvt. Ltd.', M, y); y += 16;
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
  const win = window.open('', '_blank');
  await preloadCertificateLogo();
  const url = String(onboardingLetterPdf(d).output('bloburl'));
  if (win) win.location.href = url; else window.open(url, '_blank');
};
/** The letter as a File, ready to attach to an email. */
export const onboardingLetterFile = async (d: OnboardingLetterData): Promise<File> => {
  await preloadCertificateLogo();
  const blob = onboardingLetterPdf(d).output('blob');
  return new File([blob], onboardingLetterFileName(d.organizationName), { type: 'application/pdf' });
};
