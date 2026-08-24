import { getLeagueBase, teamIdentity, type LeagueBase } from "@/lib/league-context";
import { liveSource, type LeagueSource } from "@/lib/league-source";
import { resolvePlayer } from "@/lib/players";
import type { NflPlayer, NflState, SleeperLeague, SleeperRoster } from "@/lib/types";
import { points } from "@/lib/utils";

/** Positions that get their own "room" on the overview; anything else is folded into `other`. */
export const ROOM_POSITIONS = ["QB", "RB", "WR", "TE"] as const;
export type RoomPosition = (typeof ROOM_POSITIONS)[number];

export type ValuedPlayer = {
  player: NflPlayer;
  value: number;
  /** Rank across every valued player in the league's format, 1 = most valuable. */
  rankOverall: number | null;
  /** Rank within the player's own position. */
  rankPosition: number | null;
  /** Roster that holds the player, or null when they are a free agent. */
  ownerRosterId: number | null;
  ownerName: string | null;
};

export type PositionRoom = {
  position: string;
  value: number;
  players: number;
  avgAge: number | null;
  /** 1 = the most valuable room at this position in the league. */
  rank: number;
  leagueAvg: number;
};

export type LeagueTeam = {
  rosterId: number;
  ownerId: string | null;
  name: string;
  manager: string;
  avatar: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  value: number;
  /** 1 = most valuable roster in the league. */
  valueRank: number;
  /** 1 = most points scored. */
  powerRank: number;
  rooms: PositionRoom[];
  roster: ValuedPlayer[];
  starters: string[];
  taxi: string[];
  reserve: string[];
  players: string[];
};

export type LeagueValueContext = {
  /** The shared league read this context is built on. */
  base: LeagueBase;
  league: SleeperLeague;
  state: NflState;
  week: number;
  /** The week whose matchups should be shown — the preseason has none, so it falls back to 1. */
  matchupWeek: number;
  regularSeason: boolean;
  superflex: boolean;
  formatKey: string;
  catalog: Map<string, NflPlayer>;
  catalogReady: boolean;
  /** Player value in this league's format. Empty when RosterAudit is unreachable. */
  values: Map<string, number>;
  valuesReady: boolean;
  rankOverall: Map<string, number>;
  rankPosition: Map<string, number>;
  teams: LeagueTeam[];
  rosterByPlayer: Map<string, number>;
  rosters: SleeperRoster[];
};

const avg = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

/** Dense ranks over a value map, so ties do not silently reorder by insertion order. */
function rankByValue(entries: [string, number][]): Map<string, number> {
  const ranks = new Map<string, number>();
  entries.toSorted((a, b) => b[1] - a[1]).forEach(([id], index) => ranks.set(id, index + 1));
  return ranks;
}

function buildRooms(roster: ValuedPlayer[], leagueRooms: Map<string, number[]>): PositionRoom[] {
  return ROOM_POSITIONS.map((position) => {
    const held = roster.filter((entry) => entry.player.position === position);
    const value = held.reduce((sum, entry) => sum + entry.value, 0);
    const all = leagueRooms.get(position) ?? [];
    return {
      position,
      value,
      players: held.length,
      avgAge: avg(held.map((entry) => entry.player.age).filter((age): age is number => age !== null)),
      rank: 1 + all.filter((other) => other > value).length,
      leagueAvg: avg(all) ?? 0,
    };
  });
}

/**
 * One read of everything the value-aware pages need: the league, who owns whom, and each
 * player's worth in this league's scoring format. Degrades to names-only when RosterAudit
 * or the Sleeper player map is unavailable rather than failing the page.
 */
