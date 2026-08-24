"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { OverviewData } from "@/lib/team-insights";

const chartConfig = {
  strength: { label: "League strength", color: "var(--series-1)" },
} satisfies ChartConfig;

/**
 * A rank is lower when it is better, while a radar chart reads the outer edge as stronger.
 * Flip the scale so first place reaches 100 and the league's last-place room reaches 0.
 */
function rankStrength(rank: number, teams: number) {
  if (teams <= 1) return 100;
  return Math.round(((teams - rank) / (teams - 1)) * 100);
}

export function PositionalRankingsCard({ data }: { data: OverviewData }) {
  if (!data.team || !data.valuesReady || !data.rooms.length) return null;

  const chartData = data.rooms.map((room) => ({
    position: room.position,
    rank: room.rank,
    teams: data.league.teams,
    strength: rankStrength(room.rank, data.league.teams),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Positional rankings</CardTitle>
        <CardDescription>Your roster strength by position</CardDescription>
      </CardHeader>
      <CardContent className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <ChartContainer className="aspect-auto h-72 w-full sm:h-80" config={chartConfig} nativeResponsive>
          <RadarChart accessibilityLayer data={chartData} height={288} margin={{ bottom: 20, left: 28, right: 28, top: 20 }} outerRadius="72%" style={{ height: "100%", width: "100%" }} width={360}>
            <defs>
              <linearGradient id="position-rank-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-strength)" stopOpacity={0.7} />
                <stop offset="100%" stopColor="var(--color-strength)" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <PolarGrid gridType="polygon" />
            <PolarAngleAxis
              dataKey="position"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickFormatter={(position: string) => {
                const room = chartData.find((entry) => entry.position === position);
                return room ? `${position} · #${room.rank}` : position;
              }}
              tickLine={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideIndicator
                  formatter={(_value, _name, item) => {
                    const room = item.payload as { rank?: number; teams?: number } | undefined;
                    return room?.rank && room.teams ? (
                      <span className="font-mono tabular-nums">#{room.rank} of {room.teams}</span>
                    ) : null;
                  }}
                />
              }
            />
            <Radar
              dataKey="strength"
              dot={{ fill: "var(--color-strength)", r: 3.5, strokeWidth: 0 }}
              fill="url(#position-rank-fill)"
              fillOpacity={1}
              stroke="var(--color-strength)"
              strokeWidth={2}
            />
          </RadarChart>
        </ChartContainer>
        <dl className="grid grid-cols-4 gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border">
          {chartData.map((room) => (
            <div className="bg-card px-2 py-2.5 text-center" key={room.position}>
              <dt className="text-[0.65rem] font-medium text-muted-foreground">{room.position}</dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">#{room.rank}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
