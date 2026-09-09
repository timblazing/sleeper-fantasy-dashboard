import { ROOM_POSITIONS, type RoomPosition } from "@/lib/roster-positions";
import type { SleeperLeague } from "@/lib/types";

/**
 * Turning a projected-points board into a redraft league's currency.
 *
 * Raw points per game is the wrong number to rank a roster by: a quarterback scores half again
 * what a wide receiver does in every scoring system, so summing PPG would say every 1QB team's
 * best asset is its quarterback. What actually costs a manager points is the gap between a
 * player and whoever would start in his place — the replacement level — and that level is set
 * by the league's own starting requirements. A superflex league starts nearly two quarterbacks
 * per team, which pushes QB replacement down the board and makes quarterbacks genuinely
 * valuable; the same math handles TE-premium-shaped lineups and 10- or 14-team leagues.
 *
 * Pure: everything here is a function of the projection rows and the Sleeper league object.
 */

export type ProjectedPlayer = { sleeperId: string; position: string; ppg: number };

/**
 * How a flex slot is actually filled, by position. A FLEX is a running back or receiver far
 * more often than a tight end, and a SUPER_FLEX is a quarterback nearly every week — splitting
 * each slot evenly across the positions it *permits* would understate quarterbacks badly in the
 * one format where they matter most.
 */
const FLEX_SHARES: Record<string, Partial<Record<RoomPosition, number>>> = {
  FLEX: { RB: 0.45, WR: 0.45, TE: 0.1 },
  SUPER_FLEX: { QB: 0.9, RB: 0.04, WR: 0.04, TE: 0.02 },
  REC_FLEX: { WR: 0.8, TE: 0.2 },
  WRRB_FLEX: { RB: 0.5, WR: 0.5 },
  WRRB_WRT: { RB: 0.5, WR: 0.5 },
  IDP_FLEX: {},
};

/** Bench, taxi and IR slots are not starting requirements, so they set no replacement level. */
const NON_STARTING = new Set(["BN", "TAXI", "IR"]);

/** Starters per team at each position, flex slots included at the rate they are really used. */
export function starterCounts(league: SleeperLeague): Record<RoomPosition, number> {
  const counts = Object.fromEntries(ROOM_POSITIONS.map((position) => [position, 0])) as Record<RoomPosition, number>;
  for (const slot of league.roster_positions) {
    if (NON_STARTING.has(slot)) continue;
    if ((ROOM_POSITIONS as readonly string[]).includes(slot)) {
      counts[slot as RoomPosition] += 1;
      continue;
    }
    for (const [position, share] of Object.entries(FLEX_SHARES[slot] ?? {})) counts[position as RoomPosition] += share ?? 0;
  }
  return counts;
}

/**
 * The PPG of the last starter at each position across the whole league — the bar a player has
 * to clear to be worth anything at all. A board that does not run that deep at a position falls
 * back to its own last ranked player there, which is the most pessimistic honest answer.
 */
export function replacementLevels(players: ProjectedPlayer[], league: SleeperLeague): Record<RoomPosition, number> {
  const teams = Math.max(2, league.settings.num_teams ?? 12);
  const counts = starterCounts(league);
  const levels = {} as Record<RoomPosition, number>;
  for (const position of ROOM_POSITIONS) {
    const board = players.filter((player) => player.position === position).map((player) => player.ppg).toSorted((a, b) => b - a);
    const index = Math.max(1, Math.round(counts[position] * teams)) - 1;
    levels[position] = board.length ? board[Math.min(index, board.length - 1)] : 0;
  }
  return levels;
}

/**
 * Points above replacement per player, keyed by Sleeper id and rounded to a tenth.
 *
 * The rounding is deliberate: every table, tile and roster total in the app renders a raw value
 * with `toLocaleString`, so a value carrying six decimals would print as one. A tenth of a point
 * per game is also finer than any projection is actually accurate to.
 *
 * Positions outside the four that get a room (kickers, defenses, IDP) are not projected against
 * a replacement level and are worth zero here — the same treatment they already get in the
 * dynasty basis, where RosterAudit does not price them either.
 */
export function toRedraftValues(players: ProjectedPlayer[], league: SleeperLeague): Map<string, number> {
  const levels = replacementLevels(players, league);
  const values = new Map<string, number>();
  for (const player of players) {
    if (!(ROOM_POSITIONS as readonly string[]).includes(player.position)) continue;
    const above = player.ppg - levels[player.position as RoomPosition];
    values.set(player.sleeperId, above > 0 ? Math.round(above * 10) / 10 : 0);
  }
  return values;
}
