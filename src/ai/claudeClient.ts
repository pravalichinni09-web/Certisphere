/**
 * Claude API client.
 * ----------------------------------------------------------------------
 * PRIMARY MODE — server-managed key (recommended for the live site):
 *   The key is stored once as the Vercel env var ANTHROPIC_API_KEY and
 *   every call goes through the /api/claude server function. Users never
 *   enter a key. `initClaudeServer()` (called from main.tsx) detects it.
 *
 * FALLBACK MODE — BYO key, browser-direct (local development only):
 * ----------------------------------------------------------------------
 * - Reads the API key from localStorage 'cms_anthropic_api_key'.
 * - Calls api.anthropic.com /v1/messages directly from the browser.
 *   Anthropic supports this only when `anthropic-dangerous-direct-browser-access`
 *   is sent — never ship a public deployment with this enabled. For an
 *   internal certification tool with BYO keys this is acceptable.
 * - Provides `isClaudeConfigured`, `askClaude`, and a streaming-free
 *   single-turn `complete` helper for short prompts.
 *
 * The user can wipe the key with `clearApiKey()` from the AI Settings page.
 */

const API_KEY_STORAGE = 'cms_anthropic_api_key';
const MODEL_STORAGE = 'cms_anthropic_model';
const EVENT_NAME = 'cms-claude-config-updated';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

/* ── Server-managed key detection ──────────────────────────────────── */
const SERVER_ENDPOINT = '/api/claude';
const SERVER_CACHE = 'cms_claude_server_v1';
/** Placeholder returned by getApiKey() when the server holds the key. */
export const SERVER_MANAGED_KEY = '__server_managed__';

let serverAvailable: boolean = (() => {
  try { return localStorage.getItem(SERVER_CACHE) === '1'; } catch { return false; }
})();

/** True when AI calls are handled by the /api/claude server function. */
export const isServerManaged = (): boolean => serverAvailable;

/**
 * Asks the server whether ANTHROPIC_API_KEY is set. Resolves quickly
 * (timeout) so the app never waits long; result is cached for next load.
 */
export const initClaudeServer = async (timeoutMs = 2000): Promise<boolean> => {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let available = false;
  try {
    const res = await fetch(SERVER_ENDPOINT, { method: 'GET', signal: ctrl?.signal, cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    if (res.ok && type.includes('application/json')) {
      const json = await res.json();
      available = !!json?.configured;
    }
  } catch {
    available = false;
  } finally {
    if (timer) clearTimeout(timer);
  }
  const changed = available !== serverAvailable;
  serverAvailable = available;
  try { localStorage.setItem(SERVER_CACHE, available ? '1' : '0'); } catch { /* ignore */ }
  if (changed) {
    try { window.dispatchEvent(new CustomEvent(EVENT_NAME)); } catch { /* ignore */ }
  }
  return available;
};

/**
 * Drop-in replacement for `fetch('https://api.anthropic.com/v1/messages', init)`.
 * Uses the server proxy when available (the caller's x-api-key header is
 * ignored), otherwise calls Anthropic directly with the caller's headers.
 */
export const anthropicFetch = (init: RequestInit = {}): Promise<Response> => {
  if (serverAvailable) {
    return fetch(SERVER_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: init.body,
      signal: init.signal,
    });
  }
  return fetch('https://api.anthropic.com/v1/messages', init);
};

export const SUPPORTED_MODELS: { id: string; label: string; description: string }[] = [
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    description: 'Fastest. Great for short drafts and quick answers.',
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    description: 'Balanced quality and speed. Recommended for NCRs and summaries.',
  },
  {
    id: 'claude-opus-4-6',
    label: 'Claude Opus 4.6',
    description: 'Highest quality. Best for nuanced corrective-action drafting.',
  },
];

/** Key the user typed into AI Settings on this browser (fallback mode). */
export const getLocalApiKey = (): string | null => {
  try {
    const v = localStorage.getItem(API_KEY_STORAGE);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
};

/**
 * Key to use for a call. When the server manages the key this returns a
 * placeholder (the real key never reaches the browser).
 */
export const getApiKey = (): string | null =>
  serverAvailable ? SERVER_MANAGED_KEY : getLocalApiKey();

export const setApiKey = (key: string): void => {
  try {
    if (!key || !key.trim()) {
      localStorage.removeItem(API_KEY_STORAGE);
    } else {
      localStorage.setItem(API_KEY_STORAGE, key.trim());
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    /* ignore */
  }
};

export const clearApiKey = (): void => setApiKey('');

export const getModel = (): string => {
  try {
    const v = localStorage.getItem(MODEL_STORAGE);
    return v && v.trim() ? v.trim() : DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
};

export const setModel = (model: string): void => {
  try {
    localStorage.setItem(MODEL_STORAGE, model);
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    /* ignore */
  }
};

export const isClaudeConfigured = (): boolean => !!getApiKey();

export const onClaudeConfigChange = (cb: () => void): (() => void) => {
  const handler = () => cb();
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
};

export interface CompleteOptions {
  /** Optional system prompt injected as the `system` field. */
  system?: string;
  /** Override model for a single call. */
  model?: string;
  /** Max output tokens (default 1024). */
  maxTokens?: number;
  /** Temperature (default 0.4). */
  temperature?: number;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

export interface ClaudeError extends Error {
  status?: number;
  type?: string;
}

const buildError = (message: string, status?: number, type?: string): ClaudeError => {
  const err = new Error(message) as ClaudeError;
  err.status = status;
  err.type = type;
  return err;
};

/**
 * Single-turn completion. Returns the assistant's text output.
 * Throws a ClaudeError on network/API failures.
 */
export const complete = async (
  userPrompt: string,
  opts: CompleteOptions = {}
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw buildError(
      'Claude is not configured. Ask your administrator to add ANTHROPIC_API_KEY in Vercel.',
      0,
      'not_configured'
    );
  }

  const body = {
    model: opts.model || getModel(),
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.4,
    ...(opts.system ? { system: opts.system } : {}),
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  };

  let res: Response;
  try {
    res = await anthropicFetch({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    throw buildError(
      'Could not reach Claude (network error). Check your connection.',
      0,
      'network'
    );
  }

  if (!res.ok) {
    let detail = `Claude API error ${res.status}`;
    try {
      const err = await res.json();
      detail = err?.error?.message || detail;
    } catch {
      /* ignore parse errors */
    }
    throw buildError(detail, res.status, 'api_error');
  }

  const json = await res.json();
  // Response shape: { content: [{ type: 'text', text: '...' }, ... ] }
  const blocks: Array<{ type: string; text?: string }> = json?.content || [];
  const text = blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text || '')
    .join('\n')
    .trim();

  if (!text) {
    throw buildError('Claude returned an empty response.', res.status, 'empty');
  }
  return text;
};

/** Convenience wrapper that returns null on failure instead of throwing. */
export const completeSafe = async (
  prompt: string,
  opts: CompleteOptions = {}
): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
  try {
    const text = await complete(prompt, opts);
    return { ok: true, text };
  } catch (e: unknown) {
    const msg = (e as Error)?.message || 'Unknown Claude error';
    return { ok: false, error: msg };
  }
};
