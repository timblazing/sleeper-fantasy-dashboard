import { raFetch } from "@/lib/roster-audit/client";
import { h2hResponseSchema, leagueManagersResponseSchema, managerCareerResponseSchema, moversResponseSchema, tradeResponseSchema, picksResponseSchema, ppgRankingsResponseSchema, presetsResponseSchema, playerSearchResponseSchema, playerStatsResponseSchema, rankingsResponseSchema, valuesResponseSchema } from "@/lib/roster-audit/schemas";
import type { RankingsPlayerRow, TradeResponse } from "@/lib/roster-audit/schemas";
import type { RaH2h, RaManagerCareer, RaManagerDossier, RaMovers, RaPaged, RaPick, RaPickCurve, RaPlayerValue, RaPreset, RaResult, RaTrade, RaTradeAsset, RaTradeSide, TradeAssetInput } from "@/lib/roster-audit/types";

export type RankingsParams = { preset: string; position?: string; perPage?: number; page?: number; sort?: string; minAge?: number; maxAge?: number; leagueSize?: number; search?: string };

const mapPreset = (preset: { key: string; label: string; league_size: number; is_sf: boolean; scoring_format: string; is_tep: boolean; format_key: string; reliable: boolean }): RaPreset => ({ key: preset.key, label: preset.label, formatKey: preset.format_key, isSuperflex: preset.is_sf, isTep: preset.is_tep, scoringFormat: preset.scoring_format, leagueSize: preset.league_size, reliable: preset.reliable });

/** /rankings interleaves pick rows with player rows; only the latter map to an RaPlayerValue. */
const isPlayerRow = (row: { sleeper_id: string | null }): row is RankingsPlayerRow => row.sleeper_id !== null;

const mapRankingsPlayer = (player: { sleeper_id: string; name: string; position: string; team: string | null; age: number | null; tier: number | null; trend_7d: number; trend_30d: number; photo_url: string | null; val_sf_market: number; val_1qb_market: number; years_exp: number | null; value: number; rank_overall: number | null; rank_pos: number | null }): RaPlayerValue => ({ sleeperId: player.sleeper_id, name: player.name, position: player.position, team: player.team, age: player.age, tier: player.tier, value: player.value, valueSf: player.val_sf_market, value1qb: player.val_1qb_market, rankOverall: player.rank_overall, rankPosition: player.rank_pos, trend7d: player.trend_7d, trend30d: player.trend_30d, photoUrl: player.photo_url, yearsExp: player.years_exp });

const mapPick = (pick: { id: number; pick_season: number; pick_round: number; pick_slot: "early" | "mid" | "late"; val_sf: number; val_1qb: number; label: string; sort_order: number }): RaPick => ({ id: pick.id, season: pick.pick_season, round: pick.pick_round, slot: pick.pick_slot, label: pick.label, valueSf: pick.val_sf, value1qb: pick.val_1qb, sortOrder: pick.sort_order });

const mapMover = (mover: { sleeper_id: string; name: string; position: string; team: string | null; age: number | null; val_sf: number; trend_7d: number; trend_30d: number; tier: number | null }): RaPlayerValue => ({ sleeperId: mover.sleeper_id, name: mover.name, position: mover.position, team: mover.team, age: mover.age, tier: mover.tier, value: mover.val_sf, valueSf: mover.val_sf, value1qb: null, rankOverall: null, rankPosition: null, trend7d: mover.trend_7d, trend30d: mover.trend_30d, photoUrl: null, yearsExp: null });

const mapSearchPlayer = (player: { sleeper_id: string; name: string; position: string; team: string | null; val_sf: number; val_1qb: number; rank_pos_sf: number | null; trend_7d: number }): RaPlayerValue => ({ sleeperId: player.sleeper_id, name: player.name, position: player.position, team: player.team, age: null, tier: null, value: player.val_sf, valueSf: player.val_sf, value1qb: player.val_1qb, rankOverall: null, rankPosition: player.rank_pos_sf, trend7d: player.trend_7d, trend30d: 0, photoUrl: null, yearsExp: null });

