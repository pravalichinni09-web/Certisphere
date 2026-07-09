/**
 * Global demo seeder — fills every CMS surface with realistic
 * globally-distributed certification data.
 *
 * Coverage:
 *   - 8 countries (USA, UK, Germany, India, UAE, Singapore, Australia, Brazil)
 *   - 1 Lead Auditor per country + 1-2 Auditors per country (~22 auditors)
 *   - ~16 clients spanning all 8 countries
 *   - Audit schedules, certifications, workflows, dispatches, findings, scopes,
 *     types, checklists tied to those clients & auditors so the entire app
 *     looks like a live global certification body.
 *
 * Idempotent. Each storage key is only written when empty, and a global flag
 * `cms_global_seeded_v2` ensures we don't re-seed once the user has explored.
 */

const GLOBAL_FLAG_KEY = 'cms_global_seeded_v3';

const KEYS = {
  auditors: 'cms_auditors',
  auditorsData: 'cms_auditors_data',
  clients: 'cms_client_registrations',
  scopes: 'cms_audit_scopes',
  types: 'cms_audit_types',
  checklists: 'cms_audit_checklists',
  schedules: 'cms_audit_schedules',
  schedulesV3: 'cms_audit_schedules_v3',
  certifications: 'cms_audit_certifications',
  workflows: 'cms_audit_workflow',
  dispatch: 'cms_application_dispatch_v7',
  findings: 'cms_audit_findings_v1',
  certificates: 'cms_certificates',
  reports: 'cms_audit_reports',
  reminderLog: 'cms_audit_reminder_log_v1',
  dispatchLog: 'cms_dispatch_log',
  renewalLog: 'cms_renewal_log',
  scheduleRequests: 'cms_schedule_requests_v1',
  dashboardFlag: 'cms_dashboard_seeded_v1',
  enquiriesFlag: 'cms_client_enquiries_seeded_v1',
  findingsFlag: 'cms_audit_findings_seeded_v1',
  workflowFlag: 'cms_audit_workflow_seeded_v1',
  certsFlag: 'cms_audit_certifications_seeded_v1',
};

const day = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};
const isoDay = (offset: number): string => new Date(Date.now() + offset * 86400000).toISOString();

