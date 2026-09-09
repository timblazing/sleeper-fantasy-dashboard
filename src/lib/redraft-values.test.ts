import { describe, expect, it } from "vitest";
import { replacementLevels, starterCounts, toRedraftValues, type ProjectedPlayer } from "@/lib/redraft-values";
import { makeLeague } from "@/lib/test/fixtures";

const board = (rows: [string, string, number][]): ProjectedPlayer[] =>
  rows.map(([sleeperId, position, ppg]) => ({ sleeperId, position, ppg }));

/** N players at one position, descending by `step`, so a replacement level is easy to name. */
const ladder = (position: string, count: number, top: number, step = 1): ProjectedPlayer[] =>
  Array.from({ length: count }, (_, index) => ({ sleeperId: `${position}${index + 1}`, position, ppg: top - index * step }));

describe("starterCounts", () => {
  it("counts dedicated slots directly", () => {
    const league = makeLeague({ roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE", "K", "DEF", "BN", "BN"] });
    expect(starterCounts(league)).toEqual({ QB: 1, RB: 2, WR: 2, TE: 1 });
  });

  it("splits a FLEX across the positions that really fill it", () => {
    const league = makeLeague({ roster_positions: ["RB", "WR", "FLEX"] });
    expect(starterCounts(league)).toEqual({ QB: 0, RB: 1.45, WR: 1.45, TE: 0.1 });
  });

  it("treats a superflex slot as very nearly a second quarterback", () => {
    const league = makeLeague({ roster_positions: ["QB", "SUPER_FLEX"] });
    expect(starterCounts(league).QB).toBeCloseTo(1.9);
  });

  it("ignores bench, taxi and IR slots", () => {
    const league = makeLeague({ roster_positions: ["QB", "BN", "BN", "TAXI", "IR"] });
    expect(starterCounts(league)).toEqual({ QB: 1, RB: 0, WR: 0, TE: 0 });
  });
});

describe("replacementLevels", () => {
  it("is the last starter at the position across the whole league", () => {
    // 2 teams × 1 starting QB = the 2nd-best quarterback sets the bar.
    const league = makeLeague({ roster_positions: ["QB"], settings: { num_teams: 2 } });
    expect(replacementLevels(ladder("QB", 5, 25), league).QB).toBe(24);
  });

  it("falls back to the last ranked player when the board is shallower than the league", () => {
    const league = makeLeague({ roster_positions: ["QB"], settings: { num_teams: 12 } });
    expect(replacementLevels(ladder("QB", 3, 25), league).QB).toBe(23);
  });

  it("is zero at a position the board does not cover", () => {
    const league = makeLeague({ roster_positions: ["QB", "TE"], settings: { num_teams: 2 } });
    expect(replacementLevels(ladder("QB", 4, 25), league).TE).toBe(0);
  });
});

describe("toRedraftValues", () => {
  it("prices a player at his points above replacement, to a tenth", () => {
    const league = makeLeague({ roster_positions: ["QB"], settings: { num_teams: 2 } });
    const values = toRedraftValues(board([["a", "QB", 24.75], ["b", "QB", 20.25], ["c", "QB", 18]]), league);
    // Replacement is the 2nd QB at 20.25, so 24.75 → 4.5 and everyone below him → 0.
    expect(values.get("a")).toBe(4.5);
    expect(values.get("b")).toBe(0);
    expect(values.get("c")).toBe(0);
  });

  it("never returns a negative value", () => {
    const league = makeLeague({ roster_positions: ["RB"], settings: { num_teams: 2 } });
    for (const value of toRedraftValues(ladder("RB", 6, 20), league).values()) expect(value).toBeGreaterThanOrEqual(0);
  });

  /**
   * The whole reason redraft cannot reuse raw points per game: quarterbacks outscore receivers in
   * every format, so a 1QB league that ranked on PPG alone would say a manager's most valuable
   * asset is always his quarterback. Above replacement, the same board flips.
   */
  it("demotes quarterbacks in a 1QB league and promotes them in superflex", () => {
    // Slopes shaped like the real thing: quarterbacks outscore receivers at the top but the
    // receiver pool falls away faster, which is exactly what makes replacement level the deciding
    // number rather than the raw score.
    const rows = [...ladder("QB", 24, 24, 0.4), ...ladder("WR", 48, 18, 0.2)];
    const oneQb = toRedraftValues(rows, makeLeague({ roster_positions: ["QB", "WR", "WR"], settings: { num_teams: 12 } }));
    const superflex = toRedraftValues(rows, makeLeague({ roster_positions: ["QB", "WR", "WR", "SUPER_FLEX"], settings: { num_teams: 12 } }));

    expect(oneQb.get("QB1")!).toBeLessThan(oneQb.get("WR1")!);
    expect(superflex.get("QB1")!).toBeGreaterThan(superflex.get("WR1")!);
    expect(superflex.get("QB1")!).toBeGreaterThan(oneQb.get("QB1")!);
  });

  it("skips positions that get no room — kickers and defenses are not priced", () => {
    const league = makeLeague({ roster_positions: ["QB", "K", "DEF"], settings: { num_teams: 2 } });
    const values = toRedraftValues(board([["a", "QB", 25], ["k", "K", 9], ["d", "DEF", 8]]), league);
    expect(values.has("k")).toBe(false);
    expect(values.has("d")).toBe(false);
  });
});
