import Link from "next/link";
import { ArrowRight, CircleAlertIcon, LightbulbIcon, TrendingUpIcon, TriangleAlertIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamLink } from "@/components/team-link";
import { formatValue } from "@/lib/display";
import type { OverviewData, PositionScarcity, RecommendedAction, Tone } from "@/lib/team-insights";
import { cn } from "@/lib/utils";

const TONE_CHIP: Record<Tone, string> = {
  positive: "bg-positive/10 text-positive",
  warning: "bg-warning/10 text-warning",
  critical: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

const POSITION_STYLE: Record<PositionScarcity["position"], { text: string; bar: string; highlight: string }> = {
  QB: { text: "text-position-qb-foreground", bar: "bg-position-qb-background", highlight: "bg-position-qb-foreground" },
  RB: { text: "text-position-rb-foreground", bar: "bg-position-rb-background", highlight: "bg-position-rb-foreground" },
  WR: { text: "text-position-wr-foreground", bar: "bg-position-wr-background", highlight: "bg-position-wr-foreground" },
  TE: { text: "text-position-te-foreground", bar: "bg-position-te-background", highlight: "bg-position-te-foreground" },
};

function ToneIcon({ tone }: { tone: Tone }) {
  const Icon = tone === "positive" ? TrendingUpIcon : tone === "critical" ? CircleAlertIcon : tone === "warning" ? TriangleAlertIcon : LightbulbIcon;
  return <Icon size="16" aria-hidden="true" />;
}

function ActionRow({ action }: { action: RecommendedAction }) {
  return (
    <div className="flex items-start gap-3 border-b py-3 first:pt-0 last:border-b-0 last:pb-0">
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TONE_CHIP[action.tone])}><ToneIcon tone={action.tone} /></span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{action.title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{action.detail}</p>
        {/* Below sm the CTA drops out of the row and sits under the detail, rather than
            disappearing and leaving the recommendation with no way to act on it. */}
        {action.href && action.cta ? (
          <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 sm:hidden")} href={action.href}>
            {action.cta}<ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      {action.href && action.cta ? (
        <Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0 max-sm:hidden")} href={action.href}>
          {action.cta}<ArrowRight data-icon="inline-end" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function ScarcityColumn({ leagueId, scarcity, username }: { leagueId: string; scarcity: PositionScarcity; username?: string }) {
  const style = POSITION_STYLE[scarcity.position];
  const max = scarcity.rows[0]?.value ?? 1;
  const compactValue = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : formatValue(value);

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className={cn("font-semibold", style.text)}>{scarcity.position}</h3>
        <p className="text-xs text-muted-foreground">Top 3 control {scarcity.topThreeShare}%</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {scarcity.rows.map((row, index) => (
          <div className="grid grid-cols-[0.75rem_minmax(0,1fr)_minmax(1.5rem,3.5rem)_2.25rem] items-center gap-1.5 text-xs sm:grid-cols-[1rem_minmax(0,1fr)_minmax(2rem,4rem)_2.5rem]" key={row.rosterId}>
            <span className="text-center font-mono text-[0.65rem] text-muted-foreground">{index + 1}</span>
            <div className="min-w-0">
              <TeamLink className={cn("block truncate", row.isUser ? "font-semibold text-primary" : "text-muted-foreground")} leagueId={leagueId} rosterId={row.rosterId} username={username}>{row.name}</TeamLink>
              <span className="block truncate text-[0.6rem] text-muted-foreground">{row.manager}</span>
            </div>
            <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <span className={cn("block h-full rounded-full", row.isUser ? style.highlight : style.bar)} style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }} />
            </span>
            <span className={cn("text-right font-mono text-[0.65rem] tabular-nums", row.isUser ? "font-semibold text-foreground" : "text-muted-foreground")}>{compactValue(row.value)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PositionalScarcityCard({ data }: { data: OverviewData }) {
  if (!data.positionScarcity.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Positional scarcity</CardTitle>
        <CardDescription>Who controls each position</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
        {data.positionScarcity.map((scarcity) => <ScarcityColumn key={scarcity.position} leagueId={data.league.id} scarcity={scarcity} username={data.username} />)}
      </CardContent>
    </Card>
  );
}

export function RecommendedActionsCard({ data }: { data: OverviewData }) {
  if (!data.actions.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommended actions</CardTitle>
        <CardDescription>Ranked by what costs you most if you ignore it</CardDescription>
      </CardHeader>
      <CardContent>{data.actions.map((action) => <ActionRow action={action} key={action.id} />)}</CardContent>
    </Card>
  );
}
