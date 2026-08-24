import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PositionBadge } from "@/components/position-badge";
import { describeGame, headshotUrl } from "@/lib/display";
import { cn } from "@/lib/utils";
import type { NflPlayer, PlayerGame, RosterSlot } from "@/lib/types";

// Sleeper reports these verbatim in `injury_status`; anything not listed still renders, uncoloured.
const INJURY_TONE: Record<string, string> = { Out: "text-destructive", IR: "text-destructive", PUP: "text-destructive", Sus: "text-destructive", Doubtful: "text-destructive", Questionable: "text-amber-600 dark:text-amber-500", Probable: "text-muted-foreground" };
const INJURY_SHORT: Record<string, string> = { Questionable: "Q", Doubtful: "D", Out: "O", Probable: "P", Sus: "SUS" };

export function PlayerIdentity({ player, game }: { player: NflPlayer; game?: PlayerGame | null }) {
  const meta = [player.team, player.age ? `${player.age}y` : null].filter(Boolean).join(" · ");
  const status = player.injuryStatus;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="bg-muted">
        <AvatarImage alt="" src={headshotUrl(player)} />
        <AvatarFallback className="text-[0.65rem]">{player.position ?? "—"}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{player.name}</span>
          <PositionBadge position={player.position} />
          {status ? <span className={cn("text-[0.65rem] font-semibold uppercase", INJURY_TONE[status] ?? "text-muted-foreground")}>{INJURY_SHORT[status] ?? status}</span> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{meta}{game ? ` · ${describeGame(game)}` : ""}</p>
      </div>
    </div>
  );
}

export function EmptySlot() {
  return <div className="flex items-center gap-3 text-sm text-muted-foreground"><Avatar className="bg-muted"><AvatarFallback className="text-[0.65rem]">—</AvatarFallback></Avatar>Empty</div>;
}

export function SlotBadge({ slot }: { slot: string }) {
  return <Badge className="w-16 justify-center font-mono text-[0.65rem]" variant="secondary">{slot}</Badge>;
}

export function SlotRow({ entry, showPoints }: { entry: RosterSlot; showPoints?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b py-2 last:border-b-0">
      <SlotBadge slot={entry.slot} />
      <div className="min-w-0 flex-1">{entry.player ? <PlayerIdentity game={entry.game} player={entry.player} /> : <EmptySlot />}</div>
      {showPoints ? <span className="w-14 shrink-0 text-right font-mono text-sm tabular-nums">{entry.points == null ? "—" : entry.points.toFixed(1)}</span> : null}
    </div>
  );
}
