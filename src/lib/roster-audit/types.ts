export type Attribution = { text: string; url: string };
export type RaPreset = { key: string; label: string; formatKey: string; isSuperflex: boolean; isTep: boolean; scoringFormat: string; leagueSize: number; reliable: boolean };
export type RaPlayerValue = { sleeperId: string; name: string; position: string; team: string | null; age: number | null; tier: number | null; value: number; valueSf: number | null; value1qb: number | null; rankOverall: number | null; rankPosition: number | null; trend7d: number; trend30d: number; photoUrl: string | null; yearsExp: number | null };
export type RaPick = { id: number; season: number; round: number; slot: "early" | "mid" | "late"; label: string; valueSf: number; value1qb: number; sortOrder: number };
/**
 * What a rookie pick is worth *by its overall draft slot* — pick 1 through 60, keyed by pick number.
 *
 * Distinct from `RaPick`, which prices a tradeable future pick ("2026 Early 1st") before the order
 * is known. This curve prices a slot that has already been used, which is the only honest benchmark
 * for grading a pick after the fact.
 */
export type RaPickCurve = { sf: Record<number, number>; oneQb: Record<number, number> };
export type RaMovers = { risers: RaPlayerValue[]; fallers: RaPlayerValue[]; updated: string | null };
export type RaPaged<T> = { items: T[]; total: number; page: number; perPage: number; totalPages: number; preset: string; presetLabel: string };
export type RaResult<T> = { ok: true; data: T; attribution: Attribution } | { ok: false; error: RaError };
export type RaError = { kind: "missing-key" | "rejected-key" | "unsynced-league" | "no-history" | "rate-limited" | "upstream-unavailable" | "invalid-response"; message: string; retryable: boolean };
/** Request-side asset. `id` is a Sleeper player id; picks are described, not identified. */
export type TradeAssetInput = { type: "player"; id: string } | { type: "pick"; season: number; round: number; slot: "early" | "mid" | "late" };
export type RaTradePlayerAsset = { type: "player"; sleeperId: string; name: string; position: string; team: string | null; age: number | null; value: number; rankOverall: number | null; rankPosition: number | null; trend7d: number; trend30d: number; tier: number | null; photoUrl: string | null; buyLow: boolean; sellHigh: boolean };
export type RaTradePickAsset = { type: "pick"; season: number; round: number; slot: "early" | "mid" | "late"; label: string; value: number };
export type RaTradeAsset = RaTradePlayerAsset | RaTradePickAsset;
export type RaTradeSide = { assets: RaTradeAsset[]; value: number };
/** `grade` rates how even the deal is and is the same for both sides. `winner` is null when the sides are even. */
export type RaTradeVerdict = { winner: "sideA" | "sideB" | null; grade: string; difference: number; differencePct: number };
export type RaCliffFactor = { factor: string; severity: string; detail: string };
export type RaCliffWarning = { sleeperId: string; name: string; position: string; riskLevel: string; riskScore: number; summary: string; factors: RaCliffFactor[]; side: string };
export type RaTrade = { sideA: RaTradeSide; sideB: RaTradeSide; verdict: RaTradeVerdict; cliffWarnings: RaCliffWarning[]; calculatedAt: string };

