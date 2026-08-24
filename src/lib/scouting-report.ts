import { getLeagueValueContext, ROOM_POSITIONS, type LeagueTeam, type RoomPosition } from "@/lib/league-values";
import { liveSource, type LeagueSource } from "@/lib/league-source";
import { getHeadToHead, getLeagueManagers, getManagerCareer } from "@/lib/roster-audit";
import { getLeagueLineage, getLeagueRosters, getUserLeagues } from "@/lib/sleeper";
import type { NflPlayer, SleeperDraftPick, SleeperTransaction } from "@/lib/types";

/**
 * The GM Scouting Report: every opponent profiled from how they have actually behaved, not
 * from how their roster looks today.
 *
 * Roster strength is already covered by Power Rankings. What this module adds is *tendency* —
 * how often a manager trades, when they are reachable, what they overpay for, and where their
 * roster forces them to shop. Those signals only exist in history, so the read walks the league
 * lineage (`previous_league_id`) rather than the current season alone: one season of a 12-team
 * league is a few dozen moves, three seasons is several hundred, which is the difference between
 * noise and a profile.
 */

/** How strongly a signal should be trusted, from the size of the sample behind it. */
export type SignalStrength = "strong" | "moderate" | "weak";
/** Which section of the dossier an insight belongs to, mirroring the four scouting lenses. */
export type InsightGroup = "needs" | "trades" | "cross-league" | "edge";
export type InsightTone = "positive" | "warning" | "critical" | "neutral";

export type ScoutInsight = {
  id: string;
  group: InsightGroup;
  /** Short uppercase tag on the card — "ROSTER HOLE", "TRADE BIAS", "PLAYER CRUSH". */
  label: string;
  tone: InsightTone;
  strength: SignalStrength;
  title: string;
  detail: string;
  /** False for anything derived from the manager's *other* leagues. */
  thisLeague: boolean;
};

/** Where a manager sits in the compete/rebuild cycle, which decides what they will pay for. */
export type Window = "Contender" | "Fringe" | "Rebuilding";

/** How a manager's trade volume compares to the league. */
export type TradeStyle = "Hyperactive" | "Active" | "Selective" | "Inactive";

export type ManagerTendencies = {
  /** Completed trades across the scanned lineage. */
  trades: number;
  tradesPerYear: number;
  /** 1 = most trades in the league. */
  tradeRank: number;
  style: TradeStyle;
  /** Players acquired minus players sent in trades. Negative = a net seller of bodies. */
  netPlayerFlow: number;
  /** Draft picks acquired minus picks sent. */
  netPickFlow: number;
  waiverClaims: number;
  faabSpent: number;
  /** 0–6, Sunday-indexed, of non-trade activity. Says when an offer will actually be read. */
  activityByDay: number[];
  busiestDay: string | null;
  /** Non-trade moves per season. */
  movesPerYear: number;
  /** Roster ids this manager has completed a trade with, most frequent first. */
  partners: { rosterId: number; manager: string; trades: number }[];
  seasonsScanned: number;
};

/** Positional bias in rookie drafts — what they reach for when left alone with a pick. */
export type DraftTendency = { position: RoomPosition | "Other"; picks: number; share: number };

/** How much of their scoring ceiling a manager actually starts. */
export type LineupEfficiency = {
  /** `pointsFor / maxPointsFor`, 0–1, averaged over seasons that reported both. */
  rate: number;
  /** 1 = best lineup manager in the league. */
  rank: number;
  /** Points left on the bench per season. */
  pointsLostPerSeason: number;
  seasons: number;
};

/** The rivalry line against the connected manager. */
export type HeadToHead = { meetings: number; wins: number; losses: number; pointsFor: number; pointsAgainst: number; lastMeeting: string | null };

/** A position room ranked against the league, which is what makes a manager a buyer. */
export type RoomNeed = { position: RoomPosition; rank: number; value: number; leagueAvg: number; starterCount: number };

/** One repeated holding across a manager's other leagues. */
export type PlayerCrush = { player: NflPlayer; leagues: number; ofLeagues: number };

export type ManagerProfile = {
  rosterId: number;
  userId: string | null;
  name: string;
  manager: string;
  avatar: string | null;
  isUser: boolean;
  /** 0–100. How much there is for *you* to gain by working this manager. */
  leverage: number;
  window: Window;
  record: { wins: number; losses: number; ties: number };
  valueRank: number;
  teams: number;
  /** The single sentence at the top of the dossier. Null for the self scout. */
  play: string | null;
  needs: RoomNeed[];
  surpluses: RoomNeed[];
  tendencies: ManagerTendencies;
  draftTendencies: DraftTendency[];
  efficiency: LineupEfficiency | null;
  headToHead: HeadToHead | null;
  crushes: PlayerCrush[];
  /** How many of this manager's other leagues were scanned. 0 = cross-league unavailable. */
  otherLeagues: number;
  insights: ScoutInsight[];
  /** Career line from RosterAudit, when the league is synced. */
  career: { seasons: number; winPct: number; championships: number; playoffAppearances: number } | null;
};

