import type { TextSample } from './types';

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'particle'
  | 'phrase'
  | 'term';

export interface DictionaryEntry {
  id: string;
  headword: string;
  arabic: string;
  pos: PartOfSpeech;
  root: string;
  ipa: string;
  domain: string;
  definitionEn: string;
  definitionAr: string;
  exampleEn: string;
  exampleAr: string;
  synonyms: string[];
  frequencyInCorpus: number;
  mediaKey: string;
}

export interface LinguisticSymbol {
  symbol: string;
  codepoint: string;
  group: 'ipa_consonant' | 'ipa_vowel' | 'arabic_diacritic' | 'arabic_phoneme';
  nameEn: string;
  nameAr: string;
  articulationEn: string;
  articulationAr: string;
  exampleToken: string;
  exampleGloss: string;
}

export const STARTER_LINGUISTIC_DICTIONARY: DictionaryEntry[] = [
  {
    id: 'dict-stylometry',
    headword: 'stylometry',
    arabic: 'علم الأسلوبية الإحصائية',
    pos: 'noun',
    root: 'س-ل-ب / stylos',
    ipa: '/staɪˈlɒmɪtri/',
    domain: 'computational_linguistics',
    definitionEn:
      'Quantitative study of measurable linguistic style features—such as sentence rhythm, vocabulary richness, and punctuation entropy—to characterize writing origin or genre.',
    definitionAr:
      'دراسة كمية للسمات الأسلوبية القابلة للقياس مثل إيقاع الجمل وثراء المفردات وإنتروبيا الترقيم لوصف خصائص الكتابة وأصلها.',
    exampleEn: 'Multilingual stylometry compares English and Arabic passages without relying on surface keywords.',
    exampleAr: 'تقارن الأسلوبية متعددة اللغات النصوص الإنجليزية والعربية دون الاعتماد على كلمات سطحية.',
    synonyms: ['authorship attribution', 'computational stylistics'],
    frequencyInCorpus: 4,
    mediaKey: '\\cards\\dict-stylometry.svg',
  },
  {
    id: 'dict-burstiness',
    headword: 'burstiness',
    arabic: 'تباين إيقاع الجمل (التدفق المتقطع)',
    pos: 'noun',
    root: 'ت-ف-ق / burst',
    ipa: '/ˈbɜːrstɪnəs/',
    domain: 'stylometry',
    definitionEn:
      'Variation in sentence lengths across a passage (coefficient of variation). Human writing mixes short abrupt bursts with long clauses; unedited LLM text often stays uniform.',
    definitionAr:
      'مقدار التفاوت في أطوال الجمل داخل النص (معامل التشتت)؛ يمزج البشر بين الجمل القصيرة والمركبة بينما يميل النص الآلي إلى الانتظام.',
    exampleEn: 'Burstiness drops sharply when a clerk irons messy dockside notes into uniform summaries.',
    exampleAr: 'ينخفض تباين الإيقاع عند توحيد الملاحظات السردية في صياغة تقريرية منتظمة.',
    synonyms: ['cadence variance', 'syntactic rhythm'],
    frequencyInCorpus: 6,
    mediaKey: '\\cards\\dict-burstiness.svg',
  },
  {
    id: 'dict-guiraud',
    headword: 'Guiraud index',
    arabic: 'مؤشر غيرو للثراء المعجمي',
    pos: 'term',
    root: 'ث-ر-ي / Guiraud',
    ipa: '/ɡiˈroʊ ˈɪndɛks/',
    domain: 'lexicometrics',
    definitionEn:
      'Length-adjusted lexical diversity formula R = V / sqrt(N), dividing unique word types V by the square root of total word tokens N.',
    definitionAr:
      'مقياس لتنوّع المفردات معدّل لطول النص عبر قسمة عدد الكلمات الفريدة على الجذر التربيعي لإجمالي الكلمات.',
    exampleEn: 'A Guiraud index above 7.0 in a 150-word essay signals high lexical variety.',
    exampleAr: 'ارتفاع مؤشر غيرو فوق ٧٫٠ في نص متوسط يشير إلى تنوّع معجمي مرتفع.',
    synonyms: ['root type-token ratio', 'RTTR'],
    frequencyInCorpus: 5,
    mediaKey: '\\cards\\dict-guiraud.svg',
  },
  {
    id: 'dict-hapax',
    headword: 'hapax legomenon',
    arabic: 'الكلمة الأحادية الورود (هاباكس)',
    pos: 'term',
    root: 'و-ح-د / ἅπαξ',
    ipa: '/ˈhæpæks lɪˈɡɒmɪnɒn/',
    domain: 'corpus_linguistics',
    definitionEn:
      'A word form that occurs exactly once within a given corpus or passage; elevated hapax ratio reflects specific lexical detail.',
    definitionAr:
      'لفظة ترد مرة واحدة فقط في المدونة أو المقطع المدروس؛ ارتفاع نسبتها يعكس حضور تفاصيل معجمية محددة.',
    exampleEn: 'Terms like "ledger" and "sycamore" act as hapax tokens inside narrative passages.',
    exampleAr: 'تعمل مفردات دقيقة مثل "المزلاج" و"الرصيف" بوصفها كلمات أحادية الورود في السرد.',
    synonyms: ['singleton token', 'once-occurring word'],
    frequencyInCorpus: 3,
    mediaKey: '\\cards\\dict-hapax.svg',
  },
  {
    id: 'dict-provenance',
    headword: 'provenance',
    arabic: 'سلسلة المنشأ والموثوقية',
    pos: 'noun',
    root: 'ن-ش-أ / provenire',
    ipa: '/ˈprɒvənəns/',
    domain: 'corpus_governance',
    definitionEn:
      'Verifiable record of a text sample source, license, collection date, and any subsequent human or machine editing operations.',
    definitionAr:
      'السجل الموثّق لمصدر العينة النصية وترخيصها وتاريخ جمعها وجميع عمليات التحرير البشرية أو الآلية اللاحقة.',
    exampleEn: 'Every sample requires explicit provenance before entering the APPROVED layer.',
    exampleAr: 'تتطلب كل عينة توثيق المنشأ والترخيص قبل انتقالها إلى الطبقة المعتمدة.',
    synonyms: ['lineage', 'source pedigree'],
    frequencyInCorpus: 7,
    mediaKey: '\\cards\\dict-provenance.svg',
  },
  {
    id: 'dict-tashkeel',
    headword: 'tashkeel (diacritics)',
    arabic: 'التشكيل (الحركات الإعرابية)',
    pos: 'noun',
    root: 'ش-ك-ل',
    ipa: '/taʃˈkiːl/',
    domain: 'arabic_phonology',
    definitionEn:
      'Optional Arabic diacritical marks (Fatha َ, Damma ُ, Kasra ِ, Shadda ّ, Sukun ْ, Tanwin) representing short vowels and consonant gemination.',
    definitionAr:
      'علامات الضبط الصوتي والصرفي فوق الحروف العربية أو تحتها (الفتحة والضمة والكسرة والشدة والسكون والتنوين).',
    exampleEn: 'Normalizing optional tashkeel ensures accurate Arabic lexical frequency counts.',
    exampleAr: 'يساعد عزل التشكيل الاختياري في طبقة المعالجة على توحيد إحصاء المفردات العربية.',
    synonyms: ['harakat', 'vocalization marks'],
    frequencyInCorpus: 4,
    mediaKey: '\\cards\\dict-tashkeel.svg',
  },
  {
    id: 'dict-coediting',
    headword: 'co-editing trajectory',
    arabic: 'مسار التحرير المشترك (البشري-الآلي)',
    pos: 'phrase',
    root: 'ح-ر-ر',
    ipa: '/koʊ ˈɛdɪtɪŋ trəˈdʒɛktəri/',
    domain: 'stylometry',
    definitionEn:
      'Sequence of revisions between a human author and an LLM (human-edited AI or AI-edited human), producing mixed stylometric footprints.',
    definitionAr:
      'تسلسل المراجعات بين الكاتب البشري والنموذج اللغوي، مما ينتج بصمات أسلوبية هجينة تجمع سمات الطرفين.',
    exampleEn: 'Adding em-dashes and colloquial pivots shifts an AI draft along a human-edited trajectory.',
    exampleAr: 'إدخال التعديلات التعبيرية يحوّل المسودة الآلية إلى مسار تحرير بشري واضح.',
    synonyms: ['hybrid revision', 'human-AI editing'],
    frequencyInCorpus: 5,
    mediaKey: '\\cards\\dict-coediting.svg',
  },
  {
    id: 'dict-diglossia',
    headword: 'diglossia (MSA vs. dialect)',
    arabic: 'الازدواجية اللغوية (الفصحى والعامية)',
    pos: 'noun',
    root: 'ز-و-ج / δίγλωσσος',
    ipa: '/daɪˈɡlɒsiə/',
    domain: 'sociolinguistics',
    definitionEn:
      'Coexistence of Modern Standard Arabic (arb) for formal writing and regional varieties such as Egyptian Arabic (arz) for everyday narrative.',
    definitionAr:
      'التعايش الوظيفي بين العربية الفصحى المعاصرة للكتابة الرسمية واللهجات المحكية كالمصرية في السرد اليومي.',
    exampleEn: 'Ignoring Arabic diglossia causes detectors to misclassify formal human essays.',
    exampleAr: 'إغفال الازدواجية اللغوية يؤدي إلى التباس التصنيف بين الفصحى البشرية والنص الآلي.',
    synonyms: ['register stratification', 'MSA-dialect continuum'],
    frequencyInCorpus: 4,
    mediaKey: '\\cards\\dict-diglossia.svg',
  },
  {
    id: 'dict-entropy',
    headword: 'punctuation entropy',
    arabic: 'إنتروبيا علامات الترقيم',
    pos: 'term',
    root: 'ر-ق-م / ἐντροπία',
    ipa: '/ˌpʌŋktʃuˈeɪʃən ˈɛntrəpi/',
    domain: 'information_theory',
    definitionEn:
      'Shannon information entropy computed across punctuation symbol probabilities (comma ،, semicolon ؛, em-dash —, colon, question ؟, exclamation !).',
    definitionAr:
      'إنتروبيا شانون المحسوبة على توزيع علامات الترقيم المختلفة بالبت لقياس تنوّع الفصل النحوي.',
    exampleEn: 'Higher punctuation entropy often correlates with expressive editorial human style.',
    exampleAr: 'يرتبط ارتفاع إنتروبيا الترقيم عادةً بتنوع الأساليب التحريرية البشرية.',
    synonyms: ['punctuation diversity', 'symbol entropy'],
    frequencyInCorpus: 4,
    mediaKey: '\\cards\\dict-entropy.svg',
  },
  {
    id: 'dict-lemma',
    headword: 'lemma & triliteral root',
    arabic: 'المدخل المعجمي والجذر الثلاثي',
    pos: 'term',
    root: 'ج-ذ-ر',
    ipa: '/ˈlɛmə/',
    domain: 'morphology',
    definitionEn:
      'Canonical dictionary form (lemma) paired in Semitic lexicography with its consonantal root (e.g., ك-ت-ب for كتاب، مكتبة، كاتب).',
    definitionAr:
      'الصيغة المعجمية المرجعية مقترنةً في المعاجم العربية بالجذر الثلاثي الصامت مثل (ك-ت-ب).',
    exampleEn: 'Indexing both Arabic surface stems and triliteral roots enriches cross-genre lexicon search.',
    exampleAr: 'ربط المفردات بجذورها الثلاثية يسهّل استكشاف المشتقات في القواميس التخصصية.',
    synonyms: ['citation form', 'consonantal root'],
    frequencyInCorpus: 3,
    mediaKey: '\\cards\\dict-lemma.svg',
  },
  {
    id: 'dict-calibration',
    headword: 'expected calibration error (ECE)',
    arabic: 'خطأ المعايرة المتوقع (ECE)',
    pos: 'term',
    root: 'ع-ي-ر',
    ipa: '/ɪkˈspɛktɪd ˌkælɪˈbreɪʃən ˈɛrər/',
    domain: 'evaluation',
    definitionEn:
      'Average gap between predicted confidence scores and actual empirical accuracy across probability bins; lower ECE means more trustworthy uncertainty estimates.',
    definitionAr:
      'متوسط الفارق بين نسبة الثقة التي يعلنها المصنّف والدقة الفعلية عبر الشرائح الاحتمالية.',
    exampleEn: 'Keeping ECE below 0.08 prevents overconfident authorship screening.',
    exampleAr: 'بقاء خطأ المعايرة دون ٠٫٠٨ يمنع المبالغة غير المبررة في نسب الثقة.',
    synonyms: ['probability calibration', 'reliability score'],
    frequencyInCorpus: 3,
    mediaKey: '\\cards\\dict-calibration.svg',
  },
  {
    id: 'dict-mdd',
    headword: 'MDict archive (.mdd / .mdx)',
    arabic: 'أرشيف القواميس الدولي (MDict .mdd / .mdx)',
    pos: 'noun',
    root: 'ق-م-س',
    ipa: '/ˈɛm dɪkt ˈɑːrkaɪv/',
    domain: 'lexicography',
    definitionEn:
      'Standard bilingual dictionary container format pairing an .mdx headword/HTML database with a companion .mdd resource archive storing phonetic SVG cards and media.',
    definitionAr:
      'صيغة قواميس دولية قياسية تقرن قاعدة المداخل (‎.mdx) بأرشيف الموارد والرسوم الصوتية المرافق (‎.mdd).',
    exampleEn: 'Researchers export TEXTPRINT dictionaries to .mdd and .mdx for GoldenDict and MDict readers.',
    exampleAr: 'يصدّر الباحثون قواميس المنصة بصيغتَي ‎.mdd و ‎.mdx لاستخدامها في تطبيقات القواميس العالمية.',
    synonyms: ['MDict v2.0', 'lexicon package'],
    frequencyInCorpus: 2,
    mediaKey: '\\cards\\dict-mdd.svg',
  },
];

