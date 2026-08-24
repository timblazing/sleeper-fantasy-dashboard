import { describe, expect, it } from "vitest";
import { clearedInjuryQuery, hasActiveInjuryFilters, injuriesHref, parseInjuryQuery, serializeInjuryQuery, toggleSeverityHref } from "@/lib/injury-query";

const defaults = parseInjuryQuery({});

describe("parseInjuryQuery", () => {
  it("falls back to defaults for an empty or invalid query", () => {
    expect(defaults).toEqual({ position: "all", search: "", sort: "severity", severities: [], startersOnly: false, team: undefined, username: undefined });
    expect(parseInjuryQuery({ position: "LB", sort: "chaos", team: "-3", starters: "yes" })).toEqual(defaults);
  });

  it("reads both the repeated and the comma-joined status forms", () => {
    expect(parseInjuryQuery({ status: ["risk", "out"] }).severities).toEqual(["out", "risk"]);
    expect(parseInjuryQuery({ status: "watch,out" }).severities).toEqual(["out", "watch"]);
    // Unknown tiers are dropped rather than carried through as a filter that matches nothing.
    expect(parseInjuryQuery({ status: "out,sprained" }).severities).toEqual(["out"]);
  });

  it("trims and caps the search term", () => {
    expect(parseInjuryQuery({ search: "  mccaffrey  " }).search).toBe("mccaffrey");
    expect(parseInjuryQuery({ search: "x".repeat(80) }).search).toHaveLength(50);
  });

  it("takes the first value when a param is repeated", () => {
    expect(parseInjuryQuery({ position: ["RB", "WR"] }).position).toBe("RB");
  });
});

describe("serializeInjuryQuery", () => {
  it("omits every default so a clean URL stays clean", () => {
    expect(serializeInjuryQuery(defaults)).toBe("");
  });

  it("round-trips through parse", () => {
    const query = parseInjuryQuery({ position: "RB", search: "knee", sort: "value", status: "out,risk", starters: "1", team: "4", username: "clay" });
    expect(parseInjuryQuery(Object.fromEntries(new URLSearchParams(serializeInjuryQuery(query))))).toEqual(query);
  });

  it("normalizes severity order so equivalent URLs serialize identically", () => {
    expect(serializeInjuryQuery(defaults, { severities: ["watch", "out"] })).toBe(serializeInjuryQuery(defaults, { severities: ["out", "watch"] }));
  });

  it("keeps username through every other change", () => {
    const query = parseInjuryQuery({ username: "clay" });
    expect(injuriesHref("L1", query, { position: "TE" })).toBe("/L1/injuries?position=TE&username=clay");
  });
});

describe("toggleSeverityHref", () => {
  it("adds a tier that is off and removes one that is on", () => {
    const off = parseInjuryQuery({});
    expect(toggleSeverityHref("L1", off, "out")).toBe("/L1/injuries?status=out");
    const on = parseInjuryQuery({ status: "out" });
    expect(toggleSeverityHref("L1", on, "out")).toBe("/L1/injuries");
  });
});

describe("hasActiveInjuryFilters", () => {
  it("is false only for the untouched view", () => {
    expect(hasActiveInjuryFilters(defaults)).toBe(false);
    // A username identifies the reader; it is not a filter they can clear.
    expect(hasActiveInjuryFilters(parseInjuryQuery({ username: "clay" }))).toBe(false);
    expect(hasActiveInjuryFilters(parseInjuryQuery({ starters: "1" }))).toBe(true);
    expect(hasActiveInjuryFilters(parseInjuryQuery({ team: "2" }))).toBe(true);
  });

  it("clears every filter but keeps the reader's identity", () => {
    const cleared = clearedInjuryQuery(parseInjuryQuery({ position: "RB", starters: "1", team: "2", username: "clay" }));
    expect(hasActiveInjuryFilters(cleared)).toBe(false);
    expect(cleared.username).toBe("clay");
  });
});
