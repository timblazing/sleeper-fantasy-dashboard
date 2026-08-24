import { afterEach, describe, expect, it, vi } from "vitest";
import { getRankings } from "@/lib/roster-audit/endpoints";

// Live-captured 2026-08-20: /rankings interleaves pick rows among the player rows. The app
// sources picks from /picks so that rankings-data.ts alone decides where a pick sorts, so
// getRankings must drop the inline ones rather than surface half-populated players.
const playerRow = {
  sleeper_id: "9509", name: "Bijan Robinson", position: "RB", team: "ATL", age: "24.6", tier: "1",
  trend_7d: "0", trend_30d: "0", photo_url: null, val_sf_market: "10000", val_1qb_market: "10000",
  years_exp: "3", value: 10000, rank_overall: 1, rank_pos: 1,
};
const pickRow = {
  type: "pick", sleeper_id: null, name: "2026 Pick 1.01", position: "PICK", team: "2026",
  age: null, value: 6300, rank_overall: 12, rank_pos: 0, tier: 0, trend_7d: 0, trend_30d: 0,
  photo_url: null, pick_season: 2026, pick_round: 1, pick_slot: "01", is_exact: true,
};

const body = {
  players: [playerRow, pickRow], total: 478, page: 1, per_page: 50, total_pages: 10,
  format: "sf", preset: "sf-ppr", preset_label: "SF PPR",
  attribution: "Values by RosterAudit.com", attribution_url: "https://rosteraudit.com",
};

afterEach(() => { vi.unstubAllGlobals(); });

describe("getRankings against the live /rankings shape", () => {
  it("parses a pick-interleaved page instead of failing the whole response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: "200",
      json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)),
    } as Response));

    const result = await getRankings({ preset: "sf-ppr", perPage: 50, page: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0].sleeperId).toBe("9509");
    expect(result.data.items.some((item) => item.position === "PICK")).toBe(false);
  });
});
