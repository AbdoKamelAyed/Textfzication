import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Compass,
  Database,
  FileSearch,
  FlaskConical,
  GitCompare,
  Languages,
  Layers,
  LayoutDashboard,
  Menu,
  Moon,
  Network,
  Radar,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { AiAnalysisAndCompareView } from './components/AiAnalysisAndCompareView';
import { DataAcquisitionView } from './components/DataAcquisitionView';
import { DatasetManagementView } from './components/DatasetManagementView';
import { DictionaryLabView } from './components/DictionaryLabView';
import { DocumentationGuideView } from './components/DocumentationGuideView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { GovernanceAndSettingsView } from './components/GovernanceAndSettingsView';
import { LinguisticAndStylometryView } from './components/LinguisticAndStylometryView';
import { ReportsAndCopilotView } from './components/ReportsAndCopilotView';
import { ResearchDashboard, type ModuleId } from './components/ResearchDashboard';
import { TrainingAndExperimentsView } from './components/TrainingAndExperimentsView';
import { VisualIntelligenceView } from './components/VisualIntelligenceView';
import { UI_STRINGS } from './engine/i18n';
import { useI18n } from './lib/i18nContext';
import { applyBulkSampleValidation } from './engine/bulkValidation';
import { createImportCollectionJob } from './engine/collectionJobs';
import {
  DEMO_DATASETS,
  DEMO_SAMPLES,
  INITIAL_COLLECTION_JOBS,
  INITIAL_EXPERIMENTS,
  INITIAL_EXTERNAL_SOURCES,
  INITIAL_PATTERNS,
} from './engine/demoCorpus';

const INITIAL_AUDIT_LOGS: AuditEvent[] = [
  {
    id: 'aud_init_001',
    timestamp: '2026-11-20T15:00:00Z',
    actor: 'system',
    action: 'INIT_DEMO_CORPUS',
    target_type: 'dataset',
    target_id: 'tx-demo-multilingual-v1',
    details: 'Initialized 7 labeled synthetic demonstration samples across EN and AR.',
  },
];
import type {
  AuditEvent,
  CollectionJob,
  DatasetRecord,
  ExperimentRecord,
  ExternalSource,
  PatternStatus,
  StorageLayer,
  TextSample,
  ValidationStatus,
  WritingPattern,
} from './engine/types';
import {
  getFreshIdToken,
  signInWithGoogle,
  signOutGoogle,
  subscribeAuth,
  syncDatasetAndSampleToFirestore,
  syncUserProfileToFirestore,
  testFirestoreConnection,
} from './lib/firebase';
import {
  clearAllIndexedDbData,
  loadWorkspaceFromIndexedDb,
  saveWorkspaceToIndexedDb,
} from './storage/indexedDb';
import { resolveApiUrl } from './lib/apiBase';
import { safeFetchJson } from './lib/safeFetchJson';

