import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  BookmarkPlus,
  Download,
  ExternalLink,
  FileText,
  Printer,
  Send,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { CLASSIFIER_VERSION } from '../engine/classifier';
import { buildStylometricProfiles } from '../engine/comparison';
import { LINGUISTIC_ENGINE_VERSION } from '../engine/linguistic';
import type {
  DatasetRecord,
  ExperimentRecord,
  TextSample,
  WritingPattern,
} from '../engine/types';
import {
  getInMemoryDriveToken,
  listUserNotesFromFirestore,
  saveResearchNoteToFirestore,
} from '../lib/firebase';

interface Props {
  initialSubView: 'reports' | 'copilot';
  datasets: DatasetRecord[];
  samples: TextSample[];
  patterns: WritingPattern[];
  experiments: ExperimentRecord[];
  user: User | null;
  hasDriveToken: boolean;
  onSignIn: () => void;
  onLogAudit: (action: string, targetType: string, targetId: string, details: string) => void;
}

type ReportType =
  | 'dataset_quality'
  | 'pattern_analysis'
  | 'stylometric_profiles'
  | 'evaluation_experiments';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  groundingSources?: Array<{ uri: string; title: string }>;
  timestamp: string;
}

interface SavedNote {
  noteId: string;
  title: string;
  content: string;
  tags?: string[];
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ReportsAndCopilotView({
  initialSubView,
  datasets,
  samples,
  patterns,
  experiments,
  user,
  hasDriveToken,
  onSignIn,
  onLogAudit,
}: Props) {
  const [subView, setSubView] = useState<'reports' | 'copilot'>(initialSubView);
  const [reportType, setReportType] = useState<ReportType>('dataset_quality');
  const [driveConfirmOpen, setDriveConfirmOpen] = useState(false);
  const [driveUploading, setDriveUploading] = useState(false);
  const [driveStatus, setDriveStatus] = useState<string | null>(null);

  // Copilot state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text:
        'TEXTPRINT Research Copilot ready. Ask about English or Arabic (MSA / Egyptian) stylometry, human-AI co-editing signatures, calibration metrics (ECE / ROC-AUC), or enable Google Search Grounding for live literature and dataset references.',
      modelUsed: 'gemini-4-hydrogen',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatMode, setChatMode] = useState<'standard' | 'deep' | 'fast'>('standard');
  const [useSearch, setUseSearch] = useState(false);
  const [includeCorpusContext, setIncludeCorpusContext] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [noteStatus, setNoteStatus] = useState<string | null>(null);

  useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);

  useEffect(() => {
    if (!user) {
      setSavedNotes([]);
      return;
    }
    listUserNotesFromFirestore(user)
      .then((notes) => {
        setSavedNotes((notes as SavedNote[]) || []);
      })
      .catch(() => {
        // Ignore if index or notes collection has no documents yet
      });
  }, [user]);

  const stylometricProfiles = useMemo(
    () => buildStylometricProfiles(samples),
    [samples]
  );

  const generatedTimestamp = useMemo(() => new Date().toISOString(), [datasets, samples, patterns, experiments, reportType]);

  const reportPayload = useMemo(() => {
    const datasetVersions = datasets.map((d) => `${d.dataset_key}@v${d.version}`);
    const containsSyntheticDemo = samples.some((s) => s.is_synthetic_demo);

    const baseMeta = {
      platform: 'TEXTPRINT Writing Intelligence Laboratory',
      report_type: reportType,
      generated_at: generatedTimestamp,
      linguistic_engine_version: LINGUISTIC_ENGINE_VERSION,
      classifier_version: CLASSIFIER_VERSION,
      dataset_versions: datasetVersions,
      contains_synthetic_demo_records: containsSyntheticDemo,
      scientific_disclaimer:
        'All authorship probabilities and stylometric markers are empirical indicators, not absolute proof of origin.',
    };

    if (reportType === 'dataset_quality') {
      return {
        ...baseMeta,
        title: 'Dataset Quality & Corpus Governance Report',
        summary: {
          total_datasets: datasets.length,
          total_samples: samples.length,
          research_samples: samples.filter((s) => !s.is_synthetic_demo).length,
          synthetic_demo_samples: samples.filter((s) => s.is_synthetic_demo).length,
          verified_samples: samples.filter((s) => s.validation.verified).length,
          pending_samples: samples.filter((s) => s.validation.status === 'pending').length,
          quarantined_or_rejected: samples.filter(
            (s) => s.validation.status === 'quarantined' || s.validation.status === 'rejected'
          ).length,
        },
        rows: samples.map((s) => ({
          sample_id: s.sample_id,
          dataset_key: s.dataset_key,
          layer: s.layer,
          language: s.language,
          dialect: s.dialect || 'standard',
          origin_class: s.origin.class,
          validation_status: s.validation.status,
          is_synthetic_demo: s.is_synthetic_demo,
          word_count: s.linguistic_metrics?.word_count ?? 0,
        })),
      };
    }

    if (reportType === 'pattern_analysis') {
      return {
        ...baseMeta,
        title: 'Writing Pattern Discovery & Validation Report',
        summary: {
          total_patterns: patterns.length,
          approved: patterns.filter((p) => p.validation_status === 'approved').length,
          statistically_supported: patterns.filter(
            (p) => p.validation_status === 'statistically_supported'
          ).length,
          hypothesis: patterns.filter((p) => p.validation_status === 'hypothesis').length,
          observed: patterns.filter((p) => p.validation_status === 'observed').length,
        },
        rows: patterns.map((p) => ({
          pattern_id: p.pattern_id,
          title: p.title,
          category: p.category,
          validation_status: p.validation_status,
          confidence: p.confidence,
          frequency: p.frequency,
          discovery_method: p.discovery_method,
        })),
      };
    }

    if (reportType === 'stylometric_profiles') {
      return {
        ...baseMeta,
        title: 'Stylometric Fingerprints & Consent Governance Report',
        summary: {
          total_profiles: stylometricProfiles.length,
          total_samples_profiled: samples.length,
        },
        rows: stylometricProfiles.map((p) => ({
          profile_id: p.profile_id,
          label: p.label,
          entity_type: p.entity_type,
          language: p.language,
          sample_count: p.sample_count,
          consent_status: p.consent_status,
          avg_sentence_length: p.metrics.avg_sentence_length,
          burstiness_index: p.metrics.burstiness_index,
          guiraud_r: p.metrics.guiraud_r,
          transition_density: p.metrics.transition_density,
          formality_score: p.metrics.formality_score,
        })),
      };
    }

    return {
      ...baseMeta,
      title: 'Model Training & Calibration Evaluation Report',
      summary: {
        total_experiments: experiments.length,
        exploratory_runs: experiments.filter((e) => e.is_exploratory).length,
      },
      rows: experiments.map((e) => ({
        experiment_key: e.experiment_key,
        name: e.name,
        dataset_key: e.dataset_key,
        split_strategy: e.split_strategy,
        is_exploratory: e.is_exploratory,
        accuracy: e.metrics.accuracy,
        f1_score: e.metrics.f1_score,
        roc_auc: e.metrics.roc_auc,
        ece_calibration: e.metrics.ece_calibration,
        edited_text_f1: e.metrics.edited_text_f1,
      })),
    };
  }, [reportType, datasets, samples, patterns, stylometricProfiles, experiments, generatedTimestamp]);

  const buildCsvReport = () => {
    const rows = reportPayload.rows as Array<Record<string, unknown>>;
    if (rows.length === 0) return 'no_records\n';
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        headers
          .map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    return lines.join('\n');
  };

  const buildHtmlReport = () => {
    const rows = reportPayload.rows as Array<Record<string, unknown>>;
    const headers = rows[0] ? Object.keys(rows[0]) : [];
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(reportPayload.title)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 2rem; line-height: 1.5; }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  .meta { font-size: 0.8rem; color: #475569; margin-bottom: 1.5rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 1rem; }
  th, td { border: 1px solid #cbd5e1; padding: 0.45rem 0.6rem; text-align: left; }
  th { background: #f8fafc; }
</style>
</head>
<body>
  <h1>${escapeHtml(reportPayload.title)}</h1>
  <div class="meta">
    Generated: ${escapeHtml(reportPayload.generated_at)} |
    Linguistic Engine: ${escapeHtml(reportPayload.linguistic_engine_version)} |
    Classifier: ${escapeHtml(reportPayload.classifier_version)} |
    Contains Synthetic Demo: ${String(reportPayload.contains_synthetic_demo_records)}
  </div>
  <p><strong>Scientific Note:</strong> ${escapeHtml(reportPayload.scientific_disclaimer)}</p>
  <pre>${escapeHtml(JSON.stringify(reportPayload.summary, null, 2))}</pre>
  <table>
    <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows
        .map(
          (r) =>
            `<tr>${headers
              .map((h) => `<td>${escapeHtml(String(r[h] ?? ''))}</td>`)
              .join('')}</tr>`
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>`;
  };

  const handleUploadToDrive = async () => {
    const token = getInMemoryDriveToken();
    if (!token) {
      setDriveConfirmOpen(false);
      onSignIn();
      return;
    }

    setDriveUploading(true);
    setDriveStatus(null);
    try {
      const filename = `textprint-${reportType}-${generatedTimestamp.slice(0, 10)}.json`;
      const metadata = {
        name: filename,
        mimeType: 'application/json',
      };
      const bodyPayload = JSON.stringify(reportPayload, null, 2);
      const boundary = 'textprint_drive_multipart_boundary';
      const multipartBody =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
        `${bodyPayload}\r\n--${boundary}--`;

      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Drive upload failed (${res.status}).`);
      }

      const uploaded = (await res.json()) as { id: string; name: string };
      setDriveStatus(`Saved "${uploaded.name}" to Google Drive (File ID: ${uploaded.id}).`);
      onLogAudit(
        'EXPORT_DRIVE_REPORT',
        'report',
        reportType,
        `Uploaded versioned report ${uploaded.name} to Google Drive.`
      );
      setDriveConfirmOpen(false);
    } catch (error) {
      setDriveStatus(
        error instanceof Error ? error.message : 'Unable to upload report to Google Drive.'
      );
      setDriveConfirmOpen(false);
    } finally {
      setDriveUploading(false);
    }
  };

  const sendCopilotMessage = async (promptOverride?: string) => {
    const text = (promptOverride ?? chatInput).trim();
    if (!text || chatLoading) return;

    const contextHeader = includeCorpusContext
      ? `[Workspace Snapshot: ${datasets.length} datasets, ${samples.length} samples (${samples.filter((s) => !s.is_synthetic_demo).length} research, ${samples.filter((s) => s.is_synthetic_demo).length} synthetic demo), ${patterns.length} patterns, ${experiments.length} experiments]\n\n`
      : '';

    const userMsg: ChatMessage = {
      id: `usr_${Date.now().toString(36)}`,
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (!promptOverride) setChatInput('');
    setChatLoading(true);
    setChatError(null);

    try {
      const apiMessages = nextMessages.map((m, idx) => ({
        role: m.role,
        text: idx === nextMessages.length - 1 ? `${contextHeader}${m.text}` : m.text,
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          useSearch,
          mode: chatMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Copilot request failed.');
      }

      const modelMsg: ChatMessage = {
        id: `mod_${Date.now().toString(36)}`,
        role: 'model',
        text: data.text || 'No response text returned.',
        modelUsed: data.modelUsed,
        groundingSources: data.groundingSources || [],
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, modelMsg]);
    } catch (err) {
      setChatError(
        err instanceof Error
          ? err.message
          : 'Unable to reach AI Research Copilot endpoint.'
      );
    } finally {
      setChatLoading(false);
    }
  };

  const handleSaveNote = async (msg: ChatMessage) => {
    if (!user) {
      onSignIn();
      return;
    }
    setNoteStatus(null);
    try {
      const title = `Copilot Memo (${msg.timestamp.slice(0, 10)})`;
      const noteId = await saveResearchNoteToFirestore(user, title, msg.text, [
        'copilot',
        msg.modelUsed || 'gemini-4-hydrogen',
      ]);
      setSavedNotes((prev) => [{ noteId: noteId || 'saved', title, content: msg.text }, ...prev]);
      setNoteStatus('Saved research memo to Firestore.');
      onLogAudit('SAVE_FIRESTORE_NOTE', 'note', noteId || 'note', `Saved Copilot insight to Firestore.`);
    } catch (err) {
      setNoteStatus(err instanceof Error ? err.message : 'Failed to save note to Firestore.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            12–13. Reports Center &amp; AI Research Copilot
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Generate versioned multi-format research reports with Drive export, or consult the grounded Gemini stylometry copilot.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setSubView('reports')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subView === 'reports'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            12. Reports &amp; Analytics
          </button>
          <button
            type="button"
            onClick={() => setSubView('copilot')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subView === 'copilot'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            13. AI Research Copilot
          </button>
        </div>
      </div>

      {subView === 'reports' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="w-full lg:w-80">
                <label
                  htmlFor="report-type-select"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Report Template
                </label>
                <select
                  id="report-type-select"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as ReportType)}
                  className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="dataset_quality">Dataset Quality &amp; Corpus Governance</option>
                  <option value="pattern_analysis">Writing Pattern Discovery &amp; Validation</option>
                  <option value="stylometric_profiles">Stylometric Fingerprints Summary</option>
                  <option value="evaluation_experiments">Model Evaluation &amp; Experiments</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    downloadBlob(
                      JSON.stringify(reportPayload, null, 2),
                      `textprint-${reportType}.json`,
                      'application/json'
                    );
                    onLogAudit('EXPORT_JSON_REPORT', 'report', reportType, 'Exported versioned JSON report.');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadBlob(buildCsvReport(), `textprint-${reportType}.csv`, 'text/csv;charset=utf-8');
                    onLogAudit('EXPORT_CSV_REPORT', 'report', reportType, 'Exported tabular CSV report.');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadBlob(buildHtmlReport(), `textprint-${reportType}.html`, 'text/html;charset=utf-8');
                    onLogAudit('EXPORT_HTML_REPORT', 'report', reportType, 'Exported standalone HTML report.');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>HTML</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!hasDriveToken) {
                      onSignIn();
                      return;
                    }
                    setDriveConfirmOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{hasDriveToken ? 'Save to Google Drive' : 'Sign in for Drive Export'}</span>
                </button>
              </div>
            </div>

            {driveStatus && (
              <p className="text-xs font-mono text-sky-700 dark:text-sky-400">{driveStatus}</p>
            )}

            {/* Version Metadata Bar */}
            <div className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Engine Version</span>
                <p className="font-mono text-slate-900 dark:text-slate-100">{LINGUISTIC_ENGINE_VERSION}</p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Classifier Version</span>
                <p className="font-mono text-slate-900 dark:text-slate-100">{CLASSIFIER_VERSION}</p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Generated At</span>
                <p className="font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                  {generatedTimestamp.slice(0, 19)}Z
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Synthetic Demo Flag</span>
                <p className="font-mono text-amber-700 dark:text-amber-400">
                  {reportPayload.contains_synthetic_demo_records
                    ? 'Includes labeled demo records'
                    : 'Research-only records'}
                </p>
              </div>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(reportPayload.summary).map(([key, val]) => (
                <div
                  key={key}
                  className="p-3 rounded-md border border-slate-200 dark:border-slate-800"
                >
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p className="mt-1 text-lg font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {String(val)}
                  </p>
                </div>
              ))}
            </div>

            {/* Data Table Preview */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    {reportPayload.rows[0] &&
                      Object.keys(reportPayload.rows[0]).map((col) => (
                        <th key={col} className="py-2 pr-4 font-medium capitalize">
                          {col.replace(/_/g, ' ')}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(reportPayload.rows as Array<Record<string, unknown>>).map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="py-2 pr-4 font-mono text-slate-800 dark:text-slate-200 tabular-nums"
                        >
                          {typeof cell === 'number' && !Number.isInteger(cell)
                            ? cell.toFixed(3)
                            : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Drive Confirmation Modal */}
          {driveConfirmOpen && (
            <div
              className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="drive-confirm-title"
            >
              <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
                <h2
                  id="drive-confirm-title"
                  className="text-base font-semibold text-slate-900 dark:text-slate-100"
                >
                  Confirm Google Drive Export
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  TEXTPRINT will create a new JSON file (
                  <span className="font-mono">
                    textprint-{reportType}-{generatedTimestamp.slice(0, 10)}.json
                  </span>
                  ) in your Google Drive root folder using your authorized <span className="font-mono">drive.file</span> permission.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDriveConfirmOpen(false)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleUploadToDrive}
                    disabled={driveUploading}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60"
                  >
                    {driveUploading ? 'Uploading...' : 'Confirm & Upload'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {subView === 'copilot' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col min-h-[540px]">
            {/* Copilot Controls */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Computational Stylometry Copilot
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span>Reasoning</span>
                  <select
                    aria-label="Copilot reasoning mode"
                    value={chatMode}
                    onChange={(e) =>
                      setChatMode(e.target.value as 'standard' | 'deep' | 'fast')
                    }
                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="standard">Standard (gemini-4-hydrogen)</option>
                    <option value="deep">Deep Thinking (ThinkingLevel.HIGH)</option>
                    <option value="fast">Fast (gemini-3.1-flash-lite)</option>
                  </select>
                </label>

                <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useSearch}
                    onChange={(e) => setUseSearch(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700"
                  />
                  <span>Google Search Grounding</span>
                </label>

                <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCorpusContext}
                    onChange={(e) => setIncludeCorpusContext(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700"
                  />
                  <span>Attach Corpus Stats</span>
                </label>
              </div>
            </div>

            {/* Thread */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[460px]">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3.5 rounded-lg border text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'ml-8 bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900 text-slate-900 dark:text-slate-100'
                      : 'mr-4 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {msg.role === 'user'
                        ? 'Researcher'
                        : `Copilot · ${msg.modelUsed || 'gemini-4-hydrogen'}`}
                    </span>
                    {msg.role === 'model' && msg.id !== 'welcome' && (
                      <button
                        type="button"
                        onClick={() => handleSaveNote(msg)}
                        className="inline-flex items-center gap-1 text-[11px] text-sky-700 dark:text-sky-400 hover:underline"
                      >
                        <BookmarkPlus className="w-3 h-3" />
                        <span>Save Note</span>
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {msg.groundingSources && msg.groundingSources.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Grounded Web Sources:
                      </p>
                      <ul className="space-y-1">
                        {msg.groundingSources.map((src, i) => (
                          <li key={`${src.uri}-${i}`}>
                            <a
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-sky-700 dark:text-sky-400 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              <span>{src.title || src.uri}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Synthesizing analytical response...
                </p>
              )}
            </div>

            {chatError && (
              <div className="mx-4 mb-2 px-3 py-2 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded">
                {chatError}
              </div>
            )}
            {noteStatus && (
              <div className="mx-4 mb-2 px-3 py-2 text-xs text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 rounded">
                {noteStatus}
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendCopilotMessage();
              }}
              className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
            >
              <input
                type="text"
                aria-label="Ask the Research Copilot"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about stylometric markers, Arabic/English confounders, or model calibration..."
                className="flex-1 px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>

          {/* Prompts & Saved Notes Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Research Prompt Templates
              </h2>
              <div className="space-y-2">
                {[
                  'Compare how sentence burstiness and Guiraud R shift when human academic prose is AI-edited.',
                  'What confounding factors affect Arabic (MSA vs Egyptian) AI text analysis?',
                  'Design a leakage-safe cross-domain evaluation protocol for human-edited AI corpora.',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendCopilotMessage(prompt)}
                    className="w-full text-left p-2.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Saved Firestore Research Notes
              </h2>
              {!user ? (
                <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <p>Sign in with Google to save and retrieve private research notes in Firestore.</p>
                  <button
                    type="button"
                    onClick={onSignIn}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700"
                  >
                    Sign in to Sync Notes
                  </button>
                </div>
              ) : savedNotes.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No saved notes yet. Click &ldquo;Save Note&rdquo; on any Copilot memo.
                </p>
              ) : (
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                  {savedNotes.map((n, i) => (
                    <li
                      key={`${n.noteId}-${i}`}
                      className="p-2.5 rounded-md border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                    >
                      <p className="font-medium text-slate-900 dark:text-slate-100">{n.title}</p>
                      <p className="text-slate-600 dark:text-slate-400 line-clamp-3">{n.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
