import React, { useEffect, useMemo, useState } from 'react';
import {
  UserPlus,
  Search,
  Send,
  Mail,
  Phone,
  Calendar,
  Globe,
  Briefcase,
  FileText,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  ShieldCheck,
  Filter,
  ArrowRight,
} from 'lucide-react';

/* -----------------------------------------------------------
   Auditor Request — incoming applications from the website
----------------------------------------------------------- */

type RequestStatus = 'New' | 'Form Sent' | 'Form Returned' | 'Under Review' | 'Forwarded to Management' | 'Approved' | 'Rejected';
type RequestSource = 'Website' | 'Email' | 'Phone' | 'Referral';

interface AuditorRequest {
  id: string;
  receivedAt: string;
  source: RequestSource;
  name: string;
  email: string;
  phone: string;
  country: string;
  role: string;                       // Lead Auditor / Auditor / Junior Auditor
  specialization: string;
  yearsOverall: string;
  yearsAudit: string;
  department: string;
  certifications: string[];
  message: string;
  status: RequestStatus;
  notes: string;
  // Form / documents the coordinator collected after review
  formSentAt?: string;
  formReturnedAt?: string;
  uploadedDocs?: { kind: 'certificate' | 'experience' | 'audit log'; name: string; uploadedAt: string }[];
  // Review pipeline
  reviewedByCoordinator?: { by: string; at: string; note?: string };
  reviewedByLeadAuditor?: { by: string; at: string; note?: string };
  forwardedToManagementAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

const STORAGE_KEY = 'cms_auditor_requests_v1';
const SEED_FLAG_KEY = 'cms_auditor_requests_seeded_v1';

const STATUS_COLORS: Record<RequestStatus, { bg: string; fg: string }> = {
  New:                       { bg: '#dbeafe', fg: '#1e40af' },
  'Form Sent':               { bg: '#fef3c7', fg: '#a16207' },
  'Form Returned':           { bg: '#e9d5ff', fg: '#7e22ce' },
  'Under Review':            { bg: '#fed7aa', fg: '#9a3412' },
  'Forwarded to Management': { bg: '#cffafe', fg: '#0e7490' },
  Approved:                  { bg: '#dcfce7', fg: '#15803d' },
  Rejected:                  { bg: '#fee2e2', fg: '#b91c1c' },
};


const day = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

/* -----------------------------------------------------------
   Demo seed
----------------------------------------------------------- */
const buildSeed = (): AuditorRequest[] => [
  {
    id: 'aud-req-001',
    receivedAt: day(0),
    source: 'Website',
    name: 'James Carter',
    email: 'j.carter@auditpros.com',
    phone: '+1 415 555 7811',
    country: 'USA',
    role: 'Lead Auditor',
    specialization: 'Information Security & AI Governance',
    yearsOverall: '14',
    yearsAudit: '9',
    department: 'Security',
    certifications: ['ISO 27001:2022', 'ISO 9001:2015', 'ISO 42001:2023'],
    message: 'Looking to join Qmics as a Lead Auditor in the USA. 9 years of ISMS audit experience across financial services and SaaS. Available immediately.',
    status: 'New',
    notes: '',
  },
  {
    id: 'aud-req-002',
    receivedAt: day(-1),
    source: 'Website',
    name: 'Hannah Bauer',
    email: 'h.bauer@iso-audit.de',
    phone: '+49 30 555 7812',
    country: 'Germany',
    role: 'Auditor',
    specialization: 'Automotive Quality',
    yearsOverall: '8',
    yearsAudit: '5',
    department: 'Quality',
    certifications: ['ISO 9001:2015', 'IATF 16949'],
    message: 'TUV-trained QMS auditor with 5 years auditing automotive Tier-1 suppliers. Interested in joining the German panel.',
    status: 'Form Sent',
    notes: 'Coordinator sent application form on day -1.',
    formSentAt: day(-1),
  },
  {
    id: 'aud-req-003',
    receivedAt: day(-3),
    source: 'Email',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@cert-india.in',
    phone: '+91 99880 55733',
    country: 'India',
    role: 'Auditor',
    specialization: 'Food Safety',
    yearsOverall: '10',
    yearsAudit: '7',
    department: 'Quality',
    certifications: ['ISO 22000:2018', 'FSSC 22000', 'ISO 9001:2015'],
    message: 'Sent CV via email last week. Looking forward to joining the India panel as a food safety auditor.',
    status: 'Form Returned',
    notes: 'Form returned with full CV + 3 audit logs.',
    formSentAt: day(-3),
    formReturnedAt: day(-1),
    uploadedDocs: [
      { kind: 'certificate', name: 'ISO_22000_Lead_Auditor_2024.pdf', uploadedAt: day(-1) },
      { kind: 'experience',  name: 'CV_Aarav_Sharma.pdf',             uploadedAt: day(-1) },
      { kind: 'audit log',   name: 'Audit_Logs_2024_Q1-Q3.pdf',       uploadedAt: day(-1) },
    ],
  },
  {
    id: 'aud-req-004',
    receivedAt: day(-5),
    source: 'Website',
    name: 'Sophie Laurent',
    email: 'sophie@laurent-audit.fr',
    phone: '+33 1 4555 7814',
    country: 'France',
    role: 'Lead Auditor',
    specialization: 'Environment & Energy',
    yearsOverall: '16',
    yearsAudit: '11',
    department: 'Quality',
    certifications: ['ISO 14001:2015', 'ISO 50001:2018', 'ISO 9001:2015'],
    message: 'Senior auditor with deep experience in EU energy compliance. Wants to be a Lead Auditor for the France region.',
    status: 'Under Review',
    notes: 'Reviewed by Praveen Gangarapu. Awaiting Lead Auditor sign-off.',
    formSentAt: day(-5),
    formReturnedAt: day(-3),
    uploadedDocs: [
      { kind: 'certificate', name: 'ISO_14001_Lead_2023.pdf', uploadedAt: day(-3) },
      { kind: 'certificate', name: 'ISO_50001_2022.pdf',      uploadedAt: day(-3) },
      { kind: 'experience',  name: 'CV_Sophie_Laurent.pdf',   uploadedAt: day(-3) },
    ],
    reviewedByCoordinator: { by: 'Praveen Gangarapu', at: day(-2), note: 'Credentials check out. Forward to Lead Auditor.' },
  },
  {
    id: 'aud-req-005',
    receivedAt: day(-8),
    source: 'Referral',
    name: 'Yuki Tanaka',
    email: 'y.tanaka@qms-jp.com',
    phone: '+81 3 5555 7815',
    country: 'Japan',
    role: 'Auditor',
    specialization: 'Medical Devices',
    yearsOverall: '12',
    yearsAudit: '8',
    department: 'Quality',
    certifications: ['ISO 13485:2016', 'ISO 9001:2015'],
    message: 'Referred by Emma Thompson. 8 years auditing Japanese medical device manufacturers.',
    status: 'Forwarded to Management',
    notes: 'Approved by Coordinator + Lead Auditor. Awaiting management approval.',
    formSentAt: day(-8),
    formReturnedAt: day(-6),
    uploadedDocs: [
      { kind: 'certificate', name: 'ISO_13485_Lead_2024.pdf', uploadedAt: day(-6) },
      { kind: 'experience',  name: 'CV_Yuki_Tanaka.pdf',      uploadedAt: day(-6) },
      { kind: 'audit log',   name: 'Audit_Logs_2023-2024.pdf', uploadedAt: day(-6) },
    ],
    reviewedByCoordinator: { by: 'Praveen Gangarapu', at: day(-5), note: 'Strong CV; experience in Japan medical-device QMS.' },
    reviewedByLeadAuditor: { by: 'Lead Auditor Council', at: day(-3), note: 'Approved by Lead Auditor.' },
    forwardedToManagementAt: day(-2),
  },
  {
    id: 'aud-req-006',
    receivedAt: day(-30),
    source: 'Website',
    name: 'Liam O\'Brien',
    email: 'liam.obrien@iso-australia.com.au',
    phone: '+61 2 5555 7816',
    country: 'Australia',
    role: 'Auditor',
    specialization: 'OHS / Construction',
    yearsOverall: '11',
    yearsAudit: '6',
    department: 'Safety',
    certifications: ['ISO 45001:2018', 'ISO 9001:2015'],
    message: 'OHS specialist; available to audit Australian and APAC construction clients.',
    status: 'Approved',
    notes: 'Approved by Management. Auditor profile activated.',
    formSentAt: day(-28),
    formReturnedAt: day(-26),
    uploadedDocs: [
      { kind: 'certificate', name: 'ISO_45001_Lead_2024.pdf', uploadedAt: day(-26) },
      { kind: 'experience',  name: 'CV_Liam_OBrien.pdf',      uploadedAt: day(-26) },
    ],
    reviewedByCoordinator: { by: 'Praveen Gangarapu', at: day(-24) },
    reviewedByLeadAuditor: { by: 'Emma Thompson', at: day(-20) },
    forwardedToManagementAt: day(-18),
    approvedAt: day(-12),
    approvedBy: 'Management Council',
  },
  {
    id: 'aud-req-007',
    receivedAt: day(-15),
    source: 'Website',
    name: 'Rita Costa',
    email: 'rita@costaisocert.com.br',
    phone: '+55 11 5555 7817',
    country: 'Brazil',
    role: 'Junior Auditor',
    specialization: 'Quality',
    yearsOverall: '4',
    yearsAudit: '1',
    department: 'Quality',
    certifications: ['ISO 9001:2015'],
    message: 'Recently completed ISO 9001 Lead Auditor course. Eager to start with surveillance audits.',
    status: 'Rejected',
    notes: 'Insufficient audit experience for current openings.',
    formSentAt: day(-14),
    formReturnedAt: day(-13),
    uploadedDocs: [
      { kind: 'certificate', name: 'ISO_9001_Lead_2024.pdf', uploadedAt: day(-13) },
    ],
    reviewedByCoordinator: { by: 'Praveen Gangarapu', at: day(-10), note: 'Encouraged to apply again after gaining 2 more years of audit experience.' },
    rejectedAt: day(-8),
    rejectionReason: 'Insufficient audit experience (1 year vs. 3+ required for current openings).',
  },
];

const loadRequests = (): AuditorRequest[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
    const seeded = localStorage.getItem(SEED_FLAG_KEY) === '1';
    if (!seeded) {
      const seed = buildSeed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      localStorage.setItem(SEED_FLAG_KEY, '1');
      return seed;
    }
    return [];
  } catch {
    return [];
  }
};

