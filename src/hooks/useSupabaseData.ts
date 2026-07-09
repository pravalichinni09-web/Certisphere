/**
 * useSupabaseData
 * ──────────────────────────────────────────────────────────────
 * Loads all Supabase table data into localStorage so every
 * existing component can read it immediately after login without
 * any component changes.  Call once when isLoggedIn transitions
 * from false → true.
 */
import { useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';

const TABLE_KEY: Record<string, string> = {
  organizations:   'cms_client_registrations',
  auditors:        'cms_auditors',
  audit_schedules: 'cms_audit_schedules_v3',
  certificates:    'cms_audit_certifications',
  audit_findings:  'cms_audit_findings_v1',
  audit_workflows: 'cms_audit_workflow',
  audit_reports:   'cms_audit_reports_v1',
  client_enquiries:'cms_client_enquiries_v1',
  notifications:   'cms_notifications_v1',
};

// Reverse-map DB rows back to the camelCase shape the app expects
const FROM: Record<string, (r: any) => any> = {
  organizations: (r) => ({
    id: r.id,
    organizationName: r.name,
    clientType: r.industry,
    email: r.email,
    phone: r.phone,
    address: r.address,
    country: r.country,
    website: r.website,
    status: r.status,
    registrationDate: r.created_at?.split('T')[0],
  }),
  auditors: (r) => ({
    id: r.id,
    name: r.full_name,
    email: r.email,
    role: r.role,
    specialization: r.specialization,
    department: r.department,
    country: r.country,
    phone: r.phone,
    status: r.status,
    approvalStatus: r.approval_status,
    certifications: r.certifications ?? [],
  }),
  audit_schedules: (r) => ({
    id: r.id,
    clientId: r.org_id,
    certificationStandard: r.standard,
    auditType: r.audit_type,
    date: r.scheduled_date,
    status: r.status,
    location: r.location,
    notes: r.notes,
  }),
  certificates: (r) => ({
    id: r.id,
    clientId: r.org_id,
    certificateNumber: r.certificate_number,
    standard: r.standard,
    scope: r.scope,
    issuedDate: r.issue_date,
    expirationDate: r.expiry_date,
    status: r.status,
    issuedBy: r.issued_by,
  }),
  audit_findings: (r) => ({
    id: r.id,
    scheduleId: r.schedule_id,
    clientId: r.org_id,
    findingType: r.finding_type,
    clause: r.clause,
    description: r.description,
    evidence: r.evidence,
    severity: r.severity,
    status: r.status,
    raisedBy: r.raised_by,
    assignedTo: r.assigned_to,
    dueDate: r.due_date,
    correctiveAction: r.corrective_action,
  }),
  audit_workflows: (r) => ({
    id: r.id,
    scheduleId: r.schedule_id,
    clientId: r.org_id,
    clientName: r.client_name,
    standard: r.standard,
    currentStage: r.current_stage,
    stageName: r.stage_name,
    status: r.status,
    assignedTo: r.assigned_to,
    notes: r.notes,
    stageData: r.stage_data ?? {},
  }),
  audit_reports: (r) => ({
    id: r.id,
    scheduleId: r.schedule_id,
    clientId: r.org_id,
    reportNumber: r.report_number,
    reportType: r.report_type,
    standard: r.standard,
    auditDate: r.audit_date,
    leadAuditor: r.lead_auditor,
    summary: r.summary,
    conclusion: r.conclusion,
    status: r.status,
    findingsCount: r.findings_count,
    createdBy: r.created_by,
  }),
  client_enquiries: (r) => ({
    id: r.id,
    companyName: r.company_name,
    contactName: r.contact_name,
    email: r.email,
    phone: r.phone,
    standard: r.standard,
    message: r.message,
    status: r.status,
    submittedAt: r.created_at?.split('T')[0],
  }),
  notifications: (r) => ({
    id: r.id,
    userId: r.user_id,
    role: r.role,
    title: r.title,
    message: r.message,
    type: r.type,
    read: r.is_read,
    createdAt: r.created_at,
  }),
};

export function useSupabaseData(isLoggedIn: boolean): void {
  useEffect(() => {
    if (!isLoggedIn || !isSupabaseEnabled()) return;

    (async () => {
      for (const [table, key] of Object.entries(TABLE_KEY)) {
        try {
          const { data, error } = await (supabase as any)
            .from(table)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);
          if (error || !data?.length) continue;

          const transform = FROM[table];
          const mapped = transform ? data.map(transform) : data;

          // Merge with any existing localStorage data (new local entries win)
          const existing: any[] = (() => {
            try { return JSON.parse(localStorage.getItem(key) || '[]'); }
            catch { return []; }
          })();
          const existingIds = new Set(existing.map((x: any) => String(x.id)));
          const merged = [
            ...existing,
            ...mapped.filter((r: any) => !existingIds.has(String(r.id))),
          ];

          // Use raw _set to avoid re-triggering the proxy sync
          const _set = (localStorage as any).__proto__.setItem;
          if (_set) {
            _set.call(localStorage, key, JSON.stringify(merged));
          } else {
            localStorage.setItem(key, JSON.stringify(merged));
          }
        } catch (e) {
          console.warn('[useSupabaseData] table error:', table, e);
        }
      }
      console.info('[CertiSphere] Supabase data loaded into localStorage');
    })();
  }, [isLoggedIn]);
}