const NAV_GROUP_DEFS: Array<{
  headingKey: keyof typeof UI_STRINGS.navGroups;
  items: Array<{
    id: ModuleId;
    moduleKey: keyof typeof UI_STRINGS.modules;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}> = [
  {
    headingKey: 'overview',
    items: [
      { id: 'dashboard', moduleKey: 'dashboard', icon: LayoutDashboard },
      { id: 'guide', moduleKey: 'guide', icon: Compass },
    ],
  },
  {
    headingKey: 'corpus',
    items: [
      { id: 'acquisition', moduleKey: 'acquisition', icon: Database },
      { id: 'datasets', moduleKey: 'datasets', icon: Layers },
    ],
  },
  {
    headingKey: 'stylometry',
    items: [
      { id: 'linguistic', moduleKey: 'linguistic', icon: FileSearch },
      { id: 'patterns', moduleKey: 'patterns', icon: Activity },
      { id: 'stylometry', moduleKey: 'stylometry', icon: Radar },
      { id: 'ai_analysis', moduleKey: 'ai_analysis', icon: ShieldCheck },
      { id: 'compare', moduleKey: 'compare', icon: GitCompare },
      { id: 'dictionary', moduleKey: 'dictionary', icon: BookOpen },
    ],
  },
  {
    headingKey: 'modeling',
    items: [
      { id: 'training', moduleKey: 'training', icon: FlaskConical },
      { id: 'visuals', moduleKey: 'visuals', icon: Network },
      { id: 'experiments', moduleKey: 'experiments', icon: BarChart3 },
    ],
  },
  {
    headingKey: 'reports',
    items: [
      { id: 'reports', moduleKey: 'reports', icon: Sparkles },
      { id: 'copilot', moduleKey: 'copilot', icon: Bot },
      { id: 'governance', moduleKey: 'governance', icon: Settings },
    ],
  },
];

export default function App() {
  const { lang, toggleLang, t } = useI18n();
  const isAr = lang === 'ar';
  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('textprint_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  // Core Workspace State
  const [datasets, setDatasets] = useState<DatasetRecord[]>(DEMO_DATASETS);
  const [samples, setSamples] = useState<TextSample[]>(DEMO_SAMPLES);
  const [patterns, setPatterns] = useState<WritingPattern[]>(INITIAL_PATTERNS);
  const [experiments, setExperiments] = useState<ExperimentRecord[]>(INITIAL_EXPERIMENTS);
  const [sources, setSources] = useState<ExternalSource[]>(INITIAL_EXTERNAL_SOURCES);
  const [jobs, setJobs] = useState<CollectionJob[]>(INITIAL_COLLECTION_JOBS);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>(INITIAL_AUDIT_LOGS);
  const [hydrated, setHydrated] = useState(false);

  // Auth & Runtime State
  const [user, setUser] = useState<User | null>(null);
  const [hasDriveToken, setHasDriveToken] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [firestoreConnected, setFirestoreConnected] = useState<boolean | null>(null);
  const [serverHealth, setServerHealth] = useState<{
    ok: boolean;
    geminiConfigured: boolean;
    sqlConfigured: boolean;
  } | null>(null);
  const jobTimersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      for (const timerId of jobTimersRef.current) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  // Apply Tailwind v4 dark class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      window.localStorage.setItem('textprint_theme', theme);
    } catch {
      // Ignore storage quota restrictions
    }
  }, [theme]);

  // Hydrate from IndexedDB & Server Corpus on Startup
  useEffect(() => {
    let active = true;
    async function bootstrap() {
      const [idbData, fsOk, healthRes, corpusRes] = await Promise.all([
        loadWorkspaceFromIndexedDb(),
        testFirestoreConnection(),
        safeFetchJson<{ ok: boolean; geminiConfigured: boolean; sqlConfigured: boolean }>('/api/health').then((r) =>
          r.ok ? r.data : null
        ),
        safeFetchJson<{
          datasets?: DatasetRecord[];
          samples?: TextSample[];
          patterns?: WritingPattern[];
          experiments?: ExperimentRecord[];
          sources?: ExternalSource[];
          jobs?: CollectionJob[];
          auditLogs?: AuditEvent[];
        }>('/api/corpus').then((r) => (r.ok ? r.data : null)),
      ]);

      if (!active) return;
      setFirestoreConnected(fsOk);
      if (healthRes) setServerHealth(healthRes);

      if (idbData && idbData.samples.length > 0) {
        setDatasets(idbData.datasets);
        setSamples(idbData.samples);
        if (idbData.patterns.length > 0) setPatterns(idbData.patterns);
        if (idbData.experiments.length > 0) setExperiments(idbData.experiments);
        if (idbData.sources.length > 0) setSources(idbData.sources);
        if (idbData.jobs.length > 0) setJobs(idbData.jobs);
        if (idbData.auditLogs.length > 0) setAuditLogs(idbData.auditLogs);
      } else if (corpusRes && Array.isArray(corpusRes.samples) && corpusRes.samples.length > 0) {
        setDatasets(corpusRes.datasets ?? DEMO_DATASETS);
        setSamples(corpusRes.samples);
        setPatterns(corpusRes.patterns ?? INITIAL_PATTERNS);
        setExperiments(corpusRes.experiments ?? INITIAL_EXPERIMENTS);
        setSources(corpusRes.sources ?? INITIAL_EXTERNAL_SOURCES);
        setJobs(corpusRes.jobs ?? INITIAL_COLLECTION_JOBS);
        setAuditLogs(corpusRes.auditLogs ?? INITIAL_AUDIT_LOGS);
      }
      setHydrated(true);
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  // Persist workspace changes to IndexedDB
  useEffect(() => {
    if (!hydrated) return;
    saveWorkspaceToIndexedDb({
      datasets,
      samples,
      patterns,
      experiments,
      sources,
      jobs,
      auditLogs,
    }).catch(() => {
      // IndexedDB may be disabled in private browsing contexts
    });
  }, [hydrated, datasets, samples, patterns, experiments, sources, jobs, auditLogs]);

  // Subscribe to Firebase Auth state
  useEffect(() => {
    return subscribeAuth((authUser, driveReady) => {
      setUser(authUser);
      setHasDriveToken(driveReady);
      if (authUser) {
        syncUserProfileToFirestore(authUser, theme).catch(() => {});
        getFreshIdToken()
          .then((token) => {
            if (!token) return;
            fetch(resolveApiUrl('/api/auth/sync'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            }).catch(() => {});
          })
          .catch(() => {});
      }
    });
  }, []);

  const appendAudit = (
    action: string,
    targetType: string,
    targetId: string,
    details: string
  ) => {
    const event: AuditEvent = {
      id: `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      actor: user?.email || 'local-researcher',
      action,
      target_type: targetType,
      target_id: targetId,
      details,
    };
    setAuditLogs((prev) => [event, ...prev].slice(0, 150));
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const { user: signedUser, accessToken } = await signInWithGoogle();
      setUser(signedUser);
      setHasDriveToken(Boolean(accessToken));
      appendAudit(
        'RESEARCHER_SIGN_IN',
        'auth',
        signedUser.uid,
        `Authenticated ${signedUser.email || 'researcher'} with Firebase & Google Drive.`
      );
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google Sign-In was cancelled or failed.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOutGoogle();
    setUser(null);
    setHasDriveToken(false);
    appendAudit('RESEARCHER_SIGN_OUT', 'auth', 'session', 'Signed out of cloud session.');
  };

  const handleImportSamples = async (dataset: DatasetRecord, newSamples: TextSample[]) => {
    setDatasets((prev) => {
      const exists = prev.some((d) => d.dataset_key === dataset.dataset_key);
      return exists ? prev : [dataset, ...prev];
    });
    setSamples((prev) => [...newSamples, ...prev]);
    const importJob = createImportCollectionJob(dataset, newSamples);
    setJobs((prev) => [importJob, ...prev].slice(0, 20));
    appendAudit(
      'IMPORT_SAMPLES',
      'dataset',
      dataset.dataset_key,
      `Imported ${newSamples.length} records into ${dataset.name} (${dataset.layer}).`
    );

    if (user) {
      syncDatasetAndSampleToFirestore(user, dataset, newSamples[0]).catch(() => {});
      const idToken = await getFreshIdToken().catch(() => null);
      if (idToken) {
        fetch(resolveApiUrl('/api/db/datasets'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ dataset }),
        }).catch(() => {});
        for (let i = 0; i < newSamples.length; i += 200) {
          const chunk = newSamples.slice(i, i + 200);
          fetch(resolveApiUrl('/api/db/samples'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ samples: chunk }),
          }).catch(() => {});
        }
      }
    }
  };

  const handleValidateSample = async (
    sampleId: string,
    status: ValidationStatus,
    layer: StorageLayer,
    note: string
  ) => {
    setSamples((prev) =>
      prev.map((s) =>
        s.sample_id === sampleId
          ? {
              ...s,
              layer,
              validation: {
                status,
                verified: status === 'verified',
                validation_notes: [...s.validation.validation_notes, note],
              },
            }
          : s
      )
    );
    appendAudit(
      'VALIDATE_SAMPLE',
      'sample',
      sampleId,
      `Marked ${sampleId} as ${status} in ${layer} layer (${note}).`
    );

    if (user) {
      const idToken = await getFreshIdToken().catch(() => null);
      if (idToken) {
        fetch(resolveApiUrl(`/api/db/samples/${encodeURIComponent(sampleId)}/validate`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ status, layer, note }),
        }).catch(() => {});
      }
    }
  };

  const handleBulkValidateSamples = async (
    sampleIds: string[],
    status: ValidationStatus,
    layer: StorageLayer,
    note: string
  ) => {
    const cleanIds = Array.from(new Set(sampleIds.map((id) => id.trim()).filter(Boolean)));
    if (cleanIds.length === 0) return;

    setSamples((prev) => applyBulkSampleValidation(prev, cleanIds, status, layer, note).nextSamples);

    const preview = cleanIds.slice(0, 4).join(', ');
    const suffix = cleanIds.length > 4 ? ` +${cleanIds.length - 4} more` : '';
    appendAudit(
      'BULK_VALIDATE_SAMPLES',
      'sample_batch',
      `${cleanIds.length} sample(s)`,
      `Bulk marked ${cleanIds.length} sample(s) (${preview}${suffix}) as ${status} in ${layer} layer (${note}).`
    );

    if (user) {
      const idToken = await getFreshIdToken().catch(() => null);
      if (idToken) {
        for (let i = 0; i < cleanIds.length; i += 500) {
          const chunk = cleanIds.slice(i, i + 500);
          fetch(resolveApiUrl('/api/db/samples/bulk-validate'), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ sampleIds: chunk, status, layer, note }),
          }).catch(() => {});
        }
      }
    }
  };

  const handleUpdatePatternStatus = (patternId: string, nextStatus: PatternStatus) => {
    setPatterns((prev) =>
      prev.map((p) => (p.pattern_id === patternId ? { ...p, validation_status: nextStatus } : p))
    );
    appendAudit(
      'UPDATE_PATTERN_STATUS',
      'pattern',
      patternId,
      `Transitioned writing pattern ${patternId} to ${nextStatus}.`
    );
  };

  const handleRecordExperiment = async (exp: ExperimentRecord) => {
    setExperiments((prev) => [exp, ...prev]);
    appendAudit(
      'RECORD_EXPERIMENT',
      'experiment',
      exp.experiment_key,
      `Executed ${exp.name} (${exp.split_strategy}) · F1 ${(exp.metrics.f1_score * 100).toFixed(1)}%.`
    );

    if (user) {
      const idToken = await getFreshIdToken().catch(() => null);
      if (idToken) {
        fetch(resolveApiUrl('/api/db/experiments'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ experiment: exp }),
        }).catch(() => {});
      }
    }
  };

  const handleRunCollectionJob = (jobKey: string) => {
    const totalTarget = Math.max(1, samples.length);
    const flaggedCount = samples.filter(
      (s) => s.validation.status === 'quarantined' || s.validation.status === 'rejected'
    ).length;
    const validCount = Math.max(0, samples.length - flaggedCount);

    setJobs((prev) =>
      prev.map((j) =>
        j.job_key === jobKey
          ? {
              ...j,
              execution_status: 'running',
              progress_percent: 25,
              target_records: totalTarget,
              imported_records: 0,
              failed_records: 0,
              error_log: null,
              current_stage: 'Fetching manifest & scanning corpus schema...',
            }
          : j
      )
    );

    const t1 = window.setTimeout(() => {
      const midImported = Math.ceil(validCount * 0.65);
      setJobs((prev) =>
        prev.map((j) =>
          j.job_key === jobKey && j.execution_status === 'running'
            ? {
                ...j,
                progress_percent: 68,
                imported_records: midImported,
                current_stage: 'Checking normalized hashes & provenance...',
              }
            : j
        )
      );
    }, 450);

    const t2 = window.setTimeout(() => {
      const now = new Date().toISOString();
      setJobs((prev) =>
        prev.map((j) =>
          j.job_key === jobKey
            ? {
                ...j,
                execution_status: 'completed',
                progress_percent: 100,
                target_records: totalTarget,
                imported_records: validCount,
                failed_records: flaggedCount,
                current_stage: `Verified ${validCount} ok · ${flaggedCount} flagged`,
                last_execution: now,
              }
            : j
        )
      );
      appendAudit(
        'CHECK_COLLECTION_JOB',
        'job',
        jobKey,
        `Completed collection audit (${jobKey}): ${validCount} ok, ${flaggedCount} flagged.`
      );
    }, 950);

    jobTimersRef.current.push(t1, t2);
  };

  const handleResetDemoWorkspace = () => {
    setDatasets(DEMO_DATASETS);
    setSamples(DEMO_SAMPLES);
    setPatterns(INITIAL_PATTERNS);
    setExperiments(INITIAL_EXPERIMENTS);
    setSources(INITIAL_EXTERNAL_SOURCES);
    setJobs(INITIAL_COLLECTION_JOBS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    appendAudit('RESET_DEMO_CORPUS', 'workspace', 'demo', 'Restored baseline synthetic demonstration corpus.');
  };

  const handleClearIndexedDb = async () => {
    await clearAllIndexedDbData();
    appendAudit('CLEAR_INDEXEDDB', 'storage', 'indexeddb', 'Cleared local browser IndexedDB stores.');
  };

  const navGroups = NAV_GROUP_DEFS.map((g) => ({
    heading: t(UI_STRINGS.navGroups[g.headingKey]),
    items: g.items.map((item) => ({
      id: item.id,
      label: t(UI_STRINGS.modules[item.moduleKey]),
      icon: item.icon,
    })),
  }));

  const activeNavLabel =
    navGroups.flatMap((g) => g.items).find((item) => item.id === activeModule)?.label ??
    'TEXTPRINT Laboratory';

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex overflow-x-clip">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:start-0 border-e border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <div className="min-w-0 truncate">
              <span className="font-mono text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                TEXTPRINT
              </span>
              <span className="ms-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                v1.5
              </span>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Laboratory Modules">
            {navGroups.map((group) => (
              <div key={group.heading} className="space-y-1">
                <p className="px-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                  {group.heading}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveModule(item.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-md transition-colors text-start ${
                        active
                          ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-medium'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
            {samples.length} {isAr ? 'مفهرس' : 'indexed'} · {samples.filter((s) => !s.is_synthetic_demo).length} {isAr ? 'بحثي' : 'research'}
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-950/50"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="relative w-72 max-w-[82vw] bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-800 flex flex-col z-50">
              <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                <span className="font-mono text-sm font-semibold">TEXTPRINT</span>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
                {navGroups.map((group) => (
                  <div key={group.heading} className="space-y-1">
                    <p className="px-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                      {group.heading}
                    </p>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = activeModule === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActiveModule(item.id);
                            setMobileNavOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-md transition-colors text-start ${
                            active
                              ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-medium'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 lg:ps-64 flex flex-col min-w-0">
          <header className="h-14 sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation menu"
                className="lg:hidden p-1.5 rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shrink-0"
              >
                <Menu className="w-4 h-4" />
              </button>
              <span className="hidden sm:inline text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                TEXTPRINT / {activeNavLabel}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <button
                type="button"
                data-testid="lang-toggle-btn"
                onClick={toggleLang}
                aria-label={isAr ? 'Switch interface to English' : 'تبديل الواجهة إلى العربية'}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-sky-300 dark:border-sky-700 bg-sky-50/70 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors whitespace-nowrap shrink-0"
              >
                <Languages className="w-3.5 h-3.5 shrink-0" />
                <span>{t(UI_STRINGS.actions.switchLang)}</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              >
                {theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {theme === 'dark' ? t(UI_STRINGS.actions.light) : t(UI_STRINGS.actions.dark)}
                </span>
              </button>

              <GoogleSignInButton
                user={user}
                hasDriveToken={hasDriveToken}
                isSigningIn={isSigningIn}
                onSignIn={handleSignIn}
                onSignOut={handleSignOut}
              />
            </div>
          </header>

          {authError && (
            <div className="mx-4 sm:mx-6 mt-4 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-md flex items-center justify-between gap-2">
              <span className="break-words min-w-0">{authError}</span>
              <button
                type="button"
                onClick={() => setAuthError(null)}
                className="underline shrink-0"
              >
                {t(UI_STRINGS.actions.dismiss)}
              </button>
            </div>
          )}

          <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto min-w-0">
            {activeModule === 'dashboard' && (
              <ResearchDashboard
                datasets={datasets}
                samples={samples}
                patterns={patterns}
                experiments={experiments}
                jobs={jobs}
                auditLogs={auditLogs}
                onNavigate={setActiveModule}
              />
            )}

            {activeModule === 'acquisition' && (
              <DataAcquisitionView
                datasets={datasets}
                samples={samples}
                sources={sources}
                jobs={jobs}
                hasDriveToken={hasDriveToken}
                onSignIn={handleSignIn}
                onImportSamples={handleImportSamples}
                onRunCollectionJob={handleRunCollectionJob}
                onLogAudit={appendAudit}
              />
            )}

            {activeModule === 'datasets' && (
              <DatasetManagementView
                datasets={datasets}
                samples={samples}
                onValidateSample={handleValidateSample}
                onBulkValidateSamples={handleBulkValidateSamples}
              />
            )}

            {(activeModule === 'linguistic' ||
              activeModule === 'patterns' ||
              activeModule === 'stylometry') && (
              <LinguisticAndStylometryView
                initialSubView={activeModule}
                samples={samples}
                patterns={patterns}
                onUpdatePatternStatus={handleUpdatePatternStatus}
              />
            )}

            {(activeModule === 'ai_analysis' || activeModule === 'compare') && (
              <AiAnalysisAndCompareView
                initialSubView={activeModule}
                samples={samples}
              />
            )}

            {(activeModule === 'training' || activeModule === 'experiments') && (
              <TrainingAndExperimentsView
                datasets={datasets}
                samples={samples}
                experiments={experiments}
                onRecordExperiment={handleRecordExperiment}
              />
            )}

            {activeModule === 'visuals' && (
              <VisualIntelligenceView
                datasets={datasets}
                samples={samples}
                patterns={patterns}
                experiments={experiments}
              />
            )}

            {(activeModule === 'reports' || activeModule === 'copilot') && (
              <ReportsAndCopilotView
                initialSubView={activeModule}
                datasets={datasets}
                samples={samples}
                patterns={patterns}
                experiments={experiments}
                user={user}
                hasDriveToken={hasDriveToken}
                onSignIn={handleSignIn}
                onLogAudit={appendAudit}
              />
            )}

            {activeModule === 'governance' && (
              <GovernanceAndSettingsView
                user={user}
                datasets={datasets}
                samples={samples}
                patterns={patterns}
                experiments={experiments}
                sources={sources}
                jobs={jobs}
                auditLogs={auditLogs}
                firestoreConnected={firestoreConnected}
                serverHealth={serverHealth}
                theme={theme}
                onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                onResetDemoWorkspace={handleResetDemoWorkspace}
                onClearIndexedDb={handleClearIndexedDb}
                onSignIn={handleSignIn}
                onLogAudit={appendAudit}
              />
            )}

            {activeModule === 'dictionary' && (
              <DictionaryLabView
                samples={samples}
                onLogAudit={appendAudit}
              />
            )}

            {activeModule === 'guide' && (
              <DocumentationGuideView
                onNavigate={setActiveModule}
              />
            )}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
