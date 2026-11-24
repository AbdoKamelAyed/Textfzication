import type { Language } from './i18n';
import type {
  AuditEvent,
  CollectionJob,
  DatasetRecord,
  ExperimentRecord,
  TextSample,
  WritingPattern,
} from './types';

export interface ExecutiveAdminSnapshot {
  totalSamples: number;
  researchSamples: number;
  syntheticDemoSamples: number;
  verifiedCount: number;
  pendingCount: number;
  quarantinedCount: number;
  rejectedCount: number;
  verificationRatePct: number;
  researchProgressPct: number;
  totalDatasets: number;
  approvedPatterns: number;
  totalPatterns: number;
  experimentCount: number;
  latestF1Score: number | null;
  activeJobs: number;
  failedJobs: number;
  completedJobs: number;
  moderationQueue: TextSample[];
  recentSecurityEvents: AuditEvent[];
}

export function computeExecutiveAdminSnapshot(input: {
  datasets: DatasetRecord[];
  samples: TextSample[];
  patterns: WritingPattern[];
  experiments: ExperimentRecord[];
  jobs: CollectionJob[];
  auditLogs: AuditEvent[];
}): ExecutiveAdminSnapshot {
  const { datasets, samples, patterns, experiments, jobs, auditLogs } = input;

  const researchSamples = samples.filter((s) => !s.is_synthetic_demo).length;
  const syntheticDemoSamples = samples.length - researchSamples;
  const verifiedCount = samples.filter((s) => s.validation.status === 'verified').length;
  const pendingCount = samples.filter((s) => s.validation.status === 'pending').length;
  const quarantinedCount = samples.filter((s) => s.validation.status === 'quarantined').length;
  const rejectedCount = samples.filter((s) => s.validation.status === 'rejected').length;

  const verificationRatePct =
    samples.length > 0 ? Math.round((verifiedCount / samples.length) * 100) : 0;
  const researchProgressPct = Math.min(100, Math.round((researchSamples / 3000) * 100));

  const moderationQueue = samples
    .filter((s) => s.validation.status !== 'verified')
    .sort((a, b) => {
      const rank = (status: TextSample['validation']['status']) =>
        status === 'quarantined' ? 0 : status === 'pending' ? 1 : 2;
      return rank(a.validation.status) - rank(b.validation.status);
    })
    .slice(0, 12);

  const latestExp = experiments[0];
  const latestF1Score = latestExp
    ? Number(
        (latestExp.metrics.f1_score <= 1
          ? latestExp.metrics.f1_score * 100
          : latestExp.metrics.f1_score
        ).toFixed(1)
      )
    : null;

  return {
    totalSamples: samples.length,
    researchSamples,
    syntheticDemoSamples,
    verifiedCount,
    pendingCount,
    quarantinedCount,
    rejectedCount,
    verificationRatePct,
    researchProgressPct,
    totalDatasets: datasets.length,
    approvedPatterns: patterns.filter((p) => p.validation_status === 'approved').length,
    totalPatterns: patterns.length,
    experimentCount: experiments.length,
    latestF1Score,
    activeJobs: jobs.filter((j) => j.execution_status === 'running').length,
    failedJobs: jobs.filter((j) => j.execution_status === 'failed').length,
    completedJobs: jobs.filter((j) => j.execution_status === 'completed').length,
    moderationQueue,
    recentSecurityEvents: auditLogs.slice(0, 15),
  };
}

export interface FormattedAuthGuidance {
  isUnauthorizedDomain: boolean;
  hostname: string;
  title: string;
  message: string;
  consoleUrl: string;
}