export const LINGUISTIC_SYMBOLS_CATALOG: LinguisticSymbol[] = [
  // IPA Consonants (English & Arabic contrasts)
  {
    symbol: 'θ',
    codepoint: 'U+03B8',
    group: 'ipa_consonant',
    nameEn: 'Voiceless dental fricative (ث)',
    nameAr: 'صوت احتكاكي أسناني مهموس (ث)',
    articulationEn: 'Tongue tip gently between teeth, no vocal cord vibration.',
    articulationAr: 'طرف اللسان بين الأسنان دون اهتزاز الأوتار الصوتية (مثل حرف الثاء).',
    exampleToken: 'think / ثقافة',
    exampleGloss: '/θɪŋk/ · /θaˈqaːfa/',
  },
  {
    symbol: 'ð',
    codepoint: 'U+00F0',
    group: 'ipa_consonant',
    nameEn: 'Voiced dental fricative (ذ)',
    nameAr: 'صوت احتكاكي أسناني مجهور (ذ)',
    articulationEn: 'Dental fricative with vocal cord vibration.',
    articulationAr: 'صوت أسناني احتكاكي مع اهتزاز الأوتار الصوتية (مثل حرف الذال).',
    exampleToken: 'that / ذكاء',
    exampleGloss: '/ðæt/ · /ðaˈkaːʔ/',
  },
  {
    symbol: 'ʃ',
    codepoint: 'U+0283',
    group: 'ipa_consonant',
    nameEn: 'Voiceless postalveolar fricative (ش)',
    nameAr: 'صوت غاري لثوي مهموس (ش)',
    articulationEn: 'Raised tongue blade behind alveolar ridge.',
    articulationAr: 'احتكاك الهواء عند اللثة الخلفية (مثل حرف الشين).',
    exampleToken: 'shift / شوارع',
    exampleGloss: '/ʃɪft/ · /ʃaˈwaːrɪʕ/',
  },
  {
    symbol: 'ŋ',
    codepoint: 'U+014B',
    group: 'ipa_consonant',
    nameEn: 'Velar nasal',
    nameAr: 'صوت أنفي طبقي',
    articulationEn: 'Back of tongue seals against soft palate; air exits nose.',
    articulationAr: 'انحباس الهواء عند أقصى الحنك وخروجه عبر الأنف.',
    exampleToken: 'writing',
    exampleGloss: '/ˈraɪtɪŋ/',
  },
  {
    symbol: 'ʔ',
    codepoint: 'U+0294',
    group: 'arabic_phoneme',
    nameEn: 'Glottal stop (همزة ء)',
    nameAr: 'وقفة حنجرية (الهمزة ء)',
    articulationEn: 'Brief closure and release of the vocal folds (Arabic Hamza).',
    articulationAr: 'انغلاق كامل لحظي للأوتار الصوتية ثم انفتاحها (الهمزة العربية).',
    exampleToken: 'قراءة / أسلوب',
    exampleGloss: '/qɪˈraːʔa/ · /ʔusˈluːb/',
  },
  {
    symbol: 'ʕ',
    codepoint: 'U+0295',
    group: 'arabic_phoneme',
    nameEn: 'Voiced pharyngeal fricative (ع)',
    nameAr: 'صوت حلقي احتكاكي مجهور (العين ع)',
    articulationEn: 'Constriction of the pharynx root with voicing (distinctive Arabic Ayn).',
    articulationAr: 'تضييق البلعوم مع جهر الصوت (حرف العين العربي).',
    exampleToken: 'علم / معجم',
    exampleGloss: '/ʕɪlm/ · /ˈmuʕdʒam/',
  },
  {
    symbol: 'ħ',
    codepoint: 'U+0127',
    group: 'arabic_phoneme',
    nameEn: 'Voiceless pharyngeal fricative (ح)',
    nameAr: 'صوت حلقي احتكاكي مهموس (الحاء ح)',
    articulationEn: 'Friction in the lower pharynx without voicing (Arabic Ha).',
    articulationAr: 'احتكاك هوائي صافٍ في الحلق دون جهر (حرف الحاء).',
    exampleToken: 'تحليل / بحث',
    exampleGloss: '/taħˈliːl/ · /baħθ/',
  },
  {
    symbol: 'q',
    codepoint: 'U+0071',
    group: 'arabic_phoneme',
    nameEn: 'Voiceless uvular plosive (ق)',
    nameAr: 'صوت لهوي انفجاري مهموس (القاف ق)',
    articulationEn: 'Back of tongue contacts uvula (MSA Qaf; often shifts to ʔ in Egyptian Arabic).',
    articulationAr: 'التقاء أقصى اللسان باللهاة في الفصحى (ويتحول غالباً لهمزة في العامية المصرية).',
    exampleToken: 'قلم / قياس',
    exampleGloss: '/ˈqalam/ · /qɪˈjaːs/',
  },
  {
    symbol: 'x',
    codepoint: 'U+0078',
    group: 'arabic_phoneme',
    nameEn: 'Voiceless velar/uvular fricative (خ)',
    nameAr: 'صوت طبقي احتكاكي مهموس (الخاء خ)',
    articulationEn: 'Turbulent airflow at soft palate/uvula.',
    articulationAr: 'احتكاك الهواء عند أقصى الحنك واللهاة (حرف الخاء).',
    exampleToken: 'خطاب / خصائص',
    exampleGloss: '/xɪˈtˤaːb/',
  },
  // IPA Vowels
  {
    symbol: 'ə',
    codepoint: 'U+0259',
    group: 'ipa_vowel',
    nameEn: 'Schwa (mid-central unstressed vowel)',
    nameAr: 'صائت مركزي مخفّف (شوا)',
    articulationEn: 'Relaxed neutral tongue position in unstressed English syllables.',
    articulationAr: 'صوت علّة محايد في المقاطع الإنجليزية غير المنبورة.',
    exampleToken: 'analysis',
    exampleGloss: '/əˈnælɪsɪs/',
  },
  {
    symbol: 'æ',
    codepoint: 'U+00E6',
    group: 'ipa_vowel',
    nameEn: 'Near-open front unrounded vowel',
    nameAr: 'صائت أمامي شبه مفتوح',
    articulationEn: 'Low front vowel as in "pattern" and "hapax".',
    articulationAr: 'صوت ممدود مائل للفتح الأمامي كما في "pattern".',
    exampleToken: 'pattern',
    exampleGloss: '/ˈpætərn/',
  },
  {
    symbol: 'iː',
    codepoint: 'U+0069+02D0',
    group: 'ipa_vowel',
    nameEn: 'Long close front vowel (ياء مد)',
    nameAr: 'مد الياء الطويل المكسور',
    articulationEn: 'High front unrounded long vowel matching Arabic long ya.',
    articulationAr: 'حركة كسرة طويلة ممدودة بالياء.',
    exampleToken: 'meaning / تحليل',
    exampleGloss: '/ˈmiːnɪŋ/ · /taħˈliːl/',
  },
  {
    symbol: 'aː',
    codepoint: 'U+0061+02D0',
    group: 'ipa_vowel',
    nameEn: 'Long open vowel (ألف مد)',
    nameAr: 'مد الألف الطويل المفتوح',
    articulationEn: 'Sustained open vowel corresponding to Arabic Alif.',
    articulationAr: 'فتحة طويلة ممدودة بالألف.',
    exampleToken: 'كتابة / بيان',
    exampleGloss: '/kɪˈtaːba/',
  },
  // Arabic Diacritics (Tashkeel)
  {
    symbol: 'َ',
    codepoint: 'U+064E',
    group: 'arabic_diacritic',
    nameEn: 'Fatha (الفتحة)',
    nameAr: 'الفتحة (حركة فتح قصيرة /a/)',
    articulationEn: 'Short open /a/ vowel placed above a consonant letter.',
    articulationAr: 'صوت فتح قصير يُرسم شرطة مائلة فوق الحرف.',
    exampleToken: 'كَتَبَ',
    exampleGloss: '/ˈkataba/ (he wrote)',
  },
  {
    symbol: 'ُ',
    codepoint: 'U+064F',
    group: 'arabic_diacritic',
    nameEn: 'Damma (الضمة)',
    nameAr: 'الضمة (حركة ضم قصيرة /u/)',
    articulationEn: 'Short rounded /u/ vowel placed above a consonant letter.',
    articulationAr: 'صوت ضم قصير يُرسم واواً صغيرة فوق الحرف.',
    exampleToken: 'كُتُب',
    exampleGloss: '/ˈkutub/ (books)',
  },
  {
    symbol: 'ِ',
    codepoint: 'U+0650',
    group: 'arabic_diacritic',
    nameEn: 'Kasra (الكسرة)',
    nameAr: 'الكسرة (حركة كسر قصيرة /i/)',
    articulationEn: 'Short front /i/ vowel placed beneath a consonant letter.',
    articulationAr: 'صوت كسر قصير يُرسم شرطة مائلة تحت الحرف.',
    exampleToken: 'كِتاب',
    exampleGloss: '/kɪˈtaːb/ (book)',
  },
  {
    symbol: 'ّ',
    codepoint: 'U+0651',
    group: 'arabic_diacritic',
    nameEn: 'Shadda (الشدة)',
    nameAr: 'الشدة (تضعيف الحرف الساكن)',
    articulationEn: 'Doubles (geminates) consonant length; critical for Arabic morphological stems.',
    articulationAr: 'مضاعفة زمن نطق الصامت؛ أساسية في التفريق الصرفي للمعاني.',
    exampleToken: 'مُدَرِّس / عَلَّمَ',
    exampleGloss: '/muˈdarris/ (teacher)',
  },
  {
    symbol: 'ْ',
    codepoint: 'U+0652',
    group: 'arabic_diacritic',
    nameEn: 'Sukun (السكون)',
    nameAr: 'السكون (غياب الحركة)',
    articulationEn: 'Marks a vowelless consonant closing a syllable.',
    articulationAr: 'يشير إلى خلو الحرف من الحركة وإغلاق المقطع الصوتي.',
    exampleToken: 'مَكْتَب',
    exampleGloss: '/ˈmaktab/ (desk/office)',
  },
];

