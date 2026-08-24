import { describe, expect, it } from "vitest";

import { buildSchedule, simulatePlayoffPath, simulatePlayoffs, winProbability, type ScheduledGame } from "@/lib/playoff-odds";
import { makeMatchup } from "@/lib/test/fixtures";
import type { LeagueTeam } from "@/lib/league-values";

function makeTeam(overrides: Partial<LeagueTeam> & { rosterId: number }): LeagueTeam {
  return {
    ownerId: `U${overrides.rosterId}`,
    name: `Team ${overrides.rosterId}`,
    manager: `Manager ${overrides.rosterId}`,
    avatar: null,
    wins: 0, losses: 0, ties: 0,
    pointsFor: 0, pointsAgainst: 0,
    value: 0, valueRank: 1, powerRank: 1,
    rooms: [], roster: [], starters: [], taxi: [], reserve: [], players: [],
    ...overrides,
  };
}

/** A round-robin over `weeks` weeks for the given roster ids, none of it played yet. */
function roundRobin(ids: number[], weeks: number): ScheduledGame[] {
  const games: ScheduledGame[] = [];
  for (let week = 1; week <= weeks; week += 1) {
    for (let index = 0; index < ids.length / 2; index += 1) {
      const home = ids[index];
      const away = ids[ids.length - 1 - index];
      games.push({ week, home, away, homeScore: 0, awayScore: 0, played: false });
    }
  }
  return games;
}

describe("buildSchedule", () => {
  it("pairs teams sharing a matchup id and marks past weeks with points as played", () => {
    const weeks = [
      { week: 1, matchups: [
        makeMatchup({ matchup_id: 1, roster_id: 2, points: 101 }),
        makeMatchup({ matchup_id: 1, roster_id: 1, points: 99 }),
      ] },
      { week: 2, matchups: [
        makeMatchup({ matchup_id: 1, roster_id: 1, points: 0 }),
        makeMatchup({ matchup_id: 1, roster_id: 2, points: 0 }),
      ] },
    ];

    const schedule = buildSchedule(weeks, 2);

    expect(schedule).toHaveLength(2);
    // Lower roster id becomes home regardless of payload order.
    expect(schedule[0]).toMatchObject({ week: 1, home: 1, away: 2, homeScore: 99, awayScore: 101, played: true });
    // Week 2 is the current week, so it has not been played.
    expect(schedule[1]).toMatchObject({ week: 2, played: false });
  });

  it("skips byes and unpaired entries", () => {
    const weeks = [{ week: 1, matchups: [
      makeMatchup({ matchup_id: null, roster_id: 1, points: 0 }),
      makeMatchup({ matchup_id: 5, roster_id: 2, points: 0 }),
    ] }];

    expect(buildSchedule(weeks, 5)).toEqual([]);
  });
});

describe("winProbability", () => {
  it("is even between equal teams and rises with the scoring edge", () => {
    expect(winProbability(110, 110)).toBeCloseTo(50, 5);
    expect(winProbability(120, 100)).toBeGreaterThan(60);
    expect(winProbability(100, 120)).toBeLessThan(40);
    // Fantasy variance keeps even a large edge well short of certainty.
    expect(winProbability(140, 100)).toBeLessThan(90);
  });

  it("is symmetric", () => {
    expect(winProbability(118, 104) + winProbability(104, 118)).toBeCloseTo(100, 5);
  });
});

