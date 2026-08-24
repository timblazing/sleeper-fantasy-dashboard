import { describe, expect, it } from "vitest";
import { parseInjuryQuery } from "@/lib/injury-query";
import { getInjuryReport, practiceLabel, selectInjuryEntries, severityOf } from "@/lib/injury-report";
import { makePlayer, makeRoster, makeSource, makeUser } from "@/lib/test/fixtures";

const catalog = new Map([
  ["healthy", makePlayer({ id: "healthy", name: "Healthy Harry" })],
  ["ir", makePlayer({ id: "ir", name: "Zeb Reserve", injuryStatus: "IR", position: "RB" })],
  ["out", makePlayer({ id: "out", name: "Olive Out", injuryStatus: "Out", position: "WR" })],
  ["questionable", makePlayer({ id: "questionable", name: "Quinn Question", injuryStatus: "Questionable", position: "QB" })],
  ["doubtful-a", makePlayer({ id: "doubtful-a", name: "Ana Doubt", injuryStatus: "Doubtful" })],
  ["doubtful-b", makePlayer({ id: "doubtful-b", name: "Bo Doubt", injuryStatus: "Doubtful" })],
  ["unknown", makePlayer({ id: "unknown", name: "Una Knock", injuryStatus: null, injuryBodyPart: "Ankle", position: "TE" })],
]);

const values = (data: Record<string, number>) => async () => ({
  ok: true as const,
  attribution: { text: "RosterAudit", url: "https://rosteraudit.com" },
  data: Object.fromEntries(Object.entries(data).map(([id, value]) => [id, { sf: value, "1qb": value }])),
});

const source = (players: string[], overrides: { reserve?: string[]; starters?: string[]; taxi?: string[]; values?: Record<string, number> } = {}) =>
  makeSource({
    getPlayerCatalog: async () => catalog,
    getLeagueUsers: async () => [makeUser({ user_id: "U1", metadata: { team_name: "Team One" } })],
    getLeagueRosters: async () => [makeRoster({ roster_id: 1, owner_id: "U1", players, reserve: overrides.reserve ?? [], starters: overrides.starters ?? [], taxi: overrides.taxi ?? [] })],
    ...(overrides.values ? { getValues: values(overrides.values) } : {}),
  });

const query = (params: Record<string, string> = {}) => parseInjuryQuery(params);

describe("severityOf", () => {
  it("splits Sleeper's statuses into out, risk, and watch", () => {
    expect(severityOf(makePlayer({ injuryStatus: "IR" }))).toBe("out");
    expect(severityOf(makePlayer({ injuryStatus: "Sus" }))).toBe("out");
    expect(severityOf(makePlayer({ injuryStatus: "Questionable" }))).toBe("risk");
    expect(severityOf(makePlayer({ injuryStatus: "Doubtful" }))).toBe("risk");
    // Probable is not "in doubt" — it is the mildest designation Sleeper reports.
    expect(severityOf(makePlayer({ injuryStatus: "Probable" }))).toBe("watch");
    expect(severityOf(makePlayer({ injuryStatus: null, injuryBodyPart: "Knee" }))).toBe("watch");
  });
});

describe("practiceLabel", () => {
  it("strips Sleeper's trailing boilerplate and keeps the designation", () => {
    expect(practiceLabel("Did Not Participate In Practice")).toBe("Did Not Participate");
    expect(practiceLabel("Limited Participation In Practice")).toBe("Limited");
    expect(practiceLabel("Full Participation In Practice")).toBe("Full");
    expect(practiceLabel(null)).toBeNull();
  });
});

