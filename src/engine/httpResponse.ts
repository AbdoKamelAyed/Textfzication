export interface SafeJsonParseResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
  isHtmlFallback: boolean;
}

function extractReadableErrorMessage(rawError: unknown): string {
  if (typeof rawError !== 'string') {
    return 'Request failed.';
  }
  const trimmed = rawError.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const nested = JSON.parse(trimmed) as { error?: { message?: string } | string; message?: string };
      if (typeof nested.error === 'object' && nested.error?.message) {
        return nested.error.message;
      }
      if (typeof nested.error === 'string') {
        return nested.error;
      }
      if (typeof nested.message === 'string') {
        return nested.message;
      }
    } catch {
      // Return original trimmed string if nested JSON parsing fails
    }
  }
  return trimmed;
}

export function parseSafeJsonPayload<T>(
  rawText: string,
  options: {
    httpOk: boolean;
    status: number;
    contentType?: string | null;
    unavailableMessage?: string;
  }
): SafeJsonParseResult<T> {
  const trimmed = rawText.trim();
  const contentType = (options.contentType || '').toLowerCase();
  const looksLikeHtml =
    contentType.includes('text/html') ||
    trimmed.toLowerCase().startsWith('<!doctype') ||
    trimmed.toLowerCase().startsWith('<html') ||
    trimmed.startsWith('<');

  if (looksLikeHtml) {
    return {
      ok: false,
      data: null,
      error:
        options.unavailableMessage ||
        'Server API endpoint is not available in static hosting mode.',
      isHtmlFallback: true,
    };
  }

  if (!trimmed) {
    return {
      ok: false,
      data: null,
      error: options.httpOk ? 'Empty JSON response received.' : `HTTP ${options.status}`,
      isHtmlFallback: false,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as T & { error?: unknown; message?: unknown };
    if (!options.httpOk) {
      const msg =
        typeof parsed?.error === 'string'
          ? extractReadableErrorMessage(parsed.error)
          : typeof parsed?.message === 'string'
            ? parsed.message
            : `Request failed (HTTP ${options.status}).`;
      return {
        ok: false,
        data: parsed,
        error: msg,
        isHtmlFallback: false,
      };
    }
    return {
      ok: true,
      data: parsed,
      error: null,
      isHtmlFallback: false,
    };
  } catch {
    return {
      ok: false,
      data: null,
      error: options.httpOk
        ? 'Received invalid non-JSON response from server.'
        : trimmed.slice(0, 240) || `Request failed (HTTP ${options.status}).`,
      isHtmlFallback: false,
    };
  }
}
