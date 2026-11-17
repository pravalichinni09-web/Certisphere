/**
 * Short, signed download links for emails:
 *   https://<site>/api/dl?f=<file id>&e=<expiry>&s=<signature>
 * The link opens the private file only until it expires and cannot be
 * changed to point at another file (HMAC signature with a server secret).
 */
import crypto from 'node:crypto';

const secret = () => process.env.FILE_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64url');
const unb64 = (s) => Buffer.from(String(s), 'base64url').toString('utf8');
const sig = (id, exp) => crypto.createHmac('sha256', secret()).update(`${id}.${exp}`).digest('base64url').slice(0, 22);

export const makeShareUrl = (origin, path, days = 30) => {
  const id = b64(String(path).replace(/^documents\//, ''));
  const exp = Math.floor(Date.now() / 1000) + Math.min(90, Math.max(1, Number(days) || 30)) * 86400;
  return `${origin}/api/dl?f=${id}&e=${exp}&s=${sig(id, exp)}`;
};

/** Returns the storage path, or an error message. */
export const readShare = ({ f, e, s }) => {
  if (!secret()) return { error: 'Downloads are not configured.' };
  if (!f || !e || !s) return { error: 'This download link is incomplete.' };
  const good = sig(String(f), String(e));
  if (good.length !== String(s).length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(String(s)))) return { error: 'This download link is not valid.' };
  if (Number(e) * 1000 < Date.now()) return { error: 'This download link has expired. Please ask QMICS for a new one.' };
  const rest = unb64(f);
  if (!rest || rest.includes('..')) return { error: 'This download link is not valid.' };
  return { path: `documents/${rest}` };
};

export const originOf = (req) => {
  const o = req.headers.origin;
  if (o && /^https?:\/\/[^/]+$/.test(o)) return o;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || (/^(localhost|127\.0\.0\.1)(:|$)/.test(String(host)) ? 'http' : 'https');
  return `${proto}://${host}`;
};