describe("getInjuryReport", () => {
  it("excludes players with no injury signal at all", async () => {
    const report = await getInjuryReport("L1", source(["healthy", "out"]));
    expect(report.entries.map((entry) => entry.player.id)).toEqual(["out"]);
    expect(report.catalogReady).toBe(true);
  });

  it("orders by severity, then starters, then value, then name", async () => {
    const report = await getInjuryReport("L1", source(
      ["unknown", "questionable", "doubtful-b", "doubtful-a", "out", "ir"],
      { starters: ["doubtful-b"], values: { "doubtful-a": 9000 } }
    ));
    // ir/out are both "out" and neither starts and neither is valued, so the tiebreak is the
    // name: "Olive Out" before "Zeb Reserve". doubtful-b starts, so it outranks the more
    // valuable doubtful-a — a starter's injury is the one that costs points this week.
    expect(report.entries.map((entry) => entry.player.id)).toEqual(["out", "ir", "doubtful-b", "doubtful-a", "questionable", "unknown"]);
  });

  it("marks onInjuredReserve from roster.reserve, not from the injury status", async () => {
    const report = await getInjuryReport("L1", source(["ir", "out"], { reserve: ["out"] }));
    const byId = new Map(report.entries.map((entry) => [entry.player.id, entry]));
    expect(byId.get("out")?.onInjuredReserve).toBe(true);
    expect(byId.get("ir")?.onInjuredReserve).toBe(false);
    expect(byId.get("out")?.fantasyTeam).toBe("Team One");
  });

  it("ignores Sleeper's empty '0' lineup slots when deciding who starts", async () => {
    const report = await getInjuryReport("L1", source(["out", "ir"], { starters: ["0", "out"] }));
    const byId = new Map(report.entries.map((entry) => [entry.player.id, entry]));
    expect(byId.get("out")?.isStarter).toBe(true);
    expect(byId.get("ir")?.isStarter).toBe(false);
    expect(report.startersAffected).toBe(1);
  });

  it("summarizes counts per severity and rolls teams up worst-first", async () => {
    const report = await getInjuryReport("L1", source(
      ["out", "ir", "questionable", "unknown"],
      { starters: ["questionable"], values: { out: 5000, questionable: 3000, unknown: 100 } }
    ));
    expect(report.summary).toEqual({ out: 2, risk: 1, watch: 1 });
    expect(report.teams).toHaveLength(1);
    expect(report.teams[0].counts).toEqual({ out: 2, risk: 1, watch: 1 });
    expect(report.teams[0].startersAffected).toBe(1);
    // Watch-tier players are not "at risk", so `unknown`'s 100 is excluded.
    expect(report.teams[0].valueAtRisk).toBe(8000);
    expect(report.valuesReady).toBe(true);
  });

  it("degrades to null values when RosterAudit is unreachable", async () => {
    const report = await getInjuryReport("L1", makeSource({
      getPlayerCatalog: async () => catalog,
      getLeagueRosters: async () => [makeRoster({ roster_id: 1, players: ["out"] })],
      getValues: async () => ({ ok: false, error: { kind: "upstream-unavailable", message: "down", retryable: true } }),
    }));
    expect(report.valuesReady).toBe(false);
    expect(report.entries[0].value).toBeNull();
  });

  it("reports catalogReady false when the player map is unavailable", async () => {
    const report = await getInjuryReport("L1", makeSource({ getPlayerCatalog: async () => { throw new Error("down"); } }));
    expect(report.catalogReady).toBe(false);
    expect(report.entries).toEqual([]);
  });
});

describe("selectInjuryEntries", () => {
  const load = () => getInjuryReport("L1", source(
    ["out", "ir", "questionable", "unknown"],
    { starters: ["questionable"], values: { out: 5000, questionable: 3000 } }
  ));

  it("returns every entry for an empty query", async () => {
    const report = await load();
    expect(selectInjuryEntries(report, query())).toHaveLength(4);
  });

  it("filters by position, severity, and starter status", async () => {
    const report = await load();
    expect(selectInjuryEntries(report, query({ position: "WR" })).map((entry) => entry.player.id)).toEqual(["out"]);
    expect(selectInjuryEntries(report, query({ status: "out" })).map((entry) => entry.player.id)).toEqual(["out", "ir"]);
    expect(selectInjuryEntries(report, query({ starters: "1" })).map((entry) => entry.player.id)).toEqual(["questionable"]);
  });

  it("searches player name, fantasy team, NFL team, and body part", async () => {
    const report = await load();
    expect(selectInjuryEntries(report, query({ search: "olive" })).map((entry) => entry.player.id)).toEqual(["out"]);
    expect(selectInjuryEntries(report, query({ search: "team one" }))).toHaveLength(4);
    expect(selectInjuryEntries(report, query({ search: "ankle" })).map((entry) => entry.player.id)).toEqual(["unknown"]);
  });

  it("re-sorts by value and by name on request", async () => {
    const report = await load();
    // ir and unknown are both unvalued, so the tie falls back to name.
    expect(selectInjuryEntries(report, query({ sort: "value" })).map((entry) => entry.player.id)).toEqual(["out", "questionable", "unknown", "ir"]);
    expect(selectInjuryEntries(report, query({ sort: "name" })).map((entry) => entry.player.name)).toEqual(["Olive Out", "Quinn Question", "Una Knock", "Zeb Reserve"]);
  });
});
