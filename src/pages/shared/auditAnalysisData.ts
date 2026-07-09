/**
 * Shared types and helpers for audit findings.
 *
 * The analysis surfaces (Audit Coordinator + Lead Auditor) read from this
 * single, normalised store regardless of where the finding was authored.
 *
 * Storage key: `cms_audit_findings_v1`
 */

export type FindingCategory = 'Major' | 'Minor' | 'OFI' | 'Observation';
export type FindingStatus = 'Open' | 'In Progress' | 'Closed';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface AuditFinding {
  id: string;
  auditId: string;          // reference to a cms_audit_schedules row
  auditTitle: string;       // human-friendly audit name
  client: string;           // organisation name
  standard: string;         // ISO standard, e.g. "ISO 9001:2015"
  date: string;             // YYYY-MM-DD
  category: FindingCategory;
  severity: FindingSeverity;
  clause: string;           // ISO clause, e.g. "8.5.1"
  department: string;       // observed department
  title: string;
  description: string;
  recommendation: string;
  status: FindingStatus;
  reportedAt: string;       // ISO datetime
}

export const FINDINGS_KEY = 'cms_audit_findings_v1';
const SEED_FLAG_KEY = 'cms_audit_findings_seeded_v1';

export const safeJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const loadFindings = (): AuditFinding[] => {
  return safeJSON<AuditFinding[]>(FINDINGS_KEY, []);
};

