import { liveSource, type LeagueSource } from "@/lib/league-source";
import type { SleeperBracketGame, SleeperLeague, SleeperMatchup, SleeperRoster, SleeperUser } from "@/lib/types";

/**
 * League History reads every season this league has ever been, not just the current one.
 *
 * Sleeper models a renewed league as a *new* league id that points back at the prior year through
 * `previous_league_id`, so the history is a linked list walked backwards from the id in the URL.
 * Managers are the stable identity across that list — team names change year to year, and a
 * manager who left still owns their past results — so everything here keys on `owner_id` and
 * labels rows with the most recent name that owner used.
 */

/** How far back the chain is walked. A guard against a cycle in `previous_league_id`, not a real limit. */
const MAX_SEASONS = 20;

export type HistorySeason = {
  leagueId: string;
  season: string;
  /** False while the season is still being played — its placements are not final yet. */
  complete: boolean;
  /** The first playoff week; regular-season records only count the weeks before it. */
  playoffWeekStart: number;
  /** The last week that actually has scores, so an in-progress season stops at today. */
  lastScoredWeek: number;
};

/** One manager's line in a single season. */
export type SeasonEntry = {
  season: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Regular-season finish, 1-based. */
  regularSeasonRank: number;
  /** Final finish after the bracket — null while a season is in progress or has no bracket. */
  finalRank: number | null;
  champion: boolean;
};

export type ManagerRow = {
  ownerId: string;
  /** The most recent team name this owner used. */
  name: string;
  manager: string;
  avatar: string | null;
  /** True when the owner is still in the league's current season. */
  active: boolean;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Regular-season games played — the denominator for every rate below. */
  games: number;
  pointsPerGame: number;
  winPct: number;
  championships: number;
  playoffAppearances: number;
  /**
   * Wins above expected: how many more games this manager won than their weekly scores
   * deserved, measured against the whole league rather than the one opponent they drew.
   * Positive means the schedule was kind.
   */
  winsAboveExpected: number;
  /** Share of weeks the manager beat the median score — luck-free record quality. */
  managerEfficiency: number;
  seasons: SeasonEntry[];
};

/** One completed head-to-head game, the unit every record below is derived from. */
export type HistoryGame = {
  season: string;
  week: number;
  playoff: boolean;
  homeOwner: string;
  awayOwner: string;
  homeScore: number;
  awayScore: number;
};

export type ScoreLine = { ownerId: string; name: string; season: string; week: number; points: number };

export type MarginLine = {
  season: string;
  week: number;
  margin: number;
  winnerName: string;
  loserName: string;
  winnerScore: number;
  loserScore: number;
};

export type StreakLine = { name: string; length: number; season: string; startWeek: number; endWeek: number };

export type RecordBook = {
  mostPointsSeason: { name: string; season: string; points: number } | null;
  fewestPointsSeason: { name: string; season: string; points: number } | null;
  bestRecord: { name: string; season: string; wins: number; losses: number } | null;
  worstRecord: { name: string; season: string; wins: number; losses: number } | null;
  longestWinStreak: StreakLine | null;
  longestLossStreak: StreakLine | null;
  highestScoringLoss: MarginLine | null;
  lowestScoringWin: MarginLine | null;
  biggestBlowout: MarginLine | null;
  closestMatchup: MarginLine | null;
};

/** One cell of the all-time head-to-head grid: `row` team's record against `column` team. */
export type HeadToHead = { wins: number; losses: number; ties: number };

export type LeagueHistory = {
  leagueId: string;
  name: string;
  /** Newest season first. */
  seasons: HistorySeason[];
  managers: ManagerRow[];
  /** Keyed `${rowOwnerId}:${columnOwnerId}`. */
  headToHead: Map<string, HeadToHead>;
  records: RecordBook;
  topScores: ScoreLine[];
  lowScores: ScoreLine[];
  closestMatchups: MarginLine[];
  biggestBlowouts: MarginLine[];
  /** True when only the current season resolved — the page explains the missing depth. */
  singleSeason: boolean;
};

