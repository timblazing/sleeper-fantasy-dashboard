import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CloudOff, Hourglass, TriangleAlert } from "lucide-react";
import { PlayerDetail } from "@/components/player/player-detail";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getLeagueChrome } from "@/lib/league-chrome";
import { getPlayerLeagueContext } from "@/lib/player-league-context";
import { getPlayerProfile } from "@/lib/player-profile";
import type { RaError } from "@/lib/roster-audit";
import { withUsername } from "@/lib/utils";

// Same per-kind explanations the players index uses — a reader who hits a rate limit on the
// list and then on a profile should read the same sentence, not two different ones.
const ERROR_STATES: Record<RaError["kind"], { title: string; description: string }> = {
  "rate-limited": { title: "Player is rate limited", description: "RosterAudit is throttling requests right now. Wait a minute and reload — this page will not retry on its own." },
  "upstream-unavailable": { title: "RosterAudit is unavailable", description: "The player service did not respond. This profile will return once it is reachable again." },
  "invalid-response": { title: "Unexpected player data", description: "RosterAudit returned a response this app could not read, so nothing is shown rather than wrong numbers." },
  "missing-key": { title: "RosterAudit key required", description: "This deployment has no RosterAudit API key configured, and player profiles need one." },
  "rejected-key": { title: "RosterAudit key rejected", description: "The configured RosterAudit API key was refused." },
  "unsynced-league": { title: "League not synced", description: "Sync this league at https://rosteraudit.com/league/ to unlock player profiles." },
  "no-history": { title: "No history available", description: "RosterAudit has no historical data for this player yet." },
};

const first = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export async function generateMetadata({ params }: { params: Promise<{ sleeperId: string }> }): Promise<Metadata> {
  const { sleeperId } = await params;
  const result = await getPlayerProfile(sleeperId);
  if (!result.ok) return { title: "Player" };
  const { player, value } = result.data;
  return {
    title: player.name,
    description: `${player.name} — ${player.position}${value.rankPositionSf ?? ""} · ${value.valueSf.toLocaleString("en-US")} dynasty value in superflex.`,
  };
}

export default async function PlayerPage({ params, searchParams }: { params: Promise<{ leagueId: string; sleeperId: string }>; searchParams: Promise<{ username?: string | string[] }> }) {
  const [{ leagueId, sleeperId }, query] = await Promise.all([params, searchParams]);
  const username = first(query.username);

  // The profile is the page; league chrome and ownership are enrichments that must not be able
  // to fail it, so all three are awaited together and only the profile gates rendering.
  const [league, result, context] = await Promise.all([
    getLeagueChrome(leagueId),
    getPlayerProfile(sleeperId),
    getPlayerLeagueContext(leagueId, sleeperId, username),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6 lg:p-8">
      <div>
        <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href={withUsername(`/${leagueId}/players`, username)}>
          <ArrowLeft className="size-4" /> All players
        </Link>
      </div>

      {result.ok ? (
        <>
          <PlayerDetail context={context} isSuperflex={league.isSuperflex} leagueId={leagueId} profile={result.data} username={username} />
        </>
      ) : (
        <Card>
          <CardContent>
            <Empty className="min-h-72 border">
              <EmptyHeader>
                <EmptyMedia variant="icon">{result.error.kind === "rate-limited" ? <Hourglass /> : result.error.kind === "invalid-response" ? <TriangleAlert /> : <CloudOff />}</EmptyMedia>
                <EmptyTitle>{ERROR_STATES[result.error.kind].title}</EmptyTitle>
                <EmptyDescription>{ERROR_STATES[result.error.kind].description}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
