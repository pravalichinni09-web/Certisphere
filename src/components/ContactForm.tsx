import React, { useState } from 'react';
import { sendContactForm } from '../services/emailService';
import { isEmailJSConfigured } from '../config/emailjsConfig';

interface ContactFormProps {
  onClose?: () => void;
  /** When embedded in-page (not modal) set to true */
  inline?: boolean;
}

const ContactForm: React.FC<ContactFormProps> = ({ onClose, inline }) => {
  const [form, setForm] = useState({
    fromName: '', fromEmail: '', company: '', phone: '', message: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fromName.trim() || !form.fromEmail.trim() || !form.message.trim()) {
      setErrMsg('Name, email and message are required.');
      return;
    }
    setStatus('sending');
    setErrMsg('');
    try {
      const res = await sendContactForm(form);
      if (res.status === 'sent') {
        setStatus('sent');
      } else if (res.status === 'queued') {
        // EmailJS not configured — message queued, still count as success for UX
        setStatus('sent');
      } else {
        throw new Error(res.error || 'Send failed');
      }
    } catch (err: any) {
      setStatus('error');
      setErrMsg(err?.message || 'Failed to send. Please try again.');
    }
  };

  const configured = isEmailJSConfigured();

  // ── Styles ───────────────────────────────────────────────────
  const wrap: React.CSSProperties = inline
    ? { width: '100%' }
    : {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: 16,
      };

  const card: React.CSSProperties = {
    background: '#ffffff', borderRadius: 16, padding: 36,
    width: '100%', maxWidth: 520,
    boxShadow: inline ? 'none' : '0 20px 60px rgba(0,0,0,0.25)',
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
    transition: 'border-color .2s',
    color: '#111827',
    background: '#ffffff',
  };

  const label: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: '#374151', marginBottom: 5,
  };

  const btn: React.CSSProperties = {
    width: '100%', padding: '12px 0', borderRadius: 10,
    background: status === 'sending' ? '#93C5FD' : '#1D4ED8',
    color: '#fff', fontWeight: 700, fontSize: 15,
    border: 'none', cursor: status === 'sending' ? 'not-allowed' : 'pointer',
    transition: 'background .2s',
  };

  if (status === 'sent') {
    return (
      <div style={wrap} onClick={inline ? undefined : onClose}>
        <div style={{ ...card, textAlign: 'center' }} className="cs-light-modal" onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h3 style={{ margin: '0 0 8px', color: '#111827', fontSize: 22 }}>Message Sent!</h3>
          <p style={{ color: '#6B7280', marginBottom: 24, fontSize: 15 }}>
            {configured
              ? 'Your enquiry has been sent. We\'ll get back to you within 1 business day.'
              : 'Your message has been recorded. We\'ll be in touch shortly.'}
          </p>
          {onClose && (
            <button onClick={onClose} style={{ ...btn, width: 'auto', padding: '10px 32px' }}>
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={wrap} onClick={inline ? undefined : onClose}>
      <div style={card} className="cs-light-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, color: '#111827', fontWeight: 700 }}>
              Contact Us
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
              Send us a message and we'll respond within 1 business day.
            </p>
          </div>
          {!inline && onClose && (
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6B7280', lineHeight: 1 }}>
              ✕
            </button>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Name + Email row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={label}>Full Name <span style={{ color: '#EF4444' }}>*</span></label>
              <input style={inp} type="text" value={form.fromName}
                onChange={set('fromName')} placeholder="John Doe" />
            </div>
            <div>
              <label style={label}>Email <span style={{ color: '#EF4444' }}>*</span></label>
              <input style={inp} type="email" value={form.fromEmail}
                onChange={set('fromEmail')} placeholder="john@example.com" />
            </div>
          </div>

          {/* Company + Phone row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={label}>Company / Organisation</label>
              <input style={inp} type="text" value={form.company}
                onChange={set('company')} placeholder="Acme Ltd" />
            </div>
            <div>
              <label style={label}>Phone</label>
              <input style={inp} type="tel" value={form.phone}
                onChange={set('phone')} placeholder="+91 98765 43210" />
            </div>
          </div>

          {/* Message */}
          <div style={{ marginBottom: 18 }}>
            <label style={label}>Message <span style={{ color: '#EF4444' }}>*</span></label>
            <textarea
              style={{ ...inp, minHeight: 110, resize: 'vertical' }}
              value={form.message}
              onChange={set('message')}
              placeholder="Tell us about your certification requirements…"
            />
          </div>

          {/* Error */}
          {errMsg && (
            <p style={{ color: '#DC2626', fontSize: 13, margin: '0 0 12px',
              background: '#FEF2F2', padding: '8px 12px', borderRadius: 8 }}>
              {errMsg}
            </p>
          )}

          {/* Demo mode notice */}
          {!configured && (
            <p style={{ fontSize: 12, color: '#92400E', background: '#FFFBEB',
              padding: '8px 12px', borderRadius: 8, marginBottom: 14,
              border: '1px solid #FCD34D' }}>
              ℹ️ Email delivery is in demo mode. Configure EmailJS keys in Settings to enable live sending.
            </p>
          )}

          <button type="submit" style={btn} disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ContactForm;
