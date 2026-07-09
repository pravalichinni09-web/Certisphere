/**
 * Auto-save drafts to localStorage with simple TTL (default 7 days).
 * Each draft is namespaced by a string key — typically the form name.
 */

interface DraftEnvelope<T> {
  savedAt: number;
  data: T;
}

const KEY_PREFIX = 'cms_draft:';
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const saveDraft = <T,>(key: string, data: T): void => {
  try {
    const env: DraftEnvelope<T> = { savedAt: Date.now(), data };
    localStorage.setItem(KEY_PREFIX + key, JSON.stringify(env));
  } catch {
    // ignore quota errors
  }
};

export const readDraft = <T,>(key: string, ttlMs = DEFAULT_TTL_MS): T | null => {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as DraftEnvelope<T>;
    if (Date.now() - env.savedAt > ttlMs) {
      localStorage.removeItem(KEY_PREFIX + key);
      return null;
    }
    return env.data;
  } catch {
    return null;
  }
};

export const clearDraft = (key: string): void => {
  try {
    localStorage.removeItem(KEY_PREFIX + key);
  } catch {
    // ignore
  }
};

export const getDraftSavedAt = (key: string): number | null => {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as DraftEnvelope<unknown>;
    return env.savedAt;
  } catch {
    return null;
  }
};