type SeasonBundle = {
  meta: HistorySeason;
  league: SleeperLeague;
  users: SleeperUser[];
  rosters: SleeperRoster[];
  weeks: Map<number, SleeperMatchup[]>;
  bracket: SleeperBracketGame[];
};

const scoreOf = (matchup: SleeperMatchup) => matchup.points ?? 0;

/**
 * Walk `previous_league_id` back to the league's first season.
 *
 * A season that fails to load ends the walk rather than the request: history is a bonus view of
 * older data, and a single missing year must not blank the seasons that did resolve.
 */
async function collectSeasonIds(leagueId: string, source: LeagueSource): Promise<SleeperLeague[]> {
  const chain: SleeperLeague[] = [];
  const seen = new Set<string>();
  let id: string | null = leagueId;

  while (id && !seen.has(id) && chain.length < MAX_SEASONS) {
    seen.add(id);
    const league: SleeperLeague | null = await source.getLeague(id).catch(() => null);
    if (!league) break;
    chain.push(league);
    id = league.previous_league_id;
  }
  return chain;
}

/**
 * Pull one season's rosters, users, bracket and every scored week.
 *
 * Weeks are fetched up to the last one Sleeper has scores for. An in-progress season simply has
 * fewer of them, which is what makes a live year sit alongside finished ones without special-casing.
 */
async function loadSeason(league: SleeperLeague, currentWeek: number, isCurrent: boolean, source: LeagueSource): Promise<SeasonBundle | null> {
  const playoffWeekStart = league.settings.playoff_week_start || 15;
  // A finished season is read to the end of its bracket; the live one stops at the current week.
  const finalWeek = isCurrent ? Math.max(0, currentWeek) : playoffWeekStart + 3;

  const [users, rosters, bracket] = await Promise.all([
    source.getLeagueUsers(league.league_id).catch(() => [] as SleeperUser[]),
    source.getLeagueRosters(league.league_id).catch(() => [] as SleeperRoster[]),
    source.getWinnersBracket(league.league_id).catch(() => [] as SleeperBracketGame[]),
  ]);
  if (!rosters.length) return null;

  const weekNumbers = Array.from({ length: Math.max(0, finalWeek) }, (_, index) => index + 1);
  const fetched = await Promise.all(
    weekNumbers.map((week) => source.getMatchups(league.league_id, week).then((rows) => [week, rows] as const).catch(() => [week, [] as SleeperMatchup[]] as const)),
  );

  const weeks = new Map<number, SleeperMatchup[]>();
  let lastScoredWeek = 0;
  for (const [week, rows] of fetched) {
    // Sleeper returns a fully-formed but zeroed week for games that have not been played.
    const scored = rows.filter((row) => row.matchup_id !== null);
    if (!scored.length || scored.every((row) => scoreOf(row) === 0)) continue;
    weeks.set(week, scored);
    lastScoredWeek = Math.max(lastScoredWeek, week);
  }

  return {
    meta: { leagueId: league.league_id, season: league.season, complete: league.status === "complete", playoffWeekStart, lastScoredWeek },
    league, users, rosters, weeks, bracket,
  };
}

/** Pair a week's rows by `matchup_id`, dropping byes and orphaned halves. */
function pairWeek(rows: SleeperMatchup[]): [SleeperMatchup, SleeperMatchup][] {
  const byMatchup = new Map<number, SleeperMatchup[]>();
  for (const row of rows) {
    if (row.matchup_id === null) continue;
    const bucket = byMatchup.get(row.matchup_id);
    if (bucket) bucket.push(row);
    else byMatchup.set(row.matchup_id, [row]);
  }
  return [...byMatchup.values()].filter((pair): pair is [SleeperMatchup, SleeperMatchup] => pair.length === 2);
}

/**
 * Final placements come from the bracket's placement games: `p: 1` is the championship, so its
 * winner finished 1st and its loser 2nd, and the same holds for the 3rd- and 5th-place games.
 */
