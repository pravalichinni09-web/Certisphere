/**
 * certificatePdf — the QMICS "Certificate of Registration" as a PDF.
 * Same design as Certificate Delivery; used for clients certified through
 * the workflow (Certifications View, Certificate Delivery, Management, tracker).
 */
import jsPDF from 'jspdf';
import { qrModules } from '../utils/qrcode';

export interface CertificatePdfData {
  clientId: string;
  clientName: string;
  address?: string;
  standard: string;
  scope?: string;
  certificateNumber: string;
  issuedDate: string;
  expirationDate: string;
  surveillance1Due: string;
  surveillance2Due: string;
  recertificationDueDate: string;
}

const buildVerificationUrl = (cert: { certificateNumber: string; clientId: string }): string =>
  `https://verify.qmics.com/cert/${encodeURIComponent(cert.certificateNumber)}?c=${encodeURIComponent(cert.clientId)}`;

export const certificatePdf = (data: CertificatePdfData): jsPDF => {
  const clientName = data.clientName || 'Client';
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
  doc.setFontSize(12.5);
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
  const col1X = 62;
  const col2X = 128;

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
  doc.text("IRQAO\nREGISTERED\nwww.irqao.com", 100, startY + 56, { align: "center" });

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
    const qrSizeMm = 26;
    const qrX = 22;
    const qrY = 196;
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


  return doc;
};

export const downloadCertificatePdf = (data: CertificatePdfData): void => {
  certificatePdf(data).save(`${data.clientName.replace(/\s+/g, '_')}_Certificate_${data.certificateNumber}.pdf`);
};

/** Opens the PDF in a new tab to view / print. */
export const viewCertificatePdf = (data: CertificatePdfData): void => {
  const url = certificatePdf(data).output('bloburl');
  window.open(String(url), '_blank', 'noopener');
};
