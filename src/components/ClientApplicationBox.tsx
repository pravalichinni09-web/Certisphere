/**
 * ClientApplicationBox — the application form for one client, inside the workflow.
 *  • Application form sent  → open it, or attach it if it was sent outside CertiSphere
 *  • Filled application     → the signed form the client sent back: upload / open
 * Files go to private storage on the live site (see lib/fileStore).
 */
import React, { useRef, useState } from 'react';
import { Paperclip, Upload, FileCheck2, Send } from 'lucide-react';
import SendApplicationDialog from './SendApplicationDialog';
import { applicationOf, setClientApplication, registrationOf } from '../ai/workflowAI';
import { storeFile, openStoredFile, MAX_FILE_BYTES, type StoredFile } from '../lib/fileStore';

const fmt = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); };

const ClientApplicationBox: React.FC<{ clientId: number; canEdit?: boolean; compact?: boolean }> = ({ clientId, canEdit = true, compact = false }) => {
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState<'' | 'sent' | 'filled'>('');
  const [err, setErr] = useState<string | null>(null);
  const sentInput = useRef<HTMLInputElement>(null);
  const filledInput = useRef<HTMLInputElement>(null);
  const app = applicationOf(clientId);
  const [sending, setSending] = useState(false);
  const reg = registrationOf(clientId);

  const upload = async (kind: 'sent' | 'filled', f?: File | null) => {
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) { setErr('File is too large. Keep it under 3 MB.'); return; }
    setErr(null); setBusy(kind);
    try {
      const stored = await storeFile(f);
      if (!setClientApplication(clientId, kind, stored)) setErr('Client registration not found.');
      setTick((t) => t + 1);
    } catch (e) { setErr((e as Error)?.message || 'Upload failed.'); }
    setBusy('');
  };

  const link: React.CSSProperties = { border: 'none', background: 'transparent', color: '#1d4ed8', cursor: 'pointer', padding: 0, fontSize: 12.5, textDecoration: 'underline' };
  const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 7, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer' };
  const file = (f: StoredFile) => <button type="button" style={link} onClick={(e) => { e.stopPropagation(); void openStoredFile(f); }}>{f.name}</button>;

  return (
    <div onClick={(e) => e.stopPropagation()} data-testid={`client-app-${clientId}`}
      style={{ display: 'grid', gap: 4, fontSize: 12.5, ...(compact ? {} : { padding: '8px 10px', borderRadius: 8, background: '#fff', border: '1px solid #e2e8f0' }) }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <Paperclip size={13} color="#475569" /><strong>Application sent:</strong>
        {app.sentFile ? <>{file(app.sentFile as StoredFile)}<span style={{ color: '#64748b' }}>{app.sentAt ? `· ${fmt(app.sentAt)}` : ''}{app.sentVia === 'emailjs' ? ' · emailed' : ''}</span></>
          : <span style={{ color: '#64748b' }}>not sent yet</span>}
        {canEdit && <button type="button" style={btn} disabled={!!busy} onClick={() => sentInput.current?.click()}><Upload size={12} /> {busy === 'sent' ? 'Uploading…' : app.sentFile ? 'Replace' : 'Attach'}</button>}
        {canEdit && reg && <button type="button" style={{ ...btn, borderColor: '#2563eb', color: '#1d4ed8' }} disabled={!!busy} onClick={() => setSending(true)} data-testid={`client-app-send-${clientId}`}><Send size={12} /> {app.sentFile ? 'Send again' : 'Send form by email'}</button>}
        <input ref={sentInput} type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.odt" data-testid={`client-app-sent-${clientId}`} onChange={(e) => { void upload('sent', e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <FileCheck2 size={13} color="#475569" /><strong>Filled application from client:</strong>
        {app.filledFile ? <>{file(app.filledFile as StoredFile)}<span style={{ color: '#64748b' }}>· {fmt(app.filledAt)}</span></> : <span style={{ color: '#64748b' }}>not received yet</span>}
        {canEdit && <button type="button" style={btn} disabled={!!busy} onClick={() => filledInput.current?.click()}><Upload size={12} /> {busy === 'filled' ? 'Uploading…' : app.filledFile ? 'Replace' : 'Upload'}</button>}
        <input ref={filledInput} type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.jpg,.jpeg,.png" data-testid={`client-app-filled-${clientId}`} onChange={(e) => { void upload('filled', e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {err && <div role="alert" style={{ color: '#b91c1c', fontWeight: 600 }}>{err}</div>}
      {sending && reg && (
        <SendApplicationDialog
          input={{ to: reg.email || '', contactName: reg.contactPerson || '', company: reg.organizationName || `Client #${clientId}`, standards: reg.standards || (reg.standard ? [reg.standard] : []) }}
          onClose={() => setSending(false)}
          onSent={(r) => { if (r.file) setClientApplication(clientId, 'sent', r.file, { at: r.sentAt, via: r.via }); setSending(false); setTick((t) => t + 1); }}
        />
      )}
    </div>
  );
};

export default ClientApplicationBox;
