import { describe, expect, it } from "vitest";
import { getDashboardData } from "@/lib/dashboard-data";
import { makeLeague, makeMatchup, makeRoster, makeSource, makeTwelveTeamLeague, makeUser } from "@/lib/test/fixtures";
import type { SleeperAccount } from "@/lib/types";

const account = (userId: string): SleeperAccount => ({ userId, username: "me", displayName: "Me", avatar: null, leagues: [] });

describe("getDashboardData", () => {
  it("sorts standings by wins then points-for, with a dense 1-based rank", async () => {
    const source = makeSource({
      getLeagueRosters: async () => [
        makeRoster({ roster_id: 1, owner_id: "U1", settings: { wins: 2, fpts: 200 } }),
        makeRoster({ roster_id: 2, owner_id: "U2", settings: { wins: 5, fpts: 100 } }),
        makeRoster({ roster_id: 3, owner_id: "U3", settings: { wins: 2, fpts: 300 } }),
      ],
      getLeagueUsers: async () => [makeUser({ user_id: "U1" }), makeUser({ user_id: "U2" }), makeUser({ user_id: "U3" })],
    });
    const { standings } = await getDashboardData("L1", undefined, undefined, source);
    expect(standings.map((row) => row.rosterId)).toEqual([2, 3, 1]);
    expect(standings.map((row) => row.rank)).toEqual([1, 2, 3]);
  });

  it("drops a matchup group with only one row", async () => {
    const { source } = makeTwelveTeamLeague({
      source: { getMatchups: async () => [makeMatchup({ matchup_id: 1, roster_id: 1 }), makeMatchup({ matchup_id: 1, roster_id: 7 }), makeMatchup({ matchup_id: 2, roster_id: 2 })] },
    });
    const { matchups } = await getDashboardData("L1", undefined, undefined, source);
    expect(matchups.map((pair) => pair.id)).toEqual([1]);
  });

  it("flips home and away so the connected account is always the home side", async () => {
    const { source, rosters, users, matchups } = makeTwelveTeamLeague();
    // Roster 7 is the away side of matchup 1 — the fixture pairs roster N with N + 6, in that order.
    expect(matchups.find((row) => row.roster_id === 7)?.matchup_id).toBe(1);
    const withAccount = { ...source, getNflLeaguesForUsername: async () => account(users[6].user_id) };
    const data = await getDashboardData("L1", "me", undefined, withAccount);
    expect(data.myRosterId).toBe(rosters[6].roster_id);
    expect(data.featuredMatchup?.home.rosterId).toBe(7);
    expect(data.featuredMatchup?.away.rosterId).toBe(1);
    expect(data.featuredMatchup?.homeScore).toBe(107);
  });

  it("falls back to the division ids found on rosters when the league configures none", async () => {
    const source = makeSource({
      getLeague: async () => makeLeague({ settings: { divisions: 0 } }),
      getLeagueRosters: async () => [makeRoster({ roster_id: 1, settings: { division: 3 } }), makeRoster({ roster_id: 2, settings: { division: 1 } })],
    });
    const { league } = await getDashboardData("L1", undefined, undefined, source);
    expect(league.divisions.map((division) => division.id)).toEqual([1, 3]);
  });

  it("leaves roster value null rather than throwing when RosterAudit fails", async () => {
    const { source } = makeTwelveTeamLeague({
      source: { getValues: async () => ({ ok: false, error: { kind: "upstream-unavailable", message: "down", retryable: true } }) },
    });
    const { standings } = await getDashboardData("L1", undefined, undefined, source);
    expect(standings).toHaveLength(12);
    expect(standings.every((row) => row.value === null)).toBe(true);
  });
});
