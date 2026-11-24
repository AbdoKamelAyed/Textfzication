import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Activity,
  Database,
  Download,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  computeDatabaseLayerSummary,
  filterAuditEvents,
  SYSTEM_RESPONSIBILITY_MATRIX,
  type AccountStatus,
  type SystemRole,
} from '../engine/adminGovernance';
import type {
  AuditEvent,
  CollectionJob,
  DatasetRecord,
  ExperimentRecord,
  ExternalSource,
  TextSample,
  WritingPattern,
} from '../engine/types';
import {
  checkIsAdminUser,
  grantAdminAccess,
  listFirestoreAdmins,
  listFirestoreUsers,
  revokeAdminAccess,
  testFirestoreConnection,
  updateUserRoleAndStatus,
  type FirestoreAdminRecord,
  type FirestoreUserRecord,
} from '../lib/firebase';
import { safeFetchJson } from '../lib/safeFetchJson';
import { useI18n } from '../lib/i18nContext';
import { GovernanceStatusMonitor } from './GovernanceStatusMonitor';
import type { HealthEndpointPayload } from '../engine/connectivityMonitor';

interface Props {
  user: User | null;
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
  onSignIn: () => void;
  onLogAudit: (action: string, targetType: string, targetId: string, details: string) => void;
}

type AdminSection = 'system' | 'users' | 'database' | 'deployment' | 'audit';
type DocTab = 'architecture' | 'data' | 'workflows' | 'deployment';

interface SystemStatusResponse {
  ok: boolean;
  service: string;
  nodeVersion: string;
  environment: string;
  port: number;
  uptimeSeconds: number;
  memoryMb: number;
  geminiConfigured: boolean;
  sql: {
    available: boolean;
    socketPathConfigured: boolean;
  };
  firebase: {
    projectId: string;
    firestoreDatabaseId: string;
    authDomain: string;
  };
  deployment: {
    mode: string;
    distBuilt: boolean;
    firebaseJsonPresent: boolean;
    firestoreRulesPresent: boolean;
    workflows: Array<{ path: string; exists: boolean }>;
  };
  timestamp: string;
}

