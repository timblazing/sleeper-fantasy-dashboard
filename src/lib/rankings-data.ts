import { deriveLeagueFormat, isSuperflexLeague } from "@/lib/league-features";
import { toRedraftValues } from "@/lib/redraft-values";
import { ROOM_POSITIONS } from "@/lib/roster-positions";
import { getMovers, getPicks, getPresets, getProjectedPpg, getRankings, resolvePreset } from "@/lib/roster-audit";
import type { Attribution, RaError, RaPick, RaPlayerValue, RaPreset, RaProjectedPlayer } from "@/lib/roster-audit";
import { getLeague, getLeagueRosters, getLeagueUsers, getNflLeaguesForUsername } from "@/lib/sleeper";
import type { RankingsQuery } from "@/lib/rankings-query";
import type { SleeperLeague } from "@/lib/types";
import type { ValueBasis } from "@/lib/value-basis";

export const RANKINGS_PER_PAGE = 50; // rosteraudit-api-reference.md §2.4: the real per_page floor is 10; 50 matches the vendor UI.
const FALLBACK_ATTRIBUTION: Attribution = { text: "Values by RosterAudit.com", url: "https://rosteraudit.com" };

export type RankingsOwner = { teamName: string; isMine: boolean };
export type RankingsPlayerRow = { kind: "player"; key: string; rank: number; sleeperId: string; name: string; position: string; team: string | null; age: number | null; tier: number | null; value: number; trend7d: number; rankPosition: number | null; photoUrl: string | null; owner: RankingsOwner | null };
export type RankingsPickRow = { kind: "pick"; key: string; rank: number; label: string; value: number };
export type RankingsRow = RankingsPlayerRow | RankingsPickRow;
export type RankingsMover = { sleeperId: string; name: string; position: string; team: string | null; trend7d: number };
export type RankingsView = {
  leagueId: string; leagueName: string; leagueSummary: string; isSuperflex: boolean;
  /** Which currency every `value` on this board is quoted in. */
  basis: ValueBasis;
  presetKey: string; presetLabel: string;
  rows: RankingsRow[]; total: number; totalLabel: string; page: number; totalPages: number; maxValue: number;
  movers: { risers: RankingsMover[]; fallers: RankingsMover[] } | null;
  attribution: Attribution;
};
export type RankingsResult = { ok: true; view: RankingsView } | { ok: false; error: RaError };

