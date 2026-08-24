import type { Metadata } from "next";
import { ChampionshipOdds } from "@/components/championship-odds";
import { PageHeader } from "@/components/page-header";
import { BracketBoard } from "@/components/playoff-bracket";
import { PlayoffRace, SeedMatrix } from "@/components/playoff-race";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getDashboardData } from "@/lib/dashboard-data";
import { getPlayoffPicture } from "@/lib/playoff-odds";
import { getOverviewData } from "@/lib/team-insights";

export const metadata: Metadata = { title: "Playoffs" };

export default async function PlayoffsPage({ params, searchParams }: { params: Promise<{ leagueId: string }>; searchParams: Promise<{ username?: string | string[] }> }) {
  const [{ leagueId }, query] = await Promise.all([params, searchParams]);
  const username = typeof query.username === "string" ? query.username : undefined;
  const [data, overview, picture] = await Promise.all([
    getDashboardData(leagueId, username),
    getOverviewData(leagueId, username),
    getPlayoffPicture(leagueId, username),
  ]);
  const myRosterId = data.myRosterId;

  if (data.standings.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Card><CardContent><Empty className="min-h-64"><EmptyHeader><EmptyTitle>Playoff standings unavailable</EmptyTitle><EmptyDescription>Sleeper did not return roster data for this league.</EmptyDescription></EmptyHeader></Empty></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        description={
          picture.started
            ? `Week ${picture.currentWeek} of ${picture.finalWeek} · top ${picture.playoffTeams} of ${picture.teams} teams make the bracket.`
            : `Preseason projection · top ${picture.playoffTeams} of ${picture.teams} teams make the bracket.`
        }
        title="Playoff picture"
      />

      <PlayoffRace picture={picture} />

      <SeedMatrix picture={picture} />

      <ChampionshipOdds seasons={overview.championshipOdds} />

      <BracketBoard losers={picture.losersBracket} myRosterId={myRosterId} winners={picture.winnersBracket} />
    </div>
  );
}
