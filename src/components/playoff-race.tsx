"use client";

import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TeamLink } from "@/components/team-link";
import type { PlayoffOutlook, PlayoffPicture, PlayoffRow } from "@/lib/playoff-odds";
import { cn } from "@/lib/utils";

const avatarUrl = (id: string) => `https://sleepercdn.com/avatars/thumbs/${id}`;
const initials = (name: string) => name.split(/\s|&/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
const pct = (value: number) => (value >= 99.95 ? ">99.9%" : value < 0.05 && value > 0 ? "<0.1%" : `${value.toFixed(1)}%`);

const OUTLOOK: Record<PlayoffOutlook, { label: string; chip: string; bar: string }> = {
  locked: { label: "Clinched", chip: "border-transparent bg-positive/12 text-positive", bar: "bg-positive" },
  likely: { label: "Likely", chip: "border-transparent bg-series-1/12 text-series-1", bar: "bg-series-1" },
  bubble: { label: "Bubble", chip: "border-transparent bg-warning/12 text-warning", bar: "bg-warning" },
  longshot: { label: "Long shot", chip: "border-transparent bg-muted text-muted-foreground", bar: "bg-muted-foreground/50" },
  eliminated: { label: "Eliminated", chip: "border-transparent bg-destructive/10 text-destructive", bar: "bg-destructive/40" },
};

const METRIC = {
  label: "Make playoffs",
  description: "Share of simulated seasons ending in the bracket",
} as const;

function TeamAvatar({ row, className }: { row: Pick<PlayoffRow, "avatar" | "name">; className?: string }) {
  return (
    <Avatar className={cn("size-6", className)}>
      {row.avatar ? <AvatarImage alt="" src={avatarUrl(row.avatar)} /> : null}
      <AvatarFallback className="text-[0.5rem]">{initials(row.name)}</AvatarFallback>
    </Avatar>
  );
}

/**
 * The headline table: one row per team, sorted by playoff odds, with the playoff
 * cutline drawn between the last qualifying seed and the first team on the outside.
 */
export function PlayoffRace({ leagueId, picture, username }: { leagueId: string; picture: PlayoffPicture; username?: string }) {
  const rows = useMemo(() => picture.rows.toSorted((a, b) => b.playoffOdds - a.playoffOdds), [picture.rows]);
  const max = Math.max(...rows.map((row) => row.playoffOdds), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Playoff race</CardTitle>
        <CardDescription>{METRIC.description} — {picture.simulations.toLocaleString()} simulations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[1.5rem_minmax(7rem,1fr)_minmax(3rem,6rem)_3.5rem] items-center gap-x-3 border-b pb-2 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground sm:grid-cols-[1.5rem_minmax(9rem,1.4fr)_minmax(5rem,1fr)_3.5rem_5.5rem_4.5rem_4rem]">
          <span className="text-center">#</span>
          <span>Team</span>
          <span>{METRIC.label}</span>
          <span className="text-right">Odds</span>
          <span className="max-sm:hidden">Outlook</span>
          <span className="text-right max-sm:hidden">Proj. wins</span>
          <span className="text-right max-sm:hidden">Avg seed</span>
        </div>

        <ol aria-label={METRIC.label}>
          {rows.map((row, index) => {
            const cutline = index + 1 === picture.playoffTeams && index + 1 < rows.length;
            return (
              <li key={row.rosterId}>
                <div
                  className={cn(
                    "grid grid-cols-[1.5rem_minmax(7rem,1fr)_minmax(3rem,6rem)_3.5rem] items-center gap-x-3 py-2 text-sm sm:grid-cols-[1.5rem_minmax(9rem,1.4fr)_minmax(5rem,1fr)_3.5rem_5.5rem_4.5rem_4rem]",
                    row.isUser && "-mx-2 rounded-md bg-primary/[0.07] px-2",
                  )}
                >
                  <span className="text-center font-mono text-xs tabular-nums text-muted-foreground">{index + 1}</span>

                  <div className="flex min-w-0 items-center gap-2">
                    <TeamAvatar row={row} />
                    <div className="min-w-0">
                      <TeamLink className={cn("block break-words text-xs font-medium leading-tight sm:truncate sm:text-[0.8125rem]", row.isUser && "text-primary")} leagueId={leagueId} rosterId={row.rosterId} username={username}>{row.name}</TeamLink>
                      <p className="break-all text-[0.625rem] leading-tight text-muted-foreground sm:truncate sm:text-[0.6875rem]">
                        {row.manager}
                        {picture.started ? <span className="ml-1.5 font-mono tabular-nums">{row.wins}–{row.losses}{row.ties ? `–${row.ties}` : ""}</span> : null}
                      </p>
                    </div>
                  </div>

                  <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className={cn("block h-full rounded-full transition-all", row.isUser ? "bg-primary" : OUTLOOK[row.outlook].bar)}
                      style={{ width: `${Math.max(row.playoffOdds > 0 ? 1.5 : 0, (row.playoffOdds / max) * 100)}%` }}
                    />
                  </span>

                  <span className={cn("text-right font-mono text-xs font-medium tabular-nums", row.playoffOdds === 0 && "text-muted-foreground")}>
                    {pct(row.playoffOdds)}
                  </span>

                  <span className="max-sm:hidden">
                    <Badge className={cn("px-1.5 text-[0.625rem] font-medium", OUTLOOK[row.outlook].chip)} variant="outline">
                      {OUTLOOK[row.outlook].label}
                    </Badge>
                  </span>

                  <span className="text-right font-mono text-xs tabular-nums text-muted-foreground max-sm:hidden">
                    {row.projectedWins.toFixed(1)}
                  </span>

                  <span className="text-right font-mono text-xs tabular-nums text-muted-foreground max-sm:hidden">
                    #{row.averageSeed.toFixed(1)}
                  </span>
                </div>

                {cutline ? (
                  <div aria-hidden="true" className="relative my-1 flex items-center gap-2">
                    <Separator className="flex-1 border-dashed bg-primary/30" />
                    <span className="text-[0.625rem] font-medium uppercase tracking-wide text-primary/70">Playoff cutline · top {picture.playoffTeams}</span>
                    <Separator className="flex-1 bg-primary/30" />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
