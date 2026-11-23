import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Database,
  Flame,
  Link2,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  appendHealthPingSample,
  deriveConnectivityIndicators,
  type ConnectivityStatusKind,
  type HealthEndpointPayload,
  type HealthPingSample,
} from '../engine/connectivityMonitor';
import { getConfiguredApiBaseUrl, setConfiguredApiBaseUrl } from '../lib/apiBase';
import { testFirestoreConnection } from '../lib/firebase';
import { safeFetchJson, type SafeFetchResult } from '../lib/safeFetchJson';

interface Props {
  initialFirestoreConnected: boolean | null;
  onHealthUpdate?: (health: HealthEndpointPayload | null, firestoreOk: boolean) => void;
}

const INTERVAL_OPTIONS = [
  { label: 'Every 5s', ms: 5000 },
  { label: 'Every 10s', ms: 10000 },
  { label: 'Every 30s', ms: 30000 },
] as const;

function indicatorVisuals(status: ConnectivityStatusKind): {
  dotClass: string;
  badgeClass: string;
  cardBorderClass: string;
} {
  switch (status) {
    case 'online':
      return {
        dotClass: 'bg-emerald-500',
        badgeClass:
          'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
        cardBorderClass: 'border-slate-200 dark:border-slate-800',
      };
    case 'degraded':
      return {
        dotClass: 'bg-amber-500',
        badgeClass:
          'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900',
        cardBorderClass: 'border-amber-200/80 dark:border-amber-900/60',
      };
    case 'offline':
      return {
        dotClass: 'bg-rose-500',
        badgeClass:
          'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900',
        cardBorderClass: 'border-rose-200/80 dark:border-rose-900/60',
      };
    case 'checking':
    default:
      return {
        dotClass: 'bg-sky-500',
        badgeClass:
          'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900',
        cardBorderClass: 'border-slate-200 dark:border-slate-800',
      };
  }
}

