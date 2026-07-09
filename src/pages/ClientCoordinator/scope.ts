/**
 * Client Coordinator — real-time, org-scoped data layer.
 *
 * Reads from the SAME localStorage keys the Audit Coordinator writes to:
 *   cms_certificates          — issued certificates
 *   cms_audit_certifications  — certification records
 *   cms_audit_schedules       — audit schedules
 *   cms_audit_reports         — audit reports
 *   cms_client_registrations  — org profile
 *
 * Falls back to synthetic seed data if no real records exist for this org
 * so the demo always looks populated.
 *
 * Real-time updates:
 *   • Fires a custom DOM event 'cms-cc-data-changed' whenever data is read
 *     after a change is detected.
 *   • Use the exported `subscribeToChanges(cb)` helper or the
 *     `useRealtimeScope` hook (see useRealtimeScope.ts).
 */

// ─────────────────────────────────────────────────────────────────
// Storage helpers
// ─────────────────────────────────────────────────────────────────
const ORG_KEY = 'cms_active_org_id';

const safe = <T,>(k: string, fb: T): T => {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; }
};

// ─────────────────────────────────────────────────────────────────
// Active org resolution
// ─────────────────────────────────────────────────────────────────
export const getActiveOrgId = (): number | null => {
  try {
    const raw = localStorage.getItem(ORG_KEY);
    if (raw) return Number(raw);
    const clients = safe<any[]>('cms_client_registrations', []);
    if (clients.length > 0) {
      localStorage.setItem(ORG_KEY, String(clients[0].id));
      return Number(clients[0].id);
    }
  } catch { /* ignore */ }
  return null;
};

export const setActiveOrgId = (id: number): void => {
  try { localStorage.setItem(ORG_KEY, String(id)); } catch { /* ignore */ }
};

// ─────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────
export interface OrgClient {
  id: number;
  organizationName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  standard?: string;
  clientType?: string;
  clientCode?: string;
  industry?: string;
}

export interface Branch {
  id: number;
  orgId: number;
  name: string;
  location: string;
  manager?: string;
}

export interface Certification {
  id: number;
  orgId: number;
  branchId?: number;
  standard: string;
  scope: string;
  category?: string;
  issueDate: string;
  expiryDate: string;
  status: 'Active' | 'Expiring Soon' | 'Expired';
  certNumber?: string;
  pdfUrl?: string;
  // extra real-data fields
  surveillance1Due?: string;
  surveillance2Due?: string;
  recertificationDue?: string;
  auditType?: string;
}

export interface AuditScheduleRow {
  id: string | number;
  orgId: number;
  branchId?: number;
  type: string;
  date: string;
  auditor: string;
  status: string;
  standard?: string;
}

export interface AuditReportRow {
  id: string | number;
  orgId: number;
  certId?: number;
  branchId?: number;
  date: string;
  auditor: string;
  standard: string;
  findings: number;
  major?: number;
  minor?: number;
  ofi?: number;
  status: string;
  summary?: string;
  pdfUrl?: string;
}

// ─────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────
const inferStatus = (expiry: string): 'Active' | 'Expiring Soon' | 'Expired' => {
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'Expired';
  if (days <= 30) return 'Expiring Soon';
  return 'Active';
};

const categoryOf = (standard: string): string => {
  if (/27001/.test(standard)) return 'Information Security';
  if (/14001/.test(standard)) return 'Environmental';
  if (/45001/.test(standard)) return 'Health & Safety';
  if (/22000/.test(standard)) return 'Food Safety';
  if (/13485/.test(standard)) return 'Medical Devices';
  if (/50001/.test(standard)) return 'Energy Management';
  if (/42001/.test(standard)) return 'AI Governance';
  return 'Quality';
};

const addYears = (iso: string, years: number): string => {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
};

