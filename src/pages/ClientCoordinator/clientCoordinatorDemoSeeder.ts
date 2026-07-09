/**
 * Client Coordinator — Demo Data Seeder
 *
 * Seeds realistic data for "Green Energy Solutions" (org id=1) into the
 * shared localStorage keys that the CC portal reads from:
 *
 *   cms_certificates          — 12 issued certificates (clientId: 1)
 *   cms_org_branches_v1       — 5 branches
 *   cms_audit_schedules       — 8 audit schedules
 *   cms_audit_reports         — 6 audit reports
 *
 * Runs once per version; bump SEED_VERSION to force a re-seed.
 * Also clears stale cms_org_certs_v1 (old key without orgId suffix).
 */

const SEED_VERSION = 'cms_cc_demo_seeded_v4';
const ORG_ID = 1;
const ORG_NAME = 'Green Energy Solutions';

// ── Date helpers ────────────────────────────────────────────────
const d = (offset: number): string => {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().slice(0, 10);
};

const addM = (iso: string, months: number): string => {
  const dt = new Date(iso);
  dt.setMonth(dt.getMonth() + months);
  return dt.toISOString().slice(0, 10);
};

// ── Branch definitions ───────────────────────────────────────────
const BRANCHES = [
  { id: 11, orgId: ORG_ID, name: 'Head Office',             location: 'Mumbai, Maharashtra', manager: 'John Doe'          },
  { id: 12, orgId: ORG_ID, name: 'Solar Plant — Rajasthan', location: 'Jodhpur, Rajasthan',  manager: 'Priya Singh'       },
  { id: 13, orgId: ORG_ID, name: 'Wind Farm — Gujarat',     location: 'Kutch, Gujarat',       manager: 'Vijay Patel'       },
  { id: 14, orgId: ORG_ID, name: 'R&D Centre',              location: 'Pune, Maharashtra',    manager: 'Dr. Neha Kulkarni' },
  { id: 15, orgId: ORG_ID, name: 'Distribution Hub',        location: 'New Delhi',            manager: 'Rohit Mehta'       },
];

// ── Certificate raw specs (dates as day-offsets from today) ──────
interface RawCert {
  id: string; branchId: number; branchName: string;
  certNumber: string; standard: string; scope: string;
  issueOffset: number; expiryOffset: number;
}

const RAW_CERTS: RawCert[] = [
  // Active certs
  { id: 'ges-cert-001', branchId: 11, branchName: 'Head Office',
    certNumber: 'GES-IND-9001-2022-001', standard: 'ISO 9001:2015',
    scope: 'Quality management for administration & procurement',
    issueOffset: -1070, expiryOffset: 25 + 315 },   // 340 days left
  { id: 'ges-cert-002', branchId: 12, branchName: 'Solar Plant — Rajasthan',
    certNumber: 'GES-IND-9001-2023-002', standard: 'ISO 9001:2015',
    scope: 'Quality management for solar panel installation & testing',
    issueOffset: -1040, expiryOffset: 465 },
  { id: 'ges-cert-003', branchId: 12, branchName: 'Solar Plant — Rajasthan',
    certNumber: 'GES-IND-14001-2023-001', standard: 'ISO 14001:2015',
    scope: 'Environmental management for solar energy generation',
    issueOffset: -1010, expiryOffset: 400 },
  { id: 'ges-cert-004', branchId: 13, branchName: 'Wind Farm — Gujarat',
    certNumber: 'GES-IND-45001-2024-001', standard: 'ISO 45001:2018',
    scope: 'OH&S management for wind turbine operations & maintenance',
    issueOffset: -590, expiryOffset: 500 },
  { id: 'ges-cert-005', branchId: 13, branchName: 'Wind Farm — Gujarat',
    certNumber: 'GES-IND-9001-2024-003', standard: 'ISO 9001:2015',
    scope: 'Quality management for wind turbine maintenance',
    issueOffset: -565, expiryOffset: 525 },
  { id: 'ges-cert-006', branchId: 14, branchName: 'R&D Centre',
    certNumber: 'GES-IND-27001-2024-001', standard: 'ISO 27001:2022',
    scope: 'Information security management for R&D & IP protection',
    issueOffset: -545, expiryOffset: 545 },
  { id: 'ges-cert-007', branchId: 14, branchName: 'R&D Centre',
    certNumber: 'GES-IND-14001-2024-003', standard: 'ISO 14001:2015',
    scope: 'Environmental management for research & laboratory facilities',
    issueOffset: -380, expiryOffset: 715 },
  { id: 'ges-cert-008', branchId: 15, branchName: 'Distribution Hub',
    certNumber: 'GES-IND-50001-2024-001', standard: 'ISO 50001:2018',
    scope: 'Energy management for logistics & warehousing operations',
    issueOffset: -449, expiryOffset: 646 },
  // Expiring Soon (≤30 days)
  { id: 'ges-cert-009', branchId: 11, branchName: 'Head Office',
    certNumber: 'GES-IND-50001-2023-002', standard: 'ISO 50001:2018',
    scope: 'Energy management for corporate headquarters & facilities',
    issueOffset: -1081, expiryOffset: 14 },
  { id: 'ges-cert-010', branchId: 11, branchName: 'Head Office',
    certNumber: 'GES-IND-27001-2023-002', standard: 'ISO 27001:2022',
    scope: 'Information security management for corporate IT systems',
    issueOffset: -1076, expiryOffset: 19 },
  // Expired
  { id: 'ges-cert-011', branchId: 11, branchName: 'Head Office',
    certNumber: 'GES-IND-14001-2023-003', standard: 'ISO 14001:2015',
    scope: 'Environmental management for corporate office operations',
    issueOffset: -1110, expiryOffset: -15 },
  { id: 'ges-cert-012', branchId: 12, branchName: 'Solar Plant — Rajasthan',
    certNumber: 'GES-IND-45001-2023-004', standard: 'ISO 45001:2018',
    scope: 'OH&S management for solar installation field teams',
    issueOffset: -1130, expiryOffset: -30 },
];

