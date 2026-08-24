"use client";

import { useState } from "react";
import { TrophyIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BracketGame, BracketSeat, PlayoffBracket } from "@/lib/playoff-bracket";
import { cn } from "@/lib/utils";

type BracketSide = "winners" | "losers";

const avatarUrl = (id: string) => `https://sleepercdn.com/avatars/thumbs/${id}`;
const initials = (name: string) => name.split(/\s|&/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

/** One team's line inside a game box. */
function Seat({ myRosterId, seat }: { myRosterId?: number; seat: BracketSeat }) {
  const empty = seat.rosterId === null;
  // Only dim a loser once the game is actually decided — an undecided seat is not "losing".
  const lost = seat.won === false;
  const isUser = seat.rosterId !== null && seat.rosterId === myRosterId;

  return (
    <div className={cn("flex items-center gap-2 px-2.5 py-1.5", lost && "opacity-45")}>
      {empty ? (
        <span className="size-5 shrink-0 rounded-full border border-dashed border-muted-foreground/30" />
      ) : (
        <Avatar className="size-5 shrink-0">
          {seat.avatar ? <AvatarImage alt="" src={avatarUrl(seat.avatar)} /> : null}
          <AvatarFallback className="text-[0.5rem]">{initials(seat.name)}</AvatarFallback>
        </Avatar>
      )}

      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[0.8125rem] leading-tight", empty ? "text-muted-foreground" : isUser ? "font-semibold text-primary" : seat.won ? "font-medium" : "font-normal")}>
          {empty ? seat.from ?? "TBD" : seat.name}
        </span>
        {!empty && seat.manager ? <span className="block truncate text-[0.625rem] leading-tight text-muted-foreground">{seat.manager}</span> : null}
      </span>

      {seat.seed !== null ? (
        <span className="shrink-0 font-mono text-[0.625rem] tabular-nums text-muted-foreground">#{seat.seed}</span>
      ) : null}
      {seat.won ? <TrophyIcon aria-label="Winner" className="size-3 shrink-0 text-primary" size="12" /> : null}
    </div>
  );
}

function Game({ game, myRosterId }: { game: BracketGame; myRosterId?: number }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
        {game.placement !== null ? game.label : `Game ${game.id}`}
      </p>
      <div className={cn("divide-y overflow-hidden rounded-md border", game.placement === 1 && "border-primary/40 bg-primary/[0.04]")}>
        <Seat myRosterId={myRosterId} seat={game.home} />
        <Seat myRosterId={myRosterId} seat={game.away} />
      </div>
    </div>
  );
}

/**
 * Sleeper's own bracket, round by round.
 *
 * Sleeper publishes the bracket the moment the league exists, so before the regular season ends
 * the early seats are filled from current standings and everything downstream is empty. The
 * header says which of the two it is rather than letting a projection pass as a result.
 */
export function BracketBoard({ losers, myRosterId, winners }: { losers: PlayoffBracket | null; myRosterId?: number; winners: PlayoffBracket | null }) {
  const [side, setSide] = useState<BracketSide>("winners");
  const bracket = side === "winners" ? winners : losers;
  if (!winners && !losers) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bracket</CardTitle>
        <CardDescription>
          {bracket?.started
            ? "Season results"
            : "Projected seeding"}
        </CardDescription>
        {winners && losers ? (
          <CardAction>
            {/* Tabs on desktop; the same choice collapses to a select on a phone. */}
            <Tabs className="max-sm:hidden" onValueChange={(value) => setSide(value as BracketSide)} value={side}>
              <TabsList>
                <TabsTrigger value="winners">Winners</TabsTrigger>
                <TabsTrigger value="losers">Consolation</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select onValueChange={(value) => setSide(value as BracketSide)} value={side}>
              <SelectTrigger aria-label="Bracket" className="sm:hidden" size="sm">
                <SelectValue>{(value) => (value === "losers" ? "Consolation" : "Winners")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="winners">Winners</SelectItem>
                <SelectItem value="losers">Consolation</SelectItem>
              </SelectContent>
            </Select>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {bracket ? (
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-4">
              {bracket.rounds.map((round) => (
                <section className="flex w-56 flex-col gap-3" key={round.round}>
                  <div className="flex items-center gap-2 border-b pb-1.5">
                    <h3 className="text-xs font-medium">{round.label}</h3>
                    <Badge className="px-1.5 text-[0.5625rem] font-medium" variant="secondary">R{round.round}</Badge>
                  </div>
                  {round.games.map((game) => <Game game={game} key={game.id} myRosterId={myRosterId} />)}
                </section>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sleeper has not published this bracket yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