export type PlayerProfileIdentity = { sleeperId: string; name: string; position: string; team: string | null; age: number | null; yearsExp: number | null; college: string | null; heightInches: number | null; weightLbs: number | null; photoUrl: string | null };
/** Both formats survive mapping on purpose: `sf ?? 1qb` was a live bug (API reference §2.8). */
export type PlayerProfileValue = { valueSf: number; value1qb: number; tier: number | null; tierLabel: string | null; rankOverallSf: number | null; rankOverall1qb: number | null; rankPositionSf: number | null; rankPosition1qb: number | null; trend7d: number; trend30d: number };
export type PlayerValuePoint = { date: string; valueSf: number; value1qb: number };
export type PlayerCliffFactor = { factor: string; severity: string; detail: string };
export type PlayerCliffRisk = { level: string; score: number; recommendation: string | null; factors: PlayerCliffFactor[] };
/** `stats` is position-dependent, so it stays an open record; a null cell means "not measured". */
export type PlayerWeeklyLine = { week: number; opponent: string | null; points: number | null; pointsPpr: number | null; stats: Record<string, number | null> };
export type PlayerCareerSeason = { season: number | null; stats: Record<string, number | null> };
export type PlayerProjectionSeason = { season: number; games: number | null; ppgStandard: number | null; ppgPpr: number | null; stats: Record<string, number | null> };
/** One monthly point of the career arc. Ranks ride along so the chart can plot value or rank. */
export type PlayerHistoryPoint = { date: string; value: number; rankOverall: number | null; rankPosition: number | null };
/** A percentile placement among positional peers, with the players immediately around it. */
export type PlayerRankMetric = { key: string; label: string; rank: number; of: number; value: number | null; percentile: number | null; isElite: boolean; lowerIsBetter: boolean; why: string | null; above: string[]; below: string[] };
export type PlayerWeeklyRank = { week: number; rank: number; of: number };
export type PlayerProjectionPoint = { year: number; value: number; confidence: string; isActual: boolean };
export type PlayerOutcomeLeg = { finish: string | null; value: number | null };
export type PlayerOutcomeRange = { p90: PlayerOutcomeLeg | null; p50: PlayerOutcomeLeg | null; p10: PlayerOutcomeLeg | null; breakoutPct: number | null; bustPct: number | null; strategy: string | null; archetype: string | null; risk: number | null };
export type PlayerInjuryEvent = { season: number | null; week: number | null; title: string; bodyPart: string | null; severity: string | null; gamesMissed: number | null; detail: string | null };
export type PlayerPreNflInjury = { year: number | null; description: string; significance: string | null };
/** `grade`/`score` are RosterAudit's durability rating, not a per-injury field. */
export type PlayerInjuryHistory = { grade: string | null; score: number | null; events: PlayerInjuryEvent[]; preNfl: PlayerPreNflInjury[] };
export type PlayerContract = { years: number | null; yearsLeft: number | null; expiryYear: number | null; totalValue: number | null; apy: number | null; guaranteed: number | null; team: string | null; isRookieDeal: boolean; isExpiring: boolean; otcUrl: string | null };
export type PlayerCombine = { season: string | null; draftTeam: string | null; draftRound: string | null; draftPick: string | null; school: string | null; forty: string | null; vertical: string | null; broadJump: string | null; cone: string | null; shuttle: string | null; bench: string | null };
export type PlayerSnapWeek = { week: number; offensePct: number | null; offenseSnaps: number | null; opponent: string | null };
export type PlayerTradeAsset = { players: { id: string; name: string; position: string | null }[]; picks: { season: string; round: number }[] };
export type PlayerRecentTrade = { id: string; date: string | null; format: string | null; cost: PlayerTradeAsset; alongside: PlayerTradeAsset };
export type PlayerTradeMarket = { trades: PlayerRecentTrade[]; totalTrades: number | null; avgCost: number | null; medianCost: number | null };
export type PlayerRelatedPlayer = { sleeperId: string; name: string; position: string; team: string | null; valueSf: number | null; age: number | null };
export type PlayerRelated = { teammates: PlayerRelatedPlayer[]; sameTier: PlayerRelatedPlayer[]; similarValue: PlayerRelatedPlayer[] };

export type PlayerProfile = {
  player: PlayerProfileIdentity; value: PlayerProfileValue; valueHistory: PlayerValuePoint[]; cliffRisk: PlayerCliffRisk | null;
  season: number | null; weekly: PlayerWeeklyLine[]; summary: Record<string, number | null> | null; career: PlayerCareerSeason[]; projections: PlayerProjectionSeason[];
  /** The career arc, one point per month — empty for a player with no rostered history. */
  history: PlayerHistoryPoint[];
  rankMetrics: PlayerRankMetric[]; weeklyRanks: PlayerWeeklyRank[]; rankSeason: number | null;
  projectionCurve: PlayerProjectionPoint[]; projectionSummary: string | null; outcome: PlayerOutcomeRange | null; projectedPpg: number | null; projectedPpgPpr: number | null;
  injury: PlayerInjuryHistory | null; contract: PlayerContract | null; combine: PlayerCombine | null;
  snapsWeekly: PlayerSnapWeek[]; avgSnapPct: number | null;
  advanced: Record<string, number | null>;
  tradeMarket: PlayerTradeMarket | null; related: PlayerRelated | null;
};

/**
 * One manager's career across every season RosterAudit has crawled for the league group.
 *
 * The league-history endpoints span *all* seasons of a league lineage, so this list runs
 * longer than the current roster count — managers who have since left are still in it.
 */
export type RaManagerCareer = {
  userId: string;
  displayName: string;
  avatar: string | null;
  seasonsPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
  championships: number;
  runnerUps: number;
  lastPlaces: number;
  playoffAppearances: number;
  playoffWins: number;
  playoffLosses: number;
};

/** One season of a manager's career. `maxPointsFor` is the optimal-lineup total, so
 * `pointsFor / maxPointsFor` is the lineup efficiency RosterAudit never surfaces. */
export type RaManagerSeason = {
  season: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Optimal-lineup points. Null when RosterAudit did not compute it for the season. */
  maxPointsFor: number | null;
  finalStanding: number | null;
  madePlayoffs: boolean;
  wonChampionship: boolean;
};

/** A manager's career totals plus the per-season rows that carry lineup efficiency. */
export type RaManagerDossier = { totals: RaManagerCareer; seasons: RaManagerSeason[] };

/** One past meeting between two managers. */
export type RaH2hMeeting = { season: number; week: number; isPlayoff: boolean; label: string; scoreA: number; scoreB: number; winnerUserId: string | null };

/** The rivalry record between two managers across every synced season. */
export type RaH2h = {
  userIdA: string;
  userIdB: string;
  nameA: string;
  nameB: string;
  meetings: number;
  winsA: number;
  winsB: number;
  draws: number;
  pointsA: number;
  pointsB: number;
  games: RaH2hMeeting[];
};
