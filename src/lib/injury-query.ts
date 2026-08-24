// What the /{leagueId}/injuries URL means. The Players page put its filters in the URL so a
// view is shareable and the back button works (src/lib/rankings-query.ts); this page follows
// the same rule for the same reason — "here is who is hurt on your team" is a link worth sending.

/**
 * Severity is the page's organizing idea. Sleeper reports a dozen different `injury_status`
 * strings plus a separate practice designation, and a reader scanning a lineup does not care
 * about the taxonomy — they care whether the player is gone, might not play, or is merely
 * carrying a report. Everything on this page (sort order, tone, the summary tiles, the filter
 * chips) is keyed to these three tiers rather than to the raw strings.
 *
 * It lives in this module, not beside `getInjuryReport`, because the client toolbar needs it
 * and src/lib/injury-report.ts reaches the Sleeper player catalog — importing that from a
 * client component would pull the whole server fetch layer into the browser bundle.
 */
export const SEVERITIES = ["out", "risk", "watch"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** How each tier reads in the UI: the chip label, and the one-line explanation under it. */
export const SEVERITY_LABELS: Record<Severity, string> = { out: "Out", risk: "In doubt", watch: "Watch" };
export const SEVERITY_HINTS: Record<Severity, string> = {
  out: "Ruled out, suspended, or on IR/PUP",
  risk: "Questionable or doubtful for this week",
  watch: "Carrying an injury or practice note, no game designation",
};

export const INJURY_POSITIONS = ["all", "QB", "RB", "WR", "TE"] as const;
export const INJURY_SORTS = ["severity", "value", "name", "team"] as const;
export const MAX_INJURY_SEARCH = 50;

export type InjuryPosition = (typeof INJURY_POSITIONS)[number];
export type InjurySort = (typeof INJURY_SORTS)[number];
export type InjuryQuery = {
  position: InjuryPosition;
  search: string;
  sort: InjurySort;
  /** Empty means every severity; otherwise only the tiers listed. */
  severities: Severity[];
  /** Show only players in someone's active starting lineup. */
  startersOnly: boolean;
  /** Roster id to narrow to a single fantasy team, or undefined for the whole league. */
  team?: number;
  username?: string;
};
export type InjurySearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

/** Total: every invalid value falls back to its default rather than throwing. */
export function parseInjuryQuery(searchParams: InjurySearchParams): InjuryQuery {
  const rawPosition = first(searchParams.position);
  const position = (INJURY_POSITIONS as readonly string[]).includes(rawPosition ?? "") ? (rawPosition as InjuryPosition) : "all";
  const rawSort = first(searchParams.sort);
  const sort = (INJURY_SORTS as readonly string[]).includes(rawSort ?? "") ? (rawSort as InjurySort) : "severity";
  const search = (first(searchParams.search) ?? "").trim().slice(0, MAX_INJURY_SEARCH);
  // Accepts both `?status=out&status=risk` and `?status=out,risk`; order is normalized to the
  // canonical severity order so two URLs meaning the same view serialize identically.
  const rawStatus = searchParams.status;
  const requested = new Set((Array.isArray(rawStatus) ? rawStatus : rawStatus ? [rawStatus] : []).flatMap((value) => value.split(",")).map((value) => value.trim()));
  const severities = SEVERITIES.filter((severity) => requested.has(severity));
  const rawTeam = Number(first(searchParams.team));
  const team = Number.isFinite(rawTeam) && rawTeam > 0 ? Math.floor(rawTeam) : undefined;
  const username = first(searchParams.username)?.trim() || undefined;
  return { position, search, sort, severities, startersOnly: first(searchParams.starters) === "1", team, username };
}

/** Builds `?a=b&c=d`, omitting defaults so a clean URL stays clean. `username` is always
 *  preserved — the whole app carries it (see `withUsername` in src/lib/utils.ts). */
export function serializeInjuryQuery(query: InjuryQuery, overrides: Partial<InjuryQuery> = {}): string {
  const next: InjuryQuery = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (next.position !== "all") params.set("position", next.position);
  if (next.search) params.set("search", next.search);
  if (next.sort !== "severity") params.set("sort", next.sort);
  if (next.severities.length) params.set("status", SEVERITIES.filter((severity) => next.severities.includes(severity)).join(","));
  if (next.startersOnly) params.set("starters", "1");
  if (next.team !== undefined) params.set("team", String(next.team));
  if (next.username) params.set("username", next.username);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const injuriesHref = (leagueId: string, query: InjuryQuery, overrides: Partial<InjuryQuery> = {}) => `/${leagueId}/injuries${serializeInjuryQuery(query, overrides)}`;

/** The href that adds or removes one severity — the filter chips are toggles, not radios. */
export const toggleSeverityHref = (leagueId: string, query: InjuryQuery, severity: Severity) =>
  injuriesHref(leagueId, query, {
    severities: query.severities.includes(severity) ? query.severities.filter((value) => value !== severity) : [...query.severities, severity],
  });

export const hasActiveInjuryFilters = (query: InjuryQuery) =>
  Boolean(query.search || query.position !== "all" || query.severities.length || query.startersOnly || query.team !== undefined || query.sort !== "severity");

/** The query with every filter cleared, but the reader's identity kept. */
export const clearedInjuryQuery = (query: InjuryQuery): InjuryQuery =>
  ({ position: "all", search: "", sort: "severity", severities: [], startersOnly: false, team: undefined, username: query.username });
