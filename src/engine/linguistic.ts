import type { FeatureSpec, LinguisticAnalysisResult } from './types';

export const LINGUISTIC_ENGINE_VERSION = '1.4.0-multilingual';

export const FEATURE_CATALOG: FeatureSpec[] = [
  {
    feature_id: 'VOCAB_GUIRAUD_R',
    category: 'vocabulary',
    name: "Guiraud's Root Type-Token Ratio",
    definition: 'Lexical richness normalized by the square root of token count (V / sqrt(N)).',
    calculation_method: 'unique_tokens / Math.sqrt(total_tokens)',
    supported_languages: ['en', 'ar'],
    version: '1.2.0',
    reliability_notes: 'Less sensitive to sample length than raw TTR, though Arabic clitics must be normalized before comparison.',
    example: '7.42 on a 220-word academic paragraph',
  },
  {
    feature_id: 'VOCAB_HAPAX_RATIO',
    category: 'vocabulary',
    name: 'Hapax Legomena Ratio',
    definition: 'Proportion of words occurring exactly once within the analyzed passage.',
    calculation_method: 'count(freq == 1) / total_tokens',
    supported_languages: ['en', 'ar'],
    version: '1.1.0',
    reliability_notes: 'Sensitive to short passages (< 80 tokens) where most words appear once.',
    example: '0.68 in diverse literary prose',
  },
  {
    feature_id: 'SENT_BURSTINESS',
    category: 'sentence_structure',
    name: 'Sentence Length Burstiness (CV)',
    definition: 'Coefficient of variation of sentence lengths (std_dev / mean). Measures rhythmic cadence variation.',
    calculation_method: 'std_dev(sentence_word_counts) / mean(sentence_word_counts)',
    supported_languages: ['en', 'ar'],
    version: '1.3.0',
    reliability_notes: 'Requires >= 3 sentences; Arabic coordinate clauses using "و" can inflate raw sentence lengths if punctuation is sparse.',
    example: '0.52 (varied human rhythm) vs 0.19 (uniform cadence)',
  },
  {
    feature_id: 'SENT_CLAUSE_DENSITY',
    category: 'sentence_structure',
    name: 'Subordinate Clause Density',
    definition: 'Average count of subordinating/coordinating clause markers per sentence.',
    calculation_method: 'clause_markers / sentence_count',
    supported_languages: ['en', 'ar'],
    version: '1.1.0',
    reliability_notes: 'Uses language-specific marker lexicons for English and Arabic.',
    example: '1.85 markers/sentence in academic discourse',
  },
  {
    feature_id: 'PARA_CONSISTENCY_CV',
    category: 'paragraph_structure',
    name: 'Paragraph Length Consistency (CV)',
    definition: 'Coefficient of variation of word counts across paragraphs.',
    calculation_method: 'std_dev(paragraph_word_counts) / mean(paragraph_word_counts)',
    supported_languages: ['en', 'ar'],
    version: '1.0.0',
    reliability_notes: 'Only informative for multi-paragraph documents (>= 3 paragraphs).',
    example: '0.14 in templated summaries',
  },
  {
    feature_id: 'PUNCT_ENTROPY',
    category: 'punctuation',
    name: 'Punctuation Shannon Entropy',
    definition: 'Information entropy across punctuation mark classes (period, comma/،, semicolon/؛, colon, dash, question/؟, exclamation).',
    calculation_method: '-sum(p_i * log2(p_i)) over observed punctuation classes',
    supported_languages: ['en', 'ar'],
    version: '1.2.0',
    reliability_notes: 'Recognizes both Latin punctuation and Arabic Unicode marks (، ؛ ؟).',
    example: '1.84 bits in varied editorial prose',
  },
  {
    feature_id: 'STYLE_TRANSITION_DENSITY',
    category: 'writing_style',
    name: 'Discourse Transition Density',
    definition: 'Frequency of explicit discourse connectors per 100 words.',
    calculation_method: '(matched_discourse_markers / word_count) * 100',
    supported_languages: ['en', 'ar'],
    version: '1.3.0',
    reliability_notes: 'Tracks English (moreover, furthermore, however...) and Arabic (علاوة على ذلك، من ناحية أخرى، بالرغم من...).',
    example: '2.90 per 100 words in structured LLM essays',
  },
  {
    feature_id: 'STYLE_FORMALITY',
    category: 'writing_style',
    name: 'Lexical Formality Index',
    definition: 'Composite signal of word length, passive/nominalized phrasing, and absence of contractions or colloquial markers.',
    calculation_method: 'weighted_sum(avg_word_len, nominal_markers, -contraction_rate)',
    supported_languages: ['en', 'ar'],
    version: '1.2.0',
    reliability_notes: 'Arabic evaluates MSA vs Egyptian dialect particles separately from English contraction heuristics.',
    example: '0.78 for peer-reviewed abstracts',
  },
  {
    feature_id: 'ADD_PASSIVE_RATIO',
    category: 'additional',
    name: 'Passive Voice Ratio',
    definition: 'Estimated proportion of sentences exhibiting passive constructions.',
    calculation_method: 'passive_sentences / sentence_count',
    supported_languages: ['en', 'ar'],
    version: '1.1.0',
    reliability_notes: 'English checks auxiliary + -ed/-en; Arabic checks تم/يتم + verbal noun and passive prefixes.',
    example: '0.24 in scientific methodology text',
  },
  {
    feature_id: 'ADD_READABILITY',
    category: 'additional',
    name: 'Language-Calibrated Readability Index',
    definition: 'Flesch-Kincaid Grade Level for English; AARI-inspired word/sentence complexity score for Arabic.',
    calculation_method: 'EN: 0.39*ASL + 11.8*ASW - 15.59; AR: 0.45*ASL + 2.4*AWL',
    supported_languages: ['en', 'ar'],
    version: '1.2.0',
    reliability_notes: 'English and Arabic readability scores are reported on separate scales and must not be directly equated.',
    example: 'Grade 11.4 (EN) / Complexity 14.2 (AR)',
  },
];

