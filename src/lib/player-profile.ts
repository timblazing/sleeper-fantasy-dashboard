import "server-only";
import { raFetch } from "@/lib/roster-audit/client";
import { playerPageResponseSchema } from "@/lib/roster-audit/schemas";
import type { PlayerCareerSeason, PlayerCombine, PlayerContract, PlayerHistoryPoint, PlayerInjuryHistory, PlayerProfile, PlayerProjectionSeason, PlayerRankMetric, PlayerRelated, PlayerRelatedPlayer, PlayerSnapWeek, PlayerTradeAsset, PlayerTradeMarket, PlayerWeeklyLine, PlayerWeeklyRank, RaResult } from "@/lib/roster-audit/types";

/**
 * The single seam for the player profile. Everything the profile route renders comes from
 * one /player-page read, so this is the only place a test needs to stub — see
 * player-profile.test.ts.
 *
 * /player-page was 401-without-key on 2026-08-17 and public on 2026-08-20 (API reference
 * §2.9), so the profile is built for every user. The key path still runs through raFetch,
 * which means a re-gating upstream surfaces as a normal `missing-key` RaError rather than
 * as a crash.
 */

/** Upstream sends most numerics as strings, with `null` meaning "not measured" — never zero. */
function statCell(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Coerces an untyped upstream row to numbers, dropping the keys the caller reads directly. */
function statRow(row: Record<string, unknown>, omit: string[] = []): Record<string, number | null> {
  const stats: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(row)) {
    if (omit.includes(key)) continue;
    if (typeof value !== "number" && typeof value !== "string" && value !== null) continue;
    stats[key] = statCell(value);
  }
  return stats;
}

const WEEKLY_OWN_KEYS = ["wk", "fp", "fpp", "opp"];
const CAREER_OWN_KEYS = ["season"];
const PROJECTION_OWN_KEYS = ["year", "games", "ppg_std", "ppg_ppr"];

/**
 * The advanced block the Production tab reads, flattened from `ngs` and `pbp` into one
 * record. Both upstream sections are open records of mixed string/number cells, so the
 * whitelist here is what keeps a schema drift upstream from silently adding UI rows.
 */
const NGS_KEYS = ["avg_separation", "avg_cushion", "catch_percentage", "avg_yac", "avg_yac_above_expectation", "percent_share_of_intended_air_yards", "avg_intended_air_yards_rec"];
const PBP_KEYS = ["rz_target_rate", "rz_carry_rate", "deep_target_rate", "success_rate", "third_down_rate", "play_action_rate", "shotgun_rate", "targets_trailing_rate", "targets_leading_rate"];

