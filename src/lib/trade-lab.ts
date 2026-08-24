import { deriveLeagueFormat, isDynastyLeague } from "@/lib/league-features";
import { findTeamForUser, getLeagueValueContext } from "@/lib/league-values";
import { calculateTrade, clampLeagueSize, getPicks, type RaPick, type RaResult, type RaTrade, type TradeAssetInput, type TradeSettings } from "@/lib/roster-audit";
import { getNflLeaguesForUsername } from "@/lib/sleeper";
import type { SleeperLeague } from "@/lib/types";

/** A roster entry slimmed to what the calculator renders — the full catalog player is far larger. */
export type TradePlayer = { id: string; name: string; position: string | null; team: string | null; age: number | null; value: number };
export type TradeTeam = { rosterId: number; name: string; manager: string; players: TradePlayer[] };
export type PickOption = { season: number; round: number; slot: "early" | "mid" | "late"; label: string; value: number };

export type TradeLabData = {
  league: { id: string; name: string; season: string; superflex: boolean; isDynasty: boolean };
  teams: TradeTeam[];
  /** The connected Sleeper user's roster id, when a username is attached to the request. */
  myRosterId: number | null;
  picks: PickOption[];
  valuesReady: boolean;
  picksReady: boolean;
};

/**
 * Trade settings are derived from Sleeper league settings on the server so a client cannot
 * ask for a format its league does not play. RosterAudit only publishes PPR presets today,
 * so `scoring_format` is deliberately left off the request and takes the upstream default.
 */
export function deriveTradeSettings(league: SleeperLeague): TradeSettings {
  const format = deriveLeagueFormat(league);
  return { isSuperflex: format.superflex, isTePremium: format.tePremium, leagueSize: clampLeagueSize(league.settings.num_teams) };
}

export async function getTradeLabData(leagueId: string, username?: string): Promise<TradeLabData> {
  const [context, account, picksResult] = await Promise.all([
    getLeagueValueContext(leagueId),
    username ? getNflLeaguesForUsername(username).catch(() => undefined) : undefined,
    getPicks(),
  ]);

  const teams: TradeTeam[] = context.teams.map((team) => ({
    rosterId: team.rosterId,
    name: team.name,
    manager: team.manager,
    players: team.roster
      .map((entry) => ({ id: entry.player.id, name: entry.player.name, position: entry.player.position, team: entry.player.team, age: entry.player.age, value: entry.value }))
      .toSorted((a, b) => b.value - a.value || a.name.localeCompare(b.name)),
  }));

  const superflex = context.superflex;
  const picks: PickOption[] = picksResult.ok
    ? picksResult.data
        .toSorted((a, b) => a.sortOrder - b.sortOrder)
        .map((pick: RaPick) => ({ season: pick.season, round: pick.round, slot: pick.slot, label: pick.label, value: superflex ? pick.valueSf : pick.value1qb }))
    : [];

  return {
    league: { id: leagueId, name: context.league.name, season: context.league.season, superflex, isDynasty: isDynastyLeague(context.league) },
    teams,
    myRosterId: findTeamForUser(context, account?.userId)?.rosterId ?? null,
    picks,
    valuesReady: context.valuesReady,
    picksReady: picksResult.ok,
  };
}

/** Server-side entry point for the trade route: derives settings from the league, never from the client. */
export async function evaluateTrade(leagueId: string, sideA: TradeAssetInput[], sideB: TradeAssetInput[]): Promise<RaResult<RaTrade>> {
  const context = await getLeagueValueContext(leagueId);
  return calculateTrade({ sideA, sideB, settings: deriveTradeSettings(context.league) });
}
