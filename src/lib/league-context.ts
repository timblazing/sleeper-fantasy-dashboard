import { deriveLeagueFormat, type LeagueFormat } from "@/lib/league-features";
import { liveSource, type LeagueSource } from "@/lib/league-source";
import type { MatchupPair, NflState, SleeperLeague, SleeperMatchup, SleeperRoster, SleeperUser, StandingRow } from "@/lib/types";
import { points } from "@/lib/utils";

/** Identity only — league + state + format. What the sidebar shell needs. */
export type LeagueIdentity = {
  id: string;
  league: SleeperLeague;
  state: NflState;
  format: LeagueFormat;
  week: number;
  regularSeason: boolean;
  /** The week whose matchups should be shown — the preseason has none, so it falls back to 1. */
  matchupWeek: number;
};

/** Who owns which roster, resolved once. Every page-data module writes team names from this. */
export type TeamIdentity = {
  rosterId: number;
  ownerId: string | null;
  name: string;
  manager: string;
  avatar: string | null;
  division: number;
};

/** Identity plus who owns which roster. What every page-data module needs. */
export type LeagueBase = LeagueIdentity & {
  users: SleeperUser[];
  rosters: SleeperRoster[];
  userById: Map<string, SleeperUser>;
  teamByRoster: Map<number, TeamIdentity>;
};

/** The one place the team-name fallback chain is written. */
export function teamIdentity(roster: SleeperRoster, user?: SleeperUser): TeamIdentity {
  return {
    rosterId: roster.roster_id,
    ownerId: roster.owner_id,
    name: user?.metadata?.team_name || user?.display_name || `Roster ${roster.roster_id}`,
    manager: user?.display_name ?? "Unassigned",
    avatar: user?.avatar ?? null,
    division: roster.settings.division ?? 0,
  };
}

function identityFrom(id: string, league: SleeperLeague, state: NflState): LeagueIdentity {
  const week = Math.max(1, state.week ?? state.display_week ?? 1);
  const regularSeason = state.season_type === "regular" || state.season_type === "post";
  // Deliberately not `regularSeason ? ... : 1`: only the preseason and offseason have no week to
  // show, so an unrecognized or missing `season_type` must still fall through to the live week.
  const preseason = state.season_type === "pre" || state.season_type === "off";
  return { id, league, state, format: deriveLeagueFormat(league), week, regularSeason, matchupWeek: preseason ? 1 : week };
}

/** The cheap read: league + state only. The `[leagueId]` layout renders on every page, so it must not grow. */
export async function getLeagueIdentity(leagueId: string, source: LeagueSource = liveSource): Promise<LeagueIdentity> {
  const [league, state] = await Promise.all([source.getLeague(leagueId), source.getNflState()]);
  return identityFrom(leagueId, league, state);
}

/** The read every page-data module opens with: identity plus users and rosters, resolved to teams. */
export async function getLeagueBase(leagueId: string, source: LeagueSource = liveSource): Promise<LeagueBase> {
  const [league, state, users, rosters] = await Promise.all([source.getLeague(leagueId), source.getNflState(), source.getLeagueUsers(leagueId), source.getLeagueRosters(leagueId)]);
  const userById = new Map(users.map((user) => [user.user_id, user]));
  const teamByRoster = new Map(rosters.map((roster) => [roster.roster_id, teamIdentity(roster, roster.owner_id ? userById.get(roster.owner_id) : undefined)]));
  return { ...identityFrom(leagueId, league, state), users, rosters, userById, teamByRoster };
}

/** Standings ranked by wins then points-for. `rank` is 1-based and dense. */
export function buildStandings(base: LeagueBase, playerValues: Record<string, number> = {}): StandingRow[] {
  return base.rosters
    .toSorted((a, b) => (b.settings.wins ?? 0) - (a.settings.wins ?? 0) || points(b.settings.fpts, b.settings.fpts_decimal) - points(a.settings.fpts, a.settings.fpts_decimal))
    .map((roster, index) => {
      const team = base.teamByRoster.get(roster.roster_id) ?? teamIdentity(roster);
      const rosterValue = (roster.players ?? []).reduce((sum, id) => sum + (playerValues[id] ?? 0), 0);
      const settings = roster.settings;
      return {
        rank: index + 1, rosterId: team.rosterId, division: team.division, name: team.name, manager: team.manager, avatar: team.avatar,
        wins: settings.wins ?? 0, losses: settings.losses ?? 0, ties: settings.ties ?? 0,
        pointsFor: points(settings.fpts, settings.fpts_decimal), pointsAgainst: points(settings.fpts_against, settings.fpts_against_decimal),
        value: rosterValue || null,
      };
    });
}

/** Pairs matchup rows by `matchup_id`. A group with fewer than two rows has no opponent and is dropped. */
export function groupMatchups(rows: SleeperMatchup[], standingByRoster: Map<number, StandingRow>): MatchupPair[] {
  const groups = new Map<number, SleeperMatchup[]>();
  for (const row of rows) { if (row.matchup_id == null) continue; const group = groups.get(row.matchup_id) ?? []; group.push(row); groups.set(row.matchup_id, group); }
  return [...groups.entries()].flatMap(([id, pair]) => {
    if (pair.length < 2) return [];
    const home = standingByRoster.get(pair[0].roster_id); const away = standingByRoster.get(pair[1].roster_id);
    return home && away ? [{ id, home, away, homeScore: pair[0].points ?? 0, awayScore: pair[1].points ?? 0 }] : [];
  });
}
