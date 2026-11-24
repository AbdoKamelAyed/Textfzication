import { analyzeTextLinguistics } from './linguistic';
import { detectPromptLanguage, type Language } from './i18n';
import type {
  DatasetRecord,
  ExperimentRecord,
  ExternalSource,
  TextSample,
  WritingPattern,
} from './types';

export interface CopilotFallbackContext {
  datasets: DatasetRecord[];
  samples: TextSample[];
  patterns: WritingPattern[];
  experiments: ExperimentRecord[];
  uiLanguage?: Language;
}

export interface LocalCopilotReply {
  text: string;
  modelUsed: string;
  groundingSources: Array<{ uri: string; title: string }>;
  isStaticFallback: true;
}

function summarizeOriginMetrics(samples: TextSample[], originFilter: string) {
  const subset = samples.filter((s) => s.origin.class === originFilter);
  if (subset.length === 0) {
    return null;
  }
  let burstSum = 0;
  let guiraudSum = 0;
  let transSum = 0;
  for (const s of subset) {
    const m = s.linguistic_metrics ?? analyzeTextLinguistics(s.text);
    burstSum += m.sentence_structure.burstiness_index;
    guiraudSum += m.vocabulary.guiraud_r;
    transSum += m.writing_style.transition_density;
  }
  return {
    count: subset.length,
    avgBurstiness: +(burstSum / subset.length).toFixed(3),
    avgGuiraudR: +(guiraudSum / subset.length).toFixed(2),
    avgTransitionDensity: +(transSum / subset.length).toFixed(2),
  };
}

