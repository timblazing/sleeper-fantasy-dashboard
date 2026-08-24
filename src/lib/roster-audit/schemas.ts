import { z } from "zod";
import type { Attribution } from "@/lib/roster-audit/types";

const num = z.coerce.number();
// The null branch must come first: z.coerce.number() happily accepts null and returns 0, so
// with the branches the other way round every "unknown" upstream value — an age RosterAudit
// has not established, an unranked player — parsed as a real 0 and rendered as one.
const nullableNum = z.union([z.null(), z.coerce.number()]).catch(null);

export const presetSchema = z.object({ key: z.string(), label: z.string(), league_size: num, is_sf: z.boolean(), scoring_format: z.string(), is_tep: z.boolean(), format_key: z.string(), reliable: z.boolean() }).passthrough();
export const presetsResponseSchema = z.record(z.string(), z.unknown()).transform((raw, ctx) => {
  const presets = Object.values(raw).filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null && "format_key" in entry);
  const parsed = presets.map((entry) => {
    const result = presetSchema.safeParse(entry);
    if (!result.success) { ctx.addIssue({ code: "custom", message: "Invalid preset entry" }); return null; }
    return result.data;
  });
  if (parsed.some((entry) => entry === null)) return z.NEVER;
  return parsed as z.infer<typeof presetSchema>[];
});

const rankingsPlayerSchema = z.object({ sleeper_id: z.string(), name: z.string(), position: z.string(), team: z.string().nullable(), age: nullableNum, tier: nullableNum, trend_7d: num, trend_30d: num, photo_url: z.string().nullable(), val_sf_market: num, val_1qb_market: num, years_exp: nullableNum, value: num, rank_overall: nullableNum, rank_pos: nullableNum }).passthrough();

// Since the 2026-08-17 capture in docs/rosteraudit-api-reference.md, RosterAudit folds draft
// picks into the `players` array of /rankings: `type: "pick"`, a null `sleeper_id`, and no
// val_sf_market / val_1qb_market at all. Parsing those as players failed the whole response,
// which blanked the Rankings page for every real dynasty league. They get their own branch here
// and are dropped in endpoints.ts — this app sources picks from /picks instead, so that
// rankings-data.ts stays the one place that decides where a pick sorts (shouldMergePicks).
const rankingsPickRowSchema = z.object({ type: z.literal("pick"), sleeper_id: z.null(), name: z.string(), position: z.string(), value: num, rank_overall: nullableNum }).passthrough();
export type RankingsPlayerRow = z.infer<typeof rankingsPlayerSchema>;
const rankingsRowSchema = z.union([rankingsPickRowSchema, rankingsPlayerSchema]);
export const rankingsResponseSchema = z.object({ players: z.array(rankingsRowSchema), total: num, page: num, per_page: num, total_pages: num, format: z.string(), preset: z.string(), preset_label: z.string(), league_adjusted: z.unknown().optional(), idp_live: z.unknown().optional(), attribution: z.string().optional(), attribution_url: z.string().optional() });

// The value map is a bare id -> value record, but RosterAudit also folds `attribution` and
// `attribution_url` strings into the same object. Parse entry-by-entry so those extra string keys
// (and any future ones) are skipped instead of failing the whole response.
const valueEntrySchema = z.object({ sf: num, "1qb": num });
export const valuesResponseSchema = z.record(z.string(), z.unknown()).transform((raw) => {
  const values: Record<string, z.infer<typeof valueEntrySchema>> = {};
  for (const [id, entry] of Object.entries(raw)) {
    const parsed = valueEntrySchema.safeParse(entry);
    if (parsed.success) values[id] = parsed.data;
  }
  return values;
});

const pickSchema = z.object({ id: num, pick_season: num, pick_round: num, pick_slot: z.enum(["early", "mid", "late"]), val_sf: num, val_1qb: num, label: z.string(), sort_order: num }).passthrough();
export const picksResponseSchema = z.object({ picks: z.array(pickSchema), pick_curve_sf: z.record(z.string(), num), pick_curve_1qb: z.record(z.string(), num), attribution: z.string().optional(), attribution_url: z.string().optional() });

