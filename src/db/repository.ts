import { desc, eq, inArray } from 'drizzle-orm';
import { db, isSqlAvailable, markSqlUnavailable } from './index.ts';
import {
  auditLogs,
  collectionJobs,
  datasets,
  discoveredPatterns,
  experiments,
  externalSources,
  samples,
} from './schema.ts';
import {
  DEMO_DATASETS,
  DEMO_SAMPLES,
  INITIAL_COLLECTION_JOBS,
  INITIAL_EXPERIMENTS,
  INITIAL_EXTERNAL_SOURCES,
  INITIAL_PATTERNS,
} from '../engine/demoCorpus.ts';
import type {
  AuditEvent,
  CollectionJob,
  DatasetRecord,
  ExperimentRecord,
  ExternalSource,
  TextSample,
  WritingPattern,
} from '../engine/types.ts';

interface InMemoryCorpusStore {
  datasets: DatasetRecord[];
  samples: TextSample[];
  sources: ExternalSource[];
  jobs: CollectionJob[];
  patterns: WritingPattern[];
  experiments: ExperimentRecord[];
  auditLogs: AuditEvent[];
}

const memoryStore: InMemoryCorpusStore = {
  datasets: [...DEMO_DATASETS],
  samples: [...DEMO_SAMPLES],
  sources: [...INITIAL_EXTERNAL_SOURCES],
  jobs: [...INITIAL_COLLECTION_JOBS],
  patterns: [...INITIAL_PATTERNS],
  experiments: [...INITIAL_EXPERIMENTS],
  auditLogs: [
    {
      id: 'audit-init-1',
      timestamp: new Date().toISOString(),
      actor: 'system',
      action: 'DEMO_CORPUS_INITIALIZED',
      target_type: 'dataset',
      target_id: 'tx-demo-multilingual-v1',
      details: 'Loaded clearly labeled synthetic demonstration dataset (EN/AR).',
    },
  ],
};

