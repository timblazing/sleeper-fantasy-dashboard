import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatValue } from "@/lib/display";
import type { PowerRankings, PowerRow, PowerTier } from "@/lib/power-rankings";
import { cn, withUsername } from "@/lib/utils";

const avatarUrl = (id: string) => `https://sleepercdn.com/avatars/thumbs/${id}`;
const initials = (name: string) => name.split(/\s|&/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

/** One tone ladder for the whole table: the tier chip, the rating bar, and the rank rail all read from it. */
const TIER: Record<PowerTier, { label: string; chip: string; rail: string }> = {
  elite: { label: "Elite", chip: "border-transparent bg-positive/12 text-positive", rail: "bg-positive" },
  contender: { label: "Contender", chip: "border-transparent bg-series-1/12 text-series-1", rail: "bg-series-1" },
  middle: { label: "In the mix", chip: "border-transparent bg-muted text-muted-foreground", rail: "bg-muted-foreground/40" },
  fading: { label: "Fading", chip: "border-transparent bg-warning/12 text-warning", rail: "bg-warning/70" },
  bottom: { label: "Bottom tier", chip: "border-transparent bg-destructive/10 text-destructive", rail: "bg-destructive/50" },
};

/** Week-over-week movement. Flat is deliberately quiet so the eye lands on teams that actually moved. */
function Delta({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta === 0) return <span className="inline-flex items-center text-muted-foreground/50"><Minus aria-hidden="true" className="size-3" /><span className="sr-only">No change</span></span>;

  const up = delta > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-mono text-xs font-medium tabular-nums", up ? "text-positive" : "text-negative")}>
      <Icon aria-hidden="true" className="size-3" />
      {Math.abs(delta)}
      <span className="sr-only">{up ? "up" : "down"} {Math.abs(delta)} places</span>
    </span>
  );
}

/** Recent results as dots, newest first — a whole month of form in the width of a word. */
function FormDots({ results }: { results: boolean[] }) {
  if (!results.length) return <span className="text-muted-foreground/40">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      {results.map((won, index) => (
        <span
          className={cn("size-1.5 rounded-full", won ? "bg-positive" : "bg-muted-foreground/25", index === 0 && "ring-2 ring-offset-1 ring-offset-card", index === 0 && (won ? "ring-positive/25" : "ring-muted-foreground/15"))}
          key={index}
        >
          <span className="sr-only">{won ? "Win" : "Loss"}</span>
        </span>
      ))}
    </span>
  );
}


/**
 * The league ranked by the composite rating, one team per row.
 *
 * Column order follows the argument the table is making: where a team ranks, how it got
 * there (rating, movement), what it has actually done (record, scoring), and how it is
 * trending (form, luck). Narrow screens drop the trailing evidence columns first.
 */
export function PowerRankingsTable({ rankings, leagueId, username }: { rankings: PowerRankings; leagueId: string; username?: string }) {
  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-auto w-14 py-2 pl-4">Rank</TableHead>
            <TableHead className="h-auto py-2">Team</TableHead>
            <TableHead className="hidden h-auto w-24 py-2 sm:table-cell">Tier</TableHead>
            <TableHead className="hidden h-auto w-20 py-2 md:table-cell">W–L</TableHead>
            <TableHead className="hidden h-auto w-16 py-2 text-right lg:table-cell">PPG</TableHead>
            <TableHead className="hidden h-auto w-28 py-2 lg:table-cell">Last {rankings.formWeeks}</TableHead>
            {rankings.hasValues ? <TableHead className="hidden h-auto w-20 py-2 text-right xl:table-cell">Value</TableHead> : null}
            <TableHead className="hidden h-auto w-20 py-2 pr-4 text-right xl:table-cell">Luck</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rankings.rows.map((row) => (
            <TableRow className={cn(row.isUser && "bg-primary/[0.06] hover:bg-primary/[0.09]")} key={row.rosterId}>
              <TableCell className="pl-4">
                <div className="flex items-center gap-2">
                  {/* A short colour rail carries the tier without spending a column on it at narrow widths. */}
                  <span aria-hidden="true" className={cn("h-6 w-0.5 rounded-full", TIER[row.tier].rail)} />
                  <span className="font-mono text-sm font-semibold tabular-nums">{row.rank}</span>
                  <Delta delta={row.delta} />
                </div>
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="size-8">
                    {row.avatar ? <AvatarImage alt="" src={avatarUrl(row.avatar)} /> : null}
                    <AvatarFallback className="text-[0.625rem]">{initials(row.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <Link className={cn("block max-w-40 truncate font-medium leading-tight hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-56", row.isUser && "text-primary")} href={withUsername(`/${leagueId}/teams/${row.rosterId}`, username)}>{row.name}</Link>
                    <p className="truncate text-xs leading-tight text-muted-foreground">
                      {row.manager}
                      <span className="font-mono tabular-nums md:hidden"> · {row.wins}–{row.losses}{row.ties ? `–${row.ties}` : ""}</span>
                    </p>
                  </div>
                </div>
              </TableCell>

              <TableCell className="hidden sm:table-cell">
                <Badge className={cn("px-1.5 text-[0.625rem] font-medium", TIER[row.tier].chip)} variant="outline">{TIER[row.tier].label}</Badge>
              </TableCell>

              <TableCell className="hidden font-mono text-xs tabular-nums md:table-cell">
                {row.wins}–{row.losses}{row.ties ? `–${row.ties}` : ""}
              </TableCell>

              <TableCell className="hidden text-right font-mono text-xs tabular-nums lg:table-cell">
                {rankings.started ? row.ppg.toFixed(1) : "—"}
              </TableCell>

              <TableCell className="hidden lg:table-cell">
                <span className="flex items-center gap-2">
                  <FormDots results={row.formResults} />
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{rankings.started ? row.formPpg.toFixed(1) : "—"}</span>
                </span>
              </TableCell>

              {rankings.hasValues ? (
                <TableCell className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground xl:table-cell">
                  {formatValue(row.value)}
                </TableCell>
              ) : null}

              <TableCell className="hidden pr-4 text-right xl:table-cell">
                <Luck row={row} started={rankings.started} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}

/**
 * The gap between where the standings put a team and where it has earned to be. Only a
 * meaningful gap is worth ink — anything inside two places is schedule noise, not a story.
 */
function Luck({ row, started }: { row: PowerRow; started: boolean }) {
  if (!started) return <span className="text-muted-foreground/40">—</span>;
  if (Math.abs(row.luck) < 2) return <span className="text-xs text-muted-foreground/50">Even</span>;

  const lucky = row.luck > 0;
  return (
    <Tooltip>
      <TooltipTrigger className="cursor-default">
        <span className={cn("font-mono text-xs font-medium tabular-nums", lucky ? "text-warning" : "text-series-1")}>
          {lucky ? "+" : ""}{row.luck}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {lucky
          ? `${row.recordRank}${ordinal(row.recordRank)} in the standings on the ${row.rank}${ordinal(row.rank)}-best team. The schedule has been kind.`
          : `${row.rank}${ordinal(row.rank)} by power on a team sitting ${row.recordRank}${ordinal(row.recordRank)}. Better than the record says.`}
      </TooltipContent>
    </Tooltip>
  );
}

function ordinal(rank: number): string {
  const tens = rank % 100;
  if (tens >= 11 && tens <= 13) return "th";
  return ["th", "st", "nd", "rd"][rank % 10] ?? "th";
}
