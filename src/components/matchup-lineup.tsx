import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PositionBadge } from "@/components/position-badge";
import { headshotUrl } from "@/lib/display";
import type { MatchupDetail, RosterSlot } from "@/lib/types";
import { cn, withUsername } from "@/lib/utils";

const points = (entry: RosterSlot) => (entry.game?.state !== "in" && entry.game?.state !== "post") || entry.points == null ? "-" : entry.points.toFixed(1);
const projection = (entry: RosterSlot) => entry.projection == null ? "—" : entry.projection.toFixed(1);

/**
 * The opponent line. A live game brings ESPN's own status text; otherwise this is the scheduled
 * matchup, where `projectionHome === false` means the player's team is on the road. An unknown
 * side falls back to the neutral "vs" rather than guessing.
 */
function opponentLabel(entry: RosterSlot) {
  if (entry.game?.detail) return entry.game.detail;
  if (!entry.projectionOpponent) return "—";
  return `${entry.projectionHome === false ? "@" : "vs"} ${entry.projectionOpponent}`;
}

function PlayerSide({ entry, reverse, leagueId, username }: { entry: RosterSlot; reverse?: boolean; leagueId?: string; username?: string }) {
  const player = entry.player;
  // Team defenses have no RosterAudit profile, so only real players get a link — an empty slot
  // or a DEF keeps the plain text it had before.
  const href = player && leagueId && player.position !== "DEF" ? withUsername(`/${leagueId}/players/${player.id}`, username) : null;
  const name = player?.name ?? "Empty";

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5 rounded-lg bg-muted/35 px-1.5 py-1.5 sm:gap-2 sm:px-2 sm:py-2", reverse && "flex-row-reverse text-right")}>
      <Avatar className="size-6 shrink-0 bg-muted sm:size-8">
        {player ? <AvatarImage alt="" src={headshotUrl(player)} /> : null}
        <AvatarFallback className="text-[0.6rem]">{player?.position ?? "—"}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-xs font-medium leading-tight sm:text-sm">
          {href ? <Link className="hover:underline" href={href}>{name}</Link> : name}
        </p>
        <p className="truncate text-[0.65rem] leading-tight text-muted-foreground sm:text-xs">
          {opponentLabel(entry)}
        </p>
      </div>
      <div className="hidden shrink-0 font-mono text-right tabular-nums sm:block">
        <p className="text-xs font-semibold leading-tight sm:text-sm">{points(entry)}</p>
        <p aria-label={`Projected ${projection(entry)} points`} className="text-[0.6rem] leading-tight text-muted-foreground">{projection(entry)}</p>
      </div>
    </div>
  );
}

/** `leagueId` is optional so a caller without league context still renders plain names. */
export function MatchupLineup({ matchup, leagueId, username }: { matchup: MatchupDetail; leagueId?: string; username?: string }) {
  const rows = Math.max(matchup.home.slots.length, matchup.away.slots.length);

  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: rows }, (_, index) => {
        const home = matchup.home.slots[index];
        const away = matchup.away.slots[index];
        const slot = home?.slot ?? away?.slot ?? null;
        return (
          <div className="grid grid-cols-[minmax(0,1fr)_1.75rem_minmax(0,1fr)] items-center gap-1 sm:grid-cols-[minmax(0,1fr)_3.25rem_minmax(0,1fr)] sm:gap-2" key={`${home?.slot ?? "home"}-${away?.slot ?? "away"}-${index}`}>
            {home ? <PlayerSide entry={home} leagueId={leagueId} username={username} /> : <span />}
            <span className="flex justify-center">
              <PositionBadge position={slot} label={slot ?? "—"} />
            </span>
            {away ? <PlayerSide entry={away} leagueId={leagueId} reverse username={username} /> : <span />}
          </div>
        );
      })}
    </div>
  );
}