export function GovernanceAndSettingsView({
  user,
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
  onSignIn,
  onLogAudit,
}: Props) {
  const { lang } = useI18n();
  const isAr = lang === 'ar';
  const [section, setSection] = useState<AdminSection>('system');
  const [docTab, setDocTab] = useState<DocTab>('architecture');
  const [anonymizeAuthors, setAnonymizeAuthors] = useState(true);
  const [requireConsent, setRequireConsent] = useState(true);
  const [excludeDemoExports, setExcludeDemoExports] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'clear' | null>(null);

  // Deployment & Runtime status state
  const [systemStatus, setSystemStatus] = useState<SystemStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Live Firestore & real-time /api/health monitor state
  const [liveFsCheck, setLiveFsCheck] = useState<{
    checkedAt: string;
    connected: boolean;
  } | null>(null);
  const [fsChecking, setFsChecking] = useState(false);
  const [liveHealthOverride, setLiveHealthOverride] = useState<{
    hasProbe: boolean;
    payload: HealthEndpointPayload | null;
    firestoreOk: boolean;
  } | null>(null);

  // Admin Users & RBAC state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(false);
  const [usersList, setUsersList] = useState<FirestoreUserRecord[]>([]);
  const [adminsList, setAdminsList] = useState<FirestoreAdminRecord[]>([]);
  const [userDrafts, setUserDrafts] = useState<
    Record<string, { role: SystemRole; status: AccountStatus }>
  >({});
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersFeedback, setUsersFeedback] = useState<string | null>(null);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Audit filter state
  const [auditQuery, setAuditQuery] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');

  const dbSummary = useMemo(
    () => computeDatabaseLayerSummary({ datasets, samples, experiments }),
    [datasets, samples, experiments]
  );

  const distinctAuditActions = useMemo(
    () => ['ALL', ...Array.from(new Set(auditLogs.map((a) => a.action)))],
    [auditLogs]
  );

  const filteredAudits = useMemo(
    () => filterAuditEvents(auditLogs, auditQuery, auditActionFilter),
    [auditLogs, auditQuery, auditActionFilter]
  );

  const fetchSystemStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    const result = await safeFetchJson<SystemStatusResponse>(
      '/api/system/status',
      undefined,
      'Running in Static Client Hosting mode (Express /api/* runtime not attached; IndexedDB + Firebase Auth/Firestore active).'
    );
    if (result.ok && result.data) {
      setSystemStatus(result.data);
    } else {
      setSystemStatus(null);
      setStatusError(result.error || 'Server status unavailable. Running in static client mode.');
    }
    setStatusLoading(false);
  }, []);

  useEffect(() => {
    void fetchSystemStatus();
  }, [fetchSystemStatus]);

  const loadDirectoryData = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const [uList, aList] = await Promise.all([listFirestoreUsers(), listFirestoreAdmins()]);
      setUsersList(uList);
      setAdminsList(aList);
      const drafts: Record<string, { role: SystemRole; status: AccountStatus }> = {};
      for (const u of uList) {
        drafts[u.uid] = {
          role: u.role ?? 'researcher',
          status: u.status ?? 'active',
        };
      }
      setUserDrafts(drafts);
    } catch (err) {
      setUsersError(
        err instanceof Error
          ? err.message
          : 'Unable to list Firestore user directory. Verify admin permissions.'
      );
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function verifyAdmin() {
      if (!user) {
        setIsAdmin(false);
        setUsersList([]);
        setAdminsList([]);
        return;
      }
      setAdminCheckLoading(true);
      const adminOk = await checkIsAdminUser(user);
      if (!active) return;
      setIsAdmin(adminOk);
      setAdminCheckLoading(false);
      if (adminOk) {
        void loadDirectoryData();
      }
    }
    void verifyAdmin();
    return () => {
      active = false;
    };
  }, [user, loadDirectoryData]);

  const handleSaveUserRole = async (record: FirestoreUserRecord) => {
    if (!user) return;
    const draft = userDrafts[record.uid];
    if (!draft) return;
    setUsersError(null);
    setUsersFeedback(null);
    try {
      await updateUserRoleAndStatus(user, record.uid, record.email, draft.role, draft.status);
      onLogAudit(
        'ADMIN_UPDATE_ROLE',
        'user',
        record.uid,
        `Updated ${record.email} to role=${draft.role}, status=${draft.status}.`
      );
      setUsersFeedback(`Updated ${record.email} (${draft.role} · ${draft.status}).`);
      await loadDirectoryData();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to update user role.');
    }
  };

  const handleGrantAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newAdminUid.trim() || !newAdminEmail.trim()) {
      setUsersError('Provide both Firebase UID and verified email address to grant admin access.');
      return;
    }
    setUsersError(null);
    setUsersFeedback(null);
    try {
      await grantAdminAccess(user, newAdminUid.trim(), newAdminEmail.trim());
      onLogAudit(
        'ADMIN_GRANT_ALLOWLIST',
        'admin',
        newAdminUid.trim(),
        `Granted /admins allowlist entry for ${newAdminEmail.trim()}.`
      );
      setUsersFeedback(`Granted admin access to ${newAdminEmail.trim()}.`);
      setNewAdminUid('');
      setNewAdminEmail('');
      await loadDirectoryData();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to grant admin allowlist.');
    }
  };

  const handleRevokeAdmin = async (adminRec: FirestoreAdminRecord) => {
    if (!user || adminRec.uid === user.uid) return;
    setUsersError(null);
    setUsersFeedback(null);
    try {
      await revokeAdminAccess(adminRec.uid);
      onLogAudit(
        'ADMIN_REVOKE_ALLOWLIST',
        'admin',
        adminRec.uid,
        `Revoked /admins allowlist entry for ${adminRec.email}.`
      );
      setUsersFeedback(`Revoked admin allowlist entry for ${adminRec.email}.`);
      await loadDirectoryData();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to revoke admin entry.');
    }
  };

  const handleRunLiveFirestoreCheck = async () => {
    setFsChecking(true);
    const ok = await testFirestoreConnection();
    setLiveFsCheck({
      checkedAt: new Date().toISOString(),
      connected: ok,
    });
    setFsChecking(false);
    onLogAudit(
      'CHECK_FIRESTORE_HEALTH',
      'database',
      'firestore',
      ok ? 'Verified live Firestore server connectivity.' : 'Firestore reported offline state.'
    );
  };

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
    onLogAudit('EXPORT_BACKUP', 'workspace', 'json', 'Exported full workspace JSON snapshot.');
  };

  const fsLiveStatus = liveFsCheck
    ? liveFsCheck.connected
    : liveHealthOverride?.hasProbe
      ? liveHealthOverride.firestoreOk
      : firestoreConnected;

  const handleMonitorHealthUpdate = useCallback(
    (payload: HealthEndpointPayload | null, fsOk: boolean) => {
      setLiveHealthOverride({
        hasProbe: true,
        payload,
        firestoreOk: fsOk,
      });
    },
    []
  );

  return (
    <div className="space-y-6 min-w-0">
      <div className="space-y-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 break-words">
            {isAr
              ? '14. مركز التحكم الإداري وحوكمة النظام'
              : '14. Admin Control Center & System Governance'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 break-words">
            {isAr
              ? 'فصل الصلاحيات (RBAC)، وإدارة حسابات المستخدمين، وتشخيص قواعد البيانات المتعددة، وحالة النشر المباشر.'
              : 'Separation of responsibility (RBAC), user access administration, multi-store database diagnostics, and live deployment status.'}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Admin and governance sections"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-full"
        >
          {(
            [
              ['system', isAr ? 'النظام والمسؤوليات' : 'System & Responsibility'],
              ['users', isAr ? 'المستخدمون والأدوار' : 'Users & Roles'],
              ['database', isAr ? 'مدير قواعد البيانات' : 'Database Manager'],
              ['deployment', isAr ? 'حالة النشر' : 'Deployment Status'],
              ['audit', isAr ? 'التدقيق والتوثيق' : 'Audit & Docs'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={section === id}
              onClick={() => setSection(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                section === id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Runtime Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">IndexedDB Corpus Layers</p>
          <p className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {dbSummary.totalSamples} samples · {dbSummary.totalDatasets} datasets
          </p>
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400 tabular-nums">
            raw {dbSummary.rawCount} · proc {dbSummary.processedCount} · appr {dbSummary.approvedCount}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">Firestore Persistence</p>
          <p className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
            {fsLiveStatus === null
              ? 'Checking...'
              : fsLiveStatus
                ? 'Connected (RBAC Active)'
                : 'Offline / IndexedDB Fallback'}
          </p>
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate">
            {systemStatus?.firebase.projectId || 'gen-lang-client-0224046879'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">Server &amp; Cloud SQL</p>
          <p className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
            {systemStatus?.ok
              ? 'Express Runtime Online'
              : statusError
                ? 'Static Client Mode'
                : liveHealthOverride?.hasProbe
                  ? liveHealthOverride.payload?.ok
                    ? 'Express Runtime Online'
                    : 'Static Client Mode'
                  : serverHealth?.ok
                    ? 'Express Runtime Online'
                    : 'Static Client Mode'}
          </p>
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
            SQL:{' '}
            {systemStatus?.sql.available ||
            liveHealthOverride?.payload?.sqlConfigured ||
            (!statusError && !liveHealthOverride?.hasProbe && serverHealth?.sqlConfigured)
              ? 'Connected'
              : 'Hybrid Fallback'}{' '}
            · Gemini:{' '}
            {systemStatus?.geminiConfigured ||
            liveHealthOverride?.payload?.geminiConfigured ||
            (!statusError && !liveHealthOverride?.hasProbe && serverHealth?.geminiConfigured)
              ? 'Ready'
              : 'Standby'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">Active Auth &amp; Role</p>
          <p className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100 truncate">
            {user ? (isAdmin ? 'Admin Session' : 'Researcher Session') : 'Local Researcher (Signed Out)'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
            {user?.email || 'Local browser workspace'}
          </p>
        </div>
      </div>

      {/* Real-Time /api/health & Firebase Connectivity Monitor */}
      <GovernanceStatusMonitor
        initialFirestoreConnected={firestoreConnected}
        onHealthUpdate={handleMonitorHealthUpdate}
      />

      {/* SECTION 1: SYSTEM & RESPONSIBILITY MATRIX */}
      {section === 'system' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  System Responsibility &amp; Role Separation Matrix
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                RBAC: Firestore /admins Allowlist
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[680px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-4 font-medium">Domain</th>
                    <th className="py-2 pr-4 font-medium">Responsibility Scope</th>
                    <th className="py-2 pr-4 font-medium">Researcher</th>
                    <th className="py-2 pr-4 font-medium">Reviewer</th>
                    <th className="py-2 pr-4 font-medium">Admin</th>
                    <th className="py-2 font-medium">Enforcement Layer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {SYSTEM_RESPONSIBILITY_MATRIX.map((row) => (
                    <tr key={row.domain}>
                      <td className="py-2.5 pr-4 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {row.domain}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">
                        {row.capability}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-400">
                        {row.researcher}
                      </td>
                      <td className="py-2.5 pr-4 text-sky-700 dark:text-sky-400">
                        {row.reviewer}
                      </td>
                      <td className="py-2.5 pr-4 font-medium text-emerald-700 dark:text-emerald-400">
                        {row.admin}
                      </td>
                      <td className="py-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {row.enforcementLayer}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Privacy, Consent &amp; Workspace Maintenance Controls
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
                  Enforce pseudonymous author identifiers (<span className="font-mono">author_pseudo_id</span>) across stylometric fingerprint displays.
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
                  Mark <span className="font-mono">is_synthetic_demo: true</span> explicitly in every report and exclude demo counts from 3,000-sample targets.
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
        </div>
      )}

      {/* SECTION 2: USERS & RBAC ADMINISTRATION */}
      {section === 'users' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    User Directory &amp; Role Administration
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Firestore RBAC enforced by <span className="font-mono">firestore.rules</span> (<span className="font-mono">isAdmin()</span> &amp; privilege-escalation locks).
                  </p>
                </div>
              </div>

              {user && isAdmin && (
                <button
                  type="button"
                  onClick={() => void loadDirectoryData()}
                  disabled={usersLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh Directory</span>
                </button>
              )}
            </div>

            {!user ? (
              <div className="p-5 rounded-md border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Admin Authentication Required to Manage Firestore Users
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Sign in with an authorized Google administrator account listed in <span className="font-mono">/admins</span> to view user profiles, assign <span className="font-mono">researcher / reviewer / admin</span> roles, or suspend accounts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="px-4 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 whitespace-nowrap shrink-0"
                >
                  Sign in with Google
                </button>
              </div>
            ) : adminCheckLoading ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Verifying admin authorization...</p>
            ) : !isAdmin ? (
              <div className="p-4 rounded-md border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 flex items-start gap-3 text-xs">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Standard Researcher Access ({user.email})
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">
                    Your UID (<span className="font-mono">{user.uid}</span>) does not currently hold admin privileges in <span className="font-mono">/admins</span>. Only administrators can list user profiles or reassign roles across accounts.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {usersError && (
                  <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                    {usersError}
                  </p>
                )}
                {usersFeedback && (
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {usersFeedback}
                  </p>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[640px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                        <th className="py-2 pr-4 font-medium">User &amp; UID</th>
                        <th className="py-2 pr-4 font-medium">Role</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Updated</th>
                        <th className="py-2 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {usersList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-500 dark:text-slate-400">
                            {usersLoading ? 'Loading Firestore user profiles...' : 'No user documents recorded yet.'}
                          </td>
                        </tr>
                      ) : (
                        usersList.map((u) => {
                          const draft = userDrafts[u.uid] ?? {
                            role: u.role ?? 'researcher',
                            status: u.status ?? 'active',
                          };
                          return (
                            <tr key={u.uid}>
                              <td className="py-2.5 pr-4">
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                  {u.displayName || 'Researcher'}
                                </p>
                                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                  {u.email} · {u.uid}
                                </p>
                              </td>
                              <td className="py-2.5 pr-4">
                                <select
                                  aria-label={`Role for ${u.email}`}
                                  value={draft.role}
                                  onChange={(e) =>
                                    setUserDrafts((prev) => ({
                                      ...prev,
                                      [u.uid]: {
                                        ...draft,
                                        role: e.target.value as SystemRole,
                                      },
                                    }))
                                  }
                                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                                >
                                  <option value="researcher">researcher</option>
                                  <option value="reviewer">reviewer</option>
                                  <option value="admin">admin</option>
                                </select>
                              </td>
                              <td className="py-2.5 pr-4">
                                <select
                                  aria-label={`Status for ${u.email}`}
                                  value={draft.status}
                                  onChange={(e) =>
                                    setUserDrafts((prev) => ({
                                      ...prev,
                                      [u.uid]: {
                                        ...draft,
                                        status: e.target.value as AccountStatus,
                                      },
                                    }))
                                  }
                                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                                >
                                  <option value="active">active</option>
                                  <option value="suspended">suspended</option>
                                </select>
                              </td>
                              <td className="py-2.5 pr-4 font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                {u.updatedAtIso ? u.updatedAtIso.slice(0, 10) : '—'}
                              </td>
                              <td className="py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => void handleSaveUserRole(u)}
                                  className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                  Save Role
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* /admins Allowlist Manager */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Admin Allowlist (<span className="font-mono">/admins</span>)
                  </h3>

                  <form onSubmit={handleGrantAdminSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newAdminUid}
                      onChange={(e) => setNewAdminUid(e.target.value)}
                      placeholder="Firebase User UID"
                      aria-label="Target Firebase User UID"
                      className="px-3 py-1.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                    <input
                      type="email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="admin@institution.edu"
                      aria-label="Target Admin Email"
                      className="px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700"
                    >
                      Grant Admin Access
                    </button>
                  </form>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                          <th className="py-1.5 pr-3 font-medium">Admin Email</th>
                          <th className="py-1.5 pr-3 font-medium">UID</th>
                          <th className="py-1.5 pr-3 font-medium">Granted By</th>
                          <th className="py-1.5 text-right font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {adminsList.map((a) => (
                          <tr key={a.uid}>
                            <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">
                              {a.email}
                            </td>
                            <td className="py-2 pr-3 font-mono text-slate-500 dark:text-slate-400">
                              {a.uid}
                            </td>
                            <td className="py-2 pr-3 font-mono text-slate-500 dark:text-slate-400">
                              {a.grantedBy || 'bootstrap'}
                            </td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                disabled={a.uid === user.uid}
                                onClick={() => void handleRevokeAdmin(a)}
                                className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-40 disabled:no-underline"
                              >
                                {a.uid === user.uid ? 'Current Session' : 'Revoke'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: DATABASE MANAGER */}
      {section === 'database' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Browser IndexedDB Store
                </h2>
              </div>
              <p className="text-xs font-mono text-slate-700 dark:text-slate-300">
                DB: textprint_research_lab_v1
              </p>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 font-mono tabular-nums">
                <p>RAW layer: {dbSummary.rawCount}</p>
                <p>PROCESSED layer: {dbSummary.processedCount}</p>
                <p>APPROVED layer: {dbSummary.approvedCount}</p>
                <p>Verified: {dbSummary.verifiedCount} · Quarantined: {dbSummary.quarantinedCount}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Cloud Firestore
                </h2>
                <button
                  type="button"
                  onClick={() => void handleRunLiveFirestoreCheck()}
                  disabled={fsChecking}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {fsChecking ? 'Checking...' : 'Run Live Check'}
                </button>
              </div>
              <p className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all">
                Database ID: {systemStatus?.firebase.firestoreDatabaseId || 'ai-studio-117e863f-2c6a-4a15-9406-a16d0c3a8602'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Status:{' '}
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {fsLiveStatus === null ? 'Pending' : fsLiveStatus ? 'Online' : 'Offline Fallback'}
                </span>
                {liveFsCheck && ` (${liveFsCheck.checkedAt.slice(11, 19)} UTC)`}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Cloud SQL PostgreSQL Probe
              </h2>
              <p className="text-xs font-mono text-slate-700 dark:text-slate-300">
                Status: {systemStatus?.sql.available ? 'Socket Connected' : 'Hybrid Store Active'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Socket env configured: {systemStatus?.sql.socketPathConfigured ? 'Yes (SQL_HOST)' : 'No (local dev / static)'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                When Cloud Run SQL Unix sockets are absent, mutations safely persist in IndexedDB + Firestore without blocking workflows.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Registered Corpus Datasets ({datasets.length})
              </h2>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                {dbSummary.researchDatasets} research · {dbSummary.demoDatasets} synthetic demo
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-4 font-medium">Dataset Key</th>
                    <th className="py-2 pr-4 font-medium">Layer</th>
                    <th className="py-2 pr-4 font-medium">Version</th>
                    <th className="py-2 pr-4 font-medium">License</th>
                    <th className="py-2 pr-4 font-medium text-right">Samples</th>
                    <th className="py-2 font-medium">Source Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {datasets.map((ds) => {
                    const count = samples.filter((s) => s.dataset_key === ds.dataset_key).length;
                    return (
                      <tr key={ds.dataset_key}>
                        <td className="py-2 pr-4">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{ds.name}</p>
                          <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {ds.dataset_key}
                          </p>
                        </td>
                        <td className="py-2 pr-4 font-mono uppercase text-slate-700 dark:text-slate-300">
                          {ds.layer}
                        </td>
                        <td className="py-2 pr-4 font-mono text-slate-600 dark:text-slate-400">
                          {ds.version}
                        </td>
                        <td className="py-2 pr-4 text-slate-600 dark:text-slate-400">{ds.license}</td>
                        <td className="py-2 pr-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                          {count}
                        </td>
                        <td className="py-2 font-mono text-slate-500 dark:text-slate-400">
                          {ds.source_type}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: DEPLOYMENT STATUS */}
      {section === 'deployment' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Live Runtime &amp; Deployment Target Diagnostics
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Direct inspection from <span className="font-mono">GET /api/system/status</span>, build output, Firebase config, and CI/CD pipelines.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void fetchSystemStatus()}
                disabled={statusLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${statusLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Deployment Status</span>
              </button>
            </div>

            {statusError && (
              <p className="text-xs text-amber-700 dark:text-amber-400">{statusError}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-1.5">
                <p className="text-slate-500 dark:text-slate-400">Node &amp; Server Process</p>
                <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {systemStatus ? `${systemStatus.nodeVersion} · ${systemStatus.deployment.mode}` : 'Static Browser Build'}
                </p>
                <p className="font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                  {systemStatus
                    ? `Port ${systemStatus.port} · Uptime ${systemStatus.uptimeSeconds}s · RSS ${systemStatus.memoryMb} MB`
                    : 'No Node Express runtime attached'}
                </p>
              </div>

              <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-1.5">
                <p className="text-slate-500 dark:text-slate-400">Production Bundle &amp; Firebase</p>
                <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  dist/index.html: {systemStatus?.deployment.distBuilt ? 'Built' : 'Not Built (Dev Vite)'}
                </p>
                <p className="font-mono text-slate-600 dark:text-slate-400 break-all">
                  Project: {systemStatus?.firebase.projectId || 'gen-lang-client-0224046879'}
                </p>
              </div>

              <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-1.5">
                <p className="text-slate-500 dark:text-slate-400">AI &amp; Hosting Configuration</p>
                <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  firebase.json: {systemStatus?.deployment.firebaseJsonPresent ? 'Present' : 'Checked locally'}
                </p>
                <p className="font-mono text-slate-600 dark:text-slate-400">
                  firestore.rules: {systemStatus?.deployment.firestoreRulesPresent ? 'Present' : 'Checked locally'} · Gemini:{' '}
                  {systemStatus?.geminiConfigured ? 'Configured' : 'Standby'}
                </p>
              </div>
            </div>

            {systemStatus?.deployment.workflows && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="py-1.5 pr-4 font-medium">Automation Pipeline / Workflow</th>
                      <th className="py-1.5 font-medium">Repository Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {systemStatus.deployment.workflows.map((wf) => (
                      <tr key={wf.path}>
                        <td className="py-2 pr-4 font-mono text-slate-800 dark:text-slate-200">
                          {wf.path}
                        </td>
                        <td className="py-2 font-mono">
                          <span
                            className={
                              wf.exists
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }
                          >
                            {wf.exists ? 'Ready' : 'Missing'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 5: AUDIT LOG & ARCHITECTURE DOCS */}
      {section === 'audit' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Governance &amp; Provenance Audit Log ({filteredAudits.length})
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={auditQuery}
                  onChange={(e) => setAuditQuery(e.target.value)}
                  placeholder="Search actor, target, or details..."
                  aria-label="Filter audit logs"
                  className="px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <select
                  aria-label="Filter by audit action"
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {distinctAuditActions.map((act) => (
                    <option key={act} value={act}>
                      {act}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="max-h-72 overflow-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[540px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-1.5 pr-3 font-medium">Action</th>
                    <th className="py-1.5 pr-3 font-medium">Actor</th>
                    <th className="py-1.5 pr-3 font-medium">Target</th>
                    <th className="py-1.5 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAudits.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500 dark:text-slate-400">
                        No audit events match the current search or action filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAudits.map((ev) => (
                      <tr key={ev.id}>
                        <td className="py-2 pr-3 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {ev.action}
                        </td>
                        <td className="py-2 pr-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {ev.actor}
                        </td>
                        <td className="py-2 pr-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {ev.target_id}
                        </td>
                        <td className="py-2 text-slate-700 dark:text-slate-300">{ev.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Architecture, Data Lifecycle &amp; CI/CD Specifications
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
                  <strong>Pure Analytical Engines (<span className="font-mono">src/engine/*</span>):</strong> Zero DOM or network dependencies. Linguistic extraction, probabilistic classification, comparative diffing, quality validation, training splits, admin governance matrices, and D3 knowledge graph synthesis execute deterministically in TypeScript.
                </p>
                <p>
                  <strong>Decoupled Storage &amp; AI Services:</strong> Browser IndexedDB (<span className="font-mono">raw_samples</span>, <span className="font-mono">processed_samples</span>, <span className="font-mono">approved_samples</span>) enables offline GitHub Pages operation, while optional Express proxy routes (<span className="font-mono">/api/ai/*</span>, <span className="font-mono">/api/db/*</span>, <span className="font-mono">/api/system/status</span>) and Firebase Firestore + Google Drive handle server-side Gemini inference and multi-device sync without exposing API credentials.
                </p>
              </div>
            )}

            {docTab === 'data' && (
              <div className="text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
                <p>
                  <strong>Three-Stage Lifecycle:</strong> Samples progress strictly through <span className="font-mono">RAW</span> (original encoding &amp; hash), <span className="font-mono">PROCESSED</span> (Unicode NFC normalization, Arabic diacritic/letter canonicalization, 6-category metrics), and <span className="font-mono">APPROVED</span> (provenance verified, duplicate/contamination cleared).
                </p>
                <p>
                  <strong>Contamination Controls:</strong> Exact 64-bit normalized content hashes plus 3-gram Jaccard shingle overlap (&ge;82%) prevent cross-split leakage and flag near-duplicates across batch CSV drops.
                </p>
              </div>
            )}

            {docTab === 'workflows' && (
              <div className="text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
                <p>
                  <strong>CI Validation (<span className="font-mono">.github/workflows/ci-validate.yml</span>):</strong> Runs TypeScript checks, pure engine &amp; security rule unit tests (<span className="font-mono">npm test</span>), and production Vite bundle verification.
                </p>
                <p>
                  <strong>Firebase Hosting Dev Channel (<span className="font-mono">.github/workflows/deploy-firebase-dev.yml</span>):</strong> Builds static <span className="font-mono">dist/</span> artifacts and deploys to the <span className="font-mono">dev</span> preview channel on project <span className="font-mono">gen-lang-client-0224046879</span>.
                </p>
                <p>
                  <strong>GitHub Pages Deployment (<span className="font-mono">.github/workflows/deploy-pages.yml</span>):</strong> Builds static <span className="font-mono">dist/</span> artifacts and deploys cleanly to GitHub Pages with full client-side IndexedDB support.
                </p>
              </div>
            )}

            {docTab === 'deployment' && (
              <div className="text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
                <p>
                  <strong>Cloud Run Server Mode:</strong> Runs <span className="font-mono">node server.ts</span> directly on Node v22 with <span className="font-mono">dist/</span> static assets, <span className="font-mono">/api/system/status</span>, <span className="font-mono">/api/ai/*</span>, and optional Cloud SQL Unix socket persistence.
                </p>
                <p>
                  <strong>Firebase Hosting Dev Channel:</strong> Deploy <span className="font-mono">dist/</span> via <span className="font-mono">npx firebase-tools hosting:channel:deploy dev --project gen-lang-client-0224046879</span>; Firestore rules deploy from <span className="font-mono">firestore.rules</span> to database <span className="font-mono">ai-studio-117e863f-2c6a-4a15-9406-a16d0c3a8602</span>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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
