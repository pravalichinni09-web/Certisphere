/**
 * Public certificate verification — opened by scanning the QR code on a
 * QMICS certificate (/verify/<certificate number>). No login needed.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface Result {
  valid?: boolean; status?: string; certificateNumber?: string; organization?: string; standard?: string;
  scope?: string; issuedDate?: string | null; expiryDate?: string | null; certificationBody?: string; error?: string;
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—');

const VerifyCertificate: React.FC = () => {
  const { certNo = '' } = useParams();
  const [r, setR] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    fetch(`/api/verify?n=${encodeURIComponent(certNo)}`)
      .then(async (res) => ({ ...(await res.json().catch(() => ({}))) }))
      .then((d) => { if (!cancel) { setR(d); setLoading(false); } })
      .catch(() => { if (!cancel) { setR({ error: 'Could not reach the verification service. Please try again.' }); setLoading(false); } });
    return () => { cancel = true; };
  }, [certNo]);

  const ok = r?.valid;
  const tone = loading ? '#475569' : ok ? '#166534' : r?.status === 'Expired' || r?.status === 'Not released' ? '#b45309' : '#b91c1c';
  const bg = loading ? '#f8fafc' : ok ? '#f0fdf4' : r?.status === 'Expired' || r?.status === 'Not released' ? '#fffbeb' : '#fef2f2';
  const row = (k: string, v?: string | null) => (
    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12, padding: '9px 0', borderTop: '1px solid #e2e8f0', fontSize: 14 }}>
      <span style={{ color: '#64748b', fontWeight: 600 }}>{k}</span><span style={{ color: '#0f172a' }}>{v || '—'}</span>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'grid', placeItems: 'start center', padding: '40px 16px', fontFamily: 'system-ui, Arial, sans-serif' }}>
      <div style={{ width: 'min(560px, 100%)', background: '#fff', borderRadius: 14, boxShadow: '0 10px 30px rgba(15,23,42,.08)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px', borderBottom: '3px solid #14532d' }}>
          <img src="/images/qmics-logo.png" alt="QMICS" style={{ width: 48, height: 48, objectFit: 'contain' }} />
          <div>
            <div style={{ fontWeight: 800, color: '#14532d', fontSize: 15 }}>QMICS Solutions Pvt. Ltd.</div>
            <div style={{ color: '#64748b', fontSize: 12.5 }}>Certificate verification</div>
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <div data-testid="verify-status" style={{ background: bg, color: tone, borderRadius: 10, padding: '14px 16px', fontWeight: 800, fontSize: 17 }}>
            {loading ? 'Checking certificate…'
              : ok ? '✓ Valid certificate'
              : r?.status === 'Expired' ? 'This certificate has expired'
              : r?.status === 'Not released' ? 'This certificate has not been released yet'
              : '✗ Certificate not found'}
            {!loading && !r?.status && <div style={{ fontWeight: 500, fontSize: 13.5, marginTop: 6 }}>{r?.error || 'No certificate with this number was issued by QMICS.'}</div>}
          </div>
          {!loading && r?.status && (
            <div style={{ marginTop: 14 }}>
              {row('Certificate no.', r.certificateNumber)}
              {row('Organisation', r.organization)}
              {row('Standard', r.standard)}
              {r.scope ? row('Scope', r.scope) : null}
              {row('Issue date', fmt(r.issuedDate))}
              {row('Valid until', fmt(r.expiryDate))}
              {row('Status', r.status)}
              {row('Issued by', r.certificationBody)}
            </div>
          )}
          {!loading && !r?.status && row('Certificate no.', certNo)}
          <p style={{ color: '#64748b', fontSize: 12.5, marginTop: 16 }}>Questions? Contact QMICS at rk@qmicssolutions.com · +91 98494 99111 · qmicscertifications.com</p>
        </div>
      </div>
    </div>
  );
};

export default VerifyCertificate;
