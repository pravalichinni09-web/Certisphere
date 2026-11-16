/**
 * fileStore — keep a document (application form, agreement…) and get a link.
 *  Live site: uploaded to private server storage (/api/files); we keep only
 *             the path + a 30-day download link (no big data in the database).
 *  Demo mode: kept in the browser as a data URL (as before).
 */
import { isLiveMode, apiFetch } from './liveAuth';

export interface StoredFile {
  name: string;
  size: number;
  uploadedAt: string;
  /** demo mode / fallback: the file itself */
  dataUrl?: string;
  /** live mode: private storage path + current download link */
  path?: string;
  url?: string;
  urlExpires?: string;
}

export const MAX_FILE_BYTES = 3 * 1024 * 1024;

export const readAsDataUrl = (f: File): Promise<string> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = reject;
  r.readAsDataURL(f);
});

export const storeFile = async (file: File): Promise<StoredFile> => {
  if (file.size > MAX_FILE_BYTES) throw new Error('File is too large. Keep it under 3 MB.');
  const dataUrl = await readAsDataUrl(file);
  const base: StoredFile = { name: file.name, size: file.size, uploadedAt: new Date().toISOString() };
  if (isLiveMode()) {
    const r = await apiFetch('/api/files', { action: 'upload', name: file.name, dataUrl });
    if (r.ok && r.data?.path) return { ...base, path: r.data.path, url: r.data.url, urlExpires: new Date(Date.now() + 29 * 86400000).toISOString() };
    throw new Error(r.data?.error || 'Could not upload the file to the server.');
  }
  return { ...base, dataUrl };
};

/** A download link that works now (refreshes an expired live link). */
export const fileLink = async (f: StoredFile): Promise<string | null> => {
  if (f.dataUrl) return f.dataUrl;
  if (f.url && f.urlExpires && new Date(f.urlExpires).getTime() > Date.now() + 86400000) return f.url;
  if (f.path) {
    const r = await apiFetch('/api/files', { action: 'sign', path: f.path });
    if (r.ok && r.data?.url) return r.data.url;
  }
  return f.url || null;
};

export const openStoredFile = async (f: StoredFile): Promise<void> => {
  const link = await fileLink(f);
  if (!link) { alert('This file is not available.'); return; }
  if (link.startsWith('data:')) {
    const a = document.createElement('a');
    a.href = link; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
  } else window.open(link, '_blank', 'noopener');
};

/** True when the link can be put in an email (a web address, not browser data). */
export const isShareableLink = (link?: string | null) => !!link && /^https?:\/\//.test(link);

/** The coordinator's saved standard application form (shared with all staff). */
export const STANDARD_FORM_KEY = 'cms_standard_application_form';
export const readStandardForm = (): StoredFile | null => {
  try { const v = JSON.parse(localStorage.getItem(STANDARD_FORM_KEY) || 'null'); return v && v.name ? v : null; } catch { return null; }
};
