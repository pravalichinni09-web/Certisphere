/**
 * Audit Report Storage Utilities for Auditor Coordinator
 * Manages audit report data persistence in localStorage
 */

export interface AuditReportSection {
  id: string;
  title: string;
  placeholder: string;
  content: string;
}

export interface AuditReport {
  id: string;
  scheduleId: number;
  clientName: string;
  organization?: string;
  audit?: string;
  department?: string;
  auditType: string;
  auditDate: string;
  leadAuditor: string;
  assignedAuditor: string;
  submittedDate?: string;
  status: 'Draft' | 'In Review' | 'Approved' | 'Submitted';
  createdDate: string;
  lastModified: string;
  sections: AuditReportSection[];
  findings: AuditFinding[];
}

export interface AuditFinding {
  id: string;
  category: string;
  severity: 'Critical' | 'Major' | 'Minor' | 'Observation';
  description: string;
  auditStandard: string;
  recommendation: string;
  status: 'Open' | 'Closed';
}

const AUDIT_REPORTS_STORAGE_KEY = 'cms_audit_reports_coordinator';

/**
 * Initialize report sections with default structure
 */
export const initializeReportSections = (): AuditReportSection[] => [
  {
    id: 'exec_summary',
    title: 'Executive Summary',
    placeholder: 'Provide a high-level overview of the audit findings...',
    content: ''
  },
  {
    id: 'scope',
    title: 'Audit Scope & Objectives',
    placeholder: 'Define what was audited and the audit objectives...',
    content: ''
  },
  {
    id: 'methodology',
    title: 'Methodology',
    placeholder: 'Describe the audit methods used (interviews, observation, sampling, etc.)...',
    content: ''
  },
  {
    id: 'findings',
    title: 'Key Findings',
    placeholder: 'Summary of audit findings and non-conformances...',
    content: ''
  },
  {
    id: 'conclusion',
    title: 'Conclusion',
    placeholder: 'Final assessment and overall compliance statement...',
    content: ''
  }
];

/**
 * Get all audit reports from localStorage
 */
export const getAuditReports = (): AuditReport[] => {
  try {
    const storedData = localStorage.getItem(AUDIT_REPORTS_STORAGE_KEY);
    if (storedData) {
      return JSON.parse(storedData);
    }
  } catch (error) {
    console.error('Error reading audit reports from localStorage:', error);
  }
  return [];
};

/**
 * Get a specific audit report by ID
 */
export const getAuditReportById = (reportId: string): AuditReport | null => {
  const reports = getAuditReports();
  return reports.find(r => r.id === reportId) || null;
};

/**
 * Get audit reports by schedule ID
 */
export const getAuditReportByScheduleId = (scheduleId: number): AuditReport | null => {
  const reports = getAuditReports();
  return reports.find(r => r.scheduleId === scheduleId) || null;
};

/**
 * Create a new audit report
 */
export const createAuditReport = (data: {
  scheduleId: number;
  clientName: string;
  organization?: string;
  audit?: string;
  department?: string;
  auditType: string;
  auditDate: string;
  leadAuditor: string;
  assignedAuditor: string;
  submittedDate?: string;
}): AuditReport => {
  const newReport: AuditReport = {
    id: `report-${Date.now()}`,
    scheduleId: data.scheduleId,
    clientName: data.clientName,
    organization: data.organization,
    audit: data.audit,
    department: data.department,
    auditType: data.auditType,
    auditDate: data.auditDate,
    leadAuditor: data.leadAuditor,
    assignedAuditor: data.assignedAuditor,
    submittedDate: data.submittedDate,
    status: 'Draft',
    createdDate: new Date().toISOString().split('T')[0],
    lastModified: new Date().toISOString().split('T')[0],
    sections: initializeReportSections(),
    findings: []
  };

  const reports = getAuditReports();
  reports.push(newReport);
  localStorage.setItem(AUDIT_REPORTS_STORAGE_KEY, JSON.stringify(reports));
  return newReport;
};

/**
 * Update an existing audit report
 */
export const updateAuditReport = (reportId: string, updates: Partial<AuditReport>): AuditReport | null => {
  const reports = getAuditReports();
  const index = reports.findIndex(r => r.id === reportId);

  if (index !== -1) {
    reports[index] = {
      ...reports[index],
      ...updates,
      lastModified: new Date().toISOString().split('T')[0]
    };
    localStorage.setItem(AUDIT_REPORTS_STORAGE_KEY, JSON.stringify(reports));
    return reports[index];
  }
  return null;
};

/**
 * Update a specific section in a report
 */
export const updateReportSection = (reportId: string, sectionId: string, content: string): AuditReport | null => {
  const report = getAuditReportById(reportId);
  if (report) {
    const updatedSections = report.sections.map(s =>
      s.id === sectionId ? { ...s, content } : s
    );
    return updateAuditReport(reportId, { sections: updatedSections });
  }
  return null;
};

/**
 * Add a finding to a report
 */
export const addFindingToReport = (reportId: string, finding: AuditFinding): AuditReport | null => {
  const report = getAuditReportById(reportId);
  if (report) {
    const updatedFindings = [...report.findings, finding];
    return updateAuditReport(reportId, { findings: updatedFindings });
  }
  return null;
};

/**
 * Update a finding in a report
 */
export const updateFindingInReport = (reportId: string, findingId: string, updates: Partial<AuditFinding>): AuditReport | null => {
  const report = getAuditReportById(reportId);
  if (report) {
    const updatedFindings = report.findings.map(f =>
      f.id === findingId ? { ...f, ...updates } : f
    );
    return updateAuditReport(reportId, { findings: updatedFindings });
  }
  return null;
};

/**
 * Delete a finding from a report
 */
export const deleteFindingFromReport = (reportId: string, findingId: string): AuditReport | null => {
  const report = getAuditReportById(reportId);
  if (report) {
    const updatedFindings = report.findings.filter(f => f.id !== findingId);
    return updateAuditReport(reportId, { findings: updatedFindings });
  }
  return null;
};

/**
 * Change report status
 */
export const updateReportStatus = (reportId: string, status: AuditReport['status']): AuditReport | null => {
  return updateAuditReport(reportId, { status });
};

/**
 * Delete an audit report
 */
export const deleteAuditReport = (reportId: string): void => {
  const reports = getAuditReports();
  const filtered = reports.filter(r => r.id !== reportId);
  localStorage.setItem(AUDIT_REPORTS_STORAGE_KEY, JSON.stringify(filtered));
};

/**
 * Get audit reports by status
 */
export const getReportsByStatus = (status: AuditReport['status']): AuditReport[] => {
  const reports = getAuditReports();
  return reports.filter(r => r.status === status);
};

/**
 * Get audit reports by auditor name
 */
export const getReportsByAuditor = (auditorName: string): AuditReport[] => {
  const reports = getAuditReports();
  return reports.filter(r => r.leadAuditor === auditorName || r.assignedAuditor === auditorName);
};

/**
 * Get critical findings count
 */
export const getCriticalFindingsCount = (reportId: string): number => {
  const report = getAuditReportById(reportId);
  if (!report) return 0;
  return report.findings.filter(f => f.severity === 'Critical' && f.status === 'Open').length;
};

/**
 * Reset audit reports data
 */
export const resetAuditReportsData = (): void => {
  localStorage.removeItem(AUDIT_REPORTS_STORAGE_KEY);
};
