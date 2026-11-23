import { analyzeTextLinguistics, detectLanguageAndDialect, normalizeUnicodeText } from './linguistic.ts';
import type { DatasetRecord, OriginClass, TextSample, ValidationStatus } from './types.ts';

export interface SampleValidationReport {
  sample_id: string;
  passed: boolean;
  recommended_status: ValidationStatus;
  issues: Array<{
    code:
      | 'EXACT_DUPLICATE'
      | 'NEAR_DUPLICATE'
      | 'ENCODING_ANOMALY'
      | 'LANGUAGE_MISMATCH'
      | 'MISSING_METADATA'
      | 'LABEL_INCONSISTENCY'
      | 'MIN_LENGTH_WARNING'
      | 'CONTAMINATION_RISK';
    severity: 'error' | 'warning';
    message: string;
  }>;
}

export function computeContentHash(text: string): string {
  const normalized = normalizeUnicodeText(text).toLowerCase();
  // Deterministic 64-bit FNV-1a style dual hash suitable for browser & Node
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

function getWordShingles(text: string, k = 3): Set<string> {
  const tokens = normalizeUnicodeText(text)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const shingles = new Set<string>();
  if (tokens.length < k) {
    shingles.add(tokens.join(' '));
    return shingles;
  }
  for (let i = 0; i <= tokens.length - k; i++) {
    shingles.add(tokens.slice(i, i + k).join(' '));
  }
  return shingles;
}

export function jaccardShingleSimilarity(textA: string, textB: string): number {
  const a = getWordShingles(textA);
  const b = getWordShingles(textB);
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const s of a) if (b.has(s)) inter += 1;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? inter / union : 0;
}

export function validateSampleQuality(
  candidate: TextSample,
  existingCorpus: TextSample[]
): SampleValidationReport {
  const issues: SampleValidationReport['issues'] = [];

  // 1. Encoding validation
  if (/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(candidate.text)) {
    issues.push({
      code: 'ENCODING_ANOMALY',
      severity: 'error',
      message: 'Text contains replacement characters (U+FFFD) or invalid control bytes.',
    });
  }

  // 2. Missing metadata checks
  if (!candidate.provenance.dataset || !candidate.provenance.license || !candidate.provenance.collection_date) {
    issues.push({
      code: 'MISSING_METADATA',
      severity: 'error',
      message: 'Provenance requires dataset name, license identifier, and collection date.',
    });
  }
  if (!candidate.text || candidate.text.trim().length < 20) {
    issues.push({
      code: 'MIN_LENGTH_WARNING',
      severity: 'error',
      message: 'Sample text is shorter than 20 characters and cannot support linguistic analysis.',
    });
  }

  // 3. Language validation
  const detected = detectLanguageAndDialect(candidate.text);
  if (
    candidate.language &&
    detected.language !== 'mixed' &&
    candidate.language !== detected.language
  ) {
    issues.push({
      code: 'LANGUAGE_MISMATCH',
      severity: 'warning',
      message: `Declared language "${candidate.language}" differs from detected script "${detected.language}".`,
    });
  }

  // 4. Label consistency checks
  if (candidate.origin.class === 'human' && candidate.origin.model !== null) {
    issues.push({
      code: 'LABEL_INCONSISTENCY',
      severity: 'error',
      message: 'Human-origin sample must not specify an LLM model identifier.',
    });
  }
  if (
    (candidate.origin.class === 'ai' || candidate.origin.class === 'human_edited_ai') &&
    !candidate.origin.model
  ) {
    issues.push({
      code: 'LABEL_INCONSISTENCY',
      severity: 'warning',
      message: 'AI-origin sample is missing the generating LLM model identifier.',
    });
  }
  if (candidate.origin.class === 'human_edited_ai' && !candidate.editing_history.human_edited) {
    issues.push({
      code: 'LABEL_INCONSISTENCY',
      severity: 'warning',
      message: 'Origin class is human_edited_ai but editing_history.human_edited is false.',
    });
  }

  // 5. Duplicate & Near-Duplicate + Contamination check
  const hash = candidate.content_hash || computeContentHash(candidate.text);
  for (const other of existingCorpus) {
    if (other.sample_id === candidate.sample_id) continue;
    if (other.content_hash === hash) {
      issues.push({
        code: 'EXACT_DUPLICATE',
        severity: 'error',
        message: `Exact content duplicate of existing sample ${other.sample_id}.`,
      });
      break;
    }
    const sim = jaccardShingleSimilarity(candidate.text, other.text);
    if (sim >= 0.82) {
      issues.push({
        code: other.dataset_key !== candidate.dataset_key ? 'CONTAMINATION_RISK' : 'NEAR_DUPLICATE',
        severity: 'warning',
        message: `High 3-gram overlap (${(sim * 100).toFixed(1)}%) with ${other.sample_id} in dataset "${other.dataset_key}".`,
      });
      break;
    }
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  return {
    sample_id: candidate.sample_id,
    passed: !hasErrors,
    recommended_status: hasErrors ? 'quarantined' : issues.length > 0 ? 'pending' : 'verified',
    issues,
  };
}

export interface ParsedImportRecord {
  text: string;
  language?: string;
  domain?: string;
  writing_type?: string;
  origin_class?: OriginClass;
  origin_model?: string | null;
  author_pseudo_id?: string | null;
}

export interface CsvColumnMapping {
  text?: string;
  language?: string;
  domain?: string;
  writing_type?: string;
  origin_class?: string;
  origin_model?: string;
  author_pseudo_id?: string;
}

export function parseCsvRows(rawCsv: string): string[][] {
  const input = rawCsv.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '"') {
      if (inQuotes && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(field.trim());
      field = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && input[i + 1] === '\n') {
        i += 1;
      }
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }
  return rows;
}

