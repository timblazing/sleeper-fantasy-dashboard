import { ArrowDown, ArrowUp, Flame, Snowflake, Swords, Target, TrendingDown, TrendingUp, Trophy, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RecordBook, ScoreLine } from "@/lib/league-history";
import { cn } from "@/lib/utils";

const num = (value: number, digits = 2) => value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

type Tone = "positive" | "negative" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  positive: "text-[var(--positive)]",
  negative: "text-[var(--negative)]",
  neutral: "text-foreground",
};

/**
 * A featured record — the four the league actually argues about.
 *
 * These get the icon, the large figure and the accent, because a record book where every entry is
 * the same size is just a table with extra borders. The rest live in the compact row below.
 */
function HeroRecord({ icon: Icon, label, value, unit, name, meta, tone }: { icon: LucideIcon; label: string; value: string; unit?: string; name: string; meta: string; tone: Tone }) {
  return (
    <div className="relative flex flex-col gap-2 overflow-hidden rounded-lg border bg-gradient-to-br from-muted/40 to-transparent p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-[0.6875rem] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("font-mono text-3xl font-semibold tabular-nums leading-none", TONE_CLASS[tone])}>{value}</span>
        {unit ? <span className="text-xs font-medium text-muted-foreground">{unit}</span> : null}
      </div>
      <div className="mt-auto flex flex-col gap-0.5">
        <span className="break-words text-sm font-medium sm:truncate">{name}</span>
        <span className="break-words font-mono text-[0.6875rem] tabular-nums text-muted-foreground sm:truncate">{meta}</span>
      </div>
    </div>
  );
}

/** A supporting record: one line, scannable against its neighbours. */
function CompactRecord({ icon: Icon, label, value, name, meta, tone }: { icon: LucideIcon; label: string; value: string; name: string; meta: string; tone: Tone }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="break-words text-xs font-medium sm:truncate">{name}</div>
        <div className="break-words font-mono text-[0.625rem] tabular-nums text-muted-foreground sm:truncate">{meta}</div>
      </div>
      <span className={cn("shrink-0 font-mono text-base font-semibold tabular-nums", TONE_CLASS[tone])}>{value}</span>
    </div>
  );
}

/**
 * The all-time record book.
 *
 * Split into two tiers on purpose: the four headline records carry the visual weight, and the
 * remaining six sit underneath as a scannable list. The old version rendered all ten identically,
 * which meant the 0.72-point nail-biter looked exactly as notable as a routine season total.
 */
export function HistoryRecords({ records }: { records: RecordBook }) {
  const { mostPointsSeason: most, fewestPointsSeason: fewest, bestRecord: best, worstRecord: worst, longestWinStreak: winStreak, longestLossStreak: lossStreak, highestScoringLoss: hiLoss, lowestScoringWin: loWin, biggestBlowout: blowout, closestMatchup: closest } = records;

  const heroes = [
    most && { key: "most", icon: Trophy, label: "Most points, season", value: num(most.points, 0), name: most.name, meta: most.season, tone: "positive" as Tone },
    best && { key: "best", icon: Target, label: "Best record", value: `${best.wins}–${best.losses}`, name: best.name, meta: best.season, tone: "positive" as Tone },
    blowout && { key: "blowout", icon: Zap, label: "Biggest blowout", value: num(blowout.margin), unit: "pts", name: blowout.winnerName, meta: `${blowout.season} · Wk ${blowout.week} · over ${blowout.loserName}`, tone: "neutral" as Tone },
    closest && { key: "closest", icon: Swords, label: "Closest matchup", value: num(closest.margin), unit: "pts", name: closest.winnerName, meta: `${closest.season} · Wk ${closest.week} · over ${closest.loserName}`, tone: "neutral" as Tone },
  ].filter((tile): tile is NonNullable<typeof tile> => Boolean(tile));

  const rest = [
    winStreak && { key: "win", icon: Flame, label: "Longest win streak", value: `${winStreak.length}W`, name: winStreak.name, meta: `${winStreak.season} · Wks ${winStreak.startWeek}–${winStreak.endWeek}`, tone: "positive" as Tone },
    lossStreak && { key: "loss", icon: Snowflake, label: "Longest losing streak", value: `${lossStreak.length}L`, name: lossStreak.name, meta: `${lossStreak.season} · Wks ${lossStreak.startWeek}–${lossStreak.endWeek}`, tone: "negative" as Tone },
    hiLoss && { key: "hiLoss", icon: TrendingDown, label: "Highest scoring loss", value: num(hiLoss.loserScore, 1), name: hiLoss.loserName, meta: `${hiLoss.season} · Wk ${hiLoss.week} · lost to ${hiLoss.winnerName}`, tone: "negative" as Tone },
    loWin && { key: "loWin", icon: TrendingUp, label: "Lowest scoring win", value: num(loWin.winnerScore, 1), name: loWin.winnerName, meta: `${loWin.season} · Wk ${loWin.week} · beat ${loWin.loserName}`, tone: "positive" as Tone },
    fewest && { key: "fewest", icon: ArrowDown, label: "Fewest points, season", value: num(fewest.points, 0), name: fewest.name, meta: fewest.season, tone: "negative" as Tone },
    worst && { key: "worst", icon: ArrowUp, label: "Worst record", value: `${worst.wins}–${worst.losses}`, name: worst.name, meta: worst.season, tone: "negative" as Tone },
  ].filter((tile): tile is NonNullable<typeof tile> => Boolean(tile));

  if (!heroes.length && !rest.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>All-time records</CardTitle>
        <CardDescription>The high-water marks and the low points, across every season on record</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {heroes.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {heroes.map(({ key, ...tile }) => <HeroRecord key={key} {...tile} />)}
          </div>
        ) : null}
        {rest.length ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rest.map(({ key, ...tile }) => <CompactRecord key={key} {...tile} />)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * The ten best or ten worst single-week scores.
 *
 * A bar behind each row encodes the score relative to the leader, so the table shows the *shape*
 * of the gap — whether one week ran away with it or the top ten are all within a possession.
 */
export function HistoryScoreTable({ rows, title, description, tone }: { rows: ScoreLine[]; title: string; description: string; tone: "high" | "low" }) {
  if (!rows.length) return null;

  const points = rows.map((row) => row.points);
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const accent = tone === "high" ? "var(--positive)" : "var(--negative)";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="w-16 text-right">Points</TableHead>
              <TableHead className="w-16 text-right">Season</TableHead>
              <TableHead className="w-14 text-right">Week</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              // The leader fills the row; the tail of the list keeps a visible stub.
              const fill = 12 + ((tone === "high" ? row.points - min : max - row.points) / span) * 88;
              return (
                <TableRow className="relative" key={`${row.ownerId}-${row.season}-${row.week}`}>
                  <TableCell className="text-center font-mono tabular-nums text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="relative max-w-0 truncate pr-2 text-xs font-medium sm:text-sm">
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-1 left-0 -z-10 rounded-sm"
                      style={{ width: `${fill}%`, background: `color-mix(in oklch, ${accent} 12%, transparent)` }}
                    />
                    {row.name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-mono text-xs font-semibold tabular-nums sm:text-sm" style={{ color: accent }}>
                    {num(row.points)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-mono text-[0.6875rem] tabular-nums text-muted-foreground sm:text-xs">{row.season}</TableCell>
                  <TableCell className="whitespace-nowrap text-right font-mono text-[0.6875rem] tabular-nums text-muted-foreground sm:text-xs">{row.week}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
