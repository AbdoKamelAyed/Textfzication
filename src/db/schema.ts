import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('researcher'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const datasets = pgTable('datasets', {
  id: serial('id').primaryKey(),
  datasetKey: text('dataset_key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  layer: text('layer').notNull().default('raw'), // raw | processed | approved
  version: text('version').notNull().default('1.0.0'),
  license: text('license').notNull().default('CC-BY-4.0'),
  isSyntheticDemo: boolean('is_synthetic_demo').notNull().default(false),
  sourceType: text('source_type').notNull().default('manual_import'),
  ownerUid: text('owner_uid').notNull().default('system'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const samples = pgTable('samples', {
  id: serial('id').primaryKey(),
  sampleId: text('sample_id').notNull().unique(),
  datasetId: integer('dataset_id')
    .references(() => datasets.id, { onDelete: 'cascade' })
    .notNull(),
  text: text('text').notNull(),
  normalizedText: text('normalized_text').notNull(),
  language: text('language').notNull().default('en'),
  dialect: text('dialect'),
  domain: text('domain').notNull().default('general'),
  writingType: text('writing_type').notNull().default('essay'),
  originClass: text('origin_class').notNull().default('unknown'), // human | ai | human_edited_ai | ai_edited_human | mixed | unknown
  originSource: text('origin_source').notNull().default('manual'),
  originModel: text('origin_model'),
  originModelVersion: text('origin_model_version'),
  humanEdited: boolean('human_edited').notNull().default(false),
  aiEdited: boolean('ai_edited').notNull().default(false),
  editingOperations: jsonb('editing_operations').$type<unknown[]>().notNull().default([]),
  provenanceDataset: text('provenance_dataset').notNull(),
  provenanceLicense: text('provenance_license').notNull().default('CC-BY-4.0'),
  collectionDate: text('collection_date').notNull(),
  validationStatus: text('validation_status').notNull().default('pending'), // pending | verified | rejected | quarantined
  verified: boolean('verified').notNull().default(false),
  validationNotes: jsonb('validation_notes').$type<string[]>().notNull().default([]),
  datasetVersion: text('dataset_version').notNull().default('1.0.0'),
  isSyntheticDemo: boolean('is_synthetic_demo').notNull().default(false),
  authorPseudoId: text('author_pseudo_id'),
  ownerUid: text('owner_uid').notNull().default('system'),
  linguisticMetrics: jsonb('linguistic_metrics').$type<Record<string, unknown>>(),
  contentHash: text('content_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const externalSources = pgTable('external_sources', {
  id: serial('id').primaryKey(),
  sourceKey: text('source_key').notNull().unique(),
  name: text('name').notNull(),
  officialUrl: text('official_url').notNull(),
  description: text('description').notNull(),
  dataFormat: text('data_format').notNull(),
  language: text('language').notNull(),
  license: text('license').notNull(),
  accessMethod: text('access_method').notNull(),
  lastCheckedDate: text('last_checked_date').notNull(),
  lastImportDate: text('last_import_date'),
  status: text('status').notNull().default('active'),
  reliabilityNotes: text('reliability_notes').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const collectionJobs = pgTable('collection_jobs', {
  id: serial('id').primaryKey(),
  jobKey: text('job_key').notNull().unique(),
  sourceKey: text('source_key').notNull(),
  sourceName: text('source_name').notNull(),
  collectionMethod: text('collection_method').notNull(),
  scheduleCron: text('schedule_cron').notNull(),
  expectedFormat: text('expected_format').notNull(),
  executionStatus: text('execution_status').notNull().default('idle'),
  importedRecords: integer('imported_records').notNull().default(0),
  failedRecords: integer('failed_records').notNull().default(0),
  errorLog: text('error_log'),
  lastExecution: text('last_execution'),
  nextExecution: text('next_execution').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const experiments = pgTable('experiments', {
  id: serial('id').primaryKey(),
  experimentKey: text('experiment_key').notNull().unique(),
  name: text('name').notNull(),
  hypothesis: text('hypothesis').notNull(),
  datasetKey: text('dataset_key').notNull(),
  datasetLayer: text('dataset_layer').notNull().default('approved'),
  includesUnverified: boolean('includes_unverified').notNull().default(false),
  isExploratory: boolean('is_exploratory').notNull().default(true),
  modelType: text('model_type').notNull(),
  modelVersion: text('model_version').notNull(),
  languageScope: text('language_scope').notNull().default('en,ar'),
  splitStrategy: text('split_strategy').notNull().default('grouped_by_source'),
  metrics: jsonb('metrics').$type<Record<string, unknown>>().notNull().default({}),
  status: text('status').notNull().default('completed'),
  ownerUid: text('owner_uid').notNull().default('system'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const discoveredPatterns = pgTable('discovered_patterns', {
  id: serial('id').primaryKey(),
  patternKey: text('pattern_key').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  supportingSampleIds: jsonb('supporting_sample_ids').$type<string[]>().notNull().default([]),
  frequency: real('frequency').notNull().default(0),
  relevantFeatures: jsonb('relevant_features').$type<string[]>().notNull().default([]),
  confidence: real('confidence').notNull().default(0),
  discoveryMethod: text('discovery_method').notNull(),
  validationStatus: text('validation_status').notNull().default('observed'), // observed | hypothesis | statistically_supported | approved
  relatedPatternKeys: jsonb('related_pattern_keys').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUid: text('actor_uid').notNull().default('system'),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const datasetsRelations = relations(datasets, ({ many }) => ({
  samples: many(samples),
}));

export const samplesRelations = relations(samples, ({ one }) => ({
  dataset: one(datasets, {
    fields: [samples.datasetId],
    references: [datasets.id],
  }),
}));