/* ----------------------------------------------------------------
   AUDITORS — 1 Lead Auditor per country + supporting Auditors
---------------------------------------------------------------- */
const buildAuditors = () => [
  // ───── USA ─────
  {
    id: 101, name: 'Michael Reynolds', email: 'michael.reynolds@qmics.com',
    role: 'Lead Auditor', specialization: 'Quality + ISMS',
    department: 'Quality', country: 'USA', region: 'New York',
    phone: '+1 212 555 0101', languages: ['English'],
    certifications: ['ISO 9001:2015', 'ISO 27001:2022'], status: 'Active',
    joinDate: day(-720),
    skills: { 'ISO 9001': 5, 'ISO 27001': 5, 'ISO 14001': 4, 'ISO 45001': 3 },
    ratings: [
      { at: isoDay(-30), score: 4.8, audit: 'Acme Industries USA' },
      { at: isoDay(-90), score: 4.5, audit: 'TechCore Inc' },
    ],
    approvalStatus: 'Approved', approvedBy: 'CertMS Admin', approvedAt: isoDay(-700),
  },
  {
    id: 102, name: 'Jessica Wong', email: 'jessica.wong@qmics.com',
    role: 'Auditor', specialization: 'Information Security',
    department: 'Security', country: 'USA', region: 'California',
    phone: '+1 415 555 0102', languages: ['English'],
    certifications: ['ISO 27001:2022', 'ISO 9001:2015'], status: 'Active',
    joinDate: day(-420),
    skills: { 'ISO 27001': 5, 'ISO 42001': 4, 'ISO 9001': 3 },
    ratings: [], approvalStatus: 'Approved', approvedBy: 'Michael Reynolds', approvedAt: isoDay(-400),
  },

  // ───── UK ─────
  {
    id: 103, name: 'Oliver Bennett', email: 'oliver.bennett@qmics.com',
    role: 'Lead Auditor', specialization: 'Environment + OHS',
    department: 'Quality', country: 'United Kingdom', region: 'London',
    phone: '+44 20 7946 0101', languages: ['English'],
    certifications: ['ISO 14001:2015', 'ISO 45001:2018'], status: 'Active',
    joinDate: day(-680),
    skills: { 'ISO 14001': 5, 'ISO 45001': 5, 'ISO 9001': 4, 'ISO 50001': 3 },
    ratings: [{ at: isoDay(-45), score: 4.7, audit: 'BritEnergy Plc' }],
    approvalStatus: 'Approved', approvedBy: 'CertMS Admin', approvedAt: isoDay(-660),
  },
  {
    id: 104, name: 'Charlotte Davies', email: 'charlotte.davies@qmics.com',
    role: 'Auditor', specialization: 'Quality',
    department: 'Quality', country: 'United Kingdom', region: 'Manchester',
    phone: '+44 161 555 0104', languages: ['English'],
    certifications: ['ISO 9001:2015'], status: 'Active',
    joinDate: day(-310),
    skills: { 'ISO 9001': 4, 'ISO 14001': 3 }, ratings: [],
    approvalStatus: 'Approved', approvedBy: 'Oliver Bennett', approvedAt: isoDay(-300),
  },

  // ───── Germany ─────
  {
    id: 105, name: 'Klaus Mueller', email: 'klaus.mueller@qmics.com',
    role: 'Lead Auditor', specialization: 'Automotive + QMS',
    department: 'Quality', country: 'Germany', region: 'Bavaria',
    phone: '+49 89 555 0105', languages: ['German', 'English'],
    certifications: ['ISO 9001:2015', 'IATF 16949'], status: 'Active',
    joinDate: day(-900),
    skills: { 'ISO 9001': 5, 'ISO 14001': 4, 'ISO 45001': 4 },
    ratings: [{ at: isoDay(-60), score: 4.9, audit: 'AutoTeknik GmbH' }],
    approvalStatus: 'Approved', approvedBy: 'CertMS Admin', approvedAt: isoDay(-880),
  },
  {
    id: 106, name: 'Lena Schwarz', email: 'lena.schwarz@qmics.com',
    role: 'Auditor', specialization: 'Information Security',
    department: 'Security', country: 'Germany', region: 'Berlin',
    phone: '+49 30 555 0106', languages: ['German', 'English'],
    certifications: ['ISO 27001:2022', 'ISO 9001:2015'], status: 'Active',
    joinDate: day(-200),
    skills: { 'ISO 27001': 5, 'ISO 42001': 4 }, ratings: [],
    approvalStatus: 'Approved', approvedBy: 'Klaus Mueller', approvedAt: isoDay(-190),
  },

  // ───── India ─────
  {
    id: 107, name: 'Rajesh Kumar', email: 'rajesh.kumar@qmics.com',
    role: 'Lead Auditor', specialization: 'Information Security',
    department: 'Security', country: 'India', region: 'Telangana',
    phone: '+91 98765 43210', languages: ['English', 'Hindi', 'Telugu'],
    certifications: ['ISO 27001:2022', 'ISO 9001:2015'], status: 'Active',
    joinDate: day(-540),
    skills: { 'ISO 27001': 5, 'ISO 9001': 4, 'ISO 42001': 3 },
    ratings: [
      { at: isoDay(-30), score: 4.5, audit: 'Acme Corp Stage 2' },
      { at: isoDay(-90), score: 5, audit: 'BlueWave Logistics' },
    ],
    approvalStatus: 'Approved', approvedBy: 'CertMS Admin', approvedAt: isoDay(-500),
  },
  {
    id: 108, name: 'Anita Verma', email: 'anita.verma@qmics.com',
    role: 'Lead Auditor', specialization: 'Environment & Safety',
    department: 'Quality', country: 'India', region: 'Karnataka',
    phone: '+91 90220 11108', languages: ['English', 'Hindi', 'Kannada'],
    certifications: ['ISO 14001:2015', 'ISO 45001:2018'], status: 'Active',
    joinDate: day(-420),
    skills: { 'ISO 14001': 5, 'ISO 45001': 5, 'ISO 9001': 3 },
    ratings: [{ at: isoDay(-14), score: 4.8, audit: 'GreenGrove Foods' }],
    approvalStatus: 'Approved', approvedBy: 'CertMS Admin', approvedAt: isoDay(-400),
  },
  {
    id: 109, name: 'Vikram Singh', email: 'vikram.singh@qmics.com',
    role: 'Auditor', specialization: 'Quality & Food Safety',
    department: 'Quality', country: 'India', region: 'Maharashtra',
    phone: '+91 88888 22109', languages: ['English', 'Hindi', 'Marathi'],
    certifications: ['ISO 9001:2015', 'ISO 22000:2018'], status: 'Active',
    joinDate: day(-300),
    skills: { 'ISO 9001': 4, 'ISO 22000': 5, 'ISO 14001': 2 },
    ratings: [{ at: isoDay(-60), score: 4.2, audit: 'Fresh Foods Packers' }],
    approvalStatus: 'Approved', approvedBy: 'Rajesh Kumar', approvedAt: isoDay(-280),
  },
  {
    id: 110, name: 'Priya Reddy', email: 'priya.reddy@qmics.com',
    role: 'Auditor', specialization: 'AI Governance & Security',
    department: 'Software Development', country: 'India', region: 'Telangana',
    phone: '+91 87878 33110', languages: ['English', 'Hindi', 'Telugu'],
    certifications: ['ISO 27001:2022', 'ISO 42001:2023'], status: 'Active',
    joinDate: day(-180),
    skills: { 'ISO 27001': 5, 'ISO 42001': 4, 'ISO 9001': 2 },
    ratings: [], approvalStatus: 'Approved', approvedBy: 'Rajesh Kumar', approvedAt: isoDay(-160),
  },

  // ───── UAE ─────
  {
    id: 111, name: 'Ahmed Al-Rashid', email: 'ahmed.alrashid@qmics.com',
    role: 'Lead Auditor', specialization: 'Energy + Environment',
    department: 'Quality', country: 'UAE', region: 'Dubai',
    phone: '+971 4 555 0111', languages: ['Arabic', 'English'],
    certifications: ['ISO 50001:2018', 'ISO 14001:2015'], status: 'Active',
    joinDate: day(-560),
    skills: { 'ISO 50001': 5, 'ISO 14001': 4, 'ISO 45001': 3 },
    ratings: [{ at: isoDay(-30), score: 4.6, audit: 'Gulf Power LLC' }],
    approvalStatus: 'Approved', approvedBy: 'CertMS Admin', approvedAt: isoDay(-540),
  },
  {
    id: 112, name: 'Fatima Al-Maktoum', email: 'fatima.almaktoum@qmics.com',
    role: 'Auditor', specialization: 'Construction QMS',
    department: 'Quality', country: 'UAE', region: 'Abu Dhabi',
    phone: '+971 2 555 0112', languages: ['Arabic', 'English'],
    certifications: ['ISO 9001:2015', 'ISO 45001:2018'], status: 'Active',
    joinDate: day(-180),
    skills: { 'ISO 9001': 4, 'ISO 45001': 4 }, ratings: [],
    approvalStatus: 'Approved', approvedBy: 'Ahmed Al-Rashid', approvedAt: isoDay(-170),
  },

  // ───── Singapore ─────
  {
    id: 113, name: 'Wei Lin', email: 'wei.lin@qmics.com',
    role: 'Lead Auditor', specialization: 'Information Security + AI',
    department: 'Security', country: 'Singapore',
    phone: '+65 6555 0113', languages: ['English', 'Mandarin'],
    certifications: ['ISO 27001:2022', 'ISO 42001:2023', 'ISO 9001:2015'],
    status: 'Active', joinDate: day(-480),
    skills: { 'ISO 27001': 5, 'ISO 42001': 5, 'ISO 9001': 4 },
    ratings: [{ at: isoDay(-20), score: 4.9, audit: 'FinSecure Pte' }],
    approvalStatus: 'Approved', approvedBy: 'CertMS Admin', approvedAt: isoDay(-460),
  },

  // ───── Australia ─────
  {
    id: 114, name: 'Emma Thompson', email: 'emma.thompson@qmics.com',
    role: 'Lead Auditor', specialization: 'Healthcare + Medical Devices',
    department: 'Quality', country: 'Australia', region: 'New South Wales',
    phone: '+61 2 5550 0114', languages: ['English'],
    certifications: ['ISO 13485:2016', 'ISO 9001:2015'], status: 'Active',
    joinDate: day(-360),
    skills: { 'ISO 13485': 5, 'ISO 9001': 4, 'ISO 14001': 3 },
    ratings: [{ at: isoDay(-50), score: 4.7, audit: 'MedTech Australia' }],
    approvalStatus: 'Approved', approvedBy: 'CertMS Admin', approvedAt: isoDay(-340),
  },
  {
    id: 115, name: 'Liam Brooks', email: 'liam.brooks@qmics.com',
    role: 'Auditor', specialization: 'Mining + Environment',
    department: 'Quality', country: 'Australia', region: 'Western Australia',
    phone: '+61 8 5550 0115', languages: ['English'],
    certifications: ['ISO 14001:2015', 'ISO 45001:2018'], status: 'Active',
    joinDate: day(-150),
    skills: { 'ISO 14001': 4, 'ISO 45001': 4 }, ratings: [],
    approvalStatus: 'Approved', approvedBy: 'Emma Thompson', approvedAt: isoDay(-140),
  },

  // ───── Brazil ─────
  {
    id: 116, name: 'Sofia Oliveira', email: 'sofia.oliveira@qmics.com',
    role: 'Lead Auditor', specialization: 'Food Safety + Agriculture',
    department: 'Quality', country: 'Brazil', region: 'São Paulo',
    phone: '+55 11 5555 0116', languages: ['Portuguese', 'English'],
    certifications: ['ISO 22000:2018', 'ISO 9001:2015'], status: 'Active',
    joinDate: day(-260),
    skills: { 'ISO 22000': 5, 'ISO 9001': 4, 'ISO 14001': 3 },
    ratings: [], approvalStatus: 'Approved', approvedBy: 'CertMS Admin', approvedAt: isoDay(-240),
  },

  // ───── Pending approval — new auditor from registration ─────
  {
    id: 117, name: 'Karthik Iyer', email: 'karthik.iyer@qmics.com',
    role: 'Junior Auditor', specialization: 'Quality',
    department: 'Quality', country: 'India', region: 'Tamil Nadu',
    phone: '+91 88888 99117', languages: ['English', 'Tamil'],
    certifications: ['ISO 9001:2015'], status: 'Inactive',
    joinDate: day(-15),
    skills: { 'ISO 9001': 3 }, ratings: [], approvalStatus: 'Pending Approval',
  },
];

