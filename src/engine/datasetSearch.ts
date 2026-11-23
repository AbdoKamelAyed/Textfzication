import type {
  DatasetRecord,
  OriginClass,
  StorageLayer,
  TextSample,
  ValidationStatus,
} from './types';

export type SearchScope = 'all' | 'id' | 'provenance' | 'content';

export interface DatasetManagementFilter {
  query: string;
  scope: SearchScope;
  layer: 'all' | StorageLayer;
  datasetKey: string;
  originClass: 'all' | OriginClass;
  language: 'all' | 'en' | 'ar' | 'mixed';
  validationStatus: 'all' | ValidationStatus;
}

export const DEFAULT_DATASET_FILTER: DatasetManagementFilter = {
  query: '',
  scope: 'all',
  layer: 'all',
  datasetKey: 'all',
  originClass: 'all',
  language: 'all',
  validationStatus: 'all',
};

export function hasActiveDatasetFilters(filter: DatasetManagementFilter): boolean {
  return Boolean(
    filter.query.trim() ||
      filter.scope !== 'all' ||
      filter.layer !== 'all' ||
      filter.datasetKey !== 'all' ||
      filter.originClass !== 'all' ||
      filter.language !== 'all' ||
      filter.validationStatus !== 'all'
  );
}

export function filterDatasetManagementSamples(
  samples: TextSample[],
  datasets: DatasetRecord[],
  filter: DatasetManagementFilter
): TextSample[] {
  const datasetLookup = new Map(datasets.map((d) => [d.dataset_key, d]));
  const tokens = filter.query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return samples.filter((s) => {
    if (filter.layer !== 'all' && s.layer !== filter.layer) return false;
    if (filter.datasetKey !== 'all' && s.dataset_key !== filter.datasetKey) return false;
    if (filter.originClass !== 'all' && s.origin.class !== filter.originClass) return false;
    if (filter.language !== 'all' && s.language !== filter.language) return false;
    if (filter.validationStatus !== 'all' && s.validation.status !== filter.validationStatus) {
      return false;
    }

    if (tokens.length === 0) return true;

    const ds = datasetLookup.get(s.dataset_key);
    const idHaystack = `${s.sample_id} ${s.content_hash}`.toLowerCase();
    const provenanceHaystack = [
      s.dataset_key,
      ds?.name ?? '',
      ds?.source_type ?? '',
      s.provenance.dataset,
      s.provenance.license,
      s.provenance.collection_date,
      s.origin.source,
      s.origin.model ?? '',
      s.origin.model_version ?? '',
      s.author_pseudo_id ?? '',
      s.dataset_version,
    ]
      .join(' ')
      .toLowerCase();
    const contentHaystack = [
      s.text,
      s.normalized_text,
      s.domain,
      s.writing_type,
      s.language,
      s.dialect ?? '',
    ]
      .join(' ')
      .toLowerCase();

    const targetHaystack =
      filter.scope === 'id'
        ? idHaystack
        : filter.scope === 'provenance'
          ? provenanceHaystack
          : filter.scope === 'content'
            ? contentHaystack
            : `${idHaystack} ${provenanceHaystack} ${contentHaystack}`;

    return tokens.every((tok) => targetHaystack.includes(tok));
  });
}
