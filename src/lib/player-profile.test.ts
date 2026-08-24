import { afterEach, describe, expect, it, vi } from "vitest";
import { getPlayerProfile } from "@/lib/player-profile";

// Trimmed from a live /player-page/9509 capture on 2026-08-20 — only the keys this app
// consumes, with the mixed string/number typing left exactly as upstream sends it. The
// endpoint returns 31 top-level keys; the rest are on the spec's do-NOT-build list and
// are deliberately absent here so a test failure means a real regression, not noise.
const body = {
  player: {
    sleeper_id: "9509", name: "Bijan Robinson", position: "RB", team: "ATL", age: 24.6,
    years_exp: 3, college: "Texas", height: "71", weight: 215, jersey: 7,
    photo_url: "https://rosteraudit.com/photo.png", status: "Active", injury_status: "",
  },
  value: {
    sf: 10000, one_qb: 9800, tier: 1, tier_label: "Elite", rank_sf: 1, rank_1qb: 3,
    rank_pos_sf: 1, rank_pos_1qb: 1, trend_7d: 0, trend_30d: -25, trend_90d: 40,
    delta_7d: 0, delta_30d: -250,
  },
  value_history: [
    { date: "2026-05-24", sf: 9660, one_qb: 9500 },
    { date: "2026-08-20", sf: 10000, one_qb: 9800 },
  ],
  cliff_risk: {
    player_id: "9509", position: "RB", age: 24.6, risk_score: 5, risk_level: "low",
    risk_factors: [{ factor: "value_at_risk", severity: "low", detail: "Elite value magnifies decline impact." }],
    recommendation: { action: "hold", summary: "Bijan Robinson has no significant cliff risk." },
    peak_window: [23, 26],
  },
  stats: {
    season: 2025,
    // `epa: null` is a real "not measured" hole, not a zero. fpp is PPR scoring.
    weekly: [
      { wk: 1, fp: 18.4, fpp: 24.4, opp: "TB", car: 12, rush: 24, rec: 6, tgt: 7, recy: 100, epa: null },
      { wk: 2, fp: 16.8, fpp: 19.8, opp: "MIN", car: 14, rush: 82, rec: 3, tgt: 4, recy: 22, epa: 1.2 },
    ],
    summary: { games_played: "17", rushing_yards: "1478", receptions: "79", fantasy_points_ppr_avg: "21.811765", comp_pct: null },
    career: [
      { season: "2025", games_played: "17", rushing_yards: "1478", fantasy_points_ppr_total: "370.80", pos_rank: 2 },
      { season: "2024", games_played: "17", rushing_yards: "1456", fantasy_points_ppr_total: "358.10", pos_rank: 3 },
    ],
  },
  projection_stats: [
    { year: 2026, games: 17, rush_yd: 1520, rush_td: 12, rec: 78, rec_yd: 640, rec_td: 4, ppg_std: 18.4, ppg_ppr: 22.9 },
    { year: 2027, games: 16, rush_yd: 1410, rush_td: 10, rec: 72, rec_yd: 580, rec_td: 3, ppg_std: 17.3, ppg_ppr: 21.8 },
  ],
  // Sections below back the tabbed profile. Shapes are trimmed from the same live capture:
  // `history` uses single-letter keys, `rankings.metrics` is keyed by metric name, and the
  // injury log uses s/w/t/b/g abbreviations.
  history: {
    sf: { points: [{ d: "2023-03-25", v: 6200, o: 22, p: 8 }, { d: "2026-08-20", v: 10000, o: 1, p: 1 }] },
    one_qb: { points: [{ d: "2023-03-25", v: 6100, o: 24, p: 9 }] },
  },
  rankings: {
    season: 2025,
    metrics: {
      rushing_yards: { rank: 1, of: 92, value: 1478, pctile: 100, above: [], below: ["Saquon Barkley"], is_elite: true, lower_better: false },
      bust_rate: { rank: 12, of: 92, value: 0.18, pctile: 87, above: ["Jahmyr Gibbs"], below: [], is_elite: false, lower_better: true },
    },
    metric_configs: {
      rushing_yards: { label: "Rushing Yards", lower: false, elite: 5 },
      bust_rate: { label: "Bust Rate", lower: true, elite: 5, why: "How often he busts." },
    },
    weekly_ranks: { "1": { rank: 4, of: 88 }, "3": { rank: 11, of: 90 } },
  },
  projection: [
    { year: 2026, value: 10000, confidence: "actual" },
    { year: 2027, value: 9800, confidence: "high" },
  ],
  projection_summary: "Bijan is the RB1 in dynasty.",
  projection_outcome: { p90: { finish: "RB1", value: 10500 }, p50: { finish: "RB1", value: 9800 }, p10: { finish: "RB8", value: 6400 }, breakout_pct: 35, bust_pct: 8, strategy: "hold", archetype: "elite_alpha", risk: 18 },
  projection_ppg: 18.4,
  projection_ppg_ppr: 22.9,
  injury: {
    grade: "A", score: 88,
    nfl: [{ s: 2024, w: 6, t: "Ankle Sprain", b: "ankle", sv: "mi", g: 1, d: "Missed one game." }],
    pre_nfl: [{ cat: "college_injury", year: 2021, desc: "Minor shoulder issue at Texas.", sig: "low" }],
  },
  contract: { year_signed: 2023, years: 4, years_left: 2, expiry_year: 2027, total_value: 21_000_000, apy: 5_250_000, guaranteed: 21_000_000, team: "Falcons", is_rookie_deal: true, is_expiring: false, otc_url: "https://overthecap.com/player/bijan" },
  combine: { season: "2023", draft_team: "Atlanta", draft_round: "1", draft_pick: "8", school: "Texas", forty: "4.46", vertical: "37.0", broad_jump: "120", cone: null, shuttle: null, bench: null },
  snaps: { avg_off_pct: 0.72, games: 17, season: 2025 },
  snaps_weekly: [{ week: "1", off_snaps: "44", off_pct: "0.68", opp: "TB" }, { week: "2", off_snaps: "51", off_pct: "0.79", opp: "MIN" }],
  // `rz_carry_rate` is a real measured zero; `avg_separation` is absent for a back entirely.
  ngs: { avg_yac: 3.1, catch_percentage: 78.2 },
  pbp: { rz_carry_rate: 0, success_rate: 51.4, unlisted_metric: 99 },
  recent_trades: {
    total_trades: 1,
    stats: { trade_count: 1, avg_cost: 9400, median_cost: 9400 },
    trades: [{ transaction_id: "tx1", trade_date: "2026-07-01", league_format: "12T . SF . PPR", cost: { players: [{ id: "111", name: "Garrett Wilson", position: "WR" }], picks: [{ season: "2027", round: 1 }] }, alongside: { players: [], picks: [] } }],
  },
  related: {
    teammates: [{ sleeper_id: "222", name: "Drake London", position: "WR", team: "ATL", val_sf: 6100, age: "25.1" }],
    same_tier: [{ sleeper_id: "333", name: "Jahmyr Gibbs", position: "RB", team: "DET", val_sf: 9539, age: "24.4" }],
    similar_value: [],
  },
  attribution: "Values by RosterAudit.com",
  attribution_url: "https://rosteraudit.com",
};

