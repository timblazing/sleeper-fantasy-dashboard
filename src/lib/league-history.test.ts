import { describe, expect, test } from "vitest";
import { getLeagueHistory } from "@/lib/league-history";
import { makeLeague, makeMatchup, makeRoster, makeSource, makeState, makeUser } from "@/lib/test/fixtures";
import type { SleeperBracketGame, SleeperLeague, SleeperMatchup } from "@/lib/types";

/**
 * A two-season, four-team league. Season 2024 is the older half of the chain and 2025 the current
 * one, so a test can assert both the per-season split and the all-time rollup.
 */
function makeHistorySource(overrides: { bracket2025?: SleeperBracketGame[]; status2025?: string } = {}) {
  const owners = ["U1", "U2", "U3", "U4"];
  const users = owners.map((id, index) =>
    makeUser({ user_id: id, display_name: `Manager ${index + 1}`, username: `manager${index + 1}`, metadata: { team_name: `Team ${index + 1}` } }),
  );
  const rosters = owners.map((id, index) => makeRoster({ roster_id: index + 1, owner_id: id }));

  const leagues: Record<string, SleeperLeague> = {
    L2025: makeLeague({ league_id: "L2025", season: "2025", status: overrides.status2025 ?? "complete", previous_league_id: "L2024", settings: { num_teams: 4, playoff_week_start: 3 } }),
    L2024: makeLeague({ league_id: "L2024", season: "2024", status: "complete", previous_league_id: null, settings: { num_teams: 4, playoff_week_start: 3 } }),
  };

  // Week 1 and 2 are the regular season; roster 1 wins both years, roster 4 loses both.
  const week = (scores: [number, number, number, number]): SleeperMatchup[] => [
    makeMatchup({ matchup_id: 1, roster_id: 1, points: scores[0] }),
    makeMatchup({ matchup_id: 1, roster_id: 2, points: scores[1] }),
    makeMatchup({ matchup_id: 2, roster_id: 3, points: scores[2] }),
    makeMatchup({ matchup_id: 2, roster_id: 4, points: scores[3] }),
  ];

  const matchups: Record<string, Record<number, SleeperMatchup[]>> = {
    L2024: { 1: week([120, 100, 110, 90]), 2: week([130, 110, 105, 95]) },
    L2025: { 1: week([140, 90, 115, 100]), 2: week([150, 95, 120, 80]) },
  };

  // Roster 1 beats roster 3 for the title; roster 2 beats roster 4 for third.
  const bracket: SleeperBracketGame[] = [
    { m: 1, r: 1, t1: 1, t2: 3, w: 1, l: 3, p: 1 },
    { m: 2, r: 1, t1: 2, t2: 4, w: 2, l: 4, p: 3 },
  ];

  return makeSource({
    getNflState: async () => makeState({ season: "2025", week: 3, display_week: 3 }),
    getLeague: async (id: string) => leagues[id] ?? (() => { throw new Error(`no league ${id}`); })(),
    getLeagueUsers: async () => users,
    getLeagueRosters: async () => rosters,
    getMatchups: async (id: string, wk: number) => matchups[id]?.[wk] ?? [],
    getWinnersBracket: async (id: string) => (id === "L2025" ? overrides.bracket2025 ?? bracket : bracket),
    getLosersBracket: async () => [],
  });
}

describe("getLeagueHistory", () => {
  test("walks previous_league_id and rolls both seasons into one record", async () => {
    const history = await getLeagueHistory("L2025", makeHistorySource());

    expect(history.seasons.map((season) => season.season)).toEqual(["2025", "2024"]);
    expect(history.singleSeason).toBe(false);

    // Roster 1 won all four regular-season games across the two seasons.
    const best = history.managers[0];
    expect(best.name).toBe("Team 1");
    expect([best.wins, best.losses]).toEqual([4, 0]);
    expect(best.winPct).toBe(1);
    expect(best.pointsFor).toBe(120 + 130 + 140 + 150);
    expect(best.pointsPerGame).toBeCloseTo(135, 5);
  });

  test("reads final placements off the bracket's placement games", async () => {
    const history = await getLeagueHistory("L2025", makeHistorySource());
    const byName = new Map(history.managers.map((row) => [row.name, row]));

    // `p: 1` means winner finished 1st and loser 2nd; `p: 3` means 3rd and 4th.
    expect(byName.get("Team 1")?.seasons.find((s) => s.season === "2025")?.finalRank).toBe(1);
    expect(byName.get("Team 3")?.seasons.find((s) => s.season === "2025")?.finalRank).toBe(2);
    expect(byName.get("Team 2")?.seasons.find((s) => s.season === "2025")?.finalRank).toBe(3);
    expect(byName.get("Team 4")?.seasons.find((s) => s.season === "2025")?.finalRank).toBe(4);

    // Two titles for roster 1 — one per season.
    expect(byName.get("Team 1")?.championships).toBe(2);
  });

  test("leaves an in-progress season without a final placement", async () => {
    const history = await getLeagueHistory("L2025", makeHistorySource({ status2025: "in_season" }));
    const team1 = history.managers.find((row) => row.name === "Team 1");

    expect(team1?.seasons.find((season) => season.season === "2025")?.finalRank).toBeNull();
    // The finished 2024 season still resolves.
    expect(team1?.seasons.find((season) => season.season === "2024")?.finalRank).toBe(1);
    expect(team1?.championships).toBe(1);
  });

  test("builds the head-to-head grid from both directions of every game", async () => {
    const history = await getLeagueHistory("L2025", makeHistorySource());

    // Roster 1 played roster 2 four times in the regular season and won them all.
    expect(history.headToHead.get("U1:U2")).toEqual({ wins: 4, losses: 0, ties: 0 });
    expect(history.headToHead.get("U2:U1")).toEqual({ wins: 0, losses: 4, ties: 0 });
  });

  test("derives the record book from the full game log", async () => {
    const { records, topScores, lowScores } = await getLeagueHistory("L2025", makeHistorySource());

    expect(records.mostPointsSeason).toMatchObject({ name: "Team 1", season: "2025", points: 290 });
    expect(records.bestRecord).toMatchObject({ name: "Team 1", wins: 2, losses: 0 });
    expect(records.longestWinStreak).toMatchObject({ name: "Team 1", length: 2 });
    // The single widest margin: 150 - 95 in 2025 week 2.
    expect(records.biggestBlowout).toMatchObject({ margin: 55, winnerName: "Team 1", loserName: "Team 2" });
    expect(topScores[0]).toMatchObject({ name: "Team 1", points: 150 });
    expect(lowScores[0]).toMatchObject({ name: "Team 4", points: 80 });
  });

  test("counts wins above expected against the whole league, not just the opponent", async () => {
    const history = await getLeagueHistory("L2025", makeHistorySource());
    const best = history.managers.find((row) => row.name === "Team 1");

    // Roster 1 was the top scorer every week, so its four wins were all deserved.
    expect(best?.winsAboveExpected).toBeCloseTo(0, 5);
    expect(best?.managerEfficiency).toBe(1);
  });

  test("survives a season whose upstream reads fail", async () => {
    const source = makeHistorySource();
    const history = await getLeagueHistory(
      "L2025",
      { ...source, getWinnersBracket: async () => { throw new Error("bracket down"); } },
    );

    // Records still resolve; only the placements are missing.
    expect(history.managers.length).toBe(4);
    expect(history.managers[0].seasons.every((season) => season.finalRank === null)).toBe(true);
  });
});
