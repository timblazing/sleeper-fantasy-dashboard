import Link from "next/link";
import { ChevronDown, Swords } from "lucide-react";
import { MatchupBoard } from "@/components/matchup-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getMatchupBoard } from "@/lib/matchup-detail";
import { withUsername } from "@/lib/utils";

const WEEKS = Array.from({ length: 18 }, (_, index) => index + 1);

export default async function MatchupsPage({ params, searchParams }: { params: Promise<{ leagueId: string; week: string }>; searchParams: Promise<{ username?: string | string[] }> }) {
  const [{ leagueId, week }, query] = await Promise.all([params, searchParams]);
  const username = typeof query.username === "string" ? query.username : undefined;
  const requestedWeek = Math.min(18, Math.max(1, Number.parseInt(week, 10) || 1));
  const board = await getMatchupBoard(leagueId, requestedWeek).catch(() => null);

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
            Wk. {requestedWeek}<ChevronDown data-icon="inline-end" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup className="grid grid-cols-6 gap-1">
              {WEEKS.map((value) => (
                <DropdownMenuItem className="justify-center p-1.5" key={value} render={<Link href={withUsername(`/${leagueId}/matchups/${value}`, username)} />}>
                  <span className={value === requestedWeek ? "font-semibold text-primary" : undefined}>{value}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {board?.matchups.length ? (
        <MatchupBoard leagueId={leagueId} matchups={board.matchups} username={username} week={requestedWeek} />
      ) : (
        <Card><CardContent><Empty className="min-h-64"><EmptyHeader><EmptyMedia variant="icon"><Swords /></EmptyMedia><EmptyTitle>No matchup data</EmptyTitle><EmptyDescription>Sleeper has no matchups scheduled for week {requestedWeek}.</EmptyDescription></EmptyHeader></Empty></CardContent></Card>
      )}
      {board?.byes.length ? (
        <Card><CardHeader><CardTitle>On bye</CardTitle><CardDescription>Teams without an opponent this week</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{board.byes.map((team) => <Badge key={team.rosterId} variant="outline">{team.name}</Badge>)}</CardContent></Card>
      ) : null}
    </div>
  );
}
