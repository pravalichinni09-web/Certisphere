/* eslint-disable no-console -- sync failures are reported to the browser console on purpose */
/**
 * cloudSync — keeps CertiSphere's data in Supabase (live mode)
 * ----------------------------------------------------------------------
 * Every CertiSphere screen reads and writes its data through
 * localStorage keys (`cms_*`). In live mode this module makes those keys a
 * local cache of the Supabase table `app_data`:
 *
 *   • after sign-in      → all rows the user may see are loaded (pull)
 *   • on every save      → changed records are written back (push, debounced)
 *   • while signed in    → changes made by other users arrive live (realtime)
 *   • on sign-out        → the local copy is wiped from the browser
 *
 * Each record becomes one row tagged with the client it belongs to, so the
 * database's access rules decide who sees what (see supabase/migrations).
 *
 * Store shapes:
 *   array  [{ id, clientId, ... }]   → one row per record (row_key = id)
 *   map    { "<clientId>": ... }      → one row per client (row_key = client id)
 *   value  anything else              → one row (row_key "_")
 */
import { supabase } from './supabase';

type Kind = 'array' | 'map' | 'value';
interface Row { store: string; row_key: string; kind: Kind; pos: number; client_id: number | null; data: unknown }

/* ---------- which keys are shared ------------------------------------ */
// Device-only keys: preferences, sessions, demo-seed markers, secrets.
const LOCAL_ONLY = /(seed|_session|theme|^cms_ai_|welcome|claude_server|pending_demo|active_org_id|active_client_id|current_client_id|anthropic|supabase_synced|demo_dates_repaired|client_credentials|lead_auditor_name|repaired)/i;
export const isSyncedKey = (key: string): boolean => key.startsWith('cms_') && !LOCAL_ONLY.test(key);

// Stores a signed-out visitor may submit into (mirrors is_public_submission in SQL)
const PUBLIC_STORES = new Set(['cms_client_enquiries_v1', 'cms_auditor_requests_v1']);

/* ---------- record ⇄ row conversion ---------------------------------- */
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const clientIdOf = (store: string, rec: any): number | null => {
  if (!rec || typeof rec !== 'object') return null;
  if (store === 'cms_client_registrations') return num(rec.id);
  for (const f of ['clientId', 'client_id', 'orgId', 'org_id', 'organizationId']) {
    const n = num(rec[f]);
    if (n !== null) return n;
  }
  return null;
};

export const toRows = (store: string, value: unknown): Row[] => {
  if (Array.isArray(value)) {
    // Record key: its id, or its clientId for one-per-client lists (e.g. workflows)
    const keyOf = (r: any): string | null => {
      if (!r || typeof r !== 'object') return null;
      const k = r.id ?? r.clientId;
      return typeof k === 'string' || typeof k === 'number' ? String(k) : null;
    };
    const ids = value.map(keyOf);
    const unique = ids.every((x) => x !== null) && new Set(ids).size === ids.length;
    if (unique) {
      return value.map((r, i) => ({ store, row_key: ids[i] as string, kind: 'array' as Kind, pos: i, client_id: clientIdOf(store, r), data: r }));
    }
    return value.length ? [{ store, row_key: '_', kind: 'value', pos: 0, client_id: null, data: value }] : [];
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as object);
    if (keys.length && keys.every((k) => /^\d+$/.test(k))) {
      return keys.map((k) => ({ store, row_key: k, kind: 'map' as Kind, pos: 0, client_id: Number(k), data: (value as any)[k] }));
    }
  }
  if (value === null || value === undefined) return [];
  return [{ store, row_key: '_', kind: 'value', pos: 0, client_id: null, data: value }];
};

export const fromRows = (rows: Row[]): unknown => {
  if (!rows.length) return undefined;
  const kind = rows[0].kind;
  if (kind === 'array') return [...rows].sort((a, b) => a.pos - b.pos).map((r) => r.data);
  if (kind === 'map') return Object.fromEntries(rows.map((r) => [r.row_key, r.data]));
  return rows[0].data;
};

/* ---------- state ----------------------------------------------------- */
const server = new Map<string, Map<string, Row>>(); // last known server rows per store
const timers = new Map<string, number>();
let signedIn = false;
let applyingRemote = false;
let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
let installed = false;
const nativeSet = Storage.prototype.setItem;
const nativeRemove = Storage.prototype.removeItem;

const sig = (r: Row) => JSON.stringify([r.kind, r.pos, r.client_id, r.data]);
const readLocal = (key: string): unknown => {
  try { const raw = localStorage.getItem(key); return raw === null ? undefined : JSON.parse(raw); } catch { return undefined; }
};
const writeLocal = (key: string, value: unknown) => {
  applyingRemote = true;
  try {
    if (value === undefined) nativeRemove.call(localStorage, key);
    else nativeSet.call(localStorage, key, JSON.stringify(value));
  } finally { applyingRemote = false; }
};
const announce = (key: string) => {
  try { window.dispatchEvent(new StorageEvent('storage', { key })); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent('cms-workflow-handoff')); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent('audit-workflow-updated')); } catch { /* ignore */ }
};

