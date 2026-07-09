import { Auditor, initialAuditors } from '../mockData';

const AUDITORS_STORAGE_KEY = 'cms_auditors_data';

/**
 * Initialize auditors data from localStorage or use initial mock data
 */
export const initializeAuditorsData = (): Auditor[] => {
  try {
    const storedData = localStorage.getItem(AUDITORS_STORAGE_KEY);
    if (storedData) {
      return JSON.parse(storedData);
    }
  } catch (error) {
    console.error('Error reading from localStorage:', error);
  }
  // Fallback to initial mock data
  return [...initialAuditors];
};

/**
 * Save auditors data to localStorage
 */
export const saveAuditorsData = (auditors: Auditor[]): void => {
  try {
    localStorage.setItem(AUDITORS_STORAGE_KEY, JSON.stringify(auditors));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

/**
 * Get all auditors from localStorage
 */
export const getAuditors = (): Auditor[] => {
  return initializeAuditorsData();
};

/**
 * Add a new auditor
 */
export const addAuditor = (auditor: Auditor): void => {
  const auditors = getAuditors();
  auditors.push(auditor);
  saveAuditorsData(auditors);
};

/**
 * Update an existing auditor
 */
export const updateAuditor = (id: number, updatedAuditor: Auditor): void => {
  const auditors = getAuditors();
  const index = auditors.findIndex(a => a.id === id);
  if (index !== -1) {
    auditors[index] = updatedAuditor;
    saveAuditorsData(auditors);
  }
};

/**
 * Delete an auditor
 */
export const deleteAuditor = (id: number): void => {
  const auditors = getAuditors();
  const filtered = auditors.filter(a => a.id !== id);
  saveAuditorsData(filtered);
};

/**
 * Get next available ID for new auditor
 */
export const getNextAuditorId = (): number => {
  const auditors = getAuditors();
  return auditors.length > 0 ? Math.max(...auditors.map(a => a.id)) + 1 : 1;
};

/**
 * Reset auditors to initial mock data
 */
export const resetAuditorsData = (): void => {
  saveAuditorsData([...initialAuditors]);
};
