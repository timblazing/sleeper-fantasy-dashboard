import { beforeEach, describe, expect, it, vi } from "vitest";
import { getShowcase } from "@/lib/showcase";

const getNflLeaguesForUsername = vi.fn();
const getLeagueChrome = vi.fn();
const getOverviewData = vi.fn();

vi.mock("@/lib/sleeper", () => ({ getNflLeaguesForUsername: (...args: unknown[]) => getNflLeaguesForUsername(...args) }));
vi.mock("@/lib/league-chrome", () => ({ getLeagueChrome: (...args: unknown[]) => getLeagueChrome(...args) }));
vi.mock("@/lib/team-insights", () => ({ getOverviewData: (...args: unknown[]) => getOverviewData(...args) }));

describe("getShowcase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLeagueChrome.mockResolvedValue({ id: "L1", name: "League", season: "2026", type: "Dynasty", isDynasty: true, matchupWeek: 1 });
    getOverviewData.mockResolvedValue({ insights: [] });
  });

  it("returns the backdrop league when Sleeper answers", async () => {
    getNflLeaguesForUsername.mockResolvedValue({ leagues: [{ id: "L1" }] });

    expect(await getShowcase()).toMatchObject({ league: { id: "L1" } });
  });

  it("returns null rather than throwing when Sleeper is down", async () => {
    getNflLeaguesForUsername.mockRejectedValue(new Error("502"));

    expect(await getShowcase()).toBeNull();
  });

  it("returns null when the showcase account has no leagues", async () => {
    getNflLeaguesForUsername.mockResolvedValue({ leagues: [] });

    expect(await getShowcase()).toBeNull();
  });

  it("returns null when the overview data fails to build", async () => {
    getNflLeaguesForUsername.mockResolvedValue({ leagues: [{ id: "L1" }] });
    getOverviewData.mockRejectedValue(new Error("values down"));

    expect(await getShowcase()).toBeNull();
  });
});