function placementsFrom(bracket: SleeperBracketGame[], rosterToOwner: Map<number, string>): Map<string, number> {
  const placements = new Map<string, number>();
  for (const game of bracket) {
    if (!game.p || game.w === null || game.l === null) continue;
    const winner = rosterToOwner.get(game.w);
    const loser = rosterToOwner.get(game.l);
    if (winner) placements.set(winner, game.p);
    if (loser) placements.set(loser, game.p + 1);
  }
  return placements;
}

/** The longest run of consecutive results matching `want`, over games already in chronological order. */
function longestStreak(games: { won: boolean; season: string; week: number }[], want: boolean): { length: number; season: string; startWeek: number; endWeek: number } | null {
  let best: { length: number; season: string; startWeek: number; endWeek: number } | null = null;
  let run: typeof games = [];

  const flush = () => {
    if (run.length && (!best || run.length > best.length)) {
      best = { length: run.length, season: run[0].season, startWeek: run[0].week, endWeek: run[run.length - 1].week };
    }
  };
  for (const game of games) {
    // A streak is broken by a different result *or* by crossing into a new season.
    if (game.won === want && (!run.length || run[run.length - 1].season === game.season)) run.push(game);
    else { flush(); run = game.won === want ? [game] : []; }
  }
  flush();
  return best;
}

