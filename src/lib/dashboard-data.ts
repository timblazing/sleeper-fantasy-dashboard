import { buildStandings, getLeagueBase, groupMatchups } from "@/lib/league-context";
import { liveSource, type LeagueSource } from "@/lib/league-source";
import { getTransactionFeed, toActivityItem } from "@/lib/transaction-feed";
import type { ActivityItem, DashboardData } from "@/lib/types";

export async function getDashboardData(leagueId: string, username?: string, requestedMatchupWeek?: number, source: LeagueSource = liveSource): Promise<DashboardData> {
    const base = await getLeagueBase(leagueId, source);
    const { league, state, week, format, rosters } = base;
    const matchupWeek = requestedMatchupWeek ?? base.matchupWeek;
    const [matchupRows, feed, valuesResult, account] = await Promise.all([
      source.getMatchups(leagueId, matchupWeek),
      getTransactionFeed(leagueId, 8, source).catch(() => []),
      source.getValues(format.formatKey),
      username ? source.getNflLeaguesForUsername(username, state.season).catch(() => undefined) : undefined,
    ]);
    const playerValues: Record<string, number> = valuesResult.ok
      ? Object.fromEntries(Object.entries(valuesResult.data).map(([id, value]) => [id, format.superflex ? value.sf : value["1qb"]]))
      : {};
    const standings = buildStandings(base, playerValues);
    const standingByRoster = new Map(standings.map((row) => [row.rosterId, row]));
    const matchups = groupMatchups(matchupRows, standingByRoster);
    const selectedRosterId = account ? rosters.find((roster) => roster.owner_id === account.userId)?.roster_id : undefined;
    const selectedMatchup = selectedRosterId ? matchups.find((matchup) => matchup.home.rosterId === selectedRosterId || matchup.away.rosterId === selectedRosterId) : undefined;
    const featuredMatchup = selectedMatchup && selectedRosterId === selectedMatchup.away.rosterId
      ? { ...selectedMatchup, home: selectedMatchup.away, away: selectedMatchup.home, homeScore: selectedMatchup.awayScore, awayScore: selectedMatchup.homeScore }
      : selectedMatchup ?? matchups[0];
    const configuredDivisionCount = league.settings.divisions ?? 0;
    const discoveredDivisionIds = [...new Set(rosters.map((roster) => roster.settings.division).filter((division): division is number => typeof division === "number"))].toSorted((a, b) => a - b);
    const divisionIds = configuredDivisionCount ? Array.from({ length: configuredDivisionCount }, (_, index) => index + 1) : discoveredDivisionIds;
    const divisions = (divisionIds.length ? divisionIds : [0]).map((id) => ({ id, name: id ? league.metadata?.[`division_${id}`] || `Division ${id}` : "League" }));
    const activity: ActivityItem[] = feed.map(toActivityItem);
    return { league: { id: leagueId, name: league.name, season: league.season, teams: league.settings.num_teams ?? standings.length, type: format.typeLabel, isDynasty: format.isDynasty, superflex: format.superflex, divisions }, state: { week, matchupWeek, seasonType: state.season_type }, standings, matchups, featuredMatchup, activity, account, myRosterId: selectedRosterId };
}
