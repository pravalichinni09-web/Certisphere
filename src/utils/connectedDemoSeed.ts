/**
 * Connected Demo Seed
 * -------------------
 * Creates a coherent, cross-role demo dataset where every record visible in
 * one role traces back to (or forward to) data visible in the next role.
 *
 * Each of the 6 demo clients is parked at a different stage of the 14-stage
 * workflow so every role's dashboard + pending inbox shows real activity:
 *   - Management:        new client to onboard, certificate to seal
 *   - Audit Coordinator: requirements to review, schedule to propose,
 *                        cert to generate
 *   - Lead Auditor:      team to confirm, audit in progress, actions to review
 *   - Auditor:           assignment to confirm, on-site audit, findings to draft
 *   - Auditee:           date to approve, corrective actions to submit
 *   - Client Coordinator (read-only): full picture of their own client record
 *
 * Idempotent — only runs once per browser via the flag below. Clear the flag
 * to re-seed.
 */
const FLAG = 'cms_connected_demo_seed_v1';
type WorkflowStage =
  | 'Pre-Registration'
  | 'Registration Submitted'
  | 'Coordinator Assigned'
  | 'Requirements Reviewed'
  | 'Schedule Proposed'
  | 'Assigned Auditors (Lead auditor, Auditor)'
  | 'Schedule Approved by Auditee'
  | 'Schedule Approved by Auditor'
  | 'Audit In Progress'
  | 'Audit Completed'
  | 'Audit findings'
  | 'Action items released to Auditor'
  | 'Review and Approval by Auditor'
  | 'Certification released';

const safe = <T,>(k: string, fb: T): T => {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; }
};
const write = (k: string, v: unknown) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
};

const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86400000).toISOString();

interface DemoClient {
  id: number;
  organizationName: string;
  contactPerson: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  industry: string;
  standard: string;
  clientType: string;
  status: string;
  stage: WorkflowStage;
  coordinator?: string;
  leadAuditor?: string;
  auditor?: string;
  scheduledDate?: string;
}

const CLIENTS: DemoClient[] = [
  { id: 101, organizationName: 'Global Bio Foods Ltd',  contactPerson: 'Anika Sharma',   email: 'anika@globalbio.com',  phone: '+91 98765 43210', country: 'India',     city: 'Hyderabad', industry: 'Food Processing',     standard: 'ISO 22000:2018', clientType: 'Initial Certification', status: 'Pending Onboarding',
    stage: 'Registration Submitted' },
  { id: 102, organizationName: 'NorthStar Aviation',    contactPerson: 'James Carter',   email: 'jcarter@northstaravi.com', phone: '+1 415 555 0142', country: 'USA',     city: 'San Francisco', industry: 'Aviation',         standard: 'AS 9100:2016',   clientType: 'Surveillance 1',         status: 'Active',
    stage: 'Requirements Reviewed', coordinator: 'Praveen Gangarapu' },
  { id: 103, organizationName: 'Berliner Werkzeugbau',  contactPerson: 'Hannah Bauer',   email: 'h.bauer@berlinerwerk.de', phone: '+49 30 12345 678', country: 'Germany', city: 'Berlin', industry: 'Manufacturing',         standard: 'ISO 9001:2015',  clientType: 'Surveillance 2',         status: 'Active',
    stage: 'Schedule Proposed', coordinator: 'Praveen Gangarapu', leadAuditor: 'Anita Verma', auditor: 'Sandeep Joshi', scheduledDate: iso(10).slice(0, 10) },
  { id: 104, organizationName: 'Singapore TechWorks',   contactPerson: 'Wei Lin',        email: 'wei@sgtechworks.sg',     phone: '+65 6789 1234',   country: 'Singapore', city: 'Singapore', industry: 'Electronics',       standard: 'ISO 27001:2022', clientType: 'Recertification',        status: 'Active',
    stage: 'Audit In Progress', coordinator: 'Praveen Gangarapu', leadAuditor: 'Rajesh Kumar', auditor: 'Priya Reddy', scheduledDate: iso(-1).slice(0, 10) },
  { id: 105, organizationName: 'Sydney HealthCorp',     contactPerson: 'Liam OBrien',    email: 'liam@sydneyhealth.au',   phone: '+61 2 9876 5432', country: 'Australia', city: 'Sydney', industry: 'Healthcare',          standard: 'ISO 13485:2016', clientType: 'Surveillance 1',         status: 'Active',
    stage: 'Audit findings', coordinator: 'Praveen Gangarapu', leadAuditor: 'Anita Verma', auditor: 'Vikram Singh', scheduledDate: iso(-10).slice(0, 10) },
  { id: 106, organizationName: 'Dubai Logistics LLC',   contactPerson: 'Omar Al Rashid', email: 'omar@dubailog.ae',       phone: '+971 4 800 0000', country: 'UAE',       city: 'Dubai',  industry: 'Logistics',           standard: 'ISO 45001:2018', clientType: 'Initial Certification', status: 'Active',
    stage: 'Review and Approval by Auditor', coordinator: 'Praveen Gangarapu', leadAuditor: 'Rajesh Kumar', auditor: 'Sandeep Joshi', scheduledDate: iso(-25).slice(0, 10) },
];

