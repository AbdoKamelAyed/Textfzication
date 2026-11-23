import { useId, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type MouseHandlerDataParam,
} from 'recharts';
import { ArrowRight } from 'lucide-react';
import { buildDashboard30DayTrends, type SparklinePoint } from '../engine/dashboardTrends';
import { RESEARCH_CORPUS_TARGETS } from '../engine/demoCorpus';
import type {
  AuditEvent,
  CollectionJob,
  DatasetRecord,
  ExperimentRecord,
  TextSample,
  WritingPattern,
} from '../engine/types';

export type ModuleId =
  | 'dashboard'
  | 'acquisition'
  | 'datasets'
  | 'linguistic'
  | 'patterns'
  | 'stylometry'
  | 'ai_analysis'
  | 'compare'
  | 'training'
  | 'visuals'
  | 'experiments'
  | 'reports'
  | 'copilot'
  | 'governance';

interface Props {
  datasets: DatasetRecord[];
  samples: TextSample[];
  patterns: WritingPattern[];
  experiments: ExperimentRecord[];
  jobs: CollectionJob[];
  auditLogs: AuditEvent[];
  onNavigate: (module: ModuleId) => void;
}

function InteractiveSparklineCard({
  title,
  series,
  unitLabel,
  subtitle,
  accentHex,
  onClick,
}: {
  title: string;
  series: SparklinePoint[];
  unitLabel: string;
  subtitle: string;
  accentHex: string;
  onClick?: () => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, '_');

  const safeSeries = useMemo(
    () =>
      series.length > 0
        ? series
        : [{ date: 'N/A', shortDate: 'N/A', value: 0, dailyDelta: 0 }],
    [series]
  );

  const activeIdx =
    hoveredIdx !== null && safeSeries[hoveredIdx] ? hoveredIdx : safeSeries.length - 1;
  const activePoint = safeSeries[activeIdx];
  const net30dDelta =
    series.length > 1
      ? series[series.length - 1].value - series[0].value + series[0].dailyDelta
      : 0;

  return (
    <div
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col justify-between gap-2"
      data-testid={`sparkline-card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {onClick ? (
              <button
                type="button"
                onClick={onClick}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-400 font-medium text-left truncate"
              >
                {title}
              </button>
            ) : (
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
                {title}
              </p>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-mono font-semibold text-slate-900 dark:text-slate-50 tabular-nums">
              {activePoint?.value ?? 0}
            </span>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {hoveredIdx !== null && activePoint
                ? `${activePoint.shortDate}${
                    activePoint.dailyDelta > 0 ? ` (+${activePoint.dailyDelta})` : ''
                  }`
                : `${unitLabel} · +${net30dDelta} (30d)`}
            </span>
          </div>
        </div>
        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
          30d
        </span>
      </div>

      <div
        className="w-full h-14 cursor-crosshair select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500 rounded"
        role="img"
        aria-label={`${title} 30-day trend sparkline`}
        tabIndex={0}
        onMouseLeave={() => setHoveredIdx(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setHoveredIdx((prev) => Math.max(0, (prev ?? safeSeries.length - 1) - 1));
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            setHoveredIdx((prev) => Math.min(safeSeries.length - 1, (prev ?? 0) + 1));
          } else if (e.key === 'Escape') {
            setHoveredIdx(null);
          }
        }}
      >
        <ResponsiveContainer width="100%" height={56} minWidth={0}>
          <AreaChart
            data={safeSeries}
            margin={{ top: 6, right: 6, bottom: 6, left: 6 }}
            onMouseMove={(state: MouseHandlerDataParam) => {
              const rawIdx = state?.activeTooltipIndex;
              if (rawIdx !== undefined && rawIdx !== null) {
                const idx = Number(rawIdx);
                if (!Number.isNaN(idx) && idx >= 0 && idx < safeSeries.length) {
                  setHoveredIdx(idx);
                }
              }
            }}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentHex} stopOpacity={0.24} />
                <stop offset="100%" stopColor={accentHex} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis domain={[0, (dataMax: number) => Math.max(1, dataMax)]} hide />
            <Tooltip
              content={() => null}
              cursor={false}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={accentHex}
              strokeWidth={1.75}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              activeDot={false}
            />
            {activePoint && (
              <ReferenceLine
                x={activePoint.date}
                stroke="#94a3b8"
                strokeOpacity={0.55}
                strokeWidth={1}
                strokeDasharray="2 2"
              />
            )}
            {activePoint && (
              <ReferenceDot
                x={activePoint.date}
                y={activePoint.value}
                r={3.5}
                fill={accentHex}
                stroke="#ffffff"
                strokeWidth={1.5}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>
    </div>
  );
}

export function ResearchDashboard({
  datasets,
  samples,
  patterns,
  experiments,
  jobs,
  auditLogs,
  onNavigate,
}: Props) {
  const verifiedSamples = samples.filter((s) => s.validation.verified);
  const pendingSamples = samples.filter((s) => s.validation.status === 'pending');
  const quarantinedSamples = samples.filter(
    (s) => s.validation.status === 'quarantined' || s.validation.status === 'rejected'
  );
  const researchOnlySamples = samples.filter((s) => !s.is_synthetic_demo);
  const demoOnlySamples = samples.filter((s) => s.is_synthetic_demo);

  const trends30d = useMemo(
    () =>
      buildDashboard30DayTrends({
        datasets,
        samples,
        patterns,
        experiments,
        auditLogs,
      }),
    [datasets, samples, patterns, experiments, auditLogs]
  );

  const originCounts = {
    human: samples.filter((s) => s.origin.class === 'human').length,
    ai: samples.filter((s) => s.origin.class === 'ai').length,
    human_edited_ai: samples.filter((s) => s.origin.class === 'human_edited_ai').length,
    ai_edited_human: samples.filter((s) => s.origin.class === 'ai_edited_human').length,
    mixed: samples.filter((s) => s.origin.class === 'mixed').length,
    unknown: samples.filter((s) => s.origin.class === 'unknown').length,
  };

  const langMap = new Map<string, number>();
  for (const s of samples) {
    const key = s.language.toUpperCase();
    langMap.set(key, (langMap.get(key) ?? 0) + 1);
  }
  const languages = Array.from(langMap.entries()).sort((a, b) => b[1] - a[1]);

  const latestExperiment = experiments[0];
  const approvedPatternsCount = patterns.filter((p) => p.validation_status === 'approved').length;
  const totalCount = Math.max(1, samples.length);

  const targetRows = [
    {
      label: 'Human Writing',
      current: researchOnlySamples.filter((s) => s.origin.class === 'human').length,
      demo: demoOnlySamples.filter((s) => s.origin.class === 'human').length,
      target: RESEARCH_CORPUS_TARGETS.human,
    },
    {
      label: 'AI-Generated',
      current: researchOnlySamples.filter((s) => s.origin.class === 'ai').length,
      demo: demoOnlySamples.filter((s) => s.origin.class === 'ai').length,
      target: RESEARCH_CORPUS_TARGETS.ai,
    },
    {
      label: 'Human-Edited AI',
      current: researchOnlySamples.filter((s) => s.origin.class === 'human_edited_ai').length,
      demo: demoOnlySamples.filter((s) => s.origin.class === 'human_edited_ai').length,
      target: RESEARCH_CORPUS_TARGETS.human_edited_ai,
    },
    {
      label: 'AI-Edited Human',
      current: researchOnlySamples.filter((s) => s.origin.class === 'ai_edited_human').length,
      demo: demoOnlySamples.filter((s) => s.origin.class === 'ai_edited_human').length,
      target: RESEARCH_CORPUS_TARGETS.ai_edited_human,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-mono text-sky-700 dark:text-sky-400">
              TEXTPRINT · Multilingual Stylometry &amp; Corpus Governance
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Writing Intelligence Research Overview
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
              Empirical investigation of human writing behavior, LLM stylometric patterns, human-AI co-editing trajectories, and calibrated probabilistic authorship across English and Arabic.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('ai_analysis')}
              className="px-4 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
            >
              Analyze Passage
            </button>
            <button
              type="button"
              onClick={() => onNavigate('acquisition')}
              className="px-4 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Import Corpus
            </button>
          </div>
        </div>
      </div>

      {/* Primary 30-Day Interactive Sparkline Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <InteractiveSparklineCard
          title="Active Datasets"
          series={trends30d.datasetsSeries}
          unitLabel="datasets"
          subtitle={`${datasets.filter((d) => !d.is_synthetic_demo).length} research · ${datasets.filter((d) => d.is_synthetic_demo).length} synthetic demo`}
          accentHex="#0ea5e9"
          onClick={() => onNavigate('datasets')}
        />

        <InteractiveSparklineCard
          title="Indexed Samples"
          series={trends30d.samplesSeries}
          unitLabel="samples"
          subtitle={`${researchOnlySamples.length} research · ${demoOnlySamples.length} synthetic demo`}
          accentHex="#6366f1"
          onClick={() => onNavigate('acquisition')}
        />

        <InteractiveSparklineCard
          title="Verified Samples"
          series={trends30d.verifiedSeries}
          unitLabel="verified"
          subtitle={`${verifiedSamples.length} verified · ${pendingSamples.length} pending · ${quarantinedSamples.length} quarantined`}
          accentHex="#10b981"
          onClick={() => onNavigate('datasets')}
        />

        <InteractiveSparklineCard
          title="Research Activity"
          series={trends30d.researchActivitySeries}
          unitLabel="events"
          subtitle={`${patterns.length} patterns (${approvedPatternsCount} approved) · ${experiments.length} runs`}
          accentHex="#f59e0b"
          onClick={() => onNavigate('training')}
        />
      </div>

      {/* Corpus Distribution & 3,000-Sample Research Target */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Origin &amp; Language Distribution
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Computed directly from loaded corpus records
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('datasets')}
              className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Inspect Corpus</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {(
              [
                ['Human Writing', originCounts.human, 'bg-emerald-600 dark:bg-emerald-500'],
                ['AI-Generated', originCounts.ai, 'bg-sky-600 dark:bg-sky-500'],
                ['Human-Edited AI', originCounts.human_edited_ai, 'bg-amber-600 dark:bg-amber-500'],
                ['AI-Edited Human', originCounts.ai_edited_human, 'bg-indigo-600 dark:bg-indigo-500'],
                ['Mixed-Origin', originCounts.mixed, 'bg-slate-600 dark:bg-slate-400'],
                ['Unknown / Unverified', originCounts.unknown, 'bg-rose-600 dark:bg-rose-500'],
              ] as const
            ).map(([label, count, barColor]) => {
              const pct = Math.round((count / totalCount) * 100);
              return (
                <div key={label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-300">{label}</span>
                    <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
                    <div
                      className={`h-full ${barColor} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-800 dark:text-slate-200">Languages:</span>
            {languages.map(([lang, cnt]) => (
              <span key={lang} className="font-mono tabular-nums">
                {lang}: {cnt}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                3,000-Sample Research Collection Target
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Synthetic demo records are excluded from research target counts
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('acquisition')}
              className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Acquire Data</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {targetRows.map((row) => {
              const pct = Math.min(100, (row.current / row.target) * 100);
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-300">{row.label}</span>
                    <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {row.current} / {row.target} research
                      {row.demo > 0 ? ` (+${row.demo} demo)` : ''}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-sky-600 dark:bg-sky-500"
                      style={{ width: `${Math.max(row.current > 0 ? 2 : 0, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Latest Evaluation</span>
              <p className="font-mono text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                {latestExperiment
                  ? `${latestExperiment.experiment_key} · F1 ${(latestExperiment.metrics.f1_score * 100).toFixed(1)}%`
                  : 'No runs recorded'}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Collection Jobs</span>
              <p className="font-mono text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                {jobs.length} configured · {jobs.filter((j) => j.execution_status === 'running').length} active
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Module Quick Access & Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Laboratory Pipeline Modules
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                id: 'linguistic' as ModuleId,
                title: '04. Linguistic Analysis Engine',
                desc: 'EN & Arabic (MSA/Egyptian) 6-category feature extraction & catalog.',
              },
              {
                id: 'stylometry' as ModuleId,
                title: '06. Stylometric Fingerprints',
                desc: 'Probabilistic author & LLM profiles with spider comparison.',
              },
              {
                id: 'compare' as ModuleId,
                title: '08. Comparative Laboratory',
                desc: 'Side-by-side text diff, feature deltas & Human/AI edit shifts.',
              },
              {
                id: 'training' as ModuleId,
                title: '09. Model Training & Evaluation',
                desc: 'Leakage-safe splits, exploratory gate & calibration metrics.',
              },
              {
                id: 'visuals' as ModuleId,
                title: '10. Knowledge Graph & Diagrams',
                desc: 'Interactive D3 force graph, feature trees & SVG/JSON export.',
              },
              {
                id: 'copilot' as ModuleId,
                title: '13. AI Research Copilot',
                desc: 'Multi-turn Gemini assistant with Search Grounding & Deep Thinking.',
              },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="text-left p-3.5 rounded-md border border-slate-200 dark:border-slate-800 hover:border-sky-500 dark:hover:border-sky-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {item.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Recent Activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('governance')}
              className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
            >
              Audit Log
            </button>
          </div>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No governance events recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {auditLogs.slice(0, 5).map((ev) => (
                <li key={ev.id} className="py-2.5 text-xs space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate">
                      {ev.action}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                      {ev.timestamp.slice(11, 19)}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 line-clamp-2">{ev.details}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