const moverSchema = z.object({ sleeper_id: z.string(), name: z.string(), position: z.string(), team: z.string().nullable(), age: nullableNum, val_sf: num, trend_7d: num, trend_30d: num, tier: nullableNum }).passthrough();
export const moversResponseSchema = z.object({ risers: z.array(moverSchema), fallers: z.array(moverSchema), pct_movers: z.array(z.unknown()).optional(), updated: z.string().nullable().optional(), attribution: z.string().optional(), attribution_url: z.string().optional() });

const searchPlayerSchema = z.object({ sleeper_id: z.string(), name: z.string(), position: z.string(), team: z.string().nullable(), val_sf: num, val_1qb: num, rank_pos_sf: nullableNum, trend_7d: num }).passthrough();
export const playerSearchResponseSchema = z.object({ players: z.array(searchPlayerSchema), attribution: z.string().optional(), attribution_url: z.string().optional() });

const weeklyStatSchema = z.object({ wk: num }).passthrough();
export const playerStatsResponseSchema = z.object({ season: z.string(), weekly: z.array(weeklyStatSchema), summary: z.record(z.string(), z.union([z.string(), z.number(), z.null()])), career: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))), attribution: z.string().optional(), attribution_url: z.string().optional() });

const ppgRankingSchema = z.object({ rank: num, sleeper_id: z.string(), name: z.string(), position: z.string(), team: z.string().nullable(), age: num, ppg: num, dynasty_val: num, dynasty_rank: num }).passthrough();
export const ppgRankingsResponseSchema = z.object({ rankings: z.array(ppgRankingSchema), count: num, position: z.string(), scoring: z.string(), attribution: z.string().optional(), attribution_url: z.string().optional() });

const FALLBACK_ATTRIBUTION: Attribution = { text: "Values by RosterAudit.com", url: "https://rosteraudit.com" };
export function parseAttribution(payload: unknown): Attribution {
  if (payload && typeof payload === "object" && "attribution" in payload) {
    const text = (payload as Record<string, unknown>).attribution;
    const url = (payload as Record<string, unknown>).attribution_url;
    if (typeof text === "string" && typeof url === "string") return { text, url };
  }
  return FALLBACK_ATTRIBUTION;
}

// Trade assets are a discriminated union in everything but name: only `type`, `value`,
// `val_sf`, and `val_1qb` are common to players and picks, so each arm is parsed on its own.
const tradePlayerAssetSchema = z.object({ type: z.literal("player"), sleeper_id: z.string(), name: z.string(), position: z.string(), team: z.string().nullable(), age: nullableNum, value: num, val_sf: num, val_1qb: num, rank_overall: nullableNum, rank_pos: nullableNum, trend_7d: num, trend_30d: num, tier: nullableNum, photo_url: z.string().nullable(), buy_low: z.boolean(), sell_high: z.boolean() }).passthrough();
const tradePickAssetSchema = z.object({ type: z.literal("pick"), season: num, round: num, slot: z.enum(["early", "mid", "late"]), label: z.string(), value: num, val_sf: num, val_1qb: num }).passthrough();
const tradeAssetSchema = z.discriminatedUnion("type", [tradePlayerAssetSchema, tradePickAssetSchema]);
const tradeSideSchema = z.object({ assets: z.array(tradeAssetSchema), raw_value: num, adjusted_value: num, asset_count: num }).passthrough();
const cliffFactorSchema = z.object({ factor: z.string(), severity: z.string(), detail: z.string() }).passthrough();
const cliffWarningSchema = z.object({ player_id: z.string(), player_name: z.string(), position: z.string(), risk_level: z.string(), risk_score: num, summary: z.string(), factors: z.array(cliffFactorSchema).default([]), side: z.string() }).passthrough();
export const tradeResponseSchema = z.object({ side_a: tradeSideSchema, side_b: tradeSideSchema, verdict: z.object({ winner: z.enum(["side_a", "side_b"]), grade: z.string(), difference: num, difference_pct: num }).passthrough(), meta: z.object({ is_superflex: z.boolean(), is_te_premium: z.boolean(), scoring_format: z.string(), league_size: nullableNum, calculated_at: z.string() }).passthrough(), cliff_warnings: z.array(cliffWarningSchema).default([]), attribution: z.string().optional(), attribution_url: z.string().optional() });
export type TradeResponse = z.infer<typeof tradeResponseSchema>;