/* ----------------------------------------------------------------
   CLIENTS — globally distributed
---------------------------------------------------------------- */
const buildClients = () => [
  {
    id: 201, clientCode: 'CMS-2026-USA-0001',
    organizationName: 'Acme Industries USA', contactPerson: 'Daniel Park',
    registrationNumber: 'REG-2026-2001', clientType: 'Initial Certification',
    standard: 'ISO 9001:2015', status: 'Approved',
    email: 'd.park@acme-us.com', phone: '+1 212 444 0201',
    address: 'Manhattan, NY 10001', country: 'USA', industry: 'Manufacturing',
    submittedAt: isoDay(-60), clientRespondedAt: isoDay(-55),
  },
  {
    id: 202, clientCode: 'CMS-2026-USA-0002',
    organizationName: 'TechCore Inc', contactPerson: 'Rachel Kim',
    registrationNumber: 'REG-2026-2002', clientType: 'Surveillance 1',
    standard: 'ISO 27001:2022', status: 'Pending',
    email: 'r.kim@techcore.com', phone: '+1 415 444 0202',
    address: 'San Francisco, CA 94105', country: 'USA', industry: 'Software / IT',
  },
  {
    id: 203, clientCode: 'CMS-2026-UK-0001',
    organizationName: 'BritEnergy Plc', contactPerson: 'Henry Watson',
    registrationNumber: 'REG-2026-2003', clientType: 'Recertification',
    standard: 'ISO 14001:2015', status: 'Approved',
    email: 'h.watson@britenergy.co.uk', phone: '+44 20 7444 0203',
    address: 'London EC2A 4AE', country: 'United Kingdom', industry: 'Energy',
    submittedAt: isoDay(-90), clientRespondedAt: isoDay(-85),
  },
  {
    id: 204, clientCode: 'CMS-2026-UK-0002',
    organizationName: 'Northstar Pharmaceuticals', contactPerson: 'Alice Morgan',
    registrationNumber: 'REG-2026-2004', clientType: 'Initial Certification',
    standard: 'ISO 13485:2016', status: 'Pending',
    email: 'a.morgan@northstar-pharma.co.uk', phone: '+44 161 444 0204',
    address: 'Manchester M15 4FN', country: 'United Kingdom', industry: 'Pharmaceutical',
  },
  {
    id: 205, clientCode: 'CMS-2026-DE-0001',
    organizationName: 'AutoTeknik GmbH', contactPerson: 'Hans Schmidt',
    registrationNumber: 'REG-2026-2005', clientType: 'Surveillance 2',
    standard: 'ISO 9001:2015', status: 'Approved',
    email: 'h.schmidt@autoteknik.de', phone: '+49 89 444 0205',
    address: '80331 Munich, Bavaria', country: 'Germany', industry: 'Manufacturing',
    submittedAt: isoDay(-120), clientRespondedAt: isoDay(-115),
  },
  {
    id: 206, clientCode: 'CMS-2026-DE-0002',
    organizationName: 'Berlin Cloud Services', contactPerson: 'Anna Becker',
    registrationNumber: 'REG-2026-2006', clientType: 'Initial Certification',
    standard: 'ISO 27001:2022', status: 'Pending',
    email: 'a.becker@berlincloud.de', phone: '+49 30 444 0206',
    address: '10115 Berlin', country: 'Germany', industry: 'Software / IT',
  },
  {
    id: 207, clientCode: 'CMS-2026-IN-0001',
    organizationName: 'Hyderabad TechWorks', contactPerson: 'Priya Sharma',
    registrationNumber: 'REG-2026-2007', clientType: 'Initial Certification',
    standard: 'ISO 27001:2022', status: 'Approved',
    email: 'priya@hydtechworks.in', phone: '+91 98765 0207',
    address: 'Hyderabad 500032', country: 'India', industry: 'Software / IT',
    submittedAt: isoDay(-50), clientRespondedAt: isoDay(-45),
  },
  {
    id: 208, clientCode: 'CMS-2026-IN-0002',
    organizationName: 'BlueWave Logistics', contactPerson: 'Rahul Mehta',
    registrationNumber: 'REG-2026-2008', clientType: 'Initial Certification',
    standard: 'ISO 9001:2015', status: 'Approved',
    email: 'rahul@bluewave-logistics.com', phone: '+91 90220 0208',
    address: 'Mumbai 400001', country: 'India', industry: 'Logistics',
  },
  {
    id: 209, clientCode: 'CMS-2026-IN-0003',
    organizationName: 'GreenGrove Foods', contactPerson: 'Anita Iyer',
    registrationNumber: 'REG-2026-2009', clientType: 'Surveillance 1',
    standard: 'ISO 22000:2018', status: 'Approved',
    email: 'anita.iyer@greengrove.in', phone: '+91 99883 0209',
    address: 'Bangalore 560001', country: 'India', industry: 'Food & Beverage',
  },
  {
    id: 210, clientCode: 'CMS-2026-AE-0001',
    organizationName: 'Gulf Power LLC', contactPerson: 'Omar Khalil',
    registrationNumber: 'REG-2026-2010', clientType: 'Initial Certification',
    standard: 'ISO 50001:2018', status: 'Approved',
    email: 'o.khalil@gulfpower.ae', phone: '+971 4 444 0210',
    address: 'Dubai Marina, Dubai', country: 'UAE', industry: 'Energy',
  },
  {
    id: 211, clientCode: 'CMS-2026-AE-0002',
    organizationName: 'Sand Dune Construction', contactPerson: 'Mariam Hassan',
    registrationNumber: 'REG-2026-2011', clientType: 'Surveillance 1',
    standard: 'ISO 45001:2018', status: 'Pending',
    email: 'mariam@sanddune.ae', phone: '+971 2 444 0211',
    address: 'Abu Dhabi', country: 'UAE', industry: 'Construction',
  },
  {
    id: 212, clientCode: 'CMS-2026-SG-0001',
    organizationName: 'FinSecure Pte', contactPerson: 'Tan Wei Ming',
    registrationNumber: 'REG-2026-2012', clientType: 'Recertification',
    standard: 'ISO 27001:2022', status: 'Approved',
    email: 'wm.tan@finsecure.sg', phone: '+65 6444 0212',
    address: 'Marina Bay, Singapore', country: 'Singapore', industry: 'Financial Services',
  },
  {
    id: 213, clientCode: 'CMS-2026-SG-0002',
    organizationName: 'Lumen AI Labs', contactPerson: 'Sneha Patel',
    registrationNumber: 'REG-2026-2013', clientType: 'Initial Certification',
    standard: 'ISO 42001:2023', status: 'Pending',
    email: 'sneha@lumenai.io', phone: '+65 6444 0213',
    address: 'One-North, Singapore', country: 'Singapore', industry: 'Software / IT',
  },
  {
    id: 214, clientCode: 'CMS-2026-AU-0001',
    organizationName: 'MedTech Australia', contactPerson: 'James O\'Connor',
    registrationNumber: 'REG-2026-2014', clientType: 'Surveillance 2',
    standard: 'ISO 13485:2016', status: 'Approved',
    email: 'j.oconnor@medtech.com.au', phone: '+61 2 5444 0214',
    address: 'Sydney NSW 2000', country: 'Australia', industry: 'Healthcare',
  },
  {
    id: 215, clientCode: 'CMS-2026-AU-0002',
    organizationName: 'OutbackMining Co', contactPerson: 'Olivia Brown',
    registrationNumber: 'REG-2026-2015', clientType: 'Initial Certification',
    standard: 'ISO 45001:2018', status: 'Pending',
    email: 'olivia@outbackmining.com.au', phone: '+61 8 5444 0215',
    address: 'Perth WA 6000', country: 'Australia', industry: 'Manufacturing',
  },
  {
    id: 216, clientCode: 'CMS-2026-BR-0001',
    organizationName: 'Brasil AgroFoods SA', contactPerson: 'Carlos Silva',
    registrationNumber: 'REG-2026-2016', clientType: 'Surveillance 1',
    standard: 'ISO 22000:2018', status: 'Approved',
    email: 'c.silva@brasilagrofoods.com.br', phone: '+55 11 5444 0216',
    address: 'São Paulo 01310-100', country: 'Brazil', industry: 'Food & Beverage',
  },
];