const addMonths = (iso: string, months: number): string => {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

// ─────────────────────────────────────────────────────────────────
// Org profile
// ─────────────────────────────────────────────────────────────────
export const getOrg = (): OrgClient | null => {
  const id = getActiveOrgId();
  if (id == null) return null;
  const clients = safe<any[]>('cms_client_registrations', []);
  return clients.find((c: any) => Number(c.id) === id) || null;
};

// ─────────────────────────────────────────────────────────────────
// Branches — derived from org country / address, seeded once
// ─────────────────────────────────────────────────────────────────
export const getBranches = (): Branch[] => {
  const id = getActiveOrgId();
  const org = getOrg();
  if (id == null || !org) return [];

  const stored = safe<Branch[]>('cms_org_branches_v1', []);
  const mine = stored.filter((b: Branch) => b.orgId === id);
  if (mine.length > 0) return mine;

  // Generate branches from real org data
  const country = org.country || 'India';
  const city = (org.address || '').split(',')[0].trim() || country;
  const seed: Branch[] = [
    { id: id * 10 + 1, orgId: id, name: 'Head Office',   location: city,         manager: org.contactPerson || 'Manager' },
    { id: id * 10 + 2, orgId: id, name: 'Branch Office', location: country,      manager: '' },
    { id: id * 10 + 3, orgId: id, name: 'Operations',    location: city,         manager: '' },
    { id: id * 10 + 4, orgId: id, name: 'R&D / Tech',    location: country,      manager: '' },
  ];
  try {
    localStorage.setItem('cms_org_branches_v1', JSON.stringify([...stored, ...seed]));
  } catch { /* ignore */ }
  return seed;
};

// ─────────────────────────────────────────────────────────────────
// Certifications — read from real issued-cert stores
// ─────────────────────────────────────────────────────────────────
export const getCertifications = (): Certification[] => {
  const id = getActiveOrgId();
  const org = getOrg();
  if (id == null || !org) return [];

  const results: Certification[] = [];
  const seen = new Set<string>();

  // ── Source 1: cms_certificates (issued by AC) ──────────────────
  const issuedCerts = safe<any[]>('cms_certificates', []);
  issuedCerts
    .filter((c: any) => Number(c.clientId) === id)
    .forEach((c: any, i: number) => {
      const key = c.certificateNumber || c.id;
      if (seen.has(String(key))) return;
      seen.add(String(key));
      const expiry = c.expiryDate || addYears(c.issueDate || new Date().toISOString().slice(0, 10), 3);
      results.push({
        id: i + 1,
        orgId: id,
        branchId: (id * 10 + 1 + (i % 4)),
        standard: c.standard || 'ISO 9001:2015',
        scope: c.type || 'Certification scope',
        category: categoryOf(c.standard || ''),
        issueDate: c.issueDate || new Date().toISOString().slice(0, 10),
        expiryDate: expiry,
        status: inferStatus(expiry),
        certNumber: c.certificateNumber || c.id,
        surveillance1Due: c.surveillance1Due || addMonths(expiry, -24),
        surveillance2Due: c.surveillance2Due || addMonths(expiry, -12),
        recertificationDue: c.recertificationDueDate || addMonths(expiry, -3),
        auditType: c.type,
      });
    });

  // ── Source 2: cms_audit_certifications (AC certification records) ──
  const auditCerts = safe<any[]>('cms_audit_certifications', []);
  auditCerts
    .filter((c: any) =>
      c.client === org.organizationName ||
      c.clientId === org.clientCode
    )
    .forEach((c: any, i: number) => {
      const key = c.certificateId || c.id;
      if (seen.has(String(key))) return;
      seen.add(String(key));
      const issueDate = c.certificateDate || new Date().toISOString().slice(0, 10);
      const validity = Number(c.validity) || 36;
      const expiry = addMonths(issueDate, validity);
      results.push({
        id: results.length + i + 1,
        orgId: id,
        branchId: (id * 10 + 1 + (i % 4)),
        standard: c.standard || 'ISO 9001:2015',
        scope: c.description || 'Certification scope',
        category: categoryOf(c.standard || ''),
        issueDate,
        expiryDate: expiry,
        status: inferStatus(expiry),
        certNumber: c.certificateId || c.id,
        recertificationDue: addMonths(expiry, -3),
        auditType: c.renewalPeriod,
      });
    });

  // ── Fallback: synthesize if no real data found ─────────────────
  if (results.length === 0) {
    return _syntheticCertifications(id);
  }

  return results.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
};

// ─────────────────────────────────────────────────────────────────
// Audit Schedules — from real cms_audit_schedules
// ─────────────────────────────────────────────────────────────────
export const getAuditSchedules = (): AuditScheduleRow[] => {
  const id = getActiveOrgId();
  const org = getOrg();
  if (id == null || !org) return [];

  const allSchedules = safe<any[]>('cms_audit_schedules', []);
  // Try both v3 key too
  const allSchedulesV3 = safe<any[]>('cms_audit_schedules_v3', []);
  const combined = [...allSchedules, ...allSchedulesV3];

  const orgName = org.organizationName;
  const real = combined.filter((s: any) =>
    s.organizationName === orgName ||
    s.client === orgName ||
    Number(s.clientId) === id
  );

  if (real.length > 0) {
    return real.map((s: any, i: number) => ({
      id: s.id || `s-${i}`,
      orgId: id,
      branchId: id * 10 + 1,
      type: s.auditType || s.type || 'Audit',
      date: s.date || s.scheduledDate || '',
      auditor: [s.leadAuditor, s.auditor].filter(Boolean).filter((v, idx, arr) => arr.indexOf(v) === idx).join(' · ') || '—',
      status: s.status || 'Scheduled',
      standard: s.standard,
    }));
  }

  return _syntheticSchedules(id);
};

// ─────────────────────────────────────────────────────────────────
// Audit Reports — from real cms_audit_reports
// ─────────────────────────────────────────────────────────────────
export const getAuditReports = (): AuditReportRow[] => {
  const id = getActiveOrgId();
  const org = getOrg();
  if (id == null || !org) return [];

  const allReports = safe<any[]>('cms_audit_reports', []);
  const orgName = org.organizationName;
  const real = allReports.filter((r: any) =>
    r.client === orgName ||
    Number(r.clientId) === id
  );

  if (real.length > 0) {
    return real.map((r: any, i: number) => ({
      id: r.id || `r-${i}`,
      orgId: id,
      certId: undefined,
      branchId: id * 10 + 1,
      date: r.auditDate || r.date || '',
      auditor: r.leadAuditor || r.auditor || '—',
      standard: r.standard || '—',
      findings: Number(r.findingsTotal) || Number(r.findings) || 0,
      major: Number(r.major) || 0,
      minor: Number(r.minor) || 0,
      ofi: Number(r.ofi) || 0,
      status: r.status || '—',
      summary: r.summary || r.findingSummary || '',
    }));
  }

  return _syntheticReports(id);
};

// ─────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────
export type AlertType = 'surveillance_due' | 'recertification_due' | 'cert_expiring';

export interface Notification {
  id: string;
  orgId: number;
  level: 'info' | 'warn' | 'critical';
  title: string;
  body: string;
  at: string;
  read?: boolean;
}

export interface RichNotification extends Notification {
  alertType: AlertType;
  standard: string;
  certNumber?: string;
  branchName: string;
  expiryDate: string;
  daysUntilExpiry: number;
  actionRequired: string;
}

export const getNotifications = (): RichNotification[] => {
  const id = getActiveOrgId();
  if (id == null) return [];
  const certs = getCertifications();
  const branches = getBranches();
  const branchName = (bid?: number) => branches.find(b => b.id === bid)?.name || 'Head Office';
  const now = Date.now();
  const items: RichNotification[] = [];

  certs.forEach((c) => {
    const expMs = new Date(c.expiryDate).getTime();
    const daysUntilExpiry = Math.ceil((expMs - now) / 86400000);

    // Surveillance due
    if (c.surveillance1Due) {
      const survDays = Math.ceil((new Date(c.surveillance1Due).getTime() - now) / 86400000);
      if (survDays >= 0 && survDays <= 30) {
        items.push({
          id: 'surv-' + c.id,
          orgId: id,
          level: survDays <= 7 ? 'critical' : 'warn',
          title: `Surveillance Audit due — ${c.standard}`,
          body: `${c.certNumber} (${branchName(c.branchId)}) — Surveillance must be scheduled by ${c.surveillance1Due}. Expiry: ${c.expiryDate}.`,
          at: new Date().toISOString(),
          alertType: 'surveillance_due',
          standard: c.standard,
          certNumber: c.certNumber,
          branchName: branchName(c.branchId),
          expiryDate: c.expiryDate,
          daysUntilExpiry,
          actionRequired: 'Schedule Surveillance Audit immediately',
        });
      }
    }

    // Recertification due
    if (c.recertificationDue) {
      const recertDays = Math.ceil((new Date(c.recertificationDue).getTime() - now) / 86400000);
      if (recertDays >= 0 && recertDays <= 30) {
        items.push({
          id: 'recert-' + c.id,
          orgId: id,
          level: recertDays <= 7 ? 'critical' : 'warn',
          title: `Recertification Audit due — ${c.standard}`,
          body: `${c.certNumber} (${branchName(c.branchId)}) — Recertification must be completed before ${c.recertificationDue}. Expiry: ${c.expiryDate}.`,
          at: new Date().toISOString(),
          alertType: 'recertification_due',
          standard: c.standard,
          certNumber: c.certNumber,
          branchName: branchName(c.branchId),
          expiryDate: c.expiryDate,
          daysUntilExpiry,
          actionRequired: 'Initiate Recertification Audit process',
        });
      }
    }

    // Certificate expiring / expired
    if (daysUntilExpiry <= 30) {
      items.push({
        id: 'exp-' + c.id,
        orgId: id,
        level: daysUntilExpiry < 0 ? 'critical' : daysUntilExpiry <= 7 ? 'critical' : 'warn',
        title: daysUntilExpiry < 0
          ? `Certificate EXPIRED — ${c.standard}`
          : `Certificate expiring in ${daysUntilExpiry}d — ${c.standard}`,
        body: `${c.certNumber} (${branchName(c.branchId)}) expires ${c.expiryDate}. ${daysUntilExpiry < 0 ? 'Certificate is no longer valid.' : 'Act before expiry to avoid lapse.'}`,
        at: new Date().toISOString(),
        alertType: 'cert_expiring',
        standard: c.standard,
        certNumber: c.certNumber,
        branchName: branchName(c.branchId),
        expiryDate: c.expiryDate,
        daysUntilExpiry,
        actionRequired: daysUntilExpiry < 0
          ? 'Certificate has expired — contact certification body immediately'
          : 'Ensure Recertification Audit is completed before expiry',
      });
    }
  });

  return items.sort((a, b) => {
    if (a.level === 'critical' && b.level !== 'critical') return -1;
    if (b.level === 'critical' && a.level !== 'critical') return 1;
    return a.daysUntilExpiry - b.daysUntilExpiry;
  });
};

// ─────────────────────────────────────────────────────────────────
// Real-time subscription
// ─────────────────────────────────────────────────────────────────
const CC_CHANGE_EVENT = 'cms-cc-data-changed';

/** Dispatch whenever CC-relevant localStorage keys change in this tab */
export const notifyCCDataChanged = (): void => {
  try { window.dispatchEvent(new CustomEvent(CC_CHANGE_EVENT)); } catch { /* ignore */ }
};

/** Subscribe to CC data changes (cross-tab storage + same-tab custom event) */
export const subscribeToCCChanges = (cb: () => void): () => void => {
  const WATCH_KEYS = new Set([
    'cms_certificates', 'cms_audit_certifications',
    'cms_audit_schedules', 'cms_audit_schedules_v3',
    'cms_audit_reports', 'cms_client_registrations',
    'cms_active_org_id',
  ]);

  const onStorage = (e: StorageEvent) => {
    if (!e.key || WATCH_KEYS.has(e.key)) cb();
  };
  const onCustom = () => cb();

  window.addEventListener('storage', onStorage);
  window.addEventListener(CC_CHANGE_EVENT, onCustom);
  // Also fire when AC-side custom events are dispatched in this tab
  window.addEventListener('cms-data-update', onCustom);
  window.addEventListener('client-registrations-updated', onCustom);
  window.addEventListener('cms-audit-certifications-updated', onCustom);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CC_CHANGE_EVENT, onCustom);
    window.removeEventListener('cms-data-update', onCustom);
    window.removeEventListener('client-registrations-updated', onCustom);
    window.removeEventListener('cms-audit-certifications-updated', onCustom);
  };
};

