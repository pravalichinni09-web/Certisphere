/**
 * Indian regulatory ID validators (GST, CIN, PAN) and common shape helpers.
 */

export interface ValidationResult {
  ok: boolean;
  message?: string;
}

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
// Format: 2-digit state + 10-char PAN + 1-digit entity + Z + 1 checksum
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z][Z][0-9A-Z]$/;
// Format: U/L + 5-digit industry + 2 state + 4-digit year + 3 ownership + 6 reg num
const CIN_RE = /^[ULul][0-9]{5}[A-Za-z]{2}[0-9]{4}[A-Za-z]{3}[0-9]{6}$/;

export const validatePan = (raw: string): ValidationResult => {
  const value = (raw || '').toUpperCase().trim();
  if (!value) return { ok: false, message: 'PAN is required' };
  if (!PAN_RE.test(value)) return { ok: false, message: 'PAN must be 10 chars: 5 letters + 4 digits + 1 letter' };
  return { ok: true };
};

export const validateGstin = (raw: string): ValidationResult => {
  const value = (raw || '').toUpperCase().trim();
  if (!value) return { ok: false, message: 'GSTIN is required' };
  if (value.length !== 15) return { ok: false, message: 'GSTIN must be exactly 15 characters' };
  if (!GSTIN_RE.test(value)) return { ok: false, message: 'GSTIN format invalid (e.g. 27AABCU9603R1ZM)' };
  return { ok: true };
};

export const validateCin = (raw: string): ValidationResult => {
  const value = (raw || '').toUpperCase().trim();
  if (!value) return { ok: false, message: 'CIN is required' };
  if (value.length !== 21) return { ok: false, message: 'CIN must be exactly 21 characters' };
  if (!CIN_RE.test(value)) return { ok: false, message: 'CIN format invalid (e.g. U12345MH2020PTC123456)' };
  return { ok: true };
};

export const validateEmail = (raw: string): ValidationResult => {
  const value = (raw || '').trim();
  if (!value) return { ok: false, message: 'Email is required' };
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  return ok ? { ok: true } : { ok: false, message: 'Email format invalid' };
};

export const validatePhone = (raw: string): ValidationResult => {
  const value = (raw || '').replace(/[\s\-]+/g, '').trim();
  if (!value) return { ok: false, message: 'Phone is required' };
  const digits = value.replace(/^\+/, '');
  if (!/^\d{7,15}$/.test(digits)) return { ok: false, message: 'Phone must be 7-15 digits' };
  return { ok: true };
};
