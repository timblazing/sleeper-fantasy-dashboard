import { describe, expect, it } from "vitest";
import { describeGame, formatTrend, formatValue, headshotUrl } from "@/lib/display";
import { makePlayer } from "@/lib/test/fixtures";
import type { PlayerGame } from "@/lib/types";

describe("headshotUrl", () => {
  it("uses the team logo for a DEF player with a team", () => {
    expect(headshotUrl(makePlayer({ position: "DEF", team: "KC", id: "KC" }))).toBe("https://sleepercdn.com/images/team_logos/nfl/kc.png");
  });

  it("falls back to the player thumb for a DEF player with no team", () => {
    expect(headshotUrl(makePlayer({ position: "DEF", team: null, id: "p9" }))).toBe("https://sleepercdn.com/content/nfl/players/thumb/p9.jpg");
  });

  it("uses the player thumb for a normal player", () => {
    expect(headshotUrl(makePlayer({ position: "WR", team: "KC", id: "p1" }))).toBe("https://sleepercdn.com/content/nfl/players/thumb/p1.jpg");
  });
});

describe("describeGame", () => {
  it("returns an empty string for no game", () => {
    expect(describeGame(null)).toBe("");
  });

  it("returns BYE for a bye week", () => {
    const game: PlayerGame = { opponent: null, home: false, kickoff: null, state: "pre", detail: "", bye: true };
    expect(describeGame(game)).toBe("BYE");
  });

  it("omits the detail suffix for a home pre-game", () => {
    const game: PlayerGame = { opponent: "BUF", home: true, kickoff: "2026-09-07T17:00:00Z", state: "pre", detail: "1:00 PM", bye: false };
    expect(describeGame(game)).toBe("vs BUF");
  });

  it("includes the detail suffix for an away in-progress game", () => {
    const game: PlayerGame = { opponent: "BUF", home: false, kickoff: "2026-09-07T17:00:00Z", state: "in", detail: "Q3 8:41", bye: false };
    expect(describeGame(game)).toBe("@ BUF · Q3 8:41");
  });
});

describe("formatValue", () => {
  it("renders zero as an em dash", () => {
    expect(formatValue(0)).toBe("—");
  });

  it("renders sub-10000 values with thousands separators", () => {
    expect(formatValue(9999)).toBe("9,999");
  });

  it("renders 10000 and above in K notation", () => {
    expect(formatValue(10000)).toBe("10.0K");
  });
});

describe("formatTrend", () => {
  it("prefixes a positive trend with a plus sign", () => {
    expect(formatTrend(150)).toBe("+150");
  });

  it("keeps the minus sign on a negative trend", () => {
    expect(formatTrend(-75)).toBe("-75");
  });

  it("rounds a fractional value", () => {
    expect(formatTrend(12.6)).toBe("+13");
  });
});
