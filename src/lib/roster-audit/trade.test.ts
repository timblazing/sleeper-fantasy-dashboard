import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateTrade } from "@/lib/roster-audit/endpoints";
import { tradeResponseSchema } from "@/lib/roster-audit/schemas";

/** Trimmed from a live 2026-08-18 `/trade/calculate` response — see docs/rosteraudit-api-reference.md §3. */
const playerAsset = { type: "player", id: "4984", sleeper_id: "4984", name: "Josh Allen", position: "QB", team: "BUF", age: 30.2, value: 8819, val_sf: 8819, val_1qb: 5980, raw_value: 8819, rank_pos: 1, rank_pos_sf: 1, rank_pos_1qb: 1, rank_overall: 4, rank_overall_sf: 4, rank_overall_1qb: 12, trend_7d: -211, trend_30d: -451, tier: 1, photo_url: "https://rosteraudit.com/ra/4984.jpg", buy_low: false, sell_high: false };
const pickAsset = { type: "pick", season: 2027, round: 1, slot: "mid", label: "2027 Mid 1st", value: 2828, val_sf: 2828, val_1qb: 2828 };
const tradeFixture = {
  side_a: { assets: [playerAsset], raw_value: 8819, adjusted_value: 8819, asset_count: 1 },
  side_b: { assets: [pickAsset], raw_value: 2828, adjusted_value: 2828, asset_count: 1 },
  verdict: { winner: "side_a", grade: "F", difference: 5991, difference_pct: 67.9 },
  meta: { is_superflex: true, is_te_premium: false, scoring_format: "ppr", league_size: null, calculated_at: "2026-08-18 12:36:48" },
  cliff_warnings: [{ player_id: "4984", player_name: "Josh Allen", position: "QB", risk_level: "moderate", risk_score: 16, summary: "Manageable risk.", factors: [{ factor: "approaching_decline", severity: "low", detail: "1.8 years from the typical QB decline age." }], side: "acquiring" }],
  attribution: "Values by RosterAudit.com",
  attribution_url: "https://rosteraudit.com",
};

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: String(status), json: () => Promise.resolve(body) } as Response;
}

describe("trade response schema", () => {
  it("parses players and picks as separate asset shapes", () => {
    const parsed = tradeResponseSchema.parse(tradeFixture);
    expect(parsed.side_a.assets[0].type).toBe("player");
    expect(parsed.side_b.assets[0]).toMatchObject({ type: "pick", label: "2027 Mid 1st" });
  });

  it("defaults cliff_warnings when the key is absent", () => {
    const withoutWarnings: Record<string, unknown> = { ...tradeFixture };
    delete withoutWarnings.cliff_warnings;
    expect(tradeResponseSchema.parse(withoutWarnings).cliff_warnings).toEqual([]);
  });

  it("rejects the vendor-documented shape, which upstream does not send", () => {
    expect(tradeResponseSchema.safeParse({ side_a: { total_value: 9200, assets: [] }, side_b: { total_value: 7800, assets: [] }, differential: 1400, verdict: "Side A wins", cliff_warnings: [] }).success).toBe(false);
  });
});

describe("calculateTrade", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("sends snake_case assets and derived settings, and normalizes the result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, tradeFixture));
    vi.stubGlobal("fetch", fetchMock);

    const result = await calculateTrade({
      sideA: [{ type: "player", id: "4984" }],
      sideB: [{ type: "pick", season: 2027, round: 1, slot: "mid" }],
      settings: { isSuperflex: true, isTePremium: false, leagueSize: 12 },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ side_a: [{ type: "player", id: "4984" }], side_b: [{ type: "pick", season: 2027, round: 1, slot: "mid" }], settings: { is_superflex: true, is_te_premium: false, league_size: 12 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.verdict).toMatchObject({ winner: "sideA", grade: "F", difference: 5991 });
    expect(result.data.sideA.value).toBe(8819);
    expect(result.data.cliffWarnings[0]).toMatchObject({ sleeperId: "4984", riskLevel: "moderate" });
  });

  it("reports an even trade as no winner even though upstream still names side_a", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { ...tradeFixture, verdict: { winner: "side_a", grade: "A+", difference: 0, difference_pct: 0 } })));
    const result = await calculateTrade({ sideA: [{ type: "player", id: "9509" }], sideB: [{ type: "player", id: "9509" }], settings: { isSuperflex: false, isTePremium: false } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.verdict.winner).toBeNull();
  });

  it("surfaces the rate limit as a non-retryable error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(429, { error: "Too many requests" })));
    const result = await calculateTrade({ sideA: [{ type: "player", id: "4984" }], sideB: [{ type: "player", id: "9509" }], settings: { isSuperflex: true, isTePremium: false } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ kind: "rate-limited", retryable: false });
  });

  it("classifies a missing server key rather than leaking the 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "API key required" })));
    const result = await calculateTrade({ sideA: [{ type: "player", id: "4984" }], sideB: [{ type: "player", id: "9509" }], settings: { isSuperflex: true, isTePremium: false } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("missing-key");
  });
});