export function formatFirebaseAuthErrorMessage(
  rawError: string,
  hostname: string,
  lang: Language,
  firebaseProjectId = 'gen-lang-client-0224046879'
): FormattedAuthGuidance {
  const cleanHost = (hostname || 'localhost').trim();
  const consoleUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`;
  const lower = rawError.toLowerCase();

  if (lower.includes('auth/unauthorized-domain')) {
    return {
      isUnauthorizedDomain: true,
      hostname: cleanHost,
      consoleUrl,
      title:
        lang === 'ar'
          ? 'النطاق غير مضاف في نطاقات Firebase المصرّح بها'
          : 'Domain Not Authorized in Firebase Console',
      message:
        lang === 'ar'
          ? `رفضت مصادقة Google تسجيل الدخول لأن النطاق (${cleanHost}) غير مضاف بعد إلى قائمة Authorized domains في Firebase Authentication. أضف "${cleanHost}" من إعدادات المصادقة أو استخدم تسجيل دخول المشرف بالخادم.`
          : `Google Sign-In was blocked because "${cleanHost}" is not yet in Firebase Authentication -> Settings -> Authorized domains. Add "${cleanHost}" in Firebase Console or use Express Server Admin Login when connected.`,
    };
  }

  if (lower.includes('auth/popup-blocked')) {
    return {
      isUnauthorizedDomain: false,
      hostname: cleanHost,
      consoleUrl,
      title: lang === 'ar' ? 'تم حظر النافذة المنبثقة' : 'Sign-In Popup Blocked',
      message:
        lang === 'ar'
          ? 'قام المتصفح بحظر نافذة تسجيل الدخول المنبثقة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.'
          : 'Your browser blocked the Google Sign-In popup. Allow popups for this site and try again.',
    };
  }

  if (lower.includes('auth/popup-closed-by-user')) {
    return {
      isUnauthorizedDomain: false,
      hostname: cleanHost,
      consoleUrl,
      title: lang === 'ar' ? 'تم إغلاق نافذة تسجيل الدخول' : 'Sign-In Popup Closed',
      message:
        lang === 'ar'
          ? 'تم إغلاق نافذة تسجيل الدخول عبر Google قبل إتمام المصادقة.'
          : 'The Google Sign-In popup was closed before completing authentication.',
    };
  }

  return {
    isUnauthorizedDomain: false,
    hostname: cleanHost,
    consoleUrl,
    title: lang === 'ar' ? 'تعذر تسجيل الدخول' : 'Authentication Notice',
    message: rawError,
  };
}

/**
 * Detects private/special admin access routes (?portal=admin, ?admin=1, #/admin, #admin, or /admin)
 * that open the Special Admin Login Gate without exposing a public button or nav item.
 */
export function isSpecialAdminUrlEntry(
  search: string,
  hash: string,
  pathname = ''
): boolean {
  const cleanSearch = (search || '').trim();
  if (cleanSearch) {
    try {
      const params = new URLSearchParams(cleanSearch.startsWith('?') ? cleanSearch.slice(1) : cleanSearch);
      const portal = params.get('portal')?.toLowerCase();
      const adminFlag = params.get('admin')?.toLowerCase();
      const access = params.get('access')?.toLowerCase();
      if (portal === 'admin' || adminFlag === '1' || adminFlag === 'true' || access === 'admin') {
        return true;
      }
    } catch {
      // Ignore malformed query strings
    }
  }

  const normalizedHash = (hash || '').trim().toLowerCase();
  if (
    normalizedHash === '#/admin' ||
    normalizedHash === '#admin' ||
    normalizedHash.startsWith('#/admin?') ||
    normalizedHash.startsWith('#/admin/')
  ) {
    return true;
  }

  const normalizedPath = (pathname || '').trim().toLowerCase().replace(/\/+$/, '');
  if (normalizedPath === '/admin' || normalizedPath.endsWith('/admin')) {
    return true;
  }

  return false;
}

/**
 * Admin portal navigation links remain hidden from public visitors unless the session
 * is already authenticated as an administrator.
 */
export function canShowAdminNavEntry(isAuthenticatedAdmin: boolean): boolean {
  return Boolean(isAuthenticatedAdmin);
}

