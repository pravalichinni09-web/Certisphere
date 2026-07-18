// Shared corrective-action store backed by localStorage.
// All roles (Auditee, Auditor, Lead Auditor) read/write the same key so the
// corrective-action loop flows live between pages without a refresh.

export const CORRECTIVE_ACTIONS_KEY = 'cms_corrective_actions_v1';
export const CORRECTIVE_ACTIONS_EVENT = 'cms-corrective-actions-updated';

export type CorrectiveActionSeverity = 'Major NC' | 'Minor NC' | 'OFI';

export type CorrectiveActionStatus =
  | 'Open'
  | 'Submitted'
  | 'Auditor Reviewed'
  | 'Approved'
  | 'Rejected';

export interface CorrectiveActionEvidence {
  name: string;
  date: string;
}

export interface CorrectiveActionHistoryEntry {
  at: string;
  by: string;
  action: string;
}

export interface CorrectiveActionRecord {
  id: string;
  capId: string;
  clientName: string;
  auditTitle: string;
  auditType: string;
  standard: string;
  severity: CorrectiveActionSeverity;
  description: string;
  rootCause?: string;
  correctivePlan?: string;
  evidence?: CorrectiveActionEvidence[];
  dueDate: string;
  status: CorrectiveActionStatus;
  submittedAt?: string;
  reviewedAt?: string;
  decidedAt?: string;
  history?: CorrectiveActionHistoryEntry[];
}

const seedRecords = (): CorrectiveActionRecord[] => [
  {
    id: 'CA-2026-001',
    capId: 'CAP-2026-001',
    clientName: 'Acme Manufacturing',
    auditTitle: 'QMS Recertification Audit',
    auditType: 'Recertification',
    standard: 'ISO 9001:2015',
    severity: 'Major NC',
    description:
      'Engineering change orders were released to production without document control approval, violating SOP-01 (Control of Documented Information).',
    rootCause:
      'New engineering staff were not trained on the document control workflow during onboarding.',
    correctivePlan:
      'Retrain all engineering staff on SOP-01, add document control sign-off to the onboarding checklist, and enable mandatory ECO approval routing in the PLM system.',
    evidence: [
      { name: 'ECO_Training_Attendance_Jun2026.pdf', date: '2026-06-28' },
      { name: 'PLM_Approval_Workflow_Screenshot.png', date: '2026-07-01' }
    ],
    dueDate: '2026-07-20',
    status: 'Submitted',
    submittedAt: '2026-07-02T10:15:00.000Z',
    history: [
      { at: '2026-06-18T09:00:00.000Z', by: 'Lead Auditor', action: 'Finding raised during QMS Recertification Audit' },
      { at: '2026-07-02T10:15:00.000Z', by: 'Auditee', action: 'Closure evidence submitted' }
    ]
  },
  {
    id: 'CA-2026-002',
    capId: 'CAP-2026-002',
    clientName: 'TechFlow Solutions',
    auditTitle: 'ISMS Surveillance',
    auditType: 'Surveillance',
    standard: 'ISO 27001:2022',
    severity: 'Minor NC',
    description:
      'Visitor logbook entries at the data-center entrance were not countersigned by security at exit on 3 of 10 sampled days.',
    rootCause: 'Security shift handover during peak hours leaves the exit desk unattended.',
    correctivePlan:
      'Deploy a digital visitor management system with automated check-out and daily reconciliation by the security supervisor.',
    dueDate: '2026-07-28',
    status: 'Open',
    history: [
      { at: '2026-06-25T11:30:00.000Z', by: 'Auditor', action: 'Finding raised during ISMS Surveillance audit' }
    ]
  },
  {
    id: 'CA-2026-003',
    capId: 'CAP-2026-003',
    clientName: 'GreenEarth Logistics',
    auditTitle: 'EMS Compliance Audit',
    auditType: 'Compliance',
    standard: 'ISO 14001:2015',
    severity: 'Minor NC',
    description:
      'Waste segregation bins in Warehouse Zone C were unlabeled, resulting in mixed disposal of recyclable and general waste.',
    rootCause: 'Bin labels faded over time and were not replaced during routine facility maintenance.',
    correctivePlan:
      'Install weather-resistant labels on all segregation bins and add a weekly labeling check to the maintenance schedule.',
    evidence: [
      { name: 'Zone_C_Bin_Labels_Photos.jpg', date: '2026-06-30' },
      { name: 'Maintenance_Checklist_Rev2.pdf', date: '2026-07-01' }
    ],
    dueDate: '2026-07-15',
    status: 'Auditor Reviewed',
    submittedAt: '2026-07-01T14:05:00.000Z',
    reviewedAt: '2026-07-03T09:40:00.000Z',
    history: [
      { at: '2026-06-20T10:00:00.000Z', by: 'Auditor', action: 'Finding raised during EMS Compliance Audit' },
      { at: '2026-07-01T14:05:00.000Z', by: 'Auditee', action: 'Closure evidence submitted' },
      { at: '2026-07-03T09:40:00.000Z', by: 'Auditor', action: 'Closure accepted: labels verified via site photos' }
    ]
  },
  {
    id: 'CA-2026-004',
    capId: 'CAP-2026-004',
    clientName: 'Acme Manufacturing',
    auditTitle: 'QMS Recertification Audit',
    auditType: 'Recertification',
    standard: 'ISO 9001:2015',
    severity: 'Minor NC',
    description:
      'Calibration certificates for two torque wrenches in final assembly had expired at the time of the audit.',
    rootCause: 'The calibration recall list was maintained manually and the June recall cycle was missed.',
    correctivePlan:
      'Move calibration tracking to the CMMS with automated recall notifications 30 days before due dates.',
    evidence: [
      { name: 'Calibration_Certificates_Jun2026.pdf', date: '2026-06-20' },
      { name: 'CMMS_Recall_Configuration.png', date: '2026-06-21' }
    ],
    dueDate: '2026-06-30',
    status: 'Approved',
    submittedAt: '2026-06-22T08:20:00.000Z',
    reviewedAt: '2026-06-24T13:10:00.000Z',
    decidedAt: '2026-06-26T16:45:00.000Z',
    history: [
      { at: '2026-06-10T09:30:00.000Z', by: 'Auditor', action: 'Finding raised during QMS Recertification Audit' },
      { at: '2026-06-22T08:20:00.000Z', by: 'Auditee', action: 'Closure evidence submitted' },
      { at: '2026-06-24T13:10:00.000Z', by: 'Auditor', action: 'Closure accepted: certificates verified' },
      { at: '2026-06-26T16:45:00.000Z', by: 'Lead Auditor', action: 'Action plan approved' }
    ]
  },
  {
    id: 'CA-2026-005',
    capId: 'CAP-2026-005',
    clientName: 'TechFlow Solutions',
    auditTitle: 'ISMS Surveillance',
    auditType: 'Surveillance',
    standard: 'ISO 27001:2022',
    severity: 'OFI',
    description:
      'Quarterly user access review reports are compiled manually; automating the export from the IAM platform would reduce effort and transcription errors.',
    correctivePlan:
      'Evaluate scripting the quarterly access review export from the IAM platform and pilot it for the Q3 2026 review.',
    dueDate: '2026-08-15',
    status: 'Open',
    history: [
      { at: '2026-06-25T12:00:00.000Z', by: 'Auditor', action: 'Opportunity for improvement noted during ISMS Surveillance audit' }
    ]
  }
];

