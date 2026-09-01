import { formatTrend, formatValue } from "@/lib/display";
import { getMovers } from "@/lib/roster-audit";
import { findTeamForUser, getLeagueValueContext, letterGrade, ROOM_POSITIONS, type LeagueTeam, type LeagueValueContext, type PositionRoom, type ValuedPlayer } from "@/lib/league-values";
import { getMatchupBoard } from "@/lib/matchup-detail";
import { getNflLeaguesForUsername } from "@/lib/sleeper";
import { getTransactionFeed, toActivityItem } from "@/lib/transaction-feed";
import { withUsername } from "@/lib/utils";
import type { ActivityItem, MatchupDetail, RosterSlot, SleeperAccount } from "@/lib/types";

export type Tone = "positive" | "warning" | "critical" | "neutral";
export type Insight = { id: string; tone: Tone; title: string; detail: string };
export type RecommendedAction = { id: string; tone: Tone; label: string; title: string; detail: string; href: string | null; cta: string | null };
export type PositionScarcityRow = { rosterId: number; name: string; manager: string; value: number; isUser: boolean };
export type PositionScarcity = { position: (typeof ROOM_POSITIONS)[number]; topThreeShare: number; rows: PositionScarcityRow[] };
export type TeamOutlook = { grade: string; label: string; detail: string; valueRank: number; powerRank: number; teams: number; ppg: number };
/** A single tile in the headline metric strip at the top of the overview. */
export type KeyMetric = { id: string; label: string; value: string; detail: string; tone: Tone };
export type SeasonPhase = { label: string; tone: Tone; detail: string };
export type TimelineMarker = { id: string; label: string; week: number; state: "past" | "now" | "upcoming" };
/** The season rendered as a single week rail, with the milestones that change how you play it. */
export type SeasonTimeline = { startWeek: number; endWeek: number; currentWeek: number; phase: SeasonPhase; markers: TimelineMarker[] };

export type OverviewData = {
  league: { id: string; name: string; season: string; teams: number; type: string; isDynasty: boolean; superflex: boolean };
  state: { week: number; matchupWeek: number; seasonType: string; regularSeason: boolean };
  account?: SleeperAccount;
  username?: string;
  /** Null when no ?username= is connected, or the account is not in this league. */
  team: LeagueTeam | null;
  outlook: TeamOutlook | null;
  rooms: PositionRoom[];
  matchup: MatchupDetail | null;
  /** Combined value of each side's starters — a rough dynasty-value read on the matchup. */
  matchupEdge: { mine: number; theirs: number } | null;
  topAssets: ValuedPlayer[];
  insights: Insight[];
  actions: RecommendedAction[];
  /** Every team ranked by position-room value, for the league-wide scarcity view. */
  positionScarcity: PositionScarcity[];
  activity: ActivityItem[];
  valuesReady: boolean;
  /** Headline numbers for the metric strip. Empty until a team is connected. */
  metrics: KeyMetric[];
  phase: SeasonPhase;
  timeline: SeasonTimeline;
};

// Sleeper reports these verbatim in `injury_status`. Anything in the first set cannot play.
const OUT_STATUSES = new Set(["Out", "IR", "PUP", "Sus", "NA", "DNR"]);
const RISKY_STATUSES = new Set(["Questionable", "Doubtful"]);
const OUTLOOK_LABELS = { contender: "Contender", bubble: "On the bubble", rebuild: "Rebuilding" } as const;

const ordinal = (n: number) => `#${n}`;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * The top of the roster carries the window: a young core with a top-half value rank is a
 * longer runway than the same value tied up in players who are already 28+.
 */
function coreAge(team: LeagueTeam): number | null {
  const ages = team.roster.slice(0, 10).map((entry) => entry.player.age).filter((age): age is number => age !== null);
  return ages.length ? ages.reduce((sum, age) => sum + age, 0) / ages.length : null;
}

