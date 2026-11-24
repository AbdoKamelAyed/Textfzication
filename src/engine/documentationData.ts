export interface GuideChapter {
  id: string;
  stepNumber: string;
  titleEn: string;
  titleAr: string;
  summaryEn: string;
  summaryAr: string;
  steps: Array<{
    labelEn: string;
    labelAr: string;
    detailEn: string;
    detailAr: string;
  }>;
  realExampleId?: string;
  targetModule: 'acquisition' | 'datasets' | 'linguistic' | 'ai_analysis' | 'compare' | 'dictionary' | 'reports';
  ctaEn: string;
  ctaAr: string;
}

export interface RealWalkthroughPreset {
  id: string;
  titleEn: string;
  titleAr: string;
  originLabelEn: string;
  originLabelAr: string;
  sampleId: string;
  language: 'en' | 'ar';
  text: string;
  whatToNoticeEn: string;
  whatToNoticeAr: string;
}

export const REAL_WALKTHROUGH_PRESETS: RealWalkthroughPreset[] = [
  {
    id: 'ex-en-human',
    titleEn: 'Example 1: Human Archival Note (English)',
    titleAr: 'مثال ١: نص بشري سردي (إنجليزي)',
    originLabelEn: 'Human-Authored (TX-HUM-000001)',
    originLabelAr: 'كتابة بشرية (TX-HUM-000001)',
    sampleId: 'TX-HUM-000001',
    language: 'en',
    text: `When we began logging archival correspondence from nineteenth-century port authorities, nobody expected the handwriting itself to argue with the ledger totals. Yet page after page betrayed sudden rushes of ink—abbreviated dates, clipped nouns, marginal recalculations scribbled sideways while a ship waited at berth. Later clerks ironed those messy realities into neat annual summaries! If you only read the printed digest, trade looks serene and clockwork; inspect the damp dockside notebooks, though, and you hear impatience, fog, and missed tides.`,
    whatToNoticeEn:
      'Notice the concrete sensory nouns ("damp dockside notebooks", "missed tides"), an expressive em-dash (—), an exclamation mark (!), and strong sentence rhythm contrast.',
    whatToNoticeAr:
      'لاحظ المفردات الحسية الدقيقة، واستخدام الشرطة الطويلة (—)، وعلامة التعجب (!)، والتفاوت الواضح في طول الجمل وإيقاعها.',
  },
  {
    id: 'ex-en-ai',
    titleEn: 'Example 2: AI Essay on Same Topic (English)',
    titleAr: 'مثال ٢: مقال آلي في نفس الموضوع (إنجليزي)',
    originLabelEn: 'AI-Generated (TX-AI-000001)',
    originLabelAr: 'مولّد آلياً (TX-AI-000001)',
    sampleId: 'TX-AI-000001',
    language: 'en',
    text: `Archival digitization plays a crucial role in preserving historical maritime records for contemporary scholarship. Moreover, modern optical character recognition pipelines enable researchers to extract structured data from fragile ledgers efficiently. Furthermore, standardized metadata schemas ensure that heterogeneous port logs can be queried consistently across institutional repositories. Consequently, historians gain unprecedented visibility into long-term economic patterns. In conclusion, systematic digitization bridges physical preservation and quantitative historical inquiry.`,
    whatToNoticeEn:
      'Notice the textbook connector chain ("Moreover...", "Furthermore...", "Consequently...", "In conclusion...") and nearly uniform sentence lengths—classic low-burstiness AI structure.',
    whatToNoticeAr:
      'لاحظ تسلسل الروابط المنهجية في بدايات الجمل ("Moreover"، "Furthermore"، "Consequently"، "In conclusion") وتقارب أطوال الجمل (تباين منخفض).',
  },
  {
    id: 'ex-ar-egyptian',
    titleEn: 'Example 3: Egyptian Arabic Street Narrative (RTL)',
    titleAr: 'مثال ٣: سرد بشري بالعامية المصرية (يمين إلى يسار)',
    originLabelEn: 'Human Dialectal Arabic (TX-HUM-000002)',
    originLabelAr: 'كتابة بشرية بالعامية المصرية (TX-HUM-000002)',
    sampleId: 'TX-HUM-000002',
    language: 'ar',
    text: `لما بنمشي في شوارع وسط البلد الصبح بدري قبل الزحمة، بنحس إن المباني القديمة لسه محتفظة بروحها رغم كل التغييرات اللي حصلت حواليها. القهوة على الرصيف بتفتح بدري، وصوت الباعة بيختلط بخطوات الناس المستعجلة للشغل. مش كل حاجة بتتوثق في الكتب التاريخية؛ أحياناً التفاصيل الصغيرة دي هي اللي بتحكي حكاية المدينة بصدق أكتر من أي تقرير رسمي!`,
    whatToNoticeEn:
      'Notice Arabic semicolon (؛), colloquial markers ("لما", "لسه", "اللي", "مش", "دي"), and vivid scene-setting without formal academic connectors.',
    whatToNoticeAr:
      'لاحظ الفاصلة المنقوطة العربية (؛)، والأدوات العامية ("لما"، "لسه"، "اللي"، "مش"، "دي")، والسرد الحي الخالي من الروابط الأكاديمية المتكررة.',
  },
  {
    id: 'ex-ar-ai',
    titleEn: 'Example 4: Modern Standard Arabic AI Prose (RTL)',
    titleAr: 'مثال ٤: نص آلي بالفصحى المعاصرة (يمين إلى يسار)',
    originLabelEn: 'AI-Generated MSA (TX-AI-000002)',
    originLabelAr: 'مولّد آلياً بالفصحى (TX-AI-000002)',
    sampleId: 'TX-AI-000002',
    language: 'ar',
    text: `يمثل التحول الرقمي في المؤسسات التعليمية ركيزة أساسية لتطوير جودة المناهج وتيسير الوصول إلى المعرفة. علاوة على ذلك، تسهم المنصات التفاعلية في تعزيز مشاركة الطلاب وتوفير تحليلات دقيقة لمستويات الأداء الأكاديمي. بالإضافة إلى ذلك، تتيح هذه الأدوات تصميم مسارات تعليمية مرنة تتناسب مع احتياجات المتعلمين المتنوعة. وبالتالي، يصبح الاستثمار في البنية التحتية الرقمية ضرورة استراتيجية لضمان استدامة الابتكار التعليمي.`,
    whatToNoticeEn:
      'Notice the consecutive MSA transition formulas ("علاوة على ذلك", "بالإضافة إلى ذلك", "وبالتالي") and uniform formal register.',
    whatToNoticeAr:
      'لاحظ توالي الروابط الفصحى النمطية ("علاوة على ذلك"، "بالإضافة إلى ذلك"، "وبالتالي") مع تجانس شبه كامل في الرسمية وطول الجمل.',
  },
];