const saveRequests = (rows: AuditorRequest[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
};

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return iso; }
};

const relative = (iso?: string) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

/* -----------------------------------------------------------
   Page
----------------------------------------------------------- */
const AuditorRequests: React.FC = () => {
  const [rows, setRows] = useState<AuditorRequest[]>(loadRequests());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | RequestStatus>('All');
  const [viewing, setViewing] = useState<AuditorRequest | null>(null);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) setRows(loadRequests());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const persist = (next: AuditorRequest[]) => { setRows(next); saveRequests(next); };

  const counts = useMemo(() => {
    const c: Record<RequestStatus | 'Total', number> = {
      Total: rows.length, New: 0, 'Form Sent': 0, 'Form Returned': 0,
      'Under Review': 0, 'Forwarded to Management': 0, Approved: 0, Rejected: 0,
    };
    rows.forEach(r => { c[r.status]++; });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter(r => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.country.toLowerCase().includes(q) ||
        r.specialization.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.certifications.join(' ').toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  /* -------- Actions -------- */
  const setStatus = (id: string, status: RequestStatus, extra: Partial<AuditorRequest> = {}) => {
    persist(rows.map(r => r.id === id ? { ...r, status, ...extra } : r));
  };

  const handleSendForm = (r: AuditorRequest) => {
    if (!r.email) { alert('Email is required to send the application form.'); return; }
    const subject = encodeURIComponent(`Auditor Application — ${r.name}`);
    const body = encodeURIComponent([
      `Dear ${r.name},`, '',
      'Thank you for your interest in joining Qmics Certification as an auditor.',
      'Please complete the digital application form below and return it with the required documents.',
      '',
      '──────────────────────────────────────',
      '  AUDITOR APPLICATION FORM',
      '──────────────────────────────────────',
      `  Name:                 ${r.name}`,
      `  Role:                 ${r.role}`,
      `  Email:                ${r.email}`,
      `  Country:              ${r.country}`,
      `  Specialization:       ${r.specialization}`,
      `  Years overall:        ${r.yearsOverall || '—'}`,
      `  Years auditing:       ${r.yearsAudit || '—'}`,
      `  Department:           ${r.department}`,
      '',
      'Required documents:',
      '  • Certificates (ISO Lead Auditor / training)',
      '  • Experience / CV',
      '  • Recent audit logs',
      '──────────────────────────────────────',
      '', 'Reply with the completed form and attachments.',
      '', 'Best regards,', 'Audit Coordinator', 'Qmics Certification',
    ].join('\n'));
    window.open(`mailto:${r.email}?subject=${subject}&body=${body}`, '_blank');
    setStatus(r.id, 'Form Sent', { formSentAt: new Date().toISOString() });
    alert(`Application form emailed to ${r.email}.`);
  };

  const handleSubmitReview = (r: AuditorRequest) => {
    const note = window.prompt(
      `Submit Coordinator review for ${r.name}?\n\nOptional note (visible to Lead Auditor):`,
      r.reviewedByCoordinator?.note || ''
    );
    if (note === null) return;
    setStatus(r.id, 'Under Review', {
      reviewedByCoordinator: { by: 'Praveen Gangarapu', at: new Date().toISOString(), note: note || undefined },
    });
  };

  const handleForwardToManagement = (r: AuditorRequest) => {
    if (!window.confirm(`Forward ${r.name}'s application to Management for final approval?`)) return;
    setStatus(r.id, 'Forwarded to Management', {
      forwardedToManagementAt: new Date().toISOString(),
      reviewedByLeadAuditor: r.reviewedByLeadAuditor || {
        by: 'Lead Auditor Council', at: new Date().toISOString(),
        note: 'Approved for Management review.',
      },
    });
  };

  const handleApprove = (r: AuditorRequest) => {
    if (!window.confirm(`Approve ${r.name} as an auditor? This activates their profile in CertMS.`)) return;
    setStatus(r.id, 'Approved', {
      approvedAt: new Date().toISOString(),
      approvedBy: 'Management Council',
    });
    // Also create a real auditor record so they show up under Auditor Profiles
    try {
      const raw = localStorage.getItem('cms_auditors');
      const existing = raw ? JSON.parse(raw) : [];
      if (Array.isArray(existing) && !existing.some((a: any) => (a.email || '').toLowerCase() === r.email.toLowerCase())) {
        const nextId = existing.length ? Math.max(...existing.map((a: any) => a.id || 0)) + 1 : 2001;
        existing.push({
          id: nextId, name: r.name, email: r.email, phone: r.phone,
          role: r.role, specialization: r.specialization, department: r.department,
          country: r.country, certifications: r.certifications, status: 'Active',
          joinDate: new Date().toISOString().split('T')[0], skills: {}, ratings: [],
          approvalStatus: 'Approved', approvedBy: 'Management Council', approvedAt: new Date().toISOString(),
        });
        localStorage.setItem('cms_auditors', JSON.stringify(existing));
        localStorage.setItem('cms_auditors_data', JSON.stringify(existing));
        window.dispatchEvent(new Event('cms-auditors-updated'));
      }
    } catch {}
    alert(`${r.name} approved and added to Auditor Profiles.`);
  };

  const handleReject = (r: AuditorRequest) => {
    const reason = window.prompt(`Reject ${r.name}'s application?\n\nProvide a reason (visible internally):`);
    if (reason === null || !reason.trim()) return;
    setStatus(r.id, 'Rejected', {
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason.trim(),
    });
  };

  return (
    <div style={{ padding: '0 8px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 16, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#0f172a',
            display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserPlus size={26} color="#7c3aed" /> Auditor Requests
          </h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
            Auditor join requests received from the website / email. Review, send the application form,
            forward to Lead Auditor + Management for approval.
          </p>
        </div>
      </div>

      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
        color: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
        boxShadow: '0 10px 26px rgba(124,58,237,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>Auditor Onboarding Pipeline</div>
            <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>
              {counts.Total} <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.85 }}>requests in your inbox</span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              {counts.New} new · {counts['Form Sent']} form sent · {counts['Form Returned']} returned · {counts['Under Review']} in review · {counts['Forwarded to Management']} at management
            </div>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 8, marginBottom: 14,
      }}>
        <Stat label="Total" value={counts.Total} color="#0ea5e9" />
        <Stat label="New" value={counts.New} color="#1e40af" />
        <Stat label="Form Sent" value={counts['Form Sent']} color="#a16207" />
        <Stat label="Form Returned" value={counts['Form Returned']} color="#7e22ce" />
        <Stat label="Under Review" value={counts['Under Review']} color="#9a3412" />
        <Stat label="At Management" value={counts['Forwarded to Management']} color="#0e7490" />
        <Stat label="Approved" value={counts.Approved} color="#15803d" />
        <Stat label="Rejected" value={counts.Rejected} color="#b91c1c" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, color: '#94a3b8' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, country, specialization..."
            style={{ padding: '8px 12px 8px 32px', borderRadius: 8, border: '1px solid #cbd5e1', width: 320, outline: 'none', fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b' }}>
          <Filter size={14} /> Status:
        </div>
        {(['All', 'New', 'Form Sent', 'Form Returned', 'Under Review', 'Forwarded to Management', 'Approved', 'Rejected'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '6px 12px', borderRadius: 16,
              border: '1px solid ' + (statusFilter === s ? '#7c3aed' : '#cbd5e1'),
              background: statusFilter === s ? '#7c3aed' : '#fff',
              color: statusFilter === s ? '#fff' : '#475569',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >{s}</button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 12, padding: 40, textAlign: 'center', color: '#64748b' }}>
          No auditor requests match the current filters.
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={th}>Auditor</th>
                <th style={th}>Country / Role</th>
                <th style={th}>Specialization</th>
                <th style={th}>Experience</th>
                <th style={th}>Received</th>
                <th style={th}>Status</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      <Mail size={10} style={{ verticalAlign: '-1px' }} /> {r.email}
                      {r.phone && <> · <Phone size={10} style={{ verticalAlign: '-1px' }} /> {r.phone}</>}
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      <Globe size={11} /> {r.country}
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{r.role}</div>
                  </td>
                  <td style={td}>
                    <div style={{ fontSize: 12 }}>{r.specialization}</div>
                    {r.certifications.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {r.certifications.slice(0, 2).map(c => (
                          <span key={c} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#eef2ff', color: '#4338ca' }}>{c}</span>
                        ))}
                        {r.certifications.length > 2 && <span style={{ fontSize: 10, color: '#64748b' }}>+{r.certifications.length - 2}</span>}
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    <div style={{ fontSize: 12 }}>{r.yearsOverall} yrs overall</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{r.yearsAudit} yrs auditing</div>
                  </td>
                  <td style={td}>
                    <div style={{ fontSize: 12 }}>{formatDate(r.receivedAt)}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{relative(r.receivedAt)}</div>
                  </td>
                  <td style={td}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                      background: STATUS_COLORS[r.status].bg, color: STATUS_COLORS[r.status].fg, whiteSpace: 'nowrap',
                    }}>{r.status}</span>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <IconBtn title="View details" onClick={() => setViewing(r)}><Eye size={14} /></IconBtn>
                      {r.status === 'New' && (
                        <IconBtn title="Send application form" color="#2563eb" onClick={() => handleSendForm(r)}><Send size={14} /></IconBtn>
                      )}
                      {(r.status === 'Form Returned' || r.status === 'Form Sent') && (
                        <IconBtn title="Submit Coordinator review" color="#9a3412" onClick={() => handleSubmitReview(r)}><FileText size={14} /></IconBtn>
                      )}
                      {r.status === 'Under Review' && (
                        <IconBtn title="Forward to Management" color="#0e7490" onClick={() => handleForwardToManagement(r)}><ArrowRight size={14} /></IconBtn>
                      )}
                      {r.status === 'Forwarded to Management' && (
                        <IconBtn title="Approve (Management)" color="#15803d" onClick={() => handleApprove(r)}><CheckCircle2 size={14} /></IconBtn>
                      )}
                      {(r.status !== 'Approved' && r.status !== 'Rejected') && (
                        <IconBtn title="Reject" color="#b91c1c" onClick={() => handleReject(r)}><XCircle size={14} /></IconBtn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View modal */}
      {viewing && (
        <Modal title={`${viewing.name} — Auditor Request`} onClose={() => setViewing(null)} width={680}>
          <Row icon={<Calendar size={13} />} label="Received"      value={`${formatDate(viewing.receivedAt)} · ${relative(viewing.receivedAt)}`} />
          <Row                                         label="Source"        value={viewing.source} />
          <Row                                         label="Status"        value={viewing.status} />
          <hr style={{ border: 'none', borderTop: '1px dashed #e2e8f0', margin: '10px 0' }} />
          <Row icon={<Mail size={13} />}     label="Email"   value={viewing.email} />
          <Row icon={<Phone size={13} />}    label="Phone"   value={viewing.phone || '—'} />
          <Row icon={<Globe size={13} />}    label="Country" value={viewing.country} />
          <Row icon={<Briefcase size={13} />} label="Role"   value={viewing.role} />
          <Row label="Specialization" value={viewing.specialization} />
          <Row label="Experience"     value={`${viewing.yearsOverall} yrs overall · ${viewing.yearsAudit} yrs auditing`} />
          <Row label="Department"     value={viewing.department} />
          <Row label="Certifications" value={viewing.certifications.join(', ') || '—'} />
          {viewing.message && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Message</div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 10, borderRadius: 8, marginTop: 4, fontSize: 13, whiteSpace: 'pre-wrap' }}>{viewing.message}</div>
            </div>
          )}
          {viewing.uploadedDocs && viewing.uploadedDocs.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Uploaded documents</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#334155' }}>
                {viewing.uploadedDocs.map((d, i) => (
                  <li key={i}>📎 <strong>{d.name}</strong> <span style={{ color: '#64748b' }}>({d.kind})</span></li>
                ))}
              </ul>
            </div>
          )}
          {viewing.reviewedByCoordinator && (
            <div style={{ marginTop: 12, background: '#fffbeb', border: '1px solid #fde68a', padding: 10, borderRadius: 8, fontSize: 12 }}>
              <strong>Coordinator review</strong> — {viewing.reviewedByCoordinator.by} on {formatDate(viewing.reviewedByCoordinator.at)}
              {viewing.reviewedByCoordinator.note && <div style={{ marginTop: 4, color: '#475569' }}>{viewing.reviewedByCoordinator.note}</div>}
            </div>
          )}
          {viewing.reviewedByLeadAuditor && (
            <div style={{ marginTop: 8, background: '#eff6ff', border: '1px solid #bfdbfe', padding: 10, borderRadius: 8, fontSize: 12 }}>
              <strong>Lead Auditor review</strong> — {viewing.reviewedByLeadAuditor.by} on {formatDate(viewing.reviewedByLeadAuditor.at)}
              {viewing.reviewedByLeadAuditor.note && <div style={{ marginTop: 4, color: '#475569' }}>{viewing.reviewedByLeadAuditor.note}</div>}
            </div>
          )}
          {viewing.approvedAt && (
            <div style={{ marginTop: 8, background: '#dcfce7', color: '#15803d', padding: 10, borderRadius: 8, fontSize: 12 }}>
              <strong>Approved</strong> by {viewing.approvedBy} on {formatDate(viewing.approvedAt)}
            </div>
          )}
          {viewing.rejectionReason && (
            <div style={{ marginTop: 8, background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 8, fontSize: 12 }}>
              <strong>Rejected</strong> on {formatDate(viewing.rejectedAt)} — {viewing.rejectionReason}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

/* -------- Helpers -------- */
const th: React.CSSProperties = { padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 };
const td: React.CSSProperties = { padding: '12px', verticalAlign: 'top' };

const Stat: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#fff', borderRadius: 10, padding: 10, borderLeft: `4px solid ${color}`, boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
  </div>
);

const Row: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8, padding: '4px 0', fontSize: 13, alignItems: 'center' }}>
    <span style={{ color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{icon} {label}</span>
    <span style={{ color: '#0f172a', fontWeight: 500 }}>{value}</span>
  </div>
);

const IconBtn: React.FC<{ title: string; onClick: () => void; color?: string; children: React.ReactNode }> = ({ title, onClick, color = '#475569', children }) => (
  <button onClick={onClick} title={title} aria-label={title}
    style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color, cursor: 'pointer' }}>
    {children}
  </button>
);

const Modal: React.FC<{ title: string; onClose: () => void; width?: number; children: React.ReactNode }> = ({ title, onClose, width = 540, children }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 22, width: `min(${width}px, 96vw)`, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 17, color: '#0f172a' }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
      </div>
      {children}
    </div>
  </div>
);

export default AuditorRequests;
