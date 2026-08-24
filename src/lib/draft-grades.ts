import { getLeagueBase, teamIdentity } from "@/lib/league-context";
import { liveSource, type LeagueSource } from "@/lib/league-source";
import { resolvePlayer } from "@/lib/players";
import type { SleeperDraft, SleeperTradedPick } from "@/lib/types";

export type DraftPickGrade = {
  id: string;
  pick: string;
  pickNo: number;
  round: number;
  player: string;
  playerId: string;
  position: string | null;
  team: string | null;
  /** What the player is worth today. */
  value: number;
  /** What the slot was worth when it was used — the benchmark `surplus` is measured against. */
  slotValue: number;
  surplus: number;
  grade: string;
  /** Set when the slot was acquired: the roster whose original pick this was. */
  acquiredFrom: string | null;
};

export type DraftManagerGrade = {
  rosterId: number;
  /** Sleeper user id of the roster's owner, so the viewer's own team can be preselected. */
  ownerId: string | null;
  manager: string;
  teamName: string;
  avatar: string | null;
  grade: string;
  hitRate: number;
  surplus: number;
  /** Surplus per pick — the comparable number when managers hold unequal pick counts. */
  surplusPerPick: number;
  spent: number;
  earned: number;
  best: DraftPickGrade | null;
  worst: DraftPickGrade | null;
  picks: DraftPickGrade[];
};

/** One manager's record across every graded draft in league history. */
export type DraftCareerRow = {
  rosterId: number;
  manager: string;
  teamName: string;
  avatar: string | null;
  drafts: number;
  picks: number;
  surplus: number;
  surplusPerPick: number;
  hitRate: number;
  grade: string;
  bySeason: { season: string; surplus: number; surplusPerPick: number; picks: number; grade: string }[];
};

export type DraftClassSummary = {
  season: string;
  draftId: string;
  totalSurplus: number;
  hitRate: number;
  /** Share of class value that landed with a manager other than the slot's original owner. */
  tradedPickShare: number;
};

export type DraftGradeData = {
  drafts: { id: string; label: string; season: string }[];
  selectedDraftId: string | null;
  selectedLabel: string;
  selectedSeason: string;
  rounds: number;
  teams: number;
  superflex: boolean;
  /** False when RosterAudit's slot curve is unavailable and grades fall back to a within-class benchmark. */
  curveBacked: boolean;
  managers: DraftManagerGrade[];
  allPicks: (DraftPickGrade & { rosterId: number; manager: string })[];
  /** Best and worst picks of the whole class, for the headline tiles. */
  steals: (DraftPickGrade & { rosterId: number; manager: string })[];
  reaches: (DraftPickGrade & { rosterId: number; manager: string })[];
  byPosition: { position: string; picks: number; surplus: number; surplusPerPick: number; hitRate: number }[];
  byRound: { round: number; picks: number; surplus: number; surplusPerPick: number }[];
  career: DraftCareerRow[];
  classes: DraftClassSummary[];
  attribution: { text: string; url: string } | null;
};

/**
 * Surplus per pick → letter grade, on a fixed scale rather than a league-relative one.
 *
 * RosterAudit grades by finishing order, which forces a D onto somebody even in a draft where every
 * manager beat their slots. Fixed thresholds let a whole class grade well or badly, which is both
 * more honest and the only way a grade compares across seasons. The bands are in RosterAudit value
 * units, where a mid-first is ~2,900 and a late-third ~130, so ±300/pick is a real swing.
 */
export function gradeForSurplus(surplusPerPick: number): string {
  if (surplusPerPick >= 900) return "A+";
  if (surplusPerPick >= 500) return "A";
  if (surplusPerPick >= 250) return "A-";
  if (surplusPerPick >= 120) return "B+";
  if (surplusPerPick >= 40) return "B";
  if (surplusPerPick >= -40) return "B-";
  if (surplusPerPick >= -120) return "C+";
  if (surplusPerPick >= -250) return "C";
  if (surplusPerPick >= -500) return "C-";
  if (surplusPerPick >= -900) return "D";
  return "F";
}

