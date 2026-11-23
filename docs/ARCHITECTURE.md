# TEXTPRINT System Architecture

## 1. Architectural Principles
TEXTPRINT is designed as a modular Writing Intelligence and Computational Stylometry Research Laboratory with strict separation between:
- **Pure Analytical Engines (`src/engine/*`)**: Zero DOM or network dependencies. All linguistic extraction, probabilistic classification, comparative diffing, quality validation, training splits, and knowledge graph construction execute deterministically in TypeScript and can run in browser main threads, Web Workers, Node.js servers, or future Python/FastAPI microservices.
- **Storage Adapters (`src/storage/*`, `src/db/*`, `src/lib/firebase.ts`)**:
  - **Local IndexedDB Adapter**: Layered local persistence (`raw_samples`, `processed_samples`, `approved_samples`, `patterns`, `experiments`) enabling offline and GitHub Pages static deployment.
  - **Cloud SQL PostgreSQL + Drizzle ORM**: Relational schema for datasets, samples, external sources, collection jobs, experiments, patterns, and audit logs.
  - **Firebase Firestore + Auth + Google Drive**: Researcher authentication, private cloud sync (`firebase-blueprint.json`), and corpus import/report export via Google Drive API.
- **Server-Side AI Proxy (`server.ts`)**: Exposes `/api/ai/*` endpoints using `@google/genai` (`gemini-4-hydrogen` with Search Grounding and `ThinkingLevel.HIGH`, plus `gemini-3.1-flash-lite` for rapid transformations) without exposing API credentials to the browser.

## 2. Independent Platform Modules
1. **Research Dashboard**: Real computed corpus metrics, target progress (`3,000` research goal), language/origin breakdowns.
2. **Data Acquisition & Research Center**: Multi-format importer (`CSV`, `JSON`, `JSONL`, `TXT`, `XML`), Google Drive file importer, External Sources Registry, Scheduled Jobs, AI Generation Lab, Human Contribution Portal, and Human <-> AI Editing Lab.
3. **Dataset Management System**: Strict `Raw -> Processed -> Approved` data layers, validation runner, metadata & RTL Arabic/English inspector.
4. **Linguistic Analysis Engine**: 6-category multilingual feature extraction (`en` / `ar` MSA & Egyptian dialect) with full `FEATURE_CATALOG` specifications.
5. **Writing Pattern Recognition Engine**: Explicit status lifecycle (`observed` -> `hypothesis` -> `statistically_supported` -> `approved`); never auto-promotes unverified observations.
6. **Stylometric Fingerprint Engine**: Probabilistic statistical profiles for pseudonymous authors, LLM models, and language groups with consent governance.
7. **AI Text Analysis Engine**: Calibrated multi-signal classifier (`Likely Human-Written`, `Likely AI-Generated`, `Human-Edited AI`, `AI-Edited Human`, `Mixed-Origin`, `Insufficient Evidence`) with uncertainty flags and documented limitations.
8. **Comparative Research Laboratory**: Side-by-side text diffing, delta tables, and cosine stylometric similarity.
9. **Model Training & Evaluation Center**: Leakage-safe grouped splits (`grouped_by_source`, `grouped_by_author`), exploratory flag enforcement for unverified data, and full evaluation metrics.
10. **Knowledge Graph & Visual Intelligence Engine**: Interactive D3.js force-directed Knowledge Graph, Hierarchical Feature Tree, Process Flow Diagram, and Dataset Map with SVG/PNG/JSON exports.
11. **Experiment Management System**: Hypothesis tracking, dataset lineage, and reproducible parameter snapshots.
12. **Reports & Analytics Center**: Versioned JSON, CSV, HTML, and printable PDF research reports + Google Drive export.
13. **AI Research Copilot**: Multi-turn Gemini assistant with Google Search Grounding and Deep Thinking mode.
14. **Governance, Architecture & Settings**: Consent & privacy controls, audit logs, storage diagnostics, and documentation.
