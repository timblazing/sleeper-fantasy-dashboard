import { type InjuryQuery, SEVERITIES, type Severity } from "@/lib/injury-query";
import { getLeagueBase, teamIdentity } from "@/lib/league-context";
import { liveSource, type LeagueSource } from "@/lib/league-source";
import { resolvePlayer } from "@/lib/players";
import type { NflPlayer, PlayerGame } from "@/lib/types";

/** Verbatim Sleeper `injury_status` values that mean the player will not play. */
const OUT_STATUSES = new Set(["IR", "PUP", "Out", "Sus", "NA", "COV", "DNR"]);
/** …and the ones that mean the player might not. `Probable` is deliberately not here. */
const RISK_STATUSES = new Set(["Doubtful", "Questionable"]);

export type InjuryEntry = {
  player: NflPlayer;
  fantasyTeam: string;
  rosterId: number;
  /** True when the manager has this player in their current starting lineup. */
  isStarter: boolean;
  onInjuredReserve: boolean;
  /** True when the roster is parking the player on taxi rather than in an active slot. */
  onTaxi: boolean;
  severity: Severity;
  /** Dynasty value in this league's format, or null when RosterAudit is unreachable. */
  value: number | null;
  /** This week's game, so a reader can tell "Out" from "Out, and on bye anyway". */
  game: PlayerGame | null;
};

export type InjuryReport = {
  entries: InjuryEntry[];
  catalogReady: boolean;
  valuesReady: boolean;
  week: number;
  /** Counts per severity across the whole league, before any filtering. */
  summary: Record<Severity, number>;
  /** Rostered starters carrying an injury designation — the number that actually costs points. */
  startersAffected: number;
  /** Every fantasy team that has at least one injured player, worst-hit first. */
  teams: InjuryTeamRollup[];
};

export type InjuryTeamRollup = {
  rosterId: number;
  name: string;
  counts: Record<Severity, number>;
  startersAffected: number;
  /** Combined dynasty value sitting on the injury report for this team. */
  valueAtRisk: number;
};

/** Sorting weight: the reader wants the unavailable starters at the top, every time. */
const SEVERITY_ORDER: Record<Severity, number> = { out: 0, risk: 1, watch: 2 };

export function severityOf(player: NflPlayer): Severity {
  const status = player.injuryStatus;
  if (status && OUT_STATUSES.has(status)) return "out";
  if (status && RISK_STATUSES.has(status)) return "risk";
  // No status but a body part or a practice note is still worth surfacing — that is how a
  // Wednesday DNP shows up before the Friday designation lands.
  return "watch";
}

function isInjuryRelevant(player: NflPlayer) {
  return Boolean(player.injuryStatus || player.injuryBodyPart || player.practiceParticipation);
}

/** "Did Not Participate In Practice" → "Did Not Participate". The suffix is noise in a table. */
export function practiceLabel(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/\s*Participation In Practice$/i, "").replace(/\s*In Practice$/i, "").trim() || null;
}

const emptyCounts = (): Record<Severity, number> => Object.fromEntries(SEVERITIES.map((severity) => [severity, 0])) as Record<Severity, number>;

