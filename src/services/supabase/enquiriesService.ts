import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Enquiry    = Database['public']['Tables']['client_enquiries']['Row'];
type EnquiryIns = Database['public']['Tables']['client_enquiries']['Insert'];

const LS_KEY = 'cms_client_enquiries_v1';

const fromLS = (): Enquiry[] => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
};
const toLS = (rows: Enquiry[]) => localStorage.setItem(LS_KEY, JSON.stringify(rows));

export async function getEnquiries(): Promise<Enquiry[]> {
  if (isSupabaseEnabled()) {
    const { data, error } = await (supabase as any).from('client_enquiries').select('*').order('created_at', { ascending: false });
    if (!error && data) return data;
  }
  return fromLS();
}

export async function createEnquiry(row: EnquiryIns): Promise<Enquiry | null> {
  if (isSupabaseEnabled()) {
    const { data, error } = await (supabase as any).from('client_enquiries').insert(row).select().single();
    if (!error && data) return data;
  }
  const rows = fromLS();
  const next: Enquiry = { ...row as Enquiry, id: Date.now(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  toLS([...rows, next]);
  return next;
}

export async function updateEnquiryStatus(id: number, status: Enquiry['status']): Promise<boolean> {
  if (isSupabaseEnabled()) {
    const { error } = await (supabase as any).from('client_enquiries').update({ status }).eq('id', id);
    return !error;
  }
  toLS(fromLS().map(e => e.id === id ? { ...e, status, updated_at: new Date().toISOString() } : e));
  return true;
}
