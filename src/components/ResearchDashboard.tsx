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
import { summarizeCollectionJobs } from '../engine/collectionJobs';
import { buildDashboard30DayTrends, type SparklinePoint } from '../engine/dashboardTrends';
import { RESEARCH_CORPUS_TARGETS } from '../engine/demoCorpus';
import { UI_STRINGS, getOriginLabel } from '../engine/i18n';
import { useI18n } from '../lib/i18nContext';
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
  | 'governance'
  | 'admin_portal'
  | 'dictionary'
  | 'guide';

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
  windowLabel,
  onClick,
}: {
  title: string;
  series: SparklinePoint[];
  unitLabel: string;
  subtitle: string;
  accentHex: string;
  windowLabel: string;
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
      className="min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col justify-between gap-2 overflow-hidden"
      data-testid={`sparkline-card-${title.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')}`}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {onClick ? (
              <button
                type="button"
                onClick={onClick}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-400 font-medium text-start truncate max-w-full"
              >
                {title}
              </button>
            ) : (
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
                {title}
              </p>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-xl font-mono font-semibold text-slate-900 dark:text-slate-50 tabular-nums">
              {activePoint?.value ?? 0}
            </span>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums truncate max-w-full">
              {hoveredIdx !== null && activePoint
                ? `${activePoint.shortDate}${
                    activePoint.dailyDelta > 0 ? ` (+${activePoint.dailyDelta})` : ''
                  }`
                : `${unitLabel} · +${net30dDelta} (30d)`}
            </span>
          </div>
        </div>
        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
          {windowLabel}
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
            <Tooltip content={() => null} cursor={false} />
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
  const { lang, t } = useI18n();
  const isAr = lang === 'ar';

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
      label: getOriginLabel(lang, 'human'),
      current: researchOnlySamples.filter((s) => s.origin.class === 'human').length,
      demo: demoOnlySamples.filter((s) => s.origin.class === 'human').length,
      target: RESEARCH_CORPUS_TARGETS.human,
    },
    {
      label: getOriginLabel(lang, 'ai'),
      current: researchOnlySamples.filter((s) => s.origin.class === 'ai').length,
      demo: demoOnlySamples.filter((s) => s.origin.class === 'ai').length,
      target: RESEARCH_CORPUS_TARGETS.ai,
    },
    {
      label: getOriginLabel(lang, 'human_edited_ai'),
      current: researchOnlySamples.filter((s) => s.origin.class === 'human_edited_ai').length,
      demo: demoOnlySamples.filter((s) => s.origin.class === 'human_edited_ai').length,
      target: RESEARCH_CORPUS_TARGETS.human_edited_ai,
    },
    {
      label: getOriginLabel(lang, 'ai_edited_human'),
      current: researchOnlySamples.filter((s) => s.origin.class === 'ai_edited_human').length,
      demo: demoOnlySamples.filter((s) => s.origin.class === 'ai_edited_human').length,
      target: RESEARCH_CORPUS_TARGETS.ai_edited_human,
    },
  ];

  const moduleCards: Array<{ id: ModuleId; title: string; desc: string }> = [
    {
      id: 'guide',
      title: t(UI_STRINGS.modules.guide),
      desc: isAr
        ? 'دروس مبسطة للمبتدئين من الصفر مع أمثلة حية من المدونة وقاموس مصطلحات واضح.'
        : 'Step-by-step zero-knowledge walkthrough with real EN/AR samples & plain-language definitions.',
    },
    {
      id: 'dictionary',
      title: t(UI_STRINGS.modules.dictionary),
      desc: isAr
        ? 'إنشاء قواميس ثنائية اللغة، مخططات IPA والتشكيل العربي، وتصدير ‎.mdd و ‎.mdx و XDXF و TEI P5.'
        : 'Bilingual EN↔AR lexicon builder, IPA & Tashkeel symbol charts, linguistics plots & .mdd/.mdx exports.',
    },
    {
      id: 'linguistic',
      title: t(UI_STRINGS.modules.linguistic),
      desc: isAr
        ? 'استخراج ٦ فئات من الخصائص اللغوية للإنجليزية والعربية (الفصحى والعامية المصرية).'
        : 'EN & Arabic (MSA/Egyptian) 6-category feature extraction & transparent feature catalog.',
    },
    {
      id: 'stylometry',
      title: t(UI_STRINGS.modules.stylometry),
      desc: isAr
        ? 'بصمات أسلوبية احتمالية للمؤلفين والنماذج اللغوية مع مقارنة رادارية.'
        : 'Probabilistic author & LLM profiles with multi-axis radar comparison.',
    },
    {
      id: 'compare',
      title: t(UI_STRINGS.modules.compare),
      desc: isAr
        ? 'مقارنة نصين جنباً إلى جنب مع فروق الخصائص ومسار التحرير البشري/الآلي.'
        : 'Side-by-side text diff, feature deltas & Human/AI edit shifts.',
    },
    {
      id: 'training',
      title: t(UI_STRINGS.modules.training),
      desc: isAr
        ? 'تقسيمات محمية من التسرب وبوابة العينات الاستكشافية ومقاييس المعايرة.'
        : 'Leakage-safe splits, exploratory gate & calibration metrics.',
    },
    {
      id: 'visuals',
      title: t(UI_STRINGS.modules.visuals),
      desc: isAr
        ? 'رسم معرفي تفاعلي بـ D3 وتصورات خط الأنابيب مع تصدير SVG/PNG/JSON.'
        : 'Interactive D3 force graph, feature trees & SVG/PNG/JSON export.',
    },
    {
      id: 'copilot',
      title: t(UI_STRINGS.modules.copilot),
      desc: isAr
        ? 'مساعد بحثي ثنائي اللغة يعمل محلياً على الاستضافة الساكنة أو عبر Gemini Cloud Run.'
        : 'Bilingual research copilot with automatic static-hosting fallback & live Gemini mode.',
    },
  ];

  return (
    <div className="space-y-6 min-w-0">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 sm:p-6 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 min-w-0">
          <div className="space-y-1.5 min-w-0 flex-1">
            <p className="text-xs font-mono text-sky-700 dark:text-sky-400 break-words">
              {t(UI_STRINGS.appName)} · {t(UI_STRINGS.appSubtitle)}
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 break-words">
              {isAr
                ? 'نظرة عامة على مختبر أبحاث ذكاء الكتابة والأسلوبية'
                : 'Writing Intelligence Research Overview'}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl break-words">
              {isAr
                ? 'دراسة علمية قابلة للتحقق لأساليب الكتابة البشرية، وبصمات النماذج اللغوية، والتحرير المشترك بين الإنسان والذكاء الاصطناعي بالعربية والإنجليزية.'
                : 'Empirical investigation of human writing behavior, LLM stylometric patterns, human-AI co-editing trajectories, and calibrated probabilistic authorship across English and Arabic.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('guide')}
              className="px-3.5 py-2 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
            >
              {t(UI_STRINGS.actions.openGuide)}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('ai_analysis')}
              className="px-3.5 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
            >
              {t(UI_STRINGS.actions.analyzePassage)}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('dictionary')}
              className="px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {t(UI_STRINGS.actions.openDictionary)}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('acquisition')}
              className="px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {t(UI_STRINGS.actions.importCorpus)}
            </button>
          </div>
        </div>
      </div>

      {/* Primary 30-Day Interactive Sparkline Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <InteractiveSparklineCard
          title={isAr ? 'المدونات النشطة' : 'Active Datasets'}
          series={trends30d.datasetsSeries}
          unitLabel={isAr ? 'مدونة' : 'datasets'}
          windowLabel={isAr ? '٣٠ي' : '30d'}
          subtitle={`${datasets.filter((d) => !d.is_synthetic_demo).length} ${isAr ? 'بحثي' : 'research'} · ${datasets.filter((d) => d.is_synthetic_demo).length} ${isAr ? 'تجريبي' : 'synthetic demo'}`}
          accentHex="#0ea5e9"
          onClick={() => onNavigate('datasets')}
        />

        <InteractiveSparklineCard
          title={isAr ? 'العينات المفهرسة' : 'Indexed Samples'}
          series={trends30d.samplesSeries}
          unitLabel={isAr ? 'عينة' : 'samples'}
          windowLabel={isAr ? '٣٠ي' : '30d'}
          subtitle={`${researchOnlySamples.length} ${isAr ? 'بحثي' : 'research'} · ${demoOnlySamples.length} ${isAr ? 'تجريبي' : 'synthetic demo'}`}
          accentHex="#6366f1"
          onClick={() => onNavigate('acquisition')}
        />

        <InteractiveSparklineCard
          title={isAr ? 'العينات الموثّقة' : 'Verified Samples'}
          series={trends30d.verifiedSeries}
          unitLabel={isAr ? 'موثقة' : 'verified'}
          windowLabel={isAr ? '٣٠ي' : '30d'}
          subtitle={`${verifiedSamples.length} ${isAr ? 'موثقة' : 'verified'} · ${pendingSamples.length} ${isAr ? 'معلقة' : 'pending'} · ${quarantinedSamples.length} ${isAr ? 'معزولة' : 'quarantined'}`}
          accentHex="#10b981"
          onClick={() => onNavigate('datasets')}
        />

        <InteractiveSparklineCard
          title={isAr ? 'النشاط البحثي' : 'Research Activity'}
          series={trends30d.researchActivitySeries}
          unitLabel={isAr ? 'حدث' : 'events'}
          windowLabel={isAr ? '٣٠ي' : '30d'}
          subtitle={`${patterns.length} ${isAr ? 'نمط' : 'patterns'} (${approvedPatternsCount} ${isAr ? 'معتمد' : 'approved'}) · ${experiments.length} ${isAr ? 'تجربة' : 'runs'}`}
          accentHex="#f59e0b"
          onClick={() => onNavigate('training')}
        />
      </div>

      {/* Corpus Distribution & 3,000-Sample Research Target */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 break-words">
                {isAr ? 'توزيع الأصل واللغة في المدونة' : 'Origin & Language Distribution'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
                {isAr ? 'محسوب مباشرةً من سجلات المدونة المحمّلة' : 'Computed directly from loaded corpus records'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('datasets')}
              className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline inline-flex items-center gap-1 shrink-0"
            >
              <span>{isAr ? 'فحص المدونة' : 'Inspect Corpus'}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>

          <div className="space-y-2.5">
            {(
              [
                ['human', originCounts.human, 'bg-emerald-600 dark:bg-emerald-500'],
                ['ai', originCounts.ai, 'bg-sky-600 dark:bg-sky-500'],
                ['human_edited_ai', originCounts.human_edited_ai, 'bg-amber-600 dark:bg-amber-500'],
                ['ai_edited_human', originCounts.ai_edited_human, 'bg-indigo-600 dark:bg-indigo-500'],
                ['mixed', originCounts.mixed, 'bg-slate-600 dark:bg-slate-400'],
                ['unknown', originCounts.unknown, 'bg-rose-600 dark:bg-rose-500'],
              ] as const
            ).map(([originKey, count, barColor]) => {
              const pct = Math.round((count / totalCount) * 100);
              const label = getOriginLabel(lang, originKey);
              return (
                <div key={originKey} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-700 dark:text-slate-300 truncate">{label}</span>
                    <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400 shrink-0">
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
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {isAr ? 'اللغات:' : 'Languages:'}
            </span>
            {languages.map(([langCode, cnt]) => (
              <span key={langCode} className="font-mono tabular-nums">
                {langCode}: {cnt}
              </span>
            ))}
          </div>
        </div>

        <div className="min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 break-words">
                {isAr ? 'الهدف البحثي: ٣٬٠٠٠ عينة موثّقة' : '3,000-Sample Research Collection Target'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
                {isAr
                  ? 'تُستبعد السجلات التجريبية الاصطناعية من عدّاد الهدف البحثي'
                  : 'Synthetic demo records are excluded from research target counts'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('acquisition')}
              className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline inline-flex items-center gap-1 shrink-0"
            >
              <span>{isAr ? 'استقطاب البيانات' : 'Acquire Data'}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>

          <div className="space-y-3">
            {targetRows.map((row) => {
              const pct = Math.min(100, (row.current / row.target) * 100);
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-700 dark:text-slate-300 truncate">{row.label}</span>
                    <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400 shrink-0">
                      {row.current} / {row.target} {isAr ? 'بحثي' : 'research'}
                      {row.demo > 0 ? ` (+${row.demo} ${isAr ? 'تجريبي' : 'demo'})` : ''}
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

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="min-w-0">
              <span className="text-slate-500 dark:text-slate-400">
                {isAr ? 'أحدث تقييم' : 'Latest Evaluation'}
              </span>
              <p className="font-mono text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums break-words">
                {latestExperiment
                  ? `${latestExperiment.experiment_key} · F1 ${(latestExperiment.metrics.f1_score * 100).toFixed(1)}%`
                  : isAr
                    ? 'لم تُسجل تجارب بعد'
                    : 'No runs recorded'}
              </p>
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  {isAr ? 'مهام الاستقطاب' : 'Collection Jobs'}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                  {summarizeCollectionJobs(jobs).averagePercent}%
                </span>
              </div>
              <p className="font-mono text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                {jobs.length} {isAr ? 'مُهيّأة' : 'configured'} · {jobs.filter((j) => j.execution_status === 'running').length} {isAr ? 'نشطة' : 'active'}
              </p>
              <div
                role="progressbar"
                aria-label="Collection jobs overall progress"
                aria-valuenow={summarizeCollectionJobs(jobs).averagePercent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-1.5 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-sky-600 dark:bg-sky-500 transition-all duration-300"
                  style={{ width: `${summarizeCollectionJobs(jobs).averagePercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Module Quick Access & Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {isAr ? 'وحدات خط الأنابيب البحثي والتعليمي' : 'Laboratory Pipeline Modules'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {moduleCards.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="min-w-0 text-start p-3.5 rounded-md border border-slate-200 dark:border-slate-800 hover:border-sky-500 dark:hover:border-sky-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors overflow-hidden"
              >
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words">
                  {item.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-words">
                  {item.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {isAr ? 'أحدث الأنشطة' : 'Recent Activity'}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('governance')}
              className="text-xs text-sky-700 dark:text-sky-400 hover:underline shrink-0"
            >
              {isAr ? 'سجل التدقيق' : 'Audit Log'}
            </button>
          </div>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAr ? 'لا توجد أحداث حوكمة مسجلة بعد.' : 'No governance events recorded yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {auditLogs.slice(0, 5).map((ev) => (
                <li key={ev.id} className="py-2.5 text-xs space-y-0.5 min-w-0">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate">
                      {ev.action}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                      {ev.timestamp.slice(11, 19)}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 line-clamp-2 break-words">
                    {ev.details}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
