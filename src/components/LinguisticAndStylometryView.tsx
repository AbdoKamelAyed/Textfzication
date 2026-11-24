import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  buildStylometricProfiles,
  compareProfilesSimilarity,
} from '../engine/comparison';
import { DEMO_SAMPLES } from '../engine/demoCorpus';
import {
  analyzeTextLinguistics,
  FEATURE_CATALOG,
} from '../engine/linguistic';
import type {
  PatternStatus,
  TextSample,
  WritingPattern,
} from '../engine/types';
import { classifyTextProbabilistically } from '../engine/classifier';
import { buildLocalDeterministicMemo } from '../engine/connectivityMonitor';
import { useI18n } from '../lib/i18nContext';
import { safeFetchJson } from '../lib/safeFetchJson';

interface Props {
  initialSubView: 'linguistic' | 'patterns' | 'stylometry';
  samples: TextSample[];
  patterns: WritingPattern[];
  onUpdatePatternStatus: (patternId: string, nextStatus: PatternStatus) => void;
}

function RadarChartSvg({
  profileA,
  profileB,
}: {
  profileA: ReturnType<typeof buildStylometricProfiles>[number];
  profileB?: ReturnType<typeof buildStylometricProfiles>[number];
}) {
  const axes = [
    { label: 'Sent Len', get: (m: typeof profileA.metrics) => Math.min(1, m.avg_sentence_length / 32) },
    { label: 'Burstiness', get: (m: typeof profileA.metrics) => Math.min(1, m.burstiness_index / 0.7) },
    { label: 'Guiraud R', get: (m: typeof profileA.metrics) => Math.min(1, m.guiraud_r / 10) },
    { label: 'Hapax', get: (m: typeof profileA.metrics) => Math.min(1, m.hapax_ratio) },
    { label: 'Transitions', get: (m: typeof profileA.metrics) => Math.min(1, m.transition_density / 4) },
    { label: 'Formality', get: (m: typeof profileA.metrics) => Math.min(1, m.formality_score) },
    { label: 'Punct Ent.', get: (m: typeof profileA.metrics) => Math.min(1, m.punctuation_entropy / 2.5) },
  ];

  const cx = 160;
  const cy = 145;
  const rMax = 96;

  const toPoints = (metrics: typeof profileA.metrics) =>
    axes
      .map((ax, idx) => {
        const angle = (Math.PI * 2 * idx) / axes.length - Math.PI / 2;
        const val = Math.max(0.08, ax.get(metrics));
        return `${cx + Math.cos(angle) * rMax * val},${cy + Math.sin(angle) * rMax * val}`;
      })
      .join(' ');

  return (
    <svg viewBox="0 0 320 290" className="w-full max-w-[340px] mx-auto" role="img" aria-label="Stylometric fingerprint radar comparison">
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon
          key={ring}
          points={axes
            .map((_, idx) => {
              const angle = (Math.PI * 2 * idx) / axes.length - Math.PI / 2;
              return `${cx + Math.cos(angle) * rMax * ring},${cy + Math.sin(angle) * rMax * ring}`;
            })
            .join(' ')}
          fill="none"
          className="stroke-slate-200 dark:stroke-slate-800"
          strokeWidth={1}
        />
      ))}
      {axes.map((ax, idx) => {
        const angle = (Math.PI * 2 * idx) / axes.length - Math.PI / 2;
        const x2 = cx + Math.cos(angle) * rMax;
        const y2 = cy + Math.sin(angle) * rMax;
        const lx = cx + Math.cos(angle) * (rMax + 22);
        const ly = cy + Math.sin(angle) * (rMax + 16);
        return (
          <g key={ax.label}>
            <line
              x1={cx}
              y1={cy}
              x2={x2}
              y2={y2}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth={1}
            />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-600 dark:fill-slate-400 text-[9px] font-mono"
            >
              {ax.label}
            </text>
          </g>
        );
      })}
      <polygon
        points={toPoints(profileA.metrics)}
        className="fill-sky-500/25 stroke-sky-600 dark:stroke-sky-400"
        strokeWidth={2}
      />
      {profileB && (
        <polygon
          points={toPoints(profileB.metrics)}
          className="fill-amber-500/20 stroke-amber-600 dark:stroke-amber-400"
          strokeWidth={2}
          strokeDasharray="4 2"
        />
      )}
    </svg>
  );
}