// /player-page, live-captured 2026-08-20. It was 401-without-key on 2026-08-17 and is public
// now; see docs/rosteraudit-api-reference.md §2.9. Only the keys this app renders are declared —
// the response carries 31 top-level keys and the rest are on the spec's do-NOT-build list.
// Everything below is `.nullish()` where upstream can omit it: an uncovered rookie legitimately
// has no season, and that is an empty profile, not a failed parse.
const statRowSchema = z.record(z.string(), nullableNum);
const playerPageIdentitySchema = z.object({ sleeper_id: z.string(), name: z.string(), position: z.string(), team: z.string().nullable(), age: nullableNum, years_exp: nullableNum, college: z.string().nullable(), height: nullableNum, weight: nullableNum, photo_url: z.string().nullable() }).passthrough();
const playerPageValueSchema = z.object({ sf: num, one_qb: num, tier: nullableNum, tier_label: z.string().nullable(), rank_sf: nullableNum, rank_1qb: nullableNum, rank_pos_sf: nullableNum, rank_pos_1qb: nullableNum, trend_7d: num, trend_30d: num }).passthrough();
const valueHistoryPointSchema = z.object({ date: z.string(), sf: num, one_qb: num }).passthrough();
// Reuses cliffFactorSchema from the /trade/calculate shapes above — same factor rows.
const cliffRiskSchema = z.object({ risk_level: z.string(), risk_score: num, risk_factors: z.array(cliffFactorSchema).nullish(), recommendation: z.object({ summary: z.string() }).passthrough().nullish() }).passthrough();
// `wk`, `fp`, `fpp`, and `opp` are the fixed columns; every other key is a position-dependent
// stat, so the rest passes through untyped and is coerced cell-by-cell in the mapper rather
// than enumerated per position.
const playerPageWeeklySchema = z.object({ wk: num, fp: nullableNum, fpp: nullableNum, opp: z.string().nullable() }).passthrough();
// Note `season` is a number here while /player-stats sends it as a string for the same field.
const playerPageStatsSchema = z.object({ season: nullableNum, weekly: z.array(playerPageWeeklySchema).nullish(), summary: statRowSchema.nullish(), career: z.array(statRowSchema).nullish() }).passthrough();
const projectionStatSchema = z.object({ year: num, games: nullableNum, ppg_std: nullableNum, ppg_ppr: nullableNum }).passthrough();

/* ---------------------------------------------------------------------------
 * Profile sections beyond the value/stats core.
 *
 * `history` is the long arc — one point per month back to the rookie year, each
 * carrying overall (`o`) and positional (`p`) rank alongside the value, which
 * `value_history` (40 weekly points, value only) cannot show. Both are kept:
 * the weekly series is the detail view, this is the career view.
 * ------------------------------------------------------------------------- */
