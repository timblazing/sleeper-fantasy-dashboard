import type { PlayoffRow } from "@/lib/playoff-odds";
import type { SleeperBracketGame } from "@/lib/types";

/** One side of a bracket game, resolved to a team wherever Sleeper has named one. */
export type BracketSeat = {
  rosterId: number | null;
  name: string;
  manager: string;
  avatar: string | null;
  seed: number | null;
  /** Set once the game is decided; both seats carry it so the loser can be dimmed. */
  won: boolean | null;
  /** Where an unresolved seat comes from — "Winner of R1 G2" rather than an empty box. */
  from: string | null;
};

export type BracketGame = {
  id: number;
  round: number;
  /** The finish this game decides, when it is a placement game. `1` is the championship. */
  placement: number | null;
  label: string;
  home: BracketSeat;
  away: BracketSeat;
  played: boolean;
};

export type BracketRound = { round: number; label: string; games: BracketGame[] };

export type PlayoffBracket = {
  kind: "winners" | "losers";
  rounds: BracketRound[];
  /** True once any game in the bracket has a winner — before that it is a projection. */
  started: boolean;
};

const EMPTY_SEAT: BracketSeat = { rosterId: null, name: "TBD", manager: "", avatar: null, seed: null, won: null, from: null };

/**
 * Round labels count backwards from the final, so a 6-team bracket reads
 * "Wild card / Semifinal / Final" rather than "Round 1/2/3".
 */
function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinal";
  if (fromEnd === 2) return "Quarterfinal";
  return `Round ${round}`;
}

/** Placement games are named by the finish they decide; the rest inherit the round name. */
function gameLabel(game: SleeperBracketGame, round: number, totalRounds: number, kind: "winners" | "losers"): string {
  if (game.p === undefined) return roundLabel(round, totalRounds);
  if (game.p === 1) return kind === "winners" ? "Championship" : "Consolation final";
  if (game.p === 3) return "3rd place";
  return `${game.p}th place`;
}

/**
 * `t1_from`/`t2_from` name the game a seat is fed by, so an undecided seat can still say where
 * its occupant will come from. Sleeper types these loosely, so the read is defensive.
 */
function seatOrigin(game: SleeperBracketGame, side: "t1" | "t2"): string | null {
  const from = (game as unknown as Record<string, unknown>)[`${side}_from`];
  if (!from || typeof from !== "object") return null;
  const record = from as { w?: number; l?: number };
  if (typeof record.w === "number") return `Winner of G${record.w}`;
  if (typeof record.l === "number") return `Loser of G${record.l}`;
  return null;
}

/**
 * Turn Sleeper's flat bracket array into rounds of resolved games.
 *
 * Sleeper reports a bracket for a season the moment the league is created, with the seats for
 * later rounds empty and — before the regular season ends — the early seats filled from the
 * *current* standings. That is why the bracket is labelled a projection until a game is decided.
 */
export function buildBracket(games: SleeperBracketGame[], rows: PlayoffRow[], kind: "winners" | "losers"): PlayoffBracket | null {
  if (!games.length) return null;

  const byRoster = new Map(rows.map((row) => [row.rosterId, row]));
  // Seeds come from the same order the race table uses so the two views agree.
  const seedByRoster = new Map(rows.toSorted((a, b) => a.averageSeed - b.averageSeed).map((row, index) => [row.rosterId, index + 1]));
  const totalRounds = Math.max(...games.map((game) => game.r));

  const seat = (rosterId: number | null, game: SleeperBracketGame, side: "t1" | "t2"): BracketSeat => {
    if (rosterId === null) return { ...EMPTY_SEAT, from: seatOrigin(game, side) };
    const row = byRoster.get(rosterId);
    return {
      rosterId,
      name: row?.name ?? `Roster ${rosterId}`,
      manager: row?.manager ?? "",
      avatar: row?.avatar ?? null,
      seed: seedByRoster.get(rosterId) ?? null,
      won: game.w === null ? null : game.w === rosterId,
      from: null,
    };
  };

  const rounds: BracketRound[] = [];
  for (let round = 1; round <= totalRounds; round += 1) {
    const inRound = games.filter((game) => game.r === round).toSorted((a, b) => (a.p ?? 0) - (b.p ?? 0) || a.m - b.m);
    if (!inRound.length) continue;
    rounds.push({
      round,
      label: roundLabel(round, totalRounds),
      games: inRound.map((game) => ({
        id: game.m,
        round,
        placement: game.p ?? null,
        label: gameLabel(game, round, totalRounds, kind),
        home: seat(game.t1, game, "t1"),
        away: seat(game.t2, game, "t2"),
        played: game.w !== null,
      })),
    });
  }

  return { kind, rounds, started: games.some((game) => game.w !== null) };
}
