import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TeamSwitcher } from "@/components/team-switcher";
import { SidebarProvider } from "@/components/ui/sidebar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useSelectedLayoutSegment: () => null,
}));

// The sidebar primitives call useIsMobile, which calls window.matchMedia.
beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  // The dropdown primitive measures and scrolls its popup; jsdom implements neither.
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
});

// The Avatar primitive preloads through `new window.Image()` and only mounts the real <img>
// after that fires `onload` — which jsdom never does on its own. This stub captures the
// pending loads so a test can resolve them by hand.
const pending: { src: string; onload?: () => void; onerror?: () => void }[] = [];
beforeAll(() => {
  window.Image = function (this: Record<string, unknown>) {
    const entry: { src: string; onload?: () => void; onerror?: () => void } = { src: "" };
    pending.push(entry);
    return new Proxy(this, {
      set(_target, key, value) {
        if (key === "src") entry.src = value as string;
        if (key === "onload") entry.onload = value as () => void;
        if (key === "onerror") entry.onerror = value as () => void;
        return true;
      },
    });
  } as unknown as typeof window.Image;
});
beforeEach(() => { pending.length = 0; });

const teams = [
  { name: "Dynasty Club", plan: "2026", url: "/1", logo: "https://sleepercdn.com/avatars/thumbs/abc" },
  { name: "Redraft Club", plan: "2026", url: "/2", disabled: true, disabledReason: "Redraft leagues are not supported yet" },
];

async function openMenu() {
  render(<SidebarProvider><TeamSwitcher activeTeam={{ name: "Dynasty Club", plan: "2026 · Dynasty" }} teams={teams} /></SidebarProvider>);
  // jsdom reports the trigger as pointer-events:none under the popup primitive's styles.
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  await user.click(screen.getByRole("button", { name: /Dynasty Club/ }));
  await screen.findByRole("menu");
}

describe("TeamSwitcher", () => {
  it("links to dynasty leagues and greys out the rest", async () => {
    await openMenu();
    const items = screen.getAllByRole("menuitem");
    const dynasty = items.find((item) => item.textContent?.includes("Dynasty Club"))!;
    const redraft = items.find((item) => item.textContent?.includes("Redraft Club"))!;

    expect(dynasty.closest("a")?.getAttribute("href") ?? dynasty.getAttribute("href")).toBe("/1");
    expect(redraft).toHaveAttribute("data-disabled");
    // A disabled option must not stay navigable — no anchor at all.
    expect(redraft.querySelector("a")).toBeNull();
    expect(redraft.tagName).not.toBe("A");
    expect(screen.getByText("Redraft leagues are not supported yet")).toBeInTheDocument();
  });
});

describe("TeamSwitcher league logo", () => {
  it("shows the league image once it loads, and the trophy until then", async () => {
    const logo = "https://sleepercdn.com/avatars/thumbs/abc";
    const { container } = render(<SidebarProvider><TeamSwitcher activeTeam={{ name: "Dynasty Club", plan: "2026 · Dynasty", logo }} teams={teams} /></SidebarProvider>);

    // The trophy holds the slot while the image is still in flight.
    expect(container.querySelector("svg.lucide-trophy")).not.toBeNull();
    const request = pending.find((entry) => entry.src === logo);
    expect(request).toBeDefined();

    // `alt=""` makes the image presentational, so it has no `img` role to query by.
    await act(async () => { request!.onload?.(); });
    await waitFor(() => expect(container.querySelector("img")).toHaveAttribute("src", logo));
    expect(container.querySelector("svg.lucide-trophy")).toBeNull();
  });

  // A league whose avatar 404s must not leave an empty badge.
  it("falls back to the trophy when the league image fails to load", async () => {
    const logo = "https://sleepercdn.com/avatars/thumbs/gone";
    const { container } = render(<SidebarProvider><TeamSwitcher activeTeam={{ name: "Dynasty Club", plan: "2026 · Dynasty", logo }} teams={[]} /></SidebarProvider>);

    await act(async () => { pending.find((entry) => entry.src === logo)!.onerror?.(); });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg.lucide-trophy")).not.toBeNull();
  });

  // Before the account loads there is no logo yet, so the trophy has to hold the slot.
  it("falls back to the trophy when the league has no logo", () => {
    const { container } = render(<SidebarProvider><TeamSwitcher activeTeam={{ name: "Dynasty Club", plan: "2026 · Dynasty" }} teams={[]} /></SidebarProvider>);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg.lucide-trophy")).not.toBeNull();
  });

  // The collapsed rail is only 8 units wide. The logo has to be the child that survives the
  // squeeze — the name and the chevron are the ones that drop out.
  it("keeps the logo, not the chevron, when the sidebar collapses to icons", () => {
    const logo = "https://sleepercdn.com/avatars/thumbs/abc";
    const { container } = render(<SidebarProvider><TeamSwitcher activeTeam={{ name: "Dynasty Club", plan: "2026 · Dynasty", logo }} teams={teams} /></SidebarProvider>);

    const badge = container.querySelector("[data-slot=avatar]")!.closest("div")!;
    expect(badge.className).toContain("shrink-0");
    expect(badge.className).not.toContain("group-data-[collapsible=icon]:hidden");

    const chevron = container.querySelector("svg.lucide-chevrons-up-down")!;
    expect(chevron.getAttribute("class")).toContain("group-data-[collapsible=icon]:hidden");
    expect(screen.getByText("Dynasty Club").parentElement!.className).toContain(
      "group-data-[collapsible=icon]:hidden"
    );
  });

  // The badge used to sit on a filled `bg-sidebar-primary` plate, which showed as a colored
  // square around every logo.
  it("renders the logo without a colored backing plate", () => {
    const { container } = render(<SidebarProvider><TeamSwitcher activeTeam={{ name: "Dynasty Club", plan: "2026 · Dynasty", logo: "https://sleepercdn.com/avatars/thumbs/abc" }} teams={[]} /></SidebarProvider>);
    const badge = container.querySelector("[data-slot=avatar]")!.closest("div")!;
    expect(badge.className).not.toContain("bg-sidebar-primary");
  });
});
