import { findTeamForUser, getLeagueValueContext, type LeagueTeam } from "@/lib/league-values";
import { buildBracket, type PlayoffBracket } from "@/lib/playoff-bracket";
import { liveSource, type LeagueSource } from "@/lib/league-source";
import { getNflLeaguesForUsername } from "@/lib/sleeper";
import type { SleeperAccount, SleeperBracketGame, SleeperMatchup } from "@/lib/types";

/** One scheduled head-to-head, resolved once the week is played. */
export type ScheduledGame = { week: number; home: number; away: number; homeScore: number; awayScore: number; played: boolean };

export type PlayoffOutlook = "locked" | "likely" | "bubble" | "longshot" | "eliminated";

export type PlayoffRow = {
  rosterId: number;
  name: string;
  manager: string;
  avatar: string | null;
  division: number;
  isUser: boolean;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  /** Mean scoring level the simulation drew this team's weekly totals around. */
  ppg: number;
  /** Simulated share of runs where the team made the bracket, 0–100. */
  playoffOdds: number;
  /** Simulated share of runs where the team won the title, 0–100. */
  titleOdds: number;
  /** Simulated share of runs where the team earned a first-round bye, 0–100. */
  byeOdds: number;
  /** Mean final seed across every run. */
  averageSeed: number;
  /** Mean regular-season wins across every run. */
  projectedWins: number;
  /** 10th and 90th percentile of final wins — the realistic range. */
  winRange: [number, number];
  /** Probability of finishing in each seed, index 0 = seed 1. Sums to ~100. */
  seedOdds: number[];
  outlook: PlayoffOutlook;
};

export type PlayoffPicture = {
  teams: number;
  playoffTeams: number;
  /** Number of teams that receive a first-round bye, 0 when the bracket is full. */
  byeTeams: number;
  playoffWeekStart: number;
  /** Last week of the regular season. */
  finalWeek: number;
  currentWeek: number;
  /** Weeks with results already in the books. */
  weeksPlayed: number;
  weeksRemaining: number;
  /** False before any game is played — odds are then a pure roster-strength read. */
  started: boolean;
  simulations: number;
  rows: PlayoffRow[];
  /** Games still to play for the connected team, with a win probability each. */
  remainingSchedule: RemainingGame[];
  /** Sleeper's own bracket for the season. Null when the league has not published one. */
  winnersBracket: PlayoffBracket | null;
  losersBracket: PlayoffBracket | null;
  /** The connected team's road to the title. Null when no team is connected. */
  path: PathAnalysis | null;
  account?: SleeperAccount;
  myRosterId?: number;
  leagueName: string;
  season: string;
};

export type RemainingGame = { week: number; opponentRosterId: number; opponent: string; opponentAvatar: string | null; winProbability: number };

/** One bracket round on the tracked team's path, as a survival step. */
export type PathRound = {
  round: number;
  /** Share of qualifying runs in which the team was still alive to play this round, 0–100. */
  reachOdds: number;
  /** Share of *those* runs in which it advanced, 0–100. */
  winOdds: number;
};

/** A team that stands between the tracked team and the trophy. */
export type PathThreat = {
  rosterId: number;
  name: string;
  /** Share of qualifying runs in which this team was met somewhere in the bracket, 0–100. */
  meetOdds: number;
  /** Share of those meetings the tracked team won, 0–100. */
  beatOdds: number;
};

export type PathAnalysis = {
  rosterId: number;
  playoffOdds: number;
  titleOdds: number;
  /** Title odds conditional on making the bracket — the "if I get in" number. */
  titleOddsIfQualified: number;
  rounds: PathRound[];
  threats: PathThreat[];
};

const SIMULATIONS = 10_000;

/**
 * Weekly fantasy scores are roughly normal around a team's mean. The spread is what makes
 * fantasy football fantasy football: a ~26-point standard deviation on a ~110-point mean is
 * why a better roster still loses a third of its games.
 */
const SCORE_STDDEV = 26;

