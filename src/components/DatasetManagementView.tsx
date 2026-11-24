import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, RotateCcw, Search, ShieldAlert, X } from 'lucide-react';
import {
  BULK_VALIDATION_POLICIES,
  getFilteredSelectionStats,
  pruneSelectionToExisting,
  toggleSelectAllFiltered,
  toggleSampleSelection,
} from '../engine/bulkValidation';
import {
  DEFAULT_DATASET_FILTER,
  filterDatasetManagementSamples,
  hasActiveDatasetFilters,
  type DatasetManagementFilter,
  type SearchScope,
} from '../engine/datasetSearch';
import type {
  DatasetRecord,
  OriginClass,
  StorageLayer,
  TextSample,
  ValidationStatus,
} from '../engine/types';
import { validateSampleQuality } from '../engine/validation';
import { useI18n } from '../lib/i18nContext';

interface Props {
  datasets: DatasetRecord[];
  samples: TextSample[];
  onValidateSample: (sampleId: string, status: ValidationStatus, layer: StorageLayer, note: string) => void;
  onBulkValidateSamples?: (sampleIds: string[], status: ValidationStatus, layer: StorageLayer, note: string) => void;
}

function getStatusToneClass(status: ValidationStatus): string {
  if (status === 'verified') return 'text-emerald-700 dark:text-emerald-400';
  if (status === 'quarantined') return 'text-amber-700 dark:text-amber-400';
  if (status === 'rejected') return 'text-rose-700 dark:text-rose-400';
  return 'text-slate-500 dark:text-slate-400';
}

