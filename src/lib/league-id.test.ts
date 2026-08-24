import { describe, expect, it } from "vitest";
import { isLeagueId } from "@/lib/league-id";

describe("isLeagueId", () => {
  it("accepts a realistic Sleeper id", () => {
    expect(isLeagueId("1180263650897608704")).toBe(true);
  });

  it("accepts hyphen and underscore", () => {
    expect(isLeagueId("league-id_1")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isLeagueId("")).toBe(false);
  });

  it("rejects a string longer than 64 characters", () => {
    expect(isLeagueId("a".repeat(65))).toBe(false);
  });

  it("rejects the cache-key separator", () => {
    expect(isLeagueId("a:b")).toBe(false);
  });

  it("rejects a value that would traverse the upstream URL path", () => {
    expect(isLeagueId("../state/nfl")).toBe(false);
  });

  it("rejects a value that would become a protocol-relative redirect", () => {
    expect(isLeagueId("//evil.example")).toBe(false);
  });

  it("rejects whitespace", () => {
    expect(isLeagueId("a b")).toBe(false);
  });

  it("rejects a percent-encoded slash", () => {
    expect(isLeagueId("a%2Fb")).toBe(false);
  });
});
