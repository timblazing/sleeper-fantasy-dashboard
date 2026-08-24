import "server-only";
import { fetchCached } from "@/lib/fetch-cached";
import { describeLeagueType, isDynastyLeague } from "@/lib/league-features";
import type { NflState, SleeperAccount, SleeperBracketGame, SleeperDraft, SleeperDraftPick, SleeperLeague, SleeperMatchup, SleeperRoster, SleeperTradedPick, SleeperTransaction, SleeperUser } from "@/lib/types";
const API = "https://api.sleeper.app/v1";
function sleeper<T>(path: string, ttl: number) { return fetchCached<T>(`${API}${path}`, { ttl }); }
export const getNflState = () => sleeper<NflState>("/state/nfl", 300);
export const getUser = (username: string) => sleeper<SleeperUser>(`/user/${encodeURIComponent(username)}`, 3600);
export const getUserLeagues = (userId: string, season: string) => sleeper<SleeperLeague[]>(`/user/${userId}/leagues/nfl/${season}`, 300);
// These functions assume `id` has already been validated (see `isLeagueId`) — encoding the
// upstream URL path below is defense in depth only.
export const getLeague = (id: string) => sleeper<SleeperLeague>(`/league/${encodeURIComponent(id)}`, 3600);
export const getLeagueUsers = (id: string) => sleeper<SleeperUser[]>(`/league/${encodeURIComponent(id)}/users`, 3600);
export const getLeagueRosters = (id: string) => sleeper<SleeperRoster[]>(`/league/${encodeURIComponent(id)}/rosters`, 300);
export const getMatchups = (id: string, week: number) => sleeper<SleeperMatchup[]>(`/league/${encodeURIComponent(id)}/matchups/${week}`, 300);
export const getTransactions = (id: string, week: number) => sleeper<SleeperTransaction[]>(`/league/${encodeURIComponent(id)}/transactions/${week}`, 300);
// Completed seasons never change, so the brackets that decide final placements cache for a day.
export const getWinnersBracket = (id: string) => sleeper<SleeperBracketGame[]>(`/league/${encodeURIComponent(id)}/winners_bracket`, 86400);
export const getLosersBracket = (id: string) => sleeper<SleeperBracketGame[]>(`/league/${encodeURIComponent(id)}/losers_bracket`, 86400);
export const getLeagueDrafts = (id: string) => sleeper<SleeperDraft[]>(`/league/${encodeURIComponent(id)}/drafts`, 3600);
export const getDraftPicks = (id: string) => sleeper<SleeperDraftPick[]>(`/draft/${encodeURIComponent(id)}/picks`, 3600);
// Which slots changed hands before the draft ran. A completed draft never trades another pick, so this caches for a day.
export const getDraftTradedPicks = (id: string) => sleeper<SleeperTradedPick[]>(`/draft/${encodeURIComponent(id)}/traded_picks`, 86400);

/**
 * Every league id in a dynasty's lineage, newest season first.
 *
 * Sleeper models a continuing dynasty as one league object per season chained by
 * `previous_league_id`, so behavioural history (trades, waivers, drafts) is only reachable by
 * walking the chain. `limit` bounds the walk so a long-running league cannot unbound the read.
 */
export async function getLeagueLineage(id: string, limit = 4): Promise<string[]> {
  const lineage: string[] = [];
  let current: string | null = id;
  while (current && lineage.length < limit) {
    lineage.push(current);
    const league: SleeperLeague | null = await getLeague(current).catch(() => null);
    const previous: string | null = league?.previous_league_id ?? null;
    // A league that points at itself would spin forever; a repeat means the chain is done.
    current = previous && !lineage.includes(previous) ? previous : null;
  }
  return lineage;
}

export async function getNflLeaguesForUsername(username: string, season?: string): Promise<SleeperAccount> {
  const cleanUsername = username.trim();
  const [user, state] = await Promise.all([getUser(cleanUsername), season ? Promise.resolve(null) : getNflState()]);
  if (!user?.user_id) throw new Error("Sleeper user not found");

  const targetSeason = season ?? state?.season;
  if (!targetSeason) throw new Error("The current NFL season is unavailable");
  const leagueSummaries = await getUserLeagues(user.user_id, targetSeason);
  const verifiedLeagues = await Promise.all(leagueSummaries.map((league) => getLeague(league.league_id).catch(() => null)));
  const statusOrder: Record<string, number> = { in_season: 0, drafting: 1, pre_draft: 2, complete: 3 };
  const leagues = verifiedLeagues
    .filter((league): league is SleeperLeague => league?.sport.toLowerCase() === "nfl")
    .toSorted((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) || a.name.localeCompare(b.name))
    .map((league) => ({ id: league.league_id, name: league.name, season: league.season, status: league.status, type: describeLeagueType(league), isDynasty: isDynastyLeague(league), avatar: league.avatar }));

  return { userId: user.user_id, username: user.username || cleanUsername, displayName: user.display_name || user.username || cleanUsername, avatar: user.avatar, leagues };
}