function pickKeys(row: Record<string, unknown> | null | undefined, keys: string[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  if (!row) return out;
  for (const key of keys) if (key in row) out[key] = statCell(row[key]);
  return out;
}

const mapRelatedPlayer = (row: { sleeper_id: string; name: string; position: string; team?: string | null; val_sf: number | null; age: number | null }): PlayerRelatedPlayer =>
  ({ sleeperId: row.sleeper_id, name: row.name, position: row.position, team: row.team ?? null, valueSf: row.val_sf, age: row.age });

const mapTradeAssets = (side: { players?: { id: string; name: string; position?: string | null }[] | null; picks?: { season: string; round: number }[] | null } | null | undefined): PlayerTradeAsset =>
  ({ players: (side?.players ?? []).map((p) => ({ id: p.id, name: p.name, position: p.position ?? null })), picks: (side?.picks ?? []).map((p) => ({ season: p.season, round: p.round })) });

export async function getPlayerProfile(sleeperId: string): Promise<RaResult<PlayerProfile>> {
  const result = await raFetch(`/player-page/${encodeURIComponent(sleeperId)}`, playerPageResponseSchema, { ttl: 21600 });
  if (!result.ok) return result;
  const { player, value, value_history, cliff_risk, stats, projection_stats, history, rankings, projection, projection_summary, projection_outcome, projection_ppg, projection_ppg_ppr, injury, contract, combine, snaps, snaps_weekly, ngs, pbp, recent_trades, related } = result.data;

  const weekly: PlayerWeeklyLine[] = (stats?.weekly ?? []).map((line) => ({
    week: line.wk,
    opponent: line.opp,
    points: line.fp,
    pointsPpr: line.fpp,
    stats: statRow(line as Record<string, unknown>, WEEKLY_OWN_KEYS),
  }));

  const career: PlayerCareerSeason[] = (stats?.career ?? []).map((row) => ({
    season: statCell(row.season),
    stats: statRow(row as Record<string, unknown>, CAREER_OWN_KEYS),
  }));

  const projections: PlayerProjectionSeason[] = (projection_stats ?? []).map((row) => ({
    season: row.year,
    games: row.games,
    ppgStandard: row.ppg_std,
    ppgPpr: row.ppg_ppr,
    stats: statRow(row as Record<string, unknown>, PROJECTION_OWN_KEYS),
  }));

  // The career arc uses the SF series — the same format the rest of the profile leads with.
  const historyPoints: PlayerHistoryPoint[] = (history?.sf?.points ?? []).map((point) => ({ date: point.d, value: point.v, rankOverall: point.o, rankPosition: point.p }));

  // `metrics` is keyed by metric name and `metric_configs` carries the labels, so the two are
  // joined here rather than in the view. Config is the label source; a metric with no config
  // still renders under a humanised key rather than being dropped.
  const configs = rankings?.metric_configs ?? {};
  const rankMetrics: PlayerRankMetric[] = Object.entries(rankings?.metrics ?? {}).map(([key, metric]) => ({
    key,
    label: configs[key]?.label ?? key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    rank: metric.rank, of: metric.of, value: metric.value, percentile: metric.pctile,
    isElite: metric.is_elite ?? false,
    lowerIsBetter: metric.lower_better ?? configs[key]?.lower ?? false,
    why: configs[key]?.why ?? null,
    above: metric.above ?? [], below: metric.below ?? [],
  }));

  const weeklyRanks: PlayerWeeklyRank[] = Object.entries(rankings?.weekly_ranks ?? {})
    .map(([week, rank]) => ({ week: Number(week), rank: rank.rank, of: rank.of }))
    .filter((entry) => Number.isFinite(entry.week))
    .sort((a, b) => a.week - b.week);

  const injuryHistory: PlayerInjuryHistory | null = injury
    ? {
        grade: injury.grade ?? null, score: injury.score ?? null,
        events: (injury.nfl ?? []).map((event) => ({ season: event.s, week: event.w, title: event.t, bodyPart: event.b ?? null, severity: event.sv ?? null, gamesMissed: event.g, detail: event.d ?? null })),
        preNfl: (injury.pre_nfl ?? []).map((event) => ({ year: event.year, description: event.desc, significance: event.sig ?? null })),
      }
    : null;

  const contractInfo: PlayerContract | null = contract
    ? { years: contract.years, yearsLeft: contract.years_left, expiryYear: contract.expiry_year, totalValue: contract.total_value, apy: contract.apy, guaranteed: contract.guaranteed, team: contract.team ?? null, isRookieDeal: contract.is_rookie_deal ?? false, isExpiring: contract.is_expiring ?? false, otcUrl: contract.otc_url ?? null }
    : null;

  const combineInfo: PlayerCombine | null = combine
    ? { season: combine.season ?? null, draftTeam: combine.draft_team ?? null, draftRound: combine.draft_round ?? null, draftPick: combine.draft_pick ?? null, school: combine.school ?? null, forty: combine.forty ?? null, vertical: combine.vertical ?? null, broadJump: combine.broad_jump ?? null, cone: combine.cone ?? null, shuttle: combine.shuttle ?? null, bench: combine.bench ?? null }
    : null;

  const snapWeeks: PlayerSnapWeek[] = (snaps_weekly ?? []).map((week) => ({ week: week.week, offensePct: week.off_pct, offenseSnaps: week.off_snaps, opponent: week.opp ?? null }));

  const tradeMarket: PlayerTradeMarket | null = recent_trades
    ? {
        trades: (recent_trades.trades ?? []).map((trade) => ({ id: trade.transaction_id, date: trade.trade_date ?? null, format: trade.league_format ?? null, cost: mapTradeAssets(trade.cost), alongside: mapTradeAssets(trade.alongside) })),
        totalTrades: recent_trades.total_trades ?? null,
        avgCost: recent_trades.stats?.avg_cost ?? null,
        medianCost: recent_trades.stats?.median_cost ?? null,
      }
    : null;

  const relatedPlayers: PlayerRelated | null = related
    ? { teammates: (related.teammates ?? []).map(mapRelatedPlayer), sameTier: (related.same_tier ?? []).map(mapRelatedPlayer), similarValue: (related.similar_value ?? []).map(mapRelatedPlayer) }
    : null;

  return {
    ok: true,
    attribution: result.attribution,
    data: {
      player: {
        sleeperId: player.sleeper_id,
        name: player.name,
        position: player.position,
        team: player.team,
        age: player.age,
        yearsExp: player.years_exp,
        college: player.college,
        heightInches: player.height,
        weightLbs: player.weight,
        photoUrl: player.photo_url,
      },
      value: {
        valueSf: value.sf,
        value1qb: value.one_qb,
        tier: value.tier,
        tierLabel: value.tier_label,
        rankOverallSf: value.rank_sf,
        rankOverall1qb: value.rank_1qb,
        rankPositionSf: value.rank_pos_sf,
        rankPosition1qb: value.rank_pos_1qb,
        trend7d: value.trend_7d,
        trend30d: value.trend_30d,
      },
      valueHistory: (value_history ?? []).map((point) => ({ date: point.date, valueSf: point.sf, value1qb: point.one_qb })),
      // The spec is explicit: render cliff risk only when a validated response carries it,
      // and never derive a level from age.
      cliffRisk: cliff_risk
        ? { level: cliff_risk.risk_level, score: cliff_risk.risk_score, recommendation: cliff_risk.recommendation?.summary ?? null, factors: cliff_risk.risk_factors ?? [] }
        : null,
      season: stats?.season ?? null,
      weekly,
      summary: stats?.summary ? statRow(stats.summary) : null,
      career,
      projections,
      history: historyPoints,
      rankMetrics,
      weeklyRanks,
      rankSeason: rankings?.season ?? null,
      // `confidence: "actual"` is the present-day anchor; everything after it is forecast, and
      // the chart splits the line there rather than drawing one continuous certain-looking curve.
      projectionCurve: (projection ?? []).map((point) => ({ year: point.year, value: point.value, confidence: point.confidence, isActual: point.confidence === "actual" })),
      projectionSummary: projection_summary ?? null,
      outcome: projection_outcome
        ? { p90: projection_outcome.p90 ? { finish: projection_outcome.p90.finish ?? null, value: projection_outcome.p90.value } : null, p50: projection_outcome.p50 ? { finish: projection_outcome.p50.finish ?? null, value: projection_outcome.p50.value } : null, p10: projection_outcome.p10 ? { finish: projection_outcome.p10.finish ?? null, value: projection_outcome.p10.value } : null, breakoutPct: projection_outcome.breakout_pct, bustPct: projection_outcome.bust_pct, strategy: projection_outcome.strategy ?? null, archetype: projection_outcome.archetype ?? null, risk: projection_outcome.risk }
        : null,
      projectedPpg: projection_ppg ?? null,
      projectedPpgPpr: projection_ppg_ppr ?? null,
      injury: injuryHistory,
      contract: contractInfo,
      combine: combineInfo,
      snapsWeekly: snapWeeks,
      avgSnapPct: snaps?.avg_off_pct ?? null,
      advanced: { ...pickKeys(ngs, NGS_KEYS), ...pickKeys(pbp, PBP_KEYS) },
      tradeMarket,
      related: relatedPlayers,
    },
  };
}
