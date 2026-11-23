import type {
  OriginClass,
  StorageLayer,
  TextSample,
  ValidationStatus,
} from './types';

export interface SampleExportFilter {
  searchQuery: string;
  datasetKey: string;
  layer: 'all' | StorageLayer;
  originClass: 'all' | OriginClass;
  language: 'all' | 'en' | 'ar' | 'mixed';
  validationStatus: 'all' | ValidationStatus;
  excludeSyntheticDemo: boolean;
}

export const DEFAULT_EXPORT_FILTER: SampleExportFilter = {
  searchQuery: '',
  datasetKey: 'all',
  layer: 'all',
  originClass: 'all',
  language: 'all',
  validationStatus: 'all',
  excludeSyntheticDemo: false,
};

export function filterSamplesForExport(
  samples: TextSample[],
  filter: SampleExportFilter
): TextSample[] {
  const query = filter.searchQuery.trim().toLowerCase();
  return samples.filter((s) => {
    if (filter.excludeSyntheticDemo && s.is_synthetic_demo) return false;
    if (filter.datasetKey !== 'all' && s.dataset_key !== filter.datasetKey) return false;
    if (filter.layer !== 'all' && s.layer !== filter.layer) return false;
    if (filter.originClass !== 'all' && s.origin.class !== filter.originClass) return false;
    if (filter.language !== 'all' && s.language !== filter.language) return false;
    if (filter.validationStatus !== 'all' && s.validation.status !== filter.validationStatus) {
      return false;
    }
    if (query) {
      const haystack = [
        s.sample_id,
        s.dataset_key,
        s.text,
        s.domain,
        s.writing_type,
        s.author_pseudo_id,
        s.origin.model || '',
        s.dialect || '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function serializeSamplesToCsv(
  samples: TextSample[],
  options?: {
    includeMetadata?: boolean;
    includeBom?: boolean;
  }
): string {
  const includeMetadata = options?.includeMetadata ?? true;
  const includeBom = options?.includeBom ?? true;

  const headers = includeMetadata
    ? [
        'sample_id',
        'dataset_key',
        'text',
        'language',
        'dialect',
        'domain',
        'writing_type',
        'origin_class',
        'origin_model',
        'layer',
        'validation_status',
        'verified',
        'is_synthetic_demo',
        'author_pseudo_id',
        'word_count',
        'char_count',
        'guiraud_r',
        'burstiness_index',
        'license',
        'source',
        'created_at',
      ]
    : [
        'sample_id',
        'text',
        'language',
        'domain',
        'origin_class',
        'origin_model',
        'layer',
        'validation_status',
      ];

  const rows = samples.map((s) => {
    const wordCount =
      s.linguistic_metrics?.word_count ??
      (s.text.trim() ? s.text.trim().split(/\s+/).length : 0);
    const charCount = s.linguistic_metrics?.char_count ?? s.text.length;
    const cells = includeMetadata
      ? [
          s.sample_id,
          s.dataset_key,
          s.text,
          s.language,
          s.dialect ?? '',
          s.domain,
          s.writing_type,
          s.origin.class,
          s.origin.model ?? '',
          s.layer,
          s.validation.status,
          s.validation.verified,
          s.is_synthetic_demo,
          s.author_pseudo_id ?? '',
          wordCount,
          charCount,
          s.linguistic_metrics?.vocabulary.guiraud_r ?? '',
          s.linguistic_metrics?.sentence_structure.burstiness_index ?? '',
          s.provenance.license,
          s.origin.source,
          s.provenance.collection_date,
        ]
      : [
          s.sample_id,
          s.text,
          s.language,
          s.domain,
          s.origin.class,
          s.origin.model ?? '',
          s.layer,
          s.validation.status,
        ];
    return cells.map(escapeCsvCell).join(',');
  });

  const csvBody = [headers.join(','), ...rows].join('\r\n');
  return includeBom ? `\uFEFF${csvBody}` : csvBody;
}

export function buildCsvExportFilename(
  filter: SampleExportFilter,
  now: Date = new Date()
): string {
  const parts = ['textprint-samples'];
  if (filter.layer !== 'all') parts.push(filter.layer);
  if (filter.language !== 'all') parts.push(filter.language);
  if (filter.originClass !== 'all') parts.push(filter.originClass);
  if (filter.validationStatus !== 'all') parts.push(filter.validationStatus);
  parts.push(now.toISOString().slice(0, 10));
  return `${parts.join('-')}.csv`;
}
