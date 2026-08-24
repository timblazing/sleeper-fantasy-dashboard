import { describe, expect, it } from "vitest";
import { collectTeamGames, getPowerRankings } from "@/lib/power-rankings";
import type { ScheduledGame } from "@/lib/playoff-odds";
import { makeMatchup, makeTwelveTeamLeague } from "@/lib/test/fixtures";

const game = (overrides: Partial<ScheduledGame> = {}): ScheduledGame =>
  ({ week: 1, home: 1, away: 2, homeScore: 100, awayScore: 90, played: true, ...overrides });

/**
 * Weekly matchups where roster N scores `base - N` every week, so roster 1 is the best
 * scorer and roster 12 the worst, and every pairing is decided the same way each week.
 */
function weeklyMatchups(week: number, scoreFor: (rosterId: number, week: number) => number) {
  return Array.from({ length: 12 }, (_, index) => index + 1).map((id) =>
    makeMatchup({ matchup_id: id > 6 ? id - 6 : id, roster_id: id, points: scoreFor(id, week) }),
  );
}

describe("collectTeamGames", () => {
  it("gives each roster its own scores and its opponents', oldest first", () => {
    const games = collectTeamGames(
      [game({ week: 1, home: 1, away: 2, homeScore: 100, awayScore: 90 }), game({ week: 2, home: 1, away: 3, homeScore: 80, awayScore: 120 })],
      [1, 2, 3],
    );

    expect(games.get(1)).toEqual({ scores: [100, 80], opponentScores: [90, 120], weeks: [1, 2] });
    expect(games.get(2)).toEqual({ scores: [90], opponentScores: [100], weeks: [1] });
    expect(games.get(3)).toEqual({ scores: [120], opponentScores: [80], weeks: [2] });
  });

  it("ignores weeks that have not been played", () => {
    const games = collectTeamGames([game({ week: 1 }), game({ week: 2, played: false })], [1, 2]);
    expect(games.get(1)?.scores).toEqual([100]);
  });

  it("returns an empty record for a roster with no games", () => {
    expect(collectTeamGames([], [7]).get(7)).toEqual({ scores: [], opponentScores: [], weeks: [] });
  });
});

