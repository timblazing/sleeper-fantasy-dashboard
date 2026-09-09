import { describe, expect, it } from "vitest";
import { getDraftGradeData, gradeForSurplus } from "@/lib/draft-grades";
import { makeDraft, makeDraftPick, makeLeague, makePlayer, makeRoster, makeSource, makeUser } from "@/lib/test/fixtures";
import type { LeagueSource } from "@/lib/league-source";
import type { SleeperTradedPick } from "@/lib/types";

const curve = (sf: Record<number, number>): Awaited<ReturnType<LeagueSource["getPickCurve"]>> => ({ ok: true, data: { sf, oneQb: sf }, attribution: { text: "RosterAudit", url: "https://rosteraudit.com" } });

/** Four managers, one pick each in pick order, against a 400/300/200/100 slot curve. */
function fourPickDraft(values: number[], options: { traded?: SleeperTradedPick[]; withCurve?: boolean } = {}) {
  const catalog = new Map(values.map((_, index) => [`p${index + 1}`, makePlayer({ id: `p${index + 1}`, name: `Player ${index + 1}` })]));
  return makeSource({
    // Dynasty: the slot curve and the value map below are both dynasty-basis inputs.
    getLeague: async () => makeLeague({ settings: { type: 2 } }),
    getLeagueDrafts: async () => [makeDraft({ draft_id: "D1", settings: { teams: 4, rounds: 1 } })],
    getDraftPicks: async () => values.map((_, index) => makeDraftPick({ player_id: `p${index + 1}`, roster_id: index + 1, pick_no: index + 1, draft_slot: index + 1 })),
    getDraftTradedPicks: async () => options.traded ?? [],
    getLeagueRosters: async () => values.map((_, index) => makeRoster({ roster_id: index + 1, owner_id: `U${index + 1}` })),
    getLeagueUsers: async () => values.map((_, index) => makeUser({ user_id: `U${index + 1}`, display_name: `Manager ${index + 1}`, metadata: { team_name: `Team ${index + 1}` } })),
    getPlayerCatalog: async () => catalog,
    getPickCurve: async () => (options.withCurve === false ? { ok: false, error: { kind: "upstream-unavailable", message: "down", retryable: true } } : curve({ 1: 400, 2: 300, 3: 200, 4: 100 })),
    getValues: async () => ({ ok: true, attribution: { text: "RosterAudit", url: "https://rosteraudit.com" }, data: Object.fromEntries(values.map((value, index) => [`p${index + 1}`, { sf: value, "1qb": value }])) }),
  });
}

describe("gradeForSurplus", () => {
  it("grades on fixed thresholds, so a whole class can share the same band", () => {
    expect([1200, 600, 0, -600, -1200].map((surplus) => gradeForSurplus(surplus, "dynasty"))).toEqual(["A+", "A", "B-", "D", "F"]);
  });

  // The same ladder, read in the redraft basis: a swing of three points per game is one band.
  it("scales the same bands to points above replacement for a redraft league", () => {
    expect([3.6, 1.8, 0, -1.8, -3.6].map((surplus) => gradeForSurplus(surplus, "redraft"))).toEqual(["A+", "A", "B-", "D", "F"]);
    // A dynasty-sized number would otherwise grade every redraft manager A+.
    expect(gradeForSurplus(600, "redraft")).toBe("A+");
    expect(gradeForSurplus(1.8, "dynasty")).toBe("B-");
  });
});

