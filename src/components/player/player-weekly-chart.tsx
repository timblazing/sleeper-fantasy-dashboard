"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PlayerWeeklyLine } from "@/lib/roster-audit";

const config = { points: { label: "Points", color: "var(--series-1)" } } satisfies ChartConfig;

/**
 * Week-by-week scoring, coloured against the player's own average.
 *
 * A flat bar chart hides the thing that actually decides a start/sit: consistency. Bars above
 * the mean take the positive tone and bars below take the muted one, so a boom/bust profile
 * reads as an alternating pattern rather than as a wall of identical bars.
 */
export function PlayerWeeklyChart({ weekly, season }: { weekly: PlayerWeeklyLine[]; season: number | null }) {
  const [scoring, setScoring] = useState<"ppr" | "standard">("ppr");

  const data = useMemo(
    () => weekly.map((line) => ({ week: line.week, opponent: line.opponent, points: (scoring === "ppr" ? line.pointsPpr : line.points) ?? 0 })),
    [scoring, weekly],
  );

  if (data.length < 2) return null;

  const played = data.filter((row) => row.points > 0);
  const average = played.length ? played.reduce((total, row) => total + row.points, 0) / played.length : 0;
  const best = Math.max(...data.map((row) => row.points));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly scoring</CardTitle>
        <CardDescription>
          {season ?? "Season"} · {average.toFixed(1)} average, {best.toFixed(1)} best. Bars above the line beat his own average.
        </CardDescription>
        <CardAction>
          <ToggleGroup aria-label="Scoring format" onValueChange={(next) => { if (next[0]) setScoring(next[0] as "ppr" | "standard"); }} size="sm" value={[scoring]} variant="outline">
            <ToggleGroupItem value="ppr">PPR</ToggleGroupItem>
            <ToggleGroupItem value="standard">Standard</ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-auto h-56 w-full" config={config}>
          <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 4, top: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis axisLine={false} dataKey="week" tickFormatter={(week: number) => `W${week}`} tickLine={false} tickMargin={8} />
            <YAxis axisLine={false} tickLine={false} tickMargin={8} width={32} />
            <ReferenceLine stroke="var(--border)" strokeDasharray="4 4" y={average} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(entry) => <span className="font-mono tabular-nums">{Number(entry).toFixed(1)} pts</span>}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload as { opponent: string | null } | undefined;
                    return `Week ${label}${row?.opponent ? ` vs ${row.opponent}` : ""}`;
                  }}
                />
              }
            />
            <Bar dataKey="points" radius={[4, 4, 0, 0]}>
              {data.map((row) => <Cell fill={row.points >= average ? "var(--color-points)" : "var(--muted-foreground)"} fillOpacity={row.points >= average ? 1 : 0.35} key={row.week} />)}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
