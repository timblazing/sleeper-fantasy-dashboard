import { buildSchedule, type ScheduledGame } from "@/lib/playoff-odds";
import { findTeamForUser, getLeagueValueContext, type LeagueTeam } from "@/lib/league-values";
import { liveSource, type LeagueSource } from "@/lib/league-source";
import { getNflLeaguesForUsername } from "@/lib/sleeper";
import type { SleeperAccount, SleeperMatchup } from "@/lib/types";

/** How many of the most recent weeks count as "form". */
const FORM_WEEKS = 3;

/**
 * Weights of the composite. They sum to 1, so a rating is directly readable as a
 * 0–100 percentile blend rather than an arbitrary point total.
 *
 * Scoring leads because points scored is the least luck-dependent signal a fantasy
 * season produces: a team's weekly total is unaffected by which opponent it drew.
 * Record is deliberately second — it answers "what happened" but bakes in schedule
 * luck. Form and value are the forward-looking half, and consistency is a small
 * tiebreaker rewarding teams that do not need a boom week to win.
 */
const WEIGHTS = { scoring: 0.3, record: 0.24, form: 0.2, value: 0.18, consistency: 0.08 } as const;

export type PowerTier = "elite" | "contender" | "middle" | "fading" | "bottom";

export type PowerRow = {
  rosterId: number;
  name: string;
  manager: string;
  avatar: string | null;
  isUser: boolean;
  rank: number;
  /** Composite score, 0–100. */
  rating: number;
  tier: PowerTier;
  /** Places gained (+) or lost (−) versus the same rating a week ago. Null before week 2. */
  delta: number | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Mean points per game across played weeks. */
  ppg: number;
  /** Mean points per game over the last `FORM_WEEKS` played weeks. */
  formPpg: number;
  /** Win/loss over the recent window, e.g. "2–1". */
  formRecord: string;
  /** Most recent weeks first: true = won. */
  formResults: boolean[];
  /** Coefficient-of-variation-based steadiness, 0–100. Higher = more predictable. */
  consistency: number;
  /** Roster trade value in the league's format. 0 when RosterAudit has no data. */
  value: number;
  valueRank: number;
  /** Where the team sits by record alone, for the luck read. */
  recordRank: number;
  /** recordRank − rank. Positive means the standings flatter them. */
  luck: number;
  /** Percentile components behind `rating`, each 0–100. */
  parts: { scoring: number; record: number; form: number; value: number; consistency: number };
};

export type PowerRankings = {
  rows: PowerRow[];
  teams: number;
  weeksPlayed: number;
  /** False before any game is played — ratings are then a pure roster-value read. */
  started: boolean;
  /** True when RosterAudit values were available; the value column is hidden without them. */
  hasValues: boolean;
  formWeeks: number;
  leagueName: string;
  season: string;
  account?: SleeperAccount;
  myRosterId?: number;
};

/** One team's games in played order. */
type TeamGames = { scores: number[]; opponentScores: number[]; weeks: number[] };

const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

/**
 * Percentile of a value within a set, 0–100. A league is a dozen teams at most, so
 * ranking against the actual field says more than a z-score against an assumed normal:
 * it keeps every component on the same 0–100 footing regardless of its raw units.
 */
function percentile(value: number, all: number[]): number {
  if (all.length <= 1) return 50;
  const below = all.filter((other) => other < value).length;
  const equal = all.filter((other) => other === value).length;
  return ((below + (equal - 1) / 2) / (all.length - 1)) * 100;
}

/** Steadiness as 100 − coefficient of variation, clamped. One game cannot be judged, so it reads neutral. */
function steadiness(scores: number[]): number {
  if (scores.length < 2) return 50;
  const average = mean(scores);
  if (average <= 0) return 50;
  const variance = mean(scores.map((score) => (score - average) ** 2));
  const cv = Math.sqrt(variance) / average;
  return Math.max(0, Math.min(100, 100 - cv * 250));
}

