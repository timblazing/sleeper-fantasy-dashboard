"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MatchupLineup } from "@/components/matchup-lineup";
import { MatchupSummary } from "@/components/matchup-summary";
import type { MatchupDetail } from "@/lib/types";

function MatchupDialog({ matchup, week, leagueId, username }: { matchup: MatchupDetail; week: number; leagueId?: string; username?: string }) {
  return (
    <DialogContent className="max-h-[calc(100vh-2rem)] overflow-hidden p-0 sm:max-w-5xl">
      <DialogHeader className="border-b px-10 py-4 text-center sm:px-6">
        <DialogTitle>Week {week} matchup</DialogTitle>
        <DialogDescription>Weekly projections scored with this league&rsquo;s settings</DialogDescription>
      </DialogHeader>
      <div className="min-w-0 px-4 sm:px-6">
        <div className="rounded-lg border bg-muted/20 p-3"><MatchupSummary matchup={matchup} /></div>
      </div>
      <div className="min-h-0 min-w-0 overflow-y-auto px-4 pb-5 sm:px-6">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Starters</p>
          <p className="text-xs text-muted-foreground">Live points · projected below</p>
        </div>
        <MatchupLineup leagueId={leagueId} matchup={matchup} username={username} />
      </div>
    </DialogContent>
  );
}

function MatchupCard({ matchup, week, leagueId, username }: { matchup: MatchupDetail; week: number; leagueId?: string; username?: string }) {
  return (
    <Dialog>
      <DialogTrigger
        aria-label={`${matchup.home.team.name} versus ${matchup.away.team.name}`}
        className="w-full rounded-2xl border bg-card p-3 text-left text-card-foreground shadow-xs transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
      >
        <MatchupSummary matchup={matchup} />
      </DialogTrigger>
      <MatchupDialog leagueId={leagueId} matchup={matchup} username={username} week={week} />
    </Dialog>
  );
}

export function MatchupBoard({ matchups, week, leagueId, username }: { matchups: MatchupDetail[]; week: number; leagueId?: string; username?: string }) {
  return <div className="flex flex-col gap-3">{matchups.map((matchup) => <MatchupCard key={matchup.id} leagueId={leagueId} matchup={matchup} username={username} week={week} />)}</div>;
}
