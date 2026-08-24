import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Attribution, RaPaged, RaPick, RaPlayerValue, RaPreset, RaResult } from "@/lib/roster-audit";
import type { RankingsQuery } from "@/lib/rankings-query";
import type { SleeperLeague, SleeperRoster, SleeperUser } from "@/lib/types";

const getPresets = vi.fn();
const getRankings = vi.fn();
const getPicks = vi.fn();
const getMovers = vi.fn();
const getLeague = vi.fn();
const getLeagueRosters = vi.fn();
const getLeagueUsers = vi.fn();
const getNflLeaguesForUsername = vi.fn();

vi.mock("@/lib/roster-audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/roster-audit")>();
  return { ...actual, getPresets, getRankings, getPicks, getMovers };
});

vi.mock("@/lib/sleeper", () => ({ getLeague, getLeagueRosters, getLeagueUsers, getNflLeaguesForUsername }));

const { getRankingsView } = await import("@/lib/rankings-data");

const ATTRIBUTION: Attribution = { text: "Values by RosterAudit.com", url: "https://rosteraudit.com" };
const ok = <T,>(data: T): RaResult<T> => ({ ok: true, data, attribution: ATTRIBUTION });

const preset = (over: Partial<RaPreset> & Pick<RaPreset, "key">): RaPreset => ({ label: over.key.toUpperCase(), formatKey: over.key.replace(/-/g, "_"), isSuperflex: over.key.startsWith("sf"), isTep: over.key.endsWith("tep"), scoringFormat: "ppr", leagueSize: 12, reliable: true, ...over });
const PRESETS = [preset({ key: "sf-ppr" }), preset({ key: "sf-ppr-tep" }), preset({ key: "1qb-ppr" }), preset({ key: "1qb-ppr-tep" })];

const league = (rosterPositions: string[]): SleeperLeague => ({ league_id: "L1", name: "Test League", season: "2026", sport: "nfl", status: "in_season", avatar: null, previous_league_id: null, roster_positions: rosterPositions, scoring_settings: { rec: 1 }, settings: { num_teams: 12, type: 2 } });
const SF_LEAGUE = league(["QB", "SUPER_FLEX", "RB", "WR", "TE"]);
const ONE_QB_LEAGUE = league(["QB", "RB", "WR", "TE"]);

const player = (id: string, name: string, value: number, over: Partial<RaPlayerValue> = {}): RaPlayerValue => ({ sleeperId: id, name, position: "RB", team: "ATL", age: 24.5, tier: 1, value, valueSf: value, value1qb: value, rankOverall: null, rankPosition: 1, trend7d: 0, trend30d: 0, photoUrl: null, yearsExp: 3, ...over });
const paged = (items: RaPlayerValue[], over: Partial<RaPaged<RaPlayerValue>> = {}): RaPaged<RaPlayerValue> => ({ items, total: items.length, page: 1, perPage: 50, totalPages: 1, preset: "sf-ppr", presetLabel: "SF PPR", ...over });
const pick = (over: Partial<RaPick> & Pick<RaPick, "id" | "label">): RaPick => ({ season: 2027, round: 1, slot: "early", valueSf: 5005, value1qb: 5005, sortOrder: 1, ...over });

const QUERY: RankingsQuery = { position: "all", search: "", sort: "value", page: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  getLeague.mockResolvedValue(SF_LEAGUE);
  getLeagueRosters.mockResolvedValue([]);
  getLeagueUsers.mockResolvedValue([]);
  getNflLeaguesForUsername.mockResolvedValue({ userId: "u1" });
  getPresets.mockResolvedValue(ok(PRESETS));
  getRankings.mockResolvedValue(ok(paged([player("1", "Bijan Robinson", 6000), player("2", "Puka Nacua", 4000), player("3", "Tank Bigsby", 2000)])));
  getPicks.mockResolvedValue(ok([pick({ id: 1, label: "2027 Early 1st", valueSf: 3000, value1qb: 3000 })]));
  getMovers.mockResolvedValue(ok({ risers: [player("9", "Blake Corum", 746, { trend7d: 4129 })], fallers: [], updated: null }));
});