describe("getPowerRankings", () => {
  it("ranks the best scorers first once the season is under way", async () => {
    const { source } = makeTwelveTeamLeague({
      league: { settings: { playoff_week_start: 15 } },
      source: {
        getNflState: async () => ({ season: "2025", week: 5, display_week: 5, season_type: "regular" }),
        getMatchups: async (_leagueId: string, week: number) => (week < 5 ? weeklyMatchups(week, (id) => 150 - id * 5) : []),
      },
    });

    const rankings = await getPowerRankings("L1", undefined, source);

    expect(rankings.started).toBe(true);
    expect(rankings.weeksPlayed).toBe(4);
    expect(rankings.rows).toHaveLength(12);
    expect(rankings.rows[0].rosterId).toBe(1);
    expect(rankings.rows.at(-1)?.rosterId).toBe(12);
    expect(rankings.rows.map((row) => row.rank)).toEqual([...Array(12).keys()].map((index) => index + 1));
  });

  it("scores ratings on 0-100 in descending order", async () => {
    const { source } = makeTwelveTeamLeague({
      source: {
        getNflState: async () => ({ season: "2025", week: 4, display_week: 4, season_type: "regular" }),
        getMatchups: async (_leagueId: string, week: number) => (week < 4 ? weeklyMatchups(week, (id) => 150 - id * 5) : []),
      },
    });

    const { rows } = await getPowerRankings("L1", undefined, source);

    for (const row of rows) {
      expect(row.rating).toBeGreaterThanOrEqual(0);
      expect(row.rating).toBeLessThanOrEqual(100);
    }
    expect(rows.map((row) => row.rating)).toEqual([...rows.map((row) => row.rating)].toSorted((a, b) => b - a));
  });

  it("falls back to roster value before any game is played", async () => {
    const { source } = makeTwelveTeamLeague({
      source: { getNflState: async () => ({ season: "2025", week: 1, display_week: 1, season_type: "pre" }) },
    });

    const rankings = await getPowerRankings("L1", undefined, source);

    expect(rankings.started).toBe(false);
    expect(rankings.weeksPlayed).toBe(0);
    // The fixture values roster 1 highest, so the value-only rating must order the league that way.
    expect(rankings.rows.map((row) => row.rosterId)).toEqual(rankings.rows.map((row) => row.valueRank));
    expect(rankings.rows.every((row) => row.delta === null)).toBe(true);
  });

  it("reports movement once two weeks have been played", async () => {
    // Roster 12 is dead last for three weeks, then posts the highest score in the league in
    // week 4 — its rank must improve, and someone else's must give way.
    const { source } = makeTwelveTeamLeague({
      source: {
        getNflState: async () => ({ season: "2025", week: 5, display_week: 5, season_type: "regular" }),
        getMatchups: async (_leagueId: string, week: number) =>
          week < 5 ? weeklyMatchups(week, (id) => (week === 4 && id === 12 ? 400 : 150 - id * 5)) : [],
      },
    });

    const { rows } = await getPowerRankings("L1", undefined, source);
    const climber = rows.find((row) => row.rosterId === 12);

    expect(climber?.delta).not.toBeNull();
    expect(climber!.delta!).toBeGreaterThan(0);
    expect(rows.some((row) => (row.delta ?? 0) < 0)).toBe(true);
  });

  it("tracks recent form separately from the season", async () => {
    const { source } = makeTwelveTeamLeague({
      source: {
        getNflState: async () => ({ season: "2025", week: 5, display_week: 5, season_type: "regular" }),
        getMatchups: async (_leagueId: string, week: number) => (week < 5 ? weeklyMatchups(week, (id) => 150 - id * 5) : []),
      },
    });

    const { rows, formWeeks } = await getPowerRankings("L1", undefined, source);

    expect(formWeeks).toBe(3);
    for (const row of rows) {
      expect(row.formResults).toHaveLength(3);
      // Rosters 1-6 outscore their 7-12 opponents every week in this fixture.
      expect(row.formResults.every(Boolean)).toBe(row.rosterId <= 6);
      expect(row.formRecord).toBe(row.rosterId <= 6 ? "3–0" : "0–3");
    }
  });

  it("marks luck as the gap between the standings and the power order", async () => {
    const { source } = makeTwelveTeamLeague({
      source: {
        getNflState: async () => ({ season: "2025", week: 5, display_week: 5, season_type: "regular" }),
        getMatchups: async (_leagueId: string, week: number) => (week < 5 ? weeklyMatchups(week, (id) => 150 - id * 5) : []),
      },
    });

    const { rows } = await getPowerRankings("L1", undefined, source);

    for (const row of rows) expect(row.luck).toBe(row.recordRank - row.rank);
  });

  it("neutralises the value component when RosterAudit has no data", async () => {
    const { source } = makeTwelveTeamLeague({
      source: {
        getNflState: async () => ({ season: "2025", week: 5, display_week: 5, season_type: "regular" }),
        getMatchups: async (_leagueId: string, week: number) => (week < 5 ? weeklyMatchups(week, (id) => 150 - id * 5) : []),
        getValues: async () => ({ ok: true, data: {}, attribution: { text: "RosterAudit", url: "https://rosteraudit.com" } }),
      },
    });

    const rankings = await getPowerRankings("L1", undefined, source);

    expect(rankings.hasValues).toBe(false);
    expect(rankings.rows.every((row) => row.parts.value === 50)).toBe(true);
  });

  it("survives a league whose weekly matchups fail to load", async () => {
    const { source } = makeTwelveTeamLeague({
      source: {
        getNflState: async () => ({ season: "2025", week: 6, display_week: 6, season_type: "regular" }),
        getMatchups: async () => { throw new Error("upstream down"); },
      },
    });

    const rankings = await getPowerRankings("L1", undefined, source);

    expect(rankings.rows).toHaveLength(12);
    expect(rankings.started).toBe(false);
  });
});
