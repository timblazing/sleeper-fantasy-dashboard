import { Crown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HistorySeason, ManagerRow } from "@/lib/league-history";
import { cn } from "@/lib/utils";

const initials = (name: string) => name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();

/**
 * The banner wall — one card per completed season, newest first.
 *
 * A league's history is mostly remembered as a list of champions, and the old page never said who
 * won anything: the title was a `🏆` glyph inside a stat tile. This is the section that gives the
 * page a reason to exist, so it sits directly under the summary strip.
 */
export function HistoryChampions({ managers, seasons }: { managers: ManagerRow[]; seasons: HistorySeason[] }) {
  const byOwner = new Map(managers.map((row) => [row.ownerId, row]));

  const banners = seasons
    .filter((season) => season.complete)
    .map((season) => {
      const champion = managers.find((row) => row.seasons.some((line) => line.season === season.season && line.champion));
      if (!champion) return null;
      const line = champion.seasons.find((entry) => entry.season === season.season);
      // The runner-up is the other side of the title game: final rank 2 in that season.
      const runnerUp = managers.find((row) => row.seasons.some((entry) => entry.season === season.season && entry.finalRank === 2));
      return { season, champion, line, runnerUp };
    })
    .filter((banner): banner is NonNullable<typeof banner> => Boolean(banner));

  if (!banners.length) return null;

  // Repeat winners are the league's real story, so they get called out under the wall.
  const titleCounts = [...byOwner.values()]
    .filter((row) => row.championships > 1)
    .toSorted((a, b) => b.championships - a.championships);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Champions</CardTitle>
        <CardDescription>Every title in league history{banners.length > 1 ? ` — ${banners.length} seasons decided` : ""}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {banners.map(({ season, champion, line, runnerUp }) => (
            <div
              className="relative flex flex-col gap-2.5 overflow-hidden rounded-lg border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-3.5"
              key={season.season}
            >
              {/* A soft corner glow so the banner reads as a trophy case, not another stat tile. */}
              <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/15 blur-2xl" />

              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold tabular-nums text-primary">{season.season}</span>
                <Crown className="size-4 text-primary" />
              </div>

              <div className="flex items-center gap-2.5">
                <Avatar className="size-10 shrink-0 ring-2 ring-primary/30">
                  {champion.avatar ? <AvatarImage alt="" src={`https://sleepercdn.com/avatars/thumbs/${champion.avatar}`} /> : null}
                  <AvatarFallback className="text-xs">{initials(champion.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{champion.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{champion.manager}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-primary/15 pt-2 font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
                {line ? <span>{line.wins}-{line.losses}{line.ties ? `-${line.ties}` : ""}</span> : null}
                {line ? <span className="text-muted-foreground/50">·</span> : null}
                {line ? <span>{line.pointsFor.toFixed(0)} PF</span> : null}
                {runnerUp ? (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="truncate">def. {runnerUp.name}</span>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {titleCounts.length ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Multiple titles:</span>
            {titleCounts.map((row) => (
              <span className={cn("inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary")} key={row.ownerId}>
                <Crown className="size-3" />
                {row.name}
                <span className="font-mono tabular-nums">×{row.championships}</span>
              </span>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