const buildCerts = () =>
  RAW_CERTS.map((c) => {
    const issueDate = d(c.issueOffset);
    const expiryDate = d(c.expiryOffset);
    return {
      id: c.id,
      clientId: ORG_ID,
      organizationName: ORG_NAME,
      branchId: c.branchId,
      branchName: c.branchName,
      certificateNumber: c.certNumber,
      standard: c.standard,
      type: 'Certification scope',
      scope: c.scope,
      issueDate,
      expiryDate,
      surveillance1Due: addM(expiryDate, -24),
      surveillance2Due: addM(expiryDate, -12),
      recertificationDueDate: addM(expiryDate, -3),
      status: c.expiryOffset < 0 ? 'Expired' : c.expiryOffset <= 30 ? 'Expiring Soon' : 'Active',
      country: 'India',
    };
  });

// ── Audit Schedules ──────────────────────────────────────────────
const buildSchedules = () => [
  { id: 'ges-sch-001', organizationName: ORG_NAME, clientId: ORG_ID,
    auditType: 'Surveillance 1', date: d(-112), standard: 'ISO 14001:2015',
    leadAuditor: 'Anita Verma', auditor: 'Anita Verma', status: 'Completed',
    branchId: 12, branchName: 'Solar Plant — Rajasthan' },
  { id: 'ges-sch-002', organizationName: ORG_NAME, clientId: ORG_ID,
    auditType: 'Surveillance 2', date: d(-77), standard: 'ISO 9001:2015',
    leadAuditor: 'Rajesh Kumar', auditor: 'Rajesh Kumar', status: 'Completed',
    branchId: 11, branchName: 'Head Office' },
  { id: 'ges-sch-003', organizationName: ORG_NAME, clientId: ORG_ID,
    auditType: 'Recertification', date: d(-49), standard: 'ISO 9001:2015',
    leadAuditor: 'Vikram Singh', auditor: 'Vikram Singh', status: 'Completed',
    branchId: 11, branchName: 'Head Office' },
  { id: 'ges-sch-004', organizationName: ORG_NAME, clientId: ORG_ID,
    auditType: 'Recertification', date: d(19), standard: 'ISO 14001:2015',
    leadAuditor: 'Anita Verma', auditor: 'Anita Verma', status: 'Scheduled',
    branchId: 11, branchName: 'Head Office',
    notes: 'Urgent — certificate expiring soon.' },
  { id: 'ges-sch-005', organizationName: ORG_NAME, clientId: ORG_ID,
    auditType: 'Surveillance 1', date: d(34), standard: 'ISO 50001:2018',
    leadAuditor: 'Sandeep Joshi', auditor: 'Sandeep Joshi', status: 'Confirmed',
    branchId: 15, branchName: 'Distribution Hub' },
  { id: 'ges-sch-006', organizationName: ORG_NAME, clientId: ORG_ID,
    auditType: 'Surveillance 2', date: d(60), standard: 'ISO 45001:2018',
    leadAuditor: 'Priya Reddy', auditor: 'Priya Reddy', status: 'Scheduled',
    branchId: 12, branchName: 'Solar Plant — Rajasthan' },
  { id: 'ges-sch-007', organizationName: ORG_NAME, clientId: ORG_ID,
    auditType: 'Surveillance 1', date: d(97), standard: 'ISO 27001:2022',
    leadAuditor: 'Rajesh Kumar', auditor: 'Rajesh Kumar', status: 'Pending',
    branchId: 14, branchName: 'R&D Centre' },
  { id: 'ges-sch-008', organizationName: ORG_NAME, clientId: ORG_ID,
    auditType: 'Surveillance 2', date: d(136), standard: 'ISO 45001:2018',
    leadAuditor: 'Anita Verma', auditor: 'Anita Verma', status: 'Pending',
    branchId: 13, branchName: 'Wind Farm — Gujarat' },
];