// ─────────────────────────────────────────────────────────────────
// Synthetic fallback data (used when real data not yet available)
// ─────────────────────────────────────────────────────────────────
const _syntheticCertifications = (orgId: number): Certification[] => {
  const KEY = `cms_org_certs_v1_${orgId}`;
  const cached = safe<Certification[]>(KEY, []);
  if (cached.length > 0) return cached;

  const standards = ['ISO 9001:2015','ISO 14001:2015','ISO 27001:2022','ISO 45001:2018','ISO 22000:2018','ISO 13485:2016','ISO 50001:2018'];
  const today = Date.now();
  const items: Certification[] = [];
  for (let i = 1; i <= 32; i++) {
    const std = standards[i % standards.length];
    const br = orgId * 10 + 1 + (i % 4);
    const issuedOff = -((i * 60) % 1100);
    const expiryOff = issuedOff + (1095 + (i % 6 - 3) * 30);
    const issue  = new Date(today + issuedOff * 86400000).toISOString().slice(0, 10);
    const expiry = new Date(today + expiryOff * 86400000).toISOString().slice(0, 10);
    items.push({
      id: i,
      orgId,
      branchId: br,
      standard: std,
      scope: 'Manufacturing & supporting processes',
      category: categoryOf(std),
      issueDate: issue,
      expiryDate: expiry,
      status: inferStatus(expiry),
      certNumber: 'CRT-' + (10000 + i),
      recertificationDue: addMonths(expiry, -3),
      surveillance1Due: addMonths(expiry, -24),
      surveillance2Due: addMonths(expiry, -12),
    });
  }
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  return items;
};

