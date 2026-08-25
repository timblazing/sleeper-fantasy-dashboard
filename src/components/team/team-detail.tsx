"use client";

import Link from "next/link";
import { PositionBadge } from "@/components/position-badge";
import { avatarUrl, initials } from "@/components/standings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatValue, headshotUrl } from "@/lib/display";
import type { LeagueTeam, ValuedPlayer } from "@/lib/league-values";
import { cn, withUsername } from "@/lib/utils";

type TeamDetailProps = {
  team: LeagueTeam;
  leagueId: string;
  leagueName: string;
  season: string;
  teams: number;
  valuesReady: boolean;
  username?: string;
};

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-card px-3 py-3 text-center">
      <dt className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-semibold tabular-nums sm:text-base">{value}</dd>
      <p className="mt-0.5 hidden text-[0.65rem] text-muted-foreground sm:block">{detail}</p>
    </div>
  );
}

function TeamHero({ team, leagueName, season, teams, valuesReady }: Pick<TeamDetailProps, "team" | "leagueName" | "season" | "teams" | "valuesReady">) {
  return (
    <Card>
      <CardContent className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="size-20 shrink-0 sm:size-24">
            {team.avatar ? <AvatarImage alt="" src={avatarUrl(team.avatar)} /> : null}
            <AvatarFallback className="text-2xl font-bold tracking-tight">{initials(team.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{team.name}</h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">@{team.manager}</p>
            <p className="mt-1 text-sm text-muted-foreground">{leagueName} · {season}</p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border md:min-w-96">
          <Metric detail={`${team.pointsFor.toFixed(1)} points for`} label="Record" value={`${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ""}`} />
          <Metric detail={valuesReady ? formatValue(team.value) : "Values unavailable"} label="Roster value" value={valuesReady ? `#${team.valueRank} / ${teams}` : "—"} />
          <Metric detail={`${team.pointsFor.toFixed(1)} points for`} label="Scoring" value={`#${team.powerRank} / ${teams}`} />
        </dl>
      </CardContent>
    </Card>
  );
}

function PositionRooms({ team, teams, valuesReady }: Pick<TeamDetailProps, "team" | "teams" | "valuesReady">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Position rooms</CardTitle>
        <CardDescription>How each group stacks up against the rest of the league.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {team.rooms.map((room) => {
          const strength = teams > 1 ? Math.round(((teams - room.rank) / (teams - 1)) * 100) : 100;
          return (
            <div className="rounded-lg border p-4" key={room.position}>
              <div className="flex items-center justify-between gap-3">
                <PositionBadge position={room.position} />
                <span className="font-mono text-sm font-semibold">#{room.rank} / {teams}</span>
              </div>
              <p className="mt-4 font-mono text-xl font-semibold tabular-nums">{valuesReady ? formatValue(room.value) : "—"}</p>
              <Progress className="mt-2" value={Math.max(4, strength)} />
              <p className="mt-2 text-xs text-muted-foreground">{room.players} {room.players === 1 ? "player" : "players"} · {room.avgAge === null ? "Age unavailable" : `${room.avgAge.toFixed(1)} avg age`}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function rosterGroup(team: LeagueTeam, entry: ValuedPlayer): "Starters" | "Bench" | "Taxi squad" | "Injured reserve" {
  const id = entry.player.id;
  if (team.starters.includes(id)) return "Starters";
  if (team.taxi.includes(id)) return "Taxi squad";
  if (team.reserve.includes(id)) return "Injured reserve";
  return "Bench";
}

function RosterTable({ entries, leagueId, username, valuesReady }: { entries: ValuedPlayer[]; leagueId: string; username?: string; valuesReady: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Player</TableHead>
          <TableHead className="hidden w-24 sm:table-cell">Position</TableHead>
          <TableHead className="w-24 text-right">Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.player.id}>
            <TableCell>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="bg-muted">
                  <AvatarImage alt="" src={headshotUrl(entry.player)} />
                  <AvatarFallback className="text-[0.65rem]">{entry.player.position ?? "—"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <Link className="block truncate font-medium hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={withUsername(`/${leagueId}/players/${entry.player.id}`, username)}>{entry.player.name}</Link>
                  <p className="truncate text-xs text-muted-foreground">{entry.player.team ?? "FA"}{entry.rankPosition ? ` · ${entry.player.position}${entry.rankPosition}` : ""}</p>
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden sm:table-cell"><PositionBadge position={entry.player.position} /></TableCell>
            <TableCell className={cn("pr-4 text-right font-mono font-medium tabular-nums", !valuesReady && "text-muted-foreground")}>{valuesReady ? formatValue(entry.value) : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TeamRoster({ team, leagueId, username, valuesReady }: Pick<TeamDetailProps, "team" | "leagueId" | "username" | "valuesReady">) {
  const groups = ["Starters", "Bench", "Taxi squad", "Injured reserve"] as const;
  if (!team.roster.length) return <Empty className="min-h-64 border"><EmptyHeader><EmptyTitle>Roster unavailable</EmptyTitle><EmptyDescription>Sleeper did not return any players for this team.</EmptyDescription></EmptyHeader></Empty>;

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const entries = team.roster.filter((entry) => rosterGroup(team, entry) === group);
        if (!entries.length) return null;
        return (
          <Card className="gap-0 py-0" key={group}>
            <CardHeader className="border-b py-4">
              <div className="flex items-center gap-2"><CardTitle>{group}</CardTitle><Badge variant="secondary">{entries.length}</Badge></div>
            </CardHeader>
            <CardContent className="px-0"><RosterTable entries={entries} leagueId={leagueId} username={username} valuesReady={valuesReady} /></CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function TeamDetail(props: TeamDetailProps) {
  return (
    <div className="flex flex-col gap-4">
      <TeamHero {...props} />
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="roster">Roster</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><PositionRooms team={props.team} teams={props.teams} valuesReady={props.valuesReady} /></TabsContent>
        <TabsContent value="roster"><TeamRoster leagueId={props.leagueId} team={props.team} username={props.username} valuesReady={props.valuesReady} /></TabsContent>
      </Tabs>
    </div>
  );
}
