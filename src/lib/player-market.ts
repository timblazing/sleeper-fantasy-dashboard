import { getLeagueValueContext, type LeagueValueContext, type ValuedPlayer } from "@/lib/league-values";
import { resolvePlayer } from "@/lib/players";
import { getMovers } from "@/lib/roster-audit";

export type MarketPlayer = ValuedPlayer & { trend7d: number };

const MOVER_LIMIT = 30;
const FEATURED_LIMIT = 10;

function toMarketPlayer(context: LeagueValueContext, id: string, trend7d: number): MarketPlayer {
  const ownerRosterId = context.rosterByPlayer.get(id) ?? null;
  return {
    player: resolvePlayer(context.catalog, id),
    value: context.values.get(id) ?? 0,
    rankOverall: context.rankOverall.get(id) ?? null,
    rankPosition: context.rankPosition.get(id) ?? null,
    ownerRosterId,
    ownerName: ownerRosterId === null ? null : context.teams.find((team) => team.rosterId === ownerRosterId)?.name ?? null,
    trend7d,
  };
}

function trendMap(movers: { sleeperId: string; trend7d: number }[]): Map<string, number> {
  return new Map(movers.map((mover) => [mover.sleeperId, mover.trend7d]));
}

function searchContext(context: LeagueValueContext, query: string, trends: Map<string, number>, limit: number): MarketPlayer[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  return [...context.catalog.values()]
    .filter((player) => player.name.toLowerCase().includes(trimmed))
    .toSorted((a, b) => {
      const valueDifference = (context.values.get(b.id) ?? 0) - (context.values.get(a.id) ?? 0);
      if (valueDifference) return valueDifference;
      const searchRankDifference = (a.searchRank ?? Number.MAX_SAFE_INTEGER) - (b.searchRank ?? Number.MAX_SAFE_INTEGER);
      return searchRankDifference || a.name.localeCompare(b.name);
    })
    .slice(0, limit)
    .map((player) => toMarketPlayer(context, player.id, trends.get(player.id) ?? 0));
}

/** Lightweight live-search read used by the trade calculator's hypothetical-player search. */
export async function searchMarketPlayers(leagueId: string, query: string, limit = FEATURED_LIMIT): Promise<MarketPlayer[]> {
  const [context, moversResult] = await Promise.all([
    getLeagueValueContext(leagueId),
    getMovers({ limit: MOVER_LIMIT }),
  ]);
  const movers = moversResult.ok ? [...moversResult.data.risers, ...moversResult.data.fallers] : [];
  return searchContext(context, query, trendMap(movers), limit);
}