const draftLabel = (draft: SleeperDraft, rookie: boolean) => `${draft.season} ${rookie ? "Rookie Draft" : "Draft"}`;

/**
 * Which roster's own slot produced each pick, by pick number.
 *
 * In Sleeper's traded-pick records `roster_id` is the slot's *original* owner and `owner_id` is
 * whoever ended up holding it — so a record only tells us a round-and-origin pair changed hands, not
 * which overall pick number that became. Matching them up needs the selections: within one round,
 * the acquirer used exactly the picks that its own slot count cannot explain.
 *
 * Rather than reconstruct the full slot map (snake order, reversal rounds and mid-draft trades all
 * bear on it), this pairs each round's incoming trades to that round's surplus picks for the
 * acquiring roster. A manager who picked more times in a round than it has original slots got the
 * extra ones by trade, and the trade records name who they came from.
 */
function originalOwnerByPickNo(picks: { pick_no: number; round: number; roster_id: number }[], traded: SleeperTradedPick[], season: string) {
  const result = new Map<number, number>();
  const rounds = new Set(picks.map((pick) => pick.round));
  for (const round of rounds) {
    const inRound = picks.filter((pick) => pick.round === round).toSorted((a, b) => a.pick_no - b.pick_no);
    const moves = traded.filter((trade) => trade.season === season && trade.round === round);
    for (const [rosterId, incoming] of Map.groupBy(moves, (trade) => trade.owner_id)) {
      const own = inRound.filter((pick) => pick.roster_id === rosterId);
      // The roster kept one slot of its own unless that slot was also dealt away.
      const keptOwn = moves.some((trade) => trade.roster_id === rosterId) ? 0 : 1;
      const acquired = own.slice(keptOwn);
      // Later picks in the round settle against later-listed trades; with one incoming pick — the
      // common case — the pairing is exact either way.
      acquired.forEach((pick, index) => {
        const origin = incoming[index]?.roster_id;
        if (origin !== undefined && origin !== pick.roster_id) result.set(pick.pick_no, origin);
      });
    }
  }
  return result;
}

type GradedDraft = {
  draft: SleeperDraft;
  picks: (DraftPickGrade & { rosterId: number; manager: string })[];
  curveBacked: boolean;
};