// ── Audit Reports ────────────────────────────────────────────────
const buildReports = () => [
  { id: 'ges-rep-001', client: ORG_NAME, clientId: ORG_ID,
    auditDate: d(-112), leadAuditor: 'Anita Verma',
    standard: 'ISO 14001:2015', branchId: 12, branchName: 'Solar Plant — Rajasthan',
    auditType: 'Surveillance 1',
    major: 0, minor: 2, ofi: 1, findingsTotal: 3, status: 'Issued',
    summary: 'Surveillance 1 completed. Minor NCs in waste management documentation. OFI raised for energy monitoring frequency.' },
  { id: 'ges-rep-002', client: ORG_NAME, clientId: ORG_ID,
    auditDate: d(-77), leadAuditor: 'Rajesh Kumar',
    standard: 'ISO 9001:2015', branchId: 11, branchName: 'Head Office',
    auditType: 'Surveillance 2',
    major: 1, minor: 3, ofi: 1, findingsTotal: 5, status: 'Issued',
    summary: 'Surveillance 2 audit completed. One major NC for supplier qualification records. Three minor NCs in document control. Corrective action plan submitted.' },
  { id: 'ges-rep-003', client: ORG_NAME, clientId: ORG_ID,
    auditDate: d(-49), leadAuditor: 'Vikram Singh',
    standard: 'ISO 9001:2015', branchId: 11, branchName: 'Head Office',
    auditType: 'Recertification',
    major: 0, minor: 1, ofi: 1, findingsTotal: 2, status: 'Issued',
    summary: 'Recertification audit successful. One minor NC in internal audit frequency. Certificate recommended for renewal for 3 years.' },
  { id: 'ges-rep-004', client: ORG_NAME, clientId: ORG_ID,
    auditDate: d(-300), leadAuditor: 'Sandeep Joshi',
    standard: 'ISO 14001:2015', branchId: 14, branchName: 'R&D Centre',
    auditType: 'Initial Certification',
    major: 0, minor: 3, ofi: 1, findingsTotal: 4, status: 'Issued',
    summary: 'Initial certification for R&D Centre. Three minor NCs on aspects register completeness and emergency preparedness drills.' },
  { id: 'ges-rep-005', client: ORG_NAME, clientId: ORG_ID,
    auditDate: d(-215), leadAuditor: 'Anita Verma',
    standard: 'ISO 14001:2015', branchId: 11, branchName: 'Head Office',
    auditType: 'Recertification',
    major: 2, minor: 3, ofi: 1, findingsTotal: 6, status: 'Under Review',
    summary: '2 major NCs raised in legal compliance register and management review records. Under review pending closure verification.' },
  { id: 'ges-rep-006', client: ORG_NAME, clientId: ORG_ID,
    auditDate: d(-290), leadAuditor: 'Priya Reddy',
    standard: 'ISO 45001:2018', branchId: 12, branchName: 'Solar Plant — Rajasthan',
    auditType: 'Surveillance 1',
    major: 0, minor: 2, ofi: 0, findingsTotal: 2, status: 'Issued',
    summary: 'Two minor NCs on PPE compliance documentation. No major concerns. Positive observation on safety culture at Solar Plant.' },
];