/* ----------------------------------------------------------------
   SCOPES, TYPES, CHECKLISTS — short list, varied
---------------------------------------------------------------- */
const buildScopes = () => [
  { id: 1, scopeName: 'Manufacturing — Headquarters', description: 'QMS scope covering HQ + main plant.', standard: 'ISO 9001:2015', currentVersion: 1 },
  { id: 2, scopeName: 'Cloud Services',                description: 'ISMS scope for cloud + dev pipelines.', standard: 'ISO 27001:2022', currentVersion: 2 },
  { id: 3, scopeName: 'Construction Sites',             description: 'OHS scope across active construction projects.', standard: 'ISO 45001:2018', currentVersion: 1 },
  { id: 4, scopeName: 'Cold Chain & Packing',           description: 'Food safety scope for cold chain operations.', standard: 'ISO 22000:2018', currentVersion: 1 },
  { id: 5, scopeName: 'Renewable Energy Plants',         description: 'Energy management scope.', standard: 'ISO 50001:2018', currentVersion: 1 },
  { id: 6, scopeName: 'Medical Device Manufacturing',    description: 'ISO 13485 QMS for class II/III devices.', standard: 'ISO 13485:2016', currentVersion: 2 },
  { id: 7, scopeName: 'AI Product Development',          description: 'AI governance scope for GenAI products.', standard: 'ISO 42001:2023', currentVersion: 1 },
];

const buildTypes = () => [
  { id: 1, name: 'Initial Certification',     description: 'First-time certification audit, Stage 1 + Stage 2.', defaultDurationDays: 3 },
  { id: 2, name: 'Surveillance 1',    description: 'First annual surveillance audit (~12 months after certification).', defaultDurationDays: 2 },
  { id: 3, name: 'Surveillance 2',    description: 'Second annual surveillance audit.', defaultDurationDays: 2 },
  { id: 4, name: 'Recertification',   description: '3-year recertification audit, full scope.', defaultDurationDays: 4 },
  { id: 5, name: 'Transfer',           description: 'Audit to transfer existing certification from another CB.', defaultDurationDays: 2 },
  { id: 6, name: 'Special / Extension', description: 'Scope extension or special audit.', defaultDurationDays: 1 },
];

const buildChecklists = () => [
  {
    id: 1, name: 'ISO 9001 — Stage 2 Checklist', type: 'Certification',
    standard: 'ISO 9001:2015', items: 28, status: 'Active', created: day(-90),
    checklistItems: [
      { id: 'q1-1', text: 'Are top management commitments documented and communicated?', notes: '' },
      { id: 'q1-2', text: 'Is the QMS scope clearly defined and accessible to staff?', notes: '' },
      { id: 'q1-3', text: 'Are internal audit reports for the last 12 months available?', notes: '' },
    ],
  },
  {
    id: 2, name: 'ISO 27001 — Annex A Walkthrough', type: 'Certification',
    standard: 'ISO 27001:2022', items: 93, status: 'Active', created: day(-120),
    checklistItems: [
      { id: 'q2-1', text: 'A.5.15 Access control policy — quarterly reviews evidenced?', notes: '' },
      { id: 'q2-2', text: 'A.8.13 Backup policy — retention matches RPO?', notes: '' },
    ],
  },
  {
    id: 3, name: 'ISO 45001 — Surveillance Checklist', type: 'Surveillance',
    standard: 'ISO 45001:2018', items: 22, status: 'Active', created: day(-60),
    checklistItems: [
      { id: 'q3-1', text: '6.1.2 Hazard identification process — risk register updated?', notes: '' },
    ],
  },
  {
    id: 4, name: 'ISO 22000 — HACCP Verification', type: 'Surveillance',
    standard: 'ISO 22000:2018', items: 18, status: 'Active', created: day(-45),
    checklistItems: [
      { id: 'q4-1', text: '7.1.6 Allergen segregation across receiving / storage / production?', notes: '' },
    ],
  },
  {
    id: 5, name: 'ISO 42001 — AI Governance Audit', type: 'Certification',
    standard: 'ISO 42001:2023', items: 14, status: 'Draft', created: day(-15),
    checklistItems: [
      { id: 'q5-1', text: '6.1 AI risk assessment process — documented & owners assigned?', notes: '' },
    ],
  },
];

