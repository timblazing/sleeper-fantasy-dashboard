import type { Metadata } from "next";
import { HistoryIcon } from "lucide-react";
import { HistoryChampions } from "@/components/history-champions";
import { HistoryHeadToHead } from "@/components/history-head-to-head";
import { HistoryLeaderboard } from "@/components/history-leaderboard";
import { HistoryRecords, HistoryScoreTable } from "@/components/history-records";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getLeagueHistory } from "@/lib/league-history";

export const metadata: Metadata = { title: "League History" };

function HistoryUnavailable({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto w-full max-w-screen-2xl p-4 md:p-6 lg:p-8">
      <Empty className="min-h-64 border">
        <EmptyHeader>
          <EmptyMedia variant="icon"><HistoryIcon /></EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}

export default async function LeagueHistoryPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const history = await getLeagueHistory(leagueId).catch(() => null);

  if (!history) {
    return <HistoryUnavailable title="League history unavailable" description="Sleeper did not return past seasons for this league." />;
  }
  // A brand-new league has a chain of one and no completed games — every section below would be empty.
  if (!history.managers.some((row) => row.games > 0)) {
    return <HistoryUnavailable title="No seasons on record yet" description="This league has not played a scored week. History appears once games are in the books." />;
  }

  const { seasons, managers, records } = history;

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">League history</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {seasons.length > 1
            ? `${history.name} across ${seasons.length} seasons — ${seasons.at(-1)?.season} to ${seasons[0].season}.`
            : `${history.name} — ${seasons[0]?.season}. Past seasons appear here once the league has been renewed.`}
        </p>
      </header>

      {/* The titles come first — a league's history is remembered as its list of champions. */}
      <HistoryChampions managers={managers} seasons={seasons} />

      <HistoryLeaderboard rows={managers} seasonCount={seasons.length} />

      <HistoryHeadToHead headToHead={history.headToHead} managers={managers} />

      <HistoryRecords records={records} />

      <div className="grid gap-6 lg:grid-cols-2">
        <HistoryScoreTable
          description="The ten biggest single-week scores in league history"
          rows={history.topScores}
          title="All-time weekly high scores"
          tone="high"
        />
        <HistoryScoreTable
          description="The ten weeks everyone would rather forget"
          rows={history.lowScores}
          title="All-time weekly low scores"
          tone="low"
        />
      </div>
    </div>
  );
}