const EXTRACTION_STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'into', 'are', 'was', 'were',
  'have', 'has', 'had', 'not', 'but', 'all', 'when', 'while', 'they', 'their', 'which',
  'across', 'more', 'most', 'only', 'than', 'then', 'such', 'also', 'been', 'will',
  'في', 'من', 'على', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي',
  'التى', 'أن', 'إن', 'كان', 'كانت', 'كل', 'بين', 'قبل', 'بعد', 'رغم', 'حتي', 'حتى',
  'ليس', 'غير', 'كما', 'لكن', 'أكثر', 'منها', 'فيها', 'عليه', 'عليها',
]);

function inferPosHeuristic(token: string, isArabic: boolean): PartOfSpeech {
  if (isArabic) {
    if (token.startsWith('ال') || token.endsWith('ية') || token.endsWith('ات')) return 'noun';
    if (token.startsWith('يت') || token.startsWith('يس') || token.startsWith('تت')) return 'verb';
    return 'term';
  }
  if (token.endsWith('ly')) return 'adverb';
  if (token.endsWith('tion') || token.endsWith('ment') || token.endsWith('ness') || token.endsWith('ity')) {
    return 'noun';
  }
  if (token.endsWith('ize') || token.endsWith('ate') || token.endsWith('ing')) return 'verb';
  if (token.endsWith('ive') || token.endsWith('al') || token.endsWith('ous')) return 'adjective';
  return 'term';
}

