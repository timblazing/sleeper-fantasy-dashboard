import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlayersPage from "@/app/[leagueId]/players/page";
import type { LeagueChrome } from "@/lib/league-chrome";
import type { RankingsResult } from "@/lib/rankings-data";

// RankingsSearch reads the app-router hooks; jsdom has no router.
vi.mock("next/navigation", () => ({ usePathname: () => "/L1/players", useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
// The page reads isDynasty from getLeagueChrome — the layout already renders the shell.
vi.mock("@/lib/league-chrome", () => ({ getLeagueChrome: vi.fn() }));
vi.mock("@/lib/rankings-data", () => ({ getRankingsView: vi.fn(), RANKINGS_PER_PAGE: 50 }));

const { getLeagueChrome } = await import("@/lib/league-chrome");
const { getRankingsView } = await import("@/lib/rankings-data");

const chrome = (isDynasty: boolean): LeagueChrome => ({ id: "L1", name: "Test League", season: "2026", type: isDynasty ? "Dynasty" : "Redraft", isDynasty, isSuperflex: true, avatar: null, matchupWeek: 4 });

const VIEW: RankingsResult = {
  ok: true,
  view: {
    leagueId: "L1", leagueName: "Test League", leagueSummary: "12T · SF · PPR", isSuperflex: true,
    presetKey: "sf-ppr", presetLabel: "SF PPR",
    rows: [{ kind: "player", key: "player-1", rank: 1, sleeperId: "1", name: "Bijan Robinson", position: "RB", team: "ATL", age: 24.5, tier: 1, value: 10000, trend7d: 0, rankPosition: 1, photoUrl: null, owner: null }],
    total: 1, totalLabel: "1 player", page: 1, totalPages: 1, maxValue: 10000,
    // Populated on purpose: the page must not render movers even when the view carries them.
    movers: {
      risers: [{ sleeperId: "2", name: "Rising Rick", position: "WR", team: "BUF", trend7d: 500 }],
      fallers: [{ sleeperId: "3", name: "Falling Fred", position: "TE", team: "NYJ", trend7d: -500 }],
    },
    attribution: { text: "Values by RosterAudit.com", url: "https://rosteraudit.com" },
  },
};

const renderPage = async (isDynasty: boolean, result: RankingsResult = VIEW) => {
  vi.mocked(getLeagueChrome).mockResolvedValue(chrome(isDynasty));
  vi.mocked(getRankingsView).mockResolvedValue(result);
  return render(await PlayersPage({ params: Promise.resolve({ leagueId: "L1" }), searchParams: Promise.resolve({}) }));
};

describe("PlayersPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the table for a dynasty league", async () => {
    await renderPage(true);
    expect(screen.getByText("Bijan Robinson")).toBeInTheDocument();
    // The RosterAudit credit is the layout's SiteFooter now, not this page's own attribution.
    expect(screen.queryByText("Values by RosterAudit.com")).not.toBeInTheDocument();
    expect(screen.queryByText("Players needs a dynasty league")).not.toBeInTheDocument();
  });

  it("renders DynastyRequired instead of the rankings table for a non-dynasty league", async () => {
    await renderPage(false);
    expect(screen.getByText("Players needs a dynasty league")).toBeInTheDocument();
    expect(screen.queryByText("Bijan Robinson")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to league overview" })).toHaveAttribute("href", "/L1");
  });

  it("renders the rate-limited empty state and no table when the read fails", async () => {
    await renderPage(true, { ok: false, error: { kind: "rate-limited", message: "429", retryable: true } });
    expect(screen.getByText("Players are rate limited")).toBeInTheDocument();
    expect(screen.getByText("RosterAudit is throttling requests right now. Wait a minute and reload — this page will not retry on its own.")).toBeInTheDocument();
    expect(screen.queryByText("Bijan Robinson")).not.toBeInTheDocument();
  });

  // MoversSummary was deliberately never ported onto this page; the view still carries
  // movers, so guard that a successful render shows neither risers nor fallers.
  it("does not render a risers/fallers section", async () => {
    await renderPage(true);
    expect(screen.getByText("Bijan Robinson")).toBeInTheDocument();
    expect(screen.queryByText("Rising Rick")).not.toBeInTheDocument();
    expect(screen.queryByText("Falling Fred")).not.toBeInTheDocument();
    expect(screen.queryByText(/Risers/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fallers/i)).not.toBeInTheDocument();
  });
});
