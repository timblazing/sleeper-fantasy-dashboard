"use client";

import { useState } from "react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChampionshipOddsRow, ChampionshipOddsSeason } from "@/lib/team-insights";
import { cn } from "@/lib/utils";

const TIER_BAR: Record<ChampionshipOddsRow["tier"], string> = {
  contention: "bg-warning",
  fringe: "bg-muted-foreground/55",
  out: "bg-muted-foreground/25",
};

function OddsRow({ maxOdds, nextTier, rank, row }: { maxOdds: number; nextTier?: ChampionshipOddsRow["tier"]; rank: number; row: ChampionshipOddsRow }) {
  const barWidth = Math.max(2, (row.odds / maxOdds) * 100);

  return (
    <li className={cn(
      "grid grid-cols-[1.25rem_minmax(4.75rem,7.5rem)_minmax(4rem,1fr)_3.25rem] items-center gap-x-2 border-b border-transparent py-1.5 text-xs last:border-b-0 sm:grid-cols-[1.25rem_minmax(7rem,10rem)_minmax(8rem,1fr)_3.5rem]",
      row.tier === "contention" && nextTier !== row.tier && "border-b-warning/25 pb-2",
      row.tier === "fringe" && nextTier !== row.tier && "border-b-border border-dashed pb-2",
    )}>
      <span className={cn("text-center font-mono tabular-nums", row.tier === "contention" ? "text-warning" : "text-muted-foreground")}>{rank}</span>
      <span className={cn("truncate", row.isUser ? "font-semibold text-primary" : "text-foreground")}>{row.manager}</span>
      <span className="relative h-5 overflow-hidden rounded bg-muted/35">
        <span className={cn("block h-full min-w-1 rounded", row.isUser ? "bg-primary" : TIER_BAR[row.tier])} style={{ width: `${barWidth}%` }} />
      </span>
      <span className="text-right font-mono text-[0.6875rem] font-medium tabular-nums">{row.odds.toFixed(1)}%</span>
    </li>
  );
}

export function ChampionshipOdds({ seasons }: { seasons: ChampionshipOddsSeason[] }) {
  const [season, setSeason] = useState(seasons.length ? String(seasons[0].season) : "");
  if (!seasons.length) return null;

  const active = seasons.find((entry) => String(entry.season) === season) ?? seasons[0];
  const maxOdds = active.rows[0]?.odds || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Championship odds</CardTitle>
        <CardDescription>Based on projected PPG + roster strength</CardDescription>
        <CardAction>
          {/* Tabs on desktop; the same choice collapses to a select on a phone. */}
          <Tabs className="max-sm:hidden" onValueChange={setSeason} value={season}>
            <TabsList aria-label="Championship season">
              {seasons.map((entry) => <TabsTrigger key={entry.season} value={String(entry.season)}>{entry.season}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <Select onValueChange={(value) => { if (value) setSeason(value); }} value={season}>
            <SelectTrigger aria-label="Championship season" className="sm:hidden" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((entry) => <SelectItem key={entry.season} value={String(entry.season)}>{entry.season}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ol aria-label={`${active.season} championship odds`}>
          {active.rows.map((row, index) => <OddsRow key={row.rosterId} maxOdds={maxOdds} nextTier={active.rows[index + 1]?.tier} rank={index + 1} row={row} />)}
        </ol>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.625rem] text-muted-foreground" aria-label="Odds tiers">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-warning" aria-hidden="true" />Contention</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-muted-foreground/55" aria-hidden="true" />Fringe</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-muted-foreground/25" aria-hidden="true" />Out</span>
        </div>
      </CardContent>
    </Card>
  );
}
