import { describe, expect, it } from "vitest";
import { getMatchupBoard } from "@/lib/matchup-detail";
import { makeTwelveTeamLeague } from "@/lib/test/fixtures";

describe("getMatchupBoard", () => {
  it("lists a roster with no matchup_id as a bye", async () => {
    const { source, matchups } = makeTwelveTeamLeague({
      source: { getMatchups: async () => matchups.map((row) => (row.roster_id === 4 ? { ...row, matchup_id: null } : row)) },
    });
    const board = await getMatchupBoard("L1", 5, source);
    expect(board.byes.map((team) => team.rosterId)).toContain(4);
    // Roster 10 lost its partner, so its group is a single row and it becomes a bye too.
    expect(board.byes.map((team) => team.rosterId)).toContain(10);
    expect(board.matchups).toHaveLength(5);
  });

  it("returns matchups ordered by id with both sides resolved", async () => {
    const { source } = makeTwelveTeamLeague();
    const board = await getMatchupBoard("L1", 5, source);
    expect(board.matchups.map((pair) => pair.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(board.matchups[0].home.team.name).toBe("Team 1");
    expect(board.matchups[0].away.team.name).toBe("Team 7");
    expect(board.matchups[0].home.score).toBe(101);
  });

  it("degrades rather than throws when the ESPN and projection feeds fail", async () => {
    const { source } = makeTwelveTeamLeague({
      source: {
        getWeekGamesByTeam: async () => { throw new Error("espn down"); },
        getWeekHomeAwayByTeam: async () => { throw new Error("espn down"); },
        getWeeklyProjections: async () => { throw new Error("projections down"); },
      },
    });
    const board = await getMatchupBoard("L1", 5, source);
    expect(board.matchups).toHaveLength(6);
    expect(board.matchups[0].home.projectedScore).toBeNull();
    expect(board.matchups[0].homeWinProbability).toBeNull();
    expect(board.matchups[0].home.slots.every((slot) => slot.game === null)).toBe(true);
    expect(board.matchups[0].home.slots.every((slot) => slot.projectionHome === null)).toBe(true);
  });

  it("marks a slot as away when ESPN has the player's team on the road", async () => {
    const { source } = makeTwelveTeamLeague({
      source: { getWeekHomeAwayByTeam: async () => new Map([["KC", false]]) },
    });
    const board = await getMatchupBoard("L1", 5, source);
    expect(board.matchups[0].home.slots[0].projectionHome).toBe(false);
  });

  it("leaves the side unknown when ESPN has no game for the player's team", async () => {
    const { source } = makeTwelveTeamLeague({
      source: { getWeekHomeAwayByTeam: async () => new Map([["SF", true]]) },
    });
    const board = await getMatchupBoard("L1", 5, source);
    expect(board.matchups[0].home.slots[0].projectionHome).toBeNull();
  });

  it("returns no matchups when the week's rows are unavailable", async () => {
    const { source } = makeTwelveTeamLeague({ source: { getMatchups: async () => { throw new Error("sleeper down"); } } });
    const board = await getMatchupBoard("L1", 5, source);
    expect(board.matchups).toEqual([]);
    expect(board.byes).toEqual([]);
  });
});
