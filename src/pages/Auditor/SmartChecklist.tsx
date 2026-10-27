/**
 * SmartChecklist — AI-powered audit checklist generator for the Auditor role.
 * Heuristic immediately, Claude upgrade when key configured.
 */
import React, { useState, useRef, useMemo } from 'react';
import {
  CheckSquare, Square, Wand2, Loader2, Info, Sparkles,
  Copy, Download, RefreshCw, ChevronDown, ChevronUp,
  ClipboardCheck, AlertTriangle, CheckCircle2, BookOpen,
} from 'lucide-react';
import { isClaudeConfigured, getApiKey, getModel, anthropicFetch } from '../../ai/claudeClient';

/* ──────────────────────── Types ───────────────────────────────── */
interface CheckItem {
  id: string;
  text: string;
  priority: 'High' | 'Medium' | 'Low';
  evidence: string;
}
interface Section {
  title: string;
  emoji: string;
  items: CheckItem[];
}

/* ──────────────────────── Heuristic data ──────────────────────── */
type Std = 'ISO 9001:2015' | 'ISO 14001:2015' | 'ISO 45001:2018' | 'ISO 27001:2022' | 'ISO 22000:2018' | 'ISO 13485:2016';

const BASE_SECTIONS: Record<Std, Section[]> = {
  'ISO 9001:2015': [
    {
      title: 'Pre-Audit Activities', emoji: '📋',
      items: [
        { id: 'p1', text: 'Review previous audit report and open non-conformances', priority: 'High', evidence: 'Previous audit report, CAR register' },
        { id: 'p2', text: 'Confirm audit scope, objectives, and criteria with client', priority: 'High', evidence: 'Audit plan signed off by both parties' },
        { id: 'p3', text: 'Obtain and review Quality Manual and documented procedures', priority: 'High', evidence: 'Quality manual, procedure index' },
        { id: 'p4', text: 'Review scope of certification and exclusions', priority: 'Medium', evidence: 'Certification scope document' },
        { id: 'p5', text: 'Prepare audit checklist tailored to client processes', priority: 'Medium', evidence: 'Completed checklist template' },
        { id: 'p6', text: 'Confirm logistics: rooms, availability of key personnel', priority: 'Low', evidence: 'Audit schedule sent and confirmed' },
      ],
    },
    {
      title: 'Context of the Organisation (Clause 4)', emoji: '🏢',
      items: [
        { id: 'c1', text: 'Verify identification of internal and external issues (4.1)', priority: 'High', evidence: 'SWOT/PESTLE analysis or equivalent' },
        { id: 'c2', text: 'Check identification of interested parties and their requirements (4.2)', priority: 'High', evidence: 'Stakeholder register / risk register' },
        { id: 'c3', text: 'Confirm QMS scope is defined, documented, and accessible (4.3)', priority: 'High', evidence: 'Quality manual / scope document' },
        { id: 'c4', text: 'Verify QMS processes are determined and their interactions mapped (4.4)', priority: 'Medium', evidence: 'Process map / turtle diagrams' },
      ],
    },
    {
      title: 'Leadership (Clause 5)', emoji: '👔',
      items: [
        { id: 'l1', text: 'Confirm top management demonstrates QMS leadership and commitment (5.1)', priority: 'High', evidence: 'Management review minutes, policy sign-off' },
        { id: 'l2', text: 'Verify Quality Policy is appropriate, documented, and communicated (5.2)', priority: 'High', evidence: 'Posted policy, staff awareness check' },
        { id: 'l3', text: 'Check roles, responsibilities, and authorities are assigned and communicated (5.3)', priority: 'Medium', evidence: 'Org chart, job descriptions' },
      ],
    },
    {
      title: 'Planning (Clause 6)', emoji: '📊',
      items: [
        { id: 'pl1', text: 'Review risk and opportunity identification and treatment (6.1)', priority: 'High', evidence: 'Risk register, risk treatment log' },
        { id: 'pl2', text: 'Confirm quality objectives are set, measurable, and monitored (6.2)', priority: 'High', evidence: 'KPI records, objective tracking spreadsheet' },
        { id: 'pl3', text: 'Check change management process is in place (6.3)', priority: 'Medium', evidence: 'Change request records' },
      ],
    },
    {
      title: 'Support (Clause 7)', emoji: '🛠️',
      items: [
        { id: 's1', text: 'Verify resources (people, infrastructure, environment) are adequate (7.1)', priority: 'High', evidence: 'Maintenance logs, equipment list' },
        { id: 's2', text: 'Review competence evidence for all relevant roles (7.2)', priority: 'High', evidence: 'Training records, competency matrix' },
        { id: 's3', text: 'Check awareness of Quality Policy and QMS objectives (7.3)', priority: 'Medium', evidence: 'Staff interviews, training records' },
        { id: 's4', text: 'Verify internal/external communication processes (7.4)', priority: 'Medium', evidence: 'Communication plan, meeting minutes' },
        { id: 's5', text: 'Confirm documented information is controlled and current (7.5)', priority: 'High', evidence: 'Document control log, version history' },
      ],
    },
    {
      title: 'Operations (Clause 8)', emoji: '⚙️',
      items: [
        { id: 'o1', text: 'Check operational planning and control of processes (8.1)', priority: 'High', evidence: 'Work instructions, process records' },
        { id: 'o2', text: 'Review customer requirements and change communication (8.2)', priority: 'High', evidence: 'Sales orders, contract review records' },
        { id: 'o3', text: 'Verify design and development process if applicable (8.3)', priority: 'Medium', evidence: 'D&D plan, design reviews, verification records' },
        { id: 'o4', text: 'Check external provider (supplier) control (8.4)', priority: 'High', evidence: 'Approved supplier list, purchase records, supplier evaluations' },
        { id: 'o5', text: 'Verify production/service provision controls (8.5)', priority: 'High', evidence: 'Process controls, traveller cards, batch records' },
        { id: 'o6', text: 'Check identification and traceability throughout processes (8.5.2)', priority: 'Medium', evidence: 'Labelling, lot/batch records' },
        { id: 'o7', text: 'Review handling of customer or external property (8.5.3)', priority: 'Low', evidence: 'Property register, handling procedures' },
        { id: 'o8', text: 'Verify nonconforming output is controlled (8.7)', priority: 'High', evidence: 'NCR log, quarantine procedures, disposition records' },
      ],
    },
    {
      title: 'Performance Evaluation (Clause 9)', emoji: '📈',
      items: [
        { id: 'pe1', text: 'Check monitoring, measurement, analysis, and evaluation activities (9.1)', priority: 'High', evidence: 'KPI reports, measurement records, calibration certs' },
        { id: 'pe2', text: 'Review customer satisfaction monitoring (9.1.2)', priority: 'High', evidence: 'Customer survey results, complaints log, satisfaction scores' },
        { id: 'pe3', text: 'Verify internal audit programme is established and completed (9.2)', priority: 'High', evidence: 'Internal audit schedule, audit reports, CA evidence' },
        { id: 'pe4', text: 'Confirm management review is conducted at planned intervals (9.3)', priority: 'High', evidence: 'Management review minutes, action log' },
      ],
    },
    {
      title: 'Improvement (Clause 10)', emoji: '🔄',
      items: [
        { id: 'i1', text: 'Review nonconformity and corrective action process (10.2)', priority: 'High', evidence: 'CAR log, root cause analysis records, effectiveness checks' },
        { id: 'i2', text: 'Check evidence of continual improvement initiatives (10.3)', priority: 'Medium', evidence: 'Improvement projects, management review outputs' },
      ],
    },
    {
      title: 'Physical Inspection', emoji: '🔍',
      items: [
        { id: 'ph1', text: 'Inspect production/service area for housekeeping and 5S compliance', priority: 'Medium', evidence: 'On-site observation, photos' },
        { id: 'ph2', text: 'Check equipment calibration labels/stickers are current', priority: 'High', evidence: 'Calibration certificates and labels' },
        { id: 'ph3', text: 'Verify storage areas — product segregation, labelling, FIFO', priority: 'Medium', evidence: 'On-site observation' },
        { id: 'ph4', text: 'Inspect nonconforming product quarantine area for control', priority: 'High', evidence: 'NCR tags, quarantine labels' },
      ],
    },
    {
      title: 'Interview Questions', emoji: '🎤',
      items: [
        { id: 'iq1', text: 'Ask operator: "How do you know your process is running correctly?" (verify awareness)', priority: 'High', evidence: 'Operator response, work instruction visibility' },
        { id: 'iq2', text: 'Ask supervisor: "What happens when a nonconformance is found?"', priority: 'High', evidence: 'NCR process knowledge, CAR awareness' },
        { id: 'iq3', text: 'Ask management: "How are quality objectives tracked and reviewed?"', priority: 'High', evidence: 'KPI review meeting evidence' },
        { id: 'iq4', text: 'Ask staff: "Are you aware of the Quality Policy?"', priority: 'Medium', evidence: 'Recite policy intent, awareness training records' },
        { id: 'iq5', text: 'Ask: "How are customer complaints handled from receipt to closure?"', priority: 'High', evidence: 'Complaint process walkthrough, log review' },
      ],
    },
    {
      title: 'Post-Audit Follow-up', emoji: '✅',
      items: [
        { id: 'paf1', text: 'Issue formal audit report within agreed timeframe', priority: 'High', evidence: 'Issued audit report with date stamp' },
        { id: 'paf2', text: 'Confirm all major NCs have verified corrective actions submitted', priority: 'High', evidence: 'Corrective action responses with objective evidence' },
        { id: 'paf3', text: 'Close minor NCs once evidence of effective correction is received', priority: 'Medium', evidence: 'CA evidence reviewed and accepted' },
        { id: 'paf4', text: 'Update NC status in certification management system', priority: 'Medium', evidence: 'System record updated' },
        { id: 'paf5', text: 'Schedule follow-up / next surveillance audit date', priority: 'Low', evidence: 'Next audit confirmed in schedule' },
      ],
    },
  ],
  'ISO 14001:2015': [
    {
      title: 'Pre-Audit Activities', emoji: '📋',
      items: [
        { id: 'p1', text: 'Review previous environmental audit report and open actions', priority: 'High', evidence: 'Prior audit report, CAR register' },
        { id: 'p2', text: 'Confirm EMS scope and significant environmental aspects', priority: 'High', evidence: 'EMS scope document, aspects register' },
        { id: 'p3', text: 'Review applicable legal and regulatory compliance register', priority: 'High', evidence: 'Legal register, compliance calendar' },
      ],
    },
    {
      title: 'Environmental Context & Aspects (Clauses 4–6)', emoji: '🌍',
      items: [
        { id: 'c1', text: 'Verify identification of environmental aspects and impacts (6.1.2)', priority: 'High', evidence: 'Aspects & impacts register with significance ratings' },
        { id: 'c2', text: 'Check compliance obligations are identified and met (6.1.3)', priority: 'High', evidence: 'Legal register, licence conditions, monitoring records' },
        { id: 'c3', text: 'Confirm environmental objectives and targets are set and tracked (6.2)', priority: 'High', evidence: 'Objectives register, KPI trends' },
      ],
    },
    {
      title: 'Operational Control & Emergency Preparedness (Clause 8)', emoji: '⚙️',
      items: [
        { id: 'o1', text: 'Check operational controls for significant aspects are implemented', priority: 'High', evidence: 'Procedures, work instructions, inspection records' },
        { id: 'o2', text: 'Verify waste management — segregation, labelling, disposal records', priority: 'High', evidence: 'Waste transfer notes, manifest records' },
        { id: 'o3', text: 'Check spill response / emergency preparedness plan and drill records', priority: 'High', evidence: 'Emergency plan, drill records, spill kit inspection' },
        { id: 'o4', text: 'Review energy and water consumption monitoring', priority: 'Medium', evidence: 'Utility meter readings, consumption log' },
      ],
    },
    {
      title: 'Monitoring & Compliance Evaluation (Clause 9)', emoji: '📈',
      items: [
        { id: 'pe1', text: 'Review environmental performance monitoring data vs targets', priority: 'High', evidence: 'Monitoring records, trend charts' },
        { id: 'pe2', text: 'Check compliance evaluation has been conducted and documented', priority: 'High', evidence: 'Compliance evaluation report, date stamp' },
        { id: 'pe3', text: 'Verify internal EMS audit programme completion', priority: 'High', evidence: 'Internal audit schedule and completed reports' },
      ],
    },
    {
      title: 'Physical Inspection', emoji: '🔍',
      items: [
        { id: 'ph1', text: 'Inspect waste storage areas — correct segregation and labelling', priority: 'High', evidence: 'On-site observation' },
        { id: 'ph2', text: 'Check hazardous substance storage — bunding, labelling, SDS on site', priority: 'High', evidence: 'SDS file, bund inspection, labelling' },
        { id: 'ph3', text: 'Inspect drainage/effluent points for signs of contamination', priority: 'High', evidence: 'Visual inspection, discharge monitoring' },
      ],
    },
    {
      title: 'Interview Questions', emoji: '🎤',
      items: [
        { id: 'iq1', text: 'Ask: "What are your most significant environmental aspects?"', priority: 'High', evidence: 'Staff knowledge of aspects register' },
        { id: 'iq2', text: 'Ask: "What do you do in the event of a chemical spill?"', priority: 'High', evidence: 'Emergency response knowledge' },
        { id: 'iq3', text: 'Ask: "How is waste classified and disposed of here?"', priority: 'High', evidence: 'Waste procedure knowledge' },
      ],
    },
    {
      title: 'Post-Audit Follow-up', emoji: '✅',
      items: [
        { id: 'paf1', text: 'Issue audit report and raise CARs for any NCs', priority: 'High', evidence: 'Issued report and CAR forms' },
        { id: 'paf2', text: 'Verify corrective actions address root cause, not just symptoms', priority: 'High', evidence: 'Root cause analysis in CAR submission' },
        { id: 'paf3', text: 'Schedule next environmental compliance review', priority: 'Medium', evidence: 'Next audit / review in schedule' },
      ],
    },
  ],
  'ISO 45001:2018': [
    {
      title: 'Pre-Audit Activities', emoji: '📋',
      items: [
        { id: 'p1', text: 'Review previous OH&S audit findings and open incident actions', priority: 'High', evidence: 'Prior audit report, incident register' },
        { id: 'p2', text: 'Confirm OH&S scope and worker consultation mechanisms', priority: 'High', evidence: 'OH&S scope, consultation records' },
        { id: 'p3', text: 'Review applicable legal OH&S obligations register', priority: 'High', evidence: 'Legal register, licences, permits' },
      ],
    },
    {
      title: 'Hazard Identification & Risk Assessment (Clauses 6–8)', emoji: '⚠️',
      items: [
        { id: 'h1', text: 'Verify hazard identification process covers routine and non-routine activities (6.1.2)', priority: 'High', evidence: 'Hazard register, JSA/SWMS, risk matrix' },
        { id: 'h2', text: 'Check hierarchy of controls applied to significant hazards', priority: 'High', evidence: 'Risk treatment records, engineering controls evidence' },
        { id: 'h3', text: 'Review PPE requirements and compliance — correct type, inspection records', priority: 'High', evidence: 'PPE register, inspection log' },
        { id: 'h4', text: 'Verify contractor/visitor induction and OH&S requirements communicated', priority: 'High', evidence: 'Induction records, contractor management procedure' },
        { id: 'h5', text: 'Check emergency procedures (first aid, fire, evacuation) are documented and tested', priority: 'High', evidence: 'Emergency plan, drill records, first aid register' },
      ],
    },
    {
      title: 'Incident Reporting & Investigation (Clause 10.2)', emoji: '🚨',
      items: [
        { id: 'i1', text: 'Review incident reporting process — timely, documented, investigated', priority: 'High', evidence: 'Incident register, investigation reports' },
        { id: 'i2', text: 'Verify corrective actions from incidents are tracked to closure', priority: 'High', evidence: 'CAR log, effectiveness review records' },
        { id: 'i3', text: 'Check RIDDOR/statutory reporting obligations are being met (if applicable)', priority: 'High', evidence: 'RIDDOR reports, regulator notification records' },
      ],
    },
    {
      title: 'Worker Participation (Clause 5.4)', emoji: '👥',
      items: [
        { id: 'w1', text: 'Verify workers are consulted on OH&S changes and hazard identification', priority: 'High', evidence: 'Health & safety committee minutes, consultation records' },
        { id: 'w2', text: 'Check OH&S training records — induction, task-specific, refresher', priority: 'High', evidence: 'Training matrix, certificates, induction records' },
      ],
    },
    {
      title: 'Physical Inspection', emoji: '🔍',
      items: [
        { id: 'ph1', text: 'Inspect workplace for visible hazards — trip/slip, stored energy, COSHH', priority: 'High', evidence: 'On-site observation, walkthrough notes' },
        { id: 'ph2', text: 'Check fire extinguisher inspection tags, exit signage, and clear egress routes', priority: 'High', evidence: 'Inspection tags, site observation' },
        { id: 'ph3', text: 'Verify COSHH/SDS are accessible and relevant to substances in use', priority: 'High', evidence: 'SDS file, chemical inventory' },
        { id: 'ph4', text: 'Check manual handling controls and mechanical aids are available/used', priority: 'Medium', evidence: 'Equipment inspection, worker observation' },
      ],
    },
    {
      title: 'Interview Questions', emoji: '🎤',
      items: [
        { id: 'iq1', text: 'Ask worker: "How do you report a near miss or hazard?"', priority: 'High', evidence: 'Process knowledge, reporting forms visible' },
        { id: 'iq2', text: 'Ask: "Who is your first aider and where is the first aid kit?"', priority: 'High', evidence: 'Correct answer, kit location' },
        { id: 'iq3', text: 'Ask: "What PPE is required for your task, and how is it maintained?"', priority: 'High', evidence: 'PPE procedure knowledge' },
        { id: 'iq4', text: 'Ask supervisor: "How are contractor OH&S requirements managed on site?"', priority: 'High', evidence: 'Contractor management procedure knowledge' },
      ],
    },
    {
      title: 'Post-Audit Follow-up', emoji: '✅',
      items: [
        { id: 'paf1', text: 'Issue audit report with all findings graded and evidence referenced', priority: 'High', evidence: 'Issued and distributed report' },
        { id: 'paf2', text: 'Verify corrective actions for critical safety NCs are prioritised', priority: 'High', evidence: 'Urgency flag in CAR log, management sign-off' },
        { id: 'paf3', text: 'Confirm regulator notification was made if required for incidents found', priority: 'High', evidence: 'Notification record' },
      ],
    },
  ],
  'ISO 27001:2022': [
    {
      title: 'Pre-Audit Activities', emoji: '📋',
      items: [
        { id: 'p1', text: 'Review prior ISMS audit findings and outstanding risks', priority: 'High', evidence: 'Prior report, risk register' },
        { id: 'p2', text: 'Confirm ISMS scope including information assets and services', priority: 'High', evidence: 'ISMS scope document, asset register' },
        { id: 'p3', text: 'Review Statement of Applicability (SoA) for applicable controls', priority: 'High', evidence: 'Current SoA document' },
      ],
    },
    {
      title: 'Risk Management (Clauses 6–8)', emoji: '🔐',
      items: [
        { id: 'r1', text: 'Verify information security risk assessment process is documented (6.1.2)', priority: 'High', evidence: 'Risk assessment methodology, risk register' },
        { id: 'r2', text: 'Check risk treatment plan is aligned with SoA controls (6.1.3)', priority: 'High', evidence: 'Risk treatment plan, SoA reference' },
        { id: 'r3', text: 'Review asset inventory — all critical assets identified, classified, owned', priority: 'High', evidence: 'Asset register with classification and owners' },
        { id: 'r4', text: 'Check access control — principle of least privilege, periodic review', priority: 'High', evidence: 'Access matrix, recertification records' },
      ],
    },
    {
      title: 'Annex A Controls Sample', emoji: '🛡️',
      items: [
        { id: 'a1', text: 'Verify cryptographic policy and encryption in use (A.8.24)', priority: 'High', evidence: 'Cryptographic policy, encryption config records' },
        { id: 'a2', text: 'Check patch management — critical patches applied within SLA (A.8.8)', priority: 'High', evidence: 'Patch records, vulnerability scan report' },
        { id: 'a3', text: 'Review backup procedures — tested restoration, off-site copies (A.8.13)', priority: 'High', evidence: 'Backup policy, restoration test records' },
        { id: 'a4', text: 'Verify incident response procedure is documented and tested (A.5.26)', priority: 'High', evidence: 'Incident response plan, tabletop exercise records' },
        { id: 'a5', text: 'Check supplier/third-party agreements include IS requirements (A.5.20)', priority: 'Medium', evidence: 'Supplier contracts, DPAs, security clauses' },
        { id: 'a6', text: 'Review physical security of server rooms/data centres (A.7.1)', priority: 'High', evidence: 'Access logs, CCTV, badge records' },
      ],
    },
    {
      title: 'Interview Questions', emoji: '🎤',
      items: [
        { id: 'iq1', text: 'Ask IT staff: "How do you report a suspected information security incident?"', priority: 'High', evidence: 'Incident reporting knowledge' },
        { id: 'iq2', text: 'Ask: "What is the data classification policy and how does it apply to your work?"', priority: 'High', evidence: 'Classification awareness, labels on documents' },
        { id: 'iq3', text: 'Ask management: "How are third-party IS risks assessed before onboarding suppliers?"', priority: 'High', evidence: 'Supplier due diligence process' },
      ],
    },
    {
      title: 'Post-Audit Follow-up', emoji: '✅',
      items: [
        { id: 'paf1', text: 'Issue audit report with risk-rated findings', priority: 'High', evidence: 'Distributed report' },
        { id: 'paf2', text: 'Ensure critical/high risks have documented treatment plans with owners', priority: 'High', evidence: 'Risk treatment plan updates' },
        { id: 'paf3', text: 'Schedule penetration test or technical review if recommended', priority: 'Medium', evidence: 'Pentest engagement confirmed' },
      ],
    },
  ],
  'ISO 22000:2018': [
    {
      title: 'Pre-Audit Activities', emoji: '📋',
      items: [
        { id: 'p1', text: 'Review previous food safety audit and open CARs', priority: 'High', evidence: 'Prior report, CAR register' },
        { id: 'p2', text: 'Confirm FSMS scope — products, processes, sites', priority: 'High', evidence: 'FSMS scope document' },
        { id: 'p3', text: 'Review Hazard Analysis and HACCP Plan currency', priority: 'High', evidence: 'HACCP plan, last review date' },
      ],
    },
    {
      title: 'HACCP & Hazard Analysis (Clause 8)', emoji: '🍽️',
      items: [
        { id: 'h1', text: 'Verify hazard analysis is up to date and covers all food safety hazards', priority: 'High', evidence: 'Hazard analysis worksheet, review date' },
        { id: 'h2', text: 'Check CCPs are identified with critical limits, monitoring, and verification (8.5.4)', priority: 'High', evidence: 'HACCP plan, CCP monitoring records' },
        { id: 'h3', text: 'Review CCP records for completeness, deviations, and corrective actions', priority: 'High', evidence: 'CCP monitoring logs, deviation records' },
        { id: 'h4', text: 'Verify PRPs (Prerequisite Programmes) are implemented and effective', priority: 'High', evidence: 'PRP checklists, inspection records' },
      ],
    },
    {
      title: 'Physical Inspection', emoji: '🔍',
      items: [
        { id: 'ph1', text: 'Inspect food contact surfaces — hygiene, condition, material suitability', priority: 'High', evidence: 'Cleaning schedules, surface inspection' },
        { id: 'ph2', text: 'Check allergen segregation and labelling throughout production', priority: 'High', evidence: 'Allergen matrix, segregation evidence' },
        { id: 'ph3', text: 'Verify pest control — no evidence of activity, bait stations checked', priority: 'High', evidence: 'Pest control reports, bait station log' },
        { id: 'ph4', text: 'Check temperature controls and monitoring records for storage/process', priority: 'High', evidence: 'Temperature logs, probe calibration certs' },
      ],
    },
    {
      title: 'Post-Audit Follow-up', emoji: '✅',
      items: [
        { id: 'paf1', text: 'Issue audit report with food safety risk-rated findings', priority: 'High', evidence: 'Issued report' },
        { id: 'paf2', text: 'Verify any critical food safety NCs are addressed immediately', priority: 'High', evidence: 'Immediate corrective action evidence' },
      ],
    },
  ],
  'ISO 13485:2016': [
    {
      title: 'Pre-Audit Activities', emoji: '📋',
      items: [
        { id: 'p1', text: 'Review regulatory file and previous audit findings', priority: 'High', evidence: 'Prior audit report, regulatory submissions' },
        { id: 'p2', text: 'Confirm QMS scope — device types, regulatory markets (MDR/FDA)', priority: 'High', evidence: 'QMS scope, device register' },
        { id: 'p3', text: 'Review Design History File for key devices', priority: 'High', evidence: 'DHF index, completeness check' },
      ],
    },
    {
      title: 'Design & Development (Clause 7.3)', emoji: '📐',
      items: [
        { id: 'd1', text: 'Verify design inputs are complete and traceable to outputs (7.3.3)', priority: 'High', evidence: 'Design input/output traceability matrix' },
        { id: 'd2', text: 'Check design verification and validation records (7.3.7)', priority: 'High', evidence: 'V&V protocols and reports' },
        { id: 'd3', text: 'Review design change control — regulatory impact assessed', priority: 'High', evidence: 'DCR log, regulatory impact assessment records' },
      ],
    },
    {
      title: 'Risk Management (per ISO 14971)', emoji: '⚠️',
      items: [
        { id: 'rm1', text: 'Verify risk management file exists per ISO 14971', priority: 'High', evidence: 'Risk management file, hazard analysis' },
        { id: 'rm2', text: 'Check post-market surveillance data is feeding back into risk management', priority: 'High', evidence: 'PMS plan, complaint/MDR data linkage to risk file' },
      ],
    },
    {
      title: 'Post-Audit Follow-up', emoji: '✅',
      items: [
        { id: 'paf1', text: 'Issue audit report referencing specific clause requirements', priority: 'High', evidence: 'Distributed report with clause references' },
        { id: 'paf2', text: 'Escalate any patient safety-related NCs to senior management immediately', priority: 'High', evidence: 'Escalation record, management notification' },
      ],
    },
  ],
};

