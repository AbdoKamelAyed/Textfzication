import { useState } from 'react';
import { Check, ShieldAlert, X } from 'lucide-react';
import type { DatasetRecord, StorageLayer, TextSample, ValidationStatus } from '../engine/types';
import { validateSampleQuality } from '../engine/validation';

interface Props {
  datasets: DatasetRecord[];
  samples: TextSample[];
  onValidateSample: (sampleId: string, status: ValidationStatus, layer: StorageLayer, note: string) => void;
}

export function DatasetManagementView({ datasets, samples, onValidateSample }: Props) {
  const [layerFilter, setLayerFilter] = useState<'all' | StorageLayer>('all');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string>(samples[0]?.sample_id ?? '');
  const [forceRtl, setForceRtl] = useState(false);

  const filtered = samples.filter((s) => {
    if (layerFilter !== 'all' && s.layer !== layerFilter) return false;
    if (originFilter !== 'all' && s.origin.class !== originFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        s.sample_id.toLowerCase().includes(q) ||
        s.text.toLowerCase().includes(q) ||
        s.domain.toLowerCase().includes(q) ||
        s.language.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selected = samples.find((s) => s.sample_id === selectedId) ?? filtered[0] ?? null;
  const qualityReport = selected ? validateSampleQuality(selected, samples) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            03. Dataset Management &amp; Quality Governance
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Separate Raw, Processed, and Approved layers with duplicate, contamination, encoding, and label consistency checks.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          {(['all', 'raw', 'processed', 'approved'] as const).map((layer) => (
            <button
              key={layer}
              type="button"
              onClick={() => setLayerFilter(layer)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
                layerFilter === layer
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {layer === 'all' ? `All (${samples.length})` : `${layer} (${samples.filter((s) => s.layer === layer).length})`}
            </button>
          ))}
        </div>
      </div>

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
                <th className="py-2 text-right font-medium">Records</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {datasets.map((ds) => {
                const count = samples.filter((s) => s.dataset_key === ds.dataset_key).length;
                return (
                  <tr key={ds.dataset_key}>
                    <td className="py-2 pr-4 font-mono text-slate-800 dark:text-slate-200">
                      {ds.dataset_key}
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
                      {count}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sample Browser + Inspector Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search sample ID, text, domain, language..."
              aria-label="Search corpus samples"
              className="flex-1 px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
            <select
              aria-label="Filter by origin class"
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Origins</option>
              <option value="human">Human</option>
              <option value="ai">AI-Generated</option>
              <option value="human_edited_ai">Human-Edited AI</option>
              <option value="ai_edited_human">AI-Edited Human</option>
              <option value="mixed">Mixed-Origin</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No samples match the current layer and origin filters.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[540px] overflow-y-auto">
              {filtered.map((s) => {
                const isSelected = selected?.sample_id === s.sample_id;
                return (
                  <button
                    key={s.sample_id}
                    type="button"
                    onClick={() => setSelectedId(s.sample_id)}
                    className={`w-full text-left p-3 transition-colors ${
                      isSelected
                        ? 'bg-sky-50 dark:bg-sky-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {s.sample_id}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {s.language.toUpperCase()} · {s.origin.class} · {s.validation.status}
                      </span>
                    </div>
                    <p
                      dir={s.language === 'ar' ? 'rtl' : 'ltr'}
                      className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2"
                    >
                      {s.text}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
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
