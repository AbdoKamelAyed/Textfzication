import { buildApiUrl, normalizeApiBaseUrl } from '../engine/connectivityMonitor';

const API_BASE_STORAGE_KEY = 'textprint_api_base_url';

export function getConfiguredApiBaseUrl(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(API_BASE_STORAGE_KEY);
      if (saved) {
        const normalized = normalizeApiBaseUrl(saved);
        if (normalized) return normalized;
      }
    }
  } catch {
    // Ignore storage restrictions
  }
  const envBase =
    typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL;
  return envBase ? normalizeApiBaseUrl(envBase) : '';
}

export function setConfiguredApiBaseUrl(rawUrl: string): string {
  const normalized = normalizeApiBaseUrl(rawUrl);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (normalized) {
        window.localStorage.setItem(API_BASE_STORAGE_KEY, normalized);
      } else {
        window.localStorage.removeItem(API_BASE_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage restrictions
  }
  return normalized;
}

export function resolveApiUrl(path: string): string {
  return buildApiUrl(path, getConfiguredApiBaseUrl());
}