const EN_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this', 'these', 'those',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'in', 'on', 'at',
  'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before',
  'after', 'above', 'below', 'to', 'from', 'up', 'down', 'of', 'off', 'over', 'under', 'as',
  'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she',
  'her', 'i', 'me', 'my', 'not', 'no', 'so', 'such', 'which', 'who', 'whom', 'what', 'when',
  'where', 'why', 'how',
]);

const AR_STOPWORDS = new Set([
  'في', 'من', 'على', 'إلى', 'عن', 'مع', 'أن', 'إن', 'كان', 'كانت', 'يكون', 'هذا', 'هذه',
  'ذلك', 'تلك', 'التي', 'الذي', 'الذين', 'ما', 'لا', 'لم', 'لن', 'قد', 'أو', 'و', 'ثم',
  'حتى', 'بين', 'عند', 'منذ', 'بعد', 'قبل', 'كل', 'بعض', 'غير', 'كما', 'هو', 'هي', 'هم',
  'نحن', 'أنت', 'أنا', 'لها', 'له', 'لهم', 'بها', 'به', 'فيها', 'فيه',
]);

const EN_TRANSITIONS = [
  'moreover', 'furthermore', 'additionally', 'consequently', 'therefore', 'however', 'nevertheless',
  'nonetheless', 'conversely', 'meanwhile', 'subsequently', 'ultimately', 'in conclusion',
  'on the other hand', 'as a result', 'for instance', 'in contrast', 'notably', 'significantly',
  'specifically', 'importantly', 'overall', 'similarly', 'likewise',
];

const AR_TRANSITIONS = [
  'علاوة على ذلك', 'بالإضافة إلى ذلك', 'من ناحية أخرى', 'وبالتالي', 'لذلك', 'ومع ذلك',
  'على الرغم من', 'في الختام', 'خلاصة القول', 'على سبيل المثال', 'في المقابل', 'من الجدير بالذكر',
  'علاوة على', 'نتيجة لذلك', 'بشكل عام', 'تجدر الإشارة', 'فضلا عن',
];

