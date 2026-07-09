// Mock data types and exports for AuditorCoordinator pages

export interface AuditorRating {
  at: string;          // ISO datetime
  score: number;       // 0..5
  by?: string;         // who rated
  audit?: string;      // audit reference
  note?: string;
}

export interface Auditor {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string;
  specialization?: string;
  certifications: string[];
  auditValidator?: 'Authorized' | 'Not Authorized' | 'Pending' | string;
  status: 'Active' | 'Inactive';
  joinDate?: string;
  /** Skill matrix: standard family → 0-5 competency level */
  skills?: Record<string, number>;
  /** Past performance ratings */
  ratings?: AuditorRating[];
  /** Lead Auditor approval workflow */
  approvalStatus?: 'Pending Approval' | 'Approved' | 'Rejected';
  /** Who approved/rejected (Lead Auditor name) */
  approvedBy?: string;
  /** When the approval/rejection happened (ISO) */
  approvedAt?: string;
  /** Notes left by the Lead Auditor during validation */
  approvalNotes?: string;
  /** Country the auditor operates in — used for global routing */
  country?: string;
  /** Optional region / state within country */
  region?: string;
  /** Phone number — needed for cross-country contact */
  phone?: string;
  /** Languages the auditor can audit in */
  languages?: string[];
}

export interface AuditSchedule {
  id: number | string;
  auditName?: string;
  client?: string; // legacy name
  clientId?: string; // new: references clients[].id
  scheduledDate?: string; // legacy name
  date?: string; // new: normalized date field used by components
  leadAuditor?: string;
  auditor?: string;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Pending';
}

export interface Certificate {
  id: number | string;
  organizationName?: string;
  certificateNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  status?: string;
  // Audit result/status associated with this certificate
  auditStatus?: 'Passed' | 'Failed' | 'Pending' | 'Not Applicable' | string;
  // Additional fields used by CertificateDelivery UI
  clientId?: string;
  issuedDate?: string;
  method?: 'Email' | 'Courier' | 'Portal Upload' | string;
  scope?: string;
  standard?: string;
  expirationDate?: string;
  recertificationDueDate?: string;
  surveillance1Due?: string;
  surveillance2Due?: string;
  address?: string;
  attachment?: string | null;
  type?: 'Registration' | 'Surveillance';
}

export interface Confirmation {
  id: number | string;
  // legacy fields (optional)
  auditName?: string;
  scheduledDate?: string;
  auditor?: string;
  // normalized fields used by Confirmation UI
  scheduleId?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  dueDate?: string;
  notes?: string;
  status: 'Confirmed' | 'Pending' | 'Rescheduled';
} 

// Mock data for auditors
export const initialAuditors: Auditor[] = [
  {
    id: 1,
    name: 'John Smith',
    email: 'john.smith@example.com',
    role: 'Lead Auditor',
    department: 'Quality Assurance',
    certifications: ['ISO 9001', 'ISO 14001'],
    status: 'Active',
    joinDate: '2018-06-12'
  },
  {
    id: 2,
    name: 'Jane Williams',
    email: 'jane.williams@example.com',
    role: 'Auditor',
    department: 'Information Security',
    certifications: ['ISO 27001', 'ISO 27002'],
    status: 'Active',
    joinDate: '2019-04-23'
  },
  {
    id: 3,
    name: 'Robert Johnson',
    email: 'robert.johnson@example.com',
    role: 'Auditor',
    department: 'Environmental Health & Safety',
    certifications: ['ISO 14001', 'ISO 50001'],
    status: 'Active',
    joinDate: '2016-11-04'
  },
];

// Mock data for clients
export interface ClientRecord {
  id: string;
  name: string;
  email: string;
  industry: string;
  address?: string;
  phone?: string;
}

export const clients: ClientRecord[] = [
  { id: '1', name: 'Acme Corp', email: 'contact@acme.com', industry: 'Manufacturing', address: '123 Business Park, Cityville, ST 12345', phone: '+919876543210' },
  { id: '2', name: 'Tech Solutions Inc.', email: 'info@techsol.com', industry: 'Technology', address: '456 Tech Ave, Silicon Valley, CA 94000', phone: '+14155550100' },
  { id: '3', name: 'Green Industries', email: 'support@green.com', industry: 'Environmental', address: '789 Eco Lane, Greentown, OR 97000', phone: '+15035550199' },
];