/* ---------- push: local change → Supabase ---------------------------- */
const push = async (store: string) => {
  timers.delete(store);
  if (!supabase) return;
  const rows = toRows(store, readLocal(store));

  if (!signedIn) {
    // Visitors may only add new enquiry / auditor-application records.
    if (!PUBLIC_STORES.has(store)) return;
    const known = server.get(store) || new Map<string, Row>();
    const fresh = rows.filter((r) => r.kind === 'array' && !known.has(r.row_key)).map((r) => ({ ...r, client_id: null }));
    if (!fresh.length) return;
    const { error } = await supabase.from('app_data').insert(fresh);
    if (error) console.warn('[cloudSync] public submission failed', error.message);
    fresh.forEach((r) => known.set(r.row_key, r));
    server.set(store, known);
    return;
  }

  const known = server.get(store) || new Map<string, Row>();
  const next = new Map(rows.map((r) => [r.row_key, r]));
  const upserts = rows.filter((r) => { const k = known.get(r.row_key); return !k || sig(k) !== sig(r); });
  const deletes = [...known.keys()].filter((k) => !next.has(k));
  if (!upserts.length && !deletes.length) return;

  if (upserts.length) {
    for (let i = 0; i < upserts.length; i += 500) {
      const { error } = await supabase.from('app_data').upsert(upserts.slice(i, i + 500), { onConflict: 'store,row_key' });
      if (error) { console.warn(`[cloudSync] could not save ${store}:`, error.message); return; }
    }
  }
  if (deletes.length) {
    const { error } = await supabase.from('app_data').delete().eq('store', store).in('row_key', deletes);
    if (error) console.warn(`[cloudSync] could not delete from ${store}:`, error.message);
  }
  server.set(store, next);
};

const schedule = (key: string) => {
  const t = timers.get(key);
  if (t) window.clearTimeout(t);
  timers.set(key, window.setTimeout(() => { void push(key); }, 400));
};

/** Wait until every pending save has reached Supabase (used before sign-out). */
export const flushCloudSync = async (): Promise<void> => {
  const keys = [...timers.keys()];
  keys.forEach((k) => { const t = timers.get(k); if (t) window.clearTimeout(t); });
  await Promise.all(keys.map((k) => push(k)));
};

/* ---------- interception --------------------------------------------- */
/** Install once at start-up (live mode only). */
export const installCloudSync = (): void => {
  if (installed || !supabase) return;
  installed = true;
  // Anything already in this browser for the public stores is treated as known,
  // so a visitor's submission sends only the new record.
  PUBLIC_STORES.forEach((store) => {
    server.set(store, new Map(toRows(store, readLocal(store)).map((r) => [r.row_key, r])));
  });
  Storage.prototype.setItem = function (key: string, value: string) {
    nativeSet.call(this, key, value);
    if (this === localStorage && !applyingRemote && isSyncedKey(key)) schedule(key);
  };
  Storage.prototype.removeItem = function (key: string) {
    nativeRemove.call(this, key);
    if (this === localStorage && !applyingRemote && isSyncedKey(key)) schedule(key);
  };
};

/* ---------- pull + realtime ------------------------------------------- */
const clearSyncedKeys = () => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && isSyncedKey(k)) keys.push(k); }
  keys.forEach((k) => writeLocal(k, undefined));
};

const applyStore = (store: string) => {
  if (timers.has(store)) return; // a local save is pending; it will win
  const rows = [...(server.get(store)?.values() || [])];
  writeLocal(store, fromRows(rows));
  announce(store);
};

/**
 * Call right after sign-in. Replaces the browser's copy with the data this
 * user is allowed to see, then keeps it live. Resolves when data is loaded.
 */
export const startCloudSync = async (): Promise<{ ok: boolean; rows: number; error?: string }> => {
  if (!supabase) return { ok: false, rows: 0, error: 'Supabase is not configured' };
  signedIn = true;
  server.clear();
  clearSyncedKeys();

  let all: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('app_data')
      .select('store,row_key,kind,pos,client_id,data').order('store').order('pos').range(from, from + 999);
    if (error) return { ok: false, rows: all.length, error: error.message };
    all = all.concat(data as Row[]);
    if (!data || data.length < 1000) break;
  }
  all.forEach((r) => {
    if (!server.has(r.store)) server.set(r.store, new Map());
    server.get(r.store)!.set(r.row_key, r);
  });
  server.forEach((_rows, store) => writeLocal(store, fromRows([...server.get(store)!.values()])));

  channel?.unsubscribe();
  channel = supabase.channel('app_data_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_data' }, (payload: any) => {
      const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as Row;
      if (!row?.store) return;
      if (!server.has(row.store)) server.set(row.store, new Map());
      if (payload.eventType === 'DELETE') server.get(row.store)!.delete(row.row_key);
      else server.get(row.store)!.set(row.row_key, row);
      applyStore(row.store);
    })
    .subscribe();

  announce('cms_audit_workflow');
  return { ok: true, rows: all.length };
};

/** Call on sign-out: saves pending changes, stops live updates, wipes local copies. */
export const stopCloudSync = async (): Promise<void> => {
  await flushCloudSync();
  channel?.unsubscribe();
  channel = null;
  signedIn = false;
  server.clear();
  clearSyncedKeys();
};
