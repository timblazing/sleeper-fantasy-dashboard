import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { MatchupDetail, MatchupSide } from "@/lib/types";
import { cn, withUsername } from "@/lib/utils";

const score = (value: number | null) => value == null ? "—" : value.toFixed(1);
// Favored/underdog read at a glance. An exact 50 is a true coin flip, so it stays neutral rather
// than picking a side.
const probabilityTone = (probability: number | null) =>
  probability == null || probability === 50 ? "bg-muted-foreground/50" : probability > 50 ? "bg-positive" : "bg-destructive";
const liveScore = (side: MatchupSide) => side.slots.some((entry) => entry.game?.state === "in" || entry.game?.state === "post") ? side.score.toFixed(1) : "-";

function TeamAvatar({ side }: { side: MatchupSide }) {
  return (
    <Avatar className="hidden size-10 border bg-muted sm:flex">
      {side.team.avatar ? <AvatarImage alt="" src={`https://sleepercdn.com/avatars/thumbs/${side.team.avatar}`} /> : null}
      <AvatarFallback>{side.team.name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

function CompactTeam({ probability, reverse, side, leagueId, username }: { probability: number | null; reverse?: boolean; side: MatchupSide; leagueId?: string; username?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2 sm:gap-3", reverse && "flex-row-reverse text-right")}>
      <TeamAvatar side={side} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.65rem] leading-tight text-muted-foreground sm:text-xs">@{side.team.manager}</p>
        {leagueId ? (
          <Link className="mt-0.5 block truncate text-xs font-semibold leading-tight hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-base" href={withUsername(`/${leagueId}/teams/${side.team.rosterId}`, username)}>
            {side.team.name}
          </Link>
        ) : (
          <p className="mt-0.5 truncate text-xs font-semibold leading-tight sm:text-base">{side.team.name}</p>
        )}
        <div className={cn("mt-1.5 flex items-center gap-1.5 sm:mt-2 sm:gap-2", reverse && "flex-row-reverse")}>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", probabilityTone(probability))} style={{ width: `${probability ?? 50}%` }} />
          </div>
          <span className="w-8 shrink-0 font-mono text-[0.65rem] font-semibold tabular-nums">{probability == null ? "—" : `${probability}%`}</span>
        </div>
      </div>
    </div>
  );
}

function TeamScore({ side }: { side: MatchupSide }) {
  return (
    <div className="flex min-w-8 flex-col items-center font-mono tabular-nums sm:min-w-10">
      <span className="text-sm font-semibold">{liveScore(side)}</span>
      <span aria-label={`Projected ${score(side.projectedScore)} points`} className="text-[0.65rem] text-muted-foreground">{score(side.projectedScore)}</span>
    </div>
  );
}

export function MatchupSummary({ matchup, leagueId, username }: { matchup: MatchupDetail; leagueId?: string; username?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
      <CompactTeam leagueId={leagueId} probability={matchup.homeWinProbability} side={matchup.home} username={username} />
      <div className="flex items-center gap-1 sm:gap-2">
        <TeamScore side={matchup.home} />
        <Badge className="shrink-0 rounded-full" variant="secondary">VS</Badge>
        <TeamScore side={matchup.away} />
      </div>
      <CompactTeam leagueId={leagueId} probability={matchup.awayWinProbability} reverse side={matchup.away} username={username} />
    </div>
  );
}
