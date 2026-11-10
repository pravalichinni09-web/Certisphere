/**
 * /api/register-client — public client self-registration (live mode)
 * ----------------------------------------------------------------------
 * Creates, in one step and on the server:
 *   1. the client record      (store cms_client_registrations)
 *   2. its workflow record    (stage "Registration Submitted")
 *   3. the Auditee login      (Supabase Auth + profile linked to the client)
 * so a new client can never give themselves another role or another
 * client's data.
 *
 * POST { organizationName, contactPerson, email, password, phone?, address?, standard?, clientType? }
 */
import { adminClient, readBody, send, isEmail, nextClientId } from './_lib/supabaseAdmin.js';

const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const admin = adminClient();
  if (!admin) return send(res, 503, { error: 'Registration is not configured on the server.' });

  const b = readBody(req);
  const organizationName = clean(b.organizationName);
  const contactPerson = clean(b.contactPerson);
  const email = clean(b.email).toLowerCase();
  const password = String(b.password || '');
  if (!organizationName || !contactPerson) return send(res, 400, { error: 'Organization name and contact person are required.' });
  if (!isEmail(email)) return send(res, 400, { error: 'Enter a valid email address.' });
  if (password.length < 8) return send(res, 400, { error: 'Choose a password of at least 8 characters.' });

  // 1. Login first — fails cleanly if the email is already registered
  const { data: created, error: uErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (uErr || !created?.user) {
    const exists = /already|registered|exists/i.test(uErr?.message || '');
    return send(res, exists ? 409 : 400, { error: exists ? 'An account with this email already exists. Sign in instead.' : (uErr?.message || 'Could not create your account.') });
  }

  try {
    const id = await nextClientId(admin);
    const now = new Date().toISOString();
    const { count } = await admin.from('app_data').select('row_key', { count: 'exact', head: true }).eq('store', 'cms_client_registrations');
    const registration = {
      id, organizationName, contactPerson, email,
      phone: clean(b.phone, 40), address: clean(b.address, 300),
      standard: clean(b.standard, 60) || 'ISO 9001:2015', clientType: clean(b.clientType, 60) || 'Initial',
      status: 'Pending',
      registrationNumber: `REG-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`,
      registrationDate: now, source: 'Self-registration',
    };
    const workflow = {
      clientId: id, currentStage: 'Registration Submitted',
      history: [{ stage: 'Registration Submitted', at: now, by: contactPerson }],
      createdAt: now, updatedAt: now,
    };
    const { count: wfCount } = await admin.from('app_data').select('row_key', { count: 'exact', head: true }).eq('store', 'cms_audit_workflow');
    const { error: dErr } = await admin.from('app_data').insert([
      { store: 'cms_client_registrations', row_key: String(id), kind: 'array', pos: count || 0, client_id: id, data: registration },
      { store: 'cms_audit_workflow', row_key: String(id), kind: 'array', pos: wfCount || 0, client_id: id, data: workflow },
    ]);
    if (dErr) throw new Error(dErr.message);

    const { error: pErr } = await admin.from('profiles').insert({
      id: created.user.id, email, full_name: contactPerson, role: 'Auditee', client_id: id, active: true,
    });
    if (pErr) throw new Error(pErr.message);

    return send(res, 200, { clientId: id, registrationNumber: registration.registrationNumber, email });
  } catch (e) {
    await admin.auth.admin.deleteUser(created.user.id);
    return send(res, 500, { error: `Registration failed: ${e.message}` });
  }
}