// Mock data for audit schedules
export const schedules: AuditSchedule[] = [
  {
    id: '1',
    auditName: 'Quality Management System Audit',
    client: 'Acme Corp',
    clientId: '1',
    date: '2025-01-15',
    leadAuditor: 'John Smith',
    auditor: 'John Smith',
    status: 'Scheduled',
  },
  {
    id: '2',
    auditName: 'Information Security Audit',
    client: 'Tech Solutions Inc.',
    clientId: '2',
    date: '2025-01-20',
    leadAuditor: 'Jane Williams',
    auditor: 'Jane Williams',
    status: 'In Progress',
  },
  {
    id: '3',
    auditName: 'Environmental Compliance Audit',
    client: 'Green Industries',
    clientId: '3',
    date: '2025-01-10',
    leadAuditor: 'Robert Johnson',
    auditor: 'Robert Johnson',
    status: 'Completed',
  },
];

// Mock data for certificates
export const certificates: Certificate[] = [
  {
    id: 'cert-1',
    clientId: '1',
    organizationName: 'Acme Corp',
    certificateNumber: 'CERT-2024-001',
    issuedDate: '2024-01-15',
    expiryDate: '2027-01-15',
    method: 'Email',
    scope: 'ISO 9001:2015 Quality Management',
    status: 'Active',
    auditStatus: 'Passed',
  },
  {
    id: 'cert-2',
    clientId: '2',
    organizationName: 'Tech Solutions Inc.',
    certificateNumber: 'CERT-2024-002',
    issuedDate: '2024-02-20',
    expiryDate: '2026-02-20',
    method: 'Portal Upload',
    scope: 'ISO 27001:2022 Information Security',
    status: 'Active',
    auditStatus: 'Passed',
  },
  {
    id: 'cert-3',
    clientId: '3',
    organizationName: 'Green Industries',
    certificateNumber: 'CERT-2024-003',
    issuedDate: '2023-06-10',
    expiryDate: '2024-06-10',
    method: 'Courier',
    scope: 'ISO 14001:2015 Environmental Management',
    status: 'Expired',
    auditStatus: 'Failed',
  },
];

// Mock data for confirmations
// Mock data for confirmations (Confirmed)
export const confirmations: Confirmation[] = [
  {
    id: 'conf-1',
    scheduleId: '1',
    confirmedBy: 'Alice Johnson',
    confirmedAt: '2025-01-16',
    dueDate: '2025-02-15',
    notes: '',
    status: 'Confirmed',
  },
  {
    id: 'conf-2',
    scheduleId: '2',
    confirmedBy: 'Bob Lee',
    confirmedAt: '2025-01-21',
    dueDate: '2025-02-28',
    notes: 'Accepted with minor scheduling update.',
    status: 'Confirmed',
  },
  {
    id: 'conf-3',
    scheduleId: '3',
    confirmedBy: 'Carol White',
    confirmedAt: '2025-01-11',
    dueDate: '2025-02-10',
    notes: 'Delayed delivery of report noted.',
    status: 'Confirmed',
  },
];

// Mock data for alerts (pending schedules)
export const alertRows = [
  {
    id: 'alert-1',
    auditName: 'Supplier Audit',
    clientId: '1',
    date: '2026-03-10',
    emailStatus: 'Pending (Scheduled > 1m)',
  },
  {
    id: 'alert-2',
    auditName: 'Internal Audit',
    clientId: '2',
    date: '2026-03-15',
    emailStatus: 'Auto-Sent (1 Month Prior)',
  },
  {
    id: 'alert-3',
    auditName: 'Process Audit',
    clientId: '3',
    date: '2026-03-20',
    emailStatus: 'Pending (Scheduled > 1m)',
  },
];

// Mock data for pending confirmations
export const pendingConfirmations = [
  {
    id: 'pending-1',
    scheduleId: '4',
    confirmedBy: '',
    confirmedAt: '',
    dueDate: '',
    notes: '',
    status: 'Pending',
  },
  {
    id: 'pending-2',
    scheduleId: '5',
    confirmedBy: '',
    confirmedAt: '',
    dueDate: '',
    notes: '',
    status: 'Pending',
  },
];