# TEXTPRINT Data & Storage Architecture

## 1. Three-Stage Data Lifecycle
1. **RAW (`raw_samples`)**: Original imported or submitted text, encoding checks, content hash, and initial provenance metadata. Never used directly for non-exploratory model evaluation.
2. **PROCESSED (`processed_samples`)**: Unicode NFC normalized text, stripped diacritics/zero-width normalization copy, language/dialect tag, and extracted 6-category linguistic feature vector.
3. **APPROVED (`approved_samples`)**: Verified provenance, duplicate/contamination cleared, consistent origin labels, eligible for reproducible training and benchmark comparisons.

## 2. Canonical Sample Schema (`TX-HUM-000001`)
Each sample tracks:
- `sample_id`, `dataset_key`, `layer`, `dataset_version`, `is_synthetic_demo`
- `text`, `normalized_text`, `language` (`en` | `ar` | `mixed`), `dialect` (`Modern Standard Arabic (arb)` | `Egyptian Arabic (arz)` | `null`)
- `origin`: `{ class, source, model, model_version }`
- `editing_history`: `{ human_edited, ai_edited, editing_operations[] }`
- `provenance`: `{ dataset, license, collection_date }`
- `validation`: `{ status, verified, validation_notes[] }`

## 3. Data Quality & Contamination Controls
- **Exact Duplicate Guard**: 64-bit normalized content hash (`content_hash`).
- **Near-Duplicate & Cross-Split Contamination Guard**: 3-gram Jaccard shingle overlap (`>= 82%` triggers warning/quarantine).
- **Label Consistency**: Enforces `origin.model === null` for `human` records and checks editing flags against `human_edited_ai` / `ai_edited_human`.
- **Synthetic Demo Isolation**: Demonstration records carry `is_synthetic_demo: true` and are visibly labeled across every dashboard, graph, and report.
