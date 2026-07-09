/**
 * One-time seeder for Dashboard demo data.
 *
 * Populates `cms_auditors`, `cms_audit_schedules`, and `cms_audit_certifications`
 * with realistic rows when those keys are empty, so the Coordinator Dashboard's
 * KPIs, donut, recent-audits panel, and standards-coverage chart actually render
 * something useful on first load.
 *
 * If the user already has data, this seeder is a no-op. A `cms_dashboard_seeded_v1`
 * flag prevents re-seeding once the user has cleared a list intentionally.
 */

const SEED_FLAG_KEY = 'cms_dashboard_seeded_v1';
const AUDITORS_KEY = 'cms_auditors';
const AUDITORS_DATA_KEY = 'cms_auditors_data'; // alternate key used by AuditorProfiles
const SCHEDULES_KEY = 'cms_audit_schedules';
const CERTS_KEY = 'cms_audit_certifications';

const day = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

const buildAuditors = () => [
  {
    id: 1,
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar@qmics.com',
    role: 'Lead Auditor',
    specialization: 'Information Security',
    department: 'Security',
    certifications: ['ISO 27001:2022', 'ISO 9001:2015'],
    auditValidator: 'Authorized',
    status: 'Active',
    joinDate: day(-540),
    skills: { 'ISO 27001': 5, 'ISO 9001': 4, 'ISO 42001': 3 },
    ratings: [
      { at: new Date(Date.now() - 30 * 86400000).toISOString(), score: 4.5, audit: 'Acme Corp Stage 2' },
      { at: new Date(Date.now() - 90 * 86400000).toISOString(), score: 5, audit: 'BlueWave Logistics' },
    ],
    approvalStatus: 'Approved',
    approvedBy: 'Lead Auditor',
    approvedAt: new Date(Date.now() - 500 * 86400000).toISOString(),
  },
  {
    id: 2,
    name: 'Anita Verma',
    email: 'anita.verma@qmics.com',
    role: 'Lead Auditor',
    specialization: 'Environment & Safety',
    department: 'Quality',
    certifications: ['ISO 14001:2015', 'ISO 45001:2018'],
    auditValidator: 'Authorized',
    status: 'Active',
    joinDate: day(-420),
    skills: { 'ISO 14001': 5, 'ISO 45001': 5, 'ISO 9001': 3 },
    ratings: [
      { at: new Date(Date.now() - 14 * 86400000).toISOString(), score: 4.8, audit: 'GreenGrove Foods' },
    ],
    approvalStatus: 'Approved',
    approvedBy: 'Lead Auditor',
    approvedAt: new Date(Date.now() - 400 * 86400000).toISOString(),
  },
  {
    id: 3,
    name: 'Vikram Singh',
    email: 'vikram.singh@qmics.com',
    role: 'Auditor',
    specialization: 'Quality & Food Safety',
    department: 'Quality',
    certifications: ['ISO 9001:2015', 'ISO 22000:2018'],
    auditValidator: 'Authorized',
    status: 'Active',
    joinDate: day(-300),
    skills: { 'ISO 9001': 4, 'ISO 22000': 5, 'ISO 14001': 2 },
    ratings: [
      { at: new Date(Date.now() - 60 * 86400000).toISOString(), score: 4.2, audit: 'Fresh Foods Packers' },
    ],
    approvalStatus: 'Approved',
    approvedBy: 'Lead Auditor',
    approvedAt: new Date(Date.now() - 280 * 86400000).toISOString(),
  },
  {
    id: 4,
    name: 'Priya Reddy',
    email: 'priya.reddy@qmics.com',
    role: 'Auditor',
    specialization: 'AI Governance & Security',
    department: 'Software Development',
    certifications: ['ISO 27001:2022', 'ISO 42001:2023'],
    auditValidator: 'Authorized',
    status: 'Active',
    joinDate: day(-180),
    skills: { 'ISO 27001': 5, 'ISO 42001': 4, 'ISO 9001': 2 },
    ratings: [],
    approvalStatus: 'Approved',
    approvedBy: 'Lead Auditor',
    approvedAt: new Date(Date.now() - 160 * 86400000).toISOString(),
  },
  {
    id: 5,
    name: 'Sandeep Joshi',
    email: 'sandeep.joshi@qmics.com',
    role: 'Auditor',
    specialization: 'Energy & Environment',
    department: 'Quality',
    certifications: ['ISO 14001:2015', 'ISO 50001:2018'],
    auditValidator: 'Authorized',
    status: 'Active',
    joinDate: day(-220),
    skills: { 'ISO 14001': 4, 'ISO 50001': 5, 'ISO 45001': 3 },
    ratings: [
      { at: new Date(Date.now() - 45 * 86400000).toISOString(), score: 4.0, audit: 'Solaris Power' },
    ],
    approvalStatus: 'Approved',
    approvedBy: 'Lead Auditor',
    approvedAt: new Date(Date.now() - 200 * 86400000).toISOString(),
  },
  {
    id: 6,
    name: 'Karthik Iyer',
    email: 'karthik.iyer@qmics.com',
    role: 'Junior Auditor',
    specialization: 'Quality',
    department: 'Quality',
    certifications: ['ISO 9001:2015'],
    auditValidator: 'Pending',
    status: 'Inactive',
    joinDate: day(-30),
    skills: { 'ISO 9001': 3 },
    ratings: [],
    approvalStatus: 'Pending Approval',
  },
];

