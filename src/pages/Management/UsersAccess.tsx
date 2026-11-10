/**
 * Management → Users & Access
 * ----------------------------------------------------------------------
 * Real CertiSphere accounts (live mode): add staff and client logins,
 * change roles, disable accounts and reset passwords. All changes go
 * through /api/users, which checks on the server that the caller is
 * Management — the browser can never assign roles itself.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus, KeyRound, ShieldCheck, ShieldOff, Copy, RefreshCw, Users } from 'lucide-react';
import { isLiveMode, apiFetch } from '../../lib/liveAuth';

interface Account {
  id: string; email: string; full_name: string; role: string;
  client_id: number | null; active: boolean; created_at: string;
}
const ROLES = ['Management', 'Audit Coordinator', 'Lead Auditor', 'Auditor', 'Auditee', 'Client Coordinator'];
const CLIENT_ROLES = ['Auditee', 'Client Coordinator'];

const clients = (): { id: number; name: string }[] => {
  try {
    const arr = JSON.parse(localStorage.getItem('cms_client_registrations') || '[]');
    return (Array.isArray(arr) ? arr : [])
      .filter((c: any) => Number.isFinite(Number(c.id)))
      .map((c: any) => ({ id: Number(c.id), name: c.organizationName || c.name || `Client #${c.id}` }));
  } catch { return []; }
};

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, color: '#0f172a' };
const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff', color: '#0f172a', minWidth: 0 };
const btn = (primary = true): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
  border: primary ? '1px solid #1d4ed8' : '1px solid #cbd5e1', background: primary ? '#1d4ed8' : '#fff', color: primary ? '#fff' : '#334155',
});
const small: React.CSSProperties = { ...btn(false), padding: '5px 9px', fontSize: 12 };

const UsersAccess: React.FC = () => {
  const live = isLiveMode();
  const [users, setUsers] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [form, setForm] = useState({ email: '', fullName: '', role: 'Audit Coordinator', clientId: '' });
  const clientList = useMemo(clients, [users]);
  const clientName = (id: number | null) => (id === null ? '—' : clientList.find((c) => c.id === id)?.name || `Client #${id}`);

  const load = async () => {
    if (!live) return;
    setLoading(true);
    const r = await apiFetch('/api/users', undefined, 'GET');
    setLoading(false);
    if (r.ok) setUsers(r.data.users || []);
    else setMsg({ ok: false, text: r.data?.error || 'Could not load accounts.' });
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setIssued(null);
    const needsClient = CLIENT_ROLES.includes(form.role);
    if (needsClient && !form.clientId) { setMsg({ ok: false, text: 'Choose the client this login belongs to.' }); return; }
    const r = await apiFetch('/api/users', {
      action: 'create', email: form.email, fullName: form.fullName, role: form.role,
      clientId: needsClient ? Number(form.clientId) : null,
    });
    if (!r.ok) { setMsg({ ok: false, text: r.data?.error || 'Could not create the account.' }); return; }
    setIssued({ email: r.data.email, password: r.data.password });
    setMsg({ ok: true, text: `Account created for ${r.data.email}. Give them the password below; they can change it with "Forgot your password?".` });
    setForm({ email: '', fullName: '', role: form.role, clientId: '' });
    void load();
  };

  const update = async (u: Account, patch: Record<string, unknown>, done: string) => {
    setMsg(null);
    const r = await apiFetch('/api/users', { action: 'update', id: u.id, ...patch });
    if (!r.ok) { setMsg({ ok: false, text: r.data?.error || 'Could not update the account.' }); return; }
    setMsg({ ok: true, text: done });
    void load();
  };

  const reset = async (u: Account) => {
    setMsg(null); setIssued(null);
    const r = await apiFetch('/api/users', { action: 'reset-password', id: u.id });
    if (!r.ok) { setMsg({ ok: false, text: r.data?.error || 'Could not reset the password.' }); return; }
    setIssued({ email: u.email, password: r.data.password });
    setMsg({ ok: true, text: `New password set for ${u.email}.` });
  };

  const copy = (t: string) => { navigator.clipboard?.writeText(t).catch(() => {}); };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eef2ff', display: 'grid', placeItems: 'center' }}><Users size={22} color="#4338ca" /></div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#0f172a' }}>Users &amp; Access</h1>
          <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: 13 }}>Every person signs in with their own account. Their role decides what they can see and do.</p>
        </div>
      </div>

      {!live ? (
        <div style={{ ...card, background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
          <strong>Demo mode.</strong> Real accounts are managed here once the site is connected to Supabase
          (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY). In demo mode, use the one-click demo logins on the sign-in page.
        </div>
      ) : (
        <>
          <form onSubmit={create} style={{ ...card, display: 'grid', gap: 12 }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}><UserPlus size={16} /> Add a person</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>Email
                <input id="ua-email" type="email" required style={inp} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>Full name
                <input id="ua-name" style={inp} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="First Last" />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>Role
                <select id="ua-role" style={inp} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              {CLIENT_ROLES.includes(form.role) && (
                <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>Client
                  <select id="ua-client" style={inp} value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                    <option value="">Choose a client…</option>
                    {clientList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div><button type="submit" style={btn()}><UserPlus size={14} /> Create account</button></div>
          </form>

          {msg && <div role="status" style={{ ...card, padding: 12, fontSize: 13, fontWeight: 600, color: msg.ok ? '#047857' : '#b91c1c', background: msg.ok ? '#ecfdf5' : '#fff1f2', borderColor: msg.ok ? '#a7f3d0' : '#fecdd3' }}>{msg.text}</div>}
          {issued && (
            <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', background: '#f8fafc' }}>
              <KeyRound size={16} />
              <span style={{ fontSize: 13 }}><strong>{issued.email}</strong> · password:</span>
              <code style={{ fontSize: 14, padding: '4px 8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, userSelect: 'all' }}>{issued.password}</code>
              <button type="button" style={small} onClick={() => copy(issued.password)}><Copy size={12} /> Copy</button>
              <span style={{ fontSize: 12, color: '#64748b' }}>Shown once. Share it privately.</span>
            </div>
          )}

          <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
              <strong>{users.length} account{users.length === 1 ? '' : 's'}</strong>
              <button type="button" style={small} onClick={() => void load()}><RefreshCw size={12} /> {loading ? 'Loading…' : 'Refresh'}</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#475569' }}>
                  {['Name', 'Email', 'Role', 'Client', 'Status', ''].map((h) => <th key={h} style={{ padding: '10px 12px', fontWeight: 700 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderTop: '1px solid #e2e8f0', opacity: u.active ? 1 : 0.55 }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{u.full_name || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{u.email}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <select aria-label={`Role for ${u.email}`} style={{ ...inp, padding: '5px 8px' }} value={u.role}
                        onChange={(e) => {
                          const role = e.target.value;
                          if (CLIENT_ROLES.includes(role) && u.client_id === null) { setMsg({ ok: false, text: 'Client roles need a client — create a new login for that client instead.' }); return; }
                          void update(u, { role, ...(CLIENT_ROLES.includes(role) ? {} : { clientId: null }) }, `${u.email} is now ${role}.`);
                        }}>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{clientName(u.client_id)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: u.active ? '#dcfce7' : '#fee2e2', color: u.active ? '#166534' : '#991b1b' }}>{u.active ? 'Active' : 'Disabled'}</span>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', display: 'flex', gap: 6 }}>
                      <button type="button" style={small} onClick={() => void reset(u)}><KeyRound size={12} /> Reset password</button>
                      <button type="button" style={small} onClick={() => void update(u, { active: !u.active }, `${u.email} ${u.active ? 'disabled' : 'enabled'}.`)}>
                        {u.active ? <><ShieldOff size={12} /> Disable</> : <><ShieldCheck size={12} /> Enable</>}
                      </button>
                    </td>
                  </tr>
                ))}
                {!users.length && !loading && (
                  <tr><td colSpan={6} style={{ padding: 16, color: '#64748b' }}>No accounts yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default UsersAccess;
