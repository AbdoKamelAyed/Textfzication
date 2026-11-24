export type Language = 'en' | 'ar';

export interface BilingualText {
  en: string;
  ar: string;
}

export interface GlossaryTerm {
  id: string;
  termEn: string;
  termAr: string;
  category: 'stylometry' | 'classification' | 'arabic_linguistics' | 'governance' | 'lexicography';
  plainDefinitionEn: string;
  plainDefinitionAr: string;
  formulaOrCue: string;
  exampleEn: string;
  exampleAr: string;
}

export const LINGUISTIC_GLOSSARY: GlossaryTerm[] = [
  {
    id: 'burstiness',
    termEn: 'Sentence Burstiness (CV)',
    termAr: 'تباين إيقاع الجمل (معامل التشتت)',
    category: 'stylometry',
    plainDefinitionEn:
      'Measures how much sentence lengths vary from one sentence to the next. Humans naturally mix short punchy lines with long complex thoughts (high burstiness), while unedited AI tends toward uniform sentence length (low burstiness).',
    plainDefinitionAr:
      'يقيس مدى اختلاف أطوال الجمل من جملة لأخرى. يمزج الكتّاب البشر عادةً بين جمل قصيرة سريعة وجمل طويلة مركبة (تباين مرتفع)، بينما تميل النصوص المولّدة آلياً إلى أطوال متقاربة ومنتظمة (تباين منخفض).',
    formulaOrCue: 'CV = std_dev(sentence_words) / mean(sentence_words) · Human ~0.40+, LLM ~0.15–0.28',
    exampleEn: 'Short human burst ("Wait—really?") next to a 32-word archival sentence.',
    exampleAr: 'جملة بشرية قصيرة ("يا ترى ليه؟") تليها جملة وصفية طويلة من ٢٨ كلمة.',
  },
  {
    id: 'guiraud_r',
    termEn: "Guiraud's Root TTR (Lexical Richness)",
    termAr: 'مؤشر غيرو للثراء المعجمي',
    category: 'stylometry',
    plainDefinitionEn:
      'Shows vocabulary diversity adjusted for passage length by dividing unique words by the square root of total words. Prevents short texts from looking artificially richer than long essays.',
    plainDefinitionAr:
      'يقيس تنوّع المفردات مع تعديل أثر طول النص عبر قسمة عدد الكلمات الفريدة على الجذر التربيعي لإجمالي الكلمات، حتى لا تبدو النصوص القصيرة أكثر ثراءً بشكل مضلل.',
    formulaOrCue: 'R = unique_words / sqrt(total_words)',
    exampleEn: '85 unique words in 120 words -> R = 7.76 (rich vocabulary).',
    exampleAr: '٨٥ كلمة فريدة في نص من ١٢٠ كلمة -> مؤشر غيرو = 7.76 (ثراء معجمي مرتفع).',
  },
  {
    id: 'hapax_ratio',
    termEn: 'Hapax Legomena Ratio',
    termAr: 'نسبة الكلمات الفريدة الأحادية (هاباكس)',
    category: 'stylometry',
    plainDefinitionEn:
      'The share of words that appear only once in a passage. Vivid human narratives often introduce specific one-off details, raising this ratio.',
    plainDefinitionAr:
      'نسبة الكلمات التي وردت مرة واحدة فقط داخل النص. غالباً ما يضيف السرد البشري تفاصيل عابرة دقيقة ترفع هذه النسبة.',
    formulaOrCue: 'count(freq == 1) / total_words',
    exampleEn: 'Archival terms like "ledgers", "tides", and "dockside" used once each.',
    exampleAr: 'مفردات مثل "الرصيف" و"المزلاج" و"الزحمة" ترد كل منها مرة واحدة في السرد.',
  },
  {
    id: 'transition_density',
    termEn: 'Discourse Transition Density',
    termAr: 'كثافة الروابط الخطابية',
    category: 'stylometry',
    plainDefinitionEn:
      'Counts explicit formal connectors (such as "Moreover", "Furthermore", "علاوة على ذلك", "بالإضافة إلى ذلك") per 100 words. High density is a common hallmark of templated AI essays.',
    plainDefinitionAr:
      'يحسب عدد أدوات الربط الرسمية (مثل "علاوة على ذلك"، "بالإضافة إلى ذلك"، "Moreover"، "Furthermore") لكل ١٠٠ كلمة. ارتفاع الكثافة علامة شائعة في المقالات الآلية النمطية.',
    formulaOrCue: '(connectors / total_words) * 100',
    exampleEn: 'Starting 3 consecutive sentences with "Moreover", "Furthermore", "Consequently".',
    exampleAr: 'بدء ثلاث جمل متتالية بعبارات "علاوة على ذلك" و"بالإضافة إلى ذلك" و"وبالتالي".',
  },
  {
    id: 'punctuation_entropy',
    termEn: 'Punctuation Shannon Entropy',
    termAr: 'إنتروبيا علامات الترقيم (التنوّع)',
    category: 'stylometry',
    plainDefinitionEn:
      'Measures how unpredictable and varied punctuation marks are (commas ،, semicolons ؛, em-dashes —, exclamations !, question marks ؟). Diverse punctuation raises entropy.',
    plainDefinitionAr:
      'يقيس تنوّع وعدم نمطية علامات الترقيم المستخدمة (الفاصلة ، والمنقوطة ؛ والشرطة — والتعجب ! والاستفهام ؟). تنوّع العلامات يرفع قيمة الإنتروبيا بالبت.',
    formulaOrCue: '-sum(p_i * log2(p_i)) bits',
    exampleEn: 'Using dashes, semicolons, and exclamation marks yields > 1.7 bits.',
    exampleAr: 'الجمع بين الفواصل والشرطات وعلامات التعجب يرفع الإنتروبيا فوق ١٫٧ بت.',
  },
  {
    id: 'calibrated_probability',
    termEn: 'Calibrated Authorship Probability',
    termAr: 'الاحتمال المعاير لأصل النص',
    category: 'classification',
    plainDefinitionEn:
      'A statistical confidence distribution across origins (Human, AI, Human-Edited AI, AI-Edited Human), NOT absolute proof. Short texts (<40 words) trigger an Insufficient Evidence warning.',
    plainDefinitionAr:
      'توزيع احتمالي إحصائي عبر فئات الأصل (بشري، ذكاء اصطناعي، محرّر بشرياً، محرّر آلياً)، وليس دليلاً قطعياً. النصوص القصيرة (< ٤٠ كلمة) تُظهر تحذير نقص الأدلة.',
    formulaOrCue: 'Softmax + uncertainty margin (±%) · Gate: >= 40 words recommended',
    exampleEn: '72% Human (±11% margin) means signals lean human with measured uncertainty.',
    exampleAr: '٧٢٪ بشري (هامش ±١١٪) يعني رجحان الإشارات البشرية مع وجود هامش عدم يقين.',
  },
  {
    id: 'arabic_tashkeel_normalization',
    termEn: 'Arabic Normalization & Diacritics (Tashkeel)',
    termAr: 'توحيد الحروف العربية والتشكيل',
    category: 'arabic_linguistics',
    plainDefinitionEn:
      'Before comparing Arabic words, variants like أ إ آ are standardized to ا and optional short vowel marks (َ ُ ِ ّ ْ) are indexed separately so spelling style never hides lexical structure.',
    plainDefinitionAr:
      'قبل مقارنة الكلمات العربية، تُوحَّد أشكال الألف (أ إ آ -> ا) ويُفصل التشكيل (الفتحة والضمة والكسرة والشدة) لقياس البنية الصرفية دون تشويش إملائي.',
    formulaOrCue: 'أ/إ/آ -> ا · ى -> ي · ة -> ه (normalized layer only)',
    exampleEn: '"الإبتكار" and "الابتكار" map to the same canonical token while preserving raw text.',
    exampleAr: '"الإبداع" و"الابداع" يتطابقان في الطبقة المعالَجة مع حفظ النص الخام كما هو.',
  },
  {
    id: 'msa_vs_egyptian',
    termEn: 'MSA (arb) vs. Egyptian Dialect (arz)',
    termAr: 'الفصحى المعاصرة مقابل العامية المصرية',
    category: 'arabic_linguistics',
    plainDefinitionEn:
      'Modern Standard Arabic (MSA) uses formal connectors and higher lexical formality, whereas Egyptian Arabic uses dialectal particles (اللي، عشان، مش، لسه). Naive detectors often confuse formal human MSA with AI.',
    plainDefinitionAr:
      'تستخدم العربية الفصحى المعاصرة روابط رسمية وبنية نحوية قياسية، بينما تعتمد العامية المصرية على أدوات مثل (اللي، عشان، مش، لسه). قد تخلط الأنظمة الساذجة بين الفصحى البشرية الرصينة والنص الآلي.',
    formulaOrCue: 'Dialect markers checked prior to formality scoring',
    exampleEn: '"لما بنمشي في شوارع وسط البلد" -> arz vs "يمثل التحول الرقمي" -> arb.',
    exampleAr: '"لما بنمشي في شوارع وسط البلد" (عامية مصرية) مقابل "يمثل التحول الرقمي" (فصحى).',
  },
  {
    id: 'storage_layers',
    termEn: 'RAW -> PROCESSED -> APPROVED Layers',
    termAr: 'طبقات البيانات: الخام ثم المعالَجة ثم المعتمدة',
    category: 'governance',
    plainDefinitionEn:
      'Three-stage data governance prevents leakage: RAW stores untouched imports, PROCESSED adds Unicode normalization & features, and APPROVED holds verified records safe for model training.',
    plainDefinitionAr:
      'حوكمة ثلاثية المراحل لمنع تسرب البيانات: الطبقة الخام (RAW) تحفظ الاستيراد الأصلي، والمعالَجة (PROCESSED) تضيف التطبيع والخصائص، والمعتمدة (APPROVED) تضم العينات الموثقة فقط.',
    formulaOrCue: 'Quarantined / Unverified samples are gated out of Verified training runs',
    exampleEn: 'CSV imports land in RAW first, pass quality audit, then promote to APPROVED.',
    exampleAr: 'تدخل ملفات CSV إلى RAW أولاً ثم تخضع لفحص الجودة قبل الترقية إلى APPROVED.',
  },
  {
    id: 'mdd_mdx_lexicon',
    termEn: 'MDict (.mdd / .mdx), XDXF & TEI P5 Exports',
    termAr: 'صيغ القواميس الدولية (MDict .mdd / .mdx و XDXF و TEI P5)',
    category: 'lexicography',
    plainDefinitionEn:
      'International dictionary standards: .mdx stores structured headword entries and definitions, .mdd packages companion linguistic SVG diagrams and media resources in binary MDict v2.0 blocks, and TEI P5 / XDXF / StarDict enable academic interoperability.',
    plainDefinitionAr:
      'معايير دولية لتبادل القواميس: يحفظ ملف ‎.mdx المداخل والتعريفات، ويحزم ملف ‎.mdd الموارد المرافقة والرسوم الصوتية بصيغة MDict v2.0 الثنائية، بينما توفر TEI P5 و XDXF و StarDict توافقاً أكاديمياً عالمياً.',
    formulaOrCue: 'MDict v2.0 Header (UTF-16LE + Adler-32) + TEI P5 XML + XDXF',
    exampleEn: 'Export custom EN↔AR linguistics lexicon as .mdd + .mdx for GoldenDict / MDict.',
    exampleAr: 'تصدير قاموس لسانيات عربي↔إنجليزي بصيغتَي ‎.mdd و ‎.mdx ليعمل في GoldenDict و MDict.',
  },
];

