/**
 * Shared audit-report storage service.
 *
 * Single source of truth: localStorage key `cms_audit_reports_v1`.
 * The stored shape is a Record keyed by clientId (or a generated key for
 * records that are not tied to a workflow client, e.g. Auditee uploads and
 * seeded demo data). The base record contract comes from
 * src/pages/Auditor/AuditReport.tsx — every extra field here is OPTIONAL so
 * that page's existing read/write keeps working unchanged.
 *
 * Flow: Auditor drafts/submits -> Lead Auditor reviews/approves -> Coordinator
 * sees the consolidated list. Auditee uploads also land here with
 * `source: 'Auditee'`.
 *
 * Every mutation dispatches `cms-audit-reports-updated`; readers should
 * subscribe via `subscribeAuditReports` (covers the custom event AND the
 * cross-tab 'storage' event).
 */

export type AuditReportStatus = 'Draft' | 'Submitted' | 'Reviewed' | 'Approved' | 'Rejected';
export type AuditReportSource = 'Auditor' | 'Auditee' | 'LeadAuditor' | 'Coordinator';

export interface AuditReportRecord {
  // --- Base contract (Auditor/AuditReport.tsx) — do not change ---
  summary: string;
  scope: string;
  conclusion: string;
  recommendation: 'Recommend certification' | 'Recommend with conditions' | 'Not recommended';
  draftedAt: string;
  draftedBy: string;
  submittedAt?: string;
  // --- Additive, optional extensions ---
  status?: AuditReportStatus;
  source?: AuditReportSource;
  clientName?: string;
  standard?: string;
  fileName?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewComment?: string;
  approvedAt?: string;
  updatedAt?: string;
  // Auditee corrective-action details
  proposedCompletionDate?: string;
  correction?: string;
  rootCause?: string;
  correctiveAction?: string;
  completionDate?: string;
}

export type AuditReportsMap = Record<string, AuditReportRecord>;

export const AUDIT_REPORTS_KEY = 'cms_audit_reports_v1';
export const AUDIT_REPORTS_UPDATED_EVENT = 'cms-audit-reports-updated';

const readRaw = (): AuditReportsMap => {
  try {
    const raw = localStorage.getItem(AUDIT_REPORTS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as AuditReportsMap)
      : {};
  } catch {
    return {};
  }
};

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

/** 3 coherent demo reports used when the key is empty on first load. */
const buildSeedReports = (): AuditReportsMap => ({
  'seed-acme': {
    summary: 'Stage 2 audit of Acme Manufacturing quality management system. Shop floor, stores and QC lab visited; documentation review in progress.',
    scope: 'Design, manufacture and dispatch of precision machined components (ISO 9001:2015).',
    conclusion: '',
    recommendation: 'Recommend certification',
    draftedAt: daysAgo(1),
    draftedBy: 'A. Auditor',
    status: 'Draft',
    source: 'Auditor',
    clientName: 'Acme Manufacturing',
    standard: 'ISO 9001',
  },
  'seed-techflow': {
    summary: 'Surveillance audit of TechFlow Solutions ISMS. Access control, incident management and supplier security clauses sampled; two minor non-conformities raised.',
    scope: 'Development and support of SaaS workflow products (ISO/IEC 27001:2022).',
    conclusion: 'The ISMS remains effectively implemented; minor NCs require corrective action within 60 days.',
    recommendation: 'Recommend with conditions',
    draftedAt: daysAgo(4),
    draftedBy: 'J. Smith',
    submittedAt: daysAgo(2),
    status: 'Submitted',
    source: 'Auditor',
    clientName: 'TechFlow Solutions',
    standard: 'ISO 27001',
  },
  'seed-greenearth': {
    summary: 'Recertification audit of GreenEarth Logistics environmental management system covering fleet operations, warehousing and waste handling.',
    scope: 'Road freight, warehousing and distribution services (ISO 14001:2015).',
    conclusion: 'The EMS fully conforms to ISO 14001:2015; no non-conformities identified.',
    recommendation: 'Recommend certification',
    draftedAt: daysAgo(9),
    draftedBy: 'M. Ross',
    submittedAt: daysAgo(7),
    status: 'Approved',
    source: 'Auditor',
    clientName: 'GreenEarth Logistics',
    standard: 'ISO 14001',
    reviewedAt: daysAgo(5),
    reviewedBy: 'Lead Auditor',
    approvedAt: daysAgo(5),
  },
});

export const notifyAuditReportsUpdated = (): void => {
  window.dispatchEvent(new CustomEvent(AUDIT_REPORTS_UPDATED_EVENT));
};

/** Persist the whole map, then notify listeners. */
export const saveAuditReports = (map: AuditReportsMap): void => {
  localStorage.setItem(AUDIT_REPORTS_KEY, JSON.stringify(map));
  notifyAuditReportsUpdated();
};

/** Load the map; seeds 3 demo reports if the key is empty. */
export const loadAuditReports = (): AuditReportsMap => {
  const map = readRaw();
  if (Object.keys(map).length === 0) {
    const seeded = buildSeedReports();
    localStorage.setItem(AUDIT_REPORTS_KEY, JSON.stringify(seeded));
    return seeded;
  }
  return map;
};

export const getAuditReport = (key: string | number): AuditReportRecord | null =>
  loadAuditReports()[String(key)] || null;

/** Create or replace a record, then notify. */
export const upsertAuditReport = (key: string | number, record: AuditReportRecord): AuditReportRecord => {
  const map = loadAuditReports();
  const next: AuditReportRecord = { ...record, updatedAt: new Date().toISOString() };
  map[String(key)] = next;
  saveAuditReports(map);
  return next;
};

/** Shallow-merge updates into an existing record, then notify. */
export const updateAuditReport = (
  key: string | number,
  updates: Partial<AuditReportRecord>
): AuditReportRecord | null => {
  const map = loadAuditReports();
  const existing = map[String(key)];
  if (!existing) return null;
  const next: AuditReportRecord = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  map[String(key)] = next;
  saveAuditReports(map);
  return next;
};

/** Remove a record, then notify. */
export const removeAuditReport = (key: string | number): void => {
  const map = loadAuditReports();
  if (!(String(key) in map)) return;
  delete map[String(key)];
  saveAuditReports(map);
};

/** Records written before `status` existed derive it from `submittedAt`. */
export const deriveReportStatus = (r: AuditReportRecord): AuditReportStatus =>
  r.status ?? (r.submittedAt ? 'Submitted' : 'Draft');

/**
 * Subscribe to shared-report changes (same-tab custom event + cross-tab
 * 'storage'). Returns a cleanup function for useEffect.
 */
export const subscribeAuditReports = (onChange: () => void): (() => void) => {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === AUDIT_REPORTS_KEY) onChange();
  };
  window.addEventListener(AUDIT_REPORTS_UPDATED_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(AUDIT_REPORTS_UPDATED_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
};
