import { ArrowLeftRightIcon, MinusIcon, PlusIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { headshotUrl } from "@/lib/display";
import type { ActivityItem, NflPlayer } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Three shapes only, so the column reads at a glance: a player came in, a player went out, or
 * two rosters swapped. Waiver claims and free agent adds share the plus — both are an arrival.
 */
const ENTRY_STYLE = {
  add: { icon: PlusIcon, chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  drop: { icon: MinusIcon, chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  trade: { icon: ArrowLeftRightIcon, chip: "bg-primary/10 text-primary" },
} as const;

function PlayerMove({ kind, player }: { kind: "add" | "drop"; player: NflPlayer }) {
  const Icon = kind === "add" ? PlusIcon : MinusIcon;
  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="size-9 shrink-0">
        <AvatarImage alt="" src={headshotUrl(player)} />
        <AvatarFallback className="text-[0.6rem]">{player.position ?? "NFL"}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className={cn("flex items-center gap-1 text-[0.65rem] font-medium uppercase tracking-wide", kind === "add" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
          <Icon className="size-3" aria-hidden="true" />{kind}
        </p>
        <p className="truncate text-sm font-semibold">{player.name}</p>
        <p className="text-xs text-muted-foreground">{[player.position, player.team].filter(Boolean).join(" · ") || "NFL player"}</p>
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const { icon: Icon, chip } = ENTRY_STYLE[item.kind] ?? ENTRY_STYLE.add;
  const moves = [
    ...item.adds.map((player) => ({ kind: "add" as const, player })),
    ...item.drops.map((player) => ({ kind: "drop" as const, player })),
  ].slice(0, 3);

  return (
    <li className="border-b py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex min-w-0 items-baseline gap-x-2 gap-y-0.5 text-xs">
        <span className="truncate font-semibold">{item.team ?? (item.kind === "trade" ? "League trade" : "League")}</span>
        <span className="shrink-0 uppercase tracking-wide text-muted-foreground">{item.type}</span>
        <span className="ml-auto shrink-0 text-muted-foreground">{item.time}</span>
      </div>
      <div className="mt-2 flex items-start gap-2.5">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", chip)}>
          <Icon aria-hidden="true" className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          {moves.length ? (
            <div className="grid gap-2">{moves.map((move) => <PlayerMove key={`${move.kind}-${move.player.id}`} {...move} />)}</div>
          ) : (
            <p className="text-sm font-medium leading-snug" title={item.detail}>{item.detail}</p>
          )}
        </div>
        {item.bid !== null ? (
          <div className="shrink-0 text-right">
            <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Bid</p>
            <p className="font-mono text-sm font-semibold tabular-nums">${item.bid}</p>
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** The league's last handful of completed moves — trades, waiver claims, and free agent adds. */
export function RecentActivityCard({ activity }: { activity: ActivityItem[] }) {
  return (
    <Card className="h-full min-h-0">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 lg:overflow-y-auto">
        {activity.length ? (
          <ul className="flex flex-col">
            {activity.slice(0, 8).map((item) => (
              <ActivityRow item={item} key={item.id} />
            ))}
          </ul>
        ) : (
          <Empty className="border py-6">
            <EmptyHeader>
              <EmptyTitle className="text-sm">No moves yet</EmptyTitle>
              <EmptyDescription className="text-xs">Trades and waiver claims will show up here once the league gets going.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
