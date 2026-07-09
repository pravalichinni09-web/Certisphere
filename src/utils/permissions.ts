/**
 * Role-based permission scopes attached to auditors.
 * Stored alongside the auditor record in localStorage by id.
 */

export type PermissionKey =
  | 'audit.read'
  | 'audit.execute'
  | 'audit.signOff'
  | 'reports.write'
  | 'reports.publish'
  | 'checklist.edit'
  | 'client.read'
  | 'client.edit'
  | 'cert.issue'
  | 'cert.revoke';

export interface PermissionScope {
  key: PermissionKey;
  label: string;
  description: string;
  group: 'Audit' | 'Reports' | 'Clients' | 'Certificates';
}

export const ALL_PERMISSIONS: PermissionScope[] = [
  { key: 'audit.read', label: 'View audits', description: 'Read assigned audit records and findings', group: 'Audit' },
  { key: 'audit.execute', label: 'Conduct audits', description: 'Record findings and submit reports', group: 'Audit' },
  { key: 'audit.signOff', label: 'Sign off audits', description: 'Approve final audit reports', group: 'Audit' },
  { key: 'reports.write', label: 'Draft reports', description: 'Create and edit audit reports', group: 'Reports' },
  { key: 'reports.publish', label: 'Publish reports', description: 'Publish finalized reports to clients', group: 'Reports' },
  { key: 'checklist.edit', label: 'Edit checklists', description: 'Modify standard checklists', group: 'Audit' },
  { key: 'client.read', label: 'View clients', description: 'Read client records', group: 'Clients' },
  { key: 'client.edit', label: 'Edit clients', description: 'Edit client records', group: 'Clients' },
  { key: 'cert.issue', label: 'Issue certificates', description: 'Issue or reissue certificates', group: 'Certificates' },
  { key: 'cert.revoke', label: 'Revoke certificates', description: 'Suspend or revoke certificates', group: 'Certificates' },
];

const ROLE_DEFAULTS: Record<string, PermissionKey[]> = {
  'Lead Auditor': ['audit.read', 'audit.execute', 'audit.signOff', 'reports.write', 'reports.publish', 'checklist.edit', 'client.read'],
  'Auditor': ['audit.read', 'audit.execute', 'reports.write', 'client.read'],
  'Auditor Coordinator': ['audit.read', 'reports.write', 'checklist.edit', 'client.read', 'client.edit', 'cert.issue'],
  'Management': ['audit.read', 'reports.publish', 'client.read', 'cert.issue', 'cert.revoke'],
};

const STORAGE_KEY = 'cms_user_permissions';

const readAll = (): Record<number, PermissionKey[]> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeAll = (data: Record<number, PermissionKey[]>): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
};

export const defaultPermissionsForRole = (role: string): PermissionKey[] => {
  return ROLE_DEFAULTS[role] || ROLE_DEFAULTS['Auditor'];
};

export const getUserPermissions = (userId: number, role?: string): PermissionKey[] => {
  const all = readAll();
  if (all[userId]) return all[userId];
  return role ? defaultPermissionsForRole(role) : [];
};

export const setUserPermissions = (userId: number, perms: PermissionKey[]): void => {
  const all = readAll();
  all[userId] = perms;
  writeAll(all);
};
