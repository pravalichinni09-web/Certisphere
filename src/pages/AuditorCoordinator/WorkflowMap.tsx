/**
 * Workflow Map
 *
 * Cross-role overview of every CMS area. Each row shows:
 *   - the area / stage,
 *   - the role that owns it,
 *   - what they do,
 *   - a quick-jump link to that role's screen.
 *
 * Lives inside the Audit Coordinator role and is the single page a
 * coordinator can use to see end-to-end how a certification application
 * moves through the five roles (Audit Coordinator, Management, Lead
 * Auditor, Auditor, Auditee).
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ExternalLink,
  Workflow as WorkflowIcon,
  Filter,
  Users,
  Shield,
  ClipboardCheck,
  Briefcase,
  Building2,
  CheckCircle2,
} from 'lucide-react';

type RoleKey = 'Coordinator' | 'Management' | 'Lead Auditor' | 'Auditor' | 'Auditee';

interface RoleAction {
  role: RoleKey;
  does: string;
  link: string;
  linkLabel: string;
}

interface FlowArea {
  id: string;
  area: string;
  summary: string;
  group: 'Setup' | 'Registration' | 'Execution' | 'Closure';
  steps: RoleAction[];
}

const ROLE_META: Record<RoleKey, { color: string; bg: string; icon: React.ReactNode }> = {
  Coordinator:    { color: '#0e7490', bg: '#cffafe', icon: <Users size={14} /> },
  Management:     { color: '#7c3aed', bg: '#ede9fe', icon: <Shield size={14} /> },
  'Lead Auditor': { color: '#b45309', bg: '#fef3c7', icon: <ClipboardCheck size={14} /> },
  Auditor:        { color: '#1d4ed8', bg: '#dbeafe', icon: <Briefcase size={14} /> },
  Auditee:        { color: '#047857', bg: '#d1fae5', icon: <Building2 size={14} /> },
};

const FLOW: FlowArea[] = [
  {
    id: 'auditor-onboarding',
    area: 'Auditor Onboarding',
    summary: 'New auditor applies via the public site, coordinator validates and forwards, management approves.',
    group: 'Setup',
    steps: [
      { role: 'Auditee',      does: 'Submits self-registration form on the public site.',                                 link: '/enquiry',                                       linkLabel: 'Public Enquiry' },
      { role: 'Coordinator',  does: 'Reviews the join request, asks for missing docs, validates CV/certificates.',         link: '/auditor-coordinator/auditor-requests',          linkLabel: 'Auditor Requests' },
      { role: 'Coordinator',  does: 'Forwards complete profiles to management for final approval.',                        link: '/auditor-coordinator/auditor-profiles',          linkLabel: 'Auditor Profiles' },
      { role: 'Lead Auditor', does: 'Performs technical review of competence + sample audit logs.',                        link: '/lead-auditor/auditor-approvals',                linkLabel: 'Auditor Approvals' },
      { role: 'Management',   does: 'Issues credentials and grants role access.',                                          link: '/management/client-credentials',                 linkLabel: 'Client Credentials' },
    ],
  },
  {
    id: 'audit-scope',
    area: 'Audit Scope',
    summary: 'Standards, departments and applicable scopes the org certifies against.',
    group: 'Setup',
    steps: [
      { role: 'Coordinator',  does: 'Maintains master list of standards and applicable scopes.',                           link: '/auditor-coordinator/audit-scope',               linkLabel: 'Audit Scope' },
      { role: 'Lead Auditor', does: 'Cross-checks scopes against active certification programmes.',                        link: '/lead-auditor/dashboard',                        linkLabel: 'Lead Auditor Dashboard' },
    ],
  },
  {
    id: 'audit-types',
    area: 'Audit Types',
    summary: 'Initial, Surveillance 1, Surveillance 2, Recertification - the 4-year certification lifecycle.',
    group: 'Setup',
    steps: [
      { role: 'Coordinator',  does: 'Maintains the 4 lifecycle types and links them to schedules.',                        link: '/auditor-coordinator/audit-types',               linkLabel: 'Audit Types' },
      { role: 'Lead Auditor', does: 'Confirms the correct audit type is selected for each schedule.',                      link: '/lead-auditor/audit-schedules',                  linkLabel: 'LA - Audit Schedules' },
    ],
  },
  {
    id: 'application',
    area: 'Application Dispatch',
    summary: 'Send the certification application form to a prospective client.',
    group: 'Registration',
    steps: [
      { role: 'Coordinator',  does: 'Dispatches the application form (email / WhatsApp / portal link).',                   link: '/auditor-coordinator/application-dispatch',      linkLabel: 'Application' },
      { role: 'Auditee',      does: 'Fills in the form and submits the application.',                                      link: '/audit-client/pending-applications',             linkLabel: 'Pending Applications' },
      { role: 'Coordinator',  does: 'Logs the returned application against the client.',                                   link: '/auditor-coordinator/client-registration',       linkLabel: 'Client Registration' },
    ],
  },
  {
    id: 'client-registration',
    area: 'Client Registration',
    summary: 'Capture the new auditee organisation and route to management for credential creation.',
    group: 'Registration',
    steps: [
      { role: 'Coordinator',  does: 'Registers the client and uploads supporting docs.',                                   link: '/auditor-coordinator/client-registration',       linkLabel: 'Client Registration' },
      { role: 'Management',   does: 'Approves the registration and issues client credentials.',                            link: '/management/client-credentials',                 linkLabel: 'Client Credentials' },
      { role: 'Auditee',      does: 'Logs into the portal and confirms profile details.',                                  link: '/audit-client/dashboard',                        linkLabel: 'Auditee Dashboard' },
    ],
  },
  {
    id: 'audit-checklists',
    area: 'Audit Checklists',
    summary: 'Standard-specific checklists the auditors take into the field.',
    group: 'Execution',
    steps: [
      { role: 'Coordinator',  does: 'Maintains master checklists and assigns them per audit.',                             link: '/auditor-coordinator/audit-checklists',          linkLabel: 'Audit Checklists' },
      { role: 'Lead Auditor', does: 'Reviews / customises checklist before audit kick-off.',                               link: '/lead-auditor/conduct-audit',                    linkLabel: 'LA - Conduct Audit' },
      { role: 'Auditor',      does: 'Executes the checklist on-site and captures evidence.',                               link: '/auditor/conduct-audit',                         linkLabel: 'Conduct Audit' },
    ],
  },
  {
    id: 'audit-schedules',
    area: 'Audit Schedules',
    summary: 'Propose a date, allocate team, get auditee + auditor sign-off.',
    group: 'Execution',
    steps: [
      { role: 'Coordinator',  does: 'Proposes the audit date and assigns Lead Auditor + Auditor.',                         link: '/auditor-coordinator/audit-schedules',           linkLabel: 'Audit Schedules' },
      { role: 'Auditee',      does: 'Approves or counter-proposes the date in their portal.',                              link: '/audit-client/schedule-approvals',               linkLabel: 'Schedule Approvals' },
      { role: 'Auditor',      does: 'Confirms availability for the assigned slot.',                                        link: '/auditor/schedule-confirmations',                linkLabel: 'Schedule Confirmations' },
      { role: 'Lead Auditor', does: 'Confirms the final team and locks the schedule.',                                     link: '/lead-auditor/audit-schedules',                  linkLabel: 'LA - Audit Schedules' },
    ],
  },
  {
    id: 'audit-workflow',
    area: 'Audit Workflow (14 stages)',
    summary: 'Master tracker - every certification progresses through the 14 stages here.',
    group: 'Execution',
    steps: [
      { role: 'Coordinator',  does: 'Owns the workflow board; advances each row through 14 stages.',                       link: '/auditor-coordinator/audit-workflow',            linkLabel: 'Audit Workflow' },
      { role: 'Management',   does: 'Audits stage transitions for compliance.',                                            link: '/management/audit-assignments',                  linkLabel: 'Audit Assignments' },
      { role: 'Lead Auditor', does: 'Picks up each row at "Audit In Progress" and drives to closure.',                     link: '/lead-auditor/dashboard',                        linkLabel: 'Lead Auditor Dashboard' },
    ],
  },
  {
    id: 'conduct-audit',
    area: 'Conduct Audit',
    summary: 'On-site execution - Lead Auditor + Auditor capture findings and evidence.',
    group: 'Execution',
    steps: [
      { role: 'Lead Auditor', does: 'Runs the opening meeting, allocates sections, signs off findings.',                   link: '/lead-auditor/conduct-audit',                    linkLabel: 'LA - Conduct Audit' },
      { role: 'Auditor',      does: 'Executes the checklist, captures evidence, raises observations.',                     link: '/auditor/conduct-audit',                         linkLabel: 'Conduct Audit' },
      { role: 'Auditee',      does: 'Supplies records, walks the auditor through processes.',                              link: '/audit-client/audit-actions',                    linkLabel: 'Audit Actions' },
    ],
  },
  {
    id: 'findings-actions',
    area: 'Findings & Corrective Actions',
    summary: 'Findings are released to the auditee, who submits corrective actions.',
    group: 'Execution',
    steps: [
      { role: 'Auditor',      does: 'Logs non-conformities + observations into the findings register.',                    link: '/auditor/action-review',                         linkLabel: 'Action Review' },
      { role: 'Auditee',      does: 'Submits root cause + corrective actions per finding.',                                link: '/audit-client/submit-report',                    linkLabel: 'Submit Report' },
      { role: 'Lead Auditor', does: 'Reviews the corrective actions and accepts/rejects.',                                 link: '/lead-auditor/action-review',                    linkLabel: 'LA - Action Review' },
      { role: 'Lead Auditor', does: 'Final approval - moves the audit to "Review and Approval".',                          link: '/lead-auditor/action-approval',                  linkLabel: 'Action Approval' },
    ],
  },
  {
    id: 'audit-report',
    area: 'Audit Report',
    summary: 'Final report compiled from findings, actions and evidence.',
    group: 'Closure',
    steps: [
      { role: 'Auditor',      does: 'Drafts the audit report from on-site findings.',                                      link: '/auditor/audit-report',                          linkLabel: 'Audit Report' },
      { role: 'Lead Auditor', does: 'Reviews + signs off the audit report.',                                               link: '/lead-auditor/audit-report',                     linkLabel: 'LA - Audit Report' },
      { role: 'Coordinator',  does: 'Files the report and triggers certification.',                                        link: '/auditor-coordinator/audit-report',              linkLabel: 'Coordinator - Audit Report' },
    ],
  },
  {
    id: 'certifications',
    area: 'Audit Certifications',
    summary: 'Certification recommendation -> issue -> delivery.',
    group: 'Closure',
    steps: [
      { role: 'Lead Auditor', does: 'Recommends certification based on the closed audit.',                                 link: '/lead-auditor/dashboard',                        linkLabel: 'Lead Auditor Dashboard' },
      { role: 'Coordinator',  does: 'Generates the certificate and logs validity.',                                        link: '/auditor-coordinator/audit-certifications',      linkLabel: 'Audit Certifications' },
      { role: 'Management',   does: 'Approves issuance and seals the certificate.',                                        link: '/management/audit-assignments',                  linkLabel: 'Management - Audit Assignments' },
    ],
  },
  {
    id: 'certificate-delivery',
    area: 'Certificate Delivery',
    summary: 'Hand the certificate to the auditee + log dispatch.',
    group: 'Closure',
    steps: [
      { role: 'Coordinator',  does: 'Sends the certificate via email / WhatsApp / courier and logs dispatch.',             link: '/auditor-coordinator/certificate-delivery',      linkLabel: 'Certificate Delivery' },
      { role: 'Auditee',      does: 'Receives the certificate and downloads from the portal.',                             link: '/audit-client/dashboard',                        linkLabel: 'Auditee Dashboard' },
    ],
  },
  {
    id: 'client-portal',
    area: 'Client Coordinator Portal',
    summary: 'Read-only client-side portal — each client organisation sees only their own data.',
    group: 'Closure',
    steps: [
      { role: 'Coordinator',  does: 'Issues credentials so the client can log in to their read-only portal.',     link: '/management/client-onboarding',         linkLabel: 'Client Onboarding' },
      { role: 'Auditee',      does: 'The client organisation\'s Client Coordinator signs in to view their data.', link: '/client-coordinator/dashboard',         linkLabel: 'Client Portal · Dashboard' },
      { role: 'Auditee',      does: 'Browses certifications, due dates, schedules and audit reports — read-only.', link: '/client-coordinator/certifications',    linkLabel: 'Client Portal · Certifications' },
    ],
  },
  {
    id: 'audit-analysis',
    area: 'Audit Analysis',
    summary: 'Cross-audit analytics - close rates, NC density, auditor performance.',
    group: 'Closure',
    steps: [
      { role: 'Coordinator',  does: 'Reviews operational KPIs across the certification pipeline.',                         link: '/auditor-coordinator/audit-analysis',            linkLabel: 'Audit Analysis (Coordinator)' },
      { role: 'Lead Auditor', does: 'Reviews quality KPIs across audits and teams.',                                       link: '/lead-auditor/audit-analysis',                   linkLabel: 'Audit Analysis (Lead Auditor)' },
      { role: 'Management',   does: 'Reviews strategic KPIs across the business.',                                         link: '/management/dashboard',                          linkLabel: 'Management Dashboard' },
    ],
  },
];

const GROUPS: FlowArea['group'][] = ['Setup', 'Registration', 'Execution', 'Closure'];

const WorkflowMap: React.FC = () => {
  const navigate = useNavigate();
  const [roleFilter, setRoleFilter] = useState<'All' | RoleKey>('All');
  const [groupFilter, setGroupFilter] = useState<'All' | FlowArea['group']>('All');

  const visible = useMemo(() => {
    return FLOW.filter((row) => {
      if (groupFilter !== 'All' && row.group !== groupFilter) return false;
      if (roleFilter !== 'All' && !row.steps.some((s) => s.role === roleFilter)) return false;
      return true;
    });
  }, [roleFilter, groupFilter]);

  const roleCounts = useMemo(() => {
    const counts: Record<RoleKey, number> = {
      Coordinator: 0, Management: 0, 'Lead Auditor': 0, Auditor: 0, Auditee: 0,
    };
    FLOW.forEach((f) => {
      const seen = new Set<RoleKey>();
      f.steps.forEach((s) => {
        if (!seen.has(s.role)) {
          counts[s.role] += 1;
          seen.add(s.role);
        }
      });
    });
    return counts;
  }, []);

  return (
    <div className="page" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <div style={{
          background: '#ecfeff', color: '#0e7490', width: 40, height: 40,
          borderRadius: 10, display: 'grid', placeItems: 'center',
        }}>
          <WorkflowIcon size={22} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Workflow Map</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
            End-to-end view of every CMS area and the role that owns it - click any link to jump straight to that screen.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <Filter size={14} color="#64748b" />
        <span style={{ fontSize: 12, color: '#64748b', marginRight: 4 }}>Filter by role:</span>
        {(['All', ...Object.keys(ROLE_META)] as ('All' | RoleKey)[]).map((r) => {
          const isActive = roleFilter === r;
          const meta = r === 'All' ? null : ROLE_META[r as RoleKey];
          return (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              style={{
                border: '1px solid ' + (isActive ? (meta?.color ?? '#0e7490') : '#cbd5e1'),
                background: isActive ? (meta?.bg ?? '#cffafe') : '#fff',
                color: isActive ? (meta?.color ?? '#0e7490') : '#475569',
                padding: '4px 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {meta?.icon}
              {r}
              {r !== 'All' && (
                <span style={{
                  background: meta?.color, color: '#fff',
                  borderRadius: 999, padding: '0 6px', fontSize: 10,
                }}>{roleCounts[r as RoleKey]}</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <span style={{ fontSize: 12, color: '#64748b', marginRight: 4 }}>Filter by phase:</span>
        {(['All', ...GROUPS] as ('All' | FlowArea['group'])[]).map((g) => {
          const isActive = groupFilter === g;
          return (
            <button
              key={g}
              onClick={() => setGroupFilter(g)}
              style={{
                border: '1px solid ' + (isActive ? '#0f172a' : '#cbd5e1'),
                background: isActive ? '#0f172a' : '#fff',
                color: isActive ? '#fff' : '#475569',
                padding: '4px 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {g}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {GROUPS.map((g) => {
          const rows = visible.filter((v) => v.group === g);
          if (rows.length === 0) return null;
          return (
            <section key={g}>
              <h2 style={{
                margin: '0 0 8px 0', fontSize: 13, fontWeight: 700,
                color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5,
              }}>{g}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rows.map((row) => (
                  <article
                    key={row.id}
                    style={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: 16,
                      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                    }}
                  >
                    <header style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle2 size={16} color="#0e7490" />
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                          {row.area}
                        </h3>
                      </div>
                      <p style={{ margin: '4px 0 0 24px', fontSize: 13, color: '#64748b' }}>
                        {row.summary}
                      </p>
                    </header>

                    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {row.steps.map((step, idx) => {
                        const meta = ROLE_META[step.role];
                        return (
                          <li
                            key={idx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '24px 150px 1fr auto',
                              alignItems: 'center',
                              gap: 12,
                              padding: '6px 8px',
                              borderRadius: 8,
                              background: idx % 2 === 0 ? '#f8fafc' : '#fff',
                            }}
                          >
                            <span style={{
                              width: 22, height: 22, borderRadius: 11,
                              background: '#0f172a', color: '#fff',
                              display: 'grid', placeItems: 'center',
                              fontSize: 11, fontWeight: 700,
                            }}>
                              {idx + 1}
                            </span>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              background: meta.bg, color: meta.color,
                              padding: '3px 8px', borderRadius: 999,
                              fontSize: 12, fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}>
                              {meta.icon}
                              {step.role}
                            </span>
                            <span style={{ fontSize: 13, color: '#0f172a' }}>{step.does}</span>
                            <button
                              onClick={() => navigate(step.link)}
                              title={'Open ' + step.linkLabel}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                background: '#fff',
                                border: '1px solid #cbd5e1',
                                color: '#0e7490',
                                padding: '4px 10px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <ExternalLink size={12} />
                              {step.linkLabel}
                            </button>
                          </li>
                        );
                      })}
                    </ol>

                    <footer style={{
                      marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e2e8f0',
                      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                      fontSize: 11, color: '#64748b',
                    }}>
                      Hand-off chain:
                      {row.steps.map((s, i) => (
                        <React.Fragment key={i}>
                          <span style={{
                            background: ROLE_META[s.role].bg,
                            color: ROLE_META[s.role].color,
                            padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                          }}>
                            {s.role}
                          </span>
                          {i < row.steps.length - 1 && <ArrowRight size={12} color="#94a3b8" />}
                        </React.Fragment>
                      ))}
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        {visible.length === 0 && (
          <div style={{
            padding: 32, textAlign: 'center', color: '#64748b',
            border: '1px dashed #cbd5e1', borderRadius: 12, background: '#f8fafc',
          }}>
            No areas match the current filters.
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowMap;