const mapManagerCareer = (manager: { user_id: string; display_name: string; avatar?: string | null; seasons_played: number; total_wins: number; total_losses: number; total_ties: number; win_pct: number; total_pf: number; championships: number; runner_ups: number; last_places: number; playoff_appearances: number; total_playoff_wins: number; total_playoff_losses: number }): RaManagerCareer => ({ userId: manager.user_id, displayName: manager.display_name, avatar: manager.avatar ?? null, seasonsPlayed: manager.seasons_played, wins: manager.total_wins, losses: manager.total_losses, ties: manager.total_ties, winPct: manager.win_pct, pointsFor: manager.total_pf, championships: manager.championships, runnerUps: manager.runner_ups, lastPlaces: manager.last_places, playoffAppearances: manager.playoff_appearances, playoffWins: manager.total_playoff_wins, playoffLosses: manager.total_playoff_losses });

async function mapResult<TIn, TOut>(result: Promise<RaResult<TIn>>, map: (data: TIn) => TOut): Promise<RaResult<TOut>> {
  const awaited = await result;
  return awaited.ok ? { ok: true, data: map(awaited.data), attribution: awaited.attribution } : awaited;
}

export const getPresets = (): Promise<RaResult<RaPreset[]>> => mapResult(raFetch("/presets", presetsResponseSchema, { ttl: 86400 }), (presets) => presets.map(mapPreset));

export const getRankings = (params: RankingsParams): Promise<RaResult<RaPaged<RaPlayerValue>>> => {
  const query = new URLSearchParams({ preset: params.preset });
  if (params.position) query.set("position", params.position);
  if (params.perPage) query.set("per_page", String(params.perPage));
  if (params.page) query.set("page", String(params.page));
  if (params.sort) query.set("sort", params.sort);
  if (params.minAge) query.set("min_age", String(params.minAge));
  if (params.maxAge) query.set("max_age", String(params.maxAge));
  if (params.leagueSize) query.set("league_size", String(params.leagueSize));
  if (params.search) query.set("search", params.search);
  return mapResult(raFetch(`/rankings?${query.toString()}`, rankingsResponseSchema, { ttl: 21600 }), (data) => ({ items: data.players.filter(isPlayerRow).map(mapRankingsPlayer), total: data.total, page: data.page, perPage: data.per_page, totalPages: data.total_pages, preset: data.preset, presetLabel: data.preset_label }));
};

export const getValues = (formatKey: string) => raFetch(`/rankings/values?format_key=${formatKey}`, valuesResponseSchema, { ttl: 21600 });

export const getPicks = (): Promise<RaResult<RaPick[]>> => mapResult(raFetch("/picks", picksResponseSchema, { ttl: 86400 }), (data) => data.picks.map(mapPick));

/**
 * The slot-value curve that rides along on the same `/picks` payload `getPicks` reads.
 *
 * Draft Grades needs the curve and not the tradeable-pick list, and the keys arrive as strings, so
 * this projects the other half of the response into number-keyed maps rather than making callers
 * re-derive it. Same 24h TTL, so requesting both costs one upstream read.
 */
export const getPickCurve = (): Promise<RaResult<RaPickCurve>> => mapResult(raFetch("/picks", picksResponseSchema, { ttl: 86400 }), (data) => ({
  sf: Object.fromEntries(Object.entries(data.pick_curve_sf).map(([pick, value]) => [Number(pick), value])),
  oneQb: Object.fromEntries(Object.entries(data.pick_curve_1qb).map(([pick, value]) => [Number(pick), value])),
}));

export const getMovers = (params?: { position?: string; limit?: number }): Promise<RaResult<RaMovers>> => {
  const query = new URLSearchParams();
  if (params?.position) query.set("position", params.position);
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return mapResult(raFetch(`/movers${qs ? `?${qs}` : ""}`, moversResponseSchema, { ttl: 21600 }), (data) => ({ risers: data.risers.map(mapMover), fallers: data.fallers.map(mapMover), updated: data.updated ?? null }));
};