export const seedConnectedDemo = (): boolean => {
  try {
    if (localStorage.getItem(FLAG) === '1') return false;

    // 1) cms_client_registrations — merge with existing
    const existingClients = safe<any[]>('cms_client_registrations', []);
    const existingIds = new Set(existingClients.map((c: any) => c.id));
    const newClients = CLIENTS.filter(c => !existingIds.has(c.id)).map(c => ({
      id: c.id, clientCode: 'CRT-' + c.id, organizationName: c.organizationName,
      contactPerson: c.contactPerson, email: c.email, phone: c.phone,
      address: `${c.city}, ${c.country}`, country: c.country, city: c.city,
      industry: c.industry, standard: c.standard, clientType: c.clientType,
      status: c.status, registrationNumber: 'REG-' + c.id, createdAt: iso(-90 + c.id),
    }));
    write('cms_client_registrations', [...existingClients, ...newClients]);

    // 2) cms_audit_workflow — one record per demo client at its target stage
    const wfExisting = safe<any[]>('cms_audit_workflow', []);
    const wfNew = CLIENTS.map(c => ({
      clientId: c.id,
      currentStage: c.stage,
      assignedCoordinator: c.coordinator,
      assignedAt: iso(-30 + c.id),
      requirements: c.coordinator ? {
        scope: `${c.industry} operations at ${c.city}, ${c.country}`,
        standards: [c.standard],
        documents: ['Quality Manual', 'Process Map', 'Internal Audit Logs'],
        notes: `${c.clientType} for ${c.standard}.`,
        reviewedAt: iso(-25 + c.id), reviewedBy: c.coordinator,
      } : undefined,
      schedule: c.scheduledDate ? {
        proposedDate: c.scheduledDate,
        proposedTime: '09:30',
        leadAuditor: c.leadAuditor,
        auditor: c.auditor,
        notes: `${c.clientType} audit at ${c.city}.`,
        proposedAt: iso(-15 + c.id),
        proposedBy: c.coordinator,
        decision: c.stage === 'Schedule Proposed' ? 'Pending' : 'Approved',
        decisionAt: c.stage === 'Schedule Proposed' ? undefined : iso(-12 + c.id),
      } : undefined,
      history: [
        { stage: 'Registration Submitted', at: iso(-40 + c.id), by: 'Auditee · ' + c.contactPerson },
        ...(c.coordinator ? [{ stage: 'Coordinator Assigned', at: iso(-35 + c.id), by: 'Management', note: `Picked ${c.coordinator}` }] : []),
        ...(c.coordinator ? [{ stage: 'Requirements Reviewed', at: iso(-25 + c.id), by: c.coordinator, note: 'Docs OK.' }] : []),
        ...(c.scheduledDate ? [{ stage: 'Schedule Proposed', at: iso(-15 + c.id), by: c.coordinator }] : []),
        { stage: c.stage, at: iso(-5 + c.id), by: 'System' },
      ],
      createdAt: iso(-90 + c.id),
      updatedAt: iso(-1 + c.id),
    }));
    const wfMerged = [...wfExisting.filter((w: any) => !CLIENTS.some(c => c.id === w.clientId)), ...wfNew];
    write('cms_audit_workflow', wfMerged);

    // 3) cms_client_onboarding_v1 — feed the Management onboarding queue
    const onbExisting = safe<any[]>('cms_client_onboarding_v1', []);
    const onbNew = [
      { id: 101, organizationName: 'Global Bio Foods Ltd', contactPerson: 'Anika Sharma',
        email: 'anika@globalbio.com', phone: '+91 98765 43210', country: 'India',
        industry: 'Food Processing', standard: 'ISO 22000:2018', status: 'Pending Review',
        forwardedBy: 'Praveen Gangarapu (Coordinator)', forwardedAt: iso(-1),
        coordinatorNote: 'All docs received, clean application. Recommend approval.' },
    ];
    const onbMerged = [...onbExisting.filter((o: any) => !onbNew.some(n => n.id === o.id)), ...onbNew];
    write('cms_client_onboarding_v1', onbMerged);

    // 4) cms_audit_schedules — schedules visible to LA + Auditor
    const schExisting = safe<any[]>('cms_audit_schedules', []);
    const schNew = CLIENTS.filter(c => c.scheduledDate).map(c => ({
      id: 'sch-' + c.id,
      auditId: 'aud-' + c.id,
      clientId: c.id,
      auditTitle: `${c.clientType} · ${c.standard}`,
      organizationName: c.organizationName,
      scheduledDate: c.scheduledDate,
      startTime: '09:30',
      endTime: '17:30',
      location: `${c.city}, ${c.country}`,
      assignedAuditors: [c.leadAuditor, c.auditor].filter(Boolean),
      leadAuditor: c.leadAuditor,
      auditor: c.auditor,
      status: c.stage === 'Audit In Progress' ? 'in-progress' : c.stage === 'Audit Completed' ? 'completed' : 'scheduled',
      notes: `${c.clientType} audit at ${c.city}.`,
      createdAt: iso(-15 + c.id),
    }));
    const schMerged = [...schExisting.filter((s: any) => !schNew.some(n => n.id === s.id)), ...schNew];
    write('cms_audit_schedules', schMerged);

    // 5) cms_audit_findings_v1 — auditor's findings for Audit findings / Action items / Approval stages
    const findings = safe<Record<string, any[]>>('cms_audit_findings_v1', {});
    CLIENTS.filter(c => ['Audit findings', 'Action items released to Auditor', 'Review and Approval by Auditor'].includes(c.stage)).forEach(c => {
      if (!findings[String(c.id)]) {
        findings[String(c.id)] = [
          { id: 'f-' + c.id + '-1', severity: 'Minor NC', clause: '8.5.1', description: 'Calibration record incomplete for QC instrument #04.', evidence: 'Document review', createdAt: iso(-7 + c.id) },
          { id: 'f-' + c.id + '-2', severity: 'Observation', clause: '7.1.4', description: 'Internal lighting at workstation 3 below recommended lux level.', evidence: 'On-site observation', createdAt: iso(-7 + c.id) },
          { id: 'f-' + c.id + '-3', severity: 'Opportunity', clause: '9.1.3', description: 'Process metrics dashboard could be automated.', evidence: 'Interview', createdAt: iso(-6 + c.id) },
        ];
      }
    });
    write('cms_audit_findings_v1', findings);

    // 6) cms_audit_reports_v1 — for clients past Audit Completed
    const reports = safe<Record<string, any>>('cms_audit_reports_v1', {});
    CLIENTS.filter(c => ['Audit findings', 'Action items released to Auditor', 'Review and Approval by Auditor', 'Certification released'].includes(c.stage)).forEach(c => {
      if (!reports[String(c.id)]) {
        reports[String(c.id)] = {
          summary: `Audit conducted at ${c.city}. Scope: ${c.industry}. ${c.standard} compliance assessed across all clauses.`,
          scope: `${c.industry} operations at ${c.city}, ${c.country}`,
          conclusion: 'The QMS demonstrates effective implementation of ' + c.standard + ' with a small number of minor non-conformities documented.',
          recommendation: 'Recommend certification',
          draftedAt: iso(-5 + c.id), draftedBy: c.auditor,
          submittedAt: c.stage === 'Review and Approval by Auditor' || c.stage === 'Certification released' ? iso(-3 + c.id) : undefined,
        };
      }
    });
    write('cms_audit_reports_v1', reports);

    // 7) cms_auditor_requests_v1 — give Lead Auditor + Management things to review
    const aReqsExisting = safe<any[]>('cms_auditor_requests_v1', []);
    if (aReqsExisting.length === 0) {
      const aReqs = [
        { id: 'aud-req-501', receivedAt: iso(-3), source: 'Website', name: 'Maria Gonzalez', email: 'maria@example.com', phone: '+34 91 555 0123', country: 'Spain', role: 'Lead Auditor', specialization: 'ISO 27001', yearsOverall: '14', yearsAudit: '9', department: 'Information Security', certifications: ['ISO 27001:2022', 'ISO 9001:2015'], message: 'Interested in joining as Lead Auditor.', status: 'Under Review', notes: '' },
        { id: 'aud-req-502', receivedAt: iso(-1), source: 'Email', name: 'Yuki Tanaka', email: 'yuki@example.com', phone: '+81 3 1234 5678', country: 'Japan', role: 'Auditor', specialization: 'Quality', yearsOverall: '8', yearsAudit: '5', department: 'Quality', certifications: ['ISO 9001:2015'], message: 'Open to remote audits.', status: 'Forwarded to Management', notes: 'Coordinator-reviewed.', reviewedByCoordinator: { by: 'Praveen Gangarapu', at: iso(-1), note: 'Strong references, recommend.' }, forwardedToManagementAt: iso(-1) },
      ];
      write('cms_auditor_requests_v1', aReqs);
    }

    // 8) Active client for Client Coordinator portal
    write('cms_active_client_id', 102);  // Default to NorthStar Aviation
    write('cms_active_org_id', 102);

    // 9) Reset the org-scoped caches so Client Coordinator regenerates with new id
    try {
      localStorage.removeItem('cms_org_certs_v1');
      localStorage.removeItem('cms_org_audit_schedules_v1');
      localStorage.removeItem('cms_org_audit_reports_v1');
    } catch { /* ignore */ }

    // Broadcast
    try {
      window.dispatchEvent(new CustomEvent('cms-workflow-handoff'));
      window.dispatchEvent(new CustomEvent('audit-workflow-updated'));
    } catch { /* ignore */ }

    localStorage.setItem(FLAG, '1');
    return true;
  } catch {
    return false;
  }
};