export async function fetchCorpusSnapshot(): Promise<{
  backendMode: 'cloudsql' | 'hybrid_memory';
  datasets: DatasetRecord[];
  samples: TextSample[];
  sources: ExternalSource[];
  jobs: CollectionJob[];
  patterns: WritingPattern[];
  experiments: ExperimentRecord[];
  auditLogs: AuditEvent[];
}> {
  if (await isSqlAvailable()) {
    try {
      const [dbDatasets, dbSamples, dbSources, dbJobs, dbPatterns, dbExperiments, dbLogs] =
        await Promise.all([
          db.select().from(datasets).orderBy(desc(datasets.createdAt)),
          db.select().from(samples).orderBy(desc(samples.createdAt)),
          db.select().from(externalSources),
          db.select().from(collectionJobs),
          db.select().from(discoveredPatterns),
          db.select().from(experiments).orderBy(desc(experiments.createdAt)),
          db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50),
        ]);

      if (dbDatasets.length > 0 || dbSamples.length > 0) {
        const dsKeyById = new Map<number, string>();
        for (const d of dbDatasets) dsKeyById.set(d.id, d.datasetKey);

        return {
          backendMode: 'cloudsql',
          datasets: dbDatasets.map((d) => ({
            dataset_key: d.datasetKey,
            name: d.name,
            description: d.description,
            layer: d.layer as DatasetRecord['layer'],
            version: d.version,
            license: d.license,
            is_synthetic_demo: d.isSyntheticDemo,
            source_type: d.sourceType,
            created_at: d.createdAt.toISOString(),
            updated_at: d.updatedAt.toISOString(),
          })),
          samples: dbSamples.map((s) => ({
            sample_id: s.sampleId,
            dataset_key: dsKeyById.get(s.datasetId) ?? s.provenanceDataset,
            text: s.text,
            normalized_text: s.normalizedText,
            language: s.language,
            dialect: s.dialect,
            domain: s.domain,
            writing_type: s.writingType,
            origin: {
              class: s.originClass as TextSample['origin']['class'],
              source: s.originSource,
              model: s.originModel,
              model_version: s.originModelVersion,
            },
            editing_history: {
              human_edited: s.humanEdited,
              ai_edited: s.aiEdited,
              editing_operations: (s.editingOperations as TextSample['editing_history']['editing_operations']) || [],
            },
            provenance: {
              dataset: s.provenanceDataset,
              license: s.provenanceLicense,
              collection_date: s.collectionDate,
            },
            validation: {
              status: s.validationStatus as TextSample['validation']['status'],
              verified: s.verified,
              validation_notes: s.validationNotes || [],
            },
            layer: s.verified ? 'approved' : 'raw',
            dataset_version: s.datasetVersion,
            is_synthetic_demo: s.isSyntheticDemo,
            author_pseudo_id: s.authorPseudoId,
            content_hash: s.contentHash,
            linguistic_metrics: (s.linguisticMetrics as unknown as TextSample['linguistic_metrics']) ?? undefined,
          })),
          sources:
            dbSources.length > 0
              ? dbSources.map((src) => ({
                  source_key: src.sourceKey,
                  name: src.name,
                  official_url: src.officialUrl,
                  description: src.description,
                  data_format: src.dataFormat,
                  language: src.language,
                  license: src.license,
                  access_method: src.accessMethod,
                  last_checked_date: src.lastCheckedDate,
                  last_import_date: src.lastImportDate,
                  status: src.status as ExternalSource['status'],
                  reliability_notes: src.reliabilityNotes,
                }))
              : memoryStore.sources,
          jobs:
            dbJobs.length > 0
              ? dbJobs.map((j) => ({
                  job_key: j.jobKey,
                  source_key: j.sourceKey,
                  source_name: j.sourceName,
                  collection_method: j.collectionMethod,
                  schedule_cron: j.scheduleCron,
                  expected_format: j.expectedFormat,
                  execution_status: j.executionStatus as CollectionJob['execution_status'],
                  imported_records: j.importedRecords,
                  failed_records: j.failedRecords,
                  error_log: j.errorLog,
                  last_execution: j.lastExecution,
                  next_execution: j.nextExecution,
                }))
              : memoryStore.jobs,
          patterns:
            dbPatterns.length > 0
              ? dbPatterns.map((p) => ({
                  pattern_id: p.patternKey,
                  title: p.title,
                  description: p.description,
                  category: p.category,
                  supporting_samples: p.supportingSampleIds,
                  frequency: p.frequency,
                  relevant_features: p.relevantFeatures,
                  confidence: p.confidence,
                  discovery_method: p.discoveryMethod,
                  validation_status: p.validationStatus as WritingPattern['validation_status'],
                  related_patterns: p.relatedPatternKeys,
                }))
              : memoryStore.patterns,
          experiments:
            dbExperiments.length > 0
              ? dbExperiments.map((e) => ({
                  experiment_key: e.experimentKey,
                  name: e.name,
                  hypothesis: e.hypothesis,
                  dataset_key: e.datasetKey,
                  dataset_layer: e.datasetLayer as ExperimentRecord['dataset_layer'],
                  includes_unverified: e.includesUnverified,
                  is_exploratory: e.isExploratory,
                  model_type: e.modelType,
                  model_version: e.modelVersion,
                  language_scope: e.languageScope,
                  split_strategy: e.splitStrategy,
                  status: e.status as ExperimentRecord['status'],
                  metrics: e.metrics as ExperimentRecord['metrics'],
                  created_at: e.createdAt.toISOString(),
                }))
              : memoryStore.experiments,
          auditLogs: dbLogs.map((l) => ({
            id: String(l.id),
            timestamp: l.createdAt.toISOString(),
            actor: l.actorUid,
            action: l.action,
            target_type: l.targetType,
            target_id: l.targetId,
            details: JSON.stringify(l.details),
          })),
        };
      }
    } catch {
      markSqlUnavailable();
    }
  }

  return {
    backendMode: 'hybrid_memory',
    ...memoryStore,
  };
}