export const searchPlayers = (params: { q?: string; position?: string; limit?: number; formatKey?: string }): Promise<RaResult<RaPlayerValue[]>> => {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.position) query.set("position", params.position);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.formatKey) query.set("format_key", params.formatKey);
  const qs = query.toString();
  return mapResult(raFetch(`/players/search${qs ? `?${qs}` : ""}`, playerSearchResponseSchema, { ttl: 21600 }), (data) => data.players.map(mapSearchPlayer));
};

export const getPlayerStats = (sleeperId: string) => raFetch(`/player-stats/${sleeperId}`, playerStatsResponseSchema, { ttl: 21600 });

export const getPpgRankings = (params?: { position?: string }) => {
  const query = new URLSearchParams();
  if (params?.position) query.set("position", params.position);
  const qs = query.toString();
  return raFetch(`/projections/ppg-rankings${qs ? `?${qs}` : ""}`, ppgRankingsResponseSchema, { ttl: 21600 });
};

export type TradeSettings = { isSuperflex: boolean; isTePremium: boolean; leagueSize?: number; scoringFormat?: string };

const mapTradeAsset = (asset: TradeResponse["side_a"]["assets"][number]): RaTradeAsset => asset.type === "pick"
  ? { type: "pick", season: asset.season, round: asset.round, slot: asset.slot, label: asset.label, value: asset.value }
  : { type: "player", sleeperId: asset.sleeper_id, name: asset.name, position: asset.position, team: asset.team, age: asset.age, value: asset.value, rankOverall: asset.rank_overall, rankPosition: asset.rank_pos, trend7d: asset.trend_7d, trend30d: asset.trend_30d, tier: asset.tier, photoUrl: asset.photo_url, buyLow: asset.buy_low, sellHigh: asset.sell_high };

const mapTradeSide = (side: TradeResponse["side_a"]): RaTradeSide => ({ assets: side.assets.map(mapTradeAsset), value: side.adjusted_value });

const toRequestAsset = (asset: TradeAssetInput) => asset.type === "player" ? { type: "player", id: asset.id } : { type: "pick", season: asset.season, round: asset.round, slot: asset.slot };

/**
 * POST /trade/calculate. Requires ROSTERAUDIT_API_KEY — the endpoint 401s without one
 * despite the vendor docs advertising free calls, and it is the only rate-limited endpoint
 * (120/hr with a key), so callers must not retry a rate-limit failure.
 */
export const calculateTrade = (input: { sideA: TradeAssetInput[]; sideB: TradeAssetInput[]; settings: TradeSettings }): Promise<RaResult<RaTrade>> => {
  const body = {
    side_a: input.sideA.map(toRequestAsset),
    side_b: input.sideB.map(toRequestAsset),
    settings: { is_superflex: input.settings.isSuperflex, is_te_premium: input.settings.isTePremium, ...(input.settings.leagueSize ? { league_size: input.settings.leagueSize } : {}), ...(input.settings.scoringFormat ? { scoring_format: input.settings.scoringFormat } : {}) },
  };
  return mapResult(raFetch("/trade/calculate", tradeResponseSchema, { ttl: 0, method: "POST", body }), (data) => ({
    sideA: mapTradeSide(data.side_a),
    sideB: mapTradeSide(data.side_b),
    // A tie comes back as `winner: "side_a", grade: "A+"`, so difference is the only reliable tie signal.
    verdict: { winner: data.verdict.difference === 0 ? null : data.verdict.winner === "side_a" ? "sideA" : "sideB", grade: data.verdict.grade, difference: data.verdict.difference, differencePct: data.verdict.difference_pct },
    cliffWarnings: data.cliff_warnings.map((warning) => ({ sleeperId: warning.player_id, name: warning.player_name, position: warning.position, riskLevel: warning.risk_level, riskScore: warning.risk_score, summary: warning.summary, factors: warning.factors, side: warning.side })),
    calculatedAt: data.meta.calculated_at,
  }));
};

