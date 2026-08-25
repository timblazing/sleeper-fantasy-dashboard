import Link from "next/link";
import { SearchX } from "lucide-react";
import { PositionBadge } from "@/components/position-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { describeGame, headshotUrl } from "@/lib/display";
import { clearedInjuryQuery, injuriesHref, SEVERITY_LABELS, type InjuryQuery, type Severity } from "@/lib/injury-query";
import { practiceLabel, type InjuryEntry, type InjuryReport } from "@/lib/injury-report";
import { cn, withUsername } from "@/lib/utils";

const SEVERITY_BADGE: Record<Severity, "red" | "secondary" | "outline"> = { out: "red", risk: "secondary", watch: "outline" };

function InjuryRow({ entry, leagueId, username }: { entry: InjuryEntry; leagueId: string; username?: string }) {
  const practice = practiceLabel(entry.player.practiceParticipation);
  const game = describeGame(entry.game);
  // A "Did Not Participate" is the strongest practice signal there is; colouring it keeps the
  // reader from having to read three words to find the one that matters.
  const practiceTone = practice?.toLowerCase().startsWith("did not") ? "text-destructive"
    : practice?.toLowerCase().startsWith("limited") ? "text-warning"
    : undefined;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="bg-muted">
            <AvatarImage alt="" src={headshotUrl(entry.player)} />
            <AvatarFallback className="text-[0.65rem]">{entry.player.position ?? "—"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Link className="block max-w-56 truncate font-medium hover:underline" href={withUsername(`/${leagueId}/players/${entry.player.id}`, username)}>
              {entry.player.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {[entry.player.team ?? "FA", game || null].filter(Boolean).join(" · ")}
            </p>
            <p className="break-words text-xs leading-tight text-muted-foreground sm:hidden">
              {[entry.player.injuryBodyPart ?? "Injury not reported", entry.fantasyTeam].join(" · ")}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="max-sm:hidden"><PositionBadge position={entry.player.position} /></TableCell>
      <TableCell className="max-sm:pr-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={SEVERITY_BADGE[entry.severity]}>{entry.player.injuryStatus ?? SEVERITY_LABELS[entry.severity]}</Badge>
          {entry.onInjuredReserve ? <Badge variant="outline">IR slot</Badge> : null}
          {entry.onTaxi ? <Badge variant="outline">Taxi</Badge> : null}
        </div>
      </TableCell>
      <TableCell className={cn("max-sm:hidden", !entry.player.injuryBodyPart && "text-muted-foreground/60")}>{entry.player.injuryBodyPart ?? "Not reported"}</TableCell>
      <TableCell className={cn("hidden md:table-cell", practiceTone ?? (!practice && "text-muted-foreground/60"))}>{practice ?? "Not reported"}</TableCell>
      <TableCell className="max-sm:hidden">
        <div className="flex items-center gap-1.5">
          <span className="truncate">{entry.fantasyTeam}</span>
          {entry.isStarter ? <Badge variant="secondary">Starting</Badge> : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function InjuryReportTable({ entries, leagueId, query, report }: { entries: InjuryEntry[]; leagueId: string; query: InjuryQuery; report: InjuryReport }) {
  if (!entries.length) {
    return (
      <Card><CardContent>
        <Empty className="min-h-72 border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
            <EmptyTitle>No injuries match these filters</EmptyTitle>
            <EmptyDescription>Nothing in this league matches the current view. Clear the filters to see all {report.entries.length} designations.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={injuriesHref(leagueId, clearedInjuryQuery(query))}>Clear filters</Link>
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
              <TableHead>Player</TableHead>
              <TableHead className="max-sm:hidden">Pos</TableHead>
              <TableHead className="w-28 max-sm:pr-4">Status</TableHead>
              <TableHead className="max-sm:hidden">Injury</TableHead>
              <TableHead className="hidden md:table-cell">Practice</TableHead>
              <TableHead className="max-sm:hidden">Fantasy team</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => <InjuryRow entry={entry} key={entry.player.id} leagueId={leagueId} username={query.username} />)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