/** Mulberry32 — a small seeded PRNG so a given league always simulates to the same odds. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller, returning one standard normal draw per call. */
function normal(random: () => number): number {
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Rebuild the season schedule from Sleeper's weekly matchup payloads.
 *
 * Sleeper pairs teams by a shared `matchup_id` within a week and reports no explicit home
 * side, so the lower roster id is treated as home; nothing downstream depends on which is which.
 */
export function buildSchedule(weeks: { week: number; matchups: SleeperMatchup[] }[], currentWeek: number): ScheduledGame[] {
  const games: ScheduledGame[] = [];

  for (const { week, matchups } of weeks) {
    const byPairing = new Map<number, SleeperMatchup[]>();
    for (const entry of matchups) {
      if (entry.matchup_id === null) continue;
      const bucket = byPairing.get(entry.matchup_id);
      if (bucket) bucket.push(entry);
      else byPairing.set(entry.matchup_id, [entry]);
    }

    for (const pair of byPairing.values()) {
      if (pair.length !== 2) continue;
      const [first, second] = pair.toSorted((a, b) => a.roster_id - b.roster_id);
      // A week counts as played only once it is behind us and actually produced points.
      const played = week < currentWeek && (first.points > 0 || second.points > 0);
      games.push({
        week,
        home: first.roster_id,
        away: second.roster_id,
        homeScore: first.points ?? 0,
        awayScore: second.points ?? 0,
        played,
      });
    }
  }

  return games.toSorted((a, b) => a.week - b.week);
}

type SimTeam = {
  rosterId: number;
  ppg: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  division: number;
};

/**
 * A team's expected weekly score.
 *
 * Actual scoring is the honest signal but takes weeks to stabilise, so it is blended with the
 * roster-value read — which is available in week 0 — on a weight that slides toward results as
 * the sample grows. With no values and no games, everyone is average and the odds fall back to
 * seeding noise rather than pretending to know something.
 */
function expectedPpg(team: LeagueTeam, valueScale: number | null, leagueAvgPpg: number): number {
  const games = team.wins + team.losses + team.ties;
  const actual = games ? team.pointsFor / games : null;
  // Roster value maps onto a ±12% scoring swing around the league average.
  const fromValue = valueScale === null ? leagueAvgPpg : leagueAvgPpg * (1 + valueScale * 0.12);
  if (actual === null) return fromValue;
  const weight = Math.min(1, games / 8);
  return actual * weight + fromValue * (1 - weight);
}

/** Seed the bracket: division winners first when the league runs divisions, then by record. */
function seedOrder(teams: SimTeam[], divisions: number): SimTeam[] {
  const byRecord = (a: SimTeam, b: SimTeam) => {
    const aWinPct = (a.wins + a.ties * 0.5) / Math.max(1, a.wins + a.losses + a.ties);
    const bWinPct = (b.wins + b.ties * 0.5) / Math.max(1, b.wins + b.losses + b.ties);
    if (aWinPct !== bWinPct) return bWinPct - aWinPct;
    return b.pointsFor - a.pointsFor;
  };

  if (divisions < 2) return teams.toSorted(byRecord);

  // Sleeper seeds every division winner ahead of every wildcard.
  const winners = new Map<number, SimTeam>();
  for (const team of teams) {
    const current = winners.get(team.division);
    if (!current || byRecord(team, current) < 0) winners.set(team.division, team);
  }
  const champs = [...winners.values()].toSorted(byRecord);
  const rest = teams.filter((team) => !winners.has(team.division) || winners.get(team.division) !== team).toSorted(byRecord);
  return [...champs, ...rest];
}

/**
 * Watches one simulated bracket, called once per game with both participants and the winner.
 *
 * The path analysis needs to know *who a team met and whether it survived*, which the champion's
 * roster id alone cannot answer. Passing an observer keeps that bookkeeping out of the hot loop
 * for every caller that only wants title odds.
 */
type BracketObserver = (game: { round: number; home: SimTeam; away: SimTeam; winner: SimTeam }) => void;

/**
 * Play out a seeded single-elimination bracket and return the winner's roster id.
 *
 * Byes go to the top seeds whenever the field is not a power of two, matching Sleeper's
 * default bracket. Each game is decided by the same scoring model as the regular season.
 */
function simulateBracket(field: SimTeam[], byeTeams: number, random: () => number, observe?: BracketObserver): number {
  let round = field.slice();
  let roundNumber = 1;
  // The bye round: top seeds advance untouched, the rest play in.
  if (byeTeams > 0 && round.length > byeTeams) {
    const byes = round.slice(0, byeTeams);
    const playIn = round.slice(byeTeams);
    const survivors: SimTeam[] = [];
    for (let index = 0; index < Math.floor(playIn.length / 2); index += 1) {
      const home = playIn[index];
      const away = playIn[playIn.length - 1 - index];
      const winner = playGame(home, away, random);
      observe?.({ round: roundNumber, home, away, winner });
      survivors.push(winner);
    }
    round = [...byes, ...survivors];
    roundNumber += 1;
  }

  while (round.length > 1) {
    const next: SimTeam[] = [];
    for (let index = 0; index < Math.floor(round.length / 2); index += 1) {
      const home = round[index];
      const away = round[round.length - 1 - index];
      const winner = playGame(home, away, random);
      observe?.({ round: roundNumber, home, away, winner });
      next.push(winner);
    }
    // An odd bracket size advances the middle seed rather than dropping it.
    if (round.length % 2 === 1) next.push(round[Math.floor(round.length / 2)]);
    round = next;
    roundNumber += 1;
  }

  return round[0]?.rosterId ?? field[0].rosterId;
}

function playGame(home: SimTeam, away: SimTeam, random: () => number): SimTeam {
  const homeScore = home.ppg + normal(random) * SCORE_STDDEV;
  const awayScore = away.ppg + normal(random) * SCORE_STDDEV;
  return homeScore >= awayScore ? home : away;
}

const percentile = (sorted: number[], fraction: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * fraction)))];

