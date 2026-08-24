import { getLeagueIdentity } from "@/lib/league-context";
import { liveSource, type LeagueSource } from "@/lib/league-source";

// The sidebar shell lives in the [leagueId] layout, which never sees `searchParams`.
// It only needs the league identity, so this is the thin server read that backs it —
// deliberately `getLeagueIdentity` and not `getLeagueBase`: it renders on every page.
//
// `avatar` is Sleeper's avatar id, not a URL — `leagueAvatarUrl` in `lib/utils` turns it into one.
export type LeagueChrome = { id: string; name: string; season: string; type: string; isDynasty: boolean; isSuperflex: boolean; matchupWeek: number; avatar: string | null };

export async function getLeagueChrome(leagueId: string, source: LeagueSource = liveSource): Promise<LeagueChrome> {
  try {
    const { league, format, matchupWeek } = await getLeagueIdentity(leagueId, source);
    return { id: leagueId, name: league.name, season: league.season, type: format.typeLabel, isDynasty: format.isDynasty, isSuperflex: format.superflex, matchupWeek, avatar: league.avatar };
  } catch {
    // The [leagueId] layout awaits this with no error boundary above it, so a bad league id or a
    // Sleeper outage must degrade to a named shell rather than 500 every page in the section.
    return { id: leagueId, name: "League unavailable", season: "", type: "Redraft", isDynasty: false, isSuperflex: false, matchupWeek: 1, avatar: null };
  }
}