export async function getLeagueHistory(leagueId: string, source: LeagueSource = liveSource): Promise<LeagueHistory> {
  const [chain, state] = await Promise.all([collectSeasonIds(leagueId, source), source.getNflState()]);
  if (!chain.length) throw new Error("League history unavailable");

  const currentWeek = Math.max(1, state.week ?? state.display_week ?? 1);
  const loaded = await Promise.all(chain.map((league, index) => loadSeason(league, currentWeek, index === 0, source)));
  const resolved = loaded.filter((bundle): bundle is SeasonBundle => bundle !== null);
  // Newest first. A season with no scored weeks still contributes its roster of managers and a
  // column to the placements grid — that is how the live preseason shows up as "TBD".
  const bundles = resolved.filter((bundle) => bundle.weeks.size > 0);
  if (!resolved.length) throw new Error("League history unavailable");

  // ---- Identity: owner_id is stable across seasons, the team name is not. -------------------
  const nameByOwner = new Map<string, { name: string; manager: string; avatar: string | null }>();
  // Bundles run newest first, so the first name seen for an owner is their latest.
  for (const bundle of resolved) {
    for (const user of bundle.users) {
      if (nameByOwner.has(user.user_id)) continue;
      nameByOwner.set(user.user_id, { name: user.metadata?.team_name || user.display_name || user.username, manager: user.display_name || user.username, avatar: user.avatar });
    }
  }
  const activeOwners = new Set(resolved[0].rosters.map((roster) => roster.owner_id).filter((id): id is string => Boolean(id)));

  // ---- Replay every week of every season ---------------------------------------------------
  const games: HistoryGame[] = [];
  const scoreLines: ScoreLine[] = [];
  /** Per owner, per season: the running regular-season line. */
  const seasonLines = new Map<string, Map<string, SeasonEntry & { expectedWins: number; medianWeeks: number; weeks: number }>>();
  // Every resolved season, newest first — scoreless live seasons included.
  const seasonMeta: HistorySeason[] = resolved.map((bundle) => bundle.meta);

  for (const bundle of [...bundles].reverse()) {
    const { season, playoffWeekStart } = bundle.meta;
    const rosterToOwner = new Map(bundle.rosters.map((roster) => [roster.roster_id, roster.owner_id ?? `roster-${roster.roster_id}`]));

    for (const week of [...bundle.weeks.keys()].toSorted((a, b) => a - b)) {
      const rows = bundle.weeks.get(week) ?? [];
      const playoff = week >= playoffWeekStart;
      const weekScores = rows.map((row) => ({ ownerId: rosterToOwner.get(row.roster_id) ?? `roster-${row.roster_id}`, points: scoreOf(row) })).filter((entry) => entry.points > 0);

      for (const entry of weekScores) {
        const identity = nameByOwner.get(entry.ownerId);
        scoreLines.push({ ownerId: entry.ownerId, name: identity?.name ?? "Unknown", season, week, points: entry.points });
      }

      for (const [home, away] of pairWeek(rows)) {
        const homeOwner = rosterToOwner.get(home.roster_id);
        const awayOwner = rosterToOwner.get(away.roster_id);
        if (!homeOwner || !awayOwner) continue;
        games.push({ season, week, playoff, homeOwner, awayOwner, homeScore: scoreOf(home), awayScore: scoreOf(away) });
      }

      // Expected wins and median rate are regular-season-only: a 6-team playoff week has no league median.
      if (playoff || weekScores.length < 2) continue;
      const sorted = [...weekScores].toSorted((a, b) => b.points - a.points);
      const middle = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 ? sorted[middle].points : (sorted[middle - 1].points + sorted[middle].points) / 2;

      for (const entry of weekScores) {
        const bySeason = seasonLines.get(entry.ownerId) ?? new Map();
        seasonLines.set(entry.ownerId, bySeason);
        const line = bySeason.get(season) ?? { season, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, regularSeasonRank: 0, finalRank: null, champion: false, expectedWins: 0, medianWeeks: 0, weeks: 0 };
        // Beating N of the other N teams is worth N/(N-1) of a win in a league of that size.
        line.expectedWins += weekScores.filter((other) => other.ownerId !== entry.ownerId && entry.points > other.points).length / (weekScores.length - 1);
        if (entry.points > median) line.medianWeeks += 1;
        line.weeks += 1;
        bySeason.set(season, line);
      }
    }

    // Regular-season W/L comes from the games themselves so it stays consistent with everything else.
    for (const game of games.filter((entry) => entry.season === season && !entry.playoff)) {
      for (const [ownerId, own, opponent] of [[game.homeOwner, game.homeScore, game.awayScore], [game.awayOwner, game.awayScore, game.homeScore]] as const) {
        const line = seasonLines.get(ownerId)?.get(season);
        if (!line) continue;
        line.pointsFor += own;
        line.pointsAgainst += opponent;
        if (own > opponent) line.wins += 1;
        else if (own < opponent) line.losses += 1;
        else line.ties += 1;
      }
    }

    // Rank the season, then overlay the bracket's final placements.
    const placements = placementsFrom(bundle.bracket, rosterToOwner);
    const ranked = [...seasonLines.entries()]
      .map(([ownerId, bySeason]) => ({ ownerId, line: bySeason.get(season) }))
      .filter((entry): entry is { ownerId: string; line: NonNullable<typeof entry.line> } => Boolean(entry.line))
      .toSorted((a, b) => b.line.wins - a.line.wins || b.line.pointsFor - a.line.pointsFor);

    ranked.forEach((entry, index) => {
      entry.line.regularSeasonRank = index + 1;
      const placement = placements.get(entry.ownerId);
      // Only a finished season has a final placement; a live one keeps `null` and renders as TBD.
      if (bundle.meta.complete && placement) {
        entry.line.finalRank = placement;
        entry.line.champion = placement === 1;
      }
    });
  }

  // A manager whose only season has not kicked off yet still belongs in the league — seed an
  // empty line so they appear in the standings and placements grid at 0-0 rather than vanishing.
  for (const bundle of resolved) {
    if (bundle.weeks.size > 0) continue;
    for (const roster of bundle.rosters) {
      if (!roster.owner_id) continue;
      const bySeason = seasonLines.get(roster.owner_id) ?? new Map();
      seasonLines.set(roster.owner_id, bySeason);
      if (!bySeason.has(bundle.meta.season)) {
        bySeason.set(bundle.meta.season, { season: bundle.meta.season, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, regularSeasonRank: 0, finalRank: null, champion: false, expectedWins: 0, medianWeeks: 0, weeks: 0 });
      }
    }
  }

  // ---- Aggregate managers -------------------------------------------------------------------
  const headToHead = new Map<string, HeadToHead>();
  const bump = (a: string, b: string, result: "win" | "loss" | "tie") => {
    const key = `${a}:${b}`;
    const cell = headToHead.get(key) ?? { wins: 0, losses: 0, ties: 0 };
    if (result === "win") cell.wins += 1;
    else if (result === "loss") cell.losses += 1;
    else cell.ties += 1;
    headToHead.set(key, cell);
  };
  for (const game of games) {
    const result = game.homeScore > game.awayScore ? "win" : game.homeScore < game.awayScore ? "loss" : "tie";
    bump(game.homeOwner, game.awayOwner, result);
    bump(game.awayOwner, game.homeOwner, result === "win" ? "loss" : result === "loss" ? "win" : "tie");
  }

  const managers: ManagerRow[] = [...seasonLines.entries()].map(([ownerId, bySeason]) => {
    const identity = nameByOwner.get(ownerId) ?? { name: "Unknown manager", manager: "Unknown", avatar: null };
    const lines = [...bySeason.values()].toSorted((a, b) => Number(b.season) - Number(a.season));
    const total = lines.reduce(
      (sum, line) => ({
        wins: sum.wins + line.wins, losses: sum.losses + line.losses, ties: sum.ties + line.ties,
        pointsFor: sum.pointsFor + line.pointsFor, pointsAgainst: sum.pointsAgainst + line.pointsAgainst,
        expectedWins: sum.expectedWins + line.expectedWins, medianWeeks: sum.medianWeeks + line.medianWeeks, weeks: sum.weeks + line.weeks,
      }),
      { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, expectedWins: 0, medianWeeks: 0, weeks: 0 },
    );
    const played = total.wins + total.losses + total.ties;
    return {
      ownerId, name: identity.name, manager: identity.manager, avatar: identity.avatar,
      active: activeOwners.has(ownerId),
      wins: total.wins, losses: total.losses, ties: total.ties,
      pointsFor: total.pointsFor, pointsAgainst: total.pointsAgainst, games: played,
      pointsPerGame: played ? total.pointsFor / played : 0,
      winPct: played ? (total.wins + total.ties / 2) / played : 0,
      championships: lines.filter((line) => line.champion).length,
      // Sleeper's brackets are top-6, so a final placement at all means the manager made it.
      playoffAppearances: lines.filter((line) => line.finalRank !== null && line.finalRank <= 6).length,
      winsAboveExpected: total.wins - total.expectedWins,
      managerEfficiency: total.weeks ? total.medianWeeks / total.weeks : 0,
      // The three running accumulators are aggregate-only; the public season line drops them.
      seasons: lines.map((line): SeasonEntry => ({ season: line.season, wins: line.wins, losses: line.losses, ties: line.ties, pointsFor: line.pointsFor, pointsAgainst: line.pointsAgainst, regularSeasonRank: line.regularSeasonRank, finalRank: line.finalRank, champion: line.champion })),
    };
  }).toSorted((a, b) => b.winPct - a.winPct || b.pointsFor - a.pointsFor);

  // ---- Record book ---------------------------------------------------------------------------
  const nameOf = (ownerId: string) => nameByOwner.get(ownerId)?.name ?? "Unknown";
  const margins: MarginLine[] = games.map((game) => {
    const homeWon = game.homeScore >= game.awayScore;
    return {
      season: game.season, week: game.week, margin: Math.abs(game.homeScore - game.awayScore),
      winnerName: nameOf(homeWon ? game.homeOwner : game.awayOwner),
      loserName: nameOf(homeWon ? game.awayOwner : game.homeOwner),
      winnerScore: homeWon ? game.homeScore : game.awayScore,
      loserScore: homeWon ? game.awayScore : game.homeScore,
    };
  }).filter((line) => line.winnerScore > 0 && line.loserScore > 0);

  const seasonTotals = managers.flatMap((row) => row.seasons.map((line) => ({ name: row.name, season: line.season, points: line.pointsFor, wins: line.wins, losses: line.losses })));
  // A season still being played has fewer games, so it cannot fairly hold a season-total record.
  const finishedSeasons = new Set(seasonMeta.filter((entry) => entry.complete).map((entry) => entry.season));
  const completeTotals = seasonTotals.filter((entry) => finishedSeasons.has(entry.season) && entry.points > 0);

  const chronological = (ownerId: string) =>
    games
      .filter((game) => game.homeOwner === ownerId || game.awayOwner === ownerId)
      .toSorted((a, b) => Number(a.season) - Number(b.season) || a.week - b.week)
      .map((game) => {
        const own = game.homeOwner === ownerId ? game.homeScore : game.awayScore;
        const other = game.homeOwner === ownerId ? game.awayScore : game.homeScore;
        return { won: own > other, season: game.season, week: game.week };
      });

  let longestWinStreak: StreakLine | null = null;
  let longestLossStreak: StreakLine | null = null;
  for (const row of managers) {
    const timeline = chronological(row.ownerId);
    const win = longestStreak(timeline, true);
    const loss = longestStreak(timeline, false);
    if (win && (!longestWinStreak || win.length > longestWinStreak.length)) longestWinStreak = { name: row.name, ...win };
    if (loss && (!longestLossStreak || loss.length > longestLossStreak.length)) longestLossStreak = { name: row.name, ...loss };
  }

  const byPoints = [...scoreLines].filter((line) => line.points > 0).toSorted((a, b) => b.points - a.points);
  const byMargin = [...margins].toSorted((a, b) => a.margin - b.margin);
  const bestSeason = [...completeTotals].toSorted((a, b) => b.points - a.points)[0] ?? null;
  const worstSeason = [...completeTotals].toSorted((a, b) => a.points - b.points)[0] ?? null;
  const bestRecord = [...completeTotals].toSorted((a, b) => b.wins - a.wins || a.losses - b.losses)[0] ?? null;
  const worstRecord = [...completeTotals].toSorted((a, b) => b.losses - a.losses || a.wins - b.wins)[0] ?? null;

  const records: RecordBook = {
    mostPointsSeason: bestSeason && { name: bestSeason.name, season: bestSeason.season, points: bestSeason.points },
    fewestPointsSeason: worstSeason && { name: worstSeason.name, season: worstSeason.season, points: worstSeason.points },
    bestRecord: bestRecord && { name: bestRecord.name, season: bestRecord.season, wins: bestRecord.wins, losses: bestRecord.losses },
    worstRecord: worstRecord && { name: worstRecord.name, season: worstRecord.season, wins: worstRecord.wins, losses: worstRecord.losses },
    longestWinStreak, longestLossStreak,
    // The loser's side of the highest-scoring game, and the winner's side of the lowest-scoring one.
    highestScoringLoss: [...margins].toSorted((a, b) => b.loserScore - a.loserScore)[0] ?? null,
    lowestScoringWin: [...margins].toSorted((a, b) => a.winnerScore - b.winnerScore)[0] ?? null,
    biggestBlowout: [...margins].toSorted((a, b) => b.margin - a.margin)[0] ?? null,
    closestMatchup: byMargin[0] ?? null,
  };

  return {
    leagueId,
    name: resolved[0].league.name,
    seasons: seasonMeta,
    managers,
    headToHead,
    records,
    topScores: byPoints.slice(0, 10),
    lowScores: [...byPoints].reverse().slice(0, 10),
    closestMatchups: byMargin.slice(0, 6),
    biggestBlowouts: [...margins].toSorted((a, b) => b.margin - a.margin).slice(0, 6),
    singleSeason: seasonMeta.length <= 1,
  };
}
