/**
 * Seed demo Audit Workflow records.
 *
 * Populates `cms_audit_workflow` with realistic workflow rows that span every
 * stage of the certification pipeline. Runs once (guarded by a one-time flag);
 * if the user clears the list intentionally, the seeder does NOT re-fire.
 */

import { WorkflowRecord, WORKFLOW_KEY } from '../../../utils/auditWorkflow';

const SEED_FLAG_KEY = 'cms_audit_workflow_seeded_v2';

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const futureDate = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

const buildSeed = (): WorkflowRecord[] => [
  /* -------- Stage 2: Coordinator Assigned -------- */
  {
    clientId: 2, // Tech Innovations Ltd
    currentStage: 'Coordinator Assigned',
    assignedCoordinator: 'Praveen Gangarapu',
    assignedAt: daysAgo(3),
    history: [
      { stage: 'Registration Submitted', at: daysAgo(7),  by: 'Auditee · Sarah Smith' },
      { stage: 'Coordinator Assigned',    at: daysAgo(3),  by: 'Management',           note: 'Picked Audit Coordinator Praveen for ISO 27001 readiness.' },
    ],
    createdAt: daysAgo(7),
    updatedAt: daysAgo(3),
  },

  /* -------- Stage 3: Requirements Reviewed -------- */
  {
    clientId: 1, // Green Energy Solutions
    currentStage: 'Requirements Reviewed',
    assignedCoordinator: 'Praveen Gangarapu',
    assignedAt: daysAgo(14),
    requirements: {
      scope: 'Manufacturing line A & B at the Hyderabad facility, QMS scope as per ISO 9001:2015 sections 4-10.',
      standards: ['ISO 9001:2015'],
      documents: [
        'Quality Manual v3.2',
        'Process map (ISO-PM-001)',
        'Internal audit reports — last 12 months',
      ],
      notes: 'Stage 1 readiness review complete; client has closed all gaps from previous surveillance.',
      reviewedAt: daysAgo(5),
      reviewedBy: 'Praveen Gangarapu',
    },
    history: [
      { stage: 'Registration Submitted', at: daysAgo(28) },
      { stage: 'Coordinator Assigned',    at: daysAgo(20), by: 'Management' },
      { stage: 'Requirements Reviewed',   at: daysAgo(5),  by: 'Praveen Gangarapu', note: 'All required docs collected.' },
    ],
    createdAt: daysAgo(28),
    updatedAt: daysAgo(5),
  },

  /* -------- Stage 4: Schedule Proposed (awaiting auditee approval) -------- */
  {
    clientId: 3, // SkyHigh Construction
    currentStage: 'Schedule Proposed',
    assignedCoordinator: 'Praveen Gangarapu',
    assignedAt: daysAgo(22),
    requirements: {
      scope: 'Construction sites in Telangana + AP. Surveillance 1 of ISO 45001 OHS scope.',
      standards: ['ISO 45001:2018'],
      documents: ['HSE policy v2.1', 'Incident register YTD', 'Risk register v4'],
      notes: 'Major closed; ready for surveillance.',
      reviewedAt: daysAgo(10),
      reviewedBy: 'Praveen Gangarapu',
    },
    schedule: {
      proposedDate: futureDate(7),
      proposedTime: '09:30',
      leadAuditor: 'Anita Verma',
      auditor: 'Sandeep Joshi',
      notes: 'Two-day surveillance audit. Day 1 at HQ, day 2 at Site 4.',
      proposedAt: daysAgo(2),
      proposedBy: 'Praveen Gangarapu',
      decision: 'Pending',
    },
    history: [
      { stage: 'Registration Submitted', at: daysAgo(40) },
      { stage: 'Coordinator Assigned',    at: daysAgo(30), by: 'Management' },
      { stage: 'Requirements Reviewed',   at: daysAgo(10), by: 'Praveen Gangarapu' },
      { stage: 'Schedule Proposed',       at: daysAgo(2),  by: 'Praveen Gangarapu', note: 'Proposed ' + futureDate(7) + ' 09:30 with Anita Verma + Sandeep Joshi.' },
    ],
    createdAt: daysAgo(40),
    updatedAt: daysAgo(2),
  },

  /* -------- Stage 7: Schedule Approved by Auditee -------- */
  {
    clientId: 6, // AutoParts Manufacturing
    currentStage: 'Schedule Approved by Auditee',
    assignedCoordinator: 'Praveen Gangarapu',
    assignedAt: daysAgo(35),
    requirements: {
      scope: 'Plant 1 + supplier QC for surveillance 1.',
      standards: ['ISO 9001:2015'],
      documents: ['Process map', 'Supplier QC reports', 'Internal audit YTD'],
      notes: 'All readiness items confirmed.',
      reviewedAt: daysAgo(20),
      reviewedBy: 'Praveen Gangarapu',
    },
    schedule: {
      proposedDate: futureDate(14),
      proposedTime: '10:00',
      leadAuditor: 'Anita Verma',
      auditor: 'Vikram Singh',
      notes: 'Surveillance 1 — 2-day audit across plant 1 and supplier QC.',
      proposedAt: daysAgo(8),
      proposedBy: 'Praveen Gangarapu',
      decision: 'Approved',
      decisionAt: daysAgo(5),
      decisionNote: 'Client confirmed the proposed slot.',
    },
    history: [
      { stage: 'Registration Submitted', at: daysAgo(60) },
      { stage: 'Coordinator Assigned',    at: daysAgo(45), by: 'Management' },
      { stage: 'Requirements Reviewed',   at: daysAgo(20), by: 'Praveen Gangarapu' },
      { stage: 'Schedule Proposed',       at: daysAgo(8),  by: 'Praveen Gangarapu' },
      { stage: 'Schedule Approved by Auditee', at: daysAgo(5),  by: 'Auditee · Jennifer Taylor', note: 'Client confirmed the proposed slot.' },
    ],
    createdAt: daysAgo(60),
    updatedAt: daysAgo(5),
  },

  /* -------- Stage 9: Audit In Progress -------- */
  {
    clientId: 4, // Fresh Foods Packers
    currentStage: 'Audit In Progress',
    assignedCoordinator: 'Praveen Gangarapu',
    assignedAt: daysAgo(50),
    requirements: {
      scope: 'Cold chain + HACCP for Surveillance 2.',
      standards: ['ISO 22000:2018'],
      documents: ['HACCP plan v4', 'Cold-chain temperature logs', 'Allergen segregation matrix'],
      notes: 'All readiness items confirmed.',
      reviewedAt: daysAgo(30),
      reviewedBy: 'Praveen Gangarapu',
    },
    schedule: {
      proposedDate: futureDate(-1),
      proposedTime: '09:00',
      leadAuditor: 'Anita Verma',
      auditor: 'Vikram Singh',
      notes: 'Surveillance 2 — 3-day audit at Hyderabad packing facility.',
      proposedAt: daysAgo(20),
      proposedBy: 'Praveen Gangarapu',
      decision: 'Approved',
      decisionAt: daysAgo(18),
      decisionNote: 'Client confirmed.',
    },
    history: [
      { stage: 'Registration Submitted', at: daysAgo(80) },
      { stage: 'Coordinator Assigned',    at: daysAgo(60), by: 'Management' },
      { stage: 'Requirements Reviewed',   at: daysAgo(30), by: 'Praveen Gangarapu' },
      { stage: 'Schedule Proposed',       at: daysAgo(20), by: 'Praveen Gangarapu' },
      { stage: 'Schedule Approved by Auditee', at: daysAgo(18), by: 'Auditee · Emily Davis' },
      { stage: 'Schedule Approved by Auditor', at: daysAgo(17), by: 'Lead Auditor · Anita Verma' },
      { stage: 'Audit In Progress',       at: daysAgo(1),  by: 'Lead Auditor · Anita Verma', note: 'On-site day 1 complete.' },
    ],
    createdAt: daysAgo(80),
    updatedAt: daysAgo(1),
  },

  /* -------- Stage 14: Certification released -------- */
  {
    clientId: 8, // HealthFirst Hospital
    currentStage: 'Certification released',
    assignedCoordinator: 'Praveen Gangarapu',
    assignedAt: daysAgo(120),
    requirements: {
      scope: 'Hospital QMS — full transfer audit.',
      standards: ['ISO 9001:2015'],
      documents: ['Quality Manual v5', 'Incident register', 'Patient feedback summary'],
      notes: 'Transfer audit — previous certification body discontinued.',
      reviewedAt: daysAgo(95),
      reviewedBy: 'Praveen Gangarapu',
    },
    schedule: {
      proposedDate: futureDate(-30),
      proposedTime: '09:00',
      leadAuditor: 'Rajesh Kumar',
      auditor: 'Priya Reddy',
      notes: 'Transfer audit — 3 days.',
      proposedAt: daysAgo(80),
      proposedBy: 'Praveen Gangarapu',
      decision: 'Approved',
      decisionAt: daysAgo(75),
    },
    history: [
      { stage: 'Registration Submitted', at: daysAgo(150) },
      { stage: 'Coordinator Assigned',    at: daysAgo(130), by: 'Management' },
      { stage: 'Requirements Reviewed',   at: daysAgo(95),  by: 'Praveen Gangarapu' },
      { stage: 'Schedule Proposed',       at: daysAgo(80),  by: 'Praveen Gangarapu' },
      { stage: 'Schedule Approved by Auditee', at: daysAgo(75),  by: 'Auditee · Lisa Anderson' },
      { stage: 'Schedule Approved by Auditor', at: daysAgo(74),  by: 'Lead Auditor · Rajesh Kumar' },
      { stage: 'Audit In Progress',       at: daysAgo(30) },
      { stage: 'Audit Completed',         at: daysAgo(25),  by: 'Lead Auditor · Rajesh Kumar', note: 'Audit fieldwork complete.' },
      { stage: 'Audit findings',          at: daysAgo(24),  by: 'Lead Auditor · Rajesh Kumar', note: 'Findings documented for review.' },
      { stage: 'Action items released to Auditor', at: daysAgo(23), by: 'Audit Coordinator' },
      { stage: 'Review and Approval by Auditor', at: daysAgo(22), by: 'Auditor · Priya Reddy' },
      { stage: 'Certification released',  at: daysAgo(20),  by: 'Certifier', note: 'Certificate issued to client.' },
    ],
    createdAt: daysAgo(150),
    updatedAt: daysAgo(20),
  },

  /* -------- Stage 6: Assigned Auditors (Lead auditor, Auditor) -------- */
  {
    clientId: 7, // Chemical Bros Ltd
    currentStage: 'Assigned Auditors (Lead auditor, Auditor)',
    assignedCoordinator: 'Praveen Gangarapu',
    assignedAt: daysAgo(1),
    requirements: {
      scope: 'Chemical manufacturing and lab operations, ISO 9001 surveillance scope.',
      standards: ['ISO 9001:2015'],
      documents: ['Process safety plan', 'Calibration records'],
      notes: 'Client documents received; auditor assignment pending approval.',
      reviewedAt: daysAgo(1),
      reviewedBy: 'Praveen Gangarapu',
    },
    schedule: {
      proposedDate: futureDate(5),
      proposedTime: '11:00',
      leadAuditor: 'Sunita Rao',
      auditor: 'Karan Mehta',
      notes: 'Initial surveillance slot proposed; audit team assigned.',
      proposedAt: daysAgo(1),
      proposedBy: 'Praveen Gangarapu',
      decision: 'Pending',
    },
    history: [
      { stage: 'Registration Submitted', at: daysAgo(2)  },
      { stage: 'Coordinator Assigned',    at: daysAgo(1), by: 'Management', note: 'Newly assigned, awaiting requirements review.' },
      { stage: 'Requirements Reviewed',   at: daysAgo(1), by: 'Praveen Gangarapu', note: 'Ready for auditor assignment.' },
      { stage: 'Schedule Proposed',       at: daysAgo(1), by: 'Praveen Gangarapu' },
      { stage: 'Assigned Auditors (Lead auditor, Auditor)', at: daysAgo(1), by: 'Audit Coordinator', note: 'Lead auditor and auditor assigned.' },
    ],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
  },

  /* ============================================================
     Additional records covering every remaining new stage —
     mapped onto global-seed clients (IDs 201+) so the workflow
     summary panel always shows coverage across all 14 stages.
  ============================================================ */

  /* -------- Stage 1: Pre-Registration (just enquired) -------- */
  {
    clientId: 202, // TechCore Inc
    currentStage: 'Pre-Registration',
    history: [
      { stage: 'Pre-Registration', at: daysAgo(1), by: 'Public website · TechCore Inc', note: 'Client onboarding in progress — enquiry submitted from website.' },
    ],
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },

  /* -------- Stage 8: Schedule Approved by Auditor -------- */
  {
    clientId: 206, // Berlin Cloud Services
    currentStage: 'Schedule Approved by Auditor',
    assignedCoordinator: 'Praveen Gangarapu',
    assignedAt: daysAgo(20),
    requirements: {
      scope: 'Berlin Cloud — ISMS scope for cloud + dev pipelines.',
      standards: ['ISO 27001:2022'],
      documents: ['Statement of Applicability v2', 'Risk register', 'Access review evidence'],
      notes: 'Ready for audit. Audit team confirmed.',
      reviewedAt: daysAgo(12),
      reviewedBy: 'Praveen Gangarapu',
    },
    schedule: {
      proposedDate: futureDate(10),
      proposedTime: '09:00',
      leadAuditor: 'Klaus Mueller',
      auditor: 'Lena Schwarz',
      notes: 'Stage 2 — 3 days on-site in Berlin.',
      proposedAt: daysAgo(6),
      proposedBy: 'Praveen Gangarapu',
      decision: 'Approved',
      decisionAt: daysAgo(4),
    },
    history: [
      { stage: 'Registration Submitted',                       at: daysAgo(30) },
      { stage: 'Coordinator Assigned',                          at: daysAgo(20), by: 'Management' },
      { stage: 'Requirements Reviewed',                         at: daysAgo(12), by: 'Praveen Gangarapu' },
      { stage: 'Schedule Proposed',                             at: daysAgo(6),  by: 'Praveen Gangarapu' },
      { stage: 'Assigned Auditors (Lead auditor, Auditor)',     at: daysAgo(5),  by: 'Audit Coordinator', note: 'Klaus + Lena assigned.' },
      { stage: 'Schedule Approved by Auditee',                  at: daysAgo(4),  by: 'Auditee · Anna Becker' },
      { stage: 'Schedule Approved by Auditor',                  at: daysAgo(3),  by: 'Lead Auditor · Klaus Mueller', note: 'Auditor approved the schedule.' },
    ],
    createdAt: daysAgo(30),
    updatedAt: daysAgo(3),
  },

  /* -------- Stage 10: Audit Completed (fieldwork done, awaiting findings write-up) -------- */
  {
    clientId: 211, // Sand Dune Construction
    currentStage: 'Audit Completed',
    assignedCoordinator: 'Praveen Gangarapu',
    assignedAt: daysAgo(45),
    requirements: {
      scope: 'Active construction sites — Surveillance 1 of ISO 45001.',
      standards: ['ISO 45001:2018'],
      documents: ['Risk register v3', 'Incident log YTD', 'PPE inventory'],
      notes: 'All readiness items confirmed.',
      reviewedAt: daysAgo(30),
      reviewedBy: 'Praveen Gangarapu',
    },
    schedule: {
      proposedDate: futureDate(-5),
      proposedTime: '08:30',
      leadAuditor: 'Ahmed Al-Rashid',
      auditor: 'Fatima Al-Maktoum',
      notes: 'Surveillance 1 — 2 days on-site.',
      proposedAt: daysAgo(20),
      proposedBy: 'Praveen Gangarapu',
      decision: 'Approved',
      decisionAt: daysAgo(15),
    },
    history: [
      { stage: 'Registration Submitted',                       at: daysAgo(60) },
      { stage: 'Coordinator Assigned',                          at: daysAgo(45), by: 'Management' },
      { stage: 'Requirements Reviewed',                         at: daysAgo(30), by: 'Praveen Gangarapu' },
      { stage: 'Schedule Proposed',                             at: daysAgo(20), by: 'Praveen Gangarapu' },
      { stage: 'Assigned Auditors (Lead auditor, Auditor)',     at: daysAgo(18), by: 'Audit Coordinator' },
      { stage: 'Schedule Approved by Auditee',                  at: daysAgo(15), by: 'Auditee · Mariam Hassan' },
      { stage: 'Schedule Approved by Auditor',                  at: daysAgo(14), by: 'Lead Auditor · Ahmed Al-Rashid' },
      { stage: 'Audit In Progress',                             at: daysAgo(5),  by: 'Lead Auditor · Ahmed Al-Rashid' },
      { stage: 'Audit Completed',                               at: daysAgo(2),  by: 'Lead Auditor · Ahmed Al-Rashid', note: 'Audit fieldwork complete.' },
    ],
    createdAt: daysAgo(60),
    updatedAt: daysAgo(2),
  },

  /* -------- Stage 11: Audit findings (documented, waiting for action items) -------- */
  {
    clientId: 209, // GreenGrove Foods
    currentStage: 'Audit findings',
    assignedCoordinator: 'Praveen Gangarapu',
    assignedAt: daysAgo(70),
    requirements: {
      scope: 'Surveillance 1 — Food safety scope for cold chain + HACCP.',
      standards: ['ISO 22000:2018'],
      documents: ['HACCP plan v3', 'Cold-chain logs', 'Allergen matrix'],
      notes: 'All readiness items confirmed.',
      reviewedAt: daysAgo(55),
      reviewedBy: 'Praveen Gangarapu',
    },
    schedule: {
      proposedDate: futureDate(-12),
      proposedTime: '09:00',
      leadAuditor: 'Anita Verma',
      auditor: 'Vikram Singh',
      notes: 'Surveillance 1 — 2 days on-site in Bangalore.',
      proposedAt: daysAgo(40),
      proposedBy: 'Praveen Gangarapu',
      decision: 'Approved',
      decisionAt: daysAgo(35),
    },
    history: [
      { stage: 'Registration Submitted',                       at: daysAgo(90) },
      { stage: 'Coordinator Assigned',                          at: daysAgo(70), by: 'Management' },
      { stage: 'Requirements Reviewed',                         at: daysAgo(55), by: 'Praveen Gangarapu' },
      { stage: 'Schedule Proposed',                             at: daysAgo(40), by: 'Praveen Gangarapu' },
      { stage: 'Assigned Auditors (Lead auditor, Auditor)',     at: daysAgo(38), by: 'Audit Coordinator' },
      { stage: 'Schedule Approved by Auditee',                  at: daysAgo(35), by: 'Auditee · Anita Iyer' },
      { stage: 'Schedule Approved by Auditor',                  at: daysAgo(34), by: 'Lead Auditor · Anita Verma' },
      { stage: 'Audit In Progress',                             at: daysAgo(14) },
      { stage: 'Audit Completed',                               at: daysAgo(10), by: 'Lead Auditor · Anita Verma' },
      { stage: 'Audit findings',                                at: daysAgo(8),  by: 'Lead Auditor · Anita Verma', note: 'Findings documented (2 Minor, 1 OFI).' },
    ],
    createdAt: daysAgo(90),
    updatedAt: daysAgo(8),
  },

  /* -------- Stage 12: Action items released to Auditor -------- */
  {
    clientId: 205, // AutoTeknik GmbH
    currentStage: 'Action items released to Auditor',
    assignedCoordinator: 'Praveen Gangarapu',
    assignedAt: daysAgo(120),
    requirements: {
      scope: 'Surveillance 2 — manufacturing HQ + supplier QC.',
      standards: ['ISO 9001:2015'],
      documents: ['Process map v4', 'Supplier QC reports', 'Internal audit YTD'],
      notes: 'All readiness items confirmed.',
      reviewedAt: daysAgo(95),
      reviewedBy: 'Praveen Gangarapu',
    },
    schedule: {
      proposedDate: futureDate(-25),
      proposedTime: '08:00',
      leadAuditor: 'Klaus Mueller',
      auditor: 'Lena Schwarz',
      notes: 'Surveillance 2 — 3 days at Munich plant.',
      proposedAt: daysAgo(70),
      proposedBy: 'Praveen Gangarapu',
      decision: 'Approved',
      decisionAt: daysAgo(65),
    },
    history: [
      { stage: 'Registration Submitted',                       at: daysAgo(150) },
      { stage: 'Coordinator Assigned',                          at: daysAgo(120), by: 'Management' },
      { stage: 'Requirements Reviewed',                         at: daysAgo(95),  by: 'Praveen Gangarapu' },
      { stage: 'Schedule Proposed',                             at: daysAgo(70),  by: 'Praveen Gangarapu' },
      { stage: 'Assigned Auditors (Lead auditor, Auditor)',     at: daysAgo(68),  by: 'Audit Coordinator' },
      { stage: 'Schedule Approved by Auditee',                  at: daysAgo(65),  by: 'Auditee · Hans Schmidt' },
      { stage: 'Schedule Approved by Auditor',                  at: daysAgo(64),  by: 'Lead Auditor · Klaus Mueller' },
      { stage: 'Audit In Progress',                             at: daysAgo(28) },
      { stage: 'Audit Completed',                               at: daysAgo(25),  by: 'Lead Auditor · Klaus Mueller' },
      { stage: 'Audit findings',                                at: daysAgo(22),  by: 'Lead Auditor · Klaus Mueller', note: '3 findings documented.' },
      { stage: 'Action items released to Auditor',              at: daysAgo(20),  by: 'Audit Coordinator', note: 'Action items sent to auditor for client follow-up.' },
    ],
    createdAt: daysAgo(150),
    updatedAt: daysAgo(20),
  },

  /* -------- Stage 13: Review and Approval by Auditor -------- */
  {
    clientId: 203, // BritEnergy Plc
    currentStage: 'Review and Approval by Auditor',
    assignedCoordinator: 'Praveen Gangarapu',
    assignedAt: daysAgo(180),
    requirements: {
      scope: 'Recertification — renewable energy plants.',
      standards: ['ISO 14001:2015'],
      documents: ['EMS manual v6', 'Emission reports YTD', 'Internal audit YTD'],
      notes: 'Recertification readiness complete.',
      reviewedAt: daysAgo(150),
      reviewedBy: 'Praveen Gangarapu',
    },
    schedule: {
      proposedDate: futureDate(-15),
      proposedTime: '09:30',
      leadAuditor: 'Oliver Bennett',
      auditor: 'Charlotte Davies',
      notes: 'Recertification — 3 days across two sites.',
      proposedAt: daysAgo(110),
      proposedBy: 'Praveen Gangarapu',
      decision: 'Approved',
      decisionAt: daysAgo(105),
    },
    history: [
      { stage: 'Registration Submitted',                       at: daysAgo(200) },
      { stage: 'Coordinator Assigned',                          at: daysAgo(180), by: 'Management' },
      { stage: 'Requirements Reviewed',                         at: daysAgo(150), by: 'Praveen Gangarapu' },
      { stage: 'Schedule Proposed',                             at: daysAgo(110), by: 'Praveen Gangarapu' },
      { stage: 'Assigned Auditors (Lead auditor, Auditor)',     at: daysAgo(108), by: 'Audit Coordinator' },
      { stage: 'Schedule Approved by Auditee',                  at: daysAgo(105), by: 'Auditee · Henry Watson' },
      { stage: 'Schedule Approved by Auditor',                  at: daysAgo(104), by: 'Lead Auditor · Oliver Bennett' },
      { stage: 'Audit In Progress',                             at: daysAgo(18) },
      { stage: 'Audit Completed',                               at: daysAgo(15),  by: 'Lead Auditor · Oliver Bennett' },
      { stage: 'Audit findings',                                at: daysAgo(13),  by: 'Lead Auditor · Oliver Bennett' },
      { stage: 'Action items released to Auditor',              at: daysAgo(10),  by: 'Audit Coordinator' },
      { stage: 'Review and Approval by Auditor',                at: daysAgo(2),   by: 'Auditor · Charlotte Davies', note: 'Client closures verified; ready for certification.' },
    ],
    createdAt: daysAgo(200),
    updatedAt: daysAgo(2),
  },
];

