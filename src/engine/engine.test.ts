import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeTextLinguistics,
  detectLanguageAndDialect,
  normalizeUnicodeText,
  FEATURE_CATALOG,
} from './linguistic';
import { classifyTextProbabilistically } from './classifier';
import { compareTexts, buildStylometricProfiles, compareProfilesSimilarity } from './comparison';
import {
  computeContentHash,
  parseImportedDatasetText,
  validateSampleQuality,
  buildSampleFromImport,
} from './validation';
import { buildKnowledgeGraphFromCorpus } from './knowledgeGraph';
import {
  DEMO_DATASETS,
  DEMO_SAMPLES,
  INITIAL_EXPERIMENTS,
  INITIAL_PATTERNS,
} from './demoCorpus';
import { runControlledTrainingExperiment } from './training';
import { buildDashboard30DayTrends } from './dashboardTrends';

test('linguistic engine detects English and Arabic RTL dialects accurately', () => {
  const en = detectLanguageAndDialect('Archival digitization preserves maritime correspondence.');
  assert.equal(en.language, 'en');
  assert.equal(en.isRtl, false);

  const arEg = detectLanguageAndDialect(
    'لما بنمشي في شوارع وسط البلد الصبح بدري بنحس إن المباني القديمة لسه محتفظة بروحها عشان التفاصيل الصغيرة دي.'
  );
  assert.equal(arEg.language, 'ar');
  assert.equal(arEg.isRtl, true);
  assert.equal(arEg.dialect, 'Egyptian Arabic (arz)');

  const arMsa = detectLanguageAndDialect(
    'يمثل التحول الرقمي في المؤسسات التعليمية ركيزة أساسية لتطوير جودة المناهج وتيسير الوصول إلى المعرفة.'
  );
  assert.equal(arMsa.language, 'ar');
  assert.equal(arMsa.dialect, 'Modern Standard Arabic (arb)');
});

test('unicode normalization strips Arabic diacritics and zero-width characters', () => {
  const norm = normalizeUnicodeText('التَّحَوُّلُ\u200B  الرَّقْمِيُّ');
  assert.equal(norm, 'التحول الرقمي');
});

test('feature catalog documents all 6 linguistic categories with versions and reliability notes', () => {
  const categories = new Set(FEATURE_CATALOG.map((f) => f.category));
  assert.ok(categories.has('vocabulary'));
  assert.ok(categories.has('sentence_structure'));
  assert.ok(categories.has('paragraph_structure'));
  assert.ok(categories.has('punctuation'));
  assert.ok(categories.has('writing_style'));
  assert.ok(categories.has('additional'));
  for (const spec of FEATURE_CATALOG) {
    assert.ok(spec.feature_id.length > 0);
    assert.ok(spec.reliability_notes.length > 10);
  }
});

test('probabilistic classifier abstains on short texts and never outputs 100% certainty', () => {
  const shortRes = classifyTextProbabilistically('Too short to classify reliably.');
  assert.equal(shortRes.predicted_label, 'Insufficient Evidence');
  assert.equal(shortRes.is_uncertain, true);

  const aiSample = DEMO_SAMPLES.find((s) => s.sample_id === 'TX-AI-000001')!;
  const aiRes = classifyTextProbabilistically(aiSample.text);
  assert.ok(aiRes.calibrated_confidence <= 0.89);
  assert.ok(aiRes.calibrated_confidence > 0);
  assert.ok(aiRes.known_limitations.length >= 3);
  const probSum = Object.values(aiRes.probabilities).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(probSum - 1) < 0.01);
});

test('validation engine detects exact duplicates, encoding anomalies, and label inconsistencies', () => {
  const dupCandidate = {
    ...DEMO_SAMPLES[0],
    sample_id: 'TX-DUP-999',
  };
  const dupReport = validateSampleQuality(dupCandidate, DEMO_SAMPLES);
  assert.equal(dupReport.passed, false);
  assert.ok(dupReport.issues.some((i) => i.code === 'EXACT_DUPLICATE'));

  const badLabel = {
    ...DEMO_SAMPLES[0],
    sample_id: 'TX-BAD-999',
    text: 'This is a completely novel human passage with enough characters for validation checks and distinct phrasing.',
    content_hash: computeContentHash(
      'This is a completely novel human passage with enough characters for validation checks and distinct phrasing.'
    ),
    origin: { class: 'human' as const, source: 'test', model: 'gpt-4', model_version: null },
  };
  const labelReport = validateSampleQuality(badLabel, DEMO_SAMPLES);
  assert.equal(labelReport.passed, false);
  assert.ok(labelReport.issues.some((i) => i.code === 'LABEL_INCONSISTENCY'));
});

