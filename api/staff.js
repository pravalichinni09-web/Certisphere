/**
 * /api/staff — staff directory for signed-in staff (live mode)
 * ----------------------------------------------------------------------
 * GET → [{ name, role }] for active Management / Audit Coordinator /
 * Lead Auditor / Auditor accounts. Used to fill the coordinator / audit
 * team pickers and the AI team suggestions. Client users get 403.
 * Emails are not returned.
 */
import { adminClient, callerProfile, send, STAFF_ROLES } from './_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  const admin = adminClient();
  if (!admin) return send(res, 503, { error: 'Not configured on the server.' });
  const me = await callerProfile(admin, req);
  if (!me) return send(res, 401, { error: 'Please sign in again.' });
  if (!STAFF_ROLES.includes(me.role)) return send(res, 403, { error: 'Staff only.' });
  const { data, error } = await admin.from('profiles').select('full_name,email,role,active').in('role', STAFF_ROLES).eq('active', true);
  if (error) return send(res, 500, { error: error.message });
  return send(res, 200, { staff: (data || []).map((p) => ({ name: (p.full_name || '').trim() || p.email, role: p.role })) });
}