// The demo league never hits Sleeper, so stand in a league shape that derives a real preset.
const DEMO_LEAGUE: SleeperLeague = { league_id: "demo", name: "Sunday Syndicate", season: "2026", sport: "nfl", status: "in_season", avatar: null, previous_league_id: null, roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE", "SUPER_FLEX"], scoring_settings: { rec: 1 }, settings: { num_teams: 12, type: 2 } };

const upstream = (message: string): RaError => ({ kind: "upstream-unavailable", message, retryable: true });
const pickValue = (pick: RaPick, isSuperflex: boolean) => (isSuperflex ? pick.valueSf : pick.value1qb); // Never `sf ?? 1qb` — that is the §2.8 regression.
const toMover = (player: RaPlayerValue): RankingsMover => ({ sleeperId: player.sleeperId, name: player.name, position: player.position, team: player.team, trend7d: player.trend7d });

function describeLeague(league: SleeperLeague, preset: RaPreset): string {
  const teams = league.settings.num_teams ?? preset.leagueSize;
  return [`${teams}T`, preset.isSuperflex ? "SF" : "1QB", preset.scoringFormat.toUpperCase(), preset.isTep ? "TEP" : null].filter(Boolean).join(" · ");
}

async function loadOwnership(leagueId: string, username?: string): Promise<Map<string, RankingsOwner>> {
  const map = new Map<string, RankingsOwner>();
  if (leagueId === "demo") return map;
  try {
    const [rosters, users, account] = await Promise.all([
      getLeagueRosters(leagueId),
      getLeagueUsers(leagueId),
      username ? getNflLeaguesForUsername(username).catch(() => undefined) : undefined,
    ]);
    const userById = new Map(users.map((user) => [user.user_id, user]));
    for (const roster of rosters) {
      const user = roster.owner_id ? userById.get(roster.owner_id) : undefined;
      // Team-name expression taken verbatim from src/lib/dashboard-data.ts.
      const teamName = user?.metadata?.team_name || user?.display_name || `Roster ${roster.roster_id}`;
      const isMine = Boolean(account && roster.owner_id && roster.owner_id === account.userId);
      for (const playerId of roster.players ?? []) map.set(playerId, { teamName, isMine });
    }
  } catch {
    return map;
  }
  return map;
}

/** Draft picks are merged into the player list only where the merge is meaningful.
 *  Picks have no age and no player name, so interleaving them into an age- or name-sorted
 *  list, or into a single-position tab, would be nonsense. `position=picks` shows picks
 *  only; QB/RB/WR/TE show players only; `all` + `sort=value` is the interleaved view
 *  (rosteraudit-api-reference.md §2.5 — /rankings itself never returns picks). */
const shouldMergePicks = (query: RankingsQuery) => query.sort === "value" && query.position === "all";

// docs/endpoints.md §4.4: /rankings filters by position, age, and search — never by
// experience — so a rookies tab cannot be a server-side filter. The tab therefore pulls one
// wide page and keeps `years_exp === 0`, then paginates locally exactly as `picks` does.
// 100 is the documented per_page ceiling; rookies are a small slice of the pool, so one page
// covers every rookie the API ranks. A rookie whose years_exp is null is not counted — an
// unknown is not a match, and guessing would put veterans on a rookie tab.
const ROOKIE_FETCH_PER_PAGE = 100;
const isRookie = (player: RaPlayerValue) => player.yearsExp === 0;

const describeRedraftLeague = (league: SleeperLeague): string =>
  [`${league.settings.num_teams ?? 12}T`, isSuperflexLeague(league) ? "SF" : "1QB", "PPR"].join(" · ");

/**
 * The redraft board: every projected player, priced as points per game above the replacement
 * this league's starting lineup implies.
 *
 * Everything is done here rather than upstream because `/projections/ppg-rankings` takes no
 * filters worth using — it is one cheap cached read of the whole board, and replacement level is
 * a league-wide comparison that a position-filtered request could not produce anyway. Picks and
 * rookies have no meaning on this board, so those tabs collapse to the full list.
 */
async function redraftRankingsView(leagueId: string, league: SleeperLeague, query: RankingsQuery): Promise<RankingsResult> {
  const [projected, ownership] = await Promise.all([getProjectedPpg(), loadOwnership(leagueId, query.username)]);
  if (!projected.ok) return { ok: false, error: projected.error };

  const values = toRedraftValues(projected.data, league);
  const position = query.position === "picks" || query.position === "rookies" ? "all" : query.position;
  const needle = query.search.trim().toLowerCase();

  const matches = (player: RaProjectedPlayer) =>
    (ROOM_POSITIONS as readonly string[]).includes(player.position)
    && (position === "all" || player.position === position)
    && (!needle || player.name.toLowerCase().includes(needle))
    && (query.minAge === undefined || (player.age !== null && player.age >= query.minAge))
    && (query.maxAge === undefined || (player.age !== null && player.age <= query.maxAge));

  const ranked = projected.data
    .filter(matches)
    .map((player) => ({ player, value: values.get(player.sleeperId) ?? 0 }))
    .toSorted((a, b) => {
      if (query.sort === "name") return a.player.name.localeCompare(b.player.name);
      // Nulls last, so an unknown age never claims the top of the youngest-first list.
      if (query.sort === "age") return (a.player.age ?? Infinity) - (b.player.age ?? Infinity) || a.player.name.localeCompare(b.player.name);
      return b.value - a.value || a.player.name.localeCompare(b.player.name);
    });

  // Position rank is the standing on the full board, not within the current filter, so "RB3"
  // still means RB3 after a search narrows the page to one player.
  const positionRank = new Map<string, number>();
  for (const room of ROOM_POSITIONS) {
    projected.data
      .filter((player) => player.position === room)
      .toSorted((a, b) => (values.get(b.sleeperId) ?? 0) - (values.get(a.sleeperId) ?? 0))
      .forEach((player, index) => positionRank.set(player.sleeperId, index + 1));
  }

  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / RANKINGS_PER_PAGE));
  const start = (query.page - 1) * RANKINGS_PER_PAGE;
  const rows: RankingsRow[] = ranked.slice(start, start + RANKINGS_PER_PAGE).map(({ player, value }, index) => ({
    kind: "player",
    key: `player-${player.sleeperId}`,
    rank: start + index + 1,
    sleeperId: player.sleeperId,
    name: player.name,
    position: player.position,
    team: player.team,
    age: player.age,
    tier: null,
    value,
    // The projection board publishes no movement, and a dynasty trend would be the wrong number.
    trend7d: 0,
    rankPosition: positionRank.get(player.sleeperId) ?? null,
    photoUrl: null,
    owner: ownership.get(player.sleeperId) ?? null,
  }));

  const format = deriveLeagueFormat(league);
  return {
    ok: true,
    view: {
      leagueId, leagueName: league.name, leagueSummary: describeRedraftLeague(league), isSuperflex: format.superflex,
      basis: "redraft", presetKey: format.presetKey, presetLabel: "Projected PPG",
      rows, total, totalLabel: `${total.toLocaleString()} ${total === 1 ? "player" : "players"}`,
      page: query.page, totalPages, maxValue: rows.reduce((max, row) => Math.max(max, row.value), 0),
      movers: null, attribution: projected.attribution,
    },
  };
}

