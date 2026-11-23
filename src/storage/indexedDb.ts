import type {
  AuditEvent,
  CollectionJob,
  DatasetRecord,
  ExperimentRecord,
  ExternalSource,
  TextSample,
  WritingPattern,
} from '../engine/types';

const DB_NAME = 'textprint_research_lab_v1';
const DB_VERSION = 1;

export type StoreName =
  | 'datasets'
  | 'raw_samples'
  | 'processed_samples'
  | 'approved_samples'
  | 'patterns'
  | 'experiments'
  | 'sources'
  | 'jobs'
  | 'audit_logs';

const STORES: Array<{ name: StoreName; keyPath: string }> = [
  { name: 'datasets', keyPath: 'dataset_key' },
  { name: 'raw_samples', keyPath: 'sample_id' },
  { name: 'processed_samples', keyPath: 'sample_id' },
  { name: 'approved_samples', keyPath: 'sample_id' },
  { name: 'patterns', keyPath: 'pattern_id' },
  { name: 'experiments', keyPath: 'experiment_key' },
  { name: 'sources', keyPath: 'source_key' },
  { name: 'jobs', keyPath: 'job_key' },
  { name: 'audit_logs', keyPath: 'id' },
];

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable in current runtime.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s.name)) {
          db.createObjectStore(s.name, { keyPath: s.keyPath });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putMany<T>(storeName: StoreName, items: T[]): Promise<void> {
  if (items.length === 0) return;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getAllFromStore<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDatabase();
  const rows = await new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows;
}

async function clearStore(storeName: StoreName): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function saveWorkspaceToIndexedDb(payload: {
  datasets: DatasetRecord[];
  samples: TextSample[];
  patterns: WritingPattern[];
  experiments: ExperimentRecord[];
  sources: ExternalSource[];
  jobs: CollectionJob[];
  auditLogs: AuditEvent[];
}): Promise<void> {
  const raw = payload.samples.filter((s) => s.layer === 'raw');
  const processed = payload.samples.filter((s) => s.layer === 'processed');
  const approved = payload.samples.filter((s) => s.layer === 'approved');

  await Promise.all([
    clearStore('datasets').then(() => putMany('datasets', payload.datasets)),
    clearStore('raw_samples').then(() => putMany('raw_samples', raw)),
    clearStore('processed_samples').then(() => putMany('processed_samples', processed)),
    clearStore('approved_samples').then(() => putMany('approved_samples', approved)),
    clearStore('patterns').then(() => putMany('patterns', payload.patterns)),
    clearStore('experiments').then(() => putMany('experiments', payload.experiments)),
    clearStore('sources').then(() => putMany('sources', payload.sources)),
    clearStore('jobs').then(() => putMany('jobs', payload.jobs)),
    clearStore('audit_logs').then(() => putMany('audit_logs', payload.auditLogs.slice(0, 150))),
  ]);
}

export async function loadWorkspaceFromIndexedDb(): Promise<{
  datasets: DatasetRecord[];
  samples: TextSample[];
  patterns: WritingPattern[];
  experiments: ExperimentRecord[];
  sources: ExternalSource[];
  jobs: CollectionJob[];
  auditLogs: AuditEvent[];
} | null> {
  try {
    const [datasets, raw, processed, approved, patterns, experiments, sources, jobs, auditLogs] =
      await Promise.all([
        getAllFromStore<DatasetRecord>('datasets'),
        getAllFromStore<TextSample>('raw_samples'),
        getAllFromStore<TextSample>('processed_samples'),
        getAllFromStore<TextSample>('approved_samples'),
        getAllFromStore<WritingPattern>('patterns'),
        getAllFromStore<ExperimentRecord>('experiments'),
        getAllFromStore<ExternalSource>('sources'),
        getAllFromStore<CollectionJob>('jobs'),
        getAllFromStore<AuditEvent>('audit_logs'),
      ]);

    if (datasets.length === 0 && raw.length + processed.length + approved.length === 0) {
      return null;
    }

    return {
      datasets,
      samples: [...approved, ...processed, ...raw],
      patterns,
      experiments,
      sources,
      jobs,
      auditLogs,
    };
  } catch {
    return null;
  }
}

export async function clearAllIndexedDbData(): Promise<void> {
  await Promise.all(STORES.map((s) => clearStore(s.name)));
}
