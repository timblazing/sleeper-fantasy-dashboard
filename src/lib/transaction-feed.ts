import { getLeagueBase } from "@/lib/league-context";
import { liveSource, type LeagueSource } from "@/lib/league-source";
import { resolvePlayer } from "@/lib/players";
import type { ActivityItem, NflPlayer, SleeperTransaction, TransactionAsset, TransactionEntry } from "@/lib/types";

// Sleeper files transactions under a "round" that tracks the league week. Offseason and preseason
// activity lands in low weeks, so an empty current week says nothing about whether a league is
// active — scan back across the season instead of showing a false "no moves" state.
const MAX_WEEK = 18;

export function relativeTime(timestamp: number, now = Date.now()) {
  const minutes = Math.max(1, Math.round((now - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : `${Math.round(days / 30)}mo ago`;
}

function pickLabel(pick: { season: string; round: number }) {
  const suffix = pick.round === 1 ? "st" : pick.round === 2 ? "nd" : pick.round === 3 ? "rd" : "th";
  return `${pick.season} ${pick.round}${suffix}`;
}

function toEntry(transaction: SleeperTransaction, week: number, catalog: Map<string, NflPlayer>, teamNames: Map<number, string>): TransactionEntry {
  const rosterIds = transaction.roster_ids ?? [];
  const sides: TransactionAsset[] = rosterIds.map((rosterId) => {
    const adds = Object.entries(transaction.adds ?? {}).filter(([, target]) => target === rosterId).map(([id]) => resolvePlayer(catalog, id));
    const drops = Object.entries(transaction.drops ?? {}).filter(([, target]) => target === rosterId).map(([id]) => resolvePlayer(catalog, id));
    const picks = (transaction.draft_picks ?? []).filter((pick) => pick.owner_id === rosterId).map(pickLabel);
    const faab = (transaction.waiver_budget ?? []).filter((move) => move.receiver === rosterId).reduce((sum, move) => sum + move.amount, 0);
    return { rosterId, teamName: teamNames.get(rosterId) ?? `Roster ${rosterId}`, adds, drops, picks, faab: faab || null };
  });
  return { id: transaction.transaction_id, type: transaction.type, status: transaction.status, week, created: transaction.created, time: relativeTime(transaction.created), bid: transaction.settings?.waiver_bid ?? null, sides };
}

/**
 * Completed transactions newest-first. Weeks are fetched from the current week backwards and the
 * scan stops early once `limit` entries are collected.
 */
export async function getTransactionFeed(leagueId: string, limit = 40, source: LeagueSource = liveSource): Promise<TransactionEntry[]> {
  const [base, catalog] = await Promise.all([
    getLeagueBase(leagueId, source), source.getPlayerCatalog().catch(() => new Map<string, NflPlayer>()),
  ]);
  const teamNames = new Map([...base.teamByRoster].map(([rosterId, team]) => [rosterId, team.name] as const));

  const startWeek = Math.min(MAX_WEEK, base.week);
  const entries: TransactionEntry[] = [];
  for (let week = startWeek; week >= 1 && entries.length < limit; week -= 1) {
    const transactions = await source.getTransactions(leagueId, week).catch(() => []);
    for (const transaction of transactions) {
      if (transaction.status !== "complete") continue;
      entries.push(toEntry(transaction, week, catalog, teamNames));
    }
  }
  return entries.toSorted((a, b) => b.created - a.created).slice(0, limit);
}

export function describeTransaction(entry: TransactionEntry): string {
  if (entry.type === "trade") return entry.sides.map((side) => side.teamName).join(" ↔ ");
  const side = entry.sides[0];
  if (!side) return "League transaction";
  const added = side.adds.map((player) => player.name).join(", ");
  const dropped = side.drops.map((player) => player.name).join(", ");
  const parts = [added && `added ${added}`, dropped && `dropped ${dropped}`].filter(Boolean).join(" · ");
  return parts ? `${side.teamName} ${parts}` : `${side.teamName} made a move`;
}

/**
 * Sleeper files an add and a drop under the same `free_agent` type, so the type alone can't name
 * the move: a drop-only entry was reading as "Free agent add". Look at what actually changed
 * hands, and fall back to the type when a move carries neither.
 */
export const transactionLabel = (entry: TransactionEntry) => {
  if (entry.type === "trade") return "Trade";
  const side = entry.sides[0];
  const added = side ? side.adds.length > 0 : false;
  const dropped = side ? side.drops.length > 0 : false;
  if (entry.type === "waiver") return "Waiver claim";
  if (added) return "Free agent add";
  if (dropped) return "Free agent drop";
  return "Free agent move";
};

/** The three shapes the activity feed draws an icon for. */
export type TransactionKind = "trade" | "add" | "drop";

/**
 * What the entry did, for the feed's icon. A waiver claim that swaps a player in and out counts
 * as an add — the claim is the point, the corresponding drop is the cost.
 */
export const transactionKind = (entry: TransactionEntry): TransactionKind => {
  if (entry.type === "trade") return "trade";
  const side = entry.sides[0];
  if (side && side.adds.length > 0) return "add";
  if (side && side.drops.length > 0) return "drop";
  return "add";
};

/** Preserve the people and players behind a move so the dashboard can show more than a sentence. */
export function toActivityItem(entry: TransactionEntry): ActivityItem {
  const side = entry.sides[0];
  return {
    id: entry.id,
    type: transactionLabel(entry),
    detail: describeTransaction(entry),
    time: entry.time,
    kind: transactionKind(entry),
    team: entry.type === "trade" ? null : side?.teamName ?? null,
    adds: side?.adds ?? [],
    drops: side?.drops ?? [],
    bid: entry.bid,
  };
}
