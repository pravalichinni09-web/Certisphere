/**
 * /api/dl — opens a file from a short signed email link (see _lib/shareLink.js).
 * Anyone with the link can download that one file until the link expires.
 */
import { adminClient } from './_lib/supabaseAdmin.js';
import { readShare } from './_lib/shareLink.js';

const page = (res, status, msg) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(status).send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QMICS download</title><body style="font-family:Arial,sans-serif;max-width:520px;margin:60px auto;padding:0 16px;color:#0f172a"><h2 style="color:#14532d">QMICS Solutions Pvt. Ltd.</h2><p>${msg}</p></body>`);
};

export default async function handler(req, res) {
  const q = (req.query && Object.keys(req.query).length) ? req.query : Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const r = readShare(q);
  if (r.error) return page(res, 403, r.error);
  const admin = adminClient();
  if (!admin) return page(res, 503, 'Downloads are not available right now.');
  const name = r.path.split('/').pop().replace(/^\d+-/, '');
  const { data, error } = await admin.storage.from('certisphere-files').createSignedUrl(r.path, 120, { download: name });
  if (error || !data?.signedUrl) return page(res, 404, 'This file is no longer available. Please ask QMICS for a new link.');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', data.signedUrl);
  res.status(302).send('');
}
