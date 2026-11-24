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
  parseCsvRows,
  parseImportedDatasetText,
  processCsvFileBatch,
  validateSampleQuality,
  buildSampleFromImport,
} from './validation';
import { buildKnowledgeGraphFromCorpus } from './knowledgeGraph';
import {
  DEMO_DATASETS,
  DEMO_SAMPLES,
  INITIAL_EXPERIMENTS,
  INITIAL_EXTERNAL_SOURCES,
  INITIAL_PATTERNS,
} from './demoCorpus';
import { runControlledTrainingExperiment } from './training';
import { buildDashboard30DayTrends } from './dashboardTrends';
import {
  computeDatabaseLayerSummary,
  filterAuditEvents,
  SYSTEM_RESPONSIBILITY_MATRIX,
} from './adminGovernance';
import {
  computeJobProgress,
  createImportCollectionJob,
  summarizeCollectionJobs,
} from './collectionJobs';
import {
  detectPromptLanguage,
  getOriginLabel,
  LINGUISTIC_GLOSSARY,
  UI_STRINGS,
} from './i18n';
import {
  generateLocalCopilotReply,
  generateLocalEditTransform,
  generateLocalSourceDiscoveryReply,
} from './copilotFallback';
import {
  computeLinguisticChartsData,
  extractCorpusDictionaryCandidates,
  LINGUISTIC_SYMBOLS_CATALOG,
  STARTER_LINGUISTIC_DICTIONARY,
} from './dictionary';
import {
  buildDictionaryCsv,
  buildDictionaryTsvAnki,
  buildMdictMddBinary,
  buildMdictMdxBinary,
  buildMdictSourceTxt,
  buildOntoLexJsonLd,
  buildStarDictBundle,
  buildTeiP5Xml,
  buildXdxfXml,
  computeAdler32,
} from './dictionaryExport';
import {
  REAL_WALKTHROUGH_PRESETS,
  ZERO_KNOWLEDGE_GUIDE_CHAPTERS,
} from './documentationData';
import {
  buildDeploymentReportMarkdown,
  DEPLOYMENT_TARGETS,
  TECHNOLOGY_STACK_INVENTORY,
} from './deploymentReport';
import {
  canShowAdminNavEntry,
  computeExecutiveAdminSnapshot,
  formatFirebaseAuthErrorMessage,
  isSpecialAdminUrlEntry,
} from './adminDashboard';
import {
  claimInitialAdminPasscode,
  getAdminAuthStatus,
  verifyAdminBearerToken,
  verifyAdminPasscode,
} from '../lib/adminAuth';

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

