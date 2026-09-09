import { AmbulanceIcon, BinocularsIcon, BookOpenIcon, ClipboardListIcon, LayoutDashboardIcon, ScaleIcon, TrophyIcon, UsersIcon, type LucideIcon } from "lucide-react";

// `segment` matches what useSelectedLayoutSegment() reports under the [leagueId] layout;
// null is the index route (Dashboard).
// Every entry renders for every league format. Pages that quote player values quote them in the
// league's own basis (`src/lib/value-basis.ts`) rather than hiding themselves.
export type NavEntry = { title: string; segment: string | null; icon: LucideIcon };

export const mainNav: NavEntry[] = [
  { title: "Dashboard", segment: null, icon: LayoutDashboardIcon },
  { title: "League", segment: "league", icon: TrophyIcon },
  { title: "Players", segment: "players", icon: UsersIcon },
  { title: "Draft", segment: "draft", icon: ClipboardListIcon },
];

export const toolsNav: NavEntry[] = [
  { title: "Trade Calculator", segment: "trade", icon: ScaleIcon },
  { title: "Scouting Report", segment: "scouting-report", icon: BinocularsIcon },
  { title: "Injury Report", segment: "injuries", icon: AmbulanceIcon },
  { title: "Resources", segment: "resources", icon: BookOpenIcon },
];

export function navTitle(segment: string | null): string {
  if (segment === "matchups") return "Matchups";
  if (segment === "teams") return "Team";
  return [...mainNav, ...toolsNav].find((entry) => entry.segment === segment)?.title ?? "Dashboard";
}
