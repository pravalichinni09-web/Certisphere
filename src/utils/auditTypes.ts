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
export const getAuditTypeNames = (): string[] => {
  const types = getSystemAuditTypes();
  return types.map(t => t.name);
};

/**
 * Get an audit type by name
 */
export const getAuditTypeByName = (name: string): AuditType | undefined => {
  const types = getSystemAuditTypes();
  return types.find(t => t.name === name);
};
