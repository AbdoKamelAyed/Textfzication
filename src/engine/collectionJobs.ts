import type { CollectionJob, DatasetRecord, TextSample } from './types.ts';

export interface JobProgressView {
  percent: number;
  processedRecords: number;
  statusLabel: 'Idle' | 'Running' | 'Completed' | 'Failed';
  stageLabel: string;
  tone: 'idle' | 'running' | 'completed' | 'failed';
}

export interface CollectionJobsSummary {
  total: number;
  running: number;
  completed: number;
  failed: number;
  idle: number;
  totalImported: number;
  totalFailed: number;
  averagePercent: number;
}

export function computeJobProgress(job: CollectionJob): JobProgressView {
  const processedRecords = Math.max(0, job.imported_records) + Math.max(0, job.failed_records);

  let rawPercent: number;
  if (typeof job.progress_percent === 'number' && Number.isFinite(job.progress_percent)) {
    rawPercent = job.progress_percent;
  } else if (
    typeof job.target_records === 'number' &&
    Number.isFinite(job.target_records) &&
    job.target_records > 0
  ) {
    rawPercent = (processedRecords / job.target_records) * 100;
  } else if (job.execution_status === 'completed') {
    rawPercent = 100;
  } else if (job.execution_status === 'running') {
    rawPercent = 50;
  } else if (job.execution_status === 'failed') {
    rawPercent = 100;
  } else {
    rawPercent = 0;
  }

  const percent = Math.max(0, Math.min(100, Math.round(rawPercent)));

  let statusLabel: JobProgressView['statusLabel'] = 'Idle';
  let defaultStage = 'Scheduled / awaiting run';
  if (job.execution_status === 'running') {
    statusLabel = 'Running';
    defaultStage = 'Processing records...';
  } else if (job.execution_status === 'completed') {
    statusLabel = 'Completed';
    defaultStage = 'Verification complete';
  } else if (job.execution_status === 'failed') {
    statusLabel = 'Failed';
    defaultStage = job.error_log || 'Execution halted with errors';
  }

  return {
    percent,
    processedRecords,
    statusLabel,
    stageLabel: job.current_stage?.trim() || defaultStage,
    tone: job.execution_status,
  };
}

export function summarizeCollectionJobs(jobs: CollectionJob[]): CollectionJobsSummary {
  let running = 0;
  let completed = 0;
  let failed = 0;
  let idle = 0;
  let totalImported = 0;
  let totalFailed = 0;
  let percentSum = 0;

  for (const job of jobs) {
    if (job.execution_status === 'running') running += 1;
    else if (job.execution_status === 'completed') completed += 1;
    else if (job.execution_status === 'failed') failed += 1;
    else idle += 1;

    totalImported += Math.max(0, job.imported_records);
    totalFailed += Math.max(0, job.failed_records);
    percentSum += computeJobProgress(job).percent;
  }

  return {
    total: jobs.length,
    running,
    completed,
    failed,
    idle,
    totalImported,
    totalFailed,
    averagePercent: jobs.length > 0 ? Math.round(percentSum / jobs.length) : 0,
  };
}

export function createImportCollectionJob(
  dataset: DatasetRecord,
  importedSamples: TextSample[],
  nowIso = new Date().toISOString()
): CollectionJob {
  const flaggedCount = importedSamples.filter(
    (s) => s.validation.status === 'quarantined' || s.validation.status === 'rejected'
  ).length;
  const importedCount = Math.max(0, importedSamples.length - flaggedCount);
  const totalCount = importedSamples.length;
  const format = dataset.source_type.includes('csv')
    ? 'CSV'
    : dataset.source_type.replace(/^importer_/, '').toUpperCase() || 'DATA';

  return {
    job_key: `job-import-${dataset.dataset_key}-${Date.now().toString(36).slice(-4)}`,
    source_key: dataset.dataset_key,
    source_name: `Import: ${dataset.name}`,
    collection_method:
      dataset.source_type === 'csv_batch_drop' ? 'CSV Batch Drop' : 'Dataset Importer',
    schedule_cron: 'manual',
    expected_format: format,
    execution_status: totalCount > 0 ? 'completed' : 'failed',
    imported_records: importedCount,
    failed_records: flaggedCount,
    error_log: totalCount === 0 ? 'No valid records imported.' : null,
    last_execution: nowIso,
    next_execution: nowIso,
    progress_percent: 100,
    target_records: totalCount,
    current_stage:
      totalCount > 0
        ? `Imported ${importedCount} ready · ${flaggedCount} quarantined`
        : 'Empty import payload',
  };
}
