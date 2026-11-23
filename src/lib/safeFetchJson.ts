import { parseSafeJsonPayload, type SafeJsonParseResult } from '../engine/httpResponse';
import { resolveApiUrl } from './apiBase';

export interface SafeFetchResult<T> extends SafeJsonParseResult<T> {
  status: number;
}

export async function safeFetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  unavailableMessage = 'Server API endpoint is unavailable in static hosting mode (using local IndexedDB + Firebase client mode).'
): Promise<SafeFetchResult<T>> {
  try {
    const resolvedInput = typeof input === 'string' && input.startsWith('/api/')
      ? resolveApiUrl(input)
      : input;
    const res = await fetch(resolvedInput, init);
    const rawText = await res.text();
    const parsed = parseSafeJsonPayload<T>(rawText, {
      httpOk: res.ok,
      status: res.status,
      contentType: res.headers.get('content-type'),
      unavailableMessage,
    });
    return {
      ...parsed,
      status: res.status,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : 'Network request failed.',
      isHtmlFallback: false,
    };
  }
}
