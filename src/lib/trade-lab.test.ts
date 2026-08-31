import { afterEach, describe, expect, it, vi } from "vitest";
import { resetRequestRateLimitForTests } from "@/lib/request-rate-limit";
import { deriveTradeSettings } from "@/lib/trade-lab";
import type { SleeperLeague } from "@/lib/types";

const league = (overrides: Partial<SleeperLeague> = {}): SleeperLeague => ({
  league_id: "1", name: "Test", season: "2026", sport: "nfl", status: "in_season", avatar: null,
  previous_league_id: null, roster_positions: ["QB", "RB", "WR", "TE"], scoring_settings: {}, settings: { type: 2, num_teams: 12 },
  ...overrides,
});

describe("deriveTradeSettings", () => {
  it("reads Superflex from a SUPER_FLEX slot", () => {
    expect(deriveTradeSettings(league({ roster_positions: ["QB", "SUPER_FLEX", "RB"] })).isSuperflex).toBe(true);
  });

  it("treats a second QB slot as Superflex", () => {
    expect(deriveTradeSettings(league({ roster_positions: ["QB", "QB", "RB"] })).isSuperflex).toBe(true);
  });

  it("is 1QB when the league starts one quarterback", () => {
    expect(deriveTradeSettings(league()).isSuperflex).toBe(false);
  });

  it("reads TE premium from bonus_rec_te", () => {
    expect(deriveTradeSettings(league({ scoring_settings: { bonus_rec_te: 0.5 } })).isTePremium).toBe(true);
    expect(deriveTradeSettings(league({ scoring_settings: { bonus_rec_te: 0 } })).isTePremium).toBe(false);
  });

  it("clamps league size into the range RosterAudit prices", () => {
    expect(deriveTradeSettings(league({ settings: { num_teams: 4 } })).leagueSize).toBe(8);
    expect(deriveTradeSettings(league({ settings: { num_teams: 24 } })).leagueSize).toBe(16);
    expect(deriveTradeSettings(league({ settings: {} })).leagueSize).toBe(12);
  });
});

describe("POST /api/roster-audit/trade", () => {
  afterEach(() => {
    resetRequestRateLimitForTests();
    vi.resetModules();
  });

  async function post(body: unknown, evaluate = vi.fn(), headers?: HeadersInit) {
    vi.doMock("@/lib/trade-lab", () => ({ evaluateTrade: evaluate }));
    const { POST } = await import("@/app/api/roster-audit/trade/route");
    const response = await POST(new Request("http://localhost/api/roster-audit/trade", { method: "POST", body: JSON.stringify(body), headers }));
    return { response, payload: await response.json() as { error?: string }, evaluate };
  }

  it("rejects a trade with an empty side before calling upstream", async () => {
    const { response, evaluate } = await post({ leagueId: "1", sideA: [{ type: "player", id: "4984" }], sideB: [] });
    expect(response.status).toBe(400);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("rejects client-supplied settings by ignoring them and validating the known shape", async () => {
    const evaluate = vi.fn().mockResolvedValue({ ok: true, data: { verdict: {} }, attribution: { text: "t", url: "u" } });
    const { response } = await post({ leagueId: "1", sideA: [{ type: "player", id: "4984" }], sideB: [{ type: "pick", season: 2027, round: 1, slot: "mid" }], settings: { is_superflex: true } }, evaluate);
    expect(response.status).toBe(200);
    expect(evaluate).toHaveBeenCalledWith("1", [{ type: "player", id: "4984" }], [{ type: "pick", season: 2027, round: 1, slot: "mid" }]);
  });

  it("rejects an unknown asset type", async () => {
    const { response, evaluate } = await post({ leagueId: "1", sideA: [{ type: "cash", id: "500" }], sideB: [{ type: "player", id: "9509" }] });
    expect(response.status).toBe(400);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("maps a rate limit to 429 without exposing the upstream message", async () => {
    const evaluate = vi.fn().mockResolvedValue({ ok: false, error: { kind: "rate-limited", message: "429 rate limited", retryable: false } });
    const { response, payload } = await post({ leagueId: "1", sideA: [{ type: "player", id: "4984" }], sideB: [{ type: "player", id: "9509" }] }, evaluate);
    expect(response.status).toBe(429);
    expect(payload.error).not.toContain("429");
  });

  it("maps a missing server key to 503", async () => {
    const evaluate = vi.fn().mockResolvedValue({ ok: false, error: { kind: "missing-key", message: "API key required", retryable: false } });
    const { response } = await post({ leagueId: "1", sideA: [{ type: "player", id: "4984" }], sideB: [{ type: "player", id: "9509" }] }, evaluate);
    expect(response.status).toBe(503);
  });

  it("limits valid requests per client before calling the evaluator", async () => {
    const evaluate = vi.fn().mockResolvedValue({ ok: true, data: { verdict: {} }, attribution: { text: "t", url: "u" } });
    const body = { leagueId: "1", sideA: [{ type: "player", id: "4984" }], sideB: [{ type: "player", id: "9509" }] };

    for (let request = 0; request < 20; request += 1) {
      expect((await post(body, evaluate, { "x-forwarded-for": "203.0.113.10" })).response.status).toBe(200);
    }

    const limited = await post(body, evaluate, { "x-forwarded-for": "203.0.113.10" });
    expect(limited.response.status).toBe(429);
    expect(limited.response.headers.get("retry-after")).toBe("600");
    expect(evaluate).toHaveBeenCalledTimes(20);
  });

  it("does not spend the valid-request budget on an invalid body", async () => {
    const evaluate = vi.fn().mockResolvedValue({ ok: true, data: { verdict: {} }, attribution: { text: "t", url: "u" } });
    const invalidBody = { leagueId: "1", sideA: [{ type: "player", id: "4984" }], sideB: [] };
    const validBody = { leagueId: "1", sideA: [{ type: "player", id: "4984" }], sideB: [{ type: "player", id: "9509" }] };
    const headers = { "x-real-ip": "198.51.100.12" };

    expect((await post(invalidBody, evaluate, headers)).response.status).toBe(400);
    for (let request = 0; request < 20; request += 1) {
      expect((await post(validBody, evaluate, headers)).response.status).toBe(200);
    }
    expect((await post(validBody, evaluate, headers)).response.status).toBe(429);
    expect(evaluate).toHaveBeenCalledTimes(20);
  });

  it("gives a different client address an independent budget", async () => {
    const evaluate = vi.fn().mockResolvedValue({ ok: true, data: { verdict: {} }, attribution: { text: "t", url: "u" } });
    const body = { leagueId: "1", sideA: [{ type: "player", id: "4984" }], sideB: [{ type: "player", id: "9509" }] };

    for (let request = 0; request < 20; request += 1) {
      expect((await post(body, evaluate, { "x-forwarded-for": "203.0.113.20" })).response.status).toBe(200);
    }

    const independent = await post(body, evaluate, { "x-forwarded-for": "203.0.113.21" });
    expect(independent.response.status).toBe(200);
    expect(evaluate).toHaveBeenCalledTimes(21);
  });
});
