import { describe, expect, it } from "vitest";
import { parseStoredAccount } from "@/lib/account-storage";

describe("parseStoredAccount", () => {
  it("parses a well-formed cookie", () => {
    expect(parseStoredAccount("bob:1180263650897608704")).toEqual({ username: "bob", leagueId: "1180263650897608704" });
  });

  it("round-trips a percent-encoded username containing a colon", () => {
    const encoded = `${encodeURIComponent("bo:b")}:1180263650897608704`;
    expect(parseStoredAccount(encoded)).toEqual({ username: "bo:b", leagueId: "1180263650897608704" });
  });

  it("round-trips a percent-encoded username containing a space", () => {
    const encoded = `${encodeURIComponent("bo b")}:1180263650897608704`;
    expect(parseStoredAccount(encoded)).toEqual({ username: "bo b", leagueId: "1180263650897608704" });
  });

  it("returns null for undefined", () => {
    expect(parseStoredAccount(undefined)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseStoredAccount("")).toBeNull();
  });

  it("returns null when the decoded leagueId would become a protocol-relative redirect", () => {
    expect(parseStoredAccount(`bob:${encodeURIComponent("//evil.example")}`)).toBeNull();
  });

  it("returns null when the decoded leagueId would traverse the upstream URL path", () => {
    expect(parseStoredAccount(`bob:${encodeURIComponent("../foo")}`)).toBeNull();
  });

  it("returns null without throwing for malformed username encoding", () => {
    const parse = () => parseStoredAccount("%E0%A4%A:1180263650897608704");

    expect(parse).not.toThrow();
    expect(parse()).toBeNull();
  });

  it("returns null without throwing for malformed leagueId encoding", () => {
    const parse = () => parseStoredAccount("bob:%E0%A4%A");

    expect(parse).not.toThrow();
    expect(parse()).toBeNull();
  });

  it("returns null when a valid username has no valid league segment", () => {
    expect(parseStoredAccount("bob:")).toBeNull();
  });
});
