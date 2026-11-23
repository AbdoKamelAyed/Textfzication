import { useState } from 'react';
import { runControlledTrainingExperiment } from '../engine/training';
import type {
  DatasetRecord,
  ExperimentRecord,
  TextSample,
} from '../engine/types';

interface Props {
  datasets: DatasetRecord[];
  samples: TextSample[];
  experiments: ExperimentRecord[];
  onRecordExperiment: (exp: ExperimentRecord) => void;
}

export function TrainingAndExperimentsView({
  datasets,
  samples,
  experiments,
  onRecordExperiment,
}: Props) {
  const [name, setName] = useState('Multilingual Calibration Experiment');
  const [hypothesis, setHypothesis] = useState(
    'Grouped source splitting prevents data leakage across human and LLM-generated English/Arabic subsets.'
  );
  const [datasetKey, setDatasetKey] = useState<string>('all');
  const [splitStrategy, setSplitStrategy] = useState<
    'grouped_by_source' | 'grouped_by_author' | 'stratified_origin'
  >('grouped_by_source');
  const [modelType, setModelType] = useState('Calibrated Multi-Signal Statistical Baseline');
  const [allowExploratory, setAllowExploratory] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedExpKey, setSelectedExpKey] = useState<string>(
    experiments[0]?.experiment_key ?? ''
  );

  const activeExp =
    experiments.find((e) => e.experiment_key === selectedExpKey) ?? experiments[0] ?? null;

  const handleRunTraining = (e: React.FormEvent) => {
    e.preventDefault();
    const res = runControlledTrainingExperiment(samples, {
      name: name.trim() || 'Untitled Experiment',
      hypothesis: hypothesis.trim() || 'Baseline evaluation.',
      datasetKey,
      datasetLayer: 'approved',
      allowUnverifiedExploratory: allowExploratory,
      splitStrategy,
      modelType,
      languageScope: 'en, ar',
      trainRatio: 0.65,
    });

    if (res.error || !res.experiment) {
      setErrorMsg(res.error || 'Training run rejected.');
      return;
    }

    setErrorMsg(null);
    onRecordExperiment(res.experiment);
    setSelectedExpKey(res.experiment.experiment_key);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          09 &amp; 11. Model Training, Evaluation &amp; Experiments
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Leakage-safe grouped splits, strict exploratory gating for unverified records, and calibrated multi-metric evaluation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleRunTraining}
          className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Define Controlled Training Run
          </h2>

          <div>
            <label
              htmlFor="exp-name"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Experiment Name
            </label>
            <input
              id="exp-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="exp-hypothesis"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Research Hypothesis
            </label>
            <textarea
              id="exp-hypothesis"
              rows={2}
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="exp-dataset"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Dataset Scope
              </label>
              <select
                id="exp-dataset"
                value={datasetKey}
                onChange={(e) => setDatasetKey(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="all">All Indexed Corpora ({samples.length})</option>
                {datasets.map((d) => (
                  <option key={d.dataset_key} value={d.dataset_key}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="exp-split"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Leakage-Safe Split
              </label>
              <select
                id="exp-split"
                value={splitStrategy}
                onChange={(e) => setSplitStrategy(e.target.value as typeof splitStrategy)}
                className="w-full px-2.5 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="grouped_by_source">Grouped by Source &amp; Model</option>
                <option value="grouped_by_author">Grouped by Author / Family</option>
                <option value="stratified_origin">Stratified Origin &amp; Language</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="exp-model"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Model Architecture
            </label>
            <select
              id="exp-model"
              value={modelType}
              onChange={(e) => setModelType(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="Calibrated Multi-Signal Statistical Baseline">
                Calibrated Multi-Signal Statistical Baseline
              </option>
              <option value="Rule-Based Linguistic Thresholds">
                Rule-Based Linguistic Thresholds
              </option>
              <option value="Logistic Stylometric Adapter (Scikit-Ready)">
                Logistic Stylometric Adapter (Scikit-Ready)
              </option>
            </select>
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={allowExploratory}
              onChange={(e) => setAllowExploratory(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 dark:border-slate-700"
            />
            <span>
              Mark experiment as Exploratory (required if dataset contains unverified samples)
            </span>
          </label>

          {errorMsg && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{errorMsg}</p>
          )}

          <button
            type="submit"
            className="w-full px-4 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors"
          >
            Execute &amp; Evaluate Experiment
          </button>
        </form>

        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
          {!activeExp ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No experiments recorded yet. Configure and run an evaluation on the left.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <p className="text-xs font-mono text-sky-700 dark:text-sky-400">
                    {activeExp.experiment_key} · {activeExp.is_exploratory ? 'Exploratory' : 'Verified Run'}
                  </p>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {activeExp.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {activeExp.hypothesis}
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  Train {activeExp.metrics.train_count} / Eval {activeExp.metrics.eval_count}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums text-xs">
                {[
                  ['Accuracy', `${(activeExp.metrics.accuracy * 100).toFixed(1)}%`],
                  ['Precision', `${(activeExp.metrics.precision * 100).toFixed(1)}%`],
                  ['Recall', `${(activeExp.metrics.recall * 100).toFixed(1)}%`],
                  ['F1-Score', `${(activeExp.metrics.f1_score * 100).toFixed(1)}%`],
                  ['ROC-AUC', activeExp.metrics.roc_auc.toFixed(3)],
                  ['FPR', `${(activeExp.metrics.fpr * 100).toFixed(1)}%`],
                  ['FNR', `${(activeExp.metrics.fnr * 100).toFixed(1)}%`],
                  ['ECE Calib.', activeExp.metrics.ece_calibration.toFixed(3)],
                ].map(([label, val]) => (
                  <div
                    key={label}
                    className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  >
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                      {label}
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {val}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    Performance by Language
                  </p>
                  {Object.entries(activeExp.metrics.by_language).map(([lang, stats]) => (
                    <div key={lang} className="flex justify-between font-mono tabular-nums">
                      <span className="text-slate-600 dark:text-slate-400">{lang.toUpperCase()}</span>
                      <span className="text-slate-900 dark:text-slate-100">
                        {(stats.f1 * 100).toFixed(1)}% (n={stats.count})
                      </span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    Performance by Domain &amp; Edited Text
                  </p>
                  <div className="flex justify-between font-mono tabular-nums">
                    <span className="text-slate-600 dark:text-slate-400">Edited Text F1</span>
                    <span className="text-slate-900 dark:text-slate-100">
                      {(activeExp.metrics.edited_text_f1 * 100).toFixed(1)}%
                    </span>
                  </div>
                  {Object.entries(activeExp.metrics.by_domain).map(([dom, stats]) => (
                    <div key={dom} className="flex justify-between font-mono tabular-nums">
                      <span className="text-slate-600 dark:text-slate-400">{dom}</span>
                      <span className="text-slate-900 dark:text-slate-100">
                        {(stats.f1 * 100).toFixed(1)}% (n={stats.count})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Experiment History Registry */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Experiment History ({experiments.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-4 font-medium">Experiment</th>
                <th className="py-2 pr-4 font-medium">Model · Split</th>
                <th className="py-2 pr-4 font-medium">Mode</th>
                <th className="py-2 pr-4 text-right font-medium">F1</th>
                <th className="py-2 text-right font-medium">ROC-AUC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {experiments.map((exp) => (
                <tr
                  key={exp.experiment_key}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => setSelectedExpKey(exp.experiment_key)}
                      className="text-left font-medium text-sky-700 dark:text-sky-400 hover:underline"
                    >
                      {exp.experiment_key} — {exp.name}
                    </button>
                  </td>
                  <td className="py-2 pr-4 font-mono text-slate-600 dark:text-slate-400">
                    {exp.model_version} · {exp.split_strategy}
                  </td>
                  <td className="py-2 pr-4 font-mono text-slate-600 dark:text-slate-400">
                    {exp.is_exploratory ? 'Exploratory' : 'Strict Verified'}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {(exp.metrics.f1_score * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {exp.metrics.roc_auc.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