/* ----------------------------------------------------------------
   SCHEDULES — country-matched auditors
---------------------------------------------------------------- */
const buildSchedules = () => [
  // USA — Michael Reynolds (lead) + Jessica Wong
  { id: 'sch-usa-001', organizationName: 'Acme Industries USA', client: 'Acme Industries USA',
    standard: 'ISO 9001:2015', leadAuditor: 'Michael Reynolds', auditor: 'Jessica Wong',
    date: day(7), scheduledDate: day(7), status: 'Scheduled', auditType: 'Initial Certification',
    auditName: 'Stage 2 — Acme Industries USA', auditScope: 'Manufacturing HQ', country: 'USA' },
  { id: 'sch-usa-002', organizationName: 'TechCore Inc', client: 'TechCore Inc',
    standard: 'ISO 27001:2022', leadAuditor: 'Michael Reynolds', auditor: 'Jessica Wong',
    date: day(21), scheduledDate: day(21), status: 'Scheduled', auditType: 'Surveillance 1',
    auditName: 'Surveillance 1 — TechCore', auditScope: 'Cloud + dev pipeline', country: 'USA' },

  // UK — Oliver Bennett + Charlotte Davies
  { id: 'sch-uk-001', organizationName: 'BritEnergy Plc', client: 'BritEnergy Plc',
    standard: 'ISO 14001:2015', leadAuditor: 'Oliver Bennett', auditor: 'Charlotte Davies',
    date: day(-15), scheduledDate: day(-15), status: 'Completed', auditType: 'Recertification',
    auditName: 'Recertification — BritEnergy', auditScope: 'Renewable energy plants', country: 'United Kingdom' },
  { id: 'sch-uk-002', organizationName: 'Northstar Pharmaceuticals', client: 'Northstar Pharmaceuticals',
    standard: 'ISO 13485:2016', leadAuditor: 'Oliver Bennett', auditor: 'Charlotte Davies',
    date: day(14), scheduledDate: day(14), status: 'Scheduled', auditType: 'Initial Certification',
    auditName: 'Stage 1 — Northstar Pharma', auditScope: 'Medical device QMS', country: 'United Kingdom' },

  // Germany — Klaus Mueller + Lena Schwarz
  { id: 'sch-de-001', organizationName: 'AutoTeknik GmbH', client: 'AutoTeknik GmbH',
    standard: 'ISO 9001:2015', leadAuditor: 'Klaus Mueller', auditor: 'Lena Schwarz',
    date: day(-25), scheduledDate: day(-25), status: 'Completed', auditType: 'Surveillance 2',
    auditName: 'Surveillance 2 — AutoTeknik', auditScope: 'Plant 1 + suppliers', country: 'Germany' },
  { id: 'sch-de-002', organizationName: 'Berlin Cloud Services', client: 'Berlin Cloud Services',
    standard: 'ISO 27001:2022', leadAuditor: 'Klaus Mueller', auditor: 'Lena Schwarz',
    date: day(10), scheduledDate: day(10), status: 'Scheduled', auditType: 'Initial Certification',
    auditName: 'Stage 2 — Berlin Cloud', auditScope: 'ISMS + dev pipeline', country: 'Germany' },

  // India — Rajesh / Anita / Vikram / Priya
  { id: 'sch-in-001', organizationName: 'Hyderabad TechWorks', client: 'Hyderabad TechWorks',
    standard: 'ISO 27001:2022', leadAuditor: 'Rajesh Kumar', auditor: 'Priya Reddy',
    date: day(5), scheduledDate: day(5), status: 'Scheduled', auditType: 'Initial Certification',
    auditName: 'Stage 2 — Hyderabad TechWorks', auditScope: 'HQ + cloud infra', country: 'India' },
  { id: 'sch-in-002', organizationName: 'BlueWave Logistics', client: 'BlueWave Logistics',
    standard: 'ISO 9001:2015', leadAuditor: 'Anita Verma', auditor: 'Vikram Singh',
    date: day(-2), scheduledDate: day(-2), status: 'In Progress', auditType: 'Initial Certification',
    auditName: 'Stage 1 — BlueWave', auditScope: 'Hub operations', country: 'India' },
  { id: 'sch-in-003', organizationName: 'GreenGrove Foods', client: 'GreenGrove Foods',
    standard: 'ISO 22000:2018', leadAuditor: 'Anita Verma', auditor: 'Vikram Singh',
    date: day(14), scheduledDate: day(14), status: 'Scheduled', auditType: 'Surveillance 1',
    auditName: 'Surveillance 1 — GreenGrove', auditScope: 'Cold chain + HACCP', country: 'India' },

  // UAE — Ahmed Al-Rashid + Fatima Al-Maktoum
  { id: 'sch-ae-001', organizationName: 'Gulf Power LLC', client: 'Gulf Power LLC',
    standard: 'ISO 50001:2018', leadAuditor: 'Ahmed Al-Rashid', auditor: 'Fatima Al-Maktoum',
    date: day(-30), scheduledDate: day(-30), status: 'Completed', auditType: 'Initial Certification',
    auditName: 'Stage 2 — Gulf Power', auditScope: 'Energy mgmt', country: 'UAE' },
  { id: 'sch-ae-002', organizationName: 'Sand Dune Construction', client: 'Sand Dune Construction',
    standard: 'ISO 45001:2018', leadAuditor: 'Ahmed Al-Rashid', auditor: 'Fatima Al-Maktoum',
    date: day(28), scheduledDate: day(28), status: 'Scheduled', auditType: 'Surveillance 1',
    auditName: 'Surveillance 1 — Sand Dune', auditScope: 'Active sites', country: 'UAE' },

  // Singapore — Wei Lin
  { id: 'sch-sg-001', organizationName: 'FinSecure Pte', client: 'FinSecure Pte',
    standard: 'ISO 27001:2022', leadAuditor: 'Wei Lin', auditor: 'Wei Lin',
    date: day(-20), scheduledDate: day(-20), status: 'Completed', auditType: 'Recertification',
    auditName: 'Recertification — FinSecure', auditScope: 'ISMS', country: 'Singapore' },

  // Australia — Emma Thompson + Liam Brooks
  { id: 'sch-au-001', organizationName: 'MedTech Australia', client: 'MedTech Australia',
    standard: 'ISO 13485:2016', leadAuditor: 'Emma Thompson', auditor: 'Emma Thompson',
    date: day(-50), scheduledDate: day(-50), status: 'Completed', auditType: 'Surveillance 2',
    auditName: 'Surveillance 2 — MedTech', auditScope: 'Class II devices', country: 'Australia' },
  { id: 'sch-au-002', organizationName: 'OutbackMining Co', client: 'OutbackMining Co',
    standard: 'ISO 45001:2018', leadAuditor: 'Emma Thompson', auditor: 'Liam Brooks',
    date: day(35), scheduledDate: day(35), status: 'Scheduled', auditType: 'Initial Certification',
    auditName: 'Stage 1 — OutbackMining', auditScope: 'Mine sites', country: 'Australia' },

  // Brazil — Sofia Oliveira
  { id: 'sch-br-001', organizationName: 'Brasil AgroFoods SA', client: 'Brasil AgroFoods SA',
    standard: 'ISO 22000:2018', leadAuditor: 'Sofia Oliveira', auditor: 'Sofia Oliveira',
    date: day(-10), scheduledDate: day(-10), status: 'Completed', auditType: 'Surveillance 1',
    auditName: 'Surveillance 1 — Brasil AgroFoods', auditScope: 'Agriculture + packing', country: 'Brazil' },
];

