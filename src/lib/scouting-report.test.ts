import { describe, expect, it } from "vitest";
import type { LeagueTeam, PositionRoom } from "@/lib/league-values";
import { buildNetwork, buildTendencies, leverageFor, windowFor, type Lineage, type RoomNeed } from "@/lib/scouting-report";
import type { SleeperTransaction } from "@/lib/types";

const WEDNESDAY = new Date("2026-01-07T12:00:00Z").getTime();

const room = (position: PositionRoom["position"], rank: number): PositionRoom => ({ position, value: 1000, players: 3, avgAge: 25, rank, leagueAvg: 1000 });

const team = (rosterId: number, overrides: Partial<LeagueTeam> = {}): LeagueTeam => ({
  rosterId, ownerId: `user-${rosterId}`, name: `Team ${rosterId}`, manager: `Manager ${rosterId}`, avatar: null,
  wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, value: 1000, valueRank: rosterId, powerRank: rosterId,
  rooms: [room("QB", 1), room("RB", 1), room("WR", 1), room("TE", 1)], roster: [], starters: [], taxi: [], reserve: [], players: [],
  ...overrides,
});

const trade = (rosterIds: number[], overrides: Partial<SleeperTransaction> = {}): SleeperTransaction => ({
  transaction_id: `t-${Math.random()}`, type: "trade", status: "complete", created: WEDNESDAY,
  roster_ids: rosterIds, adds: null, drops: null, draft_picks: null, waiver_budget: null, ...overrides,
});

const waiver = (rosterId: number, bid: number, created = WEDNESDAY): SleeperTransaction => ({
  transaction_id: `w-${Math.random()}`, type: "waiver", status: "complete", created,
  roster_ids: [rosterId], adds: null, drops: null, draft_picks: null, waiver_budget: null, settings: { waiver_bid: bid },
});

const season = (transactions: SleeperTransaction[]): Lineage => ({ leagueId: "L", transactions, draftPicks: [] });

const need = (position: RoomNeed["position"], rank: number): RoomNeed => ({ position, rank, value: 500, leagueAvg: 1000, starterCount: 2 });

describe("buildTendencies", () => {
  it("attributes a trade to both sides and records them as partners", () => {
    const result = buildTendencies([season([trade([1, 2])])], [team(1), team(2)]);

    expect(result.get(1)?.trades).toBe(1);
    expect(result.get(2)?.trades).toBe(1);
    expect(result.get(1)?.partners).toEqual([{ rosterId: 2, manager: "Manager 2", trades: 1 }]);
  });

  it("counts player and pick flow from the direction of the deal", () => {
    // Roster 1 receives player 99 and sends a 2027 pick to roster 2.
    const result = buildTendencies([season([
      trade([1, 2], { adds: { "99": 1 }, drops: { "99": 2 }, draft_picks: [{ season: "2027", round: 1, roster_id: 1, owner_id: 2, previous_owner_id: 1 }] }),
    ])], [team(1), team(2)]);

    expect(result.get(1)?.netPlayerFlow).toBe(1);
    expect(result.get(2)?.netPlayerFlow).toBe(-1);
    expect(result.get(1)?.netPickFlow).toBe(-1);
    expect(result.get(2)?.netPickFlow).toBe(1);
  });

  it("grades trade style against the league's own pace rather than a fixed threshold", () => {
    // Roster 1 makes every trade in a quiet league, so it is hyperactive despite only three deals.
    const result = buildTendencies([season([trade([1, 2]), trade([1, 2]), trade([1, 2])])], [team(1), team(2), team(3)]);

    expect(result.get(1)?.style).toBe("Hyperactive");
    expect(result.get(3)?.style).toBe("Inactive");
    expect(result.get(1)?.tradeRank).toBe(1);
  });

  it("averages trade volume over the number of seasons scanned", () => {
    const result = buildTendencies([season([trade([1, 2])]), season([trade([1, 2])]), season([trade([1, 2])])], [team(1), team(2)]);

    expect(result.get(1)?.trades).toBe(3);
    expect(result.get(1)?.tradesPerYear).toBeCloseTo(1);
    expect(result.get(1)?.seasonsScanned).toBe(3);
  });

  it("sums FAAB from waivers and leaves trades out of the day-of-week profile", () => {
    const result = buildTendencies([season([waiver(1, 30), waiver(1, 12), trade([1, 2])])], [team(1), team(2)]);

    expect(result.get(1)?.waiverClaims).toBe(2);
    expect(result.get(1)?.faabSpent).toBe(42);
    // Two waivers land on Wednesday; the trade must not add a third.
    expect(result.get(1)?.activityByDay[3]).toBe(2);
  });

  it("withholds a busiest day until there is enough activity to call one", () => {
    const thin = buildTendencies([season([waiver(1, 1), waiver(1, 1)])], [team(1)]);
    expect(thin.get(1)?.busiestDay).toBeNull();

    const enough = buildTendencies([season(Array.from({ length: 5 }, () => waiver(1, 1)))], [team(1)]);
    expect(enough.get(1)?.busiestDay).toBe("Wednesday");
  });
});

