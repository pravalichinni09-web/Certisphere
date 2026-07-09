import React, { useEffect, useMemo, useState } from 'react';
import {
  MailOpen,
  Plus,
  Search,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  Edit2,
  Trash2,
  X,
  Filter,
  Tag,
  Briefcase,
  Send,
  FileText,
  Inbox,
  Copy,
  Sparkles,
} from 'lucide-react';
import AIPanel from '../../components/AIPanel';
import {
  triageEnquiry,
  draftEnquiryReply,
  polishDraftWithClaude,
  isClaudeConfigured,
} from '../../ai/coordinatorInsights';

/* -----------------------------------------------------------
   Types & storage
----------------------------------------------------------- */

type EnquiryStatus =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Converted'
  | 'Rejected';

type EnquirySource = 'Website' | 'Referral' | 'Email' | 'Phone' | 'Trade Show' | 'Other';

interface Enquiry {
  id: string;
  receivedAt: string; // ISO
  source: EnquirySource;
  company: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  country: string;
  industry: string;
  employees: string;
  standards: string[];
  message: string;
  status: EnquiryStatus;
  notes: string;
  convertedClientId?: string;
  convertedAt?: string;
}

const STORAGE_KEY = 'cms_client_enquiries_v1';
const REGISTRATION_KEY = 'cms_client_registrations';
const DISPATCH_KEY = 'cms_application_dispatch_v7';

const STANDARDS_OPTIONS = [
  'ISO 9001:2015',
  'ISO 14001:2015',
  'ISO 45001:2018',
  'ISO 27001:2022',
  'ISO 22000:2018',
  'ISO 13485:2016',
  'ISO 50001:2018',
  'ISO 42001:2023',
];

const STATUS_COLORS: Record<EnquiryStatus, { bg: string; fg: string }> = {
  New: { bg: '#dbeafe', fg: '#1e40af' },
  Contacted: { bg: '#fef3c7', fg: '#a16207' },
  Qualified: { bg: '#e9d5ff', fg: '#7e22ce' },
  Converted: { bg: '#dcfce7', fg: '#15803d' },
  Rejected: { bg: '#fee2e2', fg: '#b91c1c' },
};

