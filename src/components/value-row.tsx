import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PositionBadge } from "@/components/position-badge";
import { formatTrend, formatValue, headshotUrl } from "@/lib/display";
import { type ValuedPlayer } from "@/lib/league-values";
import { cn } from "@/lib/utils";

export const trendTone = (trend: number) => (trend > 0 ? "text-emerald-600 dark:text-emerald-400" : trend < 0 ? "text-destructive" : "text-muted-foreground");

/**
 * One player as the dynasty market sees them: identity on the left, worth on the right.
 * `meta` replaces the default club/position line when the caller has something better to
 * say there (who rosters them, how far they have moved this week).
 */
export function ValueRow({ entry, meta, note, trend, showRank = true }: { entry: ValuedPlayer; meta?: string; note?: string; trend?: number; showRank?: boolean }) {
  const player = entry.player;
  const defaultMeta = [player.team, player.age ? `age ${player.age}` : null].filter(Boolean).join(" · ");
  const rank = showRank && entry.rankOverall ? `#${entry.rankOverall}${entry.rankPosition && player.position ? ` · ${player.position}${entry.rankPosition}` : ""}` : null;

  return (
    <div className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
      <Avatar className="bg-muted">
        <AvatarImage alt="" src={headshotUrl(player)} />
        <AvatarFallback className="text-[0.6rem]">{player.position ?? "—"}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          <span className="truncate">{player.name}</span>
          <PositionBadge position={player.position} />
          {note ? <Badge className="text-[0.6rem]" variant="secondary">{note}</Badge> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{meta ?? defaultMeta}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-sm font-semibold tabular-nums">{formatValue(entry.value)}</p>
        {trend !== undefined && trend !== 0 ? (
          <p className={cn("font-mono text-xs tabular-nums", trendTone(trend))}>7d {formatTrend(trend)}</p>
        ) : rank ? (
          <p className="font-mono text-xs text-muted-foreground tabular-nums">{rank}</p>
        ) : null}
      </div>
    </div>
  );
}