const _syntheticSchedules = (orgId: number): AuditScheduleRow[] => {
  const KEY = `cms_org_schedules_v1_${orgId}`;
  const cached = safe<AuditScheduleRow[]>(KEY, []);
  if (cached.length > 0) return cached;

  const types = ['Surveillance 1', 'Surveillance 2', 'Recertification', 'Initial Certification', 'Transfer'];
  const auditors = ['Anita Verma', 'Rajesh Kumar', 'Sandeep Joshi', 'Priya Reddy', 'Vikram Singh'];
  const statuses = ['Scheduled', 'Confirmed', 'Completed', 'Pending'];
  const rows: AuditScheduleRow[] = Array.from({ length: 14 }).map((_, i) => ({
    id: 'asch-' + (i + 1),
    orgId,
    branchId: orgId * 10 + 1 + (i % 4),
    type: types[i % types.length],
    date: new Date(Date.now() + (i - 5) * 30 * 86400000).toISOString().slice(0, 10),
    auditor: auditors[i % auditors.length],
    status: statuses[i % statuses.length],
  }));
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* ignore */ }
  return rows;
};

const _syntheticReports = (orgId: number): AuditReportRow[] => {
  const KEY = `cms_org_reports_v1_${orgId}`;
  const cached = safe<AuditReportRow[]>(KEY, []);
  if (cached.length > 0) return cached;

  const standards = ['ISO 9001:2015','ISO 14001:2015','ISO 27001:2022','ISO 45001:2018','ISO 22000:2018'];
  const auditors  = ['Anita Verma', 'Rajesh Kumar', 'Sandeep Joshi', 'Priya Reddy'];
  const statuses  = ['Issued', 'Under Review', 'Draft', 'Approved'];
  const rows: AuditReportRow[] = Array.from({ length: 12 }).map((_, i) => ({
    id: 'arep-' + (i + 1),
    orgId,
    certId: (i % 7) + 1,
    branchId: orgId * 10 + 1 + (i % 4),
    date: new Date(Date.now() - i * 25 * 86400000).toISOString().slice(0, 10),
    auditor: auditors[i % auditors.length],
    standard: standards[i % standards.length],
    findings: (i % 4) + ((i * 3) % 7),
    major: i % 3,
    minor: (i % 2) + 1,
    ofi: i % 2,
    status: statuses[i % statuses.length],
    summary: `Audit completed for ${standards[i % standards.length]}. ${((i % 4) + ((i * 3) % 7))} findings raised.`,
  }));
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* ignore */ }
  return rows;
};
