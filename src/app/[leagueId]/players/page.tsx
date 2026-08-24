import type { Metadata } from "next";
import { CloudOff, Hourglass, TriangleAlert } from "lucide-react";
import { DynastyRequired } from "@/components/dynasty-required";
import { PageHeader } from "@/components/page-header";
import { RankingsToolbar } from "@/components/rankings-toolbar";
import { RankingsTable } from "@/components/rankings-table";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getLeagueChrome } from "@/lib/league-chrome";
import { getRankingsView } from "@/lib/rankings-data";
import { parseRankingsQuery, type RankingsSearchParams } from "@/lib/rankings-query";
import type { RaError } from "@/lib/roster-audit";

export const metadata: Metadata = { title: "Players" };

// PLAN.md line 47: each failure kind gets its own explanation, and line 46 forbids
// auto-retrying a rate limit — the reader retries by reloading.
const ERROR_STATES: Record<RaError["kind"], { title: string; description: string }> = {
  "rate-limited": { title: "Players are rate limited", description: "RosterAudit is throttling requests right now. Wait a minute and reload — this page will not retry on its own." },
  "upstream-unavailable": { title: "RosterAudit is unavailable", description: "The player value service did not respond. Values will return once it is reachable again." },
  "invalid-response": { title: "Unexpected player data", description: "RosterAudit returned a response this app could not read, so no values are shown rather than wrong ones." },
  "missing-key": { title: "RosterAudit key required", description: "This deployment has no RosterAudit API key configured." },
  "rejected-key": { title: "RosterAudit key rejected", description: "The configured RosterAudit API key was refused." },
  "unsynced-league": { title: "League not synced", description: "Sync this league at https://rosteraudit.com/league/ to unlock its player values." },
  "no-history": { title: "No history available", description: "RosterAudit has no historical data for this league yet." },
};

export default async function PlayersPage({ params, searchParams }: { params: Promise<{ leagueId: string }>; searchParams: Promise<RankingsSearchParams> }) {
  const [{ leagueId }, rawQuery] = await Promise.all([params, searchParams]);
  const query = parseRankingsQuery(rawQuery);
  // getLeagueChrome is the cheap read the layout already performs; it supplies isDynasty
  // without the full dashboard fetch a LeagueShell-owning page would need.
  const [league, result] = await Promise.all([getLeagueChrome(leagueId), getRankingsView(leagueId, query)]);

  // Plan 003's gate: dynasty values are meaningless for a redraft or keeper league, so the
  // whole page body is replaced rather than shown with numbers that do not apply.
  if (!league.isDynasty)
    return (
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
        <PageHeader description="Dynasty market values for every player, ranked and filterable." title="Players" />
        <DynastyRequired feature="Players" leagueId={leagueId} />
      </div>
    );

  // The sidebar and chrome come from src/app/[leagueId]/layout.tsx, so this page renders
  // only its own content inside the standard container.
  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <PageHeader description="Dynasty market values for every player, ranked and filterable." title="Players" />

      {result.ok ? (
        <>
          <RankingsToolbar leagueId={leagueId} query={query} />
          <RankingsTable query={query} view={result.view} />
        </>
      ) : (
        <Card><CardContent><Empty className="min-h-72 border"><EmptyHeader><EmptyMedia variant="icon">{result.error.kind === "rate-limited" ? <Hourglass /> : result.error.kind === "invalid-response" ? <TriangleAlert /> : <CloudOff />}</EmptyMedia><EmptyTitle>{ERROR_STATES[result.error.kind].title}</EmptyTitle><EmptyDescription>{ERROR_STATES[result.error.kind].description}</EmptyDescription></EmptyHeader></Empty></CardContent></Card>
      )}
    </div>
  );
}