export async function getRankingsView(leagueId: string, query: RankingsQuery): Promise<RankingsResult> {
  let league: SleeperLeague;
  if (leagueId === "demo") league = DEMO_LEAGUE;
  else {
    try { league = await getLeague(leagueId); } catch (error) { return { ok: false, error: upstream(error instanceof Error ? error.message : "Sleeper league unavailable") }; }
  }

  if (deriveLeagueFormat(league).basis === "redraft") return redraftRankingsView(leagueId, league, query);

  const presetsResult = await getPresets();
  if (!presetsResult.ok) return { ok: false, error: presetsResult.error };
  // No override argument: the scoring format is a property of the connected league, not a
  // control. `resolvePreset` derives it from roster_positions + scoring_settings, so a
  // superflex TE-premium league only ever sees superflex TE-premium values.
  const preset = resolvePreset(league, undefined, presetsResult.data);
  if (!preset) return { ok: false, error: { kind: "invalid-response", message: "No RosterAudit preset matches this league", retryable: false } };
  const isSuperflex = preset.isSuperflex;

  const picksOnly = query.position === "picks";
  const rookiesOnly = query.position === "rookies";
  const [rankingsResult, picksResult, moversResult, ownership] = await Promise.all([
    picksOnly ? undefined : getRankings({ preset: preset.key, position: rookiesOnly ? undefined : query.position === "all" ? undefined : query.position, perPage: rookiesOnly ? ROOKIE_FETCH_PER_PAGE : RANKINGS_PER_PAGE, page: rookiesOnly ? 1 : query.page, sort: query.sort, minAge: query.minAge, maxAge: query.maxAge, leagueSize: preset.leagueSize, search: query.search || undefined }),
    picksOnly || shouldMergePicks(query) ? getPicks() : undefined,
    getMovers({ limit: 5 }),
    loadOwnership(leagueId, query.username),
  ]);

  if (rankingsResult && !rankingsResult.ok) return { ok: false, error: rankingsResult.error };
  if (picksOnly && picksResult && !picksResult.ok) return { ok: false, error: picksResult.error };

  const allPicks = picksResult?.ok ? picksResult.data : [];
  const attribution = (rankingsResult?.ok ? rankingsResult.attribution : picksResult?.ok ? picksResult.attribution : undefined) ?? FALLBACK_ATTRIBUTION;

  let rows: RankingsRow[];
  let total: number;
  let totalPages: number;

  if (picksOnly) {
    const needle = query.search.toLowerCase();
    const filtered = allPicks
      .filter((pick) => !needle || pick.label.toLowerCase().includes(needle))
      .map((pick) => ({ pick, value: pickValue(pick, isSuperflex) }))
      .toSorted((a, b) => (query.sort === "name" ? a.pick.label.localeCompare(b.pick.label) : b.value - a.value));
    total = filtered.length;
    totalPages = Math.max(1, Math.ceil(total / RANKINGS_PER_PAGE));
    const start = (query.page - 1) * RANKINGS_PER_PAGE;
    rows = filtered.slice(start, start + RANKINGS_PER_PAGE).map(({ pick, value }, index) => ({ kind: "pick", key: `pick-${pick.id}`, rank: start + index + 1, label: pick.label, value }));
  } else if (rookiesOnly && rankingsResult?.ok) {
    // Local slice: upstream already applied search and the age range, so only the rookie
    // predicate and the page window are left. Sort order is whatever /rankings returned.
    const rookies = rankingsResult.data.items.filter(isRookie);
    total = rookies.length;
    totalPages = Math.max(1, Math.ceil(total / RANKINGS_PER_PAGE));
    const start = (query.page - 1) * RANKINGS_PER_PAGE;
    rows = rookies.slice(start, start + RANKINGS_PER_PAGE).map((player, index) => ({ kind: "player", key: `player-${player.sleeperId}`, rank: start + index + 1, sleeperId: player.sleeperId, name: player.name, position: player.position, team: player.team, age: player.age, tier: player.tier, value: player.value, trend7d: player.trend7d, rankPosition: player.rankPosition, photoUrl: player.photoUrl, owner: ownership.get(player.sleeperId) ?? null }));
  } else if (rankingsResult?.ok) {
    const paged = rankingsResult.data;
    total = paged.total;
    totalPages = Math.max(1, paged.totalPages);
    const playerRows: RankingsRow[] = paged.items.map((player) => ({ kind: "player", key: `player-${player.sleeperId}`, rank: 0, sleeperId: player.sleeperId, name: player.name, position: player.position, team: player.team, age: player.age, tier: player.tier, value: player.value, trend7d: player.trend7d, rankPosition: player.rankPosition, photoUrl: player.photoUrl, owner: ownership.get(player.sleeperId) ?? null }));

    let merged = playerRows;
    let startRank = (paged.page - 1) * (paged.perPage || RANKINGS_PER_PAGE) + 1;
    if (shouldMergePicks(query) && allPicks.length && playerRows.length) {
      // /rankings paginates server-side and picks are merged here, so a pick can only be
      // placed on the page whose value range contains it; picks outside that range belong
      // to another page and are not shown here.
      const values = playerRows.map((row) => row.value);
      const pageMax = Math.max(...values);
      const pageMin = Math.min(...values);
      const isFirstPage = paged.page <= 1;
      const isLastPage = paged.page >= totalPages;
      const scored = allPicks.map((pick) => ({ pick, value: pickValue(pick, isSuperflex) }));
      const onPage = scored.filter(({ value }) => (value <= pageMax || isFirstPage) && (value >= pageMin || isLastPage));
      startRank += isFirstPage ? 0 : scored.filter(({ value }) => value > pageMax).length;
      const pickRows: RankingsRow[] = onPage.map(({ pick, value }) => ({ kind: "pick", key: `pick-${pick.id}`, rank: 0, label: pick.label, value }));
      merged = [...playerRows, ...pickRows].toSorted((a, b) => b.value - a.value);
    }
    rows = merged.map((row, index) => ({ ...row, rank: startRank + index }));
  } else {
    return { ok: false, error: upstream("Rankings unavailable") };
  }

  // rosteraudit-api-reference.md §2.6: the /movers percent-change field is off by ~10,000x,
  // so only trend fields cross this boundary; §3 notes /movers carries no val_1qb at all.
  const movers = moversResult.ok ? { risers: moversResult.data.risers.map(toMover), fallers: moversResult.data.fallers.map(toMover) } : null;
  const maxValue = rows.reduce((max, row) => Math.max(max, row.value), 0);

  return {
    ok: true,
    view: {
      leagueId, leagueName: league.name, leagueSummary: describeLeague(league, preset), isSuperflex,
      basis: "dynasty", presetKey: preset.key, presetLabel: preset.label,
      rows, total, totalLabel: `${total.toLocaleString()} ${picksOnly ? (total === 1 ? "pick" : "picks") : rookiesOnly ? (total === 1 ? "rookie" : "rookies") : total === 1 ? "player" : "players"}`,
      page: query.page, totalPages, maxValue, movers, attribution,
    },
  };
}