test('dataset parser supports CSV, JSON, JSONL, and XML imports', () => {
  const csv = 'text,language,domain,origin_class\n"Hello world research passage for stylometry testing.",en,academic,human';
  const parsedCsv = parseImportedDatasetText(csv, 'csv');
  assert.equal(parsedCsv.errors.length, 0);
  assert.equal(parsedCsv.records.length, 1);
  assert.equal(parsedCsv.records[0].origin_class, 'human');

  const jsonl = '{"text":"First research sample passage.","origin_class":"ai","model":"gemini-4-hydrogen"}\n{"text":"Second sample passage.","origin_class":"human"}';
  const parsedJsonl = parseImportedDatasetText(jsonl, 'jsonl');
  assert.equal(parsedJsonl.records.length, 2);

  const built = buildSampleFromImport(parsedCsv.records[0], {
    sampleId: 'TX-TEST-001',
    datasetKey: 'ds-test',
    license: 'CC-BY-4.0',
    source: 'unit_test',
    isSyntheticDemo: true,
  });
  assert.equal(built.layer, 'raw');
  assert.equal(built.validation.verified, false);
});

test('comparison & stylometry profile engines compute deterministic diffs and similarities', () => {
  const cmp = compareTexts(DEMO_SAMPLES[0].text, DEMO_SAMPLES[1].text);
  assert.ok(cmp.diff_segments.length > 0);
  assert.ok(cmp.stylometric_cosine_similarity >= 0 && cmp.stylometric_cosine_similarity <= 1);

  const profiles = buildStylometricProfiles(DEMO_SAMPLES);
  assert.ok(profiles.length >= 3);
  const sim = compareProfilesSimilarity(profiles[0], profiles[0]);
  assert.ok(Math.abs(sim - 1) < 0.001);
});

test('knowledge graph builds provenance-backed nodes and edges from actual corpus', () => {
  const kg = buildKnowledgeGraphFromCorpus({
    datasets: DEMO_DATASETS,
    samples: DEMO_SAMPLES,
    patterns: INITIAL_PATTERNS,
    experiments: INITIAL_EXPERIMENTS,
  });
  assert.ok(kg.nodes.some((n) => n.type === 'sample'));
  assert.ok(kg.nodes.some((n) => n.type === 'dataset'));
  assert.ok(kg.edges.every((e) => Boolean(e.provenance && e.validation_status)));
});

test('training engine blocks non-exploratory training on unverified samples', () => {
  const blocked = runControlledTrainingExperiment(DEMO_SAMPLES, {
    name: 'Strict Run',
    hypothesis: 'Test strict gating',
    datasetKey: 'all',
    datasetLayer: 'raw',
    allowUnverifiedExploratory: false,
    splitStrategy: 'grouped_by_source',
    modelType: 'Calibrated Baseline',
    languageScope: 'en, ar',
    trainRatio: 0.7,
  });
  assert.equal(blocked.experiment, null);
  assert.match(blocked.error!, /unverified/i);

  const exploratory = runControlledTrainingExperiment(DEMO_SAMPLES, {
    name: 'Exploratory Run',
    hypothesis: 'Test exploratory run',
    datasetKey: 'all',
    datasetLayer: 'raw',
    allowUnverifiedExploratory: true,
    splitStrategy: 'grouped_by_source',
    modelType: 'Calibrated Baseline',
    languageScope: 'en, ar',
    trainRatio: 0.7,
  });
  assert.ok(exploratory.experiment);
  assert.equal(exploratory.experiment!.is_exploratory, true);
});

test('dashboard 30-day trends engine computes deterministic sparkline series from real corpus timestamps', () => {
  const trends = buildDashboard30DayTrends({
    datasets: DEMO_DATASETS,
    samples: DEMO_SAMPLES,
    patterns: INITIAL_PATTERNS,
    experiments: INITIAL_EXPERIMENTS,
    auditLogs: [],
  });

  assert.equal(trends.datasetsSeries.length, 30);
  assert.equal(trends.samplesSeries.length, 30);
  assert.equal(trends.verifiedSeries.length, 30);
  assert.equal(trends.researchActivitySeries.length, 30);

  const lastDs = trends.datasetsSeries[trends.datasetsSeries.length - 1];
  const lastSamples = trends.samplesSeries[trends.samplesSeries.length - 1];
  const lastVerified = trends.verifiedSeries[trends.verifiedSeries.length - 1];
  const lastActivity = trends.researchActivitySeries[trends.researchActivitySeries.length - 1];

  assert.equal(lastDs.value, DEMO_DATASETS.length);
  assert.equal(lastSamples.value, DEMO_SAMPLES.length);
  assert.equal(lastVerified.value, DEMO_SAMPLES.filter((s) => s.validation.verified).length);
  assert.equal(lastActivity.value, INITIAL_EXPERIMENTS.length + INITIAL_PATTERNS.length);
  assert.ok(lastSamples.shortDate.length >= 4);
});
