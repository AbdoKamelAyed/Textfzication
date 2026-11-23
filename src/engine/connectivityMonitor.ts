import type { SafeFetchResult } from '../lib/safeFetchJson';
import type { LinguisticAnalysisResult, ProbabilisticClassification } from './types';

export interface HealthEndpointPayload {
  ok: boolean;
  service: string;
  geminiConfigured: boolean;
  sqlConfigured: boolean;
  firebaseConfigured?: boolean;
  timestamp?: string;
}

export type ConnectivityStatusKind = 'online' | 'degraded' | 'offline' | 'checking';

export interface ServiceConnectivityIndicator {
  id: 'gemini' | 'sql' | 'firebase';
  label: string;
  status: ConnectivityStatusKind;
  badgeText: string;
  detail: string;
  latencyMs: number | null;
}

export interface HealthPingSample {
  id: string;
  timestamp: string;
  ok: boolean;
  isHtmlFallback: boolean;
  latencyMs: number;
  geminiConfigured: boolean;
  sqlConfigured: boolean;
  firebaseConnected: boolean;
}

export function normalizeApiBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function buildApiUrl(path: string, baseUrl?: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedBase = baseUrl ? normalizeApiBaseUrl(baseUrl) : '';
  return normalizedBase ? `${normalizedBase}${normalizedPath}` : normalizedPath;
}

export function deriveConnectivityIndicators(params: {
  healthResult: Pick<SafeFetchResult<HealthEndpointPayload>, 'ok' | 'data' | 'error' | 'isHtmlFallback' | 'status'> | null;
  firestoreConnected: boolean | null;
  lastLatencyMs: number | null;
  isPinging: boolean;
}): ServiceConnectivityIndicator[] {
  const { healthResult, firestoreConnected, lastLatencyMs, isPinging } = params;

  // 1. Gemini AI indicator
  let gemini: ServiceConnectivityIndicator;
  if (!healthResult && isPinging) {
    gemini = {
      id: 'gemini',
      label: 'Gemini AI',
      status: 'checking',
      badgeText: 'Checking...',
      detail: 'Pinging /api/health endpoint',
      latencyMs: null,
    };
  } else if (healthResult?.ok && healthResult.data) {
    gemini = healthResult.data.geminiConfigured
      ? {
          id: 'gemini',
          label: 'Gemini AI',
          status: 'online',
          badgeText: 'Online',
          detail: 'Express proxy ready (gemini-4-hydrogen)',
          latencyMs: lastLatencyMs,
        }
      : {
          id: 'gemini',
          label: 'Gemini AI',
          status: 'degraded',
          badgeText: 'Standby',
          detail: 'Express online · GEMINI_API_KEY not set',
          latencyMs: lastLatencyMs,
        };
  } else if (healthResult?.isHtmlFallback) {
    gemini = {
      id: 'gemini',
      label: 'Gemini AI',
      status: 'offline',
      badgeText: 'Static Host',
      detail: 'Express backend required (static hosting detected)',
      latencyMs: lastLatencyMs,
    };
  } else {
    gemini = {
      id: 'gemini',
      label: 'Gemini AI',
      status: 'offline',
      badgeText: 'Offline',
      detail: healthResult?.error || 'Express /api/health unreachable',
      latencyMs: lastLatencyMs,
    };
  }

  // 2. Cloud SQL indicator
  let sql: ServiceConnectivityIndicator;
  if (!healthResult && isPinging) {
    sql = {
      id: 'sql',
      label: 'Cloud SQL',
      status: 'checking',
      badgeText: 'Checking...',
      detail: 'Probing PostgreSQL availability',
      latencyMs: null,
    };
  } else if (healthResult?.ok && healthResult.data) {
    sql = healthResult.data.sqlConfigured
      ? {
          id: 'sql',
          label: 'Cloud SQL',
          status: 'online',
          badgeText: 'Connected',
          detail: 'PostgreSQL pool active via Express',
          latencyMs: lastLatencyMs,
        }
      : {
          id: 'sql',
          label: 'Cloud SQL',
          status: 'degraded',
          badgeText: 'Hybrid Fallback',
          detail: 'Socket absent · IndexedDB + Firestore active',
          latencyMs: lastLatencyMs,
        };
  } else if (healthResult?.isHtmlFallback) {
    sql = {
      id: 'sql',
      label: 'Cloud SQL',
      status: 'degraded',
      badgeText: 'Local Store',
      detail: 'Static mode · IndexedDB + Firestore active',
      latencyMs: lastLatencyMs,
    };
  } else {
    sql = {
      id: 'sql',
      label: 'Cloud SQL',
      status: 'offline',
      badgeText: 'Unreachable',
      detail: 'Backend offline · IndexedDB fallback active',
      latencyMs: lastLatencyMs,
    };
  }

  // 3. Firebase indicator (client Firestore + server config visibility)
  let firebase: ServiceConnectivityIndicator;
  if (firestoreConnected === null) {
    firebase = {
      id: 'firebase',
      label: 'Firebase',
      status: 'checking',
      badgeText: 'Checking...',
      detail: 'Verifying Auth & Firestore channel',
      latencyMs: null,
    };
  } else if (firestoreConnected) {
    firebase = {
      id: 'firebase',
      label: 'Firebase',
      status: 'online',
      badgeText: 'Online',
      detail: healthResult?.data?.firebaseConfigured === false
        ? 'Client Firestore online · server config absent'
        : 'Auth + Firestore RBAC connected',
      latencyMs: lastLatencyMs,
    };
  } else {
    firebase = {
      id: 'firebase',
      label: 'Firebase',
      status: 'offline',
      badgeText: 'Offline',
      detail: 'Firestore client offline · IndexedDB active',
      latencyMs: lastLatencyMs,
    };
  }

  return [gemini, sql, firebase];
}

