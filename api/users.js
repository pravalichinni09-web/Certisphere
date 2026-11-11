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
 *   POST { action: 'demo-login', id, show, password? }                    (Management)
 *        show=true  → sets the account's password and lists it on the sign-in page
 *        show=false → removes it from the sign-in page
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
    const { data: demo } = await admin.from('demo_logins').select('user_id,password');
    return send(res, 200, { users: data, demo: demo || [] });
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
    // keep the sign-in page's demo list in step with the account
    if (data.active === false) await admin.from('demo_logins').delete().eq('user_id', data.id);
    else if (patch.role) await admin.from('demo_logins').update({ role: data.role, updated_at: patch.updated_at }).eq('user_id', data.id);
    return send(res, 200, { user: data });
  }

  if (body.action === 'reset-password') {
    const password = tempPassword();
    const { error } = await admin.auth.admin.updateUserById(body.id, { password });
    if (error) return send(res, 400, { error: error.message });
    await admin.from('demo_logins').delete().eq('user_id', body.id); // old demo password no longer works
    return send(res, 200, { password });
  }

  if (body.action === 'demo-login') {
    if (!body.show) {
      const { error } = await admin.from('demo_logins').delete().eq('user_id', body.id);
      if (error) return send(res, 400, { error: error.message });
      return send(res, 200, { ok: true });
    }
    const password = String(body.password || '');
    if (password.length < 8) return send(res, 400, { error: 'Demo password must be at least 8 characters.' });
    const { data: prof, error: gErr } = await admin.from('profiles').select('id,email,role,active').eq('id', body.id).maybeSingle();
    if (gErr) return send(res, 400, { error: gErr.message });
    if (!prof) return send(res, 404, { error: 'Account not found.' });
    if (!prof.active) return send(res, 400, { error: 'Enable this account before showing it on the sign-in page.' });
    const { error: aErr } = await admin.auth.admin.updateUserById(prof.id, { password });
    if (aErr) return send(res, 400, { error: aErr.message });
    const { error: dErr } = await admin.from('demo_logins').upsert(
      { user_id: prof.id, email: prof.email, role: prof.role, password, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' });
    if (dErr) return send(res, 400, { error: dErr.message });
    return send(res, 200, { ok: true });
  }

  return send(res, 400, { error: 'Unknown action.' });
}
