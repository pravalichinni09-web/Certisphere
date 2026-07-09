/**
 * Generic versioned-record store backed by localStorage.
 * Each "track" is a string key — call addVersion to push a new version.
 */

export interface Version<T> {
  version: number;       // 1-based monotonic
  savedAt: number;       // epoch ms
  author?: string;
  note?: string;
  data: T;
}

const KEY_PREFIX = 'cms_versions:';

const readAll = <T,>(track: string): Version<T>[] => {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + track);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Version<T>[]) : [];
  } catch {
    return [];
  }
};

const writeAll = <T,>(track: string, list: Version<T>[]): void => {
  try {
    localStorage.setItem(KEY_PREFIX + track, JSON.stringify(list));
  } catch {
    // ignore
  }
};

export const listVersions = <T,>(track: string): Version<T>[] => readAll<T>(track);

export const addVersion = <T,>(
  track: string,
  data: T,
  meta: { author?: string; note?: string } = {}
): Version<T> => {
  const list = readAll<T>(track);
  const v: Version<T> = {
    version: list.length + 1,
    savedAt: Date.now(),
    data,
    ...meta,
  };
  list.push(v);
  writeAll(track, list);
  return v;
};

export const latestVersion = <T,>(track: string): Version<T> | null => {
  const list = readAll<T>(track);
  return list.length ? list[list.length - 1] : null;
};

export const getVersion = <T,>(track: string, version: number): Version<T> | null => {
  const list = readAll<T>(track);
  return list.find((v) => v.version === version) || null;
};

export const clearVersions = (track: string): void => {
  try {
    localStorage.removeItem(KEY_PREFIX + track);
  } catch {
    // ignore
  }
};
