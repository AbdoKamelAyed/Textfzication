import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  computeExecutiveAdminSnapshot,
  formatFirebaseAuthErrorMessage,
} from '../engine/adminDashboard';
import type { AccountStatus, SystemRole } from '../engine/adminGovernance';
import type {
  AuditEvent,
  CollectionJob,
  DatasetRecord,
  ExperimentRecord,
  StorageLayer,
  TextSample,
  ValidationStatus,
  WritingPattern,
} from '../engine/types';
import { getConfiguredApiBaseUrl, setConfiguredApiBaseUrl } from '../lib/apiBase';
import {
  getFreshIdToken,
  grantAdminAccess,
  listFirestoreAdmins,
  listFirestoreUsers,
  revokeAdminAccess,
  updateUserRoleAndStatus,
  type FirestoreAdminRecord,
  type FirestoreUserRecord,
} from '../lib/firebase';
import { useI18n } from '../lib/i18nContext';
import { safeFetchJson } from '../lib/safeFetchJson';
import type { ModuleId } from './ResearchDashboard';

interface AdminStatusPayload {
  ok: boolean;
  envPasscodeActive: boolean;
  claimedPasscodeActive: boolean;
  needsFirstRunSetup: boolean;
  claimedAtIso: string | null;
}

interface AdminLoginPayload {
  ok: boolean;
  token: string;
  expiresAt: string;
  role: 'admin';
  authMethod: 'server-passcode';
  error?: string;
}

interface AdminOverviewPayload {
  ok: boolean;
  subject: string;
  authMethod: string;
  nodeVersion: string;
  environment: string;
  uptimeSeconds: number;
  memoryMb: number;
  geminiConfigured: boolean;
  sqlConfigured: boolean;
  timestamp: string;
}

interface Props {
  user: User | null;
  isFirebaseAdmin: boolean;
  authError: string | null;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
  serverAdminToken: string | null;
  serverAdminMeta: { subject: string; expiresAt: string } | null;
  onServerAdminLoginSuccess: (token: string, subject: string, expiresAt: string) => void;
  onServerAdminLogout: () => void;
  datasets: DatasetRecord[];
  samples: TextSample[];
  patterns: WritingPattern[];
  experiments: ExperimentRecord[];
  jobs: CollectionJob[];
  auditLogs: AuditEvent[];
  onValidateSample: (
    sampleId: string,
    status: ValidationStatus,
    layer: StorageLayer,
    note: string
  ) => void;
  onNavigate: (module: ModuleId) => void;
  onLogAudit: (action: string, targetType: string, targetId: string, details: string) => void;
}