const buildSchedules = () => [
  {
    id: 'sch-001',
    organizationName: 'Tech Innovations Ltd',
    client: 'Tech Innovations Ltd',
    standard: 'ISO 27001:2022',
    leadAuditor: 'Rajesh Kumar',
    auditor: 'Priya Reddy',
    date: day(7),
    scheduledDate: day(7),
    status: 'Scheduled',
    auditType: 'Initial Audit',
    auditName: 'ISO 27001 Stage 2 — Tech Innovations',
    auditScope: 'Headquarters + cloud infra',
  },
  {
    id: 'sch-002',
    organizationName: 'Green Energy Solutions',
    client: 'Green Energy Solutions',
    standard: 'ISO 9001:2015',
    leadAuditor: 'Anita Verma',
    auditor: 'Vikram Singh',
    date: day(3),
    scheduledDate: day(3),
    status: 'Scheduled',
    auditType: 'Surveillance 1',
    auditName: 'Surveillance 1 — Green Energy',
    auditScope: 'Manufacturing line A & B',
  },
  {
    id: 'sch-003',
    organizationName: 'BlueWave Logistics',
    client: 'BlueWave Logistics',
    standard: 'ISO 9001:2015',
    leadAuditor: 'Anita Verma',
    auditor: 'Vikram Singh',
    date: day(-2),
    scheduledDate: day(-2),
    status: 'In Progress',
    auditType: 'Initial Audit',
    auditName: 'Stage 1 Readiness — BlueWave',
    auditScope: 'Hub operations + driver SOPs',
  },
  {
    id: 'sch-004',
    organizationName: 'Fresh Foods Packers',
    client: 'Fresh Foods Packers',
    standard: 'ISO 22000:2018',
    leadAuditor: 'Anita Verma',
    auditor: 'Vikram Singh',
    date: day(14),
    scheduledDate: day(14),
    status: 'Scheduled',
    auditType: 'Surveillance 2',
    auditName: 'Surveillance 2 — Fresh Foods',
    auditScope: 'Cold chain + HACCP',
  },
  {
    id: 'sch-005',
    organizationName: 'AutoParts Manufacturing',
    client: 'AutoParts Manufacturing',
    standard: 'ISO 9001:2015',
    leadAuditor: 'Anita Verma',
    auditor: 'Vikram Singh',
    date: day(-12),
    scheduledDate: day(-12),
    status: 'Completed',
    auditType: 'Surveillance 1',
    auditName: 'Surveillance 1 — AutoParts',
    auditScope: 'Plant 1 + supplier QC',
  },
  {
    id: 'sch-006',
    organizationName: 'CyberSecure Systems',
    client: 'CyberSecure Systems',
    standard: 'ISO 27001:2022',
    leadAuditor: 'Rajesh Kumar',
    auditor: 'Priya Reddy',
    date: day(21),
    scheduledDate: day(21),
    status: 'Scheduled',
    auditType: 'Transfer',
    auditName: 'Transfer Audit — CyberSecure',
    auditScope: 'ISMS + dev pipeline',
  },
  {
    id: 'sch-007',
    organizationName: 'SkyHigh Construction',
    client: 'SkyHigh Construction',
    standard: 'ISO 45001:2018',
    leadAuditor: 'Anita Verma',
    auditor: 'Sandeep Joshi',
    date: day(-25),
    scheduledDate: day(-25),
    status: 'Completed',
    auditType: 'Surveillance 1',
    auditName: 'Surveillance 1 — SkyHigh',
    auditScope: 'Site 4 + contractor management',
  },
  {
    id: 'sch-008',
    organizationName: 'Helix Diagnostics',
    client: 'Helix Diagnostics',
    standard: 'ISO 13485:2016',
    leadAuditor: 'Rajesh Kumar',
    auditor: 'Vikram Singh',
    date: day(10),
    scheduledDate: day(10),
    status: 'Scheduled',
    auditType: 'Initial Audit',
    auditName: 'Stage 2 — Helix Diagnostics',
    auditScope: 'Lab QMS + device files',
  },
];

