import { deriveLeagueFormat, isDynastyLeague } from "@/lib/league-features";
import { liveSource, type LeagueSource } from "@/lib/league-source";
import { findTeamForUser, getLeagueValueContext, type LeagueValueContext } from "@/lib/league-values";
import { calculateTrade, clampLeagueSize, getPicks, type RaPick, type RaResult, type RaTrade, type TradeAssetInput, type TradeSettings } from "@/lib/roster-audit";
import { getNflLeaguesForUsername } from "@/lib/sleeper";
import type { SleeperLeague } from "@/lib/types";
import { sumValues, type ValueBasis } from "@/lib/value-basis";

/** A roster entry slimmed to what the calculator renders — the full catalog player is far larger. */
export type TradePlayer = { id: string; name: string; position: string | null; team: string | null; age: number | null; value: number };
export type TradeTeam = { rosterId: number; name: string; manager: string; players: TradePlayer[] };
export type PickOption = { season: number; round: number; slot: "early" | "mid" | "late"; label: string; value: number };

export type TradeLabData = {
  league: { id: string; name: string; season: string; superflex: boolean; isDynasty: boolean; basis: ValueBasis };
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
  const context = await getLeagueValueContext(leagueId);
  // Future rookie picks are a dynasty asset class. A redraft league's next draft belongs to next
  // season's league, which nobody in this one can trade for, so the pick list is not fetched at all.
  const [account, picksResult] = await Promise.all([
    username ? getNflLeaguesForUsername(username).catch(() => undefined) : undefined,
    context.basis === "dynasty" ? getPicks() : undefined,
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
  const picks: PickOption[] = picksResult?.ok
    ? picksResult.data
        .toSorted((a, b) => a.sortOrder - b.sortOrder)
        .map((pick: RaPick) => ({ season: pick.season, round: pick.round, slot: pick.slot, label: pick.label, value: superflex ? pick.valueSf : pick.value1qb }))
    : [];

  return {
    league: { id: leagueId, name: context.league.name, season: context.league.season, superflex, isDynasty: isDynastyLeague(context.league), basis: context.basis },
    teams,
    myRosterId: findTeamForUser(context, account?.userId)?.rosterId ?? null,
    picks,
    valuesReady: context.valuesReady,
    // A redraft league has no picks to fetch, so "ready" is the honest answer rather than a warning.
    picksReady: picksResult ? picksResult.ok : true,
  };
}

/** How far apart the two sides can be before the deal stops being fair, as a share of the bigger side. */
const REDRAFT_GRADE_BANDS: [number, string][] = [[0.03, "A+"], [0.08, "A"], [0.15, "A-"], [0.25, "B"], [0.4, "C"], [0.6, "D"]];

/**
 * A redraft trade, graded here rather than at RosterAudit.
 *
 * `/trade/calculate` prices dynasty assets — age curves, rookie picks, contending windows — none
 * of which decide a one-season deal. What decides it is the starting points each side gains or
 * loses, which is exactly the currency `getLeagueValueContext` already holds for this league, so
 * the whole calculation is local: no upstream call, no rate limit, and no dynasty number can leak
 * into a redraft verdict. The grade reads the *gap* as a share of the larger side, so a 2-point
 * gap between two blockbusters grades better than the same gap between two spare parts.
 */
function evaluateRedraftTrade(context: LeagueValueContext, sideA: TradeAssetInput[], sideB: TradeAssetInput[]): RaTrade {
  const price = (assets: TradeAssetInput[]) => assets.flatMap((asset) => {
    // Picks are unreachable in a redraft league (`getTradeLabData` sends none), and a hand-rolled
    // request naming one is priced at zero rather than guessed at.
    if (asset.type !== "player") return [];
    const player = context.catalog.get(asset.id);
    const value = context.values.get(asset.id) ?? 0;
    return [{
      type: "player" as const,
      sleeperId: asset.id,
      name: player?.name ?? "Unknown player",
      position: player?.position ?? "—",
      team: player?.team ?? null,
      age: player?.age ?? null,
      value,
      rankOverall: context.rankOverall.get(asset.id) ?? null,
      rankPosition: context.rankPosition.get(asset.id) ?? null,
      trend7d: 0,
      trend30d: 0,
      tier: null,
      photoUrl: null,
      buyLow: false,
      sellHigh: false,
    }];
  });

  const assetsA = price(sideA);
  const assetsB = price(sideB);
  const valueA = sumValues(assetsA.map((asset) => asset.value));
  const valueB = sumValues(assetsB.map((asset) => asset.value));
  const difference = Math.abs(sumValues([valueA, -valueB]));
  const larger = Math.max(valueA, valueB);
  const share = larger > 0 ? difference / larger : 0;
  const grade = difference === 0 ? "A+" : REDRAFT_GRADE_BANDS.find(([ceiling]) => share <= ceiling)?.[1] ?? "F";

  return {
    sideA: { assets: assetsA, value: valueA },
    sideB: { assets: assetsB, value: valueB },
    verdict: {
      winner: difference === 0 ? null : valueA > valueB ? "sideA" : "sideB",
      grade,
      difference,
      differencePct: Math.round(share * 1000) / 10,
    },
    // Age-cliff risk is a dynasty concern: a 30-year-old who produces this season is worth exactly
    // his production here, so there is nothing to warn about.
    cliffWarnings: [],
    calculatedAt: new Date().toISOString(),
  };
}

/** Server-side entry point for the trade route: derives settings from the league, never from the client. */
export async function evaluateTrade(leagueId: string, sideA: TradeAssetInput[], sideB: TradeAssetInput[], source: LeagueSource = liveSource): Promise<RaResult<RaTrade>> {
  const context = await getLeagueValueContext(leagueId, source);
  if (context.basis === "redraft") {
    return { ok: true, data: evaluateRedraftTrade(context, sideA, sideB), attribution: { text: "Projections by RosterAudit.com", url: "https://rosteraudit.com" } };
  }
  return calculateTrade({ sideA, sideB, settings: deriveTradeSettings(context.league) });
}
