import { analyzeTextLinguistics, tokenizeWords } from './linguistic';
import type {
  EditingOperation,
  LinguisticAnalysisResult,
  StylometricProfile,
  TextSample,
} from './types';

export interface DiffSegment {
  type: 'equal' | 'added' | 'removed';
  text: string;
}

export interface ComparisonSummary {
  left_metrics: LinguisticAnalysisResult;
  right_metrics: LinguisticAnalysisResult;
  lexical_jaccard_similarity: number;
  stylometric_cosine_similarity: number;
  deltas: {
    word_count_delta: number;
    avg_sentence_length_delta: number;
    burstiness_delta: number;
    guiraud_r_delta: number;
    transition_density_delta: number;
    formality_delta: number;
    passive_voice_delta: number;
  };
  diff_segments: DiffSegment[];
  extracted_editing_operation: EditingOperation;
}

function featureVectorFromMetrics(m: LinguisticAnalysisResult): number[] {
  return [
    m.sentence_structure.avg_sentence_length / 30,
    m.sentence_structure.burstiness_index,
    m.vocabulary.guiraud_r / 12,
    m.vocabulary.hapax_legomena_ratio,
    m.writing_style.transition_density / 5,
    m.writing_style.formality_score,
    m.punctuation.punctuation_entropy / 3,
    m.additional.passive_voice_ratio,
  ];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return Number((dot / (Math.sqrt(normA) * Math.sqrt(normB))).toFixed(4));
}

