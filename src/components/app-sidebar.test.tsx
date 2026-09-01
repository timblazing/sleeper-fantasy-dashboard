import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { LeagueChrome } from "@/lib/league-chrome";

// The sidebar reads the app-router hooks; jsdom has no router.
const searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => searchParams,
  useSelectedLayoutSegment: () => null,
}));

// The sidebar primitives call useIsMobile, which calls window.matchMedia.
beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false } as Response)));
});

const league = (isDynasty: boolean): LeagueChrome => ({ id: "123", name: "Test League", season: "2026", type: isDynasty ? "Dynasty" : "Redraft", isDynasty, isSuperflex: true, avatar: null, matchupWeek: 4 });

const hrefs = (container: HTMLElement) => [...container.querySelectorAll("a")].map((anchor) => anchor.getAttribute("href"));

function renderSidebar(chrome: LeagueChrome) {
  return render(<SidebarProvider><AppSidebar league={chrome} /></SidebarProvider>);
}

describe("AppSidebar", () => {
  it("renders the dynasty tool links for a dynasty league", () => {
    const { container } = renderSidebar(league(true));
    const rendered = hrefs(container);
    expect(rendered).toEqual(expect.arrayContaining(["/123/trade", "/123/injuries"]));
    expect(screen.getByText("Injury Report")).toBeInTheDocument();
    expect(screen.queryByText("Dynasty tools unavailable")).not.toBeInTheDocument();
  });

  it("does not render the removed Insights page", () => {
    const { container } = renderSidebar(league(true));
    const rendered = hrefs(container);
    expect(rendered).not.toContain("/123/insights");
    expect(screen.queryByText("Insights")).not.toBeInTheDocument();
  });

  it("hides the dynasty tool links for a non-dynasty league and explains why", () => {
    const { container } = renderSidebar(league(false));
    const rendered = hrefs(container);
    expect(rendered).not.toContain("/123/trade");
    expect(screen.getByText("Dynasty tools unavailable")).toBeInTheDocument();
  });

  it("keeps the injury report in Tools for every league format", () => {
    for (const isDynasty of [true, false]) {
      const { container, unmount } = renderSidebar(league(isDynasty));
      expect(hrefs(container)).toContain("/123/injuries");
      expect(screen.getByText("Injury Report")).toBeInTheDocument();
      unmount();
    }
  });

  it("keeps Resources in Tools for every league format", () => {
    for (const isDynasty of [true, false]) {
      const { container, unmount } = renderSidebar(league(isDynasty));
      expect(hrefs(container)).toContain("/123/resources");
      expect(screen.getByText("Resources")).toBeInTheDocument();
      unmount();
    }
  });

  it("renders the requested primary links in order without a section title", () => {
    const { container } = renderSidebar(league(true));
    const rendered = hrefs(container);
    const primaryLinks = rendered.filter((href) => href === "/123" || href === "/123/league" || href === "/123/players" || href === "/123/draft");
    expect(primaryLinks).toEqual(["/123", "/123/league", "/123/players", "/123/draft"]);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("League")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("no longer offers the removed Weekly Report link", () => {
    const { container } = renderSidebar(league(true));
    expect(hrefs(container)).not.toContain("/123/weekly-report");
    expect(screen.queryByText("Weekly Report")).not.toBeInTheDocument();
  });

  it("removes the old analytics and standings links", () => {
    const { container } = renderSidebar(league(true));
    const rendered = hrefs(container);
    expect(rendered).not.toContain("/123/power-rankings");
    expect(rendered).not.toContain("/123/standings");
    expect(rendered).not.toContain("/123/playoffs");
    expect(rendered).not.toContain("/123/history");
    expect(screen.queryByText("Analytics")).not.toBeInTheDocument();
    expect(screen.queryByText("Power Rankings")).not.toBeInTheDocument();
    expect(screen.queryByText("Playoffs")).not.toBeInTheDocument();
    expect(screen.queryByText("League History")).not.toBeInTheDocument();
    expect(screen.queryByText("Standings")).not.toBeInTheDocument();
    expect(rendered.indexOf("/123/draft")).toBeLessThan(rendered.indexOf("/123/trade"));
    expect(screen.getByText("Tools")).toBeInTheDocument();
  });

  it("labels the draft analytics entry Draft", () => {
    const { container } = renderSidebar(league(true));
    expect(hrefs(container)).toContain("/123/draft");
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders Scouting in Tools for every league format", () => {
    for (const isDynasty of [true, false]) {
      const { container, unmount } = renderSidebar(league(isDynasty));
      expect(hrefs(container)).toContain("/123/scouting-report");
      expect(screen.getByText("Scouting Report")).toBeInTheDocument();
      unmount();
    }
  });

  it("places Scouting before Injuries and Resources", () => {
    const { container } = renderSidebar(league(true));
    const rendered = hrefs(container);
    expect(rendered.indexOf("/123/scouting-report")).toBe(rendered.indexOf("/123/trade") + 1);
    expect(rendered.indexOf("/123/injuries")).toBe(rendered.indexOf("/123/scouting-report") + 1);
    expect(rendered.indexOf("/123/resources")).toBe(rendered.indexOf("/123/injuries") + 1);
  });

  it("does not render the removed Stats link", () => {
    const { container } = renderSidebar(league(true));
    const rendered = hrefs(container);
    expect(rendered).not.toContain("/123/stats");
    expect(screen.queryByText("Stats")).not.toBeInTheDocument();
  });

  // Rankings was folded into Players, so its own nav entry is gone for every format.
  it("no longer offers the removed Rankings link", () => {
    for (const isDynasty of [true, false]) {
      const { container, unmount } = renderSidebar(league(isDynasty));
      expect(hrefs(container)).not.toContain("/123/rankings");
      expect(screen.queryByText("Rankings", { exact: true })).not.toBeInTheDocument();
      expect(hrefs(container)).toContain("/123/players");
      unmount();
    }
  });

  it("no longer offers the removed League Hub link", () => {
    const { container } = renderSidebar(league(true));
    expect(hrefs(container)).not.toContain("/123/hub");
    expect(screen.queryByText("League Hub")).not.toBeInTheDocument();
  });

  it("does not render the removed Matchups link", () => {
    const { container } = renderSidebar(league(true));
    expect(hrefs(container)).not.toContain("/123/matchups/4");
    expect(screen.queryByText("Matchups")).not.toBeInTheDocument();
  });

  it("preserves the username query on every sidebar link", () => {
    searchParams.set("username", "tim blazing");
    try {
      const { container } = renderSidebar(league(true));
      const rendered = hrefs(container).filter((href): href is string => href !== null && href.startsWith("/123"));
      expect(rendered.length).toBeGreaterThan(0);
      for (const href of rendered) expect(href).toContain("?username=tim%20blazing");
      expect(rendered).toContain("/123/league?username=tim%20blazing");
    } finally {
      searchParams.delete("username");
    }
  });
});
