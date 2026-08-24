import "server-only";
import type { ZodType } from "zod";
import { fetchCached, HttpError } from "@/lib/fetch-cached";
import { parseAttribution } from "@/lib/roster-audit/schemas";
import type { RaError, RaResult } from "@/lib/roster-audit/types";

const API = "https://rosteraudit.com/wp-json/ra/v1";

function classifyFromBody(status: number, body: unknown, hadKey: boolean): RaError {
  const errorText = body && typeof body === "object" && "error" in body ? String((body as Record<string, unknown>).error) : "";
  if (status === 401 && errorText === "API key required") return { kind: hadKey ? "rejected-key" : "missing-key", message: errorText, retryable: false };
  if (status === 400 && (errorText === "League not synced" || errorText === "Could not resolve league history")) return { kind: "unsynced-league", message: errorText, retryable: false };
  return { kind: "upstream-unavailable", message: errorText || `${status} unclassified error`, retryable: true };
}

/** The one status → RaError mapping, shared by the GET and POST paths so they cannot drift. */
function classifyStatus(status: number, body: unknown, hadKey: boolean, message: string): RaError {
  if (status === 429) return { kind: "rate-limited", message, retryable: false };
  if (status >= 500) return { kind: "upstream-unavailable", message, retryable: true };
  if (status === 400 || status === 401) return classifyFromBody(status, body, hadKey);
  return { kind: "upstream-unavailable", message, retryable: true };
}

export async function raFetch<T>(path: string, schema: ZodType<T>, options: { ttl: number; method?: "GET" | "POST"; body?: unknown }): Promise<RaResult<T>> {
  const apiKey = process.env.ROSTERAUDIT_API_KEY;
  const headers = apiKey ? { "X-RA-Key": apiKey } : undefined;
  const method = options.method ?? "GET";
  let payload: unknown;

  if (method === "POST") {
    try {
      const response = await fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Sleeper Fantasy Dashboard/0.1", ...headers }, body: JSON.stringify(options.body ?? {}) });
      const json = await response.json().catch(() => undefined);
      if (!response.ok) return { ok: false, error: classifyStatus(response.status, json, Boolean(apiKey), `${response.status} upstream error`) };
      payload = json;
    } catch (error) {
      const message = error instanceof Error ? error.message : "External request failed";
      return { ok: false, error: { kind: "upstream-unavailable", message, retryable: true } };
    }
  } else {
    try {
      payload = await fetchCached<unknown>(`${API}${path}`, { ttl: options.ttl, headers });
    } catch (error) {
      // fetchCached already read the error body, so classification costs no extra upstream request.
      if (error instanceof HttpError) return { ok: false, error: classifyStatus(error.status, error.body, Boolean(apiKey), error.message) };
      const message = error instanceof Error ? error.message : "External request failed";
      return { ok: false, error: { kind: "upstream-unavailable", message, retryable: true } };
    }
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: { kind: "invalid-response", message: parsed.error.message, retryable: false } };
  return { ok: true, data: parsed.data, attribution: parseAttribution(payload) };
}
