import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { raFetch } from "@/lib/roster-audit/client";

function jsonResponse(status: number, body: unknown, ok = status >= 200 && status < 300) {
  const text = JSON.stringify(body);
  return { ok, status, statusText: String(status), json: () => Promise.resolve(body), text: () => Promise.resolve(text) } as Response;
}

function textResponse(status: number, text: string) {
  return { ok: false, status, statusText: String(status), json: () => Promise.reject(new Error("not json")), text: () => Promise.resolve(text) } as Response;
}

const trivialSchema = z.object({ value: z.number() });

describe("raFetch error classification", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("classifies 401 + API key required with no env key as missing-key in one request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: "API key required" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await raFetch("/presets", trivialSchema, { ttl: 60 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("missing-key");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("classifies 401 + API key required with an env key set as rejected-key in one request", async () => {
    vi.stubEnv("ROSTERAUDIT_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: "API key required" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await raFetch("/presets", trivialSchema, { ttl: 60 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("rejected-key");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("classifies 400 + League not synced as unsynced-league in one request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(400, { error: "League not synced" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await raFetch("/league-history/1/managers", trivialSchema, { ttl: 60 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("unsynced-league");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("classifies 400 + Could not resolve league history as unsynced-league", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: "Could not resolve league history" })));
    const result = await raFetch("/league-history/1/managers", trivialSchema, { ttl: 60 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("unsynced-league");
  });

  it("classifies 429 as rate-limited, not retryable and not retried", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(429, { error: "Too many requests" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await raFetch("/rankings", trivialSchema, { ttl: 60 });
    expect(result.ok).toBe(false);
    if (!result.ok) { expect(result.error.kind).toBe("rate-limited"); expect(result.error.retryable).toBe(false); }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("classifies 503 as upstream-unavailable, retryable and retried", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503, { error: "Service unavailable" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await raFetch("/rankings", trivialSchema, { ttl: 60 });
    expect(result.ok).toBe(false);
    if (!result.ok) { expect(result.error.kind).toBe("upstream-unavailable"); expect(result.error.retryable).toBe(true); }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("classifies a 500 as upstream-unavailable after exhausting the retry policy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(500, { error: "Boom" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await raFetch("/rankings", trivialSchema, { ttl: 60 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("upstream-unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("falls back to upstream-unavailable for a non-JSON error body rather than throwing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(textResponse(400, "<html>Gateway error</html>"));
    vi.stubGlobal("fetch", fetchMock);
    const result = await raFetch("/rankings", trivialSchema, { ttl: 60 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("upstream-unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("classifies a 200 response that fails the schema as invalid-response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { unexpected: true })));
    const result = await raFetch("/rankings", trivialSchema, { ttl: 60 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("invalid-response");
  });

  it("returns ok: true with populated attribution on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { value: 42, attribution: "Values by RosterAudit.com", attribution_url: "https://rosteraudit.com" })));
    const result = await raFetch("/rankings", trivialSchema, { ttl: 60 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.attribution).toEqual({ text: "Values by RosterAudit.com", url: "https://rosteraudit.com" });
  });

  it("sends X-RA-Key when the env var is set", async () => {
    vi.stubEnv("ROSTERAUDIT_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { value: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    await raFetch("/rankings", trivialSchema, { ttl: 60 });
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["X-RA-Key"]).toBe("test-key");
  });

  it("sends no X-RA-Key header when the env var is not set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { value: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    await raFetch("/rankings", trivialSchema, { ttl: 60 });
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["X-RA-Key"]).toBeUndefined();
  });
});
