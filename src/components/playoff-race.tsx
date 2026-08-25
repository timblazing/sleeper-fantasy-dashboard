"use client";

import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
export function PlayoffRace({ picture }: { picture: PlayoffPicture }) {
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
                      <p className={cn("break-words text-xs font-medium leading-tight sm:truncate sm:text-[0.8125rem]", row.isUser && "text-primary")}>{row.name}</p>
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

/**
 * Seed-by-seed probability grid. Reading across a row shows how a team's season is likely to
 * land; reading down a column shows who is competing for that seed.
 */
export function SeedMatrix({ picture }: { picture: PlayoffPicture }) {
  const rows = useMemo(() => picture.rows.toSorted((a, b) => a.averageSeed - b.averageSeed), [picture.rows]);
  const seeds = Array.from({ length: picture.teams }, (_, index) => index + 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seed probability</CardTitle>
        <CardDescription>Chance of finishing at each seed</CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="overflow-x-auto">
            <table className="w-full min-w-xl table-fixed border-separate border-spacing-0.5">
              <colgroup>
                <col className="w-[11rem]" />
                {seeds.map((seed) => <col key={seed} />)}
              </colgroup>
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card pr-2 text-left text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">Team</th>
                  {seeds.map((seed) => (
                    <th
                      key={seed}
                      className={cn(
                        "pb-1 text-center font-mono text-[0.625rem] font-medium tabular-nums",
                        seed <= picture.playoffTeams ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {seed}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rosterId}>
                    <th
                      className={cn(
                        "sticky left-0 z-10 max-w-[10rem] truncate bg-card pr-2 text-left text-[0.75rem] font-medium",
                        row.isUser ? "text-primary" : "text-foreground",
                      )}
                      scope="row"
                    >
                      <span className="flex items-center gap-1.5">
                        <TeamAvatar className="size-4" row={row} />
                        <span className="truncate">{row.name}</span>
                      </span>
                    </th>
                    {seeds.map((seed) => {
                      const value = row.seedOdds[seed - 1] ?? 0;
                      const inBracket = seed <= picture.playoffTeams;
                      // Seed odds rarely exceed ~40% for one team, so the ramp saturates near
                      // that rather than at 100 — otherwise the whole grid reads as pale.
                      const intensity = Math.min(92, 10 + (value / 40) * 82);
                      return (
                        <td key={seed} className="p-0">
                          <Tooltip>
                            <TooltipTrigger
                              className={cn(
                                "flex h-7 w-full items-center justify-center rounded-[3px] font-mono text-[0.5625rem] font-medium tabular-nums transition-colors",
                                value < 0.5
                                  ? "text-muted-foreground/40"
                                  // The mid range of the ramp is the tricky part: it is too dark
                                  // for foreground text and too light for inverted text, so the
                                  // flip happens late and the fill carries a matching border.
                                  : intensity >= 70
                                    ? inBracket ? "text-primary-foreground" : "text-background"
                                    : "text-foreground",
                              )}
                              style={{
                                // A single hue ramp per side of the cutline keeps the grid readable
                                // without introducing a second colour scale.
                                backgroundColor: value < 0.5
                                  ? "var(--muted)"
                                  : inBracket
                                    ? `color-mix(in oklch, var(--primary) ${intensity}%, transparent)`
                                    : `color-mix(in oklch, var(--muted-foreground) ${intensity}%, transparent)`,
                              }}
                            >
                              {value >= 0.5 ? value.toFixed(0) : "·"}
                            </TooltipTrigger>
                            <TooltipContent>
                              {row.name} finishes seed {seed} in {pct(value)} of seasons
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
