import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { classifyTextProbabilistically } from '../engine/classifier';
import { compareTexts } from '../engine/comparison';
import { DEMO_SAMPLES } from '../engine/demoCorpus';
import { getOriginLabel } from '../engine/i18n';
import { useI18n } from '../lib/i18nContext';
import type { ClassificationLabel, TextSample } from '../engine/types';

interface Props {
  initialSubView: 'ai_analysis' | 'compare';
  samples: TextSample[];
}

export function AiAnalysisAndCompareView({ initialSubView, samples }: Props) {
  const { lang } = useI18n();
  const isAr = lang === 'ar';
  const [subView, setSubView] = useState<'ai_analysis' | 'compare'>(initialSubView);
  useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);
  const [selectedSampleId, setSelectedSampleId] = useState(
    samples[0]?.sample_id ?? DEMO_SAMPLES[0].sample_id
  );
  const [textInput, setTextInput] = useState(samples[0]?.text ?? DEMO_SAMPLES[0].text);

  // Comparative lab states
  const [leftId, setLeftId] = useState(samples[0]?.sample_id ?? DEMO_SAMPLES[0].sample_id);
  const [rightId, setRightId] = useState(
    samples[1]?.sample_id ?? samples[0]?.sample_id ?? DEMO_SAMPLES[1].sample_id
  );
  const [leftText, setLeftText] = useState(samples[0]?.text ?? DEMO_SAMPLES[0].text);
  const [rightText, setRightText] = useState(
    samples[1]?.text ?? samples[0]?.text ?? DEMO_SAMPLES[1].text
  );

  const classification = useMemo(
    () => classifyTextProbabilistically(textInput),
    [textInput]
  );

  const comparison = useMemo(
    () => compareTexts(leftText, rightText),
    [leftText, rightText]
  );

  const probEntries = Object.entries(classification.probabilities) as [
    ClassificationLabel,
    number,
  ][];

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 break-words">
            {isAr
              ? '07–08. التحليل الاحتمالي بالذكاء الاصطناعي والمختبر المقارن'
              : '07–08. Probabilistic AI Analysis & Comparative Laboratory'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 break-words">
            {isAr
              ? 'تصنيف احتمالي متعدد الإشارات مع حدود عدم اليقين ومقارنة أسلوبية جنباً إلى جنب.'
              : 'Calibrated multi-signal origin classification with explicit uncertainty bounds and side-by-side stylometric comparison.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-full shrink-0">
          <button
            type="button"
            onClick={() => setSubView('ai_analysis')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subView === 'ai_analysis'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {isAr ? '07. التحليل الاحتمالي' : '07. AI Text Analysis'}
          </button>
          <button
            type="button"
            onClick={() => setSubView('compare')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subView === 'compare'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {isAr ? '08. المختبر المقارن' : '08. Comparative Lab'}
          </button>
        </div>
      </div>

      {subView === 'ai_analysis' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
              <label
                htmlFor="ai-sample-select"
                className="text-xs font-medium text-slate-700 dark:text-slate-300 shrink-0"
              >
                {isAr ? 'عينة من المدونة' : 'Sample Passage'}
              </label>
              <select
                id="ai-sample-select"
                value={selectedSampleId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedSampleId(id);
                  const found = samples.find((s) => s.sample_id === id);
                  if (found) setTextInput(found.text);
                }}
                className="max-w-full min-w-0 flex-1 sm:flex-initial px-2.5 py-1.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                {samples.map((s) => (
                  <option key={s.sample_id} value={s.sample_id}>
                    {s.sample_id} · {s.origin.class} ({s.language.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <textarea
              aria-label="Text to evaluate probabilistically"
              rows={9}
              dir="auto"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={
                isAr
                  ? 'ألصق نصاً عربياً أو إنجليزياً (يُفضّل >= ٤٠ كلمة)...'
                  : 'Paste English or Arabic text (>= 40 words recommended)...'
              }
              className="w-full px-3.5 py-2.5 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 leading-relaxed"
            />

            <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">
                {isAr
                  ? 'تقدير بحثي احتمالي فقط؛ لا يمكن إثبات التأليف بشكل قطعي من الأسلوب وحده، لذا يُعامل التوزيع الاحتمالي كدلالة إرشادية مع مراجعة بشرية.'
                  : 'Probabilistic research estimate only. Authorship cannot be established with absolute certainty; treat outputs as calibrated signal distributions alongside human review.'}
              </span>
            </div>
          </div>

          <div className="lg:col-span-6 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr ? 'التصنيف المعاير' : 'Calibrated Classification'} ({classification.model_version})
                </p>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 break-words">
                  {getOriginLabel(lang, classification.predicted_label)}
                </h2>
              </div>
              <div className="text-right font-mono tabular-nums">
                <p className="text-lg font-semibold text-sky-700 dark:text-sky-400">
                  {(classification.calibrated_confidence * 100).toFixed(1)}%
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  ±{(classification.confidence_margin * 100).toFixed(1)}% margin
                </p>
              </div>
            </div>

            {/* 6-Class Posterior Distribution */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Calibrated Posterior Distribution
              </p>
              {probEntries
                .sort((a, b) => b[1] - a[1])
                .map(([label, prob]) => (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 dark:text-slate-300">{label}</span>
                      <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {(prob * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
                      <div
                        className={`h-full ${
                          label === classification.predicted_label
                            ? 'bg-sky-600 dark:bg-sky-400'
                            : 'bg-slate-400 dark:bg-slate-600'
                        }`}
                        style={{ width: `${Math.round(prob * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>

            {/* Evidence & Uncertainty */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Supporting Signals
                </p>
                <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                  {classification.supporting_evidence.map((ev, i) => (
                    <li key={i}>• {ev}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Contradictory &amp; Uncertainty
                </p>
                <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                  {classification.contradictory_evidence.map((ev, i) => (
                    <li key={`c-${i}`}>• Contra: {ev}</li>
                  ))}
                  {classification.uncertainty_indicators.map((u, i) => (
                    <li key={`u-${i}`}>• Uncertainty: {u}</li>
                  ))}
                  {classification.contradictory_evidence.length === 0 &&
                    classification.uncertainty_indicators.length === 0 && (
                      <li>• Signals align consistently across measured features.</li>
                    )}
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <p className="font-medium text-slate-700 dark:text-slate-300">
                Calibration &amp; Known Limitations ({classification.calibration_method})
              </p>
              {classification.known_limitations.map((lim, i) => (
                <p key={i}>— {lim}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {subView === 'compare' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 shrink-0">
                  {isAr ? 'النص المرجعي أ' : 'Reference Text A'}
                </span>
                <select
                  aria-label="Select Reference Text A"
                  value={leftId}
                  onChange={(e) => {
                    setLeftId(e.target.value);
                    const found = samples.find((s) => s.sample_id === e.target.value);
                    if (found) setLeftText(found.text);
                  }}
                  className="max-w-full min-w-0 flex-1 sm:flex-initial px-2 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {samples.map((s) => (
                    <option key={s.sample_id} value={s.sample_id}>
                      {s.sample_id} ({s.origin.class})
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                aria-label="Reference Text A content"
                rows={7}
                dir="auto"
                value={leftText}
                onChange={(e) => setLeftText(e.target.value)}
                className="w-full px-3 py-2 text-xs leading-relaxed rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 shrink-0">
                  {isAr ? 'النص المقارن ب' : 'Comparison Text B'}
                </span>
                <select
                  aria-label="Select Comparison Text B"
                  value={rightId}
                  onChange={(e) => {
                    setRightId(e.target.value);
                    const found = samples.find((s) => s.sample_id === e.target.value);
                    if (found) setRightText(found.text);
                  }}
                  className="max-w-full min-w-0 flex-1 sm:flex-initial px-2 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {samples.map((s) => (
                    <option key={s.sample_id} value={s.sample_id}>
                      {s.sample_id} ({s.origin.class})
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                aria-label="Comparison Text B content"
                rows={7}
                dir="auto"
                value={rightText}
                onChange={(e) => setRightText(e.target.value)}
                className="w-full px-3 py-2 text-xs leading-relaxed rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isAr ? 'فروق الخصائص الكمية (ب − أ)' : 'Quantitative Feature Deltas (B − A)'}
                </h2>
                <span className="font-mono text-sky-700 dark:text-sky-400 tabular-nums">
                  Cosine Sim {(comparison.stylometric_cosine_similarity * 100).toFixed(1)}% · Jaccard{' '}
                  {(comparison.lexical_jaccard_similarity * 100).toFixed(1)}%
                </span>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse font-mono tabular-nums min-w-[360px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-start">
                    <th className="py-1.5 font-medium">{isAr ? 'المقياس' : 'Metric'}</th>
                    <th className="py-1.5 text-end font-medium">{isAr ? 'النص أ' : 'Text A'}</th>
                    <th className="py-1.5 text-end font-medium">{isAr ? 'النص ب' : 'Text B'}</th>
                    <th className="py-1.5 text-end font-medium">{isAr ? 'الفرق' : 'Delta'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[
                    [
                      'Word Count',
                      comparison.left_metrics.word_count,
                      comparison.right_metrics.word_count,
                      comparison.deltas.word_count_delta,
                    ],
                    [
                      'Mean Sent Len',
                      comparison.left_metrics.sentence_structure.avg_sentence_length,
                      comparison.right_metrics.sentence_structure.avg_sentence_length,
                      comparison.deltas.avg_sentence_length_delta,
                    ],
                    [
                      'Burstiness CV',
                      comparison.left_metrics.sentence_structure.burstiness_index,
                      comparison.right_metrics.sentence_structure.burstiness_index,
                      comparison.deltas.burstiness_delta,
                    ],
                    [
                      'Guiraud R',
                      comparison.left_metrics.vocabulary.guiraud_r,
                      comparison.right_metrics.vocabulary.guiraud_r,
                      comparison.deltas.guiraud_r_delta,
                    ],
                    [
                      'Transitions/100w',
                      comparison.left_metrics.writing_style.transition_density,
                      comparison.right_metrics.writing_style.transition_density,
                      comparison.deltas.transition_density_delta,
                    ],
                    [
                      'Formality',
                      comparison.left_metrics.writing_style.formality_score,
                      comparison.right_metrics.writing_style.formality_score,
                      comparison.deltas.formality_delta,
                    ],
                  ].map(([label, aVal, bVal, dVal]) => (
                    <tr key={String(label)}>
                      <td className="py-2 font-sans text-slate-700 dark:text-slate-300">{label}</td>
                      <td className="py-2 text-right text-slate-800 dark:text-slate-200">{aVal}</td>
                      <td className="py-2 text-right text-slate-800 dark:text-slate-200">{bVal}</td>
                      <td className="py-2 text-right text-sky-700 dark:text-sky-400">
                        {Number(dVal) >= 0 ? `+${dVal}` : dVal}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            <div className="min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isAr ? 'الفروق البنيوية على مستوى الكلمات' : 'Word-Level Structural Diff'}
              </h2>
              <div
                dir="auto"
                className="p-3.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs leading-relaxed max-h-80 overflow-y-auto break-words"
              >
                {comparison.diff_segments.map((seg, idx) =>
                  seg.type === 'equal' ? (
                    <span key={idx} className="text-slate-700 dark:text-slate-300">
                      {seg.text}{' '}
                    </span>
                  ) : seg.type === 'added' ? (
                    <ins
                      key={idx}
                      className="no-underline bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 px-0.5 rounded"
                    >
                      {seg.text}{' '}
                    </ins>
                  ) : (
                    <del
                      key={idx}
                      className="bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 px-0.5 rounded"
                    >
                      {seg.text}{' '}
                    </del>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