/* ----------------------------------------------------------------
   CERTIFICATIONS — issued certificates
---------------------------------------------------------------- */
const buildCertifications = () => [
  { id: 1,  name: 'ISO 9001:2015 Certification — AutoTeknik', certificateId: 'CERT-2026-DE-0001', certificateDate: day(-110),
    client: 'AutoTeknik GmbH',    clientId: 'CMS-2026-DE-0001', description: 'QMS certification for manufacturing HQ',
    standard: 'ISO 9001:2015', validity: 36, renewalPeriod: '12 Months' },
  { id: 2,  name: 'ISO 14001:2015 Certification — BritEnergy', certificateId: 'CERT-2026-UK-0001', certificateDate: day(-13),
    client: 'BritEnergy Plc',     clientId: 'CMS-2026-UK-0001', description: 'Environmental management for renewable energy plants',
    standard: 'ISO 14001:2015', validity: 36, renewalPeriod: '12 Months' },
  { id: 3,  name: 'ISO 27001:2022 Certification — FinSecure', certificateId: 'CERT-2026-SG-0001', certificateDate: day(-18),
    client: 'FinSecure Pte',      clientId: 'CMS-2026-SG-0001', description: 'ISMS for fintech operations',
    standard: 'ISO 27001:2022', validity: 36, renewalPeriod: '12 Months' },
  { id: 4,  name: 'ISO 13485:2016 Certification — MedTech',   certificateId: 'CERT-2026-AU-0001', certificateDate: day(-48),
    client: 'MedTech Australia',  clientId: 'CMS-2026-AU-0001', description: 'Medical device QMS',
    standard: 'ISO 13485:2016', validity: 36, renewalPeriod: '12 Months' },
  { id: 5,  name: 'ISO 50001:2018 Certification — Gulf Power', certificateId: 'CERT-2026-AE-0001', certificateDate: day(-28),
    client: 'Gulf Power LLC',     clientId: 'CMS-2026-AE-0001', description: 'Energy management system',
    standard: 'ISO 50001:2018', validity: 36, renewalPeriod: '12 Months' },
  { id: 6,  name: 'ISO 22000:2018 Certification — Brasil AgroFoods', certificateId: 'CERT-2026-BR-0001', certificateDate: day(-8),
    client: 'Brasil AgroFoods SA', clientId: 'CMS-2026-BR-0001', description: 'Food safety MS',
    standard: 'ISO 22000:2018', validity: 36, renewalPeriod: '12 Months' },
  { id: 7,  name: 'ISO 9001:2015 Surveillance Cert — Acme USA', certificateId: 'CERT-2026-USA-0001', certificateDate: day(-200),
    client: 'Acme Industries USA', clientId: 'CMS-2026-USA-0001', description: 'QMS — initial certification',
    standard: 'ISO 9001:2015', validity: 36, renewalPeriod: '12 Months' },
];

/* ----------------------------------------------------------------
   AUDIT REPORTS — recent draft + final reports
---------------------------------------------------------------- */
const buildReports = () => [
  {
    id: 'rpt-001', auditId: 'sch-uk-001', client: 'BritEnergy Plc',
    standard: 'ISO 14001:2015', auditType: 'Recertification',
    leadAuditor: 'Oliver Bennett', auditor: 'Charlotte Davies',
    country: 'United Kingdom',
    auditDate: day(-15),
    submittedAt: isoDay(-12),
    reportType: 'Final',
    status: 'Approved',
    findingsTotal: 4, major: 1, minor: 2, ofi: 1,
    summary: 'Recertification audit complete. One Major finding raised (energy efficiency dashboard outdated), closed within 30 days. Recertification recommended.',
    recommendation: 'Recommend renewal of ISO 14001 certificate for 3 years.',
  },
  {
    id: 'rpt-002', auditId: 'sch-de-001', client: 'AutoTeknik GmbH',
    standard: 'ISO 9001:2015', auditType: 'Surveillance 2',
    leadAuditor: 'Klaus Mueller', auditor: 'Lena Schwarz',
    country: 'Germany',
    auditDate: day(-25),
    submittedAt: isoDay(-22),
    reportType: 'Final',
    status: 'Approved',
    findingsTotal: 3, major: 1, minor: 1, ofi: 1,
    summary: 'Second annual surveillance — process map outdated for one production line. Corrective actions closed; certificate remains in good standing.',
    recommendation: 'Maintain certification; next surveillance in 12 months.',
  },
  {
    id: 'rpt-003', auditId: 'sch-ae-001', client: 'Gulf Power LLC',
    standard: 'ISO 50001:2018', auditType: 'Initial Certification',
    leadAuditor: 'Ahmed Al-Rashid', auditor: 'Fatima Al-Maktoum',
    country: 'UAE',
    auditDate: day(-30),
    submittedAt: isoDay(-25),
    reportType: 'Final',
    status: 'Approved',
    findingsTotal: 2, major: 0, minor: 2, ofi: 0,
    summary: 'Initial certification audit complete. Two Minor findings; both closed. Energy management system meets ISO 50001:2018.',
    recommendation: 'Issue ISO 50001 certificate, 3-year validity.',
  },
  {
    id: 'rpt-004', auditId: 'sch-sg-001', client: 'FinSecure Pte',
    standard: 'ISO 27001:2022', auditType: 'Recertification',
    leadAuditor: 'Wei Lin', auditor: 'Wei Lin',
    country: 'Singapore',
    auditDate: day(-20),
    submittedAt: isoDay(-18),
    reportType: 'Final',
    status: 'Approved',
    findingsTotal: 3, major: 0, minor: 2, ofi: 1,
    summary: 'Recertification — ISMS scope expanded to include payments operations. All controls verified.',
    recommendation: 'Recertify for 3 years with expanded scope.',
  },
  {
    id: 'rpt-005', auditId: 'sch-au-001', client: 'MedTech Australia',
    standard: 'ISO 13485:2016', auditType: 'Surveillance 2',
    leadAuditor: 'Emma Thompson', auditor: 'Emma Thompson',
    country: 'Australia',
    auditDate: day(-50),
    submittedAt: isoDay(-45),
    reportType: 'Final',
    status: 'Approved',
    findingsTotal: 2, major: 0, minor: 1, ofi: 1,
    summary: 'Surveillance 2 — medical device QMS maintained. One Minor on supplier validation closed in 21 days.',
    recommendation: 'Maintain certification; next is Recertification audit.',
  },
  {
    id: 'rpt-006', auditId: 'sch-in-002', client: 'BlueWave Logistics',
    standard: 'ISO 9001:2015', auditType: 'Initial Certification',
    leadAuditor: 'Anita Verma', auditor: 'Vikram Singh',
    country: 'India',
    auditDate: day(-2),
    submittedAt: isoDay(-1),
    reportType: 'Draft',
    status: 'Draft',
    findingsTotal: 3, major: 1, minor: 1, ofi: 1,
    summary: 'Stage 1 readiness in progress. Process map incomplete for reverse logistics — to be addressed before Stage 2.',
    recommendation: 'Address findings before Stage 2 audit.',
  },
  {
    id: 'rpt-007', auditId: 'sch-br-001', client: 'Brasil AgroFoods SA',
    standard: 'ISO 22000:2018', auditType: 'Surveillance 1',
    leadAuditor: 'Sofia Oliveira', auditor: 'Sofia Oliveira',
    country: 'Brazil',
    auditDate: day(-10),
    submittedAt: isoDay(-8),
    reportType: 'Final',
    status: 'Approved',
    findingsTotal: 3, major: 0, minor: 2, ofi: 1,
    summary: 'Surveillance 1 — food safety MS performing well. Two Minor findings on allergen labelling closed within 14 days.',
    recommendation: 'Maintain certification; Surveillance 2 scheduled in 12 months.',
  },
];

