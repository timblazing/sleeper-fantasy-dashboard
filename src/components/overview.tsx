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
import type { OverviewData, SeasonTimeline, Tone } from "@/lib/team-insights";
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

/**
 * Tone is the only thing on this screen allowed to color a number, and it maps to the
 * semantic result tokens rather than a per-component hex.
 */
const TONE_TEXT: Record<Tone, string> = {
  positive: "text-positive",
  warning: "text-warning",
  critical: "text-negative",
  neutral: "text-foreground",
};

/**
 * The focal panel. An operations console answers "how are things?" with one dominant
 * read, not a row of equal tiles — so the trajectory verdict (Compete / Retool / Rebuild)
 * takes the left two thirds at display size, and the four supporting metrics sit beside
 * it at a deliberately smaller weight.
 */
function LeagueStatus({ data }: { data: OverviewData }) {
  const { team, outlook, trajectory } = data;
  if (!team || !outlook) return null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-0 p-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-4 p-4 md:gap-5 md:p-6">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-10 shrink-0">
              {team.avatar ? <AvatarImage alt="" src={avatarUrl(team.avatar)} /> : null}
              <AvatarFallback className="text-xs font-semibold">{initials(team.name)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <p className="truncate font-semibold leading-tight">{team.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                @{team.manager} · {data.league.season} {data.league.type} · {data.league.superflex ? "Superflex" : "1QB"}
              </p>
            </div>
          </div>

          {trajectory ? (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">Your window</span>
              <p className={cn("text-3xl font-bold leading-none tracking-tight sm:text-4xl lg:text-5xl", TONE_TEXT[trajectory.tone])}>
                {trajectory.window}
              </p>
              {/* The verdict is only useful with the move that follows from it, and this is the
                  one place on the dashboard where a reading measure applies. */}
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{trajectory.detail}</p>
              <p className="font-mono text-xs text-muted-foreground">{trajectory.meta}</p>
            </div>
          ) : null}
        </div>

        {/* Supporting tier: a hairline-separated 2×2 rather than four floating cards, so the
            metrics read as one instrument panel attached to the verdict. */}
        <dl className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4 lg:grid-cols-2 lg:border-t-0 lg:border-l">
          {data.metrics.map((metric) => (
            <div className="flex flex-col justify-center gap-0.5 bg-card p-3 md:p-5 lg:gap-1" key={metric.id}>
              <dt className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">{metric.label}</dt>
              <dd className={cn("font-mono text-lg font-semibold tabular-nums md:text-xl", TONE_TEXT[metric.tone])}>{metric.value}</dd>
              {/* The supporting sentence is the first thing to go when there is no room for it. */}
              <dd className="hidden text-xs text-muted-foreground sm:block">{metric.detail}</dd>
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
      <CardContent className="flex flex-col gap-3">
        {matchup ? (
          <>
            <div className="rounded-lg bg-muted/20 p-2.5 sm:p-3"><MatchupSummary leagueId={data.league.id} matchup={matchup} username={data.username} /></div>
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
  return <MatchupLineup leagueId={leagueId} matchup={matchup} username={username} />;
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
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:gap-6 md:p-6">
      <PageHeader description="This week at a glance — your matchup, where you stand, and what just moved in the league." title="Dashboard" />

      {data.team ? <LeagueStatus data={data} /> : <ConnectPrompt leagueId={data.league.id} />}

      {/* The matchup is the week's headline, so it keeps two thirds; recent league movement fills
          the side rail to the same height on desktop. */}
      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
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
