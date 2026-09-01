import type { Metadata } from "next";
import { HistoryIcon } from "lucide-react";
import { HistoryChampions } from "@/components/history-champions";
import { HistoryLeaderboard } from "@/components/history-leaderboard";
import { PositionalScarcityCard } from "@/components/insights";
import { PlayoffRace } from "@/components/playoff-race";
import { HistoryRecords } from "@/components/history-records";
import { SeasonTimelineCard } from "@/components/season-timeline";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getLeagueHistory } from "@/lib/league-history";
import { getPlayoffPicture } from "@/lib/playoff-odds";
import { getOverviewData } from "@/lib/team-insights";

export const metadata: Metadata = { title: "League" };

function HistoryUnavailable() {
  return (
    <div className="rounded-xl border border-dashed p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><HistoryIcon /></EmptyMedia>
          <EmptyTitle>League history unavailable</EmptyTitle>
          <EmptyDescription>Past-season standings, records, and champions will appear once Sleeper returns scored history.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}

export default async function LeaguePage({ params, searchParams }: { params: Promise<{ leagueId: string }>; searchParams: Promise<{ username?: string | string[] }> }) {
  const [{ leagueId }, query] = await Promise.all([params, searchParams]);
  const username = typeof query.username === "string" ? query.username : undefined;
  const [overview, picture, history] = await Promise.all([
    getOverviewData(leagueId, username),
    getPlayoffPicture(leagueId, username),
    getLeagueHistory(leagueId).catch(() => null),
  ]);
  const hasHistory = Boolean(history?.managers.some((row) => row.games > 0));

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader description={`${overview.league.name} at a glance — activity, scarcity, the playoff race, and the league record book.`} title="League" />

      <PlayoffRace leagueId={leagueId} picture={picture} username={username} />
      <SeasonTimelineCard timeline={overview.timeline} />
      <PositionalScarcityCard data={overview} />

      {hasHistory && history ? (
        <>
          <HistoryChampions leagueId={leagueId} managers={history.managers} seasons={history.seasons} username={username} />
          <HistoryLeaderboard leagueId={leagueId} rows={history.managers} seasonCount={history.seasons.length} username={username} />
          <HistoryRecords leagueId={leagueId} managers={history.managers} records={history.records} username={username} />
        </>
      ) : <HistoryUnavailable />}
    </PageContainer>
  );
}
