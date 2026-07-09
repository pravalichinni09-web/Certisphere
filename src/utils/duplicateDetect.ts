/**
 * Lightweight duplicate detection for client / contact records.
 * Compares email and phone with normalization (lowercase, strip non-digits).
 */

export interface DuplicateCandidate {
  field: 'email' | 'phone';
  /** Existing record's identifier so callers can navigate to it. */
  existingId: string | number;
  existingLabel: string;
  reason: string;
}

export interface CompareTarget {
  id: string | number;
  label: string;
  email?: string;
  phone?: string;
}

const normalizeEmail = (e?: string): string => (e || '').trim().toLowerCase();
const normalizePhone = (p?: string): string => (p || '').replace(/[^0-9]/g, '');

export const detectDuplicates = (
  candidate: { email?: string; phone?: string },
  haystack: CompareTarget[]
): DuplicateCandidate[] => {
  const out: DuplicateCandidate[] = [];
  const candEmail = normalizeEmail(candidate.email);
  const candPhone = normalizePhone(candidate.phone);
  for (const item of haystack) {
    if (candEmail && normalizeEmail(item.email) === candEmail) {
      out.push({
        field: 'email',
        existingId: item.id,
        existingLabel: item.label,
        reason: `Email matches ${item.label}`,
      });
    }
    if (candPhone && candPhone.length >= 7 && normalizePhone(item.phone) === candPhone) {
      out.push({
        field: 'phone',
        existingId: item.id,
        existingLabel: item.label,
        reason: `Phone matches ${item.label}`,
      });
    }
  }
  return out;
};
