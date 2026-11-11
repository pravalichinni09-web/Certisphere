/**
 * A small in-memory stand-in for Supabase, used only by tests/live.e2e.mjs.
 * It speaks the same HTTP API as Supabase Auth + PostgREST for the calls
 * CertiSphere makes, and applies the SAME access rules as
 * supabase/migrations/001_certisphere_live.sql, so the live-mode app can be
 * tested end to end without a real project.
 *
 *   node tests/support/fake-supabase.mjs [port]      (default 54321)
 */
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.argv[2] || process.env.FAKE_SUPABASE_PORT || 54321);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export const makeJwt = (payload) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.c2ln`;
export const ANON_KEY = makeJwt({ role: 'anon', iss: 'fake-supabase', exp: 4102444800 });
export const SERVICE_KEY = makeJwt({ role: 'service_role', iss: 'fake-supabase', exp: 4102444800 });

const users = new Map();      // id -> { id, email, password }
const profiles = new Map();   // id -> profile row
const appData = new Map();    // `${store}|${row_key}` -> row
const demoLogins = new Map();
const STAFF = ['Management', 'Audit Coordinator', 'Lead Auditor', 'Auditor'];
const CLIENT = ['Auditee', 'Client Coordinator'];
const SHARED_REF = new Set(['cms_audit_types', 'cms_audit_scopes', 'cms_global_config_v1', 'cms_departments_v1', 'cms_audit_checklists']);
const PUBLIC_SUBMIT = new Set(['cms_client_enquiries_v1', 'cms_auditor_requests_v1']);

const decode = (token) => {
  try { return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString()); } catch { return null; }
};
const userJson = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, created_at: u.created_at });
const session = (u) => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return { access_token: makeJwt({ sub: u.id, role: 'authenticated', email: u.email, exp, aud: 'authenticated' }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: crypto.randomUUID(), user: userJson(u) };
};

/* ---------- who is calling ---------- */
const caller = (req) => {
  const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.headers.apikey;
  const c = decode(tok) || {};
  if (c.role === 'service_role') return { kind: 'service' };
  if (c.sub && users.has(c.sub)) {
    const p = profiles.get(c.sub);
    return { kind: 'user', id: c.sub, profile: p && p.active ? p : null };
  }
  return { kind: 'anon' };
};
const roleOf = (who) => (who.kind === 'user' ? who.profile?.role : null);
const isStaff = (who) => STAFF.includes(roleOf(who));
const isClient = (who) => CLIENT.includes(roleOf(who));

/* ---------- access rules (mirror of the SQL policies) ---------- */
const canRead = (who, row) => who.kind === 'service' || isStaff(who) ||
  (isClient(who) && (row.client_id === who.profile.client_id || (row.client_id === null && SHARED_REF.has(row.store))));
const canInsert = (who, row) => who.kind === 'service' || isStaff(who) ||
  (isClient(who) && row.client_id === who.profile.client_id) ||
  (who.kind === 'anon' && PUBLIC_SUBMIT.has(row.store) && row.kind === 'array' && row.client_id === null);
const canUpdate = (who, oldRow, newRow) => who.kind === 'service' || isStaff(who) ||
  (isClient(who) && oldRow.client_id === who.profile.client_id && newRow.client_id === who.profile.client_id);
const canDelete = (who) => who.kind === 'service' || isStaff(who);
const canReadProfile = (who, p) => who.kind === 'service' || (who.kind === 'user' && (p.id === who.id || roleOf(who) === 'Management'));

/* ---------- PostgREST filter helpers ---------- */
const parseFilters = (params) => {
  const f = [];
  for (const [k, v] of params) {
    if (['select', 'order', 'offset', 'limit', 'on_conflict', 'columns'].includes(k)) continue;
    const m = /^(eq|in)\.(.*)$/.exec(v);
    if (!m) continue;
    if (m[1] === 'eq') f.push((r) => String(r[k]) === m[2]);
    else {
      const list = m[2].replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''));
      f.push((r) => list.includes(String(r[k])));
    }
  }
  return (r) => f.every((fn) => fn(r));
};
const pick = (row, select) => {
  if (!select || select === '*') return row;
  return Object.fromEntries(select.split(',').map((c) => [c, row[c]]));
};
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const rlsError = (res) => send(res, 403, { code: '42501', message: 'new row violates row-level security policy for table "app_data"', details: null, hint: null });

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS' });
    return res.end();
  }
  let raw = '';
  for await (const ch of req) raw += ch;
  const body = raw ? JSON.parse(raw) : undefined;
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  const who = caller(req);

  /* ---- test control ---- */
  if (p === '/__reset') { users.clear(); profiles.clear(); appData.clear(); demoLogins.clear(); return send(res, 200, { ok: true }); }
  if (p === '/__seed-admin') {
    const u = { id: crypto.randomUUID(), email: body.email, password: body.password, created_at: new Date().toISOString() };
    users.set(u.id, u);
    profiles.set(u.id, { id: u.id, email: u.email, full_name: body.fullName || 'Admin', role: 'Management', client_id: null, active: true, created_at: u.created_at, updated_at: u.created_at });
    if (body.demo) demoLogins.set(u.id, { user_id: u.id, email: u.email, role: 'Management', password: body.password });
    return send(res, 200, { id: u.id });
  }
  if (p === '/__dump') return send(res, 200, { profiles: [...profiles.values()], app_data: [...appData.values()] });

  /* ---- auth ---- */
  if (p === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
    const u = [...users.values()].find((x) => x.email === String(body.email).toLowerCase() && x.password === body.password);
    if (!u) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' });
    return send(res, 200, session(u));
  }
  if (p === '/auth/v1/user' && req.method === 'GET') {
    const c = decode(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    const u = c && users.get(c.sub);
    return u ? send(res, 200, userJson(u)) : send(res, 401, { code: 401, msg: 'invalid JWT' });
  }
  if (p === '/auth/v1/user' && req.method === 'PUT') {
    const c = decode(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    const u = c && users.get(c.sub);
    if (!u) return send(res, 401, { msg: 'invalid JWT' });
    if (body.password) u.password = body.password;
    return send(res, 200, userJson(u));
  }
  if (p === '/auth/v1/logout') return send(res, 204);
  if (p === '/auth/v1/recover') return send(res, 200, {});
  if (p === '/auth/v1/admin/users' && req.method === 'POST') {
    if (who.kind !== 'service') return send(res, 403, { msg: 'not admin' });
    const email = String(body.email).toLowerCase();
    if ([...users.values()].some((x) => x.email === email)) return send(res, 422, { code: 'email_exists', msg: 'A user with this email address has already been registered' });
    const u = { id: crypto.randomUUID(), email, password: body.password, created_at: new Date().toISOString() };
    users.set(u.id, u);
    return send(res, 200, userJson(u));
  }
  const adminUser = /^\/auth\/v1\/admin\/users\/([^/]+)$/.exec(p);
  if (adminUser) {
    if (who.kind !== 'service') return send(res, 403, { msg: 'not admin' });
    const u = users.get(adminUser[1]);
    if (!u) return send(res, 404, { msg: 'User not found' });
    if (req.method === 'DELETE') { users.delete(u.id); profiles.delete(u.id); return send(res, 200, {}); }
    if (body?.password) u.password = body.password;
    return send(res, 200, userJson(u));
  }

  /* ---- REST ---- */
  const rest = /^\/rest\/v1\/(app_data|profiles|demo_logins)$/.exec(p);
  if (rest) {
    const table = rest[1];
    const params = url.searchParams;
    const match = parseFilters(params);
    const prefer = String(req.headers.prefer || '');

    if (table === 'demo_logins') {
      if (req.method === 'GET') return send(res, 200, [...demoLogins.values()].filter(match).map((r) => pick(r, params.get('select'))));
      if (who.kind !== 'service') return send(res, 403, { code: '42501', message: 'permission denied for table demo_logins' });
      if (req.method === 'POST') { (Array.isArray(body) ? body : [body]).forEach((r) => demoLogins.set(r.user_id, { ...demoLogins.get(r.user_id), ...r })); return send(res, 201); }
      if (req.method === 'PATCH') { const rows = [...demoLogins.values()].filter(match); rows.forEach((r) => Object.assign(r, body)); return send(res, 200, rows); }
      if (req.method === 'DELETE') { [...demoLogins.entries()].filter(([, r]) => match(r)).forEach(([k]) => demoLogins.delete(k)); return send(res, 204); }
    }
    if (table === 'profiles') {
      if (req.method === 'GET') {
        let rows = [...profiles.values()].filter((r) => canReadProfile(who, r) && match(r));
        if ((params.get('order') || '').startsWith('created_at')) rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
        return send(res, 200, rows.map((r) => pick(r, params.get('select'))));
      }
      if (who.kind !== 'service') return send(res, 403, { code: '42501', message: 'permission denied for table profiles' });
      if (req.method === 'POST') {
        const now = new Date().toISOString();
        (Array.isArray(body) ? body : [body]).forEach((r) => profiles.set(r.id, { full_name: '', client_id: null, active: true, created_at: now, updated_at: now, ...r }));
        return send(res, 201, prefer.includes('return=representation') ? [] : undefined);
      }
      if (req.method === 'PATCH') {
        const rows = [...profiles.values()].filter(match);
        rows.forEach((r) => Object.assign(r, body));
        return send(res, 200, rows);
      }
    }

    // app_data
    if (req.method === 'GET' || req.method === 'HEAD') {
      let rows = [...appData.values()].filter((r) => canRead(who, r) && match(r));
      rows.sort((a, b) => (a.store === b.store ? a.pos - b.pos : a.store.localeCompare(b.store)));
      const total = rows.length;
      const off = Number(params.get('offset') || 0); const lim = params.get('limit') ? Number(params.get('limit')) : rows.length;
      rows = rows.slice(off, off + lim);
      const headers = { 'content-range': `${total ? off : '*'}-${total ? off + rows.length - 1 : ''}/${total}` };
      if (req.method === 'HEAD') { res.writeHead(200, { ...headers, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }); return res.end(); }
      return send(res, 200, rows.map((r) => pick(r, params.get('select'))), headers);
    }
    if (req.method === 'POST') {
      const list = Array.isArray(body) ? body : [body];
      const upsert = prefer.includes('merge-duplicates');
      for (const r of list) {
        const row = { pos: 0, client_id: null, ...r, updated_at: new Date().toISOString(), updated_by: who.id || null };
        const key = `${row.store}|${row.row_key}`;
        const old = appData.get(key);
        if (old) {
          if (!upsert) return send(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint' });
          if (!canUpdate(who, old, row)) return rlsError(res);
        } else if (!canInsert(who, row)) return rlsError(res);
      }
      list.forEach((r) => appData.set(`${r.store}|${r.row_key}`, { pos: 0, client_id: null, ...r, updated_at: new Date().toISOString(), updated_by: who.id || null }));
      return send(res, 201, prefer.includes('return=representation') ? list : undefined);
    }
    if (req.method === 'DELETE') {
      if (!canDelete(who)) return send(res, 204); // RLS: silently deletes nothing
      [...appData.entries()].filter(([, r]) => match(r)).forEach(([k]) => appData.delete(k));
      return send(res, 204);
    }
  }
  return send(res, 404, { message: `fake-supabase: no route for ${req.method} ${p}` });
});
// Realtime is not emulated: refuse websocket upgrades quietly.
server.on('upgrade', (_req, socket) => socket.destroy());

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, '127.0.0.1', () => console.log(`fake-supabase on http://127.0.0.1:${PORT}`));
}
export { server, PORT };
