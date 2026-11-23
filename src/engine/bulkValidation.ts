import type { StorageLayer, TextSample, ValidationStatus } from './types';

export interface BulkValidationPolicy {
  status: ValidationStatus;
  defaultLayer: StorageLayer;
  label: string;
  defaultNote: string;
}

export const BULK_VALIDATION_POLICIES: Record<ValidationStatus, BulkValidationPolicy> = {
  verified: {
    status: 'verified',
    defaultLayer: 'approved',
    label: 'Mark Verified',
    defaultNote: 'Bulk verified and promoted to APPROVED layer by researcher.',
  },
  quarantined: {
    status: 'quarantined',
    defaultLayer: 'raw',
    label: 'Quarantine',
    defaultNote: 'Bulk quarantined to RAW layer for quality or contamination review.',
  },
  rejected: {
    status: 'rejected',
    defaultLayer: 'raw',
    label: 'Reject',
    defaultNote: 'Bulk rejected during corpus quality audit.',
  },
  pending: {
    status: 'pending',
    defaultLayer: 'processed',
    label: 'Mark Pending',
    defaultNote: 'Bulk returned to PENDING status in PROCESSED layer.',
  },
};

export interface FilteredSelectionStats {
  totalSelected: number;
  visibleSelected: number;
  hiddenSelected: number;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
}

export function toggleSampleSelection(
  selectedIds: ReadonlySet<string>,
  sampleId: string
): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(sampleId)) {
    next.delete(sampleId);
  } else {
    next.add(sampleId);
  }
  return next;
}

export function toggleSelectAllFiltered(
  selectedIds: ReadonlySet<string>,
  filteredSamples: ReadonlyArray<Pick<TextSample, 'sample_id'>>
): Set<string> {
  if (filteredSamples.length === 0) {
    return new Set(selectedIds);
  }
  const allVisibleAlreadySelected = filteredSamples.every((s) =>
    selectedIds.has(s.sample_id)
  );
  const next = new Set(selectedIds);
  if (allVisibleAlreadySelected) {
    for (const s of filteredSamples) {
      next.delete(s.sample_id);
    }
  } else {
    for (const s of filteredSamples) {
      next.add(s.sample_id);
    }
  }
  return next;
}

export function pruneSelectionToExisting(
  selectedIds: ReadonlySet<string>,
  allSamples: ReadonlyArray<Pick<TextSample, 'sample_id'>>
): Set<string> {
  if (selectedIds.size === 0) return new Set();
  const valid = new Set(allSamples.map((s) => s.sample_id));
  const next = new Set<string>();
  for (const id of selectedIds) {
    if (valid.has(id)) next.add(id);
  }
  return next;
}

export function getFilteredSelectionStats(
  selectedIds: ReadonlySet<string>,
  filteredSamples: ReadonlyArray<Pick<TextSample, 'sample_id'>>
): FilteredSelectionStats {
  let visibleSelected = 0;
  for (const s of filteredSamples) {
    if (selectedIds.has(s.sample_id)) {
      visibleSelected += 1;
    }
  }
  const totalSelected = selectedIds.size;
  const hiddenSelected = Math.max(0, totalSelected - visibleSelected);
  const allVisibleSelected =
    filteredSamples.length > 0 && visibleSelected === filteredSamples.length;
  const someVisibleSelected =
    visibleSelected > 0 && visibleSelected < filteredSamples.length;

  return {
    totalSelected,
    visibleSelected,
    hiddenSelected,
    allVisibleSelected,
    someVisibleSelected,
  };
}

export interface BulkValidationResult {
  nextSamples: TextSample[];
  updatedIds: string[];
  skippedIds: string[];
  resolvedLayer: StorageLayer;
  resolvedNote: string;
}

export function applyBulkSampleValidation(
  samples: ReadonlyArray<TextSample>,
  sampleIds: ReadonlyArray<string>,
  status: ValidationStatus,
  layer?: StorageLayer,
  note?: string
): BulkValidationResult {
  const policy = BULK_VALIDATION_POLICIES[status];
  const resolvedLayer = layer ?? policy.defaultLayer;
  const trimmedNote = typeof note === 'string' ? note.trim() : '';
  const resolvedNote = trimmedNote || policy.defaultNote;

  const uniqueTargetIds = Array.from(
    new Set(sampleIds.map((id) => id.trim()).filter(Boolean))
  );
  const targetSet = new Set(uniqueTargetIds);
  const matchedSet = new Set<string>();

  const nextSamples = samples.map((sample) => {
    if (!targetSet.has(sample.sample_id)) {
      return sample;
    }
    matchedSet.add(sample.sample_id);
    return {
      ...sample,
      layer: resolvedLayer,
      validation: {
        status,
        verified: status === 'verified',
        validation_notes: [...sample.validation.validation_notes, resolvedNote],
      },
    };
  });

  const updatedIds = uniqueTargetIds.filter((id) => matchedSet.has(id));
  const skippedIds = uniqueTargetIds.filter((id) => !matchedSet.has(id));

  return {
    nextSamples,
    updatedIds,
    skippedIds,
    resolvedLayer,
    resolvedNote,
  };
}
