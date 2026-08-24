import { describe, expect, it } from "vitest";
import { projectedWinProbability, scoreProjection } from "@/lib/projections";

describe("scoreProjection", () => {
  it("uses the league scoring multipliers", () => {
    expect(scoreProjection({ pass_yd: 250, pass_td: 2, pass_int: 1 }, { pass_yd: 0.04, pass_td: 4, pass_int: -2 })).toBe(16);
  });

  it("returns null when the player has no projection", () => {
    expect(scoreProjection(undefined, { rec: 1 })).toBeNull();
  });
});

describe("projectedWinProbability", () => {
  it("is even for equal projections", () => {
    expect(projectedWinProbability(125, 125)).toBe(50);
  });

  it("returns complementary matchup odds", () => {
    const home = projectedWinProbability(145, 115);
    const away = projectedWinProbability(115, 145);
    expect(home).toBeGreaterThan(50);
    expect(home + away).toBe(100);
  });
});
