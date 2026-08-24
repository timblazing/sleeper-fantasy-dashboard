"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { PlayerSnapWeek } from "@/lib/roster-audit";

const config = { snapPct: { label: "Snap share", color: "var(--series-2)" } } satisfies ChartConfig;

/**
 * Snap share by week — the leading indicator of a role changing.
 *
 * Fantasy points lag opportunity: a player losing snaps in weeks 14–16 is a sell before the
 * scoring catches up. Fixed 0–100 domain so the slope is honest rather than auto-scaled to
 * look dramatic.
 */
export function PlayerSnapTrend({ snaps, avgSnapPct }: { snaps: PlayerSnapWeek[]; avgSnapPct: number | null }) {
  const data = snaps.filter((week) => week.offensePct != null).map((week) => ({ week: week.week, opponent: week.opponent, snapPct: Math.round((week.offensePct ?? 0) * 100) }));
  if (data.length < 3) return null;

  // Last quarter of the season against the full-year average is the "is the role changing" read.
  const recent = data.slice(-4);
  const recentAvg = recent.reduce((total, row) => total + row.snapPct, 0) / recent.length;
  const seasonAvg = avgSnapPct != null ? Math.round(avgSnapPct * 100) : Math.round(data.reduce((total, row) => total + row.snapPct, 0) / data.length);
  const drift = Math.round(recentAvg - seasonAvg);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Snap share trend</CardTitle>
        <CardDescription>
          {seasonAvg}% on the season, {Math.round(recentAvg)}% over the last {recent.length} games
          {drift !== 0 ? <span className={drift > 0 ? "text-positive" : "text-negative"}> ({drift > 0 ? "+" : ""}{drift} pts)</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-auto h-48 w-full" config={config}>
          <AreaChart accessibilityLayer data={data} margin={{ left: 4, right: 4, top: 4 }}>
            <defs>
              <linearGradient id="player-snap-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-snapPct)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--color-snapPct)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis axisLine={false} dataKey="week" tickFormatter={(week: number) => `W${week}`} tickLine={false} tickMargin={8} />
            <YAxis axisLine={false} domain={[0, 100]} tickFormatter={(entry: number) => `${entry}%`} tickLine={false} tickMargin={8} width={40} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(entry) => <span className="font-mono tabular-nums">{Number(entry)}% of snaps</span>}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload as { opponent: string | null } | undefined;
                    return `Week ${label}${row?.opponent ? ` vs ${row.opponent}` : ""}`;
                  }}
                />
              }
            />
            <Area dataKey="snapPct" fill="url(#player-snap-fill)" stroke="var(--color-snapPct)" strokeWidth={2} type="monotone" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