export function LinguisticAndStylometryView({
  initialSubView,
  samples,
  patterns,
  onUpdatePatternStatus,
}: Props) {
  const { lang } = useI18n();
  const isAr = lang === 'ar';
  const [subView, setSubView] = useState<'linguistic' | 'patterns' | 'stylometry'>(initialSubView);
  useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);
  const [activeSampleId, setActiveSampleId] = useState(samples[0]?.sample_id ?? DEMO_SAMPLES[0].sample_id);
  const [customText, setCustomText] = useState(samples[0]?.text ?? DEMO_SAMPLES[0].text);
  const [deepMemo, setDeepMemo] = useState<string | null>(null);
  const [deepMemoSource, setDeepMemoSource] = useState<'gemini' | 'local' | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepError, setDeepError] = useState<string | null>(null);

  const metrics = useMemo(() => analyzeTextLinguistics(customText), [customText]);
  const profiles = useMemo(() => buildStylometricProfiles(samples), [samples]);
  const [profileAId, setProfileAId] = useState<string>(profiles[0]?.profile_id ?? '');
  const [profileBId, setProfileBId] = useState<string>(profiles[1]?.profile_id ?? '');

  const profileA = profiles.find((p) => p.profile_id === profileAId) ?? profiles[0];
  const profileB = profiles.find((p) => p.profile_id === profileBId) ?? profiles[1];
  const profileSim =
    profileA && profileB ? compareProfilesSimilarity(profileA, profileB) : null;

  const handleLoadSample = (sid: string) => {
    setActiveSampleId(sid);
    const found = samples.find((s) => s.sample_id === sid);
    if (found) {
      setCustomText(found.text);
      setDeepMemo(null);
    }
  };

  const handleRunDeepThinkingMemo = async () => {
    setDeepLoading(true);
    setDeepError(null);
    try {
      const result = await safeFetchJson<{ analysis?: string }>(
        '/api/ai/analyze-deep',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: customText,
            metricsSummary: {
              language: metrics.detected_language,
              dialect: metrics.detected_dialect,
              word_count: metrics.word_count,
              guiraud_r: metrics.vocabulary.guiraud_r,
              burstiness_index: metrics.sentence_structure.burstiness_index,
              transition_density: metrics.writing_style.transition_density,
              punctuation_entropy: metrics.punctuation.punctuation_entropy,
              passive_voice_ratio: metrics.additional.passive_voice_ratio,
            },
          }),
        },
        'Deep Thinking Gemini analysis requires the Express backend server (not available on static hosting).'
      );
      if (!result.ok || !result.data) {
        if (result.isHtmlFallback) {
          const localClassification = classifyTextProbabilistically(customText);
          setDeepMemo(buildLocalDeterministicMemo(metrics, localClassification));
          setDeepMemoSource('local');
          setDeepError(
            `${result.error} Displaying local deterministic stylometric summary below (or attach an Express Cloud Run URL in 14. Admin & Governance).`
          );
          return;
        }
        throw new Error(result.error || 'Deep analysis failed.');
      }
      setDeepMemo(result.data.analysis || '');
      setDeepMemoSource('gemini');
    } catch (err) {
      setDeepError(err instanceof Error ? err.message : 'Deep analysis request failed.');
    } finally {
      setDeepLoading(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 break-words">
            {isAr
              ? '04–06. التحليل اللغوي والأنماط والبصمات الأسلوبية'
              : '04–06. Linguistic Analysis, Patterns & Stylometry'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 break-words">
            {isAr
              ? 'استخراج الخصائص العربية والإنجليزية، ودورة اعتماد الأنماط، والبصمات الأسلوبية الاحتمالية.'
              : 'Multilingual EN/AR feature extraction, validated pattern lifecycle, and probabilistic stylometric profiles.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-full shrink-0">
          {(
            [
              ['linguistic', isAr ? '04. المحرك اللغوي' : '04. Linguistic Engine'],
              ['patterns', isAr ? '05. اكتشاف الأنماط' : '05. Pattern Discovery'],
              ['stylometry', isAr ? '06. البصمات الأسلوبية' : '06. Fingerprints'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubView(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                subView === id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {subView === 'linguistic' && (
        <div className="space-y-6">
          <div className="min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                <label
                  htmlFor="ling-sample-select"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 shrink-0"
                >
                  {isAr ? 'تحميل عينة:' : 'Load Corpus Sample:'}
                </label>
                <select
                  id="ling-sample-select"
                  value={activeSampleId}
                  onChange={(e) => handleLoadSample(e.target.value)}
                  className="max-w-full min-w-0 px-3 py-1.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {samples.map((s) => (
                    <option key={s.sample_id} value={s.sample_id}>
                      {s.sample_id} ({s.language.toUpperCase()} · {s.origin.class})
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 break-words">
                Engine {metrics.engine_version} · {metrics.detected_language.toUpperCase()}
                {metrics.detected_dialect ? ` (${metrics.detected_dialect})` : ''}
              </span>
            </div>

            <textarea
              aria-label="Passage for linguistic analysis"
              rows={5}
              dir={metrics.is_rtl ? 'rtl' : 'ltr'}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                {metrics.word_count} words · {metrics.sentence_structure.sentence_count} sentences ·{' '}
                {metrics.paragraph_structure.paragraph_count} paragraphs ·{' '}
                {metrics.is_rtl ? 'RTL layout' : 'LTR layout'}
              </div>
              <button
                type="button"
                onClick={handleRunDeepThinkingMemo}
                disabled={deepLoading || metrics.word_count < 8}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{deepLoading ? 'Reasoning (ThinkingLevel.HIGH)...' : 'Generate Deep Stylometry Memo'}</span>
              </button>
            </div>

            {deepError && (
              <p role="alert" className="text-xs text-amber-700 dark:text-amber-400">
                {deepError}
              </p>
            )}
            {deepMemo && (
              <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <p className="text-xs font-mono font-medium text-sky-700 dark:text-sky-400">
                  {deepMemoSource === 'local'
                    ? `Local Deterministic Stylometry Memo (${metrics.engine_version} · Offline Fallback)`
                    : 'Gemini Deep Reasoning Memo (gemini-4-hydrogen · ThinkingLevel.HIGH)'}
                </p>
                <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {deepMemo}
                </div>
              </div>
            )}
          </div>

          {/* 6-Category Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2 text-xs">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">A. Vocabulary</h2>
              <div className="grid grid-cols-2 gap-y-1.5 font-mono tabular-nums">
                <span className="text-slate-500 dark:text-slate-400">Unique / TTR</span>
                <span className="text-right text-slate-900 dark:text-slate-100">
                  {metrics.vocabulary.unique_words} ({metrics.vocabulary.ttr})
                </span>
                <span className="text-slate-500 dark:text-slate-400">Guiraud R</span>
                <span className="text-right text-slate-900 dark:text-slate-100">{metrics.vocabulary.guiraud_r}</span>
                <span className="text-slate-500 dark:text-slate-400">Hapax Ratio</span>
                <span className="text-right text-slate-900 dark:text-slate-100">{metrics.vocabulary.hapax_legomena_ratio}</span>
                <span className="text-slate-500 dark:text-slate-400">Avg Word Len</span>
                <span className="text-right text-slate-900 dark:text-slate-100">{metrics.vocabulary.avg_word_length} ch</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2 text-xs">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">B. Sentence Structure</h2>
              <div className="grid grid-cols-2 gap-y-1.5 font-mono tabular-nums">
                <span className="text-slate-500 dark:text-slate-400">Mean Length</span>
                <span className="text-right text-slate-900 dark:text-slate-100">{metrics.sentence_structure.avg_sentence_length} w</span>
                <span className="text-slate-500 dark:text-slate-400">Burstiness (CV)</span>
                <span className="text-right text-slate-900 dark:text-slate-100">{metrics.sentence_structure.burstiness_index}</span>
                <span className="text-slate-500 dark:text-slate-400">Min / Max Len</span>
                <span className="text-right text-slate-900 dark:text-slate-100">
                  {metrics.sentence_structure.min_sentence_length} / {metrics.sentence_structure.max_sentence_length}
                </span>
                <span className="text-slate-500 dark:text-slate-400">Clause Density</span>
                <span className="text-right text-slate-900 dark:text-slate-100">{metrics.sentence_structure.clause_density}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2 text-xs">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">C. Paragraph &amp; D. Punctuation</h2>
              <div className="grid grid-cols-2 gap-y-1.5 font-mono tabular-nums">
                <span className="text-slate-500 dark:text-slate-400">Para CV</span>
                <span className="text-right text-slate-900 dark:text-slate-100">{metrics.paragraph_structure.paragraph_consistency_cv}</span>
                <span className="text-slate-500 dark:text-slate-400">Punct Entropy</span>
                <span className="text-right text-slate-900 dark:text-slate-100">{metrics.punctuation.punctuation_entropy} bits</span>
                <span className="text-slate-500 dark:text-slate-400">Commas / 1k</span>
                <span className="text-right text-slate-900 dark:text-slate-100">{metrics.punctuation.comma_per_1k}</span>
                <span className="text-slate-500 dark:text-slate-400">Dashes / 1k</span>
                <span className="text-right text-slate-900 dark:text-slate-100">{metrics.punctuation.dash_per_1k}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2 text-xs">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">E. Writing Style</h2>
              <div className="grid grid-cols-2 gap-y-1.5 font-mono tabular-nums">
                <span className="text-slate-500 dark:text-slate-400">Formality</span>
                <span className="text-right text-slate-900 dark:text-slate-100">{metrics.writing_style.formality_score}</span>
                <span className="text-slate-500 dark:text-slate-400">Directness</span>
                <span className="text-right text-slate-900 dark:text-slate-100">{metrics.writing_style.directness_score}</span>
                <span className="text-slate-500 dark:text-slate-400">Transitions/100w</span>
                <span className="text-right text-slate-900 dark:text-slate-100">{metrics.writing_style.transition_density}</span>
                <span className="text-slate-500 dark:text-slate-400">Cohesion</span>
                <span className="text-right text-slate-900 dark:text-slate-100">{metrics.writing_style.cohesion_score}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2 text-xs md:col-span-2">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                F. Additional Signals &amp; Readability
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Readability</span>
                  <span className="text-slate-900 dark:text-slate-100">{metrics.additional.readability_score}</span>
                  <span className="text-[10px] text-slate-400 block">{metrics.additional.readability_scale}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Passive Voice</span>
                  <span className="text-slate-900 dark:text-slate-100">{(metrics.additional.passive_voice_ratio * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Function Words</span>
                  <span className="text-slate-900 dark:text-slate-100">{(metrics.additional.function_word_ratio * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Top Bigram</span>
                  <span className="text-slate-900 dark:text-slate-100">
                    {metrics.additional.top_bigrams[0]?.gram || '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Specification Catalog */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Documented Feature Catalog ({FEATURE_CATALOG.length} registered features)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-4 font-medium">Feature ID</th>
                    <th className="py-2 pr-4 font-medium">Definition</th>
                    <th className="py-2 pr-4 font-medium">Languages · Ver</th>
                    <th className="py-2 font-medium">Reliability Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {FEATURE_CATALOG.map((f) => (
                    <tr key={f.feature_id}>
                      <td className="py-2.5 pr-4 font-mono text-slate-900 dark:text-slate-100 align-top">
                        {f.feature_id}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300 align-top max-w-xs">
                        {f.definition}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-slate-600 dark:text-slate-400 align-top whitespace-nowrap">
                        {f.supported_languages.join(', ')} · v{f.version}
                      </td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-400 align-top max-w-sm">
                        {f.reliability_notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subView === 'patterns' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              05. Writing Pattern Recognition Registry
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Separates observed patterns and experimental hypotheses from statistically supported and approved findings. No pattern is auto-promoted without researcher validation.
            </p>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {patterns.map((pat) => (
              <div key={pat.pattern_id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
                <div className="space-y-1 max-w-3xl min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {pat.pattern_id}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-sky-700 dark:text-sky-400">
                      Status: {pat.validation_status}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      Confidence {(pat.confidence * 100).toFixed(0)}% · Freq {(pat.frequency * 100).toFixed(0)}%
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">
                    {pat.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 break-words">{pat.description}</p>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 break-words">
                    Method: {pat.discovery_method} · Samples: {pat.supporting_samples.join(', ')}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    aria-label={`Validation stage for ${pat.pattern_id}`}
                    value={pat.validation_status}
                    onChange={(e) =>
                      onUpdatePatternStatus(pat.pattern_id, e.target.value as PatternStatus)
                    }
                    className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="observed">Observed Pattern</option>
                    <option value="hypothesis">Experimental Hypothesis</option>
                    <option value="statistically_supported">Statistically Supported</option>
                    <option value="approved">Approved Finding</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subView === 'stylometry' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              06. Stylometric Fingerprint Profiles
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Notice: A writing fingerprint is a probabilistic statistical profile, not an identity verification mechanism. Author profiles use pseudonymous IDs with explicit consent controls.
            </p>
          </div>

          {profiles.length < 2 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              At least two distinct corpus profiles are required for comparison.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-5">
                {profileA && <RadarChartSvg profileA={profileA} profileB={profileB} />}
              </div>
              <div className="lg:col-span-7 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="prof-a"
                      className="block text-xs font-medium text-sky-700 dark:text-sky-400 mb-1"
                    >
                      Primary Profile (Solid Blue)
                    </label>
                    <select
                      id="prof-a"
                      value={profileA?.profile_id}
                      onChange={(e) => setProfileAId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    >
                      {profiles.map((p) => (
                        <option key={p.profile_id} value={p.profile_id}>
                          {p.label} ({p.sample_count} samples)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="prof-b"
                      className="block text-xs font-medium text-amber-700 dark:text-amber-400 mb-1"
                    >
                      Comparison Profile (Dashed Amber)
                    </label>
                    <select
                      id="prof-b"
                      value={profileB?.profile_id}
                      onChange={(e) => setProfileBId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    >
                      {profiles.map((p) => (
                        <option key={p.profile_id} value={p.profile_id}>
                          {p.label} ({p.sample_count} samples)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {profileSim !== null && profileA && profileB && (
                  <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Cosine Stylometric Similarity
                      </span>
                      <span className="font-mono text-base font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {(profileSim * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">
                      Consent status: {profileA.consent_status} · {profileB.consent_status}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