/* ----------------------------------------------------------------
   APPLICATION DISPATCHES — Sent / Received / Approved applications
---------------------------------------------------------------- */
const buildDispatches = () => [
  // Sent (awaiting client to fill the digital form)
  { id: 1001, clientName: 'Daniel Park',     organization: 'Acme Industries USA',    mobile: '+1 212 444 0201',  contactName: 'Daniel Park',
    applicationType: 'Initial Certification', standard: 'ISO 9001:2015',
    email: 'd.park@acme-us.com',            dispatchedDate: day(-7),  status: 'Sent',     country: 'USA',
    sentAt: isoDay(-7), deliveredAt: isoDay(-7), readAt: isoDay(-6) },
  { id: 1002, clientName: 'Rachel Kim',      organization: 'TechCore Inc',           mobile: '+1 415 444 0202',  contactName: 'Rachel Kim',
    applicationType: 'Surveillance 1',         standard: 'ISO 27001:2022',
    email: 'r.kim@techcore.com',            dispatchedDate: day(-3),  status: 'Pending',  country: 'USA',
    sentAt: isoDay(-3) },
  { id: 1003, clientName: 'Sneha Patel',     organization: 'Lumen AI Labs',          mobile: '+65 6444 0213',     contactName: 'Sneha Patel',
    applicationType: 'Initial Certification', standard: 'ISO 42001:2023',
    email: 'sneha@lumenai.io',              dispatchedDate: day(-1),  status: 'Sent',     country: 'Singapore',
    sentAt: isoDay(-1), deliveredAt: isoDay(-1) },

  // Received (client submitted the digital form back)
  { id: 1004, clientName: 'Anna Becker',     organization: 'Berlin Cloud Services',  mobile: '+49 30 444 0206',   contactName: 'Anna Becker',
    applicationType: 'Initial Certification', standard: 'ISO 27001:2022',
    email: 'a.becker@berlincloud.de',       dispatchedDate: day(-14), status: 'Received', country: 'Germany',
    sentAt: isoDay(-14), deliveredAt: isoDay(-14), readAt: isoDay(-13),
    clientSubmittedAt: isoDay(-5),
    clientFormFields: {
      address: 'Friedrichstr. 123, 10117 Berlin', industry: 'Software / IT', employees: '85',
      standardsInterested: ['ISO 27001:2022', 'ISO 9001:2015'], preferredStart: day(15), preferredEnd: day(17),
      additionalNotes: 'Targeting enterprise EU SaaS customers. Stage 1 + Stage 2 needed.',
    },
  },
  { id: 1005, clientName: 'Mariam Hassan',   organization: 'Sand Dune Construction', mobile: '+971 2 444 0211',   contactName: 'Mariam Hassan',
    applicationType: 'Surveillance 1',         standard: 'ISO 45001:2018',
    email: 'mariam@sanddune.ae',            dispatchedDate: day(-21), status: 'Received', country: 'UAE',
    sentAt: isoDay(-21), deliveredAt: isoDay(-21), readAt: isoDay(-20),
    clientSubmittedAt: isoDay(-9),
    clientFormFields: {
      address: 'Sheikh Zayed Rd, Abu Dhabi', industry: 'Construction', employees: '320',
      standardsInterested: ['ISO 45001:2018'], preferredStart: day(28), preferredEnd: day(30),
    },
  },

  // Approved (already reviewed and waiting for client registration)
  { id: 1006, clientName: 'Olivia Brown',    organization: 'OutbackMining Co',       mobile: '+61 8 5444 0215',   contactName: 'Olivia Brown',
    applicationType: 'Initial Certification', standard: 'ISO 45001:2018',
    email: 'olivia@outbackmining.com.au',   dispatchedDate: day(-35), status: 'Approved', country: 'Australia',
    sentAt: isoDay(-35), deliveredAt: isoDay(-35), readAt: isoDay(-34),
    clientSubmittedAt: isoDay(-25),
    reviewDate: day(-15),
    clientFormFields: {
      address: 'Hay St, Perth WA 6000', industry: 'Manufacturing', employees: '180',
      standardsInterested: ['ISO 45001:2018'], preferredStart: day(35), preferredEnd: day(38),
    },
  },
];

/* ----------------------------------------------------------------
   ISSUED CERTIFICATES — separate `cms_certificates` store
---------------------------------------------------------------- */
const buildCertificates = () => [
  {
    id: 'cert-001', clientId: 205, organizationName: 'AutoTeknik GmbH',
    certificateNumber: 'QCS-DE-9001-2026-0001', standard: 'ISO 9001:2015',
    issueDate: day(-110), expiryDate: day(985),
    surveillance1Due: day(255), surveillance2Due: day(620), recertificationDueDate: day(985),
    status: 'Active', type: 'Initial Certification', country: 'Germany',
  },
  {
    id: 'cert-002', clientId: 203, organizationName: 'BritEnergy Plc',
    certificateNumber: 'QCS-UK-14001-2026-0001', standard: 'ISO 14001:2015',
    issueDate: day(-13), expiryDate: day(1082),
    surveillance1Due: day(352), surveillance2Due: day(717), recertificationDueDate: day(1082),
    status: 'Active', type: 'Recertification', country: 'United Kingdom',
  },
  {
    id: 'cert-003', clientId: 212, organizationName: 'FinSecure Pte',
    certificateNumber: 'QCS-SG-27001-2026-0001', standard: 'ISO 27001:2022',
    issueDate: day(-18), expiryDate: day(1077),
    surveillance1Due: day(347), surveillance2Due: day(712), recertificationDueDate: day(1077),
    status: 'Active', type: 'Recertification', country: 'Singapore',
  },
  {
    id: 'cert-004', clientId: 214, organizationName: 'MedTech Australia',
    certificateNumber: 'QCS-AU-13485-2026-0001', standard: 'ISO 13485:2016',
    issueDate: day(-48), expiryDate: day(1047),
    surveillance1Due: day(317), surveillance2Due: day(682), recertificationDueDate: day(1047),
    status: 'Active', type: 'Surveillance 2', country: 'Australia',
  },
  {
    id: 'cert-005', clientId: 210, organizationName: 'Gulf Power LLC',
    certificateNumber: 'QCS-AE-50001-2026-0001', standard: 'ISO 50001:2018',
    issueDate: day(-28), expiryDate: day(1067),
    surveillance1Due: day(337), surveillance2Due: day(702), recertificationDueDate: day(1067),
    status: 'Active', type: 'Initial Certification', country: 'UAE',
  },
  {
    id: 'cert-006', clientId: 216, organizationName: 'Brasil AgroFoods SA',
    certificateNumber: 'QCS-BR-22000-2026-0001', standard: 'ISO 22000:2018',
    issueDate: day(-8), expiryDate: day(1087),
    surveillance1Due: day(357), surveillance2Due: day(722), recertificationDueDate: day(1087),
    status: 'Active', type: 'Surveillance 1', country: 'Brazil',
  },
  {
    id: 'cert-007', clientId: 201, organizationName: 'Acme Industries USA',
    certificateNumber: 'QCS-USA-9001-2025-0007', standard: 'ISO 9001:2015',
    issueDate: day(-200), expiryDate: day(895),
    surveillance1Due: day(165), surveillance2Due: day(530), recertificationDueDate: day(895),
    status: 'Active', type: 'Initial Certification', country: 'USA',
  },
];

/* ----------------------------------------------------------------
   REMINDER + DISPATCH + RENEWAL logs
---------------------------------------------------------------- */
const buildReminderLog = () => [
  { id: 'rem-001', scheduleId: 'sch-usa-001', client: 'Acme Industries USA',
    type: 'Schedule Confirmation', sentAt: isoDay(-2), sentBy: 'Audit Coordinator',
    channel: 'Email', subject: 'Reminder: confirm Stage 2 schedule', success: true },
  { id: 'rem-002', scheduleId: 'sch-in-001', client: 'Hyderabad TechWorks',
    type: 'Schedule Confirmation', sentAt: isoDay(-1), sentBy: 'Audit Coordinator',
    channel: 'Email', subject: 'Reminder: confirm Stage 2 schedule', success: true },
  { id: 'rem-003', scheduleId: 'sch-ae-002', client: 'Sand Dune Construction',
    type: 'Pre-audit reminder', sentAt: isoDay(-1), sentBy: 'Audit Coordinator',
    channel: 'Email', subject: 'Surveillance 1 — 28 days away', success: true },
];

