import { useState } from 'react';
import { FolderOpen, Search, Upload, Wand2 } from 'lucide-react';
import { compareTexts } from '../engine/comparison';
import { detectLanguageAndDialect } from '../engine/linguistic';
import type {
  CollectionJob,
  DatasetRecord,
  ExternalSource,
  OriginClass,
  TextSample,
} from '../engine/types';
import {
  buildSampleFromImport,
  parseImportedDatasetText,
  validateSampleQuality,
} from '../engine/validation';
import { getInMemoryDriveToken } from '../lib/firebase';

interface Props {
  datasets: DatasetRecord[];
  samples: TextSample[];
  sources: ExternalSource[];
  jobs: CollectionJob[];
  hasDriveToken: boolean;
  onSignIn: () => void;
  onImportSamples: (dataset: DatasetRecord, newSamples: TextSample[]) => void;
  onRunCollectionJob: (jobKey: string) => void;
}

type AcquisitionTab = 'importer' | 'drive' | 'sources' | 'editing_lab' | 'human_portal';

interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

export function DataAcquisitionView({
  datasets,
  samples,
  sources,
  jobs,
  hasDriveToken,
  onSignIn,
  onImportSamples,
  onRunCollectionJob,
}: Props) {
  const [tab, setTab] = useState<AcquisitionTab>('importer');

  // Importer state
  const [format, setFormat] = useState<'csv' | 'json' | 'jsonl' | 'txt' | 'xml'>('jsonl');
  const [targetDatasetName, setTargetDatasetName] = useState('Custom Research Import');
  const [licenseId, setLicenseId] = useState('CC-BY-4.0');
  const [isSyntheticDemo, setIsSyntheticDemo] = useState(false);
  const [rawInput, setRawInput] = useState(
    '{"text":"Field observations across alpine weather stations reveal abrupt wind-shear shifts every twenty minutes, complicating automated averaging scripts.","language":"en","domain":"meteorology","origin_class":"human"}\n{"text":"Furthermore, automated meteorological pipelines consistently standardize sensor readings across distributed observation networks to ensure reliable climate forecasting.","language":"en","domain":"meteorology","origin_class":"ai","model":"gemini-4-hydrogen"}'
  );
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [detectedCols, setDetectedCols] = useState<string[]>([]);

  // Google Drive state
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSearch, setDriveSearch] = useState('');

  // External Source Discovery (Search Grounding)
  const [sourceQuery, setSourceQuery] = useState(
    'open benchmark datasets for Arabic and English AI-generated text stylometry'
  );
  const [discoveryResult, setDiscoveryResult] = useState<{
    summary: string;
    groundingSources: Array<{ uri: string; title: string }>;
  } | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  // Editing & Generation Lab
  const [labDirection, setLabDirection] = useState<'human_to_ai_edited' | 'ai_to_human_edited' | 'ai_generate'>('human_to_ai_edited');
  const [labOriginalText, setLabOriginalText] = useState(
    'When our team checked the municipal water meters after the October storm, half the mechanical dials were fogged up with silt—so we scribbled estimates on waterproof index cards and reconciled them back at the depot.'
  );
  const [labInstruction, setLabInstruction] = useState(
    'Polish into formal academic prose while preserving the core factual details.'
  );
  const [labEditedText, setLabEditedText] = useState('');
  const [labModelUsed, setLabModelUsed] = useState<string | null>(null);
  const [labLoading, setLabLoading] = useState(false);
  const [labError, setLabError] = useState<string | null>(null);

  // Human Writing Portal
  const [humanText, setHumanText] = useState('');
  const [humanDomain, setHumanDomain] = useState('academic');
  const [humanType, setHumanType] = useState('essay');
  const [humanPseudoId, setHumanPseudoId] = useState('AUTH-RES-01');
  const [humanConsent, setHumanConsent] = useState(false);
  const [humanFeedback, setHumanFeedback] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv' || ext === 'json' || ext === 'jsonl' || ext === 'txt' || ext === 'xml') {
      setFormat(ext);
    }
    const content = await file.text();
    setRawInput(content);
    setImportFeedback(`Loaded file "${file.name}" (${content.length} chars). Click Inspect & Import to validate.`);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseImportedDatasetText(rawInput, format);
    setDetectedCols(parsed.detectedColumns);

    if (parsed.errors.length > 0 && parsed.records.length === 0) {
      setImportFeedback(`Import aborted: ${parsed.errors.join(' ')}`);
      return;
    }

    const dsKey = targetDatasetName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `import-${Date.now().toString(36)}`;

    const dataset: DatasetRecord = {
      dataset_key: dsKey,
      name: targetDatasetName.trim() || 'Imported Corpus',
      description: `Imported ${parsed.records.length} record(s) via ${format.toUpperCase()} importer.`,
      layer: 'raw',
      version: '1.0.0',
      license: licenseId.trim() || 'CC-BY-4.0',
      is_synthetic_demo: isSyntheticDemo,
      source_type: `importer_${format}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const existingPlusBatch = [...samples];
    const builtSamples: TextSample[] = [];
    let quarantinedCount = 0;

    parsed.records.forEach((rec, i) => {
      const prefix =
        rec.origin_class === 'human'
          ? 'HUM'
          : rec.origin_class === 'ai'
            ? 'AI'
            : rec.origin_class === 'human_edited_ai'
              ? 'HEA'
              : rec.origin_class === 'ai_edited_human'
                ? 'AEH'
                : 'UNK';
      const sid = `TX-${prefix}-${Date.now().toString(36).toUpperCase().slice(-4)}${String(i + 1).padStart(2, '0')}`;
      const sample = buildSampleFromImport(rec, {
        sampleId: sid,
        datasetKey: dsKey,
        license: dataset.license,
        source: `file_import_${format}`,
        isSyntheticDemo,
      });

      const validation = validateSampleQuality(sample, existingPlusBatch);
      if (!validation.passed) {
        sample.validation.status = 'quarantined';
        sample.validation.validation_notes = validation.issues.map((iss) => iss.message);
        quarantinedCount += 1;
      } else if (validation.issues.length > 0) {
        sample.validation.validation_notes = validation.issues.map((iss) => iss.message);
      }
      builtSamples.push(sample);
      existingPlusBatch.push(sample);
    });

    onImportSamples(dataset, builtSamples);
    setImportFeedback(
      `Imported ${builtSamples.length} sample(s) into RAW layer (${quarantinedCount} flagged for quality review).`
    );
  };

  const handleLoadDriveFiles = async () => {
    const token = getInMemoryDriveToken();
    if (!token) {
      setDriveError('Sign in with Google to authorize Google Drive file browsing.');
      return;
    }
    setDriveLoading(true);
    setDriveError(null);
    try {
      const qParts = ["trashed = false", "(mimeType = 'text/plain' or mimeType = 'text/csv' or mimeType = 'application/json' or mimeType = 'application/vnd.google-apps.document')"];
      if (driveSearch.trim()) {
        const safe = driveSearch.trim().replace(/'/g, "\\'");
        qParts.push(`name contains '${safe}'`);
      }
      const url = `https://www.googleapis.com/drive/v3/files?pageSize=20&fields=files(id,name,mimeType,modifiedTime)&q=${encodeURIComponent(qParts.join(' and '))}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Drive API returned HTTP ${res.status}`);
      }
      const data = await res.json();
      setDriveFiles(data.files || []);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Failed to list Google Drive files.');
    } finally {
      setDriveLoading(false);
    }
  };

  const handleImportDriveFile = async (file: DriveFileItem) => {
    const token = getInMemoryDriveToken();
    if (!token) return;
    setDriveLoading(true);
    setDriveError(null);
    try {
      const isGoogleDoc = file.mimeType === 'application/vnd.google-apps.document';
      const downloadUrl = isGoogleDoc
        ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=text/plain`
        : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`;
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch file content (HTTP ${res.status}).`);
      }
      const text = await res.text();
      const lowerName = file.name.toLowerCase();
      const detectedFmt = lowerName.endsWith('.csv')
        ? 'csv'
        : lowerName.endsWith('.json')
          ? 'json'
          : lowerName.endsWith('.jsonl')
            ? 'jsonl'
            : 'txt';
      setFormat(detectedFmt);
      setTargetDatasetName(`Drive: ${file.name}`);
      setRawInput(text);
      setTab('importer');
      setImportFeedback(`Fetched "${file.name}" from Google Drive. Review schema and click Import to RAW Layer.`);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Failed to read Drive file.');
    } finally {
      setDriveLoading(false);
    }
  };

  const handleDiscoverSources = async () => {
    setDiscoveryLoading(true);
    setDiscoveryError(null);
    try {
      const res = await fetch('/api/ai/discover-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sourceQuery }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Discovery request failed.');
      setDiscoveryResult({
        summary: data.summary,
        groundingSources: data.groundingSources || [],
      });
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : 'Source search failed.');
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const handleRunLabTransform = async () => {
    setLabLoading(true);
    setLabError(null);
    try {
      const res = await fetch('/api/ai/edit-transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: labDirection === 'ai_generate' ? 'generate' : 'edit',
          text: labOriginalText,
          instruction: labInstruction,
          fast: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transformation failed.');
      setLabEditedText(data.outputText || '');
      setLabModelUsed(data.modelUsed || 'gemini-4-hydrogen');
    } catch (err) {
      setLabError(err instanceof Error ? err.message : 'Transformation failed.');
    } finally {
      setLabLoading(false);
    }
  };

  const handleSaveLabExperimentSample = () => {
    if (!labEditedText.trim()) return;
    const isGenerateOnly = labDirection === 'ai_generate';
    const originClass: OriginClass = isGenerateOnly
      ? 'ai'
      : labDirection === 'human_to_ai_edited'
        ? 'ai_edited_human'
        : 'human_edited_ai';

    const cmp = !isGenerateOnly
      ? compareTexts(
          labOriginalText,
          labEditedText,
          labDirection === 'human_to_ai_edited' ? 'ai' : 'human',
          'formalize',
          labModelUsed || 'gemini-4-hydrogen'
        )
      : null;

    const detected = detectLanguageAndDialect(labEditedText);
    const ds: DatasetRecord = datasets.find((d) => d.dataset_key === 'tx-lab-experiments') ?? {
      dataset_key: 'tx-lab-experiments',
      name: 'TEXTPRINT Editing Laboratory Experiments',
      description: 'Controlled paired human/AI editing trajectories captured inside TEXTPRINT.',
      layer: 'processed',
      version: '1.0.0',
      license: 'Research-Internal',
      is_synthetic_demo: false,
      source_type: 'editing_laboratory',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const sample = buildSampleFromImport(
      {
        text: labEditedText,
        language: detected.language,
        domain: 'laboratory_experiment',
        writing_type: 'controlled_draft',
        origin_class: originClass,
        origin_model: labModelUsed || 'gemini-4-hydrogen',
      },
      {
        sampleId: `TX-LAB-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        datasetKey: ds.dataset_key,
        license: ds.license,
        source: 'editing_laboratory',
        isSyntheticDemo: false,
      }
    );
    if (cmp) {
      sample.editing_history.editing_operations = [cmp.extracted_editing_operation];
    }
    sample.layer = 'processed';
    onImportSamples(ds, [sample]);
    setLabError(null);
    setImportFeedback(`Saved ${sample.sample_id} (${originClass}) with editing operation history.`);
  };

  const handleHumanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!humanConsent) {
      setHumanFeedback('Consent checkbox must be confirmed before archiving human writing.');
      return;
    }
    if (humanText.trim().length < 40) {
      setHumanFeedback('Please provide at least 40 characters for statistical validity.');
      return;
    }

    const ds: DatasetRecord = datasets.find((d) => d.dataset_key === 'tx-human-portal') ?? {
      dataset_key: 'tx-human-portal',
      name: 'Consented Human Writing Contributions',
      description: 'Voluntary human writing samples collected with explicit consent and pseudonymous IDs.',
      layer: 'raw',
      version: '1.0.0',
      license: 'Research-Consent-Only',
      is_synthetic_demo: false,
      source_type: 'human_portal',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const sample = buildSampleFromImport(
      {
        text: humanText.trim(),
        domain: humanDomain,
        writing_type: humanType,
        origin_class: 'human',
        origin_model: null,
        author_pseudo_id: humanPseudoId.trim() || 'AUTH-ANON',
      },
      {
        sampleId: `TX-HUM-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        datasetKey: ds.dataset_key,
        license: 'Research-Consent-Only',
        source: 'human_contribution_portal',
        isSyntheticDemo: false,
      }
    );

    onImportSamples(ds, [sample]);
    setHumanText('');
    setHumanConsent(false);
    setHumanFeedback(`Archived ${sample.sample_id} with pseudonymous author ${sample.author_pseudo_id}.`);
  };

  const labComparison =
    labDirection !== 'ai_generate' && labEditedText.trim().length > 0
      ? compareTexts(labOriginalText, labEditedText)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            02. Data Acquisition &amp; Research Center
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Acquire, inspect, validate, and register datasets from local files, Google Drive, external registries, and controlled editing experiments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          {(
            [
              ['importer', 'Dataset Importer'],
              ['drive', 'Google Drive'],
              ['sources', 'Sources & Jobs'],
              ['editing_lab', 'AI & Editing Lab'],
              ['human_portal', 'Human Portal'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tab === id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'importer' && (
        <form
          onSubmit={handleImportSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label
                htmlFor="import-ds-name"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Target Dataset Name
              </label>
              <input
                id="import-ds-name"
                type="text"
                required
                value={targetDatasetName}
                onChange={(e) => setTargetDatasetName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="import-format"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Source Format
              </label>
              <select
                id="import-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
                className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="jsonl">JSONL (Line-delimited)</option>
                <option value="json">JSON Array</option>
                <option value="csv">CSV</option>
                <option value="txt">TXT (Blank-line split)</option>
                <option value="xml">XML (&lt;sample&gt;)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="import-license"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                License Identifier
              </label>
              <input
                id="import-license"
                type="text"
                required
                value={licenseId}
                onChange={(e) => setLicenseId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-y border-slate-100 dark:border-slate-800">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isSyntheticDemo}
                onChange={(e) => setIsSyntheticDemo(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700"
              />
              <span>Label imported records as Synthetic Demonstration Data</span>
            </label>

            <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Load File (.csv, .json, .jsonl, .txt, .xml)</span>
              <input
                type="file"
                accept=".csv,.json,.jsonl,.txt,.xml"
                onChange={handleFileUpload}
                className="sr-only"
              />
            </label>
          </div>

          <div>
            <label
              htmlFor="import-raw-payload"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Dataset Payload (Schema Inspection &amp; Extraction)
            </label>
            <textarea
              id="import-raw-payload"
              rows={7}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>

          {detectedCols.length > 0 && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Detected schema fields:{' '}
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {detectedCols.join(' · ')}
              </span>
            </p>
          )}

          {importFeedback && (
            <p className="text-xs font-medium text-sky-700 dark:text-sky-400">{importFeedback}</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors"
            >
              Inspect &amp; Import to RAW Layer
            </button>
          </div>
        </form>
      )}

      {tab === 'drive' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Google Drive Corpus Browser
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Import `.txt`, `.csv`, `.json`, `.jsonl`, or Google Docs directly into TEXTPRINT with user permission.
              </p>
            </div>
            {!hasDriveToken ? (
              <button
                type="button"
                onClick={onSignIn}
                className="px-4 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors whitespace-nowrap"
              >
                Authorize Google Drive
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={driveSearch}
                  onChange={(e) => setDriveSearch(e.target.value)}
                  placeholder="Filter Drive filename..."
                  aria-label="Filter Drive filename"
                  className="px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleLoadDriveFiles}
                  disabled={driveLoading}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {driveLoading ? 'Loading...' : 'List Drive Files'}
                </button>
              </div>
            )}
          </div>

          {driveError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{driveError}</p>
          )}

          {driveFiles.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-md">
              <FolderOpen className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {hasDriveToken
                  ? 'Click "List Drive Files" to browse compatible corpus documents in your Google Drive.'
                  : 'Connect your Google account above to access Google Drive corpora.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-4 font-medium">File Name</th>
                    <th className="py-2 pr-4 font-medium">MIME Type</th>
                    <th className="py-2 pr-4 font-medium">Modified</th>
                    <th className="py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {driveFiles.map((f) => (
                    <tr key={f.id}>
                      <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-slate-100">
                        {f.name}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-slate-500 dark:text-slate-400">
                        {f.mimeType}
                      </td>
                      <td className="py-2.5 pr-4 font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {f.modifiedTime ? f.modifiedTime.slice(0, 10) : '—'}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleImportDriveFile(f)}
                          className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
                        >
                          Fetch to Importer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'sources' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  External Research Sources Registry
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Licensed academic corpora and benchmarks. Automated downloads strictly respect licensing and access terms.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-4 font-medium">Source</th>
                    <th className="py-2 pr-4 font-medium">Format · Lang</th>
                    <th className="py-2 pr-4 font-medium">License</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium">Reliability Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sources.map((src) => (
                    <tr key={src.source_key}>
                      <td className="py-3 pr-4 align-top">
                        <a
                          href={src.official_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-sky-700 dark:text-sky-400 hover:underline"
                        >
                          {src.name}
                        </a>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5 max-w-xs">
                          {src.description}
                        </p>
                      </td>
                      <td className="py-3 pr-4 align-top font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {src.data_format} · {src.language}
                      </td>
                      <td className="py-3 pr-4 align-top text-slate-700 dark:text-slate-300">
                        {src.license}
                      </td>
                      <td className="py-3 pr-4 align-top font-mono text-slate-700 dark:text-slate-300">
                        {src.status}
                      </td>
                      <td className="py-3 align-top text-slate-600 dark:text-slate-400 max-w-sm">
                        {src.reliability_notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Google Search Grounded Discovery */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <label
                htmlFor="discover-sources-query"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Discover Public Corpora via Google Search Grounding
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="discover-sources-query"
                  type="text"
                  value={sourceQuery}
                  onChange={(e) => setSourceQuery(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleDiscoverSources}
                  disabled={discoveryLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{discoveryLoading ? 'Searching...' : 'Search Verified Corpora'}</span>
                </button>
              </div>
              {discoveryError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{discoveryError}</p>
              )}
              {discoveryResult && (
                <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200 leading-relaxed">
                    {discoveryResult.summary}
                  </p>
                  {discoveryResult.groundingSources.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                      <p className="font-medium text-slate-700 dark:text-slate-300">
                        Grounded References:
                      </p>
                      <ul className="space-y-1">
                        {discoveryResult.groundingSources.map((s) => (
                          <li key={s.uri}>
                            <a
                              href={s.uri}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-700 dark:text-sky-400 hover:underline break-all"
                            >
                              {s.title || s.uri}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Scheduled Collection &amp; Validation Jobs
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-4 font-medium">Job</th>
                    <th className="py-2 pr-4 font-medium">Method · Cron</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Next Run</th>
                    <th className="py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {jobs.map((job) => (
                    <tr key={job.job_key}>
                      <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-slate-100">
                        {job.source_name}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-slate-600 dark:text-slate-400">
                        {job.collection_method} · {job.schedule_cron}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-slate-700 dark:text-slate-300">
                        {job.execution_status} ({job.imported_records} ok / {job.failed_records} err)
                      </td>
                      <td className="py-2.5 pr-4 font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {job.next_execution.slice(0, 16).replace('T', ' ')}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => onRunCollectionJob(job.job_key)}
                          className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
                        >
                          Trigger Audit Check
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'editing_lab' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Controlled AI Generation &amp; Human-AI Editing Laboratory
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Record original drafts, apply controlled AI edits or human revisions, extract editing operations, and store provenance.
              </p>
            </div>
            <select
              aria-label="Laboratory workflow mode"
              value={labDirection}
              onChange={(e) => setLabDirection(e.target.value as typeof labDirection)}
              className="px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="human_to_ai_edited">Human Writing → AI Editing</option>
              <option value="ai_to_human_edited">AI Writing → Human Editing</option>
              <option value="ai_generate">Controlled AI Generation</option>
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label
                htmlFor="lab-original"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {labDirection === 'ai_generate' ? 'Prompt / Topic Specification' : 'Original Passage'}
              </label>
              <textarea
                id="lab-original"
                rows={6}
                value={labDirection === 'ai_generate' ? labInstruction : labOriginalText}
                onChange={(e) =>
                  labDirection === 'ai_generate'
                    ? setLabInstruction(e.target.value)
                    : setLabOriginalText(e.target.value)
                }
                className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              {labDirection !== 'ai_generate' && (
                <div>
                  <label
                    htmlFor="lab-instruction"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Editing Transformation Directive
                  </label>
                  <input
                    id="lab-instruction"
                    type="text"
                    value={labInstruction}
                    onChange={(e) => setLabInstruction(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="lab-edited"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Resulting Passage (Editable for Human Post-Editing)
              </label>
              <textarea
                id="lab-edited"
                rows={8}
                value={labEditedText}
                onChange={(e) => setLabEditedText(e.target.value)}
                placeholder="Click Run AI Transformation or paste/edit human revisions directly..."
                className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {labError && <p className="text-xs text-rose-600 dark:text-rose-400">{labError}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunLabTransform}
                disabled={labLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>{labLoading ? 'Generating...' : 'Run Gemini Transformation'}</span>
              </button>
              <button
                type="button"
                onClick={handleSaveLabExperimentSample}
                disabled={!labEditedText.trim()}
                className="px-4 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                Archive Experiment Sample
              </button>
            </div>
            {labModelUsed && (
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Model: {labModelUsed}
              </span>
            )}
          </div>

          {labComparison && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Insertions / Deletions</span>
                <p className="font-mono text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  +{labComparison.extracted_editing_operation.insertions} / -
                  {labComparison.extracted_editing_operation.deletions} words
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Lexical Shift Ratio</span>
                <p className="font-mono text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {(labComparison.extracted_editing_operation.lexicalShiftRatio * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Burstiness Delta</span>
                <p className="font-mono text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {labComparison.deltas.burstiness_delta >= 0 ? '+' : ''}
                  {labComparison.deltas.burstiness_delta}
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Transition Delta</span>
                <p className="font-mono text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {labComparison.deltas.transition_density_delta >= 0 ? '+' : ''}
                  {labComparison.deltas.transition_density_delta}/100w
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'human_portal' && (
        <form
          onSubmit={handleHumanSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Human Writing Contribution &amp; Consent Portal
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Collects voluntary human-authored passages using pseudonymous author identifiers and explicit research consent.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="hum-pseudo"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Pseudonymous Author ID
              </label>
              <input
                id="hum-pseudo"
                type="text"
                value={humanPseudoId}
                onChange={(e) => setHumanPseudoId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label
                htmlFor="hum-domain"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Domain
              </label>
              <input
                id="hum-domain"
                type="text"
                value={humanDomain}
                onChange={(e) => setHumanDomain(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label
                htmlFor="hum-type"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Writing Type
              </label>
              <input
                id="hum-type"
                type="text"
                value={humanType}
                onChange={(e) => setHumanType(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="hum-text"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Original Human-Written Passage (English or Arabic)
            </label>
            <textarea
              id="hum-text"
              rows={6}
              dir="auto"
              value={humanText}
              onChange={(e) => setHumanText(e.target.value)}
              placeholder="Paste or type original human-authored text..."
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={humanConsent}
              onChange={(e) => setHumanConsent(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 dark:border-slate-700"
            />
            <span>
              I confirm this passage is human-written without undisclosed AI generation and consent to pseudonymous stylometric research storage.
            </span>
          </label>

          {humanFeedback && (
            <p className="text-xs font-medium text-sky-700 dark:text-sky-400">{humanFeedback}</p>
          )}

          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors"
          >
            Submit Consented Sample
          </button>
        </form>
      )}
    </div>
  );
}
