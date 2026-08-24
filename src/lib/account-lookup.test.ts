import { describe, expect, it } from "vitest";
import { classifyLookupFailure } from "@/lib/account-lookup";
import { HttpError } from "@/lib/fetch-cached";

describe("classifyLookupFailure", () => {
  it("maps a 429 to a rate-limit message", () => {
    expect(classifyLookupFailure(new HttpError(429, "Too Many Requests", "https://api.sleeper.app/v1/user/x", undefined))).toEqual({
      status: 429,
      error: "Sleeper is rate limiting us right now. Wait a moment and try again.",
    });
  });

  it("maps a 503 to an outage message", () => {
    expect(classifyLookupFailure(new HttpError(503, "Service Unavailable", "https://api.sleeper.app/v1/user/x", undefined))).toEqual({
      status: 503,
      error: "Sleeper is unavailable right now. This isn't your username — try again in a few minutes.",
    });
  });

  it("maps a 500 to an outage message", () => {
    expect(classifyLookupFailure(new HttpError(500, "Internal Server Error", "https://api.sleeper.app/v1/user/x", undefined))).toEqual({
      status: 503,
      error: "Sleeper is unavailable right now. This isn't your username — try again in a few minutes.",
    });
  });

  it("maps a 404 to the spelling message", () => {
    expect(classifyLookupFailure(new HttpError(404, "Not Found", "https://api.sleeper.app/v1/user/x", undefined))).toEqual({
      status: 404,
      error: "We couldn't find that Sleeper username. Check the spelling and try again.",
    });
  });

  it("maps an unrecognized HttpError status to a generic upstream message", () => {
    expect(classifyLookupFailure(new HttpError(418, "I'm a teapot", "https://api.sleeper.app/v1/user/x", undefined))).toEqual({
      status: 502,
      error: "Sleeper returned an unexpected response. Try again in a few minutes.",
    });
  });

  it("maps the missing-user message to the spelling message", () => {
    expect(classifyLookupFailure(new Error("Sleeper user not found"))).toEqual({
      status: 404,
      error: "We couldn't find that Sleeper username. Check the spelling and try again.",
    });
  });

  it("maps the missing-season message to an outage message", () => {
    expect(classifyLookupFailure(new Error("The current NFL season is unavailable"))).toEqual({
      status: 503,
      error: "Sleeper is unavailable right now. This isn't your username — try again in a few minutes.",
    });
  });

  it("maps an unrecognized plain Error to a generic connection message", () => {
    expect(classifyLookupFailure(new Error("socket hang up"))).toEqual({
      status: 502,
      error: "We couldn't reach Sleeper. Check your connection and try again.",
    });
  });

  it("maps a non-Error throw to a generic connection message", () => {
    expect(classifyLookupFailure("boom")).toEqual({
      status: 502,
      error: "We couldn't reach Sleeper. Check your connection and try again.",
    });
  });

  it("prefers the HttpError status over message matching (the bug this plan fixes)", () => {
    // Before this plan, every failure — including a 503 HttpError — collapsed to 404 "check
    // the spelling". This asserts the fix directly: a 503 HttpError must stay 503, not 404.
    const result = classifyLookupFailure(new HttpError(503, "Service Unavailable", "https://api.sleeper.app/v1/user/x", undefined));
    expect(result.status).toBe(503);
    expect(result.status).not.toBe(404);
  });
});
