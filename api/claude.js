/**
 * /api/claude — server-side proxy to the Anthropic Messages API.
 * ----------------------------------------------------------------------
 * The Anthropic API key lives ONLY in the Vercel environment variable
 * ANTHROPIC_API_KEY. Browsers never see it, and users never have to
 * enter a key: every AI tool in CertiSphere calls this endpoint.
 *
 *   GET  /api/claude  → { configured: boolean, model: string }
 *   POST /api/claude  → same body as Anthropic /v1/messages
 *                       (model, max_tokens, temperature, system, messages)
 *
 * Safety limits: same-origin requests only, allow-listed models,
 * capped output tokens and request size.
 *
 * Optional env: ANTHROPIC_MODEL — default model (else Claude Haiku 4.5).
 */

const ALLOWED_MODELS = new Set([
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
  'claude-opus-4-6',
]);
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL && ALLOWED_MODELS.has(process.env.ANTHROPIC_MODEL)
  ? process.env.ANTHROPIC_MODEL
  : 'claude-haiku-4-5-20251001';
const MAX_OUTPUT_TOKENS = 4096;
const MAX_REQUEST_BYTES = 200 * 1024; // 200 KB of prompt

const sameOrigin = (req) => {
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return true; // same-origin fetches may omit Origin on GET
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (req.method === 'GET') {
    return res.status(200).json({ configured: !!apiKey, model: DEFAULT_MODEL });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  if (!sameOrigin(req)) {
    return res.status(403).json({ error: { message: 'Requests are only accepted from the CertiSphere app.' } });
  }

  if (!apiKey) {
    return res.status(503).json({
      error: { type: 'not_configured', message: 'AI is not enabled on this server (ANTHROPIC_API_KEY missing).' },
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({ error: { message: 'Request must include a non-empty "messages" array.' } });
  }
  if (JSON.stringify(body).length > MAX_REQUEST_BYTES) {
    return res.status(413).json({ error: { message: 'Prompt is too large.' } });
  }

  const payload = {
    model: ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL,
    max_tokens: Math.min(Math.max(Number(body.max_tokens) || 1024, 1), MAX_OUTPUT_TOKENS),
    messages: body.messages,
    ...(typeof body.temperature === 'number' ? { temperature: Math.min(Math.max(body.temperature, 0), 1) } : {}),
    ...(body.system ? { system: body.system } : {}),
  };

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', 'application/json');
    return res.send(text);
  } catch (err) {
    return res.status(502).json({ error: { type: 'network', message: 'Could not reach the Claude API from the server.' } });
  }
}
