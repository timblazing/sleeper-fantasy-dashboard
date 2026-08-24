import "server-only";
const RETRYABLE = new Set([500, 502, 503, 504]);
/** Upstream error pages can be huge; the captured body is only ever read to classify the failure. */
const MAX_BODY_CHARS = 8 * 1024;

/**
 * A non-ok HTTP response, with the body already read. Callers classify on `status` and `body`
 * rather than re-issuing the request. `message` is the legacy `${status} ${statusText} for ${url}`.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  /** Parsed JSON body when the error response carried one, else the raw text, else undefined. */
  readonly body: unknown;

  constructor(status: number, statusText: string, url: string, body: unknown) {
    super(`${status} ${statusText} for ${url}`);
    this.name = "HttpError";
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.body = body;
  }
}

async function httpError(response: Response, url: string): Promise<HttpError> {
  const text = await response.text().then((value) => value.slice(0, MAX_BODY_CHARS)).catch(() => undefined);
  let body: unknown = text;
  if (text) { try { body = JSON.parse(text); } catch { body = text; } }
  return new HttpError(response.status, response.statusText, url, body);
}

export async function fetchCached<T>(url: string, options: { ttl: number; headers?: HeadersInit }): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "Sleeper Fantasy Dashboard/0.1", ...options.headers }, next: { revalidate: options.ttl } });
      if (!response.ok) { const error = await httpError(response, url); if (!RETRYABLE.has(response.status)) throw error; lastError = error; }
      else { return (await response.json()) as T; }
    } catch (error) {
      // A non-retryable status is final — retrying only spends quota on a rate-limited upstream.
      if (error instanceof HttpError && !RETRYABLE.has(error.status)) throw error;
      lastError = error instanceof Error ? error : new Error("External request failed");
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 800 * 2 ** attempt));
  }
  throw lastError ?? new Error(`Failed to fetch ${url}`);
}