test('CSV batch parser handles UTF-8 BOM, multi-line quoted cells, custom column overrides, and cross-file duplicate quarantine', () => {
  const bomCsv =
    '\uFEFFcustom_body,source_tag,lang_code\r\n"Line one of ""quoted"" observational prose,\r\nline two across paragraphs.",human,en\r\n"Distinct second human passage about coastal cartography and tidal instrumentation.",human,en';
  const rows = parseCsvRows(bomCsv);
  assert.equal(rows.length, 3);
  assert.equal(rows[0][0], 'custom_body');
  assert.ok(rows[1][0].includes('"quoted"'));

  const fileA = {
    fileName: 'batch-a.csv',
    content: bomCsv,
  };
  const fileB = {
    fileName: 'batch-b.csv',
    content:
      'custom_body,source_tag,lang_code\n"Distinct second human passage about coastal cartography and tidal instrumentation.",human,en\n"Automated synthetic telemetry summary generated for stylometric divergence inspection.",ai,en',
  };

  const batchResult = processCsvFileBatch([fileA, fileB], DEMO_SAMPLES, {
    datasetName: 'Multi-File Coastal Study',
    license: 'CC-BY-4.0',
    isSyntheticDemo: false,
    columnOverrides: {
      text: 'custom_body',
      origin_class: 'source_tag',
      language: 'lang_code',
    },
    idSeed: 'TST1',
  });

  assert.equal(batchResult.errors.length, 0);
  assert.equal(batchResult.fileSummaries.length, 2);
  assert.equal(batchResult.builtSamples.length, 4);
  assert.equal(batchResult.quarantinedCount, 1);
  assert.equal(batchResult.fileSummaries[1].quarantinedCount, 1);
  assert.equal(batchResult.dataset.layer, 'raw');
  assert.equal(batchResult.dataset.source_type, 'csv_batch_drop');
  assert.ok(batchResult.builtSamples.every((s) => s.layer === 'raw'));
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

test('admin governance module summarizes database layers, responsibility matrix, and audit search', () => {
  assert.ok(SYSTEM_RESPONSIBILITY_MATRIX.length >= 5);
  assert.ok(SYSTEM_RESPONSIBILITY_MATRIX.every((r) => r.admin && r.researcher && r.reviewer && r.enforcementLayer));

  const summary = computeDatabaseLayerSummary({
    datasets: DEMO_DATASETS,
    samples: DEMO_SAMPLES,
    experiments: INITIAL_EXPERIMENTS,
  });
  assert.equal(summary.totalDatasets, DEMO_DATASETS.length);
  assert.equal(summary.totalSamples, DEMO_SAMPLES.length);
  assert.equal(
    summary.rawCount + summary.processedCount + summary.approvedCount,
    DEMO_SAMPLES.length
  );

  const sampleAudits = [
    {
      id: 'a1',
      timestamp: '2026-11-23T10:00:00Z',
      actor: 'admin@example.com',
      action: 'ADMIN_UPDATE_ROLE',
      target_type: 'user',
      target_id: 'uid_99',
      details: 'Promoted reviewer role.',
    },
    {
      id: 'a2',
      timestamp: '2026-11-23T11:00:00Z',
      actor: 'local-researcher',
      action: 'IMPORT_SAMPLES',
      target_type: 'dataset',
      target_id: 'csv-batch',
      details: 'Imported CSV batch.',
    },
  ];
  assert.equal(filterAuditEvents(sampleAudits, 'uid_99').length, 1);
  assert.equal(filterAuditEvents(sampleAudits, '', 'IMPORT_SAMPLES').length, 1);
});

test('collectionJobs engine computes clamped progress percentages, summaries, and import job records', () => {
  const idleJob = computeJobProgress({
    job_key: 'j1',
    source_key: 's1',
    source_name: 'Idle Source',
    collection_method: 'Fetch',
    schedule_cron: '0 0 * * *',
    expected_format: 'CSV',
    execution_status: 'idle',
    imported_records: 0,
    failed_records: 0,
    error_log: null,
    last_execution: null,
    next_execution: '2026-12-01T00:00:00Z',
  });
  assert.equal(idleJob.percent, 0);
  assert.equal(idleJob.statusLabel, 'Idle');

  const targetDerivedRunning = computeJobProgress({
    job_key: 'j2',
    source_key: 's2',
    source_name: 'Active Scrape',
    collection_method: 'API',
    schedule_cron: 'manual',
    expected_format: 'JSONL',
    execution_status: 'running',
    imported_records: 130,
    failed_records: 20,
    target_records: 200,
    error_log: null,
    last_execution: null,
    next_execution: '2026-12-01T00:00:00Z',
  });
  assert.equal(targetDerivedRunning.percent, 75);
  assert.equal(targetDerivedRunning.processedRecords, 150);
  assert.equal(targetDerivedRunning.tone, 'running');

  const clampedCompleted = computeJobProgress({
    job_key: 'j3',
    source_key: 's3',
    source_name: 'Overrun Clamp',
    collection_method: 'Import',
    schedule_cron: 'manual',
    expected_format: 'CSV',
    execution_status: 'completed',
    progress_percent: 145,
    imported_records: 10,
    failed_records: 0,
    error_log: null,
    last_execution: '2026-11-23T12:00:00Z',
    next_execution: '2026-12-01T00:00:00Z',
  });
  assert.equal(clampedCompleted.percent, 100);

  const importJob = createImportCollectionJob(DEMO_DATASETS[0], DEMO_SAMPLES, '2026-11-23T13:00:00Z');
  assert.equal(importJob.execution_status, 'completed');
  assert.equal(importJob.progress_percent, 100);
  assert.equal(importJob.imported_records + importJob.failed_records, DEMO_SAMPLES.length);

  const summary = summarizeCollectionJobs([
    {
      job_key: 'j1',
      source_key: 's1',
      source_name: 'Idle',
      collection_method: 'Fetch',
      schedule_cron: '0 0 * * *',
      expected_format: 'CSV',
      execution_status: 'idle',
      imported_records: 0,
      failed_records: 0,
      error_log: null,
      last_execution: null,
      next_execution: '2026-12-01T00:00:00Z',
    },
    importJob,
  ]);
  assert.equal(summary.total, 2);
  assert.equal(summary.idle, 1);
  assert.equal(summary.completed, 1);
  assert.equal(summary.averagePercent, 50);
});

test('parseSafeJsonPayload handles HTML doctype fallbacks and nested JSON error payloads without throwing SyntaxError', async () => {
  const { parseSafeJsonPayload } = await import('./httpResponse');

  const htmlFallback = parseSafeJsonPayload('<!doctype html><html><body>SPA shell</body></html>', {
    httpOk: true,
    status: 200,
    contentType: 'text/html; charset=utf-8',
    unavailableMessage: 'API offline in static mode.',
  });
  assert.equal(htmlFallback.ok, false);
  assert.equal(htmlFallback.isHtmlFallback, true);
  assert.equal(htmlFallback.data, null);
  assert.equal(htmlFallback.error, 'API offline in static mode.');

  const htmlWithoutHeader = parseSafeJsonPayload('<html><body>404</body></html>', {
    httpOk: false,
    status: 404,
  });
  assert.equal(htmlWithoutHeader.ok, false);
  assert.equal(htmlWithoutHeader.isHtmlFallback, true);

  const validJson = parseSafeJsonPayload<{ status: string }>('{"status":"ok"}', {
    httpOk: true,
    status: 200,
    contentType: 'application/json',
  });
  assert.equal(validJson.ok, true);
  assert.equal(validJson.isHtmlFallback, false);
  assert.deepEqual(validJson.data, { status: 'ok' });

  const nestedGeminiError = parseSafeJsonPayload(
    JSON.stringify({
      error: JSON.stringify({
        error: { code: 503, message: 'This model is currently experiencing high demand.' },
      }),
    }),
    {
      httpOk: false,
      status: 502,
      contentType: 'application/json',
    }
  );
  assert.equal(nestedGeminiError.ok, false);
  assert.equal(nestedGeminiError.isHtmlFallback, false);
  assert.equal(nestedGeminiError.error, 'This model is currently experiencing high demand.');

  const emptyPayload = parseSafeJsonPayload('   ', {
    httpOk: true,
    status: 200,
  });
  assert.equal(emptyPayload.ok, false);
  assert.equal(emptyPayload.isHtmlFallback, false);
  assert.match(emptyPayload.error!, /Empty JSON/);

  const plainTextError = parseSafeJsonPayload('Bad Gateway from upstream proxy', {
    httpOk: false,
    status: 502,
    contentType: 'text/plain',
  });
  assert.equal(plainTextError.ok, false);
  assert.equal(plainTextError.isHtmlFallback, false);
  assert.equal(plainTextError.error, 'Bad Gateway from upstream proxy');
});

test('connectivityMonitor derives Gemini, SQL, and Firebase indicators and aggregates ping history', async () => {
  const {
    normalizeApiBaseUrl,
    buildApiUrl,
    deriveConnectivityIndicators,
    appendHealthPingSample,
    buildLocalDeterministicMemo,
  } = await import('./connectivityMonitor');

  assert.equal(normalizeApiBaseUrl('https://service.run.app///'), 'https://service.run.app');
  assert.equal(normalizeApiBaseUrl('ftp://invalid.local'), '');
  assert.equal(buildApiUrl('/api/health', 'https://service.run.app/'), 'https://service.run.app/api/health');
  assert.equal(buildApiUrl('/api/health', ''), '/api/health');

  const onlineIndicators = deriveConnectivityIndicators({
    healthResult: {
      ok: true,
      status: 200,
      isHtmlFallback: false,
      error: null,
      data: {
        ok: true,
        service: 'TEXTPRINT',
        geminiConfigured: true,
        sqlConfigured: true,
        firebaseConfigured: true,
      },
    },
    firestoreConnected: true,
    lastLatencyMs: 18,
    isPinging: false,
  });
  assert.equal(onlineIndicators.find((i) => i.id === 'gemini')?.status, 'online');
  assert.equal(onlineIndicators.find((i) => i.id === 'sql')?.status, 'online');
  assert.equal(onlineIndicators.find((i) => i.id === 'firebase')?.status, 'online');

  const staticIndicators = deriveConnectivityIndicators({
    healthResult: {
      ok: false,
      status: 200,
      isHtmlFallback: true,
      error: 'Static hosting detected',
      data: null,
    },
    firestoreConnected: true,
    lastLatencyMs: 9,
    isPinging: false,
  });
  assert.equal(staticIndicators.find((i) => i.id === 'gemini')?.badgeText, 'Static Host');
  assert.equal(staticIndicators.find((i) => i.id === 'sql')?.status, 'degraded');
  assert.equal(staticIndicators.find((i) => i.id === 'firebase')?.status, 'online');

  let history: import('./connectivityMonitor').HealthPingSample[] = [];
  for (let i = 0; i < 15; i++) {
    const agg = appendHealthPingSample(
      history,
      {
        id: `p-${i}`,
        timestamp: '2026-11-23T13:25:00Z',
        ok: i % 2 === 0,
        isHtmlFallback: false,
        latencyMs: 20,
        geminiConfigured: true,
        sqlConfigured: false,
        firebaseConnected: true,
      },
      12
    );
    history = agg.samples;
    if (i === 14) {
      assert.equal(agg.samples.length, 12);
      assert.equal(agg.averageLatencyMs, 20);
      assert.equal(agg.successRatePercent, 50);
    }
  }

  const ling = analyzeTextLinguistics(DEMO_SAMPLES[0].text);
  const cls = classifyTextProbabilistically(DEMO_SAMPLES[0].text);
  const memo = buildLocalDeterministicMemo(ling, cls);
  assert.match(memo, /Local Deterministic Stylometry Summary/);
  assert.match(memo, /Guiraud R/);
});

test('csvExport filters corpus samples and round-trips RFC-4180 CSV with UTF-8 BOM and Arabic/quoted text', async () => {
  const {
    DEFAULT_EXPORT_FILTER,
    filterSamplesForExport,
    serializeSamplesToCsv,
    buildCsvExportFilename,
  } = await import('./csvExport');

  const arOnly = filterSamplesForExport(DEMO_SAMPLES, {
    ...DEFAULT_EXPORT_FILTER,
    language: 'ar',
  });
  assert.ok(arOnly.length >= 2);
  assert.ok(arOnly.every((s) => s.language === 'ar'));

  const verifiedHuman = filterSamplesForExport(DEMO_SAMPLES, {
    ...DEFAULT_EXPORT_FILTER,
    originClass: 'human',
    validationStatus: 'verified',
  });
  assert.ok(verifiedHuman.length >= 1);
  assert.ok(verifiedHuman.every((s) => s.origin.class === 'human' && s.validation.status === 'verified'));

  const excludedDemo = filterSamplesForExport(DEMO_SAMPLES, {
    ...DEFAULT_EXPORT_FILTER,
    excludeSyntheticDemo: true,
  });
  assert.equal(excludedDemo.length, 0);

  const trickySample = {
    ...DEMO_SAMPLES[0],
    sample_id: 'TX-CSV-QUOTE',
    text: 'Observed "quoted" telemetry,\r\nacross two lines and Egyptian Arabic: تجربة التصدير.',
  };
  const csvWithBom = serializeSamplesToCsv([trickySample, ...arOnly], {
    includeMetadata: true,
    includeBom: true,
  });
  assert.ok(csvWithBom.startsWith('\uFEFF'));

  const parsedRows = parseCsvRows(csvWithBom);
  assert.equal(parsedRows[0][0], 'sample_id');
  assert.equal(parsedRows[1][0], 'TX-CSV-QUOTE');
  assert.equal(parsedRows[1][2], trickySample.text);

  const reimported = parseImportedDatasetText(csvWithBom, 'csv');
  assert.equal(reimported.errors.length, 0);
  assert.equal(reimported.records.length, 1 + arOnly.length);
  assert.equal(reimported.records[0].text, trickySample.text);

  const filename = buildCsvExportFilename(
    {
      ...DEFAULT_EXPORT_FILTER,
      layer: 'approved',
      language: 'ar',
      originClass: 'human',
    },
    new Date('2026-11-23T12:00:00Z')
  );
  assert.equal(filename, 'textprint-samples-approved-ar-human-2026-11-23.csv');
});

test('datasetSearch locates samples by ID, provenance metadata, content keyword, and multi-filter criteria', async () => {
  const {
    DEFAULT_DATASET_FILTER,
    filterDatasetManagementSamples,
    hasActiveDatasetFilters,
  } = await import('./datasetSearch');

  assert.equal(hasActiveDatasetFilters(DEFAULT_DATASET_FILTER), false);

  const byId = filterDatasetManagementSamples(DEMO_SAMPLES, DEMO_DATASETS, {
    ...DEFAULT_DATASET_FILTER,
    query: 'TX-AI-000001',
    scope: 'id',
  });
  assert.equal(byId.length, 1);
  assert.equal(byId[0].sample_id, 'TX-AI-000001');

  const byProvenance = filterDatasetManagementSamples(DEMO_SAMPLES, DEMO_DATASETS, {
    ...DEFAULT_DATASET_FILTER,
    query: 'CC0-1.0',
    scope: 'provenance',
  });
  assert.equal(byProvenance.length, DEMO_SAMPLES.length);

  const contentNotMatchingProvenance = filterDatasetManagementSamples(DEMO_SAMPLES, DEMO_DATASETS, {
    ...DEFAULT_DATASET_FILTER,
    query: 'CC0-1.0',
    scope: 'content',
  });
  assert.equal(contentNotMatchingProvenance.length, 0);

  const byArabicContent = filterDatasetManagementSamples(DEMO_SAMPLES, DEMO_DATASETS, {
    ...DEFAULT_DATASET_FILTER,
    query: 'التحول الرقمي',
    scope: 'content',
    language: 'ar',
  });
  assert.equal(byArabicContent.length, 1);
  assert.equal(byArabicContent[0].sample_id, 'TX-AI-000002');
  assert.equal(hasActiveDatasetFilters({ ...DEFAULT_DATASET_FILTER, language: 'ar' }), true);
});

test('bulkValidation toggles selections, computes filtered stats, and validates batches atomically', async () => {
  const {
    applyBulkSampleValidation,
    getFilteredSelectionStats,
    pruneSelectionToExisting,
    toggleSelectAllFiltered,
    toggleSampleSelection,
  } = await import('./bulkValidation');

  let selected = new Set<string>();
  selected = toggleSampleSelection(selected, 'TX-HUM-000001');
  selected = toggleSampleSelection(selected, 'TX-AI-000001');
  assert.equal(selected.size, 2);
  selected = toggleSampleSelection(selected, 'TX-AI-000001');
  assert.equal(selected.size, 1);
  assert.equal(selected.has('TX-HUM-000001'), true);

  const arSubset = DEMO_SAMPLES.filter((s) => s.language === 'ar');
  selected = toggleSelectAllFiltered(selected, arSubset);
  // TX-HUM-000001 (EN) stays selected + all AR samples
  assert.equal(selected.size, 1 + arSubset.length);

  const statsFullSubset = getFilteredSelectionStats(selected, arSubset);
  assert.equal(statsFullSubset.allVisibleSelected, true);
  assert.equal(statsFullSubset.someVisibleSelected, false);
  assert.equal(statsFullSubset.hiddenSelected, 1);

  const statsAll = getFilteredSelectionStats(selected, DEMO_SAMPLES);
  assert.equal(statsAll.allVisibleSelected, false);
  assert.equal(statsAll.someVisibleSelected, true);
  assert.equal(statsAll.hiddenSelected, 0);

  // Toggling select-all again on arSubset unselects only arSubset
  selected = toggleSelectAllFiltered(selected, arSubset);
  assert.equal(selected.size, 1);
  assert.equal(selected.has('TX-HUM-000001'), true);

  // Prune drops missing IDs
  const withStale = new Set([...selected, 'NON-EXISTENT-ID']);
  const pruned = pruneSelectionToExisting(withStale, DEMO_SAMPLES);
  assert.equal(pruned.has('NON-EXISTENT-ID'), false);
  assert.equal(pruned.size, 1);

  // Atomic bulk quarantine + bulk verify
  const quarantineRes = applyBulkSampleValidation(
    DEMO_SAMPLES,
    ['TX-AEH-000001', 'TX-UNK-000001', 'MISSING-ID'],
    'quarantined',
    undefined,
    'Suspected cross-corpus overlap'
  );
  assert.deepEqual(quarantineRes.updatedIds, ['TX-AEH-000001', 'TX-UNK-000001']);
  assert.deepEqual(quarantineRes.skippedIds, ['MISSING-ID']);
  assert.equal(quarantineRes.resolvedLayer, 'raw');

  const q1 = quarantineRes.nextSamples.find((s) => s.sample_id === 'TX-AEH-000001')!;
  const q2 = quarantineRes.nextSamples.find((s) => s.sample_id === 'TX-UNK-000001')!;
  const untouched = quarantineRes.nextSamples.find((s) => s.sample_id === 'TX-HUM-000001')!;
  assert.equal(q1.validation.status, 'quarantined');
  assert.equal(q1.validation.verified, false);
  assert.equal(q1.layer, 'raw');
  assert.equal(q2.validation.status, 'quarantined');
  assert.ok(q2.validation.validation_notes.includes('Suspected cross-corpus overlap'));
  assert.equal(untouched.validation.status, 'verified');

  const verifyRes = applyBulkSampleValidation(
    quarantineRes.nextSamples,
    ['TX-AEH-000001', 'TX-UNK-000001'],
    'verified'
  );
  assert.equal(verifyRes.resolvedLayer, 'approved');
  const v1 = verifyRes.nextSamples.find((s) => s.sample_id === 'TX-AEH-000001')!;
  assert.equal(v1.validation.status, 'verified');
  assert.equal(v1.validation.verified, true);
  assert.equal(v1.layer, 'approved');
});

test('i18n provides full EN/AR translation pairs and bilingual glossary definitions', () => {
  assert.equal(detectPromptLanguage('كيف يختلف تباين الجمل؟', 'en'), 'ar');
  assert.equal(detectPromptLanguage('Compare burstiness and Guiraud R', 'ar'), 'en');
  assert.equal(getOriginLabel('ar', 'human'), 'كتابة بشرية خالصة');
  assert.equal(getOriginLabel('en', 'human'), 'Human Writing');
  assert.ok(LINGUISTIC_GLOSSARY.length >= 10);
  for (const term of LINGUISTIC_GLOSSARY) {
    assert.ok(term.termEn.trim().length > 0 && term.termAr.trim().length > 0);
    assert.ok(term.plainDefinitionEn.trim().length > 20 && term.plainDefinitionAr.trim().length > 20);
  }
  assert.ok(UI_STRINGS.modules.dictionary.ar.length > 0);
  assert.ok(UI_STRINGS.modules.guide.ar.length > 0);
});

test('static-hosting deterministic copilot, source discovery, and edit transform fallbacks respond cleanly in EN and AR', () => {
  const replyEn = generateLocalCopilotReply(
    'Compare how sentence burstiness and Guiraud R shift when human prose is AI-edited.',
    {
      datasets: DEMO_DATASETS,
      samples: DEMO_SAMPLES,
      patterns: INITIAL_PATTERNS,
      experiments: INITIAL_EXPERIMENTS,
      uiLanguage: 'en',
    }
  );
  assert.equal(replyEn.isStaticFallback, true);
  assert.ok(replyEn.text.includes('Burstiness CV'));
  assert.ok(replyEn.groundingSources.length >= 1);

  const replyAr = generateLocalCopilotReply(
    'ما العوامل المؤثرة في تحليل الفصحى والعامية المصرية؟',
    {
      datasets: DEMO_DATASETS,
      samples: DEMO_SAMPLES,
      patterns: INITIAL_PATTERNS,
      experiments: INITIAL_EXPERIMENTS,
      uiLanguage: 'ar',
    }
  );
  assert.equal(replyAr.isStaticFallback, true);
  assert.ok(replyAr.text.includes('المساعد البحثي المحلي الحتمي'));
  assert.ok(replyAr.text.includes('العامية المصرية'));

  const srcRes = generateLocalSourceDiscoveryReply('Arabic M4GT benchmark', INITIAL_EXTERNAL_SOURCES, 'en');
  assert.ok(srcRes.summary.includes('M4GT-Bench'));
  assert.ok(srcRes.groundingSources.length >= 3);

  const editRes = generateLocalEditTransform({
    mode: 'edit',
    text: 'Nobody expected the dials to fog up! Yet we kept notes—quickly.',
    instruction: 'Polish into formal academic prose',
  });
  assert.ok(editRes.outputText.length > 20);
  assert.ok(!editRes.outputText.includes('!'));
});

test('dictionary maker extracts corpus candidates, builds IPA/Arabic symbol tables, and computes linguistic charts', () => {
  const candidates = extractCorpusDictionaryCandidates(DEMO_SAMPLES, STARTER_LINGUISTIC_DICTIONARY, 8);
  assert.ok(candidates.length >= 5);
  assert.ok(candidates.every((c) => c.frequencyInCorpus >= 1 && c.headword.length >= 4));

  assert.ok(LINGUISTIC_SYMBOLS_CATALOG.some((s) => s.group === 'ipa_consonant'));
  assert.ok(LINGUISTIC_SYMBOLS_CATALOG.some((s) => s.group === 'ipa_vowel'));
  assert.ok(LINGUISTIC_SYMBOLS_CATALOG.some((s) => s.group === 'arabic_diacritic'));
  assert.ok(LINGUISTIC_SYMBOLS_CATALOG.some((s) => s.group === 'arabic_phoneme'));

  const charts = computeLinguisticChartsData(STARTER_LINGUISTIC_DICTIONARY, DEMO_SAMPLES);
  assert.ok(charts.posDistribution.length >= 2);
  assert.ok(charts.totalAnalyzedTokens > 100);
  assert.ok(charts.zipfTopTokens.length >= 5);
  assert.equal(charts.zipfTopTokens[0].rank, 1);
});

test('dictionary exports generate valid MDict .mdd/.mdx binaries with verified Adler-32 and international XML/TSV formats', () => {
  const meta = {
    title: 'TEXTPRINT Bilingual Stylometry Dictionary',
    description: 'EN-AR computational linguistics lexicon',
    author: 'TEXTPRINT Lab',
    createdDate: '2026-11-24',
  };
  const subset = STARTER_LINGUISTIC_DICTIONARY.slice(0, 4);

  // 1. Validate binary .mdd header length, UTF-16LE XML payload, and Adler-32 checksum
  const mdd = buildMdictMddBinary(subset, meta);
  assert.ok(mdd instanceof Uint8Array);
  assert.ok(mdd.length > 200);
  const view = new DataView(mdd.buffer, mdd.byteOffset, mdd.byteLength);
  const headerLen = view.getUint32(0, false); // big-endian
  assert.ok(headerLen > 40 && headerLen < mdd.length);
  const headerBytes = mdd.slice(4, 4 + headerLen);
  const storedAdlerLe = view.getUint32(4 + headerLen, true);
  assert.equal(storedAdlerLe, computeAdler32(headerBytes));
  const decodedHeader = new TextDecoder('utf-16le').decode(headerBytes);
  assert.ok(decodedHeader.startsWith('<Dictionary GeneratedByEngineVersion="2.0"'));
  assert.ok(decodedHeader.includes('MDD Media'));

  // 2. Validate binary .mdx header & UTF-16LE encoding + checksum
  const mdx = buildMdictMdxBinary(subset, meta);
  const mdxView = new DataView(mdx.buffer, mdx.byteOffset, mdx.byteLength);
  const mdxHeaderLen = mdxView.getUint32(0, false);
  const mdxHeaderBytes = mdx.slice(4, 4 + mdxHeaderLen);
  assert.equal(mdxView.getUint32(4 + mdxHeaderLen, true), computeAdler32(mdxHeaderBytes));
  const mdxDecodedHeader = new TextDecoder('utf-16le').decode(mdxHeaderBytes);
  assert.ok(mdxDecodedHeader.includes('Encoding="UTF-8"'));

  // 3. Validate MDict source, XDXF, TEI P5, StarDict, Anki TSV, CSV, JSON-LD
  const mdxTxt = buildMdictSourceTxt(subset);
  assert.ok(mdxTxt.includes('stylometry'));
  assert.ok(mdxTxt.includes('</>'));

  const xdxf = buildXdxfXml(subset, meta);
  assert.ok(xdxf.includes('<xdxf lang_from="ENG" lang_to="ARA"'));
  assert.ok(xdxf.includes('<dtrn xml:lang="ar">'));

  const tei = buildTeiP5Xml(subset, meta);
  assert.ok(tei.includes('<TEI xmlns="http://www.tei-c.org/ns/1.0">'));
  assert.ok(tei.includes('<pron notation="ipa">'));

  const stardict = buildStarDictBundle(subset, meta);
  assert.ok(stardict.ifo.includes(`wordcount=${subset.length}`));
  assert.ok(stardict.dictTxt.includes('\t'));

  const csv = buildDictionaryCsv(subset);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('mdd_media_key'));

  const tsv = buildDictionaryTsvAnki(subset);
  assert.ok(tsv.includes('#separator:tab'));

  const ontolex = JSON.parse(buildOntoLexJsonLd(subset, meta));
  assert.equal(ontolex['@type'], 'ontolex:Lexicon');
  assert.equal(ontolex.entries.length, subset.length);
});

test('interactive guide presets and multi-platform deployment report cover real samples and GH Pages/Firebase/Vercel/Cloud Run', () => {
  assert.ok(ZERO_KNOWLEDGE_GUIDE_CHAPTERS.length >= 5);
  assert.ok(REAL_WALKTHROUGH_PRESETS.some((p) => p.language === 'ar'));
  assert.ok(REAL_WALKTHROUGH_PRESETS.some((p) => p.language === 'en'));

  const targetIds = new Set(DEPLOYMENT_TARGETS.map((t) => t.id));
  assert.ok(targetIds.has('github_pages'));
  assert.ok(targetIds.has('firebase_hosting'));
  assert.ok(targetIds.has('vercel'));
  assert.ok(targetIds.has('cloud_run'));
  assert.ok(TECHNOLOGY_STACK_INVENTORY.length >= 4);

  const mdEn = buildDeploymentReportMarkdown('en');
  assert.ok(mdEn.includes('GitHub Pages'));
  assert.ok(mdEn.includes('Firebase Hosting'));
  assert.ok(mdEn.includes('Vercel'));
  assert.ok(mdEn.includes('Cloud Run'));

  const mdAr = buildDeploymentReportMarkdown('ar');
  assert.ok(mdAr.includes('تقرير البنية التقنية'));
});

test('adminDashboard computes executive snapshot and formats unauthorized-domain auth guidance in EN & AR', () => {
  const snap = computeExecutiveAdminSnapshot({
    datasets: DEMO_DATASETS,
    samples: DEMO_SAMPLES,
    patterns: INITIAL_PATTERNS,
    experiments: INITIAL_EXPERIMENTS,
    jobs: [],
    auditLogs: [],
  });
  assert.equal(snap.totalSamples, DEMO_SAMPLES.length);
  assert.ok(snap.moderationQueue.length >= 1);
  assert.equal(snap.latestF1Score, 82.5);

  const enGuidance = formatFirebaseAuthErrorMessage(
    'Firebase: Error (auth/unauthorized-domain).',
    'abdokamelayed.github.io',
    'en'
  );
  assert.equal(enGuidance.isUnauthorizedDomain, true);
  assert.equal(enGuidance.hostname, 'abdokamelayed.github.io');
  assert.ok(enGuidance.message.includes('abdokamelayed.github.io'));

  const arGuidance = formatFirebaseAuthErrorMessage(
    'Firebase: Error (auth/unauthorized-domain).',
    'abdokamelayed.github.io',
    'ar'
  );
  assert.equal(arGuidance.isUnauthorizedDomain, true);
  assert.ok(arGuidance.title.includes('Firebase'));

  assert.equal(isSpecialAdminUrlEntry('', '', '/'), false);
  assert.equal(isSpecialAdminUrlEntry('?portal=research', '#/dashboard', '/Textfzication/'), false);
  assert.equal(isSpecialAdminUrlEntry('?portal=admin', '', '/Textfzication/'), true);
  assert.equal(isSpecialAdminUrlEntry('?admin=1', '', '/'), true);
  assert.equal(isSpecialAdminUrlEntry('', '#/admin', '/Textfzication/'), true);
  assert.equal(isSpecialAdminUrlEntry('', '', '/admin'), true);

  assert.equal(canShowAdminNavEntry(false), false);
  assert.equal(canShowAdminNavEntry(true), true);
});

test('server adminAuth handles scrypt first-run passcode claim, verification, and Bearer token validation', () => {
  const initialStatus = getAdminAuthStatus();
  assert.equal(initialStatus.needsFirstRunSetup, true);

  const tooShort = claimInitialAdminPasscode('short', 'Tester');
  assert.equal(tooShort.ok, false);

  const claimed = claimInitialAdminPasscode('TextPrintAdmin#2026', 'Primary Admin');
  assert.equal(claimed.ok, true);
  if (!claimed.ok) return;

  assert.equal(verifyAdminPasscode('TextPrintAdmin#2026'), true);
  assert.equal(verifyAdminPasscode('WrongPasscode123'), false);

  const verifiedPayload = verifyAdminBearerToken(claimed.token);
  assert.ok(verifiedPayload);
  assert.equal(verifiedPayload.role, 'admin');
  assert.equal(verifiedPayload.sub, 'Primary Admin');

  // Re-claiming must lock cleanly with 409
  const secondClaim = claimInitialAdminPasscode('AnotherPass#2026', 'Attacker');
  assert.equal(secondClaim.ok, false);
  if (!secondClaim.ok) {
    assert.equal(secondClaim.status, 409);
  }

  // Tampered token must fail verification
  assert.equal(verifyAdminBearerToken(`${claimed.token}tamper`), null);
});

