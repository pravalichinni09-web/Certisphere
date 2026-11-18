/**
 * /api/verify?n=<certificate number> — public certificate check (no login).
 * Used by the QR code on every certificate: shows whether the certificate is
 * genuine and valid. Returns only what is printed on the certificate itself.
 */
import { adminClient, send } from './_lib/supabaseAdmin.js';

const DAY = 864e5;
const addDays = (iso, n) => new Date(new Date(iso).getTime() + n * DAY).toISOString();

export default async function handler(req, res) {
  const q = (req.query && Object.keys(req.query).length) ? req.query : Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const n = String(q.n || '').trim();
  if (!/^[A-Za-z0-9-]{3,40}$/.test(n)) return send(res, 400, { error: 'Enter a certificate number.' });
  const admin = adminClient();
  if (!admin) return send(res, 503, { error: 'Verification is not available right now.' });

  const { data: flags, error } = await admin.from('app_data').select('row_key,data').eq('store', 'cms_workflow_flags_v1');
  if (error) return send(res, 500, { error: 'Verification is not available right now.' });
  const hit = (flags || []).find((r) => String(r.data?.certificateNumber || '').toLowerCase() === n.toLowerCase());
  if (!hit) return send(res, 404, { valid: false, certificateNumber: n, error: 'No certificate with this number was issued by QMICS.' });

  const clientId = String(hit.row_key);
  const [{ data: wfRows }, { data: regRows }] = await Promise.all([
    admin.from('app_data').select('data').eq('store', 'cms_audit_workflow').eq('row_key', clientId),
    admin.from('app_data').select('data').eq('store', 'cms_client_registrations').eq('row_key', clientId),
  ]);
  const wf = wfRows?.[0]?.data || {};
  const reg = regRows?.[0]?.data || {};
  const released = wf.currentStage === 'Certification released';
  const issued = [...(wf.history || [])].reverse().find((h) => h.stage === 'Certification released')?.at || hit.data.certificateGeneratedAt;
  const expiry = issued ? addDays(issued, 3 * 365 - 1) : null;
  const status = !released ? 'Not released' : (expiry && new Date(expiry).getTime() < Date.now() ? 'Expired' : 'Valid');

  return send(res, 200, {
    valid: status === 'Valid',
    status,
    certificateNumber: hit.data.certificateNumber,
    organization: reg.organizationName || `Client #${clientId}`,
    standard: wf.requirements?.standards?.[0] || reg.standard || '',
    scope: wf.requirements?.scope || '',
    issuedDate: released ? issued : null,
    expiryDate: released ? expiry : null,
    certificationBody: 'QMICS Solutions and Compliances Pvt. Ltd.',
  });
}
