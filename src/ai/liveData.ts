/**
 * liveData.ts — unified LIVE reads over the cms_* localStorage keys.
 * Every AI feature builds on these so insights always reflect current data.
 * All readers are safe (never throw) and merge versioned key variants.
 */

export const safeJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
};

/* ---------- Core entity readers (merged across key versions) ---------- */
export const getClients = (): any[] => safeJSON<any[]>('cms_client_registrations', []);
export const getAuditors = (): any[] => {
  const a = safeJSON<any[]>('cms_auditors', []);
  return a.length ? a : safeJSON<any[]>('cms_auditors_data', []);
};
export const getSchedules = (): any[] => ([
  ...safeJSON<any[]>('cms_audit_schedules', []),
  ...safeJSON<any[]>('cms_audit_schedules_v3', []),
]);
export const getDispatches = (): any[] => safeJSON<any[]>('cms_application_dispatch_v7', []);
export const getEnquiries = (): any[] => safeJSON<any[]>('cms_client_enquiries_v1', []);
export const getCertificates = (): any[] => ([
  ...safeJSON<any[]>('cms_certificates', []),
  ...safeJSON<any[]>('cms_audit_certifications', []),
]);
export const getFindings = (): any[] => safeJSON<any[]>('cms_audit_findings_v1', []);
export const getCorrectiveActions = (): any[] => safeJSON<any[]>('cms_corrective_actions_v1', []);
export const getReports = (): any[] => {
  const v1 = safeJSON<any>('cms_audit_reports_v1', null);
  const legacy = safeJSON<any[]>('cms_audit_reports', []);
  // cms_audit_reports_v1 may be a map or an array depending on writer — normalise.
  if (Array.isArray(v1)) return [...v1, ...legacy];
  if (v1 && typeof v1 === 'object') return [...Object.values(v1).flat() as any[], ...legacy];
  return legacy;
};
export const getScheduleRequests = (): any[] => safeJSON<any[]>('cms_schedule_requests_v1', []);
export const getScopes = (): any[] => safeJSON<any[]>('cms_audit_scopes', []);

/* ---------- Change subscription (live refresh) ---------- */
const CHANGE_EVENTS = [
  'storage',
  'cms-schedules-updated',
  'cms-corrective-actions-updated',
  'cms-audit-reports-updated',
  'cms-audit-certifications-updated',
  'cms-audit-checklists-updated',
];

/** Subscribe to any CMS data change. Returns an unsubscribe fn. */
export const onCmsChange = (cb: () => void): (() => void) => {
  CHANGE_EVENTS.forEach((e) => window.addEventListener(e, cb));
  return () => CHANGE_EVENTS.forEach((e) => window.removeEventListener(e, cb));
};

/* ---------- Small shared utils ---------- */
export const daysBetween = (a: string | Date, b: string | Date): number => {
  const da = new Date(a).getTime(), db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.round((db - da) / 86400000);
};
export const daysFromNow = (d: string | Date): number => daysBetween(new Date(), d);

/* ---------- Optional Claude enhancement ---------- */
export { completeSafe as claudeComplete, isClaudeConfigured } from './claudeClient';