export function DatasetManagementView({
  datasets,
  samples,
  onValidateSample,
  onBulkValidateSamples,
}: Props) {
  const { lang } = useI18n();
  const isAr = lang === 'ar';
  const [filter, setFilter] = useState<DatasetManagementFilter>(DEFAULT_DATASET_FILTER);
  const [selectedId, setSelectedId] = useState<string>(samples[0]?.sample_id ?? '');
  const [selectedSampleIds, setSelectedSampleIds] = useState<Set<string>>(() => new Set());
  const [bulkNote, setBulkNote] = useState('');
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);
  const [forceRtl, setForceRtl] = useState(false);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(
    () => filterDatasetManagementSamples(samples, datasets, filter),
    [samples, datasets, filter]
  );

  const activeSelection = useMemo(
    () => pruneSelectionToExisting(selectedSampleIds, samples),
    [selectedSampleIds, samples]
  );

  const selectionStats = useMemo(
    () => getFilteredSelectionStats(activeSelection, filtered),
    [activeSelection, filtered]
  );

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectionStats.someVisibleSelected;
    }
  }, [selectionStats.someVisibleSelected]);

  const filtersActive = hasActiveDatasetFilters(filter);
  const selected = filtered.find((s) => s.sample_id === selectedId) ?? filtered[0] ?? null;
  const qualityReport = selected ? validateSampleQuality(selected, samples) : null;

  const handleBulkAction = (status: ValidationStatus) => {
    const targetIds = Array.from(activeSelection);
    if (targetIds.length === 0) return;

    const policy = BULK_VALIDATION_POLICIES[status];
    const resolvedNote = bulkNote.trim() || policy.defaultNote;

    if (onBulkValidateSamples) {
      onBulkValidateSamples(targetIds, status, policy.defaultLayer, resolvedNote);
    } else {
      for (const id of targetIds) {
        onValidateSample(id, status, policy.defaultLayer, resolvedNote);
      }
    }

    setSelectedSampleIds(new Set());
    setBulkNote('');
    setBulkFeedback(
      `Updated ${targetIds.length} sample(s) to ${status} (${policy.defaultLayer} layer).`
    );
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 break-words">
            {isAr
              ? '03. إدارة المدونات وحوكمة الجودة'
              : '03. Dataset Management & Quality Governance'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 break-words">
            {isAr
              ? 'فصل الطبقات الخام والمعالَجة والمعتمدة مع فحوصات التكرار والتلوث والترميز واتساق التسميات.'
              : 'Separate Raw, Processed, and Approved layers with duplicate, contamination, encoding, and label consistency checks.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-full shrink-0">
          {(['all', 'raw', 'processed', 'approved'] as const).map((layer) => (
            <button
              key={layer}
              type="button"
              onClick={() => setFilter((prev) => ({ ...prev, layer }))}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
                filter.layer === layer
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {layer === 'all' ? `${isAr ? 'الكل' : 'All'} (${samples.length})` : `${layer} (${samples.filter((s) => s.layer === layer).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Global Search & Filter Bar */}
      <section
        aria-label="Global sample search and filter bar"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 min-w-0"
      >
        <div className="flex flex-col sm:flex-row gap-2.5 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search
              aria-hidden="true"
              className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={filter.query}
              onChange={(e) => setFilter((prev) => ({ ...prev, query: e.target.value }))}
              placeholder={
                isAr
                  ? 'ابحث بمعرّف العينة (TX-...) أو المصدر أو النموذج أو كلمة من النص...'
                  : 'Search by sample ID (TX-...), provenance (dataset, license, source, model, author), or content keyword...'
              }
              aria-label="Global search by ID, provenance, or content keyword"
              className="w-full ps-9 pe-8 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
            {filter.query && (
              <button
                type="button"
                aria-label="Clear search query"
                onClick={() => setFilter((prev) => ({ ...prev, query: '' }))}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            aria-label="Search scope"
            value={filter.scope}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, scope: e.target.value as SearchScope }))
            }
            className="sm:w-52 shrink-0 px-2.5 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          >
            <option value="all">Scope: All Fields</option>
            <option value="id">Scope: Sample ID / Hash</option>
            <option value="provenance">Scope: Provenance</option>
            <option value="content">Scope: Content Keyword</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <select
            aria-label="Filter by dataset"
            value={filter.datasetKey}
            onChange={(e) => setFilter((prev) => ({ ...prev, datasetKey: e.target.value }))}
            className="w-full min-w-0 px-2.5 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          >
            <option value="all">All Datasets</option>
            {datasets.map((ds) => (
              <option key={ds.dataset_key} value={ds.dataset_key}>
                {ds.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by origin class"
            value={filter.originClass}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                originClass: e.target.value as 'all' | OriginClass,
              }))
            }
            className="w-full min-w-0 px-2.5 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          >
            <option value="all">All Origins</option>
            <option value="human">Human</option>
            <option value="ai">AI-Generated</option>
            <option value="human_edited_ai">Human-Edited AI</option>
            <option value="ai_edited_human">AI-Edited Human</option>
            <option value="mixed">Mixed-Origin</option>
            <option value="unknown">Unknown</option>
          </select>

          <select
            aria-label="Filter by language"
            value={filter.language}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                language: e.target.value as 'all' | 'en' | 'ar' | 'mixed',
              }))
            }
            className="w-full min-w-0 px-2.5 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          >
            <option value="all">All Languages</option>
            <option value="en">English (EN)</option>
            <option value="ar">Arabic (AR)</option>
            <option value="mixed">Mixed</option>
          </select>

          <select
            aria-label="Filter by validation status"
            value={filter.validationStatus}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                validationStatus: e.target.value as 'all' | ValidationStatus,
              }))
            }
            className="w-full min-w-0 px-2.5 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          >
            <option value="all">All Validation</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="quarantined">Quarantined</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-mono tabular-nums">
            Showing {filtered.length} of {samples.length} sample(s)
          </span>
          {filtersActive && (
            <button
              type="button"
              onClick={() => setFilter(DEFAULT_DATASET_FILTER)}
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>
      </section>

      {/* Dataset Catalog Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Registered Datasets
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-4 font-medium">Dataset Key</th>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Layer · Version</th>
                <th className="py-2 pr-4 font-medium">License</th>
                <th className="py-2 text-right font-medium">
                  {filtersActive ? 'Matched / Total' : 'Records'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {datasets.map((ds) => {
                const totalCount = samples.filter((s) => s.dataset_key === ds.dataset_key).length;
                const matchedCount = filtered.filter((s) => s.dataset_key === ds.dataset_key).length;
                return (
                  <tr key={ds.dataset_key}>
                    <td className="py-2 pr-4 font-mono text-slate-800 dark:text-slate-200">
                      <button
                        type="button"
                        onClick={() =>
                          setFilter((prev) => ({
                            ...prev,
                            datasetKey:
                              prev.datasetKey === ds.dataset_key ? 'all' : ds.dataset_key,
                          }))
                        }
                        className="hover:underline text-left"
                      >
                        {ds.dataset_key}
                      </button>
                    </td>
                    <td className="py-2 pr-4 text-slate-900 dark:text-slate-100">
                      {ds.name}
                      {ds.is_synthetic_demo && (
                        <span className="ml-2 text-[11px] font-mono text-amber-700 dark:text-amber-400">
                          [Synthetic Demo]
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-mono text-slate-600 dark:text-slate-400">
                      {ds.layer} · v{ds.version}
                    </td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-400">{ds.license}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {filtersActive ? `${matchedCount} / ${totalCount}` : totalCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Selection & Validation Actions */}
      {(selectionStats.totalSelected > 0 || bulkFeedback) && (
        <section
          aria-label="Bulk sample validation actions"
          className="bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg p-4 space-y-3"
        >
          {bulkFeedback && (
            <div
              role="status"
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200"
            >
              <span>{bulkFeedback}</span>
              <button
                type="button"
                aria-label="Dismiss bulk action status"
                onClick={() => setBulkFeedback(null)}
                className="text-emerald-700 dark:text-emerald-300 hover:opacity-75"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {selectionStats.totalSelected > 0 && (
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-semibold text-sky-900 dark:text-sky-100">
                    {selectionStats.totalSelected} sample(s) selected
                  </span>
                  {selectionStats.hiddenSelected > 0 && (
                    <span className="text-[11px] font-mono text-amber-700 dark:text-amber-300">
                      ({selectionStats.hiddenSelected} outside current filter)
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSampleIds(new Set())}
                  className="self-start sm:self-auto text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline"
                >
                  Clear Selection
                </button>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
                <input
                  type="text"
                  value={bulkNote}
                  onChange={(e) => setBulkNote(e.target.value)}
                  placeholder="Optional bulk audit note (applies to all selected samples)..."
                  aria-label="Bulk validation note"
                  className="flex-1 min-w-0 px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleBulkAction('verified')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark Verified</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAction('quarantined')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Quarantine</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAction('rejected')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAction('pending')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Mark Pending</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Sample Browser + Inspector Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={selectionStats.allVisibleSelected}
                  disabled={filtered.length === 0}
                  onChange={() => {
                    setBulkFeedback(null);
                    setSelectedSampleIds((prev) => toggleSelectAllFiltered(prev, filtered));
                  }}
                  aria-label="Select all filtered samples"
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-sky-500 cursor-pointer disabled:opacity-40"
                />
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {isAr ? `دليل العينات (${filtered.length})` : `Sample Directory (${filtered.length})`}
                </span>
              </label>
            </div>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {selectionStats.totalSelected > 0
                ? `${selectionStats.totalSelected} selected · Scope: ${filter.scope}`
                : `Scope: ${filter.scope}`}
            </span>
          </div>

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              {isAr
                ? 'لا توجد عينات تطابق معايير البحث والترشيح الحالية.'
                : 'No samples match the current global search and filter criteria.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[540px] overflow-y-auto">
              {filtered.map((s) => {
                const isSelected = selected?.sample_id === s.sample_id;
                const isChecked = activeSelection.has(s.sample_id);
                return (
                  <div
                    key={s.sample_id}
                    className={`flex items-start gap-3 p-3 transition-colors min-w-0 ${
                      isSelected
                        ? 'bg-sky-50 dark:bg-sky-950/40'
                        : isChecked
                          ? 'bg-slate-50 dark:bg-slate-800/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setBulkFeedback(null);
                        setSelectedSampleIds((prev) => toggleSampleSelection(prev, s.sample_id));
                      }}
                      aria-label={`Select sample ${s.sample_id}`}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.sample_id)}
                      className="flex-1 min-w-0 text-start"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 break-all">
                          {s.sample_id}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {s.language.toUpperCase()} · {s.origin.class} ·{' '}
                          <span className={getStatusToneClass(s.validation.status)}>
                            {s.validation.status}
                          </span>
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                        {s.dataset_key} · {s.provenance.license} · {s.origin.source}
                        {s.origin.model ? ` (${s.origin.model})` : ''}
                      </p>
                      <p
                        dir={s.language === 'ar' ? 'rtl' : 'ltr'}
                        className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 break-words"
                      >
                        {s.text}
                      </p>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          {!selected ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a sample from the list to inspect its metadata, quality report, and text.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {selected.sample_id}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selected.domain} · {selected.writing_type} · {selected.layer} layer ·{' '}
                    {selected.is_synthetic_demo ? 'Synthetic Demo' : 'Research Record'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForceRtl((v) => !v)}
                  className="px-2.5 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {forceRtl || selected.language === 'ar' ? 'RTL Active' : 'LTR (Toggle RTL)'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-md bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-[11px] font-mono">
                <span className="text-slate-600 dark:text-slate-400 truncate">
                  Dataset: <strong className="text-slate-900 dark:text-slate-100">{selected.dataset_key}</strong>
                </span>
                <span className="text-slate-600 dark:text-slate-400 truncate">
                  License: <strong className="text-slate-900 dark:text-slate-100">{selected.provenance.license}</strong>
                </span>
                <span className="text-slate-600 dark:text-slate-400 truncate">
                  Source: <strong className="text-slate-900 dark:text-slate-100">{selected.origin.source}</strong>
                </span>
                <span className="text-slate-600 dark:text-slate-400 truncate">
                  Author/Model:{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {selected.origin.model || selected.author_pseudo_id || 'Unspecified'}
                  </strong>
                </span>
              </div>

              <div
                dir={forceRtl || selected.language === 'ar' ? 'rtl' : 'ltr'}
                className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 leading-relaxed"
              >
                {selected.text}
              </div>

              {qualityReport && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Automated Quality Audit
                    </span>
                    <span
                      className={`font-mono ${
                        qualityReport.passed
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {qualityReport.passed ? 'Checks Passed' : 'Attention Required'}
                    </span>
                  </div>
                  {qualityReport.issues.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No duplicate hashes, encoding errors, language mismatches, or label inconsistencies detected.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {qualityReport.issues.map((iss, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>
                            <strong className="font-mono">{iss.code}:</strong> {iss.message}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    onValidateSample(
                      selected.sample_id,
                      'verified',
                      'approved',
                      'Verified and promoted to APPROVED layer by researcher.'
                    )
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Verify &amp; Approve</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onValidateSample(
                      selected.sample_id,
                      'rejected',
                      'raw',
                      'Rejected during manual quality audit.'
                    )
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reject Record</span>
                </button>
              </div>

              <details className="text-xs">
                <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  Inspect Canonical Sample JSON Schema
                </summary>
                <pre className="mt-2 p-3 rounded bg-slate-100 dark:bg-slate-950 text-[11px] font-mono text-slate-800 dark:text-slate-200 overflow-x-auto max-h-56">
                  {JSON.stringify(
                    {
                      ...selected,
                      linguistic_metrics: selected.linguistic_metrics
                        ? '(computed metrics attached)'
                        : undefined,
                    },
                    null,
                    2
                  )}
                </pre>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
