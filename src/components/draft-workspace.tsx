"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftRightIcon, ChevronRightIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { GradeBadge, ManagerAvatar, PlayerHeadshot, SortHeader, SurplusBar, plain, signed, valueTone } from "@/components/draft-grade-parts";
import { PositionBadge } from "@/components/position-badge";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DraftGradeData, DraftManagerGrade, DraftPickGrade } from "@/lib/draft-grades";
import { cn } from "@/lib/utils";

type BoardPick = DraftGradeData["allPicks"][number];

/** Which leaderboard column is driving the order. */
type ManagerSortKey = "picks" | "hitRate" | "surplus" | "grade";
/** Which column is driving the order inside a manager's pick list. */
type PickSortKey = "pick" | "slotValue" | "value" | "surplus";

type Sort<Key extends string> = { key: Key; direction: "asc" | "desc" };

/** Toggle direction when the same column is clicked again, otherwise start a new column descending. */
function nextSort<Key extends string>(current: Sort<Key>, key: Key): Sort<Key> {
  return current.key === key ? { key, direction: current.direction === "desc" ? "asc" : "desc" } : { key, direction: "desc" };
}

function sortBy<Row>(rows: Row[], direction: "asc" | "desc", value: (row: Row) => number) {
  const sign = direction === "desc" ? -1 : 1;
  return rows.toSorted((a, b) => sign * (value(a) - value(b)));
}

/**
 * Grade → a number, so the letter column sorts the way it reads.
 *
 * Grades are derived from surplus per pick, so ordering by that number reproduces the letter order
 * exactly while keeping ties broken by the real margin rather than alphabetically.
 */
const gradeOrder = (row: { surplusPerPick: number }) => row.surplusPerPick;

/**
 * The leaderboard: one row per manager, sortable, opening a detail panel on click.
 *
 * The detail lives in a dialog rather than an expanded row because it is taller than the ranking it
 * explains — expanding in place pushed the managers being compared off screen.
 */
