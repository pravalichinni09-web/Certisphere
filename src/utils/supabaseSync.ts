/**
 * supabaseSync.ts
 * ──────────────────────────────────────────────────────────
 * One-time migration: pushes all localStorage demo data into
 * Supabase the first time a user connects a real database.
 *
 * Safe to call on every boot — idempotent via sync flag key.
 */
import { supabase, isSupabaseEnabled } from '../lib/supabase';

const SYNC_FLAG = 'cms_supabase_synced_v1';

async function upsert(table: string, rows: any[], conflictCol = 'id') {
  if (!rows.length) return;
  const { error } = await (supabase as any)
    .from(table)
    .upsert(rows, { onConflict: conflictCol, ignoreDuplicates: true });
  if (error) console.warn(`[CertiSphere] Sync warning for ${table}:`, error.message);
}

function fromLS<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]') as T[]; } catch { return []; }
}

export async function syncLocalStorageToSupabase(): Promise<void> {
  if (!isSupabaseEnabled()) return;
  if (localStorage.getItem(SYNC_FLAG) === '1') return;

  console.info('[CertiSphere] Syncing demo data to Supabase…');

  try {
    // ── Organizations ────────────────────────────────────────
    const clients = fromLS<any>('cms_client_registrations').map(c => ({
      id:       c.id,
      name:     c.organizationName || c.name || 'Unknown',
      industry: c.clientType || c.industry || null,
      email:    c.email || null,
      phone:    c.phone || null,
      address:  c.address || null,
      country:  c.country || 'India',
      status:   c.status || 'Active',
    }));
    await upsert('organizations', clients);

    // ── Auditors ──────────────────────────────────────────────
    const auditors = fromLS<any>('cms_auditors').map(a => ({
      id:           a.id,
      full_name:    a.name || a.full_name || '',
      email:        a.email || '',
      role:         a.role || 'Auditor',
      specialization: a.specialization || null,
      department:   a.department || null,
      country:      a.country || null,
      phone:        a.phone || null,
      status:       a.status || 'Active',
      approval_status: a.approvalStatus || 'Pending',
      certifications: a.certifications || [],
    }));
    await upsert('auditors', auditors);

    // ── Certificates ──────────────────────────────────────────
    const certs = fromLS<any>('cms_certificates').map(c => ({
      id:               c.id || `cert-${Date.now()}-${Math.random()}`,
      org_id:           Number(c.clientId) || null,
      certificate_number: c.certificateNumber || c.certNumber || null,
      standard:         c.standard || null,
      scope:            c.scope || null,
      issue_date:       c.issuedDate || c.issueDate || null,
      expiry_date:      c.expirationDate || c.expiryDate || null,
      status:           c.status || 'Active',
      issued_by:        c.issuedBy || null,
    }));
    await upsert('certificates', certs, 'id');

    // ── Audit Schedules ───────────────────────────────────────
    const schedules = fromLS<any>('cms_audit_schedules_v3').map(s => ({
      id:             s.id || `sched-${Date.now()}`,
      org_id:         Number(s.clientId) || null,
      standard:       s.certificationStandard || s.standard || null,
      audit_type:     s.auditType || 'Stage 1',
      scheduled_date: s.date || s.scheduledDate || null,
      auditor_id:     null,
      status:         s.status || 'Scheduled',
      location:       s.location || null,
      notes:          s.notes || null,
    }));
    await upsert('audit_schedules', schedules, 'id');

    // ── Client Enquiries ──────────────────────────────────────
    const enquiries = fromLS<any>('cms_client_enquiries_v1').map(e => ({
      id:           e.id || `enq-${Date.now()}`,
      company_name: e.companyName || e.company || '',
      contact_name: e.contactName || e.name || '',
      email:        e.email || '',
      phone:        e.phone || null,
      standard:     e.standard || null,
      message:      e.message || null,
      status:       e.status || 'New',
    }));
    await upsert('client_enquiries', enquiries, 'id');

    // ── Notifications ─────────────────────────────────────────
    const notifs = fromLS<any>('cms_notifications_v1').slice(0, 100).map(n => ({
      id:       n.id || `notif-${Date.now()}`,
      user_id:  null,
      role:     n.role || null,
      title:    n.title || '',
      message:  n.message || n.body || '',
      type:     n.type || 'info',
      is_read:  n.read || false,
    }));
    await upsert('notifications', notifs, 'id');

    localStorage.setItem(SYNC_FLAG, '1');
    console.info('[CertiSphere] Sync complete ✓');
  } catch (err) {
    console.error('[CertiSphere] Sync error:', err);
  }
}

/** Call this after a successful Supabase sign-in. */
export const triggerSync = syncLocalStorageToSupabase;