function buildOutlook(team: LeagueTeam, teams: number, week: number): TeamOutlook {
  const games = team.wins + team.losses + team.ties;
  const ppg = games ? team.pointsFor / games : 0;
  const valuePct = teams > 1 ? (teams - team.valueRank) / (teams - 1) : 0.5;
  const label = valuePct >= 0.6 ? OUTLOOK_LABELS.contender : valuePct >= 0.35 ? OUTLOOK_LABELS.bubble : OUTLOOK_LABELS.rebuild;
  const age = coreAge(team);
  const ageNote = age === null ? "" : age <= 24.5 ? " with a young core" : age >= 27 ? " on an aging core" : "";
  const recordNote = games ? `${team.wins}–${team.losses}${team.ties ? `–${team.ties}` : ""} through week ${week}` : "before kickoff";

  return {
    grade: letterGrade(team.valueRank, teams),
    label,
    detail: `${ordinal(team.valueRank)} of ${teams} in roster value${ageNote} · ${recordNote}`,
    valueRank: team.valueRank,
    powerRank: team.powerRank,
    teams,
    ppg,
  };
}

function starterSlots(matchup: MatchupDetail | null, rosterId: number): RosterSlot[] {
  if (!matchup) return [];
  return matchup.home.team.rosterId === rosterId ? matchup.home.slots : matchup.away.slots;
}

function buildActions(context: LeagueValueContext, team: LeagueTeam, slots: RosterSlot[], trends: Map<string, number>, link: (path: string) => string): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const teams = context.teams.length;
  const rosterLink = `${link(`/${context.league.league_id}/players`)}#rosters`;

  // 1. Lineup problems first — these cost points this week, not next season.
  const empty = slots.filter((entry) => !entry.player);
  if (empty.length) {
    actions.push({ id: "empty-slots", tone: "critical", label: "Lineup", title: `Fill ${plural(empty.length, "empty starting slot")}`, detail: `${empty.map((entry) => entry.slot).join(", ")} ${empty.length === 1 ? "is" : "are"} unset and will score zero.`, href: rosterLink, cta: "Open rosters" });
  }

  const benched = slots.filter((entry) => entry.player?.injuryStatus && OUT_STATUSES.has(entry.player.injuryStatus));
  for (const entry of benched.slice(0, 2)) {
    const player = entry.player!;
    actions.push({ id: `out-${player.id}`, tone: "critical", label: "Injury", title: `${player.name} is ${player.injuryStatus}`, detail: `He is in your ${entry.slot} slot and will not play. Swap in an active ${player.position ?? "player"}.`, href: rosterLink, cta: "Open rosters" });
  }

  const byes = slots.filter((entry) => entry.game?.bye && entry.player);
  if (byes.length) {
    actions.push({ id: "bye-starters", tone: "warning", label: "Bye week", title: `${plural(byes.length, "starter")} on bye`, detail: `${byes.map((entry) => entry.player!.name).join(", ")} ${byes.length === 1 ? "has" : "have"} no game this week.`, href: rosterLink, cta: "Open rosters" });
  }

  const risky = slots.filter((entry) => entry.player?.injuryStatus && RISKY_STATUSES.has(entry.player.injuryStatus));
  if (risky.length) {
    actions.push({ id: "risky-starters", tone: "warning", label: "Watch", title: `${plural(risky.length, "starter")} carrying an injury tag`, detail: `${risky.map((entry) => `${entry.player!.name} (${entry.player!.injuryStatus})`).join(", ")}. Check inactives before kickoff.`, href: rosterLink, cta: "Open rosters" });
  }

  if (!context.valuesReady) return actions;

  // 2. Roster construction — the weakest room is where a trade moves the needle most.
  const weakest = team.rooms.toSorted((a, b) => b.rank - a.rank)[0];
  const strongest = team.rooms.toSorted((a, b) => a.rank - b.rank)[0];
  if (weakest && weakest.rank > Math.ceil(teams / 2)) {
    actions.push({ id: "weak-room", tone: "warning", label: "Trade", title: `Upgrade the ${weakest.position} room`, detail: `${ordinal(weakest.rank)} of ${teams} at ${weakest.position} (${formatValue(weakest.value)} against a ${formatValue(Math.round(weakest.leagueAvg))} league average)${strongest && strongest.position !== weakest.position ? `. Your ${strongest.position} surplus (${ordinal(strongest.rank)}) is the piece to move.` : "."}`, href: link(`/${context.league.league_id}/trade`), cta: "Open trade calculator" });
  }

  // 3. Market timing — only surfaced for players the movers feed actually covers.
  const held = team.roster.filter((entry) => trends.has(entry.player.id));
  const sellHigh = held.filter((entry) => (trends.get(entry.player.id) ?? 0) > 0).toSorted((a, b) => (trends.get(b.player.id) ?? 0) - (trends.get(a.player.id) ?? 0))[0];
  if (sellHigh && (trends.get(sellHigh.player.id) ?? 0) >= 500) {
    actions.push({ id: `sell-${sellHigh.player.id}`, tone: "positive", label: "Sell high", title: `${sellHigh.player.name} is up ${formatTrend(trends.get(sellHigh.player.id) ?? 0)} in 7 days`, detail: `Now worth ${formatValue(sellHigh.value)}. Shop him while the market is hot.`, href: link(`/${context.league.league_id}/trade`), cta: "Open trade calculator" });
  }
  const falling = held.toSorted((a, b) => (trends.get(a.player.id) ?? 0) - (trends.get(b.player.id) ?? 0))[0];
  if (falling && (trends.get(falling.player.id) ?? 0) <= -750) {
    actions.push({ id: `falling-${falling.player.id}`, tone: "warning", label: "Fading", title: `${falling.player.name} has shed ${formatTrend(trends.get(falling.player.id) ?? 0)}`, detail: `Down to ${formatValue(falling.value)} over the last week. Decide whether to hold through it or move on.`, href: link(`/${context.league.league_id}/players`), cta: "Open players" });
  }

  // 4. Roster edges — the tail of the bench that can be turned into a waiver claim.
  const startersSet = new Set(team.starters);
  const droppable = team.roster.filter((entry) => !startersSet.has(entry.player.id) && !team.taxi.includes(entry.player.id) && entry.value > 0 && entry.value < 100);
  if (droppable.length >= 2) {
    actions.push({ id: "drop-candidates", tone: "neutral", label: "Waivers", title: `${plural(droppable.length, "bench player")} below 100 value`, detail: `${droppable.slice(0, 3).map((entry) => entry.player.name).join(", ")}${droppable.length > 3 ? ", …" : ""}. These are your cheapest roster spots to convert into a waiver claim.`, href: link(`/${context.league.league_id}/players`), cta: "See waiver fits" });
  }

  return actions;
}

