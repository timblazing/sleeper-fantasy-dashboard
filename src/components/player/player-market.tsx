import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PositionBadge } from "@/components/position-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatValue } from "@/lib/display";
import type { PlayerRelated, PlayerRelatedPlayer, PlayerTradeAsset, PlayerTradeMarket } from "@/lib/roster-audit";
import { withUsername } from "@/lib/utils";

/** "Josh Jacobs, Jordan Love, 2026 1st" — one readable line per side of a trade. */
function assetLine(assets: PlayerTradeAsset): string {
  const players = assets.players.map((player) => player.name);
  const picks = assets.picks.map((pick) => `${pick.season} ${["", "1st", "2nd", "3rd", "4th"][pick.round] ?? `R${pick.round}`}`);
  return [...players, ...picks].join(", ") || "—";
}

/**
 * What the player actually cost in real dynasty trades.
 *
 * A calculator value is a model's opinion; these are completed deals, which is the number a
 * manager is really negotiating against. `alongside` matters as much as `cost` — a player who
 * only moves in packages is priced differently than one who moves alone.
 */
const MAX_TRADES = 8;

export function PlayerTradeMarketCard({ market }: { market: PlayerTradeMarket | null }) {
  if (!market || !market.trades.length) return null;
  // `total_trades` counts something narrower than the rows it ships alongside — a live capture
  // sent `total_trades: 2` with 24 trades — so the row count is what the header reports.
  const shown = market.trades.slice(0, MAX_TRADES);
  const total = market.trades.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent trades</CardTitle>
        <CardDescription>
          {total === 1 ? "1 recorded trade" : `${total} recorded trades`}
          {total > MAX_TRADES ? `, showing the ${MAX_TRADES} most recent` : ""}
          {market.medianCost != null ? ` · ${formatValue(market.medianCost)} median cost` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {shown.map((trade) => (
          <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0" key={trade.id}>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {trade.date ? <span className="tabular-nums">{new Date(`${trade.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span> : null}
              {trade.format ? <Badge variant="outline">{trade.format}</Badge> : null}
            </div>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">Cost</p>
                <p className="text-sm">{assetLine(trade.cost)}</p>
              </div>
              <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
              {trade.alongside.players.length || trade.alongside.picks.length ? (
                <div className="min-w-0 flex-1">
                  <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">Moved alongside</p>
                  <p className="text-sm">{assetLine(trade.alongside)}</p>
                </div>
              ) : (
                <div className="min-w-0 flex-1"><p className="text-sm text-muted-foreground">Moved alone</p></div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RelatedList({ title, description, players, leagueId, username }: { title: string; description: string; players: PlayerRelatedPlayer[]; leagueId: string; username?: string }) {
  if (!players.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {players.map((player) => (
          <Link className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 hover:underline" href={withUsername(`/${leagueId}/players/${player.sleeperId}`, username)} key={player.sleeperId}>
            <PositionBadge position={player.position} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{player.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{[player.team, player.age ? `${player.age.toFixed(1)}y` : null].filter(Boolean).join(" · ")}</span>
            <span className="w-14 shrink-0 text-right font-mono text-sm tabular-nums">{player.valueSf == null ? "—" : formatValue(player.valueSf)}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

/** Comparable players — the three ways a manager frames a price. */
export function PlayerRelatedCards({ related, leagueId, username }: { related: PlayerRelated | null; leagueId: string; username?: string }) {
  if (!related) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <RelatedList description="Same value, any position — the real trade comps" leagueId={leagueId} players={related.similarValue} title="Similar value" username={username} />
      <RelatedList description="Peers in the same dynasty tier" leagueId={leagueId} players={related.sameTier} title="Same tier" username={username} />
      <RelatedList description="Who else eats on this offense" leagueId={leagueId} players={related.teammates} title="Teammates" username={username} />
    </div>
  );
}
