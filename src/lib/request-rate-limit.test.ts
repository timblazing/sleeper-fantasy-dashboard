import { describe, expect, it } from "vitest";
import {
  isRequestAllowed,
  resetRequestRateLimitForTests,
  REQUEST_RATE_LIMIT_MAX_KEYS,
  REQUEST_RATE_LIMIT_MAX_REQUESTS,
  REQUEST_RATE_LIMIT_WINDOW_MS,
} from "@/lib/request-rate-limit";

describe("isRequestAllowed", () => {
  it("accepts the first request", () => {
    resetRequestRateLimitForTests();

    expect(isRequestAllowed("client-a", 1_000)).toBe(true);
  });

  it("accepts requests up to the configured maximum and rejects the next one", () => {
    resetRequestRateLimitForTests();

    for (let request = 0; request < REQUEST_RATE_LIMIT_MAX_REQUESTS; request += 1) {
      expect(isRequestAllowed("client-a", 1_000 + request)).toBe(true);
    }
    expect(isRequestAllowed("client-a", 2_000)).toBe(false);
  });

  it("allows a request after the sliding window expires", () => {
    resetRequestRateLimitForTests();

    for (let request = 0; request < REQUEST_RATE_LIMIT_MAX_REQUESTS; request += 1) {
      expect(isRequestAllowed("client-a", 1_000 + request)).toBe(true);
    }

    expect(isRequestAllowed("client-a", 1_000 + REQUEST_RATE_LIMIT_WINDOW_MS + 1)).toBe(true);
  });

  it("evicts stale keys", () => {
    resetRequestRateLimitForTests();

    for (let request = 0; request < REQUEST_RATE_LIMIT_MAX_REQUESTS; request += 1) {
      expect(isRequestAllowed("stale-client", 1_000 + request)).toBe(true);
    }

    const later = 1_000 + REQUEST_RATE_LIMIT_WINDOW_MS + 1;
    expect(isRequestAllowed("fresh-client", later)).toBe(true);
    expect(isRequestAllowed("stale-client", later)).toBe(true);
  });

  it("keeps the key map bounded by evicting the oldest key", () => {
    resetRequestRateLimitForTests();

    for (let request = 0; request < REQUEST_RATE_LIMIT_MAX_REQUESTS; request += 1) {
      expect(isRequestAllowed("oldest-client", 1_000 + request)).toBe(true);
    }
    for (let key = 1; key < REQUEST_RATE_LIMIT_MAX_KEYS; key += 1) {
      expect(isRequestAllowed(`client-${key}`, 2_000)).toBe(true);
    }

    expect(isRequestAllowed("new-client", 3_000)).toBe(true);
    expect(isRequestAllowed("oldest-client", 3_000)).toBe(true);
  });

  it("gives distinct keys independent budgets", () => {
    resetRequestRateLimitForTests();

    for (let request = 0; request < REQUEST_RATE_LIMIT_MAX_REQUESTS; request += 1) {
      expect(isRequestAllowed("client-a", 1_000 + request)).toBe(true);
    }

    expect(isRequestAllowed("client-a", 2_000)).toBe(false);
    expect(isRequestAllowed("client-b", 2_000)).toBe(true);
  });
});