export async function createDatasetRecord(
  dataset: DatasetRecord,
  ownerUid: string
): Promise<{ persistedToSql: boolean }> {
  memoryStore.datasets = [
    dataset,
    ...memoryStore.datasets.filter((d) => d.dataset_key !== dataset.dataset_key),
  ];
  memoryStore.auditLogs.unshift({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: ownerUid,
    action: 'DATASET_CREATED',
    target_type: 'dataset',
    target_id: dataset.dataset_key,
    details: `Created ${dataset.name} (${dataset.layer})`,
  });

  if (await isSqlAvailable()) {
    try {
      await db
        .insert(datasets)
        .values({
          datasetKey: dataset.dataset_key,
          name: dataset.name,
          description: dataset.description,
          layer: dataset.layer,
          version: dataset.version,
          license: dataset.license,
          isSyntheticDemo: dataset.is_synthetic_demo,
          sourceType: dataset.source_type,
          ownerUid,
        })
        .onConflictDoNothing();
      return { persistedToSql: true };
    } catch {
      markSqlUnavailable();
    }
  }
  return { persistedToSql: false };
}

export async function createSampleRecords(
  newSamples: TextSample[],
  ownerUid: string
): Promise<{ persistedToSql: boolean; count: number }> {
  const existingIds = new Set(memoryStore.samples.map((s) => s.sample_id));
  const uniqueNew = newSamples.filter((s) => !existingIds.has(s.sample_id));
  memoryStore.samples = [...uniqueNew, ...memoryStore.samples];
  memoryStore.auditLogs.unshift({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: ownerUid,
    action: 'SAMPLES_IMPORTED',
    target_type: 'sample_batch',
    target_id: newSamples[0]?.dataset_key ?? 'batch',
    details: `Imported ${uniqueNew.length} sample(s) into RAW layer.`,
  });

  if ((await isSqlAvailable()) && uniqueNew.length > 0) {
    try {
      for (const s of uniqueNew) {
        const dsRows = await db
          .select()
          .from(datasets)
          .where(eq(datasets.datasetKey, s.dataset_key))
          .limit(1);
        if (dsRows.length === 0) continue;

        await db
          .insert(samples)
          .values({
            sampleId: s.sample_id,
            datasetId: dsRows[0].id,
            text: s.text,
            normalizedText: s.normalized_text,
            language: s.language,
            dialect: s.dialect,
            domain: s.domain,
            writingType: s.writing_type,
            originClass: s.origin.class,
            originSource: s.origin.source,
            originModel: s.origin.model,
            originModelVersion: s.origin.model_version,
            humanEdited: s.editing_history.human_edited,
            aiEdited: s.editing_history.ai_edited,
            editingOperations: s.editing_history.editing_operations,
            provenanceDataset: s.provenance.dataset,
            provenanceLicense: s.provenance.license,
            collectionDate: s.provenance.collection_date,
            validationStatus: s.validation.status,
            verified: s.validation.verified,
            validationNotes: s.validation.validation_notes,
            datasetVersion: s.dataset_version,
            isSyntheticDemo: s.is_synthetic_demo,
            authorPseudoId: s.author_pseudo_id,
            ownerUid,
            linguisticMetrics: (s.linguistic_metrics ?? {}) as Record<string, unknown>,
            contentHash: s.content_hash,
          })
          .onConflictDoNothing();
      }
      return { persistedToSql: true, count: uniqueNew.length };
    } catch {
      markSqlUnavailable();
    }
  }
  return { persistedToSql: false, count: uniqueNew.length };
}