function stubFetch(payload: unknown, init?: { ok?: boolean; status?: number }) {
  const ok = init?.ok ?? true;
  const status = init?.status ?? 200;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok, status, statusText: String(status),
    json: () => Promise.resolve(payload), text: () => Promise.resolve(JSON.stringify(payload)),
  } as Response));
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("getPlayerProfile", () => {
  it("maps the identity header fields, coercing the string height upstream sends", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.player).toEqual({
      sleeperId: "9509", name: "Bijan Robinson", position: "RB", team: "ATL", age: 24.6,
      yearsExp: 3, college: "Texas", heightInches: 71, weightLbs: 215,
      photoUrl: "https://rosteraudit.com/photo.png",
    });
  });

  it("keeps both format values so the caller picks by preset rather than falling back", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // §2.8 of the API reference: `sf ?? 1qb` was a live bug. Both must survive mapping so
    // a 1QB league never silently reads a superflex number.
    expect(result.data.value).toEqual({
      valueSf: 10000, value1qb: 9800, tier: 1, tierLabel: "Elite",
      rankOverallSf: 1, rankOverall1qb: 3, rankPositionSf: 1, rankPosition1qb: 1,
      trend7d: 0, trend30d: -25,
    });
  });

  it("maps value history oldest-first with both formats", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.valueHistory).toEqual([
      { date: "2026-05-24", valueSf: 9660, value1qb: 9500 },
      { date: "2026-08-20", valueSf: 10000, value1qb: 9800 },
    ]);
  });

  it("preserves a null weekly stat as null instead of zeroing it", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.season).toBe(2025);
    expect(result.data.weekly[0]).toMatchObject({ week: 1, opponent: "TB", points: 18.4, pointsPpr: 24.4 });
    expect(result.data.weekly[0].stats.epa).toBeNull();
    expect(result.data.weekly[1].stats.epa).toBe(1.2);
  });

  it("coerces the all-string summary and career rows to numbers, keeping nulls", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.summary).toMatchObject({ games_played: 17, rushing_yards: 1478, receptions: 79 });
    expect(result.data.summary?.comp_pct).toBeNull();
    expect(result.data.career.map((row) => row.season)).toEqual([2025, 2024]);
    expect(result.data.career[0].stats.rushing_yards).toBe(1478);
  });

  it("maps projections as future seasons", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.projections).toEqual([
      { season: 2026, games: 17, ppgStandard: 18.4, ppgPpr: 22.9, stats: { rush_yd: 1520, rush_td: 12, rec: 78, rec_yd: 640, rec_td: 4 } },
      { season: 2027, games: 16, ppgStandard: 17.3, ppgPpr: 21.8, stats: { rush_yd: 1410, rush_td: 10, rec: 72, rec_yd: 580, rec_td: 3 } },
    ]);
  });

  it("maps cliff risk with its factors and recommendation", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.cliffRisk).toEqual({
      level: "low", score: 5, recommendation: "Bijan Robinson has no significant cliff risk.",
      factors: [{ factor: "value_at_risk", severity: "low", detail: "Elite value magnifies decline impact." }],
    });
  });

  // The spec makes cliff risk conditional: render it only if a validated response carries
  // it, never derive a level from age.
  it("returns a null cliff risk rather than inventing one when upstream omits it", async () => {
    stubFetch({ ...body, cliff_risk: null });
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.cliffRisk).toBeNull();
  });

  // A rookie or an uncovered player has no season yet. That is a normal case, not an error.
  it("returns empty collections when stats and history are absent", async () => {
    stubFetch({ ...body, stats: null, value_history: null, projection_stats: null });
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.season).toBeNull();
    expect(result.data.weekly).toEqual([]);
    expect(result.data.career).toEqual([]);
    expect(result.data.projections).toEqual([]);
    expect(result.data.valueHistory).toEqual([]);
    expect(result.data.summary).toBeNull();
  });

  it("maps the career arc from the SF series, keeping the ranks each point carries", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.history).toEqual([
      { date: "2023-03-25", value: 6200, rankOverall: 22, rankPosition: 8 },
      { date: "2026-08-20", value: 10000, rankOverall: 1, rankPosition: 1 },
    ]);
  });

  it("joins rank metrics to their configs for labels and lower-is-better", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byKey = Object.fromEntries(result.data.rankMetrics.map((metric) => [metric.key, metric]));
    expect(byKey.rushing_yards).toMatchObject({ label: "Rushing Yards", rank: 1, of: 92, percentile: 100, isElite: true, lowerIsBetter: false, below: ["Saquon Barkley"] });
    // A "lower is better" metric keeps that flag so the caller captions the raw value correctly,
    // even though the percentile upstream sends is already normalised.
    expect(byKey.bust_rate).toMatchObject({ label: "Bust Rate", lowerIsBetter: true, percentile: 87, why: "How often he busts." });
    expect(result.data.rankSeason).toBe(2025);
  });

  it("sorts weekly ranks by week, turning the string keys into numbers", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.weeklyRanks).toEqual([{ week: 1, rank: 4, of: 88 }, { week: 3, rank: 11, of: 90 }]);
  });

  it("flags the projection curve's present-day anchor as actual", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.projectionCurve).toEqual([
      { year: 2026, value: 10000, confidence: "actual", isActual: true },
      { year: 2027, value: 9800, confidence: "high", isActual: false },
    ]);
    expect(result.data.outcome).toMatchObject({ p90: { finish: "RB1", value: 10500 }, p10: { finish: "RB8", value: 6400 }, breakoutPct: 35, strategy: "hold", archetype: "elite_alpha" });
    expect(result.data.projectedPpgPpr).toBe(22.9);
    expect(result.data.projectionSummary).toBe("Bijan is the RB1 in dynasty.");
  });

  it("expands the abbreviated injury log and keeps the durability grade", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.injury).toMatchObject({ grade: "A", score: 88 });
    expect(result.data.injury?.events).toEqual([{ season: 2024, week: 6, title: "Ankle Sprain", bodyPart: "ankle", severity: "mi", gamesMissed: 1, detail: "Missed one game." }]);
    expect(result.data.injury?.preNfl).toEqual([{ year: 2021, description: "Minor shoulder issue at Texas.", significance: "low" }]);
  });

  it("maps the contract and combine blocks", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.contract).toMatchObject({ years: 4, yearsLeft: 2, expiryYear: 2027, apy: 5_250_000, isRookieDeal: true, isExpiring: false, team: "Falcons" });
    expect(result.data.combine).toMatchObject({ draftRound: "1", draftPick: "8", school: "Texas", forty: "4.46", cone: null });
  });

  it("coerces the all-string weekly snap rows", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.snapsWeekly).toEqual([
      { week: 1, offensePct: 0.68, offenseSnaps: 44, opponent: "TB" },
      { week: 2, offensePct: 0.79, offenseSnaps: 51, opponent: "MIN" },
    ]);
    expect(result.data.avgSnapPct).toBe(0.72);
  });

  it("keeps a measured zero in the advanced block and drops unlisted keys", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // A real 0 must survive — a back with no red-zone carries is not the same as one whose
    // rate was never measured, and the card distinguishes them.
    expect(result.data.advanced.rz_carry_rate).toBe(0);
    expect(result.data.advanced.success_rate).toBe(51.4);
    expect(result.data.advanced.avg_yac).toBe(3.1);
    // The whitelist is what stops an upstream schema change from adding surprise UI rows.
    expect(result.data.advanced.unlisted_metric).toBeUndefined();
  });

  it("maps trade comps and related players, tolerating an empty group", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.tradeMarket).toMatchObject({ totalTrades: 1, medianCost: 9400 });
    expect(result.data.tradeMarket?.trades[0]).toMatchObject({
      id: "tx1", date: "2026-07-01", format: "12T . SF . PPR",
      cost: { players: [{ id: "111", name: "Garrett Wilson", position: "WR" }], picks: [{ season: "2027", round: 1 }] },
      alongside: { players: [], picks: [] },
    });
    expect(result.data.related?.teammates).toEqual([{ sleeperId: "222", name: "Drake London", position: "WR", team: "ATL", valueSf: 6100, age: 25.1 }]);
    expect(result.data.related?.similarValue).toEqual([]);
  });

  it("returns empty sections rather than failing when the payload omits them", async () => {
    // A rookie with no games, no trades, and no contract is a legitimate response, not an error.
    const omitted = ["history", "rankings", "projection", "injury", "contract", "combine", "snaps_weekly", "recent_trades", "related"];
    const sparse = Object.fromEntries(Object.entries(body).filter(([key]) => !omitted.includes(key)));
    stubFetch(sparse);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.history).toEqual([]);
    expect(result.data.rankMetrics).toEqual([]);
    expect(result.data.weeklyRanks).toEqual([]);
    expect(result.data.projectionCurve).toEqual([]);
    expect(result.data.snapsWeekly).toEqual([]);
    expect(result.data.injury).toBeNull();
    expect(result.data.contract).toBeNull();
    expect(result.data.combine).toBeNull();
    expect(result.data.tradeMarket).toBeNull();
    expect(result.data.related).toBeNull();
    // The core the page leads with still maps.
    expect(result.data.player.name).toBe("Bijan Robinson");
  });

  it("carries the upstream attribution through", async () => {
    stubFetch(body);
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attribution).toEqual({ text: "Values by RosterAudit.com", url: "https://rosteraudit.com" });
  });

  // /player-page went from 401-without-key to public between 2026-08-17 and 2026-08-20.
  // It could flip back, so the missing-key path stays wired rather than being unreachable.
  it("classifies a 401 as a key error rather than throwing", async () => {
    stubFetch({ error: "API key required" }, { ok: false, status: 401 });
    const result = await getPlayerProfile("9509");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("missing-key");
  });

  it("reports an unknown player id as an upstream error, not a crash", async () => {
    stubFetch({ error: "Player not found" }, { ok: false, status: 404 });
    const result = await getPlayerProfile("0");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("upstream-unavailable");
  });
});