const blankEnquiry = (): Enquiry => ({
  id: `enq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  receivedAt: new Date().toISOString(),
  source: 'Website',
  company: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  website: '',
  country: '',
  industry: '',
  employees: '',
  standards: [],
  message: '',
  status: 'New',
  notes: '',
});

// Seed enquiries used when localStorage is empty so the page demonstrates the workflow
// at a glance. Once the user adds, edits, or deletes anything, their data is persisted
// and the seed is no longer applied.
const SEED_VERSION_KEY = 'cms_client_enquiries_seeded_v1';

const buildSeedEnquiries = (): Enquiry[] => {
  const day = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };
  return [
    {
      id: 'enq-seed-001',
      receivedAt: day(0),
      source: 'Website',
      company: 'Acme Innovations Pvt Ltd',
      contactName: 'Priya Sharma',
      contactEmail: 'priya.sharma@acme-innovations.in',
      contactPhone: '+91 98765 43210',
      website: 'https://acme-innovations.in',
      country: 'India',
      industry: 'Software / IT',
      employees: '120',
      standards: ['ISO 27001:2022', 'ISO 9001:2015'],
      message:
        "We are preparing for an enterprise client RFP that mandates ISO 27001. " +
        "Looking for a Stage 1 readiness assessment in the next 6-8 weeks. " +
        "We currently have ~120 employees across two offices (Hyderabad, Bengaluru).",
      status: 'New',
      notes: 'High-priority — RFP deadline tight.',
    },
    {
      id: 'enq-seed-002',
      receivedAt: day(1),
      source: 'Website',
      company: 'BlueWave Logistics',
      contactName: 'Rahul Mehta',
      contactEmail: 'rahul@bluewave-logistics.com',
      contactPhone: '+91 90220 11122',
      website: 'https://bluewave-logistics.com',
      country: 'India',
      industry: 'Logistics',
      employees: '45',
      standards: ['ISO 9001:2015'],
      message:
        'Hello, we run a regional logistics company and want to get certified ' +
        "for ISO 9001. Please share the cost and timeline.",
      status: 'Contacted',
      notes: 'First call done. Quote sent on day 1.',
    },
    {
      id: 'enq-seed-003',
      receivedAt: day(3),
      source: 'Referral',
      company: 'GreenGrove Foods',
      contactName: 'Anita Iyer',
      contactEmail: 'anita.iyer@greengrove.in',
      contactPhone: '+91 99883 55667',
      website: 'https://greengrove.in',
      country: 'India',
      industry: 'Food & Beverage',
      employees: '210',
      standards: ['ISO 22000:2018', 'ISO 14001:2015'],
      message:
        'Referred by Mr. Verma (former client). We are scaling export operations and ' +
        'need ISO 22000 alongside our existing FSSAI compliance.',
      status: 'Qualified',
      notes: 'Pre-audit walkthrough scheduled for next week.',
    },
    {
      id: 'enq-seed-004',
      receivedAt: day(5),
      source: 'Email',
      company: 'Helix Diagnostics',
      contactName: 'Dr. Sandeep Rao',
      contactEmail: 'srao@helixdiagnostics.com',
      contactPhone: '+91 91777 33445',
      website: 'https://helixdiagnostics.com',
      country: 'India',
      industry: 'Healthcare',
      employees: '85',
      standards: ['ISO 13485:2016'],
      message:
        'Pathology lab chain looking to expand to medical-device distribution. ' +
        'Need an ISO 13485 certification proposal.',
      status: 'Contacted',
      notes: '',
    },
    {
      id: 'enq-seed-005',
      receivedAt: day(7),
      source: 'Website',
      company: 'Solaris Power Solutions',
      contactName: 'Vikram Joshi',
      contactEmail: 'vikram@solarispower.com',
      contactPhone: '+91 98112 99887',
      website: 'https://solarispower.com',
      country: 'India',
      industry: 'Energy',
      employees: '60',
      standards: ['ISO 50001:2018', 'ISO 14001:2015'],
      message:
        'We design rooftop solar systems and want both ISO 50001 (energy) and ISO 14001 ' +
        '(environment). Tender requirement.',
      status: 'Converted',
      notes: 'Already onboarded as a registered client.',
      convertedClientId: 'client-seed-001',
      convertedAt: day(2),
    },
    {
      id: 'enq-seed-006',
      receivedAt: day(11),
      source: 'Phone',
      company: 'NorthStar Constructions',
      contactName: 'Imran Khan',
      contactEmail: 'imran@northstar-cons.com',
      contactPhone: '+91 97676 12321',
      website: '',
      country: 'India',
      industry: 'Construction',
      employees: '320',
      standards: ['ISO 45001:2018'],
      message:
        'Public-sector tender requires ISO 45001 (occupational health & safety). ' +
        'Need to be certified within 3 months. Sites across Telangana and AP.',
      status: 'Rejected',
      notes: 'Timeline too aggressive — declined politely. Suggested 5 months minimum.',
    },
    {
      id: 'enq-seed-007',
      receivedAt: day(14),
      source: 'Website',
      company: 'Lumen AI Labs',
      contactName: 'Sneha Patel',
      contactEmail: 'sneha@lumenai.io',
      contactPhone: '+91 87878 22112',
      website: 'https://lumenai.io',
      country: 'India',
      industry: 'Software / IT',
      employees: '28',
      standards: ['ISO 42001:2023', 'ISO 27001:2022'],
      message:
        'AI startup building enterprise GenAI products. Customers asking about AI ' +
        'governance — interested in ISO 42001 and 27001 together.',
      status: 'New',
      notes: '',
    },
  ];
};

const loadEnquiries = (): Enquiry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
    // Seed only once: if the user has cleared the list intentionally, don't re-seed.
    const alreadySeeded = localStorage.getItem(SEED_VERSION_KEY) === '1';
    if (!alreadySeeded) {
      const seed = buildSeedEnquiries();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      localStorage.setItem(SEED_VERSION_KEY, '1');
      return seed;
    }
    return [];
  } catch {
    return [];
  }
};

const saveEnquiries = (rows: Enquiry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
};

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
};

/* -----------------------------------------------------------
   Page
----------------------------------------------------------- */

/* -----------------------------------------------------------
   AI — Enquiry Auto-Triage panel (Feature 4)
----------------------------------------------------------- */

const EnquiryTriagePanel: React.FC<{ enquiries: Enquiry[] }> = ({ enquiries }) => {
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [polishing, setPolishing] = useState(false);
  const [copied, setCopied] = useState(false);

  const triaged = useMemo(
    () =>
      enquiries
        .filter((e) => e.status !== 'Converted' && e.status !== 'Rejected')
        .map((e) => ({ enquiry: e, t: triageEnquiry(e) }))
        .sort((a, b) => b.t.winScore - a.t.winScore),
    [enquiries]
  );

  const openDraft = (e: Enquiry) => {
    setDraftFor(e.id);
    setDraftText(draftEnquiryReply(e));
    setCopied(false);
  };

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const polish = async () => {
    setPolishing(true);
    const better = await polishDraftWithClaude(draftText, 'enquiry qualification reply');
    if (better) setDraftText(better);
    setPolishing(false);
  };

  return (
    <AIPanel
      title="Enquiry Auto-Triage"
      subtitle="Standards detected, urgency and win-likelihood for open enquiries — with one-click reply drafts"
    >
      {triaged.length === 0 ? (
        <p className="ai-panel-note">No open enquiries to triage.</p>
      ) : (
        <ul className="ai-insight-list">
          {triaged.map(({ enquiry, t }) => (
            <li key={t.id}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <strong style={{ fontSize: 13, color: '#0f172a' }}>{t.company}</strong>
                <span className={'ai-chip ' + (t.winLevel === 'High' ? 'low' : t.winLevel === 'Med' ? 'med' : 'high')}>
                  Win {t.winScore}% · {t.winLevel}
                </span>
                <span className={'ai-chip ' + (t.urgency === 'High' ? 'high' : t.urgency === 'Med' ? 'med' : 'info')}>
                  Urgency {t.urgency}
                </span>
                {t.detectedStandards.slice(0, 3).map((s) => (
                  <span key={s} className="ai-chip info">{s.split(':')[0]}</span>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                {t.urgencyReasons[0]} · {t.winReasons.slice(0, 2).join(' · ')}
              </div>
              <button type="button" className="ai-action-btn" onClick={() => openDraft(enquiry)}>
                <Sparkles size={12} /> Draft reply
              </button>
              {draftFor === enquiry.id && (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    value={draftText}
                    onChange={(ev) => setDraftText(ev.target.value)}
                    rows={12}
                    style={{ width: '100%', fontSize: 12, fontFamily: 'inherit', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, boxSizing: 'border-box', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="ai-action-btn" onClick={copyDraft}>
                      <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
                    </button>
                    {isClaudeConfigured() && (
                      <button type="button" className="ai-action-btn" onClick={polish} disabled={polishing}>
                        <Sparkles size={12} /> {polishing ? 'Polishing…' : 'Enhance with Claude'}
                      </button>
                    )}
                    <button type="button" className="ai-action-btn" onClick={() => setDraftFor(null)}>
                      Close
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="ai-panel-note">Heuristic triage on live enquiry data — works without an API key.</p>
    </AIPanel>
  );
};

const ClientEnquiry: React.FC = () => {
  const [rows, setRows] = useState<Enquiry[]>(loadEnquiries());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Enquiry | null>(null);
  const [form, setForm] = useState<Enquiry>(blankEnquiry());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | EnquiryStatus>('All');
  const [viewing, setViewing] = useState<Enquiry | null>(null);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) setRows(loadEnquiries());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const persist = (next: Enquiry[]) => {
    setRows(next);
    saveEnquiries(next);
  };

  const startNew = () => {
    setEditing(null);
    setForm(blankEnquiry());
    setShowForm(true);
  };

  const startEdit = (row: Enquiry) => {
    setEditing(row);
    setForm({ ...row });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const setF = <K extends keyof Enquiry>(k: K, v: Enquiry[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const toggleStandard = (s: string) => {
    setForm((prev) => ({
      ...prev,
      standards: prev.standards.includes(s)
        ? prev.standards.filter((x) => x !== s)
        : [...prev.standards, s],
    }));
  };

  const suggestStandards = () => {
    const text = `${form.industry} ${form.message}`.toLowerCase();
    const choices = new Set<string>();

    if (/(quality|management|customer|service|qms|process)/i.test(text)) {
      choices.add('ISO 9001:2015');
    }
    if (/(environment|sustainab|green|eco|emission|waste|environmental)/i.test(text)) {
      choices.add('ISO 14001:2015');
    }
    if (/(safety|ohs|health and safety|workplace|accident|risk assessment)/i.test(text)) {
      choices.add('ISO 45001:2018');
    }
    if (/(security|cyber|data|privacy|information|it|network)/i.test(text)) {
      choices.add('ISO 27001:2022');
    }
    if (/(food|fssai|restaurant|beverage|catering|nutrition|kitchen)/i.test(text)) {
      choices.add('ISO 22000:2018');
    }
    if (/(medical|pharma|healthcare|lab|device|clinical|diagnostic)/i.test(text)) {
      choices.add('ISO 13485:2016');
    }
    if (/(energy|power|solar|efficiency|carbon|fuel|electricity)/i.test(text)) {
      choices.add('ISO 50001:2018');
    }
    if (/(ai|artificial intelligence|machine learning|ml|genai|ai startup|algorithm)/i.test(text)) {
      choices.add('ISO 42001:2023');
    }

    if (choices.size === 0) {
      choices.add('ISO 9001:2015');
    }

    setForm((prev) => ({
      ...prev,
      standards: Array.from(choices),
    }));
  };

  const handleSave = () => {
    if (!form.company.trim()) {
      alert('Company name is required.');
      return;
    }
    if (!form.contactEmail.trim() && !form.contactPhone.trim()) {
      alert('Add at least an email or a phone number for the contact.');
      return;
    }
    if (editing) {
      persist(rows.map((r) => (r.id === editing.id ? form : r)));
    } else {
      persist([form, ...rows]);
    }
    closeForm();
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this enquiry? This cannot be undone.')) return;
    persist(rows.filter((r) => r.id !== id));
  };

  const setStatus = (id: string, status: EnquiryStatus) => {
    persist(rows.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  /* ----- Send Digital Form: emails a structured application form to the client
     AND creates a Sent Application record so the workflow continues. ----- */
  const handleSendDigitalForm = (row: Enquiry) => {
    const to = row.contactEmail.trim();
    if (!to) {
      alert('This enquiry has no email — add one before sending the digital form.');
      return;
    }
    // 1) Open mailto with the structured digital form body
    const subject = encodeURIComponent(
      `Application for Certification — ${row.company}`
    );
    const body = encodeURIComponent(
      [
        `Dear ${row.contactName || 'Client'},`,
        '',
        `Thank you for your enquiry on ${formatDate(row.receivedAt)} regarding ${row.company}.`,
        'Please complete the digital application form below and return it to us. You can also',
        'fill this form directly in your Auditee portal under "Pending Applications".',
        '',
        '────────────────────────────────────────────────',
        '  APPLICATION FOR CERTIFICATION',
        '────────────────────────────────────────────────',
        `  Client Name:        ${row.contactName}`,
        `  Organisation:       ${row.company}`,
        `  Contact Number:     ${row.contactPhone || '—'}`,
        `  Email:              ${row.contactEmail}`,
        `  Enquiry Date:       ${formatDate(row.receivedAt)}`,
        `  Application Status: Pending`,
        `  Application Attached: digital form (fill in your Auditee portal)`,
        '────────────────────────────────────────────────',
        '',
        'Reply with your filled details or submit through the portal.',
        '',
        'Best regards,',
        'Audit Coordinator',
        'Qmics Certification',
      ].join('\n')
    );
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, '_blank');

    // 2) Create a Sent Application record so it appears in the Sent tab
    try {
      const raw = localStorage.getItem(DISPATCH_KEY);
      const existing: any[] = raw ? JSON.parse(raw) : [];
      const arr = Array.isArray(existing) ? existing : [];
      const dupExists = arr.some(
        (d: any) =>
          d.sourceEnquiryId === row.id ||
          (d.email === row.contactEmail && d.organization === row.company)
      );
      if (!dupExists) {
        const dispatch = {
          id: Date.now(),
          clientName: row.contactName || row.company,
          organization: row.company,
          mobile: row.contactPhone,
          contactName: row.contactName,
          applicationType: 'Initial Audit',
          standard: row.standards[0] || '',
          email: row.contactEmail,
          dispatchedDate: new Date().toISOString().split('T')[0],
          status: 'Sent',
          sourceEnquiryId: row.id,
          sentAt: new Date().toISOString(),
          link: 'Digital Application Form',
        };
        const next = [dispatch, ...arr];
        localStorage.setItem(DISPATCH_KEY, JSON.stringify(next));
      }
    } catch {
      /* ignore */
    }

    // 3) Flip enquiry status to "Contacted" (if still New) and add a note
    persist(
      rows.map((r) =>
        r.id === row.id
          ? {
              ...r,
              status: r.status === 'New' ? 'Contacted' : r.status,
              notes: (r.notes ? r.notes + ' · ' : '') +
                'Digital application form sent on ' +
                new Date().toLocaleDateString(),
            }
          : r
      )
    );
    alert(
      `Digital application form emailed to ${to}.\n\n` +
      `A Sent Application record has been created. The client will see the form in their Pending Applications inbox.`
    );
  };

  const handleConvert = (row: Enquiry) => {
    if (
      !window.confirm(
        `Convert this enquiry into a Client Registration?\n\n${row.company} will be added to the registrations list with the captured details.`
      )
    ) {
      return;
    }
    // Seed Client Registration
    let regs: any[] = [];
    try {
      const raw = localStorage.getItem(REGISTRATION_KEY);
      if (raw) regs = JSON.parse(raw) || [];
    } catch {
      /* ignore */
    }
    const newClientId = `client-${Date.now()}`;
    const newReg = {
      id: newClientId,
      organizationName: row.company,
      contactPerson: row.contactName,
      email: row.contactEmail,
      phone: row.contactPhone,
      website: row.website,
      country: row.country,
      industry: row.industry,
      employees: row.employees,
      standard: row.standards[0] || '',
      standards: row.standards,
      status: 'Pending',
      registrationDate: new Date().toISOString(),
      source: `Enquiry · ${row.source}`,
      sourceEnquiryId: row.id,
      notes: row.message,
    };
    try {
      localStorage.setItem(
        REGISTRATION_KEY,
        JSON.stringify([newReg, ...regs])
      );
    } catch {
      /* ignore */
    }
    persist(
      rows.map((r) =>
        r.id === row.id
          ? {
              ...r,
              status: 'Converted' as const,
              convertedClientId: newClientId,
              convertedAt: new Date().toISOString(),
            }
          : r
      )
    );
    alert(`${row.company} has been added to Client Registration as Pending.`);
  };

  const counts = useMemo(() => {
    const c: Record<EnquiryStatus | 'Total', number> = {
      Total: rows.length,
      New: 0,
      Contacted: 0,
      Qualified: 0,
      Converted: 0,
      Rejected: 0,
    };
    rows.forEach((r) => {
      c[r.status]++;
    });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.company.toLowerCase().includes(q) ||
        r.contactName.toLowerCase().includes(q) ||
        r.contactEmail.toLowerCase().includes(q) ||
        r.contactPhone.toLowerCase().includes(q) ||
        r.country.toLowerCase().includes(q) ||
        r.industry.toLowerCase().includes(q) ||
        r.standards.join(' ').toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  return (
    <div style={{ padding: '0 8px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 18,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <MailOpen size={26} color="#2563eb" /> Client Enquiry
          </h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
            Capture and triage enquiries received from the website, email, phone, and referrals before they become formal registrations.
          </p>
        </div>
        <button
          onClick={startNew}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 16px',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 1px 3px rgba(15,23,42,0.1)',
          }}
        >
          <Plus size={16} /> Our enquiry
        </button>
      </div>

      {/* AI: Enquiry auto-triage */}
      <EnquiryTriagePanel enquiries={rows} />

      {/* Certification Requests banner — emphasises the inbox count */}
      <div
        style={{
          background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
          color: '#fff',
          borderRadius: 14,
          padding: '14px 18px',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
          boxShadow: '0 10px 26px rgba(37,99,235,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >
            <Inbox size={22} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>
              Certification Requests
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>
              {counts.Total} <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.85 }}>
                {counts.Total === 1 ? 'enquiry' : 'enquiries'} in your inbox
              </span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              {counts.New > 0
                ? `${counts.New} new · ${counts.Contacted} contacted · ${counts.Qualified} qualified`
                : 'All caught up — no new enquiries waiting.'}
            </div>
          </div>
        </div>
        {counts.New > 0 && (
          <button
            onClick={() => setStatusFilter('New')}
            style={{
              padding: '8px 16px',
              background: '#fff',
              color: '#2563eb',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
            }}
          >
            <FileText size={14} /> Review {counts.New} new
          </button>
        )}
      </div>

      {/* Stat row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10,
          marginBottom: 18,
        }}
      >
        <Stat label="Total" value={counts.Total} color="#0ea5e9" />
        <Stat label="New" value={counts.New} color="#1e40af" />
        <Stat label="Contacted" value={counts.Contacted} color="#a16207" />
        <Stat label="Qualified" value={counts.Qualified} color="#7e22ce" />
        <Stat label="Converted" value={counts.Converted} color="#15803d" />
        <Stat label="Rejected" value={counts.Rejected} color="#b91c1c" />
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, color: '#94a3b8' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, contact, email, country..."
            style={{
              padding: '8px 12px 8px 32px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              width: 320,
              outline: 'none',
              fontSize: 13,
            }}
          />
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b' }}>
          <Filter size={14} /> Status:
        </div>
        {(['All', 'New', 'Contacted', 'Qualified', 'Converted', 'Rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '6px 12px',
              borderRadius: 16,
              border: '1px solid ' + (statusFilter === s ? '#2563eb' : '#cbd5e1'),
              background: statusFilter === s ? '#2563eb' : '#fff',
              color: statusFilter === s ? '#fff' : '#475569',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div
          style={{
            background: '#fff',
            border: '1px dashed #cbd5e1',
            borderRadius: 12,
            padding: 40,
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          {rows.length === 0 ? (
            <>
              <MailOpen size={28} style={{ color: '#94a3b8', marginBottom: 8 }} />
              <p style={{ margin: 0 }}>No enquiries yet.</p>
              <p style={{ margin: '4px 0 12px', fontSize: 12 }}>
                Capture website enquiries here. They flow into Client Registration once you convert them.
              </p>
              <button
                onClick={startNew}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Add the first enquiry
              </button>
            </>
          ) : (
            <p style={{ margin: 0 }}>
              No enquiries match your filters. Try clearing search or status.
            </p>
          )}
        </div>
      ) : (
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={th}>Company</th>
                <th style={th}>Contact</th>
                <th style={th}>Standards</th>
                <th style={th}>Status</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderTop: '1px solid #f1f5f9' }}
                >
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.company}</div>
                    {r.industry && (
                      <div style={{ fontSize: 11, color: '#64748b' }}>{r.industry}</div>
                    )}
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 500 }}>{r.contactName || '—'}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {r.contactEmail && (
                        <span>
                          <Mail size={10} style={{ verticalAlign: '-1px' }} /> {r.contactEmail}
                        </span>
                      )}
                      {r.contactEmail && r.contactPhone && ' · '}
                      {r.contactPhone && (
                        <span>
                          <Phone size={10} style={{ verticalAlign: '-1px' }} /> {r.contactPhone}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={td}>
                    {r.standards.length === 0 ? (
                      <span style={{ color: '#94a3b8' }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {r.standards.slice(0, 2).map((s) => (
                          <span
                            key={s}
                            style={{
                              fontSize: 11,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: '#eef2ff',
                              color: '#4338ca',
                            }}
                          >
                            {s.replace(/:\d+$/, '')}
                          </span>
                        ))}
                        {r.standards.length > 2 && (
                          <span style={{ fontSize: 11, color: '#64748b' }}>
                            +{r.standards.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    <select
                      value={r.status}
                      onChange={(e) => setStatus(r.id, e.target.value as EnquiryStatus)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 12,
                        border: 'none',
                        background: STATUS_COLORS[r.status].bg,
                        color: STATUS_COLORS[r.status].fg,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Converted">Converted</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <IconBtn title="View details" onClick={() => setViewing(r)}>
                        <MessageSquare size={14} />
                      </IconBtn>
                      {r.status !== 'Converted' && r.contactEmail && (
                        <IconBtn
                          title="Send digital application form to this client"
                          onClick={() => handleSendDigitalForm(r)}
                          color="#2563eb"
                        >
                          <Send size={14} />
                        </IconBtn>
                      )}
                      {r.status !== 'Converted' && (
                        <IconBtn
                          title="Convert to client registration"
                          onClick={() => handleConvert(r)}
                          color="#15803d"
                        >
                          <ArrowRight size={14} />
                        </IconBtn>
                      )}
                      <IconBtn title="Edit" onClick={() => startEdit(r)}>
                        <Edit2 size={14} />
                      </IconBtn>
                      <IconBtn title="Delete" onClick={() => handleDelete(r.id)} color="#b91c1c">
                        <Trash2 size={14} />
                      </IconBtn>
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
        <Modal title={`Enquiry — ${viewing.company}`} onClose={() => setViewing(null)}>
          <ViewRow label="Status" value={viewing.status} />
          <hr style={{ border: 'none', borderTop: '1px dashed #e2e8f0', margin: '12px 0' }} />
          <ViewRow label="Company" value={viewing.company} icon={<Building2 size={13} />} />
          <ViewRow label="Industry" value={viewing.industry || '—'} icon={<Briefcase size={13} />} />
          <ViewRow label="Country" value={viewing.country || '—'} icon={<Globe size={13} />} />
          <ViewRow label="Website" value={viewing.website || '—'} />
          <hr style={{ border: 'none', borderTop: '1px dashed #e2e8f0', margin: '12px 0' }} />
          <ViewRow label="Contact" value={viewing.contactName || '—'} icon={<User size={13} />} />
          <ViewRow label="Email" value={viewing.contactEmail || '—'} icon={<Mail size={13} />} />
          <ViewRow label="Phone" value={viewing.contactPhone || '—'} icon={<Phone size={13} />} />
          <hr style={{ border: 'none', borderTop: '1px dashed #e2e8f0', margin: '12px 0' }} />
          <ViewRow
            label="Certification — What we help u"
            value={viewing.standards.length ? viewing.standards.join(', ') : '—'}
            icon={<Tag size={13} />}
          />
          {viewing.message && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Message
              </div>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: 10,
                  borderRadius: 8,
                  marginTop: 4,
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {viewing.message}
              </div>
            </div>
          )}

          {viewing.status === 'Converted' && viewing.convertedAt && (
            <div
              style={{
                marginTop: 12,
                background: '#dcfce7',
                color: '#15803d',
                padding: 10,
                borderRadius: 8,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <CheckCircle2 size={14} /> Converted to client registration on {formatDate(viewing.convertedAt)}
            </div>
          )}
        </Modal>
      )}

      {/* Form modal */}
      {showForm && (
        <Modal
          title={editing ? 'Edit Enquiry' : 'New Client Enquiry'}
          onClose={closeForm}
          width={760}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Company name *" full>
              <input
                value={form.company}
                onChange={(e) => setF('company', e.target.value)}
                style={inp}
                placeholder="Acme Corporation"
              />
            </Field>
            <Field label="Enter industry name">
              <input
                value={form.industry}
                onChange={(e) => setF('industry', e.target.value)}
                style={inp}
                placeholder="Manufacturing, Software, Healthcare..."
              />
            </Field>
            <Field label="Country / Region">
              <input
                value={form.country}
                onChange={(e) => setF('country', e.target.value)}
                style={inp}
                placeholder="India"
              />
            </Field>
            <Field label="Website">
              <input
                value={form.website}
                onChange={(e) => setF('website', e.target.value)}
                style={inp}
                placeholder="https://acme.example"
              />
            </Field>
            <Field label="Contact Name">
              <input
                value={form.contactName}
                onChange={(e) => setF('contactName', e.target.value)}
                style={inp}
                placeholder="Jane Doe"
              />
            </Field>
            <Field label="Contact Email">
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setF('contactEmail', e.target.value)}
                style={inp}
                placeholder="jane@acme.example"
              />
            </Field>
            <Field label="Contact Phone">
              <input
                value={form.contactPhone}
                onChange={(e) => setF('contactPhone', e.target.value)}
                style={inp}
                placeholder="+91 90000 00000"
              />
            </Field>
            <Field label="Certification — What we help u" full>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {STANDARDS_OPTIONS.map((s) => {
                  const on = form.standards.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStandard(s)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 14,
                        border: '1px solid ' + (on ? '#4338ca' : '#cbd5e1'),
                        background: on ? '#eef2ff' : '#fff',
                        color: on ? '#4338ca' : '#475569',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => suggestStandards()}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #4338ca',
                  background: '#fff',
                  color: '#4338ca',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                AI suggest standards
              </button>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                Use AI to choose the best standards for this enquiry.
              </div>
            </Field>
            <Field label="Message / requirements" full>
              <textarea
                value={form.message}
                onChange={(e) => setF('message', e.target.value)}
                rows={3}
                placeholder="What did the prospect tell us? Paste the website form or email body here."
                style={{ ...inp, minHeight: 70, fontFamily: 'inherit' }}
              />
            </Field>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 16,
              borderTop: '1px solid #e2e8f0',
              paddingTop: 14,
            }}
          >
            <button
              onClick={closeForm}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <CheckCircle2 size={14} /> {editing ? 'Submit' : 'Add'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

/* -----------------------------------------------------------
   Sub-components / styles
----------------------------------------------------------- */

const th: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 11,
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const td: React.CSSProperties = {
  padding: '12px 14px',
  verticalAlign: 'top',
};

const inp: React.CSSProperties = {
  width: '100%',
  padding: 8,
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const Stat: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div
    style={{
      background: '#fff',
      borderRadius: 10,
      padding: 12,
      borderLeft: `4px solid ${color}`,
      boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
    }}
  >
    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
      {label}
    </div>
    <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
      {value}
    </div>
  </div>
);

const Field: React.FC<{
  label: string;
  full?: boolean;
  children: React.ReactNode;
}> = ({ label, full, children }) => (
  <label
    style={{
      gridColumn: full ? '1 / -1' : 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      fontSize: 12,
      fontWeight: 600,
      color: '#334155',
    }}
  >
    {label}
    {children}
  </label>
);

const ViewRow: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({
  label,
  value,
  icon,
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '160px 1fr',
      gap: 8,
      padding: '4px 0',
      fontSize: 13,
      alignItems: 'center',
    }}
  >
    <span style={{ color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {icon} {label}
    </span>
    <span style={{ color: '#0f172a', fontWeight: 500 }}>{value}</span>
  </div>
);

const IconBtn: React.FC<{
  title: string;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}> = ({ title, onClick, color = '#475569', children }) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    style={{
      width: 28,
      height: 28,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      border: '1px solid #e2e8f0',
      background: '#fff',
      color,
      cursor: 'pointer',
    }}
  >
    {children}
  </button>
);

const Modal: React.FC<{
  title: string;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}> = ({ title, onClose, width = 540, children }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15,23,42,0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 16,
    }}
    onClick={onClose}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 22,
        width: `min(${width}px, 96vw)`,
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 17, color: '#0f172a' }}>{title}</h3>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#64748b',
          }}
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default ClientEnquiry;
