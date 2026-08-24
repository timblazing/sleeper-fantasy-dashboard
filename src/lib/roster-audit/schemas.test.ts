import { describe, expect, it } from "vitest";
import { h2hResponseSchema, managerCareerResponseSchema, parseAttribution, presetsResponseSchema, rankingsResponseSchema, valuesResponseSchema } from "@/lib/roster-audit/schemas";

const presetsFixture = {
  "0": { key: "sf-ppr", label: "SF PPR", league_size: 12, is_sf: true, scoring_format: "ppr", is_tep: false, roster: ["QB", "RB"], format_key: "sf_ppr", has_format_values: true, format_players: 43, exact_trades: 39298, confidence: 1, reliable: true },
  "1": { key: "sf-ppr-tep", label: "SF PPR TEP", league_size: 12, is_sf: true, scoring_format: "ppr", is_tep: true, roster: ["QB", "RB"], format_key: "sf_ppr_tep", has_format_values: true, format_players: 40, exact_trades: 1000, confidence: 1, reliable: true },
  "2": { key: "1qb-ppr", label: "1QB PPR", league_size: 12, is_sf: false, scoring_format: "ppr", is_tep: false, roster: ["QB", "RB"], format_key: "1qb_ppr", has_format_values: true, format_players: 43, exact_trades: 39298, confidence: 1, reliable: true },
  "3": { key: "1qb-ppr-tep", label: "1QB PPR TEP", league_size: 12, is_sf: false, scoring_format: "ppr", is_tep: true, roster: ["QB", "RB"], format_key: "1qb_ppr_tep", has_format_values: true, format_players: 40, exact_trades: 1000, confidence: 1, reliable: true },
  attribution: "Values by RosterAudit.com",
  attribution_url: "https://rosteraudit.com",
};

const rankingsPlayerFixture = {
  sleeper_id: "9509",
  name: "Bijan Robinson",
  position: "RB",
  team: "ATL",
  age: "24.5",
  tier: "1",
  trend_7d: "0",
  trend_30d: "0",
  buy_low: "0",
  sell_high: "0",
  breakout: "0",
  photo_url: "https://rosteraudit.com/wp-content/uploads/ra-headshots/9509.jpg",
  val_sf_market: "10000",
  val_1qb_market: "10000",
  years_exp: "3",
  value: 10000,
  rank_overall: 1,
  rank_pos: 1,
};

// Captured live on 2026-08-20 from
// /rankings?preset=sf-ppr&per_page=50&page=1&sort=value&league_size=12 (index 11).
// RosterAudit interleaves pick rows among the players; they carry no sleeper_id and no
// val_*_market keys at all, which is what used to fail the whole response.
const rankingsPickFixture = {
  type: "pick",
  sleeper_id: null,
  name: "2026 Pick 1.01",
  position: "PICK",
  team: "2026",
  age: null,
  value: 6300,
  rank_overall: 12,
  rank_pos: 0,
  tier: 0,
  trend_7d: 0,
  trend_30d: 0,
  photo_url: null,
  pick_season: 2026,
  pick_round: 1,
  pick_slot: "01",
  is_exact: true,
};

const rankingsResponseFixture = {
  players: [rankingsPlayerFixture],
  total: 1,
  page: 1,
  per_page: 10,
  total_pages: 1,
  format: "sf",
  preset: "sf-ppr",
  preset_label: "SF PPR",
  attribution: "Values by RosterAudit.com",
  attribution_url: "https://rosteraudit.com",
};

const valuesResponseFixture = {
  "9509": { sf: 10000, "1qb": 9500 },
  "7564": { sf: 8000, "1qb": 7800 },
};

describe("presetsResponseSchema", () => {
  it("parses the numerically-keyed object with mixed-in attribution to exactly 4 presets", () => {
    const result = presetsResponseSchema.parse(presetsFixture);
    expect(result).toHaveLength(4);
    expect(result.map((preset) => preset.key)).toEqual(["sf-ppr", "sf-ppr-tep", "1qb-ppr", "1qb-ppr-tep"]);
  });

  it("does not include an attribution string as a preset", () => {
    const result = presetsResponseSchema.parse(presetsFixture);
    expect(result.some((preset) => (preset as unknown) === "Values by RosterAudit.com")).toBe(false);
  });
});

describe("rankingsResponseSchema", () => {
  it("coerces string age and tier to numbers", () => {
    const result = rankingsResponseSchema.parse(rankingsResponseFixture);
    const [player] = result.players;
    if (player.sleeper_id === null) throw new Error("expected a player row");
    expect(player.age).toBe(24.5);
    expect(player.tier).toBe(1);
  });

  it("fails on a payload missing a required field rather than coercing a zero", () => {
    const { sleeper_id, ...withoutId } = rankingsPlayerFixture;
    void sleeper_id;
    const broken = { ...rankingsResponseFixture, players: [withoutId] };
    expect(() => rankingsResponseSchema.parse(broken)).toThrow();
  });

  it("parses a response whose players array interleaves pick rows", () => {
    const mixed = { ...rankingsResponseFixture, players: [rankingsPlayerFixture, rankingsPickFixture], total: 2 };
    const result = rankingsResponseSchema.parse(mixed);
    expect(result.players).toHaveLength(2);
    expect(result.players[1].sleeper_id).toBeNull();
    expect(result.players[1].name).toBe("2026 Pick 1.01");
  });

  it("still rejects a player row that is merely missing its id", () => {
    const { sleeper_id, ...withoutId } = rankingsPlayerFixture;
    void sleeper_id;
    expect(() => rankingsResponseSchema.parse({ ...rankingsResponseFixture, players: [withoutId] })).toThrow();
  });
});