function classify(playoffOdds: number, started: boolean): PlayoffOutlook {
  if (!started) return playoffOdds >= 70 ? "likely" : playoffOdds >= 35 ? "bubble" : "longshot";
  if (playoffOdds >= 99) return "locked";
  if (playoffOdds >= 70) return "likely";
  if (playoffOdds >= 25) return "bubble";
  if (playoffOdds >= 1) return "longshot";
  return "eliminated";
}

/**
 * Monte Carlo the rest of the regular season and the bracket that follows it.
 *
 * Every run replays each unplayed game, re-seeds on the resulting records, and plays the
 * bracket out, so playoff, bye, seed and title odds all fall out of the same set of runs and
 * stay consistent with one another.
 */
export function simulatePlayoffs(
  teams: LeagueTeam[],
  schedule: ScheduledGame[],
  options: { playoffTeams: number; divisions: number; simulations?: number; seed?: number; divisionByRoster?: Map<number, number> },
): Map<number, Omit<PlayoffRow, "name" | "manager" | "avatar" | "isUser" | "division" | "wins" | "losses" | "ties" | "pointsFor">> {
  const runs = options.simulations ?? SIMULATIONS;
  const random = createRandom(options.seed ?? 1);
  const playoffTeams = Math.max(2, Math.min(teams.length, options.playoffTeams));
  // Byes fill the gap up to the next power of two — a 6-team field gives the top 2 a bye.
  const bracketSize = 2 ** Math.ceil(Math.log2(playoffTeams));
  const byeTeams = bracketSize - playoffTeams;

  const games = teams.map((team) => team.wins + team.losses + team.ties);
  const measured = teams.map((team, index) => (games[index] ? team.pointsFor / games[index] : null)).filter((value): value is number => value !== null);
  const leagueAvgPpg = measured.length ? measured.reduce((sum, value) => sum + value, 0) / measured.length : 110;

  const values = teams.map((team) => team.value || 0);
  const valueMax = Math.max(...values);
  const valueMin = Math.min(...values);
  const valueSpread = valueMax - valueMin;
  const scales = values.map((value) => (valueSpread ? ((value - valueMin) / valueSpread) * 2 - 1 : null));

  const base: SimTeam[] = teams.map((team, index) => ({
    rosterId: team.rosterId,
    ppg: expectedPpg(team, scales[index], leagueAvgPpg),
    wins: team.wins,
    losses: team.losses,
    ties: team.ties,
    pointsFor: team.pointsFor,
    division: options.divisionByRoster?.get(team.rosterId) ?? 0,
  }));
  const ppgByRoster = new Map(base.map((team) => [team.rosterId, team.ppg]));

  const remaining = schedule.filter((game) => !game.played);
  const tally = new Map(teams.map((team) => [team.rosterId, {
    made: 0,
    titles: 0,
    byes: 0,
    seedSum: 0,
    seedCounts: new Array(teams.length).fill(0) as number[],
    winTotals: [] as number[],
  }]));

  for (let run = 0; run < runs; run += 1) {
    const state = new Map(base.map((team) => [team.rosterId, { ...team }]));

    for (const game of remaining) {
      const home = state.get(game.home);
      const away = state.get(game.away);
      if (!home || !away) continue;
      const homeScore = home.ppg + normal(random) * SCORE_STDDEV;
      const awayScore = away.ppg + normal(random) * SCORE_STDDEV;
      home.pointsFor += homeScore;
      away.pointsFor += awayScore;
      if (homeScore > awayScore) { home.wins += 1; away.losses += 1; }
      else { away.wins += 1; home.losses += 1; }
    }

    const seeded = seedOrder([...state.values()], options.divisions);
    for (let index = 0; index < seeded.length; index += 1) {
      const record = tally.get(seeded[index].rosterId);
      if (!record) continue;
      record.seedSum += index + 1;
      record.seedCounts[index] += 1;
      record.winTotals.push(seeded[index].wins);
      if (index < playoffTeams) record.made += 1;
      if (index < byeTeams) record.byes += 1;
    }

    const champion = simulateBracket(seeded.slice(0, playoffTeams), byeTeams, random);
    const winner = tally.get(champion);
    if (winner) winner.titles += 1;
  }

  const started = schedule.some((game) => game.played);
  const result = new Map<number, Omit<PlayoffRow, "name" | "manager" | "avatar" | "isUser" | "division" | "wins" | "losses" | "ties" | "pointsFor">>();
  for (const team of teams) {
    const record = tally.get(team.rosterId);
    if (!record) continue;
    const sortedWins = record.winTotals.toSorted((a, b) => a - b);
    const playoffOdds = (record.made / runs) * 100;
    result.set(team.rosterId, {
      rosterId: team.rosterId,
      ppg: ppgByRoster.get(team.rosterId) ?? leagueAvgPpg,
      playoffOdds,
      titleOdds: (record.titles / runs) * 100,
      byeOdds: (record.byes / runs) * 100,
      averageSeed: record.seedSum / runs,
      projectedWins: record.winTotals.reduce((sum, value) => sum + value, 0) / runs,
      winRange: [percentile(sortedWins, 0.1), percentile(sortedWins, 0.9)],
      seedOdds: record.seedCounts.map((count) => (count / runs) * 100),
      outlook: classify(playoffOdds, started),
    });
  }

  return result;
}