const GENERIC_SECTIONS: Section[] = [
  {
    title: 'Pre-Audit Activities', emoji: '📋',
    items: [
      { id: 'g_p1', text: 'Review previous audit findings and verify open actions', priority: 'High', evidence: 'Prior audit report, corrective action register' },
      { id: 'g_p2', text: 'Confirm audit scope, criteria, and objectives with client', priority: 'High', evidence: 'Signed audit plan' },
      { id: 'g_p3', text: 'Request and review management system documentation', priority: 'High', evidence: 'Policy, procedures, manual' },
    ],
  },
  {
    title: 'Leadership & Planning', emoji: '👔',
    items: [
      { id: 'g_l1', text: 'Verify top management commitment and policy deployment', priority: 'High', evidence: 'Policy, management review minutes' },
      { id: 'g_l2', text: 'Check objectives are set, measurable, and tracked', priority: 'High', evidence: 'KPI register, objective tracking' },
      { id: 'g_l3', text: 'Review risk and opportunity management process', priority: 'High', evidence: 'Risk register' },
    ],
  },
  {
    title: 'Physical Inspection', emoji: '🔍',
    items: [
      { id: 'g_ph1', text: 'Inspect work areas for visible non-conformances', priority: 'Medium', evidence: 'On-site observations' },
      { id: 'g_ph2', text: 'Check equipment condition and calibration status', priority: 'High', evidence: 'Calibration certs, equipment logs' },
    ],
  },
  {
    title: 'Post-Audit Follow-up', emoji: '✅',
    items: [
      { id: 'g_paf1', text: 'Issue formal audit report within agreed timeframe', priority: 'High', evidence: 'Issued report' },
      { id: 'g_paf2', text: 'Verify corrective actions submitted and effective', priority: 'High', evidence: 'CAR responses with evidence' },
    ],
  },
];