/**
 * Career records for every manager in the league's history.
 *
 * Keyed by Sleeper league id, and RosterAudit resolves it to the whole league *group* — so the
 * response covers previous seasons under earlier league ids without walking `previous_league_id`.
 * Requires the league to have been synced; an unsynced one returns `unsynced-league` rather than
 * an empty list, which callers should treat as "no history yet" and not as a failure.
 */
export const getLeagueManagers = (leagueId: string): Promise<RaResult<RaManagerCareer[]>> =>
  mapResult(raFetch(`/league-history/${encodeURIComponent(leagueId)}/managers`, leagueManagersResponseSchema, { ttl: 21600 }), (data) => data.managers.map(mapManagerCareer));


/**
 * One manager's career, season by season.
 *
 * The per-season rows carry `max_points_for` — the optimal-lineup total — which is what makes
 * lineup efficiency (`pointsFor / maxPointsFor`) computable. Nothing else in the API exposes it.
 */
export const getManagerCareer = (leagueId: string, userId: string): Promise<RaResult<RaManagerDossier>> =>
  mapResult(raFetch(`/league-history/${encodeURIComponent(leagueId)}/manager/${encodeURIComponent(userId)}`, managerCareerResponseSchema, { ttl: 21600 }), (data) => ({
    totals: mapManagerCareer({
      user_id: data.totals.user_id ?? userId,
      display_name: data.totals.display_name,
      avatar: data.totals.avatar,
      // `/manager/{id}` names the season count `seasons`; the `/managers` list calls it `seasons_played`.
      seasons_played: data.totals.seasons ?? data.totals.seasons_played ?? 0,
      total_wins: data.totals.total_wins,
      total_losses: data.totals.total_losses,
      total_ties: data.totals.total_ties ?? 0,
      win_pct: data.totals.win_pct ?? 0,
      total_pf: data.totals.total_pf,
      championships: data.totals.championships,
      runner_ups: data.totals.runner_ups,
      last_places: data.totals.last_places,
      playoff_appearances: data.totals.playoff_appearances ?? 0,
      total_playoff_wins: data.totals.total_playoff_wins ?? data.totals.playoff_wins ?? 0,
      total_playoff_losses: data.totals.total_playoff_losses ?? data.totals.playoff_losses ?? 0,
    }),
    seasons: data.seasons.map((season) => ({
      season: season.season,
      wins: season.wins,
      losses: season.losses,
      ties: season.ties ?? 0,
      pointsFor: season.points_for,
      pointsAgainst: season.points_against ?? 0,
      maxPointsFor: season.max_points_for ?? null,
      finalStanding: season.final_standing ?? null,
      madePlayoffs: Boolean(season.made_playoffs),
      wonChampionship: Boolean(season.won_championship),
    })),
  }));

/** The rivalry record between two managers across every synced season of the league group. */
export const getHeadToHead = (leagueId: string, userIdA: string, userIdB: string): Promise<RaResult<RaH2h>> =>
  mapResult(raFetch(`/league-history/${encodeURIComponent(leagueId)}/h2h/${encodeURIComponent(userIdA)}/${encodeURIComponent(userIdB)}`, h2hResponseSchema, { ttl: 21600 }), (data) => ({
    userIdA: data.user_id_1,
    userIdB: data.user_id_2,
    nameA: data.name_1 ?? "",
    nameB: data.name_2 ?? "",
    meetings: data.total_matchups ?? data.matchups.length,
    winsA: data.wins_1 ?? 0,
    winsB: data.wins_2 ?? 0,
    draws: data.draws ?? 0,
    pointsA: data.total_pts_1 ?? 0,
    pointsB: data.total_pts_2 ?? 0,
    games: data.matchups.map((game) => ({
      season: game.season,
      week: game.week,
      isPlayoff: Boolean(game.is_playoff),
      label: game.round_label ?? `Wk ${game.week}`,
      scoreA: game.score_1,
      scoreB: game.score_2,
      winnerUserId: game.winner ?? null,
    })),
  }));