/** Grade one draft's picks against the slot curve, falling back to a within-class benchmark. */
function gradeDraft(
  draft: SleeperDraft,
  rawPicks: Awaited<ReturnType<LeagueSource["getDraftPicks"]>>,
  traded: SleeperTradedPick[],
  values: Record<string, number>,
  curve: Record<number, number>,
  catalog: Awaited<ReturnType<LeagueSource["getPlayerCatalog"]>>,
  teamNameByRoster: Map<number, string>,
): GradedDraft {
  const ordered = rawPicks.toSorted((a, b) => a.pick_no - b.pick_no);
  const curveBacked = Object.keys(curve).length > 0;
  // Without the curve, fall back to the old benchmark: the Nth-best player of this same class. It
  // grades a class against itself, so it is only ever a degraded mode — hence `curveBacked`.
  const classBenchmark = ordered.map((pick) => values[pick.player_id] ?? 0).toSorted((a, b) => b - a);
  const owners = originalOwnerByPickNo(ordered, traded, draft.season);

  const picks = ordered.map((pick) => {
    const player = resolvePlayer(catalog, pick.player_id);
    const value = values[pick.player_id] ?? 0;
    const slotValue = curveBacked ? (curve[pick.pick_no] ?? 0) : (classBenchmark[pick.pick_no - 1] ?? value);
    const surplus = value - slotValue;
    const origin = owners.get(pick.pick_no);
    return {
      id: `${draft.draft_id}:${pick.pick_no}`,
      pick: `${pick.round}.${String(pick.draft_slot).padStart(2, "0")}`,
      pickNo: pick.pick_no,
      round: pick.round,
      player: player.name,
      playerId: pick.player_id,
      position: player.position,
      team: player.team,
      value,
      slotValue,
      surplus,
      grade: gradeForSurplus(surplus),
      acquiredFrom: origin !== undefined && origin !== pick.roster_id ? (teamNameByRoster.get(origin) ?? `Roster ${origin}`) : null,
      rosterId: pick.roster_id,
      manager: teamNameByRoster.get(pick.roster_id) ?? `Roster ${pick.roster_id}`,
    };
  });
  return { draft, picks, curveBacked };
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const rate = (hits: number, total: number) => (total ? Math.round((hits / total) * 100) : 0);

export async function getDraftGradeData(leagueId: string, requestedDraftId?: string, source: LeagueSource = liveSource): Promise<DraftGradeData> {
  const [base, drafts, catalog] = await Promise.all([
    getLeagueBase(leagueId, source),
    source.getLeagueDrafts(leagueId).catch(() => []),
    source.getPlayerCatalog(),
  ]);
  const { league, rosters, format } = base;
  const rookie = league.settings.type === 2;
  const available = drafts
    .filter((draft) => draft.status === "complete")
    .toSorted((a, b) => Number(b.season) - Number(a.season) || b.draft_id.localeCompare(a.draft_id));
  const selected = available.find((draft) => draft.draft_id === requestedDraftId) ?? available[0];
  const draftOptions = available.map((draft) => ({ id: draft.draft_id, label: draftLabel(draft, rookie), season: draft.season }));

  const teamNameByRoster = new Map<number, string>();
  const identityByRoster = new Map<number, Pick<DraftManagerGrade, "rosterId" | "ownerId" | "manager" | "teamName" | "avatar">>();
  for (const roster of rosters) {
    const team = base.teamByRoster.get(roster.roster_id) ?? teamIdentity(roster);
    // Unlike every other module, an unclaimed roster reads as "Roster N" here rather than "Unassigned".
    const user = roster.owner_id ? base.userById.get(roster.owner_id) : undefined;
    teamNameByRoster.set(roster.roster_id, team.name);
    identityByRoster.set(roster.roster_id, { rosterId: team.rosterId, ownerId: team.ownerId ?? null, manager: user?.display_name ?? `Roster ${roster.roster_id}`, teamName: team.name, avatar: team.avatar });
  }

  const empty: DraftGradeData = {
    drafts: draftOptions, selectedDraftId: null, selectedLabel: "Draft", selectedSeason: "",
    rounds: 0, teams: league.settings.num_teams ?? rosters.length, superflex: format.superflex,
    curveBacked: false, managers: [], allPicks: [], steals: [], reaches: [],
    byPosition: [], byRound: [], career: [], classes: [], attribution: null,
  };
  if (!selected) return empty;

  const [valuesResult, curveResult] = await Promise.all([source.getValues(format.formatKey), source.getPickCurve()]);
  const values: Record<string, number> = valuesResult.ok
    ? Object.fromEntries(Object.entries(valuesResult.data).map(([id, value]) => [id, format.superflex ? value.sf : value["1qb"]]))
    : {};
  const curve = curveResult.ok ? (format.superflex ? curveResult.data.sf : curveResult.data.oneQb) : {};
  const attribution = valuesResult.ok ? valuesResult.attribution : curveResult.ok ? curveResult.attribution : null;

  // Every completed draft is graded, not just the selected one: the career table and the class
  // comparison both need history, and each draft is two cached reads.
  const graded = await Promise.all(available.map(async (draft) => {
    const [picks, traded] = await Promise.all([
      source.getDraftPicks(draft.draft_id).catch(() => []),
      source.getDraftTradedPicks(draft.draft_id).catch(() => []),
    ]);
    return gradeDraft(draft, picks, traded, values, curve, catalog, teamNameByRoster);
  }));

  const current = graded.find((entry) => entry.draft.draft_id === selected.draft_id) ?? graded[0];
  const allPicks = current.picks;

  const managers = [...identityByRoster.values()]
    .map((identity) => {
      const picks = allPicks.filter((pick) => pick.rosterId === identity.rosterId);
      const surplus = sum(picks.map((pick) => pick.surplus));
      const ranked = picks.toSorted((a, b) => b.surplus - a.surplus);
      return {
        ...identity,
        grade: gradeForSurplus(picks.length ? surplus / picks.length : 0),
        hitRate: rate(picks.filter((pick) => pick.surplus >= 0).length, picks.length),
        surplus,
        surplusPerPick: picks.length ? Math.round(surplus / picks.length) : 0,
        spent: sum(picks.map((pick) => pick.slotValue)),
        earned: sum(picks.map((pick) => pick.value)),
        best: ranked[0] ?? null,
        worst: ranked.length > 1 ? (ranked.at(-1) ?? null) : null,
        picks,
      };
    })
    .filter((manager) => manager.picks.length)
    .toSorted((a, b) => b.surplus - a.surplus || b.hitRate - a.hitRate);

  const ranked = allPicks.toSorted((a, b) => b.surplus - a.surplus);
  const positions = [...new Set(allPicks.map((pick) => pick.position ?? "—"))];
  const byPosition = positions
    .map((position) => {
      const picks = allPicks.filter((pick) => (pick.position ?? "—") === position);
      const surplus = sum(picks.map((pick) => pick.surplus));
      return { position, picks: picks.length, surplus, surplusPerPick: Math.round(surplus / picks.length), hitRate: rate(picks.filter((pick) => pick.surplus >= 0).length, picks.length) };
    })
    .toSorted((a, b) => b.surplusPerPick - a.surplusPerPick);

  const rounds = selected.settings.rounds ?? Math.max(0, ...allPicks.map((pick) => pick.round));
  const byRound = Array.from({ length: rounds }, (_, index) => index + 1)
    .map((round) => {
      const picks = allPicks.filter((pick) => pick.round === round);
      const surplus = sum(picks.map((pick) => pick.surplus));
      return { round, picks: picks.length, surplus, surplusPerPick: picks.length ? Math.round(surplus / picks.length) : 0 };
    })
    .filter((row) => row.picks);

  const career = [...identityByRoster.values()]
    .map((identity) => {
      const bySeason = graded
        .map((entry) => {
          const picks = entry.picks.filter((pick) => pick.rosterId === identity.rosterId);
          const surplus = sum(picks.map((pick) => pick.surplus));
          const perPick = picks.length ? Math.round(surplus / picks.length) : 0;
          return { season: entry.draft.season, surplus, surplusPerPick: perPick, picks: picks.length, grade: gradeForSurplus(perPick) };
        })
        .filter((row) => row.picks)
        .toSorted((a, b) => Number(a.season) - Number(b.season));
      const picks = sum(bySeason.map((row) => row.picks));
      const surplus = sum(bySeason.map((row) => row.surplus));
      const perPick = picks ? Math.round(surplus / picks) : 0;
      const hits = sum(graded.map((entry) => entry.picks.filter((pick) => pick.rosterId === identity.rosterId && pick.surplus >= 0).length));
      return { ...identity, drafts: bySeason.length, picks, surplus, surplusPerPick: perPick, hitRate: rate(hits, picks), grade: gradeForSurplus(perPick), bySeason };
    })
    .filter((row) => row.picks)
    .toSorted((a, b) => b.surplusPerPick - a.surplusPerPick);

  const classes = graded
    .map((entry) => {
      const acquired = entry.picks.filter((pick) => pick.acquiredFrom);
      return {
        season: entry.draft.season,
        draftId: entry.draft.draft_id,
        totalSurplus: sum(entry.picks.map((pick) => pick.surplus)),
        hitRate: rate(entry.picks.filter((pick) => pick.surplus >= 0).length, entry.picks.length),
        tradedPickShare: rate(acquired.length, entry.picks.length),
      };
    })
    .toSorted((a, b) => Number(a.season) - Number(b.season));

  return {
    drafts: draftOptions,
    selectedDraftId: selected.draft_id,
    selectedLabel: draftLabel(selected, rookie),
    selectedSeason: selected.season,
    rounds,
    teams: selected.settings.teams ?? league.settings.num_teams ?? rosters.length,
    superflex: format.superflex,
    curveBacked: current.curveBacked,
    managers,
    allPicks,
    steals: ranked.slice(0, 5),
    reaches: ranked.slice(-5).toReversed(),
    byPosition,
    byRound,
    career,
    classes,
    attribution,
  };
}