const buildCertifications = () => [
  {
    id: 'cert-001',
    organizationName: 'AutoParts Manufacturing',
    standard: 'ISO 9001:2015',
    issuedDate: day(-380),
    expirationDate: day(720),
    surveillance1Due: day(-15),
    surveillance2Due: day(350),
    recertificationDueDate: day(720),
    status: 'Active',
    type: 'QMS',
  },
  {
    id: 'cert-002',
    organizationName: 'SkyHigh Construction',
    standard: 'ISO 45001:2018',
    issuedDate: day(-410),
    expirationDate: day(685),
    surveillance1Due: day(-45),
    surveillance2Due: day(320),
    recertificationDueDate: day(685),
    status: 'Active',
    type: 'OHSAS',
  },
  {
    id: 'cert-003',
    organizationName: 'Green Energy Solutions',
    standard: 'ISO 9001:2015',
    issuedDate: day(-200),
    expirationDate: day(900),
    surveillance1Due: day(165),
    surveillance2Due: day(530),
    recertificationDueDate: day(900),
    status: 'Active',
    type: 'QMS',
  },
];

const writeIfEmpty = (key: string, value: any[]) => {
  try {
    const existing = localStorage.getItem(key);
    if (!existing) {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }
    const parsed = JSON.parse(existing);
    if (Array.isArray(parsed) && parsed.length === 0) {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Seed Dashboard demo data once. Returns true if anything was written.
 */
export const seedDashboardDemoData = (): boolean => {
  try {
    const alreadySeeded = localStorage.getItem(SEED_FLAG_KEY) === '1';
    if (alreadySeeded) return false;

    let wroteSomething = false;
    if (writeIfEmpty(AUDITORS_KEY, buildAuditors())) wroteSomething = true;
    if (writeIfEmpty(AUDITORS_DATA_KEY, buildAuditors())) wroteSomething = true;
    if (writeIfEmpty(SCHEDULES_KEY, buildSchedules())) wroteSomething = true;
    if (writeIfEmpty(CERTS_KEY, buildCertifications())) wroteSomething = true;

    localStorage.setItem(SEED_FLAG_KEY, '1');
    return wroteSomething;
  } catch {
    return false;
  }
};
