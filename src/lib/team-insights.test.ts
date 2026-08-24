import { describe, expect, it } from "vitest";
import { buildChampionshipOdds } from "@/lib/team-insights";

const team = (rosterId: number, projectedPpg: number | null, value: number) => ({
  rosterId,
  manager: `Manager ${rosterId}`,
  name: `Team ${rosterId}`,
  projectedPpg,
  value,
  valueRank: rosterId,
  powerRank: rosterId,
  pointsFor: 0,
  wins: 0,
  losses: 0,
  ties: 0,
  isUser: rosterId === 2,
});

describe("buildChampionshipOdds", () => {
  it("returns four seasons whose odds add to 100 percent", () => {
    const seasons = buildChampionshipOdds([team(1, 140, 8000), team(2, 125, 10000), team(3, 110, 6000)], 2026, 2);

    expect(seasons.map(({ season }) => season)).toEqual([2026, 2027, 2028, 2029]);
    for (const season of seasons) expect(season.rows.reduce((sum, row) => sum + row.odds, 0)).toBeCloseTo(100, 5);
  });

  it("places a team with no points signal inside the range of the teams that have one", () => {
    // Roster 3 has no projection and no games played, but the best power rank in the league.
    // Ranking it on the raw points scale would put ~3 next to everyone else's ~120 and pin
    // its odds at zero; it belongs at the top of the measured range instead.
    const seasons = buildChampionshipOdds([team(1, 130, 9000), team(2, 120, 9000), { ...team(3, null, 9000), powerRank: 1 }], 2026, 2);
    const rows = seasons[0].rows;
    const rowFor = (rosterId: number) => rows.find((row) => row.rosterId === rosterId);

    expect(rowFor(3)?.ppg).toBe(130);
    expect(rowFor(3)?.odds).toBeGreaterThan(rowFor(2)?.odds ?? 0);
  });

  it("still separates teams by power rank when nobody has a points signal", () => {
    const seasons = buildChampionshipOdds([team(1, null, 9000), team(2, null, 9000), team(3, null, 9000)], 2026, 2);
    const oddsFor = (rosterId: number) => seasons[0].rows.find((row) => row.rosterId === rosterId)?.odds ?? 0;

    expect(oddsFor(1)).toBeGreaterThan(oddsFor(3));
    expect(seasons[0].rows.reduce((sum, row) => sum + row.odds, 0)).toBeCloseTo(100, 5);
  });

  it("lets roster strength matter more in later seasons", () => {
    const seasons = buildChampionshipOdds([team(1, 145, 5000), team(2, 115, 10000)], 2026, 2);
    const oddsFor = (seasonIndex: number, rosterId: number) => seasons[seasonIndex].rows.find((row) => row.rosterId === rosterId)?.odds ?? 0;

    expect(oddsFor(3, 2)).toBeGreaterThan(oddsFor(0, 2));
  });
});