describe("buildNetwork", () => {
  it("collapses repeated pairings into one weighted link", () => {
    const links = buildNetwork([season([trade([1, 2]), trade([2, 1]), trade([1, 3])])]);

    expect(links[0]).toEqual({ a: 1, b: 2, trades: 2 });
    expect(links).toHaveLength(2);
  });

  it("records every pairing in a three-team deal", () => {
    const links = buildNetwork([season([trade([1, 2, 3])])]);

    expect(links).toHaveLength(3);
    expect(links.every((link) => link.trades === 1)).toBe(true);
  });
});

describe("windowFor", () => {
  const tendencies = (netPickFlow: number) => ({ ...buildTendencies([season([])], [team(1)]).get(1)!, netPickFlow });

  it("reads a strong roster as a contender", () => {
    expect(windowFor(team(1, { valueRank: 1 }), 12, tendencies(0))).toBe("Contender");
  });

  it("reads a weak roster as rebuilding", () => {
    expect(windowFor(team(12, { valueRank: 12 }), 12, tendencies(0))).toBe("Rebuilding");
  });

  it("lets pick hoarding override a flattering value rank", () => {
    // Rank 6 of 12 reads as Fringe on value alone; stockpiling picks is the louder signal.
    expect(windowFor(team(6, { valueRank: 6 }), 12, tendencies(0))).toBe("Fringe");
    expect(windowFor(team(6, { valueRank: 6 }), 12, tendencies(4))).toBe("Rebuilding");
  });
});

describe("leverageFor", () => {
  const base = buildTendencies([season([])], [team(1)]).get(1)!;
  const activeTrader = { ...base, trades: 12, tradesPerYear: 4 };

  it("scores a manager who never trades at zero, however good the fit", () => {
    const score = leverageFor(
      { tendencies: { ...base, trades: 0, tradesPerYear: 0 }, needs: [need("RB", 12)], surpluses: [need("QB", 1)], window: "Rebuilding" },
      [need("RB", 1)], [need("QB", 12)],
    );

    expect(score).toBe(0);
  });

  it("rewards a hole that your surplus fills", () => {
    const fits = leverageFor({ tendencies: activeTrader, needs: [need("RB", 12)], surpluses: [], window: "Fringe" }, [need("RB", 1)], []);
    const misses = leverageFor({ tendencies: activeTrader, needs: [need("RB", 12)], surpluses: [], window: "Fringe" }, [need("TE", 1)], []);

    expect(fits).toBeGreaterThan(misses);
  });

  it("ranks a reachable manager above an equally-fitting inactive one", () => {
    const reachable = leverageFor({ tendencies: activeTrader, needs: [need("RB", 12)], surpluses: [], window: "Fringe" }, [need("RB", 1)], []);
    const quiet = leverageFor({ tendencies: { ...base, trades: 1, tradesPerYear: 0.3 }, needs: [need("RB", 12)], surpluses: [], window: "Fringe" }, [need("RB", 1)], []);

    expect(reachable).toBeGreaterThan(quiet);
  });

  it("stays inside 0-100", () => {
    const score = leverageFor(
      { tendencies: { ...base, trades: 40, tradesPerYear: 20 }, needs: [need("RB", 12)], surpluses: [need("QB", 1)], window: "Rebuilding" },
      [need("RB", 1)], [need("QB", 12)],
    );

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
