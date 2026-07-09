import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Cert    = Database['public']['Tables']['certificates']['Row'];
type CertIns = Database['public']['Tables']['certificates']['Insert'];

const LS_KEY = 'cms_certificates';

const fromLS = (): Cert[] => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
};
const toLS = (rows: Cert[]) => localStorage.setItem(LS_KEY, JSON.stringify(rows));

export async function getCertificates(orgId?: number): Promise<Cert[]> {
  if (isSupabaseEnabled()) {
    let q = supabase!.from('certificates').select('*').order('created_at', { ascending: false });
    if (orgId) q = q.eq('org_id', orgId);
    const { data, error } = await q;
    if (!error && data) return data;
  }
  const rows = fromLS();
  return orgId ? rows.filter(c => Number(c.org_id) === orgId) : rows;
}

export async function getCertificateById(id: string): Promise<Cert | null> {
  if (isSupabaseEnabled()) {
    const { data } = await (supabase as any).from('certificates').select('*').eq('id', id).single();
    if (data) return data;
  }
  return fromLS().find(c => c.id === id) ?? null;
}

export async function createCertificate(row: CertIns): Promise<Cert | null> {
  if (isSupabaseEnabled()) {
    const { data, error } = await (supabase as any).from('certificates').insert(row).select().single();
    if (!error && data) return data;
  }
  const rows = fromLS();
  const next: Cert = { ...row as Cert, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  toLS([...rows, next]);
  return next;
}

export async function updateCertificate(id: string, patch: Partial<CertIns>): Promise<boolean> {
  if (isSupabaseEnabled()) {
    const { error } = await (supabase as any).from('certificates').update(patch).eq('id', id);
    return !error;
  }
  toLS(fromLS().map(c => c.id === id ? { ...c, ...patch, updated_at: new Date().toISOString() } : c));
  return true;
}

export async function deleteCertificate(id: string): Promise<boolean> {
  if (isSupabaseEnabled()) {
    const { error } = await (supabase as any).from('certificates').delete().eq('id', id);
    return !error;
  }
  toLS(fromLS().filter(c => c.id !== id));
  return true;
}

/** Returns certificates expiring within `days` days. */
export async function getExpiringCertificates(days = 60, orgId?: number): Promise<Cert[]> {
  const all = await getCertificates(orgId);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  return all.filter(c => {
    if (!c.expiry_date) return false;
    const exp = new Date(c.expiry_date);
    return exp <= cutoff && exp >= new Date();
  });
}
