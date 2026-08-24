import Link from "next/link";
import { CheckIcon, SparklesIcon } from "lucide-react";
import { PositionalScarcityCard, RecommendedActionsCard } from "@/components/insights";
import { MatchupLineup } from "@/components/matchup-lineup";
import { MatchupSummary } from "@/components/matchup-summary";
import { PageHeader } from "@/components/page-header";
import { RecentActivityCard } from "@/components/recent-activity-card";
import { initials, avatarUrl } from "@/components/standings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { OverviewData, SeasonTimeline } from "@/lib/team-insights";
import { cn } from "@/lib/utils";
import type { MatchupDetail } from "@/lib/types";

/** The season as one rail, so how much runway is left is a glance rather than a calculation. */
function SeasonTimelineCard({ timeline }: { timeline: SeasonTimeline }) {
  const span = Math.max(1, timeline.endWeek - timeline.startWeek);
  const at = (week: number) => Math.min(100, Math.max(0, ((week - timeline.startWeek) / span) * 100));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Season timeline</CardTitle>
        <CardDescription>
          {timeline.currentWeek === 0 ? timeline.phase.label : `Week ${timeline.currentWeek} of ${timeline.endWeek}`} · {timeline.phase.detail}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="relative mx-1.5 mt-3 h-1.5 rounded-full bg-muted">
          <div className="absolute inset-y-0 left-0 rounded-full bg-foreground/60" style={{ width: `${at(timeline.currentWeek)}%` }} />
          {timeline.markers.map((marker) => (
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-card",
                marker.state === "now" ? "bg-foreground" : marker.state === "past" ? "bg-foreground/60" : "bg-muted-foreground/30",
              )}
              key={marker.id}
              style={{ left: `${at(marker.week)}%` }}
            />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {timeline.markers.map((marker) => (
            <div className={cn("rounded-lg p-3 ring-1", marker.state === "now" ? "bg-muted/60 ring-foreground/20" : "bg-muted/30 ring-foreground/5")} key={marker.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">{marker.week === 0 ? "Current phase" : `Week ${marker.week}`}</span>
                {marker.state === "now" ? <Badge className="text-[0.6rem]" variant="secondary">Now</Badge> : null}
                {marker.state === "past" ? <CheckIcon className="size-3.5 text-muted-foreground" aria-hidden="true" /> : null}
              </div>
              <p className={cn("mt-1 font-medium", marker.state === "past" && "text-muted-foreground")}>{marker.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{marker.detail}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TeamGrade({ data }: { data: OverviewData }) {
  const { team, outlook } = data;
  if (!team || !outlook) return null;

  return (
    <Card>
      <CardContent className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="size-20 shrink-0 sm:size-24">
            {team.avatar ? <AvatarImage alt="" src={avatarUrl(team.avatar)} /> : null}
            <AvatarFallback className="text-2xl font-bold tracking-tight">{initials(team.name)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{team.name}</p>
            </div>
            <p className="truncate text-sm text-muted-foreground">@{team.manager}</p>
            <p className="text-sm text-muted-foreground">{data.league.season} {data.league.type} · {data.league.superflex ? "Superflex" : "1QB"} · {data.phase.label}</p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border md:min-w-96">
          {[
            { label: "Record", value: `${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ""}` },
            { label: "Roster value", value: `#${outlook.valueRank} / ${outlook.teams}` },
            { label: "Scoring", value: `#${outlook.powerRank} / ${outlook.teams}` },
          ].map((metric) => (
            <div className="bg-card px-3 py-3 text-center" key={metric.label}>
              <dt className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{metric.label}</dt>
              <dd className="mt-1 font-mono text-sm font-semibold tabular-nums sm:text-base">{metric.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function CurrentMatchup({ data }: { data: OverviewData }) {
  const { matchup } = data;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{data.team && matchup && (matchup.home.team.rosterId === data.team.rosterId || matchup.away.team.rosterId === data.team.rosterId) ? "Your matchup" : "This week"}</CardTitle>
        <CardDescription>Week {data.state.matchupWeek}{data.state.regularSeason ? "" : " · preseason preview"}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {matchup ? (
          <>
            <div className="rounded-lg border bg-muted/20 p-3"><MatchupSummary leagueId={data.league.id} matchup={matchup} username={data.username} /></div>
            <LineupPreview leagueId={data.league.id} matchup={matchup} username={data.username} />
          </>
        ) : (
          <Empty className="border"><EmptyHeader><EmptyTitle>No matchup available</EmptyTitle><EmptyDescription>There is no matchup data for week {data.state.matchupWeek}.</EmptyDescription></EmptyHeader></Empty>
        )}
      </CardContent>
    </Card>
  );
}

function LineupPreview({ matchup, leagueId, username }: { matchup: MatchupDetail; leagueId: string; username?: string }) {
  if (!matchup.home.slots.length) return null;
  // The lineup is the densest grid on the dashboard and the first thing to truncate on a phone.
  // Cancelling the card's side padding here buys the player names ~24px without shrinking type
  // or touching the card's own padding everywhere else.
  return (
    <section className="-mx-(--card-spacing) sm:mx-0">
      <MatchupLineup leagueId={leagueId} matchup={matchup} username={username} />
    </section>
  );
}

function ConnectPrompt({ leagueId }: { leagueId: string }) {
  return (
    <Card>
      <CardContent>
        <Empty className="min-h-56 border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><SparklesIcon /></EmptyMedia>
            <EmptyTitle>Connect your Sleeper username</EmptyTitle>
            <EmptyDescription>Roster grades, lineup warnings, and recommended moves are built around your team. Add <code className="font-mono">?username=</code> to the URL, or pick your league from the home page.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/?league=${leagueId}`}>Connect account</Link>
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  );
}

export function Overview({ data }: { data: OverviewData }) {
  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <PageHeader description="This week at a glance — your matchup, where you stand, and what just moved in the league." title="Dashboard" />

      {data.team ? <TeamGrade data={data} /> : <ConnectPrompt leagueId={data.league.id} />}

      {/* The matchup is the week's headline, so it keeps two thirds; recent league movement fills
          the side rail to the same height on desktop. */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Grid items default to min-width:auto, which refuses to shrink below the lineup's
            intrinsic width and pushes the whole row past a phone viewport. */}
        <div className="min-w-0 lg:col-span-2">
          <CurrentMatchup data={data} />
        </div>
        <div className="min-w-0 lg:h-0 lg:min-h-full">
          <RecentActivityCard activity={data.activity} />
        </div>
      </div>

      <RecommendedActionsCard data={data} />

      <PositionalScarcityCard data={data} />

      <SeasonTimelineCard timeline={data.timeline} />
    </div>
  );
}
