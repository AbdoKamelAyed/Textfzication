# TEXTPRINT Deployment & System Management Guide

## 1. Local Full-Stack Development
- Install dependencies: `npm install`
- Start Express + Vite dev server on port 3000: `npm run dev`
- Run unit tests & Firestore security rule tests: `npm test`
- Typecheck & lint Firestore rules: `npm run lint && npx eslint firestore.rules`

## 2. Deploying to Firebase Hosting (`dev` Channel & Live)
TEXTPRINT ships `firebase.json` and `.firebaserc` wired to project `gen-lang-client-0224046879` and Firestore database `ai-studio-117e863f-2c6a-4a15-9406-a16d0c3a8602`.

- **Manual CLI (`dev` preview channel)**:
  1. Build static bundle: `npm run build`
  2. Authenticate once: `npx firebase-tools login`
  3. Deploy to `dev` channel: `npx firebase-tools hosting:channel:deploy dev --project gen-lang-client-0224046879 --expires 30d`
  4. Deploy Firestore rules only: `npx firebase-tools deploy --only firestore:rules --project gen-lang-client-0224046879`
  5. Deploy live site + rules: `npx firebase-tools deploy --only hosting,firestore:rules --project gen-lang-client-0224046879`
- **Automated CI (`dev` channel)**:
  - `.github/workflows/deploy-firebase-dev.yml` deploys pushes on `dev` and PRs into `main` to Firebase Hosting's `dev` channel when `FIREBASE_SERVICE_ACCOUNT_GEN_LANG_CLIENT_0224046879` is added to GitHub Repository Secrets.
- **Note on `/api/*` Server Routes on Static Hosting**:
  - Static Firebase Hosting / GitHub Pages builds run all 14 pure linguistic, stylometry, validation, diffing, training, and D3/Recharts modules client-side via IndexedDB + Firebase Auth/Firestore. Server-side Gemini proxy routes (`/api/ai/*`) and optional Cloud SQL (`/api/db/*`) require the Node/Express runtime (`npm start`).

## 3. System & Operations Management
- **Datasets & Provenance (`02. Data Acquisition`, `03. Dataset Management`)**:
  - Three-layer lifecycle: `raw` (ingest + hash) → `processed` (Unicode NFC normalization + 6-category metrics) → `approved` (verified & leakage-checked).
  - Synthetic demo records are tagged `is_synthetic_demo: true` and excluded from 3,000-sample research targets.
  - Export complete workspace JSON backups or reset/clear local cache from `14. Governance & Settings`.
- **Code Versioning**:
  - Track package version in `package.json`, feature branches (`dev` → `main`) with SemVer git tags (`git tag -a v1.x.x`), and automated checks in `.github/workflows/ci-validate.yml`.
- **Databases (Hybrid Triple-Store)**:
  - **Client Offline Cache**: IndexedDB (`textprint_research_lab_v1` in `src/storage/indexedDb.ts`).
  - **Cloud Sync**: Firestore (`ai-studio-117e863f-2c6a-4a15-9406-a16d0c3a8602`), schema defined in `firebase-blueprint.json`.
  - **Optional Relational Store**: PostgreSQL/Cloud SQL Drizzle schema in `src/db/schema.ts` (gracefully falls back when SQL socket is unavailable).
- **Authentication & Authorization**:
  - Client Google Sign-In via `signInWithPopup` (`src/lib/firebase.ts`); Google Drive OAuth tokens stay strictly in memory.
  - Add any custom Firebase Hosting / `dev` preview domain under **Firebase Console → Authentication → Settings → Authorized domains** so `signInWithPopup` succeeds on `*.web.app` / `--dev-*.web.app`.
  - Backend Express routes verify Firebase ID tokens via `adminAuth.verifyIdToken` (`src/middleware/auth.ts`).
  - Firestore authorization rules (`firestore.rules`) enforce verified-email owner checks (`users/{userId}/*`), immutable `createdAt`/`ownerUid` fields, and `/admins/{uid}` + bootstrap admin (`abdokamel200514@gmail.com`). Validate rules with `npx eslint firestore.rules && npm test`.
- **Audit & System Logs**:
  - Research provenance events (`INIT_DEMO_CORPUS`, `IMPORT_SAMPLES`, `VALIDATE_SAMPLE`, `RUN_TRAINING`) are recorded in-app (`auditLogs`, viewable in `14. Governance & Settings`) and in SQL `audit_logs` when Cloud SQL is active.
  - Runtime errors surface structured `FirestoreErrorInfo` payloads in browser console / `ErrorBoundary` and Express stdout logs (`server.ts`).
