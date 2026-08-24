import { describe, expect, it } from "vitest";
import {
  hasActiveRankingsFilters,
  parseRankingsQuery,
  rankingsHref,
  serializeRankingsQuery,
  type RankingsQuery,
} from "@/lib/rankings-query";

const reparse = (serialized: string) =>
  parseRankingsQuery(Object.fromEntries(new URLSearchParams(serialized.replace(/^\?/, ""))));

describe("parseRankingsQuery", () => {
  it("produces defaults from an empty search-param object", () => {
    expect(parseRankingsQuery({})).toEqual({
      position: "all",
      search: "",
      sort: "value",
      minAge: undefined,
      maxAge: undefined,
      page: 1,
      username: undefined,
    });
  });

  it("falls back to defaults for invalid position, sort, and page instead of throwing", () => {
    const query = parseRankingsQuery({ position: "Kickers", sort: "vibes", page: "-3" });
    expect(query.position).toBe("all");
    expect(query.sort).toBe("value");
    expect(query.page).toBe(1);
  });

  // Scoring format is derived from the connected Sleeper league, never from the URL, so a
  // `preset` param is ignored rather than honoured — nobody can link someone into values
  // that do not match their own league.
  it("ignores a preset param entirely", () => {
    expect(serializeRankingsQuery(parseRankingsQuery({ preset: "1qb-ppr", position: "TE" }))).toBe("?position=TE");
  });

  it("clamps the age range and orders it", () => {
    const query = parseRankingsQuery({ minAge: "40", maxAge: "12" });
    expect(query.minAge).toBe(20);
    expect(query.maxAge).toBe(40);
  });

  it("reads the first value when a param is repeated and truncates a long search", () => {
    const query = parseRankingsQuery({ position: ["TE", "QB"], search: "x".repeat(80) });
    expect(query.position).toBe("TE");
    expect(query.search).toHaveLength(50);
  });
});

describe("serializeRankingsQuery", () => {
  const base: RankingsQuery = { position: "all", search: "", sort: "value", page: 1 };

  it("omits every default so a clean URL stays clean", () => {
    expect(serializeRankingsQuery(base)).toBe("");
  });

  it("resets page to 1 when the position changes", () => {
    const onPageNine: RankingsQuery = { ...base, page: 9 };
    expect(serializeRankingsQuery(onPageNine, { position: "TE" })).toBe("?position=TE");
  });

  it("resets page to 1 when the sort or age range changes", () => {
    const onPageNine: RankingsQuery = { ...base, page: 9 };
    expect(serializeRankingsQuery(onPageNine, { sort: "age" })).toBe("?sort=age");
    expect(serializeRankingsQuery(onPageNine, { minAge: 24 })).toBe("?minAge=24");
  });

  it("keeps the page when only the page changes", () => {
    expect(serializeRankingsQuery(base, { page: 4 })).toBe("?page=4");
  });

  it("preserves username across every filter change", () => {
    const withUser: RankingsQuery = { ...base, page: 9, username: "tim blazing" };
    expect(serializeRankingsQuery(withUser, { position: "QB" })).toBe("?position=QB&username=tim+blazing");
    expect(serializeRankingsQuery(withUser, { page: 2 })).toContain("username=tim+blazing");
  });

  it("round-trips through parseRankingsQuery", () => {
    const query: RankingsQuery = { position: "RB", search: "bijan", sort: "age", minAge: 22, maxAge: 30, page: 3, username: "tim" };
    expect(reparse(serializeRankingsQuery(query))).toEqual(query);
  });

  it("builds a players href rooted at the league", () => {
    expect(rankingsHref("1234", base, { position: "picks" })).toBe("/1234/players?position=picks");
  });
});

describe("hasActiveRankingsFilters", () => {
  it("is false for the default view and true once anything is filtered", () => {
    const base: RankingsQuery = { position: "all", search: "", sort: "value", page: 1 };
    expect(hasActiveRankingsFilters(base)).toBe(false);
    expect(hasActiveRankingsFilters({ ...base, search: "kyren" })).toBe(true);
  });
});
