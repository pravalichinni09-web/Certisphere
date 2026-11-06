import { defineConfig, loadEnv, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Runs the Vercel function api/claude.js inside `npm run dev`, so the AI
 * features also work on localhost. Put the key in .env.local as
 *   ANTHROPIC_API_KEY=sk-ant-...
 * (no VITE_ prefix, so it is never bundled into the browser code).
 */
const localClaudeApi = (env: Record<string, string>): Plugin => ({
  name: 'local-claude-api',
  configureServer(server) {
    if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY
    if (env.ANTHROPIC_MODEL) process.env.ANTHROPIC_MODEL = env.ANTHROPIC_MODEL
    server.middlewares.use('/api/claude', async (req, res) => {
      let raw = ''
      for await (const chunk of req) raw += chunk
      const mod = await server.ssrLoadModule('/api/claude.js')
      const reply = {
        status(code: number) { res.statusCode = code; return reply },
        setHeader(k: string, v: string) { res.setHeader(k, v); return reply },
        json(obj: unknown) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); return reply },
        send(text: string) { res.end(text); return reply },
      }
      let body: unknown
      try { body = raw ? JSON.parse(raw) : undefined } catch { body = raw }
      await mod.default({ method: req.method, headers: req.headers, body }, reply)
    })
  },
})

// Set BASE_PATH at build time when deploying to a sub-path host like
// GitHub Pages, e.g.   BASE_PATH=/CertMS/ npm run build
// Leave it empty for Vercel / Netlify / Cloudflare Pages (served at /).
const basePath = process.env.BASE_PATH || '/'

export default defineConfig(({ mode }) => ({
  base: basePath,
  plugins: [react(), localClaudeApi(loadEnv(mode, process.cwd(), ''))],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
}))