const CLIENT_KEY = 'cms_client_registrations';

/**
 * Read the clients currently in localStorage so we can attach stages to
 * their real IDs (rather than hard-coded IDs that may not exist any more).
 */
const readCurrentClientIds = (): number[] => {
  try {
    const raw = localStorage.getItem(CLIENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((c: any) => c.id).filter((n: any) => typeof n === 'number');
  } catch {
    return [];
  }
};

/**
 * Build a fallback set of workflow records mapped onto whatever clients
 * currently exist. Each of the 14 stages gets at least one client.
 */
const buildDynamicSeed = (clientIds: number[]): WorkflowRecord[] => {
  // Recipes — stage + how to back-date the timeline
  const RECIPES = [
    { stage: 'Pre-Registration' as const, daysBack: 1,
      history: [{ stage: 'Pre-Registration' as const, at: daysAgo(1), by: 'Public website', note: 'Client onboarding in progress.' }] },
    { stage: 'Registration Submitted' as const, daysBack: 3,
      history: [
        { stage: 'Pre-Registration' as const, at: daysAgo(5) },
        { stage: 'Registration Submitted' as const, at: daysAgo(3), by: 'Auditee', note: 'Auditee registered.' },
      ] },
    { stage: 'Coordinator Assigned' as const, daysBack: 5,
      history: [
        { stage: 'Pre-Registration' as const, at: daysAgo(10) },
        { stage: 'Registration Submitted' as const, at: daysAgo(8), by: 'Auditee' },
        { stage: 'Coordinator Assigned' as const, at: daysAgo(5), by: 'Management', note: 'Management assigned coordinator.' },
      ] },
    { stage: 'Requirements Reviewed' as const, daysBack: 12,
      history: [
        { stage: 'Pre-Registration' as const, at: daysAgo(40) },
        { stage: 'Registration Submitted' as const, at: daysAgo(35), by: 'Auditee' },
        { stage: 'Coordinator Assigned' as const, at: daysAgo(25), by: 'Management' },
        { stage: 'Requirements Reviewed' as const, at: daysAgo(12), by: 'Audit Coordinator', note: 'Requirements reviewed and confirmed.' },
      ] },
    { stage: 'Schedule Proposed' as const, daysBack: 6,
      history: [
        { stage: 'Pre-Registration' as const, at: daysAgo(45) },
        { stage: 'Registration Submitted' as const, at: daysAgo(40), by: 'Auditee' },
        { stage: 'Coordinator Assigned' as const, at: daysAgo(30), by: 'Management' },
        { stage: 'Requirements Reviewed' as const, at: daysAgo(15), by: 'Audit Coordinator' },
        { stage: 'Schedule Proposed' as const, at: daysAgo(6), by: 'Audit Coordinator', note: 'Schedule proposed to auditee.' },
      ] },
    { stage: 'Assigned Auditors (Lead auditor, Auditor)' as const, daysBack: 4,
      history: [
        { stage: 'Pre-Registration' as const, at: daysAgo(60) },
        { stage: 'Registration Submitted' as const, at: daysAgo(50), by: 'Auditee' },
        { stage: 'Coordinator Assigned' as const, at: daysAgo(35), by: 'Management' },
        { stage: 'Requirements Reviewed' as const, at: daysAgo(20), by: 'Audit Coordinator' },
        { stage: 'Schedule Proposed' as const, at: daysAgo(10), by: 'Audit Coordinator' },
        { stage: 'Assigned Auditors (Lead auditor, Auditor)' as const, at: daysAgo(4), by: 'Audit Coordinator', note: 'Audit team assigned.' },
      ] },
    { stage: 'Schedule Approved by Auditee' as const, daysBack: 3,
      history: [
        { stage: 'Pre-Registration' as const, at: daysAgo(65) },
        { stage: 'Registration Submitted' as const, at: daysAgo(55), by: 'Auditee' },
        { stage: 'Coordinator Assigned' as const, at: daysAgo(40), by: 'Management' },
        { stage: 'Requirements Reviewed' as const, at: daysAgo(25), by: 'Audit Coordinator' },
        { stage: 'Schedule Proposed' as const, at: daysAgo(12), by: 'Audit Coordinator' },
        { stage: 'Assigned Auditors (Lead auditor, Auditor)' as const, at: daysAgo(8), by: 'Audit Coordinator' },
        { stage: 'Schedule Approved by Auditee' as const, at: daysAgo(3), by: 'Auditee', note: 'Auditee approved the schedule.' },
      ] },
    { stage: 'Schedule Approved by Auditor' as const, daysBack: 2,
      history: [
        { stage: 'Pre-Registration' as const, at: daysAgo(70) },
        { stage: 'Registration Submitted' as const, at: daysAgo(60), by: 'Auditee' },
        { stage: 'Coordinator Assigned' as const, at: daysAgo(45), by: 'Management' },
        { stage: 'Requirements Reviewed' as const, at: daysAgo(28), by: 'Audit Coordinator' },
        { stage: 'Schedule Proposed' as const, at: daysAgo(14), by: 'Audit Coordinator' },
        { stage: 'Assigned Auditors (Lead auditor, Auditor)' as const, at: daysAgo(10), by: 'Audit Coordinator' },
        { stage: 'Schedule Approved by Auditee' as const, at: daysAgo(4), by: 'Auditee' },
        { stage: 'Schedule Approved by Auditor' as const, at: daysAgo(2), by: 'Lead Auditor', note: 'Auditor approved the schedule.' },
      ] },
    { stage: 'Audit In Progress' as const, daysBack: 1,
      history: [
        { stage: 'Pre-Registration' as const, at: daysAgo(80) },
        { stage: 'Registration Submitted' as const, at: daysAgo(70), by: 'Auditee' },
        { stage: 'Coordinator Assigned' as const, at: daysAgo(55), by: 'Management' },
        { stage: 'Requirements Reviewed' as const, at: daysAgo(35), by: 'Audit Coordinator' },
        { stage: 'Schedule Proposed' as const, at: daysAgo(20), by: 'Audit Coordinator' },
        { stage: 'Assigned Auditors (Lead auditor, Auditor)' as const, at: daysAgo(16), by: 'Audit Coordinator' },
        { stage: 'Schedule Approved by Auditee' as const, at: daysAgo(10), by: 'Auditee' },
        { stage: 'Schedule Approved by Auditor' as const, at: daysAgo(9), by: 'Lead Auditor' },
        { stage: 'Audit In Progress' as const, at: daysAgo(1), by: 'Lead Auditor', note: 'Audit underway.' },
      ] },
    { stage: 'Audit Completed' as const, daysBack: 2,
      history: [
        { stage: 'Pre-Registration' as const, at: daysAgo(90) },
        { stage: 'Registration Submitted' as const, at: daysAgo(80), by: 'Auditee' },
        { stage: 'Coordinator Assigned' as const, at: daysAgo(60), by: 'Management' },
        { stage: 'Requirements Reviewed' as const, at: daysAgo(40), by: 'Audit Coordinator' },
        { stage: 'Schedule Proposed' as const, at: daysAgo(25), by: 'Audit Coordinator' },
        { stage: 'Assigned Auditors (Lead auditor, Auditor)' as const, at: daysAgo(22), by: 'Audit Coordinator' },
        { stage: 'Schedule Approved by Auditee' as const, at: daysAgo(15), by: 'Auditee' },
        { stage: 'Schedule Approved by Auditor' as const, at: daysAgo(14), by: 'Lead Auditor' },
        { stage: 'Audit In Progress' as const, at: daysAgo(7), by: 'Lead Auditor' },
        { stage: 'Audit Completed' as const, at: daysAgo(2), by: 'Lead Auditor', note: 'Audit fieldwork complete.' },
      ] },
    { stage: 'Audit findings' as const, daysBack: 4,
      history: [
        { stage: 'Pre-Registration' as const, at: daysAgo(100) },
        { stage: 'Registration Submitted' as const, at: daysAgo(90), by: 'Auditee' },
        { stage: 'Coordinator Assigned' as const, at: daysAgo(70), by: 'Management' },
        { stage: 'Requirements Reviewed' as const, at: daysAgo(50), by: 'Audit Coordinator' },
        { stage: 'Schedule Proposed' as const, at: daysAgo(30), by: 'Audit Coordinator' },
        { stage: 'Assigned Auditors (Lead auditor, Auditor)' as const, at: daysAgo(26), by: 'Audit Coordinator' },
        { stage: 'Schedule Approved by Auditee' as const, at: daysAgo(20), by: 'Auditee' },
        { stage: 'Schedule Approved by Auditor' as const, at: daysAgo(19), by: 'Lead Auditor' },
        { stage: 'Audit In Progress' as const, at: daysAgo(12), by: 'Lead Auditor' },
        { stage: 'Audit Completed' as const, at: daysAgo(8), by: 'Lead Auditor' },
        { stage: 'Audit findings' as const, at: daysAgo(4), by: 'Lead Auditor', note: 'Findings documented.' },
      ] },
    { stage: 'Action items released to Auditor' as const, daysBack: 6,
      history: [
        { stage: 'Pre-Registration' as const, at: daysAgo(120) },
        { stage: 'Registration Submitted' as const, at: daysAgo(110), by: 'Auditee' },
        { stage: 'Coordinator Assigned' as const, at: daysAgo(90), by: 'Management' },
        { stage: 'Requirements Reviewed' as const, at: daysAgo(60), by: 'Audit Coordinator' },
        { stage: 'Schedule Proposed' as const, at: daysAgo(40), by: 'Audit Coordinator' },
        { stage: 'Assigned Auditors (Lead auditor, Auditor)' as const, at: daysAgo(36), by: 'Audit Coordinator' },
        { stage: 'Schedule Approved by Auditee' as const, at: daysAgo(30), by: 'Auditee' },
        { stage: 'Schedule Approved by Auditor' as const, at: daysAgo(29), by: 'Lead Auditor' },
        { stage: 'Audit In Progress' as const, at: daysAgo(22), by: 'Lead Auditor' },
        { stage: 'Audit Completed' as const, at: daysAgo(18), by: 'Lead Auditor' },
        { stage: 'Audit findings' as const, at: daysAgo(14), by: 'Lead Auditor' },
        { stage: 'Action items released to Auditor' as const, at: daysAgo(6), by: 'Audit Coordinator', note: 'Action items sent to auditor.' },
      ] },
    { stage: 'Review and Approval by Auditor' as const, daysBack: 3,
      history: [
        { stage: 'Pre-Registration' as const, at: daysAgo(140) },
        { stage: 'Registration Submitted' as const, at: daysAgo(130), by: 'Auditee' },
        { stage: 'Coordinator Assigned' as const, at: daysAgo(110), by: 'Management' },
        { stage: 'Requirements Reviewed' as const, at: daysAgo(70), by: 'Audit Coordinator' },
        { stage: 'Schedule Proposed' as const, at: daysAgo(50), by: 'Audit Coordinator' },
        { stage: 'Assigned Auditors (Lead auditor, Auditor)' as const, at: daysAgo(46), by: 'Audit Coordinator' },
        { stage: 'Schedule Approved by Auditee' as const, at: daysAgo(40), by: 'Auditee' },
        { stage: 'Schedule Approved by Auditor' as const, at: daysAgo(39), by: 'Lead Auditor' },
        { stage: 'Audit In Progress' as const, at: daysAgo(30), by: 'Lead Auditor' },
        { stage: 'Audit Completed' as const, at: daysAgo(26), by: 'Lead Auditor' },
        { stage: 'Audit findings' as const, at: daysAgo(20), by: 'Lead Auditor' },
        { stage: 'Action items released to Auditor' as const, at: daysAgo(12), by: 'Audit Coordinator' },
        { stage: 'Review and Approval by Auditor' as const, at: daysAgo(3), by: 'Auditor', note: 'Auditor review and approval complete.' },
      ] },
    { stage: 'Certification released' as const, daysBack: 5,
      history: [
        { stage: 'Pre-Registration' as const, at: daysAgo(170) },
        { stage: 'Registration Submitted' as const, at: daysAgo(160), by: 'Auditee' },
        { stage: 'Coordinator Assigned' as const, at: daysAgo(140), by: 'Management' },
        { stage: 'Requirements Reviewed' as const, at: daysAgo(100), by: 'Audit Coordinator' },
        { stage: 'Schedule Proposed' as const, at: daysAgo(70), by: 'Audit Coordinator' },
        { stage: 'Assigned Auditors (Lead auditor, Auditor)' as const, at: daysAgo(66), by: 'Audit Coordinator' },
        { stage: 'Schedule Approved by Auditee' as const, at: daysAgo(55), by: 'Auditee' },
        { stage: 'Schedule Approved by Auditor' as const, at: daysAgo(54), by: 'Lead Auditor' },
        { stage: 'Audit In Progress' as const, at: daysAgo(40), by: 'Lead Auditor' },
        { stage: 'Audit Completed' as const, at: daysAgo(35), by: 'Lead Auditor' },
        { stage: 'Audit findings' as const, at: daysAgo(28), by: 'Lead Auditor' },
        { stage: 'Action items released to Auditor' as const, at: daysAgo(20), by: 'Audit Coordinator' },
        { stage: 'Review and Approval by Auditor' as const, at: daysAgo(10), by: 'Auditor' },
        { stage: 'Certification released' as const, at: daysAgo(5), by: 'Certifier', note: 'Certification issued.' },
      ] },
  ];

  // Cycle recipes across the available client IDs so every stage has at least
  // one client. If we have more clients than recipes, the cycle wraps.
  const out: WorkflowRecord[] = [];
  for (let i = 0; i < clientIds.length; i++) {
    const recipe = RECIPES[i % RECIPES.length];
    out.push({
      clientId: clientIds[i],
      currentStage: recipe.stage,
      assignedCoordinator: 'Praveen Gangarapu',
      assignedAt: daysAgo(Math.max(recipe.daysBack + 3, 5)),
      history: recipe.history.map(h => ({ ...h })),
      createdAt: daysAgo(recipe.daysBack + 30),
      updatedAt: daysAgo(recipe.daysBack),
    });
  }
  return out;
};

export const seedWorkflowDemo = (): boolean => {
  try {
    if (localStorage.getItem(SEED_FLAG_KEY) === '1') return false;
    const existing = localStorage.getItem(WORKFLOW_KEY);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Existing data — only re-seed if the records reference client IDs
        // that aren't in the current client table (data drift).
        const currentIds = new Set(readCurrentClientIds());
        const anyLive = parsed.some((w: any) => currentIds.has(w.clientId));
        if (anyLive) {
          localStorage.setItem(SEED_FLAG_KEY, '1');
          return false;
        }
        // Otherwise fall through and re-seed against live clients.
      }
    }
    const currentIds = readCurrentClientIds();
    // If we have live clients, seed against them so every record is visible
    // on the AuditWorkflow page; otherwise fall back to the static buildSeed().
    const seed = currentIds.length > 0 ? buildDynamicSeed(currentIds) : buildSeed();
    localStorage.setItem(WORKFLOW_KEY, JSON.stringify(seed));
    localStorage.setItem(SEED_FLAG_KEY, '1');
    return true;
  } catch {
    return false;
  }
};
