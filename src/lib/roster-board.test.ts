import { describe, expect, it } from "vitest";
import { getRosterBoard } from "@/lib/roster-board";
import { makeLeague, makeMatchup, makePlayer, makeRoster, makeSource, makeUser } from "@/lib/test/fixtures";

const catalog = new Map([
  ["qb", makePlayer({ id: "qb", name: "Quinn Back", position: "QB" })],
  ["rb", makePlayer({ id: "rb", name: "Rhea Back", position: "RB" })],
  ["def", makePlayer({ id: "def", name: "Kansas City", position: "DEF" })],
  ["bench", makePlayer({ id: "bench", name: "Benny Bench", position: "WR" })],
]);

describe("getRosterBoard", () => {
  it("maps roster positions to their display labels and skips non-starting slots", async () => {
    const source = makeSource({
      getLeague: async () => makeLeague({ roster_positions: ["QB", "SUPER_FLEX", "DEF", "BN", "IR"] }),
      getLeagueUsers: async () => [makeUser({ user_id: "U1", metadata: { team_name: "Team One" } })],
      getLeagueRosters: async () => [makeRoster({ roster_id: 1, owner_id: "U1", players: ["qb", "rb", "def", "bench"], starters: ["qb", "rb", "def"] })],
      getPlayerCatalog: async () => catalog,
      getMatchups: async () => [makeMatchup({ roster_id: 1, players_points: { bench: 12 } })],
    });
    const board = await getRosterBoard("L1", source);
    const [starters, bench] = board.teams[0].groups;
    expect(starters.slots.map((slot) => slot.slot)).toEqual(["QB", "SFLEX", "D/ST"]);
    expect(bench.slots.map((slot) => slot.player?.id)).toEqual(["bench"]);
    expect(bench.slots[0].points).toBe(12);
    expect(board.teams[0].counts).toEqual({ QB: 1, RB: 1, DEF: 1, WR: 1 });
  });

  it("sorts teams by name", async () => {
    const source = makeSource({
      getLeagueUsers: async () => [
        makeUser({ user_id: "U1", metadata: { team_name: "Zebras" } }),
        makeUser({ user_id: "U2", metadata: { team_name: "Aardvarks" } }),
      ],
      getLeagueRosters: async () => [makeRoster({ roster_id: 1, owner_id: "U1" }), makeRoster({ roster_id: 2, owner_id: "U2" })],
      getPlayerCatalog: async () => catalog,
    });
    const board = await getRosterBoard("L1", source);
    expect(board.teams.map((team) => team.name)).toEqual(["Aardvarks", "Zebras"]);
  });

  it("keeps empty starting slots visible and formats the record", async () => {
    const source = makeSource({
      getLeague: async () => makeLeague({ roster_positions: ["QB", "RB", "WR", "BN"] }),
      getLeagueRosters: async () => [makeRoster({ roster_id: 1, owner_id: null, starters: ["qb", "0"], settings: { wins: 3, losses: 2, ties: 1 } })],
      getPlayerCatalog: async () => catalog,
    });
    const board = await getRosterBoard("L1", source);
    const starters = board.teams[0].groups[0];
    expect(starters.slots).toHaveLength(3);
    expect(starters.slots.map((slot) => slot.player?.id ?? null)).toEqual(["qb", null, null]);
    expect(board.teams[0].record).toBe("3–2–1");
    expect(board.teams[0].name).toBe("Roster 1");
  });
});
