/**
 * SendApplicationDialog — send the application form to a prospective client
 * ----------------------------------------------------------------------
 * Used from Client Enquiry → Enquiries (✈ Send icon).
 *  1. Choose the application form: our saved standard form, or upload one.
 *  2. Check / edit the email.
 *  3. Send:  EmailJS configured → the email goes out automatically, with a
 *            30-day download link to the form (live site: private storage).
 *            Not configured   → your email app opens with the text + link.
 * The caller records the Sent Application with the same attachment, so the
 * file shows under Sent Application / Receive / Review.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { X, Send, Paperclip, Upload, CheckCircle2, AlertTriangle, Mail } from 'lucide-react';
import { storeFile, emailLink, isShareableLink, MAX_FILE_BYTES, readStandardForm, STANDARD_FORM_KEY, type StoredFile } from '../lib/fileStore';
import { isEmailJSConfigured } from '../config/emailjsConfig';
import { sendEmail } from '../services/emailService';

export interface ApplicationSendInput {
  to: string; contactName: string; company: string; standards?: string[]; enquiryDate?: string;
}
export interface ApplicationSendResult {
  file: StoredFile | null; via: 'emailjs' | 'mailapp'; sentAt: string; to: string; subject: string;
}

const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

const SendApplicationDialog: React.FC<{
  input: ApplicationSendInput;
  onClose: () => void;
  onSent: (r: ApplicationSendResult) => void;
}> = ({ input, onClose, onSent }) => {
  const standard = useMemo(() => readStandardForm(), []);
  const [useStandard, setUseStandard] = useState<boolean>(!!standard);
  const [picked, setPicked] = useState<File | null>(null);
  const [saveAsStandard, setSaveAsStandard] = useState<boolean>(!standard);
  const [to, setTo] = useState(input.to);
  const [subject, setSubject] = useState(`Application for Certification — ${input.company}`);
  const [message, setMessage] = useState(() => [
    `Dear ${input.contactName || 'Sir/Madam'},`,
    '',
    `Thank you for your enquiry${input.enquiryDate ? ` on ${input.enquiryDate}` : ''} regarding ${input.standards?.length ? input.standards.join(', ') : 'certification'} for ${input.company}.`,
    'Please download the attached Application for Certification, fill it in completely, sign it and send it back to us by replying to this email.',
    '',
    'Once we receive it, we will review your application and share the quotation and next steps.',
    '',
    'Best regards,',
    'Audit Coordinator',
    'QMICS Certification',
  ].join('\n'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ejs = isEmailJSConfigured();

  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [busy, onClose]);

  const send = async () => {
    setErr(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) { setErr('Enter a valid client email.'); return; }
    if (!useStandard && !picked) { setErr('Attach the application form (or choose the standard form).'); return; }
    setBusy(true);
    try {
      // 1) the form file
      let file: StoredFile | null = useStandard ? standard : null;
      if (!useStandard && picked) {
        file = await storeFile(picked);
        if (saveAsStandard) localStorage.setItem(STANDARD_FORM_KEY, JSON.stringify(file));
      }
      const link = file ? await emailLink(file) : null;
      const shareable = isShareableLink(link);
      const registerLink = `${window.location.origin}/login`;
      // plain text (email app fallback)
      const full = [
        message.trim(),
        '',
        file ? (shareable ? `Application form (${file.name}) — download link, valid 30 days:\n${link}` : `Application form: ${file.name} (attached)`) : '',
        `You can also register on our portal: ${registerLink}`,
      ].filter(Boolean).join('\n');
      // HTML for EmailJS: short clickable text instead of long web addresses
      const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const btn = 'display:inline-block;padding:10px 18px;background:#166534;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold';
      const html = [
        esc(message.trim()),
        '',
        file && shareable ? `<a href="${link}" style="${btn}">Download the Application Form</a>\n<span style="color:#64748b;font-size:12px">${esc(file.name)} · link valid for 30 days</span>` : '',
        file && !shareable ? `Application form: ${esc(file.name)} (attached)` : '',
        `You can also register on our portal: <a href="${registerLink}">${esc(window.location.host)}</a>`,
      ].filter(Boolean).join('\n');
      const sentAt = new Date().toISOString();

      // 2) send
      if (ejs) {
        const r = await sendEmail({
          type: 'application', to: to.trim(), subject, body: full,
          templateVars: {
            to_email: to.trim(), to_name: input.contactName || to.trim(), company: input.company, subject, message: html, message_text: full,
            form_name: file?.name || '', form_link: shareable ? String(link) : '', register_link: registerLink,
          },
        });
        if (r.status !== 'sent') throw new Error(`Email could not be sent: ${r.error || 'EmailJS error'}. Check Email Configuration.`);
        onSent({ file, via: 'emailjs', sentAt, to: to.trim(), subject });
      } else {
        window.open(`mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(full)}`, '_blank');
        onSent({ file, via: 'mailapp', sentAt, to: to.trim(), subject });
      }
    } catch (e) {
      setErr((e as Error)?.message || 'Could not send.');
      setBusy(false);
    }
  };

  const box: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 8 };
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, color: '#0f172a', background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { display: 'grid', gap: 4, fontSize: 12, fontWeight: 600, color: '#334155' };

  return (
    <div role="dialog" aria-modal="true" aria-label="Send application form" onClick={() => !busy && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 9000, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, 100%)', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 14, boxShadow: '0 20px 50px rgba(0,0,0,.3)', color: '#0f172a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #e2e8f0' }}>
          <Send size={18} color="#2563eb" />
          <strong style={{ flex: 1, fontSize: 16 }}>Send application form — {input.company}</strong>
          <button type="button" aria-label="Close" onClick={onClose} disabled={busy} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
        </div>

        <div style={{ padding: 18, display: 'grid', gap: 14 }}>
          {/* 1. attachment */}
          <div style={box}>
            <strong style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Paperclip size={14} /> 1. Application form</strong>
            {standard && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                <input type="radio" name="appform" checked={useStandard} onChange={() => setUseStandard(true)} />
                Our standard form: <strong>{standard.name}</strong> <span style={{ color: '#64748b' }}>({fmtSize(standard.size)})</span>
              </label>
            )}
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
              {standard && <input type="radio" name="appform" checked={!useStandard} onChange={() => setUseStandard(false)} />}
              <span>{standard ? 'Upload a different file:' : 'Upload the application form (PDF / Word, max 3 MB):'}</span>
            </label>
            {(!standard || !useStandard) && (
              <div style={{ display: 'grid', gap: 6, paddingLeft: standard ? 24 : 0 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content', padding: '7px 12px', borderRadius: 8, border: '1px dashed #94a3b8', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <Upload size={14} /> {picked ? 'Change file' : 'Choose file'}
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.odt" style={{ display: 'none' }} data-testid="send-app-file"
                    onChange={(e) => { const f = e.target.files?.[0] || null; if (f && f.size > MAX_FILE_BYTES) { setErr('File is too large. Keep it under 3 MB.'); return; } setErr(null); setPicked(f); setUseStandard(false); }} />
                </label>
                {picked && <span style={{ fontSize: 13 }}><CheckCircle2 size={13} color="#16a34a" style={{ verticalAlign: '-2px' }} /> {picked.name} · {fmtSize(picked.size)}</span>}
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: '#334155' }}>
                  <input type="checkbox" checked={saveAsStandard} onChange={(e) => setSaveAsStandard(e.target.checked)} />
                  Save as our standard application form (pre-selected next time)
                </label>
              </div>
            )}
          </div>

          {/* 2. email */}
          <div style={box}>
            <strong style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={14} /> 2. Email</strong>
            <label style={lbl}>To<input style={inp} value={to} onChange={(e) => setTo(e.target.value)} type="email" /></label>
            <label style={lbl}>Subject<input style={inp} value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
            <label style={lbl}>Message<textarea style={{ ...inp, minHeight: 170 }} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
            <span style={{ fontSize: 12, color: '#64748b' }}>A download link to the form and a link to register on CertiSphere are added at the end automatically.</span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, padding: '8px 10px', borderRadius: 8, background: ejs ? '#ecfdf5' : '#fffbeb', color: ejs ? '#065f46' : '#92400e' }}>
            {ejs ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            <span>{ejs
              ? 'The email will be sent automatically from your EmailJS account.'
              : 'Automatic email is not set up yet (Email Configuration → EmailJS). Your email app will open with this text and the download link — press Send there.'}</span>
          </div>

          {err && <div role="alert" style={{ fontSize: 13, fontWeight: 600, color: '#b91c1c', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: '8px 10px' }}>{err}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose} disabled={busy} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button type="button" onClick={() => void send()} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              <Send size={15} /> {busy ? 'Sending…' : ejs ? 'Send email' : 'Open email & record'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendApplicationDialog;
