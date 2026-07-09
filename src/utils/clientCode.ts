/**
 * Auto-generates client codes of the form CMS-YYYY-NNNN.
 * Counter is persisted in localStorage so codes are sequential per browser.
 */

const STORAGE_KEY = 'cms_client_code_counter';

interface CounterState {
  year: number;
  next: number;
}

const readCounter = (): CounterState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.year === 'number' && typeof parsed.next === 'number') return parsed;
    }
  } catch {
    // fallthrough
  }
  return { year: new Date().getFullYear(), next: 1 };
};

const writeCounter = (state: CounterState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
};

/**
 * Allocate the next client code. Each call increments the counter.
 */
export const allocateClientCode = (): string => {
  const year = new Date().getFullYear();
  const state = readCounter();
  if (state.year !== year) {
    state.year = year;
    state.next = 1;
  }
  const code = `CMS-${year}-${String(state.next).padStart(4, '0')}`;
  state.next += 1;
  writeCounter(state);
  return code;
};

/**
 * Peek at the next code without allocating it (useful for previews).
 */
export const peekClientCode = (): string => {
  const year = new Date().getFullYear();
  const state = readCounter();
  const next = state.year === year ? state.next : 1;
  return `CMS-${year}-${String(next).padStart(4, '0')}`;
};

/**
 * Reset counter (used in dev tools only).
 */
export const resetClientCode = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};
