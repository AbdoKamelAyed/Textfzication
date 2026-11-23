export type OriginClass =
  | 'human'
  | 'ai'
  | 'human_edited_ai'
  | 'ai_edited_human'
  | 'mixed'
  | 'unknown';

export type ValidationStatus = 'pending' | 'verified' | 'rejected' | 'quarantined';
export type StorageLayer = 'raw' | 'processed' | 'approved';
export type PatternStatus = 'observed' | 'hypothesis' | 'statistically_supported' | 'approved';

export interface EditingOperation {
  timestamp: string;
  actor: 'human' | 'ai';
  operationType: 'paraphrase' | 'formalize' | 'concise' | 'expand' | 'grammar_fix' | 'manual_edit';
  providerOrEditor: string;
  insertions: number;
  deletions: number;
  lexicalShiftRatio: number;
  notes?: string;
}

export interface TextSample {
  sample_id: string;
  dataset_key: string;
  text: string;
  normalized_text: string;
  language: 'en' | 'ar' | 'mixed' | string;
  dialect: string | null;
  domain: string;
  writing_type: string;
  origin: {
    class: OriginClass;
    source: string;
    model: string | null;
    model_version: string | null;
  };
  editing_history: {
    human_edited: boolean;
    ai_edited: boolean;
    editing_operations: EditingOperation[];
  };
  provenance: {
    dataset: string;
    license: string;
    collection_date: string;
  };
  validation: {
    status: ValidationStatus;
    verified: boolean;
    validation_notes: string[];
  };
  layer: StorageLayer;
  dataset_version: string;
  is_synthetic_demo: boolean;
  author_pseudo_id: string | null;
  content_hash: string;
  linguistic_metrics?: LinguisticAnalysisResult;
}

export interface DatasetRecord {
  dataset_key: string;
  name: string;
  description: string;
  layer: StorageLayer;
  version: string;
  license: string;
  is_synthetic_demo: boolean;
  source_type: string;
  created_at: string;
  updated_at: string;
}

export interface FeatureSpec {
  feature_id: string;
  category:
    | 'vocabulary'
    | 'sentence_structure'
    | 'paragraph_structure'
    | 'punctuation'
    | 'writing_style'
    | 'additional';
  name: string;
  definition: string;
  calculation_method: string;
  supported_languages: ('en' | 'ar')[];
  version: string;
  reliability_notes: string;
  example: string;
}

export interface LinguisticAnalysisResult {
  engine_version: string;
  detected_language: 'en' | 'ar' | 'mixed';
  detected_dialect: string | null;
  is_rtl: boolean;
  char_count: number;
  word_count: number;
  vocabulary: {
    unique_words: number;
    ttr: number; // Type-Token Ratio
    guiraud_r: number; // Root TTR
    hapax_legomena_ratio: number;
    rare_word_ratio: number;
    repeated_bigram_ratio: number;
    avg_word_length: number;
    top_words: Array<{ word: string; count: number }>;
  };
  sentence_structure: {
    sentence_count: number;
    avg_sentence_length: number;
    sentence_length_std: number;
    burstiness_index: number; // CV of sentence length
    min_sentence_length: number;
    max_sentence_length: number;
    clause_density: number;
    syntactic_variation: number;
  };
  paragraph_structure: {
    paragraph_count: number;
    avg_paragraph_words: number;
    paragraph_consistency_cv: number;
    opening_repetition_ratio: number;
    progression_overlap: number;
  };
  punctuation: {
    total_punctuation: number;
    comma_per_1k: number;
    semicolon_per_1k: number;
    colon_per_1k: number;
    dash_per_1k: number;
    question_per_1k: number;
    exclamation_per_1k: number;
    quote_per_1k: number;
    punctuation_entropy: number;
  };
  writing_style: {
    formality_score: number; // 0..1
    directness_score: number; // 0..1
    verbosity_index: number; // 0..1
    transition_density: number; // per 100 words
    cohesion_score: number; // adjacent sentence Jaccard
    repetition_index: number; // 0..1
  };
  additional: {
    top_bigrams: Array<{ gram: string; count: number }>;
    top_trigrams: Array<{ gram: string; count: number }>;
    function_word_ratio: number;
    content_word_ratio: number;
    passive_voice_ratio: number;
    readability_score: number;
    readability_scale: string;
  };
}