export function generateLocalCopilotReply(
  question: string,
  context: CopilotFallbackContext
): LocalCopilotReply {
  const lang = detectPromptLanguage(question, context.uiLanguage ?? 'en');
  const qLower = question.toLowerCase();

  const { datasets, samples, patterns, experiments } = context;
  const verifiedCount = samples.filter((s) => s.validation.verified).length;
  const arSamples = samples.filter((s) => s.language === 'ar');
  const enSamples = samples.filter((s) => s.language === 'en');
  const humanStats = summarizeOriginMetrics(samples, 'human');
  const aiStats = summarizeOriginMetrics(samples, 'ai');
  const heaStats = summarizeOriginMetrics(samples, 'human_edited_ai');
  const aehStats = summarizeOriginMetrics(samples, 'ai_edited_human');
  const latestExp = experiments[0];

  const wantsArabicAnalysis =
    qLower.includes('arabic') ||
    qLower.includes('msa') ||
    qLower.includes('egyptian') ||
    question.includes('العربية') ||
    question.includes('الفصحى') ||
    question.includes('المصرية') ||
    question.includes('تشكيل');

  const wantsSplitProtocol =
    qLower.includes('split') ||
    qLower.includes('leakage') ||
    qLower.includes('evaluation') ||
    qLower.includes('ece') ||
    qLower.includes('roc') ||
    question.includes('تقييم') ||
    question.includes('تسرب');

  const wantsBurstinessOrEdit =
    qLower.includes('burstiness') ||
    qLower.includes('guiraud') ||
    qLower.includes('edit') ||
    qLower.includes('transition') ||
    question.includes('تباين') ||
    question.includes('تحرير') ||
    question.includes('غيرو');

  const wantsDeployInfo =
    qLower.includes('deploy') ||
    qLower.includes('github') ||
    qLower.includes('vercel') ||
    qLower.includes('firebase') ||
    qLower.includes('cloud run') ||
    question.includes('نشر') ||
    question.includes('استضافة');

  if (lang === 'ar') {
    const sections: string[] = [
      `المساعد البحثي المحلي الحتمي (وضع الاستضافة الساكنة بدون خادم Express):`,
      `• ملخص المدونة الحالية: ${datasets.length} مدونة، ${samples.length} عينة (${verifiedCount} موثقة، ${enSamples.length} إنجليزية، ${arSamples.length} عربية)، ${patterns.length} نمط كتابي، و${experiments.length} تجربة.`,
    ];

    if (humanStats || aiStats) {
      sections.push(
        `• مقارنة الأسلوبية في عيناتك الحالية:\n` +
          (humanStats
            ? `  - الكتابة البشرية (${humanStats.count} عينات): متوسط تباين الجمل = ${humanStats.avgBurstiness}، مؤشر غيرو = ${humanStats.avgGuiraudR}، كثافة الروابط = ${humanStats.avgTransitionDensity}/100 كلمة.\n`
            : '') +
          (aiStats
            ? `  - النصوص الآلية (${aiStats.count} عينات): متوسط تباين الجمل = ${aiStats.avgBurstiness}، مؤشر غيرو = ${aiStats.avgGuiraudR}، كثافة الروابط = ${aiStats.avgTransitionDensity}/100 كلمة.\n`
            : '') +
          (heaStats
            ? `  - آلي حرّره إنسان (${heaStats.count}): تباين = ${heaStats.avgBurstiness}، روابط = ${heaStats.avgTransitionDensity}/100 كلمة.`
            : '')
      );
    }

    if (wantsArabicAnalysis || (!wantsSplitProtocol && !wantsDeployInfo)) {
      sections.push(
        `• الضوابط اللغوية للغة العربية (الفصحى مقابل العامية المصرية):\n` +
          `  1) توحيد الألف (أ/إ/آ -> ا) والتاء المربوطة وفصل التشكيل يمنع التشويش الإملائي قبل قياس الجذور.\n` +
          `  2) العامية المصرية (مثل: اللي، عشان، مش، لسه) تمتلك إيقاعاً غير متماثل وتنخفض فيها الروابط الرسمية مقارنةً بالفصحى الآلية (علاوة على ذلك، وبالتالي).\n` +
          `  3) الفصحى البشرية الأكاديمية قد تشبه النصوص الآلية في الرسمية؛ لذا نجمع تباين الجمل وإنتروبيا الترقيم قبل الحكم الاحتمالي.`
      );
    }

    if (wantsSplitProtocol && latestExp) {
      sections.push(
        `• بروتوكول التقييم ومنع التسرب:\n` +
          `  - آخر تجربة (${latestExp.experiment_key}): F1 = ${(latestExp.metrics.f1_score * 100).toFixed(1)}%، ROC-AUC = ${latestExp.metrics.roc_auc.toFixed(3)}، ECE = ${latestExp.metrics.ece_calibration.toFixed(3)}.\n` +
          `  - استخدم دائماً التقسيم المجمّع حسب المصدر أو المؤلف (grouped_by_source / grouped_by_author) مع عزل العينات غير الموثقة في وضع Exploratory فقط.`
      );
    }

    if (wantsDeployInfo) {
      sections.push(
        `• الاستضافة والنشر:\n` +
          `  - على GitHub Pages أو Firebase Hosting أو Vercel Static يعمل المحرك اللغوي وIndexedDB وصانع القواميس (.mdd) محلياً بالكامل.\n` +
          `  - لتشغيل Gemini السحابي المباشر، انشر خادم server.ts على Cloud Run ثم الصق رابطه في وحدة (14. الإدارة والحوكمة).`
      );
    }

    sections.push(
      `ملاحظة: هذه الاستجابة محلية وحتمية من بياناتك المحمّلة؛ لتفعيل Gemini ThinkingLevel.HIGH والبحث المباشر عبر Google، اربط رابط خادم Cloud Run من شاشة 14.`
    );

    return {
      text: sections.join('\n\n'),
      modelUsed: 'local-deterministic-copilot-v1',
      groundingSources: [
        { uri: 'https://github.com/mbzuai-nlp/M4GT-Bench', title: 'M4GT-Bench (Arabic & Multilingual Benchmark)' },
        { uri: 'https://raid-bench.xyz', title: 'RAID Robust AI Detection Benchmark' },
      ],
      isStaticFallback: true,
    };
  }

  // English response
  const sections: string[] = [
    `Local Deterministic Copilot (Static Hosting Fallback — Computed Directly from Your Loaded Workspace):`,
    `• Active Corpus Snapshot: ${datasets.length} datasets, ${samples.length} total samples (${verifiedCount} verified, ${enSamples.length} EN, ${arSamples.length} AR), ${patterns.length} writing patterns, and ${experiments.length} recorded experiments.`,
  ];

  if (wantsBurstinessOrEdit || (!wantsArabicAnalysis && !wantsSplitProtocol && !wantsDeployInfo)) {
    const lines: string[] = [];
    if (humanStats) {
      lines.push(
        `  - Human (${humanStats.count} samples): mean Burstiness CV = ${humanStats.avgBurstiness}, Guiraud R = ${humanStats.avgGuiraudR}, Transitions = ${humanStats.avgTransitionDensity}/100w`
      );
    }
    if (aiStats) {
      lines.push(
        `  - AI-Generated (${aiStats.count} samples): mean Burstiness CV = ${aiStats.avgBurstiness}, Guiraud R = ${aiStats.avgGuiraudR}, Transitions = ${aiStats.avgTransitionDensity}/100w`
      );
    }
    if (heaStats) {
      lines.push(
        `  - Human-Edited AI (${heaStats.count} samples): Burstiness CV = ${heaStats.avgBurstiness}, Guiraud R = ${heaStats.avgTransitionDensity ? heaStats.avgGuiraudR : heaStats.avgGuiraudR}, Transitions = ${heaStats.avgTransitionDensity}/100w`
      );
    }
    if (aehStats) {
      lines.push(
        `  - AI-Edited Human (${aehStats.count} samples): Burstiness CV = ${aehStats.avgBurstiness}, Guiraud R = ${aehStats.avgGuiraudR}, Transitions = ${aehStats.avgTransitionDensity}/100w`
      );
    }
    sections.push(
      `• Measured Stylometric Contrast & Co-Editing Shifts:\n${lines.join('\n')}\n` +
        `  Interpretation: When human prose is AI-edited, transition density typically rises while extreme sentence-length swings dampen. Conversely, human editing of AI drafts injects em-dashes, colloquial pivots, and burstiness variance.`
    );
  }

  if (wantsArabicAnalysis) {
    sections.push(
      `• Arabic Confounders (Modern Standard Arabic vs. Egyptian Dialect):\n` +
        `  1) Orthographic Variance: Alef forms (أ/إ/آ), Ta Marbuta (ة), and optional Tashkeel (َ ُ ِ ّ ْ) must be normalized prior to vocabulary richness (Guiraud R) calculations.\n` +
        `  2) MSA Formality Bias: Formal human academic MSA shares lexical density with LLM Arabic; separate discourse connector chains ("علاوة على ذلك", "وبالتالي") from authentic sentence-length rhythm.\n` +
        `  3) Dialectal Markers: Egyptian particles (اللي، عشان، مش، لسه) strongly separate human dialectal narratives from standard MSA generators.`
    );
  }

  if (wantsSplitProtocol) {
    sections.push(
      `• Leakage-Safe Evaluation Protocol:\n` +
        (latestExp
          ? `  - Latest Baseline (${latestExp.experiment_key}): Accuracy ${(latestExp.metrics.accuracy * 100).toFixed(1)}%, F1 ${(latestExp.metrics.f1_score * 100).toFixed(1)}%, ROC-AUC ${latestExp.metrics.roc_auc.toFixed(3)}, ECE ${latestExp.metrics.ece_calibration.toFixed(3)}, Edited-Text F1 ${(latestExp.metrics.edited_text_f1 * 100).toFixed(1)}%.\n`
          : '') +
        `  - Enforce grouped splits (grouped_by_source or grouped_by_author) plus 64-bit hash + 3-gram Jaccard (>=82%) contamination screening so edited pairs never span train and eval folds.`
    );
  }

  if (wantsDeployInfo) {
    sections.push(
      `• Hosting & Deployment Architecture:\n` +
        `  - Static hosts (GitHub Pages, Firebase Hosting, Vercel Static) run all 6 deterministic engines, IndexedDB layers, Dictionary Maker (.mdd/.mdx), and local Copilot fallback in-browser.\n` +
        `  - Full-stack Gemini / SQL features run on Cloud Run (node server.ts); attach your Cloud Run base URL in 14. Admin & Governance -> Connectivity Monitor.`
    );
  }

  sections.push(
    `Tip: To enable live cloud Gemini reasoning (ThinkingLevel.HIGH) and Google Search Grounding on a static host, attach your Express Cloud Run URL in module 14. Admin & Governance.`
  );

  return {
    text: sections.join('\n\n'),
    modelUsed: 'local-deterministic-copilot-v1',
    groundingSources: [
      { uri: 'https://raid-bench.xyz', title: 'RAID Benchmark (Robust AI Detection)' },
      { uri: 'https://github.com/mbzuai-nlp/M4GT-Bench', title: 'M4GT-Bench Multilingual Corpus' },
    ],
    isStaticFallback: true,
  };
}