export const UI_STRINGS = {
  appName: { en: 'TEXTPRINT', ar: 'تيكست برينت · TEXTPRINT' },
  appSubtitle: {
    en: 'Multilingual Stylometry & Corpus Governance',
    ar: 'مختبر الأسلوبية متعددة اللغات وحوكمة المدونات',
  },
  navGroups: {
    overview: { en: 'Overview & Guide', ar: 'نظرة عامة والدليل' },
    corpus: { en: 'Corpus & Quality', ar: 'المدونات والجودة' },
    stylometry: { en: 'Stylometry & Lexicon', ar: 'الأسلوبية والمعاجم' },
    modeling: { en: 'Modeling & Visuals', ar: 'النمذجة والتصورات' },
    reports: { en: 'Reports & Governance', ar: 'التقارير والحوكمة' },
  },
  modules: {
    dashboard: { en: '01. Research Dashboard', ar: '01. لوحة البحث الرئيسية' },
    acquisition: { en: '02. Data Acquisition', ar: '02. استقطاب البيانات' },
    datasets: { en: '03. Dataset Management', ar: '03. إدارة المدونات والجودة' },
    linguistic: { en: '04. Linguistic Engine', ar: '04. المحرك اللغوي' },
    patterns: { en: '05. Writing Patterns', ar: '05. أنماط الكتابة' },
    stylometry: { en: '06. Stylometric Profiles', ar: '06. البصمات الأسلوبية' },
    ai_analysis: { en: '07. AI Text Analysis', ar: '07. التحليل الاحتمالي للنص' },
    compare: { en: '08. Comparative Lab', ar: '08. المختبر المقارن' },
    training: { en: '09. Training & Eval', ar: '09. التدريب والتقييم' },
    visuals: { en: '10. Knowledge Graph', ar: '10. الرسم المعرفي' },
    experiments: { en: '11. Experiments', ar: '11. التجارب العلمية' },
    reports: { en: '12. Reports & Deployment', ar: '12. التقارير والنشر' },
    copilot: { en: '13. AI Research Copilot', ar: '13. المساعد البحثي الذكي' },
    governance: { en: '14. Admin & Governance', ar: '14. الإدارة والحوكمة' },
    admin_portal: { en: '00. Special Admin Dashboard', ar: '00. لوحة المشرف الخاصة' },
    dictionary: { en: '15. Dictionary & Symbols', ar: '15. صانع القواميس والرموز' },
    guide: { en: '16. Interactive Guide', ar: '16. الدليل التفاعلي للمبتدئين' },
  },
  actions: {
    light: { en: 'Light', ar: 'فاتح' },
    dark: { en: 'Dark', ar: 'داكن' },
    switchLang: { en: 'العربية', ar: 'English' },
    signInGoogle: { en: 'Sign in with Google', ar: 'تسجيل الدخول عبر Google' },
    signOut: { en: 'Sign out', ar: 'تسجيل الخروج' },
    analyzePassage: { en: 'Analyze Passage', ar: 'تحليل نص الآن' },
    importCorpus: { en: 'Import Corpus', ar: 'استيراد مدونة' },
    openGuide: { en: 'Zero-Knowledge Guide', ar: 'دليل المبتدئين التفاعلي' },
    openDictionary: { en: 'Dictionary Maker (.mdd)', ar: 'صانع القواميس (.mdd)' },
    search: { en: 'Search', ar: 'بحث' },
    resetFilters: { en: 'Reset Filters', ar: 'إعادة تعيين المرشحات' },
    dismiss: { en: 'Dismiss', ar: 'إغلاق' },
    exportCsv: { en: 'Export CSV', ar: 'تصدير CSV' },
    exportJson: { en: 'Export JSON', ar: 'تصدير JSON' },
    exportHtml: { en: 'Export HTML', ar: 'تصدير HTML' },
    exportMarkdown: { en: 'Export Markdown', ar: 'تصدير Markdown' },
    printPdf: { en: 'Print / PDF', ar: 'طباعة / PDF' },
  },
  originLabels: {
    human: { en: 'Human Writing', ar: 'كتابة بشرية خالصة' },
    ai: { en: 'AI-Generated', ar: 'مولّد بالذكاء الاصطناعي' },
    human_edited_ai: { en: 'Human-Edited AI', ar: 'نص آلي حرّره إنسان' },
    ai_edited_human: { en: 'AI-Edited Human', ar: 'نص بشري حرّره الذكاء الاصطناعي' },
    mixed: { en: 'Mixed-Origin', ar: 'أصل مختلط' },
    unknown: { en: 'Unknown / Unverified', ar: 'غير معروف / قيد التحقق' },
  },
  statusLabels: {
    verified: { en: 'Verified', ar: 'مُوثّق' },
    pending: { en: 'Pending', ar: 'قيد المراجعة' },
    quarantined: { en: 'Quarantined', ar: 'معزول للفحص' },
    rejected: { en: 'Rejected', ar: 'مرفوض' },
  },
  layerLabels: {
    all: { en: 'All', ar: 'الكل' },
    raw: { en: 'Raw', ar: 'خام (RAW)' },
    processed: { en: 'Processed', ar: 'معالَج' },
    approved: { en: 'Approved', ar: 'معتمد' },
  },
  scientificDisclaimer: {
    en: 'Scientific Notice: Stylometric metrics and authorship scores are probabilistic indicators, not absolute proof of origin.',
    ar: 'تنبيه علمي: المؤشرات الأسلوبية ودرجات تصنيف الأصل هي دلالات احتمالية إحصائية وليست إثباتاً قطعياً لهوية الكاتب.',
  },
} as const;

export function pickText(lang: Language, pair: BilingualText): string {
  return lang === 'ar' ? pair.ar : pair.en;
}

export function getOriginLabel(lang: Language, originClass: string): string {
  const map = UI_STRINGS.originLabels as Record<string, BilingualText>;
  const hit = map[originClass];
  return hit ? pickText(lang, hit) : originClass;
}

export function getStatusLabel(lang: Language, status: string): string {
  const map = UI_STRINGS.statusLabels as Record<string, BilingualText>;
  const hit = map[status];
  return hit ? pickText(lang, hit) : status;
}

export function detectPromptLanguage(text: string, fallback: Language = 'en'): Language {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latinChars = (text.match(/[A-Za-z]/g) || []).length;
  if (arabicChars > latinChars) return 'ar';
  if (latinChars > arabicChars) return 'en';
  return fallback;
}