function ManagerTable({ data, onSelect }: { data: DraftGradeData; onSelect: (rosterId: number) => void }) {
  const [sort, setSort] = React.useState<Sort<ManagerSortKey>>({ key: "surplus", direction: "desc" });
  const scale = Math.max(...data.managers.map((manager) => Math.abs(manager.surplusPerPick)), 1);
  const managers = React.useMemo(() => {
    const value = {
      picks: (manager: DraftManagerGrade) => manager.picks.length,
      hitRate: (manager: DraftManagerGrade) => manager.hitRate,
      surplus: (manager: DraftManagerGrade) => manager.surplus,
      grade: gradeOrder,
    }[sort.key];
    return sortBy(data.managers, sort.direction, value);
  }, [data.managers, sort]);

  const header = (key: ManagerSortKey, label: string) => (
    <SortHeader active={sort.key === key} direction={sort.direction} onClick={() => setSort((current) => nextSort(current, key))}>
      {label}
    </SortHeader>
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        <CardDescription>{data.selectedLabel} · {data.rounds} rounds · graded on value today against the slot used</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table className="max-sm:table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-4 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:pl-5">#</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Manager</TableHead>
              <TableHead className="w-16 text-right">{header("picks", "Picks")}</TableHead>
              <TableHead className="hidden w-20 text-right sm:table-cell">{header("hitRate", "Hit %")}</TableHead>
              <TableHead className="hidden w-28 md:table-cell" />
              <TableHead className="w-24 text-right max-sm:hidden">{header("surplus", "Surplus")}</TableHead>
              <TableHead className="w-16 text-right">{header("grade", "Grade")}</TableHead>
              <TableHead className="w-8 pr-5 max-sm:hidden" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {managers.map((manager, index) => (
              <TableRow className="cursor-pointer" key={manager.rosterId} onClick={() => onSelect(manager.rosterId)}>
                <TableCell className="pl-4 text-muted-foreground tabular-nums sm:pl-5">{index + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <ManagerAvatar avatar={manager.avatar} name={manager.teamName} className="size-8" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium sm:text-sm">{manager.teamName}</p>
                      <p className="truncate text-xs text-muted-foreground">{manager.manager}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{manager.picks.length}</TableCell>
                <TableCell className={cn("hidden text-right tabular-nums sm:table-cell", manager.hitRate >= 50 ? "text-positive" : manager.hitRate > 0 ? "text-amber-600 dark:text-amber-400" : "text-negative")}>{manager.hitRate}%</TableCell>
                <TableCell className="hidden md:table-cell"><SurplusBar surplus={manager.surplusPerPick} scale={scale} /></TableCell>
                <TableCell className={cn("text-right font-medium tabular-nums max-sm:hidden", valueTone(manager.surplus))}>{signed(manager.surplus)}</TableCell>
                <TableCell className="text-right"><GradeBadge grade={manager.grade} /></TableCell>
                <TableCell className="pr-5 max-sm:hidden">
                  <ChevronRightIcon aria-hidden="true" className="size-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardContent className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
        Grades compare each player&apos;s current dynasty value against the expected value of the draft slot where they were selected. Surplus = current value − slot value. Hit rate = % of picks where the player is worth at least the pick used. Select any manager to see their pick-by-pick breakdown.
      </CardContent>
    </Card>
  );
}

/** One drafted player, at the density the detail panel and the trend lists share. */
function PickLine({ pick, scale }: { pick: DraftPickGrade; scale: number }) {
  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 py-2.5 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:gap-3">
      <span className="font-mono text-xs text-muted-foreground tabular-nums">{pick.pick}</span>
      <div className="flex min-w-0 items-center gap-2.5">
        <PlayerHeadshot className="size-8 shrink-0" playerId={pick.playerId} position={pick.position} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <span className="break-words text-xs leading-tight sm:truncate sm:text-sm">{pick.player}</span>
            {pick.acquiredFrom ? (
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex"><ArrowLeftRightIcon aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" /></span>} />
                <TooltipContent>Slot acquired from {pick.acquiredFrom}</TooltipContent>
              </Tooltip>
            ) : null}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <PositionBadge position={pick.position} />
            <span className="break-words text-[0.625rem] leading-tight tabular-nums sm:truncate sm:text-xs">{pick.team ?? "FA"} · slot {plain(pick.slotValue)} → now {plain(pick.value)}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden w-20 sm:block"><SurplusBar surplus={pick.surplus} scale={scale} /></div>
        <span className={cn("w-16 text-right text-sm font-medium tabular-nums", valueTone(pick.surplus))}>{signed(pick.surplus)}</span>
        <GradeBadge className="w-9 justify-center" grade={pick.grade} />
      </div>
    </div>
  );
}

/** A headline number in the detail panel's summary row. */
function StatTile({ label, value, tone, detail }: { label: string; value: string; tone?: string; detail?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate text-lg font-semibold tabular-nums", tone)}>{value}</p>
      {detail ? <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">{detail}</p> : null}
    </div>
  );
}

/**
 * A manager's full draft, shown in the dialog/drawer the leaderboard opens.
 *
 * Four tiles carry the verdict — how often they hit, the per-pick margin that produced the grade,
 * and the two picks that swung it — so the answer is readable before scrolling into the pick list.
 */
function ManagerDetail({ manager, data }: { manager: DraftManagerGrade; data: DraftGradeData }) {
  const [sort, setSort] = React.useState<Sort<PickSortKey>>({ key: "surplus", direction: "desc" });
  const scale = Math.max(...data.allPicks.map((pick) => Math.abs(pick.surplus)), 1);
  const acquired = manager.picks.filter((pick) => pick.acquiredFrom).length;
  const picks = React.useMemo(() => {
    const value = {
      pick: (pick: DraftPickGrade) => -pick.pickNo,
      slotValue: (pick: DraftPickGrade) => pick.slotValue,
      value: (pick: DraftPickGrade) => pick.value,
      surplus: (pick: DraftPickGrade) => pick.surplus,
    }[sort.key];
    return sortBy(manager.picks, sort.direction, value);
  }, [manager.picks, sort]);
  const hits = Math.round((manager.hitRate / 100) * manager.picks.length);

  return (
    <div className="flex flex-col gap-4 pb-1">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Hit rate" value={`${manager.hitRate}%`} tone={manager.hitRate >= 50 ? "text-positive" : undefined} detail={`${hits} hits / ${manager.picks.length - hits} misses`} />
        <StatTile label="Avg surplus / pick" value={signed(manager.surplusPerPick)} tone={valueTone(manager.surplusPerPick)} detail={`${signed(manager.surplus)} total`} />
        {manager.best ? <StatTile label="Best pick" value={manager.best.player} tone="text-positive" detail={`${manager.best.pick} · ${signed(manager.best.surplus)}`} /> : null}
        {manager.worst ? <StatTile label="Worst pick" value={manager.worst.player} tone="text-negative" detail={`${manager.worst.pick} · ${signed(manager.worst.surplus)}`} /> : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Spent {plain(manager.spent)} of slot value on {manager.picks.length} {manager.picks.length === 1 ? "pick" : "picks"} and holds {plain(manager.earned)} today
        {acquired ? ` · ${acquired} ${acquired === 1 ? "slot" : "slots"} acquired by trade` : ""}.
      </p>

      <div>
        <div className="flex items-center justify-between gap-3 border-b pb-1.5">
          <SortHeader active={sort.key === "pick"} align="left" direction={sort.direction} onClick={() => setSort((current) => nextSort(current, "pick"))}>Slot</SortHeader>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden w-16 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:inline">Slot val</span>
            <span className="hidden w-16 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:inline">Cur val</span>
            <div className="w-24">
              <SortHeader active={sort.key === "surplus"} direction={sort.direction} onClick={() => setSort((current) => nextSort(current, "surplus"))}>Surplus</SortHeader>
            </div>
          </div>
        </div>
        <div className="divide-y">
          {picks.map((pick) => <PickLine key={pick.id} pick={pick} scale={scale} />)}
        </div>
      </div>
    </div>
  );
}

/** Where the value actually was in this class — the answer to "should I have taken a TE?". */
function PositionBreakdown({ data }: { data: DraftGradeData }) {
  const scale = Math.max(...data.byPosition.map((row) => Math.abs(row.surplusPerPick)), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where the value was</CardTitle>
        <CardDescription>Surplus per pick by position across the whole class</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {data.byPosition.map((row) => (
          <div className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center gap-3" key={row.position}>
            <PositionBadge position={row.position} />
            <SurplusBar surplus={row.surplusPerPick} scale={scale} />
            <div className="text-right">
              <span className={cn("text-sm font-medium tabular-nums", valueTone(row.surplusPerPick))}>{signed(row.surplusPerPick)}</span>
              <span className="ml-1 text-xs text-muted-foreground tabular-nums">·{row.picks}</span>
            </div>
          </div>
        ))}
        {data.byRound.length > 1 ? (
          <div className="mt-1 border-t pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">By round</p>
            <div className="flex flex-col gap-2">
              {data.byRound.map((row) => (
                <div className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center gap-3" key={row.round}>
                  <span className="text-xs text-muted-foreground">Rd {row.round}</span>
                  <SurplusBar surplus={row.surplusPerPick} scale={Math.max(...data.byRound.map((entry) => Math.abs(entry.surplusPerPick)), 1)} />
                  <span className={cn("text-right text-sm font-medium tabular-nums", valueTone(row.surplusPerPick))}>{signed(row.surplusPerPick)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StealsAndReaches({ data, onSelect }: { data: DraftGradeData; onSelect: (rosterId: number) => void }) {
  const scale = Math.max(...data.allPicks.map((pick) => Math.abs(pick.surplus)), 1);
  const columns = [
    { key: "steals", title: "Steals", icon: TrendingUpIcon, tone: "text-positive", rows: data.steals },
    { key: "reaches", title: "Reaches", icon: TrendingDownIcon, tone: "text-negative", rows: data.reaches },
  ] as const;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {columns.map((column) => (
        <Card key={column.key}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <column.icon aria-hidden="true" className={cn("size-4", column.tone)} />
              {column.title}
            </CardTitle>
            <CardDescription>{column.key === "steals" ? "Picks that most outperformed their slot" : "Picks that fell furthest short of their slot"}</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {column.rows.map((pick) => (
              <button className="block w-full text-left" key={pick.id} onClick={() => onSelect(pick.rosterId)} type="button">
                <PickLine pick={pick} scale={scale} />
                <p className="-mt-1.5 truncate pb-2 pl-[3.5rem] text-xs text-muted-foreground">{pick.manager}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Every pick in the class as one sortable table, in pick order by default.
 *
 * A table rather than the round-by-round card grid it replaced: laid out in columns, "picked by",
 * slot value and current value line up down the page, so the board can be read as a ranking of the
 * class and not only as a replay of draft night.
 */
function DraftBoard({ data, onSelect }: { data: DraftGradeData; onSelect: (rosterId: number) => void }) {
  const [sort, setSort] = React.useState<Sort<PickSortKey>>({ key: "pick", direction: "desc" });
  const scale = Math.max(...data.allPicks.map((pick) => Math.abs(pick.surplus)), 1);
  const picks = React.useMemo(() => {
    const value = {
      pick: (pick: BoardPick) => -pick.pickNo,
      slotValue: (pick: BoardPick) => pick.slotValue,
      value: (pick: BoardPick) => pick.value,
      surplus: (pick: BoardPick) => pick.surplus,
    }[sort.key];
    return sortBy(data.allPicks, sort.direction, value);
  }, [data.allPicks, sort]);

  const header = (key: PickSortKey, label: string, align: "left" | "right" = "right") => (
    <SortHeader active={sort.key === key} align={align} direction={sort.direction} onClick={() => setSort((current) => nextSort(current, key))}>
      {label}
    </SortHeader>
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Draft results</CardTitle>
        <CardDescription>All {data.allPicks.length} picks in {data.selectedLabel}, graded against the slot each used</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table className="max-sm:table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 pl-5">{header("pick", "Slot", "left")}</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Player</TableHead>
              <TableHead className="hidden text-xs font-medium uppercase tracking-wider text-muted-foreground md:table-cell">Picked by</TableHead>
              <TableHead className="hidden w-24 text-right sm:table-cell">{header("slotValue", "Slot val")}</TableHead>
              <TableHead className="hidden w-24 text-right sm:table-cell">{header("value", "Cur val")}</TableHead>
              <TableHead className="w-28 text-right max-sm:hidden">{header("surplus", "Surplus")}</TableHead>
              <TableHead className="w-20 pr-5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Grade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {picks.map((pick) => (
              <TableRow className="cursor-pointer" key={pick.id} onClick={() => onSelect(pick.rosterId)}>
                <TableCell className="pl-5 font-mono text-xs text-muted-foreground tabular-nums">{pick.pick}</TableCell>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <PlayerHeadshot className="size-8 shrink-0" playerId={pick.playerId} position={pick.position} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{pick.player}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <PositionBadge position={pick.position} />
                        <span className="truncate">{pick.team ?? "FA"}</span>
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden max-w-40 md:table-cell">
                  <span className="flex min-w-0 items-center gap-1 truncate text-sm text-primary">
                    <span className="truncate">{pick.manager}</span>
                    {pick.acquiredFrom ? (
                      <Tooltip>
                        <TooltipTrigger render={<span className="inline-flex"><ArrowLeftRightIcon aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" /></span>} />
                        <TooltipContent>Slot acquired from {pick.acquiredFrom}</TooltipContent>
                      </Tooltip>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">{plain(pick.slotValue)}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{plain(pick.value)}</TableCell>
                <TableCell className="text-right max-sm:hidden">
                  <span className={cn("text-sm font-medium tabular-nums", valueTone(pick.surplus))}>{signed(pick.surplus)}</span>
                  <div className="mt-1"><SurplusBar surplus={pick.surplus} scale={scale} /></div>
                </TableCell>
                <TableCell className="pr-5 text-right"><GradeBadge grade={pick.grade} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * Draft record across every completed draft, which a single-class leaderboard cannot show.
 *
 * One good class is noise; the career table is where a manager who drafts well every year separates
 * from one who hit once. Per-season grades ride along so a trend is visible without a chart.
 */
function CareerTable({ data }: { data: DraftGradeData }) {
  const seasons = [...new Set(data.classes.map((entry) => entry.season))].toSorted((a, b) => Number(a) - Number(b));
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Career draft record</CardTitle>
        <CardDescription>Every completed draft in this league, {seasons.at(0)}–{seasons.at(-1)}</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table className="max-sm:table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Manager</TableHead>
                <TableHead className="text-right max-sm:hidden">Drafts</TableHead>
                <TableHead className="w-14 text-right">Picks</TableHead>
                <TableHead className="text-right max-sm:hidden">Hit</TableHead>
                {seasons.map((season) => <TableHead className="text-center max-sm:hidden" key={season}>{season}</TableHead>)}
                <TableHead className="text-right max-sm:hidden">Per pick</TableHead>
                <TableHead className="w-16 pr-4 text-right sm:pr-5">Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.career.map((row) => (
                <TableRow key={row.rosterId}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-3">
                      <ManagerAvatar avatar={row.avatar} name={row.teamName} className="size-7" />
                      <span className="truncate font-medium">{row.teamName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums max-sm:hidden">{row.drafts}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.picks}</TableCell>
                  <TableCell className="text-right tabular-nums max-sm:hidden">{row.hitRate}%</TableCell>
                  {seasons.map((season) => {
                    const entry = row.bySeason.find((item) => item.season === season);
                    return (
                      <TableCell className="text-center max-sm:hidden" key={season}>
                        {entry ? <GradeBadge grade={entry.grade} /> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    );
                  })}
                  <TableCell className={cn("text-right font-medium tabular-nums max-sm:hidden", valueTone(row.surplusPerPick))}>{signed(row.surplusPerPick)}</TableCell>
                  <TableCell className="pr-4 text-right sm:pr-5"><GradeBadge grade={row.grade} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function DraftWorkspace({ data, basePath }: { data: DraftGradeData; basePath: string }) {
  const [view, setView] = React.useState("grades");
  const [selectedRosterId, setSelectedRosterId] = React.useState<number | null>(null);
  const selected = data.managers.find((manager) => manager.rosterId === selectedRosterId) ?? null;

  // Opening a manager from the board or the trend lists shows the same panel without leaving the tab.
  const select = React.useCallback((rosterId: number) => setSelectedRosterId(rosterId), []);
  const close = React.useCallback((open: boolean) => {
    if (!open) setSelectedRosterId(null);
  }, []);

  if (!data.managers.length) {
    return (
      <Card>
        <CardContent>
          <Empty className="min-h-80">
            <EmptyHeader>
              <EmptyTitle>No completed draft found</EmptyTitle>
              <EmptyDescription>Once this league completes a Sleeper draft, its grades and board will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {!data.curveBacked ? (
        <Card className="border-amber-500/40 bg-amber-500/5 py-3">
          <CardContent className="px-4 text-xs text-muted-foreground">
            RosterAudit&apos;s slot values are unavailable, so picks are benchmarked against the rest of their own class instead. Grades will shift once the curve returns.
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={view} onValueChange={setView} className="gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList aria-label="Draft views">
            <TabsTrigger value="grades">Leaderboard</TabsTrigger>
            <TabsTrigger value="board">Draft results</TabsTrigger>
            <TabsTrigger value="trends">Class trends</TabsTrigger>
            {data.career.length ? <TabsTrigger value="career">Career</TabsTrigger> : null}
          </TabsList>
          {/* Season is URL state, matching the rankings filters: a graded class stays shareable. */}
          {data.drafts.length > 1 ? (
            <ButtonGroup aria-label="Draft season">
              {data.drafts.map((draft) => (
                <Button
                  key={draft.id}
                  render={<Link href={`${basePath}?draft=${draft.id}`} scroll={false} />}
                  size="sm"
                  variant={draft.id === data.selectedDraftId ? "default" : "outline"}
                >
                  {draft.season}
                </Button>
              ))}
            </ButtonGroup>
          ) : null}
        </div>

        <TabsContent value="grades">
          <ManagerTable data={data} onSelect={select} />
        </TabsContent>

        <TabsContent value="board"><DraftBoard data={data} onSelect={select} /></TabsContent>

        <TabsContent value="trends" className="flex flex-col gap-6">
          <StealsAndReaches data={data} onSelect={select} />
          <PositionBreakdown data={data} />
        </TabsContent>

        {data.career.length ? <TabsContent value="career"><CareerTable data={data} /></TabsContent> : null}
      </Tabs>

      <ResponsiveDialog
        description={selected ? `${selected.manager} · ${data.selectedLabel} · ${selected.picks.length} ${selected.picks.length === 1 ? "pick" : "picks"}` : undefined}
        onOpenChange={close}
        open={selected !== null}
        title={
          selected ? (
            <span className="flex items-center gap-2.5">
              <ManagerAvatar avatar={selected.avatar} name={selected.teamName} className="size-7" />
              <span className="truncate">{selected.teamName}</span>
              <GradeBadge grade={selected.grade} />
            </span>
          ) : ""
        }
      >
        {selected ? <ManagerDetail data={data} manager={selected} /> : null}
      </ResponsiveDialog>
    </div>
  );
}
