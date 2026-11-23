# Deploying TEXTPRINT to GitHub Pages

This guide provides step-by-step instructions for building and deploying **TEXTPRINT** (React + Vite + TypeScript) to **GitHub Pages**, including configuring Vite's `base` path for project subdirectory hosting (`https://<username>.github.io/<repo-name>/`).

---

## 1. Static Hosting Scope (What Runs on GitHub Pages)

Because TEXTPRINT's linguistic extraction, stylometry, probabilistic classification, quality validation, training simulation, and D3/Recharts engines reside in pure TypeScript under `src/engine/`, the compiled static bundle (`dist/`) runs directly in the browser on GitHub Pages:

- **Available on GitHub Pages:** All 14 UI modules, client-side NLP/stylometry engines, Recharts/D3 visualizations, local layered persistence via IndexedDB (`textprint_research_lab_v1` in `src/storage/indexedDb.ts`), and Firebase Auth / Firestore sync (once the Pages domain is authorized).
- **Unavailable on static hosting:** Server-side Express endpoints under `/api/*` (`server.ts`), including Gemini AI proxy routes (`/api/ai/*`) and optional Cloud SQL PostgreSQL routes (`/api/db/*`). Those require deploying the full-stack Express runtime (`npm start`) to Node/Cloud Run.

---

## 2. Prerequisites

- Node.js **22+** and `npm`
- A GitHub repository containing this project on the `main` branch
- Clean local dependencies (`npm ci`)

---

## 3. Configure `base` in `vite.config.ts` for Subdirectory Hosting

GitHub Pages serves repositories in one of two URL structures:

1. **User/Organization root site** (`https://<username>.github.io/`) → `base: '/'`
2. **Project repository subdirectory** (`https://<username>.github.io/<repo-name>/`) → `base: '/<repo-name>/'`

If `base` remains `'/'` when deployed to a subdirectory, Vite emits asset paths like `/assets/index-*.js` instead of `/<repo-name>/assets/index-*.js`, causing 404 errors and a blank screen.

### Recommended `vite.config.ts` Configuration

Using an environment variable keeps root-path hosting (`npm run dev`, Cloud Run, Firebase Hosting) working at `'/'` while allowing GitHub Pages builds to inject `/<repo-name>/`:

```ts
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    // Defaults to '/' for root hosting; set VITE_BASE_PATH='/<repo-name>/' for GitHub Pages subdirectories
    base: process.env.VITE_BASE_PATH || '/',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
```

> **Path Rule:** Always include **both** a leading and trailing slash for subdirectories (for example `'/textprint/'`, not `'textprint'` or `'/textprint'`). Vite automatically rewrites `<script type="module" src="/src/main.tsx">` in `index.html` and bundled CSS/JS URLs to use this `base` prefix.

*(If you only ever deploy to a single fixed repository subdirectory and never to root, you may set `base: '/<repo-name>/'` directly instead of reading `process.env.VITE_BASE_PATH`.)*

---

## 4. Test the Subdirectory Build Locally

Before pushing, verify TypeScript types, unit/rules tests, and the subdirectory bundle locally:

```bash
npm ci
npm run lint
npm test
VITE_BASE_PATH=/textprint/ npm run build
npx vite preview --port 4173
```

Open `http://localhost:4173/textprint/` in your browser and confirm that the dashboard and all JavaScript/CSS assets load with HTTP 200 and zero console errors.

---

## 5. Enable GitHub Pages in Repository Settings

1. Open your repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

---

## 6. Configure and Run the GitHub Actions Workflow

The repository already includes `.github/workflows/deploy-pages.yml` and `.github/workflows/ci-validate.yml`.

If deploying to a project subdirectory (`https://<username>.github.io/<repo-name>/`), pass `VITE_BASE_PATH` to the build step in `.github/workflows/deploy-pages.yml`:

```yaml
      - name: Build static frontend
        env:
          VITE_BASE_PATH: /${{ github.event.repository.name }}/
        run: npm run build
```

*(For a `<username>.github.io` root repository, omit `VITE_BASE_PATH` or set it to `/`.)*

### Triggering Deployment

- **Automatic:** Push or merge changes to the `main` branch.
- **Manual:** Open **Actions → Deploy TEXTPRINT Static Build to GitHub Pages → Run workflow**.

Once the `build` and `deploy` jobs succeed, GitHub displays your live site URL in the workflow summary and under **Settings → Pages**.

---

## 7. Post-Deploy Checks (Routing & Firebase Auth)

1. **Client-Side Module Navigation:** TEXTPRINT switches between its 14 research modules via React state (`ModuleId` in `src/App.tsx`) rather than nested URL history routes, so page refreshes at `/<repo-name>/` work cleanly without custom `404.html` redirect hacks.
2. **Firebase Google Sign-In (`src/lib/firebase.ts`):** If you use Google authentication and Firestore sync from your GitHub Pages URL, add `<username>.github.io` (or your custom domain) under **Firebase Console → Authentication → Settings → Authorized domains**. Otherwise `signInWithPopup` will throw `auth/unauthorized-domain`.
3. **Static Asset References:** If you ever add unbundled files in `public/` or `src/assets/`, reference them using `${import.meta.env.BASE_URL}...` so subdirectory prefixes resolve accurately.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| Blank page & `404` for `/assets/index-*.js` | `base` in `vite.config.ts` is still `'/'` on a subdirectory URL | Set `VITE_BASE_PATH=/<repo-name>/` (with leading & trailing slashes) and rebuild |
| `auth/unauthorized-domain` on Google Sign-In | GitHub Pages hostname is not allowlisted in Firebase Auth | Add `<username>.github.io` in Firebase Console → Authentication → Authorized domains |
| AI Copilot / Gemini endpoints return `404` | GitHub Pages only serves static files, not `server.ts` | Run `npm start` on Node / Cloud Run for server-side `/api/ai/*` routes |
