/**
 * /api/files — private document storage for staff (live mode)
 * ----------------------------------------------------------------------
 * Application forms, agreements and other documents are kept in a private
 * Supabase Storage bucket. Files are never public: anyone who needs one gets
 * a time-limited download link.
 *
 *   POST { action: 'upload', name, dataUrl }  → { path, url }   (staff only)
 *   POST { action: 'sign', path, days? }      → { url }         (staff only)
 *   POST { action: 'share', path, days? }     → { url }  short link for emails (/api/dl…)
 *
 * Download links last 30 days by default (max 90), long enough for a
 * client to open the application form sent to them by email.
 */
import { adminClient, callerProfile, readBody, send, STAFF_ROLES } from './_lib/supabaseAdmin.js';
import { makeShareUrl, originOf } from './_lib/shareLink.js';

const BUCKET = 'certisphere-files';
const MAX_BYTES = 3 * 1024 * 1024;

const ensureBucket = async (admin) => {
  const { data } = await admin.storage.getBucket(BUCKET);
  if (data) return;
  await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_BYTES });
};
const signed = async (admin, path, days = 30) => {
  const secs = Math.min(90, Math.max(1, Number(days) || 30)) * 86400;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, secs, { download: path.split('/').pop() });
  if (error) throw new Error(error.message);
  return data.signedUrl;
};

export default async function handler(req, res) {
  const admin = adminClient();
  if (!admin) return send(res, 503, { error: 'File storage is not configured on the server.' });
  const me = await callerProfile(admin, req);
  if (!me) return send(res, 401, { error: 'Please sign in again.' });
  if (!STAFF_ROLES.includes(me.role)) return send(res, 403, { error: 'Staff only.' });
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const body = readBody(req);

  try {
    if (body.action === 'upload') {
      const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(String(body.dataUrl || ''));
      if (!m) return send(res, 400, { error: 'No file received.' });
      const bytes = Buffer.from(m[3], m[2] ? 'base64' : 'utf8');
      if (bytes.length > MAX_BYTES) return send(res, 413, { error: 'File is too large (max 3 MB).' });
      const safe = String(body.name || 'file').replace(/[^\w.\- ()]+/g, '_').slice(-120) || 'file';
      const path = `documents/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safe}`;
      await ensureBucket(admin);
      const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: m[1] || 'application/octet-stream', upsert: false });
      if (error) return send(res, 400, { error: error.message });
      return send(res, 200, { path, url: await signed(admin, path, body.days) });
    }
    if (body.action === 'sign') {
      if (!String(body.path || '').startsWith('documents/')) return send(res, 400, { error: 'Unknown file.' });
      return send(res, 200, { url: await signed(admin, String(body.path), body.days) });
    }
    if (body.action === 'share') {
      if (!String(body.path || '').startsWith('documents/')) return send(res, 400, { error: 'Unknown file.' });
      return send(res, 200, { url: makeShareUrl(originOf(req), String(body.path), body.days) });
    }
    return send(res, 400, { error: 'Unknown action.' });
  } catch (e) {
    return send(res, 500, { error: e?.message || 'Storage error' });
  }
}
