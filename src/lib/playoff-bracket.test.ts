import { describe, expect, it } from "vitest";

import { buildBracket } from "@/lib/playoff-bracket";
import type { PlayoffRow } from "@/lib/playoff-odds";
import type { SleeperBracketGame } from "@/lib/types";

function makeRow(rosterId: number, averageSeed: number): PlayoffRow {
  return {
    rosterId,
    name: `Team ${rosterId}`,
    manager: `Manager ${rosterId}`,
    avatar: null,
    division: 0,
    isUser: false,
    wins: 0, losses: 0, ties: 0, pointsFor: 0,
    ppg: 110, playoffOdds: 50, titleOdds: 10, byeOdds: 10,
    averageSeed,
    projectedWins: 7, winRange: [5, 9], seedOdds: [], outlook: "bubble",
  };
}

/** The real shape Sleeper returns for a completed 6-team bracket. */
const COMPLETED: SleeperBracketGame[] = [
  { m: 1, r: 1, t1: 3, t2: 6, w: 6, l: 3 },
  { m: 2, r: 1, t1: 12, t2: 10, w: 10, l: 12 },
  { m: 3, r: 2, t1: 7, t2: 6, w: 7, l: 6 },
  { m: 4, r: 2, t1: 1, t2: 10, w: 10, l: 1 },
  { p: 5, m: 5, r: 2, t1: 3, t2: 12, w: 3, l: 12 },
  { p: 1, m: 6, r: 3, t1: 7, t2: 10, w: 7, l: 10 },
  { p: 3, m: 7, r: 3, t1: 6, t2: 1, w: 6, l: 1 },
];

const ROWS = [3, 6, 12, 10, 7, 1].map((id, index) => makeRow(id, index + 1));

describe("buildBracket", () => {
  it("returns null for a league with no published bracket", () => {
    expect(buildBracket([], ROWS, "winners")).toBeNull();
  });

  it("groups games into rounds and names them backwards from the final", () => {
    const bracket = buildBracket(COMPLETED, ROWS, "winners");
    expect(bracket?.rounds.map((round) => round.label)).toEqual(["Quarterfinal", "Semifinal", "Final"]);
  });

  it("labels placement games by the finish they decide", () => {
    const bracket = buildBracket(COMPLETED, ROWS, "winners");
    const finalRound = bracket?.rounds.at(-1);
    expect(finalRound?.games.map((game) => game.label)).toEqual(["Championship", "3rd place"]);
  });

  it("marks the winner and loser of a decided game", () => {
    const bracket = buildBracket(COMPLETED, ROWS, "winners");
    const championship = bracket?.rounds.at(-1)?.games[0];
    expect(championship?.home.rosterId).toBe(7);
    expect(championship?.home.won).toBe(true);
    expect(championship?.away.won).toBe(false);
    expect(championship?.played).toBe(true);
  });

  it("resolves seats to team identities and seeds them off average seed", () => {
    const bracket = buildBracket(COMPLETED, ROWS, "winners");
    const first = bracket?.rounds[0].games[0];
    expect(first?.home.name).toBe("Team 3");
    // Team 3 has the best average seed in ROWS, so it seeds first.
    expect(first?.home.seed).toBe(1);
  });

  it("describes an undecided seat by the game that feeds it", () => {
    const upcoming: SleeperBracketGame[] = [
      { m: 3, r: 2, t1: 10, t2: null, w: null, l: null },
      { p: 1, m: 6, r: 3, t1: null, t2: null, w: null, l: null, ...{ t1_from: { w: 3 }, t2_from: { l: 4 } } },
    ];
    const bracket = buildBracket(upcoming, ROWS, "winners");
    const final = bracket?.rounds.at(-1)?.games[0];
    expect(final?.home.from).toBe("Winner of G3");
    expect(final?.away.from).toBe("Loser of G4");
    expect(bracket?.started).toBe(false);
  });

  it("names the consolation bracket's title game as a consolation final", () => {
    const bracket = buildBracket(COMPLETED, ROWS, "losers");
    expect(bracket?.rounds.at(-1)?.games[0].label).toBe("Consolation final");
  });
});
