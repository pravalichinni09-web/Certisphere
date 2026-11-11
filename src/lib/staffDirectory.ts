/**
 * Live mode: fetch the real staff list (names + roles) once per sign-in and
 * keep it in this browser only (key is not cms_*, so it is never synced).
 * The workflow pickers and AI team suggestions read it via workflowAI.
 */
import { apiFetch } from './liveAuth';
import { STAFF_CACHE_KEY } from '../ai/workflowAI';

const STAFF = ['Management', 'Audit Coordinator', 'Lead Auditor', 'Auditor'];

export const loadStaffDirectory = async (role: string): Promise<void> => {
  try {
    if (!STAFF.includes(role)) { localStorage.removeItem(STAFF_CACHE_KEY); return; }
    const r = await apiFetch('/api/staff', undefined, 'GET');
    if (r.ok && Array.isArray(r.data?.staff)) {
      localStorage.setItem(STAFF_CACHE_KEY, JSON.stringify(r.data.staff));
      window.dispatchEvent(new CustomEvent('cms-workflow-handoff'));
    }
  } catch { /* directory is optional */ }
};

export const clearStaffDirectory = (): void => { try { localStorage.removeItem(STAFF_CACHE_KEY); } catch { /* ignore */ } };
