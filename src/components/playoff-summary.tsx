import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlayoffPicture, PlayoffRow } from "@/lib/playoff-odds";
import { cn } from "@/lib/utils";

const avatarUrl = (id: string) => `https://sleepercdn.com/avatars/thumbs/${id}`;
const initials = (name: string) => name.split(/\s|&/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
const pct = (value: number) => (value >= 99.95 ? ">99.9" : value < 0.05 && value > 0 ? "<0.1" : value.toFixed(1));

/** A 44px ring showing one probability, with the value centred inside it. */
function OddsRing({ value, label, tone = "primary" }: { value: number; label: string; tone?: "primary" | "muted" }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="flex items-center gap-3">
      <svg aria-hidden="true" className="-rotate-90" height="48" viewBox="0 0 48 48" width="48">
        <circle cx="24" cy="24" r={radius} className="stroke-muted" fill="none" strokeWidth="4" />
        <circle
          cx="24" cy="24" r={radius} fill="none" strokeLinecap="round" strokeWidth="4"
          className={tone === "primary" ? "stroke-primary" : "stroke-muted-foreground"}
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <div className="min-w-0">
        <p className="font-mono text-lg font-semibold leading-none tabular-nums">{pct(value)}<span className="text-xs text-muted-foreground">%</span></p>
        <p className="mt-1 text-[0.6875rem] leading-tight text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/**
 * The connected team's own playoff picture, plus the games that will decide it.
 * Renders nothing when no team is connected — the league-wide cards carry the page instead.
 */
export function MyPlayoffOutlook({ picture }: { picture: PlayoffPicture }) {
  const me = picture.rows.find((row) => row.isUser);
  if (!me) return null;

  const seedRank = picture.rows.toSorted((a, b) => a.averageSeed - b.averageSeed).findIndex((row) => row.rosterId === me.rosterId) + 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Avatar className="size-6">
            {me.avatar ? <AvatarImage alt="" src={avatarUrl(me.avatar)} /> : null}
            <AvatarFallback className="text-[0.5rem]">{initials(me.name)}</AvatarFallback>
          </Avatar>
          {me.name}
        </CardTitle>
        <CardDescription>
          Projected #{seedRank} of {picture.teams} · {me.projectedWins.toFixed(1)} wins ({me.winRange[0]}–{me.winRange[1]}) · {me.ppg.toFixed(1)} PPG
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <OddsRing label="Make the playoffs" value={me.playoffOdds} />
          <OddsRing label={picture.byeTeams > 0 ? "First-round bye" : "Top seed"} tone="muted" value={picture.byeTeams > 0 ? me.byeOdds : me.seedOdds[0] ?? 0} />
          <OddsRing label="Win the championship" tone="muted" value={me.titleOdds} />
        </div>

        {picture.remainingSchedule.length ? (
          <div>
            <p className="mb-2 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
              Remaining schedule · {picture.remainingSchedule.length} games
            </p>
            <ul className="flex flex-col gap-1">
              {picture.remainingSchedule.map((game) => (
                <li className="flex items-center gap-2.5 text-sm" key={`${game.week}-${game.opponentRosterId}`}>
                  <span className="w-8 shrink-0 font-mono text-[0.625rem] uppercase tabular-nums text-muted-foreground">Wk {game.week}</span>
                  <Avatar className="size-5 shrink-0">
                    {game.opponentAvatar ? <AvatarImage alt="" src={avatarUrl(game.opponentAvatar)} /> : null}
                    <AvatarFallback className="text-[0.5rem]">{initials(game.opponent)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem]">{game.opponent}</span>
                  <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted sm:w-24">
                    <span
                      className={cn("block h-full rounded-full", game.winProbability >= 50 ? "bg-emerald-500" : "bg-muted-foreground/50")}
                      style={{ width: `${game.winProbability}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums">{game.winProbability.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Small stat tiles summarising the state of the race across the whole league. */
export function PlayoffStats({ picture }: { picture: PlayoffPicture }) {
  const clinched = picture.rows.filter((row) => row.outlook === "locked").length;
  const eliminated = picture.rows.filter((row) => row.outlook === "eliminated").length;
  const bubble = picture.rows.filter((row) => row.outlook === "bubble").length;
  const favourite = picture.rows.toSorted((a, b) => b.titleOdds - a.titleOdds)[0];

  const tiles = [
    { label: "Title favourite", value: favourite ? `${favourite.titleOdds.toFixed(1)}%` : "—", detail: favourite?.name ?? "" },
    { label: "Weeks remaining", value: String(picture.weeksRemaining), detail: `Playoffs start week ${picture.playoffWeekStart}` },
    { label: "Still on the bubble", value: String(bubble), detail: `${picture.playoffTeams} of ${picture.teams} spots` },
    { label: picture.started ? "Clinched · out" : "Bracket size", value: picture.started ? `${clinched} · ${eliminated}` : `${picture.playoffTeams} teams`, detail: picture.started ? "Teams locked in or out" : `${picture.byeTeams} first-round ${picture.byeTeams === 1 ? "bye" : "byes"}` },
  ];

  return (
    <section aria-label="Playoff summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <Card className="gap-0 py-0" key={tile.label}>
          <CardContent className="p-4">
            <p className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">{tile.label}</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{tile.value}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{tile.detail}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export type { PlayoffRow };
