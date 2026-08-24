import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PlayerRankMetric } from "@/lib/roster-audit";
import { cn } from "@/lib/utils";

/**
 * Percentile is already normalised for "lower is better" upstream — a bust rate in the 90th
 * percentile means a *good* bust rate. So the bar length and its colour both read off the
 * percentile directly, and `lowerIsBetter` only affects how the raw value is captioned.
 */
const toneFor = (percentile: number | null) => {
  if (percentile == null) return "bg-muted-foreground/40";
  if (percentile >= 90) return "bg-positive";
  if (percentile >= 70) return "bg-primary";
  if (percentile >= 40) return "bg-muted-foreground/60";
  return "bg-negative/70";
};

const formatMetricValue = (metric: PlayerRankMetric) => {
  if (metric.value == null) return "—";
  // Rates arrive as a 0–1 fraction; counting stats arrive whole. Anything under 1 that is not
  // an exact integer is a share, so it reads as a percentage.
  if (metric.value > 0 && metric.value < 1) return `${(metric.value * 100).toFixed(1)}%`;
  return Number.isInteger(metric.value) ? metric.value.toLocaleString("en-US") : metric.value.toFixed(2);
};

function MetricRow({ metric }: { metric: PlayerRankMetric }) {
  const percentile = metric.percentile ?? 0;
  const peers = [...metric.above.slice(-1), ...metric.below.slice(0, 1)];

  const row = (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium">{metric.label}</span>
        <span className="shrink-0 font-mono text-sm tabular-nums">{formatMetricValue(metric)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", toneFor(metric.percentile))} style={{ width: `${Math.max(percentile, 2)}%` }} />
      </div>
      <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">#{metric.rank} of {metric.of}</span>
        <span className={cn("tabular-nums", metric.isElite && "font-medium text-positive")}>{metric.percentile == null ? "—" : `${metric.percentile}th pct`}</span>
      </div>
    </div>
  );

  // `why` is RosterAudit's own explanation of the metric; peers give the placement a human scale.
  if (!metric.why && !peers.length) return row;
  return (
    <Tooltip>
      <TooltipTrigger render={<div className="cursor-help" />}>{row}</TooltipTrigger>
      <TooltipContent className="max-w-64">
        {metric.why ? <p>{metric.why}</p> : null}
        {peers.length ? <p className={cn("text-muted-foreground", metric.why && "mt-1")}>Near: {peers.join(", ")}</p> : null}
      </TooltipContent>
    </Tooltip>
  );
}

/** Where the player sits among positional peers, one bar per tracked metric. */
export function PlayerPercentiles({ metrics, season, position }: { metrics: PlayerRankMetric[]; season: number | null; position: string }) {
  if (!metrics.length) return null;
  // Strongest first: the reader wants the case for the player before the caveats.
  const ordered = [...metrics].sort((a, b) => (b.percentile ?? -1) - (a.percentile ?? -1));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{season ?? "Season"} rankings</CardTitle>
        <CardDescription>Percentile among {position}s, best first. Hover a metric for what it measures.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((metric) => <MetricRow key={metric.key} metric={metric} />)}
      </CardContent>
    </Card>
  );
}
