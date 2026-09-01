import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TeamDetail } from "@/components/team/team-detail";
import { buttonVariants } from "@/components/ui/button";
import { getLeagueValueContext } from "@/lib/league-values";
import { withUsername } from "@/lib/utils";

export const metadata: Metadata = { title: "Team" };

const first = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;

export default async function TeamPage({ params, searchParams }: { params: Promise<{ leagueId: string; rosterId: string }>; searchParams: Promise<{ username?: string | string[] }> }) {
  const [{ leagueId, rosterId }, query] = await Promise.all([params, searchParams]);
  const id = Number.parseInt(rosterId, 10);
  if (!Number.isInteger(id)) notFound();

  const context = await getLeagueValueContext(leagueId);
  const team = context.teams.find((entry) => entry.rosterId === id);
  if (!team) notFound();
  const username = first(query.username);

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6 lg:p-8">
      <div>
        <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href={withUsername(`/${leagueId}/league`, username)}>
          <ArrowLeft className="size-4" /> Back to league
        </Link>
      </div>
      <TeamDetail
        leagueId={leagueId}
        leagueName={context.league.name}
        season={context.league.season}
        team={team}
        teams={context.teams.length}
        username={username}
        valuesReady={context.valuesReady}
      />
    </div>
  );
}