function buildInsights(context: LeagueValueContext, team: LeagueTeam, trends: Map<string, number>, matchup: MatchupDetail | null, edge: { mine: number; theirs: number } | null): Insight[] {
  const insights: Insight[] = [];
  const teams = context.teams.length;
  const games = team.wins + team.losses + team.ties;

  if (context.valuesReady && games >= 2) {
    // A roster that is far better than its record usually just needs time; the reverse is a warning.
    const recordRank = 1 + context.teams.filter((other) => other.wins > team.wins || (other.wins === team.wins && other.pointsFor > team.pointsFor)).length;
    const gap = recordRank - team.valueRank;
    if (gap >= 3) insights.push({ id: "underperforming", tone: "warning", title: "Your roster is better than your record", detail: `${ordinal(team.valueRank)} in value but only ${ordinal(recordRank)} in the standings. Expect positive regression before you sell anyone off.` });
    else if (gap <= -3) insights.push({ id: "overperforming", tone: "warning", title: "You are outrunning your roster", detail: `${ordinal(recordRank)} in the standings on the ${ordinal(team.valueRank)} roster by value. Bank the wins now — this is the window to buy.` });
  }

  if (games >= 2) {
    const luck = team.pointsFor - team.pointsAgainst;
    if (Math.abs(luck) >= 40) insights.push({ id: "point-differential", tone: luck > 0 ? "positive" : "warning", title: luck > 0 ? "You are winning the scoring battle" : "You are drawing tough weeks", detail: `${team.pointsFor.toFixed(1)} for against ${team.pointsAgainst.toFixed(1)} allowed — a ${luck > 0 ? "+" : ""}${luck.toFixed(1)} differential over ${plural(games, "game")}.` });
  }

  if (context.valuesReady) {
    const strongest = team.rooms.toSorted((a, b) => a.rank - b.rank)[0];
    if (strongest && strongest.rank <= 3) insights.push({ id: "strong-room", tone: "positive", title: `${strongest.position} is your trade currency`, detail: `${ordinal(strongest.rank)} of ${teams} at ${strongest.position} with ${formatValue(strongest.value)} across ${plural(strongest.players, "player")}. Surplus here buys elsewhere.` });

    const oldest = team.rooms.filter((room) => room.avgAge !== null && room.players >= 2).toSorted((a, b) => (b.avgAge ?? 0) - (a.avgAge ?? 0))[0];
    if (oldest && (oldest.avgAge ?? 0) >= 27.5) insights.push({ id: "aging-room", tone: "warning", title: `Your ${oldest.position} room is aging`, detail: `Average age ${(oldest.avgAge ?? 0).toFixed(1)} across ${plural(oldest.players, "player")}. Values at that age fall faster than production does.` });

    const held = team.roster.filter((entry) => trends.has(entry.player.id));
    const riser = held.toSorted((a, b) => (trends.get(b.player.id) ?? 0) - (trends.get(a.player.id) ?? 0))[0];
    if (riser && (trends.get(riser.player.id) ?? 0) > 0) insights.push({ id: "top-riser", tone: "positive", title: `${riser.player.name} is your biggest riser`, detail: `${formatTrend(trends.get(riser.player.id) ?? 0)} over seven days, now ${formatValue(riser.value)}${riser.rankPosition ? ` (${riser.player.position}${riser.rankPosition})` : ""}.` });
  }

  if (matchup && edge && context.valuesReady) {
    const diff = edge.mine - edge.theirs;
    const opponent = matchup.home.team.rosterId === team.rosterId ? matchup.away.team : matchup.home.team;
    insights.push({
      id: "matchup-edge",
      tone: diff >= 0 ? "positive" : "warning",
      title: diff >= 0 ? `You start the more valuable lineup` : `${opponent.name} starts the more valuable lineup`,
      detail: `${formatValue(edge.mine)} of starting value against ${formatValue(edge.theirs)} — a ${diff >= 0 ? "+" : ""}${formatValue(Math.abs(diff))} ${diff >= 0 ? "edge" : "deficit"} on paper.`,
    });
  }

  return insights;
}

