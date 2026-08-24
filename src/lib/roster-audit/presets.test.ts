import { describe, expect, it } from "vitest";
import { clampLeagueSize, derivePresetKey, resolvePreset } from "@/lib/roster-audit/presets";
import type { SleeperLeague } from "@/lib/types";
import type { RaPreset } from "@/lib/roster-audit/types";

function makeLeague(overrides: Partial<SleeperLeague> = {}): SleeperLeague {
  return {
    league_id: "1",
    name: "Test League",
    season: "2026",
    sport: "nfl",
    status: "in_season",
    avatar: null,
    previous_league_id: null,
    roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"],
    scoring_settings: { rec: 1 },
    settings: { num_teams: 12 },
    ...overrides,
  };
}

const availablePresets: RaPreset[] = [
  { key: "sf-ppr", label: "SF PPR", formatKey: "sf_ppr", isSuperflex: true, isTep: false, scoringFormat: "ppr", leagueSize: 12, reliable: true },
  { key: "sf-ppr-tep", label: "SF PPR TEP", formatKey: "sf_ppr_tep", isSuperflex: true, isTep: true, scoringFormat: "ppr", leagueSize: 12, reliable: true },
  { key: "1qb-ppr", label: "1QB PPR", formatKey: "1qb_ppr", isSuperflex: false, isTep: false, scoringFormat: "ppr", leagueSize: 12, reliable: true },
  { key: "1qb-ppr-tep", label: "1QB PPR TEP", formatKey: "1qb_ppr_tep", isSuperflex: false, isTep: true, scoringFormat: "ppr", leagueSize: 12, reliable: true },
];

describe("derivePresetKey", () => {
  it("returns sf-ppr for a Superflex PPR league", () => {
    const league = makeLeague({ roster_positions: ["QB", "SUPER_FLEX", "RB", "WR"], scoring_settings: { rec: 1 } });
    expect(derivePresetKey(league)).toBe("sf-ppr");
  });

  it("treats two QB entries with no SUPER_FLEX slot as Superflex-equivalent", () => {
    const league = makeLeague({ roster_positions: ["QB", "QB", "RB", "WR"], scoring_settings: { rec: 1 } });
    expect(derivePresetKey(league)).toBe("sf-ppr");
  });

  it("returns 1qb-ppr for a 1QB PPR league", () => {
    const league = makeLeague({ roster_positions: ["QB", "RB", "WR"], scoring_settings: { rec: 1 } });
    expect(derivePresetKey(league)).toBe("1qb-ppr");
  });

  it("returns the -tep variant when bonus_rec_te is present and positive", () => {
    const league = makeLeague({ roster_positions: ["QB", "SUPER_FLEX"], scoring_settings: { rec: 1, bonus_rec_te: 0.5 } });
    expect(derivePresetKey(league)).toBe("sf-ppr-tep");
  });

  it("does not treat bonus_rec_te: 0 as TEP", () => {
    const league = makeLeague({ roster_positions: ["QB", "SUPER_FLEX"], scoring_settings: { rec: 1, bonus_rec_te: 0 } });
    expect(derivePresetKey(league)).toBe("sf-ppr");
  });

  it("maps a half-PPR league to the -ppr preset family, since no half preset exists", () => {
    const league = makeLeague({ roster_positions: ["QB", "RB", "WR"], scoring_settings: { rec: 0.5 } });
    expect(derivePresetKey(league)).toBe("1qb-ppr");
  });
});

describe("resolvePreset", () => {
  it("returns the override preset when it matches an available preset", () => {
    const league = makeLeague({ roster_positions: ["QB", "RB", "WR"], scoring_settings: { rec: 1 } });
    const resolved = resolvePreset(league, "sf-ppr-tep", availablePresets);
    expect(resolved?.key).toBe("sf-ppr-tep");
  });

  it("falls back to the derived preset when the override is unknown", () => {
    const league = makeLeague({ roster_positions: ["QB", "RB", "WR"], scoring_settings: { rec: 1 } });
    const resolved = resolvePreset(league, "not-a-real-preset", availablePresets);
    expect(resolved?.key).toBe("1qb-ppr");
  });

  it("clamps league size of 20 to 16", () => {
    const league = makeLeague({ roster_positions: ["QB", "RB", "WR"], scoring_settings: { rec: 1 }, settings: { num_teams: 20 } });
    const resolved = resolvePreset(league, undefined, availablePresets);
    expect(resolved?.leagueSize).toBe(16);
  });
});

describe("clampLeagueSize", () => {
  it("clamps below 8 up to 8", () => {
    expect(clampLeagueSize(4)).toBe(8);
  });

  it("clamps above 16 down to 16", () => {
    expect(clampLeagueSize(20)).toBe(16);
  });

  it("leaves an in-range size unchanged", () => {
    expect(clampLeagueSize(12)).toBe(12);
  });
});
