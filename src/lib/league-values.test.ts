import { describe, expect, it } from "vitest";
import { findTeamForUser, getLeagueValueContext } from "@/lib/league-values";
import { makeRoster, makeSource, makeState, makeTwelveTeamLeague, makeUser } from "@/lib/test/fixtures";

describe("getLeagueValueContext", () => {
  it("ranks teams by value and by points, densely and 1-based", async () => {
    const { source } = makeTwelveTeamLeague();
    const context = await getLeagueValueContext("L1", source);
    // The fixture gives roster N the Nth-highest player values and the Nth-most points.
    expect(context.teams.map((team) => team.valueRank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(context.teams.map((team) => team.rosterId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(context.teams.map((team) => team.powerRank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("computes room ranks across the whole league, not within a team", async () => {
    const { source } = makeTwelveTeamLeague();
    const context = await getLeagueValueContext("L1", source);
    const qbRanks = context.teams.map((team) => team.rooms.find((room) => room.position === "QB")?.rank);
    expect(qbRanks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const top = context.teams[0].rooms.find((room) => room.position === "QB");
    expect(top?.players).toBe(1);
    expect(top?.leagueAvg).toBeGreaterThan(0);
  });

  it("reports catalogReady and valuesReady as false when those reads fail", async () => {
    const source = makeSource({
      getPlayerCatalog: async () => { throw new Error("sleeper down"); },
      getValues: async () => ({ ok: false, error: { kind: "upstream-unavailable", message: "down", retryable: true } }),
      getLeagueRosters: async () => [makeRoster({ roster_id: 1, players: ["p1"] })],
      getLeagueUsers: async () => [makeUser()],
    });
    const context = await getLeagueValueContext("L1", source);
    expect(context.catalogReady).toBe(false);
    expect(context.valuesReady).toBe(false);
    expect(context.teams).toHaveLength(1);
    expect(context.teams[0].value).toBe(0);
  });
});

describe("findTeamForUser", () => {
  it("returns the owner's team, and null for a non-member", async () => {
    const { source } = makeTwelveTeamLeague();
    const context = await getLeagueValueContext("L1", source);
    expect(findTeamForUser(context, "U3")?.rosterId).toBe(3);
    expect(findTeamForUser(context, "not-in-league")).toBeNull();
    expect(findTeamForUser(context)).toBeNull();
  });
});

describe("matchupWeek", () => {
  it("keeps the live week for an unrecognized season_type, and drops to 1 only in the pre/off season", async () => {
    const week = async (season_type: string) =>
      (await getLeagueValueContext("L1", makeSource({ getNflState: async () => ({ ...makeState({ week: 7 }), season_type: season_type as "regular" }) }))).matchupWeek;
    expect(await week("regular")).toBe(7);
    expect(await week("post")).toBe(7);
    expect(await week("something-new")).toBe(7);
    expect(await week("pre")).toBe(1);
    expect(await week("off")).toBe(1);
  });
});

describe("loadValueMap", () => {
  const projections = (rows: { sleeperId: string; position: string; ppg: number }[]) => async () => ({
    ok: true as const,
    attribution: { text: "RosterAudit", url: "https://rosteraudit.com" },
    data: rows.map((row) => ({ ...row, name: row.sleeperId, team: null, age: null })),
  });

  it("prices a dynasty league off the market board and never touches the projections", async () => {
    let projectionsRead = false;
    const { source } = makeTwelveTeamLeague({
      source: { getProjectedPpg: async () => { projectionsRead = true; throw new Error("must not be read"); } },
    });
    const context = await getLeagueValueContext("L1", source);
    expect(context.basis).toBe("dynasty");
    // The fixture's 1QB market value for roster 1's first player.
    expect(context.values.get("p11")).toBe(890);
    expect(projectionsRead).toBe(false);
  });

  // The regression the redraft basis exists to prevent: a redraft league reading dynasty values.
  it("prices a redraft league off the projection board and never touches the market values", async () => {
    let marketRead = false;
    const { source } = makeTwelveTeamLeague({
      league: { roster_positions: ["QB", "RB", "WR"], settings: { type: 0, num_teams: 12 } },
      source: {
        getValues: async () => { marketRead = true; throw new Error("must not be read"); },
        getProjectedPpg: projections([
          { sleeperId: "p11", position: "QB", ppg: 24 },
          ...Array.from({ length: 12 }, (_, index) => ({ sleeperId: `qb${index}`, position: "QB", ppg: 20 - index })),
        ]),
      },
    });
    const context = await getLeagueValueContext("L1", source);
    expect(context.basis).toBe("redraft");
    // 12 teams × 1 starting QB, so the 12th-best quarterback on the board (10 ppg) is
    // replacement level, and the 24 ppg starter is worth the 14 points he clears it by.
    expect(context.values.get("p11")).toBe(14);
    expect(context.values.get("p12")).toBeUndefined();
    expect(marketRead).toBe(false);
  });

  it("degrades to no values when the projection board is unavailable", async () => {
    const { source } = makeTwelveTeamLeague({
      league: { settings: { type: 0, num_teams: 12 } },
      source: { getProjectedPpg: async () => ({ ok: false, error: { kind: "upstream-unavailable", message: "down", retryable: true } }) },
    });
    const context = await getLeagueValueContext("L1", source);
    expect(context.valuesReady).toBe(false);
    expect(context.teams.every((team) => team.value === 0)).toBe(true);
  });
});