export function computeWordDiff(originalText: string, editedText: string): {
  segments: DiffSegment[];
  insertions: number;
  deletions: number;
  unchanged: number;
} {
  const a = originalText.trim().split(/\s+/).filter(Boolean);
  const b = editedText.trim().split(/\s+/).filter(Boolean);

  // Bounded LCS DP for predictable speed on research passages
  const maxTokens = 350;
  const aSlice = a.slice(0, maxTokens);
  const bSlice = b.slice(0, maxTokens);
  const n = aSlice.length;
  const m = bSlice.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (aSlice[i] === bSlice[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const rawSegments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  let insertions = 0;
  let deletions = 0;
  let unchanged = 0;

  while (i < n && j < m) {
    if (aSlice[i] === bSlice[j]) {
      rawSegments.push({ type: 'equal', text: aSlice[i] });
      unchanged += 1;
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rawSegments.push({ type: 'removed', text: aSlice[i] });
      deletions += 1;
      i += 1;
    } else {
      rawSegments.push({ type: 'added', text: bSlice[j] });
      insertions += 1;
      j += 1;
    }
  }
  while (i < n) {
    rawSegments.push({ type: 'removed', text: aSlice[i++] });
    deletions += 1;
  }
  while (j < m) {
    rawSegments.push({ type: 'added', text: bSlice[j++] });
    insertions += 1;
  }

  // Merge adjacent segments of same type for cleaner rendering
  const merged: DiffSegment[] = [];
  for (const seg of rawSegments) {
    const prev = merged[merged.length - 1];
    if (prev && prev.type === seg.type) {
      prev.text += ` ${seg.text}`;
    } else {
      merged.push({ ...seg });
    }
  }

  return { segments: merged, insertions, deletions, unchanged };
}

export function compareTexts(
  leftText: string,
  rightText: string,
  actor: 'human' | 'ai' = 'ai',
  operationType: EditingOperation['operationType'] = 'paraphrase',
  providerOrEditor = 'TEXTPRINT Lab'
): ComparisonSummary {
  const leftMetrics = analyzeTextLinguistics(leftText);
  const rightMetrics = analyzeTextLinguistics(rightText);

  const leftWords = new Set(tokenizeWords(leftText, leftMetrics.detected_language));
  const rightWords = new Set(tokenizeWords(rightText, rightMetrics.detected_language));
  let inter = 0;
  for (const w of leftWords) if (rightWords.has(w)) inter += 1;
  const union = new Set([...leftWords, ...rightWords]).size;
  const jaccard = union > 0 ? Number((inter / union).toFixed(4)) : 0;

  const styloSim = cosineSimilarity(
    featureVectorFromMetrics(leftMetrics),
    featureVectorFromMetrics(rightMetrics)
  );

  const diff = computeWordDiff(leftText, rightText);
  const totalOps = diff.insertions + diff.deletions + diff.unchanged;
  const lexicalShiftRatio = totalOps > 0 ? Number(((diff.insertions + diff.deletions) / totalOps).toFixed(3)) : 0;

  return {
    left_metrics: leftMetrics,
    right_metrics: rightMetrics,
    lexical_jaccard_similarity: jaccard,
    stylometric_cosine_similarity: styloSim,
    deltas: {
      word_count_delta: rightMetrics.word_count - leftMetrics.word_count,
      avg_sentence_length_delta: Number(
        (rightMetrics.sentence_structure.avg_sentence_length - leftMetrics.sentence_structure.avg_sentence_length).toFixed(2)
      ),
      burstiness_delta: Number(
        (rightMetrics.sentence_structure.burstiness_index - leftMetrics.sentence_structure.burstiness_index).toFixed(3)
      ),
      guiraud_r_delta: Number(
        (rightMetrics.vocabulary.guiraud_r - leftMetrics.vocabulary.guiraud_r).toFixed(3)
      ),
      transition_density_delta: Number(
        (rightMetrics.writing_style.transition_density - leftMetrics.writing_style.transition_density).toFixed(2)
      ),
      formality_delta: Number(
        (rightMetrics.writing_style.formality_score - leftMetrics.writing_style.formality_score).toFixed(3)
      ),
      passive_voice_delta: Number(
        (rightMetrics.additional.passive_voice_ratio - leftMetrics.additional.passive_voice_ratio).toFixed(3)
      ),
    },
    diff_segments: diff.segments,
    extracted_editing_operation: {
      timestamp: new Date().toISOString(),
      actor,
      operationType,
      providerOrEditor,
      insertions: diff.insertions,
      deletions: diff.deletions,
      lexicalShiftRatio,
    },
  };
}

export function buildStylometricProfiles(samples: TextSample[]): StylometricProfile[] {
  const groups = new Map<
    string,
    {
      entityType: StylometricProfile['entity_type'];
      label: string;
      language: string;
      consentStatus: StylometricProfile['consent_status'];
      samples: TextSample[];
    }
  >();

  for (const s of samples) {
    // Group by pseudonymous author if present
    if (s.author_pseudo_id) {
      const key = `author:${s.author_pseudo_id}`;
      if (!groups.has(key)) {
        groups.set(key, {
          entityType: 'author',
          label: `Author ${s.author_pseudo_id}`,
          language: s.language,
          consentStatus: s.is_synthetic_demo ? 'synthetic_benchmark' : 'consented_pseudonymous',
          samples: [],
        });
      }
      groups.get(key)!.samples.push(s);
    }

    // Group by LLM model if present
    if (s.origin.model) {
      const key = `model:${s.origin.model}:${s.language}`;
      if (!groups.has(key)) {
        groups.set(key, {
          entityType: 'llm_model',
          label: `${s.origin.model}${s.origin.model_version ? ` (${s.origin.model_version})` : ''} · ${s.language.toUpperCase()}`,
          language: s.language,
          consentStatus: s.is_synthetic_demo ? 'synthetic_benchmark' : 'public_corpus',
          samples: [],
        });
      }
      groups.get(key)!.samples.push(s);
    }

    // Group by Origin Class + Language
    const groupKey = `origin:${s.origin.class}:${s.language}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        entityType: 'language_group',
        label: `${s.origin.class.replace(/_/g, ' ')} (${s.language.toUpperCase()})`,
        language: s.language,
        consentStatus: s.is_synthetic_demo ? 'synthetic_benchmark' : 'public_corpus',
        samples: [],
      });
    }
    groups.get(groupKey)!.samples.push(s);
  }

  const profiles: StylometricProfile[] = [];
  for (const [key, g] of groups.entries()) {
    const metricsList = g.samples.map((s) => s.linguistic_metrics ?? analyzeTextLinguistics(s.text));
    const n = metricsList.length;
    if (n === 0) continue;

    const avg = (fn: (m: LinguisticAnalysisResult) => number) =>
      Number((metricsList.reduce((acc, m) => acc + fn(m), 0) / n).toFixed(3));

    profiles.push({
      profile_id: key.replace(/[^a-zA-Z0-9_-]/g, '_'),
      entity_type: g.entityType,
      label: g.label,
      language: g.language,
      sample_count: n,
      consent_status: g.consentStatus,
      version: '1.0.0',
      metrics: {
        avg_sentence_length: avg((m) => m.sentence_structure.avg_sentence_length),
        burstiness_index: avg((m) => m.sentence_structure.burstiness_index),
        guiraud_r: avg((m) => m.vocabulary.guiraud_r),
        hapax_ratio: avg((m) => m.vocabulary.hapax_legomena_ratio),
        transition_density: avg((m) => m.writing_style.transition_density),
        formality_score: avg((m) => m.writing_style.formality_score),
        punctuation_entropy: avg((m) => m.punctuation.punctuation_entropy),
        passive_voice_ratio: avg((m) => m.additional.passive_voice_ratio),
      },
    });
  }

  return profiles.sort((a, b) => b.sample_count - a.sample_count);
}

export function compareProfilesSimilarity(a: StylometricProfile, b: StylometricProfile): number {
  const vecA = [
    a.metrics.avg_sentence_length / 30,
    a.metrics.burstiness_index,
    a.metrics.guiraud_r / 12,
    a.metrics.hapax_ratio,
    a.metrics.transition_density / 5,
    a.metrics.formality_score,
    a.metrics.punctuation_entropy / 3,
    a.metrics.passive_voice_ratio,
  ];
  const vecB = [
    b.metrics.avg_sentence_length / 30,
    b.metrics.burstiness_index,
    b.metrics.guiraud_r / 12,
    b.metrics.hapax_ratio,
    b.metrics.transition_density / 5,
    b.metrics.formality_score,
    b.metrics.punctuation_entropy / 3,
    b.metrics.passive_voice_ratio,
  ];
  return cosineSimilarity(vecA, vecB);
}
