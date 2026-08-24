import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PowerRankingsTable } from "@/components/power-rankings-table";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getPowerRankings } from "@/lib/power-rankings";

export const metadata: Metadata = { title: "Power Rankings" };

export default async function PowerRankingsPage({ params, searchParams }: { params: Promise<{ leagueId: string }>; searchParams: Promise<{ username?: string | string[] }> }) {
  const [{ leagueId }, query] = await Promise.all([params, searchParams]);
  const username = typeof query.username === "string" ? query.username : undefined;
  const rankings = await getPowerRankings(leagueId, username);

  if (rankings.rows.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Card><CardContent><Empty className="min-h-64"><EmptyHeader><EmptyTitle>Power rankings unavailable</EmptyTitle><EmptyDescription>Sleeper did not return roster data for this league.</EmptyDescription></EmptyHeader></Empty></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        description={
          rankings.started
            ? `All ${rankings.teams} teams ranked by how they are actually playing, through ${rankings.weeksPlayed} ${rankings.weeksPlayed === 1 ? "week" : "weeks"}.`
            : `Preseason projection · all ${rankings.teams} teams ranked on roster strength until games are played.`
        }
        title="Power Rankings"
      />

      <Card>
        <CardContent className="px-0">
          <PowerRankingsTable leagueId={leagueId} rankings={rankings} username={username} />
        </CardContent>
      </Card>
    </div>
  );
}