const EN_SUBORDINATORS = [
  'although', 'because', 'since', 'while', 'whereas', 'unless', 'until', 'whenever',
  'wherever', 'though', 'whether', 'which', 'that', 'who', 'whom', 'whose',
];

const AR_SUBORDINATORS = [
  'لأن', 'بينما', 'حيث', 'إذا', 'عندما', 'رغم', 'بما أن', 'كي', 'لكي', 'التي', 'الذي', 'إذ',
];

const EGYPTIAN_AR_MARKERS = [
  'عشان', 'علشان', 'إزاي', 'ازاي', 'كده', 'كدا', 'مش', 'مفيش', 'عايز', 'عاوز', 'دلوقتي',
  'يعني', 'بتاع', 'بتاعت', 'اللي', 'ده', 'دي', 'دول', 'ايه', 'إيه', 'ليه', 'فين', 'حاجة', 'برضو',
];

export function normalizeUnicodeText(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Normalize Arabic presentation alef/ya/ta forms subtly while preserving raw readability
    .replace(/[\u064B-\u065F\u0670]/g, '') // Strip Arabic tashkeel diacritics for normalized comparison
    .replace(/\u0640/g, '') // Strip tatweel
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function detectLanguageAndDialect(text: string): {
  language: 'en' | 'ar' | 'mixed';
  dialect: string | null;
  isRtl: boolean;
} {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latinChars = (text.match(/[A-Za-z]/g) || []).length;
  const totalAlpha = arabicChars + latinChars;

  if (totalAlpha === 0) {
    return { language: 'en', dialect: null, isRtl: false };
  }

  const arRatio = arabicChars / totalAlpha;
  const enRatio = latinChars / totalAlpha;

  if (arRatio > 0.7) {
    const normalized = normalizeUnicodeText(text);
    const egyptianHits = EGYPTIAN_AR_MARKERS.filter((m) =>
      new RegExp(`(^|\\s)${m}(\\s|$|[،؟.!])`).test(normalized)
    ).length;
    return {
      language: 'ar',
      dialect: egyptianHits >= 2 ? 'Egyptian Arabic (arz)' : 'Modern Standard Arabic (arb)',
      isRtl: true,
    };
  }
  if (enRatio > 0.7) {
    return {
      language: 'en',
      dialect: null,
      isRtl: false,
    };
  }
  return {
    language: 'mixed',
    dialect: 'Code-switched EN/AR',
    isRtl: arRatio > enRatio,
  };
}

export function tokenizeWords(text: string, language: 'en' | 'ar' | 'mixed'): string[] {
  const normalized = normalizeUnicodeText(text).toLowerCase();
  if (language === 'ar') {
    return (normalized.match(/[\u0621-\u064A0-9]+/g) || []).filter(Boolean);
  }
  if (language === 'mixed') {
    return (normalized.match(/[\u0621-\u064A]+|[a-z0-9]+(?:'[a-z]+)?/g) || []).filter(Boolean);
  }
  return (normalized.match(/[a-z0-9]+(?:'[a-z]+)?/g) || []).filter(Boolean);
}

export function splitSentences(text: string): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  const parts = cleaned
    .split(/(?<=[.!?؟])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : [cleaned];
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  const variance = nums.reduce((sum, v) => sum + (v - m) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

function countSyllablesEn(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (clean.length <= 3) return 1;
  const stripped = clean.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function analyzeTextLinguistics(rawText: string): LinguisticAnalysisResult {
  const text = rawText.trim();
  const normalized = normalizeUnicodeText(text);
  const { language, dialect, isRtl } = detectLanguageAndDialect(text);
  const words = tokenizeWords(text, language);
  const wordCount = words.length;

  const stopwords = language === 'ar' ? AR_STOPWORDS : EN_STOPWORDS;
  const freqMap = new Map<string, number>();
  for (const w of words) {
    freqMap.set(w, (freqMap.get(w) ?? 0) + 1);
  }

  const uniqueWords = freqMap.size;
  const ttr = wordCount > 0 ? uniqueWords / wordCount : 0;
  const guiraudR = wordCount > 0 ? uniqueWords / Math.sqrt(wordCount) : 0;
  let hapaxCount = 0;
  let rareCount = 0;
  let functionCount = 0;

  for (const [w, count] of freqMap.entries()) {
    if (count === 1) hapaxCount += 1;
    if (count === 1 && w.length >= 7) rareCount += 1;
  }
  for (const w of words) {
    if (stopwords.has(w)) functionCount += 1;
  }

  const hapaxRatio = wordCount > 0 ? hapaxCount / wordCount : 0;
  const rareRatio = wordCount > 0 ? rareCount / wordCount : 0;

  const topWords = Array.from(freqMap.entries())
    .filter(([w]) => !stopwords.has(w) && w.length > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  const avgWordLength =
    wordCount > 0 ? words.reduce((acc, w) => acc + w.length, 0) / wordCount : 0;

  // Bigrams and Trigrams
  const bigramCounts = new Map<string, number>();
  const trigramCounts = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const bg = `${words[i]} ${words[i + 1]}`;
    bigramCounts.set(bg, (bigramCounts.get(bg) ?? 0) + 1);
    if (i < words.length - 2) {
      const tg = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      trigramCounts.set(tg, (trigramCounts.get(tg) ?? 0) + 1);
    }
  }
  const repeatedBigrams = Array.from(bigramCounts.values()).filter((c) => c > 1).length;
  const repeatedBigramRatio =
    bigramCounts.size > 0 ? repeatedBigrams / bigramCounts.size : 0;

  const topBigrams = Array.from(bigramCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([gram, count]) => ({ gram, count }));

  const topTrigrams = Array.from(trigramCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([gram, count]) => ({ gram, count }));

  // Sentence Structure
  const sentences = splitSentences(text);
  const sentenceWordLists = sentences.map((s) => tokenizeWords(s, language));
  const sentenceLengths = sentenceWordLists.map((list) => list.length).filter((n) => n > 0);
  const effectiveLengths = sentenceLengths.length > 0 ? sentenceLengths : [wordCount];
  const avgSentenceLen = mean(effectiveLengths);
  const sentenceStd = stdDev(effectiveLengths);
  const burstinessIndex = avgSentenceLen > 0 ? sentenceStd / avgSentenceLen : 0;
  const minSentenceLen = Math.min(...effectiveLengths);
  const maxSentenceLen = Math.max(...effectiveLengths);

  const subordinators = language === 'ar' ? AR_SUBORDINATORS : EN_SUBORDINATORS;
  let clauseHits = 0;
  for (const w of words) {
    if (subordinators.includes(w)) clauseHits += 1;
  }
  const clauseDensity = sentences.length > 0 ? clauseHits / sentences.length : 0;
  const syntacticVariation = Math.min(1, burstinessIndex * 0.8 + Math.min(1, clauseDensity / 3) * 0.2);

  // Paragraph Structure
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const effectiveParas = paragraphs.length > 0 ? paragraphs : text ? [text] : [];
  const paraLengths = effectiveParas.map((p) => tokenizeWords(p, language).length);
  const avgParaWords = mean(paraLengths);
  const paraCV = avgParaWords > 0 ? stdDev(paraLengths) / avgParaWords : 0;

  const openingTokens = effectiveParas
    .map((p) => tokenizeWords(p, language)[0] ?? '')
    .filter(Boolean);
  const uniqueOpenings = new Set(openingTokens).size;
  const openingRepetitionRatio =
    openingTokens.length > 1 ? 1 - uniqueOpenings / openingTokens.length : 0;

  // Adjacent sentence lexical overlap (cohesion)
  let overlapSum = 0;
  let overlapPairs = 0;
  for (let i = 0; i < sentenceWordLists.length - 1; i++) {
    const a = new Set(sentenceWordLists[i].filter((w) => !stopwords.has(w)));
    const b = new Set(sentenceWordLists[i + 1].filter((w) => !stopwords.has(w)));
    if (a.size > 0 && b.size > 0) {
      let inter = 0;
      for (const tok of a) if (b.has(tok)) inter += 1;
      const union = new Set([...a, ...b]).size;
      overlapSum += union > 0 ? inter / union : 0;
      overlapPairs += 1;
    }
  }
  const cohesionScore = overlapPairs > 0 ? overlapSum / overlapPairs : 0;

  // Punctuation
  const charCount = text.length;
  const scale = charCount > 0 ? 1000 / charCount : 0;
  const commas = (text.match(/[,،]/g) || []).length;
  const semicolons = (text.match(/[;؛]/g) || []).length;
  const colons = (text.match(/:/g) || []).length;
  const dashes = (text.match(/[—–]|--/g) || []).length;
  const questions = (text.match(/[?؟]/g) || []).length;
  const exclamations = (text.match(/!/g) || []).length;
  const quotes = (text.match(/["'«»“”‘’]/g) || []).length;
  const periods = (text.match(/[.。]/g) || []).length;
  const punctBuckets = [periods, commas, semicolons, colons, dashes, questions, exclamations, quotes];
  const totalPunct = punctBuckets.reduce((a, b) => a + b, 0);

  let punctEntropy = 0;
  if (totalPunct > 0) {
    for (const c of punctBuckets) {
      if (c > 0) {
        const p = c / totalPunct;
        punctEntropy -= p * Math.log2(p);
      }
    }
  }

  // Writing Style
  const lowerNormalized = normalized.toLowerCase();
  const transitions = language === 'ar' ? AR_TRANSITIONS : EN_TRANSITIONS;
  let transitionHits = 0;
  for (const tr of transitions) {
    const re = new RegExp(tr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = lowerNormalized.match(re);
    if (matches) transitionHits += matches.length;
  }
  const transitionDensity = wordCount > 0 ? (transitionHits / wordCount) * 100 : 0;

  const contractions =
    language === 'en' ? (text.match(/\b[a-z]+'[a-z]+\b/gi) || []).length : 0;
  const contractionRate = wordCount > 0 ? contractions / wordCount : 0;
  const egyptianDialectHits =
    language === 'ar'
      ? EGYPTIAN_AR_MARKERS.filter((m) => lowerNormalized.includes(m)).length
      : 0;

  // Passive voice estimation
  let passiveHits = 0;
  if (language === 'ar') {
    for (const s of sentences) {
      if (/(?:تم|يتم|تتم|سيتم|أجريت|نُفذت|قُدمت)\s+[\u0621-\u064A]+/.test(s)) {
        passiveHits += 1;
      }
    }
  } else {
    for (const s of sentences) {
      if (/\b(?:is|are|was|were|been|being|be)\s+[a-z]+(?:ed|en|wn|pt)\b/i.test(s)) {
        passiveHits += 1;
      }
    }
  }
  const passiveRatio = sentences.length > 0 ? passiveHits / sentences.length : 0;

  const formalityRaw =
    0.45 * Math.min(1, Math.max(0, (avgWordLength - 3.2) / 3.5)) +
    0.25 * Math.min(1, transitionDensity / 4) +
    0.15 * Math.min(1, passiveRatio * 2.5) +
    0.15 * Math.max(0, 1 - contractionRate * 12 - egyptianDialectHits * 0.12);
  const formalityScore = Math.max(0, Math.min(1, formalityRaw));

  const hedgingRegex =
    language === 'ar'
      ? /(?:قد|ربما|من المحتمل|يبدو أن|إلى حد ما|بشكل عام)/g
      : /\b(?:perhaps|maybe|might|could|generally|typically|often|somewhat|arguably|likely|appears|seems)\b/gi;
  const hedgeHits = (lowerNormalized.match(hedgingRegex) || []).length;
  const directnessScore = Math.max(
    0,
    Math.min(1, 1 - (wordCount > 0 ? (hedgeHits / wordCount) * 18 : 0))
  );

  const verbosityIndex = Math.max(
    0,
    Math.min(1, (avgSentenceLen / 35) * 0.55 + (1 - ttr) * 0.45)
  );
  const repetitionIndex = Math.max(
    0,
    Math.min(1, repeatedBigramRatio * 0.65 + (1 - ttr) * 0.35)
  );

  // Readability
  let readabilityScore = 0;
  let readabilityScale = 'Flesch-Kincaid Grade (EN)';
  if (language === 'ar') {
    readabilityScale = 'Arabic Structural Complexity Index (AR)';
    readabilityScore = Number((0.45 * avgSentenceLen + 2.4 * avgWordLength).toFixed(2));
  } else {
    const syllables = words.reduce((acc, w) => acc + countSyllablesEn(w), 0);
    const asw = wordCount > 0 ? syllables / wordCount : 1.5;
    readabilityScore = Number(
      Math.max(0, 0.39 * avgSentenceLen + 11.8 * asw - 15.59).toFixed(2)
    );
  }

  return {
    engine_version: LINGUISTIC_ENGINE_VERSION,
    detected_language: language,
    detected_dialect: dialect,
    is_rtl: isRtl,
    char_count: charCount,
    word_count: wordCount,
    vocabulary: {
      unique_words: uniqueWords,
      ttr: Number(ttr.toFixed(4)),
      guiraud_r: Number(guiraudR.toFixed(3)),
      hapax_legomena_ratio: Number(hapaxRatio.toFixed(4)),
      rare_word_ratio: Number(rareRatio.toFixed(4)),
      repeated_bigram_ratio: Number(repeatedBigramRatio.toFixed(4)),
      avg_word_length: Number(avgWordLength.toFixed(2)),
      top_words: topWords,
    },
    sentence_structure: {
      sentence_count: sentences.length,
      avg_sentence_length: Number(avgSentenceLen.toFixed(2)),
      sentence_length_std: Number(sentenceStd.toFixed(2)),
      burstiness_index: Number(burstinessIndex.toFixed(3)),
      min_sentence_length: minSentenceLen,
      max_sentence_length: maxSentenceLen,
      clause_density: Number(clauseDensity.toFixed(3)),
      syntactic_variation: Number(syntacticVariation.toFixed(3)),
    },
    paragraph_structure: {
      paragraph_count: effectiveParas.length,
      avg_paragraph_words: Number(avgParaWords.toFixed(2)),
      paragraph_consistency_cv: Number(paraCV.toFixed(3)),
      opening_repetition_ratio: Number(openingRepetitionRatio.toFixed(3)),
      progression_overlap: Number(cohesionScore.toFixed(3)),
    },
    punctuation: {
      total_punctuation: totalPunct,
      comma_per_1k: Number((commas * scale).toFixed(2)),
      semicolon_per_1k: Number((semicolons * scale).toFixed(2)),
      colon_per_1k: Number((colons * scale).toFixed(2)),
      dash_per_1k: Number((dashes * scale).toFixed(2)),
      question_per_1k: Number((questions * scale).toFixed(2)),
      exclamation_per_1k: Number((exclamations * scale).toFixed(2)),
      quote_per_1k: Number((quotes * scale).toFixed(2)),
      punctuation_entropy: Number(punctEntropy.toFixed(3)),
    },
    writing_style: {
      formality_score: Number(formalityScore.toFixed(3)),
      directness_score: Number(directnessScore.toFixed(3)),
      verbosity_index: Number(verbosityIndex.toFixed(3)),
      transition_density: Number(transitionDensity.toFixed(2)),
      cohesion_score: Number(cohesionScore.toFixed(3)),
      repetition_index: Number(repetitionIndex.toFixed(3)),
    },
    additional: {
      top_bigrams: topBigrams,
      top_trigrams: topTrigrams,
      function_word_ratio: Number((wordCount > 0 ? functionCount / wordCount : 0).toFixed(3)),
      content_word_ratio: Number(
        (wordCount > 0 ? (wordCount - functionCount) / wordCount : 0).toFixed(3)
      ),
      passive_voice_ratio: Number(passiveRatio.toFixed(3)),
      readability_score: readabilityScore,
      readability_scale: readabilityScale,
    },
  };
}