/** One edge of the trade network — a pair who have completed deals. */
export type TradeLink = { a: number; b: number; trades: number };

export type ScoutingReport = {
  league: { id: string; name: string; season: string; teams: number; superflex: boolean };
  /** Null when no ?username= is connected. Everything comparative degrades gracefully without it. */
  userRosterId: number | null;
  username?: string;
  profiles: ManagerProfile[];
  /** Every league id whose history fed the profiles, newest first. */
  lineage: string[];
  seasonsScanned: number;
  /** Pair-level trade counts across the lineage, for the network view. */
  network: TradeLink[];
  /** One-line read on the trade market right now. */
  marketSummary: string;
  /** Counts behind `marketSummary`, for the filter chips. */
  marketCounts: { rebuilding: number; contending: number; fringe: number };
  valuesReady: boolean;
  historyReady: boolean;
  crossLeagueReady: boolean;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** How many prior seasons of behaviour to walk. Three is where trade cadence stops being noise. */
const LINEAGE_LIMIT = 3;
/** Sleeper files transactions per week; dynasty offseason moves land in low weeks. */
const MAX_WEEK = 18;
/**
 * Cross-league scanning costs one roster fetch per league per manager, so it dominates a cold
 * load (12 managers x this cap). Four is enough leagues to tell a genuine preference from a
 * coincidence while keeping the whole page's first visit near a hundred requests; every result
 * is cached, so repeat visits pay none of it.
 */
const CROSS_LEAGUE_CAP = 4;
/** A player held in at least this share of a manager's leagues reads as a genuine preference. */
const CRUSH_MIN_LEAGUES = 2;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const pct = (value: number) => `${Math.round(value * 100)}%`;

/** Sample-size gate shared by every insight, so "strong signal" means the same thing everywhere. */
function strengthFor(sample: number, strong: number, moderate: number): SignalStrength {
  return sample >= strong ? "strong" : sample >= moderate ? "moderate" : "weak";
}

export type Lineage = { leagueId: string; transactions: SleeperTransaction[]; draftPicks: SleeperDraftPick[] };

/**
 * Every completed transaction and rookie pick across the lineage.
 *
 * Weeks are fetched in parallel per season but seasons run in sequence, so a league with no
 * history costs one season's worth of requests rather than the cap's worth.
 */
async function readLineage(leagueIds: string[], source: LeagueSource): Promise<Lineage[]> {
  return Promise.all(leagueIds.map(async (leagueId) => {
    const weeks = await Promise.all(
      Array.from({ length: MAX_WEEK }, (_, index) => source.getTransactions(leagueId, index + 1).catch(() => [] as SleeperTransaction[])),
    );
    const drafts = await source.getLeagueDrafts(leagueId).catch(() => []);
    const draftPicks = (await Promise.all(drafts.map((draft) => source.getDraftPicks(draft.draft_id).catch(() => [] as SleeperDraftPick[])))).flat();
    return { leagueId, transactions: weeks.flat().filter((entry) => entry.status === "complete"), draftPicks };
  }));
}

/**
 * Trade and waiver behaviour per roster.
 *
 * Roster ids are stable across a Sleeper dynasty's seasons, which is what lets moves from an
 * earlier league id be attributed to the manager who sits in that seat today.
 */
export function buildTendencies(lineage: Lineage[], teams: LeagueTeam[]): Map<number, ManagerTendencies> {
  const seasons = Math.max(1, lineage.length);
  const nameByRoster = new Map(teams.map((team) => [team.rosterId, team.manager]));
  const blank = () => ({ trades: 0, adds: 0, sends: 0, picksIn: 0, picksOut: 0, waivers: 0, faab: 0, days: Array(7).fill(0) as number[], partners: new Map<number, number>(), moves: 0 });
  const raw = new Map<number, ReturnType<typeof blank>>(teams.map((team) => [team.rosterId, blank()]));

  for (const season of lineage) {
    for (const entry of season.transactions) {
      if (entry.type === "trade") {
        for (const rosterId of entry.roster_ids ?? []) {
          const stats = raw.get(rosterId);
          if (!stats) continue;
          stats.trades += 1;
          // Everyone else on the ticket is a partner; a multi-team deal counts each pairing once.
          for (const other of entry.roster_ids ?? []) if (other !== rosterId) stats.partners.set(other, (stats.partners.get(other) ?? 0) + 1);
        }
        // In a trade Sleeper records the receiving roster in `adds` and the sending one in `drops`.
        for (const target of Object.values(entry.adds ?? {})) { const stats = raw.get(target); if (stats) stats.adds += 1; }
        for (const sender of Object.values(entry.drops ?? {})) { const stats = raw.get(sender); if (stats) stats.sends += 1; }
        for (const pick of entry.draft_picks ?? []) {
          if (pick.owner_id != null) { const stats = raw.get(pick.owner_id); if (stats) stats.picksIn += 1; }
          if (pick.previous_owner_id != null) { const stats = raw.get(pick.previous_owner_id); if (stats) stats.picksOut += 1; }
        }
        continue;
      }
      // Non-trade activity: who is working the wire, and when.
      for (const rosterId of entry.roster_ids ?? []) {
        const stats = raw.get(rosterId);
        if (!stats) continue;
        stats.moves += 1;
        stats.days[new Date(entry.created).getDay()] += 1;
        if (entry.type === "waiver") { stats.waivers += 1; stats.faab += entry.settings?.waiver_bid ?? 0; }
      }
    }
  }

  const tradeCounts = [...raw.entries()].map(([rosterId, stats]) => [rosterId, stats.trades] as const);
  const leagueAvgTrades = tradeCounts.reduce((sum, [, count]) => sum + count, 0) / Math.max(1, tradeCounts.length);

  const result = new Map<number, ManagerTendencies>();
  for (const [rosterId, stats] of raw) {
    const perYear = stats.trades / seasons;
    const busiest = stats.days.indexOf(Math.max(...stats.days));
    result.set(rosterId, {
      trades: stats.trades,
      tradesPerYear: perYear,
      tradeRank: 1 + tradeCounts.filter(([, count]) => count > stats.trades).length,
      // Graded against this league's own pace: "active" in a quiet league is a different number.
      style: stats.trades === 0 ? "Inactive" : stats.trades >= leagueAvgTrades * 1.5 ? "Hyperactive" : stats.trades >= leagueAvgTrades * 0.75 ? "Active" : "Selective",
      netPlayerFlow: stats.adds - stats.sends,
      netPickFlow: stats.picksIn - stats.picksOut,
      waiverClaims: stats.waivers,
      faabSpent: stats.faab,
      activityByDay: stats.days,
      busiestDay: stats.moves >= 5 ? DAY_NAMES[busiest] : null,
      movesPerYear: stats.moves / seasons,
      partners: [...stats.partners.entries()]
        .map(([partner, trades]) => ({ rosterId: partner, manager: nameByRoster.get(partner) ?? `Roster ${partner}`, trades }))
        .toSorted((a, b) => b.trades - a.trades),
      seasonsScanned: seasons,
    });
  }
  return result;
}

/** Rookie-draft positional bias, by the roster that used the pick. */
function buildDraftTendencies(lineage: Lineage[]): Map<number, DraftTendency[]> {
  const byRoster = new Map<number, Map<string, number>>();
  for (const season of lineage) {
    for (const pick of season.draftPicks) {
      const position = pick.metadata?.position;
      if (!position) continue;
      const slot = (ROOM_POSITIONS as readonly string[]).includes(position) ? position : "Other";
      const counts = byRoster.get(pick.roster_id) ?? new Map<string, number>();
      counts.set(slot, (counts.get(slot) ?? 0) + 1);
      byRoster.set(pick.roster_id, counts);
    }
  }
  const result = new Map<number, DraftTendency[]>();
  for (const [rosterId, counts] of byRoster) {
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    result.set(rosterId, [...counts.entries()]
      .map(([position, picks]) => ({ position: position as DraftTendency["position"], picks, share: total ? picks / total : 0 }))
      .toSorted((a, b) => b.picks - a.picks));
  }
  return result;
}

/** Pair-level trade counts, deduplicated so each pairing appears once. */
export function buildNetwork(lineage: Lineage[]): TradeLink[] {
  const links = new Map<string, TradeLink>();
  for (const season of lineage) {
    for (const entry of season.transactions) {
      if (entry.type !== "trade") continue;
      const rosters = [...new Set(entry.roster_ids ?? [])].toSorted((a, b) => a - b);
      for (let i = 0; i < rosters.length; i += 1) {
        for (let j = i + 1; j < rosters.length; j += 1) {
          const key = `${rosters[i]}-${rosters[j]}`;
          const existing = links.get(key);
          if (existing) existing.trades += 1;
          else links.set(key, { a: rosters[i], b: rosters[j], trades: 1 });
        }
      }
    }
  }
  return [...links.values()].toSorted((a, b) => b.trades - a.trades);
}

/**
 * Repeated holdings across a manager's *other* leagues.
 *
 * A player a manager rosters everywhere is one they will not sell at market price, which makes
 * this the cheapest way to avoid wasting capital on an offer that was never going to land.
 */
async function buildCrushes(userId: string, season: string, currentLeagueId: string, catalog: Map<string, NflPlayer>): Promise<{ crushes: PlayerCrush[]; scanned: number }> {
  const leagues = await getUserLeagues(userId, season).catch(() => []);
  const others = leagues.filter((league) => league.league_id !== currentLeagueId).slice(0, CROSS_LEAGUE_CAP);
  if (!others.length) return { crushes: [], scanned: 0 };

  const rosterSets = await Promise.all(others.map(async (league) => {
    const rosters = await getLeagueRosters(league.league_id).catch(() => []);
    return rosters.find((roster) => roster.owner_id === userId)?.players ?? [];
  }));
  const scanned = rosterSets.filter((players) => players.length > 0).length;
  if (!scanned) return { crushes: [], scanned: 0 };

  const counts = new Map<string, number>();
  for (const players of rosterSets) for (const id of new Set(players)) counts.set(id, (counts.get(id) ?? 0) + 1);

  const crushes = [...counts.entries()]
    .filter(([, held]) => held >= CRUSH_MIN_LEAGUES)
    .map(([id, held]) => ({ player: catalog.get(id), leagues: held, ofLeagues: scanned }))
    .filter((entry): entry is PlayerCrush => Boolean(entry.player))
    .toSorted((a, b) => b.leagues - a.leagues || (a.player.searchRank ?? 9999) - (b.player.searchRank ?? 9999));
  return { crushes: crushes.slice(0, 6), scanned };
}

/** Rooms ranked against the league, split into what they must buy and what they can sell. */
function roomSplit(team: LeagueTeam, teams: number): { needs: RoomNeed[]; surpluses: RoomNeed[] } {
  const rows: RoomNeed[] = team.rooms.map((room) => ({ position: room.position as RoomPosition, rank: room.rank, value: room.value, leagueAvg: room.leagueAvg, starterCount: room.players }));
  const half = Math.ceil(teams / 2);
  return {
    needs: rows.filter((room) => room.rank > half).toSorted((a, b) => b.rank - a.rank),
    surpluses: rows.filter((room) => room.rank <= Math.max(1, Math.floor(teams / 3))).toSorted((a, b) => a.rank - b.rank),
  };
}

export function windowFor(team: LeagueTeam, teams: number, tendencies: ManagerTendencies): Window {
  const valuePct = teams > 1 ? (teams - team.valueRank) / (teams - 1) : 0.5;
  // Stockpiling picks is the loudest rebuild tell there is — it outranks a flattering value rank.
  if (tendencies.netPickFlow >= 3 && valuePct < 0.7) return "Rebuilding";
  if (valuePct >= 0.6) return "Contender";
  return valuePct >= 0.35 ? "Fringe" : "Rebuilding";
}

/**
 * 0–100 on how much *you* stand to gain from working this manager.
 *
 * Deliberately not a power ranking. A great roster that never trades is worth less of your
 * attention than a mediocre one that answers every offer and needs what you are sitting on, so
 * the score is built from reachability and fit rather than strength.
 */
export function leverageFor(profile: { tendencies: ManagerTendencies; needs: RoomNeed[]; surpluses: RoomNeed[]; window: Window }, userSurpluses: RoomNeed[], userNeeds: RoomNeed[]): number {
  const { tendencies, needs, surpluses, window } = profile;
  // Reachability: a manager who does not trade cannot be leveraged at any price.
  const activity = Math.min(1, tendencies.tradesPerYear / 4);
  if (tendencies.trades === 0) return 0;

  // Complementary fit — their holes against your surplus, and their surplus against your holes.
  const userSurplusPositions = new Set(userSurpluses.map((room) => room.position));
  const userNeedPositions = new Set(userNeeds.map((room) => room.position));
  const sellFit = needs.filter((room) => userSurplusPositions.has(room.position)).length / Math.max(1, needs.length || 1);
  const buyFit = surpluses.filter((room) => userNeedPositions.has(room.position)).length / Math.max(1, surpluses.length || 1);

  // A rebuilder sells veterans cheap and a contender overpays for them; a fringe team does neither.
  const windowBonus = window === "Rebuilding" ? 0.2 : window === "Contender" ? 0.15 : 0;

  const score = activity * 40 + sellFit * 25 + buyFit * 20 + windowBonus * 75;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** The single recommended action at the top of a dossier. */
function playFor(profile: { needs: RoomNeed[]; surpluses: RoomNeed[]; window: Window; tendencies: ManagerTendencies; manager: string }, userSurpluses: RoomNeed[], userNeeds: RoomNeed[], teams: number): string | null {
  if (profile.tendencies.trades === 0) return `No completed trades on record — ${profile.manager} is unlikely to answer. Spend your capital elsewhere.`;
  const sellTarget = profile.needs.find((room) => userSurpluses.some((mine) => mine.position === room.position));
  if (sellTarget) return `Sell ${sellTarget.position} depth into their critical need (ranked #${sellTarget.rank} of ${teams}).`;
  const buyTarget = profile.surpluses.find((room) => userNeeds.some((mine) => mine.position === room.position));
  if (buyTarget) return `Buy ${buyTarget.position} from their surplus — they are #${buyTarget.rank} of ${teams} and can afford to move one.`;
  if (profile.window === "Rebuilding") return `Rebuilding and open for business — offer picks for their remaining veterans.`;
  if (profile.window === "Contender") return `Win-now buyer. Time a veteran offer for their playoff push.`;
  return `No clean positional fit right now. Re-check after their next move.`;
}

/** Every insight card in a dossier, in the order the four lenses are read. */
function buildInsights(args: {
  profile: Omit<ManagerProfile, "insights" | "leverage" | "play">;
  teams: number;
  userSurpluses: RoomNeed[];
  userNeeds: RoomNeed[];
  leagueAvgFaab: number;
  /** Null when no account is connected; used so the user is never described as a third party. */
  userRosterId: number | null;
}): ScoutInsight[] {
  const { profile, teams, userSurpluses, userNeeds, leagueAvgFaab, userRosterId } = args;
  const { tendencies: tend, manager } = profile;
  const insights: ScoutInsight[] = [];
  const seasons = tend.seasonsScanned;

  // ---- What they need -----------------------------------------------------
  for (const room of profile.needs.slice(0, 2)) {
    const mine = userSurpluses.find((entry) => entry.position === room.position);
    insights.push({
      id: `need-${room.position}`,
      group: "needs",
      label: "ROSTER HOLE",
      tone: "critical",
      strength: room.rank >= teams - 1 ? "strong" : "moderate",
      title: `Desperate for ${room.position} (ranked #${room.rank} of ${teams})`,
      detail: `${room.value.toLocaleString("en-US")} against a ${Math.round(room.leagueAvg).toLocaleString("en-US")} league average.${mine ? ` You are #${mine.rank} there — they should be willing to overpay.` : " Critical hole they must address."}`,
      thisLeague: true,
    });
  }

  if (profile.window === "Contender") {
    insights.push({
      id: "window-contend",
      group: "needs",
      label: "TEAM WINDOW",
      tone: "warning",
      strength: "strong",
      title: "Win-now mode — will overpay for missing pieces",
      detail: `#${profile.valueRank} of ${teams} in roster value. During the playoff push they get desperate; time your offer for maximum leverage.`,
      thisLeague: true,
    });
  } else if (profile.window === "Rebuilding") {
    insights.push({
      id: "window-rebuild",
      group: "needs",
      label: "TEAM WINDOW",
      tone: "positive",
      strength: tend.netPickFlow >= 3 ? "strong" : "moderate",
      title: tend.netPickFlow > 0 ? `Rebuilding — has taken on ${plural(tend.netPickFlow, "net pick")}` : "Rebuilding — veterans are available",
      detail: `#${profile.valueRank} of ${teams} in value. Their veterans should come cheap, and they will trade production for youth and picks.`,
      thisLeague: true,
    });
  }

  // ---- How they trade -----------------------------------------------------
  if (tend.trades > 0) {
    insights.push({
      id: "trade-style",
      group: "trades",
      label: "TRADE STYLE",
      tone: tend.style === "Hyperactive" || tend.style === "Active" ? "positive" : "neutral",
      strength: strengthFor(tend.trades, 6, 3),
      title: `${tend.style} trader — ${plural(tend.trades, "deal")} (${tend.tradesPerYear.toFixed(1)}/yr, #${tend.tradeRank} of ${teams} in league)`,
      detail: tend.style === "Inactive"
        ? "Rarely engages. An offer here needs to be obviously in their favour to get a reply."
        : `${tend.style === "Hyperactive" ? "Top of the league by trade volume. Will respond to offers and negotiate aggressively." : "Engages selectively — lead with your best offer rather than a lowball."}`,
      thisLeague: true,
    });

    if (Math.abs(tend.netPlayerFlow) >= 2) {
      const disposer = tend.netPlayerFlow < 0;
      insights.push({
        id: "trade-bias",
        group: "trades",
        label: "TRADE BIAS",
        tone: "neutral",
        strength: strengthFor(Math.abs(tend.netPlayerFlow), 5, 2),
        title: `${disposer ? "Player disposer" : "Player collector"} — net ${tend.netPlayerFlow > 0 ? "+" : ""}${tend.netPlayerFlow} flow`,
        detail: disposer
          ? `Has sent out ${Math.abs(tend.netPlayerFlow)} more players than acquired. Uses bodies as trade fuel — offer quantity, ask for quality.`
          : `Has taken in ${tend.netPlayerFlow} more players than sent. Collects depth — package your spare parts.`,
        thisLeague: true,
      });
    }

    if (tend.netPickFlow !== 0) {
      insights.push({
        id: "pick-flow",
        group: "trades",
        label: "PICK FLOW",
        tone: tend.netPickFlow > 0 ? "positive" : "warning",
        strength: strengthFor(Math.abs(tend.netPickFlow), 4, 2),
        title: `${tend.netPickFlow > 0 ? "Accumulating" : "Spending"} draft capital (${tend.netPickFlow > 0 ? "+" : ""}${tend.netPickFlow})`,
        detail: tend.netPickFlow > 0
          ? "Values picks over production — picks will not pry their good players loose, but veterans might."
          : "Trades picks away for immediate help. Future capital is the currency they will accept.",
        thisLeague: true,
      });
    }
  } else {
    insights.push({
      id: "trade-none",
      group: "trades",
      label: "TRADE STYLE",
      tone: "warning",
      strength: strengthFor(seasons, 3, 2),
      title: `No completed trades in ${plural(seasons, "season")}`,
      detail: "Nothing on record. Either genuinely inactive or only moved by a clearly lopsided offer.",
      thisLeague: true,
    });
  }

  if (tend.busiestDay) {
    insights.push({
      id: "timing",
      group: "trades",
      label: "TRADE TIMING",
      tone: "neutral",
      strength: strengthFor(tend.movesPerYear * seasons, 20, 8),
      title: `Most active on ${tend.busiestDay}s`,
      detail: `Their roster moves cluster on ${tend.busiestDay}. Send offers so they land in the inbox on their most engaged day.`,
      thisLeague: true,
    });
  }

  if (tend.waiverClaims > 0) {
    const aggressive = tend.faabSpent > leagueAvgFaab * 1.25;
    insights.push({
      id: "waivers",
      group: "trades",
      label: "WAIVERS",
      tone: "neutral",
      strength: strengthFor(tend.waiverClaims, 15, 5),
      title: `${plural(tend.waiverClaims, "waiver claim")} · ${tend.faabSpent.toLocaleString("en-US")} FAAB spent`,
      detail: aggressive
        ? "Spends above the league average on the wire. Reacts fast to injuries and breakouts — do not expect to sneak a claim past them."
        : "Conservative on the wire. Free-agent value is more likely to slip through to you.",
      thisLeague: true,
    });
  }

  // ---- Draft tendencies ---------------------------------------------------
  const topDraft = profile.draftTendencies[0];
  if (topDraft && topDraft.picks >= 2 && topDraft.share >= 0.4) {
    insights.push({
      id: "draft-bias",
      group: "trades",
      label: "DRAFT BIAS",
      tone: "neutral",
      strength: strengthFor(profile.draftTendencies.reduce((sum, row) => sum + row.picks, 0), 8, 4),
      title: `Drafts ${topDraft.position} — ${pct(topDraft.share)} of their rookie picks`,
      detail: `${plural(topDraft.picks, "pick")} spent on ${topDraft.position} across ${plural(seasons, "season")}. Expect them to reach there again, so that is the room to sell into on draft day.`,
      thisLeague: true,
    });
  }

  // ---- Cross-league intel -------------------------------------------------
  for (const crush of profile.crushes.slice(0, 3)) {
    insights.push({
      id: `crush-${crush.player.id}`,
      group: "cross-league",
      label: "PLAYER CRUSH",
      tone: "warning",
      strength: crush.leagues === crush.ofLeagues ? "strong" : "moderate",
      title: `${crush.player.name} owned in ${crush.leagues} of ${crush.ofLeagues} leagues (${pct(crush.leagues / crush.ofLeagues)})`,
      detail: "Likely untouchable — emotional attachment. Do not waste capital trying to acquire.",
      thisLeague: false,
    });
  }

  // ---- Your edge ----------------------------------------------------------
  if (profile.efficiency && profile.efficiency.rank > Math.ceil(teams / 2)) {
    insights.push({
      id: "efficiency",
      group: "edge",
      label: "COACHING",
      tone: "positive",
      strength: strengthFor(profile.efficiency.seasons, 3, 2),
      title: `Leaves points on the bench — ${pct(profile.efficiency.rate)} lineup efficiency (#${profile.efficiency.rank} of ${teams})`,
      detail: `Roughly ${Math.round(profile.efficiency.pointsLostPerSeason).toLocaleString("en-US")} points per season lost to lineup mistakes. Beatable head-to-head even when the roster says otherwise.`,
      thisLeague: true,
    });
  } else if (profile.efficiency && profile.efficiency.rank <= 3) {
    insights.push({
      id: "efficiency-good",
      group: "edge",
      label: "COACHING",
      tone: "warning",
      strength: strengthFor(profile.efficiency.seasons, 3, 2),
      title: `Sharp lineup manager — ${pct(profile.efficiency.rate)} efficiency (#${profile.efficiency.rank} of ${teams})`,
      detail: "Rarely misplays a start/sit. Do not count on them beating themselves.",
      thisLeague: true,
    });
  }

  if (profile.headToHead && profile.headToHead.meetings > 0) {
    const h2h = profile.headToHead;
    const winning = h2h.wins > h2h.losses;
    insights.push({
      id: "h2h",
      group: "edge",
      label: "RIVALRY",
      tone: winning ? "positive" : h2h.losses > h2h.wins ? "critical" : "neutral",
      strength: strengthFor(h2h.meetings, 5, 2),
      title: `You are ${h2h.wins}–${h2h.losses} against them in ${plural(h2h.meetings, "meeting")}`,
      detail: `${h2h.pointsFor.toFixed(1)} to ${h2h.pointsAgainst.toFixed(1)} all-time.${h2h.lastMeeting ? ` Last met ${h2h.lastMeeting}.` : ""}`,
      thisLeague: true,
    });
  }

  const bestPartner = tend.partners[0];
  if (bestPartner && bestPartner.trades >= 2) {
    // When the top partner *is* the connected user, this is a standing relationship to lean on,
    // not a rival to out-bid — describing yourself as competition read as a bug on the page.
    const isSelf = userRosterId !== null && bestPartner.rosterId === userRosterId;
    insights.push({
      id: "partner",
      group: "edge",
      label: "TRADE NETWORK",
      tone: isSelf ? "positive" : "neutral",
      strength: strengthFor(bestPartner.trades, 3, 2),
      title: isSelf
        ? `You are their most frequent partner (${plural(bestPartner.trades, "deal")})`
        : `Trades most with ${bestPartner.manager} (${plural(bestPartner.trades, "deal")})`,
      detail: isSelf
        ? `${manager} already deals with you more than anyone. Open the conversation — the relationship is established.`
        : `An established pipeline. You are competing with ${bestPartner.manager} for anything ${manager} makes available.`,
      thisLeague: true,
    });
  }

  for (const room of profile.surpluses.slice(0, 2)) {
    const mine = userNeeds.find((entry) => entry.position === room.position);
    if (!mine) continue;
    insights.push({
      id: `acquire-${room.position}`,
      group: "edge",
      label: "ACQUIRABLE",
      tone: "positive",
      strength: "moderate",
      title: `${room.position} surplus fills your #${mine.rank} room`,
      detail: `They are #${room.rank} of ${teams} at ${room.position} with ${room.starterCount} bodies. Worth making an offer — the depth is spare to them.`,
      thisLeague: true,
    });
  }

  return insights;
}

/**
 * The whole report.
 *
 * Every upstream is failure-tolerant: without RosterAudit history there is no efficiency or
 * rivalry data but tendencies still come from Sleeper, and without values the position rooms
 * degrade rather than blanking the page.
 */
export async function getScoutingReport(leagueId: string, username?: string, source: LeagueSource = liveSource): Promise<ScoutingReport> {
  const context = await getLeagueValueContext(leagueId, source);
  const teams = context.teams;
  const teamCount = teams.length;

  const lineageIds = await getLeagueLineage(leagueId, LINEAGE_LIMIT).catch(() => [leagueId]);
  const [lineage, managersResult] = await Promise.all([
    readLineage(lineageIds, source),
    getLeagueManagers(leagueId).catch(() => ({ ok: false as const, error: { kind: "upstream-unavailable" as const, message: "unavailable", retryable: true } })),
  ]);

  const tendenciesByRoster = buildTendencies(lineage, teams);
  const draftByRoster = buildDraftTendencies(lineage);
  const network = buildNetwork(lineage);

  const account = username ? await source.getNflLeaguesForUsername(username).catch(() => null) : null;
  const userTeam = account ? teams.find((team) => team.ownerId === account.userId) ?? null : null;
  const userRosterId = userTeam?.rosterId ?? null;
  const userRooms = userTeam ? roomSplit(userTeam, teamCount) : { needs: [], surpluses: [] };

  const historyReady = managersResult.ok;
  const careerByUser = new Map(managersResult.ok ? managersResult.data.map((entry) => [entry.userId, entry]) : []);

  // Lineup efficiency needs the per-season rows, which are one request per manager.
  const dossiers = historyReady
    ? await Promise.all(teams.map(async (team) => {
        if (!team.ownerId) return null;
        const result = await getManagerCareer(leagueId, team.ownerId).catch(() => null);
        return result?.ok ? { rosterId: team.rosterId, dossier: result.data } : null;
      }))
    : [];

  const efficiencyRaw = new Map<number, { rate: number; lost: number; seasons: number }>();
  for (const entry of dossiers) {
    if (!entry) continue;
    const usable = entry.dossier.seasons.filter((season) => season.maxPointsFor && season.maxPointsFor > 0 && season.pointsFor > 0);
    if (!usable.length) continue;
    const rate = usable.reduce((sum, season) => sum + season.pointsFor / season.maxPointsFor!, 0) / usable.length;
    const lost = usable.reduce((sum, season) => sum + (season.maxPointsFor! - season.pointsFor), 0) / usable.length;
    efficiencyRaw.set(entry.rosterId, { rate, lost, seasons: usable.length });
  }
  const efficiencyOrder = [...efficiencyRaw.entries()].toSorted((a, b) => b[1].rate - a[1].rate).map(([rosterId]) => rosterId);

  // Rivalry lines are only meaningful against a connected manager.
  const h2hByRoster = new Map<number, HeadToHead>();
  if (historyReady && account?.userId) {
    const rows = await Promise.all(teams.map(async (team) => {
      if (!team.ownerId || team.ownerId === account.userId) return null;
      const result = await getHeadToHead(leagueId, account.userId, team.ownerId).catch(() => null);
      if (!result?.ok) return null;
      const data = result.data;
      // The endpoint answers in the order the ids were passed, so side A is always the user.
      const last = data.games.toSorted((a, b) => b.season - a.season || b.week - a.week)[0];
      return [team.rosterId, {
        meetings: data.meetings,
        wins: data.winsA,
        losses: data.winsB,
        pointsFor: data.pointsA,
        pointsAgainst: data.pointsB,
        lastMeeting: last ? `${last.season} ${last.label}` : null,
      }] as const;
    }));
    for (const row of rows) if (row) h2hByRoster.set(row[0], row[1]);
  }

  // Cross-league intel: capped per manager, and skipped entirely for the connected user.
  const crushResults = await Promise.all(teams.map(async (team) => {
    if (!team.ownerId) return null;
    const result = await buildCrushes(team.ownerId, context.league.season, leagueId, context.catalog).catch(() => null);
    return result ? { rosterId: team.rosterId, ...result } : null;
  }));
  const crushByRoster = new Map(crushResults.filter((entry) => entry !== null).map((entry) => [entry.rosterId, entry]));

  const leagueAvgFaab = [...tendenciesByRoster.values()].reduce((sum, entry) => sum + entry.faabSpent, 0) / Math.max(1, tendenciesByRoster.size);

  const profiles: ManagerProfile[] = teams.map((team) => {
    const tendencies = tendenciesByRoster.get(team.rosterId) ?? {
      trades: 0, tradesPerYear: 0, tradeRank: teamCount, style: "Inactive" as TradeStyle, netPlayerFlow: 0, netPickFlow: 0,
      waiverClaims: 0, faabSpent: 0, activityByDay: Array(7).fill(0), busiestDay: null, movesPerYear: 0, partners: [], seasonsScanned: lineage.length,
    };
    const { needs, surpluses } = roomSplit(team, teamCount);
    const window = windowFor(team, teamCount, tendencies);
    const isUser = team.rosterId === userRosterId;
    const efficiencyEntry = efficiencyRaw.get(team.rosterId);
    const crush = crushByRoster.get(team.rosterId);
    const career = team.ownerId ? careerByUser.get(team.ownerId) ?? null : null;

    const base = {
      rosterId: team.rosterId,
      userId: team.ownerId,
      name: team.name,
      manager: team.manager,
      avatar: team.avatar,
      isUser,
      window,
      record: { wins: team.wins, losses: team.losses, ties: team.ties },
      valueRank: team.valueRank,
      teams: teamCount,
      needs,
      surpluses,
      tendencies,
      draftTendencies: draftByRoster.get(team.rosterId) ?? [],
      efficiency: efficiencyEntry
        ? { rate: efficiencyEntry.rate, rank: 1 + efficiencyOrder.indexOf(team.rosterId), pointsLostPerSeason: efficiencyEntry.lost, seasons: efficiencyEntry.seasons }
        : null,
      headToHead: h2hByRoster.get(team.rosterId) ?? null,
      crushes: crush?.crushes ?? [],
      otherLeagues: crush?.scanned ?? 0,
      career: career ? { seasons: career.seasonsPlayed, winPct: career.winPct, championships: career.championships, playoffAppearances: career.playoffAppearances } : null,
    };

    return {
      ...base,
      // The self scout is a mirror, not a target: no leverage score, no recommended play.
      leverage: isUser ? 0 : leverageFor({ tendencies, needs, surpluses, window }, userRooms.surpluses, userRooms.needs),
      play: isUser ? null : playFor({ needs, surpluses, window, tendencies, manager: team.manager }, userRooms.surpluses, userRooms.needs, teamCount),
      insights: buildInsights({ profile: base, teams: teamCount, userSurpluses: userRooms.surpluses, userNeeds: userRooms.needs, leagueAvgFaab, userRosterId }),
    };
  });

  const marketCounts = {
    rebuilding: profiles.filter((profile) => !profile.isUser && profile.window === "Rebuilding").length,
    contending: profiles.filter((profile) => !profile.isUser && profile.window === "Contender").length,
    fringe: profiles.filter((profile) => !profile.isUser && profile.window === "Fringe").length,
  };

  return {
    league: { id: leagueId, name: context.league.name, season: context.league.season, teams: teamCount, superflex: context.superflex },
    userRosterId,
    username,
    profiles: profiles.toSorted((a, b) => (a.isUser ? -1 : b.isUser ? 1 : 0) || b.leverage - a.leverage || a.valueRank - b.valueRank),
    lineage: lineageIds,
    seasonsScanned: lineage.length,
    network,
    marketSummary: marketCounts.rebuilding > marketCounts.contending
      ? `${plural(marketCounts.rebuilding, "team")} rebuilding. Veteran prices low — buyer's market.`
      : marketCounts.contending > marketCounts.rebuilding
        ? `${plural(marketCounts.contending, "team")} contending. Veterans are in demand — seller's market.`
        : `Market is balanced — ${marketCounts.contending} contending against ${marketCounts.rebuilding} rebuilding.`,
    marketCounts,
    valuesReady: context.valuesReady,
    historyReady,
    crossLeagueReady: [...crushByRoster.values()].some((entry) => entry.scanned > 0),
  };
}
