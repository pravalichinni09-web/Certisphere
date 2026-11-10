import { defineConfig, loadEnv, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Runs the Vercel functions in api/*.js inside `npm run dev`, so AI and live
 * accounts also work on localhost. Server-only secrets go in .env.local
 * WITHOUT the VITE_ prefix (never bundled into the browser code):
 *   ANTHROPIC_API_KEY=...            (AI)
 *   SUPABASE_SERVICE_ROLE_KEY=...    (account management / registration)
 */
const SERVER_ENV = ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL']
const localApi = (env: Record<string, string>): Plugin => ({
  name: 'local-vercel-api',
  configureServer(server) {
    SERVER_ENV.forEach((k) => { if (env[k]) process.env[k] = env[k] })
    server.middlewares.use(async (req, res, next) => {
      const m = /^\/api\/([a-z0-9-]+)(?:[/?#]|$)/i.exec(req.url || '')
      if (!m) return next()
      let raw = ''
      for await (const chunk of req) raw += chunk
      let mod: any
      try { mod = await server.ssrLoadModule(`/api/${m[1]}.js`) } catch {
        res.statusCode = 404; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ error: 'Not found' })); return
      }
      const reply = {
        status(code: number) { res.statusCode = code; return reply },
        setHeader(k: string, v: string) { res.setHeader(k, v); return reply },
        json(obj: unknown) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); return reply },
        send(text: string) { res.end(text); return reply },
      }
      let body: unknown
      try { body = raw ? JSON.parse(raw) : undefined } catch { body = raw }
      await mod.default({ method: req.method, headers: req.headers, body, url: req.url }, reply)
    })
  },
})

// Set BASE_PATH at build time when deploying to a sub-path host like
// GitHub Pages, e.g.   BASE_PATH=/CertMS/ npm run build
// Leave it empty for Vercel / Netlify / Cloudflare Pages (served at /).
const basePath = process.env.BASE_PATH || '/'

export default defineConfig(({ mode }) => ({
  base: basePath,
  plugins: [react(), localApi(loadEnv(mode, process.cwd(), ''))],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
}))