export const saveFindings = (rows: AuditFinding[]) => {
  try {
    localStorage.setItem(FINDINGS_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
};

const day = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

/**
 * One-time seeder. Fires only when `cms_audit_findings_v1` is empty AND
 * the SEED flag is not yet set. Produces ~22 findings across the seeded
 * schedules so every analysis chart populates with realistic data.
 */
export const seedFindings = (): boolean => {
  try {
    if (localStorage.getItem(SEED_FLAG_KEY) === '1') return false;
    const existing = loadFindings();
    if (existing.length > 0) {
      localStorage.setItem(SEED_FLAG_KEY, '1');
      return false;
    }
    saveFindings(buildSeed());
    localStorage.setItem(SEED_FLAG_KEY, '1');
    return true;
  } catch {
    return false;
  }
};

const buildSeed = (): AuditFinding[] => [
  /* ---- AutoParts Manufacturing — completed audit (older) ---- */
  {
    id: 'fnd-001', auditId: 'sch-005', auditTitle: 'Surveillance 1 — AutoParts',
    client: 'AutoParts Manufacturing', standard: 'ISO 9001:2015',
    date: day(-12), category: 'Major', severity: 'high',
    clause: '8.5.1', department: 'Manufacturing',
    title: 'Production controls not consistently applied',
    description: 'Work instructions for Plant 1 line B were last revised 18 months ago and do not reflect current process.',
    recommendation: 'Revise WI-PM-014, train operators, retain training records for 2 years.',
    status: 'Open', reportedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: 'fnd-002', auditId: 'sch-005', auditTitle: 'Surveillance 1 — AutoParts',
    client: 'AutoParts Manufacturing', standard: 'ISO 9001:2015',
    date: day(-12), category: 'Minor', severity: 'medium',
    clause: '7.1.5.2', department: 'Quality',
    title: 'Calibration records overdue',
    description: 'Three CMM machines past their calibration cycle by 2-3 weeks.',
    recommendation: 'Re-calibrate within 7 days; add SLA reminder to calibration tracker.',
    status: 'In Progress', reportedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: 'fnd-003', auditId: 'sch-005', auditTitle: 'Surveillance 1 — AutoParts',
    client: 'AutoParts Manufacturing', standard: 'ISO 9001:2015',
    date: day(-12), category: 'OFI', severity: 'low',
    clause: '9.1.3', department: 'Quality',
    title: 'Improve trend analysis depth',
    description: 'Monthly QMS reviews include process capability but lack supplier returns trend.',
    recommendation: 'Add supplier-returns Pareto to monthly QMS review pack.',
    status: 'Open', reportedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: 'fnd-004', auditId: 'sch-005', auditTitle: 'Surveillance 1 — AutoParts',
    client: 'AutoParts Manufacturing', standard: 'ISO 9001:2015',
    date: day(-11), category: 'Minor', severity: 'medium',
    clause: '8.4.2', department: 'Purchase',
    title: 'Approved supplier list incomplete',
    description: 'Two new suppliers added in Q1 are not yet in the approved supplier register.',
    recommendation: 'Update register and complete due diligence pack for both.',
    status: 'Closed', reportedAt: new Date(Date.now() - 11 * 86400000).toISOString(),
  },

  /* ---- SkyHigh Construction — completed audit (older) ---- */
  {
    id: 'fnd-005', auditId: 'sch-007', auditTitle: 'Surveillance 1 — SkyHigh',
    client: 'SkyHigh Construction', standard: 'ISO 45001:2018',
    date: day(-25), category: 'Major', severity: 'critical',
    clause: '8.1.2', department: 'Safety',
    title: 'Hot-work permit not issued at Site 4',
    description: 'Two welders observed working without a daily hot-work permit despite procedure HSE-PR-021.',
    recommendation: 'Stop work, retrain crew, audit permit logs for last 30 days.',
    status: 'Closed', reportedAt: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: 'fnd-006', auditId: 'sch-007', auditTitle: 'Surveillance 1 — SkyHigh',
    client: 'SkyHigh Construction', standard: 'ISO 45001:2018',
    date: day(-24), category: 'Major', severity: 'high',
    clause: '7.3', department: 'HR',
    title: 'Contractor competency records missing',
    description: 'Three of nine sampled contractors have no induction record on file.',
    recommendation: 'Onboard records within 14 days; tighten contractor onboarding gate.',
    status: 'In Progress', reportedAt: new Date(Date.now() - 24 * 86400000).toISOString(),
  },
  {
    id: 'fnd-007', auditId: 'sch-007', auditTitle: 'Surveillance 1 — SkyHigh',
    client: 'SkyHigh Construction', standard: 'ISO 45001:2018',
    date: day(-24), category: 'Minor', severity: 'medium',
    clause: '8.2', department: 'Safety',
    title: 'Emergency drill cadence',
    description: 'Quarterly emergency drills missed in Q3.',
    recommendation: 'Schedule make-up drill within 30 days; lock annual cadence.',
    status: 'Open', reportedAt: new Date(Date.now() - 24 * 86400000).toISOString(),
  },
  {
    id: 'fnd-008', auditId: 'sch-007', auditTitle: 'Surveillance 1 — SkyHigh',
    client: 'SkyHigh Construction', standard: 'ISO 45001:2018',
    date: day(-23), category: 'OFI', severity: 'low',
    clause: '6.1.2.1', department: 'Safety',
    title: 'Risk register usability',
    description: 'Risk register works but is hard for site teams to query by location.',
    recommendation: 'Add location filter / export view per site.',
    status: 'Open', reportedAt: new Date(Date.now() - 23 * 86400000).toISOString(),
  },

  /* ---- BlueWave Logistics — in-progress audit ---- */
  {
    id: 'fnd-009', auditId: 'sch-003', auditTitle: 'Stage 1 Readiness — BlueWave',
    client: 'BlueWave Logistics', standard: 'ISO 9001:2015',
    date: day(-2), category: 'Major', severity: 'high',
    clause: '4.4', department: 'Quality',
    title: 'Process map incomplete',
    description: 'Hub-operations process map ends at dispatch; reverse-logistics flow undocumented.',
    recommendation: 'Document end-to-end process before Stage 2.',
    status: 'Open', reportedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'fnd-010', auditId: 'sch-003', auditTitle: 'Stage 1 Readiness — BlueWave',
    client: 'BlueWave Logistics', standard: 'ISO 9001:2015',
    date: day(-2), category: 'Minor', severity: 'medium',
    clause: '7.5.3', department: 'Admin',
    title: 'Document control inconsistencies',
    description: 'Two SOPs in circulation have no revision number on the cover page.',
    recommendation: 'Apply standard cover template, retire orphan copies.',
    status: 'Open', reportedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'fnd-011', auditId: 'sch-003', auditTitle: 'Stage 1 Readiness — BlueWave',
    client: 'BlueWave Logistics', standard: 'ISO 9001:2015',
    date: day(-1), category: 'OFI', severity: 'low',
    clause: '9.3', department: 'Admin',
    title: 'Management review template',
    description: 'Current MR pack lacks a decisions/actions table.',
    recommendation: 'Add decisions/actions section template.',
    status: 'Open', reportedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },

  /* ---- Older completed audits to give the year-period filter content ---- */
  {
    id: 'fnd-012', auditId: 'sch-old-1', auditTitle: 'Recertification — AutoParts',
    client: 'AutoParts Manufacturing', standard: 'ISO 9001:2015',
    date: day(-200), category: 'Major', severity: 'high',
    clause: '8.5.1', department: 'Manufacturing',
    title: 'Run-at-rate sign-off missing',
    description: 'Two new launches went live without a formal run-at-rate sign-off.',
    recommendation: 'Require sign-off as launch gate; backfill records.',
    status: 'Closed', reportedAt: new Date(Date.now() - 200 * 86400000).toISOString(),
  },
  {
    id: 'fnd-013', auditId: 'sch-old-1', auditTitle: 'Recertification — AutoParts',
    client: 'AutoParts Manufacturing', standard: 'ISO 9001:2015',
    date: day(-200), category: 'Minor', severity: 'medium',
    clause: '7.1.5.2', department: 'Quality',
    title: 'Calibration records overdue',
    description: 'Two more CMM machines past calibration — recurring issue.',
    recommendation: 'Investigate root cause for recurrence; daily dashboard.',
    status: 'Closed', reportedAt: new Date(Date.now() - 200 * 86400000).toISOString(),
  },
  {
    id: 'fnd-014', auditId: 'sch-old-2', auditTitle: 'Surveillance — Green Energy',
    client: 'Green Energy Solutions', standard: 'ISO 9001:2015',
    date: day(-95), category: 'Minor', severity: 'medium',
    clause: '8.5.1', department: 'Manufacturing',
    title: 'Inline inspection skipped on shift change',
    description: 'Operators on shift change skipped the inline inspection on 4 occasions.',
    recommendation: 'Andon trigger if QC step skipped > 1 minute.',
    status: 'In Progress', reportedAt: new Date(Date.now() - 95 * 86400000).toISOString(),
  },
  {
    id: 'fnd-015', auditId: 'sch-old-2', auditTitle: 'Surveillance — Green Energy',
    client: 'Green Energy Solutions', standard: 'ISO 9001:2015',
    date: day(-95), category: 'OFI', severity: 'low',
    clause: '10.3', department: 'Quality',
    title: 'Continual improvement metrics',
    description: 'CI metrics tracked at site, not aggregated to company level.',
    recommendation: 'Roll up to monthly company KPI dashboard.',
    status: 'Open', reportedAt: new Date(Date.now() - 95 * 86400000).toISOString(),
  },

  /* ---- Tech Innovations — earlier ISMS audits ---- */
  {
    id: 'fnd-016', auditId: 'sch-old-3', auditTitle: 'Stage 2 — Tech Innovations',
    client: 'Tech Innovations Ltd', standard: 'ISO 27001:2022',
    date: day(-65), category: 'Major', severity: 'critical',
    clause: 'A.5.15', department: 'Security',
    title: 'Access review not performed',
    description: 'Quarterly access review for cloud admin roles missed for two quarters.',
    recommendation: 'Run review immediately; calendar invite + auto-reminder.',
    status: 'Closed', reportedAt: new Date(Date.now() - 65 * 86400000).toISOString(),
  },
  {
    id: 'fnd-017', auditId: 'sch-old-3', auditTitle: 'Stage 2 — Tech Innovations',
    client: 'Tech Innovations Ltd', standard: 'ISO 27001:2022',
    date: day(-64), category: 'Minor', severity: 'medium',
    clause: 'A.8.13', department: 'Software Development',
    title: 'Backup retention policy ambiguous',
    description: 'Policy says "minimum 30 days" but daily backups deleted at 21 days.',
    recommendation: 'Either revise policy or extend retention.',
    status: 'Closed', reportedAt: new Date(Date.now() - 64 * 86400000).toISOString(),
  },
  {
    id: 'fnd-018', auditId: 'sch-old-3', auditTitle: 'Stage 2 — Tech Innovations',
    client: 'Tech Innovations Ltd', standard: 'ISO 27001:2022',
    date: day(-64), category: 'Minor', severity: 'medium',
    clause: 'A.7.7', department: 'Admin',
    title: 'Clear-desk audit gaps',
    description: 'Quarterly clear-desk audits skipped at 2 of 4 offices.',
    recommendation: 'Tighten cadence; spot-check between audits.',
    status: 'In Progress', reportedAt: new Date(Date.now() - 64 * 86400000).toISOString(),
  },
  {
    id: 'fnd-019', auditId: 'sch-old-3', auditTitle: 'Stage 2 — Tech Innovations',
    client: 'Tech Innovations Ltd', standard: 'ISO 27001:2022',
    date: day(-63), category: 'OFI', severity: 'low',
    clause: '9.1', department: 'Security',
    title: 'Phishing simulation cadence',
    description: 'Phishing simulations run twice a year — could be more frequent.',
    recommendation: 'Consider monthly micro-simulations.',
    status: 'Open', reportedAt: new Date(Date.now() - 63 * 86400000).toISOString(),
  },

  /* ---- Fresh Foods (food-safety) audit ---- */
  {
    id: 'fnd-020', auditId: 'sch-old-4', auditTitle: 'Recertification — Fresh Foods',
    client: 'Fresh Foods Packers', standard: 'ISO 22000:2018',
    date: day(-150), category: 'Major', severity: 'high',
    clause: '8.5.4', department: 'Quality',
    title: 'Cold-chain temperature breach',
    description: 'Cold storage logs show two 4°C → 9°C excursions over 8 hours.',
    recommendation: 'Root-cause; verify product disposition; tighten alerts.',
    status: 'Closed', reportedAt: new Date(Date.now() - 150 * 86400000).toISOString(),
  },
  {
    id: 'fnd-021', auditId: 'sch-old-4', auditTitle: 'Recertification — Fresh Foods',
    client: 'Fresh Foods Packers', standard: 'ISO 22000:2018',
    date: day(-149), category: 'Minor', severity: 'medium',
    clause: '7.1.6', department: 'Manufacturing',
    title: 'Allergen segregation labelling',
    description: 'Allergen-containing batch labels lacked the standardised colour code in 3 batches.',
    recommendation: 'Print-template lock; audit weekly until 4 clean weeks.',
    status: 'Closed', reportedAt: new Date(Date.now() - 149 * 86400000).toISOString(),
  },
  {
    id: 'fnd-022', auditId: 'sch-old-4', auditTitle: 'Recertification — Fresh Foods',
    client: 'Fresh Foods Packers', standard: 'ISO 22000:2018',
    date: day(-149), category: 'OFI', severity: 'low',
    clause: '10.3', department: 'Quality',
    title: 'HACCP plan refresh cadence',
    description: 'Plan reviewed annually — consider semi-annual review for new SKUs.',
    recommendation: 'Trigger review on new-SKU introduction.',
    status: 'Open', reportedAt: new Date(Date.now() - 149 * 86400000).toISOString(),
  },
];

/* -----------------------------------------------------------
   Period filtering — used by analysis surfaces
----------------------------------------------------------- */

export type Period = 'all' | 'year' | 'quarter' | 'month' | 'week' | 'day';

export const periodLabel: Record<Period, string> = {
  all: 'All time',
  year: 'Last 12 months',
  quarter: 'Last 90 days',
  month: 'Last 30 days',
  week: 'Last 7 days',
  day: 'Last 24 hours',
};

export const periodCutoff = (period: Period): number => {
  if (period === 'all') return 0;
  const now = Date.now();
  switch (period) {
    case 'year':    return now - 365 * 86400000;
    case 'quarter': return now - 90  * 86400000;
    case 'month':   return now - 30  * 86400000;
    case 'week':    return now - 7   * 86400000;
    case 'day':     return now - 1   * 86400000;
  }
};

export const inPeriod = (iso: string | undefined, period: Period): boolean => {
  if (period === 'all') return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return false;
  return t >= periodCutoff(period);
};
