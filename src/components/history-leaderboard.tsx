"use client";

import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ManagerRow } from "@/lib/league-history";
import { cn } from "@/lib/utils";

const avatarUrl = (id: string) => `https://sleepercdn.com/avatars/thumbs/${id}`;
const initials = (name: string) => name.split(/\s|&/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

type SortKey = "record" | "pointsPerGame" | "winsAboveExpected" | "managerEfficiency";

const SORTS: { id: SortKey; label: string; description: string }[] = [
  { id: "record", label: "Compiled record", description: "Compiled regular-season wins, then win rate" },
  { id: "pointsPerGame", label: "Points per game", description: "Scoring rate across every regular-season week" },
  { id: "winsAboveExpected", label: "Wins above expected", description: "Wins beyond what the weekly scores deserved — schedule luck" },
  { id: "managerEfficiency", label: "Manager efficiency", description: "Share of weeks the manager outscored the league median" },
];

/** Signed values read faster with an explicit +, and the sign carries the color. */
function Signed({ value, digits = 2 }: { value: number; digits?: number }) {
  const rounded = Number(value.toFixed(digits));
  return (
    <span className={cn("font-mono tabular-nums", rounded > 0 ? "text-[var(--positive)]" : rounded < 0 ? "text-[var(--negative)]" : "text-muted-foreground")}>
      {rounded > 0 ? "+" : ""}{rounded.toFixed(digits)}
    </span>
  );
}

/**
 * The all-time standings — one row per manager, spanning every season the league has played.
 *
 * The sort is the point of the table: the same set of managers reorders under "wins above
 * expected" versus "compiled record", which is what separates the teams that were good from the
 * teams that were lucky.
 */
export function HistoryLeaderboard({ rows, seasonCount }: { rows: ManagerRow[]; seasonCount: number }) {
  const [sort, setSort] = useState<SortKey>("record");
  const active = SORTS.find((entry) => entry.id === sort) ?? SORTS[0];

  const sorted = useMemo(
    () =>
      rows.toSorted((a, b) =>
        sort === "record" ? b.wins - a.wins || b.winPct - a.winPct : b[sort] - a[sort] || b.winPct - a.winPct,
      ),
    [rows, sort],
  );

  return (
    <Card>
      <CardHeader className="max-sm:grid-cols-1!">
        <CardTitle>All-time standings</CardTitle>
        <CardDescription>{active.description} — {rows.length} managers across {seasonCount} {seasonCount === 1 ? "season" : "seasons"}</CardDescription>
        <CardAction className="max-sm:col-start-1 max-sm:row-start-3 max-sm:mt-2 max-sm:justify-self-stretch">
          <Select onValueChange={(value) => setSort(value as SortKey)} value={sort}>
            <SelectTrigger aria-label="Sort managers by" size="sm" className="w-[11.5rem] max-sm:w-full">
              {/* Base UI renders the raw value unless the label is supplied explicitly. */}
              <SelectValue>{() => active.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>{entry.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-4 text-center">#</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Record</TableHead>
              <TableHead className="text-right max-sm:hidden">PPG</TableHead>
              <TableHead className="text-right max-md:hidden">WAE</TableHead>
              <TableHead className="text-right max-md:hidden">Efficiency</TableHead>
              <TableHead className="pr-4 text-right max-lg:hidden">Seasons</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row, index) => (
              <TableRow key={row.ownerId} className={cn(!row.active && "opacity-60")}>
                <TableCell className="pl-4 text-center font-mono tabular-nums text-muted-foreground">{index + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-7">
                      {row.avatar ? <AvatarImage alt="" src={avatarUrl(row.avatar)} /> : null}
                      <AvatarFallback className="text-[0.5rem]">{initials(row.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="break-words text-xs font-medium leading-tight sm:truncate sm:text-sm">{row.name}</span>
                        {/* One trophy per title, so a dynasty is visible at a glance. */}
                        {row.championships > 0 ? (
                          <span aria-label={`${row.championships} championship${row.championships === 1 ? "" : "s"}`} className="shrink-0 text-xs">
                            {"🏆".repeat(row.championships)}
                          </span>
                        ) : null}
                        {!row.active ? <Badge className="shrink-0 max-sm:hidden" variant="outline">Former</Badge> : null}
                      </div>
                      <span className="block break-all text-[0.625rem] leading-tight text-muted-foreground sm:truncate sm:text-xs">{row.manager}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono tabular-nums">{row.wins}–{row.losses}{row.ties ? `–${row.ties}` : ""}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground max-sm:hidden">{row.games ? `${(row.winPct * 100).toFixed(0)}%` : "—"}</span>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums max-sm:hidden">{row.games ? row.pointsPerGame.toFixed(1) : "—"}</TableCell>
                <TableCell className="text-right max-md:hidden">{row.games ? <Signed value={row.winsAboveExpected} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-right font-mono tabular-nums max-md:hidden">{row.games ? `${(row.managerEfficiency * 100).toFixed(0)}%` : "—"}</TableCell>
                <TableCell className="pr-4 text-right max-lg:hidden">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{row.seasons.map((season) => season.season).join(" · ")}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
