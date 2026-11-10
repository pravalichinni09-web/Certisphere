/**
 * Server-only Supabase helpers for the /api functions.
 * Uses the SERVICE ROLE key (Vercel env SUPABASE_SERVICE_ROLE_KEY), which
 * bypasses access rules — it must never be sent to the browser.
 */
import { createClient } from '@supabase/supabase-js';

export const STAFF_ROLES = ['Management', 'Audit Coordinator', 'Lead Auditor', 'Auditor'];
export const CLIENT_ROLES = ['Auditee', 'Client Coordinator'];
export const ALL_ROLES = [...STAFF_ROLES, ...CLIENT_ROLES];

export const adminClient = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
};

export const readBody = (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return req.body ? JSON.parse(req.body) : {}; } catch { return {}; }
};

/** Verifies the caller's access token and returns their active profile, or null. */
export const callerProfile = async (admin, req) => {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  const token = String(auth).replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: profile } = await admin.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  return profile && profile.active ? profile : null;
};

/** A readable temporary password: 12 chars incl. upper, lower, digit, symbol. */
export const tempPassword = () => {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%*?'];
  const all = sets.join('');
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  const chars = sets.map(pick);
  while (chars.length < 12) chars.push(pick(all));
  return chars.sort(() => Math.random() - 0.5).join('');
};

export const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** Next free numeric client id (max of existing client registrations + 1). */
export const nextClientId = async (admin) => {
  const { data } = await admin.from('app_data').select('row_key').eq('store', 'cms_client_registrations');
  const max = (data || []).reduce((m, r) => Math.max(m, Number(r.row_key) || 0), 0);
  return max + 1;
};

export const send = (res, status, body) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
};