/** Collect each roster's played games from the rebuilt schedule, oldest first. */
export function collectTeamGames(schedule: ScheduledGame[], rosterIds: number[]): Map<number, TeamGames> {
  const byRoster = new Map<number, TeamGames>(rosterIds.map((id) => [id, { scores: [], opponentScores: [], weeks: [] }]));

  for (const game of schedule.filter((entry) => entry.played).toSorted((a, b) => a.week - b.week)) {
    const home = byRoster.get(game.home);
    if (home) {
      home.scores.push(game.homeScore);
      home.opponentScores.push(game.awayScore);
      home.weeks.push(game.week);
    }
    const away = byRoster.get(game.away);
    if (away) {
      away.scores.push(game.awayScore);
      away.opponentScores.push(game.homeScore);
      away.weeks.push(game.week);
    }
  }

  return byRoster;
}

type RatedTeam = {
  team: LeagueTeam;
  games: TeamGames;
  ppg: number;
  formPpg: number;
  formResults: boolean[];
  consistency: number;
  winPct: number;
};

/** Everything derived from a team's own games, before any cross-league comparison. */
function rate(team: LeagueTeam, games: TeamGames): RatedTeam {
  const played = games.scores.length;
  const window = Math.min(FORM_WEEKS, played);
  const recentScores = games.scores.slice(-window);
  const recentOpponents = games.opponentScores.slice(-window);
  // Most recent first, so the UI can render the dots left-to-right as newest-to-oldest.
  const formResults = recentScores.map((score, index) => score > recentOpponents[index]).toReversed();
  const decided = team.wins + team.losses + team.ties;

  return {
    team,
    games,
    ppg: played ? mean(games.scores) : 0,
    // Before any game is played the "recent" window is empty; season ppg (also 0) is the honest answer.
    formPpg: window ? mean(recentScores) : 0,
    formResults,
    consistency: steadiness(games.scores),
    winPct: decided ? (team.wins + team.ties * 0.5) / decided : 0.5,
  };
}

/** Assemble one row per team, given the whole field's percentile context. */
function buildRows(rated: RatedTeam[], hasValues: boolean, started: boolean, myRosterId?: number): PowerRow[] {
  const scoringAll = rated.map((entry) => entry.ppg);
  const recordAll = rated.map((entry) => entry.winPct);
  const formAll = rated.map((entry) => entry.formPpg);
  const valueAll = rated.map((entry) => entry.team.value);
  const steadyAll = rated.map((entry) => entry.consistency);

  // Before kickoff only roster value carries information, so the composite collapses onto it
  // rather than ranking a whole league of identical 0–0 teams by percentile noise.
  const weights = started ? WEIGHTS : { scoring: 0, record: 0, form: 0, value: 1, consistency: 0 };

  const scored = rated.map((entry) => {
    const parts = {
      scoring: percentile(entry.ppg, scoringAll),
      record: percentile(entry.winPct, recordAll),
      form: percentile(entry.formPpg, formAll),
      // A league RosterAudit does not cover would otherwise hand every team the same value
      // percentile; treating it as neutral keeps it from diluting the live components.
      value: hasValues ? percentile(entry.team.value, valueAll) : 50,
      consistency: percentile(entry.consistency, steadyAll),
    };
    const rating =
      parts.scoring * weights.scoring +
      parts.record * weights.record +
      parts.form * weights.form +
      parts.value * weights.value +
      parts.consistency * weights.consistency;
    return { entry, parts, rating };
  });

  const recordOrder = rated
    .toSorted((a, b) => b.winPct - a.winPct || b.team.pointsFor - a.team.pointsFor)
    .map((entry) => entry.team.rosterId);

  return scored
    .toSorted((a, b) => b.rating - a.rating || b.entry.ppg - a.entry.ppg)
    .map(({ entry, parts, rating }, index) => {
      const rank = index + 1;
      const recordRank = recordOrder.indexOf(entry.team.rosterId) + 1;
      const wins = entry.formResults.filter(Boolean).length;

      return {
        rosterId: entry.team.rosterId,
        name: entry.team.name,
        manager: entry.team.manager,
        avatar: entry.team.avatar,
        isUser: entry.team.rosterId === myRosterId,
        rank,
        rating: Math.round(rating * 10) / 10,
        tier: tierFor(rank, rated.length),
        delta: null,
        wins: entry.team.wins,
        losses: entry.team.losses,
        ties: entry.team.ties,
        pointsFor: entry.team.pointsFor,
        pointsAgainst: entry.team.pointsAgainst,
        ppg: entry.ppg,
        formPpg: entry.formPpg,
        formRecord: `${wins}–${entry.formResults.length - wins}`,
        formResults: entry.formResults,
        consistency: Math.round(entry.consistency),
        value: entry.team.value,
        valueRank: entry.team.valueRank,
        recordRank,
        luck: recordRank - rank,
        parts,
      };
    });
}