function buildHeuristicChecklist(standard: string, industry: string, auditType: string): Section[] {
  const base = BASE_SECTIONS[standard as Std] || GENERIC_SECTIONS;
  // For surveillance audits, flag new Risk Assessment section
  if (auditType === 'Surveillance') {
    const survSection: Section = {
      title: 'Surveillance-Specific Checks', emoji: '🎯',
      items: [
        { id: 'sv1', text: 'Verify all previous audit NCs are effectively closed with evidence', priority: 'High', evidence: 'Prior NCs, CA evidence, effectiveness review' },
        { id: 'sv2', text: 'Confirm no scope creep or undisclosed changes to certified activities', priority: 'High', evidence: 'Scope document, change records' },
        { id: 'sv3', text: 'Sample-check 2–3 processes not audited at last visit', priority: 'High', evidence: 'Audit programme, process records' },
        { id: 'sv4', text: 'Review any regulatory changes since last audit', priority: 'Medium', evidence: 'Legal register update, compliance review' },
      ],
    };
    return [survSection, ...base];
  }
  if (auditType === 'Recertification') {
    const recertSection: Section = {
      title: 'Recertification-Specific Checks', emoji: '🏆',
      items: [
        { id: 'rc1', text: 'Full re-audit of all clauses — not just changes since last cycle', priority: 'High', evidence: 'Complete audit programme' },
        { id: 'rc2', text: 'Review 3-year trends in KPIs, audit history, incidents, CARs', priority: 'High', evidence: 'Trend data, historic records' },
        { id: 'rc3', text: 'Confirm system has been maintained and improved, not just maintained', priority: 'High', evidence: 'Improvement evidence, management review trend' },
      ],
    };
    return [recertSection, ...base];
  }
  // Industry-specific additions
  if (industry.toLowerCase().includes('construction') || industry.toLowerCase().includes('manufactur')) {
    const mfgSection: Section = {
      title: `${industry} — Sector-Specific Items`, emoji: '🏭',
      items: [
        { id: 'mfg1', text: 'Check sub-contractor management and OH&S inductions', priority: 'High', evidence: 'Contractor register, induction records' },
        { id: 'mfg2', text: 'Verify inspection and test plan (ITP) completion per project', priority: 'High', evidence: 'ITP sign-offs, inspection records' },
        { id: 'mfg3', text: 'Review material traceability from receipt through to final product', priority: 'High', evidence: 'Batch/lot records, delivery notes' },
      ],
    };
    return [...base, mfgSection];
  }
  if (industry.toLowerCase().includes('food') || industry.toLowerCase().includes('beverage')) {
    const foodSection: Section = {
      title: 'Food Industry — Additional Checks', emoji: '🍽️',
      items: [
        { id: 'food1', text: 'Verify allergen management programme and cross-contact controls', priority: 'High', evidence: 'Allergen matrix, cleaning validation records' },
        { id: 'food2', text: 'Check traceability one-up/one-down capability (tested within 4 hours)', priority: 'High', evidence: 'Traceability exercise results' },
      ],
    };
    return [...base, foodSection];
  }
  return base;
}