/** Win probability for a single game between two mean scoring levels. */
export function winProbability(mine: number, theirs: number): number {
  // The difference of two normals is normal with a √2-scaled spread.
  const z = (mine - theirs) / (SCORE_STDDEV * Math.SQRT2);
  // Logistic approximation to the normal CDF — within a point of exact across the useful range.
  return (1 / (1 + Math.exp(-1.702 * z))) * 100;
}

/**
 * Simulate one team's road to the title: who it runs into, and how often it gets past them.
 *
 * This re-runs the same Monte Carlo as `simulatePlayoffs` but records, for the tracked team,
 * every bracket opponent it drew and whether it survived that game. The regular-season half is
 * identical, so the qualification rate this produces matches the race table's playoff odds.
 */
export function simulatePlayoffPath(
  teams: LeagueTeam[],
  schedule: ScheduledGame[],
  rosterId: number,
  options: { playoffTeams: number; divisions: number; simulations?: number; seed?: number; divisionByRoster?: Map<number, number> },
): PathAnalysis | null {
  if (!teams.some((team) => team.rosterId === rosterId)) return null;

  const runs = options.simulations ?? SIMULATIONS;
  const random = createRandom(options.seed ?? 1);
  const playoffTeams = Math.max(2, Math.min(teams.length, options.playoffTeams));
  const byeTeams = 2 ** Math.ceil(Math.log2(playoffTeams)) - playoffTeams;

  const games = teams.map((team) => team.wins + team.losses + team.ties);
  const measured = teams.map((team, index) => (games[index] ? team.pointsFor / games[index] : null)).filter((value): value is number => value !== null);
  const leagueAvgPpg = measured.length ? measured.reduce((sum, value) => sum + value, 0) / measured.length : 110;
  const values = teams.map((team) => team.value || 0);
  const valueSpread = Math.max(...values) - Math.min(...values);
  const valueMin = Math.min(...values);
  const scales = values.map((value) => (valueSpread ? ((value - valueMin) / valueSpread) * 2 - 1 : null));

  const base: SimTeam[] = teams.map((team, index) => ({
    rosterId: team.rosterId,
    ppg: expectedPpg(team, scales[index], leagueAvgPpg),
    wins: team.wins,
    losses: team.losses,
    ties: team.ties,
    pointsFor: team.pointsFor,
    division: options.divisionByRoster?.get(team.rosterId) ?? 0,
  }));

  const remaining = schedule.filter((game) => !game.played);
  // Per opponent: how often we met them in a bracket at all, and how often we won that game.
  const met = new Map<number, { faced: number; beat: number }>();
  // Per bracket round: how often we were still alive to play it, and how often we advanced.
  const byRound = new Map<number, { reached: number; won: number }>();
  let qualified = 0;
  let titles = 0;

  for (let run = 0; run < runs; run += 1) {
    const state = new Map(base.map((team) => [team.rosterId, { ...team }]));

    for (const game of remaining) {
      const home = state.get(game.home);
      const away = state.get(game.away);
      if (!home || !away) continue;
      const homeScore = home.ppg + normal(random) * SCORE_STDDEV;
      const awayScore = away.ppg + normal(random) * SCORE_STDDEV;
      home.pointsFor += homeScore;
      away.pointsFor += awayScore;
      if (homeScore > awayScore) { home.wins += 1; away.losses += 1; }
      else { away.wins += 1; home.losses += 1; }
    }

    const seeded = seedOrder([...state.values()], options.divisions);
    const field = seeded.slice(0, playoffTeams);
    if (!field.some((team) => team.rosterId === rosterId)) {
      // Still play the bracket out so the shared PRNG stream stays aligned with the odds run.
      simulateBracket(field, byeTeams, random);
      continue;
    }
    qualified += 1;

    const champion = simulateBracket(field, byeTeams, random, ({ round, home, away, winner }) => {
      if (home.rosterId !== rosterId && away.rosterId !== rosterId) return;
      const opponent = home.rosterId === rosterId ? away : home;
      const entry = met.get(opponent.rosterId) ?? { faced: 0, beat: 0 };
      entry.faced += 1;
      if (winner.rosterId === rosterId) entry.beat += 1;
      met.set(opponent.rosterId, entry);

      const roundEntry = byRound.get(round) ?? { reached: 0, won: 0 };
      roundEntry.reached += 1;
      if (winner.rosterId === rosterId) roundEntry.won += 1;
      byRound.set(round, roundEntry);
    });
    if (champion === rosterId) titles += 1;
  }

  const nameByRoster = new Map(teams.map((team) => [team.rosterId, team]));
  const threats: PathThreat[] = [...met.entries()]
    .map(([opponentId, entry]) => ({
      rosterId: opponentId,
      name: nameByRoster.get(opponentId)?.name ?? `Roster ${opponentId}`,
      // Share of *our* bracket runs in which this team stood in the way at some point.
      meetOdds: qualified ? (entry.faced / qualified) * 100 : 0,
      beatOdds: entry.faced ? (entry.beat / entry.faced) * 100 : 0,
    }))
    .toSorted((a, b) => b.meetOdds - a.meetOdds);

  const rounds: PathRound[] = [...byRound.entries()]
    .toSorted((a, b) => a[0] - b[0])
    .map(([round, entry]) => ({
      round,
      // Denominated in qualifying runs, so the series reads as a survival curve.
      reachOdds: qualified ? (entry.reached / qualified) * 100 : 0,
      winOdds: entry.reached ? (entry.won / entry.reached) * 100 : 0,
    }));

  return {
    rosterId,
    playoffOdds: (qualified / runs) * 100,
    titleOdds: (titles / runs) * 100,
    // The question a manager actually asks in week 10: "if I get in, can I win it?"
    titleOddsIfQualified: qualified ? (titles / qualified) * 100 : 0,
    rounds,
    threats,
  };
}

