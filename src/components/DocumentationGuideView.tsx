import { useMemo, useState } from 'react';
import { ArrowRight, BookMarked, Compass, Play, Search } from 'lucide-react';
import { classifyTextProbabilistically } from '../engine/classifier';
import {
  REAL_WALKTHROUGH_PRESETS,
  ZERO_KNOWLEDGE_GUIDE_CHAPTERS,
} from '../engine/documentationData';
import { getOriginLabel, LINGUISTIC_GLOSSARY } from '../engine/i18n';
import { analyzeTextLinguistics } from '../engine/linguistic';
import { useI18n } from '../lib/i18nContext';
import type { ModuleId } from './ResearchDashboard';

interface Props {
  onNavigate: (module: ModuleId) => void;
}

type GuideTab = 'walkthrough' | 'sandbox' | 'glossary';

export function DocumentationGuideView({ onNavigate }: Props) {
  const { lang, t } = useI18n();
  const [tab, setTab] = useState<GuideTab>('walkthrough');

  // Interactive real-example live sandbox
  const [selectedPresetId, setSelectedPresetId] = useState(REAL_WALKTHROUGH_PRESETS[0].id);
  const [sandboxText, setSandboxText] = useState(REAL_WALKTHROUGH_PRESETS[0].text);

  // Bilingual clear definitions glossary search
  const [glossaryQuery, setGlossaryQuery] = useState('');
  const [glossaryCat, setGlossaryCat] = useState<string>('all');

  const activePreset =
    REAL_WALKTHROUGH_PRESETS.find((p) => p.id === selectedPresetId) ?? REAL_WALKTHROUGH_PRESETS[0];

  const liveAnalysis = useMemo(() => analyzeTextLinguistics(sandboxText), [sandboxText]);
  const liveClass = useMemo(() => classifyTextProbabilistically(sandboxText), [sandboxText]);

  const filteredGlossary = useMemo(() => {
    const q = glossaryQuery.trim().toLowerCase();
    return LINGUISTIC_GLOSSARY.filter((term) => {
      if (glossaryCat !== 'all' && term.category !== glossaryCat) return false;
      if (!q) return true;
      return (
        term.termEn.toLowerCase().includes(q) ||
        term.termAr.toLowerCase().includes(q) ||
        term.plainDefinitionEn.toLowerCase().includes(q) ||
        term.plainDefinitionAr.toLowerCase().includes(q)
      );
    });
  }, [glossaryQuery, glossaryCat]);

  const handleLoadPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const found = REAL_WALKTHROUGH_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setSandboxText(found.text);
      setTab('sandbox');
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {t({
              en: '16. Interactive Guide & Bilingual Definitions (Zero-Knowledge Ready)',
              ar: '16. الدليل التفاعلي والتعريفات الواضحة (مصمم للمبتدئين من الصفر بأمثلة حية)',
            })}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t({
              en: 'Learn every part of TEXTPRINT step by step using real English & Arabic corpus examples—no linguistics or machine-learning background needed.',
              ar: 'تعلّم كل خطوة في النظام عبر أمثلة حقيقية باللغتين العربية والإنجليزية دون الحاجة لأي خبرة مسبقة في اللسانيات أو الذكاء الاصطناعي.',
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shrink-0 max-w-full">
          {(
            [
              ['walkthrough', t({ en: 'Step-by-Step Guide', ar: 'دليل الخطوات' })],
              ['sandbox', t({ en: 'Try Real Examples Live', ar: 'جرّب أمثلة حية الآن' })],
              ['glossary', t({ en: 'Clear EN/AR Definitions', ar: 'قاموس المصطلحات الواضح' })],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: STEP-BY-STEP WALKTHROUGH */}
      {tab === 'walkthrough' && (
        <div className="space-y-4">
          {ZERO_KNOWLEDGE_GUIDE_CHAPTERS.map((chap) => (
            <div
              key={chap.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-mono text-xs text-sky-700 dark:text-sky-400">
                    {t({ en: `LESSON ${chap.stepNumber}`, ar: `الدرس ${chap.stepNumber}` })}
                  </span>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {lang === 'ar' ? chap.titleAr : chap.titleEn}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {lang === 'ar' ? chap.summaryAr : chap.summaryEn}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {chap.realExampleId && (
                    <button
                      type="button"
                      onClick={() => handleLoadPreset(chap.realExampleId!)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{t({ en: 'Run Real Example', ar: 'تشغيل مثال حي' })}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate(chap.targetModule)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span>{lang === 'ar' ? chap.ctaAr : chap.ctaEn}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {chap.steps.map((st, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1 min-w-0"
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {lang === 'ar' ? st.labelAr : st.labelEn}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {lang === 'ar' ? st.detailAr : st.detailEn}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: LIVE REAL-EXAMPLE SANDBOX */}
      {tab === 'sandbox' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {REAL_WALKTHROUGH_PRESETS.map((preset) => {
              const selected = preset.id === selectedPresetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleLoadPreset(preset.id)}
                  className={`text-start p-3.5 rounded-lg border transition-colors space-y-1 min-w-0 ${
                    selected
                      ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 text-slate-900 dark:text-slate-100'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-400'
                  }`}
                >
                  <span className="font-mono text-[11px] text-sky-700 dark:text-sky-400 block">
                    {preset.sampleId} · {preset.language.toUpperCase()}
                  </span>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'ar' ? preset.titleAr : preset.titleEn}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {lang === 'ar' ? preset.originLabelAr : preset.originLabelEn}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t({ en: 'Live Editable Passage', ar: 'النص الحي القابل للتعديل والتجربة' })}
                </h2>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {liveAnalysis.detected_language.toUpperCase()} · {liveAnalysis.is_rtl ? 'RTL' : 'LTR'}
                </span>
              </div>

              <textarea
                aria-label="Interactive example passage"
                rows={7}
                dir={liveAnalysis.is_rtl ? 'rtl' : 'ltr'}
                value={sandboxText}
                onChange={(e) => setSandboxText(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 leading-relaxed"
              />

              <div className="p-3 rounded-md bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 shrink-0" />
                  <span>{t({ en: 'What to Look For in This Example:', ar: 'ماذا تلاحظ في هذا المثال؟' })}</span>
                </p>
                <p>{lang === 'ar' ? activePreset.whatToNoticeAr : activePreset.whatToNoticeEn}</p>
              </div>
            </div>

            <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4 min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    {t({ en: 'Instant Probabilistic Screening', ar: 'التقدير الاحتمالي الفوري' })}
                  </span>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {getOriginLabel(lang, liveClass.predicted_label)}
                  </h3>
                </div>
                <span className="font-mono text-base font-semibold text-sky-700 dark:text-sky-400 tabular-nums">
                  {(liveClass.calibrated_confidence * 100).toFixed(1)}% (±{(liveClass.confidence_margin * 100).toFixed(1)}%)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  {
                    labelEn: 'Burstiness (Sentence Variety)',
                    labelAr: 'تباين الجمل (الإيقاع)',
                    val: String(liveAnalysis.sentence_structure.burstiness_index),
                    hintEn: liveAnalysis.sentence_structure.burstiness_index >= 0.35 ? 'High variety (human-like rhythm)' : 'Uniform length (structured/AI cue)',
                    hintAr: liveAnalysis.sentence_structure.burstiness_index >= 0.35 ? 'تنوع واضح (إيقاع بشري حي)' : 'تجانس في الأطوال (إشارة نمطية/آلية)',
                  },
                  {
                    labelEn: 'Transition Density / 100w',
                    labelAr: 'كثافة الروابط / ١٠٠ كلمة',
                    val: String(liveAnalysis.writing_style.transition_density),
                    hintEn: liveAnalysis.writing_style.transition_density >= 1.8 ? 'Heavy formal connectors' : 'Natural sparse connectors',
                    hintAr: liveAnalysis.writing_style.transition_density >= 1.8 ? 'كثرة الروابط الرسمية المتكررة' : 'روابط طبيعية غير متكلفة',
                  },
                  {
                    labelEn: 'Guiraud R (Vocabulary Richness)',
                    labelAr: 'مؤشر غيرو (ثراء المفردات)',
                    val: String(liveAnalysis.vocabulary.guiraud_r),
                    hintEn: `${liveAnalysis.vocabulary.unique_words} unique / ${liveAnalysis.word_count} total`,
                    hintAr: `${liveAnalysis.vocabulary.unique_words} كلمة فريدة من أصل ${liveAnalysis.word_count}`,
                  },
                  {
                    labelEn: 'Punctuation Entropy',
                    labelAr: 'إنتروبيا علامات الترقيم',
                    val: `${liveAnalysis.punctuation.punctuation_entropy} bits`,
                    hintEn: `${liveAnalysis.sentence_structure.sentence_count} sentences analyzed`,
                    hintAr: `تم فحص ${liveAnalysis.sentence_structure.sentence_count} جمل`,
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.labelEn}
                    className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1 min-w-0"
                  >
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      {lang === 'ar' ? kpi.labelAr : kpi.labelEn}
                    </span>
                    <span className="text-base font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums block">
                      {kpi.val}
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 block">
                      {lang === 'ar' ? kpi.hintAr : kpi.hintEn}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 text-xs">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {t({ en: 'Why did the engine output this?', ar: 'لماذا أعطى المحرك هذه النتيجة؟' })}
                </p>
                <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                  {liveClass.supporting_evidence.map((ev, i) => (
                    <li key={i}>• {ev}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLEAR BILINGUAL DEFINITIONS GLOSSARY */}
      {tab === 'glossary' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookMarked className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {t({ en: 'Bilingual Clear Definitions Glossary', ar: 'مسرد التعريفات المبسّط (عربي / إنجليزي)' })}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={glossaryQuery}
                  onChange={(e) => setGlossaryQuery(e.target.value)}
                  placeholder={t({ en: 'Filter terms...', ar: 'ابحث عن مصطلح...' })}
                  aria-label="Filter glossary terms"
                  className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <select
                aria-label="Filter glossary category"
                value={glossaryCat}
                onChange={(e) => setGlossaryCat(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="all">{t({ en: 'All Categories', ar: 'كل التصنيفات' })}</option>
                <option value="stylometry">{t({ en: 'Stylometry', ar: 'الأسلوبية' })}</option>
                <option value="classification">{t({ en: 'Classification', ar: 'التصنيف' })}</option>
                <option value="arabic_linguistics">{t({ en: 'Arabic Linguistics', ar: 'اللسانيات العربية' })}</option>
                <option value="governance">{t({ en: 'Data Governance', ar: 'حوكمة البيانات' })}</option>
                <option value="lexicography">{t({ en: 'Dictionary Formats', ar: 'صيغ القواميس' })}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGlossary.map((item) => (
              <article
                key={item.id}
                className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-2.5 min-w-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {item.termEn}
                  </h3>
                  <span dir="rtl" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    {item.termAr}
                  </span>
                </div>

                <p dir="ltr" className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {item.plainDefinitionEn}
                </p>
                <p dir="rtl" className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {item.plainDefinitionAr}
                </p>

                <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-sky-700 dark:text-sky-400 break-words">
                  {item.formulaOrCue}
                </div>

                <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                  <p dir="ltr">
                    <strong>EN Ex:</strong> {item.exampleEn}
                  </p>
                  <p dir="rtl">
                    <strong>مثال:</strong> {item.exampleAr}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