export function generateLocalSourceDiscoveryReply(
  query: string,
  sources: ExternalSource[],
  uiLanguage: Language = 'en'
): {
  summary: string;
  groundingSources: Array<{ uri: string; title: string }>;
} {
  const qWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const scored = sources
    .map((src) => {
      const hay = `${src.name} ${src.description} ${src.language} ${src.reliability_notes}`.toLowerCase();
      const score = qWords.reduce((acc, w) => acc + (hay.includes(w) ? 1 : 0), 0);
      return { src, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored.map((item) => item.src);
  const header =
    uiLanguage === 'ar'
      ? `نتائج البحث المحلي الحتمي في سجل المصادر البحثية الموثقة (بديل الاستضافة الساكنة) للاستعلام: "${query}"`
      : `Local Verified Source Registry Results (Static Hosting Fallback) for query: "${query}"`;

  const lines = top.map(
    (s, i) =>
      `${i + 1}. ${s.name} [${s.data_format} · ${s.language} · ${s.license}]\n   ${s.description} (${s.reliability_notes})`
  );

  return {
    summary: `${header}\n\n${lines.join('\n\n')}`,
    groundingSources: top.map((s) => ({
      uri: s.official_url,
      title: `${s.name} (${s.license})`,
    })),
  };
}

export function generateLocalEditTransform(params: {
  mode: 'edit' | 'generate';
  text: string;
  instruction: string;
}): {
  outputText: string;
  modelUsed: string;
} {
  const { mode, text, instruction } = params;
  const isArabic = detectPromptLanguage(mode === 'generate' ? instruction : text, 'en') === 'ar';

  if (mode === 'generate') {
    const topic = instruction.trim() || (isArabic ? 'التحليل الأسلوبي للنصوص' : 'stylometric provenance');
    if (isArabic) {
      return {
        outputText: `يمثل موضوع "${topic}" محوراً أساسياً في الدراسات اللغوية الحاسوبية المعاصرة. علاوة على ذلك، تسهم المقاييس الكمية الدقيقة في تحليل تباين الجمل وكثافة الروابط الخطابية بصورة منهجية. بالإضافة إلى ذلك، يساعد توثيق البيانات على فصل العينات البشرية عن المخرجات الآلية بدقة احتمالية واضحة. وبالتالي، توفر هذه المقاربة إطاراً عملياً قابلاً لإعادة التحقق في مختبرات النصوص.`,
        modelUsed: 'local-deterministic-generator-v1 (static fallback)',
      };
    }
    return {
      outputText: `Systematic research into "${topic}" plays an important role in reproducible computational linguistics. Moreover, structured empirical baselines help analysts measure sentence burstiness, vocabulary richness, and discourse connector density consistently across corpora. Furthermore, transparent provenance tracking clarifies how human editorial revisions alter automated baselines. Consequently, calibrated indicators support disciplined, evidence-based interpretation.`,
      modelUsed: 'local-deterministic-generator-v1 (static fallback)',
    };
  }

  // Deterministic edit transform on provided passage
  const trimmed = text.trim();
  if (!trimmed) {
    return { outputText: '', modelUsed: 'local-deterministic-editor-v1 (static fallback)' };
  }

  const instLower = instruction.toLowerCase();
  if (isArabic) {
    let edited = trimmed
      .replace(/—/g, '، ')
      .replace(/!/g, '.')
      .replace(/عشان/g, 'لأن')
      .replace(/اللي/g, 'الذي')
      .replace(/مش/g, 'ليس');
    if (!edited.includes('علاوة على ذلك')) {
      const parts = edited.split(/(?<=[.!؟])\s+/);
      if (parts.length >= 2) {
        parts[1] = `علاوة على ذلك، ${parts[1]}`;
        edited = parts.join(' ');
      }
    }
    return {
      outputText: edited,
      modelUsed: 'local-deterministic-editor-v1 (static fallback)',
    };
  }

  let edited = trimmed
    .replace(/\s*—\s*/g, ', ')
    .replace(/!/g, '.')
    .replace(/\bnobody\b/gi, 'few observers')
    .replace(/\bwe\b/gi, 'the research team')
    .replace(/\bour\b/gi, 'the');

  if (instLower.includes('formal') || instLower.includes('academic') || !instLower.includes('concise')) {
    const sentences = edited.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length >= 2 && !/^(moreover|furthermore|consequently)/i.test(sentences[1])) {
      sentences[1] = `Moreover, ${sentences[1].charAt(0).toLowerCase()}${sentences[1].slice(1)}`;
    }
    if (sentences.length >= 3 && !/^(furthermore|consequently|therefore)/i.test(sentences[sentences.length - 1])) {
      const lastIdx = sentences.length - 1;
      sentences[lastIdx] = `Consequently, ${sentences[lastIdx].charAt(0).toLowerCase()}${sentences[lastIdx].slice(1)}`;
    }
    edited = sentences.join(' ');
  }

  return {
    outputText: edited,
    modelUsed: 'local-deterministic-editor-v1 (static fallback)',
  };
}