export function appendHealthPingSample(
  history: HealthPingSample[],
  sample: HealthPingSample,
  maxSamples = 12
): {
  samples: HealthPingSample[];
  averageLatencyMs: number;
  successRatePercent: number;
} {
  const next = [...history, sample].slice(-Math.max(1, maxSamples));
  const totalLatency = next.reduce((acc, item) => acc + Math.max(0, item.latencyMs), 0);
  const okCount = next.filter((item) => item.ok).length;
  return {
    samples: next,
    averageLatencyMs: Math.round(totalLatency / next.length),
    successRatePercent: Math.round((okCount / next.length) * 100),
  };
}

export function buildLocalDeterministicMemo(
  metrics: LinguisticAnalysisResult,
  classification: ProbabilisticClassification
): string {
  const langLabel = metrics.detected_dialect
    ? `${metrics.detected_language.toUpperCase()} (${metrics.detected_dialect})`
    : metrics.detected_language.toUpperCase();
  const topSignals = (classification.feature_contributions || [])
    .slice(0, 3)
    .map((f) => `${f.label} (${f.observed_value})`)
    .join(', ');

  return [
    `Local Deterministic Stylometry Summary (Static Fallback — Express Gemini Backend Not Attached)`,
    `1. Language & Length: Detected ${langLabel} across ${metrics.word_count} words, ${metrics.sentence_structure.sentence_count} sentences, and ${metrics.paragraph_structure.paragraph_count} paragraphs.`,
    `2. Syntactic & Rhythmic Profile: Mean sentence length ${metrics.sentence_structure.avg_sentence_length} words, burstiness CV ${metrics.sentence_structure.burstiness_index}, clause density ${metrics.sentence_structure.clause_density}, punctuation entropy ${metrics.punctuation.punctuation_entropy} bits.`,
    `3. Lexical & Style Indicators: Guiraud R ${metrics.vocabulary.guiraud_r}, hapax legomena ratio ${metrics.vocabulary.hapax_legomena_ratio}, transition density ${metrics.writing_style.transition_density}/100w, passive voice ${(metrics.additional.passive_voice_ratio * 100).toFixed(1)}%.`,
    `4. Calibrated Heuristic Screening: ${classification.predicted_label} (${Math.round(classification.calibrated_confidence * 100)}% calibrated confidence; key signals: ${topSignals || 'balanced lexical baseline'}).`,
    `5. Scope Note: Deep LLM reasoning (ThinkingLevel.HIGH) requires an Express /api/ai/analyze-deep runtime (Cloud Run or npm start).`,
  ].join('\n');
}