export async function getInjuryReport(leagueId: string, source: LeagueSource = liveSource): Promise<InjuryReport> {
  const [base, catalog] = await Promise.all([
    getLeagueBase(leagueId, source),
    source.getPlayerCatalog().catch(() => new Map<string, NflPlayer>()),
  ]);

  const { superflex, formatKey } = base.format;
  // Both enrichments are strictly additive: the page is still correct and useful with neither,
  // so a failure in either degrades to null rather than failing the read.
  const [valuesResult, games] = await Promise.all([
    source.getValues(formatKey),
    source.getWeekGamesByTeam(base.state.season, base.matchupWeek).catch(() => new Map<string, PlayerGame>()),
  ]);
  const values = new Map<string, number>(
    valuesResult.ok ? Object.entries(valuesResult.data).map(([id, entry]) => [id, superflex ? entry.sf : entry["1qb"]]) : []
  );

  const entries = base.rosters.flatMap((roster) => {
    const team = base.teamByRoster.get(roster.roster_id) ?? teamIdentity(roster);
    const reserve = new Set(roster.reserve ?? []);
    const taxi = new Set(roster.taxi ?? []);
    // Sleeper pads an unfilled lineup slot with "0", which is not a player id.
    const starters = new Set((roster.starters ?? []).filter((id) => id && id !== "0"));
    return (roster.players ?? []).flatMap((id) => {
      const player = resolvePlayer(catalog, id);
      if (!isInjuryRelevant(player)) return [];
      return [{
        player,
        fantasyTeam: team.name,
        rosterId: roster.roster_id,
        isStarter: starters.has(id),
        onInjuredReserve: reserve.has(id),
        onTaxi: taxi.has(id),
        severity: severityOf(player),
        value: values.get(id) ?? null,
        game: player.team ? games.get(player.team) ?? null : null,
      }];
    });
  });

  // Worst first, then the players who actually start, then by what they are worth. Value is the
  // tiebreak rather than the name because "who does this hurt most" is the question the page
  // answers; alphabetical order only settles the case where nothing else separates two rows.
  entries.sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    || Number(b.isStarter) - Number(a.isStarter)
    || (b.value ?? 0) - (a.value ?? 0)
    || a.player.name.localeCompare(b.player.name)
  );

  const summary = emptyCounts();
  for (const entry of entries) summary[entry.severity] += 1;

  const rollups = new Map<number, InjuryTeamRollup>();
  for (const entry of entries) {
    const rollup = rollups.get(entry.rosterId)
      ?? { rosterId: entry.rosterId, name: entry.fantasyTeam, counts: emptyCounts(), startersAffected: 0, valueAtRisk: 0 };
    rollup.counts[entry.severity] += 1;
    if (entry.isStarter) rollup.startersAffected += 1;
    // Only what is unavailable or in doubt is "at risk" — a watch-list body part is not a loss.
    if (entry.severity !== "watch") rollup.valueAtRisk += entry.value ?? 0;
    rollups.set(entry.rosterId, rollup);
  }

  const teams = [...rollups.values()].sort((a, b) =>
    b.counts.out - a.counts.out || b.startersAffected - a.startersAffected || b.valueAtRisk - a.valueAtRisk || a.name.localeCompare(b.name)
  );

  return {
    entries,
    catalogReady: catalog.size > 0,
    valuesReady: values.size > 0,
    week: base.matchupWeek,
    summary,
    startersAffected: entries.filter((entry) => entry.isStarter).length,
    teams,
  };
}

/** The rows a given URL asks for, plus the counts the toolbar badges. Filtering lives here
 *  rather than in the table component so the page stays a server component and the whole
 *  view is reproducible from the URL alone. */
export function selectInjuryEntries(report: InjuryReport, query: InjuryQuery): InjuryEntry[] {
  const search = query.search.trim().toLowerCase();
  const filtered = report.entries.filter((entry) =>
    (query.position === "all" || entry.player.position === query.position)
    && (!query.severities.length || query.severities.includes(entry.severity))
    && (!query.startersOnly || entry.isStarter)
    && (query.team === undefined || entry.rosterId === query.team)
    && (!search
      || entry.player.name.toLowerCase().includes(search)
      || entry.fantasyTeam.toLowerCase().includes(search)
      || (entry.player.team?.toLowerCase().includes(search) ?? false)
      || (entry.player.injuryBodyPart?.toLowerCase().includes(search) ?? false))
  );

  // `severity` is the default order the entries already carry, so only the explicit
  // alternatives re-sort. Each still falls back to name so the order is total.
  if (query.sort === "value") return filtered.toSorted((a, b) => (b.value ?? 0) - (a.value ?? 0) || a.player.name.localeCompare(b.player.name));
  if (query.sort === "name") return filtered.toSorted((a, b) => a.player.name.localeCompare(b.player.name));
  if (query.sort === "team") return filtered.toSorted((a, b) => a.fantasyTeam.localeCompare(b.fantasyTeam) || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.player.name.localeCompare(b.player.name));
  return filtered;
}