/** Top sixth is elite, then contenders through the median, and the mirror image below. */
function tierFor(rank: number, teams: number): PowerTier {
  if (teams <= 1) return "middle";
  const pct = (rank - 1) / (teams - 1);
  if (pct <= 0.17) return "elite";
  if (pct <= 0.42) return "contender";
  if (pct <= 0.58) return "middle";
  if (pct <= 0.83) return "fading";
  return "bottom";
}

/**
 * The league ranked by how it is actually playing.
 *
 * Movement is computed by re-running the same rating on the season minus its most recent
 * week and diffing the two orders, so the arrow shown against a team is the real change in
 * its standing rather than a stored snapshot the app would have to keep between deploys.
 */
export async function getPowerRankings(leagueId: string, username?: string, source: LeagueSource = liveSource): Promise<PowerRankings> {
  const [context, account] = await Promise.all([
    getLeagueValueContext(leagueId, source),
    username ? getNflLeaguesForUsername(username).catch(() => undefined) : undefined,
  ]);

  const playoffWeekStart = context.league.settings.playoff_week_start || 15;
  const finalWeek = Math.max(1, playoffWeekStart - 1);

  const weeks = await Promise.all(
    Array.from({ length: finalWeek }, (_, index) => index + 1).map(async (week) => ({
      week,
      matchups: await source.getMatchups(leagueId, week).catch(() => [] as SleeperMatchup[]),
    })),
  );

  const schedule = buildSchedule(weeks, context.week);
  const playedWeeks = [...new Set(schedule.filter((game) => game.played).map((game) => game.week))].toSorted((a, b) => a - b);
  const started = playedWeeks.length > 0;
  const team = findTeamForUser(context, account?.userId);
  const rosterIds = context.teams.map((entry) => entry.rosterId);

  const games = collectTeamGames(schedule, rosterIds);
  const rated = context.teams.map((entry) => rate(entry, games.get(entry.rosterId) ?? { scores: [], opponentScores: [], weeks: [] }));
  const rows = buildRows(rated, context.valuesReady, started, team?.rosterId);

  // Last week's order comes from the same function on a truncated season, which keeps the two
  // rankings comparable — a rating computed a different way would produce phantom movement.
  if (playedWeeks.length > 1) {
    const priorWeek = playedWeeks.at(-1)!;
    const priorSchedule = schedule.map((game) => (game.week >= priorWeek ? { ...game, played: false } : game));
    const priorGames = collectTeamGames(priorSchedule, rosterIds);
    const priorRated = context.teams.map((entry) => {
      const own = priorGames.get(entry.rosterId) ?? { scores: [], opponentScores: [], weeks: [] };
      // Wins and points come off the live roster settings, which include the latest week, so the
      // prior-week record is rebuilt from that team's own truncated results instead.
      const wins = own.scores.filter((score, index) => score > own.opponentScores[index]).length;
      const losses = own.scores.filter((score, index) => score < own.opponentScores[index]).length;
      const ties = own.scores.length - wins - losses;
      return rate({ ...entry, wins, losses, ties, pointsFor: own.scores.reduce((sum, score) => sum + score, 0) }, own);
    });
    const priorRank = new Map(buildRows(priorRated, context.valuesReady, true).map((row) => [row.rosterId, row.rank]));
    for (const row of rows) {
      const before = priorRank.get(row.rosterId);
      if (before !== undefined) row.delta = before - row.rank;
    }
  }

  return {
    rows,
    teams: context.teams.length,
    weeksPlayed: playedWeeks.length,
    started,
    hasValues: context.valuesReady,
    formWeeks: Math.min(FORM_WEEKS, playedWeeks.length),
    leagueName: context.league.name,
    season: context.league.season,
    account,
    myRosterId: team?.rosterId,
  };
}