describe("simulatePlayoffs", () => {
  const ids = [1, 2, 3, 4, 5, 6, 7, 8];

  it("gives every team a probability set that sums correctly", () => {
    const teams = ids.map((rosterId) => makeTeam({ rosterId, value: 1000 - rosterId * 10, valueRank: rosterId, powerRank: rosterId }));
    const result = simulatePlayoffs(teams, roundRobin(ids, 12), { playoffTeams: 4, divisions: 0, simulations: 2000 });

    expect(result.size).toBe(8);

    const totalPlayoff = [...result.values()].reduce((sum, row) => sum + row.playoffOdds, 0);
    const totalTitle = [...result.values()].reduce((sum, row) => sum + row.titleOdds, 0);
    // Exactly four teams make the bracket in every run, and exactly one wins it.
    expect(totalPlayoff).toBeCloseTo(400, 0);
    expect(totalTitle).toBeCloseTo(100, 0);

    for (const row of result.values()) {
      expect(row.seedOdds.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 0);
      expect(row.titleOdds).toBeLessThanOrEqual(row.playoffOdds + 0.001);
      expect(row.winRange[0]).toBeLessThanOrEqual(row.winRange[1]);
    }
  });

  it("ranks a stronger roster above a weaker one", () => {
    const teams = ids.map((rosterId) => makeTeam({ rosterId, value: 1000 - rosterId * 100, valueRank: rosterId, powerRank: rosterId }));
    const result = simulatePlayoffs(teams, roundRobin(ids, 12), { playoffTeams: 4, divisions: 0, simulations: 3000 });

    const best = result.get(1);
    const worst = result.get(8);
    expect(best!.playoffOdds).toBeGreaterThan(worst!.playoffOdds);
    expect(best!.titleOdds).toBeGreaterThan(worst!.titleOdds);
    expect(best!.averageSeed).toBeLessThan(worst!.averageSeed);
  });

  it("treats an identical league as a coin flip", () => {
    const teams = ids.map((rosterId) => makeTeam({ rosterId, value: 500, valueRank: 1, powerRank: 1 }));
    const result = simulatePlayoffs(teams, roundRobin(ids, 12), { playoffTeams: 4, divisions: 0, simulations: 4000 });

    for (const row of result.values()) {
      // Four of eight equal teams advance, so everyone sits near 50%.
      expect(row.playoffOdds).toBeGreaterThan(40);
      expect(row.playoffOdds).toBeLessThan(60);
      expect(row.titleOdds).toBeGreaterThan(5);
      expect(row.titleOdds).toBeLessThan(20);
    }
  });

  it("locks in a team that has already clinched and eliminates one that cannot catch up", () => {
    // The season is over: no games remain, so the standings are final.
    const teams = ids.map((rosterId) => makeTeam({
      rosterId,
      wins: 13 - rosterId,
      losses: rosterId,
      pointsFor: 1500 - rosterId * 50,
      value: 500,
      valueRank: rosterId,
      powerRank: rosterId,
    }));
    const played: ScheduledGame[] = [{ week: 1, home: 1, away: 2, homeScore: 100, awayScore: 90, played: true }];
    const result = simulatePlayoffs(teams, played, { playoffTeams: 4, divisions: 0, simulations: 500 });

    expect(result.get(1)!.playoffOdds).toBe(100);
    expect(result.get(1)!.outlook).toBe("locked");
    expect(result.get(8)!.playoffOdds).toBe(0);
    expect(result.get(8)!.outlook).toBe("eliminated");
  });

  it("is deterministic for a given seed", () => {
    const teams = ids.map((rosterId) => makeTeam({ rosterId, value: 1000 - rosterId * 10, valueRank: rosterId, powerRank: rosterId }));
    const schedule = roundRobin(ids, 12);
    const options = { playoffTeams: 4, divisions: 0, simulations: 1000, seed: 42 };

    const first = simulatePlayoffs(teams, schedule, options);
    const second = simulatePlayoffs(teams, schedule, options);

    expect([...first.values()].map((row) => row.titleOdds)).toEqual([...second.values()].map((row) => row.titleOdds));
  });

  it("seeds division winners ahead of better-record wildcards", () => {
    // Roster 4 wins the weak division 2 outright despite the worst record in the league.
    const teams = [1, 2, 3, 4].map((rosterId) => makeTeam({
      rosterId,
      wins: rosterId === 4 ? 1 : 10,
      losses: rosterId === 4 ? 12 : 3,
      pointsFor: rosterId === 4 ? 900 : 1400,
      value: 500, valueRank: rosterId, powerRank: rosterId,
    }));
    const divisionByRoster = new Map([[1, 1], [2, 1], [3, 1], [4, 2]]);
    const result = simulatePlayoffs(teams, [{ week: 1, home: 1, away: 2, homeScore: 100, awayScore: 90, played: true }], {
      playoffTeams: 2, divisions: 2, divisionByRoster, simulations: 200,
    });

    // Both division winners are seeded 1-2, so the lone division-2 team always makes it.
    expect(result.get(4)!.playoffOdds).toBe(100);
  });
});

describe("simulatePlayoffPath", () => {
  const ids = [1, 2, 3, 4, 5, 6];
  const options = { playoffTeams: 4, divisions: 0, simulations: 500, seed: 7 };

  it("returns null for a roster that is not in the league", () => {
    const teams = ids.map((rosterId) => makeTeam({ rosterId }));
    expect(simulatePlayoffPath(teams, roundRobin(ids, 10), 99, options)).toBeNull();
  });

  it("reports title odds conditional on qualifying, which exceed the unconditional odds", () => {
    const teams = ids.map((rosterId) => makeTeam({ rosterId, value: 1000 - rosterId * 40, valueRank: rosterId, powerRank: rosterId }));
    const path = simulatePlayoffPath(teams, roundRobin(ids, 10), 1, options)!;

    expect(path.titleOdds).toBeGreaterThan(0);
    expect(path.titleOddsIfQualified).toBeGreaterThan(path.titleOdds);
    // Conditioning on qualification cannot manufacture more title runs than the raw count.
    expect(path.titleOddsIfQualified).toBeLessThanOrEqual(100);
  });

  it("records every bracket round as a survival step that only narrows", () => {
    const teams = ids.map((rosterId) => makeTeam({ rosterId, value: 1000 - rosterId * 40, valueRank: rosterId, powerRank: rosterId }));
    const path = simulatePlayoffPath(teams, roundRobin(ids, 10), 1, options)!;

    expect(path.rounds.length).toBeGreaterThan(0);
    const reaches = path.rounds.map((round) => round.reachOdds);
    expect(reaches).toEqual([...reaches].toSorted((a, b) => b - a));
  });

  it("names the opponents met in the bracket, never the team itself", () => {
    const teams = ids.map((rosterId) => makeTeam({ rosterId, value: 1000 - rosterId * 40, valueRank: rosterId, powerRank: rosterId }));
    const path = simulatePlayoffPath(teams, roundRobin(ids, 10), 1, options)!;

    expect(path.threats.length).toBeGreaterThan(0);
    expect(path.threats.some((threat) => threat.rosterId === 1)).toBe(false);
    for (const threat of path.threats) {
      expect(threat.meetOdds).toBeGreaterThan(0);
      expect(threat.beatOdds).toBeGreaterThanOrEqual(0);
      expect(threat.beatOdds).toBeLessThanOrEqual(100);
    }
  });

  it("agrees with the odds run on how often the team qualifies", () => {
    const teams = ids.map((rosterId) => makeTeam({ rosterId, value: 1000 - rosterId * 40, valueRank: rosterId, powerRank: rosterId }));
    const schedule = roundRobin(ids, 10);
    const odds = simulatePlayoffs(teams, schedule, options);
    const path = simulatePlayoffPath(teams, schedule, 1, options)!;

    // Both simulations draw from the same seeded stream, so qualification must match exactly.
    expect(path.playoffOdds).toBeCloseTo(odds.get(1)!.playoffOdds, 5);
  });
});
