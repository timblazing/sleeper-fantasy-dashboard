"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { PathAnalysis, PlayoffPicture } from "@/lib/playoff-odds";
import { cn } from "@/lib/utils";

const pct = (value: number) => (value >= 99.95 ? ">99.9%" : value < 0.05 && value > 0 ? "<0.1%" : `${value.toFixed(1)}%`);

const config = { reachOdds: { label: "Still alive", color: "var(--series-1)" } } satisfies ChartConfig;

/** Round names run backwards from the final, matching the bracket card's labels. */
function roundLabel(round: number, total: number): string {
  const fromEnd = total - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi";
  if (fromEnd === 2) return "Quarter";
  return `R${round}`;
}

/**
 * The connected team's road to the title.
 *
 * Three things a manager wants that the race table cannot answer: whether the title case rests on
 * *getting in* or on *winning once there*, how deep the run typically goes, and who keeps ending it.
 */
export function PlayoffPath({ picture }: { picture: PlayoffPicture }) {
  const path: PathAnalysis | null = picture.path;
  if (!path || path.playoffOdds <= 0) return null;

  const totalRounds = path.rounds.length;
  const data = path.rounds.map((round) => ({
    round: roundLabel(round.round, totalRounds),
    reachOdds: Number(round.reachOdds.toFixed(1)),
    winOdds: round.winOdds,
  }));

  // Only the teams that actually turn up often enough to matter — the tail is noise.
  const threats = path.threats.filter((threat) => threat.meetOdds >= 1).slice(0, 6);
  const maxMeet = Math.max(...threats.map((threat) => threat.meetOdds), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Playoff path</CardTitle>
        <CardDescription>
          {pct(path.playoffOdds)} to qualify, then {pct(path.titleOddsIfQualified)} to win it from there — {pct(path.titleOdds)} overall
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div>
          <p className="mb-2 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
            How far the run goes · share of seasons where the bracket is reached
          </p>
          <ChartContainer className="aspect-auto h-40 w-full" config={config}>
            <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 4, top: 16 }}>
              <CartesianGrid vertical={false} />
              <XAxis axisLine={false} dataKey="round" tickLine={false} tickMargin={8} />
              <YAxis axisLine={false} domain={[0, 100]} tickFormatter={(entry: number) => `${entry}%`} tickLine={false} tickMargin={8} width={40} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(entry, _name, item) => {
                      const row = item?.payload as { winOdds: number } | undefined;
                      return (
                        <span className="font-mono tabular-nums">
                          {Number(entry)}% still alive
                          {row ? <span className="text-muted-foreground"> · wins it {row.winOdds.toFixed(0)}%</span> : null}
                        </span>
                      );
                    }}
                    labelFormatter={(label) => `${label} round`}
                  />
                }
              />
              <Bar dataKey="reachOdds" fill="var(--color-reachOdds)" radius={[4, 4, 0, 0]}>
                <LabelList className="fill-muted-foreground font-mono text-[0.625rem]" dataKey="reachOdds" formatter={(value) => (value === undefined ? "" : `${value}%`)} position="top" />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>

        {threats.length ? (
          <div>
            <p className="mb-2 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
              Who is in the way · how often they are met, and how often they are beaten
            </p>
            <ul className="flex flex-col gap-1.5">
              {threats.map((threat) => (
                <li className="grid grid-cols-[minmax(5rem,1fr)_minmax(4rem,7rem)_3rem_3.5rem] items-center gap-x-2.5 text-sm" key={threat.rosterId}>
                  <span className="truncate text-[0.8125rem]">{threat.name}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-muted-foreground/50" style={{ width: `${(threat.meetOdds / maxMeet) * 100}%` }} />
                  </span>
                  <span className="text-right font-mono text-[0.6875rem] tabular-nums text-muted-foreground">{threat.meetOdds.toFixed(0)}%</span>
                  {/* Below an even split this team is a genuine roadblock rather than a formality. */}
                  <span className={cn("text-right font-mono text-xs font-medium tabular-nums", threat.beatOdds >= 50 ? "text-positive" : "text-negative")}>
                    {threat.beatOdds.toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[0.625rem] text-muted-foreground">
              Left bar: share of your bracket runs they appear in. Right: your win rate in those meetings.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