export async function getLeagueValueContext(leagueId: string, source: LeagueSource = liveSource): Promise<LeagueValueContext> {
  const [base, catalog] = await Promise.all([
    getLeagueBase(leagueId, source),
    source.getPlayerCatalog().catch(() => new Map<string, NflPlayer>()),
  ]);

  const { league, state, week, regularSeason, matchupWeek, rosters } = base;
  const { superflex, formatKey } = base.format;

  const valuesResult = await source.getValues(formatKey);
  const values = new Map<string, number>(
    valuesResult.ok ? Object.entries(valuesResult.data).map(([id, entry]) => [id, superflex ? entry.sf : entry["1qb"]]) : []
  );

  const valueEntries = [...values.entries()];
  const rankOverall = rankByValue(valueEntries);
  const rankPosition = new Map<string, number>();
  for (const position of ROOM_POSITIONS) {
    const atPosition = valueEntries.filter(([id]) => resolvePlayer(catalog, id).position === position);
    for (const [id, rank] of rankByValue(atPosition)) rankPosition.set(id, rank);
  }

  const rosterByPlayer = new Map<string, number>();
  for (const roster of rosters) for (const id of roster.players ?? []) rosterByPlayer.set(id, roster.roster_id);

  const valuedTeams = rosters.map((roster) => {
    const team = base.teamByRoster.get(roster.roster_id) ?? teamIdentity(roster);
    const name = team.name;
    const held: ValuedPlayer[] = (roster.players ?? [])
      .map((id) => ({
        player: resolvePlayer(catalog, id),
        value: values.get(id) ?? 0,
        rankOverall: rankOverall.get(id) ?? null,
        rankPosition: rankPosition.get(id) ?? null,
        ownerRosterId: roster.roster_id,
        ownerName: name,
      }))
      .toSorted((a, b) => b.value - a.value);
    const settings = roster.settings;
    return {
      rosterId: team.rosterId,
      ownerId: team.ownerId,
      name,
      manager: team.manager,
      avatar: team.avatar,
      wins: settings.wins ?? 0,
      losses: settings.losses ?? 0,
      ties: settings.ties ?? 0,
      pointsFor: points(settings.fpts, settings.fpts_decimal),
      pointsAgainst: points(settings.fpts_against, settings.fpts_against_decimal),
      value: held.reduce((sum, entry) => sum + entry.value, 0),
      roster: held,
      starters: roster.starters ?? [],
      taxi: roster.taxi ?? [],
      reserve: roster.reserve ?? [],
      players: roster.players ?? [],
    };
  });

  // Room ranks need every team's totals, so the per-position league columns are collected first.
  const leagueRooms = new Map<string, number[]>(
    ROOM_POSITIONS.map((position) => [
      position,
      valuedTeams.map((team) => team.roster.filter((entry) => entry.player.position === position).reduce((sum, entry) => sum + entry.value, 0)),
    ])
  );
  const valueRanks = rankByValue(valuedTeams.map((team) => [String(team.rosterId), team.value]));
  const powerRanks = rankByValue(valuedTeams.map((team) => [String(team.rosterId), team.pointsFor]));

  const teams: LeagueTeam[] = valuedTeams
    .map((team) => ({
      ...team,
      valueRank: valueRanks.get(String(team.rosterId)) ?? valuedTeams.length,
      powerRank: powerRanks.get(String(team.rosterId)) ?? valuedTeams.length,
      rooms: buildRooms(team.roster, leagueRooms),
    }))
    .toSorted((a, b) => a.valueRank - b.valueRank);

  return {
    base,
    league,
    state,
    week,
    matchupWeek,
    regularSeason,
    superflex,
    formatKey,
    catalog,
    catalogReady: catalog.size > 0,
    values,
    valuesReady: values.size > 0,
    rankOverall,
    rankPosition,
    teams,
    rosterByPlayer,
    rosters,
  };
}

/** Resolves the connected Sleeper account to a roster in this league, if they are in it. */
export function findTeamForUser(context: LeagueValueContext, userId?: string): LeagueTeam | null {
  if (!userId) return null;
  return context.teams.find((team) => team.ownerId === userId) ?? null;
}

export function letterGrade(rank: number, teams: number): string {
  if (teams <= 1) return "B";
  const percentile = (teams - rank) / (teams - 1);
  const scale: [number, string][] = [[0.95, "A+"], [0.85, "A"], [0.75, "A-"], [0.65, "B+"], [0.55, "B"], [0.45, "B-"], [0.35, "C+"], [0.25, "C"], [0.15, "C-"], [0.05, "D"]];
  return scale.find(([floor]) => percentile >= floor)?.[1] ?? "F";
}

