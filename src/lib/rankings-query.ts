// The single source of truth for what the /{leagueId}/players URL means. PLAN.md line 64
// requires position, search, sort, age range, and page to be shareable URL state, so every
// one of them lives here and none of them lives in React state.
//
// Scoring format is deliberately *not* here. It is derived from the connected Sleeper
// league (`deriveLeagueFormat` in src/lib/league-features.ts) and shown as a read-only
// label — a league only ever has one format, so offering the other three invited the
// reader to look at values that do not apply to their league.

export const RANKINGS_POSITIONS = ["all", "QB", "RB", "WR", "TE", "picks", "rookies"] as const;
export const RANKINGS_SORTS = ["value", "age", "name"] as const;
export const MIN_RANKINGS_AGE = 20;
export const MAX_RANKINGS_AGE = 45;
export const MAX_RANKINGS_SEARCH = 50;

export type RankingsPosition = (typeof RANKINGS_POSITIONS)[number];
export type RankingsSort = (typeof RANKINGS_SORTS)[number];
export type RankingsQuery = { position: RankingsPosition; search: string; sort: RankingsSort; minAge?: number; maxAge?: number; page: number; username?: string };
export type RankingsSearchParams = Record<string, string | string[] | undefined>;

// Overriding any of these changes which rows exist, so a stale page number would land the
// reader on an empty page (page 9 of All has no counterpart in page 9 of TE).
const PAGE_RESETTING_KEYS = ["position", "sort", "minAge", "maxAge", "search"] as const;

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

const parseAge = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw.trim() === "") return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(MAX_RANKINGS_AGE, Math.max(MIN_RANKINGS_AGE, Math.round(parsed)));
};

/** Total: every invalid value falls back to its default rather than throwing. */
export function parseRankingsQuery(searchParams: RankingsSearchParams): RankingsQuery {
  const rawPosition = first(searchParams.position);
  const position = (RANKINGS_POSITIONS as readonly string[]).includes(rawPosition ?? "") ? (rawPosition as RankingsPosition) : "all";
  const rawSort = first(searchParams.sort);
  const sort = (RANKINGS_SORTS as readonly string[]).includes(rawSort ?? "") ? (rawSort as RankingsSort) : "value";
  const search = (first(searchParams.search) ?? "").trim().slice(0, MAX_RANKINGS_SEARCH);
  const rawPage = Number(first(searchParams.page));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  let minAge = parseAge(first(searchParams.minAge));
  let maxAge = parseAge(first(searchParams.maxAge));
  if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) [minAge, maxAge] = [maxAge, minAge];
  const username = first(searchParams.username)?.trim() || undefined;
  return { position, search, sort, minAge, maxAge, page, username };
}

/** Builds `?a=b&c=d`, omitting defaults so a clean URL stays clean. `username` is always
 *  preserved — the whole app carries it (see `withUsername` in src/lib/utils.ts) and
 *  dropping it would break roster highlighting on every filter click. */
export function serializeRankingsQuery(query: RankingsQuery, overrides: Partial<RankingsQuery> = {}): string {
  const resetsPage = PAGE_RESETTING_KEYS.some((key) => key in overrides && overrides[key] !== query[key]);
  const next: RankingsQuery = { ...query, ...overrides, page: "page" in overrides ? overrides.page ?? 1 : resetsPage ? 1 : query.page };
  const params = new URLSearchParams();
  if (next.position !== "all") params.set("position", next.position);
  if (next.search) params.set("search", next.search);
  if (next.sort !== "value") params.set("sort", next.sort);
  if (next.minAge !== undefined) params.set("minAge", String(next.minAge));
  if (next.maxAge !== undefined) params.set("maxAge", String(next.maxAge));
  if (next.page > 1) params.set("page", String(next.page));
  if (next.username) params.set("username", next.username);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const rankingsHref = (leagueId: string, query: RankingsQuery, overrides: Partial<RankingsQuery> = {}) => `/${leagueId}/players${serializeRankingsQuery(query, overrides)}`;

export const hasActiveRankingsFilters = (query: RankingsQuery) => Boolean(query.search || query.minAge !== undefined || query.maxAge !== undefined || query.position !== "all" || query.sort !== "value");

/** What the "Filters" button badges. Only the controls that live *inside* the popover
 *  count — position and search have their own always-visible affordances, so counting
 *  them would badge a button whose contents the reader can already see. */
export const rankingsFilterCount = (query: RankingsQuery) => (query.minAge !== undefined || query.maxAge !== undefined ? 1 : 0);

/** "22–30", "22+", "up to 30" — the age range as a chip label, or null when unset. */
export const describeAgeRange = (query: RankingsQuery): string | null => {
  if (query.minAge !== undefined && query.maxAge !== undefined) return `${query.minAge}–${query.maxAge}`;
  if (query.minAge !== undefined) return `${query.minAge}+`;
  if (query.maxAge !== undefined) return `up to ${query.maxAge}`;
  return null;
};

export const describeRankingsFilters = (query: RankingsQuery): string => {
  const parts: string[] = [];
  if (query.position !== "all") parts.push(query.position === "picks" ? "draft picks" : query.position === "rookies" ? "rookies" : `position ${query.position}`);
  if (query.search) parts.push(`search “${query.search}”`);
  if (query.minAge !== undefined || query.maxAge !== undefined) parts.push(`age ${query.minAge ?? MIN_RANKINGS_AGE}–${query.maxAge ?? MAX_RANKINGS_AGE}`);
  if (query.sort !== "value") parts.push(`sorted by ${query.sort}`);
  return parts.join(", ");
};