// ── Main seeder ──────────────────────────────────────────────────
export const seedClientCoordinatorDemo = (): void => {
  try {
    if (localStorage.getItem(SEED_VERSION) === '1') return;

    // 1. Ensure org exists in cms_client_registrations
    const REG_KEY = 'cms_client_registrations';
    const clients: any[] = JSON.parse(localStorage.getItem(REG_KEY) || '[]');
    if (!clients.find((c: any) => Number(c.id) === ORG_ID)) {
      clients.unshift({
        id: ORG_ID, clientCode: 'CMS-2025-0001',
        organizationName: ORG_NAME, contactPerson: 'John Doe',
        registrationNumber: 'REG-2025-001', clientType: 'Initial Certification',
        standard: 'ISO 9001:2015', status: 'Registered',
        email: 'info@greenenergy.com', phone: '9876543210',
        address: '123 Green Way, NY', country: 'India', industry: 'Energy & Utilities',
      });
      localStorage.setItem(REG_KEY, JSON.stringify(clients));
    }

    // 2. Set active org if not already set
    if (!localStorage.getItem('cms_active_org_id')) {
      localStorage.setItem('cms_active_org_id', String(ORG_ID));
    }

    // 3. Seed branches (merge — preserve other orgs)
    const BRANCH_KEY = 'cms_org_branches_v1';
    const allBranches: any[] = JSON.parse(localStorage.getItem(BRANCH_KEY) || '[]');
    const otherBranches = allBranches.filter((b: any) => Number(b.orgId) !== ORG_ID);
    localStorage.setItem(BRANCH_KEY, JSON.stringify([...otherBranches, ...BRANCHES]));

    // 4. Seed certificates into cms_certificates (merge)
    const CERT_KEY = 'cms_certificates';
    const allCerts: any[] = JSON.parse(localStorage.getItem(CERT_KEY) || '[]');
    const otherCerts = allCerts.filter((c: any) => Number(c.clientId) !== ORG_ID);
    localStorage.setItem(CERT_KEY, JSON.stringify([...otherCerts, ...buildCerts()]));

    // 5. Seed audit schedules (merge)
    const SCHED_KEY = 'cms_audit_schedules';
    const allScheds: any[] = JSON.parse(localStorage.getItem(SCHED_KEY) || '[]');
    const otherScheds = allScheds.filter(
      (s: any) => s.organizationName !== ORG_NAME && Number(s.clientId) !== ORG_ID,
    );
    localStorage.setItem(SCHED_KEY, JSON.stringify([...otherScheds, ...buildSchedules()]));

    // 6. Seed audit reports (merge)
    const REP_KEY = 'cms_audit_reports';
    const allReps: any[] = JSON.parse(localStorage.getItem(REP_KEY) || '[]');
    const otherReps = allReps.filter(
      (r: any) => r.client !== ORG_NAME && Number(r.clientId) !== ORG_ID,
    );
    localStorage.setItem(REP_KEY, JSON.stringify([...otherReps, ...buildReports()]));

    // 7. Clear stale synthetic keys so fresh seeded data takes priority
    localStorage.removeItem('cms_org_certs_v1');
    localStorage.removeItem(`cms_org_certs_v1_${ORG_ID}`);
    localStorage.removeItem(`cms_org_schedules_v1_${ORG_ID}`);
    localStorage.removeItem(`cms_org_reports_v1_${ORG_ID}`);

    // 8. Mark seeded
    localStorage.setItem(SEED_VERSION, '1');

    // 9. Notify live components
    window.dispatchEvent(new Event('cms-cc-data-changed'));
    window.dispatchEvent(new Event('cms-data-update'));
  } catch (err) {
    console.warn('[CC Demo Seeder] Failed:', err);
  }
};
