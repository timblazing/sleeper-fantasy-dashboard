"use client";

import { CartesianGrid, Cell, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { PlayoffPicture } from "@/lib/playoff-odds";

const config = {
  playoffOdds: { label: "Playoff odds", color: "var(--series-1)" },
} satisfies ChartConfig;

/**
 * Scoring strength against playoff odds — the chart that shows *why* the table is ordered
 * the way it is, and which teams are being carried or held back by their schedule.
 *
 * The two reference lines split the field into quadrants: above the 50% line and left of the
 * average scoring line is a team the schedule is flattering, and the reverse is one it is robbing.
 */
export function OddsScatter({ picture }: { picture: PlayoffPicture }) {
  const rows = picture.rows;
  if (rows.length < 2) return null;

  const data = rows.map((row) => ({
    ppg: Number(row.ppg.toFixed(1)),
    playoffOdds: Number(row.playoffOdds.toFixed(1)),
    name: row.name,
    manager: row.manager,
    isUser: row.isUser,
    // Drives the point radius through ZAxis, so the title favourites read as the bigger dots.
    titleOdds: Math.max(1, row.titleOdds),
  }));

  const ppgValues = data.map((row) => row.ppg);
  const rawMin = Math.min(...ppgValues);
  const rawMax = Math.max(...ppgValues);
  // Pad the domain so no point sits on an axis, and guard the all-equal case.
  const spread = rawMax - rawMin || 10;
  const avgPpg = ppgValues.reduce((sum, value) => sum + value, 0) / ppgValues.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strength vs. odds</CardTitle>
        <CardDescription>Projected scoring against playoff probability — dot size is title odds</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-auto h-72 w-full" config={config}>
          <ScatterChart accessibilityLayer margin={{ left: 4, right: 12, top: 12, bottom: 12 }}>
            <CartesianGrid />
            <XAxis
              axisLine={false}
              dataKey="ppg"
              domain={[Number((rawMin - spread * 0.12).toFixed(1)), Number((rawMax + spread * 0.12).toFixed(1))]}
              name="Points per game"
              tickCount={6}
              tickFormatter={(entry: number) => entry.toFixed(0)}
              tickLine={false}
              tickMargin={8}
              type="number"
            />
            <YAxis
              axisLine={false}
              dataKey="playoffOdds"
              domain={[0, 100]}
              name="Playoff odds"
              tickFormatter={(entry: number) => `${entry}%`}
              tickLine={false}
              tickMargin={8}
              type="number"
              width={44}
            />
            <ZAxis dataKey="titleOdds" range={[60, 420]} type="number" />
            <ReferenceLine strokeDasharray="4 4" y={50} />
            <ReferenceLine strokeDasharray="4 4" x={Number(avgPpg.toFixed(1))} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(_entry, _name, item) => {
                    const row = item?.payload as { name: string; manager: string; ppg: number; playoffOdds: number } | undefined;
                    if (!row) return null;
                    return (
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium">{row.name}</span>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {row.ppg.toFixed(1)} PPG · {row.playoffOdds.toFixed(1)}% playoff odds
                        </span>
                      </span>
                    );
                  }}
                />
              }
              cursor={{ strokeDasharray: "3 3" }}
            />
            <Scatter data={data} name="Teams">
              {data.map((row) => (
                <Cell
                  fill={row.isUser ? "var(--primary)" : "var(--color-playoffOdds)"}
                  fillOpacity={row.isUser ? 1 : row.playoffOdds >= 50 ? 0.75 : 0.4}
                  key={row.name}
                  stroke={row.isUser ? "var(--primary)" : "transparent"}
                  strokeWidth={row.isUser ? 2 : 0}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ChartContainer>
        <p className="mt-2 text-center text-[0.625rem] text-muted-foreground">Projected points per game</p>
      </CardContent>
    </Card>
  );
}
