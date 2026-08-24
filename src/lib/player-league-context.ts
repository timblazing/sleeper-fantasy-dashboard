import "server-only";
import { getLeagueRosters, getLeagueUsers, getNflLeaguesForUsername } from "@/lib/sleeper";

/**
 * The half of the player profile RosterAudit cannot supply.
 *
 * /player-page knows everything about the player and nothing about *your* league, so this
 * adds the one fact the reader actually opened the page to check: who holds him here, and
 * is that me. It is deliberately a separate read from getPlayerProfile — a Sleeper outage
 * costs the ownership strip, not the whole profile, and the page renders either way.
 */
export type PlayerLeagueContext = {
  /** null = nobody in this league rosters the player (free agent / waivers). */
  owner: { rosterId: number; teamName: string; manager: string; isMine: boolean } | null;
  /** The owning roster's other players at this position, most valuable first is the caller's job. */
  positionMates: string[];
  starterSlots: string[];
};

const EMPTY: PlayerLeagueContext = { owner: null, positionMates: [], starterSlots: [] };

export async function getPlayerLeagueContext(leagueId: string, sleeperId: string, username?: string): Promise<PlayerLeagueContext> {
  if (leagueId === "demo") return EMPTY;
  try {
    const [rosters, users, account] = await Promise.all([
      getLeagueRosters(leagueId),
      getLeagueUsers(leagueId),
      username ? getNflLeaguesForUsername(username).catch(() => undefined) : undefined,
    ]);
    const roster = rosters.find((entry) => (entry.players ?? []).includes(sleeperId));
    if (!roster) return EMPTY;

    const user = users.find((entry) => entry.user_id === roster.owner_id);
    // Team-name expression taken verbatim from src/lib/rankings-data.ts so a manager reads
    // the same on every surface.
    const teamName = user?.metadata?.team_name || user?.display_name || `Roster ${roster.roster_id}`;
    return {
      owner: {
        rosterId: roster.roster_id,
        teamName,
        manager: user?.display_name ?? "Unknown manager",
        isMine: Boolean(account && roster.owner_id && roster.owner_id === account.userId),
      },
      positionMates: (roster.players ?? []).filter((id) => id !== sleeperId),
      starterSlots: (roster.starters ?? []).includes(sleeperId) ? ["starter"] : [],
    };
  } catch {
    // Same contract as loadOwnership in rankings-data: ownership is an enrichment, never a
    // reason to fail the page.
    return EMPTY;
  }
}
