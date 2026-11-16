/**
 * Audit Types — loads system audit type classification data from localStorage
 */

export interface AuditType {
  id: number;
  name: string;
  description: string;
  defaultDurationDays: number;
}

/**
 * Load audit types from system data (cms_audit_types)
 * Falls back to empty array if not available
 */
export const getSystemAuditTypes = (): AuditType[] => {
  try {
    const raw = localStorage.getItem('cms_audit_types');
    if (!raw) return [];
    const types = JSON.parse(raw);
    return Array.isArray(types) ? types : [];
  } catch {
    return [];
  }
};

/**
 * Get audit type names for dropdown/select elements
 */
/** Standard certification-body audit types, used until the Coordinator defines
 *  their own in Audit Types (and on the sign-in page, where visitors can't read them). */
export const DEFAULT_AUDIT_TYPE_NAMES = [
  'Initial Certification',
  'Recertification',
  'Transfer Audit',
  'Surveillance Audit 1',
  'Surveillance Audit 2',
  'Special Audit',
];

export const getAuditTypeNames = (): string[] => {
  const names = getSystemAuditTypes().map(t => t.name).filter(Boolean);
  return names.length ? names : DEFAULT_AUDIT_TYPE_NAMES;
};

/**
 * Get an audit type by name
 */
export const getAuditTypeByName = (name: string): AuditType | undefined => {
  const types = getSystemAuditTypes();
  return types.find(t => t.name === name);
};
