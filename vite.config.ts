import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set BASE_PATH at build time when deploying to a sub-path host like
// GitHub Pages, e.g.   BASE_PATH=/CertMS/ npm run build
// Leave it empty for Vercel / Netlify / Cloudflare Pages (served at /).
const basePath = process.env.BASE_PATH || '/'

export default defineConfig({
  base: basePath,
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