describe("getRankingsView pick merging", () => {
  it("interleaves picks into the value-sorted list at the correct rank", async () => {
    const result = await getRankingsView("L1", QUERY);
    if (!result.ok) throw new Error("expected ok");
    expect(result.view.rows.map((row) => [row.rank, row.kind, row.value])).toEqual([
      [1, "player", 6000],
      [2, "player", 4000],
      [3, "pick", 3000],
      [4, "player", 2000],
    ]);
  });

  it("does not merge picks when sorting by age or name", async () => {
    for (const sort of ["age", "name"] as const) {
      const result = await getRankingsView("L1", { ...QUERY, sort });
      if (!result.ok) throw new Error("expected ok");
      expect(result.view.rows.every((row) => row.kind === "player")).toBe(true);
    }
    expect(getPicks).not.toHaveBeenCalled();
  });

  it("does not merge picks into a single-position tab", async () => {
    const result = await getRankingsView("L1", { ...QUERY, position: "QB" });
    if (!result.ok) throw new Error("expected ok");
    expect(result.view.rows.every((row) => row.kind === "player")).toBe(true);
    expect(getPicks).not.toHaveBeenCalled();
  });

  it("leaves out picks whose value falls outside the current page's range", async () => {
    getRankings.mockResolvedValue(ok(paged([player("1", "A", 9000), player("2", "B", 8000)], { page: 2, totalPages: 4, total: 200 })));
    const result = await getRankingsView("L1", { ...QUERY, page: 2 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.view.rows.every((row) => row.kind === "player")).toBe(true);
  });

  it("uses the preset-correct pick value — a 1QB league must not inherit val_sf", async () => {
    // Regression guard for rosteraudit-api-reference.md §2.8 (`sf ?? 1qb`).
    getLeague.mockResolvedValue(ONE_QB_LEAGUE);
    getPicks.mockResolvedValue(ok([pick({ id: 1, label: "2027 Early 1st", valueSf: 5005, value1qb: 3000 })]));
    const result = await getRankingsView("L1", QUERY);
    if (!result.ok) throw new Error("expected ok");
    expect(result.view.presetKey).toBe("1qb-ppr");
    const pickRow = result.view.rows.find((row) => row.kind === "pick");
    expect(pickRow?.value).toBe(3000);
  });

  it("shows picks only, paginated locally, on the picks tab", async () => {
    getPicks.mockResolvedValue(ok([pick({ id: 1, label: "2027 Early 1st", valueSf: 5005, value1qb: 5005 }), pick({ id: 2, label: "2027 Mid 1st", valueSf: 2888, value1qb: 2888 })]));
    const result = await getRankingsView("L1", { ...QUERY, position: "picks" });
    if (!result.ok) throw new Error("expected ok");
    expect(getRankings).not.toHaveBeenCalled();
    expect(result.view.rows.map((row) => row.kind)).toEqual(["pick", "pick"]);
    expect(result.view.totalLabel).toBe("2 picks");
  });
});

describe("getRankingsView rookies tab", () => {
  const ROOKIE_QUERY: RankingsQuery = { ...QUERY, position: "rookies" };
  const mixed = [player("1", "Bijan Robinson", 6000, { yearsExp: 3 }), player("2", "Ashton Jeanty", 5000, { yearsExp: 0 }), player("3", "Tetairoa McMillan", 4000, { yearsExp: 0 }), player("4", "Unknown Guy", 3000, { yearsExp: null })];

  it("keeps only players with no NFL experience", async () => {
    getRankings.mockResolvedValue(ok(paged(mixed)));
    const result = await getRankingsView("L1", ROOKIE_QUERY);
    if (!result.ok) throw new Error("expected ok");
    expect(result.view.rows.map((row) => (row.kind === "player" ? row.name : row.label))).toEqual(["Ashton Jeanty", "Tetairoa McMillan"]);
    expect(result.view.totalLabel).toBe("2 rookies");
  });

  // years_exp === null is an unknown, not a rookie; counting it would put veterans on the tab.
  it("excludes players whose experience is unknown", async () => {
    getRankings.mockResolvedValue(ok(paged([player("4", "Unknown Guy", 3000, { yearsExp: null })])));
    const result = await getRankingsView("L1", ROOKIE_QUERY);
    if (!result.ok) throw new Error("expected ok");
    expect(result.view.rows).toEqual([]);
    expect(result.view.totalLabel).toBe("0 rookies");
  });

  // /rankings has no experience filter, so the tab must pull one wide page and slice locally.
  it("requests a single wide page with no position filter", async () => {
    getRankings.mockResolvedValue(ok(paged(mixed)));
    await getRankingsView("L1", ROOKIE_QUERY);
    expect(getRankings).toHaveBeenCalledWith(expect.objectContaining({ page: 1, perPage: 100, position: undefined }));
  });

  it("never merges draft picks into the rookie list", async () => {
    getRankings.mockResolvedValue(ok(paged(mixed)));
    const result = await getRankingsView("L1", ROOKIE_QUERY);
    if (!result.ok) throw new Error("expected ok");
    expect(result.view.rows.every((row) => row.kind === "player")).toBe(true);
  });

  it("paginates locally and ranks continuously across pages", async () => {
    const rookies = Array.from({ length: 60 }, (_, index) => player(`r${index}`, `Rookie ${index}`, 6000 - index, { yearsExp: 0 }));
    getRankings.mockResolvedValue(ok(paged(rookies)));
    const result = await getRankingsView("L1", { ...ROOKIE_QUERY, page: 2 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.view.totalPages).toBe(2);
    expect(result.view.rows).toHaveLength(10);
    expect(result.view.rows[0]).toMatchObject({ rank: 51, name: "Rookie 50" });
    expect(result.view.totalLabel).toBe("60 rookies");
  });

  it("labels a single rookie in the singular", async () => {
    getRankings.mockResolvedValue(ok(paged([player("2", "Ashton Jeanty", 5000, { yearsExp: 0 })])));
    const result = await getRankingsView("L1", ROOKIE_QUERY);
    if (!result.ok) throw new Error("expected ok");
    expect(result.view.totalLabel).toBe("1 rookie");
  });
});

describe("getRankingsView ownership", () => {
  const rosters: SleeperRoster[] = [
    { roster_id: 1, owner_id: "u1", players: ["1"], starters: null, taxi: null, reserve: null, settings: {} },
    { roster_id: 2, owner_id: "u2", players: ["2"], starters: null, taxi: null, reserve: null, settings: {} },
  ];
  const users: SleeperUser[] = [
    { user_id: "u1", display_name: "Ada", username: "ada", avatar: null, metadata: { team_name: "Fourth & Long" } },
    { user_id: "u2", display_name: "Bo", username: "bo", avatar: null },
  ];

  it("marks the signed-in user's players isMine and others with their team name", async () => {
    getLeagueRosters.mockResolvedValue(rosters);
    getLeagueUsers.mockResolvedValue(users);
    const result = await getRankingsView("L1", { ...QUERY, username: "ada" });
    if (!result.ok) throw new Error("expected ok");
    const rows = result.view.rows.filter((row) => row.kind === "player");
    expect(rows[0].owner).toEqual({ teamName: "Fourth & Long", isMine: true });
    expect(rows[1].owner).toEqual({ teamName: "Bo", isMine: false });
    expect(rows[2].owner).toBeNull();
  });

  it("owns nothing when no username is present", async () => {
    getLeagueRosters.mockResolvedValue(rosters);
    getLeagueUsers.mockResolvedValue(users);
    const result = await getRankingsView("L1", QUERY);
    if (!result.ok) throw new Error("expected ok");
    const rows = result.view.rows.filter((row) => row.kind === "player");
    expect(rows.every((row) => !row.owner?.isMine)).toBe(true);
    expect(getNflLeaguesForUsername).not.toHaveBeenCalled();
  });
});

describe("getRankingsView movers and errors", () => {
  it("returns only trend fields from /movers, never the unusable percent change", async () => {
    const result = await getRankingsView("L1", QUERY);
    if (!result.ok) throw new Error("expected ok");
    expect(Object.keys(result.view.movers?.risers[0] ?? {})).toEqual(["sleeperId", "name", "position", "team", "trend7d"]);
  });

  it("returns an error state rather than throwing when /rankings fails", async () => {
    getRankings.mockResolvedValue({ ok: false, error: { kind: "rate-limited", message: "429 rate limited", retryable: false } });
    const result = await getRankingsView("L1", QUERY);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error state");
    expect(result.error.kind).toBe("rate-limited");
  });

  it("returns an error state rather than throwing when Sleeper is unreachable", async () => {
    getLeague.mockRejectedValue(new Error("503 upstream"));
    const result = await getRankingsView("L1", QUERY);
    if (result.ok) throw new Error("expected an error state");
    expect(result.error.kind).toBe("upstream-unavailable");
  });

  it("carries the response attribution and summarizes the league settings", async () => {
    const result = await getRankingsView("L1", QUERY);
    if (!result.ok) throw new Error("expected ok");
    expect(result.view.attribution).toEqual(ATTRIBUTION);
    expect(result.view.leagueSummary).toBe("12T · SF · PPR");
    // The format is derived from the league, not chosen: a superflex league gets the
    // superflex preset and there is no user-facing control that could override it.
    expect(result.view.presetKey).toBe("sf-ppr");
  });
});
