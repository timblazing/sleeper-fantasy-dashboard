import Link from "next/link";
import { SearchX, TrendingDown, TrendingUp } from "lucide-react";
import { PositionBadge } from "@/components/position-badge";
import { RankingsPagination } from "@/components/rankings-toolbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RankingsRow, RankingsView } from "@/lib/rankings-data";
import { describeRankingsFilters, rankingsHref, type RankingsQuery } from "@/lib/rankings-query";
import { withUsername } from "@/lib/utils";

const initials = (name: string) => name.split(/\s|&/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

function Trend({ value }: { value: number }) {
  if (!value) return null; // A zero trend is not a trend — render nothing rather than a 0.
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return <span className={`inline-flex items-center gap-1 font-mono text-xs ${value > 0 ? "text-positive" : "text-destructive"}`}><Icon aria-hidden="true" className="size-3" />{value > 0 ? "+" : ""}{value.toLocaleString()}</span>;
}

function RankingsRowCells({ row, leagueId, username, maxValue }: { row: RankingsRow; leagueId: string; username?: string; maxValue: number }) {
  const share = maxValue > 0 ? Math.max(2, Math.round((row.value / maxValue) * 100)) : 0;
  const mine = row.kind === "player" && row.owner?.isMine;

  return (
    <TableRow className={mine ? "border-l-2 border-l-primary bg-muted/40" : undefined}>
      <TableCell className="pl-4 font-mono font-medium text-muted-foreground">{row.rank}</TableCell>
      <TableCell>
        {row.kind === "pick" ? (
          <div className="flex items-center gap-3"><Avatar><AvatarFallback>PK</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate font-medium">{row.label}</p><p className="text-xs text-muted-foreground">Draft pick</p></div></div>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar>{row.photoUrl ? <AvatarImage alt="" src={row.photoUrl} /> : null}<AvatarFallback>{initials(row.name)}</AvatarFallback></Avatar>
            <div className="min-w-0">
              <Link className="max-w-56 truncate font-medium hover:underline" href={withUsername(`/${leagueId}/players/${row.sleeperId}`, username)}>{row.name}</Link>
              <p className="truncate text-[0.6875rem] text-muted-foreground sm:text-xs">{row.team ?? "FA"}{row.owner ? ` · ${row.owner.teamName}` : ""}</p>
            </div>
            {mine ? <Badge className="max-sm:hidden" variant="secondary">MY TEAM</Badge> : null}
          </div>
        )}
      </TableCell>
      <TableCell className="max-sm:hidden">
        {row.kind === "pick" ? <Badge size="position" variant="outline">PICK</Badge> : <PositionBadge label={row.position} position={row.position} />}
      </TableCell>
      <TableCell>
        <div className="flex min-w-20 flex-col gap-1 sm:min-w-28"><span className="font-mono font-medium tabular-nums">{row.value.toLocaleString()}</span><Progress className="w-full max-sm:hidden" value={share} /></div>
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">{row.kind === "pick" ? "—" : row.age !== null ? row.age.toFixed(1) : "—"}</TableCell>
      <TableCell className="hidden pr-4 lg:table-cell">{row.kind === "pick" ? <span className="text-muted-foreground">—</span> : <Trend value={row.trend7d} />}</TableCell>
    </TableRow>
  );
}

export function RankingsTable({ view, query }: { view: RankingsView; query: RankingsQuery }) {
  if (!view.rows.length) {
    const active = describeRankingsFilters(query);
    return (
      <Card><CardContent>
        <Empty className="min-h-72 border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
            <EmptyTitle>No players match these filters</EmptyTitle>
            <EmptyDescription>{active ? `Nothing matched ${active}.` : "Nothing matched the current view."} Clear the filters to see the full board.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={rankingsHref(view.leagueId, { position: "all", search: "", sort: "value", page: 1, username: query.username })}>Clear filters</Link>
          </EmptyContent>
        </Empty>
      </CardContent></Card>
    );
  }

  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-0">
        <Table className="max-sm:table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 pl-4"><span className="sm:hidden">#</span><span className="max-sm:hidden">Rank</span></TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="max-sm:hidden">Position</TableHead>
              <TableHead className="w-24">Value</TableHead>
              <TableHead className="hidden md:table-cell">Age</TableHead>
              <TableHead className="hidden pr-4 lg:table-cell">7d</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.rows.map((row) => <RankingsRowCells key={row.key} leagueId={view.leagueId} maxValue={view.maxValue} row={row} username={query.username} />)}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        <RankingsPagination leagueId={view.leagueId} page={view.page} query={query} totalLabel={view.totalLabel} totalPages={view.totalPages} />
      </CardFooter>
    </Card>
  );
}
