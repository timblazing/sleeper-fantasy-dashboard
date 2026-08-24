import { getLeagueValueContext } from "@/lib/league-values";
import { liveSource, type LeagueSource } from "@/lib/league-source";
import { getLeagueManagers, type Attribution, type RaManagerCareer } from "@/lib/roster-audit";
import { getNflLeaguesForUsername } from "@/lib/sleeper";

export type PedigreeRow = {
  userId: string;
  name: string;
  avatar: string | null;
  seasons: number;
  playoffAppearances: number;
  playoffWins: number;
  playoffLosses: number;
  championships: number;
  runnerUps: number;
  isUser: boolean;
};

export type PlayoffPedigree = {
  rows: PedigreeRow[];
  /** Longest career in the table — the league's own age, in seasons. */
  seasons: number;
  attribution: Attribution;
};

/**
 * Rank by what the postseason actually rewards: rings first, then deep runs, then trips.
 *
 * Career wins are deliberately not the tiebreak — a regular-season juggernaut that never wins a
 * bracket game should not outrank the manager holding the trophy.
 */
function byPedigree(a: PedigreeRow, b: PedigreeRow): number {
  return b.championships - a.championships
    || b.runnerUps - a.runnerUps
    || b.playoffWins - a.playoffWins
    || b.playoffAppearances - a.playoffAppearances
    || a.name.localeCompare(b.name);
}

const toRow = (career: RaManagerCareer, myUserId?: string): PedigreeRow => ({
  userId: career.userId,
  name: career.displayName,
  avatar: career.avatar,
  seasons: career.seasonsPlayed,
  playoffAppearances: career.playoffAppearances,
  playoffWins: career.playoffWins,
  playoffLosses: career.playoffLosses,
  championships: career.championships,
  runnerUps: career.runnerUps,
  isUser: Boolean(myUserId) && career.userId === myUserId,
});

/**
 * Career postseason records for the managers currently in the league.
 *
 * RosterAudit keys league history to the whole league *group*, so its manager list covers every
 * season under previous league ids — and includes managers who have since left. Those are filtered
 * out against the current rosters, since this sits under a card about the current race.
 *
 * Returns null rather than throwing when the league has never been synced with RosterAudit; the
 * page simply omits the card in that case.
 */
export async function getPlayoffPedigree(leagueId: string, username?: string, source: LeagueSource = liveSource): Promise<PlayoffPedigree | null> {
  const [context, account, managers] = await Promise.all([
    getLeagueValueContext(leagueId, source),
    username ? getNflLeaguesForUsername(username).catch(() => undefined) : undefined,
    getLeagueManagers(leagueId),
  ]);

  if (!managers.ok || !managers.data.length) return null;

  const currentOwners = new Set(context.teams.map((team) => team.ownerId).filter((id): id is string => id !== null));
  const rows = managers.data
    .filter((career) => currentOwners.has(career.userId))
    .map((career) => toRow(career, account?.userId))
    .toSorted(byPedigree);

  if (!rows.length) return null;

  return {
    rows,
    seasons: Math.max(...rows.map((row) => row.seasons), 0),
    attribution: managers.attribution,
  };
}
