import { describe, expect, it } from "vitest";
import { deriveLeagueFormat, describeLeagueType, isDynastyLeague, isSuperflexLeague } from "@/lib/league-features";
import type { SleeperLeague } from "@/lib/types";

const league = (settings: Record<string, number>, overrides: Partial<SleeperLeague> = {}): SleeperLeague => ({
  league_id: "1", name: "Test", season: "2026", sport: "nfl", status: "in_season", avatar: null,
  previous_league_id: null, roster_positions: ["QB", "RB", "WR"], scoring_settings: {}, settings, ...overrides,
});

describe("isDynastyLeague", () => {
  it("is true for settings.type 2", () => expect(isDynastyLeague(league({ type: 2 }))).toBe(true));
  it("is false for settings.type 1", () => expect(isDynastyLeague(league({ type: 1 }))).toBe(false));
  it("is false for settings.type 0", () => expect(isDynastyLeague(league({ type: 0 }))).toBe(false));
  it("fails closed when settings.type is missing", () => expect(isDynastyLeague(league({}))).toBe(false));
});

describe("describeLeagueType", () => {
  it("labels settings.type 2 as Dynasty", () => expect(describeLeagueType(league({ type: 2 }))).toBe("Dynasty"));
  it("labels settings.type 1 as Keeper", () => expect(describeLeagueType(league({ type: 1 }))).toBe("Keeper"));
  it("labels settings.type 0 as Redraft", () => expect(describeLeagueType(league({ type: 0 }))).toBe("Redraft"));
  it("falls back to Redraft when settings.type is missing", () => expect(describeLeagueType(league({}))).toBe("Redraft"));
  it("falls back to Redraft for an unknown settings.type", () => expect(describeLeagueType(league({ type: 7 }))).toBe("Redraft"));
});

describe("isSuperflexLeague", () => {
  it("is true for a SUPER_FLEX slot", () =>
    expect(isSuperflexLeague(league({}, { roster_positions: ["QB", "RB", "SUPER_FLEX"] }))).toBe(true));
  it("is true for two QB slots with no SUPER_FLEX", () =>
    expect(isSuperflexLeague(league({}, { roster_positions: ["QB", "QB", "RB"] }))).toBe(true));
  it("is false for one QB and no SUPER_FLEX", () =>
    expect(isSuperflexLeague(league({}, { roster_positions: ["QB", "RB", "WR"] }))).toBe(false));
});

describe("deriveLeagueFormat", () => {
  it("keys a 1QB PPR league as 1qb-ppr", () => {
    const format = deriveLeagueFormat(league({ type: 0 }));
    expect(format.presetKey).toBe("1qb-ppr");
    expect(format.superflex).toBe(false);
    expect(format.tePremium).toBe(false);
  });

  it("keys a superflex league as sf-ppr", () =>
    expect(deriveLeagueFormat(league({}, { roster_positions: ["QB", "SUPER_FLEX"] })).presetKey).toBe("sf-ppr"));

  it("appends -tep when bonus_rec_te is positive", () => {
    const format = deriveLeagueFormat(league({}, { scoring_settings: { bonus_rec_te: 0.5 } }));
    expect(format.tePremium).toBe(true);
    expect(format.presetKey.endsWith("-tep")).toBe(true);
  });

  it("does not append -tep when bonus_rec_te is zero or missing", () => {
    expect(deriveLeagueFormat(league({}, { scoring_settings: { bonus_rec_te: 0 } })).tePremium).toBe(false);
    expect(deriveLeagueFormat(league({})).presetKey).toBe("1qb-ppr");
  });

  it("expresses formatKey as the underscore form of presetKey", () => {
    const format = deriveLeagueFormat(league({}, { roster_positions: ["QB", "SUPER_FLEX"], scoring_settings: { bonus_rec_te: 1 } }));
    expect(format.presetKey).toBe("sf-ppr-tep");
    expect(format.formatKey).toBe("sf_ppr_tep");
  });

  it("carries the dynasty flag and type label", () => {
    expect(deriveLeagueFormat(league({ type: 2 }))).toMatchObject({ isDynasty: true, typeLabel: "Dynasty" });
    expect(deriveLeagueFormat(league({ type: 1 }))).toMatchObject({ isDynasty: false, typeLabel: "Keeper" });
    expect(deriveLeagueFormat(league({ type: 0 }))).toMatchObject({ isDynasty: false, typeLabel: "Redraft" });
  });
});
