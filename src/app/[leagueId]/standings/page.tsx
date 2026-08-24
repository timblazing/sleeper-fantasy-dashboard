import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { DivisionStandings, StandingsTable } from "@/components/standings";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getDashboardData } from "@/lib/dashboard-data";

export const metadata: Metadata = { title: "Standings" };

export default async function StandingsPage({ params, searchParams }: { params: Promise<{ leagueId: string }>; searchParams: Promise<{ username?: string | string[] }> }) {
  const [{ leagueId }, query] = await Promise.all([params, searchParams]);
  const username = typeof query.username === "string" ? query.username : undefined;
  const data = await getDashboardData(leagueId, username);
  const myRosterId = data.myRosterId;
  const divided = data.league.divisions.length > 1;

  if (data.standings.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Card><CardContent><Empty className="min-h-64"><EmptyHeader><EmptyTitle>Standings unavailable</EmptyTitle><EmptyDescription>Sleeper did not return roster data for this league.</EmptyDescription></EmptyHeader></Empty></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <PageHeader description={`All ${data.standings.length} teams by record, then points scored.`} title="Standings" />

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <StandingsTable leagueId={leagueId} myRosterId={myRosterId} rows={data.standings} username={username} />
        </CardContent>
      </Card>

      {divided ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {data.league.divisions.map((division) => (
            <DivisionStandings division={division} key={division.id} leagueId={leagueId} myRosterId={myRosterId} rows={data.standings} username={username} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