const historyPointSchema = z.object({ d: z.string(), v: num, o: nullableNum, p: nullableNum }).passthrough();
const historySeriesSchema = z.object({ points: z.array(historyPointSchema).nullish() }).passthrough();
/** `metrics` is keyed by metric name; every entry is a percentile plus its nearest peers. */
const rankMetricSchema = z.object({ rank: num, of: num, value: nullableNum, pctile: nullableNum, above: z.array(z.string()).nullish(), below: z.array(z.string()).nullish(), is_elite: z.boolean().nullish(), lower_better: z.boolean().nullish() }).passthrough();
const metricConfigSchema = z.object({ label: z.string(), lower: z.boolean().nullish(), why: z.string().nullish() }).passthrough();
const rankingsSectionSchema = z.object({ season: nullableNum, games: nullableNum, scoring_type: z.string().nullish(), metrics: z.record(z.string(), rankMetricSchema).nullish(), metric_configs: z.record(z.string(), metricConfigSchema).nullish(), weekly_ranks: z.record(z.string(), z.object({ rank: num, of: num }).passthrough()).nullish() }).passthrough();
/** Projection curve: `confidence: "actual"` marks the present-day anchor, the rest are forecast. */
const projectionPointSchema = z.object({ year: num, value: num, confidence: z.string() }).passthrough();
const outcomeLegSchema = z.object({ finish: z.string().nullish(), value: nullableNum }).passthrough();
const projectionOutcomeSchema = z.object({ p90: outcomeLegSchema.nullish(), p50: outcomeLegSchema.nullish(), p10: outcomeLegSchema.nullish(), breakout_pct: nullableNum, bust_pct: nullableNum, strategy: z.string().nullish(), archetype: z.string().nullish(), risk: nullableNum }).passthrough();
/** Injury rows use single-letter keys: s=season, w=week, t=title, b=body part, g=games missed. */
const nflInjurySchema = z.object({ s: nullableNum, w: nullableNum, t: z.string(), b: z.string().nullish(), sv: z.string().nullish(), g: nullableNum, d: z.string().nullish() }).passthrough();
const preNflInjurySchema = z.object({ year: nullableNum, desc: z.string(), sig: z.string().nullish() }).passthrough();
const injurySectionSchema = z.object({ nfl: z.array(nflInjurySchema).nullish(), pre_nfl: z.array(preNflInjurySchema).nullish(), grade: z.string().nullish(), score: nullableNum }).passthrough();
const contractSchema = z.object({ years: nullableNum, years_left: nullableNum, expiry_year: nullableNum, total_value: nullableNum, apy: nullableNum, guaranteed: nullableNum, team: z.string().nullish(), is_rookie_deal: z.boolean().nullish(), is_expiring: z.boolean().nullish(), otc_url: z.string().nullish() }).passthrough();
const combineSchema = z.object({ season: z.string().nullish(), draft_team: z.string().nullish(), draft_round: z.string().nullish(), draft_pick: z.string().nullish(), school: z.string().nullish(), ht: z.string().nullish(), wt: z.string().nullish(), forty: z.string().nullish(), bench: z.string().nullish(), vertical: z.string().nullish(), broad_jump: z.string().nullish(), cone: z.string().nullish(), shuttle: z.string().nullish() }).passthrough();
const snapsWeeklySchema = z.object({ week: num, off_pct: nullableNum, off_snaps: nullableNum, opp: z.string().nullish() }).passthrough();
/** Trade comps: what this player actually cost in real leagues, and who moved alongside them. */
// `id` is a string on most trade rows and a bare number on others in the same response, so it
// is coerced rather than declared — a live 2026-08-20 capture failed to parse without this.
const tradeAssetListSchema = z.object({ players: z.array(z.object({ id: z.coerce.string(), name: z.string(), position: z.string().nullish() }).passthrough()).nullish(), picks: z.array(z.object({ season: z.coerce.string(), round: num }).passthrough()).nullish() }).passthrough();
const recentTradeSchema = z.object({ transaction_id: z.string(), trade_date: z.string().nullish(), league_format: z.string().nullish(), cost: tradeAssetListSchema.nullish(), alongside: tradeAssetListSchema.nullish() }).passthrough();
const recentTradesSchema = z.object({ trades: z.array(recentTradeSchema).nullish(), total_trades: nullableNum, stats: z.object({ trade_count: nullableNum, avg_cost: nullableNum, median_cost: nullableNum }).passthrough().nullish() }).passthrough();
const relatedPlayerSchema = z.object({ sleeper_id: z.string(), name: z.string(), position: z.string(), team: z.string().nullish(), val_sf: nullableNum, age: nullableNum }).passthrough();
const relatedSchema = z.object({ teammates: z.array(relatedPlayerSchema).nullish(), same_tier: z.array(relatedPlayerSchema).nullish(), similar_value: z.array(relatedPlayerSchema).nullish() }).passthrough();

