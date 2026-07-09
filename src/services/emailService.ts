/**
 * CertiSphere — Email Service
 *
 * Sends emails via EmailJS (@emailjs/browser).
 * Falls back to a localStorage queue when EmailJS is not yet configured
 * so the app stays fully functional in demo mode.
 *
 * Configure keys:  Audit Coordinator → Settings → Email Configuration
 * or edit:         src/config/emailjsConfig.ts
 */

import emailjs from '@emailjs/browser';
import { getEmailJSConfig, isEmailJSConfigured } from '../config/emailjsConfig';

// ── Types ────────────────────────────────────────────────────────

export type EmailType =
  | 'contact'
  | 'audit_notify'
  | 'cert_issued'
  | 'expiry_alert'
  | 'welcome'
  | 'general';

export interface EmailMessage {
  type?: EmailType;
  to: string;
  subject: string;
  body: string;
  /** Extra template variables forwarded to EmailJS */
  templateVars?: Record<string, string>;
  sentAt?: string | null;
  status?: 'queued' | 'sending' | 'sent' | 'failed';
  error?: string | null;
}

// ── Queue (localStorage fallback) ────────────────────────────────

const QUEUE_KEY = 'cms_email_queue_v1';

const readQueue = (): EmailMessage[] => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
};
const writeQueue = (q: EmailMessage[]) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
};

// ── Template ID resolver ─────────────────────────────────────────

const resolveTemplateId = (type: EmailType | undefined): string => {
  const { templates } = getEmailJSConfig();
  switch (type) {
    case 'contact':      return templates.contact;
    case 'audit_notify': return templates.auditNotify;
    case 'cert_issued':  return templates.certIssued;
    case 'expiry_alert': return templates.expiryAlert;
    case 'welcome':      return templates.welcome;
    default:             return templates.contact; // generic fallback
  }
};

// ── Core send function ───────────────────────────────────────────

export async function sendEmail(message: EmailMessage): Promise<EmailMessage> {
  const msg: EmailMessage = {
    ...message,
    sentAt: null,
    status: 'sending',
    error: null,
  };

  // ── Fallback: queue if EmailJS not configured ─────────────────
  if (!isEmailJSConfigured()) {
    msg.status = 'queued';
    const q = readQueue();
    q.unshift({ ...msg });
    writeQueue(q);
    window.dispatchEvent(new CustomEvent('cms-email-queued', { detail: msg }));
    console.info('[EmailService] Queued (EmailJS not configured):', msg.subject);
    return msg;
  }

  const cfg = getEmailJSConfig();

  // Build template params — merge standard fields + any extra vars
  const templateParams: Record<string, string> = {
    to_email:    message.to,
    subject:     message.subject,
    message:     message.body,
    from_name:   'CertiSphere',
    to_name:     message.to,
    reply_to:    'noreply@certisphere.com',
    ...(message.templateVars || {}),
  };

  try {
    // Initialise each time with fresh public key (supports runtime key changes)
    emailjs.init({ publicKey: cfg.publicKey });

    await emailjs.send(
      cfg.serviceId,
      resolveTemplateId(message.type),
      templateParams,
    );

    msg.status = 'sent';
    msg.sentAt = new Date().toISOString();
    window.dispatchEvent(new CustomEvent('cms-email-sent', { detail: msg }));
    console.info('[EmailService] Sent via EmailJS:', msg.subject);
    return msg;

  } catch (err: any) {
    msg.status = 'failed';
    msg.error = String(err?.text || err?.message || err);
    // Save failed messages to queue for retry
    const q = readQueue();
    q.unshift({ ...msg });
    writeQueue(q);
    window.dispatchEvent(new CustomEvent('cms-email-failed', { detail: msg }));
    console.error('[EmailService] Failed:', msg.error);
    return msg;
  }
}

// ── Convenience senders ──────────────────────────────────────────

export const sendContactForm = (params: {
  fromName: string;
  fromEmail: string;
  company?: string;
  phone?: string;
  message: string;
}) =>
  sendEmail({
    type: 'contact',
    to: params.fromEmail,
    subject: `New Enquiry from ${params.fromName}`,
    body: params.message,
    templateVars: {
      from_name:  params.fromName,
      from_email: params.fromEmail,
      company:    params.company || '',
      phone:      params.phone   || '',
      message:    params.message,
    },
  });

export const sendAuditNotification = (params: {
  clientName: string;
  toEmail: string;
  auditType: string;
  auditDate: string;
  auditor: string;
  standard: string;
  location?: string;
}) =>
  sendEmail({
    type: 'audit_notify',
    to: params.toEmail,
    subject: `Audit Scheduled: ${params.auditType} — ${params.clientName}`,
    body: `Your ${params.auditType} audit is scheduled for ${params.auditDate}.`,
    templateVars: {
      to_email:    params.toEmail,
      client_name: params.clientName,
      audit_type:  params.auditType,
      audit_date:  params.auditDate,
      auditor:     params.auditor,
      standard:    params.standard,
      location:    params.location || 'On-site',
    },
  });

export const sendCertificateIssued = (params: {
  clientName: string;
  toEmail: string;
  standard: string;
  certNumber: string;
  issueDate: string;
  expiryDate: string;
  verifyUrl?: string;
}) =>
  sendEmail({
    type: 'cert_issued',
    to: params.toEmail,
    subject: `Certificate Issued: ${params.standard} — ${params.certNumber}`,
    body: `Your ${params.standard} certificate (${params.certNumber}) has been issued.`,
    templateVars: {
      to_email:    params.toEmail,
      client_name: params.clientName,
      standard:    params.standard,
      cert_number: params.certNumber,
      issue_date:  params.issueDate,
      expiry_date: params.expiryDate,
      verify_url:  params.verifyUrl || window.location.origin,
    },
  });

export const sendExpiryAlert = (params: {
  clientName: string;
  toEmail: string;
  certNumber: string;
  standard: string;
  expiryDate: string;
  daysLeft: number;
}) =>
  sendEmail({
    type: 'expiry_alert',
    to: params.toEmail,
    subject: `Action Required: ${params.standard} certificate expiring in ${params.daysLeft} days`,
    body: `Certificate ${params.certNumber} expires on ${params.expiryDate}.`,
    templateVars: {
      to_email:    params.toEmail,
      client_name: params.clientName,
      cert_number: params.certNumber,
      standard:    params.standard,
      expiry_date: params.expiryDate,
      days_left:   String(params.daysLeft),
      action:      params.daysLeft <= 30 ? 'Recertification' : 'Surveillance Audit',
    },
  });

export const sendWelcomeEmail = (params: {
  userName: string;
  toEmail: string;
  tempPassword: string;
  role: string;
}) =>
  sendEmail({
    type: 'welcome',
    to: params.toEmail,
    subject: `Welcome to CertiSphere — ${params.userName}`,
    body: `Your CertiSphere account has been created. Role: ${params.role}`,
    templateVars: {
      to_email:       params.toEmail,
      user_name:      params.userName,
      temp_password:  params.tempPassword,
      role:           params.role,
      login_url:      window.location.origin,
    },
  });

// ── Queue utilities ──────────────────────────────────────────────

export const listQueuedEmails = (): EmailMessage[] => readQueue();

export const clearEmailQueue = (): void => {
  writeQueue([]);
  window.dispatchEvent(new Event('cms-email-queue-cleared'));
};

export default {
  sendEmail,
  sendContactForm,
  sendAuditNotification,
  sendCertificateIssued,
  sendExpiryAlert,
  sendWelcomeEmail,
  listQueuedEmails,
  clearEmailQueue,
};
