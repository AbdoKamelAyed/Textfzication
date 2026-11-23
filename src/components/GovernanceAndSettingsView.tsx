import { useState } from 'react';
import { Download, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import type {
  AuditEvent,
  CollectionJob,
  DatasetRecord,
  ExperimentRecord,
  ExternalSource,
  TextSample,
  WritingPattern,
} from '../engine/types';

interface Props {
  datasets: DatasetRecord[];
  samples: TextSample[];
  patterns: WritingPattern[];
  experiments: ExperimentRecord[];
  sources: ExternalSource[];
  jobs: CollectionJob[];
  auditLogs: AuditEvent[];
  firestoreConnected: boolean | null;
  serverHealth: {
    ok: boolean;
    geminiConfigured: boolean;
    sqlConfigured: boolean;
  } | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onResetDemoWorkspace: () => void;
  onClearIndexedDb: () => void;
}

type DocTab = 'architecture' | 'data' | 'workflows' | 'deployment';

export function GovernanceAndSettingsView({
  datasets,
  samples,
  patterns,
  experiments,
  sources,
  jobs,
  auditLogs,
  firestoreConnected,
  serverHealth,
  theme,
  onToggleTheme,
  onResetDemoWorkspace,
  onClearIndexedDb,
}: Props) {
  const [docTab, setDocTab] = useState<DocTab>('architecture');
  const [anonymizeAuthors, setAnonymizeAuthors] = useState(true);
  const [requireConsent, setRequireConsent] = useState(true);
  const [excludeDemoExports, setExcludeDemoExports] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'clear' | null>(null);

  const exportFullBackup = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      datasets,
      samples,
      patterns,
      experiments,
      sources,
      jobs,
      auditLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `textprint-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          14. System Governance, Architecture &amp; Settings
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Storage layer diagnostics, privacy &amp; consent governance, audit trails, and repository architecture specifications.
        </p>
      </div>

      {/* Storage & Runtime Diagnostics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-1.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">IndexedDB Layered Storage</p>
          <p className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
            textprint_research_lab_v1
          </p>
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400 tabular-nums">
            raw: {samples.filter((s) => s.layer === 'raw').length} · processed:{' '}
            {samples.filter((s) => s.layer === 'processed').length} · approved:{' '}
            {samples.filter((s) => s.layer === 'approved').length}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-1.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Cloud Sync &amp; Firestore</p>
          <p className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
            {firestoreConnected === null
              ? 'Checking...'
              : firestoreConnected
                ? 'Firestore Connected'
                : 'Offline / Local IndexedDB Mode'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Auth-scoped user datasets, samples, and research notes
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-1.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Server Proxy &amp; AI Runtime</p>
          <p className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
            {serverHealth?.ok ? 'Express Proxy Online' : 'Static Client Mode'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Gemini API: {serverHealth?.geminiConfigured ? 'Configured' : 'Standby'} · SQL Pool:{' '}
            {serverHealth?.sqlConfigured ? 'Configured' : 'Fallback'}
          </p>
        </div>
      </div>

      {/* Privacy & Workspace Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Privacy, Consent &amp; Scientific Governance
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={anonymizeAuthors}
                onChange={(e) => setAnonymizeAuthors(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-700"
              />
              <span>
                Enforce pseudonymous author identifiers (`author_pseudo_id`) across stylometric fingerprint displays.
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={requireConsent}
                onChange={(e) => setRequireConsent(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-700"
              />
              <span>
                Require explicit participant research consent before admitting voluntary human writing submissions.
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={excludeDemoExports}
                onChange={(e) => setExcludeDemoExports(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-700"
              />
              <span>
                Mark `is_synthetic_demo: true` explicitly in every report and exclude demo counts from 3,000-sample targets.
              </span>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Switch Theme ({theme === 'dark' ? 'Dark' : 'Light'})
            </button>
            <button
              type="button"
              onClick={exportFullBackup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Workspace JSON</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction('reset')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo Corpus</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction('clear')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear IndexedDB</span>
            </button>
          </div>
        </div>

        {/* Audit Log */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Governance &amp; Provenance Audit Log
          </h2>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-1.5 pr-3 font-medium">Action</th>
                  <th className="py-1.5 pr-3 font-medium">Target</th>
                  <th className="py-1.5 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.map((ev) => (
                  <tr key={ev.id}>
                    <td className="py-2 pr-3 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {ev.action}
                    </td>
                    <td className="py-2 pr-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {ev.target_id}
                    </td>
                    <td className="py-2 text-slate-700 dark:text-slate-300">{ev.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Architecture & GitHub Actions Documentation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Architecture, Data Lifecycle &amp; GitHub Actions Automation
          </h2>
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-md border border-slate-200 dark:border-slate-800 text-xs">
            {(
              [
                ['architecture', 'System Architecture'],
                ['data', 'Data Lifecycle'],
                ['workflows', 'GitHub Actions'],
                ['deployment', 'Deployment'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDocTab(id)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  docTab === id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {docTab === 'architecture' && (
          <div className="text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
            <p>
              <strong>Pure Analytical Engines (`src/engine/*`):</strong> Zero DOM or network dependencies. Linguistic extraction, probabilistic classification, comparative diffing, quality validation, training splits, and D3 knowledge graph synthesis execute deterministically in TypeScript.
            </p>
            <p>
              <strong>Decoupled Storage &amp; AI Services:</strong> Browser IndexedDB (`raw_samples`, `processed_samples`, `approved_samples`) enables offline GitHub Pages operation, while optional Express proxy routes (`/api/ai/*`, `/api/db/*`) and Firebase Firestore + Google Drive handle server-side Gemini inference and multi-device sync without exposing API credentials.
            </p>
          </div>
        )}

        {docTab === 'data' && (
          <div className="text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
            <p>
              <strong>Three-Stage Lifecycle:</strong> Samples progress strictly through <span className="font-mono">RAW</span> (original encoding &amp; hash), <span className="font-mono">PROCESSED</span> (Unicode NFC normalization, Arabic diacritic/letter canonicalization, 6-category metrics), and <span className="font-mono">APPROVED</span> (provenance verified, duplicate/contamination cleared).
            </p>
            <p>
              <strong>Contamination Controls:</strong> Exact 64-bit normalized content hashes plus 3-gram Jaccard shingle overlap (&ge;82%) prevent cross-split leakage and flag near-duplicates.
            </p>
          </div>
        )}

        {docTab === 'workflows' && (
          <div className="text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
            <p>
              <strong>CI Validation (`.github/workflows/ci-validate.yml`):</strong> Runs on pushes, pull requests, and weekly Monday schedule (`0 3 * * 1`) to execute TypeScript checks, pure engine &amp; security rule unit tests (`npm test`), and production Vite bundle verification.
            </p>
            <p>
              <strong>Firebase Hosting Dev Channel (`.github/workflows/deploy-firebase-dev.yml`):</strong> Builds static `dist/` artifacts and deploys to the `dev` preview channel on project `gen-lang-client-0224046879` via `firebase.json`.
            </p>
            <p>
              <strong>GitHub Pages Deployment (`.github/workflows/deploy-pages.yml`):</strong> Builds static `dist/` artifacts and deploys cleanly to GitHub Pages with full client-side IndexedDB support.
            </p>
          </div>
        )}

        {docTab === 'deployment' && (
          <div className="text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
            <p>
              <strong>Firebase Hosting Dev Channel:</strong> Build with <span className="font-mono">npm run build</span> and deploy <span className="font-mono">dist/</span> using <span className="font-mono">npx firebase-tools hosting:channel:deploy dev --project gen-lang-client-0224046879</span>; Firestore rules deploy from <span className="font-mono">firestore.rules</span> to database <span className="font-mono">ai-studio-117e863f-2c6a-4a15-9406-a16d0c3a8602</span>.
            </p>
            <p>
              <strong>Static GitHub Pages Mode:</strong> Build with <span className="font-mono">npm run build</span> and deploy <span className="font-mono">dist/</span>; all 14 analytical modules operate locally using IndexedDB.
            </p>
            <p>
              <strong>Full-Stack Research Mode:</strong> Run <span className="font-mono">npm start</span> with server-side `GEMINI_API_KEY`, Firebase Auth/Firestore, and Google Drive OAuth enabled.
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {confirmAction === 'reset' ? 'Reset Demo Corpus?' : 'Clear Local IndexedDB Cache?'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {confirmAction === 'reset'
                ? 'This restores the initial synthetic demonstration datasets, patterns, and baseline experiments.'
                : 'This deletes locally cached IndexedDB records in this browser.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmAction === 'reset') onResetDemoWorkspace();
                  else onClearIndexedDb();
                  setConfirmAction(null);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-rose-600 text-white hover:bg-rose-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