describe("getDraftGradeData", () => {
  it("benchmarks each pick against the slot curve rather than the class itself", async () => {
    // Values 100/400/200/300 against a 400/300/200/100 curve.
    const data = await getDraftGradeData("L1", undefined, fourPickDraft([100, 400, 200, 300]));
    expect(data.curveBacked).toBe(true);
    expect(data.allPicks.map((pick) => pick.slotValue)).toEqual([400, 300, 200, 100]);
    expect(data.allPicks.map((pick) => pick.surplus)).toEqual([-300, 100, 0, 200]);
  });

  it("grades every manager well when every manager beat their slot", async () => {
    // Each pick clears its slot, so nobody is forced into a low grade by rank.
    const data = await getDraftGradeData("L1", undefined, fourPickDraft([900, 800, 700, 600]));
    expect(data.managers.every((manager) => manager.grade.startsWith("A"))).toBe(true);
    expect(data.managers.every((manager) => manager.hitRate === 100)).toBe(true);
  });

  it("falls back to the within-class benchmark and flags it when the curve is unavailable", async () => {
    const data = await getDraftGradeData("L1", undefined, fourPickDraft([100, 400, 200, 300], { withCurve: false }));
    expect(data.curveBacked).toBe(false);
    // Benchmark for pick N is the Nth-highest value of the class: 400/300/200/100.
    expect(data.allPicks.map((pick) => pick.surplus)).toEqual([100 - 400, 400 - 300, 0, 300 - 100]);
  });

  it("credits a traded slot to the roster it came from", async () => {
    // Roster 2 holds its own first-rounder plus roster 3's, so it picks twice in round 1.
    const catalog = new Map(["p1", "p2", "p3"].map((id) => [id, makePlayer({ id, name: id })]));
    const source = makeSource({
      getLeague: async () => makeLeague({ settings: { type: 2 } }),
      getLeagueDrafts: async () => [makeDraft({ draft_id: "D1", settings: { teams: 3, rounds: 1 } })],
      getDraftPicks: async () => [
        makeDraftPick({ player_id: "p1", roster_id: 1, pick_no: 1, draft_slot: 1 }),
        makeDraftPick({ player_id: "p2", roster_id: 2, pick_no: 2, draft_slot: 2 }),
        makeDraftPick({ player_id: "p3", roster_id: 2, pick_no: 3, draft_slot: 3 }),
      ],
      getDraftTradedPicks: async () => [{ season: "2025", round: 1, roster_id: 3, previous_owner_id: 3, owner_id: 2 }],
      getLeagueRosters: async () => [1, 2, 3].map((id) => makeRoster({ roster_id: id, owner_id: `U${id}` })),
      getLeagueUsers: async () => [1, 2, 3].map((id) => makeUser({ user_id: `U${id}`, display_name: `Manager ${id}`, metadata: { team_name: `Team ${id}` } })),
      getPlayerCatalog: async () => catalog,
      getPickCurve: async () => curve({ 1: 300, 2: 200, 3: 100 }),
      getValues: async () => ({ ok: true, attribution: { text: "RosterAudit", url: "https://rosteraudit.com" }, data: { p1: { sf: 1, "1qb": 1 }, p2: { sf: 1, "1qb": 1 }, p3: { sf: 1, "1qb": 1 } } }),
    });
    const data = await getDraftGradeData("L1", undefined, source);
    expect(data.allPicks.map((pick) => pick.acquiredFrom)).toEqual([null, null, "Team 3"]);
  });

  it("summarizes the class by position, round, and best/worst pick", async () => {
    const data = await getDraftGradeData("L1", undefined, fourPickDraft([100, 400, 200, 300]));
    expect(data.steals[0].surplus).toBe(200);
    expect(data.reaches[0].surplus).toBe(-300);
    expect(data.byRound).toEqual([{ round: 1, picks: 4, surplus: 0, surplusPerPick: 0 }]);
    expect(data.byPosition[0].picks).toBeGreaterThan(0);
  });

  it("builds a career row per manager spanning every completed draft", async () => {
    const catalog = new Map([["p1", makePlayer({ id: "p1" })]]);
    const source = makeSource({
      getLeague: async () => makeLeague({ settings: { type: 2 } }),
      getLeagueDrafts: async () => [makeDraft({ draft_id: "D1", season: "2024" }), makeDraft({ draft_id: "D2", season: "2025" })],
      getDraftPicks: async () => [makeDraftPick({ player_id: "p1", roster_id: 1, pick_no: 1, draft_slot: 1 })],
      getLeagueRosters: async () => [makeRoster({ roster_id: 1, owner_id: "U1" })],
      getLeagueUsers: async () => [makeUser({ user_id: "U1", metadata: { team_name: "Team 1" } })],
      getPlayerCatalog: async () => catalog,
      getPickCurve: async () => curve({ 1: 100 }),
      getValues: async () => ({ ok: true, attribution: { text: "RosterAudit", url: "https://rosteraudit.com" }, data: { p1: { sf: 300, "1qb": 300 } } }),
    });
    const data = await getDraftGradeData("L1", undefined, source);
    expect(data.career).toHaveLength(1);
    expect(data.career[0]).toMatchObject({ drafts: 2, picks: 2, surplus: 400, surplusPerPick: 200 });
    expect(data.career[0].bySeason.map((row) => row.season)).toEqual(["2024", "2025"]);
    expect(data.classes.map((row) => row.season)).toEqual(["2024", "2025"]);
  });

  // Redraft: the dynasty slot curve prices rookie picks, which a startup draft has none of, so
  // the class is benchmarked against itself and the curve is never even fetched.
  it("benchmarks a redraft class against itself without reading the slot curve", async () => {
    let curveRead = false;
    const catalog = new Map([1, 2, 3, 4].map((n) => [`p${n}`, makePlayer({ id: `p${n}`, name: `Player ${n}`, position: "RB" })]));
    const source = makeSource({
      getLeague: async () => makeLeague({ settings: { type: 0, num_teams: 4 }, roster_positions: ["RB"] }),
      getLeagueDrafts: async () => [makeDraft({ draft_id: "D1", settings: { teams: 4, rounds: 1 } })],
      getDraftPicks: async () => [1, 2, 3, 4].map((n) => makeDraftPick({ player_id: `p${n}`, roster_id: n, pick_no: n, draft_slot: n })),
      getLeagueRosters: async () => [1, 2, 3, 4].map((n) => makeRoster({ roster_id: n, owner_id: `U${n}` })),
      getLeagueUsers: async () => [1, 2, 3, 4].map((n) => makeUser({ user_id: `U${n}`, metadata: { team_name: `Team ${n}` } })),
      getPlayerCatalog: async () => catalog,
      getPickCurve: async () => { curveRead = true; throw new Error("must not be read"); },
      // 4 teams × 1 starting RB, so the 4th back is replacement: values are 12/8/4/0.
      getProjectedPpg: async () => ({
        ok: true,
        attribution: { text: "RosterAudit", url: "https://rosteraudit.com" },
        data: [22, 18, 14, 10].map((ppg, index) => ({ sleeperId: `p${index + 1}`, name: `Player ${index + 1}`, position: "RB", team: null, age: null, ppg })),
      }),
    });

    const data = await getDraftGradeData("L1", undefined, source);
    expect(curveRead).toBe(false);
    expect(data.basis).toBe("redraft");
    expect(data.curveBacked).toBe(false);
    // Picked in value order, so every pick exactly meets its slot and nobody gains or loses.
    expect(data.allPicks.map((pick) => pick.value)).toEqual([12, 8, 4, 0]);
    expect(data.allPicks.map((pick) => pick.surplus)).toEqual([0, 0, 0, 0]);
    expect(data.managers.every((manager) => manager.grade === "B-")).toBe(true);
  });

  it("returns the empty shape when no draft has completed", async () => {
    const source = makeSource({
      getLeagueDrafts: async () => [makeDraft({ status: "drafting" })],
      getLeagueRosters: async () => [makeRoster({ roster_id: 1 })],
    });
    const data = await getDraftGradeData("L1", undefined, source);
    expect(data).toMatchObject({ drafts: [], selectedDraftId: null, selectedLabel: "Draft", rounds: 0, managers: [], allPicks: [], career: [] });
  });

  it("selects the requested draft, falling back to the most recent complete one", async () => {
    const drafts = [makeDraft({ draft_id: "D1", season: "2024" }), makeDraft({ draft_id: "D2", season: "2025" })];
    const source = makeSource({ getLeagueDrafts: async () => drafts, getLeagueRosters: async () => [makeRoster({ roster_id: 1 })] });
    expect((await getDraftGradeData("L1", undefined, source)).selectedDraftId).toBe("D2");
    expect((await getDraftGradeData("L1", "D1", source)).selectedDraftId).toBe("D1");
  });
});
