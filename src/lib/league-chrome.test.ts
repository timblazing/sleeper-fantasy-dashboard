import { describe, expect, it, vi } from "vitest";
import { getLeagueChrome } from "@/lib/league-chrome";
import { makeLeague, makeSource, makeState } from "@/lib/test/fixtures";

describe("getLeagueChrome", () => {
  it("reports the league type and dynasty flag from the league settings", async () => {
    const source = makeSource({ getLeague: async () => makeLeague({ name: "Dynasty Club", settings: { type: 2 } }) });
    await expect(getLeagueChrome("L1", source)).resolves.toEqual({ id: "L1", name: "Dynasty Club", season: "2025", type: "Dynasty", isDynasty: true, isSuperflex: false, matchupWeek: 5, avatar: null });
  });

  it("falls back to week 1 for matchups outside the regular season", async () => {
    const source = makeSource({ getNflState: async () => makeState({ season_type: "pre", week: 3 }) });
    await expect(getLeagueChrome("L1", source)).resolves.toMatchObject({ type: "Redraft", isDynasty: false, matchupWeek: 1 });
  });

  // The player profile picks the superflex or the 1QB value by this flag. `sf ?? 1qb` was a
  // live bug (API reference §2.8), so the flag has to reach the page rather than be guessed.
  it("carries the superflex flag so value selection is preset-correct", async () => {
    const superflex = makeSource({ getLeague: async () => makeLeague({ roster_positions: ["QB", "RB", "WR", "TE", "SUPER_FLEX"] }) });
    await expect(getLeagueChrome("L1", superflex)).resolves.toMatchObject({ isSuperflex: true });
  });

  // The favicon and the sidebar badge are both keyed off this id, so it has to survive the mapping.
  it("carries the league avatar id through for the favicon and sidebar badge", async () => {
    const source = makeSource({ getLeague: async () => makeLeague({ avatar: "abc123" }) });
    await expect(getLeagueChrome("L1", source)).resolves.toMatchObject({ avatar: "abc123" });
  });

  it("does not read users or rosters — the layout renders on every page", async () => {
    const getLeagueUsers = vi.fn(async () => []);
    const getLeagueRosters = vi.fn(async () => []);
    await getLeagueChrome("L1", makeSource({ getLeagueUsers, getLeagueRosters }));
    expect(getLeagueUsers).not.toHaveBeenCalled();
    expect(getLeagueRosters).not.toHaveBeenCalled();
  });
});

describe("getLeagueChrome when the league cannot be read", () => {
  it("degrades to a named shell rather than throwing into the layout", async () => {
    const source = makeSource({ getLeague: async () => { throw new Error("404 Not Found"); } });
    await expect(getLeagueChrome("bad-id", source)).resolves.toEqual({ id: "bad-id", name: "League unavailable", season: "", type: "Redraft", isDynasty: false, isSuperflex: false, matchupWeek: 1, avatar: null });
  });
});