export type ClassificationLabel =
  | 'Likely Human-Written'
  | 'Likely AI-Generated'
  | 'Human-Edited AI'
  | 'AI-Edited Human'
  | 'Mixed-Origin'
  | 'Insufficient Evidence';

export interface FeatureContribution {
  feature_id: string;
  label: string;
  observed_value: string;
  direction: 'human' | 'ai' | 'edited' | 'neutral';
  weight: number; // signed -1..+1 where + is AI-leaning, - is human-leaning
  explanation: string;
}

export interface ProbabilisticClassification {
  predicted_label: ClassificationLabel;
  probabilities: Record<ClassificationLabel, number>;
  calibrated_confidence: number;
  confidence_margin: number;
  is_uncertain: boolean;
  feature_contributions: FeatureContribution[];
  supporting_evidence: string[];
  contradictory_evidence: string[];
  uncertainty_indicators: string[];
  model_version: string;
  calibration_method: string;
  known_limitations: string[];
}

export interface WritingPattern {
  pattern_id: string;
  title: string;
  description: string;
  category: string;
  supporting_samples: string[];
  frequency: number;
  relevant_features: string[];
  confidence: number;
  discovery_method: string;
  validation_status: PatternStatus;
  related_patterns: string[];
}

export interface StylometricProfile {
  profile_id: string;
  entity_type: 'author' | 'llm_model' | 'model_version' | 'domain' | 'language_group';
  label: string;
  language: string;
  sample_count: number;
  consent_status: 'consented_pseudonymous' | 'public_corpus' | 'synthetic_benchmark';
  version: string;
  metrics: {
    avg_sentence_length: number;
    burstiness_index: number;
    guiraud_r: number;
    hapax_ratio: number;
    transition_density: number;
    formality_score: number;
    punctuation_entropy: number;
    passive_voice_ratio: number;
  };
}

export interface ExternalSource {
  source_key: string;
  name: string;
  official_url: string;
  description: string;
  data_format: string;
  language: string;
  license: string;
  access_method: string;
  last_checked_date: string;
  last_import_date: string | null;
  status: 'active' | 'manual_only' | 'rate_limited' | 'deprecated';
  reliability_notes: string;
}

export interface CollectionJob {
  job_key: string;
  source_key: string;
  source_name: string;
  collection_method: string;
  schedule_cron: string;
  expected_format: string;
  execution_status: 'idle' | 'running' | 'completed' | 'failed';
  imported_records: number;
  failed_records: number;
  error_log: string | null;
  last_execution: string | null;
  next_execution: string;
}

export interface ExperimentRecord {
  experiment_key: string;
  name: string;
  hypothesis: string;
  dataset_key: string;
  dataset_layer: StorageLayer;
  includes_unverified: boolean;
  is_exploratory: boolean;
  model_type: string;
  model_version: string;
  language_scope: string;
  split_strategy: string;
  status: 'draft' | 'running' | 'completed' | 'approved';
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    roc_auc: number;
    fpr: number;
    fnr: number;
    ece_calibration: number;
    by_language: Record<string, { f1: number; count: number }>;
    by_domain: Record<string, { f1: number; count: number }>;
    edited_text_f1: number;
    train_count: number;
    eval_count: number;
  };
  created_at: string;
}

export interface KnowledgeNode {
  id: string;
  label: string;
  type: 'sample' | 'dataset' | 'author' | 'model' | 'feature' | 'pattern' | 'experiment';
  validation_status: string;
  metadata: Record<string, unknown>;
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  relation:
    | 'BELONGS_TO_DATASET'
    | 'HAS_FEATURE'
    | 'MODEL_GENERATES_SAMPLE'
    | 'AUTHORED_SAMPLE'
    | 'SUPPORTED_BY_SAMPLE'
    | 'ASSOCIATED_WITH_PATTERN'
    | 'EXPERIMENT_USES_DATASET';
  provenance: string;
  validation_status: string;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  generated_at: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
}