export const ZERO_KNOWLEDGE_GUIDE_CHAPTERS: GuideChapter[] = [
  {
    id: 'chap-start',
    stepNumber: '01',
    titleEn: 'Start Here: What TEXTPRINT Does (Zero Experience Needed)',
    titleAr: 'ابدأ هنا: ماذا يفعل النظام؟ (بدون خبرة مسبقة)',
    summaryEn:
      'TEXTPRINT is a scientific laboratory for studying how humans and AI write—and what changes when one edits the other. You do not need math or coding knowledge to read its signals.',
    summaryAr:
      'منصة تيكست برينت هي مختبر علمي لدراسة أسلوب الكتابة البشري والآلي، وكيف يتغيّر النص عندما يحرّر الإنسان نصاً آلياً أو العكس. لا تحتاج أي خلفية برمجية أو إحصائية للبدء.',
    steps: [
      {
        labelEn: 'Step 1 · Pick or paste any paragraph',
        labelAr: 'الخطوة ١ · اختر أو الصق أي فقرة نصية',
        detailEn: 'Choose a built-in English or Arabic demo passage below, or paste at least 40 words of your own writing.',
        detailAr: 'اختر نموذجاً جاهزاً باللغة العربية أو الإنجليزية من الأسفل، أو الصق نصاً لا يقل عن ٤٠ كلمة.',
      },
      {
        labelEn: 'Step 2 · Read three simple clues',
        labelAr: 'الخطوة ٢ · اقرأ ثلاثة مؤشرات بسيطة',
        detailEn: 'Look at Burstiness (sentence rhythm variety), Transition Density (formal connectors), and Guiraud R (vocabulary richness).',
        detailAr: 'راقب تباين الجمل (تنوع الإيقاع)، وكثافة الروابط الرسمية، ومؤشر غيرو (ثراء المفردات).',
      },
      {
        labelEn: 'Step 3 · Remember: Probability, not a verdict',
        labelAr: 'الخطوة ٣ · تذكّر: النتيجة احتمالية وليست حكماً قطعياً',
        detailEn: 'Even human academic writing can look formal. TEXTPRINT shows a confidence range (±%) and highlights why.',
        detailAr: 'قد تشبه الكتابة الأكاديمية البشرية أسلوب الذكاء الاصطناعي، لذا يعرض النظام نطاق ثقة (±٪) مع الأدلة المفسّرة.',
      },
    ],
    realExampleId: 'ex-en-human',
    targetModule: 'ai_analysis',
    ctaEn: 'Try in 07. AI Text Analysis',
    ctaAr: 'جرّب في 07. التحليل الاحتمالي',
  },
  {
    id: 'chap-compare',
    stepNumber: '02',
    titleEn: 'Comparing Two Texts Side-by-Side (Human vs. AI or Edited)',
    titleAr: 'مقارنة نصين جنباً إلى جنب (بشري مقابل آلي أو محرّر)',
    summaryEn:
      'Seeing two passages side-by-side on the same topic is the fastest way for beginners to spot stylometric fingerprints.',
    summaryAr:
      'مقارنة نصين حول الموضوع نفسه هي أسرع طريقة للمبتدئين لاكتشاف الفروق الأسلوبية الدقيقة.',
    steps: [
      {
        labelEn: 'Spot word-level edits',
        labelAr: 'اكتشف التعديلات على مستوى الكلمة',
        detailEn: 'Green highlights show added phrases; red strikethrough shows deleted words and replaced connectors.',
        detailAr: 'اللون الأخضر يبرز الكلمات المضافة، والأحمر المشطوب يوضح الكلمات المحذوفة أو المستبدلة.',
      },
      {
        labelEn: 'Check Delta (B - A)',
        labelAr: 'اقرأ الفارق الكمي (ب - أ)',
        detailEn: 'Positive Burstiness delta means Text B has livelier rhythm; positive Transition delta means Text B relies more on textbook connectors.',
        detailAr: 'الفارق الموجب في التباين يعني إيقاعاً أكثر حيوية في النص ب، والفارق الموجب في الروابط يعني زيادة الأدوات الخطابية الرسمية.',
      },
    ],
    realExampleId: 'ex-en-ai',
    targetModule: 'compare',
    ctaEn: 'Open 08. Comparative Lab',
    ctaAr: 'افتح 08. المختبر المقارن',
  },
  {
    id: 'chap-import-govern',
    stepNumber: '03',
    titleEn: 'Collecting, Searching & Validating Your Own Texts',
    titleAr: 'استيراد نصوصك والبحث فيها والتحقق من جودتها',
    summaryEn:
      'Before analyzing a collection or training a baseline model, TEXTPRINT separates RAW imports from PROCESSED and APPROVED records so duplicates never leak into results.',
    summaryAr:
      'قبل تحليل مجموعة نصوص، يفصل النظام بين الطبقة الخام (RAW) والمعالَجة (PROCESSED) والمعتمدة (APPROVED) لمنع التكرار وتسرب البيانات.',
    steps: [
      {
        labelEn: 'Drag & Drop CSV or JSONL',
        labelAr: 'اسحب وأفلت ملف CSV أو JSONL',
        detailEn: 'In 02. Data Acquisition, drop one or multiple CSV files; columns auto-map and duplicate hashes are automatically flagged.',
        detailAr: 'في وحدة 02. استقطاب البيانات، أسقط ملفات CSV ليتم ربط الأعمدة واكتشاف التكرار تلقائياً.',
      },
      {
        labelEn: 'Search & Bulk Verify',
        labelAr: 'ابحث وحقّق بالجملة',
        detailEn: 'In 03. Dataset Management, search by ID, dataset, or keyword, select rows via checkboxes, and approve or quarantine in one click.',
        detailAr: 'في 03. إدارة المدونات، ابحث بالمعرّف أو الكلمة المفتاحية، وحدد العينات لاعتمادها أو عزلها بضغطة واحدة.',
      },
    ],
    targetModule: 'datasets',
    ctaEn: 'Open 03. Dataset Management',
    ctaAr: 'افتح 03. إدارة المدونات',
  },
  {
    id: 'chap-dictionary',
    stepNumber: '04',
    titleEn: 'Building Bilingual Dictionaries (.mdd / .mdx / TEI P5) & Symbol Charts',
    titleAr: 'بناء القواميس ثنائية اللغة وتصدير صيغة (.mdd) ورسوم اللسانيات',
    summaryEn:
      'Create custom English-Arabic linguistic dictionaries with IPA pronunciation, Arabic 3-letter roots, corpus usage examples, and export them to international formats including binary MDict .mdd archives.',
    summaryAr:
      'أنشئ قواميس متخصصة (إنجليزي ↔ عربي) تشمل النطق الصوتي IPA والجذور الثلاثية العربية وأمثلة حقيقية من المدونة، وصدّرها بصيغ عالمية تشمل ملفات MDict ‎.mdd و ‎.mdx و TEI P5.',
    steps: [
      {
        labelEn: 'Extract terms straight from your texts',
        labelAr: 'استخرج المصطلحات مباشرة من نصوصك',
        detailEn: 'Click "Extract Terms from Corpus" to automatically discover candidate words with measured frequencies and context sentences.',
        detailAr: 'اضغط "استخراج مصطلحات من المدونة" لاكتشاف الكلمات المتكررة مع أمثلة سياقية حقيقية.',
      },
      {
        labelEn: 'Insert IPA & Arabic Diacritic symbols in one click',
        labelAr: 'أدرج رموز IPA والتشكيل العربي بنقرة واحدة',
        detailEn: 'Use the interactive IPA Consonant/Vowel & Arabic Tashkeel table to learn each sound and click to copy or insert.',
        detailAr: 'استخدم جدول الرموز الصوتية والتشكيل التفاعلي لمعرفة مخرج كل صوت وإدراجه بسهولة.',
      },
    ],
    realExampleId: 'ex-ar-egyptian',
    targetModule: 'dictionary',
    ctaEn: 'Open 15. Dictionary & Symbols',
    ctaAr: 'افتح 15. صانع القواميس',
  },
  {
    id: 'chap-deploy',
    stepNumber: '05',
    titleEn: 'Deploying to GitHub Pages, Firebase, Vercel, or Cloud Run',
    titleAr: 'نشر النظام على GitHub Pages أو Firebase أو Vercel أو Cloud Run',
    summaryEn:
      'All core linguistic engines, dictionary exports, and IndexedDB work 100% offline on static hosts—and you can attach an Express Cloud Run backend URL anytime for live Gemini AI.',
    summaryAr:
      'تعمل جميع المحركات اللغوية وتصدير القواميس وقاعدة IndexedDB بنسبة ١٠٠٪ على الاستضافة الساكنة، مع إمكانية ربط خادم Cloud Run لاحقاً لتشغيل Gemini السحابي.',
    steps: [
      {
        labelEn: 'Static Hosts (GitHub Pages / Firebase Hosting / Vercel)',
        labelAr: 'الاستضافة الساكنة (GitHub Pages / Firebase / Vercel)',
        detailEn: 'Build dist/ with npm run build. When /api/* returns HTML fallback, TEXTPRINT automatically switches to local deterministic Copilot & Stylometry fallback.',
        detailAr: 'ابنِ مجلد dist/ عبر npm run build. وعند غياب Express، ينتقل النظام تلقائياً للوضع المحلي الحتمي دون أخطاء.',
      },
      {
        labelEn: 'Full-Stack Cloud Run',
        labelAr: 'الاستضافة الكاملة على Cloud Run',
        detailEn: 'Run node server.ts on Node 22 (port 3000) for server-side Gemini ThinkingLevel.HIGH, Search Grounding, and Cloud SQL PostgreSQL.',
        detailAr: 'شغّل node server.ts على Node 22 لتفعيل التحليل العميق لـ Gemini والبحث الموثق وقاعدة بيانات Cloud SQL.',
      },
    ],
    targetModule: 'reports',
    ctaEn: 'Open 12. Deployment Report',
    ctaAr: 'افتح 12. تقرير النشر والتقنيات',
  },
];