export const playerPageResponseSchema = z.object({
  player: playerPageIdentitySchema, value: playerPageValueSchema, value_history: z.array(valueHistoryPointSchema).nullish(),
  cliff_risk: cliffRiskSchema.nullish(), stats: playerPageStatsSchema.nullish(), projection_stats: z.array(projectionStatSchema).nullish(),
  history: z.object({ sf: historySeriesSchema.nullish(), one_qb: historySeriesSchema.nullish() }).passthrough().nullish(),
  rankings: rankingsSectionSchema.nullish(),
  projection: z.array(projectionPointSchema).nullish(), projection_summary: z.string().nullish(), projection_outcome: projectionOutcomeSchema.nullish(),
  projection_ppg: nullableNum, projection_ppg_ppr: nullableNum,
  injury: injurySectionSchema.nullish(), contract: contractSchema.nullish(), combine: combineSchema.nullish(),
  snaps: z.object({ avg_off_pct: nullableNum, games: nullableNum, season: nullableNum }).passthrough().nullish(),
  snaps_weekly: z.array(snapsWeeklySchema).nullish(),
  ngs: statRowSchema.nullish(), pbp: statRowSchema.nullish(),
  recent_trades: recentTradesSchema.nullish(), related: relatedSchema.nullish(),
  attribution: z.string().optional(), attribution_url: z.string().optional(),
}).passthrough();

/**
 * League-history managers. Every numeric field arrives as a *string* from this endpoint
 * (API reference §4.9), so `num` coercion is doing real work here rather than being defensive.
 */
const managerCareerSchema = z.object({
  user_id: z.string(),
  display_name: z.string(),
  avatar: z.string().nullish(),
  seasons_played: num,
  total_wins: num,
  total_losses: num,
  total_ties: num,
  win_pct: num,
  total_pf: num,
  championships: num,
  runner_ups: num,
  last_places: num,
  playoff_appearances: num,
  total_playoff_wins: num,
  total_playoff_losses: num,
}).passthrough();

export const leagueManagersResponseSchema = z.object({ managers: z.array(managerCareerSchema).default([]), attribution: z.string().optional(), attribution_url: z.string().optional() });

/**
 * One season row of a manager's career. Like the managers list, every numeric field arrives
 * as a string. `max_points_for` is the optimal-lineup total and is the only source for
 * lineup efficiency — it is nullish because older synced seasons can omit it.
 */
const managerSeasonSchema = z.object({
  season: num,
  wins: num,
  losses: num,
  ties: num.nullish(),
  points_for: num,
  points_against: num.nullish(),
  max_points_for: num.nullish(),
  final_standing: num.nullish(),
  made_playoffs: num.nullish(),
  won_championship: num.nullish(),
}).passthrough();

export const managerCareerResponseSchema = z.object({
  /**
   * `/manager/{id}` returns a differently-named totals object than the `/managers` list: it omits
   * `user_id` (already in the path), renames `seasons_played` to `seasons` and
   * `total_playoff_wins/losses` to `playoff_wins/losses`, and drops `total_ties` and
   * `playoff_appearances` entirely. Requiring the list's shape here made every request fail to
   * parse, which silently removed lineup efficiency from the scouting report.
   */
  totals: managerCareerSchema
    .partial({ user_id: true, seasons_played: true, total_ties: true, playoff_appearances: true, total_playoff_wins: true, total_playoff_losses: true })
    .extend({ seasons: num.nullish(), win_pct: num.nullish(), playoff_wins: num.nullish(), playoff_losses: num.nullish() })
    .passthrough(),
  seasons: z.array(managerSeasonSchema).default([]),
  attribution: z.string().optional(),
  attribution_url: z.string().optional(),
}).passthrough();

/** A single past meeting. `winner` is the winning user id, or absent on a draw. */
const h2hMatchupSchema = z.object({
  season: num,
  week: num,
  is_playoff: z.coerce.boolean().nullish(),
  round_label: z.string().nullish(),
  score_1: num,
  score_2: num,
  winner: z.string().nullish(),
}).passthrough();

export const h2hResponseSchema = z.object({
  user_id_1: z.string(),
  user_id_2: z.string(),
  name_1: z.string().nullish(),
  name_2: z.string().nullish(),
  total_matchups: num.nullish(),
  wins_1: num.nullish(),
  wins_2: num.nullish(),
  draws: num.nullish(),
  total_pts_1: num.nullish(),
  total_pts_2: num.nullish(),
  matchups: z.array(h2hMatchupSchema).default([]),
  attribution: z.string().optional(),
  attribution_url: z.string().optional(),
}).passthrough();

