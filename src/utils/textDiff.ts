/**
 * Tiny line-based diff using LCS, returns simple add/remove/equal ops.
 * Sufficient for short audit-scope documents.
 */

export type DiffOp = 'equal' | 'add' | 'remove';

export interface DiffLine {
  op: DiffOp;
  text: string;
  /** Old-side line number (1-indexed) or undefined for adds. */
  oldNo?: number;
  /** New-side line number (1-indexed) or undefined for removes. */
  newNo?: number;
}

const splitLines = (s: string): string[] => (s || '').replace(/\r\n/g, '\n').split('\n');

export const diffLines = (oldText: string, newText: string): DiffLine[] => {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const m = a.length;
  const n = b.length;

  // LCS table
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ op: 'equal', text: a[i], oldNo: i + 1, newNo: j + 1 });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ op: 'remove', text: a[i], oldNo: i + 1 });
      i += 1;
    } else {
      out.push({ op: 'add', text: b[j], newNo: j + 1 });
      j += 1;
    }
  }
  while (i < m) {
    out.push({ op: 'remove', text: a[i], oldNo: i + 1 });
    i += 1;
  }
  while (j < n) {
    out.push({ op: 'add', text: b[j], newNo: j + 1 });
    j += 1;
  }
  return out;
};

export const summarizeDiff = (diff: DiffLine[]): { added: number; removed: number; equal: number } => {
  let added = 0;
  let removed = 0;
  let equal = 0;
  for (const d of diff) {
    if (d.op === 'add') added += 1;
    else if (d.op === 'remove') removed += 1;
    else equal += 1;
  }
  return { added, removed, equal };
};