export function AdminDashboardView({
  user,
  isFirebaseAdmin,
  authError,
  onSignInGoogle,
  onSignOutGoogle,
  serverAdminToken,
  serverAdminMeta,
  onServerAdminLoginSuccess,
  onServerAdminLogout,
  datasets,
  samples,
  patterns,
  experiments,
  jobs,
  auditLogs,
  onValidateSample,
  onNavigate,
  onLogAudit,
}: Props) {
  const { lang, t } = useI18n();
  const isAr = lang === 'ar';

  const isAuthenticatedAdmin = isFirebaseAdmin || Boolean(serverAdminToken);

  // Express admin auth state
  const [adminStatus, setAdminStatus] = useState<AdminStatusPayload | null>(null);
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);
  const [checkingBackend, setCheckingBackend] = useState(false);

  const [labelInput, setLabelInput] = useState('Primary Admin');
  const [passcodeInput, setPasscodeInput] = useState('');
  const [confirmPasscodeInput, setConfirmPasscodeInput] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Cloud Run URL quick connector
  const [backendUrlInput, setBackendUrlInput] = useState(() => getConfiguredApiBaseUrl());
  const [copiedHost, setCopiedHost] = useState(false);

  // Admin Dashboard active section
  const [activeTab, setActiveTab] = useState<'moderation' | 'directory' | 'runtime'>('moderation');

  // Protected /api/admin/overview state
  const [overview, setOverview] = useState<AdminOverviewPayload | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Firestore RBAC state
  const [usersList, setUsersList] = useState<FirestoreUserRecord[]>([]);
  const [adminsList, setAdminsList] = useState<FirestoreAdminRecord[]>([]);
  const [userDrafts, setUserDrafts] = useState<
    Record<string, { role: SystemRole; status: AccountStatus }>
  >({});
  const [dirLoading, setDirLoading] = useState(false);
  const [dirError, setDirError] = useState<string | null>(null);
  const [dirFeedback, setDirFeedback] = useState<string | null>(null);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const currentHostname =
    typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost';

  const authGuidance = useMemo(
    () =>
      authError
        ? formatFirebaseAuthErrorMessage(authError, currentHostname, lang)
        : null,
    [authError, currentHostname, lang]
  );

  const snapshot = useMemo(
    () =>
      computeExecutiveAdminSnapshot({
        datasets,
        samples,
        patterns,
        experiments,
        jobs,
        auditLogs,
      }),
    [datasets, samples, patterns, experiments, jobs, auditLogs]
  );

  const probeAdminBackend = useCallback(async () => {
    setCheckingBackend(true);
    const res = await safeFetchJson<AdminStatusPayload>('/api/admin/status');
    if (res.ok && res.data) {
      setBackendReachable(true);
      setAdminStatus(res.data);
    } else {
      setBackendReachable(false);
      setAdminStatus(null);
    }
    setCheckingBackend(false);
  }, []);

  useEffect(() => {
    void probeAdminBackend();
  }, [probeAdminBackend]);

  const fetchServerAdminOverview = useCallback(async () => {
    const bearer = serverAdminToken || (isFirebaseAdmin ? await getFreshIdToken() : null);
    if (!bearer) return;
    setOverviewLoading(true);
    const res = await safeFetchJson<AdminOverviewPayload>('/api/admin/overview', {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (res.ok && res.data) {
      setOverview(res.data);
    }
    setOverviewLoading(false);
  }, [serverAdminToken, isFirebaseAdmin]);

  const loadDirectory = useCallback(async () => {
    if (!isFirebaseAdmin) return;
    setDirLoading(true);
    setDirError(null);
    try {
      const [uList, aList] = await Promise.all([listFirestoreUsers(), listFirestoreAdmins()]);
      setUsersList(uList);
      setAdminsList(aList);
      const drafts: Record<string, { role: SystemRole; status: AccountStatus }> = {};
      for (const u of uList) {
        drafts[u.uid] = { role: u.role ?? 'researcher', status: u.status ?? 'active' };
      }
      setUserDrafts(drafts);
    } catch (err) {
      setDirError(err instanceof Error ? err.message : 'Failed to load Firestore directory.');
    } finally {
      setDirLoading(false);
    }
  }, [isFirebaseAdmin]);

  useEffect(() => {
    if (isAuthenticatedAdmin) {
      void fetchServerAdminOverview();
      if (isFirebaseAdmin) {
        void loadDirectory();
      }
    }
  }, [isAuthenticatedAdmin, isFirebaseAdmin, fetchServerAdminOverview, loadDirectory]);

  const handleCopyHostname = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentHostname).catch(() => {});
      setCopiedHost(true);
      window.setTimeout(() => setCopiedHost(false), 1800);
    }
  };

  const handleSaveBackendUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfiguredApiBaseUrl(backendUrlInput);
    await probeAdminBackend();
  };

  const handlePasscodeAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const isClaim = Boolean(adminStatus?.needsFirstRunSetup);
    if (passcodeInput.trim().length < (isClaim ? 8 : 1)) {
      setLoginError(
        t({
          en: isClaim
            ? 'Please choose an admin passcode of at least 8 characters.'
            : 'Please enter your server admin passcode.',
          ar: isClaim
            ? 'يرجى اختيار كلمة مرور للمشرف لا تقل عن 8 أحرف.'
            : 'يرجى إدخال كلمة مرور المشرف الخاصة بالخادم.',
        })
      );
      return;
    }

    if (isClaim && passcodeInput !== confirmPasscodeInput) {
      setLoginError(
        t({
          en: 'Passcodes do not match.',
          ar: 'كلمتا المرور غير متطابقتين.',
        })
      );
      return;
    }

    setLoginBusy(true);
    const endpoint = isClaim ? '/api/admin/claim' : '/api/admin/login';
    const res = await safeFetchJson<AdminLoginPayload>(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passcode: passcodeInput,
        label: labelInput.trim() || 'Primary Admin',
      }),
    });
    setLoginBusy(false);

    if (!res.ok || !res.data?.token) {
      setLoginError(
        res.error ||
          t({
            en: 'Admin authentication failed. Verify the passcode and try again.',
            ar: 'فشل التحقق من دخول المشرف. يرجى التأكد من كلمة المرور والمحاولة مجدداً.',
          })
      );
      return;
    }

    setPasscodeInput('');
    setConfirmPasscodeInput('');
    onServerAdminLoginSuccess(
      res.data.token,
      labelInput.trim() || 'Server Admin',
      res.data.expiresAt
    );
    onLogAudit(
      isClaim ? 'ADMIN_CLAIM_PASSCODE' : 'ADMIN_SERVER_LOGIN',
      'auth',
      'server-admin',
      `${isClaim ? 'Claimed initial admin credentials' : 'Authenticated server admin session'} (${labelInput.trim() || 'Server Admin'}).`
    );
    await probeAdminBackend();
  };

  const handleQuickModeration = (
    sample: TextSample,
    nextStatus: ValidationStatus,
    nextLayer: StorageLayer
  ) => {
    const note =
      nextStatus === 'verified'
        ? 'Approved via Special Admin Dashboard moderation queue.'
        : 'Quarantined via Special Admin Dashboard moderation queue.';
    onValidateSample(sample.sample_id, nextStatus, nextLayer, note);
  };

  const handleSaveUserRole = async (record: FirestoreUserRecord) => {
    if (!user) return;
    const draft = userDrafts[record.uid];
    if (!draft) return;
    setDirError(null);
    setDirFeedback(null);
    try {
      await updateUserRoleAndStatus(user, record.uid, record.email, draft.role, draft.status);
      onLogAudit(
        'ADMIN_UPDATE_ROLE',
        'user',
        record.uid,
        `Admin updated ${record.email} to role=${draft.role}, status=${draft.status}.`
      );
      setDirFeedback(`Updated ${record.email} (${draft.role} · ${draft.status}).`);
      await loadDirectory();
    } catch (err) {
      setDirError(err instanceof Error ? err.message : 'Failed to update user role.');
    }
  };

  const handleGrantAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newAdminUid.trim() || !newAdminEmail.trim()) {
      setDirError('Provide both Firebase UID and verified email address.');
      return;
    }
    setDirError(null);
    setDirFeedback(null);
    try {
      await grantAdminAccess(user, newAdminUid.trim(), newAdminEmail.trim());
      onLogAudit(
        'ADMIN_GRANT_ALLOWLIST',
        'admin',
        newAdminUid.trim(),
        `Granted /admins allowlist entry to ${newAdminEmail.trim()}.`
      );
      setDirFeedback(`Granted admin access to ${newAdminEmail.trim()}.`);
      setNewAdminUid('');
      setNewAdminEmail('');
      await loadDirectory();
    } catch (err) {
      setDirError(err instanceof Error ? err.message : 'Failed to grant admin allowlist.');
    }
  };

  const handleRevokeAdmin = async (adminRec: FirestoreAdminRecord) => {
    if (!user || adminRec.uid === user.uid) return;
    setDirError(null);
    setDirFeedback(null);
    try {
      await revokeAdminAccess(adminRec.uid);
      onLogAudit(
        'ADMIN_REVOKE_ALLOWLIST',
        'admin',
        adminRec.uid,
        `Revoked /admins allowlist entry for ${adminRec.email}.`
      );
      setDirFeedback(`Revoked admin allowlist for ${adminRec.email}.`);
      await loadDirectory();
    } catch (err) {
      setDirError(err instanceof Error ? err.message : 'Failed to revoke admin entry.');
    }
  };

  const handleFullAdminLogout = () => {
    if (serverAdminToken) {
      onServerAdminLogout();
      onLogAudit('ADMIN_SERVER_LOGOUT', 'auth', 'server-admin', 'Ended server admin session.');
    }
    if (user) {
      onSignOutGoogle();
    }
  };

  // ==================== ADMIN LOGIN GATE (UNAUTHENTICATED) ====================
  if (!isAuthenticatedAdmin) {
    return (
      <div className="space-y-6 min-w-0">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 sm:p-6 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-sky-700 dark:text-sky-400">
                <Shield className="w-4 h-4 shrink-0" />
                <span>
                  {t({
                    en: 'SPECIAL AUTHORIZED ACCESS ONLY',
                    ar: 'دخول خاص ومقيّد للمشرفين فقط',
                  })}
                </span>
              </div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 break-words">
                {t({
                  en: 'Special Administrator Login',
                  ar: 'بوابة الدخول الخاصة بالمشرف',
                })}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl break-words">
                {t({
                  en: 'Private executive portal (hidden from public navigation). Authenticate with an authorized administrator Google account or server admin passcode to unlock moderation, user RBAC, and runtime telemetry.',
                  ar: 'بوابة إدارية خاصة غير ظاهرة للعامة. سجّل الدخول بحساب المشرف المخوّل أو كلمة مرور الخادم لفتح لوحة التحكم التنفيذية وإدارة الصلاحيات.',
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            >
              {t({ en: 'Return to Lab', ar: 'العودة إلى المختبر' })}
            </button>
          </div>
        </div>

        {/* Auth Error or Unauthorized Domain Helper */}
        {authGuidance && (
          <div
            role="alert"
            className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg p-4 space-y-2.5 text-xs"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0 flex-1">
                <p className="font-semibold text-rose-900 dark:text-rose-200">
                  {authGuidance.title}
                </p>
                <p className="text-rose-800 dark:text-rose-300 break-words">
                  {authGuidance.message}
                </p>
              </div>
            </div>

            {authGuidance.isUnauthorizedDomain && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <code className="px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 font-mono text-rose-900 dark:text-rose-200">
                  {authGuidance.hostname}
                </code>
                <button
                  type="button"
                  onClick={handleCopyHostname}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-rose-800 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/50"
                >
                  {copiedHost ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedHost ? (isAr ? 'تم النسخ' : 'Copied') : isAr ? 'نسخ النطاق' : 'Copy Domain'}</span>
                </button>
                <a
                  href={authGuidance.consoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-700 text-white hover:bg-rose-800"
                >
                  <span>{isAr ? 'فتح إعدادات Firebase Console' : 'Open Firebase Authorized Domains'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Option 1: Firebase Google Admin Login */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4 min-w-0 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t({
                    en: 'Option 1 · Google Admin Sign-In (Firebase RBAC)',
                    ar: 'الخيار الأول · دخول المشرف عبر Google (Firebase RBAC)',
                  })}
                </h2>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-words">
                {t({
                  en: 'Verified Google accounts listed in the Firestore /admins allowlist automatically unlock full user management and executive dashboard controls.',
                  ar: 'حسابات Google الموثّقة والمدرجة في قائمة المشرفين المعتمدة تفتح لوحة المشرف الخاصة وإدارة أدوار المستخدمين تلقائياً.',
                })}
              </p>

              {user && !isFirebaseAdmin && (
                <div className="p-3 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-xs space-y-1">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    {t({
                      en: `Signed in as Researcher (${user.email})`,
                      ar: `تم تسجيل الدخول كباحث (${user.email})`,
                    })}
                  </p>
                  <p className="text-amber-800 dark:text-amber-300 font-mono text-[11px] break-all">
                    UID: {user.uid}
                  </p>
                  <p className="text-amber-800 dark:text-amber-300">
                    {t({
                      en: 'This account does not have admin privileges in /admins. Sign out and sign in with an authorized admin Google account.',
                      ar: 'هذا الحساب لا يملك صلاحية مشرف في ‎/admins. سجّل الخروج ثم ادخل بحساب مشرف مخوّل.',
                    })}
                  </p>
                </div>
              )}

              {/* Proactive note when on external static domain like GitHub Pages */}
              {!currentHostname.includes('localhost') &&
                !currentHostname.endsWith('.run.app') &&
                !currentHostname.endsWith('.web.app') &&
                !currentHostname.endsWith('.firebaseapp.com') && (
                  <div className="p-3 rounded-md border border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/20 text-xs space-y-1.5">
                    <p className="font-medium text-sky-900 dark:text-sky-200">
                      {t({
                        en: 'External Domain Checklist (GitHub Pages / Vercel)',
                        ar: 'تفعيل النطاق الخارجي في Firebase (GitHub Pages / Vercel)',
                      })}
                    </p>
                    <p className="text-sky-800 dark:text-sky-300 break-words">
                      {t({
                        en: `Ensure "${currentHostname}" is listed under Firebase Console -> Authentication -> Settings -> Authorized domains so Google Sign-In popup succeeds.`,
                        ar: `تأكد من إضافة النطاق "${currentHostname}" ضمن Authorized domains في إعدادات Firebase Authentication لكي يعمل تسجيل الدخول عبر Google بنجاح.`,
                      })}
                    </p>
                  </div>
                )}
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-2">
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={onSignOutGoogle}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t({ en: 'Switch Google Account', ar: 'تبديل حساب Google' })}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onSignInGoogle}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{t({ en: 'Sign in with Google Admin', ar: 'تسجيل دخول المشرف عبر Google' })}</span>
                </button>
              )}
            </div>
          </div>

          {/* Option 2: Express Server Passcode Admin Login / First-Run Setup */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t({
                    en: 'Option 2 · Express Server Admin Login',
                    ar: 'الخيار الثاني · دخول المشرف بكلمة مرور الخادم',
                  })}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => void probeAdminBackend()}
                disabled={checkingBackend}
                aria-label="Refresh server auth status"
                className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingBackend ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {backendReachable === false ? (
              <div className="space-y-3">
                <div className="p-3 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/20 text-xs space-y-1">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    {t({
                      en: 'Static Hosting Mode (Express Backend Not Attached)',
                      ar: 'وضع الاستضافة الساكنة (خادم Express غير متصل)',
                    })}
                  </p>
                  <p className="text-amber-800 dark:text-amber-300 break-words">
                    {t({
                      en: 'Passcode verification is performed strictly on the Express server. Connect your Cloud Run Express URL below or use Option 1 (Google Admin Sign-In).',
                      ar: 'التحقق من كلمة المرور يتم حصرياً على الخادم الآمن. أدخل رابط خادم Cloud Run بالأسفل أو استخدم الخيار الأول (دخول Google).',
                    })}
                  </p>
                </div>

                <form onSubmit={handleSaveBackendUrl} className="space-y-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t({
                      en: 'Attach Express / Cloud Run Backend URL',
                      ar: 'ربط رابط خادم Express / Cloud Run',
                    })}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={backendUrlInput}
                      onChange={(e) => setBackendUrlInput(e.target.value)}
                      placeholder="https://your-service.run.app"
                      className="flex-1 min-w-0 px-3 py-1.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 shrink-0"
                    >
                      {t({ en: 'Connect', ar: 'اتصال' })}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <form onSubmit={handlePasscodeAuthSubmit} className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-400 break-words">
                  {adminStatus?.needsFirstRunSetup
                    ? t({
                        en: 'No ADMIN_PASSCODE secret is set yet. Complete this one-time first-run admin setup to hash and lock your server admin passcode.',
                        ar: 'لم يتم تعيين كلمة مرور ADMIN_PASSCODE بعد. أنشئ كلمة مرور المشرف الأولية الآن لتشفيرها وحفظها على الخادم.',
                      })
                    : t({
                        en: 'Enter the server administrator passcode (verified on Express via salted scrypt + signed Bearer session in memory).',
                        ar: 'أدخل كلمة مرور مشرف الخادم (يتم التحقق منها بأمان على الخادم وإصدار جلسة مشفرة بالذاكرة فقط).',
                      })}
                </p>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t({ en: 'Admin Label', ar: 'اسم المشرف' })}
                  </label>
                  <input
                    type="text"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    placeholder="Primary Admin"
                    className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {adminStatus?.needsFirstRunSetup
                      ? t({ en: 'Create Admin Passcode (min 8 chars)', ar: 'إنشاء كلمة مرور المشرف (8 أحرف فأكثر)' })
                      : t({ en: 'Admin Passcode', ar: 'كلمة مرور المشرف' })}
                  </label>
                  <input
                    type="password"
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete={adminStatus?.needsFirstRunSetup ? 'new-password' : 'current-password'}
                    className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>

                {adminStatus?.needsFirstRunSetup && (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      {t({ en: 'Confirm Admin Passcode', ar: 'تأكيد كلمة مرور المشرف' })}
                    </label>
                    <input
                      type="password"
                      value={confirmPasscodeInput}
                      onChange={(e) => setConfirmPasscodeInput(e.target.value)}
                      placeholder="••••••••••••"
                      autoComplete="new-password"
                      className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}

                {loginError && (
                  <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400 break-words">
                    {loginError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loginBusy || backendReachable === null}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>
                    {loginBusy
                      ? t({ en: 'Verifying...', ar: 'جارٍ التحقق...' })
                      : adminStatus?.needsFirstRunSetup
                        ? t({ en: 'Claim Admin Access & Open Dashboard', ar: 'تعيين كلمة المرور وفتح لوحة المشرف' })
                        : t({ en: 'Unlock Special Admin Dashboard', ar: 'دخول لوحة المشرف الخاصة' })}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== SPECIAL EXECUTIVE ADMIN DASHBOARD (UNLOCKED) ====================
  return (
    <div className="space-y-6 min-w-0">
      {/* Executive Command Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 text-white border border-slate-800 rounded-lg p-5 sm:p-6 min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t({ en: 'ADMIN SESSION ACTIVE', ar: 'جلسة المشرف مفعّلة' })}</span>
              </span>
              {isFirebaseAdmin && (
                <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-sky-200 text-[11px] font-mono">
                  Google RBAC ({user?.email})
                </span>
              )}
              {serverAdminMeta && (
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 text-[11px] font-mono">
                  Server Passcode ({serverAdminMeta.subject})
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold break-words">
              {t({
                en: 'Special Executive Admin Dashboard',
                ar: 'لوحة التحكم التنفيذية الخاصة بالمشرف',
              })}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 break-words">
              {t({
                en: 'Centralized moderation queue, user RBAC role directory, database layer monitoring, and audit trail.',
                ar: 'إدارة مركزية لاعتماد العينات، ودليل صلاحيات المستخدمين RBAC، ومراقبة الخادم، وسجل المراجعة الأمني.',
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('governance')}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-700 bg-slate-800/80 text-slate-100 hover:bg-slate-800"
            >
              {t({ en: '14. Governance & Matrix', ar: '14. الحوكمة والمصفوفة' })}
            </button>
            <button
              type="button"
              onClick={handleFullAdminLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-rose-500/50 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t({ en: 'Sign Out Admin', ar: 'تسجيل خروج المشرف' })}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-1.5 min-w-0">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{t({ en: 'Corpus Verification Rate', ar: 'نسبة التحقق من المدونة' })}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <p className="text-2xl font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {snapshot.verificationRatePct}%
          </p>
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
            {snapshot.verifiedCount} {isAr ? 'موثق' : 'verified'} · {snapshot.pendingCount}{' '}
            {isAr ? 'معلق' : 'pending'} · {snapshot.quarantinedCount}{' '}
            {isAr ? 'معزول' : 'quarantined'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-1.5 min-w-0">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{t({ en: '3,000-Sample Target', ar: 'هدف الـ 3,000 عينة بحثية' })}</span>
            <Database className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          </div>
          <p className="text-2xl font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            <span dir="ltr" className="inline-block">
              {snapshot.researchSamples} / 3,000
            </span>
          </p>
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
            {snapshot.totalDatasets} {isAr ? 'مجموعات' : 'datasets'} · +{snapshot.syntheticDemoSamples}{' '}
            {isAr ? 'تجريبية' : 'demo'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-1.5 min-w-0">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{t({ en: 'Pipeline & Model Eval', ar: 'الخطوط والتجارب' })}</span>
            <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
          <p className="text-2xl font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            <span dir="ltr" className="inline-block">
              {snapshot.latestF1Score !== null ? `F1 ${snapshot.latestF1Score}%` : '—'}
            </span>
          </p>
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
            {snapshot.activeJobs} {isAr ? 'نشط' : 'active'} · {snapshot.completedJobs}{' '}
            {isAr ? 'مكتمل' : 'done'} · {snapshot.failedJobs} {isAr ? 'فاشل' : 'failed'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-1.5 min-w-0">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{t({ en: 'Moderation Backlog', ar: 'قائمة المراجعة والاعتماد' })}</span>
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          </div>
          <p className="text-2xl font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {snapshot.moderationQueue.length}
          </p>
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
            <span dir="ltr" className="inline-block">
              {snapshot.approvedPatterns}/{snapshot.totalPatterns}
            </span>{' '}
            {isAr ? 'أنماط معتمدة' : 'patterns approved'}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Special admin dashboard sections"
        className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full sm:w-fit max-w-full"
      >
        {(
          [
            ['moderation', t({ en: `Moderation Queue (${snapshot.moderationQueue.length})`, ar: `اعتماد العينات (${snapshot.moderationQueue.length})` })],
            ['directory', t({ en: 'Cloud Users & RBAC', ar: 'المستخدمون والصلاحيات' })],
            ['runtime', t({ en: 'Server Telemetry & Audit Log', ar: 'مراقبة الخادم وسجل التدقيق' })],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === id
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: MODERATION QUEUE */}
      {activeTab === 'moderation' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t({
                  en: 'Pending & Quarantined Corpus Samples',
                  ar: 'العينات المعلقة أو المعزولة بانتظار قرار المشرف',
                })}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t({
                  en: 'Verify clean samples into the approved training layer or quarantine problematic texts with one click.',
                  ar: 'اعتماد العينات السليمة ونقلها إلى الطبقة المعتمدة أو عزلها بضغطة واحدة.',
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('datasets')}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t({ en: 'Open Full 03. Dataset Manager', ar: 'فتح 03. إدارة المدونات الكاملة' })}
            </button>
          </div>

          {snapshot.moderationQueue.length === 0 ? (
            <div className="p-6 text-center rounded-md border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              {t({
                en: 'All corpus samples are verified! Zero pending or quarantined items remain.',
                ar: 'جميع العينات في المدونة موثّقة ومعتمدة حالياً ولا توجد عناصر معلقة.',
              })}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {snapshot.moderationQueue.map((sample) => (
                <div
                  key={sample.sample_id}
                  className="py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {sample.sample_id}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-mono text-[11px]">
                        {sample.validation.status}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {sample.layer} · {sample.language.toUpperCase()} · {sample.origin.class}
                      </span>
                    </div>
                    <p
                      className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 break-words"
                      dir={sample.language === 'ar' ? 'rtl' : 'ltr'}
                    >
                      {sample.text}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleQuickModeration(sample, 'verified', 'approved')}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      {t({ en: 'Verify & Approve', ar: 'توثيق واعتماد' })}
                    </button>
                    {sample.validation.status !== 'quarantined' && (
                      <button
                        type="button"
                        onClick={() => handleQuickModeration(sample, 'quarantined', 'raw')}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        {t({ en: 'Quarantine', ar: 'عزل' })}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CLOUD USERS & RBAC DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t({ en: 'Firestore User & Admin RBAC Controls', ar: 'دليل المستخدمين وصلاحيات Firestore' })}
              </h2>
            </div>
            {isFirebaseAdmin && (
              <button
                type="button"
                onClick={() => void loadDirectory()}
                disabled={dirLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${dirLoading ? 'animate-spin' : ''}`} />
                <span>{t({ en: 'Refresh Directory', ar: 'تحديث القائمة' })}</span>
              </button>
            )}
          </div>

          {!isFirebaseAdmin ? (
            <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <p className="text-slate-700 dark:text-slate-300 break-words">
                {t({
                  en: 'You unlocked the dashboard with Server Passcode. To read or modify Firestore /users and /admins documents, also sign in with an authorized Google administrator account.',
                  ar: 'تم الدخول عبر كلمة مرور الخادم. لقراءة أو تعديل مستخدمي Firestore مباشرة، سجّل الدخول أيضاً بحساب Google المشرف المخوّل.',
                })}
              </p>
              <button
                type="button"
                onClick={onSignInGoogle}
                className="px-3.5 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 shrink-0"
              >
                {t({ en: 'Sign in with Google', ar: 'الدخول عبر Google' })}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {dirError && <p className="text-xs text-rose-600 dark:text-rose-400">{dirError}</p>}
              {dirFeedback && <p className="text-xs text-emerald-700 dark:text-emerald-400">{dirFeedback}</p>}

              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="py-2 pe-4 font-medium text-start">User &amp; UID</th>
                      <th className="py-2 pe-4 font-medium text-start">Role</th>
                      <th className="py-2 pe-4 font-medium text-start">Status</th>
                      <th className="py-2 text-end font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {usersList.map((u) => {
                      const draft = userDrafts[u.uid] ?? {
                        role: u.role ?? 'researcher',
                        status: u.status ?? 'active',
                      };
                      return (
                        <tr key={u.uid}>
                          <td className="py-2.5 pe-4">
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {u.displayName || 'Researcher'}
                            </p>
                            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              {u.email} · {u.uid}
                            </p>
                          </td>
                          <td className="py-2.5 pe-4">
                            <select
                              aria-label={`Admin dashboard role for ${u.email}`}
                              value={draft.role}
                              onChange={(e) =>
                                setUserDrafts((prev) => ({
                                  ...prev,
                                  [u.uid]: { ...draft, role: e.target.value as SystemRole },
                                }))
                              }
                              className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                            >
                              <option value="researcher">researcher</option>
                              <option value="reviewer">reviewer</option>
                              <option value="admin">admin</option>
                            </select>
                          </td>
                          <td className="py-2.5 pe-4">
                            <select
                              aria-label={`Admin dashboard status for ${u.email}`}
                              value={draft.status}
                              onChange={(e) =>
                                setUserDrafts((prev) => ({
                                  ...prev,
                                  [u.uid]: { ...draft, status: e.target.value as AccountStatus },
                                }))
                              }
                              className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                            >
                              <option value="active">active</option>
                              <option value="suspended">suspended</option>
                            </select>
                          </td>
                          <td className="py-2.5 text-end">
                            <button
                              type="button"
                              onClick={() => void handleSaveUserRole(u)}
                              className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              Save
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <form onSubmit={handleGrantAdminSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <input
                  type="text"
                  value={newAdminUid}
                  onChange={(e) => setNewAdminUid(e.target.value)}
                  placeholder="Firebase User UID"
                  className="px-3 py-1.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin@institution.edu"
                  className="px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700"
                >
                  Grant /admins Allowlist
                </button>
              </form>

              {adminsList.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {adminsList.map((a) => (
                    <div
                      key={a.uid}
                      className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs"
                    >
                      <span className="font-mono">{a.email}</span>
                      {user && a.uid !== user.uid && (
                        <button
                          type="button"
                          onClick={() => void handleRevokeAdmin(a)}
                          className="text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RUNTIME & SECURITY AUDIT LOG */}
      {activeTab === 'runtime' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t({ en: 'Protected Server Overview (/api/admin/overview)', ar: 'بيانات الخادم المحمية للمشرف' })}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => void fetchServerAdminOverview()}
                disabled={overviewLoading}
                className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${overviewLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {overview ? (
              <dl className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <dt className="text-slate-500">Auth Method</dt>
                  <dd className="text-slate-900 dark:text-slate-100 font-semibold mt-0.5">{overview.authMethod}</dd>
                </div>
                <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <dt className="text-slate-500">Node / Env</dt>
                  <dd className="text-slate-900 dark:text-slate-100 font-semibold mt-0.5">
                    {overview.nodeVersion} · {overview.environment}
                  </dd>
                </div>
                <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <dt className="text-slate-500">Uptime / RSS</dt>
                  <dd className="text-slate-900 dark:text-slate-100 font-semibold mt-0.5">
                    {overview.uptimeSeconds}s · {overview.memoryMb} MB
                  </dd>
                </div>
                <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <dt className="text-slate-500">Gemini / Cloud SQL</dt>
                  <dd className="text-slate-900 dark:text-slate-100 font-semibold mt-0.5">
                    {overview.geminiConfigured ? 'Ready' : 'Unset'} /{' '}
                    {overview.sqlConfigured ? 'Connected' : 'Fallback'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t({
                  en: 'Express backend telemetry is unavailable in standalone static hosting mode.',
                  ar: 'بيانات الخادم غير متاحة في وضع الاستضافة الساكنة المنفردة.',
                })}
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3 min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t({ en: 'Recent Security & Governance Events', ar: 'أحدث أحداث الأمان والحوكمة' })}
            </h2>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto text-xs">
              {snapshot.recentSecurityEvents.map((ev) => (
                <li key={ev.id} className="py-2 space-y-0.5">
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                    <span className="font-semibold text-sky-700 dark:text-sky-400">{ev.action}</span>
                    <span className="text-slate-400">{ev.timestamp.slice(11, 19)}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 break-words">{ev.details}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
