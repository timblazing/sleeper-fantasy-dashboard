import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, withUsername } from "@/lib/utils";
import type { LeagueDivision, StandingRow } from "@/lib/types";

export const initials = (name: string) => name.split(/\s|&/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
export const avatarUrl = (id: string) => `https://sleepercdn.com/avatars/thumbs/${id}`;
export const record = (team: StandingRow) => `${team.wins}–${team.losses}${team.ties ? `–${team.ties}` : ""}`;

export function TeamCell({ team, leagueId, username }: { team: StandingRow; leagueId?: string; username?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 @md:gap-3">
      <Avatar className="size-8 @md:size-9">
        {team.avatar ? <AvatarImage alt="" src={avatarUrl(team.avatar)} /> : null}
        <AvatarFallback>{initials(team.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        {leagueId ? (
          <Link className="block truncate text-xs font-medium hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring @md:text-sm" href={withUsername(`/${leagueId}/teams/${team.rosterId}`, username)}>{team.name}</Link>
        ) : (
          <p className="truncate text-xs font-medium @md:text-sm">{team.name}</p>
        )}
        <p className="hidden truncate text-xs text-muted-foreground @md:block">{team.manager}</p>
      </div>
    </div>
  );
}

export function StandingsTable({ rows, myRosterId, leagueId, username }: { rows: StandingRow[]; myRosterId?: number; leagueId?: string; username?: string }) {
  return (
    <div className="@container">
      <Table className="table-fixed @md:table-auto">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 pl-4"><span className="@md:hidden">#</span><span className="hidden @md:inline">Rank</span></TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="w-16 pr-2 text-right @2xl:pr-4 @2xl:text-left">W–L</TableHead>
            <TableHead className="hidden pr-4 text-right @2xl:table-cell @3xl:pr-0">PF</TableHead>
            <TableHead className="hidden pr-4 text-right @3xl:table-cell">PA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((team, index) => (
            <TableRow className={cn(team.rosterId === myRosterId && "bg-muted/50")} key={team.rosterId}>
              <TableCell className="pl-4 font-mono font-medium">{index + 1}</TableCell>
              <TableCell><TeamCell leagueId={leagueId} team={team} username={username} /></TableCell>
              <TableCell className="pr-2 text-right font-mono tabular-nums @2xl:pr-4 @2xl:text-left">{record(team)}</TableCell>
              <TableCell className="hidden pr-4 text-right font-mono tabular-nums @2xl:table-cell @3xl:pr-0">{team.pointsFor.toFixed(1)}</TableCell>
              <TableCell className="hidden pr-4 text-right font-mono tabular-nums text-muted-foreground @3xl:table-cell">{team.pointsAgainst.toFixed(1)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function DivisionStandings({ division, rows, myRosterId, leagueId, username }: { division: LeagueDivision; rows: StandingRow[]; myRosterId?: number; leagueId?: string; username?: string }) {
  const divisionRows = rows.filter((team) => team.division === division.id);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{division.name}</CardTitle>
        <CardDescription>{divisionRows.length} teams</CardDescription>
        {divisionRows.some((team) => team.rosterId === myRosterId) ? <CardAction><Badge variant="secondary">Your division</Badge></CardAction> : null}
      </CardHeader>
      <CardContent className="px-0">
        <StandingsTable leagueId={leagueId} myRosterId={myRosterId} rows={divisionRows} username={username} />
      </CardContent>
    </Card>
  );
}
