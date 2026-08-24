import type { SleeperLeague } from "@/lib/types";

// Sleeper encodes the league format in `settings.type`: 0 = redraft, 1 = keeper, 2 = dynasty.
// Anything else (including a missing value) fails closed: not dynasty, described as "Redraft".
const LEAGUE_TYPE_LABELS: Record<number, string> = { 0: "Redraft", 1: "Keeper", 2: "Dynasty" };

/** Everything about a league's format that downstream modules key off. The single owner of these answers. */
export type LeagueFormat = {
  /** RosterAudit preset key, e.g. "sf-ppr-tep". */
  presetKey: string;
  /** The same key in the underscore form the values endpoint wants, e.g. "sf_ppr_tep". */
  formatKey: string;
  superflex: boolean;
  tePremium: boolean;
  isDynasty: boolean;
  /** "Redraft" | "Keeper" | "Dynasty" */
  typeLabel: string;
};

export function isDynastyLeague(league: SleeperLeague): boolean {
  return league.settings?.type === 2;
}

export function describeLeagueType(league: SleeperLeague): string {
  const type = league.settings?.type;
  return (typeof type === "number" ? LEAGUE_TYPE_LABELS[type] : undefined) ?? "Redraft";
}

/**
 * A `SUPER_FLEX` slot *or* two or more `QB` slots. The second case matters: a 2-QB league values
 * quarterbacks like a Superflex league even though Sleeper never emits the SUPER_FLEX position.
 */
export function isSuperflexLeague(league: SleeperLeague): boolean {
  const qbCount = league.roster_positions.filter((position) => position === "QB").length;
  return league.roster_positions.includes("SUPER_FLEX") || qbCount >= 2;
}

export function deriveLeagueFormat(league: SleeperLeague): LeagueFormat {
  const superflex = isSuperflexLeague(league);
  const tePremium = (league.scoring_settings.bonus_rec_te ?? 0) > 0;
  const presetKey = `${superflex ? "sf" : "1qb"}-ppr${tePremium ? "-tep" : ""}`;
  return { presetKey, formatKey: presetKey.replace(/-/g, "_"), superflex, tePremium, isDynasty: isDynastyLeague(league), typeLabel: describeLeagueType(league) };
}
