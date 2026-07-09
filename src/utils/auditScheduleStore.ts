/**
 * Shared data layer for audit schedules stored in localStorage.
 *
 * Two keys co-exist (do NOT rename them):
 *   - `cms_audit_schedules`     — legacy / demo-seeded records
 *   - `cms_audit_schedules_v3`  — records created by the Coordinator
 *     (src/pages/AuditorCoordinator/AuditSchedules.tsx)
 *
 * Readers merge both keys; writers always write back to the key the
 * record originally came from, then dispatch `cms-schedules-updated`
 * so every open page can reload.
 *
 * Status contract (matches the Coordinator pages — do not invent new values):
 *   - Core `status` (v3): 'Scheduled' | 'Pending' | 'Submitted' | 'Approved' | 'Completed'
 *     ('Submitted' = sent to the auditee, 'Approved' = auditee approved — see
 *     handleSubmitToClient / handleApprove in AuditSchedules.tsx).
 *   - Legacy seeds also use 'In Progress' / 'scheduled' / 'in-progress' / 'completed'.
 *   - Additive optional fields (stored on the record, ignored by legacy readers):
 *       auditeeApproval?:     'Pending' | 'Approved' | 'Alternative Proposed'
 *       auditorConfirmation?: 'Pending' | 'Confirmed' | 'Declined'
 */

export type AuditeeApproval = 'Pending' | 'Approved' | 'Alternative Proposed';
export type AuditorConfirmation = 'Pending' | 'Confirmed' | 'Declined';

export const SCHEDULE_KEYS = ['cms_audit_schedules', 'cms_audit_schedules_v3'] as const;
export type ScheduleSourceKey = (typeof SCHEDULE_KEYS)[number];

export const SCHEDULES_UPDATED_EVENT = 'cms-schedules-updated';

export interface StoredSchedule {
  id: string | number;
  // Coordinator (v3) fields
  dispatchId?: number | string;
  clientId?: string | number;
  organization?: string;
  auditee?: string;
  auditeeEmail?: string;
  auditeePhone?: string;
  certificationStandard?: string;
  duration?: string;
  date?: string;
  status?: string;
  // Legacy / seeded fields
  organizationName?: string;
  client?: string;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  standard?: string;
  auditName?: string;
  auditTitle?: string;
  notes?: string;
  createdAt?: string;
  // Assignment fields (both shapes)
  leadAuditor?: string;
  leadAuditorEmail?: string;
  auditor?: string;
  auditorEmail?: string;
  assignedAuditors?: string[];
  auditType?: string;
  auditScope?: string;
  department?: string;
  location?: string;
  // Additive workflow fields (optional — see header comment)
  auditeeApproval?: AuditeeApproval;
  auditeeApprovalNote?: string;
  auditeeApprovalAt?: string;
  auditorConfirmation?: AuditorConfirmation;
  auditorConfirmationNote?: string;
  auditorConfirmationAt?: string;
  [extra: string]: unknown;
}

export interface MergedScheduleEntry {
  /** The raw record as stored. */
  record: StoredSchedule;
  /** Which localStorage key the record lives in (write-back target). */
  sourceKey: ScheduleSourceKey;
}

const safeArray = <T,>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** Read both schedule keys, tagging each record with its source key. */
export const readMergedSchedules = (): MergedScheduleEntry[] => {
  const out: MergedScheduleEntry[] = [];
  SCHEDULE_KEYS.forEach((key) => {
    safeArray<StoredSchedule>(key).forEach((record) => {
      if (record && typeof record === 'object' && record.id !== undefined) {
        out.push({ record, sourceKey: key });
      }
    });
  });
  return out;
};

/**
 * Patch a schedule in-place in whichever key it came from, then notify
 * every open page via the shared update event.
 */
export const updateSchedule = (
  entry: MergedScheduleEntry,
  patch: Partial<StoredSchedule>
): boolean => {
  try {
    const list = safeArray<StoredSchedule>(entry.sourceKey);
    const idx = list.findIndex((r) => String(r?.id) === String(entry.record.id));
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...patch };
    localStorage.setItem(entry.sourceKey, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(SCHEDULES_UPDATED_EVENT));
    return true;
  } catch {
    return false;
  }
};

// --- Display helpers (records are heterogeneous across the two keys) --------

export const scheduleOrg = (r: StoredSchedule): string =>
  r.organization || r.organizationName || r.client || 'Unknown Organization';

export const scheduleDate = (r: StoredSchedule): string =>
  r.date || r.scheduledDate || '';

export const scheduleStatus = (r: StoredSchedule): string => r.status || 'Scheduled';

export const scheduleStandard = (r: StoredSchedule): string =>
  r.certificationStandard || r.standard || '';

export const scheduleTitle = (r: StoredSchedule): string =>
  r.auditName || r.auditTitle || r.auditType || 'Audit';

/** Stable key for React lists / selection across both sources. */
export const entryKey = (e: MergedScheduleEntry): string =>
  `${e.sourceKey}:${String(e.record.id)}`;

/** Is a given auditor (by name) assigned to this schedule? */
export const isAssignedTo = (r: StoredSchedule, auditorName: string): boolean => {
  const target = auditorName.trim().toLowerCase();
  if (!target) return false;
  const names = [r.auditor, r.leadAuditor, ...(r.assignedAuditors || [])];
  return names.some((n) => (n || '').trim().toLowerCase() === target);
};

// --- Auditors registry (`cms_auditors`, with `cms_auditors_data` fallback) --

export interface RegisteredAuditor {
  id?: number | string;
  name?: string;
  email?: string;
  role?: string;
  specialization?: string;
  department?: string;
  status?: string;
  [extra: string]: unknown;
}

export const readAuditorsRegistry = (): RegisteredAuditor[] => {
  const primary = safeArray<RegisteredAuditor>('cms_auditors');
  const alt = safeArray<RegisteredAuditor>('cms_auditors_data');
  const seen = new Set<string>();
  const merged: RegisteredAuditor[] = [];
  [...primary, ...alt].forEach((a) => {
    const key = (a?.name || '').trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(a);
  });
  return merged;
};

export const findAuditorByName = (name?: string): RegisteredAuditor | undefined => {
  if (!name) return undefined;
  const target = name.trim().toLowerCase();
  return readAuditorsRegistry().find((a) => (a.name || '').trim().toLowerCase() === target);
};

/**
 * The demo auditor identity used by the Auditor role pages (there is no
 * per-auditor login). Prefers the first active plain 'Auditor' registered in
 * `cms_auditors`; falls back to the seeded default.
 */
export const resolveDemoAuditorName = (): string => {
  const registry = readAuditorsRegistry();
  const plain = registry.find(
    (a) => (a.role || '') === 'Auditor' && (a.status || 'Active') === 'Active' && a.name
  );
  if (plain?.name) return plain.name;
  const anyActive = registry.find((a) => (a.status || 'Active') === 'Active' && a.name);
  return anyActive?.name || 'Vikram Singh';
};