/* ──────────────────────── Claude streaming ─────────────────────── */
const SYSTEM = `You are an audit checklist expert. Generate a comprehensive audit checklist for the specified certification type and client industry.

For the checklist, include:
1. Pre-audit activities
2. Main audit areas (organize by major sections)
3. Specific questions/verification points
4. Documentation to review
5. Physical inspection items
6. Interview questions (for management/staff)
7. Risk assessment areas
8. Post-audit follow-up items

Format each section exactly as JSON so it can be parsed:
Return a JSON array of section objects. Each section has: title, emoji, items[]. Each item has: id (unique string), text, priority ("High"|"Medium"|"Low"), evidence.

Example:
[{"title":"Pre-Audit Activities","emoji":"📋","items":[{"id":"p1","text":"Review previous audit report","priority":"High","evidence":"Prior audit report"}]}]

Return ONLY the JSON array, no markdown fences, no other text.`;

async function streamChecklist(prompt: string, onChunk: (c: string) => void, signal: AbortSignal): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('not_configured');
  const res = await anthropicFetch({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: getModel(), max_tokens: 3200, temperature: 0.3,
      stream: true, system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Claude ${res.status}`);
  const reader = res.body.getReader(); const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value).split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim(); if (raw === '[DONE]') return;
      try { const d = JSON.parse(raw)?.delta?.text || ''; if (d) onChunk(d); } catch { /* */ }
    }
  }
}

function parseSections(raw: string): Section[] | null {
  try {
    const m = raw.match(/\[[\s\S]*\]/); if (!m) return null;
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return null;
    return arr as Section[];
  } catch { return null; }
}

/* ──────────────────────── Styles ───────────────────────────────── */
const GOLD = '#c9922a', BLUE = '#1d4ed8';
const PCOLOR: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };
const PBG: Record<string, string>    = { High: 'rgba(239,68,68,0.1)', Medium: 'rgba(245,158,11,0.1)', Low: 'rgba(34,197,94,0.1)' };
const cardS: React.CSSProperties = { background: '#ffffff', border: '1px solid rgba(15,23,42,0.09)', borderRadius: 16, padding: 22, marginBottom: 18 };
const inp:   React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1.5px solid rgba(15,23,42,0.12)', borderRadius: 9, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', color: '#0f2547', background: '#f8fafc', outline: 'none' };
const lbl:   React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' };
const btnS = (c = BLUE): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 9, border: 'none', background: c, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' });
const aiBadge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: 'rgba(201,146,42,0.15)', border: '1px solid rgba(201,146,42,0.4)', color: GOLD, fontSize: 11, fontWeight: 700 };
const STANDARDS = ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 45001:2018', 'ISO 27001:2022', 'ISO 22000:2018', 'ISO 13485:2016', 'ISO 50001:2018', 'IATF 16949', 'AS9100D', 'SOC 2'];
const AUDIT_TYPES = ['Initial', 'Surveillance', 'Recertification', 'Internal', 'Special'];
const INDUSTRIES = ['Manufacturing', 'Construction', 'Food & Beverage', 'IT & Software', 'Healthcare', 'Logistics', 'Engineering', 'Financial Services', 'Retail', 'Education', 'Energy', 'Automotive', 'Aerospace', 'Pharmaceutical', 'Other'];

/* ──────────────────────── Component ────────────────────────────── */
const SmartChecklist: React.FC = () => {
  const claude = isClaudeConfigured();

  const [standard,    setStandard]    = useState('ISO 9001:2015');
  const [industry,    setIndustry]    = useState('Manufacturing');
  const [auditType,   setAuditType]   = useState('Surveillance');
  const [scope,       setScope]       = useState('');
  const [customNote,  setCustomNote]  = useState('');

  const [sections,    setSections]    = useState<Section[]>([]);
  const [checked,     setChecked]     = useState<Record<string, boolean>>({});
  const [collapsed,   setCollapsed]   = useState<Record<string, boolean>>({});
  const [busy,        setBusy]        = useState(false);
  const [source,      setSource]      = useState<'heuristic' | 'claude' | null>(null);
  const [rawBuf,      setRawBuf]      = useState('');
  const [copied,      setCopied]      = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  /* Progress */
  const total   = useMemo(() => sections.reduce((a, s) => a + s.items.length, 0), [sections]);
  const done    = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;

  /* Generate */
  const generate = async () => {
    if (busy) { abortRef.current?.abort(); setBusy(false); return; }
    setChecked({});
    const heuristic = buildHeuristicChecklist(standard, industry, auditType);
    setSections(heuristic); setSource('heuristic'); setRawBuf('');
    if (!claude) return;

    setBusy(true);
    abortRef.current = new AbortController();
    const prompt = `Generate a comprehensive audit checklist for:
Standard: ${standard}
Industry: ${industry}
Audit Type: ${auditType}
Scope: ${scope || 'Full management system'}
${customNote ? `Special Requirements: ${customNote}` : ''}

Include all 8 content types specified. Make it practical for field use. Return JSON array only.`;

    let buf = '';
    try {
      await streamChecklist(prompt, chunk => { buf += chunk; setRawBuf(buf); }, abortRef.current.signal);
      const parsed = parseSections(buf);
      if (parsed && parsed.length > 0) { setSections(parsed); setSource('claude'); }
    } catch { /* keep heuristic */ }
    finally { setBusy(false); }
  };

  /* Checklist export text */
  const exportText = () => sections.map(s =>
    `${'═'.repeat(60)}\n${s.emoji} ${s.title.toUpperCase()}\n${'═'.repeat(60)}\n` +
    s.items.map((it, idx) => `${idx + 1}. [${checked[it.id] ? '✓' : ' '}] ${it.text}\n   Priority: ${it.priority}  |  Evidence: ${it.evidence}`).join('\n\n')
  ).join('\n\n');

  const copy = () => { navigator.clipboard.writeText(exportText()); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const download = () => {
    const blob = new Blob([exportText()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `Checklist_${standard.replace(/[:\s]/g,'_')}_${industry.replace(/\s/g,'_')}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto', fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#0f2547,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ClipboardCheck size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f2547' }}>Smart Checklist Generator</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            {claude ? 'AI-tailored audit checklists — generated live for any standard and industry' : 'Standard-specific heuristic checklists — add Claude API key for fully AI-tailored output'}
          </p>
        </div>
      </div>

      {!claude && (
        <div style={{ background: 'rgba(201,146,42,0.07)', border: '1px solid rgba(201,146,42,0.25)', borderRadius: 9, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Info size={15} color={GOLD} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#0f2547', lineHeight: 1.5 }}>
            <strong style={{ color: GOLD }}>Heuristic mode</strong> — high-quality built-in checklists for all major standards. Live Claude AI (enabled by your administrator) is needed for fully tailored, industry-specific AI output.
          </p>
        </div>
      )}

      {/* Config form */}
      <div style={cardS}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, color: '#0f2547', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={16} color={GOLD} /> Audit Parameters
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Certification Standard</label>
            <select value={standard} onChange={e => setStandard(e.target.value)} style={inp}>
              {STANDARDS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Client Industry</label>
            <select value={industry} onChange={e => setIndustry(e.target.value)} style={inp}>
              {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Audit Type</label>
            <select value={auditType} onChange={e => setAuditType(e.target.value)} style={inp}>
              {AUDIT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Audit Scope (optional)</label>
            <input value={scope} onChange={e => setScope(e.target.value)} style={inp} placeholder="e.g. Design and manufacture of precision components" />
          </div>
        </div>
        {claude && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Special Requirements / Focus Areas (optional)</label>
            <textarea value={customNote} onChange={e => setCustomNote(e.target.value)} rows={2}
              placeholder="e.g. High-risk processes, customer complaints trend, regulatory changes, new product lines..."
              style={{ ...inp, resize: 'vertical', minHeight: 54 }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={btnS(busy ? '#374151' : BLUE)} onClick={generate}>
            {busy
              ? <><Loader2 size={15} style={{ animation: 'sc-spin 1s linear infinite' }} />{claude ? ' Generating… (click to stop)' : ' Generating…'}</>
              : <><Wand2 size={15} />{claude ? ' Generate with Claude' : ' Generate Checklist'}</>}
          </button>
          {sections.length > 0 && !busy && (
            <button style={{ ...btnS('transparent'), border: '1px solid rgba(15,23,42,0.14)', color: '#64748b' }} onClick={generate}>
              <RefreshCw size={14} /> Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Streaming indicator */}
      {busy && claude && rawBuf && (
        <div style={{ ...cardS, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 size={14} color={GOLD} style={{ animation: 'sc-spin 0.8s linear infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#64748b' }}>Claude is building your checklist… ({rawBuf.length} chars)</span>
        </div>
      )}

      {/* Progress bar */}
      {sections.length > 0 && (
        <div style={cardS}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#0f2547' }}>
              <CheckCircle2 size={15} color="#22c55e" style={{ verticalAlign: 'middle', marginRight: 5 }} />
              {standard} — {auditType} Audit
            </span>
            {source === 'claude'    && <span style={aiBadge}><Sparkles size={10} /> Claude AI</span>}
            {source === 'heuristic' && <span style={{ ...aiBadge, background: 'rgba(100,116,139,0.12)', borderColor: 'rgba(100,116,139,0.3)', color: '#64748b' }}>Built-in Template</span>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button style={{ ...btnS('#eef2f7'), padding: '6px 12px', fontSize: 12, border: '1px solid rgba(15,23,42,0.12)' }} onClick={copy}>
                <Copy size={12} />{copied ? ' Copied!' : ' Copy'}
              </button>
              <button style={{ ...btnS('#064e3b'), padding: '6px 12px', fontSize: 12 }} onClick={download}>
                <Download size={12} /> Download .txt
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 8, background: 'rgba(15,23,42,0.08)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#22c55e' : BLUE, borderRadius: 999, transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? '#22c55e' : '#64748b', minWidth: 70, textAlign: 'right' }}>
              {done}/{total} ({pct}%)
            </span>
          </div>
        </div>
      )}

      {/* Sections */}
      {sections.map(section => {
        const isCollapsed = collapsed[section.title];
        const sectionDone = section.items.filter(it => checked[it.id]).length;
        const highCount   = section.items.filter(i => i.priority === 'High').length;
        return (
          <div key={section.title} style={cardS}>
            <button
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: 0 }}
              onClick={() => setCollapsed(p => ({ ...p, [section.title]: !isCollapsed }))}
            >
              <span style={{ fontSize: 20 }}>{section.emoji}</span>
              <span style={{ flex: 1, textAlign: 'left', fontWeight: 800, fontSize: 15, color: '#0f2547' }}>{section.title}</span>
              {highCount > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 999 }}>
                  <AlertTriangle size={10} /> {highCount} high
                </span>
              )}
              <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>{sectionDone}/{section.items.length}</span>
              {isCollapsed ? <ChevronDown size={16} color="#64748b" /> : <ChevronUp size={16} color="#64748b" />}
            </button>

            {!isCollapsed && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {section.items.map(item => (
                  <div key={item.id}
                    style={{ background: checked[item.id] ? 'rgba(34,197,94,0.05)' : '#eef4fb', border: `1px solid ${checked[item.id] ? 'rgba(34,197,94,0.2)' : 'rgba(15,23,42,0.07)'}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s' }}
                    onClick={() => setChecked(p => ({ ...p, [item.id]: !p[item.id] }))}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ marginTop: 1, flexShrink: 0 }}>
                        {checked[item.id]
                          ? <CheckSquare size={17} color="#22c55e" />
                          : <Square size={17} color="#475569" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 6px', fontSize: 13.5, color: checked[item.id] ? '#64748b' : '#334155', textDecoration: checked[item.id] ? 'line-through' : 'none', lineHeight: 1.5 }}>{item.text}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, color: PCOLOR[item.priority], background: PBG[item.priority] }}>
                            {item.priority}
                          </span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>📎 {item.evidence}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <style>{`@keyframes sc-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
};

export default SmartChecklist;