export async function getPlayoffPicture(leagueId: string, username?: string, source: LeagueSource = liveSource): Promise<PlayoffPicture> {
  const [context, account] = await Promise.all([
    getLeagueValueContext(leagueId, source),
    username ? getNflLeaguesForUsername(username).catch(() => undefined) : undefined,
  ]);

  const playoffWeekStart = context.league.settings.playoff_week_start || 15;
  const finalWeek = Math.max(1, playoffWeekStart - 1);
  const playoffTeams = context.league.settings.playoff_teams || 6;
  const divisions = context.league.settings.divisions ?? 0;

  const [weeks, winnersGames, losersGames] = await Promise.all([
    Promise.all(
      Array.from({ length: finalWeek }, (_, index) => index + 1).map(async (week) => ({
        week,
        matchups: await source.getMatchups(leagueId, week).catch(() => [] as SleeperMatchup[]),
      })),
    ),
    // A league with no bracket published yet simply renders no bracket card.
    source.getWinnersBracket(leagueId).catch(() => [] as SleeperBracketGame[]),
    source.getLosersBracket(leagueId).catch(() => [] as SleeperBracketGame[]),
  ]);

  const schedule = buildSchedule(weeks, context.week);
  const team = findTeamForUser(context, account?.userId) ?? null;
  const divisionByRoster = new Map([...context.base.teamByRoster].map(([rosterId, identity]) => [rosterId, identity.division]));
  // One seed for both simulations, so the path analysis and the race table describe the same season.
  const seed = Number(leagueId.slice(-8)) || 1;
  const simulated = simulatePlayoffs(context.teams, schedule, { playoffTeams, divisions, divisionByRoster, seed });

  const rows: PlayoffRow[] = context.teams
    .map((entry) => {
      const sim = simulated.get(entry.rosterId);
      return {
        ...(sim ?? {
          ppg: 0, playoffOdds: 0, titleOdds: 0, byeOdds: 0, averageSeed: 0,
          projectedWins: 0, winRange: [0, 0] as [number, number],
          seedOdds: [], outlook: "bubble" as PlayoffOutlook,
        }),
        rosterId: entry.rosterId,
        name: entry.name,
        manager: entry.manager === "Unassigned" ? entry.name : entry.manager,
        avatar: entry.avatar,
        division: divisionByRoster.get(entry.rosterId) ?? 0,
        isUser: entry.rosterId === team?.rosterId,
        wins: entry.wins,
        losses: entry.losses,
        ties: entry.ties,
        pointsFor: entry.pointsFor,
      };
    })
    .toSorted((a, b) => b.playoffOdds - a.playoffOdds || b.titleOdds - a.titleOdds);

  const ppgByRoster = new Map(rows.map((row) => [row.rosterId, row.ppg]));
  const nameByRoster = new Map(rows.map((row) => [row.rosterId, row]));
  const remainingSchedule: RemainingGame[] = team
    ? schedule
        .filter((game) => !game.played && (game.home === team.rosterId || game.away === team.rosterId))
        .map((game) => {
          const opponentId = game.home === team.rosterId ? game.away : game.home;
          const opponent = nameByRoster.get(opponentId);
          return {
            week: game.week,
            opponentRosterId: opponentId,
            opponent: opponent?.name ?? `Roster ${opponentId}`,
            opponentAvatar: opponent?.avatar ?? null,
            winProbability: winProbability(ppgByRoster.get(team.rosterId) ?? 0, ppgByRoster.get(opponentId) ?? 0),
          };
        })
    : [];

  const weeksPlayed = new Set(schedule.filter((game) => game.played).map((game) => game.week)).size;

  const path = team ? simulatePlayoffPath(context.teams, schedule, team.rosterId, { playoffTeams, divisions, divisionByRoster, seed }) : null;

  return {
    winnersBracket: buildBracket(winnersGames, rows, "winners"),
    losersBracket: buildBracket(losersGames, rows, "losers"),
    path,
    teams: context.teams.length,
    playoffTeams,
    byeTeams: 2 ** Math.ceil(Math.log2(Math.max(2, playoffTeams))) - playoffTeams,
    playoffWeekStart,
    finalWeek,
    currentWeek: context.week,
    weeksPlayed,
    weeksRemaining: Math.max(0, finalWeek - weeksPlayed),
    started: schedule.some((game) => game.played),
    simulations: SIMULATIONS,
    rows,
    remainingSchedule,
    account,
    myRosterId: team?.rosterId,
    leagueName: context.league.name,
    season: context.league.season,
  };
}