/**
 * Load all corrective-action records from localStorage.
 * Seeds the key with demo data if it is missing, empty, or unreadable.
 */
export const loadCorrectiveActions = (): CorrectiveActionRecord[] => {
  try {
    const raw = window.localStorage.getItem(CORRECTIVE_ACTIONS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Defensive: drop null/malformed entries so consumers never crash on record.id
        const clean = (parsed as unknown[]).filter(
          (r): r is CorrectiveActionRecord => !!r && typeof r === 'object' && 'id' in (r as object)
        );
        if (clean.length > 0) return clean;
      }
    }
  } catch {
    // Corrupt data — fall through and reseed.
  }
  const seeded = seedRecords();
  try {
    window.localStorage.setItem(CORRECTIVE_ACTIONS_KEY, JSON.stringify(seeded));
  } catch {
    // Storage unavailable — still return in-memory seed.
  }
  return seeded;
};

/**
 * Persist records and notify every mounted page (same tab via the custom
 * event; other tabs receive the native 'storage' event automatically).
 */
export const saveCorrectiveActions = (records: CorrectiveActionRecord[]): void => {
  try {
    window.localStorage.setItem(CORRECTIVE_ACTIONS_KEY, JSON.stringify(records));
  } catch {
    // Storage unavailable — listeners still get the in-memory update event.
  }
  window.dispatchEvent(new CustomEvent(CORRECTIVE_ACTIONS_EVENT));
};

/**
 * Apply an updater to a single record (by id), persist, and return the
 * updated array.
 */
export const updateCorrectiveAction = (
  id: string,
  updater: (record: CorrectiveActionRecord) => CorrectiveActionRecord
): CorrectiveActionRecord[] => {
  const records = loadCorrectiveActions().map(record =>
    record.id === id ? updater(record) : record
  );
  saveCorrectiveActions(records);
  return records;
};

/** Immutably append a history entry to a record. */
export const withHistory = (
  record: CorrectiveActionRecord,
  by: string,
  action: string,
  at: string = new Date().toISOString()
): CorrectiveActionRecord => ({
  ...record,
  history: [...(record.history ?? []), { at, by, action }]
});