const buildDispatchLog = () => [
  { id: 'disp-001', certificateId: 'cert-002', client: 'BritEnergy Plc',
    channel: 'Email', sentAt: isoDay(-13), recipient: 'h.watson@britenergy.co.uk', success: true,
    template: 'Certificate delivery — ISO 14001' },
  { id: 'disp-002', certificateId: 'cert-003', client: 'FinSecure Pte',
    channel: 'WhatsApp', sentAt: isoDay(-18), recipient: '+65 6444 0212', success: true,
    template: 'Certificate delivery — ISO 27001' },
  { id: 'disp-003', certificateId: 'cert-005', client: 'Gulf Power LLC',
    channel: 'Email', sentAt: isoDay(-28), recipient: 'o.khalil@gulfpower.ae', success: true,
    template: 'Certificate delivery — ISO 50001' },
];

const buildRenewalLog = () => [
  { id: 'ren-001', certificateId: 'cert-001', client: 'AutoTeknik GmbH',
    daysToRenewal: 985, status: 'Active', sentAt: isoDay(-30),
    channel: 'Email', template: 'Surveillance reminder T-90' },
  { id: 'ren-002', certificateId: 'cert-007', client: 'Acme Industries USA',
    daysToRenewal: 895, status: 'Active', sentAt: isoDay(-15),
    channel: 'Email', template: 'Surveillance reminder T-180' },
];

/* ----------------------------------------------------------------
   Helpers
---------------------------------------------------------------- */
const writeIfEmpty = (key: string, value: any[]): boolean => {
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
 * Seed all CMS surfaces with global demo data. Idempotent.
 */
export const seedGlobalDemo = (): boolean => {
  try {
    if (localStorage.getItem(GLOBAL_FLAG_KEY) === '1') return false;
    let wrote = false;

    // Auditors (both keys used by different surfaces)
    if (writeIfEmpty(KEYS.auditors,     buildAuditors())) wrote = true;
    if (writeIfEmpty(KEYS.auditorsData, buildAuditors())) wrote = true;

    if (writeIfEmpty(KEYS.clients,        buildClients()))         wrote = true;
    if (writeIfEmpty(KEYS.scopes,         buildScopes()))          wrote = true;
    if (writeIfEmpty(KEYS.types,          buildTypes()))           wrote = true;
    if (writeIfEmpty(KEYS.checklists,     buildChecklists()))      wrote = true;
    if (writeIfEmpty(KEYS.schedules,      buildSchedules()))       wrote = true;
    if (writeIfEmpty(KEYS.certifications, buildCertifications()))  wrote = true;
    if (writeIfEmpty(KEYS.reports,        buildReports()))         wrote = true;
    if (writeIfEmpty(KEYS.dispatch,       buildDispatches()))      wrote = true;
    if (writeIfEmpty(KEYS.certificates,   buildCertificates()))    wrote = true;
    if (writeIfEmpty(KEYS.reminderLog,    buildReminderLog()))     wrote = true;
    if (writeIfEmpty(KEYS.dispatchLog,    buildDispatchLog()))     wrote = true;
    if (writeIfEmpty(KEYS.renewalLog,     buildRenewalLog()))      wrote = true;
    if (writeIfEmpty(KEYS.scheduleRequests, buildScheduleRequests())) wrote = true;
    if (!localStorage.getItem('cms_lead_auditor_name')) {
      localStorage.setItem('cms_lead_auditor_name', 'Leo Ashford');
    }

    // Stamp the global flag + clear stale per-surface seed flags so the
    // per-surface seeders (findings, workflow, dashboard) can run if needed.
    localStorage.setItem(GLOBAL_FLAG_KEY, '1');
    // Mark per-surface seed flags so they don't overwrite our global data
    localStorage.setItem(KEYS.dashboardFlag, '1');
    localStorage.setItem(KEYS.certsFlag,     '1');
    return wrote;
  } catch {
    return false;
  }
};

/* ----------------------------------------------------------------
   SCHEDULE REQUESTS — pending requests feeding the Request Schedule page
---------------------------------------------------------------- */
const buildScheduleRequests = () => [
  {
    id: 'SRQ-2026-001', organization: 'Acme Manufacturing',
    auditor: 'Aaron Diaz', leadAuditor: 'Michael Reynolds',
    date: day(7), duration: '2', auditType: 'Surveillance',
    certificationStandard: 'ISO 9001:2015',
    notes: 'Client requested morning sessions only.', status: 'Pending',
  },
  {
    id: 'SRQ-2026-002', organization: 'TechFlow Solutions',
    auditor: 'Aaron Diaz', leadAuditor: 'Michael Reynolds',
    date: day(14), duration: '3', auditType: 'Initial',
    certificationStandard: 'ISO 27001:2022',
    notes: 'Stage 1 readiness — two sites.', status: 'Pending',
  },
  {
    id: 'SRQ-2026-003', organization: 'GreenEarth Logistics',
    auditor: 'Aaron Diaz', leadAuditor: 'Michael Reynolds',
    date: day(21), duration: '1', auditType: 'Recertification',
    certificationStandard: 'ISO 14001:2015',
    notes: '', status: 'Confirmed',
  },
];

/**
 * Helper: find the Lead Auditor assigned to a given country.
 * Used by Audit Schedules & Smart-Assign when routing audits globally.
 */
export const getCountryLeadAuditor = (country: string): { name: string; email: string } | null => {
  try {
    const raw = localStorage.getItem(KEYS.auditors);
    if (!raw) return null;
    const auditors = JSON.parse(raw);
    if (!Array.isArray(auditors)) return null;
    const match = auditors.find(
      (a: any) =>
        a.country === country &&
        a.role === 'Lead Auditor' &&
        a.approvalStatus === 'Approved' &&
        a.status === 'Active'
    );
    return match ? { name: match.name, email: match.email } : null;
  } catch {
    return null;
  }
};

/**
 * Helper: list every approved auditor in a given country.
 */
export const getCountryAuditors = (country: string): Array<{ name: string; email: string; role: string }> => {
  try {
    const raw = localStorage.getItem(KEYS.auditors);
    if (!raw) return [];
    const auditors = JSON.parse(raw);
    if (!Array.isArray(auditors)) return [];
    return auditors
      .filter(
        (a: any) =>
          a.country === country &&
          a.approvalStatus === 'Approved' &&
          a.status === 'Active'
      )
      .map((a: any) => ({ name: a.name, email: a.email, role: a.role }));
  } catch {
    return [];
  }
};

/**
 * Helper: the full list of countries currently in play.
 */
export const SUPPORTED_COUNTRIES = [
  'USA',
  'United Kingdom',
  'Germany',
  'India',
  'UAE',
  'Singapore',
  'Australia',
  'Brazil',
  'Canada',
  'France',
  'Japan',
  'South Africa',
  'Netherlands',
  'Spain',
  'Italy',
  'Mexico',
  'Saudi Arabia',
  'China',
];
