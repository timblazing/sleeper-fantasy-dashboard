import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RankingsToolbar } from "@/components/rankings-toolbar";
import type { RankingsQuery } from "@/lib/rankings-query";

// RankingsSearch reads the app-router hooks; jsdom has no router.
vi.mock("next/navigation", () => ({ usePathname: () => "/L1/players", useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const QUERY: RankingsQuery = { position: "all", search: "", sort: "value", page: 1 };

const positionButtons = () => [...(screen.getByRole("group", { name: "Position" }).querySelectorAll("a"))];

describe("RankingsToolbar position filters", () => {
  it("offers Rookies immediately after Picks", () => {
    render(<RankingsToolbar leagueId="L1" query={QUERY} />);
    expect(positionButtons().map((anchor) => anchor.textContent)).toEqual(["All", "QB", "RB", "WR", "TE", "Picks", "Rookies"]);
  });

  it("links Rookies to the shareable position query", () => {
    render(<RankingsToolbar leagueId="L1" query={QUERY} />);
    expect(screen.getByText("Rookies").closest("a")).toHaveAttribute("href", "/L1/players?position=rookies");
  });

  it("marks Rookies as the current page when it is the active filter", () => {
    render(<RankingsToolbar leagueId="L1" query={{ ...QUERY, position: "rookies" }} />);
    expect(screen.getByText("Rookies").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Picks").closest("a")).not.toHaveAttribute("aria-current");
  });

  // The username carries roster highlighting across every navigation in the app.
  it("preserves the username on the Rookies link", () => {
    render(<RankingsToolbar leagueId="L1" query={{ ...QUERY, username: "tim" }} />);
    expect(screen.getByText("Rookies").closest("a")).toHaveAttribute("href", "/L1/players?position=rookies&username=tim");
  });
});