function buildPositionScarcity(context: LeagueValueContext, team: LeagueTeam | null): PositionScarcity[] {
  if (!context.valuesReady) return [];

  return ROOM_POSITIONS.map((position) => {
    const rows = context.teams
      .map((entry) => ({
        rosterId: entry.rosterId,
        name: entry.name,
        manager: entry.manager,
        value: entry.rooms.find((room) => room.position === position)?.value ?? 0,
        isUser: entry.rosterId === team?.rosterId,
      }))
      .toSorted((a, b) => b.value - a.value);
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    const topThree = rows.slice(0, 3).reduce((sum, row) => sum + row.value, 0);

    return { position, topThreeShare: total ? Math.round((topThree / total) * 100) : 0, rows };
  });
}

const gradeTone = (grade: string): Tone => (grade.startsWith("A") ? "positive" : grade.startsWith("B") ? "neutral" : grade.startsWith("C") ? "warning" : "critical");
const signed = (n: number, digits = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`;

/**
 * The four numbers worth reading before anything else. Values-first when RosterAudit is up,
 * record-and-scoring when it is not, so the strip never collapses to empty tiles.
 */
function buildMetrics(context: LeagueValueContext, team: LeagueTeam, outlook: TeamOutlook): KeyMetric[] {
  const teams = context.teams.length;
  const half = Math.ceil(teams / 2);

  if (!context.valuesReady) {
    const games = team.wins + team.losses + team.ties;
    const diff = team.pointsFor - team.pointsAgainst;
    return [
      { id: "record", label: "Record", value: `${team.wins}\u2013${team.losses}${team.ties ? `\u2013${team.ties}` : ""}`, detail: games ? `${plural(games, "game")} played` : "before kickoff", tone: "neutral" },
      { id: "ppg", label: "Points per game", value: outlook.ppg.toFixed(1), detail: `${team.pointsFor.toFixed(1)} scored`, tone: "neutral" },
      { id: "power", label: "Power rank", value: ordinal(team.powerRank), detail: `of ${teams} by scoring`, tone: team.powerRank <= half ? "positive" : "warning" },
      { id: "differential", label: "Differential", value: signed(diff), detail: `${team.pointsAgainst.toFixed(1)} allowed`, tone: diff >= 0 ? "positive" : "warning" },
    ];
  }

  const weakest = team.rooms.toSorted((a, b) => b.rank - a.rank)[0];
  const strongest = team.rooms.toSorted((a, b) => a.rank - b.rank)[0];
  return [
    { id: "value", label: "Team value", value: formatValue(team.value), detail: `${ordinal(team.valueRank)} of ${teams}`, tone: team.valueRank <= half ? "positive" : "warning" },
    dynastyMetric(context, team, outlook, half),
    { id: "weakest", label: "Weakest spot", value: weakest.position, detail: `${ordinal(weakest.rank)} of ${teams}`, tone: weakest.rank > half ? "warning" : "neutral" },
    { id: "strongest", label: "Strongest spot", value: strongest.position, detail: `${ordinal(strongest.rank)} of ${teams}`, tone: "positive" },
  ];
}

/**
 * Dynasty lives or dies on the age curve, so that is the second headline there. Redraft has no
 * next year to protect, so it gets scoring instead — and falls back to the grade before kickoff,
 * when every team is tied at zero points and the power rank is meaningless.
 */
function dynastyMetric(context: LeagueValueContext, team: LeagueTeam, outlook: TeamOutlook, half: number): KeyMetric {
  const age = coreAge(team);
  if (context.league.settings.type === 2 && age !== null) {
    return { id: "core-age", label: "Core age", value: age.toFixed(1), detail: "top 10 by value", tone: age <= 24.5 ? "positive" : age >= 27 ? "warning" : "neutral" };
  }
  if (team.wins + team.losses + team.ties > 0) {
    return { id: "power", label: "Power rank", value: ordinal(team.powerRank), detail: `of ${context.teams.length} by scoring`, tone: team.powerRank <= half ? "positive" : "warning" };
  }
  return { id: "grade", label: "Roster grade", value: outlook.grade, detail: outlook.label, tone: gradeTone(outlook.grade) };
}

/** Sleeper stores both of these as week numbers on the league; the defaults match its own. */
const deadlineWeek = (league: LeagueValueContext["league"]) => league.settings.trade_deadline || 13;
const playoffWeek = (league: LeagueValueContext["league"]) => league.settings.playoff_week_start || 15;

function championshipWeek(league: LeagueValueContext["league"]): number {
  const playoffTeams = league.settings.playoff_teams || 6;
  const rounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, playoffTeams))));
  return playoffWeek(league) + rounds - 1;
}

/** What the calendar says you should be doing right now. */
function buildPhase(context: LeagueValueContext): SeasonPhase {
  const { week, league } = context;
  const deadline = deadlineWeek(league);
  const playoffs = playoffWeek(league);

  if (context.state.season_type === "off") return { label: "Offseason", tone: "neutral", detail: "Rookie draft prep and value shopping. Nothing is locked, so this is the cheapest time to reshape the roster." };
  if (!context.regularSeason) return { label: "Pre-season", tone: "warning", detail: "Lineup tweaks, ADP-aware moves, and identifying breakout candidates before they spike." };
  if (week >= playoffs) return { label: "Playoffs", tone: "critical", detail: "Win or go home. Start the highest floor you have and check inactives every week." };
  if (week > deadline) return { label: "Post-deadline", tone: "neutral", detail: `Trades closed after week ${deadline}. Waivers and weekly lineup calls are all that is left.` };
  if (week >= deadline - 2) return { label: "Deadline window", tone: "critical", detail: `${plural(deadline - week + 1, "week")} to buy or sell. Last chance to reshape the roster this season.` };
  return { label: "Regular season", tone: "positive", detail: "Set lineups weekly, work the waiver wire, and track buy-low windows while prices are soft." };
}

function buildTimeline(context: LeagueValueContext): SeasonTimeline {
  const { league, week } = context;
  const phase = buildPhase(context);
  const deadline = deadlineWeek(league);
  const playoffs = playoffWeek(league);
  const title = championshipWeek(league);
  const beforeKickoff = !context.regularSeason;
  const markers: { id: string; label: string; week: number }[] = [
    ...(beforeKickoff ? [{ id: "current-phase", label: phase.label, week: 0 }] : []),
    { id: "kickoff", label: "Kickoff", week: 1 },
    { id: "deadline", label: "Trade deadline", week: deadline },
    { id: "playoffs", label: "Playoffs", week: playoffs },
    { id: "championship", label: "Championship", week: title },
  ];

  return {
    startWeek: beforeKickoff ? 0 : 1,
    endWeek: Math.max(title, week),
    currentWeek: beforeKickoff ? 0 : week,
    phase,
    markers: markers.map((marker) => ({
      ...marker,
      state: marker.week < (beforeKickoff ? 0 : week) ? "past" : marker.week === (beforeKickoff ? 0 : week) ? "now" : "upcoming",
    })),
  };
}

export async function getOverviewData(leagueId: string, username?: string): Promise<OverviewData> {
  const [context, account] = await Promise.all([
    getLeagueValueContext(leagueId),
    username ? getNflLeaguesForUsername(username).catch(() => undefined) : undefined,
  ]);

  const link = (path: string) => withUsername(path, username);
  const team = findTeamForUser(context, account?.userId) ?? null;

  const [board, moversResult, feed] = await Promise.all([
    getMatchupBoard(leagueId, context.matchupWeek).catch(() => null),
    getMovers({ limit: 60 }),
    getTransactionFeed(leagueId, 8).catch(() => []),
  ]);

  const trends = new Map<string, number>();
  if (moversResult.ok) for (const mover of [...moversResult.data.risers, ...moversResult.data.fallers]) trends.set(mover.sleeperId, mover.trend7d);

  const found = team && board ? board.matchups.find((entry) => entry.home.team.rosterId === team.rosterId || entry.away.team.rosterId === team.rosterId) : undefined;
  // Always render the connected team on the left, whichever side Sleeper put them on.
  const matchup = found && team && found.away.team.rosterId === team.rosterId ? { ...found, home: found.away, away: found.home } : found ?? board?.matchups[0] ?? null;

  const slots = team ? starterSlots(matchup, team.rosterId) : [];
  const starterValue = (entries: RosterSlot[]) => entries.reduce((sum, entry) => sum + (entry.player ? context.values.get(entry.player.id) ?? 0 : 0), 0);
  const matchupEdge = matchup && team && context.valuesReady ? { mine: starterValue(matchup.home.slots), theirs: starterValue(matchup.away.slots) } : null;
  const outlook = team ? buildOutlook(team, context.teams.length, context.week) : null;
  return {
    league: {
      id: leagueId,
      name: context.league.name,
      season: context.league.season,
      teams: context.teams.length,
      type: context.league.settings.type === 2 ? "Dynasty" : context.league.settings.type === 1 ? "Keeper" : "Redraft",
      isDynasty: context.league.settings.type === 2,
      superflex: context.superflex,
    },
    state: { week: context.week, matchupWeek: context.matchupWeek, seasonType: context.state.season_type, regularSeason: context.regularSeason },
    account,
    username,
    team,
    outlook,
    rooms: team?.rooms ?? [],
    matchup,
    matchupEdge,
    topAssets: team ? team.roster.slice(0, 6) : [],
    insights: team ? buildInsights(context, team, trends, matchup, matchupEdge) : [],
    actions: team ? buildActions(context, team, slots, trends, link) : [],
    positionScarcity: buildPositionScarcity(context, team),
    activity: feed.map(toActivityItem),
    valuesReady: context.valuesReady,
    metrics: team && outlook ? buildMetrics(context, team, outlook) : [],
    phase: buildPhase(context),
    timeline: buildTimeline(context),
  };
}

export { ROOM_POSITIONS };
