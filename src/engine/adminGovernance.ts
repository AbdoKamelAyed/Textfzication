import type { AuditEvent, DatasetRecord, ExperimentRecord, TextSample } from './types.ts';

export type SystemRole = 'researcher' | 'reviewer' | 'admin';
export type AccountStatus = 'active' | 'suspended';

export interface ResponsibilityRule {
  domain: string;
  capability: string;
  researcher: string;
  reviewer: string;
  admin: string;
  enforcementLayer: string;
}

export const SYSTEM_RESPONSIBILITY_MATRIX: ResponsibilityRule[] = [
  {
    domain: 'Data Acquisition & CSV Batch',
    capability: 'Import local CSV/JSONL/XML, Drive files, or human portal samples into RAW layer',
    researcher: 'Allowed (own workspace)',
    reviewer: 'Allowed (own workspace)',
    admin: 'Full access',
    enforcementLayer: 'Client Validation + firestore.rules (isOwner)',
  },
  {
    domain: 'Dataset Governance',
    capability: 'Verify/reject samples and promote records from RAW to PROCESSED/APPROVED',
    researcher: 'Propose / run quality audit',
    reviewer: 'Approve / quarantine',
    admin: 'Approve / override / delete',
    enforcementLayer: 'DatasetManagementView + validation.ts',
  },
  {
    domain: 'Modeling & Experiments',
    capability: 'Configure splits, run probabilistic baselines, and approve writing patterns',
    researcher: 'Run exploratory / strict models',
    reviewer: 'Approve writing patterns',
    admin: 'Full audit & archive',
    enforcementLayer: 'TrainingAndExperimentsView + training.ts',
  },
  {
    domain: 'Users & Authorization',
    capability: 'List directory, assign roles (researcher/reviewer/admin), suspend accounts',
    researcher: 'Own profile only',
    reviewer: 'Own profile only',
    admin: 'Full RBAC & /admins allowlist',
    enforcementLayer: 'firestore.rules (isAdmin + affectedKeys)',
  },
  {
    domain: 'Databases & Maintenance',
    capability: 'Inspect IndexedDB, Firestore & Cloud SQL health; export backups; clear cache',
    researcher: 'Local IndexedDB export/clear',
    reviewer: 'Corpus diagnostics',
    admin: 'Cross-store diagnostics & governance',
    enforcementLayer: 'Admin & Governance + /api/system/status',
  },
  {
    domain: 'Deployment & CI/CD',
    capability: 'Inspect Node/Cloud Run status, Firebase Hosting dev channel & GitHub Actions',
    researcher: 'Read-only status',
    reviewer: 'Read-only status',
    admin: 'Deployment & workflow governance',
    enforcementLayer: 'GET /api/system/status + deploy workflows',
  },
];

export interface DatabaseLayerSummary {
  totalDatasets: number;
  researchDatasets: number;
  demoDatasets: number;
  totalSamples: number;
  rawCount: number;
  processedCount: number;
  approvedCount: number;
  verifiedCount: number;
  quarantinedCount: number;
  experimentsCount: number;
}

export function computeDatabaseLayerSummary(params: {
  datasets: DatasetRecord[];
  samples: TextSample[];
  experiments: ExperimentRecord[];
}): DatabaseLayerSummary {
  let rawCount = 0;
  let processedCount = 0;
  let approvedCount = 0;
  let verifiedCount = 0;
  let quarantinedCount = 0;

  for (const s of params.samples) {
    if (s.layer === 'raw') rawCount += 1;
    else if (s.layer === 'processed') processedCount += 1;
    else if (s.layer === 'approved') approvedCount += 1;

    if (s.validation.verified) verifiedCount += 1;
    if (s.validation.status === 'quarantined' || s.validation.status === 'rejected') {
      quarantinedCount += 1;
    }
  }

  const demoDatasets = params.datasets.filter((d) => d.is_synthetic_demo).length;
  return {
    totalDatasets: params.datasets.length,
    researchDatasets: params.datasets.length - demoDatasets,
    demoDatasets,
    totalSamples: params.samples.length,
    rawCount,
    processedCount,
    approvedCount,
    verifiedCount,
    quarantinedCount,
    experimentsCount: params.experiments.length,
  };
}

export function filterAuditEvents(
  logs: AuditEvent[],
  queryText: string,
  actionFilter = 'ALL'
): AuditEvent[] {
  const q = queryText.trim().toLowerCase();
  return logs.filter((ev) => {
    if (actionFilter !== 'ALL' && ev.action !== actionFilter) {
      return false;
    }
    if (!q) return true;
    return (
      ev.action.toLowerCase().includes(q) ||
      ev.actor.toLowerCase().includes(q) ||
      ev.target_id.toLowerCase().includes(q) ||
      ev.details.toLowerCase().includes(q)
    );
  });
}
