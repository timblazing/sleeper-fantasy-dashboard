import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCached, HttpError } from "@/lib/fetch-cached";

function response(status: number, text: string, ok = status >= 200 && status < 300) {
  return { ok, status, statusText: status === 404 ? "Not Found" : String(status), text: () => Promise.resolve(text), json: () => Promise.resolve(JSON.parse(text)) } as Response;
}

/** Awaits a rejection and hands back the thrown value, failing the test if the promise resolves. */
async function rejection(promise: Promise<unknown>): Promise<HttpError> {
  const thrown = await promise.then(() => null, (error: unknown) => error as HttpError);
  if (thrown === null) throw new Error("expected the request to reject");
  return thrown;
}

describe("fetchCached", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the parsed JSON body on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, '{"value":1}')));
    await expect(fetchCached<{ value: number }>("https://x.test/a", { ttl: 60 })).resolves.toEqual({ value: 1 });
  });

  it("throws an HttpError carrying the status and the parsed body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(401, '{"error":"API key required"}')));
    const error = await rejection(fetchCached("https://x.test/b", { ttl: 60 }));
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(401);
    expect(error.body).toEqual({ error: "API key required" });
    expect(error.url).toBe("https://x.test/b");
  });

  it("keeps the legacy message format", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(404, "missing")));
    const error = await rejection(fetchCached("https://x.test/c", { ttl: 60 }));
    expect(error.message).toBe("404 Not Found for https://x.test/c");
  });

  it("falls back to the raw text when the error body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(400, "<html>nope</html>")));
    const error = await rejection(fetchCached("https://x.test/d", { ttl: 60 }));
    expect(error.body).toBe("<html>nope</html>");
  });

  it("caps the captured body at 8 KB", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(400, "x".repeat(20_000))));
    const error = await rejection(fetchCached("https://x.test/e", { ttl: 60 }));
    expect(String(error.body)).toHaveLength(8 * 1024);
  });

  it("does not retry a non-retryable status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(400, "{}"));
    vi.stubGlobal("fetch", fetchMock);
    await fetchCached("https://x.test/f", { ttl: 60 }).catch(() => undefined);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a retryable status up to three attempts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(503, "{}"));
    vi.stubGlobal("fetch", fetchMock);
    const error = await rejection(fetchCached("https://x.test/g", { ttl: 60 }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(503);
  });

  it("throws a plain Error for a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const error = await rejection(fetchCached("https://x.test/h", { ttl: 60 }));
    expect(error).not.toBeInstanceOf(HttpError);
    expect(error.message).toBe("network down");
  });
});
