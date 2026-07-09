# Deploying CertMS to a public URL

The app is a static Vite + React build, so any free static host works.
Pick **one** of these three paths — Vercel is the fastest.

## Path A — Vercel (recommended, ~3 minutes)

1. Push the project to a new GitHub repo (or any git host Vercel reads).
   ```bash
   cd "C:\Users\91733\OneDrive\Desktop\CMS developed 5 (3)\CMS developed 5\CertMS"
   git init && git add . && git commit -m "Initial commit"
   # Create a new empty repo on https://github.com/new (e.g. praveen/certms)
   git branch -M main
   git remote add origin https://github.com/<your-user>/certms.git
   git push -u origin main
   ```
2. Go to https://vercel.com/new, click **Import** next to the new repo.
3. Vercel auto-detects Vite. Hit **Deploy**.
4. Done — share `https://certms-<your-user>.vercel.app`.

The included `vercel.json` rewrites every path to `index.html` so React
Router deep links (e.g. `/auditor-coordinator/workflow-map`) work.

## Path B — Netlify (~3 minutes)

1. Push the repo to GitHub (same as step 1 above).
2. Go to https://app.netlify.com/start, pick the repo.
3. Netlify reads `netlify.toml` automatically — build command + publish
   folder + SPA redirect are already set.
4. Done — share `https://certms-<random>.netlify.app`.

You can also drag-and-drop the `dist/` folder onto
https://app.netlify.com/drop for a one-shot upload without git.

## Path C — GitHub Pages (free, slower setup)

1. Push the repo (same as Path A step 1).
2. In the repo, **Settings → Pages → Source: GitHub Actions**.
3. The included `.github/workflows/deploy.yml` builds and publishes on
   every push to `main`. The first deploy gives you:
   `https://<your-user>.github.io/<repo-name>/`.
4. **Important:** GitHub Pages serves under a sub-path, so build with
   ```bash
   BASE_PATH=/<repo-name>/ npm run build
   ```
   The included workflow already does this if you set the repo name as
   the `BASE_PATH` secret. Alternatively, edit the workflow to read
   `${{ github.event.repository.name }}`.

## Local preview (any time)

```bash
npm run build
npx vite preview --port 5000
# open http://localhost:5000
```

## Important notes about data

CertMS persists everything in the **browser's localStorage** — there is
no shared backend. That means:

- Each visitor sees only their own data (their own demo seed).
- Shared edits between users won't propagate.
- If you want one consistent demo, run the global seeder before sharing,
  but be aware each viewer starts with a fresh localStorage.

When you're ready for a multi-user backend, the existing
`src/services/workflowHandoff.ts` is structured so it can be swapped
from localStorage to a real API with minimal code changes.