describe("valuesResponseSchema", () => {
  it("parses a bare map with no envelope", () => {
    const result = valuesResponseSchema.parse(valuesResponseFixture);
    expect(result["9509"]).toEqual({ sf: 10000, "1qb": 9500 });
  });
});

describe("parseAttribution", () => {
  it("returns the response's values when present", () => {
    expect(parseAttribution(rankingsResponseFixture)).toEqual({ text: "Values by RosterAudit.com", url: "https://rosteraudit.com" });
  });

  it("returns the fallback constants for a values-shaped payload with no attribution fields", () => {
    expect(parseAttribution(valuesResponseFixture)).toEqual({ text: "Values by RosterAudit.com", url: "https://rosteraudit.com" });
  });
});

// z.coerce.number() accepts null and returns 0, so a `z.union([z.coerce.number(), z.null()])`
// never reaches its null branch. Every nullable numeric in this file shares one helper, so
// that ordering turned "RosterAudit does not know this player's age" into a literal age of 0
// on every rankings row. This pins the branch order.
describe("nullable numeric coercion", () => {
  it("keeps an upstream null as null rather than coercing it to 0", () => {
    const parsed = rankingsResponseSchema.parse({
      ...rankingsResponseFixture,
      players: [{ ...rankingsPlayerFixture, age: null, tier: null, rank_overall: null, rank_pos: null, years_exp: null }],
    });

    const player = parsed.players[0];
    if (!("age" in player)) throw new Error("expected a player row");
    expect(player.age).toBeNull();
    expect(player.tier).toBeNull();
    expect(player.rank_overall).toBeNull();
    expect(player.years_exp).toBeNull();
  });

  it("still coerces the strings RosterAudit actually sends", () => {
    const parsed = rankingsResponseSchema.parse(rankingsResponseFixture);
    const player = parsed.players[0];
    if (!("age" in player)) throw new Error("expected a player row");
    expect(player.age).toBe(24.5);
  });
});

/**
 * Shapes captured from live `/league-history/...` responses on 2026-08-21.
 *
 * `/manager/{id}` does *not* echo the `/managers` list's field names — it drops `user_id`,
 * `total_ties` and `playoff_appearances`, and renames `seasons_played` and
 * `total_playoff_wins/losses`. Requiring the list's shape made every request fail to parse and
 * silently removed lineup efficiency from the Scouting Report, so the divergence is pinned here.
 */
const managerCareerFixture = {
  totals: { display_name: "adamckelley", seasons: 3, total_wins: 21, total_losses: 7, championships: 1, runner_ups: 0, last_places: 0, total_pf: 4298.2, playoff_wins: 2, playoff_losses: 1, win_pct: 75 },
  seasons: [
    { season: "2024", wins: "9", losses: "5", ties: "0", points_for: "2171.22", points_against: "1850.46", max_points_for: "2395.32", final_standing: "3", made_playoffs: "1", won_championship: "0" },
    { season: "2025", wins: "12", losses: "2", ties: "0", points_for: "2127.00", points_against: "1586.42", max_points_for: "2518.82", final_standing: "1", made_playoffs: "1", won_championship: "1" },
  ],
  attribution: "Values by RosterAudit.com",
};

describe("managerCareerResponseSchema", () => {
  it("parses the /manager/{id} totals despite its renamed and missing fields", () => {
    const parsed = managerCareerResponseSchema.safeParse(managerCareerFixture);

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.totals.playoff_wins).toBe(2);
    expect(parsed.success && parsed.data.totals.seasons).toBe(3);
  });

  it("coerces the string season rows that lineup efficiency is computed from", () => {
    const parsed = managerCareerResponseSchema.parse(managerCareerFixture);
    const first = parsed.seasons[0];

    expect(first.points_for).toBe(2171.22);
    expect(first.max_points_for).toBe(2395.32);
    // Efficiency is points_for / max_points_for; both must be numbers for it to mean anything.
    expect(first.points_for / first.max_points_for!).toBeCloseTo(0.906, 3);
  });

  it("keeps a season that never reported an optimal lineup rather than failing the response", () => {
    const parsed = managerCareerResponseSchema.safeParse({
      ...managerCareerFixture,
      seasons: [{ season: "2023", wins: "7", losses: "7", points_for: "1500.0" }],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.seasons[0].max_points_for).toBeUndefined();
  });
});

describe("h2hResponseSchema", () => {
  it("parses a rivalry with its per-meeting rows", () => {
    const parsed = h2hResponseSchema.parse({
      total_matchups: 2, wins_1: 2, wins_2: 0, draws: 0, total_pts_1: 297.2, total_pts_2: 242.28,
      matchups: [{ season: 2024, week: 7, is_playoff: false, round_label: "Wk 7", score_1: 151, score_2: 117.28, winner: "user-a" }],
      user_id_1: "user-a", user_id_2: "user-b", name_1: "TimBlazing", name_2: "adamckelley",
    });

    expect(parsed.wins_1).toBe(2);
    expect(parsed.matchups[0].score_1).toBe(151);
  });

  it("survives a pairing that has never met", () => {
    const parsed = h2hResponseSchema.safeParse({ user_id_1: "a", user_id_2: "b", matchups: [] });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.matchups).toEqual([]);
  });
});