export function extractCorpusDictionaryCandidates(
  samples: TextSample[],
  existingEntries: DictionaryEntry[],
  limit = 12
): DictionaryEntry[] {
  const existingSet = new Set(
    existingEntries.flatMap((e) => [e.headword.toLowerCase(), e.arabic.toLowerCase()])
  );

  const counts = new Map<
    string,
    { count: number; isArabic: boolean; sampleSnippet: string; sampleLang: 'en' | 'ar'; sampleDomain: string }
  >();

  for (const s of samples) {
    const tokens = s.text.match(/[A-Za-z][A-Za-z'-]{3,}|[\u0600-\u06FF]{3,}/g) || [];
    for (const rawTok of tokens) {
      const clean = rawTok.replace(/[\u064B-\u065F\u0670]/g, '').toLowerCase();
      if (clean.length < 4 || EXTRACTION_STOPWORDS.has(clean) || existingSet.has(clean)) continue;
      const isArabic = /[\u0600-\u06FF]/.test(clean);
      const prev = counts.get(clean);
      if (prev) {
        prev.count += 1;
      } else {
        const firstSentence =
          s.text.split(/[.!؟\n]/).find((line) => line.toLowerCase().includes(clean))?.trim() ||
          s.text.slice(0, 140);
        counts.set(clean, {
          count: 1,
          isArabic,
          sampleSnippet: firstSentence.slice(0, 160),
          sampleLang: isArabic ? 'ar' : 'en',
          sampleDomain: s.domain || 'corpus',
        });
      }
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token, info], idx) => {
      const slug = token.replace(/[^a-z0-9\u0600-\u06FF]+/gi, '-');
      return {
        id: `corpus-${idx + 1}-${slug.slice(0, 18)}`,
        headword: info.isArabic ? token : token,
        arabic: info.isArabic ? token : `مصطلح مدوني (${token})`,
        pos: inferPosHeuristic(token, info.isArabic),
        root: info.isArabic ? token.slice(0, 3).split('').join('-') : token.slice(0, 4),
        ipa: info.isArabic ? `/${token}/` : `/${token}/`,
        domain: info.sampleDomain,
        definitionEn: `Corpus-extracted lexical item appearing ${info.count} time(s) in domain "${info.sampleDomain}". Edit to add scholarly bilingual gloss.`,
        definitionAr: `مفردة مستخرجة آلياً من المدونة بتكرار ${info.count} في مجال "${info.sampleDomain}". يمكنك تحرير التعريف الدقيق.`,
        exampleEn: info.sampleLang === 'en' ? info.sampleSnippet : 'Extracted from Arabic corpus context.',
        exampleAr: info.sampleLang === 'ar' ? info.sampleSnippet : 'مستخرج من سياق نصي في المدونة.',
        synonyms: [],
        frequencyInCorpus: info.count,
        mediaKey: `\\cards\\corpus-${idx + 1}.svg`,
      };
    });
}

export interface LinguisticChartsData {
  posDistribution: Array<{ pos: string; count: number }>;
  scriptComposition: Array<{ script: string; count: number; color: string }>;
  wordLengthHistogram: Array<{ bucket: string; count: number }>;
  zipfTopTokens: Array<{ rank: number; token: string; count: number }>;
  totalAnalyzedTokens: number;
  totalArabicDiacritics: number;
}

export function computeLinguisticChartsData(
  entries: DictionaryEntry[],
  samples: TextSample[]
): LinguisticChartsData {
  const posCounts = new Map<string, number>();
  for (const e of entries) {
    posCounts.set(e.pos, (posCounts.get(e.pos) ?? 0) + 1);
  }
  const posDistribution = Array.from(posCounts.entries())
    .map(([pos, count]) => ({ pos, count }))
    .sort((a, b) => b.count - a.count);

  let latinChars = 0;
  let arabicLetters = 0;
  let arabicDiacritics = 0;
  let punctuationMarks = 0;
  let digits = 0;

  const lengthBuckets: Record<string, number> = {
    '1-2': 0,
    '3-4': 0,
    '5-6': 0,
    '7-8': 0,
    '9+': 0,
  };

  const tokenFreq = new Map<string, number>();
  let totalAnalyzedTokens = 0;

  for (const s of samples) {
    for (const ch of s.text) {
      if (/[A-Za-z]/.test(ch)) latinChars += 1;
      else if (/[\u0621-\u064A\u0671-\u06D3]/.test(ch)) arabicLetters += 1;
      else if (/[\u064B-\u065F\u0670]/.test(ch)) arabicDiacritics += 1;
      else if (/[0-9\u0660-\u0669]/.test(ch)) digits += 1;
      else if (/[.,;:!?—\-،؛؟()"]/.test(ch)) punctuationMarks += 1;
    }

    const words = s.text.match(/[A-Za-z][A-Za-z'-]*|[\u0600-\u06FF]+/g) || [];
    for (const w of words) {
      const bare = w.replace(/[\u064B-\u065F\u0670]/g, '').toLowerCase();
      if (!bare) continue;
      totalAnalyzedTokens += 1;
      const len = bare.length;
      if (len <= 2) lengthBuckets['1-2'] += 1;
      else if (len <= 4) lengthBuckets['3-4'] += 1;
      else if (len <= 6) lengthBuckets['5-6'] += 1;
      else if (len <= 8) lengthBuckets['7-8'] += 1;
      else lengthBuckets['9+'] += 1;

      if (bare.length >= 3 && !EXTRACTION_STOPWORDS.has(bare)) {
        tokenFreq.set(bare, (tokenFreq.get(bare) ?? 0) + 1);
      }
    }
  }

  const scriptComposition = [
    { script: 'Latin Letters', count: latinChars, color: '#0284c7' },
    { script: 'Arabic Letters', count: arabicLetters, color: '#059669' },
    { script: 'Punctuation', count: punctuationMarks, color: '#d97706' },
    { script: 'Arabic Tashkeel', count: arabicDiacritics, color: '#7c3aed' },
    { script: 'Digits', count: digits, color: '#64748b' },
  ];

  const wordLengthHistogram = Object.entries(lengthBuckets).map(([bucket, count]) => ({
    bucket,
    count,
  }));

  const zipfTopTokens = Array.from(tokenFreq.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([token, count], idx) => ({
      rank: idx + 1,
      token,
      count,
    }));

  return {
    posDistribution,
    scriptComposition,
    wordLengthHistogram,
    zipfTopTokens,
    totalAnalyzedTokens,
    totalArabicDiacritics: arabicDiacritics,
  };
}
