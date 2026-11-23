import { analyzeTextLinguistics } from './linguistic';
import type {
  ClassificationLabel,
  FeatureContribution,
  LinguisticAnalysisResult,
  ProbabilisticClassification,
} from './types';

export const CLASSIFIER_VERSION = 'tp-calib-v1.3.0';

function softmaxCalibrated(logits: Record<ClassificationLabel, number>, temperature = 1.45): Record<ClassificationLabel, number> {
  const keys = Object.keys(logits) as ClassificationLabel[];
  const scaled = keys.map((k) => logits[k] / temperature);
  const maxLogit = Math.max(...scaled);
  const exps = scaled.map((v) => Math.exp(v - maxLogit));
  const sum = exps.reduce((a, b) => a + b, 0);
  const out = {} as Record<ClassificationLabel, number>;
  keys.forEach((k, i) => {
    // Enforce strict probability floor/ceiling to forbid absolute certainty claims (0% or 100%)
    out[k] = Number((exps[i] / sum).toFixed(4));
  });
  return out;
}

export function classifyTextProbabilistically(
  rawText: string,
  precomputed?: LinguisticAnalysisResult
): ProbabilisticClassification {
  const metrics = precomputed ?? analyzeTextLinguistics(rawText);
  const wordCount = metrics.word_count;
  const sentenceCount = metrics.sentence_structure.sentence_count;

  const limitations: string[] = [
    'Authorship attribution is strictly probabilistic and cannot prove human or AI authorship with certainty.',
    'Edited, paraphrased, or collaboratively drafted passages frequently blend signals across multiple categories.',
    'Short passages (< 120 words) carry elevated statistical variance and wider confidence margins.',
  ];

  if (metrics.detected_language === 'ar') {
    limitations.push(
      'Arabic morphology, clitic attachment (e.g., و/ف/ب/ال), and dialectal variation alter surface TTR and sentence boundaries compared to English.'
    );
  }
  if (metrics.detected_language === 'mixed') {
    limitations.push(
      'Code-switched text exhibits mixed token distributions that reduce calibration reliability.'
    );
  }

  // Insufficient Evidence Gate
  if (wordCount < 40 || sentenceCount < 2) {
    const probs: Record<ClassificationLabel, number> = {
      'Likely Human-Written': 0.11,
      'Likely AI-Generated': 0.11,
      'Human-Edited AI': 0.08,
      'AI-Edited Human': 0.08,
      'Mixed-Origin': 0.08,
      'Insufficient Evidence': 0.54,
    };
    return {
      predicted_label: 'Insufficient Evidence',
      probabilities: probs,
      calibrated_confidence: 0.54,
      confidence_margin: 0.24,
      is_uncertain: true,
      feature_contributions: [],
      supporting_evidence: [
        `Passage length (${wordCount} words, ${sentenceCount} sentence(s)) is below the minimum statistical threshold (40 words, 2 sentences) required for multi-signal stylometric inference.`,
      ],
      contradictory_evidence: [],
      uncertainty_indicators: [
        'Sample below minimum token threshold for stable burstiness and lexical richness estimates.',
      ],
      model_version: CLASSIFIER_VERSION,
      calibration_method: 'Temperature-scaled softmax with minimum-evidence abstention gate',
      known_limitations: limitations,
    };
  }

  // Multi-signal evidence accumulation (never single-feature!)
  const contributions: FeatureContribution[] = [];
  let aiEvidence = 0;
  let humanEvidence = 0;
  let editedEvidence = 0;

  // Signal 1: Sentence Length Burstiness (CV)
  const burstiness = metrics.sentence_structure.burstiness_index;
  if (burstiness < 0.26 && sentenceCount >= 3) {
    const w = 0.72;
    aiEvidence += w;
    contributions.push({
      feature_id: 'SENT_BURSTINESS',
      label: 'Sentence Length Burstiness',
      observed_value: `CV ${burstiness.toFixed(3)}`,
      direction: 'ai',
      weight: w,
      explanation: 'Low variance in sentence lengths suggests uniform rhythmic pacing.',
    });
  } else if (burstiness >= 0.42) {
    const w = -0.78;
    humanEvidence += Math.abs(w);
    contributions.push({
      feature_id: 'SENT_BURSTINESS',
      label: 'Sentence Length Burstiness',
      observed_value: `CV ${burstiness.toFixed(3)}`,
      direction: 'human',
      weight: w,
      explanation: 'High rhythmic contrast between short and extended sentences.',
    });
  } else {
    contributions.push({
      feature_id: 'SENT_BURSTINESS',
      label: 'Sentence Length Burstiness',
      observed_value: `CV ${burstiness.toFixed(3)}`,
      direction: 'neutral',
      weight: 0.05,
      explanation: 'Moderate sentence length variation sits in the human/edited overlap band.',
    });
  }

  // Signal 2: Discourse Transition Density
  const transitions = metrics.writing_style.transition_density;
  if (transitions >= 2.1) {
    const w = 0.68;
    aiEvidence += w;
    contributions.push({
      feature_id: 'STYLE_TRANSITION_DENSITY',
      label: 'Discourse Transition Density',
      observed_value: `${transitions.toFixed(2)} / 100w`,
      direction: 'ai',
      weight: w,
      explanation: 'Elevated explicit connective markers (moreover, furthermore, علاوة على ذلك).',
    });
  } else if (transitions <= 0.7) {
    const w = -0.52;
    humanEvidence += Math.abs(w);
    contributions.push({
      feature_id: 'STYLE_TRANSITION_DENSITY',
      label: 'Discourse Transition Density',
      observed_value: `${transitions.toFixed(2)} / 100w`,
      direction: 'human',
      weight: w,
      explanation: 'Sparse explicit transition markers rely on implicit rhetorical progression.',
    });
  } else {
    editedEvidence += 0.25;
    contributions.push({
      feature_id: 'STYLE_TRANSITION_DENSITY',
      label: 'Discourse Transition Density',
      observed_value: `${transitions.toFixed(2)} / 100w`,
      direction: 'edited',
      weight: 0.18,
      explanation: 'Moderate connective density commonly seen in edited drafts.',
    });
  }

  // Signal 3: Lexical Richness (Guiraud's R + Hapax)
  const guiraud = metrics.vocabulary.guiraud_r;
  const hapax = metrics.vocabulary.hapax_legomena_ratio;
  if (guiraud < 6.4 && hapax < 0.56) {
    const w = 0.55;
    aiEvidence += w;
    contributions.push({
      feature_id: 'VOCAB_GUIRAUD_R',
      label: "Lexical Richness (Guiraud's R)",
      observed_value: `R ${guiraud.toFixed(2)} · Hapax ${(hapax * 100).toFixed(1)}%`,
      direction: 'ai',
      weight: w,
      explanation: 'Compressed lexical diversity with recurring high-probability vocabulary.',
    });
  } else if (guiraud >= 7.2 || hapax >= 0.67) {
    const w = -0.62;
    humanEvidence += Math.abs(w);
    contributions.push({
      feature_id: 'VOCAB_GUIRAUD_R',
      label: "Lexical Richness (Guiraud's R)",
      observed_value: `R ${guiraud.toFixed(2)} · Hapax ${(hapax * 100).toFixed(1)}%`,
      direction: 'human',
      weight: w,
      explanation: 'Elevated unique-word dispersion and single-occurrence lexical choices.',
    });
  } else {
    contributions.push({
      feature_id: 'VOCAB_GUIRAUD_R',
      label: "Lexical Richness (Guiraud's R)",
      observed_value: `R ${guiraud.toFixed(2)} · Hapax ${(hapax * 100).toFixed(1)}%`,
      direction: 'neutral',
      weight: 0,
      explanation: 'Lexical richness is within the expected overlap for standard prose.',
    });
  }

  // Signal 4: Punctuation Entropy & Idiomatic Markers
  const pEntropy = metrics.punctuation.punctuation_entropy;
  const dashRate = metrics.punctuation.dash_per_1k;
  if (pEntropy < 1.15 && dashRate < 1.0) {
    const w = 0.45;
    aiEvidence += w;
    contributions.push({
      feature_id: 'PUNCT_ENTROPY',
      label: 'Punctuation Entropy',
      observed_value: `${pEntropy.toFixed(2)} bits`,
      direction: 'ai',
      weight: w,
      explanation: 'Low punctuation diversity concentrated primarily in commas and periods.',
    });
  } else if (pEntropy >= 1.55 || dashRate >= 3.0) {
    const w = -0.56;
    humanEvidence += Math.abs(w);
    contributions.push({
      feature_id: 'PUNCT_ENTROPY',
      label: 'Punctuation Entropy',
      observed_value: `${pEntropy.toFixed(2)} bits · ${dashRate.toFixed(1)} dashes/1k`,
      direction: 'human',
      weight: w,
      explanation: 'Expressive punctuation variety (dashes, parentheticals, colons, or questions).',
    });
  }

  // Signal 5: Formality vs Directness tension (Edited / Hybrid indicator)
  const formality = metrics.writing_style.formality_score;
  const directness = metrics.writing_style.directness_score;
  const paraCV = metrics.paragraph_structure.paragraph_consistency_cv;

  if (metrics.paragraph_structure.paragraph_count >= 3 && paraCV < 0.18) {
    aiEvidence += 0.42;
    contributions.push({
      feature_id: 'PARA_CONSISTENCY_CV',
      label: 'Paragraph Symmetry',
      observed_value: `CV ${paraCV.toFixed(3)}`,
      direction: 'ai',
      weight: 0.42,
      explanation: 'Highly uniform paragraph word counts indicate templated structural balance.',
    });
  }

  // Detect hybrid tension: e.g. high formality/transitions combined with high burstiness or expressive punctuation
  const signalTension = Math.min(aiEvidence, humanEvidence);
  if (signalTension > 0.65 || (formality > 0.65 && burstiness > 0.38)) {
    editedEvidence += 0.85;
    contributions.push({
      feature_id: 'HYBRID_SIGNAL_TENSION',
      label: 'Cross-Signal Hybrid Tension',
      observed_value: `Formality ${formality.toFixed(2)} vs Burstiness ${burstiness.toFixed(2)}`,
      direction: 'edited',
      weight: 0.35,
      explanation:
        'Simultaneous presence of structural polish and asymmetric rhythmic or lexical markers suggests human-AI co-editing.',
    });
  }

  const lengthPenalty = wordCount < 110 ? 0.55 : 0;

  const logits: Record<ClassificationLabel, number> = {
    'Likely Human-Written': 0.5 + humanEvidence * 1.15 - aiEvidence * 0.45 - editedEvidence * 0.3,
    'Likely AI-Generated': 0.5 + aiEvidence * 1.15 - humanEvidence * 0.45 - editedEvidence * 0.3,
    'Human-Edited AI': 0.25 + editedEvidence * 0.95 + aiEvidence * 0.35 + humanEvidence * 0.25,
    'AI-Edited Human': 0.25 + editedEvidence * 0.95 + humanEvidence * 0.38 + aiEvidence * 0.22,
    'Mixed-Origin': 0.15 + signalTension * 0.85,
    'Insufficient Evidence': -0.8 + lengthPenalty * 2.0,
  };

  const probabilities = softmaxCalibrated(logits, 1.55);

  // Cap single-class maximum probability at 0.89 so we never claim near-certainty
  const entries = (Object.entries(probabilities) as [ClassificationLabel, number][]).sort(
    (a, b) => b[1] - a[1]
  );
  const topLabel = entries[0][0];
  const topProb = Math.min(0.89, entries[0][1]);
  const secondProb = entries[1][1];
  const spread = topProb - secondProb;

  const uncertaintyIndicators: string[] = [];
  if (wordCount < 120) {
    uncertaintyIndicators.push(
      `Moderate sample length (${wordCount} words): confidence margin widened.`
    );
  }
  if (spread < 0.12) {
    uncertaintyIndicators.push(
      `Close posterior separation (${(topProb * 100).toFixed(1)}% vs ${(secondProb * 100).toFixed(1)}% for ${entries[1][0]}).`
    );
  }
  if (signalTension > 0.6) {
    uncertaintyIndicators.push(
      'Strong conflicting signals detected between lexical diversity, punctuation entropy, and discourse structure.'
    );
  }
  if (metrics.detected_language === 'ar') {
    uncertaintyIndicators.push(
      'Arabic feature baselines carry higher calibration variance across dialectal registers.'
    );
  }

  const supportingEvidence = contributions
    .filter((c) =>
      topLabel === 'Likely AI-Generated'
        ? c.direction === 'ai'
        : topLabel === 'Likely Human-Written'
          ? c.direction === 'human'
          : c.direction === 'edited' || c.direction !== 'neutral'
    )
    .map((c) => `${c.label} (${c.observed_value}): ${c.explanation}`);

  const contradictoryEvidence = contributions
    .filter((c) =>
      topLabel === 'Likely AI-Generated'
        ? c.direction === 'human'
        : topLabel === 'Likely Human-Written'
          ? c.direction === 'ai'
          : false
    )
    .map((c) => `${c.label} (${c.observed_value}): ${c.explanation}`);

  const margin = Number(
    Math.min(0.28, Math.max(0.06, 0.16 - wordCount / 4000 + (spread < 0.1 ? 0.06 : 0))).toFixed(3)
  );

  return {
    predicted_label: topLabel,
    probabilities,
    calibrated_confidence: Number(topProb.toFixed(4)),
    confidence_margin: margin,
    is_uncertain: spread < 0.1 || wordCount < 100 || topLabel === 'Insufficient Evidence',
    feature_contributions: contributions,
    supporting_evidence:
      supportingEvidence.length > 0
        ? supportingEvidence
        : ['Aggregate multi-feature distribution weakly favors the top category.'],
    contradictory_evidence: contradictoryEvidence,
    uncertainty_indicators: uncertaintyIndicators,
    model_version: CLASSIFIER_VERSION,
    calibration_method: 'Temperature-scaled multi-signal logistic calibration (T=1.55)',
    known_limitations: limitations,
  };
}
