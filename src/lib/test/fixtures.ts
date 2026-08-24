import type { LeagueSource } from "@/lib/league-source";
import type { NflPlayer, NflState, SleeperDraft, SleeperDraftPick, SleeperLeague, SleeperMatchup, SleeperRoster, SleeperTransaction, SleeperUser } from "@/lib/types";

/**
 * Minimal-but-valid upstream objects, plus a `LeagueSource` built from them.
 *
 * Every factory fills in sane defaults so a test names only the fields it asserts on. `settings`,
 * `scoring_settings` and `metadata` are merged one level deep — a test overriding `settings.wins`
 * must not silently lose the default `fpts`.
 */

export function makeLeague(overrides: Partial<SleeperLeague> = {}): SleeperLeague {
  return {
    league_id: "L1", name: "Test League", season: "2025", sport: "nfl", status: "in_season",
    avatar: null, previous_league_id: null,
    roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF", "BN", "BN"],
    ...overrides,
    scoring_settings: { rec: 1, ...overrides.scoring_settings },
    settings: { num_teams: 12, divisions: 0, type: 0, ...overrides.settings },
    metadata: overrides.metadata,
  };
}

export function makeRoster(overrides: Partial<SleeperRoster> = {}): SleeperRoster {
  return {
    roster_id: 1, owner_id: "U1", players: [], starters: [], taxi: null, reserve: null,
    ...overrides,
    settings: { wins: 0, losses: 0, ties: 0, fpts: 0, fpts_decimal: 0, fpts_against: 0, fpts_against_decimal: 0, ...overrides.settings },
  };
}

export function makeUser(overrides: Partial<SleeperUser> = {}): SleeperUser {
  return { user_id: "U1", display_name: "Manager 1", username: "manager1", avatar: null, ...overrides };
}

export function makeState(overrides: Partial<NflState> = {}): NflState {
  return { season: "2025", week: 5, display_week: 5, season_type: "regular", ...overrides };
}

export function makePlayer(overrides: Partial<NflPlayer> = {}): NflPlayer {
  return {
    id: "p1", name: "Player One", position: "WR", team: "KC", age: 25, yearsExp: 3,
    injuryStatus: null, injuryBodyPart: null, practiceParticipation: null, number: 1,
    espnId: null, searchRank: 100, depthChartOrder: 1, status: "Active", ...overrides,
  };
}

export function makeMatchup(overrides: Partial<SleeperMatchup> = {}): SleeperMatchup {
  return { matchup_id: 1, roster_id: 1, points: 0, starters: [], starters_points: [], players_points: null, ...overrides };
}

export function makeTransaction(overrides: Partial<SleeperTransaction> = {}): SleeperTransaction {
  return {
    transaction_id: "t1", type: "free_agent", status: "complete", created: 1_700_000_000_000,
    roster_ids: [1], adds: null, drops: null, draft_picks: null, waiver_budget: null, ...overrides,
  };
}

export function makeDraft(overrides: Partial<SleeperDraft> = {}): SleeperDraft {
  return { draft_id: "D1", league_id: "L1", season: "2025", status: "complete", type: "snake", settings: { teams: 12, rounds: 3 }, ...overrides };
}

export function makeDraftPick(overrides: Partial<SleeperDraftPick> = {}): SleeperDraftPick {
  return { player_id: "p1", picked_by: "U1", roster_id: 1, round: 1, draft_slot: 1, pick_no: 1, ...overrides };
}

const emptyValues: Awaited<ReturnType<LeagueSource["getValues"]>> = { ok: true, data: {}, attribution: { text: "RosterAudit", url: "https://rosteraudit.com" } };

const emptyPickCurve: Awaited<ReturnType<LeagueSource["getPickCurve"]>> = { ok: true, data: { sf: {}, oneQb: {} }, attribution: { text: "RosterAudit", url: "https://rosteraudit.com" } };

/** A source whose every read succeeds with nothing in it. Tests override only what they assert on. */
export function makeSource(overrides: Partial<LeagueSource> = {}): LeagueSource {
  return {
    getLeague: async () => makeLeague(),
    getNflState: async () => makeState(),
    getLeagueUsers: async () => [],
    getLeagueRosters: async () => [],
    getMatchups: async () => [],
    getTransactions: async () => [],
    getLeagueDrafts: async () => [],
    getDraftPicks: async () => [],
    getDraftTradedPicks: async () => [],
    getWinnersBracket: async () => [],
    getLosersBracket: async () => [],
    getPlayerCatalog: async () => new Map(),
    getValues: async () => emptyValues,
    getPickCurve: async () => emptyPickCurve,
    getNflLeaguesForUsername: async () => { throw new Error("no account configured in this fixture"); },
    getWeekGamesByTeam: async () => new Map(),
    getWeekHomeAwayByTeam: async () => new Map(),
    getWeeklyProjections: async () => new Map(),
    ...overrides,
  };
}

export type TwelveTeamLeague = {
  league: SleeperLeague;
  users: SleeperUser[];
  rosters: SleeperRoster[];
  matchups: SleeperMatchup[];
  catalog: Map<string, NflPlayer>;
  values: Record<string, { sf: number; "1qb": number }>;
  source: LeagueSource;
};

/**
 * A coherent 12-team league: roster N has 12 - N wins so standings order is predictable, three
 * players each (`p{N}1`..`p{N}3`), and six head-to-head matchups pairing roster N with N + 6.
 */
export function makeTwelveTeamLeague(overrides: { league?: Partial<SleeperLeague>; source?: Partial<LeagueSource> } = {}): TwelveTeamLeague {
  const ids = Array.from({ length: 12 }, (_, index) => index + 1);
  const league = makeLeague({ settings: { num_teams: 12, ...overrides.league?.settings }, ...overrides.league });
  const users = ids.map((id) => makeUser({ user_id: `U${id}`, display_name: `Manager ${id}`, username: `manager${id}`, metadata: { team_name: `Team ${id}` } }));
  const positions = ["QB", "RB", "WR"];
  const catalog = new Map<string, NflPlayer>();
  const values: Record<string, { sf: number; "1qb": number }> = {};
  const rosters = ids.map((id) => {
    const players = positions.map((position, slot) => {
      const playerId = `p${id}${slot + 1}`;
      catalog.set(playerId, makePlayer({ id: playerId, name: `Player ${id}-${slot + 1}`, position }));
      values[playerId] = { sf: 1000 - id * 10 - slot, "1qb": 900 - id * 10 - slot };
      return playerId;
    });
    return makeRoster({ roster_id: id, owner_id: `U${id}`, players, starters: players, settings: { wins: 12 - id, losses: id, fpts: 1000 - id * 10, fpts_decimal: 50 } });
  });
  const matchups = ids.map((id) => makeMatchup({ matchup_id: id > 6 ? id - 6 : id, roster_id: id, points: 100 + id, starters: rosters[id - 1].starters, starters_points: [10, 20, 30] }));

  const source = makeSource({
    getLeague: async () => league,
    getLeagueUsers: async () => users,
    getLeagueRosters: async () => rosters,
    getMatchups: async () => matchups,
    getPlayerCatalog: async () => catalog,
    getValues: async () => ({ ...emptyValues, data: values }),
    ...overrides.source,
  });

  return { league, users, rosters, matchups, catalog, values, source };
}
