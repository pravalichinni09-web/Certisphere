/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              CertiSphere — EmailJS Configuration             ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  HOW TO GET THESE KEYS                                       ║
 * ║  1. Go to https://www.emailjs.com  →  Sign up (free tier)   ║
 * ║  2. Email Services → Add New Service (Gmail / SMTP / etc.)  ║
 * ║     → Connect your email account → copy  SERVICE ID          ║
 * ║  3. Email Templates → Create Template (once per type below) ║
 * ║     → Use the variable names in TEMPLATE_VARIABLE_GUIDES    ║
 * ║     → Copy each  TEMPLATE ID  into DEFAULTS.TEMPLATES       ║
 * ║  4. Account → API Keys → copy  PUBLIC KEY                    ║
 * ║  5. (Optional) copy  PRIVATE KEY  for server-side calls      ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Keys can also be entered at runtime:                        ║
 * ║  Audit Coordinator → Settings → Email Configuration         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── localStorage keys (runtime overrides from settings panel) ───
export const EMAILJS_STORAGE = {
  SERVICE_ID:       'cms_ejs_service_id',
  PUBLIC_KEY:       'cms_ejs_public_key',
  TPL_CONTACT:      'cms_ejs_tpl_contact',
  TPL_AUDIT_NOTIFY: 'cms_ejs_tpl_audit_notify',
  TPL_CERT_ISSUED:  'cms_ejs_tpl_cert_issued',
  TPL_EXPIRY_ALERT: 'cms_ejs_tpl_expiry_alert',
  TPL_WELCOME:      'cms_ejs_tpl_welcome',
  ENABLED:          'cms_ejs_enabled',
};

// ── Replace YOUR_... values with your real EmailJS credentials ───
export const EMAILJS_DEFAULTS = {
  SERVICE_ID:  'YOUR_SERVICE_ID',   // e.g.  service_abc123
  PUBLIC_KEY:  'YOUR_PUBLIC_KEY',   // e.g.  aBcDeFgHiJkLmNoP

  TEMPLATES: {
    /** Website contact / enquiry form  */
    CONTACT:      'YOUR_TEMPLATE_CONTACT',      // template_contact01
    /** Audit scheduled notification to client */
    AUDIT_NOTIFY: 'YOUR_TEMPLATE_AUDIT_NOTIFY', // template_audit01
    /** Certificate issued — cert details to client */
    CERT_ISSUED:  'YOUR_TEMPLATE_CERT_ISSUED',  // template_cert01
    /** Certificate expiring-soon alert */
    EXPIRY_ALERT: 'YOUR_TEMPLATE_EXPIRY_ALERT', // template_expiry01
    /** Welcome email for new auditors / coordinators */
    WELCOME:      'YOUR_TEMPLATE_WELCOME',      // template_welcome01
  },
};

// ── Live config reader  (localStorage values take priority) ──────
export const getEmailJSConfig = () => {
  const g = (key: string, fallback: string) =>
    localStorage.getItem(key) || fallback;

  return {
    serviceId:  g(EMAILJS_STORAGE.SERVICE_ID,       EMAILJS_DEFAULTS.SERVICE_ID),
    publicKey:  g(EMAILJS_STORAGE.PUBLIC_KEY,        EMAILJS_DEFAULTS.PUBLIC_KEY),
    enabled:    localStorage.getItem(EMAILJS_STORAGE.ENABLED) !== 'false',
    templates: {
      contact:     g(EMAILJS_STORAGE.TPL_CONTACT,      EMAILJS_DEFAULTS.TEMPLATES.CONTACT),
      auditNotify: g(EMAILJS_STORAGE.TPL_AUDIT_NOTIFY,  EMAILJS_DEFAULTS.TEMPLATES.AUDIT_NOTIFY),
      certIssued:  g(EMAILJS_STORAGE.TPL_CERT_ISSUED,   EMAILJS_DEFAULTS.TEMPLATES.CERT_ISSUED),
      expiryAlert: g(EMAILJS_STORAGE.TPL_EXPIRY_ALERT,  EMAILJS_DEFAULTS.TEMPLATES.EXPIRY_ALERT),
      welcome:     g(EMAILJS_STORAGE.TPL_WELCOME,       EMAILJS_DEFAULTS.TEMPLATES.WELCOME),
    },
  };
};

export const isEmailJSConfigured = (): boolean => {
  const cfg = getEmailJSConfig();
  return (
    cfg.enabled &&
    !cfg.serviceId.startsWith('YOUR_') &&
    !cfg.publicKey.startsWith('YOUR_')
  );
};

/** Variable reference for building EmailJS templates in the dashboard */
export const TEMPLATE_VARIABLE_GUIDES: Record<string, { var: string; desc: string }[]> = {
  CONTACT: [
    { var: '{{from_name}}',   desc: 'Sender full name' },
    { var: '{{from_email}}',  desc: 'Sender email address' },
    { var: '{{company}}',     desc: 'Sender company / organisation' },
    { var: '{{phone}}',       desc: 'Sender phone number' },
    { var: '{{message}}',     desc: 'Message body' },
    { var: '{{to_name}}',     desc: 'Your team / recipient name' },
  ],
  AUDIT_NOTIFY: [
    { var: '{{to_email}}',    desc: 'Client email address' },
    { var: '{{client_name}}', desc: 'Organisation name' },
    { var: '{{audit_type}}',  desc: 'e.g. Surveillance 1' },
    { var: '{{audit_date}}',  desc: 'Scheduled audit date' },
    { var: '{{auditor}}',     desc: 'Lead auditor name' },
    { var: '{{standard}}',    desc: 'ISO standard' },
    { var: '{{location}}',    desc: 'Audit location' },
  ],
  CERT_ISSUED: [
    { var: '{{to_email}}',    desc: 'Client email address' },
    { var: '{{client_name}}', desc: 'Organisation name' },
    { var: '{{standard}}',    desc: 'ISO standard' },
    { var: '{{cert_number}}', desc: 'Certificate number' },
    { var: '{{issue_date}}',  desc: 'Issue date' },
    { var: '{{expiry_date}}', desc: 'Expiry date' },
    { var: '{{verify_url}}',  desc: 'Certificate verification link' },
  ],
  EXPIRY_ALERT: [
    { var: '{{to_email}}',    desc: 'Client email address' },
    { var: '{{client_name}}', desc: 'Organisation name' },
    { var: '{{cert_number}}', desc: 'Certificate number' },
    { var: '{{standard}}',    desc: 'ISO standard' },
    { var: '{{expiry_date}}', desc: 'Expiry date' },
    { var: '{{days_left}}',   desc: 'Days until expiry' },
    { var: '{{action}}',      desc: 'Recommended action (e.g. Recertification)' },
  ],
  WELCOME: [
    { var: '{{to_email}}',      desc: 'User email address' },
    { var: '{{user_name}}',     desc: 'Full name' },
    { var: '{{temp_password}}', desc: 'Temporary password' },
    { var: '{{role}}',          desc: 'Assigned role' },
    { var: '{{login_url}}',     desc: 'App login URL' },
  ],
};