function normalizeOriginValue(v: unknown): OriginClass {
  const s = String(v || '').toLowerCase().trim();
  if (
    s === 'human' ||
    s === 'ai' ||
    s === 'human_edited_ai' ||
    s === 'ai_edited_human' ||
    s === 'mixed' ||
    s === 'unknown'
  ) {
    return s;
  }
  return 'unknown';
}

export function parseImportedDatasetText(
  rawContent: string,
  format: 'csv' | 'json' | 'jsonl' | 'txt' | 'xml',
  columnOverrides?: CsvColumnMapping
): { records: ParsedImportRecord[]; detectedColumns: string[]; errors: string[] } {
  const errors: string[] = [];
  const records: ParsedImportRecord[] = [];
  let detectedColumns: string[] = [];

  const trimmed = rawContent.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return { records: [], detectedColumns: [], errors: ['Empty input payload.'] };
  }

  const validOrigin = normalizeOriginValue;

  if (format === 'json') {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.records) ? parsed.records : [parsed];
      if (arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
        detectedColumns = Object.keys(arr[0]);
      }
      for (const item of arr) {
        const text = String(item?.text ?? item?.content ?? item?.body ?? '').trim();
        if (text) {
          records.push({
            text,
            language: item.language ? String(item.language) : undefined,
            domain: item.domain ? String(item.domain) : undefined,
            writing_type: item.writing_type ? String(item.writing_type) : undefined,
            origin_class: validOrigin(item?.origin?.class ?? item?.origin_class ?? item?.label),
            origin_model: item?.origin?.model ?? item?.model ?? null,
            author_pseudo_id: item?.author_pseudo_id ?? null,
          });
        }
      }
    } catch (e) {
      errors.push(`Invalid JSON format: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else if (format === 'jsonl') {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    lines.forEach((line, idx) => {
      try {
        const item = JSON.parse(line);
        if (idx === 0 && item && typeof item === 'object') {
          detectedColumns = Object.keys(item);
        }
        const text = String(item?.text ?? item?.content ?? item?.body ?? '').trim();
        if (text) {
          records.push({
            text,
            language: item.language ? String(item.language) : undefined,
            domain: item.domain ? String(item.domain) : undefined,
            writing_type: item.writing_type ? String(item.writing_type) : undefined,
            origin_class: validOrigin(item?.origin?.class ?? item?.origin_class ?? item?.label),
            origin_model: item?.origin?.model ?? item?.model ?? null,
            author_pseudo_id: item?.author_pseudo_id ?? null,
          });
        }
      } catch {
        errors.push(`Line ${idx + 1} is not valid JSON.`);
      }
    });
  } else if (format === 'csv') {
    const rows = parseCsvRows(trimmed);
    if (rows.length < 2) {
      errors.push('CSV requires a header row and at least one data row.');
    } else {
      detectedColumns = rows[0].map((h) => h.toLowerCase().trim());
      const findCol = (override: string | undefined, candidates: string[]) => {
        if (override) {
          const idx = detectedColumns.indexOf(override.toLowerCase().trim());
          if (idx >= 0) return idx;
        }
        return detectedColumns.findIndex((c) => candidates.includes(c));
      };

      const textIdx = findCol(columnOverrides?.text, [
        'text',
        'content',
        'body',
        'passage',
        'essay',
        'document',
        'article',
        'response',
        'sentence',
      ]);

      if (textIdx === -1) {
        errors.push(
          'CSV header must contain a text column ("text", "content", "body", "passage", or mapped column).'
        );
      } else {
        const langIdx = findCol(columnOverrides?.language, ['language', 'lang']);
        const domIdx = findCol(columnOverrides?.domain, ['domain', 'topic', 'category']);
        const typeIdx = findCol(columnOverrides?.writing_type, ['writing_type', 'genre', 'type']);
        const originIdx = findCol(columnOverrides?.origin_class, [
          'origin_class',
          'origin',
          'label',
          'author_type',
        ]);
        const modelIdx = findCol(columnOverrides?.origin_model, ['origin_model', 'model', 'llm']);
        const authorIdx = findCol(columnOverrides?.author_pseudo_id, [
          'author_pseudo_id',
          'author_id',
          'author',
        ]);

        for (let i = 1; i < rows.length; i += 1) {
          const cols = rows[i];
          const text = (cols[textIdx] || '').trim();
          if (text) {
            records.push({
              text,
              language: langIdx >= 0 && cols[langIdx] ? cols[langIdx] : undefined,
              domain: domIdx >= 0 && cols[domIdx] ? cols[domIdx] : undefined,
              writing_type: typeIdx >= 0 && cols[typeIdx] ? cols[typeIdx] : undefined,
              origin_class: originIdx >= 0 ? validOrigin(cols[originIdx]) : 'unknown',
              origin_model: modelIdx >= 0 && cols[modelIdx] ? cols[modelIdx] : null,
              author_pseudo_id: authorIdx >= 0 && cols[authorIdx] ? cols[authorIdx] : null,
            });
          }
        }
      }
    }
  } else if (format === 'xml') {
    detectedColumns = ['text', 'language', 'domain', 'origin'];
    const sampleMatches = trimmed.match(/<sample\b[^>]*>[\s\S]*?<\/sample>/gi) || [];
    if (sampleMatches.length === 0) {
      errors.push('XML must contain <sample><text>...</text></sample> elements.');
    }
    for (const block of sampleMatches) {
      const textMatch = block.match(/<text>([\s\S]*?)<\/text>/i);
      const langMatch = block.match(/<language>([\s\S]*?)<\/language>/i);
      const domMatch = block.match(/<domain>([\s\S]*?)<\/domain>/i);
      const originMatch = block.match(/<origin>([\s\S]*?)<\/origin>/i);
      const text = textMatch ? textMatch[1].trim() : '';
      if (text) {
        records.push({
          text,
          language: langMatch ? langMatch[1].trim() : undefined,
          domain: domMatch ? domMatch[1].trim() : undefined,
          origin_class: originMatch ? validOrigin(originMatch[1]) : 'unknown',
        });
      }
    }
  } else {
    detectedColumns = ['text'];
    const blocks = trimmed.split(/\n{2,}/).filter((b) => b.trim().length > 0);
    for (const block of blocks) {
      records.push({ text: block.trim(), origin_class: 'unknown' });
    }
  }

  return { records, detectedColumns, errors };
}

export interface CsvBatchFileInput {
  fileName: string;
  content: string;
}

export interface CsvBatchFileSummary {
  fileName: string;
  rowCount: number;
  validCount: number;
  quarantinedCount: number;
  detectedColumns: string[];
  errors: string[];
}

export interface CsvBatchImportResult {
  dataset: DatasetRecord;
  builtSamples: TextSample[];
  fileSummaries: CsvBatchFileSummary[];
  detectedColumns: string[];
  quarantinedCount: number;
  errors: string[];
}

export function processCsvFileBatch(
  files: CsvBatchFileInput[],
  existingSamples: TextSample[],
  options: {
    datasetName: string;
    license: string;
    isSyntheticDemo: boolean;
    columnOverrides?: CsvColumnMapping;
    idSeed?: string;
  }
): CsvBatchImportResult {
  const dsKey =
    options.datasetName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `csv-batch-${Date.now().toString(36)}`;

  const nowIso = new Date().toISOString();
  const seed = (options.idSeed || Date.now().toString(36)).toUpperCase().slice(-4);
  const existingPlusBatch = [...existingSamples];
  const builtSamples: TextSample[] = [];
  const fileSummaries: CsvBatchFileSummary[] = [];
  const columnSet = new Set<string>();
  const allErrors: string[] = [];
  let totalQuarantined = 0;
  let globalIdx = 0;

  for (const file of files) {
    const parsed = parseImportedDatasetText(file.content, 'csv', options.columnOverrides);
    for (const col of parsed.detectedColumns) {
      columnSet.add(col);
    }

    let fileValid = 0;
    let fileQuarantined = 0;
    const fileErrors = [...parsed.errors];
    if (parsed.records.length === 0 && fileErrors.length === 0) {
      fileErrors.push('No non-empty text rows found.');
    }
    for (const err of fileErrors) {
      allErrors.push(`${file.fileName}: ${err}`);
    }

    for (const rec of parsed.records) {
      globalIdx += 1;
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
      const sid = `TX-${prefix}-${seed}${String(globalIdx).padStart(3, '0')}`;
      const sample = buildSampleFromImport(rec, {
        sampleId: sid,
        datasetKey: dsKey,
        license: options.license.trim() || 'CC-BY-4.0',
        source: `csv_drop:${file.fileName}`,
        isSyntheticDemo: options.isSyntheticDemo,
      });

      const validation = validateSampleQuality(sample, existingPlusBatch);
      if (!validation.passed) {
        sample.validation.status = 'quarantined';
        sample.validation.validation_notes = validation.issues.map((iss) => iss.message);
        fileQuarantined += 1;
        totalQuarantined += 1;
      } else {
        if (validation.issues.length > 0) {
          sample.validation.validation_notes = validation.issues.map((iss) => iss.message);
        }
        fileValid += 1;
      }
      builtSamples.push(sample);
      existingPlusBatch.push(sample);
    }

    fileSummaries.push({
      fileName: file.fileName,
      rowCount: parsed.records.length,
      validCount: fileValid,
      quarantinedCount: fileQuarantined,
      detectedColumns: parsed.detectedColumns,
      errors: fileErrors,
    });
  }

  return {
    dataset: {
      dataset_key: dsKey,
      name: options.datasetName.trim() || 'CSV Batch Import',
      description: `Batch imported ${builtSamples.length} record(s) from ${files.length} CSV file(s).`,
      layer: 'raw',
      version: '1.0.0',
      license: options.license.trim() || 'CC-BY-4.0',
      is_synthetic_demo: options.isSyntheticDemo,
      source_type: 'csv_batch_drop',
      created_at: nowIso,
      updated_at: nowIso,
    },
    builtSamples,
    fileSummaries,
    detectedColumns: Array.from(columnSet),
    quarantinedCount: totalQuarantined,
    errors: allErrors,
  };
}

export function buildSampleFromImport(
  rec: ParsedImportRecord,
  opts: {
    sampleId: string;
    datasetKey: string;
    license: string;
    source: string;
    isSyntheticDemo: boolean;
  }
): TextSample {
  const normalized = normalizeUnicodeText(rec.text);
  const detected = detectLanguageAndDialect(rec.text);
  const language = rec.language || detected.language;
  const linguisticMetrics = analyzeTextLinguistics(rec.text);

  return {
    sample_id: opts.sampleId,
    dataset_key: opts.datasetKey,
    text: rec.text,
    normalized_text: normalized,
    language,
    dialect: detected.dialect,
    domain: rec.domain || 'general',
    writing_type: rec.writing_type || 'passage',
    origin: {
      class: rec.origin_class || 'unknown',
      source: opts.source,
      model: rec.origin_model ?? null,
      model_version: null,
    },
    editing_history: {
      human_edited: rec.origin_class === 'human_edited_ai' || rec.origin_class === 'ai_edited_human',
      ai_edited: rec.origin_class === 'ai_edited_human' || rec.origin_class === 'human_edited_ai',
      editing_operations: [],
    },
    provenance: {
      dataset: opts.datasetKey,
      license: opts.license,
      collection_date: new Date().toISOString().slice(0, 10),
    },
    validation: {
      status: 'pending',
      verified: false,
      validation_notes: ['Imported into RAW layer; awaiting quality verification.'],
    },
    layer: 'raw',
    dataset_version: '1.0.0',
    is_synthetic_demo: opts.isSyntheticDemo,
    author_pseudo_id: rec.author_pseudo_id ?? null,
    content_hash: computeContentHash(rec.text),
    linguistic_metrics: linguisticMetrics,
  };
}
