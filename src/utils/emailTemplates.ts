/**
 * Email template store. Tokens like {{clientName}} are expanded at render-time.
 */

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  /** Audit-stage tag for filtering (optional). */
  tag?: 'dispatch' | 'reminder' | 'welcome' | 'cert' | 'general';
}

const STORAGE_KEY = 'cms_email_templates';

const SEED: EmailTemplate[] = [
  {
    id: 'tpl-dispatch-default',
    name: 'Application dispatch — default',
    subject: 'Audit application package — {{clientName}}',
    body:
      'Dear {{contactName}},\n\n' +
      'Please find your audit application package for {{clientName}} attached. ' +
      'Kindly review and confirm receipt by {{dueDate}}.\n\n' +
      'Audit standard: {{standard}}\nClient code: {{clientCode}}\n\n' +
      'Regards,\n{{senderName}}\nAudit Coordinator',
    tag: 'dispatch',
  },
  {
    id: 'tpl-reminder-48h',
    name: 'Reminder — 48 hours',
    subject: 'Reminder: pending confirmation for {{clientName}}',
    body:
      'Hi {{contactName}},\n\nA quick reminder that we are awaiting your confirmation on {{auditTitle}} ' +
      'scheduled for {{auditDate}}. Please respond at your earliest convenience.\n\nThanks,\n{{senderName}}',
    tag: 'reminder',
  },
  {
    id: 'tpl-welcome-auditor',
    name: 'Auditor welcome',
    subject: 'Welcome to CertMS — {{auditorName}}',
    body:
      'Hello {{auditorName}},\n\nYour CertMS account has been provisioned.\n\n' +
      'Email: {{auditorEmail}}\nTemporary password: {{tempPassword}}\nRole: {{role}}\n\n' +
      'Please sign in and update your password.\n\nRegards,\nCertMS team',
    tag: 'welcome',
  },
  {
    id: 'tpl-cert-issued',
    name: 'Certificate issued',
    subject: 'Your certificate is ready — {{clientName}}',
    body:
      'Dear {{contactName}},\n\nYour {{standard}} certificate ({{certificateNumber}}) has been issued. ' +
      'Verify the certificate at {{verifyUrl}}.\n\nValid until {{expiryDate}}.\n\nRegards,\nCertMS',
    tag: 'cert',
  },
];

const readAll = (): EmailTemplate[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      return SEED.slice();
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : SEED.slice();
  } catch {
    return SEED.slice();
  }
};

const writeAll = (list: EmailTemplate[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('email-templates-updated'));
  } catch {
    // ignore
  }
};

export const listEmailTemplates = (tag?: EmailTemplate['tag']): EmailTemplate[] => {
  const all = readAll();
  return tag ? all.filter((t) => !t.tag || t.tag === tag) : all;
};

export const upsertEmailTemplate = (tpl: EmailTemplate): void => {
  const all = readAll();
  const idx = all.findIndex((t) => t.id === tpl.id);
  if (idx >= 0) all[idx] = tpl;
  else all.push(tpl);
  writeAll(all);
};

export const deleteEmailTemplate = (id: string): void => {
  writeAll(readAll().filter((t) => t.id !== id));
};

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export const renderTemplate = (
  template: EmailTemplate,
  vars: Record<string, string | number | undefined | null>
): { subject: string; body: string } => {
  const expand = (raw: string): string =>
    raw.replace(TOKEN_RE, (_m, key: string) => {
      const v = vars[key];
      return v === undefined || v === null ? '' : String(v);
    });
  return { subject: expand(template.subject), body: expand(template.body) };
};
