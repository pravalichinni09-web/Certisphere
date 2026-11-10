/**
 * /api/users — account management (live mode)
 * ----------------------------------------------------------------------
 *   GET                                   list all accounts       (Management)
 *   POST { action: 'create', email, fullName, role, clientId?, password? }
 *        Management may create any role; an Audit Coordinator may create
 *        client logins (Auditee / Client Coordinator) only.
 *        Returns the password once, so it can be handed to the person.
 *   POST { action: 'update', id, role?, clientId?, fullName?, active? }   (Management)
 *   POST { action: 'reset-password', id }                                 (Management)
 */
import {
  adminClient, callerProfile, readBody, send, tempPassword, isEmail,
  ALL_ROLES, CLIENT_ROLES,
} from './_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  const admin = adminClient();
  if (!admin) return send(res, 503, { error: 'Account management is not configured on the server (SUPABASE_SERVICE_ROLE_KEY missing).' });

  const me = await callerProfile(admin, req);
  if (!me) return send(res, 401, { error: 'Please sign in again.' });

  if (req.method === 'GET') {
    if (me.role !== 'Management') return send(res, 403, { error: 'Only Management can view all accounts.' });
    const { data, error } = await admin.from('profiles').select('*').order('created_at', { ascending: true });
    if (error) return send(res, 500, { error: error.message });
    return send(res, 200, { users: data });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const body = readBody(req);

  if (body.action === 'create') {
    const email = String(body.email || '').trim().toLowerCase();
    const role = String(body.role || '');
    const clientId = body.clientId === undefined || body.clientId === null || body.clientId === '' ? null : Number(body.clientId);
    if (!isEmail(email)) return send(res, 400, { error: 'Enter a valid email address.' });
    if (!ALL_ROLES.includes(role)) return send(res, 400, { error: 'Choose a valid role.' });
    if (me.role !== 'Management' && !(me.role === 'Audit Coordinator' && CLIENT_ROLES.includes(role))) {
      return send(res, 403, { error: 'You are not allowed to create this type of account.' });
    }
    if (CLIENT_ROLES.includes(role) && !Number.isFinite(clientId)) return send(res, 400, { error: 'Client logins must be linked to a client.' });

    const password = body.password && String(body.password).length >= 8 ? String(body.password) : tempPassword();
    const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !created?.user) {
      const exists = /already|registered|exists/i.test(error?.message || '');
      return send(res, exists ? 409 : 400, { error: exists ? 'An account with this email already exists.' : (error?.message || 'Could not create the account.') });
    }
    const { error: pErr } = await admin.from('profiles').insert({
      id: created.user.id, email, full_name: String(body.fullName || '').trim() || email,
      role, client_id: CLIENT_ROLES.includes(role) ? clientId : null, active: true,
    });
    if (pErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return send(res, 400, { error: pErr.message });
    }
    return send(res, 200, { id: created.user.id, email, password });
  }

  if (me.role !== 'Management') return send(res, 403, { error: 'Only Management can change accounts.' });

  if (body.action === 'update') {
    const patch = { updated_at: new Date().toISOString() };
    if (body.fullName !== undefined) patch.full_name = String(body.fullName).trim();
    if (body.role !== undefined) {
      if (!ALL_ROLES.includes(body.role)) return send(res, 400, { error: 'Choose a valid role.' });
      patch.role = body.role;
    }
    if (body.clientId !== undefined) patch.client_id = body.clientId === null || body.clientId === '' ? null : Number(body.clientId);
    if (body.active !== undefined) patch.active = !!body.active;
    if (body.id === me.id && (patch.active === false || (patch.role && patch.role !== 'Management'))) {
      return send(res, 400, { error: 'You cannot disable your own account or remove your own Management role.' });
    }
    const { data, error } = await admin.from('profiles').update(patch).eq('id', body.id).select().maybeSingle();
    if (error) return send(res, 400, { error: error.message });
    if (!data) return send(res, 404, { error: 'Account not found.' });
    return send(res, 200, { user: data });
  }

  if (body.action === 'reset-password') {
    const password = tempPassword();
    const { error } = await admin.auth.admin.updateUserById(body.id, { password });
    if (error) return send(res, 400, { error: error.message });
    return send(res, 200, { password });
  }

  return send(res, 400, { error: 'Unknown action.' });
}