export function GovernanceStatusMonitor({
  initialFirestoreConnected,
  onHealthUpdate,
}: Props) {
  const [intervalMs, setIntervalMs] = useState<number>(10000);
  const [isPaused, setIsPaused] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [healthResult, setHealthResult] =
    useState<SafeFetchResult<HealthEndpointPayload> | null>(null);
  const [firestoreOk, setFirestoreOk] = useState<boolean | null>(initialFirestoreConnected);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [pingHistory, setPingHistory] = useState<HealthPingSample[]>([]);
  const [avgLatencyMs, setAvgLatencyMs] = useState<number>(0);
  const [uptimePercent, setUptimePercent] = useState<number>(100);

  // Optional Express Backend URL override for static hosting (Firebase Hosting / GitHub Pages)
  const [configuredOrigin, setConfiguredOrigin] = useState<string>(() => getConfiguredApiBaseUrl());
  const [originDraft, setOriginDraft] = useState<string>(() => getConfiguredApiBaseUrl());
  const [showOriginForm, setShowOriginForm] = useState(false);

  const inFlightRef = useRef(false);
  const onHealthUpdateRef = useRef(onHealthUpdate);
  onHealthUpdateRef.current = onHealthUpdate;

  const runHealthPing = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsPinging(true);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    try {
      const [res, fsLive] = await Promise.all([
        safeFetchJson<HealthEndpointPayload>(
          '/api/health',
          { cache: 'no-store' },
          'Express /api/health unavailable on static hosting.'
        ),
        testFirestoreConnection(),
      ]);

      const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const latencyMs = Math.max(1, Math.round(finishedAt - startedAt));
      const nowIso = new Date().toISOString();

      setHealthResult(res);
      setFirestoreOk(fsLive);
      setLastLatencyMs(latencyMs);
      setLastCheckedAt(nowIso);

      setPingHistory((prev) => {
        const nextSummary = appendHealthPingSample(prev, {
          id: `ping_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
          timestamp: nowIso,
          ok: res.ok,
          isHtmlFallback: res.isHtmlFallback,
          latencyMs,
          geminiConfigured: Boolean(res.data?.geminiConfigured),
          sqlConfigured: Boolean(res.data?.sqlConfigured),
          firebaseConnected: fsLive,
        });
        setAvgLatencyMs(nextSummary.averageLatencyMs);
        setUptimePercent(nextSummary.successRatePercent);
        return nextSummary.samples;
      });

      onHealthUpdateRef.current?.(res.ok ? res.data : null, fsLive);
    } finally {
      inFlightRef.current = false;
      setIsPinging(false);
    }
  }, []);

  useEffect(() => {
    void runHealthPing();
  }, [runHealthPing]);

  useEffect(() => {
    if (isPaused) return;
    const timer = window.setInterval(() => {
      void runHealthPing();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPaused, intervalMs, runHealthPing]);

  const indicators = useMemo(
    () =>
      deriveConnectivityIndicators({
        healthResult,
        firestoreConnected: firestoreOk,
        lastLatencyMs,
        isPinging,
      }),
    [healthResult, firestoreOk, lastLatencyMs, isPinging]
  );

  const handleSaveOrigin = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = setConfiguredApiBaseUrl(originDraft);
    setConfiguredOrigin(saved);
    setOriginDraft(saved);
    setShowOriginForm(false);
    void runHealthPing();
  };

  const handleClearOrigin = () => {
    setConfiguredApiBaseUrl('');
    setConfiguredOrigin('');
    setOriginDraft('');
    setShowOriginForm(false);
    void runHealthPing();
  };

  const isStaticFallback = Boolean(healthResult?.isHtmlFallback);

  return (
    <section
      aria-label="Real-time service connectivity monitor"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4"
    >
      {/* Header & Polling Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 p-1.5 rounded-md bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-900 text-sky-700 dark:text-sky-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Real-Time Connectivity Monitor
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                <span
                  aria-hidden="true"
                  className={`w-2 h-2 rounded-full ${
                    isPaused
                      ? 'bg-slate-400'
                      : isPinging
                        ? 'bg-sky-500 animate-ping'
                        : healthResult?.ok
                          ? 'bg-emerald-500 animate-pulse'
                          : 'bg-amber-500'
                  }`}
                />
                <span>
                  {isPaused
                    ? 'Paused'
                    : `Live · ${intervalMs / 1000}s`}
                </span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pings <span className="font-mono">GET /api/health</span> &amp; Firestore server probe
              {configuredOrigin ? ` via ${configuredOrigin}` : ' (same-origin)'}
              {lastCheckedAt ? ` · Last check ${lastCheckedAt.slice(11, 19)} UTC` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Health ping interval"
            value={intervalMs}
            onChange={(e) => setIntervalMs(Number(e.target.value))}
            className="px-2.5 py-1.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.ms} value={opt.ms}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            aria-pressed={!isPaused}
            onClick={() => setIsPaused((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <button
            type="button"
            onClick={() => void runHealthPing()}
            disabled={isPinging}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
            <span>Ping Now</span>
          </button>

          <button
            type="button"
            onClick={() => setShowOriginForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>{configuredOrigin ? 'Backend URL' : 'Attach Backend'}</span>
          </button>
        </div>
      </div>

      {/* Three Real-Time Service Indicator Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {indicators.map((item) => {
          const vis = indicatorVisuals(item.status);
          const Icon =
            item.id === 'gemini' ? Sparkles : item.id === 'sql' ? Database : Flame;
          return (
            <div
              key={item.id}
              data-testid={`connectivity-card-${item.id}`}
              className={`rounded-md border ${vis.cardBorderClass} bg-slate-50/70 dark:bg-slate-950/60 p-3.5 space-y-2`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {item.label}
                  </span>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono font-medium rounded border ${vis.badgeClass}`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-1.5 h-1.5 rounded-full ${vis.dotClass} ${
                      item.status === 'online' && !isPaused ? 'animate-pulse' : ''
                    }`}
                  />
                  <span>{item.badgeText}</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-600 dark:text-slate-400 truncate">
                  {item.detail}
                </span>
                <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                  {item.latencyMs !== null ? `${item.latencyMs} ms` : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Static Hosting Guidance + Optional Cloud Run Backend Connector */}
      {(isStaticFallback || showOriginForm) && (
        <div className="rounded-md border border-amber-200 dark:border-amber-900/70 bg-amber-50/70 dark:bg-amber-950/25 p-3.5 space-y-2.5 text-xs">
          {isStaticFallback && (
            <p className="text-amber-800 dark:text-amber-300">
              Static hosting detected: Firebase Hosting / GitHub Pages serve client assets only, so Deep Thinking Gemini analysis, AI Copilot, and Cloud SQL require an Express backend (<span className="font-mono">node server.ts</span> on Cloud Run). Attach your Cloud Run Express URL below or open the Cloud Run app URL directly.
            </p>
          )}
          <form onSubmit={handleSaveOrigin} className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              aria-label="Express backend server URL"
              value={originDraft}
              onChange={(e) => setOriginDraft(e.target.value)}
              placeholder="https://your-cloud-run-service.run.app"
              className="flex-1 px-3 py-1.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-900 dark:bg-sky-600 text-white hover:bg-slate-800 dark:hover:bg-sky-700"
              >
                Connect Backend
              </button>
              {configuredOrigin && (
                <button
                  type="button"
                  onClick={handleClearOrigin}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Use Same-Origin
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Rolling 12-Tick Probe History */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-slate-500 dark:text-slate-400">Probe History:</span>
          <div className="flex items-end gap-1 h-4" aria-label="Recent /api/health probe history">
            {pingHistory.length === 0 ? (
              <span className="font-mono text-slate-400">Initializing...</span>
            ) : (
              pingHistory.map((sample) => (
                <span
                  key={sample.id}
                  title={`${sample.timestamp.slice(11, 19)} UTC · ${
                    sample.ok ? 'OK' : sample.isHtmlFallback ? 'Static HTML' : 'Offline'
                  } · ${sample.latencyMs} ms`}
                  aria-label={`${sample.ok ? 'Healthy' : 'Degraded'} ping ${sample.latencyMs}ms`}
                  className={`w-2 rounded-sm transition-all ${
                    sample.ok
                      ? 'bg-emerald-500 h-3.5'
                      : sample.isHtmlFallback
                        ? 'bg-amber-500 h-2.5'
                        : 'bg-rose-500 h-2'
                  }`}
                />
              ))
            )}
          </div>
        </div>

        <div className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
          {pingHistory.length > 0
            ? `${pingHistory.length} probes · ${uptimePercent}% healthy · avg ${avgLatencyMs} ms`
            : 'Awaiting first probe...'}
        </div>
      </div>
    </section>
  );
}
