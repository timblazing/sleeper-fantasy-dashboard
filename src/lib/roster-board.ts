import { getLeagueBase, teamIdentity } from "@/lib/league-context";
import { liveSource, type LeagueSource } from "@/lib/league-source";
import { resolvePlayer } from "@/lib/players";
import type { NflPlayer, PlayerGame, RosterGroup, RosterSlot, SleeperLeague, SleeperRoster, TeamRoster } from "@/lib/types";
import { points as fantasyPoints } from "@/lib/utils";

const SLOT_LABELS: Record<string, string> = { SUPER_FLEX: "SFLEX", REC_FLEX: "W/T", WRRB_FLEX: "W/R", IDP_FLEX: "IDP", DEF: "D/ST" };
// Anything in `roster_positions` that is not one of these is a starting lineup slot, and the
// `starters` array lines up positionally with those slots.
const NON_STARTING = new Set(["BN", "IR", "TAXI"]);
const BYE: PlayerGame = { opponent: null, home: false, kickoff: null, state: "pre", detail: "Bye", bye: true };

export const slotLabel = (slot: string) => SLOT_LABELS[slot] ?? slot;
export const startingSlots = (league: SleeperLeague) => league.roster_positions.filter((slot) => !NON_STARTING.has(slot));

function gameFor(player: NflPlayer | null, games: Map<string, PlayerGame>): PlayerGame | null {
  if (!player?.team) return null;
  if (games.size === 0) return null;
  return games.get(player.team) ?? BYE;
}

/** Pairs `starters` with the league's starting slots, keeping empty slots visible. */
export function buildStarterSlots(league: SleeperLeague, starters: string[], catalog: Map<string, NflPlayer>, games: Map<string, PlayerGame>, points?: number[] | null): RosterSlot[] {
  return startingSlots(league).map((slot, index) => {
    const playerId = starters[index];
    const player = playerId && playerId !== "0" ? resolvePlayer(catalog, playerId) : null;
    return { slot: slotLabel(slot), player, points: points?.[index] ?? null, projection: null, projectionOpponent: null, projectionHome: null, game: gameFor(player, games) };
  });
}

function reserveGroup(label: string, ids: string[], catalog: Map<string, NflPlayer>, games: Map<string, PlayerGame>, pointsById: Record<string, number> | null): RosterGroup {
  const slots = ids.map((id) => {
    const player = resolvePlayer(catalog, id);
    return { slot: player.position ?? "—", player, points: pointsById?.[id] ?? null, projection: null, projectionOpponent: null, projectionHome: null, game: gameFor(player, games) };
  });
  // Bench and taxi have no fixed order from Sleeper, so group by position for a readable list.
  const order = ["QB", "RB", "WR", "TE", "K", "DEF"];
  slots.sort((a, b) => (order.indexOf(a.slot) + 1 || 99) - (order.indexOf(b.slot) + 1 || 99) || (a.player?.name ?? "").localeCompare(b.player?.name ?? ""));
  return { label, slots };
}

function countByPosition(ids: string[], catalog: Map<string, NflPlayer>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of ids) {
    const position = resolvePlayer(catalog, id).position ?? "—";
    counts[position] = (counts[position] ?? 0) + 1;
  }
  return counts;
}

function teamRoster(league: SleeperLeague, roster: SleeperRoster, name: string, manager: string, avatar: string | null, catalog: Map<string, NflPlayer>, games: Map<string, PlayerGame>, pointsById: Record<string, number> | null): TeamRoster {
  const starters = roster.starters ?? [];
  const taxi = roster.taxi ?? [];
  const reserve = roster.reserve ?? [];
  const rostered = new Set([...starters, ...taxi, ...reserve]);
  const bench = (roster.players ?? []).filter((id) => !rostered.has(id));
  const settings = roster.settings;
  const groups: RosterGroup[] = [{ label: "Starters", slots: buildStarterSlots(league, starters, catalog, games) }, reserveGroup("Bench", bench, catalog, games, pointsById)];
  if (taxi.length) groups.push(reserveGroup("Taxi squad", taxi, catalog, games, pointsById));
  if (reserve.length) groups.push(reserveGroup("Injured reserve", reserve, catalog, games, pointsById));

  return {
    rosterId: roster.roster_id, name, manager, avatar,
    record: `${settings.wins ?? 0}–${settings.losses ?? 0}${settings.ties ? `–${settings.ties}` : ""}`,
    pointsFor: fantasyPoints(settings.fpts, settings.fpts_decimal),
    groups, counts: countByPosition(roster.players ?? [], catalog),
  };
}

export type RosterBoard = { leagueName: string; season: string; week: number; teams: TeamRoster[]; catalogReady: boolean };

export async function getRosterBoard(leagueId: string, source: LeagueSource = liveSource): Promise<RosterBoard> {
  const [base, catalog] = await Promise.all([
    getLeagueBase(leagueId, source),
    source.getPlayerCatalog().catch(() => new Map<string, NflPlayer>()),
  ]);
  const { league, state, week, regularSeason, rosters } = base;
  const [games, matchups] = await Promise.all([
    regularSeason ? source.getWeekGamesByTeam(state.season, week).catch(() => new Map<string, PlayerGame>()) : Promise.resolve(new Map<string, PlayerGame>()),
    regularSeason ? source.getMatchups(leagueId, week).catch(() => []) : Promise.resolve([]),
  ]);
  const pointsByRoster = new Map(matchups.map((row) => [row.roster_id, row.players_points ?? null]));

  const teams = rosters
    .map((roster) => {
      const team = base.teamByRoster.get(roster.roster_id) ?? teamIdentity(roster);
      return teamRoster(league, roster, team.name, team.manager, team.avatar, catalog, games, pointsByRoster.get(roster.roster_id) ?? null);
    })
    .toSorted((a, b) => a.name.localeCompare(b.name));

  return { leagueName: league.name, season: league.season, week, teams, catalogReady: catalog.size > 0 };
}