export async function updateSampleValidation(
  sampleId: string,
  status: TextSample['validation']['status'],
  layer: TextSample['layer'],
  note: string,
  actorUid: string
): Promise<boolean> {
  const idx = memoryStore.samples.findIndex((s) => s.sample_id === sampleId);
  if (idx >= 0) {
    const existing = memoryStore.samples[idx];
    memoryStore.samples[idx] = {
      ...existing,
      layer,
      validation: {
        status,
        verified: status === 'verified',
        validation_notes: [note, ...existing.validation.validation_notes],
      },
    };
  }
  memoryStore.auditLogs.unshift({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: actorUid,
    action: 'SAMPLE_VALIDATION_UPDATED',
    target_type: 'sample',
    target_id: sampleId,
    details: `Status=${status}, Layer=${layer}: ${note}`,
  });

  if (await isSqlAvailable()) {
    try {
      await db
        .update(samples)
        .set({
          validationStatus: status,
          verified: status === 'verified',
        })
        .where(eq(samples.sampleId, sampleId));
      return true;
    } catch {
      markSqlUnavailable();
    }
  }
  return idx >= 0;
}

export async function bulkUpdateSampleValidation(
  sampleIds: string[],
  status: TextSample['validation']['status'],
  layer: TextSample['layer'],
  note: string,
  actorUid: string
): Promise<{ updatedCount: number; persistedToSql: boolean }> {
  const cleanIds = Array.from(new Set(sampleIds.map((id) => id.trim()).filter(Boolean)));
  if (cleanIds.length === 0) {
    return { updatedCount: 0, persistedToSql: false };
  }
  const idSet = new Set(cleanIds);
  let memoryUpdated = 0;

  memoryStore.samples = memoryStore.samples.map((existing) => {
    if (!idSet.has(existing.sample_id)) return existing;
    memoryUpdated += 1;
    return {
      ...existing,
      layer,
      validation: {
        status,
        verified: status === 'verified',
        validation_notes: [note, ...existing.validation.validation_notes],
      },
    };
  });

  memoryStore.auditLogs.unshift({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: actorUid,
    action: 'SAMPLES_BULK_VALIDATED',
    target_type: 'sample_batch',
    target_id: `${cleanIds.length} sample(s)`,
    details: `Bulk Status=${status}, Layer=${layer} (${cleanIds.slice(0, 4).join(', ')}${cleanIds.length > 4 ? ', ...' : ''}): ${note}`,
  });

  if (await isSqlAvailable()) {
    try {
      await db
        .update(samples)
        .set({
          validationStatus: status,
          verified: status === 'verified',
        })
        .where(inArray(samples.sampleId, cleanIds));
      return { updatedCount: memoryUpdated || cleanIds.length, persistedToSql: true };
    } catch {
      markSqlUnavailable();
    }
  }
  return { updatedCount: memoryUpdated, persistedToSql: false };
}

export async function saveExperimentRecord(
  exp: ExperimentRecord,
  ownerUid: string
): Promise<{ persistedToSql: boolean }> {
  memoryStore.experiments = [exp, ...memoryStore.experiments];
  memoryStore.auditLogs.unshift({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: ownerUid,
    action: 'EXPERIMENT_RECORDED',
    target_type: 'experiment',
    target_id: exp.experiment_key,
    details: `${exp.name} (F1=${exp.metrics.f1_score}, exploratory=${exp.is_exploratory})`,
  });

  if (await isSqlAvailable()) {
    try {
      await db
        .insert(experiments)
        .values({
          experimentKey: exp.experiment_key,
          name: exp.name,
          hypothesis: exp.hypothesis,
          datasetKey: exp.dataset_key,
          datasetLayer: exp.dataset_layer,
          includesUnverified: exp.includes_unverified,
          isExploratory: exp.is_exploratory,
          modelType: exp.model_type,
          modelVersion: exp.model_version,
          languageScope: exp.language_scope,
          splitStrategy: exp.split_strategy,
          metrics: exp.metrics as unknown as Record<string, unknown>,
          status: exp.status,
          ownerUid,
        })
        .onConflictDoNothing();
      return { persistedToSql: true };
    } catch {
      markSqlUnavailable();
    }
  }
  return { persistedToSql: false };
}
