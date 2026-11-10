/**
 * /reset-password — request a reset email, or set a new password after
 * following the link in that email (Supabase password recovery).
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isLiveMode, sendPasswordReset, setNewPassword, liveSignOut } from '../lib/liveAuth';

const box: React.CSSProperties = { width: 'min(420px, calc(100vw - 32px))', background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.25)', color: '#0f172a', display: 'grid', gap: 12 };
const input: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 };
const button: React.CSSProperties = { padding: '10px 14px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' };

const ResetPassword: React.FC = () => {
  const [recovering, setRecovering] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    // The email link signs the user in with a recovery session
    if (/type=recovery/.test(window.location.hash)) setRecovering(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const requestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const err = await sendPasswordReset(email);
    setBusy(false);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'If an account exists for this email, a reset link is on its way. Check your inbox.' });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) { setMsg({ ok: false, text: 'Use at least 8 characters.' }); return; }
    if (pw !== pw2) { setMsg({ ok: false, text: 'The two passwords do not match.' }); return; }
    setBusy(true);
    const err = await setNewPassword(pw);
    setBusy(false);
    if (err) { setMsg({ ok: false, text: err }); return; }
    await liveSignOut();
    setMsg({ ok: true, text: 'Password changed. You can now sign in with your new password.' });
    setRecovering(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f2547', fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <div style={box}>
        <h1 style={{ margin: 0, fontSize: 20 }}>{recovering ? 'Choose a new password' : 'Reset your password'}</h1>
        {!isLiveMode() ? (
          <p style={{ margin: 0, color: '#475569' }}>Password reset is only available on the live site.</p>
        ) : recovering ? (
          <form onSubmit={save} style={{ display: 'grid', gap: 10 }}>
            <label htmlFor="rp-new" style={{ fontSize: 13, fontWeight: 600 }}>New password</label>
            <input id="rp-new" type="password" autoComplete="new-password" style={input} value={pw} onChange={(e) => setPw(e.target.value)} />
            <label htmlFor="rp-new2" style={{ fontSize: 13, fontWeight: 600 }}>Repeat new password</label>
            <input id="rp-new2" type="password" autoComplete="new-password" style={input} value={pw2} onChange={(e) => setPw2(e.target.value)} />
            <button type="submit" style={button} disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
          </form>
        ) : (
          <form onSubmit={requestEmail} style={{ display: 'grid', gap: 10 }}>
            <label htmlFor="rp-email" style={{ fontSize: 13, fontWeight: 600 }}>Your account email</label>
            <input id="rp-email" type="email" autoComplete="email" style={input} value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" style={button} disabled={busy || !email}>{busy ? 'Sending…' : 'Send reset link'}</button>
          </form>
        )}
        {msg && <div role="status" style={{ fontSize: 13, fontWeight: 600, color: msg.ok ? '#047857' : '#b91c1c' }}>{msg.text}</div>}
        <a href="/login" style={{ fontSize: 13, color: '#1d4ed8' }}>← Back to sign in</a>
      </div>
    </div>
  );
};

export default ResetPassword;
