/**
 * storageProxy.ts
 * ──────────────────────────────────────────────────────────────
 * Intercepts every localStorage.setItem for CMS data keys and
 * mirrors the write to Supabase automatically — no component
 * changes needed. All existing code keeps using localStorage.
 *
 * Call installStorageProxy() once at app boot (in main.tsx).
 */
import { supabase, isSupabaseEnabled } from '../lib/supabase';

// ── Key → Supabase table ──────────────────────────────────────
const KEY_TABLE: Record<string, string> = {
  cms_client_registrations: 'organizations',
  cms_auditors:             'auditors',
  cms_auditors_data:        'auditors',
  cms_audit_schedules_v3:   'audit_schedules',
  cms_certificates:         'certificates',
  cms_audit_certifications: 'certificates',
  cms_audit_findings_v1:    'audit_findings',
  cms_audit_workflow:       'audit_workflows',
  cms_audit_reports:        'audit_reports',
  cms_audit_reports_v1:     'audit_reports',
  cms_client_enquiries_v1:  'client_enquiries',
  cms_notifications_v1:     'notifications',
};

// ── Field transformers ────────────────────────────────────────
const T: Record<string, (r: any) => any> = {
  organizations: (c) => ({
    id: c.id ?? undefined,
    name: c.organizationName || c.name || 'Unknown',
    industry: c.clientType || c.industry || null,
    email: c.email || null,
    phone: c.phone || null,
    address: c.address || null,
    country: c.country || 'India',
    website: c.website || null,
    status: c.status || 'Active',
  }),
  auditors: (a) => ({
    id: a.id ?? undefined,
    full_name: a.name || a.full_name || '',
    email: a.email || '',
    role: a.role || 'Auditor',
    specialization: a.specialization || null,
    department: a.department || null,
    country: a.country || null,
    phone: a.phone || null,
    status: a.status || 'Active',
    approval_status: a.approvalStatus || a.approval_status || 'Pending Approval',
    certifications: a.certifications || [],
  }),
  audit_schedules: (s) => ({
    id: s.id || undefined,
    org_id: Number(s.clientId) || null,
    standard: s.certificationStandard || s.standard || null,
    audit_type: s.auditType || s.audit_type || 'Stage 1',
    scheduled_date: s.date || s.scheduledDate || s.scheduled_date || null,
    status: s.status || 'Scheduled',
    location: s.location || null,
    notes: s.notes || null,
  }),
  certificates: (c) => ({
    id: c.id || undefined,
    org_id: Number(c.clientId) || null,
    certificate_number: c.certificateNumber || c.certNumber || c.certificate_number || null,
    standard: c.standard || null,
    scope: c.scope || null,
    issue_date: c.issuedDate || c.issueDate || c.issue_date || null,
    expiry_date: c.expirationDate || c.expiryDate || c.expiry_date || null,
    status: c.status || 'Active',
    issued_by: c.issuedBy || c.issued_by || null,
  }),
  audit_findings: (f) => ({
    id: f.id || undefined,
    schedule_id: f.scheduleId || f.schedule_id || null,
    org_id: Number(f.clientId || f.org_id) || null,
    finding_type: f.findingType || f.finding_type || 'Non-Conformity',
    clause: f.clause || null,
    description: f.description || '',
    evidence: f.evidence || null,
    severity: f.severity || 'Minor',
    status: f.status || 'Open',
    raised_by: f.raisedBy || f.raised_by || null,
    assigned_to: f.assignedTo || f.assigned_to || null,
    due_date: f.dueDate || f.due_date || null,
    corrective_action: f.correctiveAction || f.corrective_action || null,
  }),
  audit_workflows: (w) => ({
    id: w.id || undefined,
    schedule_id: w.scheduleId || w.schedule_id || null,
    org_id: Number(w.clientId || w.org_id) || null,
    client_name: w.clientName || w.client_name || w.organization || null,
    standard: w.standard || null,
    current_stage: Number(w.currentStage || w.current_stage || w.stage || 1),
    stage_name: w.stageName || w.stage_name || 'Application',
    status: w.status || 'In Progress',
    assigned_to: w.assignedTo || w.assigned_to || null,
    notes: w.notes || null,
    stage_data: w.stageData || w.stage_data || {},
  }),
  audit_reports: (r) => ({
    id: r.id || undefined,
    schedule_id: r.scheduleId || r.schedule_id || null,
    org_id: Number(r.clientId || r.org_id) || null,
    report_number: r.reportNumber || r.report_number || null,
    report_type: r.reportType || r.report_type || 'Stage 1',
    standard: r.standard || null,
    audit_date: r.auditDate || r.audit_date || null,
    lead_auditor: r.leadAuditor || r.lead_auditor || null,
    summary: r.summary || null,
    conclusion: r.conclusion || 'Satisfactory',
    status: r.status || 'Draft',
    findings_count: Number(r.findingsCount || r.findings_count || 0),
    created_by: r.createdBy || r.created_by || null,
  }),
  client_enquiries: (e) => ({
    id: e.id || undefined,
    company_name: e.companyName || e.company_name || e.company || '',
    contact_name: e.contactName || e.contact_name || e.name || '',
    email: e.email || '',
    phone: e.phone || null,
    standard: e.standard || null,
    message: e.message || null,
    status: e.status || 'New',
  }),
  notifications: (n) => ({
    id: n.id || undefined,
    user_id: n.userId || n.user_id || null,
    role: n.role || null,
    title: n.title || '',
    message: n.message || n.body || '',
    type: n.type || 'info',
    is_read: n.read || n.is_read || false,
  }),
};

// ── Debounce map — avoid hammering DB on rapid writes ─────────
const debounce = new Map<string, ReturnType<typeof setTimeout>>();

async function syncToSupabase(table: string, rows: any[]): Promise<void> {
  if (!isSupabaseEnabled() || !rows.length) return;
  const transform = T[table];
  if (!transform) return;
  const mapped = rows.map(transform).filter(Boolean);
  if (!mapped.length) return;
  const { error } = await (supabase as any)
    .from(table)
    .upsert(mapped, { onConflict: 'id', ignoreDuplicates: false });
  if (error) console.warn(`[StorageProxy] ${table}:`, error.message);
}

function scheduleSync(key: string, table: string, value: string): void {
  const t = debounce.get(key);
  if (t) clearTimeout(t);
  debounce.set(key, setTimeout(async () => {
    debounce.delete(key);
    try {
      const rows = JSON.parse(value);
      if (Array.isArray(rows)) await syncToSupabase(table, rows);
    } catch { /* not JSON array — skip */ }
  }, 800));
}

// ── Install once at boot ──────────────────────────────────────
let installed = false;
export function installStorageProxy(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const _set = localStorage.setItem.bind(localStorage);
  let dispatching = false;
  localStorage.setItem = function (key: string, value: string): void {
    _set(key, value);
    const table = KEY_TABLE[key];
    if (table && isSupabaseEnabled()) scheduleSync(key, table, value);
    // Same-tab live sync: the native 'storage' event only fires in OTHER tabs.
    // Re-dispatch it here for CMS keys so every open role view refreshes the
    // moment data changes — keeping the end-to-end workflow in sync in one tab.
    if (!dispatching && typeof key === 'string' && key.indexOf('cms_') === 0) {
      dispatching = true;
      try {
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
        window.dispatchEvent(new CustomEvent('cms-data-changed', { detail: key }));
      } catch { /* ignore */ }
      dispatching = false;
    }
  };
  console.info('[CertiSphere] StorageProxy active — writes mirror to Supabase');
}
