import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RankingsTable } from "@/components/rankings-table";
import type { RankingsPlayerRow, RankingsPickRow, RankingsView } from "@/lib/rankings-data";
import type { RankingsQuery } from "@/lib/rankings-query";

const QUERY: RankingsQuery = { position: "all", search: "", sort: "value", page: 1 };

const playerRow = (over: Partial<RankingsPlayerRow> = {}): RankingsPlayerRow => ({
  kind: "player", key: "player-1", rank: 1, sleeperId: "1", name: "Bijan Robinson", position: "RB", team: "ATL",
  age: 24.5, tier: 1, value: 10000, trend7d: 0, rankPosition: 1, photoUrl: null, owner: null, ...over,
});

const pickRow = (over: Partial<RankingsPickRow> = {}): RankingsPickRow => ({ kind: "pick", key: "pick-1", rank: 25, label: "2027 Early 1st", value: 5005, ...over });

const view = (rows: RankingsView["rows"]): RankingsView => ({
  leagueId: "L1", leagueName: "Test League", leagueSummary: "12T · SF · PPR", isSuperflex: true,
  presetKey: "sf-ppr", presetLabel: "SF PPR",
  rows, total: rows.length, totalLabel: `${rows.length} players`, page: 1, totalPages: 1,
  maxValue: rows.reduce((max, row) => Math.max(max, row.value), 0),
  movers: null, attribution: { text: "Values by RosterAudit.com", url: "https://rosteraudit.com" },
});

describe("RankingsTable", () => {
  it("badges the signed-in user's row and names the owner on someone else's", () => {
    render(<RankingsTable query={QUERY} view={view([
      playerRow({ owner: { teamName: "Fourth & Long", isMine: true } }),
      playerRow({ key: "player-2", rank: 2, sleeperId: "2", name: "Puka Nacua", owner: { teamName: "Turf Monsters", isMine: false } }),
    ])} />);

    expect(screen.getByText("MY TEAM")).toBeInTheDocument();
    expect(screen.getByText("ATL · Turf Monsters")).toBeInTheDocument();
    expect(screen.getAllByText("MY TEAM")).toHaveLength(1);
  });

  it("links a player name to the player profile route, carrying username", () => {
    render(<RankingsTable query={{ ...QUERY, username: "ada" }} view={view([playerRow()])} />);
    expect(screen.getByRole("link", { name: "Bijan Robinson" })).toHaveAttribute("href", "/L1/players/1?username=ada");
  });

  it("renders a pick row with its label verbatim and an em dash for age", () => {
    render(<RankingsTable query={QUERY} view={view([pickRow()])} />);
    expect(screen.getByText("2027 Early 1st")).toBeInTheDocument();
    expect(screen.getByText("PICK")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("renders no trend indicator for a zero trend_7d and one for a non-zero trend", () => {
    const { rerender } = render(<RankingsTable query={QUERY} view={view([playerRow({ trend7d: 0 })])} />);
    expect(screen.queryByText(/^[+-]/)).not.toBeInTheDocument();
    rerender(<RankingsTable query={QUERY} view={view([playerRow({ trend7d: 412 })])} />);
    expect(screen.getByText("+412")).toBeInTheDocument();
  });

  it("shows a bare position badge — no positional rank, no tier, since the Rank column covers ordering", () => {
    render(<RankingsTable query={QUERY} view={view([playerRow({ tier: 3, rankPosition: 2 })])} />);
    expect(screen.getByText("RB")).toBeInTheDocument();
    expect(screen.queryByText("RB2")).not.toBeInTheDocument();
    expect(screen.queryByText("T3")).not.toBeInTheDocument();
  });

  it("renders a filter-clearing empty state that names the active filters", () => {
    render(<RankingsTable query={{ ...QUERY, position: "TE", search: "kyren" }} view={view([])} />);
    expect(screen.getByText(/position TE/)).toBeInTheDocument();
    expect(screen.getByText(/kyren/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/L1/players");
  });
});
